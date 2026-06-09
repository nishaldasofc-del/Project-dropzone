// server/src/db/models/Match.js
import mongoose from 'mongoose';

const playerResultSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  username: String,
  placement: Number,
  kills: Number,
  damage_dealt: Number,
  duration_alive: Number,
  headshots: Number,
  won: Boolean,
  death_cause: String,
  killer_id: mongoose.Schema.Types.ObjectId,
  killer_username: String,
  xp_earned: Number,
}, { _id: false });

const matchSchema = new mongoose.Schema({
  match_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  server_region: {
    type: String,
    default: 'us-east',
  },
  map_name: {
    type: String,
    default: 'Dropzone Island',
  },
  total_players: Number,
  duration: Number,
  winner_id: mongoose.Schema.Types.ObjectId,
  winner_username: String,
  winner_kills: Number,
  players: [playerResultSchema],
  started_at: Date,
  ended_at: Date,
  zone_phases_completed: { type: Number, default: 0 },
  total_kills: { type: Number, default: 0 },
  avg_survival_time: Number,
}, {
  timestamps: true,
});

matchSchema.index({ started_at: -1 });
matchSchema.index({ winner_id: 1 });

export const Match = mongoose.model('Match', matchSchema);
