# 无尽公路 中英文双语改造计划

## 设计原则

英文文案不逐字翻译，而是按"英文母语开发者的原生写法"重写：用游戏圈原生术语（Free Roam / Time Attack / Daily Run、Performance/Balanced/Quality）、原生 UI 惯用语（Resume / Main Menu / Back）、保持原作的诗意语感（"No finish line — just the horizon"）。语言偏好存 `localStorage.er_lang`，首次访问跟随 `navigator.language` 自动检测。

技术方案：零构建项目，手写一个轻量 `js/i18n.js`（两份扁平词典 + `t(key, params)` 插值 + `applyStatic()` 静态文案扫描），不引入任何依赖。数据文件沿用已有的 `name`/`en` 双字段模式。

## 一、英文文案总表（核心交付物）

### 主菜单
| 位置 | 中文 | 英文 |
|---|---|---|
| 标题 h1 | 无尽公路 | Endless Roads（CSS 大写 + 适度字距） |
| 副标题 | Endless Roads · 开往地平线，不设终点 | No finish line — just the horizon |
| 主题按钮 | 黄昏旷野 等 + 英文副标题 | 只显示英文名（Golden Dusk 等，隐藏副标题行） |
| 自由驾驶 | 自由驾驶 | Free Roam |
| 每日挑战 | 每日挑战 · 全球同一条路 | Daily Run · one road for everyone |
| 今日最佳 | 今日最佳 X 分 · Y km | Best today · X pts · Y km |
| 今日空 | 今日尚无记录，来跑一趟？ | No runs yet today |
| 限时挑战 | 限时挑战 · 光门续时 | Time Attack · gates add time |
| 限时副行 | 初始 60 秒，穿过光门加时，看你能跑多远 | Start with 60 seconds — gates add time. How far can you go? |
| 最近行程 | 最近行程 | Recent Runs |
| 行程汇总 | 共 X 次 · 最新 Y 分 | X runs · latest Y pts |
| 行程空 | 还没有记录，来跑一趟 | No runs yet |
| 成就 | 🏆 里程碑成就 n/total | 🏆 Milestones n / total |
| 键盘提示 | A/D 转向 · W/S 调速 · … | A/D steer · W/S speed · Shift/Space nitro · P photo · M mute |
| 触屏提示 | 手机：左右按钮转向，… | Touch: side arrows steer · + / − set speed · NOS for nitro |

### 车库
| 位置 | 中文 | 英文 |
|---|---|---|
| 性能条标签 | 极速/操控/越野/氮气 | Speed / Handling / Off-road / Nitro（bars 的 key 改为 ASCII） |
| 车名 | 灵动掀背 等 | 用已有 en 字段（Zippy Hatch 等），英文模式隐藏副标题行 |
| 车描述 | 轻盈灵活，转向响应最快 | Light and nimble, with the quickest steering |
| | 越野更从容，收集氮气 +35% | Sure-footed off-road · +35% nitro from pickups |
| | 极限速度与氮气都更强 | A higher top speed and a stronger nitro |
| 解锁提示 | 🔒 单局得分达 X 解锁 | 🔒 Unlocks at X pts |
| 页码 | X / Y · 生涯最高 Z | X / Y · career best Z |
| 选用按钮 | 当前座驾/选用/未解锁 | Selected / Select / Locked |

### HUD 与驾驶中
| 位置 | 中文 | 英文 |
|---|---|---|
| 标签 | 里程/得分/连击 | DIST / SCORE / COMBO |
| 图标 title | 拍照模式 (P) 等 | Photo mode (P) / Pause (Esc) / Mute (M) |
| 触屏按钮 | 加速/减速 | ＋ / −（aria: Speed up / Slow down） |
| 险过弹字 | 险过 +X / 对向险过 +X / 碰撞 | Near Miss +X / Oncoming +X / Crash |
| 光门 | 光门 +Xs | Gate +Xs |
| 模式标签 | 每日挑战/计时赛/自由驾驶 | Daily Run / Time Attack / Free Roam |
| 分区 | 进入 · 麦浪旷野 | Now entering Wheat Fields |
| 声音解锁 | 🔇 点按屏幕任意处开启声音 | 🔇 Tap anywhere to turn on sound |
| 成就 toast | 🏆 成就 · X　+Y 分 | 🏆 Milestone — X +Y |

