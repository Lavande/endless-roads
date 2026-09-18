// 全局可调参数
export const CONFIG = {
  chunkLen: 96,          // 区块长度（米）
  subStep: 4,            // 道路纵向细分步长
  roadHalf: 6.5,         // 可驾驶半宽
  roadEdge: 7.0,         // 路面视觉半宽（含白线）
  roadShoulder: 7.8,     // 含路肩

  chunkAhead: 9,         // 前方保留区块数
  chunkBehind: 2,        // 身后保留区块数

  // 速度（m/s）
  vMin: 8.3,             // ~30 km/h
  vMax: 55.5,            // ~200 km/h
  vNitro: 72,            // ~260 km/h
  vDefault: 33.3,        // ~120 km/h 巡航
  accel: 14,             // 加速度
  brake: 28,             // 刹车减速度

  // 越野（可驶出公路，离路越远阻力越大）
  offroadStart: 7.5,     // 越野判定起点（路肩外，蹭白线不算）
  offroadDragStart: 9,   // 开始额外减速的离路距离
  offroadDragEnd: 38,    // 减速达到上限的离路距离
  offroadCap: 24,        // 深越野速度上限（m/s）
  softLat: 70,           // 软边界弹簧回拉起点
  maxLat: 78,            // 横向偏移硬上限

  latAccel: 30,          // 横向加速度
  latDamp: 5.2,          // 横向阻尼

  // 玩法
  nearMissMin: 1.15,     // 险过横向距离下限（m）
  nearMissMax: 2.9,      // 险过横向距离上限（要真的"险"）
  nearMissScore: 100,    // 险过基础分
  comboWindow: 4.5,      // 连击保持时间（s）
  steerGrace: 1.2,       // 险过要求最近一次转向后的宽限（s）
  oncomingRatio: 0.3,    // 对向车占车流比例
  centerSlowRatio: 0.14, // 占用中线的慢车比例（同向）
  collectNitro: 26,      // 每个收集品氮气
  nitroDrain: 26,        // 氮气消耗 /s
  nitroMin: 8,           // 最低启动量
  maxCollectibles: 90,   // 场景内收集品实例上限

  camera: {
    backBase: 6.8,       // 相机基准距离（设置里的"相机距离"以此为基准缩放）
    back: 6.8, up: 2.7, lookAhead: 16,
    fovBase: 62, fovMax: 80,
  },

  mobile: {
    chunkAhead: 7,
    pixelRatioCap: 1.6,
    propDensity: 0.55,
    particleCount: 320,
  },
  desktop: {
    chunkAhead: 9,
    pixelRatioCap: 2,
    propDensity: 1,
    particleCount: 650,
  },
};

export const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);

export function perfProfile() {
  return IS_MOBILE ? CONFIG.mobile : CONFIG.desktop;
}
