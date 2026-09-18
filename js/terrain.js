// 路侧低多边形地形 + 程序化道具散布（分区驱动 + 软碰撞登记）
import * as THREE from 'three';
import { CONFIG, perfProfile } from './config.js';
import { fbm2 } from './rng.js';

const SIDE_COLS = [7.5, 11.5, 17, 25, 36, 52, 73, 98];
const ROW_STEP = 12;

// 有碰撞体积的道具半径（× scale）；缺省类型（麦秆/灯柱/招牌）可穿过
const PROP_COLLIDER = { tree: 1.1, pine: 1.05, rock: 1.0, inkTree: 1.2, windmill: 1.1, pagoda: 2.3, bamboo: 0.85, pavilion: 2.0 };
const BUILD_R = [3.5, 4.5, 5.5]; // bldg 三档平面半宽

export class TerrainSystem {
  constructor(ctx) {
    this.ctx = ctx; // { scene, seed, theme, road, zones? }
    this.seed = ctx.seed;
    this.prof = perfProfile();
    this.matteMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    this.bldgMat = new THREE.MeshBasicMaterial({ map: makeWindowTexture() });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.windmills = new WindmillPool(this);
    this.surfaces = new Map();  // 区块号 → 渲染网格高度（含抖动），供 surfaceY 精确采样
    this._tint = { amt: 0, color: null };
    this._tintCol = new THREE.Color();
  }

  heightAt(x, s) {
    const roadY = this.ctx.road.roadY(s);
    const d = Math.abs(x) - 7;
    if (d <= 0) return roadY - 0.3;
    const t = Math.min(Math.max((d - 3) / 42, 0), 1); // 近路 10m 内保持平坦，55m 起满幅
    const hillMul = this.ctx.zones ? this.ctx.zones.hillAt(s) : 1;
    const amp = this.ctx.theme.hillAmp * hillMul;
    const rise = t * t * 14;
    const n1 = (fbm2(x * 0.012, s * 0.012, this.seed) - 0.5) * 12 * t;
    const n2 = fbm2(x * 0.004, s * 0.004, this.seed + 555) * 40 * t * t;
    return roadY - 0.3 + rise * amp + n1 + n2 * amp;
  }

  // 精确采样"玩家看到的地表"：对渲染网格（含顶点抖动）做双线性插值，
  // 消除解析面与网格弦线之间的偏差（越野上坡穿模的根因）
  surfaceY(lat, s) {
    const d = Math.abs(lat) - 7;
    if (d <= 0) return this.ctx.road.roadY(s) - 0.3;
    const a = Math.abs(lat);
    const ci = Math.floor(s / CONFIG.chunkLen);
    const surf = this.surfaces.get(ci);
    if (!surf) return this.heightAt(lat, s);
    const hs = surf[lat < 0 ? 'L' : 'R'];
    const nRow = Math.floor(CONFIG.chunkLen / ROW_STEP) + 1;
    const nCol = SIDE_COLS.length;
    const fs = (s - ci * CONFIG.chunkLen) / ROW_STEP;
    let r0 = Math.min(Math.floor(fs), nRow - 2);
    const tz = fs - r0;
    if (a <= SIDE_COLS[0]) return hs[r0 * nCol] * (1 - tz) + hs[(r0 + 1) * nCol] * tz;
    let k = 0;
    while (k < nCol - 2 && a > SIDE_COLS[k + 1]) k++;
    const tx = Math.min((a - SIDE_COLS[k]) / (SIDE_COLS[k + 1] - SIDE_COLS[k]), 1);
    const h0 = hs[r0 * nCol + k] * (1 - tx) + hs[r0 * nCol + k + 1] * tx;
    const h1 = hs[(r0 + 1) * nCol + k] * (1 - tx) + hs[(r0 + 1) * nCol + k + 1] * tx;
    return h0 * (1 - tz) + h1 * tz;
  }

