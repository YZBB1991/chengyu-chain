import type { Idiom, Mode } from "./types";
import { followCandidates, getHubs } from "./idioms";

export interface LevelConfig {
  index: number;
  targetSteps: number;
  mode: Mode;
  start: Idiom;
}

export const MAX_LEVEL = 30;

// 难度曲线：前 4 关用玩家所选模式；第 5 关起强制「严格同字」，
// 即「严格模式占比随关卡递增」。
function levelMode(index: number, playerMode: Mode): Mode {
  return index <= 4 ? playerMode : "strict";
}

function simulateSolvable(start: Idiom, mode: Mode, steps: number): boolean {
  let cur = start;
  const used = new Set([start.word]);
  for (let i = 0; i < steps; i++) {
    const c = followCandidates(cur.last, cur.lastPy, mode, used);
    if (!c.length) return false;
    cur = c[Math.floor(Math.random() * c.length)];
    used.add(cur.word);
  }
  return true;
}

/** 构建一关：目标步数递增；随机选一个枢纽成语作起始词，并保证存在可解链。 */
export function buildLevel(index: number, playerMode: Mode): LevelConfig {
  const mode = levelMode(index, playerMode);
  const targetSteps = 8 + (index - 1) * 2; // 8, 10, 12, ...
  return { index, targetSteps, mode, start: pickStart(mode, targetSteps) };
}

function pickStart(mode: Mode, targetSteps: number): Idiom {
  const hubs = getHubs();
  const top = hubs.slice(0, 240);
  // Fisher–Yates 打乱，逐个验证可解性
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  for (const s of top) {
    if (simulateSolvable(s, mode, targetSteps)) return s;
  }
  return hubs[0];
}
