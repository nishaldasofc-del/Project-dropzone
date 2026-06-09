// client/src/core/Game.js
import * as THREE from 'three';
import { NetworkManager } from '../network/NetworkManager.js';
import { AuthManager } from '../ui/AuthManager.js';
import { UIManager } from '../ui/UIManager.js';
import { InputManager } from './InputManager.js';
import { Renderer } from './Renderer.js';
import { World } from './World.js';
import { PlayerController } from './PlayerController.js';
import { RemotePlayerManager } from '../systems/RemotePlayerManager.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { ZoneRenderer } from '../systems/ZoneRenderer.js';
import { VehicleManager } from '../systems/VehicleManager.js';
import { AudioManager } from '../systems/AudioManager.js';
import { MinimapRenderer } from '../ui/MinimapRenderer.js';
import { HUD } from '../ui/HUD.js';
import { NETWORK_EVENTS, MATCH_STATES, PLAYER_STATES } from '@dropzone/shared';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.running = false;
    this.matchActive = false;
    this.localPlayerId = null;
    this.localPlayerState = null;
    this.matchState = MATCH_STATES.WAITING;
    this.frameId = null;
    this.lastTime = 0;
    this.deltaTime = 0;

    // Sub-systems (initialized in init())
    this.renderer = null;
    this.world = null;
    this.network = null;
    this.auth = null;
    this.ui = null;
    this.input = null;
    this.player = null;
    this.remotePlayers = null;
    this.weapons = null;
    this.loot = null;
    this.zone = null;
    this.vehicles = null;
    this.audio = null;
    this.minimap = null;
    this.hud = null;
  }

  async init() {
    // Core renderer
    this.renderer = new Renderer(this.canvas);

    // Network
    this.network = new NetworkManager();

    // UI
    this.ui = new UIManager(this);
    this.auth = new AuthManager(this);

    // Input
    this.input = new InputManager(this.canvas);

    // World (Three.js scene, terrain, buildings)
    this.world = new World(this.renderer.scene, this.renderer.camera);

    // Game systems
    this.remotePlayers = new RemotePlayerManager(this.renderer.scene);
    this.weapons = new WeaponSystem(this.renderer.scene, this.renderer.camera);
    this.loot = new LootSystem(this.renderer.scene);
    this.zone = new ZoneRenderer(this.renderer.scene);
    this.vehicles = new VehicleManager(this.renderer.scene);
    this.audio = new AudioManager(this.renderer.camera);
    this.hud = new HUD(this);
    this.minimap = new MinimapRenderer(this);

    // Player controller (depends on world, input, weapons)
    this.player = new PlayerController(this);

    // Wire up network events
    this.setupNetworkEvents();

    // Resize handler
    window.addEventListener('resize', () => this.renderer.resize(), { passive: true });

    return this;
  }

  setupNetworkEvents() {
    const net = this.network;

    net.on(NETWORK_EVENTS.AUTH_SUCCESS, (data) => {
      this.localPlayerId = data.playerId;
      this.ui.onAuthSuccess(data);
    });

    net.on(NETWORK_EVENTS.LOBBY_STATE, (data) => {
      this.ui.onLobbyState(data);
    });

    net.on(NETWORK_EVENTS.LOBBY_PLAYER_JOIN, (data) => {
      this.ui.onLobbyPlayerJoin(data);
    });

    net.on(NETWORK_EVENTS.LOBBY_PLAYER_LEAVE, (data) => {
      this.ui.onLobbyPlayerLeave(data);
    });

    net.on(NETWORK_EVENTS.LOBBY_COUNTDOWN, (data) => {
      this.ui.onLobbyCountdown(data);
    });

    net.on(NETWORK_EVENTS.MATCH_START, (data) => {
      this.onMatchStart(data);
    });

    net.on(NETWORK_EVENTS.MATCH_END, (data) => {
      this.onMatchEnd(data);
    });

    net.on(NETWORK_EVENTS.AIRPLANE_STATE, (data) => {
      this.world.updateAirplane(data);
      this.hud.updateParachuteHUD(this.localPlayerState);
    });

    net.on(NETWORK_EVENTS.PLAYERS_UPDATE, (data) => {
      this.onPlayersUpdate(data);
    });

    net.on(NETWORK_EVENTS.PLAYER_HIT, (data) => {
      this.onPlayerHit(data);
    });

    net.on(NETWORK_EVENTS.PLAYER_DEATH, (data) => {
      this.onPlayerDeath(data);
    });

    net.on(NETWORK_EVENTS.KILL_FEED, (data) => {
      this.hud.addKillFeedEntry(data);
    });

    net.on(NETWORK_EVENTS.PLAYERS_REMAINING, (data) => {
      this.hud.updatePlayersRemaining(data.count);
    });

    net.on(NETWORK_EVENTS.WEAPON_FIRE, (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.weapons.showRemoteFire(data);
      }
    });

    net.on(NETWORK_EVENTS.WEAPON_RELOAD, (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.remotePlayers.playReloadAnimation(data.playerId);
      }
    });

    net.on(NETWORK_EVENTS.INVENTORY_UPDATE, (data) => {
      this.player.onInventoryUpdate(data);
      this.hud.updateWeaponHUD(this.player);
    });

    net.on(NETWORK_EVENTS.LOOT_SPAWN, (data) => {
      this.loot.spawnItem(data.item);
    });

    net.on(NETWORK_EVENTS.LOOT_DESPAWN, (data) => {
      this.loot.removeItem(data.itemId);
    });

    net.on(NETWORK_EVENTS.ZONE_UPDATE, (data) => {
      this.zone.updateZone(data);
      this.hud.updateZoneTimer(data);
    });

    net.on(NETWORK_EVENTS.ZONE_DAMAGE, (data) => {
      if (this.localPlayerState) {
        this.localPlayerState.health = data.healthRemaining;
        this.hud.updateHealth(data.healthRemaining, this.localPlayerState.armor);
        this.hud.flashDamage();
      }
    });

    net.on(NETWORK_EVENTS.ZONE_WARNING, () => {
      this.hud.showZoneWarning();
    });

    net.on(NETWORK_EVENTS.VEHICLE_ENTER, (data) => {
      this.vehicles.onPlayerEnter(data);
      if (data.playerId === this.localPlayerId) {
        this.player.onEnterVehicle(data.vehicleId, data.seat);
      }
    });

    net.on(NETWORK_EVENTS.VEHICLE_EXIT, (data) => {
      this.vehicles.onPlayerExit(data);
      if (data.playerId === this.localPlayerId) {
        this.player.onExitVehicle();
      }
    });

    net.on(NETWORK_EVENTS.VEHICLE_STATE, (data) => {
      this.vehicles.updateVehicles(data);
    });

    net.on(NETWORK_EVENTS.PLAYER_JUMP, (data) => {
      if (data.playerId !== this.localPlayerId) {
        this.remotePlayers.onPlayerJump(data.playerId, data.position);
      }
    });

    net.on(NETWORK_EVENTS.CHAT_MESSAGE, (data) => {
      this.hud.addChatMessage(data);
    });
  }

  // ============================================================
  // MATCH LIFECYCLE
  // ============================================================

  async onMatchStart(data) {
    this.matchState = MATCH_STATES.AIRPLANE;
    this.matchActive = true;

    // Build world from map seed
    await this.world.buildMap(data.mapSeed);

    // Spawn loot
    if (data.lootSpawns) {
      for (const item of data.lootSpawns) {
        this.loot.spawnItem(item);
      }
    }

    // Spawn vehicles
    if (data.vehicleSpawns) {
      for (const v of data.vehicleSpawns) {
        this.vehicles.spawnVehicle(v);
      }
    }

    // Setup airplane
    this.world.setupAirplane(data.airplanePath);

    // Init local player in airplane state
    this.player.enterAirplane();
    this.localPlayerState = {
      state: PLAYER_STATES.IN_AIRPLANE,
      health: 100, armor: 0, boost: 0,
      position: { x: 0, y: 600, z: 0 },
    };

    // Show game
    this.ui.showScreen('game');
    this.hud.show();

    // Start game loop
    this.startGameLoop();
  }

  onMatchEnd(data) {
    this.matchActive = false;
    this.matchState = MATCH_STATES.ENDED;

    if (data.winner?.playerId === this.localPlayerId) {
      this.hud.showWinScreen(data, this.player);
    } else if (this.localPlayerState?.state !== PLAYER_STATES.DEAD) {
      // Still alive but match ended
      this.hud.showWinScreen(data, this.player);
    }

    // Stop game loop after a delay
    setTimeout(() => this.stopGameLoop(), 10000);
  }

  onPlayersUpdate(data) {
    for (const ps of data.players) {
      if (ps.id === this.localPlayerId) {
        // Server reconciliation for local player
        this.player.applyServerReconciliation(ps);
        this.localPlayerState = ps;
        this.hud.updateHealth(ps.health, ps.armor);
      } else {
        this.remotePlayers.updatePlayer(ps);
      }
    }

    // Update vehicles
    if (data.vehicles) {
      this.vehicles.updateVehicles(data.vehicles);
    }
  }

  onPlayerHit(data) {
    if (data.targetId === this.localPlayerId) {
      this.localPlayerState.health = data.healthRemaining;
      this.localPlayerState.armor = data.armorRemaining;
      this.hud.updateHealth(data.healthRemaining, data.armorRemaining);
      this.hud.flashDamage();
      this.hud.showHitIndicator();
      this.audio.playHit();
    } else if (data.shooterId === this.localPlayerId) {
      // We hit someone
      this.hud.showHitMarker(data.isHeadshot);
      this.audio.playHitMarker(data.isHeadshot);
    }
  }

  onPlayerDeath(data) {
    if (data.targetId === this.localPlayerId) {
      this.localPlayerState.state = PLAYER_STATES.DEAD;
      this.hud.showDeathScreen({
        killerName: data.killerName,
        kills: this.player.killCount,
        damage: this.player.damageDealt,
        survived: this.player.timeAlive,
      });
      this.player.die();
      this.input.setGameMode(false);
    } else {
      this.remotePlayers.onPlayerDeath(data.targetId);
    }
  }

  // ============================================================
  // GAME LOOP
  // ============================================================

  startGameLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.loop.bind(this));
  }

  stopGameLoop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  loop(timestamp) {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.loop.bind(this));

    this.deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(this.deltaTime);
    this.renderer.render();
  }

  update(dt) {
    if (!this.matchActive) return;

    // Update input
    this.input.update();

    // Update player
    this.player.update(dt);

    // Update remote players
    this.remotePlayers.update(dt);

    // Update vehicles
    this.vehicles.update(dt);

    // Update world (airplane, effects)
    this.world.update(dt);

    // Update loot (bobbing animation)
    this.loot.update(dt);

    // Update zone
    this.zone.update(dt);

    // Update weapon visuals
    this.weapons.update(dt);

    // Update audio
    this.audio.update(dt, this.player);

    // Update minimap
    this.minimap.update();

    // Check loot proximity
    this.loot.checkProximity(this.player.position, (nearbyItems) => {
      this.hud.showLootPrompt(nearbyItems);
    });

    // Send input to server
    this.sendPlayerInput();
  }

  sendPlayerInput() {
    if (!this.player.isAlive && this.player.state !== PLAYER_STATES.PARACHUTING) return;

    const input = this.input.getGameInput();
    input.seq = this.player.inputSeq++;
    input.timestamp = Date.now();
    input.yaw = this.player.yaw;
    input.pitch = this.player.pitch;

    this.network.emit(NETWORK_EVENTS.PLAYER_INPUT, input);
  }

  joinLobby() {
    this.network.emit(NETWORK_EVENTS.LOBBY_JOIN, {});
  }

  leaveLobby() {
    this.network.emit(NETWORK_EVENTS.LOBBY_LEAVE, {});
  }

  returnToMenu() {
    this.stopGameLoop();
    this.matchActive = false;
    this.world.reset();
    this.remotePlayers.reset();
    this.loot.reset();
    this.zone.reset();
    this.vehicles.reset();
    this.player.reset();
    this.hud.hide();
    this.leaveLobby();
    this.ui.showScreen('menu');
  }
}
