export interface Idiom {
  word: string;
  pinyin: string;
  first: string;
  last: string;
  firstPy: string;
  lastPy: string;
  explanation: string;
  derivation: string;
}

export type Mode = "strict" | "homo";

export const MODE_LABEL: Record<Mode, string> = {
  strict: "严格同字",
  homo: "谐音接龙",
};
