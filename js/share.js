// 分享卡片合成（Canvas2D）+ Web Share / 下载 / 剪贴板
export function buildShareCard({ screenshot, themeName, dateLabel, modeLabel, stats, accent, bgColors }) {
  const W = 1080, H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');

  // 背景渐变
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, bgColors[0]);
  grad.addColorStop(1, bgColors[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // 截图（cover 裁剪，圆角 + 底部渐隐）
  if (screenshot) {
    const img = typeof screenshot === 'string' ? toImage(screenshot) : screenshot;
    if (img && img.width) {
      const boxX = 60, boxY = 60, boxW = W - 120, boxH = 760;
      g.save();
      roundRect(g, boxX, boxY, boxW, boxH, 36);
      g.clip();
      const scale = Math.max(boxW / img.width, boxH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      g.drawImage(img, boxX + (boxW - dw) / 2, boxY + (boxH - dh) / 2, dw, dh);
      // 底部渐隐到卡片底色
      const fade = g.createLinearGradient(0, boxY + boxH - 220, 0, boxY + boxH);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(10,10,20,0.55)');
      g.fillStyle = fade;
      g.fillRect(boxX, boxY, boxW, boxH);
      g.restore();
    }
  }

  // 标题
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = '600 64px "PingFang SC", "Microsoft YaHei", sans-serif';
  g.fillText('无 尽 公 路', W / 2, 950);
  g.font = '400 34px "PingFang SC", sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.fillText(`${themeName} · ${modeLabel}`, W / 2, 1002);
  g.fillText(dateLabel, W / 2, 1048);

  // 数据卡：纯排版（标签 + 数值 + 主题色条）
  const items = [
    ['得分', fmt(stats.score)],
    ['里程', stats.distKm + ' km'],
    ['极速', stats.topKmh + ' km/h'],
    ['险过', '×' + stats.nearMisses],
    ['最高连击', '×' + stats.maxCombo],
    ['收集', '×' + stats.collects],
  ];
  const colW = (W - 120 - 40) / 3, rowH = 118;
  items.forEach((it, i) => {
    const cx = 60 + (i % 3) * (colW + 20);
    const cy = 1090 + Math.floor(i / 3) * (rowH + 18);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(g, cx, cy, colW, rowH, 20);
    g.fill();
    g.fillStyle = accent;
    g.fillRect(cx + 24, cy + 30, 36, 5);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '400 26px sans-serif';
    g.textAlign = 'left';
    g.fillText(it[0], cx + 24, cy + 72);
    g.fillStyle = '#ffffff';
    g.font = '700 44px "SF Pro Display", "PingFang SC", sans-serif';
    g.fillText(String(it[1]), cx + 24, cy + 102);
  });

  // 页脚
  g.textAlign = 'center';
  g.font = '400 28px sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillText('ENDLESS ROADS', W / 2, 1394);

  return canvas;
}

export function shareText({ themeName, dateLabel, modeLabel, stats }) {
  return [
    `【无尽公路】${themeName} · ${modeLabel}`,
    `${dateLabel}`,
    `里程 ${stats.distKm} km · 极速 ${stats.topKmh} km/h`,
    `险过 ×${stats.nearMisses} · 最高连击 ×${stats.maxCombo} · 收集 ×${stats.collects}`,
    `得分 ${fmt(stats.score)}`,
  ].join('\n');
}

export async function shareCard(canvas, text) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = blob ? new File([blob], 'endless-roads.png', { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'aborted';
    }
  }
  // 降级：下载图片 + 复制文本
  downloadCanvas(canvas, 'endless-roads.png');
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'downloaded'; }
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function toImage(src) {
  // 同步占位：由调用方先经 preloadImage 转换
  return null;
}

export function preloadImage(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}
