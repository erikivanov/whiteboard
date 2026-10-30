"use client";
import { rememberBoard, removeBoard, readLibrary } from "./boardLibrary";
import { newId } from "./id";
import { useEffect, useRef, useState } from "react";
import { BoardDocument, parseDocument, Point } from "./document";
import { diff, merge, Presence, Session } from "./collaboration";

type Store = { current: React.RefObject<BoardDocument>; replace: (d: BoardDocument) => void; ready: boolean };
function changes(before: BoardDocument, after: BoardDocument) {
  const p = diff(before, after);
  return p.title !== undefined || p.nodes.length || p.edges.length || p.deletedNodes.length || p.deletedEdges.length || p.nodeOrder || p.edgeOrder ? p : undefined;
}
export function useCollaboration(store: Store) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [members, setMembers] = useState<Presence[]>([]);
  const [status, setStatus] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [shareRole, setShareRole] = useState<"edit" | "view">("view");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessLost, setAccessLost] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [legacyLinkReplaced, setLegacyLinkReplaced] = useState(false);
  const cursor = useRef<Point | null>(null), baseline = useRef<BoardDocument | null>(null);
  const identity = useRef<Presence | null>(null);
  const role = useRef<"edit" | "view">("edit");
  const remembered = useRef<string | null>(null);

  const selectSession = (next: Session) => {
    sessionRef.current = next;
    role.current = next.role;
    setSession(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
  };
  useEffect(() => {
    const url = new URL(location.href), id = url.searchParams.get("board"), token = new URLSearchParams(url.hash.slice(1)).get("token");
    if (id && token) { setLoading(true); selectSession({ id, token, role: "view", isOwner: false }); }
    const colors = ["#4262ff", "#df4590", "#14865b", "#ad62d5", "#ca6f10"];
    const number = crypto.getRandomValues(new Uint32Array(1))[0];
    identity.current = { id: newId(), name: `Gast ${number % 10000}`, color: colors[number % colors.length], point: null, seen: Date.now() };
  }, []);

  useEffect(() => {
    if (!session || !store.ready) return;
    let stopped = false, terminal = false, timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const active = sessionRef.current!;
      const sent = store.current.current, base = baseline.current;
      try {
        const patch = base && role.current === "edit" ? changes(base, sent) : undefined;
        const response = await fetch(`/api/boards?id=${active.id}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` },
          body: JSON.stringify({ patch, presence: { ...identity.current, point: cursor.current } }),
        });
        const data = await response.json();
        if (stopped || sessionRef.current?.token !== active.token) return;
        if (!response.ok) {
          if(response.status===401 && data.code==="AUTH_REQUIRED"){
            terminal=true;setAuthRequired(true);setAccessLost(true);setLoading(false);
            selectSession({...active,role:"view",isOwner:false});
          }
          if (data.code === "READ_ONLY") {
            selectSession({ ...active, role: "view", isOwner: false });
            if (base) store.replace(base);
            return;
          }
          if (response.status === 403 || response.status === 404) {
            terminal = true; setAccessLost(true); setLoading(false);
            selectSession({ ...active, role: "view", isOwner: false });
            try {
              if(response.status===404 || readLibrary().find(b=>b.id===active.id)?.token===active.token) removeBoard(active.id);
            } catch {}
          }
          throw Error(data.error ?? "Verbindung fehlgeschlagen");
        }
        const server = parseDocument(data.doc);
        const local = base && role.current === "edit" && data.role === "edit" ? merge(server, diff(sent, store.current.current)) : server;
        baseline.current = server;
        const next: Session = { ...active, role: data.role, isOwner: data.isOwner === true };
        selectSession(next);
        try {
          rememberBoard(next, server, { opened: remembered.current !== active.id, createdAt: data.createdAt, updatedAt: data.updatedAt });
          remembered.current = active.id;
        } catch { /* Editing remains available when browser storage is full. */ }
        if (JSON.stringify(local) !== JSON.stringify(store.current.current)) store.replace(local);
        setShareToken(data.shareToken ?? ""); setShareRole(data.shareRole ?? "view");
        setMembers(data.members.filter((p: Presence) => p.id !== identity.current?.id));
        setLoading(false); setError(""); setStatus("Gemeinsam gespeichert");
      } catch (e) {
        if (!stopped) { setError((e as Error).message); setStatus(terminal ? "Board nicht verfügbar" : "Verbindung unterbrochen – erneuter Versuch …"); }
      } finally { if (!stopped && !terminal) timer = setTimeout(tick, 200); }
    };
    tick();
    const leave = () => {
      const active = sessionRef.current;
      if (!active || terminal) return;
      cursor.current = null;
      fetch(`/api/boards?id=${active.id}`, {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` },
        body: JSON.stringify({ patch: baseline.current && role.current === "edit" ? changes(baseline.current, store.current.current) : undefined, presence: { ...identity.current, point: null }, leave: true }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener("pagehide", leave); };
  }, [session?.id, session?.token, store.ready, store.replace, store.current]);

  const share = async () => {
    if (sessionRef.current) {
      if (sessionRef.current.isOwner) await setPermission(shareRole);
      return sessionRef.current!;
    }
    const sharedDoc = store.current.current;
    const response = await fetch("/api/boards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", doc: sharedDoc }) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Freigabe fehlgeschlagen");
    const next: Session = { id: data.id, token: data.token, role: "edit", isOwner: true };
    try { rememberBoard(next, sharedDoc, { opened: true, createdAt: data.createdAt, updatedAt: data.updatedAt }); } catch {}
    baseline.current = sharedDoc; selectSession(next);
    setShareToken(data.shareToken); setShareRole(data.shareRole);
    const url = new URL(location.href); url.searchParams.set("board", next.id); url.hash = new URLSearchParams({ token: next.token }).toString(); history.replaceState(null, "", url);
    return next;
  };
  const setPermission = async (permission: "edit" | "view") => {
    const active = sessionRef.current;
    if (!active?.isOwner) throw Error("Nur der Besitzer kann die Freigabe ändern");
    const response = await fetch(`/api/boards?id=${active.id}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` },
      body: JSON.stringify({ action: "sharing", role: permission }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Freigabe konnte nicht gespeichert werden");
    const next = { ...active, token: data.ownerToken ?? active.token, isOwner: true };
    selectSession(next); setShareRole(data.shareRole); setShareToken(data.shareToken);
    if (data.ownerToken) {
      setLegacyLinkReplaced(true);
      const url = new URL(location.href); url.hash = new URLSearchParams({ token: next.token }).toString(); history.replaceState(null, "", url);
    }
    try { rememberBoard(next, parseDocument(data.doc), { createdAt: data.createdAt, updatedAt: data.updatedAt }); } catch {}
  };
  const flush = async () => {
    const active = sessionRef.current;
    if (!active || role.current !== "edit" || !baseline.current || accessLost) return;
    const patch = changes(baseline.current, store.current.current);
    if (!patch) return;
    const response = await fetch(`/api/boards?id=${active.id}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.token}` }, body: JSON.stringify({ patch }) });
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Speichern fehlgeschlagen. Bitte versuche es erneut.");
    baseline.current = parseDocument(data.doc);
    try { rememberBoard({ ...active, role: data.role, isOwner: data.isOwner }, baseline.current, { updatedAt: data.updatedAt, createdAt: data.createdAt }); } catch {}
  };
  return { session, members, status, loading, error, accessLost, authRequired, legacyLinkReplaced, share, setPermission, shareRole, shareToken, flush, cursor, identity, readOnly: !!session && (loading || accessLost || session.role === "view") };
}
