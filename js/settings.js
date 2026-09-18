// 设置：音量 / 画质 / 昼夜流转 / 相机距离，localStorage 持久化
import { CONFIG, IS_MOBILE } from './config.js';

const QUALITY = {
  low:    { pixelRatio: 1,   bloom: false, shadows: false, chunkAhead: 6 },
  medium: { pixelRatio: 1.5, bloom: true,  shadows: false, chunkAhead: 8 },
  high:   { pixelRatio: 2,   bloom: true,  shadows: true,  chunkAhead: 9 },
};

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export class Settings {
  constructor() {
    let d = {};
    try { d = JSON.parse(lsGet('er_settings') || '{}'); } catch (e) {}
    this.data = {
      volume: clamp(d.volume != null ? d.volume : 0.8, 0, 1),
      quality: QUALITY[d.quality] ? d.quality : (IS_MOBILE ? 'medium' : 'high'),
      dayNight: d.dayNight !== false,
      camDist: clamp(d.camDist || 1, 0.8, 1.5),
    };
  }

  preset() { return QUALITY[this.data.quality]; }

  save() { lsSet('er_settings', JSON.stringify(this.data)); }

  // 应用全部设置到游戏实例（启动或改动后调用）
  apply(game) {
    const p = this.preset();
    // 渲染分辨率
    const pr = Math.min(devicePixelRatio || 1, p.pixelRatio);
    game.renderer.setPixelRatio(pr);
    game.renderer.setSize(innerWidth, innerHeight);
    // 泛光
    game.postfx.setEnabled(p.bloom, game.scene, game.camera3d);
    if (p.bloom && game.postfx.composer) {
      game.postfx.composer._pixelRatio = pr;
      game.postfx.setSize(innerWidth, innerHeight);
    }
    game.postfx.applyTheme(game.theme || { bloom: { strength: 0.4, radius: 0.6, threshold: 0.8 } });
    // 阴影
    this.applyShadows(game, p.shadows);
    // 视距（当前世界 + 未来世界）
    if (game.road) game.road.prof.chunkAhead = p.chunkAhead;
    // 昼夜
    game.dayNight.setEnabled(this.data.dayNight);
    // 相机距离
    CONFIG.camera.back = CONFIG.camera.backBase * this.data.camDist;
    // 音量
    game.audio.setVolume(this.data.volume);
    this.save();
  }

  applyShadows(game, on) {
    const light = game.dirLight;
    if (!light) return;
    const was = light.castShadow;
    game.renderer.shadowMap.enabled = !!on;
    light.castShadow = !!on;
    if (on) {
      if (!light.shadow.mapSize || light.shadow.mapSize.x !== 1024) light.shadow.mapSize.set(1024, 1024);
      const sc = light.shadow.camera;
      sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 340;
      light.shadow.bias = -0.0015;
      if (light.target.parent !== game.scene) game.scene.add(light.target);
    }
    // shadowMap.enabled 切换需要刷新全部材质
    if (was !== !!on) game.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
