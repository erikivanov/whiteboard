"use client";
import { useEffect, useRef, useState } from "react";
import { BoardDocument, bounds } from "@/lib/document";
import CanvasScene from "./CanvasScene";
import { Layout } from "lucide-react";

export default function BoardThumbnail({ doc }: { doc: BoardDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 180 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  const box = bounds(doc, [...doc.nodes, ...doc.edges].map((n) => n.id));
  const z = box ? Math.max(0.001, Math.min(1, (size.w - 48) / Math.max(box.w, 1), (size.h - 40) / Math.max(box.h, 1))) : 1;
  const view = box ? {
    x: (size.w - box.w * z) / 2 - box.x * z,
    y: (size.h - box.h * z) / 2 - box.y * z, z,
  } : { x: 0, y: 0, z: 1 };
  return <div className="board-thumbnail" ref={ref} aria-hidden="true">
    {box ? <CanvasScene doc={doc} draftEdge={null} selected={[]} editing={null} view={view} grid={false} /> :
      <div className="thumbnail-empty"><Layout size={30} strokeWidth={1.1} /><span>Raum für deine Ideen</span></div>}
  </div>;
}
