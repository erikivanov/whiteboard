import { BoardDocument } from "./document";
export type Patch = {nodeOrder?:string[];edgeOrder?:string[];title?:string; nodes:BoardDocument["nodes"]; edges:BoardDocument["edges"]; deletedNodes:string[]; deletedEdges:string[]};
export function diff(before:BoardDocument, after:BoardDocument):Patch {
  return {
    ...(before.nodes.map(n=>n.id).join()!==after.nodes.map(n=>n.id).join()?{nodeOrder:after.nodes.map(n=>n.id)}:{}),
    ...(before.edges.map(n=>n.id).join()!==after.edges.map(n=>n.id).join()?{edgeOrder:after.edges.map(n=>n.id)}:{}),
    ...(before.title!==after.title?{title:after.title}:{}),
    nodes:after.nodes.filter(n=>JSON.stringify(n)!==JSON.stringify(before.nodes.find(v=>v.id===n.id))),
    edges:after.edges.filter(n=>JSON.stringify(n)!==JSON.stringify(before.edges.find(v=>v.id===n.id))),
    deletedNodes:before.nodes.filter(n=>!after.nodes.some(v=>v.id===n.id)).map(n=>n.id),
    deletedEdges:before.edges.filter(n=>!after.edges.some(v=>v.id===n.id)).map(n=>n.id),
  };
}
export function merge(doc:BoardDocument, patch:Patch):BoardDocument {
  const nodes=[...doc.nodes.filter(n=>!patch.deletedNodes.includes(n.id)).map(n=>patch.nodes.find(v=>v.id===n.id)??n),...patch.nodes.filter(n=>!doc.nodes.some(v=>v.id===n.id))];
  const edges=[...doc.edges.filter(n=>!patch.deletedEdges.includes(n.id)).map(n=>patch.edges.find(v=>v.id===n.id)??n),...patch.edges.filter(n=>!doc.edges.some(v=>v.id===n.id))].filter(e=>[e.from,e.to].every(ep=>!ep.nodeId||nodes.some(n=>n.id===ep.nodeId)));
  const order = <T extends {id:string}>(items:T[], ids?:string[]) => ids ? [...items].sort((a,b) => {const ai=ids.indexOf(a.id),bi=ids.indexOf(b.id);return (ai<0?ids.length:ai)-(bi<0?ids.length:bi);}) : items;
  return {...doc,title:patch.title??doc.title,nodes:order(nodes,patch.nodeOrder),edges:order(edges,patch.edgeOrder)};
}
export type Presence={id:string;name:string;color:string;point:{x:number;y:number}|null;seen:number};
export type Session={id:string;token:string;role:"edit"|"view";isOwner?:boolean};
