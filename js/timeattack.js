// 计时赛：初始 60 秒，穿过路上光门续时（递减），耗时结束
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const TIME_CFG = {
  start: 60,        // 初始秒数
  firstGate: 420,   // 首个光门距离（m，相对起点）
  gapMin: 520,      // 光门间距范围
  gapMax: 640,
  gain0: 10,        // 首个加时
  gainMin: 5,       // 最低加时
  gainStep: 3,      // 每过一个光门后每 3 个递减 1s
};

export class TimeAttack {
  constructor(ctx) {
    this.ctx = ctx; // { scene, road, theme }
    this.expired = false;
    this.onGain = null;   // (gain) => void
    this.onExpire = null;
    // 光门视觉：横跨路面的加色光墙
    const tex = TimeAttack.tex || (TimeAttack.tex = makeGateTexture());
    this.mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: '#ffffff',
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 6.5), this.mat);
    this.mesh.visible = false;
    ctx.scene.add(this.mesh);
    this._fr = ctx.road.makeFrame();
    this.reset(0);
  }

  reset(startS) {
    this.timeLeft = TIME_CFG.start;
    this.passed = 0;
    this.nextGateS = startS + TIME_CFG.firstGate;
    this.expired = false;
    this._pulse = 0;
  }

  gainFor() {
    return Math.max(TIME_CFG.gainMin, TIME_CFG.gain0 - Math.floor(this.passed / TIME_CFG.gainStep));
  }

  // 返回本次过门获得的秒数（未过门返回 0）
  update(dt, player) {
    if (this.expired) return 0;
    this.timeLeft -= dt;
    this._pulse += dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.expired = true;
      this.onExpire && this.onExpire();
      return 0;
    }
    let gain = 0;
    if (player.s >= this.nextGateS) {
      gain = this.gainFor();
      this.passed++;
      this.timeLeft += gain;
      this.nextGateS += TIME_CFG.gapMin + Math.random() * (TIME_CFG.gapMax - TIME_CFG.gapMin);
      this.onGain && this.onGain(gain);
    }
    this.syncMesh(player);
    return gain;
  }

  syncMesh(player) {
    const fr = this.ctx.road.frame(this.nextGateS, this._fr);
    this.mesh.visible = true;
    this.mesh.position.set(fr.pos.x, fr.pos.y + 3.0, fr.pos.z);
    this.mesh.rotation.set(0, Math.atan2(fr.tan.x, fr.tan.z) + Math.PI, 0);
    const pulse = 0.72 + 0.28 * Math.sin(this._pulse * 5);
    this.mat.opacity = 0.5 + 0.4 * pulse;
    this.mesh.scale.set(1, pulse, 1);
  }

  dispose() {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

function makeGateTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  // 竖向亮边，暗示"门柱"
  const edge = g.createLinearGradient(0, 0, 128, 0);
  edge.addColorStop(0, 'rgba(255,255,255,0.9)');
  edge.addColorStop(0.12, 'rgba(255,255,255,0.15)');
  edge.addColorStop(0.88, 'rgba(255,255,255,0.15)');
  edge.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = edge;
  g.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
