// 入口：渲染器、游戏状态机（菜单/驾驶/暂停/拍照/分享）、主循环
import * as THREE from 'three';
import { CONFIG, IS_MOBILE } from './config.js';
import { mulberry32 } from './rng.js';
import { RoadSystem } from './road.js';
import { TerrainSystem } from './terrain.js';
import { PlayerCar, NpcManager } from './car.js';
import { ChaseCamera } from './camera.js';
import { InputSystem } from './input.js';
import { Gameplay } from './gameplay.js';
import { EventManager } from './events.js';
import { SkyDome, Aurora, BackdropRidges, HorizonGrid, MistBands } from './sky.js';
import { ParticleSystem, SpeedLines } from './particles.js';
import { THEMES, THEME_ORDER, applyThemeEnv } from './themes.js';
import { ZoneSystem } from './zones.js';
import { AudioSystem } from './audio.js';
import { PostFX } from './postfx.js';
import { DayNightCycle } from './daynight.js';
import { CARS, loadSelectedCar, saveSelectedCar, careerBestScore, recordCareerBest, isCarUnlocked } from './garage.js';
import { TimeAttack } from './timeattack.js';
import { Milestones } from './milestones.js';
import { Settings } from './settings.js';
import { addRun, getRuns } from './runs.js';
import { dailyInfo, saveDailyResult, updateRecords, getRecords } from './daily.js';
import { buildShareCard, shareText, shareCard, preloadImage, downloadCanvas } from './share.js';
import { t, getLang, setLang, applyStatic, nameOf, descOf, fmtRunDate } from './i18n.js';

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);