  // 由 RoadSystem 的 onChunkBuilt 驱动；网格与几何由 RoadSystem 统一销毁
  buildChunk(index, rng, s0, chunk) {
    const theme = this.ctx.theme;
    const surf = { L: null, R: null };
    for (const side of [-1, 1]) {
      const geo = this.buildSide(side, index, s0, surf);
      const mesh = new THREE.Mesh(geo, this.matteMat);
      mesh.receiveShadow = true;
      chunk.group.add(mesh);
    }
    this.surfaces.set(index, surf);
    chunk.onDispose.push(() => this.surfaces.delete(index));
    const buckets = { matte: new Bucket(), bldg: new Bucket(), glow: new Bucket() };
    const zones = this.ctx.zones;
    const zone = zones ? zones.sample(s0 + CONFIG.chunkLen / 2) : null;
    const density = this.prof.propDensity * theme.propDensity * (zone ? zone.density : 1);
    const count = Math.max(3, Math.round(density * 26));
    const set = theme.propSet;
    // 分区权重覆盖主题权重
    let effSet = set;
    if (zone && zone.seg.def.weights) {
      effSet = [];
      for (const p of set) {
        const w = zone.weights[p.type];
        if (w === undefined || w > 0) effSet.push({ ...p, w: w === undefined ? p.w : w });
      }
      if (!effSet.length) effSet = set;
    }
    const totalW = effSet.reduce((a, p) => a + p.w, 0);
    for (let i = 0; i < count; i++) {
      let pick = rng() * totalW, def = effSet[0];
      for (const p of effSet) { pick -= p.w; if (pick <= 0) { def = p; break; } }
      this.placeProp(def, rng, s0, buckets, chunk, zone);
    }
    // 分区地标：起点附近放一个 2.5~3 倍放大道具
    if (zones) this.placeLandmarks(zones, s0, CONFIG.chunkLen, rng, buckets, chunk);
    for (const key of ['matte', 'bldg', 'glow']) {
      const geo = buckets[key].finalize();
      if (!geo) continue;
      const mat = key === 'matte' ? this.matteMat : key === 'bldg' ? this.bldgMat : this.glowMat;
      const mesh = new THREE.Mesh(geo, mat);
      if (key !== 'glow') { mesh.castShadow = true; mesh.receiveShadow = true; }
      chunk.group.add(mesh);
    }
    if (theme.windmills) {
      this.windmills.registerChunk(index, rng, s0, this._landmarkWm, zone);
      chunk.onDispose.push(() => this.windmills.releaseChunk(index));
      this._landmarkWm = null;
    }
  }

  placeProp(def, rng, s0, buckets, chunk, zone) {
    const variant = Math.floor(rng() * (def.variants || 1));
    const tpl = getTemplate(def.type, this.ctx.theme, variant);
    if (!tpl) return;
    const side = rng() < 0.5 ? -1 : 1;
    const off = side * (def.min + Math.pow(rng(), 1.55) * (def.max - def.min)); // 道路相对偏移
    const s = s0 + rng() * CONFIG.chunkLen;
    const y = this.surfaceY(off, s);
    const scale = (def.scale || 1) * (0.75 + rng() * 0.8) * (zone ? zone.scale[def.type] || 1 : 1);
    // 道路相对偏移 → 世界坐标（沿道路标架）
    const fr = this.ctx.road.frame(s, this._fr || (this._fr = this.ctx.road.makeFrame()));
    const wx = fr.pos.x + fr.right.x * off;
    const wz = fr.pos.z + fr.right.z * off;
    const m = new THREE.Matrix4()
      .makeRotationY(rng() * Math.PI * 2)
      .premultiply(new THREE.Matrix4().makeScale(scale, scale * (0.9 + rng() * 0.35), scale))
      .setPosition(wx, y - 0.15, wz);
    buckets[tpl.mat].append(tpl, m);
    // 登记软碰撞体积
    if (chunk && chunk.colliders) {
      let cr = PROP_COLLIDER[def.type];
      if (def.type === 'bldg') cr = BUILD_R[variant % 3];
      if (cr) chunk.colliders.push({ s, off, r: cr * scale });
    }
  }

