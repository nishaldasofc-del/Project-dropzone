// server/src/game/GameMatch.js
import { v4 as uuidv4 } from 'uuid';
import {
  MATCH_STATES, PLAYER_STATES, GAME_CONFIG, MAP_CONFIG,
  NETWORK_EVENTS, PLAYER_CONFIG, ZONE_CONFIG, WEAPONS,
} from '@dropzone/shared';
import { Vec3, randomRange, randomInt, clamp, sanitizeInput, validatePlayerMovement, validateFireRate } from '@dropzone/shared';
import { ServerPlayer } from './ServerPlayer.js';
import { ZoneSystem } from './ZoneSystem.js';
import { LootSystem } from './LootSystem.js';
import { BulletSystem } from './BulletSystem.js';
import { VehicleSystem } from './VehicleSystem.js';
import { AirplaneSystem } from './AirplaneSystem.js';
import { ServerMap } from './ServerMap.js';
import { logger } from '../utils/logger.js';
import { Match } from '../db/models/Match.js';
import { User } from '../db/models/User.js';

const TICK_INTERVAL = 1000 / GAME_CONFIG.TICK_RATE;

export class GameMatch {
  constructor() {
    this.matchId = uuidv4();
    this.state = MATCH_STATES.WAITING;
    this.players = new Map();      // userId -> ServerPlayer
    this.sockets = new Map();      // userId -> socket
    this.spectators = new Map();   // userId -> socket

    this.map = new ServerMap();
    this.zone = new ZoneSystem(this.map);
    this.loot = new LootSystem(this.map);
    this.bullets = new BulletSystem(this.map, this.players);
    this.vehicles = new VehicleSystem(this.map);
    this.airplane = new AirplaneSystem();

    this.tick = 0;
    this.startTime = null;
    this.endedAt = null;
    this.countdownTimer = null;
    this.gameLoop = null;
    this.lobbyTimer = null;
    this.killFeed = [];

    // Lag compensation: store historical positions
    this.positionHistory = new Map(); // playerId -> [{ tick, pos, rot }]

    this.startLobbyTimer();
    logger.info(`Match ${this.matchId} created`);
  }

  // ============================================================
  // LOBBY MANAGEMENT
  // ============================================================

  startLobbyTimer() {
    this.lobbyTimer = setTimeout(() => {
      if (this.getAlivePlayerCount() >= GAME_CONFIG.MIN_PLAYERS_TO_START) {
        this.startCountdown();
      } else {
        this.startLobbyTimer(); // Wait more
      }
    }, GAME_CONFIG.LOBBY_WAIT_TIME);
  }

  addPlayer(socket, user) {
    if (this.players.has(socket.userId)) {
      // Reconnect
      this.sockets.set(socket.userId, socket);
      const player = this.players.get(socket.userId);
      player.connected = true;
      this.sendMatchStateToPlayer(socket, player);
      logger.info(`Player reconnected: ${user.username}`);
      return;
    }

    if (this.state !== MATCH_STATES.WAITING) {
      socket.emit(NETWORK_EVENTS.AUTH_ERROR, { error: 'Match already in progress' });
      return;
    }

    const player = new ServerPlayer(socket.userId, user.username, user);
    this.players.set(socket.userId, player);
    this.sockets.set(socket.userId, socket);

    // Announce to lobby
    this.broadcast(NETWORK_EVENTS.LOBBY_PLAYER_JOIN, {
      playerId: socket.userId,
      username: user.username,
      playerCount: this.players.size,
    });

    // Send current lobby state to joining player
    this.sendLobbyState(socket);

    logger.info(`${user.username} joined match ${this.matchId} (${this.players.size} players)`);

    // Auto-start if enough players
    if (this.players.size >= GAME_CONFIG.MIN_PLAYERS_TO_START && this.state === MATCH_STATES.WAITING) {
      this.startCountdown();
    }
  }

  removePlayer(userId, socket) {
    const player = this.players.get(userId);
    if (!player) return;

    if (this.state === MATCH_STATES.WAITING) {
      // Fully remove from lobby
      this.players.delete(userId);
      this.sockets.delete(userId);
      this.broadcast(NETWORK_EVENTS.LOBBY_PLAYER_LEAVE, {
        playerId: userId,
        username: player.username,
        playerCount: this.players.size,
      });
    } else {
      // During game, mark as disconnected but keep in match
      player.connected = false;
      this.sockets.delete(userId);
    }
  }

