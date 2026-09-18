// 最近行程历史：本地保存最近 10 次
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export function addRun(entry) {
  let runs = [];
  try { runs = JSON.parse(lsGet('er_runs') || '[]'); } catch (e) { runs = []; }
  if (!Array.isArray(runs)) runs = [];
  runs.unshift(entry);
  runs = runs.slice(0, 10);
  lsSet('er_runs', JSON.stringify(runs));
  return runs;
}

export function getRuns() {
  try {
    const runs = JSON.parse(lsGet('er_runs') || '[]');
    return Array.isArray(runs) ? runs : [];
  } catch (e) { return []; }
}
