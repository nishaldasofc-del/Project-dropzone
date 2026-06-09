// server/src/game/LootSystem.js
import { v4 as uuidv4 } from 'uuid';
import { WEAPONS, ITEMS, AMMO_TYPES, LOOT_RARITY } from '@dropzone/shared';
import { randomRange, randomInt } from '@dropzone/shared';

// Loot tables by rarity
const WEAPON_LOOT_TABLE = [
  { id: 'PISTOL', rarity: LOOT_RARITY.COMMON, weight: 30 },
  { id: 'UMP', rarity: LOOT_RARITY.COMMON, weight: 20 },
  { id: 'VECTOR', rarity: LOOT_RARITY.UNCOMMON, weight: 15 },
  { id: 'M4', rarity: LOOT_RARITY.UNCOMMON, weight: 18 },
  { id: 'AKM', rarity: LOOT_RARITY.UNCOMMON, weight: 18 },
  { id: 'PUMP_SHOTGUN', rarity: LOOT_RARITY.RARE, weight: 10 },
  { id: 'SNIPER', rarity: LOOT_RARITY.EPIC, weight: 5 },
];

const ITEM_LOOT_TABLE = [
  { id: 'BANDAGE', weight: 40, quantity: [2, 5] },
  { id: 'MEDKIT', weight: 10, quantity: [1, 1] },
  { id: 'ENERGY_DRINK', weight: 20, quantity: [1, 2] },
  { id: 'ARMOR_VEST', weight: 15, quantity: [1, 1] },
  { id: 'HELMET', weight: 12, quantity: [1, 1] },
  { id: 'BACKPACK', weight: 8, quantity: [1, 1] },
];

const AMMO_LOOT_TABLE = [
  { type: 'ammo_762', quantity: [30, 60] },
  { type: 'ammo_556', quantity: [30, 60] },
  { type: 'ammo_45acp', quantity: [25, 50] },
  { type: 'ammo_12g', quantity: [10, 20] },
];

// Predefined loot spawn zones on the map
const LOOT_ZONES = [
  // Central Town
  { x: 0, z: 0, radius: 200, density: 1.5, type: 'town' },
  // Military Base
  { x: 1500, z: 1500, radius: 300, density: 2.0, type: 'military' },
  // Factory
  { x: -1200, z: 800, radius: 250, density: 1.8, type: 'industrial' },
  // Village 1
  { x: 800, z: -900, radius: 150, density: 1.0, type: 'village' },
  // Village 2
  { x: -700, z: -1100, radius: 150, density: 1.0, type: 'village' },
  // Forest
  { x: 400, z: 1200, radius: 400, density: 0.5, type: 'forest' },
  // Hills
  { x: -1500, z: -800, radius: 300, density: 0.7, type: 'hills' },
  // Lake area
  { x: 100, z: -400, radius: 180, density: 0.6, type: 'lake' },
  // Scattered buildings
  { x: 600, z: 600, radius: 100, density: 1.2, type: 'building' },
  { x: -600, z: 400, radius: 100, density: 1.2, type: 'building' },
  { x: 1000, z: -200, radius: 100, density: 1.2, type: 'building' },
  { x: -900, z: 1000, radius: 120, density: 1.3, type: 'building' },
];

export class LootSystem {
  constructor(map) {
    this.map = map;
    this.items = new Map(); // itemId -> lootItem
    this.totalSpawnCount = 0;
  }

  spawnAll() {
    for (const zone of LOOT_ZONES) {
      const count = Math.floor(zone.radius * zone.density * 0.3);
      for (let i = 0; i < count; i++) {
        this.spawnInZone(zone);
      }
    }
    this.totalSpawnCount = this.items.size;
  }

  spawnInZone(zone) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * zone.radius;
    const x = zone.x + Math.cos(angle) * r;
    const z = zone.z + Math.sin(angle) * r;
    const y = this.map.getHeightAt(x, z) + 0.5;

    const roll = Math.random();
    let item;

    if (zone.type === 'military' && roll < 0.5) {
      item = this.rollWeapon(true);
    } else if (roll < 0.4) {
      item = this.rollWeapon(false);
    } else if (roll < 0.65) {
      item = this.rollAmmo();
    } else {
      item = this.rollItem();
    }

