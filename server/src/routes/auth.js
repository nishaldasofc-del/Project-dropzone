// server/src/routes/auth.js
import { Router } from 'express';
import { User } from '../db/models/User.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
    });
    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = generateToken(user._id);
    logger.info(`New user registered: ${username}`);

    res.status(201).json({
      token,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    logger.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await User.findOne({
      $or: [
        { username: new RegExp(`^${username}$`, 'i') },
        { email: username.toLowerCase() },
      ],
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account banned', reason: user.ban_reason });
    }

    user.last_seen = new Date();
    await user.save();

    const token = generateToken(user._id);
    logger.info(`User logged in: ${user.username}`);

    res.json({
      token,
      user: user.toPublicProfile(),
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user.toPublicProfile() });
});

router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({
      username: new RegExp(`^${req.params.username}$`, 'i'),
    });
    if (!user) return res.status(404).json({ error: 'Player not found' });
    res.json({ user: user.toPublicProfile() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const { sort = 'wins', limit = 50, skip = 0 } = req.query;
    const validSorts = ['wins', 'kills', 'kd_ratio', 'avg_damage'];
    const sortField = validSorts.includes(sort) ? `stats.${sort}` : 'stats.wins';

    const users = await User.find({ 'stats.matches_played': { $gt: 0 } })
      .sort({ [sortField]: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .skip(parseInt(skip))
      .select('username avatar level stats created_at');

    res.json({ users, total: users.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
