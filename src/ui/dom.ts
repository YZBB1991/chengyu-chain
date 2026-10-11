type Attrs = Record<string, unknown>;
type Child = Node | string | null | undefined | false;

/** 极简 hyperscript：创建元素并挂属性/子节点。 */
export function h(
  tag: string,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
        if (sk.startsWith("--")) el.style.setProperty(sk, sv);
        else (el.style as unknown as Record<string, string>)[sk] = sv;
      }
    }
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  el.replaceChildren();
}
