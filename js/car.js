// 玩家车（道路坐标系街机物理，支持越野与道具软碰撞）+ NPC 车流
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeFrame } from './road.js';

const _fr = makeFrame();
const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _neg = new THREE.Vector3();

// 低多边形轿车：body(顶点色) + lights(自发光)
export function buildCarMesh(colors, isPlayer = false) {
  const body = new Bucket();
  const lights = new Bucket();
  const { body: cB, cabin: cC, wheel: cW, head: cH, tail: cT, roof: cR } = colors;

  const add = (bucket, geo, color, x, y, z) => {
    geo.translate(x, y, z);
    const g = geo.toNonIndexed();
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      bucket.pos.push(g.attributes.position.array[i * 3], g.attributes.position.array[i * 3 + 1], g.attributes.position.array[i * 3 + 2]);
      bucket.nor.push(g.attributes.normal.array[i * 3], g.attributes.normal.array[i * 3 + 1], g.attributes.normal.array[i * 3 + 2]);
      bucket.col.push(c.r, c.g, c.b);
    }
    g.dispose(); geo.dispose();
  };

  // 前进方向为 -Z
  add(body, new THREE.BoxGeometry(1.86, 0.52, 4.3), cB, 0, 0.52, 0);
  add(body, new THREE.BoxGeometry(1.66, 0.5, 2.1), cC, 0, 1.0, 0.25);
  if (cR && isPlayer) add(body, new THREE.BoxGeometry(1.68, 0.08, 2.12), cR, 0, 1.28, 0.25);
  if (isPlayer) {
    add(body, new THREE.BoxGeometry(1.7, 0.09, 0.5), cB, 0, 0.95, 2.05); // 尾翼
    add(body, new THREE.BoxGeometry(0.12, 0.3, 0.4), cB, -0.7, 0.78, 2.05);
    add(body, new THREE.BoxGeometry(0.12, 0.3, 0.4), cB, 0.7, 0.78, 2.05);
  }
  // 车轮独立成网格：可按速度滚动
  const wheels = [];
  const wheelMat = new THREE.MeshStandardMaterial({ color: cW, flatShading: true, roughness: 0.9, metalness: 0 });
  for (const [wx, wz] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) {
    const w = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 8);
    w.rotateZ(Math.PI / 2);
    const wm = new THREE.Mesh(w, wheelMat);
    wm.position.set(wx, 0.36, wz);
    wm.castShadow = true;
    wheels.push(wm);
  }
  add(lights, new THREE.BoxGeometry(0.42, 0.13, 0.08), cH, -0.6, 0.62, -2.16);
  add(lights, new THREE.BoxGeometry(0.42, 0.13, 0.08), cH, 0.6, 0.62, -2.16);
  // 尾灯独立材质：刹车时增亮（>1 过曝配合泛光出辉光）
  const tail = new Bucket();
  add(tail, new THREE.BoxGeometry(0.5, 0.12, 0.08), cT, -0.58, 0.66, 2.16);
  add(tail, new THREE.BoxGeometry(0.5, 0.12, 0.08), cT, 0.58, 0.66, 2.16);
  const tailMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  tailMat.color.setScalar(0.7);
  // 倒车灯：白色小灯，倒车时点亮
  const rev = new Bucket();
  add(rev, new THREE.BoxGeometry(0.22, 0.1, 0.08), '#ffffff', -0.12, 0.66, 2.16);
  add(rev, new THREE.BoxGeometry(0.22, 0.1, 0.08), '#ffffff', 0.12, 0.66, 2.16);
  const revMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  revMat.color.setScalar(0.25);

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.15 }));
  bodyMesh.castShadow = true;
  group.add(bodyMesh);
  group.add(new THREE.Mesh(lights.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  group.add(new THREE.Mesh(tail.geometry(), tailMat));
  group.add(new THREE.Mesh(rev.geometry(), revMat));
  for (const w of wheels) group.add(w);
  group.userData = { wheels, tailMat, revMat };
  return group;
}

class Bucket {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    return g;
  }
}

