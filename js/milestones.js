// 里程碑成就：每帧检查，首次达成给奖励分并持久化
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

const DEFS = [
  { id: 'nm1', name: '初次险过', reward: 500, check: s => s.g.nearMisses >= 1 },
  { id: 'combo5', name: '连击 ×5', reward: 1000, check: s => s.g.maxCombo >= 5 },
  { id: 'combo10', name: '连击 ×10', reward: 2500, check: s => s.g.maxCombo >= 10 },
  { id: 'combo20', name: '连击 ×20', reward: 6000, check: s => s.g.maxCombo >= 20 },
  { id: 'dist10', name: '单程 10 km', reward: 1500, check: s => s.p.s >= 10000 },
  { id: 'dist25', name: '单程 25 km', reward: 4000, check: s => s.p.s >= 25000 },
  { id: 'dist50', name: '单程 50 km', reward: 10000, check: s => s.p.s >= 50000 },
  { id: 'collect50', name: '收集 50 枚', reward: 2000, check: s => s.g.collects >= 50 },
  { id: 'clean300', name: '5 分钟零碰撞', reward: 5000, check: s => s.t >= 300 && s.g.bumps === 0 },
  { id: 'speed260', name: '极速 260 km/h', reward: 3000, check: s => s.p.kmh >= 260 },
  { id: 'oncoming10', name: '对向险过 10 次', reward: 3000, check: s => s.g.oncomingNearMisses >= 10 },
  { id: 'score10k', name: '单局 10,000 分', reward: 2000, check: s => s.g.total >= 10000 },
];

export class Milestones {
  constructor() {
    let saved = [];
    try { saved = JSON.parse(lsGet('er_achievements') || '[]'); } catch (e) {}
    this.unlocked = new Set(Array.isArray(saved) ? saved : []);
    this.runAwarded = [];
  }

  get unlockedCount() { return this.unlocked.size; }
  get total() { return DEFS.length; }

  beginRun() { this.runAwarded = []; }

  // 每帧调用；达成时加奖励分并提示
  update(gameplay, player, runTime, topSpeed, ui, audio) {
    for (const a of DEFS) {
      if (this.unlocked.has(a.id)) continue;
      let hit = false;
      try { hit = a.check({ g: gameplay, p: player, t: runTime, top: topSpeed }); } catch (e) { hit = false; }
      if (hit) {
        this.unlocked.add(a.id);
        try { lsSet('er_achievements', JSON.stringify([...this.unlocked])); } catch (e) {}
        this.runAwarded.push(a.id);
        gameplay.score += a.reward;
        if (ui) ui.toast(`🏆 成就 · ${a.name}　+${a.reward} 分`);
        if (audio) audio.blip(8);
      }
    }
  }
}
