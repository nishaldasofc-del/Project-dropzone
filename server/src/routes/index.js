// server/src/routes/index.js
import authRouter from './auth.js';

export function setupRoutes(app) {
  app.use('/api/auth', authRouter);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });
}
