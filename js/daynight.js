// 昼夜流转：在主题美术边界内缓慢往返（主题基调 ↔ 夜变体）
// 不做完整 24h 循环——保持每个主题的识别度，只让画面"活着"。
import * as THREE from 'three';

const lerp = (a, b, k) => a + (b - a) * k;

export class DayNightCycle {
  // env: { scene, sky, aurora?, ridges?, mist?, hemi, dirLight, renderer }
  constructor(env) {
    this.env = env;
    this.enabled = true;
    this.period = 460;      // 单程 ~3.8 分钟，全往返 ~7.7 分钟
    this.t = 0;
    this.k = 0;             // 0=主题基调, 1=夜变体（对 HUD/车灯暴露）
    this.theme = null;
    this._ca = new THREE.Color();
    this._cb = new THREE.Color();
    this._va = new THREE.Vector3();
    this._vb = new THREE.Vector3();
    this.dirDirection = new THREE.Vector3(0.45, 0.75, -0.4).normalize();
    this.weather = 0.5;
    this._ridgeBase = [];
    this._mistBase = null;
  }

  apply(theme) {
    this.theme = theme;
    this.t = 0;
    this.k = 0;
    if (!theme) return;
    // 基础态取自主题定义；主题未定义的可选项以当前 uniform 值兜底
    const u = this.env.sky.uniforms;
    const bs = { ...theme.sky };
    if (bs.sun == null) bs.sun = u.cSun.value.getHex();
    if (bs.sunGlowColor == null) bs.sunGlowColor = u.cSunGlow.value.getHex();
    if (bs.sunSize == null) bs.sunSize = u.sunSize.value;
    if (bs.sunGlow == null) bs.sunGlow = u.sunGlow.value;
    if (bs.stars == null) bs.stars = u.stars.value;

    const n = theme.night || {};
    this.base = {
      sky: bs,
      fog: { ...theme.fog },
      lights: theme.lights,
      exposure: theme.exposure,
    };
    this.night = {
      sky: { ...bs, ...(n.sky || {}) },
      fog: { ...this.base.fog, ...(n.fog || {}) },
      lights: n.lights || this.base.lights,
      exposure: n.exposure != null ? n.exposure : this.base.exposure,
      auroraBoost: n.auroraBoost || 1,
      ridgeTint: n.ridgeTint || null,
      ridgeMix: n.ridgeMix != null ? n.ridgeMix : 0.5,
      mist: n.mist || null,
    };
    // 远山/雾带基色缓存（供向夜色插值）
    this._ridgeBase = theme.ridges ? theme.ridges.map(r => new THREE.Color(r.color)) : [];
    this._mistBase = this.env.mist ? this.env.mist.bands[0].mesh.material.color.clone() : null;
    this.write(0);
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!v && this.theme) this.write(0);
    else if (v && this.theme) this.t = 0;
  }

  update(dt) {
    if (!this.theme) return;
    this.t += dt;
    // 天气波动：双正弦拍频，缓慢起伏 0..1（雾能见度 + 粒子密度联动）
    this.weather = 0.5 + 0.5 * Math.sin(this.t * 0.021 + 2.1) * Math.sin(this.t * 0.0127);
    if (!this.enabled) return;
    this.k = 0.5 - 0.5 * Math.cos((this.t / this.period) * Math.PI * 2);
    this.write(this.k);
  }

  write(k) {
    const { scene, sky, aurora, ridges, mist, hemi, dirLight, renderer } = this.env;
    const b = this.base, n = this.night, u = sky.uniforms;
    // 天穹
    u.cZenith.value.copy(this._lerpC(b.sky.zenith, n.sky.zenith, k));
    u.cHorizon.value.copy(this._lerpC(b.sky.horizon, n.sky.horizon, k));
    u.cGround.value.copy(this._lerpC(b.sky.ground, n.sky.ground, k));
    u.cSun.value.copy(this._lerpC(b.sky.sun, n.sky.sun, k));
    u.cSunGlow.value.copy(this._lerpC(b.sky.sunGlowColor, n.sky.sunGlowColor, k));
    u.sunSize.value = lerp(b.sky.sunSize, n.sky.sunSize, k);
    u.sunGlow.value = lerp(b.sky.sunGlow, n.sky.sunGlow, k);
    u.stars.value = lerp(b.sky.stars, n.sky.stars, k);
    // 雾（能见度随天气波动轻微起伏）
    const f = scene.fog;
    if (f) {
      f.color.copy(this._lerpC(b.fog.color, n.fog.color, k));
      f.near = lerp(b.fog.near, n.fog.near, k) * (1 - 0.12 * this.weather);
      f.far = lerp(b.fog.far, n.fog.far, k) * (1 - 0.18 * this.weather);
    }
    // 光照
    hemi.color.copy(this._lerpC(b.lights.hemi[0], n.lights.hemi[0], k));
    hemi.groundColor.copy(this._lerpC(b.lights.hemi[1], n.lights.hemi[1], k));
    hemi.intensity = lerp(b.lights.hemi[2], n.lights.hemi[2], k);
    dirLight.color.copy(this._lerpC(b.lights.dir[0], n.lights.dir[0], k));
    dirLight.intensity = lerp(b.lights.dir[1], n.lights.dir[1], k);
    // 只算方向；位置由 main 挂到玩家身上（阴影视锥跟随）
    this._va.set(...b.lights.dir[2]);
    this._vb.set(...n.lights.dir[2]);
    this.dirDirection.copy(this._va.lerp(this._vb, k)).normalize();
    // 曝光（OutputPass 每帧读取，直接生效）
    renderer.toneMappingExposure = lerp(b.exposure, n.exposure, k);
    // 极光夜间增强
    if (aurora) aurora.baseIntensity = 1 + (n.auroraBoost - 1) * k;
    // 远山入夜加深
    if (n.ridgeTint && ridges && this._ridgeBase.length) {
      this._cb.set(n.ridgeTint);
      for (let i = 0; i < ridges.layers.length; i++) {
        const ur = ridges.layers[i].material.uniforms.cRidge.value;
        if (this._ridgeBase[i]) ur.copy(this._ridgeBase[i]).lerp(this._cb, k * n.ridgeMix);
      }
    }
    // 贴地雾带染色（水墨暮色）
    if (n.mist && mist && this._mistBase) {
      this._cb.set(n.mist);
      for (const band of mist.bands) band.mesh.material.color.copy(this._mistBase).lerp(this._cb, k);
    }
  }

  _lerpC(aHex, bHex, k) {
    this._ca.set(aHex);
    this._cb.set(bHex);
    return this._ca.lerp(this._cb, k);
  }
}
