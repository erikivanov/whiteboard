import type { BoardNode } from "./document";
type TextLayout = { fontSize: number; lineHeight: number; padding: number; lines: string[]; contentWidth: number };
let measureContext: CanvasRenderingContext2D | null = null;
const layoutCache = new WeakMap<BoardNode, { key: string; layout: TextLayout }>();

function wrapText(text: string, width: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\t/g, "    ").split("\n")) {
    let line = "";
    for (const token of paragraph.match(/\S+|[ ]+/gu) ?? []) {
      if (/^[ ]+$/.test(token)) {
        if (measure(line + token) <= width) line += token;
        else { lines.push(line.trimEnd()); line = ""; }
        continue;
      }
      if (line && measure(line + token) > width) { lines.push(line.trimEnd()); line = ""; }
      if (measure(token) <= width) { line += token; continue; }
      for (const char of Array.from(token)) {
        if (line && measure(line + char) > width) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** One measured layout for both the Canvas text and its editing field. */
export function nodeTextLayout(n: BoardNode): TextLayout {
  const key = JSON.stringify([n.kind, n.w, n.h, n.text, n.fontSize, n.bold, n.italic]);
  const cached = layoutCache.get(n);
  if (cached?.key === key) return cached.layout;
  if (!measureContext && typeof document !== "undefined") measureContext = document.createElement("canvas").getContext("2d");
  const context = measureContext;
  const padding = n.kind === "text" ? 0 : Math.min(8, n.w / 8, n.h / 8);
  // Leave room for the editor border and subpixel rounding of browser text.
  const contentWidth = Math.max(.01, n.w - padding * 2 - 4);
  const contentHeight = Math.max(.01, n.h - padding * 2 - 4);
  const layoutAt = (fontSize: number) => {
    if (context) context.font = `${n.italic ? "italic " : ""}${n.bold ? "700" : "400"} ${fontSize}px Arial, Helvetica, sans-serif`;
    const measure = (text: string) => context ? context.measureText(text).width : Array.from(text).reduce((w, char) =>
      w + fontSize * (char.codePointAt(0)! > 255 ? 1 : /[MW@]/.test(char) ? .95 : .65) * (n.bold ? 1.08 : 1), 0);
    const lines = wrapText(n.text, contentWidth, measure);
    return { layout: { fontSize, lineHeight: fontSize * 1.3, padding, lines, contentWidth },
      fits: lines.length * fontSize * 1.3 <= contentHeight && lines.every(line => measure(line) <= contentWidth) };
  };
  const automatic = n.kind === "note" && n.fontSize === undefined;
  let result = layoutAt(n.fontSize ?? (automatic ? Math.min(144, Math.max(1, Math.min(n.w, n.h) * .18)) : 14));
  if (automatic && !result.fits) {
    let low = 0, high = result.layout.fontSize;
    for (let i = 0; i < 18; i++) {
      const middle = (low + high) / 2, candidate = layoutAt(middle);
      if (candidate.fits) { low = middle; result = candidate; } else high = middle;
    }
    // Auto can go below manually selectable sizes when the note is very full.
    result = layoutAt(Math.max(.0001, low));
  }
  layoutCache.set(n, { key, layout: result.layout });
  return result.layout;
}
export function nodeFontSize(n: BoardNode) { return nodeTextLayout(n).fontSize; }
export function textStyle(n: BoardNode): import("react").CSSProperties {
  const align = n.align ?? (n.kind === "text" ? "left" : "center");
  const vertical = n.verticalAlign ?? (n.kind === "text" ? "top" : "middle");
  return {
    fontSize: nodeFontSize(n),
    fontWeight: n.bold ? 700 : 400,
    fontStyle: n.italic ? "italic" : "normal",
    textAlign: align,
    justifyContent:
      align === "left"
        ? "flex-start"
        : align === "right"
          ? "flex-end"
          : "center",
    alignItems:
      vertical === "top"
        ? "flex-start"
        : vertical === "bottom"
          ? "flex-end"
          : "center",
    color: n.fill.toLowerCase() === "#151515" ? "#fff" : "#1a1a1a",
  };
}