  sendLobbyState(socket) {
    const playerList = [];
    for (const [id, player] of this.players.entries()) {
      playerList.push({ playerId: id, username: player.username });
    }
    socket.emit(NETWORK_EVENTS.LOBBY_STATE, {
      matchId: this.matchId,
      players: playerList,
      playerCount: this.players.size,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      state: this.state,
    });
  }

  // ============================================================
  // MATCH FLOW
  // ============================================================

  startCountdown() {
    if (this.state !== MATCH_STATES.WAITING) return;
    clearTimeout(this.lobbyTimer);
    this.state = MATCH_STATES.COUNTDOWN;

    let countdown = GAME_CONFIG.COUNTDOWN_TIME / 1000;
    this.broadcast(NETWORK_EVENTS.LOBBY_COUNTDOWN, { seconds: countdown });

    this.countdownTimer = setInterval(() => {
      countdown--;
      this.broadcast(NETWORK_EVENTS.LOBBY_COUNTDOWN, { seconds: countdown });
      if (countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.startAirplane();
      }
    }, 1000);
  }

  startAirplane() {
    this.state = MATCH_STATES.AIRPLANE;
    this.loot.spawnAll();
    this.vehicles.spawnAll();

    const path = this.airplane.generatePath();
    this.broadcast(NETWORK_EVENTS.MATCH_START, {
      matchId: this.matchId,
      mapSeed: this.map.seed,
      airplanePath: path,
      lootSpawns: this.loot.getSpawnData(),
      vehicleSpawns: this.vehicles.getSpawnData(),
    });

    // Start game loop during airplane phase
    this.startGameLoop();

    // Transition to active after airplane crosses map
    this.airplaneTimeout = setTimeout(() => {
      // Force-drop any players still on airplane
      for (const [id, player] of this.players.entries()) {
        if (player.state === PLAYER_STATES.IN_AIRPLANE) {
          this.handlePlayerJump(id);
        }
      }
    }, this.airplane.flightDuration);
  }

  startActivePhase() {
    if (this.state === MATCH_STATES.ACTIVE) return;
    this.state = MATCH_STATES.ACTIVE;
    this.startTime = Date.now();
    this.zone.start();
    logger.info(`Match ${this.matchId} is now ACTIVE`);
  }

