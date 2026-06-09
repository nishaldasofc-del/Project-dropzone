// shared/src/constants.js
// All game constants shared between client and server

export const GAME_CONFIG = {
  MAX_PLAYERS: 64,
  MIN_PLAYERS_TO_START: 2,
  LOBBY_WAIT_TIME: 30000,       // 30 seconds
  COUNTDOWN_TIME: 10000,         // 10 seconds
  MATCH_MAX_DURATION: 1800000,   // 30 minutes
  TICK_RATE: 20,                 // Server ticks per second
  CLIENT_TICK_RATE: 60,          // Client update rate
  INTERPOLATION_DELAY: 100,      // ms interpolation buffer
  LAG_COMPENSATION_MAX: 200,     // max ms to compensate
};

export const MAP_CONFIG = {
  SIZE: 4096,
  GRID_CELL_SIZE: 64,
  MIN_HEIGHT: -10,
  MAX_HEIGHT: 200,
  AIRPLANE_ALTITUDE: 600,
  AIRPLANE_SPEED: 120,
  AIRPLANE_PATH_LENGTH: 5000,
};

export const PLAYER_CONFIG = {
  MOVE_SPEED: 5.5,
  SPRINT_SPEED: 9.0,
  CROUCH_SPEED: 2.5,
  JUMP_FORCE: 8.0,
  GRAVITY: -20.0,
  HEIGHT: 1.8,
  RADIUS: 0.4,
  CROUCH_HEIGHT: 1.1,
  MAX_HEALTH: 100,
  MAX_ARMOR: 100,
  MAX_FALL_DAMAGE_SPEED: 15,
  FALL_DAMAGE_MULTIPLIER: 5,
  PARACHUTE_DEPLOY_HEIGHT: 400,
  PARACHUTE_FALL_SPEED: 8,
  FREE_FALL_SPEED: 55,
  LAND_SPEED: 3,
};

export const ZONE_CONFIG = {
  PHASES: [
    { phase: 1, delay: 120000, duration: 60000, damage: 1,  shrinkTo: 0.75 },
    { phase: 2, delay: 90000,  duration: 45000, damage: 2,  shrinkTo: 0.55 },
    { phase: 3, delay: 60000,  duration: 30000, damage: 3,  shrinkTo: 0.35 },
    { phase: 4, delay: 45000,  duration: 25000, damage: 5,  shrinkTo: 0.20 },
    { phase: 5, delay: 30000,  duration: 20000, damage: 8,  shrinkTo: 0.10 },
    { phase: 6, delay: 20000,  duration: 15000, damage: 12, shrinkTo: 0.05 },
    { phase: 7, delay: 15000,  duration: 10000, damage: 20, shrinkTo: 0.01 },
  ],
  WARN_BEFORE: 30000,
  DAMAGE_INTERVAL: 1000,
};

