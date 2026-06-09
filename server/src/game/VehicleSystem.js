// server/src/game/VehicleSystem.js
import { v4 as uuidv4 } from 'uuid';
import { VEHICLES } from '@dropzone/shared';
import { clamp } from '@dropzone/shared';

// Predetermined vehicle spawn points
const VEHICLE_SPAWN_POINTS = [
  { type: 'JEEP', x: 50, z: 200 },
  { type: 'JEEP', x: -300, z: -150 },
  { type: 'JEEP', x: 1400, z: 1400 },
  { type: 'JEEP', x: -1100, z: 700 },
  { type: 'MOTORCYCLE', x: 200, z: -300 },
  { type: 'MOTORCYCLE', x: -200, z: 300 },
  { type: 'MOTORCYCLE', x: 700, z: -800 },
  { type: 'MOTORCYCLE', x: -600, z: 300 },
  { type: 'MOTORCYCLE', x: 1000, z: 100 },
  { type: 'JEEP', x: -800, z: -900 },
];

export class VehicleSystem {
  constructor(map) {
    this.map = map;
    this.vehicles = new Map();
  }

  spawnAll() {
    for (const spawn of VEHICLE_SPAWN_POINTS) {
      const id = uuidv4();
      const def = VEHICLES[spawn.type];
      const y = this.map.getHeightAt(spawn.x, spawn.z);
      this.vehicles.set(id, {
        id,
        type: spawn.type,
        name: def.name,
        position: { x: spawn.x, y: y + 0.5, z: spawn.z },
        rotation: Math.random() * Math.PI * 2,
        velocity: { x: 0, y: 0, z: 0 },
        health: def.max_health,
        maxHealth: def.max_health,
        passengers: [],
        engineOn: false,
        speed: 0,
        steerAngle: 0,
        destroyed: false,
      });
    }
  }

  getVehicle(vehicleId) {
    return this.vehicles.get(vehicleId) || null;
  }

  update(dt) {
    for (const [id, vehicle] of this.vehicles.entries()) {
      if (vehicle.destroyed) continue;
      if (vehicle.passengers.length === 0) continue;

      // Simple physics update (driver controls via input)
      const groundY = this.map.getHeightAt(vehicle.position.x, vehicle.position.z);
      vehicle.position.y = groundY + 0.5;

      // Apply velocity
      vehicle.position.x += vehicle.velocity.x * dt;
      vehicle.position.z += vehicle.velocity.z * dt;

      // Damping
      vehicle.velocity.x *= 0.95;
      vehicle.velocity.z *= 0.95;
      vehicle.speed = Math.sqrt(vehicle.velocity.x ** 2 + vehicle.velocity.z ** 2);
    }
  }

  applyDamage(vehicleId, damage) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || vehicle.destroyed) return;
    vehicle.health -= damage;
    if (vehicle.health <= 0) {
      vehicle.health = 0;
      vehicle.destroyed = true;
    }
  }

  getNetworkStates() {
    const states = [];
    for (const [id, v] of this.vehicles.entries()) {
      states.push({
        id: v.id,
        type: v.type,
        x: v.position.x,
        y: v.position.y,
        z: v.position.z,
        rot: v.rotation,
        health: v.health,
        speed: v.speed,
        passengers: v.passengers,
        destroyed: v.destroyed,
      });
    }
    return states;
  }

  getSpawnData() {
    const result = [];
    for (const [id, v] of this.vehicles.entries()) {
      result.push({
        id: v.id,
        type: v.type,
        position: v.position,
        rotation: v.rotation,
        health: v.health,
        maxHealth: v.maxHealth,
      });
    }
    return result;
  }
}

// Add passenger management to vehicle object
Object.assign(Object.prototype, {}); // No prototype pollution

const vehicleProto = {
  addPassenger(userId) {
    const def = VEHICLES[this.type];
    if (this.passengers.length >= def.seats) return -1;
    const seat = this.passengers.length;
    this.passengers.push({ userId, seat });
    return seat;
  },
  removePassenger(userId) {
    this.passengers = this.passengers.filter(p => p.userId !== userId);
  },
};

// Inline methods on vehicle objects via factory
export function createVehicle(type, id, position, map) {
  const def = VEHICLES[type];
  const v = {
    id,
    type,
    name: def.name,
    position: { ...position },
    rotation: Math.random() * Math.PI * 2,
    velocity: { x: 0, y: 0, z: 0 },
    health: def.max_health,
    maxHealth: def.max_health,
    passengers: [],
    engineOn: false,
    speed: 0,
    steerAngle: 0,
    destroyed: false,
    addPassenger(userId) {
      if (this.passengers.length >= def.seats) return -1;
      const seat = this.passengers.length;
      this.passengers.push({ userId, seat });
      return seat;
    },
    removePassenger(userId) {
      this.passengers = this.passengers.filter(p => p.userId !== userId);
    },
  };
  return v;
}
