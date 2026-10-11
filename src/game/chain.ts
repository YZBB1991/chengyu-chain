import type { Idiom, Mode } from "./types";

/** 严格：尾字=首字（同字）；谐音：尾字拼音≈首字拼音（同音/近音，去声调）。 */
export function canChain(prev: Idiom, next: Idiom, mode: Mode): boolean {
  if (mode === "strict") return prev.last === next.first;
  return !!prev.lastPy && prev.lastPy === next.firstPy;
}

/** 玩家输入校验：在词库内、未用过、且能接上。 */
export function validatePlayerMove(
  prev: Idiom,
  input: string,
  used: Set<string>,
  mode: Mode,
  dict: Map<string, Idiom>
): { ok: boolean; idiom?: Idiom; reason?: string } {
  const word = input.trim();
  if (!word) return { ok: false, reason: "请输入一个成语" };
  const idiom = dict.get(word);
  if (!idiom) return { ok: false, reason: "词库里没有这个成语" };
  if (used.has(word)) return { ok: false, reason: "这个成语已经用过了" };
  if (!canChain(prev, idiom, mode)) {
    return {
      ok: false,
      reason:
        mode === "strict"
          ? `需要以「${prev.last}」开头`
          : `需要读音同「${prev.lastPy}」开头（谐音）`,
    };
  }
  return { ok: true, idiom };
}
