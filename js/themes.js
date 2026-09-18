// 四大主题：黄昏旷野 / 赛博霓虹 / 雪原极光 / 水墨山水
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);

export const THEMES = {
  sunset: {
    key: 'sunset',
    name: '黄昏旷野',
    en: 'Golden Dusk',
    accent: '#f2a65a',
    gradient: 'linear-gradient(160deg,#35528c 0%,#c96f4a 55%,#ffc27a 100%)',

    hillAmp: 1,
    propDensity: 1,
    windmills: true,
    particles: 'firefly',
    underglow: null,

    sky: {
      zenith: '#35528c', horizon: '#f2a65a', ground: '#6b543a',
      sunDir: [0.28, 0.16, -0.94], sun: '#fff3c8', sunGlowColor: '#ffb066',
      sunSize: 0.007, sunGlow: 1, stripedSun: false, stars: 0,
    },
    fog: { color: '#e8a86e', near: 55, far: 560 },
    lights: {
      hemi: ['#ffd9a8', '#7a5c3a', 0.85],
      dir: ['#ffca8a', 1.15, [60, 80, -40]],
    },
    exposure: 1.02,
    bloom: { strength: 0.32, radius: 0.55, threshold: 0.82 },
    // 夜变体：暮色沉入星夜
    night: {
      sky: { zenith: '#0a1030', horizon: '#3a2a55', ground: '#141018', sun: '#fff6e0', sunGlow: 0.25, stars: 1.0 },
      fog: { color: '#2a2338', far: 480 },
      lights: { hemi: ['#3a4470', '#1a1830', 0.5], dir: ['#8fa8ff', 0.4, [-40, 60, -20]] },
      exposure: 0.92,
      ridgeTint: '#1a1830', ridgeMix: 0.55,
    },

    road: {
      asphalt: C('#4b474e'),
      dash: C('#f5efdd'),
      edgeLine: C('#e8e2d0'),
      shoulderL: (alt) => (alt ? C('#d94f3d') : C('#f2ead8')),
      shoulderR: (alt) => (alt ? C('#d94f3d') : C('#f2ead8')),
    },
    glowEdges: null,
    lightGate: null,
    grid: null,
    aurora: null,
    ridges: [
      { color: '#a86a4a', height: 0.30, freq: 1.2, mist: 0.75 },
      { color: '#8a5340', height: 0.42, freq: 1.8, mist: 0.6 },
      { color: '#613a34', height: 0.56, freq: 2.4, mist: 0.45 },
    ],
    ridgeMist: '#f2b988',

    terrain: { base: '#c9a34e', alt: '#a8843c', patch: '#8a6d33' },
    propSet: [
      { type: 'stalk', w: 4.2, min: 8.5, max: 40, variants: 2, scale: 1.2 },
      { type: 'tree', w: 2.2, min: 12, max: 80, variants: 2 },
      { type: 'rock', w: 0.8, min: 9, max: 70, variants: 2 },
      { type: 'windmill', w: 0.35, min: 18, max: 60 },
    ],
    props: {
      tree: { crown: '#6d7a3f', crown2: '#8a8a45', trunk: '#6b4a33' },
      rock: '#8d8577', rock2: '#a39a88',
      stalk: { a: '#d8b45c', b: '#c9a34e' },
      windmill: { tower: '#e8e2d4', blade: '#f5f0e2' },
      neon: { a: '#ff2d95', b: '#22e6f6' },
      pine: { trunk: '#5d4230', base: '#2c4a3e', mid: '#39604f', top: '#eef6f2' },
      pagoda: { body: '#3a3f45', roof: '#b03a2e' },
    },

    playerCar: { body: '#e03e3e', cabin: '#20262e', wheel: '#16181c', head: '#fff6d8', tail: '#ff3b30', roof: '#f5f0e2' },
    collectible: '#ffd166',
    collectibleName: '麦穗金穗',
    events: ['birds', 'balloons', 'meteor', 'fireflyBurst'],
    shareBg: ['#c96f4a', '#35528c'],
  },

  neon: {
    key: 'neon',
    name: '赛博霓虹',
    en: 'Neon Drive',
    accent: '#22e6f6',
    gradient: 'linear-gradient(160deg,#0a0e2a 0%,#3b1e6c 55%,#ff2d95 100%)',
    dark: true,

    hillAmp: 0.75,
    propDensity: 0.9,
    windmills: false,
    particles: 'rain',
    underglow: '#22e6f6',

    sky: {
      zenith: '#131745', horizon: '#5a2ca0', ground: '#221845',
      sunDir: [0, 0.14, -1], sun: '#ffaadd', sunGlowColor: '#ff4daa',
      sunSize: 0.075, sunGlow: 1.3, stripedSun: true, stars: 0.7,
    },
    fog: { color: '#261c4a', near: 40, far: 480 },
    lights: {
      hemi: ['#7460c4', '#2a1c50', 0.85],
      dir: ['#9a8cff', 0.8, [-40, 90, -60]],
    },
    exposure: 1.25,
    bloom: { strength: 0.9, radius: 0.45, threshold: 0.5 },
    // 夜变体：深夜（霓虹本就是夜，向更深的夜推进）
    night: {
      sky: { zenith: '#050820', horizon: '#2a1450', sunGlow: 0.9, stars: 1.0 },
      fog: { color: '#160f30', far: 430 },
      lights: { hemi: ['#4a3a90', '#160f38', 0.7], dir: ['#7a6aff', 0.55, [-40, 90, -60]] },
      exposure: 1.15,
      ridgeTint: '#0d0a24', ridgeMix: 0.5,
    },

    road: {
      asphalt: C('#272b4d'),
      dash: C('#b4beee'),
      edgeLine: C('#d5deff'),
      shoulderL: () => C('#372d5c'),
      shoulderR: () => C('#372d5c'),
    },
    glowEdges: [C('#ff2d95'), C('#22e6f6')],
    lightGate: ['#ff2d95', '#22e6f6'],
    grid: '#ff2d95',
    aurora: null,
    ridges: [
      { color: '#3a2d6e', height: 0.5, freq: 2.2, mist: 0.55 },
      { color: '#2c2258', height: 0.66, freq: 2.8, mist: 0.45 },
      { color: '#221a48', height: 0.8, freq: 3.2, mist: 0.35 },
    ],
    ridgeMist: '#3d2e78',

    terrain: { base: '#232754', alt: '#181b3c', patch: '#302d64' },
    propSet: [
      { type: 'bldg', w: 3.0, min: 16, max: 72, variants: 3 },
      { type: 'pillar', w: 1.6, min: 10, max: 46, variants: 2 },
      { type: 'sign', w: 1.1, min: 11, max: 34, variants: 2 },
    ],
    props: {
      neon: { a: '#ff2d95', b: '#22e6f6' },
    },

    playerCar: { body: '#dfe4ee', cabin: '#1a2230', wheel: '#10131c', head: '#eaffff', tail: '#ff2d5e', roof: '#22e6f6' },
    collectible: '#22e6f6',
    collectibleName: '数据芯片',
    events: ['ufo', 'birds', 'meteor', 'lightTrail'],
    shareBg: ['#3b1e6c', '#ff2d95'],
  },

  snow: {
    key: 'snow',
    name: '雪原极光',
    en: 'Aurora Snowfield',
    accent: '#7ae0ff',
    gradient: 'linear-gradient(160deg,#0b1230 0%,#27437a 55%,#4dffa6 100%)',

    hillAmp: 1.15,
    propDensity: 1,
    windmills: false,
    particles: 'snow',
    underglow: null,

    sky: {
      zenith: '#0b1230', horizon: '#2e4d86', ground: '#c3d4ea',
      sunDir: [-0.3, 0.1, -0.95], sun: '#dfeaff', sunGlowColor: '#8fb0e8',
      sunSize: 0.006, sunGlow: 0.5, stripedSun: false, stars: 0.9,
    },
    fog: { color: '#a9c2e2', near: 45, far: 500 },
    lights: {
      hemi: ['#bcd2f5', '#74849e', 0.95],
      dir: ['#9fc0ff', 0.7, [50, 90, -30]],
    },
    exposure: 1.0,
    bloom: { strength: 0.42, radius: 0.65, threshold: 0.72 },
    // 夜变体：极夜，极光增亮
    night: {
      sky: { zenith: '#04081c', horizon: '#12244a', ground: '#5a6a88', sunGlow: 0.2, stars: 1.2 },
      fog: { color: '#3c517a', far: 430 },
      lights: { hemi: ['#5a78b8', '#3a4a66', 0.6], dir: ['#7a9cff', 0.35, [50, 90, -30]] },
      exposure: 0.95,
      auroraBoost: 2.2,
      ridgeTint: '#1c2a48', ridgeMix: 0.5,
    },

    road: {
      asphalt: C('#4a5060'),
      dash: C('#eef4ff'),
      edgeLine: C('#dfe9f8'),
      shoulderL: (alt) => (alt ? C('#e9f0fa') : C('#9aa8bd')),
      shoulderR: (alt) => (alt ? C('#e9f0fa') : C('#9aa8bd')),
    },
    glowEdges: null,
    lightGate: null,
    grid: null,
    aurora: ['#4dffa6', '#7ae0ff', '#b07aff'],
    ridges: [
      { color: '#6f86ad', height: 0.4, freq: 1.4, mist: 0.7 },
      { color: '#4d648c', height: 0.56, freq: 2.0, mist: 0.55 },
      { color: '#33476b', height: 0.72, freq: 2.6, mist: 0.4 },
    ],
    ridgeMist: '#c3d4ea',

    terrain: { base: '#e6eef8', alt: '#c6d6ea', patch: '#f4f9ff' },
    propSet: [
      { type: 'pine', w: 3.6, min: 9, max: 85, variants: 1 },
      { type: 'rock', w: 0.9, min: 9, max: 60, variants: 2 },
    ],
    props: {
      pine: { trunk: '#4a3a2c', base: '#2c4a3e', mid: '#3e6656', top: '#eef6f2' },
      rock: '#9fb0c4', rock2: '#c8d6e6',
      neon: { a: '#7ae0ff', b: '#4dffa6' },
    },

    playerCar: { body: '#d84545', cabin: '#1a222e', wheel: '#14161a', head: '#fffbe8', tail: '#ff3b30', roof: '#eef4ff' },
    collectible: '#4dffa6',
    collectibleName: '极光碎片',
    events: ['auroraSurge', 'birds', 'meteor'],
    shareBg: ['#27437a', '#4dffa6'],
  },

  ink: {
    key: 'ink',
    name: '水墨山水',
    en: 'Ink Mountains',
    accent: '#b03a2e',
    gradient: 'linear-gradient(160deg,#f3efe6 0%,#cfc9ba 55%,#8f887a 100%)',
    mist: true,

    hillAmp: 1.2,
    propDensity: 0.65,
    windmills: false,
    particles: 'mote',
    underglow: null,

    sky: {
      zenith: '#f2f3ec', horizon: '#ebe4d3', ground: '#d5cfbe',
      sunDir: [0.34, 0.3, -0.9], sun: '#c94f38', sunGlowColor: '#d98570',
      sunSize: 0.008, sunGlow: 0.3, stripedSun: false, stars: 0,
    },
    fog: { color: '#e7e1d1', near: 36, far: 470 },
    lights: {
      hemi: ['#f7f4eb', '#998f7d', 1.1],
      dir: ['#fff6e2', 1.0, [70, 100, -30]],
    },
    exposure: 1.0,
    bloom: { strength: 0.13, radius: 0.8, threshold: 0.88 },
    // 夜变体：暮色（纸面染上暖金，日轮低垂）
    night: {
      sky: { zenith: '#e8d9b8', horizon: '#e0b890', ground: '#b8a488', sun: '#c94f38', sunGlowColor: '#d98a5a', sunGlow: 0.5, sunSize: 0.012 },
      fog: { color: '#dcc9a8', near: 32 },
      lights: { hemi: ['#f0dfc0', '#8a7a62', 0.95], dir: ['#ffd9a0', 0.9, [70, 60, -30]] },
      exposure: 0.98,
      mist: '#c9b898',
    },

    road: {
      asphalt: C('#847e70'),
      dash: C('#f0eadb'),
      edgeLine: C('#ded7c5'),
      shoulderL: (alt) => (alt ? C('#524d44') : C('#bfb8a6')),
      shoulderR: (alt) => (alt ? C('#524d44') : C('#bfb8a6')),
    },
    glowEdges: null,
    lightGate: null,
    grid: null,
    aurora: null,
    ridges: [
      { color: '#ccc5b6', height: 0.42, freq: 1.2, mist: 0.9 },
      { color: '#a8a193', height: 0.58, freq: 1.8, mist: 0.78 },
      { color: '#75705f', height: 0.74, freq: 2.4, mist: 0.6 },
    ],
    ridgeMist: '#f0ebdd',

    terrain: { base: '#ddd6c2', alt: '#bfb8a6', patch: '#97917f' },
    propSet: [
      { type: 'bamboo', w: 2.6, min: 10, max: 70, variants: 3 },
      { type: 'inkTree', w: 2.0, min: 13, max: 80, variants: 2 },
      { type: 'pagoda', w: 0.5, min: 14, max: 55, variants: 1 },
      { type: 'pavilion', w: 0.4, min: 13, max: 40, variants: 1 },
      { type: 'rock', w: 1.0, min: 9, max: 60, variants: 2 },
    ],
    props: {
      rock: '#8a8478', rock2: '#a39c8c',
      neon: { a: '#b03a2e', b: '#4a463e' },
      pine: { trunk: '#4a3a2c', base: '#2c4a3e', mid: '#3e6656', top: '#eef6f2' },
      tree: { crown: '#5d6470', crown2: '#454b53', trunk: '#3a3f45' },
      pagoda: { body: '#454b53', roof: '#b03a2e' },
      stalk: { a: '#b5ae9c', b: '#a39c8c' },
      windmill: { tower: '#d9d2c0', blade: '#c4bda9' },
    },

    playerCar: { body: '#8f2f26', cabin: '#2b2822', wheel: '#1a1815', head: '#fff6d8', tail: '#c94f38', roof: '#e7e0cf' },
    collectible: '#b03a2e',
    collectibleName: '朱砂墨滴',
    events: ['cranes', 'meteor', 'fireflyBurst'],
    shareBg: ['#8f887a', '#b03a2e'],
  },
};

export const THEME_ORDER = ['sunset', 'neon', 'snow', 'ink'];

// 应用主题到渲染环境（天空/雾/光照/粒子由 main 协调）
export function applyThemeEnv(scene, theme) {
  scene.fog = new THREE.Fog(new THREE.Color(theme.fog.color), theme.fog.near, theme.fog.far);
  scene.background = null;
}
