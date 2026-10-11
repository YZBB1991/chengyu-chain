import "./styles/tokens.css";
import "./styles/base.css";

import type { Idiom, Mode } from "./game/types";
import { MODE_LABEL } from "./game/types";
import { loadIdioms, followCandidates, allIdioms } from "./game/idioms";
import { validatePlayerMove } from "./game/chain";
import { aiChoose } from "./game/ai";
import { buildLevel, MAX_LEVEL, type LevelConfig } from "./game/levels";
import {
  loadProgress,
  setMode,
  recordWin,
  type Progress,
} from "./game/storage";
import { buildShareText, renderResultCanvas, copyText } from "./share";
import { h, clear } from "./ui/dom";

const app = document.getElementById("app") as HTMLElement;

let dict = new Map<string, Idiom>();
let progress: Progress = loadProgress();
let session: Session | null = null;
let busy = false; // AI 思考中锁定输入

interface Session {
  level: LevelConfig;
  chain: Idiom[];
  used: Set<string>;
  status: "playing" | "won" | "lost";
  goalLength: number;
}

const ARC_COLORS = [
  "#46d8ff",
  "#19f79a",
  "#e5ed38",
  "#ff9dec",
  "#ffc650",
];

function mount(node: HTMLElement) {
  clear(app);
  app.append(node);
}

async function ensureData() {
  if (dict.size) return;
  await loadIdioms();
  for (const it of allIdioms()) dict.set(it.word, it);
}

/* ---------------- 起始页 ---------------- */
function showStart() {
  session = null;
  const mode = progress.mode;

  const tabs = h(
    "div",
    { class: "pill-tabs" },
    pillTab("homo", mode === "homo", () => {
      progress.mode = "homo";
      setMode("homo");
      showStart();
    }),
    pillTab("strict", mode === "strict", () => {
      progress.mode = "strict";
      setMode("strict");
      showStart();
    })
  );

  const screen = h(
    "div",
    { class: "screen center-col" },
    h("p", { class: "eyebrow" }, "IDIOM CHAIN · 闯关模式"),
    h(
      "h1",
      { class: "heading", style: { fontSize: "48px", marginTop: "16px" } },
      "成语",
      h("span", { class: "brush" }, "接龙")
    ),
    h(
      "p",
      { class: "subheading muted", style: { marginTop: "16px", maxWidth: "420px" } },
      "单人打 AI，逐关递增难度。严格同字 or 谐音接龙，边玩边学。"
    ),
    h(
      "div",
      { class: "row", style: { marginTop: "32px", justifyContent: "center" } },
      tabs
    ),
    h(
      "p",
      { class: "caption", style: { marginTop: "12px" } },
      "对局模式：" + MODE_LABEL[mode]
    ),
    h(
      "button",
      {
        class: "btn btn-lime btn-block",
        style: { marginTop: "40px", maxWidth: "320px" },
        onclick: async () => {
          await ensureData();
          showLevels();
        },
      },
      "开始游戏"
    ),
    h(
      "p",
      { class: "caption", style: { marginTop: "24px" } },
      "历史最高连击：" + progress.bestCombo
    )
  );
  mount(screen);
}

function pillTab(mode: Mode, active: boolean, onClick: () => void): HTMLElement {
  return h(
    "button",
    {
      class: "pill-tab" + (active ? " active" : ""),
      onclick: onClick,
    },
    MODE_LABEL[mode]
  );
}

/* ---------------- 选关页 ---------------- */
function showLevels() {
  const grid = h("div", {
    class: "stack",
    style: { marginTop: "8px", display: "grid", gap: "16px" },
  });
  (grid.style as CSSStyleDeclaration).setProperty("grid-template-columns", "1fr 1fr");
  (grid.style as CSSStyleDeclaration).setProperty("display", "grid");

  for (let i = 1; i <= MAX_LEVEL; i++) {
    const locked = i > progress.unlocked;
    const lvlMode: Mode = i <= 4 ? progress.mode : "strict";
    const arc = ARC_COLORS[(i - 1) % ARC_COLORS.length];
    const card = h(
      "div",
      {
        class: "card arc-card",
        style: { "--arc": arc } as unknown as Record<string, string>,
        onclick: locked ? undefined : () => showPlay(i),
      },
      h(
        "div",
        { class: "arc-inner stack" },
        h(
          "div",
          { class: "row spread" },
          h("span", { class: "heading-sm" }, locked ? "🔒" : String(i)),
          h("span", { class: "tag" + (lvlMode === "strict" ? " strict" : "") }, MODE_LABEL[lvlMode])
        ),
        h(
          "p",
          { class: "caption", style: { marginTop: "8px" } },
          "目标 " + (8 + (i - 1) * 2) + " 步"
        )
      )
    );
    if (locked) card.style.opacity = "0.5";
    grid.append(card);
  }

  const screen = h(
    "div",
    { class: "screen" },
    topbar("选择关卡", () => showStart()),
    grid
  );
  mount(screen);
}

