// server/src/db/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const statsSchema = new mongoose.Schema({
  kills:          { type: Number, default: 0 },
  deaths:         { type: Number, default: 0 },
  wins:           { type: Number, default: 0 },
  top10:          { type: Number, default: 0 },
  matches_played: { type: Number, default: 0 },
  damage_dealt:   { type: Number, default: 0 },
  headshots:      { type: Number, default: 0 },
  distance_traveled: { type: Number, default: 0 },
  time_survived:  { type: Number, default: 0 },
  longest_kill:   { type: Number, default: 0 },
  kd_ratio:       { type: Number, default: 0 },
  win_rate:       { type: Number, default: 0 },
  avg_damage:     { type: Number, default: 0 },
  best_kill_streak: { type: Number, default: 0 },
}, { _id: false });

const weaponStatsSchema = new mongoose.Schema({
  weapon_id: String,
  kills: { type: Number, default: 0 },
  shots_fired: { type: Number, default: 0 },
  shots_hit: { type: Number, default: 0 },
  headshots: { type: Number, default: 0 },
  damage_dealt: { type: Number, default: 0 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  avatar: {
    type: String,
    default: 'default',
  },
  level: {
    type: Number,
    default: 1,
  },
  xp: {
    type: Number,
    default: 0,
  },
  xp_next_level: {
    type: Number,
    default: 1000,
  },
  stats: {
    type: statsSchema,
    default: () => ({}),
  },
  weapon_stats: [weaponStatsSchema],
  match_history: [{
    match_id: String,
    placement: Number,
    kills: Number,
    damage: Number,
    duration: Number,
    won: Boolean,
    played_at: { type: Date, default: Date.now },
  }],
  is_banned: {
    type: Boolean,
    default: false,
  },
  ban_reason: String,
  last_seen: {
    type: Date,
    default: Date.now,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compute derived stats
userSchema.methods.updateDerivedStats = function() {
  const s = this.stats;
  s.kd_ratio = s.deaths > 0 ? parseFloat((s.kills / s.deaths).toFixed(2)) : s.kills;
  s.win_rate = s.matches_played > 0 ? parseFloat((s.wins / s.matches_played * 100).toFixed(1)) : 0;
  s.avg_damage = s.matches_played > 0 ? Math.round(s.damage_dealt / s.matches_played) : 0;
};

// Add XP and level up
userSchema.methods.addXP = function(amount) {
  this.xp += amount;
  while (this.xp >= this.xp_next_level) {
    this.xp -= this.xp_next_level;
    this.level += 1;
    this.xp_next_level = Math.floor(1000 * Math.pow(1.15, this.level - 1));
  }
};

// Public profile (no sensitive data)
userSchema.methods.toPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    avatar: this.avatar,
    level: this.level,
    xp: this.xp,
    xp_next_level: this.xp_next_level,
    stats: this.stats,
    created_at: this.created_at,
  };
};

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ 'stats.wins': -1 });
userSchema.index({ 'stats.kills': -1 });

export const User = mongoose.model('User', userSchema);
