"use client";

import type { DemoData } from "./types";
import { generateSeed } from "./seed";

const STORAGE_KEY = "wishtrip_crm_demo_v1";
// Bump to force a reseed when the seed shape changes.
export const SEED_VERSION = 1;

let cache: DemoData | null = null;
const listeners = new Set<() => void>();

function freshSeed(): DemoData {
  const db = generateSeed();
  db.version = SEED_VERSION;
  return db;
}

function load(): DemoData {
  if (cache) return cache;
  if (typeof window === "undefined") {
    // SSR pass of a client component: throwaway seed, never persisted.
    return freshSeed();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoData;
      if (parsed.version === SEED_VERSION) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    // corrupt storage — reseed
  }
  cache = freshSeed();
  save();
  return cache;
}

function save() {
  if (!cache || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage full / private mode — in-memory cache still works for the tab
  }
}

function notify() {
  save();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDb(): DemoData {
  return load();
}

export function mutateDb(fn: (db: DemoData) => void): DemoData {
  const db = load();
  fn(db);
  cache = db;
  notify();
  return db;
}

export function resetDemoData(): void {
  cache = freshSeed();
  save();
  listeners.forEach((l) => l());
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter}${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