function topbar(title: string, onBack: () => void): HTMLElement {
  return h(
    "div",
    { class: "topbar" },
    h("button", { class: "link", onclick: onBack }, "← 返回"),
    h("span", { class: "brand" }, title)
  );
}

/* ---------------- 对局页 ---------------- */
function showPlay(levelIndex: number) {
  const level = buildLevel(levelIndex, progress.mode);
  session = {
    level,
    chain: [level.start],
    used: new Set([level.start.word]),
    status: "playing",
    goalLength: 1 + level.targetSteps,
  };
  renderPlay();
}

function renderPlay() {
  if (!session) return;
  const s = session;
  const lvl = s.level;
  const last = s.chain[s.chain.length - 1];

  // 玩家回合但已无词可接 → 判负
  if (s.status === "playing" && !busy) {
    const cands = followCandidates(last.last, last.lastPy, lvl.mode, s.used);
    if (!cands.length) endGame("lost");
  }

  const chainCards = s.chain.map((it, idx) =>
    idiomCard(it, idx, s.chain.length - 1 === idx)
  );

  const tailHint =
    lvl.mode === "strict"
      ? "下一成语需以「" + last.last + "」开头"
      : "下一成语读音需同「" + last.lastPy + "」（谐音）";

  const input = h("input", {
    class: "input",
    type: "text",
    placeholder: "输入成语…",
    lang: "zh",
    autocomplete: "off",
    style: {
      flex: "1",
      border: "1px solid var(--color-slate-edge)",
      borderRadius: "var(--radius-navlinks)",
      padding: "14px 20px",
      fontSize: "17px",
      fontFamily: "var(--font-ibm-plex-sans)",
      color: "var(--color-carbon)",
      background: "var(--color-paper-white)",
      outline: "none",
    },
  }) as HTMLInputElement;

  const msg = h("p", { class: "caption", style: { minHeight: "18px", color: "var(--color-pewter)" } });

  const submit = h(
    "button",
    {
      class: "btn btn-lime",
      onclick: () => onPlayerSubmit(input, msg),
    },
    "提交"
  );

  const hintBtn = h(
    "button",
    {
      class: "btn btn-ghost",
      onclick: () => onHint(input, msg),
    },
    "提示"
  );

  const giveUp = h(
    "button",
    {
      class: "link",
      style: { marginLeft: "4px" },
      onclick: () => endGame("lost"),
    },
    "放弃"
  );

  const turnLabel =
    s.status !== "playing"
      ? ""
      : busy
      ? "AI 思考中…"
      : "轮到你了";

  const screen = h(
    "div",
    { class: "screen" },
    topbar("第 " + lvl.index + " 关", () => showLevels()),
    h(
      "div",
      { class: "row spread", style: { marginBottom: "8px" } },
      h("span", { class: "tag" }, MODE_LABEL[lvl.mode]),
      h(
        "span",
        { class: "caption" },
        "进度 " + (s.chain.length - 1) + " / " + lvl.targetSteps + " 步"
      )
    ),
    h("p", { class: "heading-sm", style: { marginTop: "4px" } }, turnLabel),
    h(
      "div",
      {
        class: "stack",
        style: {
          marginTop: "12px",
          overflowY: "auto",
          maxHeight: "42vh",
          paddingRight: "2px",
        },
      },
      ...chainCards
    ),
    h(
      "p",
      { class: "caption", style: { marginTop: "12px" } },
      tailHint
    ),
    h(
      "div",
      { class: "row", style: { marginTop: "8px" } },
      input,
      submit
    ),
    h(
      "div",
      { class: "row", style: { marginTop: "8px" } },
      hintBtn,
      giveUp
    ),
    msg
  );
  mount(screen);
  input.focus();
}

function idiomCard(it: Idiom, idx: number, isLast: boolean): HTMLElement {
  const who = idx === 0 ? "起始" : idx % 2 === 1 ? "你" : "AI";
  const detail = h(
    "div",
    {
      class: "card-inner hidden",
      style: { marginTop: "12px" },
    },
    h("p", { class: "caption" }, "拼音：" + it.pinyin),
    it.explanation ? h("p", { class: "body-text", style: { marginTop: "6px" } }, it.explanation) : null,
    it.derivation && it.derivation !== "无"
      ? h("p", { class: "caption", style: { marginTop: "6px" } }, "出处：" + it.derivation)
      : null
  );

  const card = h(
    "div",
    {
      class: "card",
      style: isLast ? { borderColor: "var(--color-cobalt-signal)" } : {},
      onclick: () => detail.classList.toggle("hidden"),
    },
    h(
      "div",
      { class: "row spread" },
      h(
        "span",
        {
          style: {
            fontSize: "24px",
            fontWeight: "600",
            color: "var(--color-midnight-ink)",
            letterSpacing: "2px",
          },
        },
        it.word
      ),
      h("span", { class: "tag" }, who)
    ),
    detail
  );
  return card;
}

