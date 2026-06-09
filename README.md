# Project Dropzone

A production-ready mobile-first multiplayer 3D battle royale game built with Three.js, Node.js, Socket.IO, and MongoDB.

## Architecture

```
project-dropzone/
├── client/                    # Three.js frontend (Vite)
│   └── src/
│       ├── core/              # Game loop, renderer, input, world, player
│       ├── systems/           # Weapons, loot, zone, vehicles, audio
│       ├── ui/                # HUD, auth, minimap, UI manager
│       └── network/           # Socket.IO client wrapper
├── server/                    # Node.js + Express + Socket.IO
│   └── src/
│       ├── game/              # Authoritative game simulation
│       │   ├── GameMatch.js       # Core match orchestrator
│       │   ├── MatchManager.js    # Match lifecycle management
│       │   ├── ServerPlayer.js    # Server-side player state
│       │   ├── BulletSystem.js    # Raycasting + lag compensation
│       │   ├── ZoneSystem.js      # Safe zone management
│       │   ├── LootSystem.js      # World loot spawning
│       │   ├── VehicleSystem.js   # Vehicle physics
│       │   ├── AirplaneSystem.js  # Airplane flight path
│       │   └── ServerMap.js       # Server-side heightmap
│       ├── network/           # Socket.IO connection management
│       ├── routes/            # REST API (auth, profiles, leaderboard)
│       ├── db/                # MongoDB models and connection
│       ├── middleware/        # JWT auth
│       └── utils/             # Logger
├── shared/                    # Constants, math, validation (client+server)
├── docker/                    # Dockerfile.server, Dockerfile.client, nginx.conf
├── database/                  # MongoDB init scripts
└── docker-compose.yml
```

## Features

- **64-player battle royale** matches with server-authoritative physics
- **Airplane drop system** with freefall and parachute deployment
- **7 weapons**: AKM, M4, UMP, Vector, Pump Shotgun, Sniper, Pistol
- **Full loot system**: weapons, ammo, medical, armor, backpacks
- **Shrinking safe zone** with 7 phases and zone damage
- **Vehicles**: Jeep (4-seat) and Motorcycle (2-seat)
- **Mobile-first UI**: dual virtual joysticks, action buttons, HUD
- **Lag compensation**: 200ms position history buffer for server-side raycasting
- **Client-side prediction**: immediate movement response with server reconciliation
- **Accounts & stats**: registration, login, K/D, wins, leaderboard
- **Audio**: procedural Web Audio API (no asset files required)
- **Minimap** with zone, players, and loot indicators
- **Kill feed**, damage flash, hit markers, crosshair

## Quick Start (Development)

```bash
# Prerequisites: Node.js 20+, MongoDB running locally

git clone <repo>
cd project-dropzone

# Install all dependencies
npm install

# Start development (server + client with hot-reload)
npm run dev
# Server: http://localhost:3000
# Client: http://localhost:5173
```

## Production (Docker)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env with your secrets

# 2. Build the client
cd client && npm run build && cd ..

# 3. Launch with Docker Compose
npm run docker:up

# Game available at http://localhost:80
```

## Networking Protocol

### Client → Server
| Event | Payload | Rate |
|-------|---------|------|
| `player:input` | `{ forward, backward, left, right, jump, crouch, sprint, fire, ads, yaw, pitch, seq, timestamp }` | 20Hz |
| `weapon:fire` | `{ direction, timestamp }` | On fire |
| `weapon:reload` | — | On R key |
| `weapon:switch` | `{ slot }` | On slot change |
| `player:jump` | — | Once from airplane |
| `item:pickup` | `{ itemId }` | On interact |
| `vehicle:enter` | `{ vehicleId }` | On approach |

### Server → Client
| Event | Payload | Rate |
|-------|---------|------|
| `players:update` | `{ tick, players[], vehicles[] }` | 20Hz |
| `zone:update` | Zone state | On change |
| `player:hit` | Damage info | On hit |
| `kill:feed` | Kill entry | On kill |
| `loot:spawn/despawn` | Item data | On change |

## Anti-Cheat

- **Server-authoritative**: all damage, movement validation, loot pickup validated server-side
- **Movement validation**: max speed check per tick, teleport detection
- **Fire rate validation**: 15% tolerance for latency
- **Lag compensation**: historical position lookup (max 200ms) for fair hit detection
- **JWT authentication**: all socket connections require valid token

## Performance Targets

| Device | Target FPS | Strategy |
|--------|-----------|----------|
| Low-end Android | 30 FPS | No shadows, low pixel ratio, no AA |
| Mid-range Android | 60 FPS | PCF shadows, 1.5x pixel ratio |
| Desktop | 60+ FPS | Full quality, 2x pixel ratio |

Optimizations:
- Frustum culling (Three.js built-in)
- Object LOD: loot items only animate within 150 units
- Minimap updates every 3 frames
- Network state interpolation buffer (100ms)
- Delta compression for player state

## Map Locations

| Location | Coordinates | Loot Density |
|----------|------------|-------------|
| Central Town | 0, 0 | High |
| Military Base | 1500, 1500 | Very High |
| Factory | -1200, 800 | High |
| Village N | 800, -900 | Medium |
| Village S | -700, -1100 | Medium |
| Forest | 400, 1200 | Low |
| Hills | -1500, -800 | Low |

## License

MIT