  placeLandmarks(zones, s0, len, rng, buckets, chunk) {
    for (const seg of zones.segments) {
      if (seg.landmarkDone || seg.start < s0 || seg.start >= s0 + len) continue;
      seg.landmarkDone = true;
      const type = seg.def.landmark;
      if (!type) continue;
      const def = this.ctx.theme.propSet.find(p => p.type === type);
      if (!def) continue;
      const variant = Math.floor(rng() * (def.variants || 1));
      const tpl = getTemplate(type, this.ctx.theme, variant);
      if (!tpl) continue;
      const side = rng() < 0.5 ? -1 : 1;
      const off = side * (13 + rng() * 6);
      const s = seg.start + 12 + rng() * 10;
      const scale = (2.5 + rng() * 0.5) * ((seg.def.scale && seg.def.scale[type]) || 1);
      const y = this.surfaceY(off, s);
      const fr = this.ctx.road.frame(s, this._fr || (this._fr = this.ctx.road.makeFrame()));
      const wx = fr.pos.x + fr.right.x * off;
      const wz = fr.pos.z + fr.right.z * off;
      const m = new THREE.Matrix4()
        .makeRotationY(rng() * Math.PI * 2)
        .premultiply(new THREE.Matrix4().makeScale(scale, scale, scale))
        .setPosition(wx, y - 0.15, wz);
      buckets[tpl.mat].append(tpl, m);
      let cr = PROP_COLLIDER[type];
      if (type === 'bldg') cr = BUILD_R[variant % 3];
      if (chunk && chunk.colliders && cr) chunk.colliders.push({ s, off, r: cr * scale });
      // 风车地标转由旋转叶片池承载
      if (type === 'windmill' && this.ctx.theme.windmills) {
        this._landmarkWm = this._landmarkWm || [];
        this._landmarkWm.push({ s, off, y, scale });
      }
    }
  }

  buildSide(side, index, s0, surf) {
    const theme = this.ctx.theme;
    const zones = this.ctx.zones;
    const nRow = Math.floor(CONFIG.chunkLen / ROW_STEP) + 1;
    const nCol = SIDE_COLS.length;
    const rowsPerChunk = Math.floor(CONFIG.chunkLen / ROW_STEP);
    const pos = new Float32Array(nRow * nCol * 3);
    const col = new Float32Array(nRow * nCol * 3);
    const hs = new Float32Array(nRow * nCol);
    const idx = new Uint32Array((nRow - 1) * (nCol - 1) * 6);
    const fr = this.ctx.road.makeFrame();
    const cBase = new THREE.Color(theme.terrain.base);
    const cAlt = new THREE.Color(theme.terrain.alt);
    const cPatch = theme.terrain.patch ? new THREE.Color(theme.terrain.patch) : null;
    const c = new THREE.Color();
    for (let r = 0; r < nRow; r++) {
      const s = s0 + r * ROW_STEP;
      this.ctx.road.frame(s, fr);
      // 分区地形色偏移（纯 s 函数，跨区块无缝）
      let tintAmt = 0;
      let tintCol = null;
      if (zones) {
        const tint = zones.tintAt(s, this._tint);
        tintAmt = tint.amt;
        if (tint.color && tintAmt > 0.001) tintCol = this._tintCol.copy(tint.color);
      }
      // 抖动用全局行号：相邻区块接缝处的顶点保持一致，避免裂缝
      const gRow = index * rowsPerChunk + r;
      for (let k = 0; k < nCol; k++) {
        const off = SIDE_COLS[k] * side;
        const x = fr.pos.x + fr.right.x * off;
        const z = fr.pos.z + fr.right.z * off;
        const y = this.heightAt(off, s) + (k < 3 ? 0 : (hashJitter(gRow, k, side) - 0.5) * 1.0 * 0.6 * Math.min((k - 2) / 3, 1));
        const i = (r * nCol + k) * 3;
        pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
        hs[r * nCol + k] = y;
        const n = fbm2(x * 0.03, s * 0.03, this.seed + 77);
        c.copy(cBase).lerp(cAlt, n);
        if (cPatch && fbm2(x * 0.045, s * 0.045, this.seed + 123) > 0.63) c.lerp(cPatch, 0.55);
        if (tintCol) c.lerp(tintCol, tintAmt);
        col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
      }
    }
    let o = 0;
    for (let r = 0; r < nRow - 1; r++) {
      for (let k = 0; k < nCol - 1; k++) {
        const a = r * nCol + k, b = a + 1, d = a + nCol, e = d + 1;
        if (side < 0) { idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = b; idx[o++] = d; idx[o++] = e; }
        else { idx[o++] = a; idx[o++] = b; idx[o++] = d; idx[o++] = b; idx[o++] = e; idx[o++] = d; }
      }
    }
    if (surf) surf[side < 0 ? 'L' : 'R'] = hs;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }
}

