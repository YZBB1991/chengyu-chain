import {
  loadIdioms,
  allIdioms,
  followCandidates,
  getHubs,
} from "../src/game/idioms.ts";
import { canChain, validatePlayerMove } from "../src/game/chain.ts";
import { aiChoose } from "../src/game/ai.ts";
import { buildLevel, MAX_LEVEL } from "../src/game/levels.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  -", msg);
}

await loadIdioms();
const pool = allIdioms();
const dict = new Map(pool.map((x) => [x.word, x]));

// 1. 词库规模
assert(pool.length > 6000, `词库规模 ${pool.length} >= 6000`);

// 2. 字段完整
const s = pool[0];
assert(
  s.word && s.pinyin && s.firstPy && s.lastPy,
  `字段完整: ${s.word}/${s.pinyin} first=${s.firstPy} last=${s.lastPy}`
);

// 3. followCandidates 严格模式：返回项都满足 canChain 且首字=尾字
let checkedStrict = 0;
for (const w of pool.slice(0, 600)) {
  const cands = followCandidates(w.last, w.lastPy, "strict", new Set());
  for (const c of cands) {
    assert(canChain(w, c, "strict"), `strict cand ${w.word}->${c.word}`);
    assert(c.first === w.last, `strict cand 首字=尾字 ${w.word}->${c.word}`);
    checkedStrict++;
  }
}
assert(checkedStrict > 0, `严格候选命中 ${checkedStrict} 次`);

// 4. followCandidates 谐音模式：返回项首音=尾音
let checkedHomo = 0;
for (const w of pool.slice(0, 600)) {
  const cands = followCandidates(w.last, w.lastPy, "homo", new Set());
  for (const c of cands) {
    assert(canChain(w, c, "homo"), `homo cand ${w.word}->${c.word}`);
    assert(c.firstPy === w.lastPy, `homo cand 首音=尾音 ${w.lastPy}`);
    checkedHomo++;
  }
}
assert(checkedHomo > 0, `谐音候选命中 ${checkedHomo} 次`);

// 5. 死局率抽样
let strictDead = 0,
  homoDead = 0,
  N = 500;
for (let i = 0; i < N; i++) {
  const w = pool[Math.floor(Math.random() * pool.length)];
  if (followCandidates(w.last, w.lastPy, "strict", new Set()).length === 0)
    strictDead++;
  if (followCandidates(w.last, w.lastPy, "homo", new Set()).length === 0)
    homoDead++;
}
console.log(
  `  抽样${N}条死局率: 严格=${((strictDead / N) * 100).toFixed(
    1
  )}% 谐音=${((homoDead / N) * 100).toFixed(1)}%`
);
assert(homoDead / N < 0.15, "谐音死局率 < 15%");

// 6. AI 出词合法
const w = pool[1000];
const ai = aiChoose(w, "homo", 3, new Set());
assert(ai && canChain(w, ai, "homo"), `AI 出词合法: ${w.word} -> ${ai.word}`);
const aiStrict = aiChoose(w, "strict", 5, new Set());
assert(
  aiStrict === null ||
    canChain(w, aiStrict, "strict") ||
    followCandidates(w.last, w.lastPy, "strict", new Set()).length === 0,
  "AI 严格模式返回合法或 null"
);

// 7. 玩家输入校验
const prev = pool[2000];
const good = followCandidates(prev.last, prev.lastPy, "homo", new Set())[0];
const v1 = validatePlayerMove(prev, good.word, new Set(), "homo", dict);
assert(v1.ok, `合法输入通过: ${good.word}`);
const v2 = validatePlayerMove(prev, "这不是成语", new Set(), "homo", dict);
assert(!v2.ok && v2.reason, "非法输入被拒: " + v2.reason);
const v3 = validatePlayerMove(prev, prev.word, new Set(), "homo", dict);
assert(!v3.ok, "空/重复输入被拒");

// 8. 关卡生成
assert(MAX_LEVEL >= 30, `MAX_LEVEL=${MAX_LEVEL}`);
let prevSteps = 0;
for (let i = 1; i <= MAX_LEVEL; i++) {
  const lv = buildLevel(i, "homo");
  assert(lv.start && dict.has(lv.start.word), `第${i}关起始成语在词库内`);
  assert(lv.targetSteps >= prevSteps, `第${i}关目标步数递增 ${lv.targetSteps}`);
  prevSteps = lv.targetSteps;
  // 前4关用玩家模式，之后强制严格
  if (i <= 4) assert(lv.mode === "homo", `第${i}关用玩家模式`);
  else assert(lv.mode === "strict", `第${i}关强制严格`);
}

// 9. 枢纽词可解性（保证首关能开局）
const hubs = getHubs();
assert(hubs.length > 0, `枢纽词 ${hubs.length} 条`);

console.log("\nALL SMOKE TESTS PASSED");
