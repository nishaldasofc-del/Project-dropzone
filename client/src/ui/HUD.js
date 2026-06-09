// client/src/ui/HUD.js
import { WEAPONS, AMMO_TYPES, ITEMS } from '@dropzone/shared';

export class HUD {
  constructor(game) {
    this.game = game;
    this.hudEl = document.getElementById('hud');
    this.visible = false;

    // Cached elements
    this.el = {
      healthBar:       document.getElementById('hud-health-bar'),
      armorBar:        document.getElementById('hud-armor-bar'),
      boostBar:        document.getElementById('hud-boost-bar'),
      healthText:      document.getElementById('hud-health'),
      ammoMag:         document.getElementById('hud-ammo-mag'),
      ammoReserve:     document.getElementById('hud-ammo-reserve'),
      weaponName:      document.getElementById('hud-weapon-name'),
      weaponSlots:     document.getElementById('hud-weapon-slots'),
      killfeed:        document.getElementById('hud-killfeed'),
      playersCount:    document.getElementById('hud-players-count'),
      zoneTimer:       document.getElementById('hud-zone-timer'),
      zoneWarning:     document.getElementById('hud-zone-warning'),
      parachuteHUD:    document.getElementById('parachute-hud'),
      paraText:        document.getElementById('para-text'),
      paraAltitude:    document.getElementById('para-altitude'),
      lootPrompt:      document.getElementById('loot-prompt'),
      lootList:        document.getElementById('loot-items-list'),
      inventory:       document.getElementById('inventory-panel'),
      invEquip:        document.getElementById('inv-equipment'),
      invItems:        document.getElementById('inv-items'),
      invAmmo:         document.getElementById('inv-ammo'),
      spectator:       document.getElementById('spectator-overlay'),
      specName:        document.getElementById('spec-name'),
      deathScreen:     document.getElementById('death-screen'),
      deathKiller:     document.getElementById('death-killer-name'),
      deathSurvived:   document.getElementById('death-survived'),
      deathKills:      document.getElementById('death-kills'),
      deathDamage:     document.getElementById('death-damage'),
      winScreen:       document.getElementById('win-screen'),
      winKills:        document.getElementById('win-kills'),
      winDamage:       document.getElementById('win-damage'),
      winTime:         document.getElementById('win-time'),
      hitIndicator:    document.getElementById('hit-indicator'),
      damageFlash:     document.getElementById('damage-flash'),
      crosshair:       document.getElementById('crosshair'),
      mapOverlay:      document.getElementById('map-overlay'),
      mapCanvas:       document.getElementById('map-canvas'),
      wsSlotsEls:      [
        document.getElementById('ws-slot-0'),
        document.getElementById('ws-slot-1'),
        document.getElementById('ws-slot-2'),
      ],
    };

    this.killfeedEntries = [];
    this.inventoryOpen = false;
    this.mapOpen = false;
    this.reloadTimeout = null;

    this.setupButtonListeners();
  }

  setupButtonListeners() {
    // Death screen buttons
    document.getElementById('spectate-btn')?.addEventListener('click', () => {
      this.el.deathScreen.classList.add('hidden');
      this.el.spectator.classList.remove('hidden');
    });
    document.getElementById('back-to-menu-btn')?.addEventListener('click', () => {
      this.game.returnToMenu();
    });
    document.getElementById('win-menu-btn')?.addEventListener('click', () => {
      this.game.returnToMenu();
    });
    document.getElementById('map-close-btn')?.addEventListener('click', () => {
      this.closeMap();
    });

    // Loot pickup via click
    this.el.lootList?.addEventListener('click', (e) => {
      const item = e.target.closest('.loot-item');
      if (item) {
        const itemId = item.dataset.itemId;
        if (itemId) {
          this.game.network.emit('item:pickup', { itemId });
        }
      }
    });
  }

  show() {
    this.hudEl.classList.remove('hidden');
    this.visible = true;
    this.updateWeaponHUD(this.game.player);
  }

  hide() {
    this.hudEl.classList.add('hidden');
    this.visible = false;
    this.el.deathScreen.classList.add('hidden');
    this.el.winScreen.classList.add('hidden');
    this.el.parachuteHUD.classList.add('hidden');
    this.closeInventory();
    this.closeMap();
  }

  // ============================================================
  // HEALTH / ARMOR
  // ============================================================

  updateHealth(health, armor) {
    const hp = Math.max(0, Math.min(100, health));
    const ar = Math.max(0, Math.min(100, armor || 0));

    this.el.healthBar.style.width = hp + '%';
    this.el.armorBar.style.width = ar + '%';
    this.el.healthText.textContent = Math.ceil(hp);

    // Color health bar by amount
    if (hp > 60) {
      this.el.healthBar.style.background = 'var(--clr-health)';
    } else if (hp > 30) {
      this.el.healthBar.style.background = '#ffaa00';
    } else {
      this.el.healthBar.style.background = 'var(--clr-danger)';
      this.el.healthBar.style.animation = 'pulse 0.8s infinite';
    }
  }

