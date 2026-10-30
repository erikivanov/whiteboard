"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowDownUp, ArrowUpRight, Check, Clock3, Grid2X2, Home, LayoutDashboard, List, Plus, Search, Star, Users, X, Trash2, Github, LogOut } from "lucide-react";
import { BoardDocument, emptyDocument, parseDocument } from "@/lib/document";
import { boardHref, LibraryBoard, LIBRARY_EVENT, LIBRARY_KEY, migrateLocalBoard, readLibrary, rememberBoard, writeLibrary, removeBoard } from "@/lib/boardLibrary";
import BoardThumbnail from "./BoardThumbnail";
import type { OwnerUser } from "@/lib/auth-policy";

type Filter = "all" | "recent" | "starred" | "shared";
const sections = {
  all: { title: "Alle Boards", subtitle: "Ein guter Gedanke verdient seinen eigenen Raum." },
  recent: { title: "Zuletzt geöffnet", subtitle: "Mach dort weiter, wo du aufgehört hast." },
  starred: { title: "Deine Favoriten", subtitle: "Die wichtigen Dinge immer in Reichweite." },
  shared: { title: "Geteilte Boards", subtitle: "Hier entstehen Ideen gemeinsam." },
};
function dateLabel(value: number) {
  const days = Math.floor((Date.now() - value) / 86_400_000);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

export default function Dashboard({user}: {user: OwnerUser}) {
  const [boards, setBoards] = useState<LibraryBoard[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<LibraryBoard|null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const newDialog = useRef<HTMLDialogElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const update = () => {
      try { setBoards(readLibrary()); }
      catch (e) { setError((e as Error).message); }
    };
    try { migrateLocalBoard(); update(); } catch (e) { setError((e as Error).message); }
    setReady(true);
    const storage = (e: StorageEvent) => { if (e.key === LIBRARY_KEY || e.key === null) update(); };
    window.addEventListener("storage", storage);
    window.addEventListener(LIBRARY_EVENT, update);
    // Refresh only the boards for which this browser already holds a capability.
    if (!loaded.current) {
      loaded.current = true;
      let known: LibraryBoard[] = [];
      try { known = readLibrary(); } catch {}
      Promise.allSettled(known.filter(b => !b.local).map(async b => {
        const response = await fetch(`/api/boards?id=${encodeURIComponent(b.id)}`, {
          ...(b.isOwner ? {method:"POST",body:JSON.stringify({action:"claim"})}:{}),
          headers: { Authorization: `Bearer ${b.token}`, "Content-Type":"application/json" }, signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404) { removeBoard(b.id); return; }
        if (!response.ok) throw Error("Nicht alle Boards konnten aktualisiert werden. Gespeicherte Vorschauen werden angezeigt.");
        const data = await response.json();
        if (!readLibrary().some(current => current.id === b.id)) return;
        rememberBoard({ id: b.id, token: b.token!, role: data.role, isOwner: data.isOwner }, parseDocument(data.doc), {
          createdAt: data.createdAt, updatedAt: data.updatedAt,
        });
      })).then(async results => {
        try {
          const response=await fetch("/api/boards",{signal:AbortSignal.timeout(8000)});
          if(response.status===401){location.assign("/?login=required");return;}
          if(!response.ok)throw Error("Übersicht konnte nicht aktualisiert werden");
          const data=await response.json();
          for(const item of data.items) rememberBoard({id:item.id,token:item.token,role:"edit",isOwner:true},parseDocument(item.doc),{createdAt:item.createdAt,updatedAt:item.updatedAt});
        }catch{setNotice("Einige Boards sind gerade nicht erreichbar. Deine gespeicherte Übersicht bleibt verfügbar.");}
        if (results.some(r => r.status === "rejected")) setNotice("Einige Boards sind gerade nicht erreichbar. Deine gespeicherte Übersicht bleibt verfügbar.");
      });
    }
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener(LIBRARY_EVENT, update);
    };
  }, []);

  useEffect(() => {
    if (creating) newDialog.current?.showModal();
    else newDialog.current?.close();
  }, [creating]);

  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleting]);
  const deleteBoard = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      if (!deleting.local) {
        const response = await fetch(`/api/boards?id=${encodeURIComponent(deleting.id)}`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${deleting.token}` },
          body: JSON.stringify({action:"delete"}),
        });
        if (!response.ok && response.status !== 404) {
          const data = await response.json(); throw Error(data.error ?? "Das Board konnte nicht gelöscht werden.");
        }
      }
      removeBoard(deleting.id); setDeleting(null);
      setNotice("Board gelöscht.");
    } catch (e) { setDeleteError((e as Error).message); }
    finally { setDeleteBusy(false); }
  };
  const openCreate = () => { setTitle(""); setError(""); setCreating(true); };
  const closeCreate = () => { if (!busy) { setCreating(false); newButton.current?.focus(); } };
  const createBoard = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const doc: BoardDocument = { ...emptyDocument(), title: title.trim() || "Unbenanntes Board" };
      const response = await fetch("/api/boards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", doc }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Das Board konnte nicht angelegt werden.");
      const board = rememberBoard({ id: data.id, token: data.token, role: "edit", isOwner: true }, doc, {
        opened: true, createdAt: data.createdAt, updatedAt: data.updatedAt,
      });
      location.assign(boardHref(board));
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const toggleStar = (id: string) => {
    try { writeLibrary(readLibrary().map(b => b.id === id ? { ...b, starred: !b.starred } : b)); }
    catch { setError("Der Favorit konnte nicht gespeichert werden."); }
  };
  const visible = boards.filter(b =>
    (filter !== "starred" || b.starred) && (filter !== "shared" || !b.local) &&
    b.title.toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de")),
  ).sort((a, b) => filter === "recent" ? b.openedAt - a.openedAt : sort === "name" ? a.title.localeCompare(b.title, "de") : sort === "created" ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt);
  const total = boards.length;

  return <main className="dashboard">
    <aside className="dashboard-sidebar" aria-label="Arbeitsbereich">
      <a href="/" className="dashboard-brand" aria-label="Whiteboard Startseite">whiteboard</a>
      <button className="dashboard-primary sidebar-create" onClick={openCreate}><Plus size={18} /> Neues Board</button>
      <nav className="dashboard-nav" aria-label="Boardübersicht">
        {([
          ["all", "Alle Boards", Home], ["recent", "Zuletzt geöffnet", Clock3],
          ["starred", "Favoriten", Star], ["shared", "Geteilte Boards", Users],
        ] as const).map(([id, label, Icon]) => <button key={id} aria-label={label} aria-current={filter === id ? "page" : undefined} onClick={() => setFilter(id)}>
          <Icon size={18} /><span>{label}</span>{id === "all" && <small>{total}</small>}{id === "starred" && <small>{boards.filter(b => b.starred).length}</small>}
        </button>)}
      </nav>
      <div className="sidebar-note"><span className="sidebar-note-symbol">✳</span><strong>Ideen werden mehr,<br />wenn man sie teilt.</strong><p>Öffne ein Board und lade andere über „Teilen“ ein.</p></div>
    </aside>

    <div className="dashboard-main">
      <header className="dashboard-topbar"><span><LayoutDashboard size={17} /> Arbeitsbereich</span><label className="dashboard-search"><Search size={18} /><input aria-label="Boards suchen" value={search} onChange={e => setSearch(e.target.value)} placeholder="Boards suchen …" />{search && <button aria-label="Suche löschen" onClick={() => setSearch("")}><X size={15} /></button>}</label><span className="dashboard-account" title={`Angemeldet als ${user.login}`}><Github size={16}/><span>@{user.login}</span></span><form action="/api/auth/logout" method="post"><button className="dashboard-logout" type="submit" aria-label="Abmelden" title="Abmelden"><LogOut size={17}/></button></form></header>
      <div className="dashboard-content">
        <section className="dashboard-welcome"><div><span className="dashboard-eyebrow">DEIN RAUM FÜR IDEEN</span><h1>{sections[filter].title}</h1><p>{sections[filter].subtitle}</p></div><button className="dashboard-primary" ref={newButton} onClick={openCreate}><Plus size={19} /> Neues Board</button></section>
        {filter === "all" && !search && <section className="dashboard-create-banner" aria-label="Ein neues Board beginnen"><div className="banner-paper"><span /><span /><span /><i /></div><div><h2>Alles beginnt mit einer leeren Fläche.</h2><p>Gedanken sammeln, Zusammenhänge sehen, gemeinsam weiterdenken.</p><button onClick={openCreate}>Ein neues Board beginnen <ArrowUpRight size={16} /></button></div><span className="banner-doodle" aria-hidden="true">✳</span></section>}
        <div className="dashboard-controls"><div className="dashboard-board-count">{search ? "Suchergebnisse" : filter === "starred" ? "Mit Stern markiert" : "Deine Boards"}<span>{visible.length}</span></div><div className="dashboard-view-controls"><label className="dashboard-sort"><ArrowDownUp size={15} /><select aria-label="Boards sortieren" value={sort} disabled={filter === "recent"} onChange={e => setSort(e.target.value)}><option value="updated">Zuletzt bearbeitet</option><option value="created">Zuletzt erstellt</option><option value="name">Name A–Z</option></select></label><div className="dashboard-view-toggle" aria-label="Darstellung"><button aria-label="Kachelansicht" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><Grid2X2 size={17} /></button><button aria-label="Listenansicht" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={19} /></button></div></div></div>
        {notice && <div className="dashboard-notice" role="status">{notice}</div>}
        {error && !creating && <div className="dashboard-error" role="alert">{error}</div>}
        {!ready ? <div className="dashboard-empty" role="status">Deine Boards werden geladen …</div> : <div className={`dashboard-boards ${layout === "list" ? "dashboard-list" : ""}`}>
          {filter === "all" && !search && layout === "grid" && <button className="new-board-card" onClick={openCreate}><span><Plus size={27} strokeWidth={1.5} /></span><strong>Neues Board erstellen</strong><small>Eine leere Fläche. Alle Möglichkeiten.</small></button>}
          {visible.map(b => <article className="dashboard-board-card" data-testid="dashboard-board" key={b.id}>
            <a className="dashboard-board-link" href={boardHref(b)} aria-label={`Board öffnen: ${b.title}`}>
              <BoardThumbnail doc={b.doc} />
              <div className="board-card-info"><h2>{b.title || "Unbenanntes Board"}</h2><p>{b.local ? "Lokales Board" : b.role === "view" ? "Nur ansehen" : "Gemeinsam bearbeitbar"}<span>·</span>{dateLabel(b.updatedAt)}</p></div>
              <span className="board-open-arrow"><ArrowUpRight size={17} /></span>
            </a>
            {(b.local || b.isOwner) && <button className="board-delete" aria-label={`${b.title} löschen`} title="Board löschen" onClick={()=>{setDeleteError("");setDeleting(b);}}><Trash2 size={16}/></button>}
            <button className={`board-star ${b.starred ? "is-starred" : ""}`} aria-label={b.starred ? `${b.title} aus Favoriten entfernen` : `${b.title} als Favorit markieren`} aria-pressed={b.starred} onClick={() => toggleStar(b.id)}><Star size={17} fill={b.starred ? "currentColor" : "none"} /></button>
          </article>)}
        </div>}
        {ready && visible.length === 0 && <div className="dashboard-empty"><div><Search size={25} strokeWidth={1.3} /></div><h2>{search ? "Kein Board gefunden" : filter === "starred" ? "Deine Lieblingsboards warten noch." : filter === "shared" ? "Hier ist Platz für gemeinsame Ideen." : "Dein nächster Gedanke hat hier Platz."}</h2><p>{search ? "Versuche einen anderen Namen oder lösche deine Suche." : filter === "starred" ? "Markiere ein Board mit dem Stern, um es hier wiederzufinden." : "Erstelle ein neues Board und leg los."}</p>{search ? <button onClick={() => setSearch("")}>Suche zurücksetzen</button> : filter !== "starred" && <button onClick={openCreate}><Plus size={16} /> Neues Board erstellen</button>}</div>}
        <footer className="dashboard-footer"><Check size={13} /> Deine bestehenden Boards bleiben erhalten. Neue Boards werden automatisch gespeichert.</footer>
      </div>
    </div>

    <dialog ref={deleteDialog} className="dashboard-create-dialog board-delete-dialog" aria-labelledby="delete-board-title" onCancel={e=>{e.preventDefault();if(!deleteBusy)setDeleting(null);}}>
      <form onSubmit={e=>{e.preventDefault();deleteBoard();}}>
        <span className="create-dialog-icon"><Trash2 size={23}/></span>
        <h2 id="delete-board-title">Board löschen?</h2>
        <p>„{deleting?.title}“ wird endgültig gelöscht.{!deleting?.local && " Das Board ist danach auch über bestehende Freigabelinks nicht mehr erreichbar."}</p>
        {deleteError && <p className="dashboard-error" role="alert">{deleteError}</p>}
        <div className="delete-dialog-actions"><button type="button" disabled={deleteBusy} onClick={()=>setDeleting(null)}>Abbrechen</button><button type="submit" className="delete-confirm" disabled={deleteBusy}>{deleteBusy?"Wird gelöscht …":"Board löschen"}</button></div>
      </form>
    </dialog>
    <dialog ref={newDialog} className="dashboard-create-dialog" aria-labelledby="create-board-title" onCancel={e => { e.preventDefault(); closeCreate(); }} onClick={e => { if (e.target === e.currentTarget) closeCreate(); }}>
      <form onSubmit={createBoard}><button type="button" className="create-dialog-close" aria-label="Dialog schließen" disabled={busy} onClick={closeCreate}><X size={19} /></button><span className="create-dialog-icon"><Plus size={25} /></span><h2 id="create-board-title">Platz für eine neue Idee.</h2><p>Gib deinem Board einen Namen. Du kannst ihn später jederzeit ändern.</p><label htmlFor="new-board-title">Boardname</label><input id="new-board-title" autoFocus maxLength={150} value={title} placeholder="Zum Beispiel: Ideen fürs nächste Projekt" onChange={e => setTitle(e.target.value)} disabled={busy} />{error && <p className="dashboard-error" role="alert">{error}</p>}<button className="dashboard-primary" type="submit" disabled={busy}>{busy ? "Board wird angelegt …" : "Board erstellen"}{!busy && <ArrowUpRight size={17} />}</button><small>Dein Board öffnet sich direkt nach dem Erstellen.</small></form>
    </dialog>
  </main>;
}
