// Direct Firestore REST API - works without Firebase Auth SDK.
// The family code (see App.tsx) acts as the capability secret; Firestore
// rules scope reads/writes to only the dailyTasks/rewards sub-documents.
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from './firebase';

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function fsUrl(path: string) {
  return `${FS_BASE}/${path}?key=${FIREBASE_API_KEY}`;
}

// Save tasks state to Firestore. Returns the updatedAt stamp it wrote, so
// the caller can remember exactly which version is now in the cloud
// (see loadTasksFromCloud + useCloudSync's staleness check).
export async function saveTasksToCloud(familyCode: string, date: string, tasks: Record<string, any[]>, updatedAt: number = Date.now()): Promise<number> {
  const url = fsUrl(`families/${familyCode}/dailyTasks/${date}`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        tasks: { stringValue: JSON.stringify(tasks) },
        updatedAt: { integerValue: String(updatedAt) },
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firestore save failed ${resp.status}: ${err.slice(0, 100)}`);
  }
  return updatedAt;
}

// Load tasks state from Firestore, along with the updatedAt stamp it was
// saved with - callers must compare this against the last version they
// know about before applying it, otherwise a poll that lands while a local
// change is still mid-save can fetch stale data and clobber that change.
export async function loadTasksFromCloud(familyCode: string, date: string): Promise<{ tasks: Record<string, any[]>; updatedAt: number } | null> {
  const url = fsUrl(`families/${familyCode}/dailyTasks/${date}`);
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const data = await resp.json();
  const raw = data?.fields?.tasks?.stringValue;
  if (!raw) return null;
  const updatedAt = Number(data?.fields?.updatedAt?.integerValue || 0);
  try { return { tasks: JSON.parse(raw), updatedAt }; } catch { return null; }
}

// Save smileys/gifts/celebration-shown-today to Firestore. Returns the
// updatedAt stamp it wrote (see saveTasksToCloud - same versioning pattern,
// needed so a poll can't clobber a fresh local award with a stale copy).
export async function saveRewardsToCloud(
  familyCode: string,
  smileys: Record<string, number>,
  gifts: Record<string, number>,
  celebrationShown: Record<string, string>,
  updatedAt: number = Date.now()
): Promise<number> {
  const url = fsUrl(`families/${familyCode}/rewards/current`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        smileys: { stringValue: JSON.stringify(smileys) },
        gifts: { stringValue: JSON.stringify(gifts) },
        celebrationShown: { stringValue: JSON.stringify(celebrationShown) },
        updatedAt: { integerValue: String(updatedAt) },
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firestore rewards save failed ${resp.status}: ${err.slice(0, 100)}`);
  }
  return updatedAt;
}

// Load smileys/gifts/celebration-shown-today from Firestore, with the
// updatedAt stamp - callers must compare before applying, same reason as
// loadTasksFromCloud.
export async function loadRewardsFromCloud(familyCode: string): Promise<{ smileys: Record<string, number>; gifts: Record<string, number>; celebrationShown: Record<string, string>; updatedAt: number } | null> {
  const url = fsUrl(`families/${familyCode}/rewards/current`);
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const data = await resp.json();
  const updatedAt = Number(data?.fields?.updatedAt?.integerValue || 0);
  try {
    return {
      smileys: JSON.parse(data?.fields?.smileys?.stringValue || '{}'),
      gifts: JSON.parse(data?.fields?.gifts?.stringValue || '{}'),
      celebrationShown: JSON.parse(data?.fields?.celebrationShown?.stringValue || '{}'),
      updatedAt,
    };
  } catch { return null; }
}

