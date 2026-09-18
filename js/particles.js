// 环境粒子（雪/雨/萤火/墨尘）+ 氮气速度线
import * as THREE from 'three';
import { perfProfile } from './config.js';

function makeSpriteTexture(soft = true) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (soft) {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
  } else {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(26, 0, 12, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.prof = perfProfile();
    const count = this.prof.particleCount;
    this.count = count;
    this.texSoft = makeSpriteTexture(true);
    this.texStreak = makeSpriteTexture(false);

    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.seeds[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.5, map: this.texSoft, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.NormalBlending, sizeAttenuation: true,
    });
    // 各模式会覆盖 sizeAttenuation，切换时需要重置
    this._baseSizeAttenuation = true;
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.mode = null;
    this._box = new THREE.Vector3(110, 46, 150);
    this.gust = 0;
    this._baseOpacity = 0.8;
  }

  setMode(mode) {
    this.mode = mode;
    const m = this.material;
    this.points.visible = !!mode;
    if (!mode) return;
    m.sizeAttenuation = this._baseSizeAttenuation;
    switch (mode) {
      case 'snow':
        m.map = this.texSoft; m.size = 0.55; m.color.set('#ffffff');
        m.opacity = 0.85; m.blending = THREE.NormalBlending;
        break;
      case 'rain':
        m.map = this.texStreak; m.size = 14; m.color.set('#9db4ff');
        m.opacity = 0.3; m.blending = THREE.AdditiveBlending;
        m.sizeAttenuation = false;
        break;
      case 'firefly':
        m.map = this.texSoft; m.size = 0.38; m.color.set('#ffe9a8');
        m.opacity = 0.9; m.blending = THREE.AdditiveBlending;
        break;
      case 'mote':
        m.map = this.texSoft; m.size = 0.3; m.color.set('#6b665c');
        m.opacity = 0.28; m.blending = THREE.NormalBlending;
        break;
    }
    this._baseOpacity = m.opacity;
    m.needsUpdate = true;
  }

  // 天气强度 0..1：密度 + 透明度 + 侧风漂移
  setWeather(w) {
    if (!this.mode) return;
    w = Math.max(0, Math.min(1, w));
    this.gust = w;
    const m = this.material;
    m.opacity = this._baseOpacity * (0.5 + 0.65 * w);
    this.points.geometry.setDrawRange(0, Math.floor(this.count * (0.45 + 0.55 * w)));
  }

  update(dt, camPos, time) {
    if (!this.mode || !this.points.visible) return;
    const p = this.positions;
    const bx = this._box.x, by = this._box.y, bz = this._box.z;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const sd = this.seeds[i];
      switch (this.mode) {
        case 'snow': {
          p[i3 + 1] -= (2.2 + sd * 2.2) * dt;
          p[i3] += Math.sin(time * 0.8 + sd * 12) * 0.7 * dt + this.gust * (1.4 + sd * 1.6) * dt;
          break;
        }
        case 'rain': {
          p[i3 + 1] -= (34 + sd * 14) * dt;
          p[i3 + 2] += 9 * dt;
          p[i3] += this.gust * (4 + sd * 5) * dt;
          break;
        }
        case 'firefly': {
          p[i3] += Math.sin(time * (0.5 + sd) + sd * 30) * 0.9 * dt;
          p[i3 + 1] += Math.cos(time * (0.4 + sd * 0.7) + sd * 20) * 0.5 * dt;
          p[i3 + 2] += Math.sin(time * 0.3 + sd * 50) * 0.9 * dt;
          break;
        }
        case 'mote': {
          p[i3] += Math.sin(time * 0.25 + sd * 40) * 0.35 * dt;
          p[i3 + 1] += (0.18 + Math.sin(time * 0.4 + sd * 9) * 0.2) * dt;
          p[i3 + 2] += 0.28 * dt;
          break;
        }
      }
      // 包裹到相机周围盒内
      if (p[i3 + 1] < camPos.y - 6) p[i3 + 1] += by;
      if (p[i3 + 1] > camPos.y + by - 6) p[i3 + 1] -= by;
      p[i3] = wrap(p[i3], camPos.x - bx / 2, bx);
      p[i3 + 2] = wrap(p[i3 + 2], camPos.z - bz / 2, bz);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

function wrap(v, min, size) {
  if (v < min) return v + size;
  if (v > min + size) return v - size;
  return v;
}

// ---------- 氮气速度线（车侧掠过的光条） ----------
export class SpeedLines {
  constructor(scene) {
    this.pool = [];
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 26; i++) {
      const len = 3 + Math.random() * 5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), mat.clone());
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0 });
    }
    this.active = false;
    this.spawnT = 0;
  }

  update(dt, player, road) {
    this.spawnT -= dt;
    if (this.active && this.spawnT <= 0) {
      this.spawnT = 0.03;
      const item = this.pool.find(p => p.life <= 0);
      if (item) {
        const fr = road.frame(player.s + 8 + Math.random() * 30, road.makeFrame());
        const side = Math.random() < 0.5 ? -1 : 1;
        const off = side * (5 + Math.random() * 9);
        const y = 0.5 + Math.random() * 3.2;
        item.mesh.position.copy(fr.pos).addScaledVector(fr.right, off).addScaledVector(UPV, y);
        item.mesh.visible = true;
        item.life = 0.5;
        item.mesh.material.opacity = 0.65;
        const n = 1 + Math.min(player.speed / 30, 2);
        item.mesh.scale.set(1, 1, n);
      }
    }
    for (const p of this.pool) {
      if (p.life > 0) {
        p.life -= dt;
        p.mesh.position.z += player.speed * dt; // 相对后掠
        p.mesh.material.opacity = Math.max(0, p.life) * 1.3;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
  }

  reset() {
    for (const p of this.pool) { p.life = 0; p.mesh.visible = false; }
  }
}

const UPV = new THREE.Vector3(0, 1, 0);
