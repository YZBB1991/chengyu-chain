import type { Idiom, Mode } from "./types";

let cache: Idiom[] | null = null;
let byFirstChar: Map<string, Idiom[]> | null = null;
let byFirstPy: Map<string, Idiom[]> | null = null;
let hubs: Idiom[] | null = null;

function pushMap(m: Map<string, Idiom[]>, k: string, v: Idiom) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

export async function loadIdioms(): Promise<Idiom[]> {
  if (cache) return cache;
  const mod = (await import("../data/idioms.json")) as { default: Idiom[] };
  cache = mod.default;
  byFirstChar = new Map();
  byFirstPy = new Map();
  for (const it of cache) {
    pushMap(byFirstChar, it.first, it);
    if (it.firstPy) pushMap(byFirstPy, it.firstPy, it);
  }
  return cache;
}

/** 能接在 prev 之后的合法成语（排除已用），按模式匹配。 */
export function followCandidates(
  tailChar: string,
  tailPy: string,
  mode: Mode,
  used: Set<string>
): Idiom[] {
  const pool =
    mode === "strict"
      ? byFirstChar!.get(tailChar) ?? []
      : byFirstPy!.get(tailPy) ?? [];
  return pool.filter((it) => !used.has(it.word));
}

/** 枢纽成语（尾字可接的成语越多分越高），用于选关卡起始词。 */
export function getHubs(): Idiom[] {
  if (hubs) return hubs;
  hubs = [...(cache as Idiom[])].sort((a, b) => hubScore(b) - hubScore(a));
  return hubs;
}

function hubScore(it: Idiom): number {
  const strict = byFirstChar!.get(it.last)?.length ?? 0;
  const homo = it.lastPy ? byFirstPy!.get(it.lastPy)?.length ?? 0 : 0;
  return strict + homo;
}

export function allIdioms(): Idiom[] {
  return cache as Idiom[];
}