  updateBoost(boost) {
    const b = Math.max(0, Math.min(100, boost || 0));
    this.el.boostBar.style.width = b + '%';
    document.getElementById('hud-boost-wrap').style.opacity = b > 0 ? '1' : '0.3';
  }

  // ============================================================
  // WEAPON HUD
  // ============================================================

  updateWeaponHUD(player) {
    if (!player) return;
    const weapon = player.weapons?.[player.activeWeaponSlot];
    const def = weapon ? WEAPONS[weapon.id] : null;

    this.el.weaponName.textContent = def ? def.name : '—';
    this.el.ammoMag.textContent = weapon ? weapon.ammo_in_mag : '—';
    this.el.ammoReserve.textContent = weapon ? weapon.ammo_reserve : '—';

    // Color ammo red if low
    if (weapon && weapon.ammo_in_mag <= 5) {
      this.el.ammoMag.style.color = 'var(--clr-danger)';
    } else {
      this.el.ammoMag.style.color = '';
    }

    // Update weapon slots HUD
    let slotsHTML = '';
    for (let i = 0; i < 3; i++) {
      const w = player.weapons?.[i];
      const active = i === player.activeWeaponSlot;
      slotsHTML += `<div class="hud-slot ${active ? 'active' : ''}">
        ${w ? (WEAPONS[w.id]?.name?.substring(0, 6) || w.id) : '—'}
      </div>`;
    }
    this.el.weaponSlots.innerHTML = slotsHTML;

    // Update weapon switcher (mobile)
    for (let i = 0; i < 3; i++) {
      const slot = this.el.wsSlotsEls[i];
      if (!slot) continue;
      const w = player.weapons?.[i];
      slot.classList.toggle('active', i === player.activeWeaponSlot);
      slot.textContent = w ? (WEAPONS[w.id]?.name?.substring(0, 5) || w.id) : '—';
    }
  }

  showReloading(duration) {
    this.el.ammoMag.textContent = '...';
    this.el.ammoMag.style.color = 'var(--clr-accent)';
    clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(() => {
      this.el.ammoMag.style.color = '';
    }, duration);
  }

  // ============================================================
  // KILL FEED
  // ============================================================