  startGameLoop() {
    let lastTick = Date.now();
    this.gameLoop = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      this.update(dt);
      this.tick++;
    }, TICK_INTERVAL);
  }

  update(dt) {
    if (this.state === MATCH_STATES.ENDED) return;

    // Update airplane
    if (this.state === MATCH_STATES.AIRPLANE) {
      const airState = this.airplane.update(dt);
      // Broadcast airplane position periodically
      if (this.tick % 3 === 0) {
        this.broadcast(NETWORK_EVENTS.AIRPLANE_STATE, airState);
      }

      // Check if all players have jumped
      const allJumped = [...this.players.values()].every(
        p => p.state !== PLAYER_STATES.IN_AIRPLANE
      );
      if (allJumped) this.startActivePhase();
    }

    // Update players
    for (const [id, player] of this.players.entries()) {
      if (!player.connected && player.state === PLAYER_STATES.ALIVE) {
        // Disconnected players become vulnerable
        continue;
      }
      player.update(dt, this.map);
    }

    // Store position history for lag compensation
    this.storePositionHistory();

    // Zone update
    if (this.state === MATCH_STATES.ACTIVE) {
      const zoneState = this.zone.update(dt);
      if (zoneState.changed) {
        this.broadcast(NETWORK_EVENTS.ZONE_UPDATE, zoneState.data);
      }

      // Apply zone damage
      if (zoneState.damaging) {
        this.applyZoneDamage();
      }
    }

    // Bullet updates
    this.bullets.update(dt);

    // Vehicle updates
    this.vehicles.update(dt);

    // Broadcast world state every tick
    this.broadcastWorldState();

    // Check win condition
    if (this.state === MATCH_STATES.ACTIVE) {
      this.checkWinCondition();
    }
  }

  storePositionHistory() {
    for (const [id, player] of this.players.entries()) {
      if (!this.positionHistory.has(id)) this.positionHistory.set(id, []);
      const history = this.positionHistory.get(id);
      history.push({
        tick: this.tick,
        timestamp: Date.now(),
        pos: { ...player.position },
        rot: player.rotation,
      });
      // Keep ~200ms of history
      const maxHistory = Math.ceil(0.2 * GAME_CONFIG.TICK_RATE);
      while (history.length > maxHistory) history.shift();
    }
  }

  getHistoricalPosition(playerId, timestamp) {
    const history = this.positionHistory.get(playerId);
    if (!history || history.length === 0) {
      return this.players.get(playerId)?.position;
    }
    const now = Date.now();
    const targetTime = timestamp || now;
    // Find closest historical position
    let closest = history[history.length - 1];
    let minDiff = Infinity;
    for (const entry of history) {
      const diff = Math.abs(entry.timestamp - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = entry;
      }
    }
    return closest.pos;
  }

  // ============================================================
  // PLAYER INPUT HANDLING
  // ============================================================

  handlePlayerInput(userId, rawInput) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const input = sanitizeInput(rawInput);

    // Validate movement
    const prevPos = { ...player.position };
    player.applyInput(input, 1 / GAME_CONFIG.TICK_RATE, this.map);

    if (!validatePlayerMovement(prevPos, player.position, 1 / GAME_CONFIG.TICK_RATE, player.state)) {
      // Reset position on invalid movement
      player.position = prevPos;
      logger.warn(`Invalid movement from ${player.username}`);
    }

    player.lastInputSeq = input.seq;
  }

  handlePlayerJump(userId) {
    const player = this.players.get(userId);
    if (!player) return;

    if (player.state === PLAYER_STATES.IN_AIRPLANE) {
      const jumpPos = this.airplane.getJumpPosition(player.jumpQueueIndex || 0);
      player.startParachuting(jumpPos);
      this.broadcast(NETWORK_EVENTS.PLAYER_JUMP, {
        playerId: userId,
        position: jumpPos,
      });
    }
  }

  handleDeployParachute(userId) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.PARACHUTING) return;
    player.deployParachute();
  }

  // ============================================================
  // WEAPON SYSTEM
  // ============================================================

  handleWeaponFire(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const weapon = player.getCurrentWeapon();
    if (!weapon) return;
    if (weapon.ammo_in_mag <= 0) {
      this.sendToPlayer(userId, NETWORK_EVENTS.WEAPON_RELOAD, { forced: true });
      return;
    }
    if (weapon.isReloading) return;

    // Validate fire rate
    if (!validateFireRate(WEAPONS[weapon.id], weapon.lastFireTime, Date.now())) return;

    weapon.lastFireTime = Date.now();
    weapon.ammo_in_mag--;

    // Determine bullet origin and direction
    const origin = {
      x: player.position.x,
      y: player.position.y + (PLAYER_CONFIG.HEIGHT * 0.85),
      z: player.position.z,
    };
    const direction = data?.direction || { x: 0, y: 0, z: -1 };

    // Server-side raycasting with lag compensation
    const shootTime = data?.timestamp || Date.now();
    const hits = this.bullets.processBullet(
      userId, weapon, origin, direction, shootTime, this
    );

    // Process hits
    for (const hit of hits) {
      if (hit.type === 'player') {
        this.applyBulletDamage(userId, hit.targetId, hit.damage, hit.isHeadshot, hit.weaponId);
      } else if (hit.type === 'vehicle') {
        this.vehicles.applyDamage(hit.vehicleId, hit.damage);
      }
    }

    // Broadcast fire event (for visual effects)
    this.broadcast(NETWORK_EVENTS.WEAPON_FIRE, {
      playerId: userId,
      weaponId: weapon.id,
      origin,
      direction,
      hits: hits.map(h => ({ type: h.type, pos: h.position })),
    });

    // Confirm ammo state to shooter
    this.sendToPlayer(userId, NETWORK_EVENTS.INVENTORY_UPDATE, {
      type: 'ammo',
      weaponSlot: player.activeWeaponSlot,
      ammo_in_mag: weapon.ammo_in_mag,
      ammo_reserve: weapon.ammo_reserve,
    });
  }

  handleWeaponReload(userId) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;
    const result = player.startReload();
    if (!result) return;

    this.broadcast(NETWORK_EVENTS.WEAPON_RELOAD, {
      playerId: userId,
      weaponSlot: player.activeWeaponSlot,
    });

    // Complete reload after reload time
    setTimeout(() => {
      if (!this.players.has(userId)) return;
      const ammoAdded = player.completeReload();
      this.sendToPlayer(userId, NETWORK_EVENTS.INVENTORY_UPDATE, {
        type: 'reload_complete',
        weaponSlot: player.activeWeaponSlot,
        ammo_in_mag: player.getCurrentWeapon()?.ammo_in_mag,
        ammo_reserve: player.getCurrentWeapon()?.ammo_reserve,
      });
    }, WEAPONS[player.getCurrentWeapon()?.id]?.reload_time || 2000);
  }

  handleWeaponSwitch(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const slotIndex = typeof data?.slot === 'number' ? data.slot : 0;
    player.switchWeapon(slotIndex);

    this.broadcast(NETWORK_EVENTS.WEAPON_SWITCH, {
      playerId: userId,
      slot: player.activeWeaponSlot,
    });
  }

  // ============================================================
  // DAMAGE SYSTEM
  // ============================================================

  applyBulletDamage(shooterId, targetId, baseDamage, isHeadshot, weaponId) {
    const target = this.players.get(targetId);
    const shooter = this.players.get(shooterId);
    if (!target || target.state === PLAYER_STATES.DEAD) return;

    let damage = baseDamage;
    if (isHeadshot) {
      damage *= WEAPONS[weaponId]?.headshot_multiplier || 2.0;
      // Reduce damage if target has helmet
      if (target.inventory.helmet) {
        damage *= (1 - target.inventory.helmet.headshot_reduction);
      }
    }

    // Apply armor
    const armorAbsorption = 0.55;
    if (target.armor > 0) {
      const absorbedByArmor = Math.min(damage * armorAbsorption, target.armor);
      target.armor -= absorbedByArmor;
      damage -= absorbedByArmor;
    }

    damage = Math.ceil(damage);
    target.health -= damage;

    // Update shooter stats
    if (shooter) {
      shooter.damageDealt += damage;
      if (isHeadshot) shooter.headshotCount++;
    }

    // Broadcast hit
    this.broadcast(NETWORK_EVENTS.PLAYER_HIT, {
      targetId,
      shooterId,
      damage,
      isHeadshot,
      healthRemaining: Math.max(0, target.health),
      armorRemaining: Math.max(0, target.armor),
    });

    if (target.health <= 0) {
      this.knockDownOrKillPlayer(target, shooter);
    }
  }

  knockDownOrKillPlayer(target, killer) {
    target.health = 0;
    target.state = PLAYER_STATES.DEAD;

    const killerId = killer?.userId || null;
    const killerName = killer?.username || 'Zone';

    if (killer) {
      killer.killCount++;
      killer.killStreak++;
    }

    // Add to kill feed
    const killEntry = {
      killerName,
      targetName: target.username,
      weaponId: killer?.getCurrentWeapon()?.id || 'zone',
      isHeadshot: false,
      timestamp: Date.now(),
    };
    this.killFeed.unshift(killEntry);
    if (this.killFeed.length > 10) this.killFeed.pop();

    this.broadcast(NETWORK_EVENTS.PLAYER_DEATH, {
      targetId: target.userId,
      killerId,
      killerName,
      targetName: target.username,
      weaponId: killer?.getCurrentWeapon()?.id || 'zone',
    });

    this.broadcast(NETWORK_EVENTS.KILL_FEED, killEntry);

    // Drop loot
    this.loot.dropPlayerLoot(target);

    // Update alive count
    const aliveCount = this.getAlivePlayerCount();
    this.broadcast(NETWORK_EVENTS.PLAYERS_REMAINING, { count: aliveCount });

    logger.info(`${target.username} was eliminated by ${killerName}`);
  }

  applyZoneDamage() {
    for (const [id, player] of this.players.entries()) {
      if (player.state !== PLAYER_STATES.ALIVE) continue;
      if (this.zone.isPlayerInSafeZone(player.position)) continue;

      const damage = this.zone.getCurrentDamage();
      player.health -= damage;

      this.sendToPlayer(id, NETWORK_EVENTS.ZONE_DAMAGE, {
        damage,
        healthRemaining: Math.max(0, player.health),
      });

      if (player.health <= 0) {
        this.knockDownOrKillPlayer(player, null);
      }
    }
  }

  // ============================================================
  // INVENTORY SYSTEM
  // ============================================================

  handleItemPickup(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const { itemId } = data;
    const lootItem = this.loot.getItem(itemId);
    if (!lootItem) return;

    // Validate proximity
    const dist = Vec3.distance(player.position, lootItem.position);
    if (dist > 3.5) return; // Too far away

    const success = player.inventory.addItem(lootItem);
    if (!success) {
      this.sendToPlayer(userId, NETWORK_EVENTS.INVENTORY_UPDATE, {
        type: 'full',
        message: 'Inventory full',
      });
      return;
    }

    this.loot.removeItem(itemId);
    this.broadcast(NETWORK_EVENTS.LOOT_DESPAWN, { itemId });
    this.sendToPlayer(userId, NETWORK_EVENTS.ITEM_PICKUP, {
      itemId,
      item: lootItem,
      inventory: player.inventory.serialize(),
    });
  }

  handleItemDrop(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const { itemType, itemId, quantity } = data;
    const dropped = player.inventory.removeItem(itemType, itemId, quantity);
    if (!dropped) return;

    const dropPos = {
      x: player.position.x + (Math.random() - 0.5) * 2,
      y: player.position.y,
      z: player.position.z + (Math.random() - 0.5) * 2,
    };

    const lootId = this.loot.spawnItem(dropped, dropPos);
    this.broadcast(NETWORK_EVENTS.LOOT_SPAWN, {
      itemId: lootId,
      item: { ...dropped, position: dropPos },
    });

    this.sendToPlayer(userId, NETWORK_EVENTS.INVENTORY_UPDATE, {
      type: 'item_dropped',
      inventory: player.inventory.serialize(),
    });
  }

  handleItemUse(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const { itemType } = data;
    const result = player.useItem(itemType);
    if (!result) return;

    this.sendToPlayer(userId, NETWORK_EVENTS.INVENTORY_UPDATE, {
      type: 'item_used',
      itemType,
      health: player.health,
      armor: player.armor,
      inventory: player.inventory.serialize(),
    });
  }

  // ============================================================
  // VEHICLE SYSTEM
  // ============================================================

  handleVehicleEnter(userId, data) {
    const player = this.players.get(userId);
    if (!player || player.state !== PLAYER_STATES.ALIVE) return;

    const { vehicleId } = data;
    const vehicle = this.vehicles.getVehicle(vehicleId);
    if (!vehicle) return;

    const dist = Vec3.distance(player.position, vehicle.position);
    if (dist > 5.0) return;

    const seat = vehicle.addPassenger(userId);
    if (seat === -1) return;

    player.inVehicle = vehicleId;
    player.vehicleSeat = seat;

    this.broadcast(NETWORK_EVENTS.VEHICLE_ENTER, {
      vehicleId,
      playerId: userId,
      seat,
    });
  }

  handleVehicleExit(userId) {
    const player = this.players.get(userId);
    if (!player || !player.inVehicle) return;

    const vehicle = this.vehicles.getVehicle(player.inVehicle);
    if (vehicle) {
      vehicle.removePassenger(userId);
      // Eject player next to vehicle
      player.position = {
        x: vehicle.position.x + 3,
        y: vehicle.position.y + 0.5,
        z: vehicle.position.z + 3,
      };
    }

    const vehicleId = player.inVehicle;
    player.inVehicle = null;
    player.vehicleSeat = -1;

    this.broadcast(NETWORK_EVENTS.VEHICLE_EXIT, {
      vehicleId,
      playerId: userId,
    });
  }

  // ============================================================
  // BROADCAST / SEND
  // ============================================================

  broadcastWorldState() {
    const playerStates = [];
    for (const [id, player] of this.players.entries()) {
      if (player.state === PLAYER_STATES.DEAD) continue;
      playerStates.push(player.getNetworkState());
    }

    const vehicleStates = this.vehicles.getNetworkStates();

    // Only broadcast if there are players
    if (playerStates.length === 0) return;

    const msg = {
      tick: this.tick,
      timestamp: Date.now(),
      players: playerStates,
      vehicles: vehicleStates,
    };

    this.broadcast(NETWORK_EVENTS.PLAYERS_UPDATE, msg);
  }

  sendMatchStateToPlayer(socket, player) {
    socket.emit(NETWORK_EVENTS.MATCH_STATE, {
      matchId: this.matchId,
      state: this.state,
      tick: this.tick,
      zone: this.zone.getState(),
      playerState: player.serialize(),
      loot: this.loot.getActiveItems(),
      vehicles: this.vehicles.getSpawnData(),
    });
  }

  broadcast(event, data) {
    for (const [userId, socket] of this.sockets.entries()) {
      socket.emit(event, data);
    }
  }

  sendToPlayer(userId, event, data) {
    const socket = this.sockets.get(userId);
    if (socket) socket.emit(event, data);
  }

  // ============================================================
  // WIN CONDITION
  // ============================================================

  checkWinCondition() {
    // Don't evaluate win condition while players are still dropping in —
    // a jump transitions them OUT of ALIVE briefly, which reads as 0 alive players.
    const anyStillDropping = [...this.players.values()].some(
      p => p.state === PLAYER_STATES.IN_AIRPLANE || p.state === PLAYER_STATES.PARACHUTING
    );
    if (anyStillDropping) return;

    const alivePlayers = [...this.players.values()].filter(
      p => p.state === PLAYER_STATES.ALIVE
    );

    if (alivePlayers.length <= 1) {
      this.endMatch(alivePlayers[0] || null);
    }
  }

  async endMatch(winner) {
    if (this.state === MATCH_STATES.ENDED) return;
    this.state = MATCH_STATES.ENDED;
    this.endedAt = Date.now();
    clearInterval(this.gameLoop);
    clearTimeout(this.airplaneTimeout);
    this.zone.stop();

    const duration = this.startTime ? (Date.now() - this.startTime) : 0;

    this.broadcast(NETWORK_EVENTS.MATCH_END, {
      winner: winner ? {
        playerId: winner.userId,
        username: winner.username,
        kills: winner.killCount,
      } : null,
      matchId: this.matchId,
      duration,
    });

    // Save match to DB
    await this.saveMatchResults(winner, duration);
    logger.info(`Match ${this.matchId} ended. Winner: ${winner?.username || 'nobody'}`);
  }

  async saveMatchResults(winner, duration) {
    try {
      const playersSorted = [...this.players.values()].sort((a, b) => {
        if (winner && a.userId === winner.userId) return -1;
        if (winner && b.userId === winner.userId) return 1;
        return b.killCount - a.killCount;
      });

      const playerResults = playersSorted.map((p, index) => ({
        user_id: p.userDbId,
        username: p.username,
        placement: index + 1,
        kills: p.killCount,
        damage_dealt: p.damageDealt,
        duration_alive: p.timeAlive,
        headshots: p.headshotCount,
        won: winner && p.userId === winner.userId,
        xp_earned: this.calculateXP(p, index + 1),
      }));

      await Match.create({
        match_id: this.matchId,
        total_players: this.players.size,
        duration,
        winner_id: winner?.userDbId || null,
        winner_username: winner?.username || null,
        winner_kills: winner?.killCount || 0,
        players: playerResults,
        started_at: new Date(this.startTime),
        ended_at: new Date(this.endedAt),
        total_kills: [...this.players.values()].reduce((sum, p) => sum + p.killCount, 0),
      });

      // Update player stats
      for (const result of playerResults) {
        if (!result.user_id) continue;
        await User.findByIdAndUpdate(result.user_id, {
          $inc: {
            'stats.kills': result.kills,
            'stats.matches_played': 1,
            'stats.damage_dealt': result.damage_dealt,
            'stats.headshots': result.headshots,
            ...(result.won ? { 'stats.wins': 1 } : {}),
            ...(result.placement <= 10 ? { 'stats.top10': 1 } : {}),
          },
          $max: {
            'stats.best_kill_streak': result.kills,
          },
          $set: {
            last_seen: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error('Failed to save match results:', err);
    }
  }

  calculateXP(player, placement) {
    let xp = 100; // participation
    xp += player.killCount * 50;
    xp += player.headshotCount * 25;
    xp += Math.floor(player.damageDealt * 0.5);
    if (placement === 1) xp += 500;
    else if (placement <= 5) xp += 200;
    else if (placement <= 10) xp += 100;
    return xp;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  getPlayerCount() {
    return this.players.size;
  }

  getAlivePlayerCount() {
    return [...this.players.values()].filter(
      p => p.state === PLAYER_STATES.ALIVE || p.state === PLAYER_STATES.IN_AIRPLANE || p.state === PLAYER_STATES.PARACHUTING
    ).length;
  }

  destroy() {
    clearInterval(this.gameLoop);
    clearInterval(this.countdownTimer);
    clearTimeout(this.lobbyTimer);
    clearTimeout(this.airplaneTimeout);
    this.zone.stop();
    this.players.clear();
    this.sockets.clear();
  }
}
