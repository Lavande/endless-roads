// 程序化道路：解析曲线 + 区块网格管理
import * as THREE from 'three';
import { CONFIG, perfProfile } from './config.js';
import { mulberry32 } from './rng.js';

// 道路中心线：P(s) = ( X(s), Y(s), -s )，s 为沿路里程（≈z 距离）
// 横向谐波幅值由目标弯道半径反推（κ=A·f² → A=1/(R·f²)），
// 并受低频"节奏" m(s) 调制：长直道（R 放大数倍）与连续弯段交替
export class RoadPath {
  constructor(seed) {
    const r = mulberry32(seed ^ 0x9E3779B9);
    // 横向：两个主弯曲分量 [波长 m, 弯段最小半径 m]
    const bend = [
      [750 + r() * 750, 260 + r() * 240],
      [380 + r() * 320, 420 + r() * 380],
    ];
    this.px = bend.map(([wl, rad]) => {
      const f = Math.PI * 2 / wl;
      return { a: 1 / (rad * f * f), f, p: r() * Math.PI * 2 };
    });
    // 纵向：主坡 4~7% + 次坡 1.5~2.5%，产生可见的翻越起伏
    const hills = [
      [520 + r() * 480, 0.04 + r() * 0.03],
      [130 + r() * 110, 0.015 + r() * 0.01],
    ];
    this.py = hills.map(([wl, grade]) => {
      const f = Math.PI * 2 / wl;
      return { a: grade / f, f, p: r() * Math.PI * 2 };
    });
    // 节奏调制 m ∈ [0.16, 1]：谷值附近为长直道（曲率缩至 ~1/6）
    this.rmF = Math.PI * 2 / (1600 + r() * 1600);
    this.rmP = r() * Math.PI * 2;
    this.rmMin = 0.16;
    this.rmAmp = (1 - this.rmMin) * 0.5;
    this.rmMid = this.rmMin + this.rmAmp;
  }
  m(s) { return this.rmMid + this.rmAmp * Math.sin(s * this.rmF + this.rmP); }
  dm(s) { return this.rmAmp * this.rmF * Math.cos(s * this.rmF + this.rmP); }
  ddm(s) { return -this.rmAmp * this.rmF * this.rmF * Math.sin(s * this.rmF + this.rmP); }
  x(s) { const m = this.m(s); let v = 0; for (const q of this.px) v += q.a * m * Math.sin(s * q.f + q.p); return v; }
  // 乘积法则同步修正导数，保持解析精度
  dx(s) {
    const m = this.m(s), d = this.dm(s); let v = 0;
    for (const q of this.px) v += q.a * (d * Math.sin(s * q.f + q.p) + m * q.f * Math.cos(s * q.f + q.p));
    return v;
  }
  ddx(s) {
    const m = this.m(s), d = this.dm(s), dd = this.ddm(s); let v = 0;
    for (const q of this.px) {
      const sn = Math.sin(s * q.f + q.p), cs = Math.cos(s * q.f + q.p);
      v += q.a * (dd * sn + 2 * d * q.f * cs - m * q.f * q.f * sn);
    }
    return v;
  }
  y(s) { let v = 0; for (const q of this.py) v += q.a * Math.sin(s * q.f + q.p); return v; }
  dy(s) { let v = 0; for (const q of this.py) v += q.a * q.f * Math.cos(s * q.f + q.p); return v; }
  curvature(s) { return this.ddx(s); }
}