### 分区名（zones.js 加 en 字段）
麦浪旷野 Wheat Fields · 风车丘陵 Windmill Hills · 疏林河谷 Wooded Valley · 红岩台地 Red Rock Mesa · 霓虹峡谷 Neon Canyon · 工业环线 Industrial Loop · 电光旷野 Electric Plains · 雪松林海 Snow Pine Forest · 冰原旷野 Frozen Tundra · 雾凇山隘 Hoarfrost Pass · 竹溪幽谷 Bamboo Glen · 古塔乡野 Pagoda Fields · 群峰深处 The High Peaks

### 成就名（milestones.js 加 en 字段）
初次险过 First Near Miss · 连击 ×5/10/20 Combo ×5/10/20 · 单程 10/25/50 km → 10/25/50 km Run · 收集 50 枚 50 Pickups · 5 分钟零碰撞 Five Clean Minutes · 极速 260 km/h 260 km/h · 对向险过 10 次 Playing Chicken · 单局 10,000 分 10,000 Points

### 环境事件 toast（events.js）
一行白鹭上青天 → A line of egrets climbs into the sky · 一群飞鸟掠过天际 → A flock of birds sweeps past · 热气球缓缓飘过 → A hot air balloon drifts by · 流星划过天际 → A meteor streaks overhead · 不明飞行物出没 → A UFO has been spotted · 极光骤然爆发 → The aurora flares up · 萤火虫群起舞 → Fireflies rise and swirl · 对向光轨呼啸而过 → A light-trail racer screams past

### 暂停 / 拍照 / 战报
| 中文 | 英文 |
|---|---|
| 已暂停 / 继续驾驶 / 重新开始 / 设置 / 结束旅程 · 生成战报 / 回主菜单 | Paused / Resume / Restart / Settings / Finish Run / Main Menu |
| 拖动旋转 · 滚轮/双指缩放 / 保存照片 / 退出 (P) | Drag to orbit · scroll or pinch to zoom / Save Photo / Exit (P) |
| 旅程战报 / 分享 / 保存图片 / 复制战报 | Run Summary / Share / Save Image / Copy Text |

### 设置面板
| 中文 | 英文 |
|---|---|
| 设置 / 返回 | Settings / Back |
| 语言（新行，选项固定为 中文 / English） | Language |
| 音量 / 测试声音 / 播放 | Volume / Test Sound / Play |
| iPhone 静音提示 | On iPhone, flip the side ring/silent switch (orange showing = silent) — silent mode mutes the game. |
| 画质：流畅/均衡/精美 | Quality: Performance / Balanced / Quality |
| 昼夜流转 开/关 | Day/Night Cycle · On / Off |
| 相机距离 | Camera Distance |
| 正在铺路… | Paving the road… |

### 各类 toast 与分享
音频测试：声音正常 Sound is on · 静音 Muted — unmute first, then test · 挂起 Audio is suspended — tap again · 中断 Audio was interrupted — tap again · 不支持 Web Audio isn't supported on this device。
分享：已分享 Shared · 已保存图片并复制战报 Image saved · stats copied · 已保存图片 Image saved · 战报已复制 Stats copied · 复制失败 Copy failed · 保存失败 Save failed · 已保存到下载 Saved to Downloads。
日期：每日标签 `2026 年 9 月 20 日` / `Sep 20, 2026`（UTC）；战报日期用 zh-CN / en-US locale。
页面 title：无尽公路 Endless Roads / Endless Roads。

### 战报卡片（share.js canvas + 纯文本）
- 标题：`无 尽 公 路` / `ENDLESS ROADS`
- 统计标签：得分/里程/极速/险过/最高连击/收集 → Score / Distance / Top Speed / Near Misses / Best Combo / Pickups（26px 左对齐，最长 "Near Misses" 在 333px 列宽内无碰撞，坐标不用改）
- shareText 英文版：
  ```
  Endless Roads — Golden Dusk · Daily Run
  Sep 20, 2026
  3.2 km · 245 km/h top speed
  14 near misses · best combo ×8 · 23 pickups
  Score 12,345
  ```

## 二、新增 js/i18n.js

