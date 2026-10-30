import { BoardDocument, parseDocument, STORAGE_KEY } from "./document";
import { Session } from "./collaboration";

export const LIBRARY_KEY = "whiteboard.boards.v1";
export const LIBRARY_EVENT = "whiteboard:boards-changed";
export type LibraryBoard = {
  id: string;
  token?: string;
  role: "edit" | "view";
  title: string;
  doc: BoardDocument;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
  starred: boolean;
  local?: boolean;
  isOwner?: boolean;
};

export function readLibrary(): LibraryBoard[] {
  const raw = localStorage.getItem(LIBRARY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw Error("Die Boardübersicht konnte nicht geladen werden.");
  return parsed.map((item) => {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" ||
      !["edit", "view"].includes(item.role) || (!item.local && typeof item.token !== "string") ||
      ![item.createdAt, item.updatedAt, item.openedAt].every(v => typeof v === "number" && Number.isFinite(v)) ||
      typeof item.starred !== "boolean") {
      throw Error("Die Boardübersicht enthält einen ungültigen Eintrag.");
    }
    return { ...item, doc: parseDocument(item.doc) } as LibraryBoard;
  });
}

export function writeLibrary(boards: LibraryBoard[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(boards));
  window.dispatchEvent(new Event(LIBRARY_EVENT));
}

export function rememberBoard(session: Session, doc: BoardDocument, options: {
  opened?: boolean; createdAt?: number; updatedAt?: number;
} = {}) {
  const boards = readLibrary();
  const existing = boards.find((b) => b.id === session.id);
  const now = Date.now();
  const changed = !existing || JSON.stringify(existing.doc) !== JSON.stringify(doc);
  const keepEdit = existing?.isOwner === true && session.isOwner !== true;
  const board: LibraryBoard = {
    id: session.id,
    token: keepEdit ? existing.token : session.token,
    role: keepEdit ? "edit" : session.role,
    isOwner: keepEdit ? true : session.isOwner ?? false,
    title: doc.title,
    doc,
    createdAt: options.createdAt ?? existing?.createdAt ?? now,
    updatedAt: options.updatedAt ?? (changed ? now : existing?.updatedAt ?? now),
    openedAt: options.opened ? now : existing?.openedAt ?? now,
    starred: existing?.starred ?? false,
  };
  if (JSON.stringify(existing) !== JSON.stringify(board)) {
    writeLibrary([...boards.filter((b) => b.id !== session.id), board]);
  }
  return board;
}

export function rememberLocalBoard(doc: BoardDocument, opened = false) {
  const boards = readLibrary(), old = boards.find((b) => b.local), now = Date.now();
  const changed = !old || JSON.stringify(old.doc) !== JSON.stringify(doc);
  const board: LibraryBoard = {
    id: "local", local: true, role: "edit", title: doc.title, doc,
    createdAt: old?.createdAt ?? now,
    updatedAt: changed ? now : old.updatedAt,
    openedAt: opened ? now : old?.openedAt ?? now,
    starred: old?.starred ?? false,
  };
  if (JSON.stringify(old) !== JSON.stringify(board)) writeLibrary([...boards.filter((b) => !b.local), board]);
}

export function migrateLocalBoard() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) rememberLocalBoard(parseDocument(JSON.parse(raw)));
}

export function boardHref(board: Pick<LibraryBoard, "id" | "token" | "local">): string {
  if (board.local) return "/board";
  return `/board?board=${encodeURIComponent(board.id)}#${new URLSearchParams({ token: board.token! })}`;
}


export function removeBoard(id: string) {
  const boards = readLibrary();
  const board = boards.find(b => b.id === id);
  if (board?.local) localStorage.removeItem(STORAGE_KEY);
  else localStorage.removeItem(`${STORAGE_KEY}.${id}`);
  writeLibrary(boards.filter(b => b.id !== id));
}
