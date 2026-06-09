// server/src/game/PlayerInventory.js
import { ITEMS, AMMO_TYPES } from '@dropzone/shared';

const DEFAULT_CAPACITY = 150;
const BACKPACK_CAPACITY = 300;

export class PlayerInventory {
  constructor() {
    this.capacity = DEFAULT_CAPACITY;
    this.usedCapacity = 0;
    this.items = new Map(); // itemType -> { item, quantity }
    this.ammo = {}; // ammoType -> quantity
    this.helmet = null;
    this.armor = null;
    this.backpack = null;

    // Init ammo
    for (const type of Object.keys(AMMO_TYPES)) {
      this.ammo[type] = 0;
    }
  }

  addItem(lootItem) {
    const itemDef = ITEMS[lootItem.type];
    if (!itemDef) {
      // Check if it's ammo
      if (AMMO_TYPES[lootItem.type]) {
        const max = AMMO_TYPES[lootItem.type].stack_size * 10;
        const add = Math.min(lootItem.quantity || 30, max - (this.ammo[lootItem.type] || 0));
        if (add > 0) {
          this.ammo[lootItem.type] = (this.ammo[lootItem.type] || 0) + add;
          return true;
        }
        return false;
      }
      return false;
    }

    // Equipment slots
    if (itemDef.type === 'helmet') {
      this.helmet = itemDef;
      return true;
    }
    if (itemDef.type === 'armor') {
      this.armor = { ...itemDef, current: itemDef.armor_amount };
      return true;
    }
    if (itemDef.type === 'backpack') {
      this.backpack = itemDef;
      this.capacity = BACKPACK_CAPACITY;
      return true;
    }

    // Stackable items
    const existing = this.items.get(lootItem.type);
    const quantity = lootItem.quantity || 1;

    if (existing) {
      if (existing.quantity + quantity > itemDef.stack_size) return false;
      existing.quantity += quantity;
      return true;
    }

    if (this.items.size >= 20) return false; // Item slot limit

    this.items.set(lootItem.type, {
      item: itemDef,
      quantity,
    });
    return true;
  }

  getItem(itemType) {
    const entry = this.items.get(itemType);
    if (entry && entry.quantity > 0) return entry.item;
    return null;
  }

  removeItem(itemType, itemId, quantity = 1) {
    const entry = this.items.get(itemType);
    if (!entry || entry.quantity < quantity) return null;
    entry.quantity -= quantity;
    if (entry.quantity <= 0) this.items.delete(itemType);
    return { ...entry.item, quantity };
  }

  getAmmo(ammoType) {
    return this.ammo[ammoType] || 0;
  }

  consumeAmmo(ammoType, amount) {
    const current = this.ammo[ammoType] || 0;
    const consumed = Math.min(current, amount);
    this.ammo[ammoType] = current - consumed;
    return consumed;
  }

  serialize() {
    const items = {};
    for (const [type, entry] of this.items.entries()) {
      items[type] = { id: entry.item.id, quantity: entry.quantity };
    }
    return {
      capacity: this.capacity,
      items,
      ammo: { ...this.ammo },
      helmet: this.helmet ? this.helmet.id : null,
      armor: this.armor ? { id: this.armor.id, current: this.armor.current } : null,
      backpack: this.backpack ? this.backpack.id : null,
    };
  }
}
