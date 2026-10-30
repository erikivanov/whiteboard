"use client";
import { useState, useRef, useLayoutEffect } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Copy,
  Trash2,
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Type,
} from "lucide-react";
import { BoardNode, Edge, EdgeLabel, NodeKind } from "@/lib/document";
import { nodeFontSize } from "@/lib/presentation";
import { noteColors } from "@/lib/palette";
type Props = {
  nodes: BoardNode[];
  edges: Edge[];
  count: number;
  position: { left: number; top: number };
  updateNodes: (patch: Partial<BoardNode>) => void;
  resizeNotes: (size: number) => void;
  updateEdges: (patch: Partial<Edge>) => void;
  duplicate: () => void;
  remove: () => void;
  label?: EdgeLabel;
  updateLabel: (patch: Partial<EdgeLabel>) => void;
  addLabel: () => void;
  editLabel: () => void;
  canAddLabel: boolean;
};
export default function SelectionToolbar({
  nodes,
  edges,
  count,
  position,
  updateNodes,
  resizeNotes,
  updateEdges,
  duplicate,
  remove,
  label, updateLabel, addLabel, editLabel, canAddLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(position.left);
  useLayoutEffect(() => {
    if (ref.current)
      setLeft(
        Math.max(
          64,
          Math.min(
            position.left - ref.current.offsetWidth / 2,
            window.innerWidth - ref.current.offsetWidth - 8,
          ),
        ),
      );
  }, [position.left, position.top, nodes.length, edges.length, nodes[0]?.kind, label?.id]);
  const [menu, setMenu] = useState<string | null>(null);
  const n = nodes[0],
    e = edges[0];
  const toggle = (name: string) => setMenu(menu === name ? null : name);
  return (
    <div
      ref={ref}
      className="contextbar"
      role="toolbar"
      aria-label="Objekteinstellungen"
      style={{ ...position, left }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <strong>
        {count} {count === 1 ? "Objekt" : "Objekte"}
      </strong>
      <span className="divider" />
      {n && (
        <>
          <select
            aria-label="Objekttyp"
            title="Typ wechseln"
            value={n.kind}
            onChange={(e) => updateNodes({ kind: e.target.value as NodeKind })}
          >
            {[
              ["note", "Notiz"],
              ["rect", "Rechteck"],
              ["ellipse", "Oval"],
              ["diamond", "Raute"],
              ["triangle", "Dreieck"],
              ["text", "Text"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Schriftgröße"
            value={n.fontSize ?? "auto"}
            onChange={(e) =>
              updateNodes({
                fontSize:
                  e.target.value === "auto"
                    ? undefined
                    : Number(e.target.value),
              })
            }
          >
            <option value="auto">{n.kind === "note" ? "Auto" : "14"}</option>
            {[8, 10, 12, 14, 18, 24, 36, 48, 64, 96, 144].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            aria-label="Schrift vergrößern"
            title="Schrift vergrößern"
            onClick={() =>
              updateNodes({ fontSize: Math.max(8, Math.min(144, nodeFontSize(n) + 2)) })
            }
          >
            <Type size={17} />
            <span className="tiny-plus">+</span>
          </button>
          <button
            aria-label="Schrift verkleinern"
            title="Schrift verkleinern"
            onClick={() =>
              updateNodes({ fontSize: Math.max(8, nodeFontSize(n) - 2) })
            }
          >
            <Type size={15} />
            <span className="tiny-plus">−</span>
          </button>
          <button
            aria-label="Fett"
            title="Fett"
            aria-pressed={!!n.bold}
            onClick={() => updateNodes({ bold: !n.bold })}
          >
            <Bold size={17} />
          </button>
          <button
            aria-label="Kursiv"
            title="Kursiv"
            aria-pressed={!!n.italic}
            onClick={() => updateNodes({ italic: !n.italic })}
          >
            <Italic size={17} />
          </button>
          <div className="menu-anchor">
            <button
              aria-label="Ausrichtung"
              title="Ausrichtung"
              aria-expanded={menu === "align"}
              onClick={() => toggle("align")}
            >
              <AlignCenter size={17} />
            </button>
            {menu === "align" && (
              <div
                className="setting-popover align-options"
                role="dialog"
                aria-label="Ausrichtung"
              >
                {(["left", "center", "right"] as const).map((align, i) => {
                  const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                  return (
                    <button
                      key={align}
                      aria-label={
                        ["Linksbündig", "Zentriert", "Rechtsbündig"][i]
                      }
                      onClick={() => updateNodes({ align })}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
                <hr />
                {(["top", "middle", "bottom"] as const).map(
                  (verticalAlign, i) => (
                    <button
                      key={verticalAlign}
                      aria-label={["Oben", "Mitte", "Unten"][i]}
                      onClick={() => updateNodes({ verticalAlign })}
                    >
                      {
                        [
                          <ArrowUpToLine key="t" size={18} />,
                          <AlignCenter key="m" size={18} />,
                          <ArrowDownToLine key="b" size={18} />,
                        ][i]
                      }
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
          {nodes.every((n) => n.kind === "note") && (
            <div className="menu-anchor">
              <button
                aria-label={`Notizgröße ${n.w < 150 ? "S" : n.w < 300 ? "M" : "L"}`}
                aria-expanded={menu === "size"}
                title="Notizgröße"
                onClick={() => toggle("size")}
              >
                {n.w < 150 ? "S" : n.w < 300 ? "M" : "L"}
                <ChevronDown size={12} />
              </button>
              {menu === "size" && (
                <div
                  className="setting-popover size-options"
                  role="menu"
                  aria-label="Notizgröße"
                >
                  {[
                    ["S", 100],
                    ["M", 200],
                    ["L", 400],
                  ].map(([label, size]) => (
                    <button
                      key={label}
                      role="menuitem"
                      onClick={() => {
                        resizeNotes(Number(size));
                        setMenu(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="menu-anchor">
            <button
              aria-label="Füllfarbe"
              title="Füllfarbe"
              aria-expanded={menu === "fill"}
              onClick={() => toggle("fill")}
            >
              <span
                className="fill-dot"
                style={{
                  background: n.fill === "transparent" ? "white" : n.fill,
                }}
              />
            </button>
            {menu === "fill" && (
              <div
                className="setting-popover fill-options"
                role="dialog"
                aria-label="Füllfarbe"
              >
                <div className="swatches">
                  {noteColors.map(([name, color]) => (
                    <button
                      key={color}
                      aria-label={`Füllfarbe ${name}`}
                      title={name}
                      style={{ background: color }}
                      onClick={() => {
                        updateNodes({ fill: color });
                        setMenu(null);
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    updateNodes({ fill: "transparent" });
                    setMenu(null);
                  }}
                >
                  Ohne Füllung
                </button>
                <label>
                  Eigene Farbe
                  <input
                    type="color"
                    aria-label="Eigene Füllfarbe"
                    value={n.fill === "transparent" ? "#ffffff" : n.fill}
                    onChange={(e) => updateNodes({ fill: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        </>
      )}
      {e && (
        <>
          {canAddLabel && <button aria-label="Verbindungstext hinzufügen" title="Text hinzufügen" onClick={addLabel}><Type size={17}/><span>+</span></button>}
          {label && <>
            <button aria-label="Beschriftung bearbeiten" title="Text bearbeiten" onClick={editLabel}><Type size={17}/></button>
            <select aria-label="Schriftgröße der Beschriftung" value={label.fontSize??14} onChange={e=>updateLabel({fontSize:Number(e.target.value)})}>
              {[10,12,14,16,18,24,32,48,64,96,144].map(size=><option key={size} value={size}>{size}</option>)}
            </select>
            <input type="color" aria-label="Textfarbe der Beschriftung" value={label.color??"#253c32"} onChange={e=>updateLabel({color:e.target.value})}/>
          </>}
          <select
            aria-label="Linientyp"
            value={e.style ?? "curve"}
            onChange={(event) =>
              updateEdges({ style: event.target.value as Edge["style"] })
            }
          >
            <option value="curve">Gebogen</option>
            <option value="straight">Gerade</option>
            <option value="elbow">Gewinkelt</option>
          </select>
          <button
            aria-label="Pfeilspitze"
            aria-pressed={e.arrow !== false}
            onClick={() => updateEdges({ arrow: e.arrow === false })}
          >
            →
          </button>
          <input
            type="color"
            aria-label="Linienfarbe"
            value={e.color ?? "#252525"}
            onChange={(event) => updateEdges({ color: event.target.value })}
          />
        </>
      )}
      <span className="divider" />
      <button
        aria-label="Duplizieren"
        title="Duplizieren · ⌘/Strg D"
        onClick={duplicate}
      >
        <Copy size={17} />
      </button>
      <button aria-label={label?"Beschriftung löschen":"Auswahl löschen"} title="Löschen · ⌫" onClick={remove}>
        <Trash2 size={17} />
      </button>
    </div>
  );
}
