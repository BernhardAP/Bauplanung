import { useSyncExternalStore } from 'react';

export type UndoEntry = {
  id: string;
  label: string;
  at: number;
  undo: () => Promise<void>;
};

const MAX = 20;
let entries: UndoEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  // create new array reference so useSyncExternalStore detects change
  entries = [...entries];
  listeners.forEach((l) => l());
}

export const undoStore = {
  push(label: string, undo: () => Promise<void>) {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    entries = [{ id, label, at: Date.now(), undo }, ...entries].slice(0, MAX);
    notify();
  },
  async run(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entries = entries.filter((e) => e.id !== id);
    notify();
    await entry.undo();
  },
  remove(id: string) {
    entries = entries.filter((e) => e.id !== id);
    notify();
  },
  clear() {
    entries = [];
    notify();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  getSnapshot() {
    return entries;
  },
};

const emptySnapshot: UndoEntry[] = [];
export function useUndoEntries(): UndoEntry[] {
  return useSyncExternalStore(
    undoStore.subscribe,
    undoStore.getSnapshot,
    () => emptySnapshot,
  );
}