class UI {
  constructor() {
    this.el = {
      loading: $('loading'), menu: $('menu'), hud: $('hud'), pause: $('pause'),
      photoBar: $('photoBar'), shareModal: $('shareModal'), settings: $('settings'),
      flash: $('flash'), letterbox: document.querySelectorAll('.letterbox'),
      spd: $('spd'), dist: $('dist'), score: $('score'),
      nitroFill: $('nitroFill'), comboBox: $('comboBox'), comboVal: $('comboVal'),
      multBox: $('multBox'), timeBox: $('timeBox'),
      themeTag: $('themeTag'), modeTag: $('modeTag'),
      popup: $('popup'), evToast: $('evToast'),
      dailyDate: $('dailyDate'), dailyBest: $('dailyBest'),
      recList: $('recList'),
      shareImg: $('shareImg'), shareHint: $('shareHint'),
    };
    this._toastTimer = null;
    this._popupTimer = null;
  }
  show(name) {
    for (const k of ['loading', 'menu', 'hud', 'pause', 'photoBar', 'shareModal', 'settings']) {
      this.el[k] && this.el[k].classList.toggle('visible', k === name);
    }
    // 触屏按钮仅驾驶态显示，避免遮挡菜单/暂停/战报等面板
    const touch = document.getElementById('touch');
    if (touch) touch.classList.toggle('visible', name === 'hud');
  }
  hideAll() { this.show(null); }
  letterbox(on) {
    this.el.letterbox.forEach(b => b.classList.toggle('visible', on));
  }
  setHUD(kmh, distKm, score, nitro, combo) {
    this.el.spd.textContent = Math.round(kmh);
    this.el.dist.textContent = distKm.toFixed(1);
    this.el.score.textContent = Math.floor(score).toLocaleString('en-US');
    this.el.nitroFill.style.width = nitro.toFixed(0) + '%';
    this.el.nitroFill.classList.toggle('full', nitro >= 99);
    const cb = this.el.comboBox;
    if (combo >= 2) {
      cb.classList.add('visible');
      this.el.comboVal.textContent = '×' + combo;
    } else cb.classList.remove('visible');
  }
  nearMiss(pts, combo, oncoming) {
    const p = this.el.popup;
    p.textContent = t(oncoming ? 'nearMissOncoming' : 'nearMiss', { pts }) + (combo > 1 ? `  ×${combo}` : '');
    p.style.fontSize = Math.min(30 + combo * 1.5, 46) + 'px';
    p.classList.remove('show');
    void p.offsetWidth;
    p.classList.add('show');
    this.flashFx('#ffffff');
  }
  bump() {
    this.flashFx('#ff3b30');
    this.el.popup.textContent = t('crash');
    this.el.popup.classList.remove('show');
    void this.el.popup.offsetWidth;
    this.el.popup.classList.add('show');
  }
  collect() { /* 声音足够，视觉用 3D 粒子 */ }
  setMult(m) {
    const el = this.el.multBox;
    if (!el) return;
    if (m > 1) {
      el.textContent = '×' + (m % 1 ? m.toFixed(1) : m);
      el.classList.add('visible');
      el.classList.toggle('hot', m >= 2);
    } else {
      el.classList.remove('visible');
    }
  }
  setTime(sec) {
    const el = this.el.timeBox;
    if (!el) return;
    if (sec == null) { el.classList.remove('visible', 'critical'); return; }
    el.textContent = `⏱ ${sec}s`;
    el.classList.add('visible');
    el.classList.toggle('critical', sec <= 10);
  }
  flashFx(color) {
    const f = this.el.flash;
    f.style.background = color;
    f.classList.remove('active');
    void f.offsetWidth;
    f.classList.add('active');
  }
  toast(msg) {
    const t = this.el.evToast;
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('visible'), 2600);
  }
  setMuted(m) {
    for (const id of ['btnMute', 'btnMuteHud']) {
      const b = $(id);
      if (b) b.classList.toggle('muted', m);
    }
  }
  refreshMenu(daily, records) {
    this.el.dailyDate.textContent = daily.label;
    this.el.dailyBest.textContent = daily.best
      ? t('dailyBest', { score: daily.best.score.toLocaleString('en-US'), km: daily.best.distKm || 0 })
      : t('dailyEmpty');
    const rows = THEME_ORDER.map(k => {
      const th = THEMES[k];
      const r = records[k];
      return `<div class="rec-row"><span>${nameOf(th)}</span><span>${r ? t('bestRow', { score: r.bestScore.toLocaleString('en-US'), km: (r.bestDist / 1000).toFixed(1) }) : '—'}</span></div>`;
    }).join('');
    this.el.recList.innerHTML = rows;
  }
  setAch(n, total) {
    const el = document.getElementById('achSummary');
    if (el) el.textContent = t('achSummary', { n, total });
  }
  renderHistory(runs) {
    const list = document.getElementById('histList');
    const summary = document.getElementById('histSummary');
    if (summary) {
      summary.textContent = runs.length
        ? t('historySum', { n: runs.length, score: runs[0].score.toLocaleString('en-US') })
        : t('historyEmpty');
    }
    if (!list) return;
    // 新记录存 key（themeKey/carKey/t 时间戳），旧记录是渲染好的字符串，查不到 key 时原样回退显示
    const modeKey = { daily: 'modeDaily', time: 'modeTime', free: 'modeFree' };
    list.innerHTML = runs.map(r => {
      const th = r.themeKey && THEMES[r.themeKey];
      const car = r.carKey && CARS.find(c => c.key === r.carKey);
      const left = [
        r.t ? fmtRunDate(r.t) : (r.date || ''),
        th ? nameOf(th) : (r.theme || ''),
        car ? nameOf(car) : (r.car || ''),
        modeKey[r.mode] ? t(modeKey[r.mode]) : (r.mode || ''),
      ].filter(Boolean).join(' · ');
      return `<div class="rec-row"><span>${left}</span><span>${t('historyRow', { score: r.score.toLocaleString('en-US'), km: r.distKm })}</span></div>`;
    }).join('') || '<div class="rec-row"><span>—</span><span>—</span></div>';
  }
  syncSettings(d) {    const vol = document.getElementById('setVolume');
    const cam = document.getElementById('setCam');
    const dn = document.getElementById('setDayNight');
    if (vol) vol.value = Math.round(d.volume * 100);
    if (cam) cam.value = Math.round(d.camDist * 100);
    if (dn) {
      dn.textContent = t(d.dayNight ? 'on' : 'off');
      dn.classList.toggle('on', d.dayNight);
    }
    document.querySelectorAll('#setQuality button').forEach(b =>
      b.classList.toggle('on', b.dataset.q === d.quality));
    document.querySelectorAll('#setLangSeg button').forEach(b =>
      b.classList.toggle('on', b.dataset.lang === getLang()));
  }
  setTags(theme, mode) {
    this.el.themeTag.textContent = nameOf(theme);
    this.el.modeTag.textContent = mode;
  }
}

// 车库面板渲染辅助：刷新菜单后由 Game.renderGarage() 调用
function renderGarageUI(g) {
  const car = g.cars[g.garageIdx];
  const $id = (k) => document.getElementById(k);
  const name = $id('carName'), en = $id('carEn'), desc = $id('carDesc');
  if (!name) return;
  const unlocked = isCarUnlocked(car);
  name.textContent = nameOf(car);
  en.textContent = car.en;
  desc.textContent = descOf(car);
  $id('carBars').innerHTML = Object.entries(car.bars).map(([k, v]) =>
    `<div class="bar-row"><span>${t('bar.' + k)}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`).join('');
  const lock = $id('carLock');
  lock.textContent = unlocked ? '' : t('carLock', { score: car.unlockAt.toLocaleString('en-US') });
  $id('carPager').textContent = t('carPager', { i: g.garageIdx + 1, n: g.cars.length, best: careerBestScore().toLocaleString('en-US') });
  const sel = $id('carSelect');
  const selected = g.selectedCar.key === car.key;
  sel.textContent = selected ? t('carSelected') : (unlocked ? t('carSelect') : t('carLocked'));
  sel.disabled = selected || !unlocked;
  sel.classList.toggle('primary', !selected && unlocked);
}

