import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { parseDocument, BoardDocument } from "@/lib/document";
import { merge, Patch, Presence } from "@/lib/collaboration";
import { getOwner, appOrigin } from "@/lib/auth";
import { readBoundedJson, RequestError, sameOriginRequest } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RecordData = {
  doc: BoardDocument;
  owner?: string;
  ownerGithubId?: number;
  edit: string;
  view: string;
  shareRole?: "edit" | "view";
  revision: number;
  createdAt?: number;
  updatedAt?: number;
};
const dir = path.join(process.cwd(), ".data", "boards");
const secret = () => randomBytes(24).toString("base64url");
const valid = (s: unknown): s is string => typeof s === "string" && /^[\w-]{20,80}$/.test(s);
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const presence = new Map<string, Map<string, Presence>>();
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function save(id: string, data: RecordData) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, id + ".json"), temp = file + "." + secret() + ".tmp";
  await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
  await rename(temp, file);
}

async function handle(req: NextRequest, body: any = null) {
  try {
    const account = await getOwner(req);
    if(req.method === "GET" && !req.nextUrl.searchParams.has("id")){
      if(!account)return json({error:"Bitte mit GitHub anmelden",code:"AUTH_REQUIRED"},401);
      let names:string[]=[];
      try{names=await readdir(dir);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
      const items=await Promise.all(names.filter(name=>/^[\w-]{20,80}\.json$/.test(name)).map(async name=>{
        try{
          const record:RecordData=JSON.parse(await readFile(path.join(dir,name),"utf8"));
          if(record.ownerGithubId!==account.id)return null;
          return{id:name.slice(0,-5),token:record.owner??record.edit,role:"edit",isOwner:true,doc:record.doc,createdAt:record.createdAt,updatedAt:record.updatedAt};
        }catch{return null;}
      }));
      return json({items:items.filter(Boolean)});
    }
    if (body?.action === "create") {
      if(!account)return json({error:"Bitte mit GitHub anmelden, um ein neues Board anzulegen",code:"AUTH_REQUIRED"},401);
      const doc = parseDocument(body.doc), id = secret(), owner = secret(), edit = secret(), view = secret(), now = Date.now();
      await save(id, { doc, owner, ownerGithubId:account.id, edit, view, shareRole: "view", revision: 0, createdAt: now, updatedAt: now });
      return json({ id, token: owner, role: "edit", isOwner: true, shareRole: "view", shareToken: view, viewToken: view, createdAt: now, updatedAt: now });
    }
    const id = req.nextUrl.searchParams.get("id"), token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!valid(id) || !valid(token)) return json({ error: "Ungültiger Freigabelink" }, 400);
    const record: RecordData = JSON.parse(await readFile(path.join(dir, id + ".json"), "utf8"));
    // Legacy boards used their edit capability as their owner's capability.
    const isOwner = equal(record.owner ?? record.edit, token);
    if(isOwner && !account)return json({error:"Bitte mit GitHub anmelden, um dein Board zu öffnen",code:"AUTH_REQUIRED"},401);
    if(isOwner && record.ownerGithubId!==undefined && record.ownerGithubId!==account?.id)return json({error:"Kein Zugriff auf dieses Board"},403);
    const guest = equal(record.edit, token) || equal(record.view, token);
    const role = isOwner ? "edit" : guest ? record.shareRole ?? "view" : null;
    if (!role) return json({ error: "Kein Zugriff auf dieses Board" }, 403);
    let ownerToken: string | undefined;
    if(body?.action === "claim"){
      if(!isOwner || !account)return json({error:"Nur der Besitzer kann dieses Board übernehmen"},403);
      if(record.ownerGithubId===undefined){record.ownerGithubId=account.id;await save(id,record);}
    }

    if (body?.action === "delete") {
      if (!isOwner) return json({ error: "Nur der Besitzer kann dieses Board löschen" }, 403);
      await unlink(path.join(dir, id + ".json"));
      presence.delete(id);
      return json({ deleted: true });
    }
    if (body?.action === "sharing") {
      if (!isOwner) return json({ error: "Nur der Besitzer kann die Freigabe ändern" }, 403);
      if (!["edit", "view"].includes(body.role)) return json({ error: "Ungültige Gastberechtigung" }, 400);
      if (!record.owner) {
        // Revoke legacy edit links on the first explicit sharing change. The
        // caller receives a fresh owner capability that is never shared.
        record.owner = secret();
        record.edit = secret();
        ownerToken = record.owner;
      }
      record.shareRole = body.role;
      await save(id, record);
    }
    if (body?.patch) {
      if (role !== "edit") return json({ error: "Nur Lesezugriff", code: "READ_ONLY" }, 403);
      const patch = body.patch as Patch;
      if (!Array.isArray(patch.nodes) || !Array.isArray(patch.edges) || !Array.isArray(patch.deletedNodes) || !Array.isArray(patch.deletedEdges)) throw Error("Ungültige Änderungen");
      for (const values of [patch.deletedNodes, patch.deletedEdges, patch.nodeOrder, patch.edgeOrder]) {
        if (values !== undefined && (!Array.isArray(values) || values.length > 6000 || values.some(v => typeof v !== "string" || !v.length || v.length > 128))) throw Error("Ungültige Reihenfolge");
      }
      if (patch.nodes.length > 2000 || patch.edges.length > 4000) throw Error("Zu viele Elemente");
      const merged = merge(record.doc, patch);
      if (Buffer.byteLength(JSON.stringify(merged)) > 2_000_000) return json({ error: "Board ist zu groß" }, 413);
      const next = parseDocument(merged);
      if (JSON.stringify(next) !== JSON.stringify(record.doc)) {
        record.doc = next; record.revision++; record.updatedAt = Date.now(); await save(id, record);
      }
    }
    // Expire inactive boards as well as members; both maps have hard bounds.
    for (const [boardId, peers] of presence) {
      for (const [peerId, peer] of peers) if (Date.now() - peer.seen > 10000) peers.delete(peerId);
      if (!peers.size) presence.delete(boardId);
    }
    let members = presence.get(id);
    if (!members) {
      if (presence.size >= 1024) presence.delete(presence.keys().next().value!);
      members = new Map(); presence.set(id, members);
    }
    if (body?.presence) {
      const p = body.presence;
      if (typeof p.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(p.id) || typeof p.name !== "string" || p.name.length > 40 || typeof p.color !== "string" || !/^#[0-9a-f]{6}$/i.test(p.color) ||
        p.point !== null && (!Number.isFinite(p.point?.x) || !Number.isFinite(p.point?.y))) throw Error("Ungültige Anwesenheit");
      if (body.leave) members.delete(p.id);
      else if (members.has(p.id) || members.size < 100) members.set(p.id, { id: p.id.slice(0, 80), name: p.name.slice(0, 40), color: p.color, point: p.point === null ? null : { x: p.point.x, y: p.point.y }, seen: Date.now() });
    }
    for (const [key, p] of members) if (Date.now() - p.seen > 10000) members.delete(key);
    return json({
      doc: record.doc, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt,
      role, isOwner, shareRole: record.shareRole ?? "view", members: [...members.values()],
      ...(isOwner ? { shareToken: record.view, viewToken: record.view, ownerToken } : {}),
    });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return json({ error: missing ? "Dieses Board wurde gelöscht oder ist nicht mehr verfügbar" : "Board konnte nicht verarbeitet werden" }, missing ? 404 : 400);
  }
}
export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) {
  if (!sameOriginRequest(req, appOrigin())) return json({ error: "Ungültiger Ursprung" }, 403);
  // Slow uploads never hold the mutation lock or queue an unlimited number of requests.
  if (pending >= 64) return json({ error: "Zu viele gleichzeitige Anfragen" }, 429);
  pending++;
  try {
    const body = await readBoundedJson(req);
    const result = queue.then(() => handle(req, body));
    queue = result.catch(() => {});
    return await result;
  } catch (error) {
    return json({ error: error instanceof RequestError ? error.message : "Ungültige Anfrage" }, error instanceof RequestError ? error.status : 400);
  } finally { pending--; }
}
