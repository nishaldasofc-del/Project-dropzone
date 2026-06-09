// server/src/game/MatchManager.js
import { GameMatch } from './GameMatch.js';
import { logger } from '../utils/logger.js';
import { MATCH_STATES, GAME_CONFIG } from '@dropzone/shared';

class MatchManagerClass {
  constructor() {
    this.matches = new Map(); // matchId -> GameMatch
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  findOrCreateMatch() {
    // Find a waiting match with space
    for (const match of this.matches.values()) {
      if (
        match.state === MATCH_STATES.WAITING &&
        match.getPlayerCount() < GAME_CONFIG.MAX_PLAYERS
      ) {
        return match;
      }
    }
    // Create new match
    const match = new GameMatch();
    this.matches.set(match.matchId, match);
    logger.info(`Created new match: ${match.matchId}`);
    return match;
  }

  getMatch(matchId) {
    return this.matches.get(matchId) || null;
  }

  getActiveMatchCount() {
    let count = 0;
    for (const match of this.matches.values()) {
      if (match.state === MATCH_STATES.ACTIVE || match.state === MATCH_STATES.AIRPLANE) count++;
    }
    return count;
  }

  getTotalPlayerCount() {
    let total = 0;
    for (const match of this.matches.values()) {
      total += match.getPlayerCount();
    }
    return total;
  }

  cleanup() {
    const now = Date.now();
    for (const [matchId, match] of this.matches.entries()) {
      if (match.state === MATCH_STATES.ENDED && now - match.endedAt > 120000) {
        match.destroy();
        this.matches.delete(matchId);
        logger.info(`Cleaned up match: ${matchId}`);
      }
    }
  }

  shutdown() {
    clearInterval(this.cleanupInterval);
    for (const match of this.matches.values()) {
      match.destroy();
    }
    this.matches.clear();
  }
}

export const MatchManager = new MatchManagerClass();
