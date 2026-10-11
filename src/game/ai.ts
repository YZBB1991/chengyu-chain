import type { Idiom, Mode } from "./types";
import { followCandidates } from "./idioms";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * AI 出词策略：
 * - 若存在「落子后对方无词可接」的制胜手，按残忍度概率直接取胜；
 * - 否则优先选「尾字更难接」的成语刁难玩家，但保留随机性；
 * - 关卡越高，AI 越狠（更爱制胜手、更偏好死胡同尾字）。
 */
export function aiChoose(
  prev: Idiom,
  mode: Mode,
  level: number,
  used: Set<string>
): Idiom | null {
  const valid = followCandidates(prev.last, prev.lastPy, mode, used);
  if (!valid.length) return null;

  const scored = valid.map((c) => {
    const followers = followCandidates(
      c.last,
      c.lastPy,
      mode,
      new Set([...used, c.word])
    );
    return { c, d: followers.length };
  });

  const winners = scored.filter((s) => s.d === 0);
  const ruthlessness = Math.min(0.85, 0.25 + level * 0.1);
  if (winners.length && Math.random() < ruthlessness) return pick(winners).c;

  scored.sort((a, b) => a.d - b.d);
  const topN = Math.max(1, Math.ceil(scored.length / 3));
  return pick(scored.slice(0, topN)).c;
}
