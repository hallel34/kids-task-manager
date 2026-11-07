import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { saveTasksToCloud, loadTasksFromCloud } from '../cloudStorage';
import { getLocalDateKey } from '../utils/date';
import type { Task } from '../types';

// Apply the breakfast feature to existing local/cloud snapshots without
// rebuilding the day or losing completed tasks, photos or parent edits.
function reconcileBreakfastTasks(snapshot: Record<string, Task[]>, dayOfWeek = new Date().getDay()): Record<string, Task[]> {
  let changed = false;
  const next = { ...snapshot };
  for (const [childId, list] of Object.entries(snapshot)) {
    const hasBreakfast = list.some(task => task.id === 'breakfast_choice');
    if (dayOfWeek === 5 && hasBreakfast) {
      next[childId] = list.filter(task => task.id !== 'breakfast_choice');
      changed = true;
    } else if (dayOfWeek !== 5 && !hasBreakfast) {
      next[childId] = [...list, { id: 'breakfast_choice', time: 'evening', title: 'בחירת ארוחת בוקר למחר', emoji: '🥣', completed: false, mandatory: true }];
      changed = true;
    }
  }
  return changed ? next : snapshot;
}

export function generateFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Cross-device sync via Firestore, keyed by a shareable "family code" (see
// firestore.rules - the code itself is the capability secret, no login
// required). Debounces local task changes out to the cloud and polls for
// changes made from other devices.
export function useCloudSync(tasks: Record<string, Task[]>, setTasks: Dispatch<SetStateAction<Record<string, Task[]>>>) {
  const [familyCode, setFamilyCodeState] = useState<string>(() => {
    const saved = localStorage.getItem('hallel_family_code');
    if (saved) return saved;
    const code = generateFamilyCode();
    localStorage.setItem('hallel_family_code', code);
    return code;
  });
  const [syncEnabled, setSyncEnabledState] = useState<boolean>(() => localStorage.getItem('hallel_sync_enabled') === 'true');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The updatedAt stamp of the newest version of "tasks" we know is either
  // already in the cloud or about to be written there. A poll result is
  // only ever applied if its updatedAt is strictly greater than this - see
  // the poll effect below for why a time-based guard isn't enough.
  const knownUpdatedAt = useRef<number>(0);

  const setFamilyCode = (code: string) => {
    localStorage.setItem('hallel_family_code', code);
    setFamilyCodeState(code);
    setSyncStatus('idle');
  };
  const setSyncEnabled = (enabled: boolean) => {
    localStorage.setItem('hallel_sync_enabled', String(enabled));
    setSyncEnabledState(enabled);
    if (!enabled) setSyncStatus('idle');
  };

  // Migrate both local saved lists and snapshots received from older devices.
  // Preserve every existing task object; never reset the day's progress.
  useEffect(() => {
    const reconciled = reconcileBreakfastTasks(tasks);
    if (reconciled !== tasks) setTasks(reconciled);
  }, [tasks, setTasks]);

  // Debounced save whenever tasks change
  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        const writtenAt = await saveTasksToCloud(familyCode, getLocalDateKey(), tasks);
        knownUpdatedAt.current = writtenAt;
        setSyncStatus('ok');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch {
        setSyncStatus('error');
      }
    }, 1500);
  }, [tasks, syncEnabled, familyCode]);

  // Poll Firestore every 30 seconds to receive updates from other devices.
  // Only ever applies a fetched snapshot if its updatedAt is strictly newer
  // than the last version we know about (our own last save, or the last
  // poll result we applied). Without this, a poll landing in the ~1.5s
  // window between a child checking a task and the debounced save above
  // actually completing would fetch the still-stale cloud copy and stomp
  // the fresh local checkmark right back to unchecked - and then the
  // debounce effect would re-fire on that reverted state and helpfully
  // save the wrong thing back to the cloud, permanently.
  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    const poll = async () => {
      try {
        const result = await loadTasksFromCloud(familyCode, getLocalDateKey());
        if (result && result.updatedAt > knownUpdatedAt.current) {
          knownUpdatedAt.current = result.updatedAt;
          setTasks(reconcileBreakfastTasks(result.tasks as Record<string, Task[]>));
          setSyncStatus('ok');
          setTimeout(() => setSyncStatus('idle'), 2000);
        }
      } catch {
        // silent fail - will retry in 30s
      }
    };
    poll(); // initial load
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [syncEnabled, familyCode]);

  return { familyCode, setFamilyCode, syncEnabled, setSyncEnabled, syncStatus };
}