// ---------------- 拾取特效 ----------------
class PickupFx {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < 10; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: PickupFx.tex || (PickupFx.tex = makeGlow()),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      spr.visible = false;
      scene.add(spr);
      this.pool.push({ spr, life: 0 });
    }
  }
  burst(pos, color) {
    const item = this.pool.find(p => p.life <= 0);
    if (!item) return;
    item.life = 0.45;
    item.spr.visible = true;
    item.spr.position.copy(pos);
    item.spr.material.color.set(color);
    item.spr.scale.setScalar(1);
  }
  update(dt) {
    for (const p of this.pool) {
      if (p.life > 0) {
        p.life -= dt;
        const t = Math.max(p.life, 0) / 0.45;
        p.spr.scale.setScalar(1 + (1 - t) * 4);
        p.spr.material.opacity = t;
        p.spr.position.y += dt * 2;
        if (p.life <= 0) p.spr.visible = false;
      }
    }
  }
}
function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------- 游戏 ----------------
class Game {
  constructor() {
    this.state = 'boot';
    this.mode = 'free';
    this.themeKey = 'sunset';
    this.ui = new UI();
    this.input = new InputSystem();
    this.audio = new AudioSystem();
    try { this.selectedTheme = localStorage.getItem('er_theme') || 'sunset'; } catch (e) { this.selectedTheme = 'sunset'; }
    if (!THEMES[this.selectedTheme]) this.selectedTheme = 'sunset';
    this.cars = CARS;
    this.selectedCar = loadSelectedCar();
    this.garageIdx = Math.max(0, this.cars.findIndex(c => c.key === this.selectedCar.key));
    this.time = 0;
    this.timeScale = 1;
    this.last = performance.now();
    this.hudT = 0;
    this.runTime = 0;
    this.milestones = new Milestones();

    // 渲染器
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.6 : 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera3d = new THREE.PerspectiveCamera(CONFIG.camera.fovBase, innerWidth / innerHeight, 0.3, 6000);
    this.chase = new ChaseCamera(this.camera3d);

    // 后期处理（桌面默认开启泛光，移动端直通渲染）
    this.postfx = new PostFX(this.renderer);
    this.postfx.setEnabled(!IS_MOBILE, this.scene, this.camera3d);

    // 灯光
    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 0.8);
    this.dirLight = new THREE.DirectionalLight('#ffffff', 1);
    this.scene.add(this.hemi, this.dirLight);
    // 桌面端阴影：紧随玩家的窄视锥，成本可控
    if (!IS_MOBILE) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(1024, 1024);
      const sc = this.dirLight.shadow.camera;
      sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 340;
      this.dirLight.shadow.bias = -0.0015;
      this.scene.add(this.dirLight.target);
    }

    // 环境（跨世界复用）
    this.sky = new SkyDome();
    this.aurora = new Aurora();
    this.ridges = new BackdropRidges();
    this.grid = new HorizonGrid();
    this.mist = new MistBands(this.scene);
    this.scene.add(this.sky.mesh, this.aurora.mesh, this.ridges.layers[0], this.ridges.layers[1], this.ridges.layers[2], this.grid.mesh);
    this.particles = new ParticleSystem(this.scene);
    this.speedLines = new SpeedLines(this.scene);

    // 昼夜流转
    this.dayNight = new DayNightCycle({
      scene: this.scene, sky: this.sky, aurora: this.aurora, ridges: this.ridges,
      mist: this.mist, hemi: this.hemi, dirLight: this.dirLight, renderer: this.renderer,
    });

    // 设置（在首次构建世界前创建，画质/视距即时生效）
    this.settings = new Settings();

    // 世界句柄
    this.road = null; this.terrain = null; this.player = null;
    this.npc = null; this.gameplay = null; this.events = null; this.zones = null;
    this.timeAttack = null;
    this.fx = new PickupFx(this.scene);

    this.bindUI();
    this.bindInput();
    this.ui.setMuted(this.audio.muted);
    this.settings.apply(this);
    // 启动即应用当前语言的静态文案（与 head 内联脚本配合，加载页之前已就位）
    applyStatic();
    this.localizeThemeCards();
    this.syncLangBtn();
    this.ui.syncSettings(this.settings.data);

    // 菜单背景世界
    this.buildWorld(this.selectedTheme, (Date.now() & 0xffffffff) >>> 0, { silent: true });
    this.state = 'menu';
    this.ui.show('menu');
    this.ui.refreshMenu(dailyInfo(), getRecords());
    this.ui.setAch(this.milestones.unlockedCount, this.milestones.total);
    this.ui.renderHistory(getRuns());
    this.renderGarage();
    this.ui.show('menu');

    window.addEventListener('resize', () => this.onResize());
    // 切出标签页自动暂停，避免回来时状态跳变
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'run') this.pauseGame();
    });
    requestAnimationFrame((t) => this.tick(t));
  }

  // ---------- 主题 accent → UI ----------
  applyAccent(themeKey) {
    const t = THEMES[themeKey];
    if (!t) return;
    document.documentElement.style.setProperty('--accent', t.accent);
    document.body.classList.toggle('theme-ink', themeKey === 'ink');
  }

  renderGarage() {
    renderGarageUI(this);
  }

  // ---------- 语言切换 ----------
  switchLang(lang) {
    if (lang === getLang()) return;
    setLang(lang); // 写偏好 + html[lang]/title + 静态 data-i18n 文案
    this.localizeThemeCards();
    this.syncLangBtn();
    // 重渲染所有动态文案面板
    this.ui.refreshMenu(dailyInfo(), getRecords());
    this.ui.setAch(this.milestones.unlockedCount, this.milestones.total);
    this.ui.renderHistory(getRuns());
    this.renderGarage();
    this.ui.syncSettings(this.settings.data);
    // 驾驶/暂停中顺带刷新 HUD 标签；战报卡片是渲染好的位图，保持生成时语言即可
    if (this.state === 'run' || this.state === 'pause' || this.state === 'photo') {
      this.ui.setTags(this.theme, t(this.mode === 'daily' ? 'modeDaily' : this.mode === 'time' ? 'modeTime' : 'modeFree'));
    }
  }

  // 主题卡中文名来自 THEMES 数据（避免词典与数据文件重复维护）
  localizeThemeCards() {
    document.querySelectorAll('.theme-card').forEach(card => {
      const th = THEMES[card.dataset.theme];
      const nameEl = card.querySelector('.tc-name');
      if (th && nameEl) nameEl.textContent = nameOf(th);
    });
  }

  // 快捷按钮显示目标语言名：中文界面显示 EN，英文界面显示 中
  syncLangBtn() {
    const b = $('btnLang');
    if (b) b.textContent = getLang() === 'zh' ? 'EN' : '中';
  }

  // ---------- 世界构建 ----------
  buildWorld(themeKey, seed, opts = {}) {
    this.disposeWorld();
    this.themeKey = themeKey;
    const theme = THEMES[themeKey];
    this.theme = theme;
    this.applyAccent(themeKey);
    const ctx = { scene: this.scene, theme, seed, silent: !!opts.silent, car: this.selectedCar };
    // 音效钩子：险过/拾取/碰撞/氮气（静默菜单世界不发声）
    if (!opts.silent) {
      ctx.onNearMissFx = (oncoming) => this.audio.whoosh(oncoming ? 1.3 : 1);
      ctx.onCollectFx = (combo) => this.audio.blip(combo);
      ctx.onBumpFx = () => this.audio.thud();
      ctx.onNitroFx = () => this.audio.nitroFx();
    }
    applyThemeEnv(this.scene, theme);
    this.renderer.toneMappingExposure = theme.exposure;
    this.postfx.applyTheme(theme);
    this.dayNight.apply(theme);
    this.hemi.color.set(theme.lights.hemi[0]);
    this.hemi.groundColor.set(theme.lights.hemi[1]);
    this.hemi.intensity = theme.lights.hemi[2];
    this.dirLight.color.set(theme.lights.dir[0]);
    this.dirLight.intensity = theme.lights.dir[1];
    this.dirLight.position.set(...theme.lights.dir[2]);
    this.sky.apply(theme);
    this.aurora.apply(theme);
    this.ridges.apply(theme);
    this.grid.apply(theme);
    this.mist.setVisible(!!theme.mist);
    this.particles.setMode(theme.particles);

    this.zones = new ZoneSystem(themeKey, seed);
    ctx.zones = this.zones;
    this.road = new RoadSystem(ctx);
    this.road.prof.chunkAhead = this.settings.preset().chunkAhead;
    ctx.road = this.road;
    this.terrain = new TerrainSystem(ctx);
    ctx.terrain = this.terrain;
    this.terrain.windmills.addToScene(this.scene);
    this.player = new PlayerCar(ctx);
    this.player.targetSpeed = CONFIG.vDefault;
    this.chase.terrain = this.terrain;
    this.npc = new NpcManager(ctx, mulberry32(seed ^ 0xABCD));
    this.npc.reset(0);
    this.gameplay = new Gameplay(ctx, this.ui, mulberry32(seed ^ 0x1234));
    this.events = new EventManager({
      scene: this.scene, road: this.road, theme, aurora: this.aurora,
      terrain: this.terrain, toast: opts.silent ? null : (m) => this.ui.toast(m),
    }, mulberry32(seed ^ 0x9876));

    this.road.onChunkBuilt((index, rng, s0, chunk) => {
      this.terrain.buildChunk(index, rng, s0, chunk);
      this.gameplay.onChunkBuilt(index, rng, s0);
    });
    this.road.update(0);
    this.player.syncMesh();
    this.updateSun();
    this.runSeed = seed;
  }

  disposeWorld() {
    const s = this.scene;
    if (this.timeAttack) { this.timeAttack.dispose(); this.timeAttack = null; }
    if (this.road) { this.road.disposeAll(); s.remove(this.road.group); this.road = null; }
    if (this.terrain) { this.terrain.windmills.reset(); s.remove(this.terrain.windmills.mesh); this.terrain = null; }
    if (this.player) { s.remove(this.player.mesh); if (this.player.dust && this.player.dust.group) s.remove(this.player.dust.group); this.player = null; }
    if (this.npc) { for (const c of this.npc.cars) s.remove(c.mesh); this.npc = null; }
    if (this.gameplay) { s.remove(this.gameplay.inst); this.gameplay.inst.geometry.dispose(); this.gameplay.inst.material.dispose(); this.gameplay = null; }
    if (this.events) { this.events.reset(); this.events = null; }
    this.zones = null;
    this.chase.terrain = null;
    this.speedLines.reset();
  }

  // ---------- 流程 ----------
  startRun({ mode, themeKey }) {
    this.audio.unlock(); // 开始按钮的手势是最佳解锁时机
    this.mode = mode;
    let seed;
    if (mode === 'daily') {
      const d = dailyInfo();
      seed = d.seed;
      themeKey = d.themeKey;
      this.dailyKey = d.key;
    } else {
      seed = (Math.random() * 0xffffffff) >>> 0;
    }
    this.buildWorld(themeKey, seed);
    this.player.reset(10);
    this.npc.reset(10);
    this.gameplay.reset(this.player.s);
    this.events.reset();
    this.topSpeed = 0;
    // 计时赛
    if (this.timeAttack) { this.timeAttack.dispose(); this.timeAttack = null; }
    if (mode === 'time') {
      this.timeAttack = new TimeAttack({ scene: this.scene, road: this.road, theme: this.theme });
      this.timeAttack.onGain = (gain) => {
        this.ui.toast(t('gateGain', { s: gain }));
        this.audio.blip(4);
        this.ui.flashFx('#ffffff');
      };
      this.timeAttack.reset(this.player.s);
    }
    this.state = 'run';
    this.runTime = 0;
    this.milestones.beginRun();
    this.ui.hideAll();
    this.ui.show('hud');
    this.ui.setTags(this.theme, t(mode === 'daily' ? 'modeDaily' : mode === 'time' ? 'modeTime' : 'modeFree'));
    this.ui.setTime(mode === 'time' ? this.timeAttack.timeLeft : null);
    this.audio.setAmbient(this.theme);
    // 解锁失败兜底：告知玩家点按屏幕即可开启声音
    const st = this.audio.ctxA && this.audio.ctxA.state;
    if (st && st !== 'running') this.ui.toast(t('soundLocked'));
  }

  goMenu() {
    this.state = 'menu';
    this.chase.exitPhoto();
    this.ui.letterbox(false);
    this.buildWorld(this.selectedTheme, (Date.now() & 0xffffffff) >>> 0, { silent: true });
    this.ui.refreshMenu(dailyInfo(), getRecords());
    this.ui.setAch(this.milestones.unlockedCount, this.milestones.total);
    this.ui.renderHistory(getRuns());
    const hl = $('histList'); if (hl) hl.style.display = 'none';
    this.renderGarage();
    this.ui.show('menu');
  }

  pauseGame() {
    if (this.state !== 'run') return;
    this.state = 'pause';
    this.ui.show('pause');
  }
  resumeGame() {
    if (this.state !== 'pause') return;
    this.state = 'run';
    this.ui.show('hud');
  }

  // ---------- 设置面板 ----------
  openSettings(from) {
    this._settingsFrom = from; // 'menu' | 'pause'
    this.ui.show('settings');
    this.ui.syncSettings(this.settings.data);
    // iPhone 物理静音拨片会整体静掉 WebAudio，代码无法绕过，只能提示
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
    const note = $('audioNote');
    if (note) note.style.display = isIOS ? 'block' : 'none';
  }
  closeSettings() {
    this.settings.apply(this);
    this.ui.show(this._settingsFrom === 'pause' ? 'pause' : 'menu');
  }

  enterPhoto() {
    if (this.state !== 'run') return;
    this.state = 'photo';
    this.chase.enterPhoto();
    this.ui.hideAll();
    this.ui.show('photoBar');
    this.ui.letterbox(true);
  }
  exitPhoto() {
    if (this.state !== 'photo') return;
    this.state = 'run';
    this.chase.exitPhoto();
    this.ui.letterbox(false);
    this.ui.show('hud');
  }

  renderFrame(dt = 0) {
    if (this.postfx.enabled) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera3d);
  }

  // 平行光跟随玩家（方向来自昼夜系统）
  updateSun() {
    const dir = this.dayNight.dirDirection;
    if (this.player) {
      const p = this.player.mesh.position;
      this.dirLight.target.position.copy(p);
      this.dirLight.position.copy(p).addScaledVector(dir, 170);
    } else {
      this.dirLight.position.copy(dir).multiplyScalar(170);
    }
  }

  captureStill() {
    this.renderFrame();
    return this.renderer.domElement.toDataURL('image/png');
  }

  async endRun() {
    if (this.state !== 'pause' && this.state !== 'run') return;
    const shot = this.captureStill();
    const theme = this.theme;
    const g = this.gameplay;
    const stats = {
      score: g.total || 0,
      distKm: +(this.player.s / 1000).toFixed(1),
      topKmh: Math.round(this.topSpeed * 3.6),
      nearMisses: g.nearMisses,
      maxCombo: g.maxCombo,
      collects: g.collects,
    };
    const modeLabel = t(this.mode === 'daily' ? 'modeDaily' : this.mode === 'time' ? 'modeTime' : 'modeFree')
      + ' · ' + (this.selectedCar ? nameOf(this.selectedCar) : '');
    const now = Date.now();
    const dateLabel = fmtRunDate(now);
    const record = updateRecords(theme.key, { dist: this.player.s, topSpeed: this.topSpeed, maxCombo: g.maxCombo, score: stats.score });
    recordCareerBest(stats.score);
    // 存 key 而非渲染好的名称，历史列表按当前语言现渲染
    addRun({ t: now, themeKey: theme.key, carKey: this.selectedCar ? this.selectedCar.key : '', mode: this.mode, score: stats.score, distKm: stats.distKm, topKmh: stats.topKmh, maxCombo: g.maxCombo });
    if (this.mode === 'daily') saveDailyResult(this.dailyKey, stats);
    const img = await preloadImage(shot);
    const card = buildShareCard({
      screenshot: img, themeName: nameOf(theme),
      dateLabel, modeLabel, stats, accent: theme.accent, bgColors: theme.shareBg,
    });
    this.shareTextStr = shareText({ themeName: nameOf(theme), dateLabel, modeLabel, stats });
    this.shareCanvas = card;
    $('shareImg').src = card.toDataURL('image/png');
    this.ui.hideAll();
    this.ui.show('shareModal');
    // 进入独立的战报态：行程已结算，防止 Esc「恢复驾驶」绕过结算重复计分
    this.state = 'share';
  }

  // ---------- UI 绑定 ----------
  bindUI() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); };
    // 菜单
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.theme === this.selectedTheme);
      card.addEventListener('click', () => {
        this.selectedTheme = card.dataset.theme;
        try { localStorage.setItem('er_theme', this.selectedTheme); } catch (e) {}
        document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('selected', c === card));
        // 菜单背景即时切换
        this.buildWorld(this.selectedTheme, (Date.now() & 0xffffffff) >>> 0, { silent: true });
      });
    });
    on('btnFree', () => this.startRun({ mode: 'free', themeKey: this.selectedTheme }));
    on('btnDaily', () => this.startRun({ mode: 'daily' }));
    on('btnTime', () => this.startRun({ mode: 'time', themeKey: this.selectedTheme }));
    // 车库
    on('carPrev', () => { this.garageIdx = (this.garageIdx + this.cars.length - 1) % this.cars.length; this.renderGarage(); });
    on('carNext', () => { this.garageIdx = (this.garageIdx + 1) % this.cars.length; this.renderGarage(); });
    on('carSelect', () => {
      const car = this.cars[this.garageIdx];
      if (!isCarUnlocked(car) || this.selectedCar.key === car.key) return;
      this.selectedCar = car;
      saveSelectedCar(car.key);
      // 菜单背景即时换车预览
      this.buildWorld(this.selectedTheme, (Date.now() & 0xffffffff) >>> 0, { silent: true });
      this.renderGarage();
      this.audio.blip(2);
    });
    on('btnMute', () => this.ui.setMuted(this.audio.toggleMute()));
    // HUD
    on('btnPause', () => this.pauseGame());
    on('btnPhoto', () => this.enterPhoto());
    on('btnMuteHud', () => this.ui.setMuted(this.audio.toggleMute()));
    // 暂停
    on('btnResume', () => this.resumeGame());
    on('btnRestart', () => this.startRun({ mode: this.mode, themeKey: this.themeKey }));
    on('btnEnd', () => this.endRun());
    on('btnMenu', () => this.goMenu());
    // 设置
    on('btnSettings', () => this.openSettings('menu'));
    on('btnPauseSettings', () => this.openSettings('pause'));
    on('btnSetBack', () => this.closeSettings());
    on('setAudioTest', () => {
      const r = this.audio.testBeep();
      const msg = {
        running: 'audioOk',
        muted: 'audioMuted',
        suspended: 'audioSuspended',
        interrupted: 'audioInterrupted',
      }[r] || 'audioUnsupported';
      this.ui.toast(t(msg));
    });
    const live = (id, fn) => { const el = $(id); if (el) el.addEventListener('input', fn); };
    live('setVolume', (e) => {
      this.settings.data.volume = e.target.value / 100;
      this.audio.setVolume(this.settings.data.volume);
      this.settings.save();
    });
    live('setCam', (e) => {
      this.settings.data.camDist = Math.max(0.8, Math.min(1.5, e.target.value / 100));
      CONFIG.camera.back = CONFIG.camera.backBase * this.settings.data.camDist;
      this.settings.save();
    });
    on('setDayNight', () => {
      this.settings.data.dayNight = !this.settings.data.dayNight;
      this.dayNight.setEnabled(this.settings.data.dayNight);
      this.ui.syncSettings(this.settings.data);
      this.settings.save();
    });
    document.querySelectorAll('#setQuality button').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.settings.data.quality = b.dataset.q;
        this.settings.apply(this);
        this.ui.syncSettings(this.settings.data);
      });
    });
    // 语言：设置面板分段选择 + 主菜单快捷按钮共用同一切换逻辑
    document.querySelectorAll('#setLangSeg button').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchLang(b.dataset.lang);
      });
    });
    on('btnLang', () => this.switchLang(getLang() === 'zh' ? 'en' : 'zh'));
    // 拍照
    on('btnShot', () => this.savePhoto());
    on('btnPhotoExit', () => this.exitPhoto());
    // 分享
    on('btnSave', () => this.shareCanvas && downloadCanvas(this.shareCanvas, `endless-roads-${Date.now()}.png`));
    on('btnShare', async () => {
      if (!this.shareCanvas) return;
      const r = await shareCard(this.shareCanvas, this.shareTextStr);
      const key = { shared: 'shared', copied: 'sharedCopied', downloaded: 'sharedDownloaded', aborted: '' }[r];
      if (key) { this.ui.toast(t(key)); }
    });
    on('btnCopy', async () => {
      try { await navigator.clipboard.writeText(this.shareTextStr || ''); this.ui.toast(t('copied')); }
      catch (e) { this.ui.toast(t('copyFailed')); }
    });
    // 最近行程
    on('btnHistory', () => {
      const list = $('histList');
      const open = list.style.display !== 'none';
      list.style.display = open ? 'none' : 'flex';
      if (!open) this.ui.renderHistory(getRuns());
    });
    on('btnCloseShare', () => this.goMenu());
    this.input.bindTouch();
  }

  savePhoto() {
    this.renderFrame();
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) { this.ui.toast(t('saveFailed')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `endless-roads-photo-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.ui.toast(t('savedToDownloads'));
    }, 'image/png');
  }

  bindInput() {
    this.input.onKey((code, down) => {
      if (!down) return;
      this.audio.unlock();
      if (code === 'KeyM') this.ui.setMuted(this.audio.toggleMute());
      if (this.state === 'run') {
        if (code === 'Escape') this.pauseGame();
        else if (code === 'KeyP') this.enterPhoto();
      } else if (this.state === 'pause') {
        if (code === 'Escape') this.resumeGame();
      } else if (this.state === 'photo') {
        if (code === 'Escape' || code === 'KeyP') this.exitPhoto();
      } else if (this.state === 'share') {
        if (code === 'Escape') this.goMenu();
      }
    });
    // 任意交互解锁音频：不同内核只认不同手势（老 iOS/微信认 touchend，部分安卓认 touchstart），
    // 且切后台后上下文可能再次挂起，故持续监听而非 once
    const unlockAudio = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio);
    window.addEventListener('click', unlockAudio);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) unlockAudio();
    });

    // 拍照模式轨道控制
    const canvas = $('gl');
    let dragging = false, lx = 0, ly = 0, pinchD = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'photo') return;
      dragging = true; lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging || this.state !== 'photo') return;
      const o = this.chase.orbit;
      o.yaw -= (e.clientX - lx) * 0.006;
      o.pitch = Math.max(-0.05, Math.min(1.2, o.pitch + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'photo') return;
      const o = this.chase.orbit;
      o.dist = Math.max(3.5, Math.min(30, o.dist + e.deltaY * 0.012));
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (this.state !== 'photo' || e.touches.length !== 2) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinchD) {
        const o = this.chase.orbit;
        o.dist = Math.max(3.5, Math.min(30, o.dist - (d - pinchD) * 0.04));
      }
      pinchD = d;
    }, { passive: true });
    canvas.addEventListener('touchend', () => { pinchD = 0; });
  }

  onResize() {
    this.camera3d.aspect = innerWidth / innerHeight;
    this.camera3d.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.postfx.setSize(innerWidth, innerHeight);
  }

  // ---------- 主循环 ----------
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    const rawDt = Math.min(Math.max((now - this.last) / 1000, 0), 0.05);
    this.last = now;
    this.time += rawDt;

    // 慢动作时间缩放
    const targetTs = (this.state === 'run' && this.gameplay && this.gameplay.slowMo > 0) ? 0.35 : 1;
    this.timeScale += (targetTs - this.timeScale) * Math.min(1, rawDt * 10);
    const dt = rawDt * this.timeScale;

    if (this.state === 'run' || this.state === 'menu') {
      const isRun = this.state === 'run';
      // 输入（菜单为自动驾驶兜圈）
      const input = isRun ? this.input : AUTO_INPUT(this.player);
      if (!isRun) this.player.targetSpeed = 27;
      if (isRun) {
        if (this.input.accel) this.player.targetSpeed = Math.min(this.player.vMaxEff, this.player.targetSpeed + 16 * rawDt);
        else if (this.input.brake) this.player.targetSpeed = Math.max(CONFIG.vMin, this.player.targetSpeed - 30 * rawDt);
        else this.player.targetSpeed += (CONFIG.vDefault - this.player.targetSpeed) * Math.min(1, rawDt * 0.5);
      }
      this.player.update(dt, input, this.gameplay);
      this.topSpeed = Math.max(this.topSpeed || 0, this.player.speed);
      // 菜单态：车流/收集品/事件/粒子等非关键系统降频（每 3 帧一次，dt 累积补齐）
      this.menuFrame = (this.menuFrame || 0) + 1;
      const lowFreq = !isRun;
      if (lowFreq) this._menuAcc = (this._menuAcc || 0) + dt;
      if (!lowFreq || this.menuFrame % 3 === 0) {
        const sysDt = lowFreq ? this._menuAcc : dt;
        this.npc.update(sysDt, this.player, this.gameplay);
        this.gameplay.update(sysDt, this.player, this.time, this.fx);
        if (isRun) this.milestones.update(this.gameplay, this.player, this.runTime, this.topSpeed, this.ui, this.audio);
        this.events.update(sysDt, this.player);
        this.fx.update(rawDt);
        this.particles.update(sysDt, this.camera3d.position, this.time);
        this.terrain.windmills.update(this.time);
        if (lowFreq) this._menuAcc = 0;
      }
      // 计时赛：倒计时与光门
      if (this.timeAttack && isRun && !this.timeAttack.expired) {
        this.timeAttack.update(dt, this.player);
        if (this.timeAttack.expired) { this.endRun(); }
      }
      this.road.update(this.player.s);
      // 分区提示（仅正式驾驶）
      if (isRun && this.zones) {
        const zoneName = this.zones.pollEnter(this.player.s);
        if (zoneName) this.ui.toast(t('enterZone', { name: zoneName }));
      }
      if (isRun) this.runTime += rawDt;
      this.speedLines.active = this.player.nitroActive;
      this.speedLines.update(dt, this.player, this.road);
      this.chase.update(rawDt, this.player, this.road);
      this.sky.update(rawDt, this.camera3d.position);
      this.aurora.update(rawDt, this.camera3d.position);
      this.ridges.update(rawDt, this.camera3d.position, this.player.s);
      this.grid.update(rawDt, this.camera3d.position);
      this.mist.update(rawDt, this.road, this.player.s, this.camera3d.position);
      this.dayNight.update(rawDt);
      this.particles.setWeather(this.dayNight.weather);
      this.updateSun();
      this.audio.update(Math.min(this.player.speed / CONFIG.vMax, 1.2), this.player.nitroActive, isRun);

      if (isRun) {
        this.hudT += rawDt;
        if (this.hudT > 0.08) {
          this.hudT = 0;
          this.ui.setHUD(this.player.kmh, this.player.s / 1000, this.gameplay.total, this.player.nitro, this.gameplay.combo);
          this.ui.setMult(this.gameplay.getMultiplier(this.player));
          if (this.timeAttack) this.ui.setTime(Math.ceil(this.timeAttack.timeLeft));
        }
      }
    } else if (this.state === 'photo') {
      this.chase.update(rawDt, this.player, this.road);
      this.sky.update(rawDt * 0.3, this.camera3d.position);
      this.particles.update(rawDt * 0.3, this.camera3d.position, this.time);
    }

    this.renderFrame(rawDt);
  }
}

// 菜单自动驾驶输入：回正 + 巡航
function AUTO_INPUT(player) {
  return {
    steer: Math.max(-1, Math.min(1, -player.lateral * 0.35 - player.latVel * 0.06)),
    accel: false, brake: false, nitro: false,
  };
}

window.game = new Game();
