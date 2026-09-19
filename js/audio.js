// WebAudio 程序化音效：引擎/风/收集/险过/碰撞/氮气 + 主题氛围垫
function lsGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}

export class AudioSystem {
  constructor() {
    this.ctxA = null;
    this.muted = lsGet('er_muted') === '1';
    this.ready = false;
    this.volume = 0.8;
  }

  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctxA = new AC();
      const c = this.ctxA;
      this.resumeCtx();
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.8;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(c.destination);

      // 引擎：双锯齿波 + 低通
      this.engGain = c.createGain();
      this.engGain.gain.value = 0;
      this.engFilter = c.createBiquadFilter();
      this.engFilter.type = 'lowpass';
      this.engFilter.frequency.value = 500;
      this.osc1 = c.createOscillator(); this.osc1.type = 'sawtooth'; this.osc1.frequency.value = 60;
      this.osc2 = c.createOscillator(); this.osc2.type = 'square'; this.osc2.frequency.value = 91;
      const og = c.createGain(); og.gain.value = 0.5;
      this.osc1.connect(this.engFilter); this.osc2.connect(og); og.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.osc1.start(); this.osc2.start();

      // 风：白噪声循环 + 带通
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      let seedN = 12345;
      for (let i = 0; i < len; i++) { seedN = (seedN * 16807) % 2147483647; data[i] = (seedN / 2147483647) * 2 - 1; }
      this.windSrc = c.createBufferSource();
      this.windSrc.buffer = this.noiseBuf; this.windSrc.loop = true;
      this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 700; this.windFilter.Q.value = 0.6;
      this.windGain = c.createGain(); this.windGain.gain.value = 0;
      this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
      this.windSrc.start();

      this.ready = true;
      this.startAmbient();
    } catch (e) { console.warn('audio init failed', e); }
  }

  // 移动端解锁：iOS/部分 WebView 创建后处于 suspended，需在手势内 resume + 播放静音缓冲
  resumeCtx() {
    const c = this.ctxA;
    if (!c || c.state !== 'suspended') return;
    c.resume();
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  }

  // 在任意用户手势中调用，安全且幂等
  unlock() {
    if (!this.ready) this.init();
    this.resumeCtx();
  }

  startAmbient() {
    const c = this.ctxA;
    this.ambGain = c.createGain();
    this.ambGain.gain.value = 0.05;
    this.ambGain.connect(this.master);
    this.ambOscs = [];
  }

  setAmbient(theme) {
    if (!this.ready) return;
    const c = this.ctxA;
    // 换和弦
    for (const o of this.ambOscs) { try { o.stop(); } catch (e) {} }
    this.ambOscs.length = 0;
    const chords = {
      sunset: [110, 164.81, 220, 277.18],
      neon: [55, 82.41, 110, 130.81],
      snow: [65.41, 98, 130.81, 196],
      ink: [87.31, 130.81, 174.61, 261.63],
    };
    const ch = chords[theme.key] || chords.sunset;
    ch.forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      const g = c.createGain();
      g.gain.value = 0.12 / (i + 1);
      // 缓慢呼吸
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + i * 0.017;
      const lg = c.createGain(); lg.gain.value = 0.04 / (i + 1);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(this.ambGain);
      o.start(); lfo.start();
      this.ambOscs.push(o, lfo);
    });
    // 水墨：偶发五声音阶拨弦
    if (theme.key === 'ink' && !this.pluckTimer) {
      const scale = [220, 261.63, 293.66, 349.23, 392];
      this.pluckTimer = setInterval(() => {
        if (this.muted || !this.ready) return;
        const f = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
        this.pluck(f);
      }, 3200 + Math.random() * 3000);
    }
    if (theme.key !== 'ink' && this.pluckTimer) { clearInterval(this.pluckTimer); this.pluckTimer = null; }
  }

  pluck(freq) {
    const c = this.ctxA;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.6);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(c.currentTime + 1.7);
  }

  // 每帧调用：速度 → 引擎/风
  update(speedNorm, nitroActive, driving) {
    if (!this.ready) return;
    const t = this.ctxA.currentTime;
    const rpm = 0.18 + speedNorm * 0.82;
    const f = 46 + rpm * 105 + (nitroActive ? 24 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f * 1.502, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(300 + speedNorm * 1600, t, 0.1);
    this.engGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.055 : 0, t, 0.15);
    this.windGain.gain.setTargetAtTime(driving ? speedNorm * 0.11 + (nitroActive ? 0.05 : 0) : 0.02, t, 0.2);
  }

  blip(combo) {
    if (!this.ready || this.muted) return;
    const c = this.ctxA, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(660 * (1 + Math.min(combo, 10) * 0.05), t);
    o.frequency.exponentialRampToValueAtTime(990 * (1 + Math.min(combo, 10) * 0.04), t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(t + 0.25);
  }

  whoosh(pitch = 1) {
    if (!this.ready || this.muted) return;
    const c = this.ctxA, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300 * pitch, t);
    f.frequency.exponentialRampToValueAtTime(2600 * pitch, t + 0.28);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.4);
  }

  thud() {
    if (!this.ready || this.muted) return;
    const c = this.ctxA, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(82, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(t + 0.3);
  }

  nitroFx() {
    if (!this.ready || this.muted) return;
    const c = this.ctxA, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.5);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(); o.stop(t + 0.75);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ready && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume * 0.8, this.ctxA.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('er_muted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.ready) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.8, this.ctxA.currentTime, 0.05);
    return this.muted;
  }
}
