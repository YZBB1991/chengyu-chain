import type { Mode } from "./game/types";
import { MODE_LABEL } from "./game/types";

export function buildShareText(
  level: number,
  passed: boolean,
  combo: number,
  mode: Mode
): string {
  const head = passed ? "🎉 成语接龙 · 闯关成功！" : "😮 成语接龙 · 惜败";
  return [
    head,
    `第 ${level} 关 · ${MODE_LABEL[mode]}`,
    `本局连击：${combo}`,
    "—— 纯前端 H5 小游戏，单人打 AI，边玩边学。",
  ].join("\n");
}

export interface ResultImageOpts {
  level: number;
  passed: boolean;
  combo: number;
  mode: Mode;
  best: number;
}

/** 生成可分享的战绩图（canvas），严格套用 DESIGN.md 配色。 */
export function renderResultCanvas(o: ResultImageOpts): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // 纸白底 + 淡蓝网格
  ctx.fillStyle = "#fcfcfd";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(235,238,247,0.7)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 标题
  ctx.fillStyle = "#0a0d16";
  ctx.textAlign = "center";
  ctx.font = "700 84px 'IBM Plex Sans', sans-serif";
  ctx.fillText("成语接龙 · 闯关", W / 2, 180);

  // 结果大字
  ctx.font = "700 140px 'IBM Plex Sans', sans-serif";
  ctx.fillText(o.passed ? "过关！" : "惜败", W / 2, 360);

  // 渐变笔触
  const grad = ctx.createLinearGradient(W / 2 - 160, 0, W / 2 + 160, 0);
  grad.addColorStop(0, "#46d8ff");
  grad.addColorStop(0.4, "#19f79a");
  grad.addColorStop(0.7, "#e5ed38");
  grad.addColorStop(1, "#ff9dec");
  ctx.fillStyle = grad;
  ctx.fillRect(W / 2 - 160, 390, 320, 10);

  // 信息卡片
  const cardX = 120;
  const cardY = 470;
  const cardW = W - 240;
  const cardH = 620;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#d5d9e8";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#151720";
  ctx.textAlign = "left";
  ctx.font = "500 44px 'IBM Plex Sans', sans-serif";
  const lines = [
    `关卡      第 ${o.level} 关`,
    `模式      ${MODE_LABEL[o.mode]}`,
    `本局连击  ${o.combo}`,
    `历史最高  ${o.best}`,
  ];
  lines.forEach((t, i) => ctx.fillText(t, cardX + 60, cardY + 130 + i * 110));

  // lime 标签
  ctx.fillStyle = "#bfff5a";
  roundRect(ctx, cardX + 60, cardY + cardH - 110, 360, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#0a0d16";
  ctx.textAlign = "center";
  ctx.font = "600 34px 'IBM Plex Sans', sans-serif";
  ctx.fillText("单人打 AI", cardX + 60 + 180, cardY + cardH - 110 + 46);

  // 页脚
  ctx.fillStyle = "#6b6d72";
  ctx.textAlign = "center";
  ctx.font = "500 30px 'IBM Plex Mono', monospace";
  ctx.fillText("IDIOM CHAIN · 边玩边学", W / 2, H - 70);

  return c;
}

export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
