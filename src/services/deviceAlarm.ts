import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

// Firestore-backed "find my device" remote command, one document per
// family: families/{familyCode}/commands/findDevice. This deliberately
// reuses the SAME `familyCode` capability-secret model as the rest of the
// app's cross-device sync (see firestore.rules) rather than introducing a
// second identity scheme - the family code IS the credential.
export interface FindDeviceCommand {
  findDevice: boolean;
  startedAt: unknown; // Firestore server Timestamp, or null when idle
  startedBy: string;
  volume: number;
}

const IDLE_COMMAND: FindDeviceCommand = {
  findDevice: false,
  startedAt: null,
  startedBy: '',
  volume: 1,
};

function commandDocRef(familyCode: string) {
  return doc(db, 'families', familyCode, 'commands', 'findDevice');
}

// Real-time subscription. Firestore's SDK keeps its own offline cache and
// automatically redelivers the latest server state as soon as the client
// reconnects, so no custom offline/retry handling is needed here - a
// tablet that goes offline while `findDevice` is set to true will receive
// that update (and start ringing) the moment it's back online.
export function subscribeToFindDeviceCommand(
  familyCode: string,
  onChange: (command: FindDeviceCommand) => void
): Unsubscribe {
  return onSnapshot(
    commandDocRef(familyCode),
    (snap) => {
      const data = snap.data();
      onChange(data ? ({ ...IDLE_COMMAND, ...data } as FindDeviceCommand) : IDLE_COMMAND);
    },
    () => {
      // Listener error (offline with no cache yet, permission denied, etc.)
      // - fail safe to "not ringing" rather than leaving stale state.
      onChange(IDLE_COMMAND);
    }
  );
}

export async function triggerFindDevice(familyCode: string, startedBy: string, volume: number): Promise<void> {
  await setDoc(commandDocRef(familyCode), {
    findDevice: true,
    startedAt: serverTimestamp(),
    startedBy,
    volume,
  });
}

export async function stopFindDevice(familyCode: string): Promise<void> {
  // Only clear the active flag/timestamp - keep the last-used volume and
  // startedBy so re-ringing later doesn't need to re-derive them.
  await setDoc(commandDocRef(familyCode), { findDevice: false, startedAt: null }, { merge: true });
}