export const WEAPONS = {
  AKM: {
    id: 'AKM',
    name: 'AKM',
    type: 'assault_rifle',
    damage: 47,
    headshot_multiplier: 2.5,
    fire_rate: 600,          // rounds per minute
    reload_time: 2400,       // ms
    magazine_size: 30,
    max_ammo: 180,
    bullet_speed: 850,       // m/s
    bullet_drop: 0.4,
    spread_base: 0.003,
    spread_ads: 0.001,
    recoil_vertical: 0.8,
    recoil_horizontal: 0.3,
    range_falloff_start: 100,
    range_falloff_end: 400,
    ammo_type: 'ammo_762',
    auto: true,
    ads_multiplier: 0.4,
  },
  M4: {
    id: 'M4',
    name: 'M4A1',
    type: 'assault_rifle',
    damage: 41,
    headshot_multiplier: 2.5,
    fire_rate: 750,
    reload_time: 2200,
    magazine_size: 30,
    max_ammo: 210,
    bullet_speed: 900,
    bullet_drop: 0.35,
    spread_base: 0.0025,
    spread_ads: 0.0008,
    recoil_vertical: 0.6,
    recoil_horizontal: 0.25,
    range_falloff_start: 150,
    range_falloff_end: 500,
    ammo_type: 'ammo_556',
    auto: true,
    ads_multiplier: 0.4,
  },
  UMP: {
    id: 'UMP',
    name: 'UMP45',
    type: 'smg',
    damage: 41,
    headshot_multiplier: 2.35,
    fire_rate: 480,
    reload_time: 2000,
    magazine_size: 25,
    max_ammo: 200,
    bullet_speed: 450,
    bullet_drop: 0.6,
    spread_base: 0.004,
    spread_ads: 0.0015,
    recoil_vertical: 0.5,
    recoil_horizontal: 0.2,
    range_falloff_start: 50,
    range_falloff_end: 200,
    ammo_type: 'ammo_45acp',
    auto: true,
    ads_multiplier: 0.5,
  },
  VECTOR: {
    id: 'VECTOR',
    name: 'Vector',
    type: 'smg',
    damage: 34,
    headshot_multiplier: 2.35,
    fire_rate: 1200,
    reload_time: 1900,
    magazine_size: 19,
    max_ammo: 190,
    bullet_speed: 420,
    bullet_drop: 0.65,
    spread_base: 0.005,
    spread_ads: 0.002,
    recoil_vertical: 0.4,
    recoil_horizontal: 0.3,
    range_falloff_start: 40,
    range_falloff_end: 150,
    ammo_type: 'ammo_45acp',
    auto: true,
    ads_multiplier: 0.5,
  },
  PUMP_SHOTGUN: {
    id: 'PUMP_SHOTGUN',
    name: 'Pump Shotgun',
    type: 'shotgun',
    damage: 220,
    headshot_multiplier: 1.5,
    fire_rate: 60,
    reload_time: 700,
    magazine_size: 5,
    max_ammo: 40,
    bullet_speed: 380,
    bullet_drop: 1.2,
    spread_base: 0.08,
    spread_ads: 0.04,
    pellets: 9,
    recoil_vertical: 2.0,
    recoil_horizontal: 0.1,
    range_falloff_start: 15,
    range_falloff_end: 60,
    ammo_type: 'ammo_12g',
    auto: false,
    ads_multiplier: 0.6,
  },
  SNIPER: {
    id: 'SNIPER',
    name: 'Kar98k',
    type: 'sniper',
    damage: 120,
    headshot_multiplier: 2.5,
    fire_rate: 45,
    reload_time: 3400,
    magazine_size: 5,
    max_ammo: 40,
    bullet_speed: 1200,
    bullet_drop: 0.15,
    spread_base: 0.001,
    spread_ads: 0.0002,
    recoil_vertical: 2.5,
    recoil_horizontal: 0.1,
    range_falloff_start: 400,
    range_falloff_end: 1200,
    ammo_type: 'ammo_762',
    auto: false,
    ads_multiplier: 0.15,
    scope_zoom: 6,
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'P1911',
    type: 'pistol',
    damage: 41,
    headshot_multiplier: 2.35,
    fire_rate: 300,
    reload_time: 1500,
    magazine_size: 7,
    max_ammo: 56,
    bullet_speed: 400,
    bullet_drop: 0.7,
    spread_base: 0.006,
    spread_ads: 0.002,
    recoil_vertical: 0.7,
    recoil_horizontal: 0.15,
    range_falloff_start: 30,
    range_falloff_end: 120,
    ammo_type: 'ammo_45acp',
    auto: false,
    ads_multiplier: 0.55,
  },
};

export const AMMO_TYPES = {
  ammo_762: { name: '7.62mm', color: 0xff6600, stack_size: 60 },
  ammo_556: { name: '5.56mm', color: 0xffcc00, stack_size: 60 },
  ammo_45acp: { name: '.45 ACP', color: 0x00ccff, stack_size: 50 },
  ammo_12g: { name: '12 Gauge', color: 0xff0066, stack_size: 20 },
};

export const ITEMS = {
  MEDKIT: {
    id: 'MEDKIT', name: 'Med Kit', type: 'healing',
    heal_amount: 100, use_time: 8000, stack_size: 1,
  },
  BANDAGE: {
    id: 'BANDAGE', name: 'Bandage', type: 'healing',
    heal_amount: 15, max_hp: 75, use_time: 4000, stack_size: 5,
  },
  ENERGY_DRINK: {
    id: 'ENERGY_DRINK', name: 'Energy Drink', type: 'boost',
    boost_amount: 40, use_time: 4000, stack_size: 3,
  },
  ARMOR_VEST: {
    id: 'ARMOR_VEST', name: 'Armor Vest', type: 'armor',
    armor_amount: 80, stack_size: 1,
  },
  BACKPACK: {
    id: 'BACKPACK', name: 'Backpack', type: 'backpack',
    capacity: 300, stack_size: 1,
  },
  HELMET: {
    id: 'HELMET', name: 'Combat Helmet', type: 'helmet',
    armor_amount: 80, headshot_reduction: 0.35, stack_size: 1,
  },
};