const _tan = new THREE.Vector3();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function makeFrame() {
  return { pos: new THREE.Vector3(), tan: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
}

export class RoadSystem {
  constructor(ctx) {
    this.ctx = ctx;              // { scene, theme, seed }
    this.path = new RoadPath(ctx.seed);
    this.group = new THREE.Group();
    this.group.name = 'roadChunks';
    ctx.scene.add(this.group);
    this.chunks = new Map();     // index -> { index, group, onDispose[], colliders[] }
    this.listeners = [];         // onChunkBuilt(index, rng, s0)
    this.prof = perfProfile();
  }

  onChunkBuilt(fn) { this.listeners.push(fn); }

  // s 处道路标架 → out {pos, tan, right, up}
  frame(s, out) {
    const p = this.path;
    out.pos.set(p.x(s), p.y(s), -s);
    _tan.set(p.dx(s), p.dy(s), -1).normalize();
    _right.crossVectors(_tan, UP).normalize();
    out.tan.copy(_tan);
    out.right.copy(_right);
    out.up.crossVectors(_right, _tan).normalize();
    return out;
  }
  roadY(s) { return this.path.y(s); }
  makeFrame() { return makeFrame(); }

  update(playerS) {
    const ci = Math.floor(playerS / CONFIG.chunkLen);
    const ahead = this.prof.chunkAhead;
    for (let i = ci - CONFIG.chunkBehind; i <= ci + ahead; i++) {
      if (!this.chunks.has(i)) this.buildChunk(i);
    }
    for (const [i, c] of [...this.chunks]) {
      if (i < ci - CONFIG.chunkBehind - 1 || i > ci + ahead + 1) this.disposeChunk(c);
    }
  }

  disposeAll() {
    for (const c of [...this.chunks.values()]) this.disposeChunk(c);
  }

  disposeChunk(c) {
    c.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.ctx.scene; // noop keep
    this.group.remove(c.group);
    for (const fn of c.onDispose) fn();
    this.chunks.delete(c.index);
  }

  buildChunk(index) {
    const { theme } = this.ctx;
    const len = CONFIG.chunkLen, sub = CONFIG.subStep;
    const rows = len / sub;
    const s0 = index * len;
    const rng = mulberry32((this.ctx.seed ^ Math.imul(index + 7349, 2654435761)) >>> 0);
    const group = new THREE.Group();
    const onDispose = [];
    const chunk = { index, group, onDispose, colliders: [] };

    // 路面（含标线，顶点色）
    {
      const cols = [-7.8, -7.0, -6.7, -6.3, -0.18, 0.18, 6.3, 6.7, 7.0, 7.8];
      const T = theme.road;
      const bandColor = (band, row) => {
        if (band === 2 || band === 6) return T.edgeLine;
        if (band === 4) return (row % 2 === 0) ? T.dash : T.asphalt;
        if (band === 0) return T.shoulderL(row % 2 === 1);
        if (band === 8) return T.shoulderR(row % 2 === 1);
        return T.asphalt;
      };
      const geo = buildRibbon(this, s0, rows, sub, cols, bandColor, 0);
      const mesh = new THREE.Mesh(geo, roadMaterial);
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // 路底遮暗层：路面与地形之间无地板，翻越坡顶时防止透视到远处亮色地形
    {
      const shade = new THREE.Color('#161419');
      const geo = buildRibbon(this, s0, rows, sub, [-8.3, 8.3], () => shade, -0.55);
      group.add(new THREE.Mesh(geo, roadMaterial));
      onDispose.push(() => geo.dispose());
    }

    // 弯道轮廓标（高曲率段两侧，白色桩 + 主题色顶）
    {
      const items = [];
      for (let z = 0; z <= len; z += 8) {
        const s = s0 + z;
        if (Math.abs(this.path.curvature(s)) > 0.0016) {
          items.push({ s, off: -7.7 }, { s, off: 7.7 });
        }
      }
      if (items.length) {
        const geo = buildPosts(this, items, theme.accent);
        group.add(new THREE.Mesh(geo, roadMaterial));
        onDispose.push(() => geo.dispose());
      }
    }

    // 主题发光路缘（加色混合）：左右两条独立窄带
    if (theme.glowEdges) {
      const L = theme.glowEdges[0], R = theme.glowEdges[1];
      const geoL = buildRibbon(this, s0, rows, sub, [-7.55, -7.1], () => L, 0.07);
      const geoR = buildRibbon(this, s0, rows, sub, [7.1, 7.55], () => R, 0.07);
      group.add(new THREE.Mesh(geoL, glowMaterial));
      group.add(new THREE.Mesh(geoR, glowMaterial));
      onDispose.push(() => { geoL.dispose(); geoR.dispose(); });
    }

    // 霓虹拱门
    if (theme.lightGate && index % 4 === 2) {
      const gate = buildGate(this, s0 + 48, theme);
      group.add(gate.mesh);
      onDispose.push(() => gate.mesh.geometry.dispose());
    }

    this.group.add(group);
    this.chunks.set(index, chunk);
    for (const fn of this.listeners) fn(index, rng, s0, chunk);
  }
}

// ---------- 共享材质 ----------
const roadMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
const gateMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

// 沿道路带状网格：cols 为横向偏移；colorFn(band, row) 返回 band 颜色。
// 每条 band 使用独立顶点，保证相邻色带边界锐利（共享顶点会产生跨带颜色晕染）
function buildRibbon(path, s0, rows, sub, cols, colorFn, yOff) {
  const nRow = rows + 1, nCol = cols.length;
  const pos = [], col = [], idx = [];
  const fr = makeFrame();
  const c = new THREE.Color();
  for (let k = 0; k < nCol - 1; k++) {
    const base = pos.length / 3;
    for (let r = 0; r < nRow; r++) {
      const s = s0 + r * sub;
      path.frame(s, fr);
      c.copy(colorFn(k, r));
      for (const off of [cols[k], cols[k + 1]]) {
        pos.push(
          fr.pos.x + fr.right.x * off,
          fr.pos.y + fr.right.y * off + fr.up.y * yOff,
          fr.pos.z + fr.right.z * off
        );
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < nRow - 1; r++) {
      const a = base + r * 2, b = a + 1, d = a + 2, e = a + 3;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 轮廓标：白色桩身 + 主题色反光顶，合并为单个几何
function buildPosts(path, items, accentHex) {
  const pos = [], nor = [], col = [];
  const fr = makeFrame();
  const cBody = new THREE.Color('#cdd3de');
  const cCap = new THREE.Color(accentHex);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const push = (geo, m4, c) => {
    const nm = new THREE.Matrix3().getNormalMatrix(m4);
    const p = geo.attributes.position, nr = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4);
      pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
      nor.push(n.x, n.y, n.z);
      col.push(c.r, c.g, c.b);
    }
  };
  const body = new THREE.BoxGeometry(0.13, 0.85, 0.13).toNonIndexed();
  const cap = new THREE.BoxGeometry(0.17, 0.14, 0.17).toNonIndexed();
  for (const it of items) {
    path.frame(it.s, fr);
    const base = new THREE.Matrix4().makeBasis(fr.right, fr.up, fr.tan.clone().negate());
    const mB = base.clone().setPosition(
      fr.pos.x + fr.right.x * it.off,
      fr.pos.y + fr.up.y * 0.425,
      fr.pos.z + fr.right.z * it.off
    );
    const mC = base.clone().setPosition(
      fr.pos.x + fr.right.x * it.off,
      fr.pos.y + fr.up.y * 0.92,
      fr.pos.z + fr.right.z * it.off
    );
    push(body, mB, cBody);
    push(cap, mC, cCap);
  }
  body.dispose(); cap.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return g;
}

// 霓虹拱门：两柱一梁，加色发光
function buildGate(path, s, theme) {
  const fr = makeFrame();
  path.frame(s, fr);
  const w = 10.5, h = 7.2, t = 0.5;
  const geos = [];
  const mk = (bw, bh, bd, lx, ly) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(fr.right, fr.up, fr.tan.clone().negate()));
    const px = fr.pos.x + fr.right.x * lx, py = fr.pos.y + fr.up.y * ly, pz = fr.pos.z + fr.right.z * lx + fr.up.z * ly;
    g.translate(px, py, pz);
    geos.push(g);
  };
  mk(t, h, t, -w / 2, h / 2);
  mk(t, h, t, w / 2, h / 2);
  mk(w + t, t, t, 0, h);

  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idxArr = new Uint16Array(iCount);
  const cA = new THREE.Color(theme.lightGate[0]), cB = new THREE.Color(theme.lightGate[1]);
  let vo = 0, io = 0;
  geos.forEach((g, gi) => {
    const c = gi % 2 === 0 ? cA : cB;
    pos.set(g.attributes.position.array, vo * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
    }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idxArr[io + i] = ix[i] + vo;
    io += ix.length; vo += g.attributes.position.count;
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return { mesh: new THREE.Mesh(geo, gateMaterial) };
}
