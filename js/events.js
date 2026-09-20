// 随机环境事件：鸟群/仙鹤/热气球/流星/UFO/极光爆发/萤火爆发/光轨
import * as THREE from 'three';
import { t } from './i18n.js';

const _v = new THREE.Vector3();

class BirdFlock {
  constructor(scene, opts) {
    const n = opts.count || 9;
    this.group = new THREE.Group();
    this.birds = [];
    this.t = 0;
    this.life = opts.life || 14;
    const mat = new THREE.MeshBasicMaterial({ color: opts.color, side: THREE.DoubleSide });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.55, 0, 0, -0.55, 1.1, 0.12, 0]), 3));
    wingGeo.computeVertexNormals();
    for (let i = 0; i < n; i++) {
      const bird = new THREE.Group();
      const l = new THREE.Mesh(wingGeo, mat);
      const r = new THREE.Mesh(wingGeo, mat);
      r.scale.x = -1;
      bird.add(l, r);
      bird.userData = { l, r, phase: Math.random() * 6.28, off: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 18) };
      this.group.add(bird);
      this.birds.push(bird);
    }
    this.dir = opts.dir || new THREE.Vector3(-1, 0.05, 0.35).normalize();
    this.speed = opts.speed || 16;
    scene.add(this.group);
  }

  update(dt) {
    this.t += dt;
    this.group.position.addScaledVector(this.dir, this.speed * dt);
    for (const b of this.birds) {
      const { l, r, phase } = b.userData;
      const flap = Math.sin(this.t * 9 + phase) * 0.55;
      l.rotation.x = flap; r.rotation.x = -flap;
      b.position.copy(b.userData.off);
      b.position.y += Math.sin(this.t * 1.2 + phase) * 0.8;
    }
    return this.t < this.life;
  }

  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

class Balloons {
  constructor(scene) {
    this.group = new THREE.Group();
    this.t = 0;
    this.life = 26;
    const colors = ['#e05a4e', '#f2b34c', '#5a8fd8'];
    this.balloons = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const env = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), new THREE.MeshStandardMaterial({ color: colors[i], flatShading: true, roughness: 0.7 }));
      env.scale.y = 1.15;
      const basket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), new THREE.MeshStandardMaterial({ color: '#7a5c3a', flatShading: true }));
      basket.position.y = -5.2;
      g.add(env, basket);
      g.position.set(i * 14 - 14, 0, i * 6);
      g.userData = { phase: i * 2.1 };
      this.group.add(g);
      this.balloons.push(g);
    }
    this.group.position.set(60, 42, -260);
    this.drift = new THREE.Vector3(1.6, 0, 0.3);
    scene.add(this.group);
  }
  update(dt) {
    this.t += dt;
    this.group.position.addScaledVector(this.drift, dt);
    for (const b of this.balloons) b.position.y = Math.sin(this.t * 0.5 + b.userData.phase) * 2.5;
    return this.t < this.life;
  }
  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

class Meteor {
  constructor(scene) {
    this.t = 0;
    this.life = 1.6;
    const geo = new THREE.PlaneGeometry(26, 0.5);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: '#ffe9c8', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.start = new THREE.Vector3(-320 - Math.random() * 200, 320 + Math.random() * 140, -900 - Math.random() * 400);
    this.vel = new THREE.Vector3(260, -130, 0);
    this.mesh.position.copy(this.start);
    this.mesh.rotation.z = Math.atan2(this.vel.y, this.vel.x);
    scene.add(this.mesh);
  }
  update(dt) {
    this.t += dt;
    this.mesh.position.addScaledVector(this.vel, dt);
    this.mesh.material.opacity = Math.max(0, 0.9 * (1 - this.t / this.life));
    return this.t < this.life;
  }
  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); }
}

class Ufo {
  constructor(scene) {
    this.t = 0;
    this.life = 16;
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 1.8, 12), new THREE.MeshStandardMaterial({ color: '#3a4258', flatShading: true, metalness: 0.6, roughness: 0.3 }));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7ae0ff', emissive: '#22e6f6', emissiveIntensity: 1.2, flatShading: true }));
    dome.position.y = 0.9;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.35, 6, 20), new THREE.MeshBasicMaterial({ color: '#ff2d95', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    this.group.add(body, dome, ring);
    this.group.position.set(-260, 120, -420);
    this.vel = new THREE.Vector3(34, 0, 8);
    scene.add(this.group);
  }
  update(dt) {
    this.t += dt;
    this.group.position.addScaledVector(this.vel, dt);
    this.group.position.y += Math.sin(this.t * 1.7) * 0.35;
    this.group.rotation.y += dt * 2;
    return this.t < this.life;
  }
  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

class AuroraSurge {
  constructor(aurora) { this.aurora = aurora; this.t = 0; this.life = 9; aurora.surge = 1; }
  update(dt) { this.t += dt; return this.t < this.life; }
  dispose() { }
}

class FireflyBurst {
  constructor(scene, center) {
    this.t = 0;
    this.life = 7;
    const n = 60;
    this.pts = [];
    this.group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const geo = new THREE.SphereGeometry(0.18, 4, 3);
    this.meshes = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 2, (Math.random() - 0.5) * 6));
      m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 2.2, 1 + Math.random() * 1.6, (Math.random() - 0.5) * 2.2), phase: Math.random() * 6.28 };
      this.group.add(m);
    }
    scene.add(this.group);
  }
  update(dt) {
    this.t += dt;
    const fade = Math.max(0, 1 - Math.max(0, this.t - this.life * 0.6) / (this.life * 0.4));
    for (const m of this.group.children) {
      m.position.addScaledVector(m.userData.v, dt);
      m.material.opacity = fade * (0.5 + 0.5 * Math.sin(this.t * 6 + m.userData.phase));
    }
    return this.t < this.life;
  }
  dispose() { this.group.parent && this.group.parent.remove(this.group); }
}