function hashJitter(a, b, c, d) {
  let h = (Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263) ^ Math.imul(c + 13, 2246822519) ^ Math.imul(d + 3, 3266489917)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- 几何桶：模板实例合并为单个几何 ----------
class Bucket {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.hasUV = false; }
  append(tpl, matrix) {
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const p = tpl.pos, n = tpl.nor;
    const v = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i < p.length; i += 3) {
      v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      nrm.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(nm).normalize();
      this.nor.push(nrm.x, nrm.y, nrm.z);
    }
    for (let i = 0; i < tpl.col.length; i++) this.col.push(tpl.col[i]);
    if (tpl.uv) {
      for (let i = 0; i < tpl.uv.length; i++) this.uv.push(tpl.uv[i]);
      this.hasUV = true;
    }
  }
  finalize() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    if (this.hasUV) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    return g;
  }
}

// ---------- 道具模板缓存（按 类型+主题+变体） ----------
const tplCache = new Map();
function getTemplate(type, theme, variant) {
  const key = `${type}|${theme.key}|${variant}`;
  if (tplCache.has(key)) return tplCache.get(key);
  const tpl = buildTemplate(type, theme, variant);
  tplCache.set(key, tpl);
  return tpl;
}

// 把几何以纯色并入模板桶
function pushGeo(bucket, geo, color, x = 0, y = 0, z = 0, withUV = null) {
  geo.translate(x, y, z);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const colArr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b; }
  for (let i = 0; i < g.attributes.position.array.length; i++) bucket.pos.push(g.attributes.position.array[i]);
  for (let i = 0; i < g.attributes.normal.array.length; i++) bucket.nor.push(g.attributes.normal.array[i]);
  for (let i = 0; i < colArr.length; i++) bucket.col.push(colArr[i]);
  if (withUV) {
    const uv = g.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) {
      bucket.uv.push(uv[i] * withUV[0], uv[i + 1] * withUV[1]);
    }
    bucket.hasUV = true;
  }
  if (g !== geo) g.dispose();
  geo.dispose();
}

