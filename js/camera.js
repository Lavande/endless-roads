// 追逐相机 + 拍照模式自由环绕
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeFrame } from './road.js';

const _fr = makeFrame();
const _target = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const UP2 = new THREE.Vector3(0, 1, 0);

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.fov = CONFIG.camera.fovBase;
    this.mode = 'chase';
    this.orbit = { yaw: Math.PI, pitch: 0.22, dist: 9 };
    this.terrain = null; // 由 main 在世界构建后注入，用于越野防穿地
  }

  update(dt, player, road, opts = {}) {
    if (this.mode === 'photo') { this.updatePhoto(player); return; }
    const cfg = CONFIG.camera;
    road.frame(player.s, _fr);
    // 锚点 = 车身实际位置（含越野地形高度）
    _target.copy(player.mesh.position);
    this.cam.position.copy(_target)
      .addScaledVector(_fr.tan, -cfg.back)
      .addScaledVector(_fr.right, player.latVel * 0.12)   // 转向时相机稍微外甩
      .addScaledVector(UP2, cfg.up + Math.min(player.speed / CONFIG.vMax, 1.15) * 0.6);

    // 越野/爬坡时相机不被地形吞没（采样渲染地表，与所见一致）
    if (this.terrain) {
      const latCam = player.lateral + player.latVel * 0.12;
      const hMin = this.terrain.surfaceY(latCam, player.s - cfg.back) + 1.7;
      if (this.cam.position.y < hMin) this.cam.position.y = hMin;
    }

    _lookTarget.copy(_target)
      .addScaledVector(_fr.tan, cfg.lookAhead)
      .addScaledVector(UP2, 1.1);
    this.cam.lookAt(_lookTarget);

    // 震动（路外/碰撞/氮气）
    const shake = player.shake + (opts.nitroShake || 0);
    if (shake > 0.01) {
      const t = performance.now() * 0.001;
      this.cam.position.x += Math.sin(t * 47) * 0.09 * shake;
      this.cam.position.y += Math.sin(t * 53 + 1) * 0.07 * shake;
    }

    // 速度 FOV + 氮气冲击
    const spdN = Math.min(player.speed / CONFIG.vMax, 1.15);
    const fovTarget = cfg.fovBase + spdN * 12 + (player.nitroActive ? 8 : 0);
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-dt * 4));
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }

  updatePhoto(player) {
    const o = this.orbit;
    const p = player.mesh.position;
    this.cam.position.set(
      p.x + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw),
      p.y + o.dist * Math.sin(o.pitch) + 0.6,
      p.z + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw)
    );
    this.cam.lookAt(p.x, p.y + 0.8, p.z);
  }

  enterPhoto() {
    this.mode = 'photo';
    this.orbit = { yaw: Math.PI, pitch: 0.18, dist: 9 }; // 车头方向
  }
  exitPhoto() { this.mode = 'chase'; }
}