export const VEHICLES = {
  JEEP: {
    id: 'JEEP',
    name: 'UAZ',
    max_speed: 22,
    acceleration: 8,
    turn_speed: 1.8,
    braking: 15,
    max_health: 1000,
    seats: 4,
    mass: 1500,
    width: 2.2,
    height: 1.9,
    length: 4.2,
  },
  MOTORCYCLE: {
    id: 'MOTORCYCLE',
    name: 'Motorcycle',
    max_speed: 32,
    acceleration: 12,
    turn_speed: 3.0,
    braking: 18,
    max_health: 400,
    seats: 2,
    mass: 280,
    width: 0.9,
    height: 1.2,
    length: 2.1,
  },
};

export const NETWORK_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_REGISTER: 'auth:register',
  AUTH_SUCCESS: 'auth:success',
  AUTH_ERROR: 'auth:error',

  // Lobby
  LOBBY_JOIN: 'lobby:join',
  LOBBY_LEAVE: 'lobby:leave',
  LOBBY_STATE: 'lobby:state',
  LOBBY_PLAYER_JOIN: 'lobby:player_join',
  LOBBY_PLAYER_LEAVE: 'lobby:player_leave',
  LOBBY_COUNTDOWN: 'lobby:countdown',

  // Match
  MATCH_START: 'match:start',
  MATCH_END: 'match:end',
  MATCH_STATE: 'match:state',

  // Airplane
  AIRPLANE_STATE: 'airplane:state',
  PLAYER_JUMP: 'player:jump',
  PLAYER_DEPLOY_PARACHUTE: 'player:deploy_parachute',
  PLAYER_LAND: 'player:land',

  // Player
  PLAYER_INPUT: 'player:input',
  PLAYER_STATE: 'player:state',
  PLAYERS_UPDATE: 'players:update',
  PLAYER_HIT: 'player:hit',
  PLAYER_DEATH: 'player:death',
  PLAYER_KNOCKED: 'player:knocked',
  PLAYER_RESPAWN: 'player:respawn',
  KILL_FEED: 'kill:feed',
  PLAYERS_REMAINING: 'players:remaining',

  // Weapons
  WEAPON_FIRE: 'weapon:fire',
  WEAPON_RELOAD: 'weapon:reload',
  WEAPON_SWITCH: 'weapon:switch',
  WEAPON_PICKUP: 'weapon:pickup',
  WEAPON_DROP: 'weapon:drop',
  BULLET_HIT: 'bullet:hit',

  // Inventory
  ITEM_PICKUP: 'item:pickup',
  ITEM_DROP: 'item:drop',
  ITEM_USE: 'item:use',
  INVENTORY_UPDATE: 'inventory:update',
  LOOT_SPAWN: 'loot:spawn',
  LOOT_UPDATE: 'loot:update',
  LOOT_DESPAWN: 'loot:despawn',

  // Zone
  ZONE_UPDATE: 'zone:update',
  ZONE_DAMAGE: 'zone:damage',
  ZONE_WARNING: 'zone:warning',
  ZONE_PHASE_CHANGE: 'zone:phase_change',

  // Vehicles
  VEHICLE_STATE: 'vehicle:state',
  VEHICLE_ENTER: 'vehicle:enter',
  VEHICLE_EXIT: 'vehicle:exit',
  VEHICLE_HIT: 'vehicle:hit',
  VEHICLE_DESTROY: 'vehicle:destroy',

  // Map
  MAP_DATA: 'map:data',

  // Chat
  CHAT_MESSAGE: 'chat:message',

  // Stats
  STATS_UPDATE: 'stats:update',
};

export const PLAYER_STATES = {
  IN_LOBBY: 'in_lobby',
  IN_AIRPLANE: 'in_airplane',
  PARACHUTING: 'parachuting',
  ALIVE: 'alive',
  KNOCKED: 'knocked',
  DEAD: 'dead',
  SPECTATING: 'spectating',
};

export const MATCH_STATES = {
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  AIRPLANE: 'airplane',
  ACTIVE: 'active',
  ENDING: 'ending',
  ENDED: 'ended',
};

export const LOOT_RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
};

export const INPUT_FLAGS = {
  FORWARD: 0b000000001,
  BACKWARD: 0b000000010,
  LEFT: 0b000000100,
  RIGHT: 0b000001000,
  JUMP: 0b000010000,
  CROUCH: 0b000100000,
  SPRINT: 0b001000000,
  FIRE: 0b010000000,
  ADS: 0b100000000,
};
