import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';

// Parent voice message, one document per family:
// families/{familyCode}/commands/voiceMessage. A parent records a short
// voice note outside the app (e.g. in WhatsApp) and it is relayed into
// this document as base64 audio; every family device subscribed here
// plays it once (see hooks/useParentVoice). This deliberately reuses the
// SAME familyCode capability-secret model as the rest of the app's
// cross-device sync (see firestore.rules) - the family code IS the
// credential, and writes to this document are shape/size-validated in
// the rules (short clips only).
export interface ParentVoiceMessage {
  audio: string; // base64-encoded audio, no data: prefix
  mime: string; // e.g. 'audio/mpeg'
  seq: number; // strictly increasing per message; 0 = no message yet
  sentAt: number; // epoch milliseconds
  sentBy: string; // display label of the sender, e.g. 'אבא'
}

export const EMPTY_VOICE_MESSAGE: ParentVoiceMessage = {
  audio: '',
  mime: '',
  seq: 0,
  sentAt: 0,
  sentBy: '',
};

function voiceDocRef(familyCode: string) {
  return doc(db, 'families', familyCode, 'commands', 'voiceMessage');
}

// Real-time subscription, mirroring subscribeToFindDeviceCommand: the
// SDK redelivers the latest server state on reconnect, so a device that
// was offline still gets the newest message when it comes back.
export function subscribeToParentVoiceMessage(
  familyCode: string,
  onChange: (message: ParentVoiceMessage) => void
): Unsubscribe {
  return onSnapshot(
    voiceDocRef(familyCode),
    (snap) => {
      const data = snap.data();
      onChange(data ? ({ ...EMPTY_VOICE_MESSAGE, ...data } as ParentVoiceMessage) : EMPTY_VOICE_MESSAGE);
    },
    () => {
      // Listener error (offline with no cache yet, permission denied,
      // etc.) - fail safe to "no message" rather than replaying stale
      // state.
      onChange(EMPTY_VOICE_MESSAGE);
    }
  );
}
