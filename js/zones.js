// 路途分区：随里程交替的地貌节奏（确定性生成，每日挑战全球一致）
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

// 每主题 3~4 个分区：weights 覆盖主题 propSet 权重，density/hill 为倍率，
// tint/tintAmt 为地形色偏移，scale 为指定道具的尺寸倍率，landmark 为分区起点的放大地标
export const ZONE_DEFS = {
  sunset: [
    { key: 'wheat', name: '麦浪旷野', weights: { stalk: 5, tree: 1.4, rock: 0.6 }, density: 1.15, hill: 0.65, tint: '#e9c05a', tintAmt: 0.3 },
    { key: 'windmill', name: '风车丘陵', weights: { stalk: 2.4, tree: 1.0, rock: 0.7, windmill: 3.2 }, density: 0.9, hill: 1.55, tint: '#8fae57', tintAmt: 0.34, scale: { windmill: 1.25 } },
    { key: 'grove', name: '疏林河谷', weights: { tree: 3.8, stalk: 1.4, rock: 0.8 }, density: 1.3, hill: 0.6, tint: '#71914e', tintAmt: 0.34 },
    { key: 'redrock', name: '红岩台地', weights: { rock: 3.8, stalk: 2.0, tree: 0.6 }, density: 0.7, hill: 1.3, tint: '#b0603a', tintAmt: 0.42, landmark: 'rock', scale: { rock: 1.3 } },
  ],
  neon: [
    { key: 'downtown', name: '霓虹峡谷', weights: { bldg: 4.6, pillar: 1.4, sign: 1.0 }, density: 1.35, hill: 0.45, tint: '#3a2a78', tintAmt: 0.35, landmark: 'bldg', scale: { bldg: 1.15 } },
    { key: 'industrial', name: '工业环线', weights: { pillar: 2.6, bldg: 1.4, sign: 1.8 }, density: 1.0, hill: 0.6, tint: '#5a4030', tintAmt: 0.3 },
    { key: 'outskirts', name: '电光旷野', weights: { pillar: 1.6, sign: 0.9, bldg: 0.5 }, density: 0.5, hill: 1.0, tint: '#16384e', tintAmt: 0.34 },
  ],
  snow: [
    { key: 'forest', name: '雪松林海', weights: { pine: 4.6, rock: 0.8 }, density: 1.35, hill: 0.95, tint: '#a4bcd4', tintAmt: 0.3, scale: { pine: 1.1 } },
    { key: 'tundra', name: '冰原旷野', weights: { pine: 0.6, rock: 1.4 }, density: 0.45, hill: 0.5, tint: '#ffffff', tintAmt: 0.32, landmark: 'rock', scale: { rock: 1.25 } },
    { key: 'pass', name: '雾凇山隘', weights: { pine: 2.2, rock: 2.6 }, density: 1.05, hill: 1.7, tint: '#7e96ae', tintAmt: 0.36, landmark: 'pine', scale: { pine: 1.2, rock: 1.2 } },
  ],
  ink: [
    { key: 'bamboo', name: '竹溪幽谷', weights: { bamboo: 4.0, rock: 0.9, inkTree: 0.8 }, density: 1.1, hill: 1.1, tint: '#8ca583', tintAmt: 0.3, scale: { bamboo: 1.15 } },
    { key: 'hamlet', name: '古塔乡野', weights: { inkTree: 2.0, pagoda: 1.2, rock: 0.8 }, density: 0.9, hill: 0.7, tint: '#f0e6c8', tintAmt: 0.3, landmark: 'pagoda' },
    { key: 'peaks', name: '群峰深处', weights: { inkTree: 0.9, rock: 1.8 }, density: 0.5, hill: 1.6, tint: '#6f6d66', tintAmt: 0.4, scale: { rock: 1.35, inkTree: 1.15 } },
  ],
};

const TRANS = 80; // 分区边界过渡距离（米）