function buildTemplate(type, theme, variant) {
  const bucket = new Bucket();
  const P = theme.props;

  switch (type) {
    case 'tree':
      pushGeo(bucket, new THREE.CylinderGeometry(0.16, 0.26, 1.6, 5), P.tree.trunk, 0, 0.8, 0);
      pushGeo(bucket, new THREE.IcosahedronGeometry(1.35, 0), variant ? P.tree.crown2 : P.tree.crown, 0, 2.55, 0);
      break;
    case 'inkTree':
      pushGeo(bucket, new THREE.CylinderGeometry(0.12, 0.22, 2.4, 5), '#3a3f45', 0, 1.2, 0);
      pushGeo(bucket, new THREE.IcosahedronGeometry(1.6, 0), variant ? '#6a7078' : '#454b53', 0, 3.4, 0);
      break;
    case 'pine':
      pushGeo(bucket, new THREE.CylinderGeometry(0.13, 0.2, 1.3, 5), P.pine.trunk, 0, 0.6, 0);
      pushGeo(bucket, new THREE.ConeGeometry(1.45, 2.7, 6), P.pine.base, 0, 2.3, 0);
      pushGeo(bucket, new THREE.ConeGeometry(1.05, 2.1, 6), P.pine.mid, 0, 3.7, 0);
      pushGeo(bucket, new THREE.ConeGeometry(0.68, 1.5, 6), P.pine.top, 0, 4.9, 0);
      break;
    case 'bamboo': {
      // 竹丛：数根细竿 + 顶叶
      const n = 4 + (variant % 3);
      const cane = variant ? '#6d7d5a' : '#77875f';
      const leaf = variant ? '#7d8f66' : '#87996e';
      for (let i = 0; i < n; i++) {
        const h = 2.6 + ((i * 37) % 10) / 10 * 1.6;
        const a = (i / n) * Math.PI * 2;
        const gx = Math.cos(a) * 0.42, gz = Math.sin(a) * 0.42;
        const stick = new THREE.CylinderGeometry(0.05, 0.075, h, 4);
        stick.rotateZ(((i * 53) % 10) / 10 * 0.16 - 0.08);
        stick.translate(gx, h / 2, gz);
        pushGeo(bucket, stick, cane);
        const tip = new THREE.ConeGeometry(0.3, 0.95, 4);
        tip.rotateZ(((i * 31) % 10) / 10 * 0.5 - 0.25);
        tip.translate(gx, h + 0.32, gz);
        pushGeo(bucket, tip, leaf);
      }
      break;
    }
    case 'pavilion': {
      // 凉亭：台基 + 四柱 + 攒尖顶（水墨地标）
      const roof = (P.pagoda && P.pagoda.roof) || '#b03a2e';
      pushGeo(bucket, new THREE.BoxGeometry(2.6, 0.35, 2.6), '#8f887a', 0, 0.18, 0);
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        pushGeo(bucket, new THREE.CylinderGeometry(0.09, 0.11, 2.1, 5), '#565048', px, 1.35, pz);
      }
      const roofCone = new THREE.ConeGeometry(2.15, 1.15, 4);
      roofCone.rotateY(Math.PI / 4);
      pushGeo(bucket, roofCone, roof, 0, 3.0, 0);
      pushGeo(bucket, new THREE.ConeGeometry(0.12, 0.5, 4), roof, 0, 3.8, 0);
      break;
    }
    case 'rock':
      pushGeo(bucket, new THREE.IcosahedronGeometry(1, 0), variant ? P.rock2 : P.rock, 0, 0.35, 0);
      break;
    case 'stalk':
      pushGeo(bucket, new THREE.ConeGeometry(0.09, 1.15, 4), variant ? P.stalk.a : P.stalk.b, 0, 0.55, 0);
      break;
    case 'windmill': {
      pushGeo(bucket, new THREE.CylinderGeometry(0.35, 0.75, 9, 5), P.windmill.tower, 0, 4.5, 0);
      pushGeo(bucket, new THREE.BoxGeometry(0.6, 0.6, 0.6), P.windmill.tower, 0, 9, 0.3);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.BoxGeometry(0.22, 3.4, 0.08);
        blade.translate(0, 1.7, 0);
        blade.rotateZ(i * Math.PI / 2 + 0.4);
        blade.translate(0, 9, 0.62);
        pushGeo(bucket, blade, P.windmill.blade);
      }
      break;
    }
    case 'pillar':
      pushGeo(bucket, new THREE.BoxGeometry(0.14, 5.5, 0.14), '#11131f', 0, 2.75, 0);
      pushGeo(bucket, new THREE.BoxGeometry(0.5, 0.22, 0.22), variant ? P.neon.a : P.neon.b, 0, 5.55, 0);
      break;
    case 'sign':
      pushGeo(bucket, new THREE.BoxGeometry(0.14, 4.4, 0.14), '#11131f', 0, 2.2, 0);
      pushGeo(bucket, new THREE.BoxGeometry(2.6, 1.15, 0.16), variant ? P.neon.a : P.neon.b, 0, 4.8, 0);
      break;
    case 'bldg': {
      const dims = [[7, 16, 7], [9, 26, 8], [11, 36, 9]][variant % 3];
      const [w, h, d] = dims;
      pushGeo(bucket, new THREE.BoxGeometry(w, h, d), '#ffffff', 0, h / 2, 0, [Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 4))]);
      pushGeo(bucket, new THREE.BoxGeometry(0.35, 0.35, 0.35), variant === 1 ? P.neon.a : P.neon.b, 0, h + 0.4, 0);
      break;
    }
    case 'pagoda': {
      const body = P.pagoda.body, roof = P.pagoda.roof;
      let y = 0, w = 2.1;
      for (let lv = 0; lv < 3; lv++) {
        pushGeo(bucket, new THREE.BoxGeometry(w, 1.1, w), body, 0, y + 0.55, 0);
        const r = new THREE.ConeGeometry(w * 0.85, 0.85, 4);
        r.rotateY(Math.PI / 4);
        pushGeo(bucket, r, roof, 0, y + 1.5, 0);
        y += 1.95; w *= 0.78;
      }
      pushGeo(bucket, new THREE.ConeGeometry(0.16, 0.55, 4), roof, 0, y + 0.25, 0);
      break;
    }
    default:
      return null;
  }
  const mat = type === 'bldg' ? 'bldg' : (type === 'sign' || type === 'pillar') ? 'glow' : 'matte';
  return { mat, pos: bucket.pos, nor: bucket.nor, col: bucket.col, uv: bucket.hasUV ? bucket.uv : null };
}

