"use client";
import { useEffect, useRef } from "react";
import { BoardDocument, Edge, edgePath, connectionGeometry, edgeLabelLayout } from "@/lib/document";
import { nodeTextLayout } from "@/lib/presentation";
export default function CanvasScene({doc, draftEdge, selected, editing, view, grid, selectedLabel}: {
  doc: BoardDocument; draftEdge: Edge | null; selected: string[]; editing: string | null;
  view: {x:number;y:number;z:number}; grid:boolean; selectedLabel?:string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const {width, height} = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      const c = canvas.getContext("2d")!;
      c.scale(ratio, ratio); c.clearRect(0,0,width,height);
      if(grid) {
        const step=20*view.z; c.lineWidth=.5; c.strokeStyle="#e4e4e4"; c.beginPath();
        for(let x=((view.x%step)+step)%step;x<width;x+=step){c.moveTo(x,0);c.lineTo(x,height);}
        for(let y=((view.y%step)+step)%step;y<height;y+=step){c.moveTo(0,y);c.lineTo(width,y);}
        c.stroke();
      }
      c.translate(view.x,view.y); c.scale(view.z,view.z);
      for(const edge of [...doc.edges,...(draftEdge?[draftEdge]:[])]) {
        c.save();
        for(const label of edge.labels??[]){
          if(!label.text.trim() && editing!==label.id)continue;
          const box=edgeLabelLayout(edge,label,doc);
          // Exclude the label area from this connection's stroke and arrowhead.
          // Clipping preserves the grid and other content underneath the text.
          c.beginPath();
          c.rect((-view.x-2)/view.z,(-view.y-2)/view.z,(width+4)/view.z,(height+4)/view.z);
          c.rect(box.x,box.y,box.w,box.h);
          c.clip("evenodd");
        }
        c.strokeStyle=selected.includes(edge.id)?"#4262ff":edge.color??"#252525";
        c.lineWidth=2; c.stroke(new Path2D(edgePath(edge,doc)));
        if(edge.arrow!==false) {
          const geometry=connectionGeometry(edge,doc),b=geometry.to,angle=geometry.arrowAngle;
          c.save();c.translate(b.x,b.y);c.rotate(angle);c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(0,0);c.lineTo(-12,-5);c.lineTo(-12,5);c.closePath();c.fill();c.restore();
        }
        c.restore();
      }
      for(const edge of doc.edges) for(const label of edge.labels ?? []) {
        if(!label.text.trim() && editing!==label.id) continue;
        const box=edgeLabelLayout(edge,label,doc);
        c.save();
        if(selectedLabel===label.id){c.strokeStyle="#4262ff";c.lineWidth=1/view.z;c.strokeRect(box.x,box.y,box.w,box.h);}
        if(editing!==label.id){
          c.font=`${box.fontSize}px Arial, Helvetica, sans-serif`;
          c.fillStyle=label.color??"#253c32";c.textAlign="center";c.textBaseline="top";
          box.lines.forEach((line,i)=>c.fillText(line,box.x+box.w/2,box.y+6+i*box.lineHeight,box.w-16));
        }
        c.restore();
      }
      for(const n of doc.nodes) {
        if(n.x+n.w < -view.x/view.z || n.y+n.h < -view.y/view.z || n.x>(width-view.x)/view.z || n.y>(height-view.y)/view.z) continue;
        c.save(); c.translate(n.x,n.y); c.beginPath();
        if(n.kind==="ellipse")c.ellipse(n.w/2,n.h/2,n.w/2,n.h/2,0,0,Math.PI*2);
        else if(n.kind==="diamond"){c.moveTo(n.w/2,0);c.lineTo(n.w,n.h/2);c.lineTo(n.w/2,n.h);c.lineTo(0,n.h/2);c.closePath();}
        else if(n.kind==="triangle"){c.moveTo(n.w/2,0);c.lineTo(n.w,n.h);c.lineTo(0,n.h);c.closePath();}
        else c.rect(0,0,n.w,n.h);
        if(n.kind!=="text") {
          c.fillStyle=n.fill;
          if(n.kind==="note"){c.shadowColor="#00000020";c.shadowBlur=4;c.shadowOffsetY=2;}
          c.fill();c.shadowColor="transparent";
          if(n.kind!=="note"){c.strokeStyle="#1a1a1a";c.lineWidth=2;c.stroke();}
        }
        if(editing!==n.id) {
          c.beginPath();c.rect(0,0,n.w,n.h);c.clip();
          const layout=nodeTextLayout(n),size=layout.fontSize,pad=layout.padding,lines=layout.lines;
          c.font=`${n.italic?"italic ":""}${n.bold?"700":"400"} ${size}px Arial, Helvetica, sans-serif`;
          const align=n.align??(n.kind==="text"?"left":"center"), vertical=n.verticalAlign??(n.kind==="text"?"top":"middle"), lineHeight=layout.lineHeight;
          const y=vertical==="top"?pad:vertical==="bottom"?n.h-pad-lines.length*lineHeight:(n.h-lines.length*lineHeight)/2;
          c.fillStyle=n.fill.toLowerCase()==="#151515"?"#fff":"#1a1a1a"; c.textAlign=align;c.textBaseline="top";
          lines.forEach((line,i)=>c.fillText(line,align==="left"?pad:align==="right"?n.w-pad:n.w/2,y+i*lineHeight));
        }
        c.restore();
      }
    };
    draw(); const observer=new ResizeObserver(draw); observer.observe(canvas);
    window.addEventListener("resize",draw);
    return()=>{observer.disconnect();window.removeEventListener("resize",draw);};
  },[doc,draftEdge,selected,editing,view,grid,selectedLabel]);
  return <canvas ref={ref} className="board-canvas" aria-label="Whiteboard Canvas" data-testid="board-canvas"/>;
}