export class ZoneSystem {
  constructor(themeKey, seed) {
    this.defs = ZONE_DEFS[themeKey] || ZONE_DEFS.sunset;
    this.rng = mulberry32((seed ^ 0x5EED1) >>> 0);
    this.segments = [];   // { start, end, def, entered, landmarkDone }
    this.covered = 0;
    this.lastIdx = -1;
    this._res = { seg: null, from: null, t: 1 };
    this._blend = new THREE.Color();
    this._cb = new THREE.Color();
  }

  ensure(s) {
    while (this.covered < s + 3000) {
      let idx;
      do { idx = Math.floor(this.rng() * this.defs.length); } while (idx === this.lastIdx && this.defs.length > 1);
      const len = 850 + this.rng() * 750;
      this.segments.push({ start: this.covered, end: this.covered + len, def: this.defs[idx], entered: false, landmarkDone: false });
      this.covered += len;
      this.lastIdx = idx;
    }
  }

  // 返回复用对象 { seg, from, t }：t 为从上一分区混入的进度 0..1
  at(s) {
    this.ensure(s);
    const res = this._res;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (s >= seg.start && s < seg.end) {
        res.seg = seg;
        if (i > 0 && s - seg.start < TRANS) { res.from = this.segments[i - 1]; res.t = (s - seg.start) / TRANS; }
        else { res.from = null; res.t = 1; }
        return res;
      }
    }
    res.seg = this.segments[this.segments.length - 1];
    res.from = null; res.t = 1;
    return res;
  }

  // 供 heightAt 用的起伏倍率（纯 s 函数，保证跨区块无缝）
  hillAt(s) {
    const { seg, from, t } = this.at(s);
    const e = t * t * (3 - 2 * t);
    const a = from ? from.def.hill ?? 1 : seg.def.hill ?? 1;
    const b = seg.def.hill ?? 1;
    return a + (b - a) * e;
  }

  // 地形色偏移（纯 s 函数）。过渡带内两侧 tint 颜色按权重预混成单一
  // (color, amt)，保证 lerp(地表色, color, amt) 全程平滑无中点跳变
  tintAt(s, out) {
    const { seg, from, t } = this.at(s);
    const e = t * t * (3 - 2 * t);
    const bAmt = seg.def.tintAmt || 0;
    const aAmt = from ? (from.def.tintAmt || 0) : bAmt;
    out.amt = aAmt + (bAmt - aAmt) * e;
    const aCol = from && from.def.tint ? from.def.tint : null;
    const bCol = seg.def.tint || null;
    if (!aCol && !bCol) { out.color = null; return out; }
    const wa = aCol ? aAmt * (1 - e) : 0;
    const wb = bCol ? bAmt * e : 0;
    const w = wa + wb;
    if (w <= 0.0001) { out.color = bCol || aCol; return out; }
    const c = this._blend;
    if (aCol && bCol) c.set(aCol).lerp(this._cb.set(bCol), wb / w);
    else c.set(aCol || bCol);
    out.color = c;
    return out;
  }

  // 供 chunk 采样：混合后的道具权重/密度/尺寸倍率（分配对象，每区块一次）
  sample(s) {
    const { seg, from, t } = this.at(s);
    const e = t * t * (3 - 2 * t);
    const a = from ? from.def : seg.def;
    const b = seg.def;
    const mixN = (x, y) => x + (y - x) * e;
    const weights = {};
    const keys = new Set([...Object.keys(a.weights || {}), ...Object.keys(b.weights || {})]);
    for (const k of keys) weights[k] = mixN((a.weights || {})[k] || 0, (b.weights || {})[k] || 0);
    const scale = {};
    const skeys = new Set([...Object.keys(a.scale || {}), ...Object.keys(b.scale || {})]);
    for (const k of skeys) scale[k] = mixN((a.scale || {})[k] || 1, (b.scale || {})[k] || 1);
    return {
      seg,
      weights,
      scale,
      density: mixN(a.density ?? 1, b.density ?? 1),
    };
  }

  // 每帧轮询：进入新分区时返回分区名（供 toast），只触发一次
  pollEnter(s) {
    const { seg } = this.at(s);
    if (!seg.entered && s > seg.start + 30) {
      seg.entered = true;
      if (this.segments.length > 40) this.segments.splice(0, 20);
      return seg.def.name;
    }
    return null;
  }
}
