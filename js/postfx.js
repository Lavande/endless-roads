// 后期处理：RenderPass → UnrealBloomPass → OutputPass
// OutputPass 自动跟随 renderer 的 toneMapping / outputColorSpace / exposure，
// 主题切换时只需更新 bloom 参数。
import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = false;
    this.composer = null;
    this.bloom = null;
  }

  // 惰性构建；HalfFloat + 4x MSAA 渲染目标抵消离屏渲染的锯齿
  ensure(scene, camera) {
    if (this.composer) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(size.x, 1), Math.max(size.y, 1), {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.4, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setEnabled(on, scene, camera) {
    this.enabled = !!on;
    if (this.enabled) this.ensure(scene, camera);
  }

  applyTheme(theme) {
    if (!this.bloom || !theme.bloom) return;
    this.bloom.strength = theme.bloom.strength;
    this.bloom.radius = theme.bloom.radius;
    this.bloom.threshold = theme.bloom.threshold;
  }

  setSize(w, h) {
    if (this.composer) this.composer.setSize(w, h);
  }

  render(dt) {
    if (this.enabled) this.composer.render(dt);
  }
}