class LightTrail {
  // 赛博主题：一辆飞驰的光轨车掠过对向车道
  constructor(scene, road, playerS) {
    this.t = 0;
    this.life = 3.5;
    const geo = new THREE.BoxGeometry(2, 0.35, 26);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? '#ff2d95' : '#22e6f6', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.s = playerS + 300;
    this.lane = -3.25;
    this.v = -95; // 对向高速
    scene.add(this.mesh);
    this.road = road;
  }
  update(dt) {
    this.t += dt;
    this.s += this.v * dt;
    const fr = this.road.frame(this.s, this.road.makeFrame());
    this.mesh.position.copy(fr.pos).addScaledVector(fr.right, this.lane).add(_v.set(0, 1.4, 0));
    this.mesh.material.opacity = 0.85 * Math.max(0, 1 - Math.abs(this.t - this.life * 0.5) / (this.life * 0.55));
    return this.t < this.life;
  }
  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); }
}

// ---------- 调度器 ----------
export class EventManager {
  constructor(ctx, rng) {
    this.ctx = ctx;         // { scene, road, theme, sky Systems: aurora }
    this.rng = rng;
    this.active = [];
    this.nextAt = 12 + rng() * 20;
    this.time = 0;
  }

  reset() {
    for (const e of this.active) e.dispose();
    this.active.length = 0;
    this.nextAt = 12 + this.rng() * 20;
    this.time = 0;
  }

  update(dt, player) {
    this.time += dt;
    if (this.time > this.nextAt) {
      this.spawn(player);
      this.nextAt = this.time + 30 + this.rng() * 45;
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!this.active[i].update(dt)) {
        this.active[i].dispose();
        this.active.splice(i, 1);
      }
    }
  }

  spawn(player) {
    const pool = this.ctx.theme.events;
    const kind = pool[Math.floor(this.rng() * pool.length)];
    const scene = this.ctx.scene;
    const road = this.ctx.road;
    const fr = road.frame(player.s + 200, road.makeFrame());
    let ev = null;
    const toast = this.ctx.toast;
    switch (kind) {
      case 'birds':
      case 'cranes': {
        const isInk = kind === 'cranes';
        ev = new BirdFlock(scene, isInk
          ? { count: 7, color: '#f8f6ef', speed: 11, life: 18 }
          : { count: 9, color: '#2b2b33', speed: 16, life: 14 });
        // 群：出现在行进方向侧前方空中
        ev.group.position.copy(fr.pos)
          .addScaledVector(fr.right, 90 + this.rng() * 40)
          .add(_v.set(0, 34 + this.rng() * 14, 0));
        ev.dir = new THREE.Vector3(-fr.right.x, 0.04, -fr.right.z).normalize();
        if (this.rng() < 0.5) { ev.dir.negate(); ev.group.position.copy(fr.pos).addScaledVector(fr.right, -(90 + this.rng() * 40)).add(_v.set(0, 36, 0)); }
        toast && toast(t(isInk ? 'evEgrets' : 'evBirds'));
        break;
      }
      case 'balloons':
        ev = new Balloons(scene);
        ev.group.position.copy(fr.pos).addScaledVector(fr.right, 70).add(_v.set(0, 40, 0));
        ev.drift = new THREE.Vector3(-fr.right.x * 2, 0, -fr.right.z * 2);
        toast && toast(t('evBalloons'));
        break;
      case 'meteor': {
        ev = new Meteor(scene);
        ev.mesh.position.add(_v.set(fr.pos.x, 0, fr.pos.z));
        toast && toast(t('evMeteor'));
        break;
      }
      case 'ufo':
        ev = new Ufo(scene);
        ev.group.position.copy(fr.pos).addScaledVector(fr.right, -160).add(_v.set(0, 110, 0));
        toast && toast(t('evUfo'));
        break;
      case 'auroraSurge':
        if (this.ctx.aurora) { ev = new AuroraSurge(this.ctx.aurora); toast && toast(t('evAurora')); }
        break;
      case 'fireflyBurst': {
        const pos = fr.pos.clone().addScaledVector(fr.right, 12 + this.rng() * 10);
        pos.y = this.ctx.terrain ? this.ctx.terrain.surfaceY(12, player.s + 200) + 1.5 : fr.pos.y + 1.5;
        ev = new FireflyBurst(scene, pos);
        toast && toast(t('evFireflies'));
        break;
      }
      case 'lightTrail':
        ev = new LightTrail(scene, road, player.s);
        toast && toast(t('evLightTrail'));
        break;
    }
    if (ev) this.active.push(ev);
  }
}
