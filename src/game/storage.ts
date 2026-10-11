import type { Mode } from "./types";

const KEY = "chengyu-chain-v1";

export interface Progress {
  unlocked: number; // 已解锁的最高关
  bestCombo: number; // 历史最高连击
  mode: Mode; // 模式偏好
}

function defaults(): Progress {
  return { unlocked: 1, bestCombo: 0, mode: "homo" };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

export function recordWin(level: number, combo: number): void {
  const p = loadProgress();
  p.unlocked = Math.max(p.unlocked, level + 1);
  p.bestCombo = Math.max(p.bestCombo, combo);
  saveProgress(p);
}

export function setMode(m: Mode): void {
  const p = loadProgress();
  p.mode = m;
  saveProgress(p);
}
