// 轻量 i18n：两份扁平词典 + 静态文案扫描；语言偏好存 er_lang，首次访问跟随浏览器
// 词典值里的 {xxx} 为插值占位；数据类名称（主题/分区/车/成就）不进词典，走各数据文件的 name/en 双字段

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export const DICT = {
  zh: {
    title: '无尽公路 Endless Roads',
    appTitle: '无尽公路',

    // 主菜单
    subtitle: 'Endless Roads · 开往地平线，不设终点',
    freeRoam: '自由驾驶',
    dailyTitle: '每日挑战 · 全球同一条路',
    dailyBest: '今日最佳 {score} 分 · {km} km',
    dailyEmpty: '今日尚无记录，来跑一趟？',
    bestRow: '最佳 {score} 分 · {km} km',
    timeTitle: '限时挑战 · 光门续时',
    timeDesc: '初始 60 秒，穿过光门加时，看你能跑多远',
    history: '最近行程',
    historySum: '共 {n} 次 · 最新 {score} 分',
    historyEmpty: '还没有记录，来跑一趟',
    historyRow: '{score} 分 · {km} km',
    achSummary: '🏆 里程碑成就 {n} / {total}',
    hintKeys: 'A/D 转向 · W/S 调速 · Shift/空格 氮气 · P 拍照 · M 静音',
    hintTouch: '手机：左右按钮转向，加速/减速控速，NOS 氮气',

    // 车库
    bar: { speed: '极速', handling: '操控', offroad: '越野', nitro: '氮气' },
    carLock: '🔒 单局得分达 {score} 解锁',
    carPager: '{i} / {n} · 生涯最高 {best}',
    carSelected: '当前座驾',
    carSelect: '选用',
    carLocked: '未解锁',
    prevCar: '上一台车',
    nextCar: '下一台车',

    // HUD
    hudDist: '里程',
    hudScore: '得分',
    hudCombo: '连击',
    photoMode: '拍照模式 (P)',
    pause: '暂停 (Esc)',
    mute: '静音 (M)',
    speedUp: '加速',
    slowDown: '减速',
    steerLeft: '左转',
    steerRight: '右转',

    // 驾驶中
    nearMiss: '险过 +{pts}',
    nearMissOncoming: '对向险过 +{pts}',
    crash: '碰撞',
    gateGain: '光门 +{s}s',
    modeDaily: '每日挑战',
    modeTime: '计时赛',
    modeFree: '自由驾驶',
    enterZone: '进入 · {name}',
    soundLocked: '🔇 点按屏幕任意处开启声音',
    achToast: '🏆 成就 · {name}　+{reward} 分',

    // 环境事件 toast
    evBirds: '一群飞鸟掠过天际',
    evEgrets: '一行白鹭上青天',
    evBalloons: '热气球缓缓飘过',
    evMeteor: '流星划过天际',
    evUfo: '不明飞行物出没',
    evAurora: '极光骤然爆发',
    evFireflies: '萤火虫群起舞',
    evLightTrail: '对向光轨呼啸而过',

    // 暂停
    paused: '已暂停',
    resume: '继续驾驶',
    restart: '重新开始',
    settings: '设置',
    finishRun: '结束旅程 · 生成战报',
    mainMenu: '回主菜单',

    // 拍照
    photoTip: '拖动旋转 · 滚轮/双指缩放',
    savePhotoBtn: '保存照片',
    photoExit: '退出 (P)',

    // 战报
    runSummary: '旅程战报',
    shareAlt: '战报卡片',
    share: '分享',
    saveImage: '保存图片',
    copyText: '复制战报',

    // 设置
    language: '语言',
    volume: '音量',
    testSound: '测试声音',
    play: '播放',
    audioNote: 'iPhone 请先关闭侧边静音拨片（拨片露出橙色点为静音），否则系统会静掉游戏声音。',
    quality: '画质',
    qLow: '流畅',
    qMedium: '均衡',
    qHigh: '精美',
    dayNight: '昼夜流转',
    on: '开',
    off: '关',
    camDist: '相机距离',
    back: '返回',
    switchLang: '切换语言',

    // 加载
    loading: '正在铺路…',

    // 音频测试结果
    audioOk: '🔊 声音正常',
    audioMuted: '当前处于静音，先取消静音再测试',
    audioSuspended: '音频被系统挂起，请再点一次',
    audioInterrupted: '音频被系统中断，请再点一次',
    audioUnsupported: '此设备不支持网页音频',

    // 分享/保存 toast
    shared: '已分享',
    sharedCopied: '已保存图片并复制战报',
    sharedDownloaded: '已保存图片',
    copied: '战报已复制',
    copyFailed: '复制失败',
    saveFailed: '保存失败',
    savedToDownloads: '已保存到下载',

    // 战报卡片（share.js）
    cardTitle: '无 尽 公 路',
    stat: { score: '得分', dist: '里程', top: '极速', nearMiss: '险过', combo: '最高连击', collect: '收集' },
    shareTextTitle: '【无尽公路】{theme} · {mode}',
    shareTextStats: '里程 {km} km · 极速 {top} km/h',
    shareTextCombo: '险过 ×{nm} · 最高连击 ×{combo} · 收集 ×{collect}',
    shareTextScore: '得分 {score}',
  },

  en: {
    title: 'Endless Roads',
    appTitle: 'Endless Roads',

    // Main menu
    subtitle: 'No finish line — just the horizon',
    freeRoam: 'Free Roam',
    dailyTitle: 'Daily Run · one road for everyone',
    dailyBest: 'Best today · {score} pts · {km} km',
    dailyEmpty: 'No runs yet today',
    bestRow: 'Best {score} pts · {km} km',
    timeTitle: 'Time Attack · gates add time',
    timeDesc: 'Start with 60 seconds — gates add time. How far can you go?',
    history: 'Recent Runs',
    historySum: '{n} runs · latest {score} pts',
    historyEmpty: 'No runs yet',
    historyRow: '{score} pts · {km} km',
    achSummary: '🏆 Milestones {n} / {total}',
    hintKeys: 'A/D steer · W/S speed · Shift/Space nitro · P photo · M mute',
    hintTouch: 'Touch: side arrows steer · + / − set speed · NOS for nitro',

    // Garage
    bar: { speed: 'Speed', handling: 'Handling', offroad: 'Off-road', nitro: 'Nitro' },
    carLock: '🔒 Unlocks at {score} pts',
    carPager: '{i} / {n} · career best {best}',
    carSelected: 'Selected',
    carSelect: 'Select',
    carLocked: 'Locked',
    prevCar: 'Previous car',
    nextCar: 'Next car',

    // HUD
    hudDist: 'DIST',
    hudScore: 'SCORE',
    hudCombo: 'COMBO',
    photoMode: 'Photo mode (P)',
    pause: 'Pause (Esc)',
    mute: 'Mute (M)',
    speedUp: '+',
    slowDown: '−',
    steerLeft: 'Steer left',
    steerRight: 'Steer right',

    // Driving
    nearMiss: 'Near Miss +{pts}',
    nearMissOncoming: 'Oncoming +{pts}',
    crash: 'Crash',
    gateGain: 'Gate +{s}s',
    modeDaily: 'Daily Run',
    modeTime: 'Time Attack',
    modeFree: 'Free Roam',
    enterZone: 'Now entering {name}',
    soundLocked: '🔇 Tap anywhere to turn on sound',
    achToast: '🏆 Milestone — {name} +{reward}',

    // Environment event toasts
    evBirds: 'A flock of birds sweeps past',
    evEgrets: 'A line of egrets climbs into the sky',
    evBalloons: 'A hot air balloon drifts by',
    evMeteor: 'A meteor streaks overhead',
    evUfo: 'A UFO has been spotted',
    evAurora: 'The aurora flares up',
    evFireflies: 'Fireflies rise and swirl',
    evLightTrail: 'A light-trail racer screams past',

    // Pause
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    settings: 'Settings',
    finishRun: 'Finish Run',
    mainMenu: 'Main Menu',

    // Photo
    photoTip: 'Drag to orbit · scroll or pinch to zoom',
    savePhotoBtn: 'Save Photo',
    photoExit: 'Exit (P)',

    // Run summary
    runSummary: 'Run Summary',
    shareAlt: 'Run summary card',
    share: 'Share',
    saveImage: 'Save Image',
    copyText: 'Copy Text',

    // Settings
    language: 'Language',
    volume: 'Volume',
    testSound: 'Test Sound',
    play: 'Play',
    audioNote: 'On iPhone, flip the side ring/silent switch (orange showing = silent) — silent mode mutes the game.',
    quality: 'Quality',
    qLow: 'Performance',
    qMedium: 'Balanced',
    qHigh: 'Quality',
    dayNight: 'Day/Night Cycle',
    on: 'On',
    off: 'Off',
    camDist: 'Camera Distance',
    back: 'Back',
    switchLang: 'Switch language',

    // Loading
    loading: 'Paving the road…',

    // Audio test results
    audioOk: '🔊 Sound is on',
    audioMuted: 'Muted — unmute first, then test',
    audioSuspended: 'Audio is suspended — tap again',
    audioInterrupted: 'Audio was interrupted — tap again',
    audioUnsupported: 'Web Audio isn\'t supported on this device',

    // Share/save toasts
    shared: 'Shared',
    sharedCopied: 'Image saved · stats copied',
    sharedDownloaded: 'Image saved',
    copied: 'Stats copied',
    copyFailed: 'Copy failed',
    saveFailed: 'Save failed',
    savedToDownloads: 'Saved to Downloads',

    // Share card (share.js)
    cardTitle: 'ENDLESS ROADS',
    stat: { score: 'Score', dist: 'Distance', top: 'Top Speed', nearMiss: 'Near Misses', combo: 'Best Combo', collect: 'Pickups' },
    shareTextTitle: 'Endless Roads — {theme} · {mode}',
    shareTextStats: '{km} km · {top} km/h top speed',
    shareTextCombo: '{nm} near misses · best combo ×{combo} · {collect} pickups',
    shareTextScore: 'Score {score}',
  },
};

