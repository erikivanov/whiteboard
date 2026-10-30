"use client";
import {
  BoardDocument,
  Bounds,
  Edge,
  edgePath,
  connectionGeometry,
  edgeLabelLayout,
} from "@/lib/document";
type Props = {
  doc: BoardDocument;
  draftEdge: Edge | null;
  selected: string[];
  selection: Bounds | null;
  editing: string | null;
  view: { x: number; y: number; z: number };
};
/** Invisible hit regions and accessible interaction handles above the Canvas renderer. */
export default function BoardScene({
  doc,
  draftEdge,
  selected,
  selection,
  editing,
  view,
}: Props) {
  return (
    <>
      {[...doc.edges, ...(draftEdge ? [draftEdge] : [])].map((edge) => (
        <g
          key={edge.id}
          data-id={edge.id}
          data-kind="edge"
          data-testid={edge.id === "draft" ? "edge-preview" : "edge"}
        >
          <path
            data-testid="edge-path"
            d={edgePath(edge, doc)}
            fill="none"
            stroke="transparent"
            strokeWidth={14 / view.z}
          />
          {(edge.labels ?? []).map(label=>{
            const box=edgeLabelLayout(edge,label,doc);
            return <g key={label.id} data-label-id={label.id} data-testid="edge-label" aria-label={`Verbindungstext: ${label.text}`}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" />
              <title>{label.text}</title>
            </g>;
          })}
        </g>
      ))}
      {doc.nodes.map((n) => (
        <g
          key={n.id}
          data-id={n.id}
          data-kind={n.kind}
          data-testid="board-node"
          transform={`translate(${n.x} ${n.y})`}
        >
          <rect width={n.w} height={n.h} fill="transparent" />
          <title>{n.text}</title>
          {selected.length > 1 && selected.includes(n.id) && !editing && (
            <rect
              x={-2 / view.z}
              y={-2 / view.z}
              width={n.w + 4 / view.z}
              height={n.h + 4 / view.z}
              fill="none"
              stroke="#4262ff"
              strokeWidth={0.8 / view.z}
              pointerEvents="none"
            />
          )}
        </g>
      ))}
      {selection && (
        <g data-testid="selection" className="selection">
          <rect
            x={selection.x - 3 / view.z}
            y={selection.y - 3 / view.z}
            width={selection.w + 6 / view.z}
            height={selection.h + 6 / view.z}
            fill="none"
            stroke="#4262ff"
            strokeWidth={1 / view.z}
            pointerEvents="none"
          />
          {doc.nodes.some((n) => selected.includes(n.id)) &&
            (["nw", "ne", "sw", "se"] as const).map((c) => (
              <rect
                key={c}
                data-corner={c}
                data-testid={`resize-${c}`}
                x={
                  selection.x + (c.includes("e") ? selection.w : 0) - 4 / view.z
                }
                y={
                  selection.y + (c.includes("s") ? selection.h : 0) - 4 / view.z
                }
                rx={4 / view.z}
                width={8 / view.z}
                height={8 / view.z}
                fill="white"
                stroke="#4262ff"
                strokeWidth={1.3 / view.z}
                style={{
                  cursor:
                    c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                }}
              />
            ))}
        </g>
      )}
      {/* Above the node hit regions, so attached handles stay draggable. */}
      {!editing && doc.edges.filter(edge=>selected.includes(edge.id)).map(edge=>{
        const geometry=connectionGeometry(edge,doc);
        return (["from","to"] as const).map(end=>{
          const point=geometry[end];
          return <g key={`${edge.id}-${end}`} data-edge-id={edge.id} data-edge-endpoint={end} data-testid={`edge-endpoint-${end}`} className="edge-endpoint-handle">
            <title>{end==="from"?"Pfeilanfang verbinden oder verschieben":"Pfeilspitze verbinden oder verschieben"}</title>
            <circle cx={point.x} cy={point.y} r={11/view.z} fill="transparent"/>
            <circle cx={point.x} cy={point.y} r={4.5/view.z} fill="white" stroke="#4262ff" strokeWidth={1.5/view.z} pointerEvents="none"/>
          </g>;
        });
      })}

    </>
  );
}
