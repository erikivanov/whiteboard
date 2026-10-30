"use client";
import {
  BoardDocument,
  BoardNode,
  Bounds,
  Edge,
  edgePath,
  endpoint,
} from "@/lib/document";
import {
  anchorPoint,
  Guide,
  quickNode,
  Side,
  sides,
  direction,
  opposite,
} from "@/lib/interactions";
type Props = {
  doc: BoardDocument;
  source: BoardNode | undefined;
  hover: Side | null;
  zoom: number;
  viewport: Bounds;
  guides: Guide[];
  targetId?: string;
  connecting: boolean;
  disabled: boolean;
  onHover: (s: Side | null) => void;
  onActivate: (s: Side) => void;
};
export default function InteractionOverlay({
  doc,
  source,
  hover,
  zoom,
  viewport,
  guides,
  targetId,
  connecting,
  disabled,
  onHover,
  onActivate,
}: Props) {
  const ghost =
    source && hover && !connecting
      ? quickNode(source, hover, "quick-preview")
      : null;
  const ghostDoc = ghost ? { ...doc, nodes: [...doc.nodes, ghost] } : doc;
  const ghostEdge: Edge | undefined =
    ghost && source && hover
      ? {
          id: "quick-preview-edge",
          from: {
            nodeId: source.id,
            side: hover,
            point: endpoint(
              { nodeId: source.id, side: hover, point: { x: 0, y: 0 } },
              doc,
            ),
          },
          to: {
            nodeId: ghost.id,
            side: opposite[hover],
            point: { x: 0, y: 0 },
          },
          style: "elbow",
        }
      : undefined;
  const target = doc.nodes.find((n) => n.id === targetId);
  const bracket = (b: Bounds, axis: "width" | "height", key: string) => {
    const o = 16 / zoom,
      c = 3 / zoom;
    return axis === "width" ? (
      <path
        key={key}
        d={`M ${b.x} ${b.y + b.h + o - c} v ${2 * c} M ${b.x} ${b.y + b.h + o} h ${b.w} M ${b.x + b.w} ${b.y + b.h + o - c} v ${2 * c}`}
      />
    ) : (
      <path
        key={key}
        d={`M ${b.x - o - c} ${b.y} h ${2 * c} M ${b.x - o} ${b.y} v ${b.h} M ${b.x - o - c} ${b.y + b.h} h ${2 * c}`}
      />
    );
  };
  return (
    <g className="interaction-overlay">
      {ghost && ghostEdge && (
        <g data-testid="quick-preview" pointerEvents="none" opacity=".3">
          <path
            d={edgePath(ghostEdge, ghostDoc)}
            fill="none"
            stroke="#333"
            strokeWidth={2}
            markerEnd="url(#arrow)"
          />
          <rect
            x={ghost.x}
            y={ghost.y}
            width={ghost.w}
            height={ghost.h}
            fill={ghost.fill}
          />
        </g>
      )}
      {target && (
        <g data-testid="connection-target" pointerEvents="none">
          <rect
            x={target.x - 3 / zoom}
            y={target.y - 3 / zoom}
            width={target.w + 6 / zoom}
            height={target.h + 6 / zoom}
            fill="#4262ff20"
            stroke="#4262ff"
            strokeWidth={2 / zoom}
          />
          {sides.map((s) => {
            const p = endpoint(
              { nodeId: target.id, side: s, point: { x: 0, y: 0 } },
              doc,
            );
            return (
              <circle
                key={s}
                cx={p.x}
                cy={p.y}
                r={4 / zoom}
                fill="white"
                stroke="#4262ff"
                strokeWidth={1.5 / zoom}
              />
            );
          })}
        </g>
      )}
      <g
        data-testid="guides"
        fill="none"
        stroke="#4262ff"
        strokeWidth={1 / zoom}
        pointerEvents="none"
      >
        {guides.map((g, i) =>
          g.kind === "position" ? (
            <path
              key={i}
              data-testid={`position-guide-${g.axis}`}
              strokeDasharray={`${4 / zoom} ${4 / zoom}`}
              d={
                g.axis === "x"
                  ? `M ${g.value} ${viewport.y} V ${viewport.y + viewport.h}`
                  : `M ${viewport.x} ${g.value} H ${viewport.x + viewport.w}`
              }
            />
          ) : (
            <g
              key={i}
              data-testid={`size-guide-${g.axis}`}
              data-reference={g.referenceId}
              data-snapped={g.snapped}
            >
              {bracket(g.box, g.axis, "moving")}
              {bracket(g.reference, g.axis, "reference")}
            </g>
          ),
        )}
      </g>
      {source &&
        !disabled &&
        !connecting &&
        sides.map((side) => {
          const p = anchorPoint(source, side, zoom),
            d = direction[side],
            active = hover === side;
          return (
            <g
              key={side}
              role="button"
              aria-label={`Verbindung ${{ left: "links", right: "rechts", top: "oben", bottom: "unten" }[side]}`}
              tabIndex={0}
              data-connection-side={side}
              data-testid={`connection-${side}`}
              transform={`translate(${p.x} ${p.y})`}
              className={`connection-point ${active ? "hovered" : ""}`}
              onPointerEnter={() => onHover(side)}
              onPointerLeave={() => onHover(null)}
              onFocus={() => onHover(side)}
              onBlur={() => onHover(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onActivate(side);
                }
              }}
            >
              <circle r={13 / zoom} fill="transparent" />
              <circle
                className="connection-dot"
                r={(active ? 12 : 3) / zoom}
                fill="#4262ff"
                stroke={active ? "#4262ff" : "white"}
                strokeWidth={2 / zoom}
              />
              {active && (
                <path
                  d={`M ${(-d.x * 6) / zoom} ${(-d.y * 6) / zoom} L ${(d.x * 6) / zoom} ${(d.y * 6) / zoom} M ${(d.x * 1 - d.y * 5) / zoom} ${(d.y * 1 + d.x * 5) / zoom} L ${(d.x * 6) / zoom} ${(d.y * 6) / zoom} L ${(d.x * 1 + d.y * 5) / zoom} ${(d.y * 1 - d.x * 5) / zoom}`}
                  fill="none"
                  stroke="white"
                  strokeWidth={1.7 / zoom}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
    </g>
  );
}