// ---------- 越野扬尘 ----------
class DustPool {
  constructor(scene, color) {
    this.group = new THREE.Group();
    this.pool = [];
    const tex = DustPool.tex || (DustPool.tex = makeDustTexture());
    for (let i = 0; i < 20; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false }));
      spr.visible = false;
      this.group.add(spr);
      this.pool.push({ spr, life: 0, v: new THREE.Vector3() });
    }
    this.acc = 0;
    scene.add(this.group);
  }
  spawn(pos) {
    const item = this.pool.find(p => p.life <= 0);
    if (!item) return;
    item.life = 0.7;
    item.spr.visible = true;
    item.spr.position.copy(pos);
    item.spr.scale.setScalar(0.7 + Math.random() * 0.5);
    item.v.set((Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.2);
  }
  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.spr.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.exp(-2 * dt));
      const t = Math.max(p.life, 0) / 0.7;
      p.spr.material.opacity = t * 0.4;
      p.spr.scale.multiplyScalar(1 + dt * 1.6);
      if (p.life <= 0) p.spr.visible = false;
    }
  }
}

// ---------- 玩家 ----------
export class PlayerCar {
  constructor(ctx) {
    this.ctx = ctx; // { scene, theme, road, terrain?, car? }
    this.car = ctx.car || null;
    this.mods = (ctx.car && ctx.car.stats) || {};
    this.mesh = buildCarMesh((ctx.car && ctx.car.colors) || ctx.theme.playerCar, true);
    if (ctx.car && ctx.car.scale) this.mesh.scale.set(...ctx.car.scale);
    ctx.scene.add(this.mesh);
    // 底盘氛围光（霓虹主题）
    if (ctx.theme.underglow) {
      const tex = makeGlowTexture();
      const spr = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 5.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: ctx.theme.underglow })
      );
      spr.rotation.x = -Math.PI / 2;
      spr.position.y = 0.06;
      this.mesh.add(spr);
    }
    this.dust = new DustPool(ctx.scene, ctx.theme.terrain ? ctx.theme.terrain.alt : '#8a7a5a');
    this._fr = makeFrame();
    this.wheels = this.mesh.userData.wheels;
    this.tailMat = this.mesh.userData.tailMat;
    this.revMat = this.mesh.userData.revMat;
    this.reset(0);
  }

  reset(s) {
    this.s = s;
    this.lateral = 0;
    this.latVel = 0;
    this.speed = CONFIG.vDefault;
    this.targetSpeed = CONFIG.vDefault;
    this.nitro = 60;
    this.nitroActive = false;
    this.bumpCd = 0;
    this.shake = 0;
    this.offroad = false;
    this.steerT = 0;      // 距上次有效转向的时间窗（险过前提）
    this.dust.acc = 0;
  }

  // 车轮处的地面高度：路面 → 地形快速过渡（路肩处有小落差感）
  groundY(lat, s) {
    const roadY = this.ctx.road.roadY(s) + 0.02;
    const t = this.ctx.terrain;
    const a = t ? Math.min(Math.max((Math.abs(lat) - 7.8) / 0.8, 0), 1) : 0;
    if (a <= 0) return roadY;
    return roadY * (1 - a) + t.surfaceY(lat, s) * a;
  }

  // 车辆修正后的性能上限
  get vMaxEff() { return CONFIG.vMax * (this.mods.vMax || 1); }
  get vNitroEff() { return CONFIG.vNitro * (this.mods.vNitro || 1); }

  update(dt, input, gameplay) {
    const cfg = CONFIG;
    const mods = this.mods;
    this.bumpCd = Math.max(0, this.bumpCd - dt);

    // 转向活动跟踪：险过需要最近有过主动驾驶
    if (Math.abs(input.steer) > 0.2 || Math.abs(this.latVel) > 1.2) this.steerT = cfg.steerGrace;
    else this.steerT = Math.max(0, this.steerT - dt);

    // 横向控制
    const steer = input.steer; // -1..1
    this.latVel += steer * cfg.latAccel * (mods.latAccel || 1) * dt * (0.55 + 0.45 * Math.min(this.speed / this.vMaxEff, 1.2));
    this.latVel *= Math.exp(-cfg.latDamp * dt);
    this.lateral += this.latVel * dt * (0.7 + 0.6 * Math.min(this.speed / this.vMaxEff, 1));

    // 软边界：离路过远时弹簧回拉
    let absLat = Math.abs(this.lateral);
    if (absLat > cfg.softLat) {
      this.latVel -= Math.sign(this.lateral) * (absLat - cfg.softLat) * 3.0 * dt;
    }
    if (Math.abs(this.lateral) > cfg.maxLat) {
      this.lateral = Math.sign(this.lateral) * cfg.maxLat;
      this.latVel *= -0.25;
    }

    // 越野状态：颠簸 + 断连击判定（蹭路肩不算）
    absLat = Math.abs(this.lateral);
    const wasOffroad = this.offroad;
    this.offroad = absLat > cfg.offroadStart;
    const depth = Math.min(Math.max((absLat - cfg.offroadDragStart) / (cfg.offroadDragEnd - cfg.offroadDragStart), 0), 1);
    if (this.offroad) {
      this.shake = Math.max(this.shake, (0.12 + depth * 0.45) * Math.min(this.speed / 18, 1));
      gameplay && gameplay.onOffroad(dt);
    }

    // 速度控制：深越野拖拽减速（不再是硬墙）
    let vTarget = this.targetSpeed;
    if (input.brake) vTarget = Math.max(cfg.vMin, vTarget - 18);
    if (input.accel) vTarget = Math.min(this.vMaxEff, vTarget + 10);
    // 氮气：启动需最低存量，已启动则持续耗尽至 0
    const wantNitro = input.nitro && (this.nitroActive ? this.nitro > 0 : this.nitro >= cfg.nitroMin);
    if (wantNitro && !this.nitroActive) this.ctx.onNitroFx && this.ctx.onNitroFx();
    this.nitroActive = wantNitro;
    if (this.nitroActive) {
      this.nitro = Math.max(0, this.nitro - cfg.nitroDrain * dt);
      vTarget = this.vNitroEff;
      gameplay && gameplay.onNitro();
    }
    if (depth > 0) vTarget = Math.min(vTarget, this.vMaxEff - depth * (this.vMaxEff - cfg.offroadCap) * (mods.offroad || 1));
    const rate = vTarget > this.speed ? cfg.accel * (this.nitroActive ? 2.4 : 1) * (mods.accel || 1) : cfg.brake;
    this.speed += Math.sign(vTarget - this.speed) * Math.min(Math.abs(vTarget - this.speed), rate * dt);

    this.s += this.speed * dt;

    // 车轮滚动 + 刹车灯（减速中即点亮）+ 倒车灯（倒退时点亮）
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.wheels) w.rotation.x += spin;
    const braking = input.brake || (this.targetSpeed < this.speed - 1.5);
    this.tailMat.color.setScalar(braking ? 1.7 : 0.7);
    this.revMat.color.setScalar(this.speed < -0.5 ? 2.2 : 0.3);

    // 道具软碰撞
    this.checkProps(gameplay);

    this.shake *= Math.exp(-4 * dt);
    this.syncMesh();

    // 越野扬尘
    if (this.offroad && this.speed > 6) {
      this.dust.acc += dt * (4 + this.speed * 0.22);
      while (this.dust.acc > 1) {
        this.dust.acc -= 1;
        const p = this.mesh.position;
        _v.copy(p).addScaledVector(this._fr.tan, -1.9);
        _v.y += 0.25;
        this.dust.spawn(_v);
      }
    }
    this.dust.update(dt);
  }

  // 查询附近区块登记的道具碰撞体，命中则推出并减速
  checkProps(gameplay) {
    if (this.bumpCd > 0) return;
    if (Math.abs(this.lateral) < 6.6) return;
    const road = this.ctx.road;
    const ci = Math.floor(this.s / CONFIG.chunkLen);
    const R = 1.05; // 车身近似半径
    for (let i = ci - 1; i <= ci + 1; i++) {
      const chunk = road.chunks.get(i);
      if (!chunk || !chunk.colliders) continue;
      for (const c of chunk.colliders) {
        const dx = this.lateral - c.off, dz = this.s - c.s;
        const rr = c.r + R;
        if (dx * dx + dz * dz >= rr * rr) continue;
        const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
        const nx = dx / d, nz = dz / d;
        const push = rr - d;
        this.lateral += nx * push;
        this.s += nz * push;
        this.latVel = nx * Math.max(3, Math.abs(this.latVel) * 0.4);
        this.speed *= 0.45;
        this.bumpCd = 1.0;
        this.shake = 1;
        gameplay && gameplay.onBump(null);
        return;
      }
    }
  }

  syncMesh() {
    const road = this.ctx.road;
    const fr = this._fr;
    road.frame(this.s, fr);
    // 4 轮接地点采样：越野时与渲染地表完全一致，杜绝上坡穿模
    const hF = this.groundY(this.lateral, this.s + 2.2);
    const hB = this.groundY(this.lateral, this.s - 2.2);
    const hL = this.groundY(this.lateral - 1.1, this.s);
    const hR = this.groundY(this.lateral + 1.1, this.s);
    _v.copy(fr.pos).addScaledVector(fr.right, this.lateral);
    _v.y = (hF + hB + hL + hR) / 4;
    this.mesh.position.copy(_v);
    // 朝向 = 道路切线 + 横向速度偏航
    const yaw = -Math.atan2(this.latVel, Math.max(this.speed, 6)) * 0.9;
    const bank = Math.max(-0.14, Math.min(0.14, -road.path.curvature(this.s) * 0.03));
    // 车头建模在 -Z，需将基向量的 Z 轴取反（否则行列式为负、翻面剔除）
    _neg.copy(fr.tan).negate();
    _m4.makeBasis(fr.right, fr.up, _neg);
    this.mesh.quaternion.setFromRotationMatrix(_m4);
    this.mesh.rotateY(yaw);
    // 越野：车身随地形俯仰/侧倾（路面坡度由道路标架自带，不重复叠加）
    const offW = Math.min(Math.max((Math.abs(this.lateral) - 7.8) / 0.8, 0), 1);
    if (offW > 0 && this.ctx.terrain && this.speed > 2) {
      this.mesh.rotateX(Math.atan2(hF - hB, 4.4) * offW);
      this.mesh.rotateZ(Math.atan2(hR - hL, 2.2) * offW);
    }
    this.mesh.rotateZ(bank + this.latVel * 0.022);
    // 路外颠簸
    if (this.shake > 0.02) {
      this.mesh.position.y += Math.sin(performance.now() * 0.09) * 0.05 * this.shake;
      this.mesh.rotateX(Math.sin(performance.now() * 0.11) * 0.02 * this.shake);
    }
  }

  get kmh() { return this.speed * 3.6; }
}

