// database/init.js
// MongoDB initialization - runs on first container start

db = db.getSiblingDB('project-dropzone');

// Create collections with validators
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: { bsonType: 'string', minLength: 3, maxLength: 20 },
        email: { bsonType: 'string' },
        password: { bsonType: 'string' },
      }
    }
  }
});

db.createCollection('matches');

// Indexes for users
db.users.createIndex({ username: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ 'stats.wins': -1 });
db.users.createIndex({ 'stats.kills': -1 });
db.users.createIndex({ 'stats.kd_ratio': -1 });
db.users.createIndex({ last_seen: -1 });

// Indexes for matches
db.matches.createIndex({ match_id: 1 }, { unique: true });
db.matches.createIndex({ started_at: -1 });
db.matches.createIndex({ winner_id: 1 });
db.matches.createIndex({ 'players.user_id': 1 });

print('Project Dropzone database initialized successfully');
