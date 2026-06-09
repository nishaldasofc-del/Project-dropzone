// shared/src/math.js
// Math utilities shared between client and server

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  copy(v) {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  addSelf(v) {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }

  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  scaleSelf(s) {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vec3();
    return new Vec3(this.x / len, this.y / len, this.z / len);
  }

  distanceTo(v) {
    return this.sub(v).length();
  }

  distanceToSq(v) {
    return this.sub(v).lengthSq();
  }

  lerp(v, t) {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  fromArray(arr) {
    this.x = arr[0]; this.y = arr[1]; this.z = arr[2];
    return this;
  }

  toJSON() {
    return { x: this.x, y: this.y, z: this.z };
  }

  static fromJSON(json) {
    return new Vec3(json.x, json.y, json.z);
  }

  static distance(a, b) {
    return Math.sqrt(
      (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
    );
  }

  static distanceSq(a, b) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  }
}

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  distanceTo(v) {
    return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vec2();
    return new Vec2(this.x / len, this.y / len);
  }

  scale(s) {
    return new Vec2(this.x * s, this.y * s);
  }

  static distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function randomInCircle(radius) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function pointInCircle(px, py, cx, cy, radius) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2;
}

export function distanceToCircleEdge(px, py, cx, cy, radius) {
  const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
  return dist - radius;
}

export function sphereAABBIntersect(sphere, aabb) {
  const dx = Math.max(aabb.minX - sphere.x, 0, sphere.x - aabb.maxX);
  const dy = Math.max(aabb.minY - sphere.y, 0, sphere.y - aabb.maxY);
  const dz = Math.max(aabb.minZ - sphere.z, 0, sphere.z - aabb.maxZ);
  return dx * dx + dy * dy + dz * dz <= sphere.radius ** 2;
}

export function rayAABBIntersect(origin, direction, aabb) {
  let tmin = -Infinity, tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const min = axis === 'x' ? aabb.minX : axis === 'y' ? aabb.minY : aabb.minZ;
    const max = axis === 'x' ? aabb.maxX : axis === 'y' ? aabb.maxY : aabb.maxZ;
    const o = origin[axis];
    const d = direction[axis];
    if (Math.abs(d) < 1e-10) {
      if (o < min || o > max) return null;
    } else {
      const t1 = (min - o) / d;
      const t2 = (max - o) / d;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
  }
  if (tmax < 0 || tmin > tmax) return null;
  return tmin < 0 ? tmax : tmin;
}

export function capsuleAABBIntersect(start, end, radius, aabb) {
  // Simplified: check start/end sphere + swept cylinder
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const expAABB = {
    minX: aabb.minX - radius, maxX: aabb.maxX + radius,
    minY: aabb.minY - radius, maxY: aabb.maxY + radius,
    minZ: aabb.minZ - radius, maxZ: aabb.maxZ + radius,
  };
  return rayAABBIntersect(start, { x: dx, y: dy, z: dz }, expAABB) !== null;
}

export function packInputFlags(input) {
  let flags = 0;
  if (input.forward)  flags |= 0b000000001;
  if (input.backward) flags |= 0b000000010;
  if (input.left)     flags |= 0b000000100;
  if (input.right)    flags |= 0b000001000;
  if (input.jump)     flags |= 0b000010000;
  if (input.crouch)   flags |= 0b000100000;
  if (input.sprint)   flags |= 0b001000000;
  if (input.fire)     flags |= 0b010000000;
  if (input.ads)      flags |= 0b100000000;
  return flags;
}

export function unpackInputFlags(flags) {
  return {
    forward:  !!(flags & 0b000000001),
    backward: !!(flags & 0b000000010),
    left:     !!(flags & 0b000000100),
    right:    !!(flags & 0b000001000),
    jump:     !!(flags & 0b000010000),
    crouch:   !!(flags & 0b000100000),
    sprint:   !!(flags & 0b001000000),
    fire:     !!(flags & 0b010000000),
    ads:      !!(flags & 0b100000000),
  };
}
