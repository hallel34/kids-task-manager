import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { saveTasksToCloud, loadTasksFromCloud } from '../cloudStorage';
import type { Task } from '../types';

function generateFamilyCode(): string {
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
  const lastLocalSave = useRef<number>(0);

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

  // Debounced save whenever tasks change
  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    const today = new Date().toISOString().split('T')[0];
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        await saveTasksToCloud(familyCode, today, tasks);
        lastLocalSave.current = Date.now();
        setSyncStatus('ok');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch {
        setSyncStatus('error');
      }
    }, 1500);
  }, [tasks, syncEnabled, familyCode]);

  // Poll Firestore every 30 seconds to receive updates from other devices
  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    const today = new Date().toISOString().split('T')[0];
    const poll = async () => {
      // Skip if we just saved locally (avoid overwriting our own data)
      if (Date.now() - lastLocalSave.current < 5000) return;
      try {
        const cloudTasks = await loadTasksFromCloud(familyCode, today);
        if (cloudTasks) {
          setTasks(cloudTasks as Record<string, Task[]>);
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