// ---------- 风车叶片池（旋转动画） ----------
class WindmillPool {
  constructor(sys) {
    this.sys = sys;
    this.max = 14;
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.BoxGeometry(0.24, 3.6, 0.08);
      b.translate(0, 1.8, 0);
      b.rotateZ(i * Math.PI / 2);
      parts.push(b.toNonIndexed());
      b.dispose();
    }
    let total = 0;
    for (const g of parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3);
    let off = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, off * 3); off += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#efe9da', flatShading: true, roughness: 0.8 }), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.slots = new Map();
    this.freeSlots = [];
    for (let i = 0; i < this.max; i++) this.freeSlots.push(i);
    this._m = new THREE.Matrix4();
    this._s = new THREE.Matrix4();
    this._r = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._axis = new THREE.Vector3(0, 0, 1);
  }
  registerChunk(index, rng, s0, landmarks, zone) {
    const count = rng() < 0.6 ? 1 : 2;
    const arr = [];
    const add = (off, s, y, scale, speed, phase) => {
      if (!this.freeSlots.length) return;
      const fr = this.sys.ctx.road.frame(s, this.sys.ctx.road.makeFrame());
      const wx = fr.pos.x + fr.right.x * off;
      const wz = fr.pos.z + fr.right.z * off;
      const base = new THREE.Matrix4().makeRotationY(rng() * Math.PI * 2)
        .premultiply(this._s.makeScale(scale, scale, scale))
        .setPosition(wx, y + 9 * scale, wz);
      arr.push({ base, speed, phase, slot: this.freeSlots.pop() });
    };
    const zScale = (zone && zone.scale.windmill) || 1;
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const off = side * (16 + rng() * 40);
      const s = s0 + rng() * CONFIG.chunkLen;
      const y = this.sys.surfaceY(off, s);
      add(off, s, y, zScale, 0.5 + rng() * 0.7, rng() * 6.28);
    }
    if (landmarks) {
      for (const lm of landmarks) add(lm.off, lm.s, lm.y, lm.scale, 0.35 + rng() * 0.3, rng() * 6.28);
    }
    if (arr.length) this.slots.set(index, arr);
  }
  releaseChunk(index) {
    const arr = this.slots.get(index);
    if (!arr) return;
    for (const it of arr) this.freeSlots.push(it.slot);
    this.slots.delete(index);
  }
  update(time) {
    let n = 0;
    for (const arr of this.slots.values()) {
      for (const it of arr) {
        this._q.setFromAxisAngle(this._axis, time * it.speed + it.phase);
        this._r.makeRotationFromQuaternion(this._q);
        this._m.multiplyMatrices(it.base, this._r);
        this.mesh.setMatrixAt(it.slot, this._m);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  addToScene(scene) { scene.add(this.mesh); }
  reset() {
    for (const k of [...this.slots.keys()]) this.releaseChunk(k);
    this.mesh.count = 0;
  }
}

// ---------- 霓虹楼群窗户贴图 ----------
function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0e1e';
  g.fillRect(0, 0, 64, 64);
  const colors = ['#5ee6ff', '#ff5fd0', '#7f8cff', '#ffd166'];
  let seedN = 7;
  const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (rnd() < 0.42) continue;
      g.fillStyle = colors[(rnd() * colors.length) | 0];
      g.globalAlpha = 0.35 + rnd() * 0.65;
      g.fillRect(x * 8 + 2, y * 8 + 2, 4, 5);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
