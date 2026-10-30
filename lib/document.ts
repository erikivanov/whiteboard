export type Point = { x: number; y: number };
export type NodeKind =
  "note" | "rect" | "ellipse" | "diamond" | "triangle" | "text";
export type BoardNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
};
export type Endpoint = {
  /** Body connections adapt automatically; an explicitly selected side stays fixed. */
  binding?: "auto" | "fixed";
  nodeId?: string;
  side?: "left" | "right" | "top" | "bottom";
  point: Point;
};
export type EdgeLabel = {
  id: string;
  text: string;
  /** Fraction of the connection's length, from source (0) to target (1). */
  position: number;
  fontSize?: number;
  color?: string;
};
export type Edge = {
  id: string;
  from: Endpoint;
  to: Endpoint;
  style?: "curve" | "straight" | "elbow";
  arrow?: boolean;
  color?: string;
  labels?: EdgeLabel[];
};
export type BoardDocument = {
  version: 1;
  title: string;
  nodes: BoardNode[];
  edges: Edge[];
};
export const emptyDocument = (): BoardDocument => ({
  version: 1,
  title: "Raum für Ideen",
  nodes: [],
  edges: [],
});
export const STORAGE_KEY = "whiteboard.document.v1";
export function endpoint(ep: Endpoint, doc: BoardDocument): Point {
  const n = doc.nodes.find((n) => n.id === ep.nodeId);
  if (!n) return ep.point;
  switch (ep.side) {
    case "left":
      return {
        x: n.x + (n.kind === "triangle" ? n.w / 4 : 0),
        y: n.y + n.h / 2,
      };
    case "top":
      return { x: n.x + n.w / 2, y: n.y };
    case "bottom":
      return { x: n.x + n.w / 2, y: n.y + n.h };
    default:
      return {
        x: n.x + n.w - (n.kind === "triangle" ? n.w / 4 : 0),
        y: n.y + n.h / 2,
      };
  }
}
export function attach(p: Point, doc: BoardDocument): Endpoint {
  const n = [...doc.nodes]
    .reverse()
    .find(
      (n) =>
        p.x >= n.x - 14 &&
        p.x <= n.x + n.w + 14 &&
        p.y >= n.y - 14 &&
        p.y <= n.y + n.h + 14,
    );
  if (!n) return { point: p };
  const sides = [
    ["left", Math.abs(p.x - n.x)],
    ["right", Math.abs(p.x - n.x - n.w)],
    ["top", Math.abs(p.y - n.y)],
    ["bottom", Math.abs(p.y - n.y - n.h)],
  ] as const;
  const side = [...sides].sort((a, b) => a[1] - b[1])[0][0];
  const distance=Math.min(Math.abs(p.x-n.x),Math.abs(p.x-n.x-n.w),Math.abs(p.y-n.y),Math.abs(p.y-n.y-n.h));
  const binding=distance<=Math.min(12,n.w*.18,n.h*.18)?"fixed":"auto";
  return { nodeId: n.id, side, point: p, binding };
}
type ConnectionSide = NonNullable<Endpoint["side"]>;
const normals: Record<ConnectionSide, Point> = {
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 },
};
const reverseSide: Record<ConnectionSide, ConnectionSide> = { left: "right", right: "left", top: "bottom", bottom: "top" };
const centerOf = (n: BoardNode): Point => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
function facingSide(n: BoardNode, point: Point): ConnectionSide {
  const c = centerOf(n), dx = point.x - c.x, dy = point.y - c.y;
  return Math.abs(dx) / n.w >= Math.abs(dy) / n.h ? dx >= 0 ? "right" : "left" : dy >= 0 ? "bottom" : "top";
}
function sideOf(ep: Endpoint, other: Endpoint, doc: BoardDocument): ConnectionSide | undefined {
  const n = doc.nodes.find(n => n.id === ep.nodeId);
  if (!n) return ep.side;
  if (ep.binding === "fixed" && ep.side) return ep.side;
  const peer = doc.nodes.find(n => n.id === other.nodeId);
  if (peer?.id === n.id) return ep.side ?? "right";
  return facingSide(n, peer ? centerOf(peer) : other.point);
}
function boundaryPort(n: BoardNode, side: ConnectionSide, fraction: number): Point {
  const c = centerOf(n), horizontal = side === "top" || side === "bottom";
  const p = horizontal ? { x: n.x + n.w * fraction, y: side === "top" ? n.y : n.y + n.h }
    : { x: side === "left" ? n.x : n.x + n.w, y: n.y + n.h * fraction };
  if (n.kind === "ellipse") {
    if (horizontal) p.y = c.y + (side === "top" ? -1 : 1) * n.h/2 * Math.sqrt(Math.max(0, 1 - ((p.x-c.x)/(n.w/2))**2));
    else p.x = c.x + (side === "left" ? -1 : 1) * n.w/2 * Math.sqrt(Math.max(0, 1 - ((p.y-c.y)/(n.h/2))**2));
  } else if (n.kind === "diamond") {
    if (horizontal) p.y = c.y + (side === "top" ? -1 : 1) * n.h/2 * (1-Math.abs(p.x-c.x)/(n.w/2));
    else p.x = c.x + (side === "left" ? -1 : 1) * n.w/2 * (1-Math.abs(p.y-c.y)/(n.h/2));
  } else if (n.kind === "triangle") {
    if (side === "left" || side === "right") p.x = n.x + n.w/2 * (1 + (side === "left" ? -1 : 1)*fraction);
    if (side === "top") { p.y = n.y + n.h * Math.abs(fraction-.5)*2; }
  }
  return p;
}
type ResolvedPort = { point: Point; side?: ConnectionSide; node?: BoardNode; index: number; count: number; peer: Point };
/** Sort incident links by their opposite object, so parallel arrows do not cross at the node. */
function resolvedPort(edge: Edge, end: "from" | "to", doc: BoardDocument, edges: Edge[]): ResolvedPort {
  const ep = edge[end], other = edge[end === "from" ? "to" : "from"], side = sideOf(ep, other, doc);
  const node = doc.nodes.find(n => n.id === ep.nodeId), otherNode = doc.nodes.find(n => n.id === other.nodeId);
  const peer = otherNode ? centerOf(otherNode) : other.point;
  if (!node || !side) return { point: ep.point, side, node, index: 0, count: 1, peer };
  const group: { key: string; peer: Point }[] = [];
  for (const candidate of edges) for (const which of ["from", "to"] as const) {
    const port = candidate[which], opposite = candidate[which === "from" ? "to" : "from"];
    if (port.nodeId !== node.id || sideOf(port, opposite, doc) !== side) continue;
    const peerNode = doc.nodes.find(n => n.id === opposite.nodeId);
    group.push({ key: candidate.id + ":" + which, peer: peerNode ? centerOf(peerNode) : opposite.point });
  }
  const vertical = side === "left" || side === "right";
  group.sort((a,b) => (vertical ? a.peer.y-b.peer.y || a.peer.x-b.peer.x : a.peer.x-b.peer.x || a.peer.y-b.peer.y) || (a.key<b.key?-1:a.key>b.key?1:0));
  const index = Math.max(0, group.findIndex(item => item.key === edge.id + ":" + end));
  return { point: boundaryPort(node, side, (index+1)/(group.length+1)), side, node, index, count: group.length, peer };
}
export type ConnectionGeometry = { from: Point; to: Point; fromSide: ConnectionSide; toSide: ConnectionSide; points: Point[]; path: string; arrowAngle: number };
const samePoint = (a: Point,b: Point) => Math.abs(a.x-b.x)<.00001 && Math.abs(a.y-b.y)<.00001;
function compactPoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && samePoint(result[result.length-1],point)) continue;
    while (result.length > 1) {
      const a = result[result.length-2], b = result[result.length-1];
      const ab = {x:b.x-a.x,y:b.y-a.y}, bc = {x:point.x-b.x,y:point.y-b.y};
      if (Math.abs(ab.x*bc.y-ab.y*bc.x)>.00001 || ab.x*bc.x+ab.y*bc.y<0) break;
      result.pop();
    }
    result.push(point);
  }
  return result;
}
function crossesBox(a: Point,b: Point, box: Bounds): boolean {
  const left=box.x+.00001,right=box.x+box.w-.00001,top=box.y+.00001,bottom=box.y+box.h-.00001;
  let low=0,high=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,left,right],[a.y,b.y-a.y,top,bottom]]){
    if(Math.abs(delta)<.0000001){if(start<=min||start>=max)return false;continue;}
    const t1=(min-start)/delta,t2=(max-start)/delta;
    low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
    if(low>high)return false;
  }
  return high>=0&&low<=1;
}
const pathLength=(points:Point[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
function gridRoute(start:Point,end:Point,boxes:Bounds[]):Point[]|null{
  const xs=[...new Set([start.x,end.x,...boxes.flatMap(b=>[b.x,b.x+b.w])])].sort((a,b)=>a-b);
  const ys=[...new Set([start.y,end.y,...boxes.flatMap(b=>[b.y,b.y+b.h])])].sort((a,b)=>a-b);
  const width=xs.length, height=ys.length, startIndex=ys.indexOf(start.y)*width+xs.indexOf(start.x), endIndex=ys.indexOf(end.y)*width+xs.indexOf(end.x);
  type State={key:number;cost:number};
  const heap:State[]=[],cost=new Map<number,number>(),previous=new Map<number,number>();
  const push=(item:State)=>{heap.push(item);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].cost<=item.cost)break;heap[i]=heap[p];i=p;}heap[i]=item;};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  const pointAt=(index:number)=>({x:xs[index%width],y:ys[Math.floor(index/width)]});
  // Axis is part of the state: shortest paths also prefer fewer corners.
  const initial=startIndex*3;cost.set(initial,0);push({key:initial,cost:0});
  while(heap.length){
    const current=pop();if(current.cost!==cost.get(current.key))continue;
    const index=Math.floor(current.key/3),axis=current.key%3;
    if(index===endIndex){const points:Point[]=[];let key:number|undefined=current.key;while(key!==undefined){points.push(pointAt(Math.floor(key/3)));key=previous.get(key);}return points.reverse();}
    const x=index%width,y=Math.floor(index/width),from=pointAt(index);
    for(const [dx,dy,nextAxis] of [[-1,0,1],[1,0,1],[0,-1,2],[0,1,2]]){
      if(x+dx<0||x+dx>=width||y+dy<0||y+dy>=height)continue;
      const next=(y+dy)*width+x+dx,to=pointAt(next);
      if(boxes.some(box=>crossesBox(from,to,box)))continue;
      const key=next*3+nextAxis,value=current.cost+Math.abs(to.x-from.x)+Math.abs(to.y-from.y)+(axis&&axis!==nextAxis?20:0);
      if(value>=(cost.get(key)??Infinity))continue;
      cost.set(key,value);previous.set(key,current.key);push({key,cost:value});
    }
  }
  return null;
}
function orthogonalRoute(a:ResolvedPort,b:ResolvedPort,fromSide:ConnectionSide,toSide:ConnectionSide,doc:BoardDocument):Point[]{
  const dx=Math.abs(a.point.x-b.point.x),dy=Math.abs(a.point.y-b.point.y);
  const gap=a.node&&b.node?Math.max(0,b.node.x-a.node.x-a.node.w,a.node.x-b.node.x-b.node.w,b.node.y-a.node.y-a.node.h,a.node.y-b.node.y-b.node.h):Math.max(dx,dy);
  const padding=gap>0?Math.min(10,gap/5):10,base=gap>0?Math.min(28,gap/3):28;
  const stub=(p:ResolvedPort,side:ConnectionSide)=>{
    const n=normals[side],axis=side==="left"||side==="right"?"y":"x";
    const rank=p.peer[axis]<p.point[axis]?p.index:p.count-1-p.index;
    let distance=base+rank*12;
    if(p.node){const node=p.node;const outside=side==="left"?p.point.x-node.x:side==="right"?node.x+node.w-p.point.x:side==="top"?p.point.y-node.y:node.y+node.h-p.point.y;distance=Math.max(distance,outside+padding+2);}
    // Keep the departure stub in the free corridor when a third note is close.
    for(const other of doc.nodes){
      if(other.id===p.node?.id||other.kind==="text")continue;
      let available=Infinity;
      if(n.x && p.point.y>other.y-padding && p.point.y<other.y+other.h+padding){
        if(n.x>0 && other.x-padding>p.point.x)available=other.x-padding-p.point.x;
        if(n.x<0 && other.x+other.w+padding<p.point.x)available=p.point.x-other.x-other.w-padding;
      }
      if(n.y && p.point.x>other.x-padding && p.point.x<other.x+other.w+padding){
        if(n.y>0 && other.y-padding>p.point.y)available=other.y-padding-p.point.y;
        if(n.y<0 && other.y+other.h+padding<p.point.y)available=p.point.y-other.y-other.h-padding;
      }
      if(Number.isFinite(available))distance=Math.min(distance,Math.max(.1,available*.7));
    }
    return{x:p.point.x+n.x*distance,y:p.point.y+n.y*distance};
  };
  const start=stub(a,fromSide),end=stub(b,toSide);
  const lane=(p:ResolvedPort,side:ConnectionSide)=>{
    const vertical=side==="left"||side==="right",axis=vertical?"y":"x";
    return (p.peer[axis]<p.point[axis]?1:-1)*((p.count-1)/2-p.index)*18;
  };
  const middleX=(start.x+end.x)/2+lane(b,toSide),middleY=(start.y+end.y)/2+lane(b,toSide);
  const minX=Math.min(start.x,end.x)-160,minY=Math.min(start.y,end.y)-160,maxX=Math.max(start.x,end.x)+160,maxY=Math.max(start.y,end.y)+160;
  const boxes=doc.nodes.filter(n=>n.kind!=="text"&&n.x+n.w>=minX&&n.x<=maxX&&n.y+n.h>=minY&&n.y<=maxY)
    .map(n=>({x:n.x-padding,y:n.y-padding,w:n.w+padding*2,h:n.h+padding*2}));
  const horizontal=fromSide==="left"||fromSide==="right";
  const candidates=[
    ...(horizontal?[[start,{x:middleX,y:start.y},{x:middleX,y:end.y},end]]:[[start,{x:start.x,y:middleY},{x:end.x,y:middleY},end]]),
    [start,{x:end.x,y:start.y},end],[start,{x:start.x,y:end.y},end],
    [start,{x:middleX,y:start.y},{x:middleX,y:end.y},end],
    [start,{x:start.x,y:middleY},{x:end.x,y:middleY},end],
  ];
  let best:Point[]|undefined,score=Infinity;
  for(const middle of candidates){
    if(middle.slice(1).some((p,i)=>boxes.some(box=>crossesBox(middle[i],p,box))))continue;
    const points=compactPoints([a.point,...middle,b.point]);
    const value=pathLength(points)+Math.max(0,points.length-2)*20;
    if(value<score){best=points;score=value;}
  }
  if(best)return best;
  const detour=gridRoute(start,end,boxes)??gridRoute(start,end,doc.nodes.filter(n=>n.kind!=="text"));
  return compactPoints([a.point,...(detour??[start,{x:end.x,y:start.y},end]),b.point]);
}
function roundedPath(points:Point[]):{path:string;points:Point[]}{
  let path=`M ${points[0].x} ${points[0].y}`;const samples:Point[]=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const before=points[i-1],corner=points[i],after=points[i+1];
    const first=Math.hypot(corner.x-before.x,corner.y-before.y),second=Math.hypot(after.x-corner.x,after.y-corner.y),radius=Math.min(12,first/2,second/2);
    const enter={x:corner.x+(before.x-corner.x)*radius/first,y:corner.y+(before.y-corner.y)*radius/first};
    const exit={x:corner.x+(after.x-corner.x)*radius/second,y:corner.y+(after.y-corner.y)*radius/second};
    path+=` L ${enter.x} ${enter.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`;samples.push(enter);
    for(let j=1;j<=8;j++){const t=j/8,u=1-t;samples.push({x:u*u*enter.x+2*u*t*corner.x+t*t*exit.x,y:u*u*enter.y+2*u*t*corner.y+t*t*exit.y});}
  }
  const last=points[points.length-1];path+=` L ${last.x} ${last.y}`;samples.push(last);return{path,points:samples};
}
let routeSignature="";
let routes=new Map<string,ConnectionGeometry>();
/** Shared by Canvas, selection handles, labels, hit testing and previews. */
export function connectionGeometry(edge:Edge,doc:BoardDocument):ConnectionGeometry{
  const edges=doc.edges.some(e=>e.id===edge.id)?doc.edges.map(e=>e.id===edge.id?edge:e):[...doc.edges,edge];
  const signature=JSON.stringify([doc.nodes.map(n=>[n.id,n.kind,n.x,n.y,n.w,n.h]),edges.map(e=>[e.id,e.from,e.to,e.style])]);
  if(signature!==routeSignature){routeSignature=signature;routes=new Map();}
  const cached=routes.get(edge.id);if(cached)return cached;
  const a=resolvedPort(edge,"from",doc,edges),b=resolvedPort(edge,"to",doc,edges);
  const fallback:ConnectionSide=Math.abs(b.point.x-a.point.x)>=Math.abs(b.point.y-a.point.y)?b.point.x>=a.point.x?"right":"left":b.point.y>=a.point.y?"bottom":"top";
  const fromSide=a.side??(b.side?reverseSide[b.side]:fallback),toSide=b.side??reverseSide[fromSide];
  let points=[a.point,b.point],path=`M ${a.point.x} ${a.point.y} L ${b.point.x} ${b.point.y}`;
  let tangent={x:b.point.x-a.point.x,y:b.point.y-a.point.y};
  if(edge.style==="elbow"){
    points=orthogonalRoute(a,b,fromSide,toSide,doc);path=points.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
    tangent={x:points[points.length-1].x-points[Math.max(0,points.length-2)].x,y:points[points.length-1].y-points[Math.max(0,points.length-2)].y};
  }else if(edge.style!=="straight"){
    let handle=Math.min(160,Math.max(16,Math.hypot(b.point.x-a.point.x,b.point.y-a.point.y)*.42));
    const n=normals[fromSide],m=normals[toSide];
    const separation=(b.point.x-a.point.x)*n.x+(b.point.y-a.point.y)*n.y;
    if(n.x===-m.x&&n.y===-m.y&&separation>0)handle=Math.min(handle,separation*.48);
    const c={x:a.point.x+n.x*handle,y:a.point.y+n.y*handle},d={x:b.point.x+m.x*handle,y:b.point.y+m.y*handle};
    points=Array.from({length:81},(_,i)=>{const t=i/80,u=1-t;return{x:u*u*u*a.point.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.point.x,y:u*u*u*a.point.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.point.y};});
    path=`M ${a.point.x} ${a.point.y} C ${c.x} ${c.y}, ${d.x} ${d.y}, ${b.point.x} ${b.point.y}`;
    tangent={x:b.point.x-d.x,y:b.point.y-d.y};
    const blocked=doc.nodes.filter(node=>node.kind!=="text").some(node=>points.some((p,i)=>i>0&&i<points.length-1&&p.x>node.x+.5&&p.x<node.x+node.w-.5&&p.y>node.y+.5&&p.y<node.y+node.h-.5));
    if(blocked){const route=orthogonalRoute(a,b,fromSide,toSide,doc),rounded=roundedPath(route);path=rounded.path;points=rounded.points;tangent={x:route[route.length-1].x-route[Math.max(0,route.length-2)].x,y:route[route.length-1].y-route[Math.max(0,route.length-2)].y};}
  }
  const result={from:a.point,to:b.point,fromSide,toSide,points,path,arrowAngle:Math.atan2(tangent.y,tangent.x)};
  routes.set(edge.id,result);return result;
}
export function edgePath(edge:Edge,doc:BoardDocument){return connectionGeometry(edge,doc).path;}
/** Return the same geometry used by the visible connector, including detours. */
export function edgePolyline(edge:Edge,doc:BoardDocument):Point[]{return connectionGeometry(edge,doc).points;}