// ---------- NPC 车流 ----------
const NPC_COLORS = [
  { body: '#c8ccd4', cabin: '#232a33', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
  { body: '#3f6f8f', cabin: '#1c2630', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
  { body: '#b3703c', cabin: '#241f1a', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
  { body: '#5d8a5a', cabin: '#1c2620', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
  { body: '#8a5d86', cabin: '#241c28', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
  { body: '#c2b45a', cabin: '#26231a', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30' },
];
// 暗色主题（霓虹）用亮色车漆，保证远距离可辨识
const NPC_COLORS_BRIGHT = [
  { body: '#e8ecf4', cabin: '#2a3242', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
  { body: '#9fd4e8', cabin: '#22303c', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
  { body: '#e8b86a', cabin: '#362a1c', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
  { body: '#b8e6c2', cabin: '#1e3028', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
  { body: '#d8b8e0', cabin: '#2e2438', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
  { body: '#f0e6b8', cabin: '#38331e', wheel: '#16181e', head: '#fffdf0', tail: '#ff4a3e' },
];

export class NpcManager {
  constructor(ctx, rng) {
    this.ctx = ctx;
    this.rng = rng;
    this.cars = [];
    const palette = ctx.theme.dark ? NPC_COLORS_BRIGHT : NPC_COLORS;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const mesh = buildCarMesh(palette[i % palette.length]);
      mesh.visible = false;
      // 对向车前灯眩光（远距离预警）
      const glare = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: '#fff8e0', transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
      }));
      glare.scale.set(3.2, 1.5, 1);
      glare.position.set(0, 0.66, -2.5);
      glare.visible = false;
      mesh.add(glare);
      ctx.scene.add(mesh);
      this.cars.push({ mesh, glare, wheels: mesh.userData.wheels, active: false, s: 0, lane: 0, v: 20, passed: false, drift: 0, driftT: 0, oncoming: false });
    }
  }

  respawn(c, playerS) {
    const r = this.rng;
    c.active = true;
    c.oncoming = r() < CONFIG.oncomingRatio;
    if (c.oncoming) {
      // 对向车道：更远的重生距离（相向而行，接近快）
      c.s = playerS + 320 + r() * 480;
      c.lane = -5.0 + (r() - 0.5) * 1.1;
      c.v = -(14 + r() * 10);
    } else if (r() < CONFIG.centerSlowRatio) {
      // 占用中线的慢车：贴中央行驶不再安全
      c.s = playerS + 130 + r() * 340;
      c.lane = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 1.0);
      c.v = 13 + r() * 6;
    } else {
      c.s = playerS + 130 + r() * 340;
      c.lane = [-3.25, 3.25][Math.floor(r() * 2)] + (r() - 0.5);
      c.v = 16 + r() * 11; // 58~97 km/h
    }
    c.passed = false;
    c.drift = 0; c.driftT = r() * 10;
    c.mesh.visible = true;
    this.syncMesh(c);
  }

  reset(playerS) {
    for (const c of this.cars) this.respawn(c, playerS);
  }

  update(dt, player, gameplay) {
    for (const c of this.cars) {
      c.s += c.v * dt;
      const spin = (c.v * dt) / 0.36;
      for (const w of c.wheels) w.rotation.x += spin;
      c.driftT += dt;
      // 车道内轻微游走
      c.drift = Math.sin(c.driftT * 0.4 + c.lane) * 0.45;
      const ds = c.s - player.s;
      const ahead = c.v > 0;
      const maxAhead = ahead ? 520 : 900;
      if (ds < -55 || ds > maxAhead) {
        this.respawn(c, player.s);
        continue;
      }
      const x = c.lane + c.drift;
      const dx = Math.abs(player.lateral - x);
      // 险过判定（仅玩家从后方接近、且最近在主动驾驶）
      if (!c.passed && player.steerT > 0 && ds > -1 && ds < 3.2 && dx > CONFIG.nearMissMin && dx < CONFIG.nearMissMax && player.speed - c.v > 6) {
        c.passed = true;
        gameplay && gameplay.onNearMiss(c);
      }
      // 碰撞（对向相撞更严重）
      if (player.bumpCd <= 0 && Math.abs(ds) < 2.6 && dx < 1.85) {
        player.speed = Math.min(player.speed, ahead ? c.v : -c.v) * (ahead ? 0.45 : 0.3);
        player.bumpCd = ahead ? 1.2 : 1.6;
        player.shake = ahead ? 1 : 1.5;
        player.latVel += Math.sign(player.lateral - x || 1) * 4;
        gameplay && gameplay.onBump(c);
      }
      this.syncMesh(c);
    }
  }

  syncMesh(c) {
    const road = this.ctx.road;
    road.frame(c.s, _fr);
    const x = c.lane + c.drift;
    c.mesh.position.copy(_fr.pos).addScaledVector(_fr.right, x);
    if (c.oncoming) {
      // 车头调转：翻 right 与 tan 使行列式为正
      _neg.copy(_fr.right).negate();
      _m4.makeBasis(_neg, _fr.up, _fr.tan);
    } else {
      _neg.copy(_fr.tan).negate();
      _m4.makeBasis(_fr.right, _fr.up, _neg);
    }
    c.mesh.quaternion.setFromRotationMatrix(_m4);
    c.glare.visible = c.oncoming;
  }
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