    if (!item) return;

    const id = uuidv4();
    this.items.set(id, {
      id,
      ...item,
      position: { x, y, z },
      spawnTime: Date.now(),
    });
  }

  rollWeapon(military = false) {
    let table = [...WEAPON_LOOT_TABLE];
    if (military) {
      table = table.map(e => ({
        ...e,
        weight: e.rarity === LOOT_RARITY.RARE || e.rarity === LOOT_RARITY.EPIC
          ? e.weight * 2 : e.weight,
      }));
    }

    const total = table.reduce((sum, e) => sum + e.weight, 0);
    let rand = Math.random() * total;
    for (const entry of table) {
      rand -= entry.weight;
      if (rand <= 0) {
        const def = WEAPONS[entry.id];
        return {
          type: entry.id,
          category: 'weapon',
          rarity: entry.rarity,
          name: def.name,
          quantity: 1,
          ammo_in_mag: def.magazine_size,
          ammo_reserve: Math.floor(def.max_ammo * 0.3),
        };
      }
    }
    return null;
  }

  rollAmmo() {
    const entry = AMMO_LOOT_TABLE[randomInt(0, AMMO_LOOT_TABLE.length - 1)];
    return {
      type: entry.type,
      category: 'ammo',
      rarity: LOOT_RARITY.COMMON,
      name: AMMO_TYPES[entry.type].name,
      quantity: randomInt(entry.quantity[0], entry.quantity[1]),
    };
  }

  rollItem() {
    const total = ITEM_LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);
    let rand = Math.random() * total;
    for (const entry of ITEM_LOOT_TABLE) {
      rand -= entry.weight;
      if (rand <= 0) {
        const def = ITEMS[entry.id];
        return {
          type: entry.id,
          category: 'item',
          rarity: LOOT_RARITY.COMMON,
          name: def.name,
          quantity: randomInt(entry.quantity[0], entry.quantity[1]),
        };
      }
    }
    return null;
  }

  spawnItem(item, position) {
    const id = uuidv4();
    this.items.set(id, {
      ...item,
      id,
      position,
      spawnTime: Date.now(),
    });
    return id;
  }

  getItem(itemId) {
    return this.items.get(itemId) || null;
  }

  removeItem(itemId) {
    return this.items.delete(itemId);
  }

  dropPlayerLoot(player) {
    const dropPos = { ...player.position };

    // Drop weapons
    for (const weapon of player.weapons) {
      if (!weapon) continue;
      this.spawnItem({
        type: weapon.id,
        category: 'weapon',
        name: WEAPONS[weapon.id].name,
        quantity: 1,
        ammo_in_mag: weapon.ammo_in_mag,
        ammo_reserve: weapon.ammo_reserve,
        rarity: LOOT_RARITY.UNCOMMON,
      }, {
        x: dropPos.x + (Math.random() - 0.5) * 3,
        y: dropPos.y,
        z: dropPos.z + (Math.random() - 0.5) * 3,
      });
    }

    // Drop inventory items
    for (const [type, entry] of player.inventory.items.entries()) {
      this.spawnItem({
        type,
        category: 'item',
        name: entry.item.name,
        quantity: entry.quantity,
        rarity: LOOT_RARITY.COMMON,
      }, {
        x: dropPos.x + (Math.random() - 0.5) * 3,
        y: dropPos.y,
        z: dropPos.z + (Math.random() - 0.5) * 3,
      });
    }

    // Drop ammo
    for (const [ammoType, qty] of Object.entries(player.inventory.ammo)) {
      if (qty <= 0) continue;
      this.spawnItem({
        type: ammoType,
        category: 'ammo',
        name: AMMO_TYPES[ammoType]?.name || ammoType,
        quantity: qty,
        rarity: LOOT_RARITY.COMMON,
      }, {
        x: dropPos.x + (Math.random() - 0.5) * 2,
        y: dropPos.y,
        z: dropPos.z + (Math.random() - 0.5) * 2,
      });
    }
  }

  getSpawnData() {
    const result = [];
    for (const [id, item] of this.items.entries()) {
      result.push(item);
    }
    return result;
  }

  getActiveItems() {
    return this.getSpawnData();
  }
}
