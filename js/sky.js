// 天空与远景：渐变天穹、太阳/星、极光带、水墨层叠远山、霓虹地平网格
import * as THREE from 'three';

const NOISE_GLSL = `
float vhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(vhash(i), vhash(i + vec2(1,0)), u.x),
             mix(vhash(i + vec2(0,1)), vhash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += vnoise(p) * a; p *= 2.03; a *= 0.5; }
  return v;
}
`;

// ---------- 天穹 ----------
export class SkyDome {
  constructor() {
    this.uniforms = {
      cZenith: { value: new THREE.Color('#3a5a9e') },
      cHorizon: { value: new THREE.Color('#ffc27a') },
      cGround: { value: new THREE.Color('#6b543a') },
      sunDir: { value: new THREE.Vector3(0.25, 0.18, -0.95).normalize() },
      cSun: { value: new THREE.Color('#fff3c8') },
      cSunGlow: { value: new THREE.Color('#ffd9a0') },
      sunSize: { value: 0.035 },
      sunGlow: { value: 0.6 },
      stripedSun: { value: 0 },
      stars: { value: 0 },
      time: { value: 0 },
      starTwinkle: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 cZenith, cHorizon, cGround, cSun, cSunGlow, sunDir;
        uniform float sunSize, sunGlow, stripedSun, stars, time;
        ${NOISE_GLSL}
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col;
          if(h >= 0.0){
            col = mix(cHorizon, cZenith, pow(min(h * 1.35, 1.0), 0.62));
          } else {
            col = mix(cHorizon, cGround, min(-h * 3.2, 1.0));
          }
          // 太阳
          float sd = dot(d, normalize(sunDir));
          float disc = smoothstep(1.0 - sunSize - 0.006, 1.0 - sunSize, sd);
          if(stripedSun > 0.5){
            // 合成波条纹太阳
            float bands = step(0.35, fract((d.y) * 90.0 - time * 0.25));
            float fadeBands = smoothstep(0.16, 0.02, abs(d.y - sunDir.y) - 0.02);
            disc *= mix(1.0, bands, fadeBands);
          }
          col = mix(col, cSun, disc);
          col += cSunGlow * pow(max(sd, 0.0), 60.0 * max(sunGlow, 0.15)) * 0.45 * sunGlow;
          col += cSunGlow * pow(max(sd, 0.0), 6.0) * 0.07 * sunGlow;
          // 星空
          if(stars > 0.01 && h > 0.02){
            vec2 sp = d.xz / (h + 0.35) * 60.0;
            float sn = vhash(floor(sp));
            float star = step(0.992, sn) * (0.55 + 0.45 * sin(time * (2.0 + sn * 4.0) + sn * 40.0));
            star *= smoothstep(0.02, 0.25, h);
            col += vec3(0.9, 0.95, 1.0) * star * stars;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 32, 18), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
  }

  update(dt, camPos) {
    this.uniforms.time.value += dt;
    this.mesh.position.copy(camPos);
  }

  apply(theme) {
    const u = this.uniforms;
    u.cZenith.value.set(theme.sky.zenith);
    u.cHorizon.value.set(theme.sky.horizon);
    u.cGround.value.set(theme.sky.ground);
    u.sunDir.value.set(theme.sky.sunDir[0], theme.sky.sunDir[1], theme.sky.sunDir[2]).normalize();
    u.cSun.value.set(theme.sky.sun);
    u.cSunGlow.value.set(theme.sky.sunGlowColor || '#ffffff');
    u.sunSize.value = theme.sky.sunSize;
    u.sunGlow.value = theme.sky.sunGlow;
    u.stripedSun.value = theme.sky.stripedSun ? 1 : 0;
    u.stars.value = theme.sky.stars || 0;
  }
}

// ---------- 极光带（雪原主题） ----------
export class Aurora {
  constructor() {
    this.uniforms = {
      time: { value: 0 },
      intensity: { value: 1 },
      cA: { value: new THREE.Color('#4dffa6') },
      cB: { value: new THREE.Color('#7ae0ff') },
      cC: { value: new THREE.Color('#b07aff') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time, intensity;
        uniform vec3 cA, cB, cC;
        ${NOISE_GLSL}
        void main(){
          float x = vUv.x * 10.0;
          float wave = sin(x * 0.9 + time * 0.5) * 0.5 + sin(x * 0.33 - time * 0.23) * 0.5;
          float y = vUv.y;
          // 帘状起伏：底部边缘随波浪
          float base = 0.12 + wave * 0.06;
          float body = smoothstep(base, base + 0.06, y) * smoothstep(1.0, 0.45, y);
          float rays = 0.6 + 0.4 * sin(x * 2.6 + time * 0.8 + sin(x * 0.7 - time * 0.31) * 2.0);
          float n = fbm(vec2(x * 0.8, y * 2.2 - time * 0.12));
          float a = body * rays * (0.35 + 0.65 * n) * intensity;
          vec3 col = mix(cA, cB, smoothstep(0.15, 0.7, y));
          col = mix(col, cC, smoothstep(0.65, 1.0, y + n * 0.2));
          gl_FragColor = vec4(col, a * 0.55);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 620, 1, 1), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -90;
    this.surge = 0; // 事件：极光爆发
  }

  update(dt, camPos, camHeading) {
    this.uniforms.time.value += dt;
    this.surge = Math.max(0, this.surge - dt / 8);
    this.uniforms.intensity.value = (this.baseIntensity || 1) + this.surge * 2.2;
    // 固定悬于行进方向左前上方，随相机平移（不随转动，简单稳定）
    this.mesh.position.set(camPos.x - 250, 480, camPos.z - 1250);
  }

  apply(theme) {
    this.mesh.visible = !!theme.aurora;
    if (theme.aurora) {
      this.uniforms.cA.value.set(theme.aurora[0]);
      this.uniforms.cB.value.set(theme.aurora[1]);
      this.uniforms.cC.value.set(theme.aurora[2]);
    }
  }
}

// ---------- 层叠远山（水墨/黄昏剪影，视差） ----------
export class BackdropRidges {
  constructor() {
    this.layers = [];
    for (let i = 0; i < 3; i++) {
      const uniforms = {
        time: { value: 0 },
        cRidge: { value: new THREE.Color('#8f887a') },
        cMist: { value: new THREE.Color('#f3efe6') },
        seed: { value: i * 17.3 },
        height: { value: 0.42 + i * 0.14 },
        freq: { value: 1.6 + i * 0.9 },
        mistAmt: { value: 0.5 },
        camX: { value: 0 },
        camS: { value: 0 },
        parallax: { value: 0.9 - i * 0.28 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 cRidge, cMist;
          uniform float time, seed, height, freq, mistAmt, camX, camS, parallax;
          ${NOISE_GLSL}
          void main(){
            float x = vUv.x * 6.0 + camX * 0.0011 * parallax + seed;
            float zf = camS * 0.00045 * parallax;
            float ridge = height * (0.55 + 0.45 * fbm(vec2(x * freq + zf, seed)));
            ridge += 0.10 * fbm(vec2(x * freq * 3.1, seed + 4.0));
            float m = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, vUv.y);
            // 山脚雾化：底部渐隐入天光，避免层叠成硬色带
            float mist = smoothstep(0.0, 0.3 + 0.25 * mistAmt, vUv.y);
            float a = m * mix(1.0, mist, mistAmt);
            // 水墨纸纹
            float grain = vnoise(vUv * vec2(320.0, 90.0)) * 0.06;
            vec3 col = mix(cMist, cRidge, 0.85 + grain);
            gl_FragColor = vec4(col, a);
          }
        `,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5200, 760, 1, 1), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -80 + i;
      this.layers.push(mesh);
    }
  }

  update(dt, camPos, playerS) {
    for (let i = 0; i < this.layers.length; i++) {
      const m = this.layers[i];
      m.material.uniforms.time.value += dt;
      m.material.uniforms.camX.value = camPos.x;
      m.material.uniforms.camS.value = playerS;
      // 越远的层越贴近正前方
      m.position.set(camPos.x * (0.96 - i * 0.12), 120 + i * 40, camPos.z - (1500 + i * 350));
    }
  }

  apply(theme) {
    const L = theme.ridges;
    this.layers.forEach((m, i) => {
      m.visible = !!L;
      if (L && L[i]) {
        m.material.uniforms.cRidge.value.set(L[i].color);
        m.material.uniforms.height.value = L[i].height;
        m.material.uniforms.freq.value = L[i].freq;
        m.material.uniforms.mistAmt.value = L[i].mist;
        m.material.uniforms.cMist.value.set(theme.ridgeMist);
      }
    });
  }
}

// ---------- 贴地雾带（水墨氤氲） ----------
export class MistBands {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const tex = MistBands.tex || (MistBands.tex = makeMistTexture());
    this.bands = [];
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: 0.28, depthWrite: false,
        color: '#d9d3c1', fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 26), mat);
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.bands.push({
        mesh,
        sOff: 60 + i * 55,
        latOff: (i % 2 ? 1 : -1) * (14 + i * 9),
        h: 2.2 + i * 2.4,
        phase: i * 1.7,
        speed: 0.16 + i * 0.05,
      });
    }
    this.t = 0;
    this._fr = null;
    scene.add(this.group);
  }

  update(dt, road, playerS, camPos) {
    if (!this.group.visible) return;
    this.t += dt;
    const fr = this._fr || (this._fr = road.makeFrame());
    for (const b of this.bands) {
      const s = playerS + b.sOff;
      road.frame(s, fr);
      const off = b.latOff + Math.sin(this.t * b.speed + b.phase) * 10;
      b.mesh.position.set(
        fr.pos.x + fr.right.x * off,
        fr.pos.y + b.h,
        fr.pos.z + fr.right.z * off
      );
      // 绕 Y 轴朝向相机
      b.mesh.rotation.y = Math.atan2(camPos.x - b.mesh.position.x, camPos.z - b.mesh.position.z);
      b.mesh.material.opacity = 0.2 + 0.12 * Math.sin(this.t * 0.3 + b.phase);
    }
  }

  setVisible(v) { this.group.visible = !!v; }
}

function makeMistTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  // 横向丝带状：纵向边缘渐隐
  const vert = g.createLinearGradient(0, 0, 0, 64);
  vert.addColorStop(0, 'rgba(0,0,0,1)');
  vert.addColorStop(0.3, 'rgba(0,0,0,0)');
  vert.addColorStop(0.7, 'rgba(0,0,0,0)');
  vert.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillRect(0, 0, 256, 64);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = vert;
  g.fillRect(0, 0, 256, 64);
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- 霓虹地平网格（赛博主题） ----------
export class HorizonGrid {
  constructor() {
    this.uniforms = {
      time: { value: 0 },
      cLine: { value: new THREE.Color('#ff2d95') },
      camZ: { value: 0 },
      opacity: { value: 0.16 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vW;
        uniform float time, camZ, opacity;
        uniform vec3 cLine;
        void main(){
          vec2 p = vec2(vW.x, vW.z) * 0.05;
          vec2 gv = abs(fract(p) - 0.5);
          float line = smoothstep(0.48, 0.5, max(gv.x, gv.y));
          float dist = length(vW.xz - vec2(0.0, camZ));
          float fade = smoothstep(1400.0, 300.0, dist) * smoothstep(60.0, 200.0, dist);
          float pulse = 0.75 + 0.25 * sin(time * 1.4 + p.y * 0.4);
          gl_FragColor = vec4(cLine, line * fade * opacity * pulse);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -70;
  }

  update(dt, camPos) {
    this.uniforms.time.value += dt;
    this.uniforms.camZ.value = camPos.z;
    this.mesh.position.set(camPos.x, -34, camPos.z);
  }

  apply(theme) {
    this.mesh.visible = !!theme.grid;
    if (theme.grid) {
      this.uniforms.cLine.value.set(theme.grid);
    }
  }
}