// Save childPoints/redeemedPrizes/pendingApprovals to Firestore. Returns the
// updatedAt stamp it wrote (see saveTasksToCloud - same versioning pattern,
// needed so a poll can't clobber a fresh local point change or approval).
export async function savePrizeStoreToCloud(
  familyCode: string,
  childPoints: Record<string, number>,
  redeemedPrizes: Record<string, any[]>,
  pendingApprovals: Record<string, any[]>,
  updatedAt: number = Date.now()
): Promise<number> {
  const url = fsUrl(`families/${familyCode}/prizeStore/current`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        childPoints: { stringValue: JSON.stringify(childPoints) },
        redeemedPrizes: { stringValue: JSON.stringify(redeemedPrizes) },
        pendingApprovals: { stringValue: JSON.stringify(pendingApprovals) },
        updatedAt: { integerValue: String(updatedAt) },
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firestore prize store save failed ${resp.status}: ${err.slice(0, 100)}`);
  }
  return updatedAt;
}

// Load childPoints/redeemedPrizes/pendingApprovals from Firestore, with the
// updatedAt stamp - callers must compare before applying, same reason as
// loadTasksFromCloud.
export async function loadPrizeStoreFromCloud(familyCode: string): Promise<{
  childPoints: Record<string, number>;
  redeemedPrizes: Record<string, any[]>;
  pendingApprovals: Record<string, any[]>;
  updatedAt: number;
} | null> {
  const url = fsUrl(`families/${familyCode}/prizeStore/current`);
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const data = await resp.json();
  const updatedAt = Number(data?.fields?.updatedAt?.integerValue || 0);
  try {
    return {
      childPoints: JSON.parse(data?.fields?.childPoints?.stringValue || '{}'),
      redeemedPrizes: JSON.parse(data?.fields?.redeemedPrizes?.stringValue || '{}'),
      pendingApprovals: JSON.parse(data?.fields?.pendingApprovals?.stringValue || '{}'),
      updatedAt,
    };
  } catch { return null; }
}

// Keep for backward compat - no-op listenToTasks (replaced by polling in App.tsx)
export function listenToTasks(_userId: string, _date: string, _callback: (tasks: Record<string, any[]> | null, isLocal: boolean) => void) {
  return () => {}; // noop unsubscribe
}

// ================= FAMILY CONFIG (per-family roster, cloud-driven) =================
// A family's roster - children, their screen-time/points rates, and the
// parent PIN - can live in the cloud under the family code instead of being
// compiled into the bundle (tasksData.ts CHILDREN). App.tsx's config gate
// loads this once at startup and, when present, feeds it through the same
// `familyData` prop the Firebase Auth path uses. The children's daily task
// lists are NOT stored here: they are derived from each child's age by the
// templates in tasksData.ts (getInitialTasksForChild / getFridayTasksForChild),
// so a config only carries identity + reward settings.
export interface CloudFamilyConfig {
  familyName?: string;
  parentPin?: string;
  children: Array<{
    id: string;
    name: string;
    age: number;
    birthdate?: string; // "yyyy-mm-dd" - when set, the app computes the live age from it
    gender?: 'male' | 'female';
    color: string;
    avatarEmoji: string;
    photo: string;
  }>;
  screenTimeRewards?: Record<string, { base: number; bonusPerOptional: number; pointsPerMandatory?: number; pointsPerOptional?: number }>;
}

// Save the family config to Firestore. Returns the updatedAt stamp it wrote
// (same versioning pattern as saveRewardsToCloud).
export async function saveFamilyConfigToCloud(familyCode: string, config: CloudFamilyConfig, updatedAt: number = Date.now()): Promise<number> {
  const url = fsUrl(`families/${familyCode}/config/current`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        config: { stringValue: JSON.stringify(config) },
        updatedAt: { integerValue: String(updatedAt) },
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firestore family config save failed ${resp.status}: ${err.slice(0, 100)}`);
  }
  return updatedAt;
}

// Load the family config from Firestore, or null when this family has none
// (404 / unreadable / malformed) - callers then fall back to the compiled-in
// defaults, so a family that never opted into a cloud config is unaffected.
export async function loadFamilyConfigFromCloud(familyCode: string): Promise<{ config: CloudFamilyConfig; updatedAt: number } | null> {
  const url = fsUrl(`families/${familyCode}/config/current`);
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const data = await resp.json();
  const raw = data?.fields?.config?.stringValue;
  if (!raw) return null;
  const updatedAt = Number(data?.fields?.updatedAt?.integerValue || 0);
  try {
    const config = JSON.parse(raw) as CloudFamilyConfig;
    if (!Array.isArray(config.children) || config.children.length === 0) return null;
    return { config, updatedAt };
  } catch { return null; }
}

