// 玩法：收集品 + 氮气 + 险过计分 + 连击
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeFrame } from './road.js';

const _fr = makeFrame();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Gameplay {
  constructor(ctx, ui, rng) {
    this.ctx = ctx;   // { scene, road, theme, silent? }
    this.ui = ui;     // HUD DOM 引用
    this.rng = rng;
    this.silent = !!ctx.silent;

    // 收集品实例池
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    this.inst = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: ctx.theme.collectible, emissive: new THREE.Color(ctx.theme.collectible),
        emissiveIntensity: 0.7, flatShading: true, roughness: 0.3,
      }),
      CONFIG.maxCollectibles || 90
    );
    this.inst.count = 0;
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.frustumCulled = false;
    ctx.scene.add(this.inst);

    this.items = []; // { s, x, y, idx, active, taken }
    this.colColor = new THREE.Color(ctx.theme.collectible);
    this.reset();
  }

  reset(baseS = 0) {
    this.items.length = 0;
    this.inst.count = 0;
    // stats
    this.score = 0;
    this.collects = 0;
    this.nearMisses = 0;
    this.oncomingNearMisses = 0;
    this.bumps = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.nitroFlash = 0;
    this.slowMo = 0;
    this.offroadT = 0;
    this.bumpFlash = 0;
    this.distScore = 0;
    this._prevS = baseS;
    this.total = 0;
  }

  // 速度倍率（Traffic Racer 精髓：开得越快，里程得分越值钱）
  getMultiplier(player) {
    const kmh = player.kmh;
    let m = 1;
    if (kmh >= 160) m = 2;
    else if (kmh >= 100) m = 1.5;
    if (player.nitroActive) m = Math.max(m, 3);
    return m;
  }

  // RoadSystem onChunkBuilt 回调：按区块放置收集品串
  onChunkBuilt(index, rng, s0) {
    if (rng() > 0.4) return;
    const count = 5 + Math.floor(rng() * 4);
    const baseS = s0 + 8 + rng() * 20;
    const lane = [-3.25, 0, 3.25][Math.floor(rng() * 3)];
    const weave = rng() < 0.45;
    const phase = rng() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const s = baseS + i * 5.5;
      const x = weave ? lane + Math.sin(i * 0.85 + phase) * 2.3 : lane;
      const y = this.ctx.road.roadY(s) + 1.15;
      this.items.push({ s, x, y, idx: -1, active: true });
    }
  }

  onNearMiss(npc) {
    this.nearMisses++;
    this.combo++;
    this.comboT = CONFIG.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const oncoming = !!(npc && npc.oncoming);
    if (oncoming) this.oncomingNearMisses++;
    const pts = Math.round(CONFIG.nearMissScore * this.combo * (oncoming ? 1.5 : 1));
    this.score += pts;
    this.slowMo = 0.45;
    if (!this.silent) {
      this.ui.nearMiss(pts, this.combo, oncoming);
      this.ctx.onNearMissFx && this.ctx.onNearMissFx(oncoming);
    }
  }

  onBump(npc) {
    this.combo = 0;
    this.comboT = 0;
    this.bumpFlash = 1;
    this.bumps++;
    if (!this.silent) {
      this.ui.bump();
      this.ctx.onBumpFx && this.ctx.onBumpFx();
    }
  }

  onOffroad(dt) {
    this.offroadT += dt;
    if (this.offroadT > 0.9 && this.combo > 0) { this.combo = 0; this.comboT = 0; }
  }

  onNitro() { this.nitroFlash = 1; }

  update(dt, player, time, fx) {
    // 连击倒计时
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.slowMo = Math.max(0, this.slowMo - dt * 1.6);
    this.nitroFlash = Math.max(0, this.nitroFlash - dt * 2);
    this.bumpFlash = Math.max(0, this.bumpFlash - dt * 1.5);
    this.offroadT = Math.max(0, this.offroadT - dt * (player.offroad ? 0 : 2));

    // 收集品：活跃窗口 + 拾取
    const win0 = player.s - 15, win1 = player.s + 280;
    let n = 0;
    const colColor = this.colColor;
    for (const it of this.items) {
      if (!it.active || it.s < win0 || it.s > win1) continue;
      // 拾取检测
      const dx = Math.abs(player.lateral - it.x);
      const ds = Math.abs(player.s - it.s);
      if (dx < 1.7 && ds < 2.2) {
        it.active = false;
        this.collects++;
        this.score += 25;
        const nitroGain = CONFIG.collectNitro * ((player.mods && player.mods.collectNitro) || 1);
        player.nitro = Math.min(100, player.nitro + nitroGain);
        if (fx && fx.burst) {
          this.ctx.road.frame(it.s, _fr);
          fx.burst(_p.set(_fr.pos.x + _fr.right.x * it.x, it.y, _fr.pos.z + _fr.right.z * it.x), colColor);
        }
        if (!this.silent) this.ctx.onCollectFx && this.ctx.onCollectFx(this.combo);
        continue;
      }
      if (it.idx < 0) { it.idx = n; }
      // 实例矩阵：道路相对坐标 → 世界坐标，旋转 + 浮动
      this.ctx.road.frame(it.s, _fr);
      const px = _fr.pos.x + _fr.right.x * it.x;
      const pz = _fr.pos.z + _fr.right.z * it.x;
      _p.set(px, it.y + Math.sin(time * 2.4 + it.s) * 0.16, pz);
      _q.setFromAxisAngle(UPV, time * 2 + it.s);
      _s.setScalar(1);
      _m.compose(_p, _q, _s);
      this.inst.setMatrixAt(n, _m);
      n++;
    }
    this.inst.count = n;
    this.inst.instanceMatrix.needsUpdate = true;
    // 清理身后旧数据防数组膨胀
    if (this.items.length > 600) {
      this.items = this.items.filter(it => it.s > player.s - 30);
      for (const it of this.items) it.idx = -1;
    }

    // 里程得分 × 速度倍率
    this.distScore += Math.max(0, player.s - this._prevS) * this.getMultiplier(player);
    this._prevS = player.s;
    this.baseScore = this.distScore;
    this.total = Math.floor(this.distScore) + this.score;
  }
}

const UPV = new THREE.Vector3(0, 1, 0);