  addKillFeedEntry(entry) {
    const el = document.createElement('div');
    el.className = 'killfeed-entry';
    el.innerHTML = `
      <span class="killfeed-killer">${this.escapeHtml(entry.killerName)}</span>
      <span class="killfeed-weapon"> [${entry.weaponId}] </span>
      <span class="killfeed-target">${this.escapeHtml(entry.targetName)}</span>
      ${entry.isHeadshot ? '<span style="color:var(--clr-accent)">💀</span>' : ''}
    `;
    this.el.killfeed.prepend(el);
    this.killfeedEntries.unshift(el);

    // Remove after 8 seconds
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        el.remove();
        this.killfeedEntries = this.killfeedEntries.filter(e => e !== el);
      }, 500);
    }, 8000);

    // Cap at 5 entries
    while (this.killfeedEntries.length > 5) {
      const old = this.killfeedEntries.pop();
      old.remove();
    }
  }

  // ============================================================
  // HIT EFFECTS
  // ============================================================

  flashDamage() {
    const el = this.el.damageFlash;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth; // reflow
    el.style.animation = 'damageFlash 0.35s ease-out forwards';
    setTimeout(() => el.classList.add('hidden'), 400);
  }

  showHitIndicator() {
    const el = this.el.hitIndicator;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'hitFlash 0.25s ease-out forwards';
    setTimeout(() => el.classList.add('hidden'), 300);
  }

  showHitMarker(isHeadshot) {
    const ch = this.el.crosshair;
    ch.style.color = isHeadshot ? 'var(--clr-accent)' : 'var(--clr-danger)';
    setTimeout(() => { ch.style.color = ''; }, 120);
  }

  // ============================================================
  // ZONE TIMER
  // ============================================================

  updateZoneTimer(state) {
    if (!state) return;
    const el = this.el.zoneTimer;
    if (state.isShrinking) {
      const remaining = Math.max(0, 1 - (state.shrinkProgress || 0));
      el.textContent = `⚡ ZONE MOVING`;
      el.style.color = 'var(--clr-danger)';
    } else {
      el.textContent = `🟢 ZONE SAFE`;
      el.style.color = 'var(--clr-safe)';
    }
  }

  showZoneWarning() {
    this.el.zoneWarning.classList.remove('hidden');
    setTimeout(() => this.el.zoneWarning.classList.add('hidden'), 5000);
  }

  // ============================================================
  // PLAYERS REMAINING
  // ============================================================

  updatePlayersRemaining(count) {
    this.el.playersCount.textContent = count;
  }

  // ============================================================
  // PARACHUTE HUD
  // ============================================================

  showParachuteHUD(show) {
    if (show) {
      this.el.parachuteHUD.classList.remove('hidden');
    } else {
      this.el.parachuteHUD.classList.add('hidden');
    }
  }

  updateParachuteHUD(playerState) {
    if (!playerState) return;
  }

  updateParachuteAltitude(altitude) {
    if (this.el.paraAltitude) {
      this.el.paraAltitude.textContent = Math.round(altitude) + 'm';
    }
  }

  updateParachuteText(text) {
    if (this.el.paraText) {
      this.el.paraText.textContent = text;
    }
  }

  // ============================================================
  // LOOT PROMPT
  // ============================================================

  showLootPrompt(items) {
    if (!items || items.length === 0) {
      this.el.lootPrompt.classList.add('hidden');
      return;
    }

    let html = '';
    for (const item of items) {
      const d = item.data;
      const rarity = d.rarity || 'common';
      html += `<div class="loot-item loot-rarity-${rarity}" data-item-id="${d.id}">
        <span class="loot-item-name">${this.escapeHtml(d.name)}</span>
        ${d.quantity > 1 ? `<span class="loot-item-qty">x${d.quantity}</span>` : ''}
      </div>`;
    }

    this.el.lootList.innerHTML = html;
    this.el.lootPrompt.classList.remove('hidden');
  }

  hideLootPrompt() {
    this.el.lootPrompt.classList.add('hidden');
  }

  // ============================================================
  // INVENTORY
  // ============================================================

  toggleInventory() {
    if (this.inventoryOpen) {
      this.closeInventory();
    } else {
      this.openInventory();
    }
  }

  openInventory() {
    this.inventoryOpen = true;
    this.el.inventory.classList.remove('hidden');
    this.refreshInventory();
  }

  closeInventory() {
    this.inventoryOpen = false;
    this.el.inventory?.classList.add('hidden');
  }

  refreshInventory() {
    const player = this.game.player;
    if (!player) return;

    // Equipment slots
    let equipHTML = '';
    const helmet = player.inventory?.helmet;
    const armor = player.inventory?.armor;
    const backpack = player.inventory?.backpack;
    equipHTML += `<div class="inv-equip-slot">${helmet ? '⛑ Helmet' : 'No Helmet'}</div>`;
    equipHTML += `<div class="inv-equip-slot">${armor ? '🦺 Armor' : 'No Armor'}</div>`;
    equipHTML += `<div class="inv-equip-slot">${backpack ? '🎒 Backpack' : 'No Pack'}</div>`;
    this.el.invEquip.innerHTML = equipHTML;

    // Items grid
    let itemsHTML = '';
    const items = player.inventory?.items || new Map();
    for (const [type, entry] of items.entries()) {
      itemsHTML += `<div class="inv-item-slot" data-type="${type}">
        ${this.escapeHtml(entry.item?.name || type)}<br>x${entry.quantity}
      </div>`;
    }
    this.el.invItems.innerHTML = itemsHTML || '<div style="color:var(--clr-muted);font-size:0.75rem;text-align:center;grid-column:1/-1">Empty</div>';

    // Ammo
    let ammoHTML = '';
    const ammo = player.inventory?.ammo || {};
    for (const [type, qty] of Object.entries(ammo)) {
      if (qty <= 0) continue;
      const def = AMMO_TYPES[type];
      ammoHTML += `<div class="inv-ammo-item">
        <span>${def?.name || type}</span>
        <span style="color:var(--clr-accent)">${qty}</span>
      </div>`;
    }
    this.el.invAmmo.innerHTML = ammoHTML;
  }

  // ============================================================
  // MAP
  // ============================================================

  toggleMap() {
    if (this.mapOpen) {
      this.closeMap();
    } else {
      this.openMap();
    }
  }

  openMap() {
    this.mapOpen = true;
    this.el.mapOverlay.classList.remove('hidden');
    this.game.minimap.renderFullMap(this.el.mapCanvas);
  }

  closeMap() {
    this.mapOpen = false;
    this.el.mapOverlay?.classList.add('hidden');
  }

  // ============================================================
  // DEATH / WIN
  // ============================================================

  showDeathScreen(data) {
    this.el.deathScreen.classList.remove('hidden');
    this.el.deathKiller.textContent = data.killerName || 'Unknown';
    this.el.deathSurvived.textContent = this.formatTime(data.survived || 0);
    this.el.deathKills.textContent = data.kills || 0;
    this.el.deathDamage.textContent = Math.round(data.damage || 0);
    this.el.crosshair.classList.add('hidden');
  }

  showWinScreen(data, player) {
    this.el.winScreen.classList.remove('hidden');
    this.el.winKills.textContent = player?.killCount || 0;
    this.el.winDamage.textContent = Math.round(player?.damageDealt || 0);
    this.el.winTime.textContent = this.formatTime(player?.timeAlive || 0);
    this.el.crosshair.classList.add('hidden');
  }

  addChatMessage(data) {
    this.showNotification(`${data.username}: ${data.message}`, 4000);
  }

  showNotification(text, duration = 3000) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = text;
    document.getElementById('hud').appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
