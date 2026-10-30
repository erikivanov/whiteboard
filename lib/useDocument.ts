"use client";
import { rememberLocalBoard } from "./boardLibrary";
import { diff, merge } from "./collaboration";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  BoardDocument,
  emptyDocument,
  parseDocument,
  STORAGE_KEY,
} from "./document";
export function useDocument() {
  const [doc, setDoc] = useState<BoardDocument>(emptyDocument);
  const current = useRef(doc);
  const storageKey = useRef(STORAGE_KEY);
  const existed = useRef(false), removedRef = useRef(false);
  const [removed, setRemoved] = useState(false);
  const cannotSave = useCallback(() => {
    if (new URL(location.href).searchParams.has("board")) return false;
    if (existed.current && localStorage.getItem(STORAGE_KEY) === null) {
      removedRef.current = true; setRemoved(true);
    }
    return removedRef.current;
  }, []);
  const [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Wird geladen …");
  const past = useRef<{before:BoardDocument;after:BoardDocument}[]>([]),
    future = useRef<{before:BoardDocument;after:BoardDocument}[]>([]);
  const [revision, bump] = useState(0);
  const replace = useCallback((d: BoardDocument) => {
    current.current = d;
    setDoc(d);
  }, []);
  useEffect(() => {
    const board = new URL(location.href).searchParams.get("board");
    storageKey.current = board ? `${STORAGE_KEY}.${board}` : STORAGE_KEY;
    try {
      const raw = board ? null : localStorage.getItem(storageKey.current);
      if (raw) { existed.current=true; const loaded=parseDocument(JSON.parse(raw)); replace(loaded); rememberLocalBoard(loaded,true); }
      setSaveStatus("Lokal gespeichert");
    } catch {
      setSaveStatus("Speicher konnte nicht geladen werden – Export empfohlen");
    }
    setReady(true);
  }, [replace]);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Wird gespeichert …");
    const t = setTimeout(() => {
      try {
        if(cannotSave()){setSaveStatus("Dieses lokale Board wurde gelöscht");return;}
        localStorage.setItem(new URL(location.href).searchParams.has("board") ? `${STORAGE_KEY}.${new URL(location.href).searchParams.get("board")}` : storageKey.current, JSON.stringify(doc));
        if (!new URL(location.href).searchParams.has("board")) { existed.current=true; rememberLocalBoard(doc); }
        setSaveStatus("Lokal gespeichert");
      } catch {
        setSaveStatus("Speichern fehlgeschlagen – bitte exportieren");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [doc, ready, cannotSave]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      try {
        if(cannotSave()){setSaveStatus("Dieses lokale Board wurde gelöscht");return;}
        localStorage.setItem(new URL(location.href).searchParams.has("board") ? `${STORAGE_KEY}.${new URL(location.href).searchParams.get("board")}` : storageKey.current, JSON.stringify(current.current));
        if (!new URL(location.href).searchParams.has("board")) { existed.current=true; rememberLocalBoard(current.current); }
      } catch {}
    };
    const deleted = (event: StorageEvent) => {
      if(event.key===STORAGE_KEY && event.newValue===null && existed.current && !new URL(location.href).searchParams.has("board")) {
        removedRef.current=true;setRemoved(true);setSaveStatus("Dieses lokale Board wurde gelöscht");
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("storage", deleted);
    return () => {window.removeEventListener("pagehide", flush);window.removeEventListener("storage", deleted);};
  }, [ready, cannotSave]);
  const record = useCallback((before: BoardDocument) => {
    if (JSON.stringify(before) === JSON.stringify(current.current)) return;
    past.current = [...past.current.slice(-99), {before,after:current.current}];
    future.current = [];
    bump((v) => v + 1);
  }, []);
  const commit = useCallback(
    (d: BoardDocument) => {
      const before = current.current;
      replace(d);
      record(before);
    },
    [replace, record],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev) {
      future.current.push(prev);
      replace(merge(current.current, diff(prev.after, prev.before)));
      bump((v) => v + 1);
    }
  }, [replace]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next) {
      past.current.push(next);
      replace(merge(current.current, diff(next.before, next.after)));
      bump((v) => v + 1);
    }
  }, [replace]);
  return {
    doc,
    current,
    replace,
    commit,
    record,
    undo,
    redo,
    ready,
    removed,
    saveStatus,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  };
}
