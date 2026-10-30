"use client";
import { newId } from "@/lib/id";
import { useEffect, useRef, useState } from "react";
import {
  MousePointer2,
  LayoutDashboard,
  StickyNote,
  Square,
  Type,
  ArrowUpRight,
  Undo2,
  Redo2,
  Minus,
  Plus,
  Maximize,
  Trash2,
  Share2,
  HelpCircle,
  X,
  Check,
  Diamond,
  Circle,
  Triangle,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import {
  attach,
  BoardDocument,
  BoardNode,
  bounds,
  Bounds,
  Edge,
  EdgeLabel,
  edgePointAt,
  edgePositionAt,
  edgeLabelLayout,
  NodeKind,
  Point,
} from "@/lib/document";
import { useDocument } from "@/lib/useDocument";
import BoardScene from "./BoardScene";
import CanvasScene from "./CanvasScene";
import { useCollaboration } from "@/lib/useCollaboration";
import InteractionOverlay from "./InteractionOverlay";
import {
  Side,
  Guide,
  quickNode,
  opposite,
  connectionTarget,
  reconnectEndpoint,
  incomingSide,
  placeAtEndpoint,
  visibleReferences,
  alignMove,
  resizeBox,
  resizeGuides,
} from "@/lib/interactions";
import { endpoint } from "@/lib/document";
import SelectionToolbar from "./SelectionToolbar";
import { nodeFontSize, nodeTextLayout, textStyle } from "@/lib/presentation";
import { noteColors } from "@/lib/palette";
type Tool =
  | "select"
  | "note"
  | "rect"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "text"
  | "edge";
type Gesture = {
  type:
    | "move"
    | "resize"
    | "marquee"
    | "create"
    | "edge"
    | "pan"
    | "place"
    | "quick"
    | "label"
    | "reconnect";
  start: Point;
  screen: Point;
  before: BoardDocument;
  ids: string[];
  id?: string;
  corner?: string;
  labelId?: string;
  edgeEnd?: "from" | "to";
  sourceId?: string;
  side?: Side;
  pointerId?: number;
  kind?: "note" | "text";
  view: { x: number; y: number; z: number };
  from?: ReturnType<typeof attach>;
  shift?: boolean;
};
const colors = noteColors;
const labels: Record<Tool, string> = {
  select: "Auswahl",
  note: "Notiz",
  rect: "Rechteck",
  ellipse: "Oval",
  diamond: "Raute",
  triangle: "Dreieck",
  text: "Text",
  edge: "Pfeillinie",
};
const icons = {
  select: MousePointer2,
  note: StickyNote,
  rect: Square,
  text: Type,
  edge: ArrowUpRight,
};
function fitTextHeight(n: BoardNode, text: string) {
  if (n.kind !== "text") return n.h;
  const columns = Math.max(1, n.w / (nodeFontSize(n) * 0.54));
  const lines = text
    .split("\n")
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(line.length / columns)),
      0,
    );
  return Math.max(n.h, lines * nodeFontSize(n) * 1.3);
}
function editorStyle(n: BoardNode, draft: string): React.CSSProperties {
  const effective=n.text===draft?n:{...n,text:draft},layout=nodeTextLayout(effective);
  const space=Math.max(0,n.h-layout.padding*2-2-layout.lines.length*layout.lineHeight);
  const vertical=n.verticalAlign??(n.kind==="text"?"top":"middle");
  return {
    ...textStyle(effective),
    paddingLeft:layout.padding,
    paddingRight:layout.padding,
    paddingBottom:layout.padding,
    paddingTop:layout.padding+(vertical==="bottom"?space:vertical==="middle"?space/2:0),
    lineHeight:`${layout.lineHeight}px`,
    tabSize:4,
  };
}

