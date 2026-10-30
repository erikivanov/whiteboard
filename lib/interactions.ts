import {
  BoardDocument,
  BoardNode,
  Bounds,
  Endpoint,
  Point,
  endpoint,
  attach,
} from "./document";
export type Side = NonNullable<Endpoint["side"]>;
export const sides: Side[] = ["top", "right", "bottom", "left"];
export const opposite: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};
export const direction: Record<Side, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
export function anchorPoint(n: BoardNode, side: Side, zoom: number): Point {
  const p = endpoint(
    { nodeId: n.id, side, point: { x: 0, y: 0 } },
    { version: 1, title: "", nodes: [n], edges: [] },
  );
  const gap = 18 / zoom + 4;
  const d = direction[side];
  return { x: p.x + d.x * gap, y: p.y + d.y * gap };
}
export function quickNode(
  source: BoardNode,
  side: Side,
  id: string,
): BoardNode {
  const d = direction[side];
  return {
    ...source,
    id,
    text: "",
    x: source.x + d.x * source.w * 2.16,
    y: source.y + d.y * source.h * 2.48,
  };
}
export function incomingSide(start: Point, end: Point): Side {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0
      ? "left"
      : "right"
    : dy >= 0
      ? "top"
      : "bottom";
}
export function placeAtEndpoint(
  source: BoardNode,
  side: Side,
  p: Point,
  id: string,
): BoardNode {
  const n = {
    ...source,
    id,
    text: "",
    x: p.x - source.w / 2,
    y: p.y - source.h / 2,
  };
  if (side === "left") n.x = p.x;
  if (side === "right") n.x = p.x - n.w;
  if (side === "top") n.y = p.y;
  if (side === "bottom") n.y = p.y - n.h;
  return n;
}
export function connectionTarget(
  doc: BoardDocument,
  p: Point,
  sourceId: string,
  zoom: number,
): Endpoint {
  const margin = 8 / zoom;
  const n = [...doc.nodes]
    .reverse()
    .find(
      (n) =>
        n.id !== sourceId &&
        n.kind !== "text" &&
        p.x >= n.x - margin &&
        p.x <= n.x + n.w + margin &&
        p.y >= n.y - margin &&
        p.y <= n.y + n.h + margin,
    );
  if (!n) return { point: p };
  return attach(
    {
      x: Math.max(n.x, Math.min(n.x + n.w, p.x)),
      y: Math.max(n.y, Math.min(n.y + n.h, p.y)),
    },
    { ...doc, nodes: [n] },
  );
}
/** Move just one end of an existing edge, preserving its style and labels. */
export function reconnectEndpoint(
  doc: BoardDocument,
  edgeId: string,
  end: "from" | "to",
  point: Point,
  zoom: number,
): { doc: BoardDocument; targetId?: string } {
  const edge = doc.edges.find(edge => edge.id === edgeId);
  if (!edge) return { doc };
  const opposite = edge[end === "from" ? "to" : "from"];
  const target = connectionTarget(doc, point, opposite.nodeId ?? "", zoom);
  return {
    doc: { ...doc, edges: doc.edges.map(item => item.id === edgeId ? { ...item, [end]: target } : item) },
    targetId: target.nodeId,
  };
}

export type Guide =
  | { kind: "position"; axis: "x" | "y"; value: number }
  | {
      kind: "size";
      axis: "width" | "height";
      reference: Bounds;
      box: Bounds;
      snapped: boolean;
      referenceId: string;
    };
export function visibleReferences(
  doc: BoardDocument,
  excluded: string[],
  viewport: Bounds,
) {
  return doc.nodes.filter(
    (n) =>
      !excluded.includes(n.id) &&
      n.x + n.w >= viewport.x &&
      n.x <= viewport.x + viewport.w &&
      n.y + n.h >= viewport.y &&
      n.y <= viewport.y + viewport.h,
  );
}
const nearest = (values: { delta: number; value: number }[], limit: number) =>
  values
    .filter((v) => Math.abs(v.delta) <= limit)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