function onPlayerSubmit(input: HTMLInputElement, msg: HTMLElement) {
  if (!session || session.status !== "playing" || busy) return;
  const s = session;
  const prev = s.chain[s.chain.length - 1];
  const res = validatePlayerMove(prev, input.value, s.used, s.level.mode, dict);
  if (!res.ok || !res.idiom) {
    msg.textContent = res.reason ?? "无效";
    return;
  }
  msg.textContent = "";
  s.chain.push(res.idiom);
  s.used.add(res.idiom.word);
  input.value = "";

  if (s.chain.length >= s.goalLength) {
    endGame("won");
    return;
  }
  // AI 回合
  busy = true;
  renderPlay();
  setTimeout(aiTurn, 750);
}

function aiTurn() {
  if (!session || session.status !== "playing") {
    busy = false;
    return;
  }
  const s = session;
  const prev = s.chain[s.chain.length - 1];
  const move = aiChoose(prev, s.level.mode, s.level.index, s.used);
  if (!move) {
    // AI 断链 → 玩家胜
    endGame("won");
    return;
  }
  s.chain.push(move);
  s.used.add(move.word);
  busy = false;
  if (s.chain.length >= s.goalLength) {
    endGame("won");
    return;
  }
  renderPlay();
}

function onHint(input: HTMLInputElement, msg: HTMLElement) {
  if (!session || session.status !== "playing" || busy) return;
  const s = session;
  const last = s.chain[s.chain.length - 1];
  const cands = followCandidates(last.last, last.lastPy, s.level.mode, s.used);
  if (!cands.length) {
    msg.textContent = "无词可接，这一局要输了 😮";
    return;
  }
  input.value = cands[0].word;
  msg.textContent = "已填入一个可接成语，确认后提交";
}

/* ---------------- 结算页 ---------------- */
function endGame(status: "won" | "lost") {
  if (!session) return;
  session.status = status;
  const combo = session.chain.length - 1;
  if (status === "won") recordWin(session.level.index, combo);
  // 刷新内存进度（recordWin 只写了 localStorage），否则回选关页会显示旧解锁状态
  progress = loadProgress();
  showResult(status, combo);
}

function showResult(status: "won" | "lost", combo: number) {
  if (!session) return;
  const lvl = session.level;
  const passed = status === "won";
  const hasNext = passed && lvl.index < MAX_LEVEL;

  const canvas = renderResultCanvas({
    level: lvl.index,
    passed,
    combo,
    mode: lvl.mode,
    best: progress.bestCombo,
  });
  const imgUrl = canvas.toDataURL("image/png");
  const img = h("img", {
    src: imgUrl,
    style: {
      width: "100%",
      maxWidth: "320px",
      borderRadius: "var(--radius-cards)",
      boxShadow: "var(--shadow-subtle)",
    },
  }) as HTMLImageElement;

  const shareText = buildShareText(lvl.index, passed, combo, lvl.mode);

  const screen = h(
    "div",
    { class: "screen" },
    topbar(passed ? "过关！" : "惜败", () => showLevels()),
    h(
      "div",
      { class: "dark-band", style: { marginTop: "8px" } },
      h(
        "div",
        { class: "amber-card stack" },
        h("p", { class: "eyebrow" }, passed ? "LEVEL CLEAR" : "GAME OVER"),
        h(
          "p",
          { style: { fontSize: "32px", fontWeight: "700", color: "var(--color-obsidian)" } },
          passed ? "第 " + lvl.index + " 关 · 闯关成功" : "第 " + lvl.index + " 关 · 惜败"
        ),
        h(
          "div",
          { class: "row", style: { gap: "24px", marginTop: "8px" } },
          stat("本局连击", String(combo)),
          stat("历史最高", String(progress.bestCombo)),
          stat("模式", MODE_LABEL[lvl.mode])
        )
      )
    ),
    h("div", { style: { display: "flex", justifyContent: "center", marginTop: "20px" } }, img),
    h(
      "div",
      { class: "stack", style: { marginTop: "16px" } },
      hasNext
        ? h(
            "button",
            {
              class: "btn btn-lime btn-block",
              onclick: () => showPlay(lvl.index + 1),
            },
            "下一关"
          )
        : null,
      h(
        "button",
        { class: "btn btn-ghost btn-block", onclick: () => showPlay(lvl.index) },
        "重玩本关"
      ),
      h("button", { class: "btn btn-ghost btn-block", onclick: () => showLevels() }, "选择关卡"),
      h(
        "button",
        {
          class: "btn btn-ghost btn-block",
          onclick: async () => {
            const ok = await copyText(shareText);
            alert(ok ? "战绩文案已复制，去粘贴分享吧！" : "复制失败，请手动截图分享。");
          },
        },
        "复制战绩文案"
      ),
      h(
        "a",
        {
          class: "btn btn-ghost btn-block",
          href: imgUrl,
          download: "chengyu-result.png",
        },
        "保存战绩图"
      )
    )
  );
  mount(screen);
}

function stat(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "stack", style: { gap: "2px" } },
    h("span", { class: "caption" }, label),
    h("span", { style: { fontSize: "20px", fontWeight: "700", color: "var(--color-obsidian)" } }, value)
  );
}

showStart();