function detect() {
  const saved = lsGet('er_lang');
  if (saved === 'zh' || saved === 'en') return saved;
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang = detect();

export function getLang() { return lang; }

export function setLang(l) {
  if (l !== 'zh' && l !== 'en') return;
  lang = l;
  lsSet('er_lang', l);
  applyDocumentMeta();
  applyStatic();
}

export function applyDocumentMeta() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
}

// 取词：支持一级 key（'resume'）和二级 key（'bar.speed'）；{xxx} 占位插值
export function t(key, params) {
  let node = DICT[lang];
  for (const seg of key.split('.')) node = node ? node[seg] : undefined;
  let s = node != null ? String(node) : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

// 数据对象取名：en 模式优先 en 字段（主题/分区/车/成就共用 name/en 双字段约定）
export function nameOf(obj) {
  if (!obj) return '';
  return (lang === 'en' && obj.en) ? obj.en : obj.name;
}

// 车描述：en 模式取 descEn
export function descOf(obj) {
  if (!obj) return '';
  return (lang === 'en' && obj.descEn) ? obj.descEn : obj.desc;
}

// 静态文案扫描：data-i18n → textContent；data-i18n-title/-aria/-alt → 对应属性
export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
}

// 行程日期（历史/战报）：按当前语言格式化；旧记录无时间戳时由调用方回退
export function fmtRunDate(ms) {
  return new Date(ms).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN',
    lang === 'en' ? { year: 'numeric', month: 'short', day: 'numeric' } : undefined);
}

applyDocumentMeta();