export function alignMove(box: Bounds, refs: BoardNode[], zoom: number) {
  const x = nearest(
    refs.flatMap((n) =>
      [n.x, n.x + n.w / 2, n.x + n.w].flatMap((value) =>
        [box.x, box.x + box.w / 2, box.x + box.w].map((v) => ({
          value,
          delta: value - v,
        })),
      ),
    ),
    6 / zoom,
  );
  const y = nearest(
    refs.flatMap((n) =>
      [n.y, n.y + n.h / 2, n.y + n.h].flatMap((value) =>
        [box.y, box.y + box.h / 2, box.y + box.h].map((v) => ({
          value,
          delta: value - v,
        })),
      ),
    ),
    6 / zoom,
  );
  const guides: Guide[] = [];
  if (x) guides.push({ kind: "position", axis: "x", value: x.value });
  if (y) guides.push({ kind: "position", axis: "y", value: y.value });
  return {
    dx: x && Math.abs(x.delta) * zoom <= 4 ? x.delta : 0,
    dy: y && Math.abs(y.delta) * zoom <= 4 ? y.delta : 0,
    guides,
  };
}
export function resizeBox(
  before: Bounds,
  corner: string,
  delta: Point,
  proportional: boolean,
): Bounds {
  const sx = corner.includes("w") ? -1 : 1,
    sy = corner.includes("n") ? -1 : 1;
  let w = Math.max(30, before.w + delta.x * sx),
    h = Math.max(30, before.h + delta.y * sy);
  if (proportional) {
    const factor = Math.max(
      30 / Math.min(before.w, before.h),
      1 +
        (before.w * delta.x * sx + before.h * delta.y * sy) /
          (before.w ** 2 + before.h ** 2),
    );
    w = before.w * factor;
    h = before.h * factor;
  }
  return {
    x: corner.includes("w") ? before.x + before.w - w : before.x,
    y: corner.includes("n") ? before.y + before.h - h : before.y,
    w,
    h,
  };
}
export function resizeGuides(
  raw: Bounds,
  before: Bounds,
  corner: string,
  refs: BoardNode[],
  zoom: number,
  proportional: boolean,
) {
  let box = { ...raw };
  const candidates = (axis: "w" | "h") =>
    refs
      .map((n) => ({ node: n, delta: n[axis] - raw[axis] }))
      .filter((v) => Math.abs(v.delta) * zoom <= 6)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  const width = candidates("w")[0],
    height = candidates("h")[0];
  const ws = width && Math.abs(width.delta) * zoom <= 4,
    hs = height && Math.abs(height.delta) * zoom <= 4;
  if (proportional) {
    const match =
      ws && (!hs || Math.abs(width.delta) <= Math.abs(height.delta))
        ? { axis: "w" as const, n: width.node }
        : hs
          ? { axis: "h" as const, n: height.node }
          : null;
    if (match) {
      const factor = match.n[match.axis] / before[match.axis];
      box.w = before.w * factor;
      box.h = before.h * factor;
    }
  } else {
    if (ws) box.w = width.node.w;
    if (hs) box.h = height.node.h;
  }
  box.x = corner.includes("w") ? before.x + before.w - box.w : before.x;
  box.y = corner.includes("n") ? before.y + before.h - box.h : before.y;
  const guides: Guide[] = [];
  for (const n of refs.filter((n) => Math.abs(n.w - box.w) * zoom <= 6))
    guides.push({
      kind: "size",
      axis: "width",
      reference: n,
      box,
      referenceId: n.id,
      snapped: Math.abs(n.w - box.w) < 0.001,
    });
  for (const n of refs.filter((n) => Math.abs(n.h - box.h) * zoom <= 6))
    guides.push({
      kind: "size",
      axis: "height",
      reference: n,
      box,
      referenceId: n.id,
      snapped: Math.abs(n.h - box.h) < 0.001,
    });
  const movingX = corner.includes("w") ? box.x : box.x + box.w,
    movingY = corner.includes("n") ? box.y : box.y + box.h;
  const ax = nearest(
    refs.flatMap((n) =>
      [n.x, n.x + n.w / 2, n.x + n.w].map((value) => ({
        value,
        delta: value - movingX,
      })),
    ),
    6 / zoom,
  );
  const ay = nearest(
    refs.flatMap((n) =>
      [n.y, n.y + n.h / 2, n.y + n.h].map((value) => ({
        value,
        delta: value - movingY,
      })),
    ),
    6 / zoom,
  );
  if (ax) guides.push({ kind: "position", axis: "x", value: ax.value });
  if (ay) guides.push({ kind: "position", axis: "y", value: ay.value });
  return { box, guides };
}