export function edgePointAt(edge: Edge, doc: BoardDocument, position = 0.5): Point {
  const points = edgePolyline(edge, doc);
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance = lengths.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, position));
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] && lengths[i] > 0) {
      const t = distance / lengths[i];
      return { x: points[i].x + (points[i+1].x-points[i].x)*t, y: points[i].y + (points[i+1].y-points[i].y)*t };
    }
    distance -= lengths[i];
  }
  return points[points.length - 1];
}
/** Project a pointer onto the actual path so dragged labels stay attached. */
export function edgePositionAt(edge: Edge, doc: BoardDocument, point: Point): number {
  const points = edgePolyline(edge, doc);
  let total = 0, nearest = Infinity, best = 0;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x-points[i].x, p.y-points[i].y));
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i], b = points[i+1], dx = b.x-a.x, dy = b.y-a.y, length = lengths[i];
    const t = length ? Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(length*length))) : 0;
    const distance = Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy);
    if (distance < nearest) { nearest = distance; best = total + t*length; }
    total += length;
  }
  return total ? best / total : 0.5;
}
/** Deterministic layout shared by Canvas, hit regions, editing and thumbnails. */
export function edgeLabelLayout(edge: Edge, label: EdgeLabel, doc: BoardDocument) {
  const size = label.fontSize ?? 14, lineHeight = size * 1.3;
  const widthOf = (text: string) => Array.from(text).reduce((width, char) =>
    width + size * (/\s/.test(char) ? .34 : /[ilI.,!:;|'`]/.test(char) ? .32 : /[MW@]/.test(char) ? .9 : char.codePointAt(0)! > 255 ? 1 : .64), 0);
  const lines: string[] = [];
  const maxWidth = Math.max(240, size * 5);
  for (const paragraph of (label.text || "Text").split("\n")) {
    let line = "";
    for (const word of paragraph.match(/\S+|[ \t]+/g) ?? [""]) {
      if (line && widthOf(line + word) > maxWidth) { lines.push(line.trimEnd()); line = ""; }
      for (const char of Array.from(word)) {
        if (line && widthOf(line + char) > maxWidth) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  const w = Math.max(44, ...lines.map(widthOf)) + 16, h = lines.length * lineHeight + 12;
  const center = edgePointAt(edge, doc, label.position);
  return { x: center.x-w/2, y: center.y-h/2, w, h, lines, lineHeight, fontSize: size };
}
export type Bounds = { x: number; y: number; w: number; h: number };
export function bounds(doc: BoardDocument, ids: string[]): Bounds | null {
  const boxes: Bounds[] = doc.nodes.filter((n) => ids.includes(n.id));
  doc.edges
    .filter((e) => ids.includes(e.id))
    .forEach((e) => {
      const points = edgePolyline(e, doc);
      const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
      boxes.push({ x, y, w: Math.max(...points.map(p => p.x))-x, h: Math.max(...points.map(p => p.y))-y });
      for (const label of e.labels ?? []) boxes.push(edgeLabelLayout(e, label, doc));
    });
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}
export function parseDocument(value: unknown): BoardDocument {
  const d = value as BoardDocument;
  if (
    !d ||
    d.version !== 1 ||
    typeof d.title !== "string" || d.title.length > 1000 ||
    !Array.isArray(d.nodes) || d.nodes.length > 2000 ||
    !Array.isArray(d.edges) || d.edges.length > 4000
  )
    throw Error("Unbekanntes Dateiformat");
  const finite = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e8;
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (
      !n ||
      typeof n.id !== "string" || !n.id.length || n.id.length > 128 ||
      ids.has(n.id) ||
      !["note", "rect", "ellipse", "diamond", "triangle", "text"].includes(
        n.kind,
      ) ||
      ![n.x, n.y, n.w, n.h].every(finite) ||
      n.w < 1 ||
      n.h < 1 ||
      typeof n.text !== "string" || n.text.length > 20000 ||
      typeof n.fill !== "string" || n.fill.length > 128 ||
      (n.fontSize !== undefined &&
        (!finite(n.fontSize) || n.fontSize < 8 || n.fontSize > 144)) ||
      (n.bold !== undefined && typeof n.bold !== "boolean") ||
      (n.italic !== undefined && typeof n.italic !== "boolean") ||
      (n.align !== undefined &&
        !["left", "center", "right"].includes(n.align)) ||
      (n.verticalAlign !== undefined &&
        !["top", "middle", "bottom"].includes(n.verticalAlign))
    )
      throw Error("Ungültige Objektdaten");
    ids.add(n.id);
  }
  for (const e of d.edges) {
    if (
      !e ||
      typeof e.id !== "string" || !e.id.length || e.id.length > 128 ||
      ids.has(e.id) ||
      (e.style !== undefined &&
        !["curve", "straight", "elbow"].includes(e.style)) ||
      (e.arrow !== undefined && typeof e.arrow !== "boolean") ||
      (e.color !== undefined && (typeof e.color !== "string" || e.color.length > 128))
    )
      throw Error("Ungültige Verbindung");
    ids.add(e.id);
    if (e.labels !== undefined) {
      if (!Array.isArray(e.labels) || e.labels.length > 64) throw Error("Ungültige Verbindungsbeschriftung");
      for (const label of e.labels) {
        if (!label || typeof label.id !== "string" || !label.id.length || label.id.length > 128 || ids.has(label.id) || typeof label.text !== "string" || label.text.length > 20000 ||
          !finite(label.position) || label.position < 0 || label.position > 1 ||
          (label.fontSize !== undefined && (!finite(label.fontSize) || label.fontSize < 8 || label.fontSize > 144)) ||
          (label.color !== undefined && (typeof label.color !== "string" || label.color.length > 128))) throw Error("Ungültige Verbindungsbeschriftung");
        ids.add(label.id);
      }
    }
    for (const ep of [e.from, e.to])
      if (
        !ep ||
        !ep.point ||
        !finite(ep.point.x) ||
        !finite(ep.point.y) ||
        (ep.nodeId !== undefined && (typeof ep.nodeId !== "string" || !d.nodes.some((n) => n.id === ep.nodeId))) ||
        (ep.side !== undefined && !["left", "right", "top", "bottom"].includes(ep.side)) ||
        (ep.binding !== undefined && !["auto", "fixed"].includes(ep.binding))
      )
        throw Error("Ungültiger Endpunkt");
  }
  return d;
}