export default function Whiteboard() {
  const localStore = useDocument();
  const collaboration = useCollaboration(localStore);
  const readOnly=collaboration.readOnly || localStore.removed;
  const store = { ...localStore,
    commit: (d: BoardDocument) => { if (!readOnly) localStore.commit(d); },
    replace: (d: BoardDocument) => { if (!readOnly) localStore.replace(d); },
    record: (d: BoardDocument) => { if (!readOnly) localStore.record(d); },
    undo: () => { if (!readOnly) localStore.undo(); },
    redo: () => { if (!readOnly) localStore.redo(); },
  };
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const shareLink = (() => {
    if (!collaboration.session || !collaboration.shareToken || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("board", collaboration.session.id);
    url.hash = new URLSearchParams({ token: collaboration.shareToken }).toString();
    return url.toString();
  })();
  const { doc, current, replace, commit, record } = store;
  const [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState<string[]>([]),
    [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [palette, setPalette] = useState<"note" | "shape" | null>(null),
    [color, setColor] = useState<string>(colors[0][1]),
    [space, setSpace] = useState(false),
    [help, setHelp] = useState(false);
  const [marquee, setMarquee] = useState<Bounds | null>(null),
    [draftEdge, setDraftEdge] = useState<Edge | null>(null);
  const [selectedLabel,setSelectedLabel]=useState<string|null>(null);
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [message, setMessage] = useState("");
  const svg = useRef<SVGSVGElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    gesture = useRef<Gesture | null>(null),
    editBefore = useRef<BoardDocument | null>(null);
  const [rightMenu, setRightMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [zoomMenu, setZoomMenu] = useState(false),
    [showGrid, setShowGrid] = useState(true);
  const [lineStyle, setLineStyle] = useState<Edge["style"]>("curve"),
    [lineArrow, setLineArrow] = useState(true);
  const [hoverSide, setHoverSide] = useState<Side | null>(null),
    [connecting, setConnecting] = useState(false),
    [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    edgeId: string;
    side: Side;
    point: Point;
    screen: Point;
  } | null>(null);
  const viewport = {
    x: -view.x / view.z,
    y: -view.y / view.z,
    w: (svg.current?.clientWidth ?? 1440) / view.z,
    h: (svg.current?.clientHeight ?? 1000) / view.z,
  };
  useEffect(() => {
    if (!readOnly) return;
    const pointerId=gesture.current?.pointerId;
    if(pointerId!==undefined && svg.current?.hasPointerCapture(pointerId)) svg.current.releasePointerCapture(pointerId);
    gesture.current=null;editBefore.current=null;
    setEditing(null);setSelectedLabel(null);setSelected([]);setDraftEdge(null);setGuides([]);setTool("select");setPalette(null);setRightMenu(null);setPendingConnection(null);
  },[readOnly]);
  const selection = bounds(doc, selected);
  const activeNode = doc.nodes.find((n) => n.id === editing);
  const editingEdge = doc.edges.find(e=>e.labels?.some(label=>label.id===editing));
  const activeLabel = editingEdge?.labels?.find(label=>label.id===editing);
  const activeLabelBox = editingEdge && activeLabel ? edgeLabelLayout(editingEdge,activeLabel,doc) : null;
  const labelEdge = doc.edges.find(e=>selected.includes(e.id) && e.labels?.some(label=>label.id===selectedLabel));
  const chosenLabel = labelEdge?.labels?.find(label=>label.id===selectedLabel);
  const toolbarBox=labelEdge&&chosenLabel?edgeLabelLayout(labelEdge,chosenLabel,doc):selection;
  useEffect(()=>{
    if(editing && !activeNode && !activeLabel){setEditing(null);editBefore.current=null;}
  },[editing,activeNode,activeLabel]);
  const point = (e: { clientX: number; clientY: number }): Point => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - view.x) / view.z,
      y: (e.clientY - r.top - view.y) / view.z,
    };
  };
  const finishEdit = () => {
    if (!editing) return;
    const next = {
      ...current.current,
      nodes: current.current.nodes.map((n) =>
        n.id === editing ? { ...n, text: draft } : n,
      ),
      edges: current.current.edges.map(edge=>({...edge,labels:edge.labels?.flatMap(label=>
        label.id===editing ? draft.trim() ? [{...label,text:draft}] : [] : [label])})),
    };
    replace(next);
    if (editBefore.current) record(editBefore.current);
    editBefore.current = null;
    setEditing(null);
  };
  const startEdit = (n: BoardNode) => {
    if (readOnly) return;
    editBefore.current = current.current;
    setSelectedLabel(null);
    setEditing(n.id);
    setDraft(n.text);
    setSelected([n.id]);
    setTool("select");
  };
  const startLabelEdit = (edge: Edge, labelId?: string, position?: number) => {
    if(readOnly)return;
    finishEdit();
    const live=current.current.edges.find(e=>e.id===edge.id);
    if(!live)return;
    const before=current.current;
    let label=live.labels?.find(l=>l.id===labelId);
    if(!label){
      const occupied=[0,...(live.labels??[]).map(l=>l.position),1].sort((a,b)=>a-b);
      let gap=0,freePosition=.5;
      for(let i=1;i<occupied.length;i++)if(occupied[i]-occupied[i-1]>gap){gap=occupied[i]-occupied[i-1];freePosition=(occupied[i]+occupied[i-1])/2;}
      label={id:newId(),text:"",position:position??freePosition};
      const added=label;
      replace({...before,edges:before.edges.map(e=>e.id===edge.id?{...e,labels:[...(e.labels??[]),added]}:e)});
    }
    editBefore.current=before;
    setSelected([edge.id]);setSelectedLabel(label.id);setEditing(label.id);setDraft(label.text);setTool("select");
  };
  const updateLabel = (patch: Partial<EdgeLabel>) => {
    if(!labelEdge || !chosenLabel)return;
    commit({...current.current,edges:current.current.edges.map(e=>e.id===labelEdge.id?{...e,labels:e.labels?.map(l=>l.id===chosenLabel.id?{...l,...patch}:l)}:e)});
  };
  useEffect(() => {
    if (editing) {
      textarea.current?.focus();
      textarea.current?.select();
    }
  }, [editing]);
  const remove = () => {
    if(labelEdge && chosenLabel){
      commit({...current.current,edges:current.current.edges.map(e=>e.id===labelEdge.id?{...e,labels:e.labels?.filter(l=>l.id!==chosenLabel.id)}:e)});
      setSelectedLabel(null);return;
    }
    const ids = new Set(selected);
    commit({
      ...current.current,
      nodes: current.current.nodes.filter((n) => !ids.has(n.id)),
      edges: current.current.edges.filter(
        (e) =>
          !ids.has(e.id) &&
          !ids.has(e.from.nodeId || "") &&
          !ids.has(e.to.nodeId || ""),
      ),
    });
    setSelected([]);
  };
  const duplicate = () => {
    if(labelEdge && chosenLabel){
      const label={...chosenLabel,id:newId(),position:Math.min(.95,chosenLabel.position+.12)};
      commit({...current.current,edges:current.current.edges.map(e=>e.id===labelEdge.id?{...e,labels:[...(e.labels??[]),label]}:e)});
      setSelectedLabel(label.id);return;
    }
    const ids = new Map(selected.map((id) => [id, newId()]));
    const nodes = current.current.nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({ ...n, id: ids.get(n.id)!, x: n.x + 30, y: n.y + 30 }));
    const edges = current.current.edges
      .filter(
        (e) =>
          ids.has(e.id) ||
          (ids.has(e.from.nodeId || "") && ids.has(e.to.nodeId || "")),
      )
      .map((e) => ({
        ...e,
        id: ids.get(e.id) ?? newId(),
        labels:e.labels?.map(label=>({...label,id:newId()})),
        from: {
          ...e.from,
          nodeId: e.from.nodeId
            ? (ids.get(e.from.nodeId) ?? e.from.nodeId)
            : undefined,
          point: { x: e.from.point.x + 30, y: e.from.point.y + 30 },
        },
        to: {
          ...e.to,
          nodeId: e.to.nodeId
            ? (ids.get(e.to.nodeId) ?? e.to.nodeId)
            : undefined,
          point: { x: e.to.point.x + 30, y: e.to.point.y + 30 },
        },
      }));
    commit({
      ...current.current,
      nodes: [...current.current.nodes, ...nodes],
      edges: [...current.current.edges, ...edges],
    });
    setSelected([...nodes, ...edges].map((n) => n.id));
    setRightMenu(null);
  };
  const updateNodes = (patch: Partial<BoardNode>) =>
    commit({
      ...current.current,
      nodes: current.current.nodes.map((n) =>
        selected.includes(n.id) ? { ...n, ...patch } : n,
      ),
    });
  const updateEdges = (patch: Partial<Edge>) =>
    commit({
      ...current.current,
      edges: current.current.edges.map((e) =>
        selected.includes(e.id) ? { ...e, ...patch } : e,
      ),
    });
  const resizeNotes = (size: number) =>
    commit({
      ...current.current,
      nodes: current.current.nodes.map((n) =>
        selected.includes(n.id)
          ? {
              ...n,
              x: n.x + (n.w - size) / 2,
              y: n.y + (n.h - size) / 2,
              w: size,
              h: size,
            }
          : n,
      ),
    });
  const reorder = (front: boolean) => {
    const nodes = current.current.nodes;
    commit({
      ...current.current,
      nodes: front
        ? [
            ...nodes.filter((n) => !selected.includes(n.id)),
            ...nodes.filter((n) => selected.includes(n.id)),
          ]
        : [
            ...nodes.filter((n) => selected.includes(n.id)),
            ...nodes.filter((n) => !selected.includes(n.id)),
          ],
    });
    setRightMenu(null);
  };
  const quickCreate = (side: Side) => {
    if (readOnly) return;
    const source = current.current.nodes.find((n) => n.id === selected[0]);
    if (!source) return;
    const node = quickNode(source, side, newId());
    const edge: Edge = {
      id: newId(),
      from: {
        nodeId: source.id,
        binding:"fixed",
        side,
        point: endpoint(
          { nodeId: source.id, side, point: { x: 0, y: 0 } },
          current.current,
        ),
      },
      to: {
        nodeId: node.id,
        binding:"auto",
        side: opposite[side],
        point: { x: node.x, y: node.y },
      },
      style: "elbow",
    };
    commit({
      ...current.current,
      nodes: [...current.current.nodes, node],
      edges: [...current.current.edges, edge],
    });
    setSelected([node.id]);
    setHoverSide(null);
    setPendingConnection(null);
  };
  const createPending = (kind?: NodeKind) => {
    const pending = pendingConnection;
    if (!pending) return;
    const source = current.current.nodes.find((n) => n.id === pending.sourceId);
    if (!source) return;
    const node = placeAtEndpoint(
      source,
      pending.side,
      pending.point,
      newId(),
    );
    if (kind && kind !== node.kind) {
      node.kind = kind;
      node.fill = kind === "note" ? source.fill : "transparent";
      node.fontSize = undefined;
    }
    commit({
      ...current.current,
      nodes: [...current.current.nodes, node],
      edges: current.current.edges.map((edge) =>
        edge.id === pending.edgeId
          ? {
              ...edge,
              style: "curve",
              to: { nodeId: node.id, side: pending.side, point: pending.point, binding:"auto" },
            }
          : edge,
      ),
    });
    setPendingConnection(null);
    setSelected([node.id]);
    setHoverSide(null);
  };
  const choose = (t: Tool) => {
    setSelectedLabel(null);
    if (readOnly && t !== "select") return;
    finishEdit();
    setPendingConnection(null);
    setHoverSide(null);
    setGuides([]);
    if (t !== "select") setSelected([]);
    setTool(t);
    setPalette(null);
    setRightMenu(null);
    setZoomMenu(false);
  };
  const history = (redo = false) => {
    setSelectedLabel(null);
    finishEdit();
    setPendingConnection(null);
    setHoverSide(null);
    setGuides([]);
    if (redo) store.redo();
    else store.undo();
    setSelected([]);
  };
  const zoom = (z: number, anchor?: Point) => {
    const r = svg.current?.getBoundingClientRect();
    const a = anchor || {
      x: (r?.width || 1000) / 2,
      y: (r?.height || 800) / 2,
    };
    setView((v) => {
      z = Math.min(4, Math.max(0.2, z));
      return {
        z,
        x: a.x - ((a.x - v.x) * z) / v.z,
        y: a.y - ((a.y - v.y) * z) / v.z,
      };
    });
  };
  const fit = () => {
    const b = bounds(
      doc,
      [...doc.nodes, ...doc.edges].map((n) => n.id),
    );
    const r = svg.current?.getBoundingClientRect();
    if (!b || !r) {
      setView({ x: 0, y: 0, z: 1 });
      return;
    }
    const z = Math.min(
      1.5,
      Math.max(
        0.2,
        Math.min(
          (r.width - 220) / Math.max(b.w, 1),
          (r.height - 220) / Math.max(b.h, 1),
        ),
      ),
    );
    setView({
      z,
      x: (r.width - b.w * z) / 2 - b.x * z,
      y: (r.height - b.h * z) / 2 - b.y * z,
    });
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.matches("textarea,input,select") ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpace(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history(e.shiftKey);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history(true);
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        ["b", "i"].includes(e.key.toLowerCase()) &&
        selected.length
      ) {
        e.preventDefault();
        const n = current.current.nodes.find((n) => selected.includes(n.id));
        if (n)
          updateNodes(
            e.key.toLowerCase() === "b"
              ? { bold: !n.bold }
              : { italic: !n.italic },
          );
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selected.length) duplicate();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        zoom(1);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setSelectedLabel(null);
        setSelected([...doc.nodes, ...doc.edges].map((n) => n.id));
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (selected.length) remove();
      }
      if (e.key === "Escape" && gesture.current) {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key === "Escape" && pendingConnection) {
        e.preventDefault();
        setPendingConnection(null);
        return;
      }
      if(e.key==="Enter" && !pendingConnection && selected.length===1){
        const edge=current.current.edges.find(edge=>edge.id===selected[0]);
        if(edge){e.preventDefault();startLabelEdit(edge,selectedLabel??undefined);return;}
      }
      if (e.key === "Enter" && pendingConnection) {
        e.preventDefault();
        createPending();
        return;
      }
      if (e.key === "Escape") {
        setSelectedLabel(null);
        setSelected([]);
        setPalette(null);
        setTool("select");
        setHelp(false);
        setRightMenu(null);
        setZoomMenu(false);
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const shortcuts: Record<string, Tool> = {
          v: "select",
          n: "note",
          r: "rect",
          o: "ellipse",
          t: "text",
          l: "edge",
        };
        if (shortcuts[e.key.toLowerCase()])
          choose(shortcuts[e.key.toLowerCase()]);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false);
    };
    const blur = () => setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (gesture.current) return;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoom(view.z * Math.exp(-e.deltaY * 0.005), {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [view]);
  const begin = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly && !space && e.button !== 1) return;
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as Element).closest("foreignObject")) return;
    e.preventDefault();
    setRightMenu(null);
    setZoomMenu(false);
    setPendingConnection(null);
    finishEdit();
    setPalette(null);
    svg.current?.focus();
    svg.current?.setPointerCapture(e.pointerId);
    const p = point(e),
      target = (e.target as Element).closest("[data-id], [data-edge-id]"),
      id = target?.getAttribute("data-id") || target?.getAttribute("data-edge-id") || undefined,
      corner = (e.target as Element).getAttribute("data-corner");
    const g: Gesture = {
      type: "marquee",
      start: p,
      screen: { x: e.clientX, y: e.clientY },
      before: current.current,
      ids: selected,
      view: { ...view },
      shift: e.shiftKey,
      pointerId: e.pointerId,
    };
    if (space || e.button === 1) {
      g.type = "pan";
      gesture.current = g;
      return;
    }
    const edgeEnd=(e.target as Element).closest("[data-edge-endpoint]")?.getAttribute("data-edge-endpoint") as "from"|"to"|null;
    if(edgeEnd && id && tool==="select" && current.current.edges.some(edge=>edge.id===id)){
      g.type="reconnect";g.id=id;g.edgeEnd=edgeEnd;
      setSelected([id]);setSelectedLabel(null);setConnecting(true);gesture.current=g;return;
    }
    const labelId=(e.target as Element).closest("[data-label-id]")?.getAttribute("data-label-id");
    if(labelId && id && tool==="select"){
      g.type="label";g.id=id;g.labelId=labelId;
      setSelected([id]);setSelectedLabel(labelId);gesture.current=g;return;
    }
    setSelectedLabel(null);
    const connectionSide = (e.target as Element)
      .closest("[data-connection-side]")
      ?.getAttribute("data-connection-side") as Side | null;
    if (connectionSide && selected.length === 1) {
      const source = current.current.nodes.find((n) => n.id === selected[0]);
      if (source) {
        g.type = "quick";
        g.sourceId = source.id;
        g.side = connectionSide;
        g.from = {
          nodeId: source.id,
          binding:"fixed",
          side: connectionSide,
          point: endpoint(
            { nodeId: source.id, side: connectionSide, point: p },
            current.current,
          ),
        };
        gesture.current = g;
        return;
      }
    }
    if (corner && selection) {
      g.type = "resize";
      g.corner = corner;
      gesture.current = g;
      return;
    }
    if (tool === "edge") {
      g.type = "edge";
      g.from = attach(p, current.current);
      setDraftEdge({
        id: "draft",
        from: g.from,
        to: { point: p },
        style: lineStyle,
        arrow: lineArrow,
      });
      gesture.current = g;
      return;
    }
    if (tool === "note" || tool === "text") {
      g.type = "place";
      g.kind = tool;
      gesture.current = g;
      return;
    }
    if (["rect", "ellipse", "diamond", "triangle"].includes(tool)) {
      const node: BoardNode = {
        id: newId(),
        kind: tool as NodeKind,
        x: p.x,
        y: p.y,
        w: 1,
        h: 1,
        text: "",
        fill: "transparent",
      };
      g.type = "create";
      g.id = node.id;
      replace({ ...current.current, nodes: [...current.current.nodes, node] });
      setSelected([node.id]);
      gesture.current = g;
      return;
    }
    if (id) {
      g.type = "move";
      g.id = id;
      let ids = selected;
      if (e.shiftKey) {
        ids = selected.includes(id)
          ? selected.filter((i) => i !== id)
          : [...selected, id];
      } else if (!selected.includes(id)) ids = [id];
      setSelected(ids);
      g.ids = ids;
      gesture.current = g;
      return;
    }
    if (!e.shiftKey) setSelected([]);
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    gesture.current = g;
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(e),
      dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    if (g.type === "pan") {
      setView({
        ...g.view,
        x: g.view.x + e.clientX - g.screen.x,
        y: g.view.y + e.clientY - g.screen.y,
      });
      return;
    }
    if(g.type==="reconnect"){
      if(Math.hypot(e.clientX-g.screen.x,e.clientY-g.screen.y)<=3)return;
      const result=reconnectEndpoint(current.current,g.id!,g.edgeEnd!,p,view.z);
      replace(result.doc);setTargetId(result.targetId);return;
    }
    if(g.type==="label"){
      if(Math.hypot(e.clientX-g.screen.x,e.clientY-g.screen.y)<3)return;
      const original=g.before.edges.find(edge=>edge.id===g.id), edge=current.current.edges.find(edge=>edge.id===g.id);
      const label=original?.labels?.find(label=>label.id===g.labelId);
      if(!original||!edge||!label)return;
      const anchor=edgePointAt(original,g.before,label.position);
      const position=edgePositionAt(edge,current.current,{x:anchor.x+dx,y:anchor.y+dy});
      replace({...current.current,edges:current.current.edges.map(e=>e.id===g.id?{...e,labels:e.labels?.map(l=>l.id===g.labelId?{...l,position}:l)}:e)});
      return;
    }
    if (g.type === "marquee") {
      setMarquee({
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      });
      return;
    }
    if (g.type === "quick") {
      if (Math.hypot(e.clientX - g.screen.x, e.clientY - g.screen.y) > 4) {
        const to = connectionTarget(current.current, p, g.sourceId!, view.z);
        setConnecting(true);
        setDraftEdge({ id: "draft", from: g.from!, to, style: "elbow" });
        setTargetId(to.nodeId);
      }
      return;
    }
    if (g.type === "edge") {
      setDraftEdge({
        id: "draft",
        from: g.from!,
        to: attach(p, current.current),
        style: lineStyle,
        arrow: lineArrow,
      });
      return;
    }
    if (g.type === "create") {
      replace({
        ...current.current,
        nodes: current.current.nodes.map((n) =>
          n.id === g.id
            ? {
                ...n,
                x: Math.min(g.start.x, p.x),
                y: Math.min(g.start.y, p.y),
                w: Math.max(1, Math.abs(dx)),
                h: Math.max(1, Math.abs(dy)),
              }
            : n,
        ),
      });
      return;
    }
    if (g.type === "move") {
      if (!g.ids.length) return;
      const b = bounds(g.before, g.ids);
      const refs = visibleReferences(g.before, g.ids, viewport);
      const aligned = b
        ? alignMove({ ...b, x: b.x + dx, y: b.y + dy }, refs, view.z)
        : { dx: 0, dy: 0, guides: [] };
      const moveX = dx + aligned.dx,
        moveY = dy + aligned.dy;
      setGuides(aligned.guides);
      replace({
        ...g.before,
        nodes: g.before.nodes.map((n) =>
          g.ids.includes(n.id) ? { ...n, x: n.x + moveX, y: n.y + moveY } : n,
        ),
        edges: g.before.edges.map((edge) =>
          g.ids.includes(edge.id)
            ? {
                ...edge,
                from: edge.from.nodeId
                  ? edge.from
                  : {
                      ...edge.from,
                      point: {
                        x: edge.from.point.x + moveX,
                        y: edge.from.point.y + moveY,
                      },
                    },
                to: edge.to.nodeId
                  ? edge.to
                  : {
                      ...edge.to,
                      point: {
                        x: edge.to.point.x + moveX,
                        y: edge.to.point.y + moveY,
                      },
                    },
              }
            : edge,
        ),
      });
      return;
    }
    if (g.type === "resize") {
      const b = bounds(g.before, g.ids);
      if (!b) return;
      const proportional =
        (g.ids.length === 1 &&
          g.before.nodes.find((n) => n.id === g.ids[0])?.kind === "note") ||
        e.shiftKey;
      const raw = resizeBox(b, g.corner!, { x: dx, y: dy }, proportional);
      const result = resizeGuides(
        raw,
        b,
        g.corner!,
        visibleReferences(g.before, g.ids, viewport),
        view.z,
        proportional,
      );
      const { x, y, w, h } = result.box;
      setGuides(result.guides);
      const sx = w / Math.max(b.w, 1),
        sy = h / Math.max(b.h, 1);
      const transform = (p: Point) => ({
        x: x + (p.x - b.x) * sx,
        y: y + (p.y - b.y) * sy,
      });
      replace({
        ...g.before,
        nodes: g.before.nodes.map((n) =>
          g.ids.includes(n.id)
            ? { ...n, ...transform(n), w: n.w * sx, h: n.h * sy }
            : n,
        ),
        edges: g.before.edges.map((edge) =>
          g.ids.includes(edge.id)
            ? {
                ...edge,
                from: edge.from.nodeId
                  ? edge.from
                  : { ...edge.from, point: transform(edge.from.point) },
                to: edge.to.nodeId
                  ? edge.to
                  : { ...edge.to, point: transform(edge.to.point) },
              }
            : edge,
        ),
      });
    }
  };
  const end = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    const p = point(e);
    setGuides([]);
    setConnecting(false);
    setTargetId(undefined);
    setDraftEdge(null);
    setHoverSide(null);
    if (g.type === "quick") {
      const source = current.current.nodes.find((n) => n.id === g.sourceId);
      if (!source) return;
      if (Math.hypot(e.clientX - g.screen.x, e.clientY - g.screen.y) <= 5) {
        quickCreate(g.side!);
      } else if (!(
        p.x >= source.x &&
        p.x <= source.x + source.w &&
        p.y >= source.y &&
        p.y <= source.y + source.h
      )) {
        const to = connectionTarget(current.current, p, source.id, view.z);
        const edge: Edge = {
          id: newId(),
          from: g.from!,
          to,
          style: "elbow",
        };
        commit({ ...current.current, edges: [...current.current.edges, edge] });
        setSelected([edge.id]);
        if (!to.nodeId)
          setPendingConnection({
            sourceId: source.id,
            edgeId: edge.id,
            side: incomingSide(g.start, p),
            point: p,
            screen: { x: e.clientX, y: e.clientY },
          });
      }
      if (svg.current?.hasPointerCapture(e.pointerId))
        svg.current.releasePointerCapture(e.pointerId);
      return;
    }

    if(g.type==="reconnect"){
      if(Math.hypot(e.clientX-g.screen.x,e.clientY-g.screen.y)>3){
        const result=reconnectEndpoint(current.current,g.id!,g.edgeEnd!,p,view.z);
        replace(result.doc);record(g.before);
      }else replace(g.before);
    } else if (g.type === "place") {
      const node: BoardNode = {
        id: newId(),
        kind: g.kind!,
        x: g.start.x - (g.kind === "note" ? 50 : 0),
        y: g.start.y - (g.kind === "note" ? 50 : 0),
        w: g.kind === "note" ? 100 : 70,
        h: g.kind === "note" ? 100 : 60,
        text: "",
        fill: g.kind === "note" ? color : "transparent",
      };
      commit({ ...current.current, nodes: [...current.current.nodes, node] });
      startEdit(node);
    } else if (g.type === "marquee") {
      const b = {
        x: Math.min(p.x, g.start.x),
        y: Math.min(p.y, g.start.y),
        w: Math.abs(p.x - g.start.x),
        h: Math.abs(p.y - g.start.y),
      };
      if (b.w > 0 || b.h > 0) {
        const ids = [...doc.nodes, ...doc.edges]
          .filter((n) => {
            const a = bounds(doc, [n.id]);
            return (
              a &&
              a.x < b.x + b.w &&
              a.y < b.y + b.h &&
              a.x + a.w > b.x &&
              a.y + a.h > b.y
            );
          })
          .map((n) => n.id);
        setSelected(g.shift ? [...new Set([...g.ids, ...ids])] : ids);
      }
      setMarquee(null);
    } else if (g.type === "edge") {
      const to = attach(p, current.current);
      if (
        Math.hypot(p.x - g.start.x, p.y - g.start.y) > 8 &&
        (!g.from!.nodeId || g.from!.nodeId !== to.nodeId)
      ) {
        const edge: Edge = {
          id: newId(),
          from: g.from!,
          to,
          style: lineStyle,
          arrow: lineArrow,
        };
        commit({ ...current.current, edges: [...current.current.edges, edge] });
        setSelected([edge.id]);
      }
      setDraftEdge(null);
      setTool("select");
    } else if (g.type === "create") {
      const next = {
        ...current.current,
        nodes: current.current.nodes.map((n) =>
          n.id === g.id && n.w < 5 && n.h < 5 ? { ...n, w: 200, h: 120 } : n,
        ),
      };
      replace(next);
      record(g.before);
      setTool("select");
    } else if (g.type === "move" || g.type === "resize" || g.type === "label") record(g.before);
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  };
  const cancel = () => {
    const g = gesture.current;
    if (g && g.type !== "pan") {
      replace(g.before);
      setSelected(
        g.ids.filter((id) =>
          [...g.before.nodes, ...g.before.edges].some((n) => n.id === id),
        ),
      );
    }
    if (
      g?.pointerId !== undefined &&
      svg.current?.hasPointerCapture(g.pointerId)
    )
      svg.current.releasePointerCapture(g.pointerId);
    gesture.current = null;
    setGuides([]);
    setConnecting(false);
    setTargetId(undefined);
    setHoverSide(null);
    setMarquee(null);
    setDraftEdge(null);
  };
  const selectedNodes = doc.nodes.filter((n) => selected.includes(n.id));
  return (
    <main className="workspace">
      <a href="/" className="board-home" aria-label="Zur Boardübersicht" title="Zur Boardübersicht" onClick={async(e)=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();finishEdit();try{await collaboration.flush();location.assign("/");}catch(error){setMessage((error as Error).message);}}}><LayoutDashboard size={18} /></a>
      <header className="topbar">
        <div className="brand">
           <span>whiteboard</span>
        </div>
        <span className="divider" />
        <input
          className="boardtitle"
          aria-label="Boardname"
          readOnly={readOnly}
          value={doc.title}
          onChange={(e) => commit({ ...doc, title: e.target.value })}
        />

        <div className="top-actions">
          {collaboration.session && <div className="presence-list" aria-label={`${collaboration.members.length + 1} Personen auf diesem Board`}>
            <span className="presence-avatar" title="Du" style={{background: collaboration.identity.current?.color}}>Du</span>
            {collaboration.members.map(p => <span className="presence-avatar" key={p.id} title={p.name} style={{background:p.color}}>{p.name.slice(-2)}</span>)}
          </div>}
          {readOnly && <span className="read-only-status">Nur ansehen</span>}
          <button className="export" disabled={shareBusy || readOnly || !!collaboration.session && !collaboration.session.isOwner} onClick={async () => {
            finishEdit(); setShareOpen(true); setShareBusy(true); setShareError("");
            try { await collaboration.share(); } catch(e) { setShareError((e as Error).message); } finally { setShareBusy(false); }
          }}><Share2 size={16} /><span>Teilen</span></button>
        </div>
      </header>
      <aside className="toolrail" aria-label="Zeichenwerkzeuge">
        {(["select", "note", "text", "rect", "edge"] as const).map(
          (t) => {
            const Icon = icons[t];
            const active =
              tool === t ||
              (t === "rect" &&
                ["ellipse", "diamond", "triangle"].includes(tool));
            return (
              <button
                key={t}
                disabled={readOnly && t !== "select"}
                aria-label={t === "rect" ? "Formen und Linien" : labels[t]}
                title={`${labels[t]} · ${{ select: "V", note: "N", rect: "R", text: "T", edge: "L" }[t]}`}
                className={active ? "tool active" : "tool"}
                onClick={() => {
                  finishEdit();
                  if (t === "note" || t === "rect") {
                    setPalette((p) =>
                      p === (t === "note" ? "note" : "shape")
                        ? null
                        : t === "note"
                          ? "note"
                          : "shape",
                    );
                    setTool(t);
                  } else choose(t);
                }}
              >
                <Icon size={22} />
                {t === "note" && <i style={{ background: color }} />}
              </button>
            );
          },
        )}
        <span className="rail-divider" />
        <button
          className="tool"
          aria-label="Rückgängig machen"
          title="Rückgängig · ⌘/Strg Z"
          disabled={readOnly || !store.canUndo}
          onClick={() => history()}
        >
          <Undo2 size={21} />
        </button>
        <button
          className="tool"
          aria-label="Wiederherstellen"
          title="Wiederherstellen · ⌘/Strg ⇧ Z"
          disabled={readOnly || !store.canRedo}
          onClick={() => history(true)}
        >
          <Redo2 size={21} />
        </button>
      </aside>
      {palette && (
        <div
          className={`palette ${palette === "note" ? "note-palette" : "shape-palette"}`}
          role="dialog"
          aria-label={palette === "note" ? "Notizen" : "Formen und Linien"}
        >
          {palette === "note" ? (
            <>
              <div className="swatches">
                {colors.map(([name, c, adjective]) => (
                  <button
                    key={c}
                    aria-label={`${adjective} Notiz anbringen`}
                    title={name}
                    style={{ background: c }}
                    className={color === c ? "chosen" : ""}
                    onClick={() => {
                      setColor(c);
                      choose("note");
                    }}
                  >
                    {color === c && <Check size={16} />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div className="line-options">
                {(
                  [
                    ["Linie", "straight", false],
                    ["Pfeil", "curve", true],
                    ["Gewinkelter Pfeil", "elbow", true],
                  ] as const
                ).map(([name, style, arrow]) => (
                  <button
                    key={name}
                    onClick={() => {
                      setLineStyle(style);
                      setLineArrow(arrow);
                      choose("edge");
                    }}
                  >
                    <ArrowUpRight size={21} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
              <div className="shape-options">
                {(["rect", "ellipse", "diamond", "triangle"] as const).map(
                  (t, i) => {
                    const Icon = [Square, Circle, Diamond, Triangle][i];
                    return (
                      <button key={t} onClick={() => choose(t)}>
                        <Icon size={23} />
                        {labels[t]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {selected.length > 0 && toolbarBox && (
        <SelectionToolbar
          key={selected.join(",")}
          nodes={selectedNodes}
          edges={doc.edges.filter((e) => selected.includes(e.id))}
          count={selected.length}
          position={{
            left: (toolbarBox.x + toolbarBox.w / 2) * view.z + view.x,
            top: Math.max(66, toolbarBox.y * view.z + view.y - 118),
          }}
          updateNodes={updateNodes}
          resizeNotes={resizeNotes}
          updateEdges={updateEdges}
          label={chosenLabel}
          updateLabel={updateLabel}
          addLabel={()=>{const edge=doc.edges.find(e=>e.id===selected[0]);if(edge)startLabelEdit(edge);}}
          editLabel={()=>{if(labelEdge&&chosenLabel)startLabelEdit(labelEdge,chosenLabel.id);}}
          canAddLabel={selected.length===1 && !!doc.edges.find(e=>e.id===selected[0])}
          duplicate={duplicate}
          remove={remove}
        />
      )}
      {rightMenu && (
        <div
          className="right-menu"
          role="menu"
          aria-label="Objektaktionen"
          style={{ left: rightMenu.x, top: rightMenu.y }}
        >
          <button role="menuitem" onClick={duplicate}>
            <Copy size={16} />
            Duplizieren<kbd>⌘/Strg D</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              remove();
              setRightMenu(null);
            }}
          >
            <Trash2 size={16} />
            Löschen<kbd>⌫</kbd>
          </button>
          <hr />
          <button
            role="menuitem"
            onClick={() => {
              updateNodes({ text: "" });
              setRightMenu(null);
            }}
            disabled={!selectedNodes.length}
          >
            Inhalte löschen
          </button>
          <hr />
          <button
            role="menuitem"
            onClick={() => reorder(true)}
            disabled={!selectedNodes.length}
          >
            <ArrowUpToLine size={16} />
            In den Vordergrund
          </button>
          <button
            role="menuitem"
            onClick={() => reorder(false)}
            disabled={!selectedNodes.length}
          >
            <ArrowDownToLine size={16} />
            In den Hintergrund
          </button>
        </div>
      )}
      {pendingConnection && (
        <div
          className="quick-create-menu"
          role="menu"
          aria-label="Verbundenes Objekt erstellen"
          style={{
            left: Math.max(
              64,
              Math.min(
                pendingConnection.screen.x - 74,
                (svg.current?.clientWidth ?? 1440) - 164,
              ),
            ),
            top: Math.max(
              64,
              Math.min(
                pendingConnection.screen.y - 40,
                (svg.current?.clientHeight ?? 1000) - 230,
              ),
            ),
          }}
        >
          <button
            className="same-object"
            role="menuitem"
            onClick={() => createPending()}
          >
            Dasselbe Objekt hinzufügen <kbd>↵</kbd>
          </button>
          <div className="quick-shapes">
            {(
              [
                "text",
                "note",
                "rect",
                "ellipse",
                "diamond",
                "triangle",
              ] as const
            ).map((kind, i) => {
              const Icon = [
                Type,
                StickyNote,
                Square,
                Circle,
                Diamond,
                Triangle,
              ][i];
              return (
                <button
                  role="menuitem"
                  key={kind}
                  aria-label={`${labels[kind]} verbunden erstellen`}
                  onClick={() => createPending(kind)}
                >
                  <Icon size={22} />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <CanvasScene doc={doc} draftEdge={draftEdge} selected={selected} editing={editing} view={view} grid={showGrid} selectedLabel={chosenLabel?.id} />
      <svg
        ref={svg}
        className={`canvas ${connecting ? "connecting" : ""} ${space ? "panning" : tool !== "select" ? "creating" : ""}`}
        aria-label="Zeichenfläche"
        role="application"
        tabIndex={0}
        data-tool={tool}
        onContextMenu={(e) => {
          e.preventDefault();
          if(readOnly)return;
          finishEdit();
          const hit = point(e);
          const n = [...doc.nodes]
            .reverse()
            .find(
              (n) =>
                hit.x >= n.x &&
                hit.x <= n.x + n.w &&
                hit.y >= n.y &&
                hit.y <= n.y + n.h,
            );
          const id =
            (e.target as Element)
              .closest("[data-id]")
              ?.getAttribute("data-id") ?? n?.id;
          if (id) {
            if (!selected.includes(id)) setSelected([id]);
            setRightMenu({
              x: Math.min(e.clientX, svg.current!.clientWidth - 260),
              y: Math.min(e.clientY, svg.current!.clientHeight - 230),
            });
          } else setRightMenu(null);
        }}
        onPointerDown={begin}
        onPointerMove={(e) => { collaboration.cursor.current = point(e); move(e); }}
        onPointerLeave={() => { collaboration.cursor.current = null; }}
        onPointerUp={end}
        onPointerCancel={cancel}
        onDoubleClick={(e) => {
          if(tool!=="select"||readOnly)return;
          const id=(e.target as Element).closest("[data-id]")?.getAttribute("data-id");
          const hit=point(e);
          const node=doc.nodes.find(n=>n.id===id)??[...doc.nodes].reverse().find(n=>hit.x>=n.x&&hit.x<=n.x+n.w&&hit.y>=n.y&&hit.y<=n.y+n.h);
          const labelAt=(edge:Edge)=>edge.labels?.find(label=>{const box=edgeLabelLayout(edge,label,doc);return hit.x>=box.x&&hit.x<=box.x+box.w&&hit.y>=box.y&&hit.y<=box.y+box.h;});
          const edge=doc.edges.find(edge=>edge.id===id)??(!node?[...doc.edges].reverse().find(edge=>{
            if(labelAt(edge))return true;
            const anchor=edgePointAt(edge,doc,edgePositionAt(edge,doc,hit));
            return Math.hypot(hit.x-anchor.x,hit.y-anchor.y)<=9/view.z;
          }):undefined);
          if(edge){
            const labelId=(e.target as Element).closest("[data-label-id]")?.getAttribute("data-label-id")??labelAt(edge)?.id;
            startLabelEdit(edge,labelId,edgePositionAt(edge,doc,hit));
          } else if(node)startEdit(node);
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={80 * view.z}
            height={80 * view.z}
            patternUnits="userSpaceOnUse"
            x={view.x}
            y={view.y}
          >
            <path
              d={`M ${20 * view.z} 0 V ${80 * view.z} M ${40 * view.z} 0 V ${80 * view.z} M ${60 * view.z} 0 V ${80 * view.z} M 0 ${20 * view.z} H ${80 * view.z} M 0 ${40 * view.z} H ${80 * view.z} M 0 ${60 * view.z} H ${80 * view.z}`}
              stroke="#eaeaea"
              strokeWidth=".5"
              fill="none"
            />
            <path
              d={`M ${80 * view.z} 0 H 0 V ${80 * view.z}`}
              stroke="#dfdfdf"
              strokeWidth=".7"
              fill="none"
            />
          </pattern>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
          <filter id="note-shadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="#000000"
              floodOpacity=".12"
            />
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="transparent"
        />
        <g
          data-testid="viewport"
          transform={`translate(${view.x} ${view.y}) scale(${view.z})`}
        >
          <BoardScene
            doc={doc}
            draftEdge={draftEdge}
            selected={selected}
            selection={selection}
            editing={editing}
            view={view}
          />
          <InteractionOverlay
            doc={doc}
            source={
              selected.length === 1 && tool === "select"
                ? doc.nodes.find(
                    (n) => n.id === selected[0] && n.kind === "note",
                  )
                : undefined
            }
            hover={hoverSide}
            zoom={view.z}
            viewport={viewport}
            guides={guides}
            targetId={targetId}
            connecting={connecting}
            disabled={!!editing || space || !!pendingConnection}
            onHover={setHoverSide}
            onActivate={quickCreate}
          />
          {marquee && (
            <rect
              data-testid="marquee"
              {...{
                x: marquee.x,
                y: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
              fill="#4262ff10"
              stroke="#4262ff"
              strokeWidth={1 / view.z}
            />
          )}
          {activeLabel && activeLabelBox && editingEdge && <foreignObject x={activeLabelBox.x} y={activeLabelBox.y} width={activeLabelBox.w} height={activeLabelBox.h} className="edge-label-editor-wrapper">
            <textarea ref={textarea} aria-label="Verbindungstext bearbeiten" value={draft} placeholder="Text" spellCheck={false}
              style={{fontSize:activeLabelBox.fontSize,lineHeight:`${activeLabelBox.lineHeight}px`,color:activeLabel.color??"#253c32"}}
              onChange={e=>{
                const text=e.target.value;setDraft(text);
                replace({...current.current,edges:current.current.edges.map(edge=>edge.id===editingEdge.id?{...edge,labels:edge.labels?.map(label=>label.id===editing?{...label,text}:label)}:edge)});
              }}
              onBlur={finishEdit}
              onKeyDown={e=>{
                e.stopPropagation();
                if(e.key==="Escape" || e.key==="Enter"&&!e.shiftKey){e.preventDefault();finishEdit();svg.current?.focus();}
              }}
            />
          </foreignObject>}
          {activeNode && (
            <foreignObject
              x={activeNode.x}
              y={activeNode.y}
              width={activeNode.w}
              height={activeNode.h}
              className="editor-wrapper"
            >
              <textarea
                ref={textarea}
                aria-label="Objekttext bearbeiten"
                value={draft}
                placeholder="Hier eintragen …"
                style={editorStyle(activeNode, draft)}
                onChange={(e) => {
                  setDraft(e.target.value);
                  replace({
                    ...current.current,
                    nodes: current.current.nodes.map((n) =>
                      n.id === editing
                        ? {
                            ...n,
                            text: e.target.value,
                            h: fitTextHeight(n, e.target.value),
                          }
                        : n,
                    ),
                  });
                }}
                onBlur={finishEdit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (
                    (e.metaKey || e.ctrlKey) &&
                    ["b", "i"].includes(e.key.toLowerCase())
                  ) {
                    e.preventDefault();
                    updateNodes(
                      e.key.toLowerCase() === "b"
                        ? { bold: !activeNode.bold }
                        : { italic: !activeNode.italic },
                    );
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    finishEdit();
                    svg.current?.focus();
                  }
                }}
              />
            </foreignObject>
          )}
        </g>
      </svg>
      <div className="remote-cursors" aria-hidden="true">
        {collaboration.members.filter(p => p.point).map(p => <div key={p.id} className="remote-cursor" data-testid="remote-cursor" style={{left:p.point!.x*view.z+view.x,top:p.point!.y*view.z+view.y,color:p.color}}>
          <MousePointer2 size={23} fill={p.color} stroke="white" strokeWidth={1.5}/><span style={{background:p.color}}>{p.name}</span>
        </div>)}
      </div>
      {localStore.removed && <div className="collaboration-error" role="alert">Dieses lokale Board wurde gelöscht. Kehre zur Boardübersicht zurück.</div>}
      {collaboration.error && <div className="collaboration-error" role="alert">{collaboration.error}{collaboration.authRequired && <> · <a href="/api/auth/github">Mit GitHub anmelden</a></>}{!collaboration.accessLost && " · Die Verbindung wird erneut versucht."}</div>}
      {shareOpen && <div className="share-backdrop" onClick={() => setShareOpen(false)}>
        <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape")setShareOpen(false);}}>
          <button className="share-close" aria-label="Freigabe schließen" autoFocus onClick={()=>setShareOpen(false)}><X size={20}/></button>
          <h2 id="share-title">„{doc.title}“ teilen</h2>
          <p>Lade andere ein, gemeinsam auf diesem Board zu arbeiten.</p>
          <label htmlFor="share-role">Jeder mit diesem Link</label>
          <select id="share-role" value={collaboration.shareRole} disabled={shareBusy || !collaboration.session?.isOwner} onChange={async(e)=>{
            const permission=e.target.value as "edit"|"view";
            setShareBusy(true);setShareError("");
            try{await collaboration.setPermission(permission);setMessage("Gastberechtigung gespeichert");}
            catch(error){setShareError((error as Error).message);}
            finally{setShareBusy(false);}
          }}><option value="edit">Kann bearbeiten</option><option value="view">Kann ansehen</option></select>
          <label htmlFor="share-link">Freigabelink</label>
          <input id="share-link" readOnly value={shareLink} onFocus={e=>e.target.select()} />
          <button className="export" disabled={shareBusy || !shareLink} onClick={async()=>{try{await navigator.clipboard.writeText(shareLink);setMessage("Freigabelink kopiert");}catch{setShareError("Bitte den Link im Feld markieren und kopieren.");}}}>{shareBusy?"Freigabe wird gespeichert …":"Link kopieren"}</button>
          {collaboration.legacyLinkReplaced && <p role="status">Der bisherige Bearbeitungslink wurde ersetzt. Bitte kopiere diesen neuen Gastlink für deine Gäste.</p>}
          <p>Die Auswahl wird gespeichert und gilt auch für bereits geöffnete Gastfenster. Dein eigener Besitzerzugriff bleibt erhalten.</p>
          {shareError && <p role="alert">{shareError}</p>}
        </section>
      </div>}
      {doc.nodes.length === 0 && doc.edges.length === 0 && store.ready && !readOnly && (
        <div className="empty-state">
          <button onClick={() => choose("note")}>
            <Plus size={17} /> Erste Notiz anlegen
          </button>
        </div>
      )}
      {zoomMenu && (
        <div className="zoom-menu" role="menu" aria-label="Zoom und Navigation">
          <button
            role="menuitem"
            onClick={() => {
              fit();
              setZoomMenu(false);
            }}
          >
            An Bildschirm anpassen
          </button>
          {[0.5, 0.7, 1, 2, 4].map((z) => (
            <button
              key={z}
              role="menuitem"
              onClick={() => {
                zoom(z);
                setZoomMenu(false);
              }}
            >
              {Math.round(z * 100)} %
            </button>
          ))}
          <hr />
          <button
            role="menuitemcheckbox"
            aria-checked={showGrid}
            onClick={() => setShowGrid((v) => !v)}
          >
            Raster {showGrid ? "✓" : ""}
          </button>
        </div>
      )}
      <div className="bottom-controls">
        <span className="divider" />
        <button
          aria-label="Alles anzeigen"
          title="Alles anzeigen"
          onClick={fit}
        >
          <Maximize size={18} />
        </button>
        <button
          aria-label="Verkleinern"
          onClick={() => zoom(view.z / 1.25)}
          disabled={view.z <= 0.2}
        >
          <Minus size={18} />
        </button>
        <button
          className="zoom-value"
          aria-label="Zoom und Navigation"
          title="Zoom und Navigation"
          aria-expanded={zoomMenu}
          onClick={() => setZoomMenu((v) => !v)}
        >
          {Math.round(view.z * 100)} %
        </button>
        <button
          aria-label="Vergrößern"
          onClick={() => zoom(view.z * 1.25)}
          disabled={view.z >= 4}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Hilfe"
          title="Bedienung und Tastenkürzel"
          onClick={() => setHelp(true)}
        >
          <HelpCircle size={19} />
        </button>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Bedienung"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Schließen"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">DEIN RAUM. DEIN TEMPO.</span>
            <h2>Ein bisschen Orientierung.</h2>
            <dl>
              <dt>Werkzeuge</dt>
              <dd>
                V Auswahl · N Notiz · R Rechteck · T Text · L Pfeil
              </dd>
              <dt>Schreiben</dt>
              <dd>Doppelklick zum Bearbeiten, Escape zum Beenden.</dd>
              <dt>Mehrere Objekte</dt>
              <dd>
                Rahmen aufziehen oder Shift + Klick. Gemeinsam ziehen, skalieren
                und löschen.
              </dd>
              <dt>Verbindungen</dt>
              <dd>
                Pfeil vom Rand eines Objekts zum Rand eines anderen ziehen.
              </dd>
              <dt>Navigation</dt>
              <dd>
                Leertaste + Ziehen. Mausrad verschiebt, Strg/⌘ +
                Mausrad zoomt.
              </dd>
              <dt>Verlauf</dt>
              <dd>⌘/Strg + Z rückgängig · ⇧ + ⌘/Strg + Z wiederherstellen.</dd>
              <dt>Deine Daten</dt>
              <dd>
                Automatisch in diesem Browser gespeichert. JSON exportieren als
                Sicherung; Import ersetzt das Board und lässt sich rückgängig
                machen.
              </dd>
            </dl>
            <p className="help-note">
              Lokale Einzelplatzversion · ohne Anmeldung. Keine
              Synchronisierung, dauerhaften Gruppen, Rotation oder Touch-Gesten.
            </p>
          </section>
        </div>
      )}
      {message && (
        <div className="toast" role="alert">
          {message}
          <button aria-label="Hinweis schließen" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
