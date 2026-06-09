// server/src/network/SocketManager.js
import { verifySocketToken } from '../middleware/auth.js';
import { MatchManager } from '../game/MatchManager.js';
import { logger } from '../utils/logger.js';
import { NETWORK_EVENTS } from '@dropzone/shared';

export class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedPlayers = new Map(); // socketId -> { socket, user, matchId }

    io.use(this.authMiddleware.bind(this));
    io.on('connection', this.onConnection.bind(this));

    logger.info('SocketManager initialized');
  }

  async authMiddleware(socket, next) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const user = await verifySocketToken(token);
      socket.user = user;
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      logger.warn(`Socket auth failed: ${err.message}`);
      next(new Error('Authentication failed'));
    }
  }

  onConnection(socket) {
    const { user } = socket;
    logger.info(`Player connected: ${user.username} (${socket.id})`);

    // Store connection
    this.connectedPlayers.set(socket.id, {
      socket,
      user,
      matchId: null,
    });

    // Send initial state
    socket.emit(NETWORK_EVENTS.AUTH_SUCCESS, {
      playerId: socket.userId,
      username: user.username,
      profile: user.toPublicProfile(),
    });

    // Lobby events
    socket.on(NETWORK_EVENTS.LOBBY_JOIN, (data) => this.onLobbyJoin(socket, data));
    socket.on(NETWORK_EVENTS.LOBBY_LEAVE, () => this.onLobbyLeave(socket));

    // Game events - forwarded to match
    socket.on(NETWORK_EVENTS.PLAYER_INPUT, (data) => this.onPlayerInput(socket, data));
    socket.on(NETWORK_EVENTS.PLAYER_JUMP, () => this.onPlayerJump(socket));
    socket.on(NETWORK_EVENTS.PLAYER_DEPLOY_PARACHUTE, () => this.onDeployParachute(socket));
    socket.on(NETWORK_EVENTS.WEAPON_FIRE, (data) => this.onWeaponFire(socket, data));
    socket.on(NETWORK_EVENTS.WEAPON_RELOAD, () => this.onWeaponReload(socket));
    socket.on(NETWORK_EVENTS.WEAPON_SWITCH, (data) => this.onWeaponSwitch(socket, data));
    socket.on(NETWORK_EVENTS.ITEM_PICKUP, (data) => this.onItemPickup(socket, data));
    socket.on(NETWORK_EVENTS.ITEM_DROP, (data) => this.onItemDrop(socket, data));
    socket.on(NETWORK_EVENTS.ITEM_USE, (data) => this.onItemUse(socket, data));
    socket.on(NETWORK_EVENTS.VEHICLE_ENTER, (data) => this.onVehicleEnter(socket, data));
    socket.on(NETWORK_EVENTS.VEHICLE_EXIT, () => this.onVehicleExit(socket));
    socket.on(NETWORK_EVENTS.CHAT_MESSAGE, (data) => this.onChatMessage(socket, data));

    socket.on('disconnect', (reason) => this.onDisconnect(socket, reason));
    socket.on('error', (err) => logger.error(`Socket error for ${user.username}:`, err));
  }

  onLobbyJoin(socket, data) {
    const player = this.connectedPlayers.get(socket.id);
    if (!player) return;

    // Find or create a match in waiting state
    const match = MatchManager.findOrCreateMatch();
    match.addPlayer(socket, socket.user);
    player.matchId = match.matchId;

    socket.join(`match:${match.matchId}`);
    logger.info(`${socket.user.username} joined lobby ${match.matchId}`);
  }

  onLobbyLeave(socket) {
    this.leaveCurrentMatch(socket);
  }

  onPlayerInput(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handlePlayerInput(socket.userId, data);
  }

  onPlayerJump(socket) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handlePlayerJump(socket.userId);
  }

  onDeployParachute(socket) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleDeployParachute(socket.userId);
  }

  onWeaponFire(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleWeaponFire(socket.userId, data);
  }

  onWeaponReload(socket) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleWeaponReload(socket.userId);
  }

  onWeaponSwitch(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleWeaponSwitch(socket.userId, data);
  }

  onItemPickup(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleItemPickup(socket.userId, data);
  }

  onItemDrop(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleItemDrop(socket.userId, data);
  }

  onItemUse(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleItemUse(socket.userId, data);
  }

  onVehicleEnter(socket, data) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleVehicleEnter(socket.userId, data);
  }

  onVehicleExit(socket) {
    const match = this.getPlayerMatch(socket);
    if (match) match.handleVehicleExit(socket.userId);
  }

  onChatMessage(socket, data) {
    const player = this.connectedPlayers.get(socket.id);
    if (!player || !player.matchId) return;
    const match = MatchManager.getMatch(player.matchId);
    if (!match) return;

    const sanitized = String(data?.message || '').substring(0, 200).trim();
    if (!sanitized) return;

    this.io.to(`match:${player.matchId}`).emit(NETWORK_EVENTS.CHAT_MESSAGE, {
      playerId: socket.userId,
      username: socket.user.username,
      message: sanitized,
      timestamp: Date.now(),
    });
  }

  onDisconnect(socket, reason) {
    logger.info(`Player disconnected: ${socket.user?.username} (${reason})`);
    this.leaveCurrentMatch(socket);
    this.connectedPlayers.delete(socket.id);
  }

  leaveCurrentMatch(socket) {
    const player = this.connectedPlayers.get(socket.id);
    if (!player || !player.matchId) return;

    const match = MatchManager.getMatch(player.matchId);
    if (match) {
      match.removePlayer(socket.userId, socket);
    }
    socket.leave(`match:${player.matchId}`);
    player.matchId = null;
  }

  getPlayerMatch(socket) {
    const player = this.connectedPlayers.get(socket.id);
    if (!player || !player.matchId) return null;
    return MatchManager.getMatch(player.matchId);
  }
}
