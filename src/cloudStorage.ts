// Direct Firestore REST API - works without Firebase Auth SDK.
// The family code (see App.tsx) acts as the capability secret; Firestore
// rules scope reads/writes to only the dailyTasks/rewards sub-documents.
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from './firebase';

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function fsUrl(path: string) {
  return `${FS_BASE}/${path}?key=${FIREBASE_API_KEY}`;
}

// Save tasks state to Firestore
export async function saveTasksToCloud(familyCode: string, date: string, tasks: Record<string, any[]>) {
  const url = fsUrl(`families/${familyCode}/dailyTasks/${date}`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        tasks: { stringValue: JSON.stringify(tasks) },
        updatedAt: { integerValue: String(Date.now()) },
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firestore save failed ${resp.status}: ${err.slice(0, 100)}`);
  }
}

// Load tasks state from Firestore
export async function loadTasksFromCloud(familyCode: string, date: string): Promise<Record<string, any[]> | null> {
  const url = fsUrl(`families/${familyCode}/dailyTasks/${date}`);
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const data = await resp.json();
  const raw = data?.fields?.tasks?.stringValue;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Save smileys to Firestore
export async function saveSmileysToCloud(familyCode: string, smileys: Record<string, number>, gifts: Record<string, number>) {
  const url = fsUrl(`families/${familyCode}/rewards/current`);
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        smileys: { stringValue: JSON.stringify(smileys) },
        gifts: { stringValue: JSON.stringify(gifts) },
        updatedAt: { integerValue: String(Date.now()) },
      }
    })
  });
}

// Load smileys from Firestore
export async function loadSmileysFromCloud(familyCode: string): Promise<{ smileys: Record<string, number>; gifts: Record<string, number> } | null> {
  const url = fsUrl(`families/${familyCode}/rewards/current`);
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  try {
    return {
      smileys: JSON.parse(data?.fields?.smileys?.stringValue || '{}'),
      gifts: JSON.parse(data?.fields?.gifts?.stringValue || '{}'),
    };
  } catch { return null; }
}

// Keep for backward compat - no-op listenToTasks (replaced by polling in App.tsx)
export function listenToTasks(_userId: string, _date: string, _callback: (tasks: Record<string, any[]> | null, isLocal: boolean) => void) {
  return () => {}; // noop unsubscribe
}

