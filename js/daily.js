// 每日挑战与记录（localStorage）
import { dailyKey, dailySeed, dailyLabel } from './rng.js';
import { THEME_ORDER } from './themes.js';

const safe = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

export function dailyInfo() {
  const key = dailyKey();
  return {
    key,
    label: dailyLabel(),
    seed: dailySeed(key),
    themeKey: THEME_ORDER[parseInt(key.slice(-2), 10) % THEME_ORDER.length],
    best: safe.get('er_daily_' + key, null),
  };
}

export function saveDailyResult(key, result) {
  const prev = safe.get('er_daily_' + key, null);
  if (!prev || result.score > prev.score) safe.set('er_daily_' + key, result);
}

export function getRecords() {
  return safe.get('er_records', {});
}

export function updateRecords(themeKey, run) {
  const rec = safe.get('er_records', {});
  const r = rec[themeKey] || { bestDist: 0, bestSpeed: 0, bestCombo: 0, bestScore: 0, runs: 0 };
  r.bestDist = Math.max(r.bestDist, run.dist);
  r.bestSpeed = Math.max(r.bestSpeed, run.topSpeed);
  r.bestCombo = Math.max(r.bestCombo, run.maxCombo);
  r.bestScore = Math.max(r.bestScore, run.score);
  r.runs += 1;
  rec[themeKey] = r;
  safe.set('er_records', rec);
  return r;
}
