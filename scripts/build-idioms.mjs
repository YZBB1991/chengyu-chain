// 从开源成语数据集构建游戏内置词库（核心连通度子集）。
// 数据源：pwxcoo/chinese-xinhua idiom.json（已下载到项目根 idiom_raw.json）
// 输出：src/data/idioms.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SRC = path.join(root, "idiom_raw.json");
const OUT = path.join(root, "src", "data", "idioms.json");

const TARGET = 7000; // 计划：5000–8000 高频子集

// 去声调：把 ā->a, ǘ->v ...
const TONE = {
  ā: "a", á: "a", ǎ: "a", à: "a",
  ē: "e", é: "e", ě: "e", è: "e",
  ī: "i", í: "i", ǐ: "i", ì: "i",
  ō: "o", ó: "o", ǒ: "o", ò: "o",
  ū: "u", ú: "u", ǔ: "u", ù: "u",
  ǖ: "v", ǘ: "v", ǚ: "v", ǜ: "v", ü: "v",
  ń: "n", ň: "n", ǹ: "n",
};
function toneless(s) {
  return s
    .split("")
    .map((c) => TONE[c] ?? c)
    .join("");
}
function pySyllables(pinyin) {
  return pinyin
    .toLowerCase()
    .split(/\s+/)
    .map(toneless)
    .filter(Boolean);
}

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const isHan = (c) => /[一-鿿]/.test(c);
const four = raw.filter(
  (d) => typeof d.word === "string" && d.word.length === 4 && [...d.word].every(isHan)
);

// 解析每条成语
const list = four.map((d) => {
  const chars = [...d.word];
  const syl = pySyllables(d.pinyin || "");
  return {
    word: d.word,
    pinyin: d.pinyin || "",
    first: chars[0],
    last: chars[3],
    firstPy: syl[0] || "",
    lastPy: syl[syl.length - 1] || "",
    explanation: (d.explanation || "").trim(),
    derivation: (d.derivation || "").trim(),
  };
});

// 连通度：能被多少成语接（首字=本尾字 或 首拼=本尾拼）+ 本成语能接多少（尾字/尾拼被多少首字/首拼匹配）
const headChar = new Map(); // 首字 -> 计数
const headPy = new Map(); // 首拼 -> 计数
for (const it of list) {
  headChar.set(it.first, (headChar.get(it.first) || 0) + 1);
  if (it.firstPy) headPy.set(it.firstPy, (headPy.get(it.firstPy) || 0) + 1);
}
for (const it of list) {
  const canBeFollowed =
    (headChar.get(it.last) || 0) + (it.lastPy ? headPy.get(it.lastPy) || 0 : 0);
  const canFollow =
    (headChar.get(it.first) || 0) + (it.firstPy ? headPy.get(it.firstPy) || 0 : 0);
  it._score = canBeFollowed + canFollow;
}

list.sort((a, b) => b._score - a._score);
const top = list.slice(0, TARGET).map(({ _score, ...rest }) => rest);

// 去重（理论上唯一，保险）
const seen = new Set();
const final = top.filter((it) => {
  if (seen.has(it.word)) return false;
  seen.add(it.word);
  return true;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(final, null, 0));

console.log("raw four-char:", list.length);
console.log("kept (top connectivity):", final.length);
console.log("sample:", JSON.stringify(final.slice(0, 3), null, 0));

// 快速校验：核心子集内部严格/谐音死局比例
const hc = new Map();
const hp = new Map();
for (const it of final) {
  hc.set(it.first, (hc.get(it.first) || 0) + 1);
  if (it.firstPy) hp.set(it.firstPy, (hp.get(it.firstPy) || 0) + 1);
}
let strictDead = 0;
let homoDead = 0;
for (const it of final) {
  if (!((hc.get(it.last) || 0) > 0)) strictDead++;
  if (!(it.lastPy && (hp.get(it.lastPy) || 0) > 0)) homoDead++;
}
console.log(
  "strict dead-ends in subset:",
  strictDead,
  "(" + ((strictDead / final.length) * 100).toFixed(1) + "%)"
);
console.log(
  "homo dead-ends in subset:",
  homoDead,
  "(" + ((homoDead / final.length) * 100).toFixed(1) + "%)"
);
console.log("output bytes:", fs.statSync(OUT).size);