- 两份扁平词典 `DICT.zh` / `DICT.en`（上表全部文案，`{name}` 形式插值）
- `detect()`：`er_lang` → `navigator.language` 以 zh 开头则 zh 否则 en
- `t(key, params)`、`getLang()`、`setLang(l)`（写 `er_lang`、更新 `html[lang]` 与 `document.title`、`applyStatic()`）
- `nameOf(obj)`（en 模式取 `obj.en` 否则 `obj.name`）、`descOf(obj)`（`descEn`/`desc`）
- `applyStatic()`：扫描 `[data-i18n]`（textContent）、`[data-i18n-title]`、`[data-i18n-aria]`、`[data-i18n-alt]`
- `fmtRunDate(ms)`：按语言 `toLocaleDateString`
- 模块顶层即执行 detect 并设置 `html[lang]`/title（i18n.js 不 import 任何项目模块，无循环依赖）

## 三、各文件改动

1. **index.html**：`<head>` 加 5 行内联脚本（首帧前按 `er_lang`/navigator 设置 `html[lang]`，避免英文用户看到中文加载页闪烁）；`#loading` 改双语双 span + CSS 按 `:lang` 切换（加载页在模块加载完成前就要正确显示）；所有静态文案节点加 `data-i18n` 属性（含 title/aria/alt）；键盘提示按 `<br>` 拆成两个 span；设置面板顶部加语言行（seg 控件：中文 | English）；主菜单 footer（设置/静音旁）加 `#btnLang` 快捷切换图标（zh 模式显示 "EN"，en 模式显示 "中"）。
2. **js/main.js**：UI 类与 renderGarageUI 的所有内联中文换 `t()`；`setTags` 用 `nameOf` + 模式词典；分区 toast、音频测试、分享结果、存照片 toast 换 `t()`；`endRun` 改存语言无关数据（`t: Date.now(), themeKey, carKey` 替代渲染好的中文字符串，modeLabel/dateLabel 改为当场按语言生成）；`renderHistory` 按 key 查 THEMES/CARS 取名，查不到回退显示旧存储值（兼容旧记录）；绑定 `#setLangSeg` 与 `#btnLang`：切换后 `setLang` + 重跑 `refreshMenu/setAch/renderHistory/renderGarage/syncSettings`，若在暂停/驾驶中再刷新 HUD 标签；构造函数里填充主题卡 `.tc-name`（来自 THEMES，避免词典重复）。
3. **js/share.js**：标题、统计标签、shareText 全部走词典；英文字体沿用现有栈。
4. **js/zones.js / js/milestones.js / js/events.js**：加 `en` 字段 / toast 换 `t()`（分区名在 `pollEnter` 返回处用 `nameOf`）。
5. **js/garage.js**：`bars` 中文 key 改为 `speed/handling/offroad/nitro`（消费点仅 main.js 一处）；加 `descEn`。
6. **js/rng.js**：`dailyLabel` 按语言格式化（UTC 时间用 `toLocaleDateString(lang, {timeZone:'UTC'})`）。
7. **css/style.css**：
   - `.i18n-en/.i18n-zh` 显隐规则（加载页）
   - `html[lang=en] .menu-card h1 { text-transform:uppercase; letter-spacing:5px }`（三个断点分别调整，中文 11/8/6px 不动）
   - `html[lang=en]` 下隐藏 `.tc-en`、`.car-en`（英文模式主名已是英文，副标题冗余）
   - `html[lang=en] .bar-row span { width:62px }`（容下 "Off-road"，中文 26px 不动）

## 四、验证

启动本地静态服务器，按记忆中的测试流程（DOM 按钮可直接点，画布交互用坐标点击/派发事件）逐项截图检查：
1. 英文浏览器环境首次访问 → 全英文；刷新后 `er_lang` 生效
2. 设置面板与主菜单快捷按钮切换 → 菜单/车库/设置/历史即时变中文，无残留
3. 英文跑一局：HUD、险过弹字、分区 toast、暂停、结算 → 战报卡片 canvas 英文排版无重叠、复制文本格式正确
4. 历史记录：新记录存 key 后中英文均正确显示；旧版中文记录仍能显示
5. 移动端视口：触屏 ＋/− 按钮、车库性能条标签不溢出、h1 字距正常
