// 车库：三台车，性能取向不同；以生涯最高单局分解锁
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export const CARS = [
  {
    key: 'hatch',
    name: '灵动掀背',
    en: 'Zippy Hatch',
    desc: '轻盈灵活，转向响应最快',
    descEn: 'Light and nimble, with the quickest steering',
    unlockAt: 0,
    scale: [1, 1, 0.96],
    colors: { body: '#e8b23a', cabin: '#20262e', wheel: '#16181c', head: '#fff6d8', tail: '#ff3b30', roof: '#f5f0e2' },
    stats: { accel: 1.15, vMax: 1.0, latAccel: 1.18, vNitro: 1.0, offroad: 1.0, collectNitro: 1.0 },
    // bars 的 key 为 ASCII，展示文案走 i18n 的 bar.* 词典
    bars: { speed: 0.62, handling: 0.95, offroad: 0.5, nitro: 0.6 },
  },
  {
    key: 'gt',
    name: '沉稳 GT',
    en: 'Grand Tourer',
    desc: '越野更从容，收集氮气 +35%',
    descEn: 'Sure-footed off-road · +35% nitro from pickups',
    unlockAt: 5000,
    scale: [1.08, 1.04, 1.1],
    colors: { body: '#3f7f8f', cabin: '#1a222c', wheel: '#14161a', head: '#fff6d8', tail: '#ff3b30', roof: '#dfe8ee' },
    stats: { accel: 0.95, vMax: 1.05, latAccel: 0.95, vNitro: 1.0, offroad: 0.55, collectNitro: 1.35 },
    bars: { speed: 0.72, handling: 0.68, offroad: 0.88, nitro: 0.65 },
  },
  {
    key: 'hyper',
    name: '极速超跑',
    en: 'Hypercar',
    desc: '极限速度与氮气都更强',
    descEn: 'A higher top speed and a stronger nitro',
    unlockAt: 20000,
    scale: [1.14, 0.86, 1.16],
    colors: { body: '#d84545', cabin: '#161a22', wheel: '#101318', head: '#fffbef', tail: '#ff2d5e', roof: '#f1f3f7' },
    stats: { accel: 1.22, vMax: 1.12, latAccel: 1.0, vNitro: 1.07, offroad: 1.15, collectNitro: 1.0 },
    bars: { speed: 1.0, handling: 0.78, offroad: 0.35, nitro: 1.0 },
  },
];

export function loadSelectedCar() {
  const k = lsGet('er_car');
  return CARS.find(c => c.key === k) || CARS[0];
}
export function saveSelectedCar(key) { lsSet('er_car', key); }

export function careerBestScore() {
  const v = parseInt(lsGet('er_careerBest') || '0', 10);
  return Number.isFinite(v) ? v : 0;
}
export function recordCareerBest(score) {
  if (score > careerBestScore()) lsSet('er_careerBest', String(Math.floor(score)));
}
export function isCarUnlocked(car) {
  return careerBestScore() >= car.unlockAt;
}
