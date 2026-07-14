import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToFindDeviceCommand, triggerFindDevice, stopFindDevice } from '../services/deviceAlarm';
import { useFindDeviceSound } from './useFindDeviceSound';

const FLASH_INTERVAL_MS = 500;
const VIBRATE_REPEAT_MS = 1000;
const VIBRATE_PULSE_MS = 500;

function detectDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPad|Tablet/i.test(ua)) return 'טאבלט';
  if (/iPhone|Android.*Mobile/i.test(ua)) return 'טלפון';
  return 'מחשב';
}

interface UseFindDevice {
  isRinging: boolean; // true on every device once the family command is active
  isFlashOn: boolean; // toggles every 500ms while ringing - for a full-screen flash overlay
  ringTablet: () => Promise<void>;
  stopRinging: () => Promise<void>;
  retryPlayback: () => void; // manual "tap here if you don't hear anything" escape hatch
  volume: number;
  setVolume: (v: number) => void;
  sendError: string | null;
}

// Remote "find my device" alarm. Every device running this hook (parent
// or child view, any browser) subscribes to the family's shared command
// document in real time and rings locally the moment it flips to active -
// the ringing side effect (audio, vibration, screen flash, wake lock) is
// intentionally decoupled from who pressed the button, since the tablet
// that needs to be found could be showing either view. `ringTablet()` /
// `stopRinging()` are what the Parent Dashboard buttons call to write
// that shared command.
export function useFindDevice(familyCode: string, syncEnabled: boolean): UseFindDevice {
  const sound = useFindDeviceSound();
  const [isRinging, setIsRinging] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const startExtras = useCallback(() => {
    if (flashIntervalRef.current === null) {
      flashIntervalRef.current = setInterval(() => setIsFlashOn((prev) => !prev), FLASH_INTERVAL_MS);
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && vibrateIntervalRef.current === null) {
      navigator.vibrate(VIBRATE_PULSE_MS);
      vibrateIntervalRef.current = setInterval(() => navigator.vibrate(VIBRATE_PULSE_MS), VIBRATE_REPEAT_MS);
    }
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request('screen')
        .then((lock) => { wakeLockRef.current = lock; })
        .catch(() => { /* not available / denied right now - ringing still works without it */ });
    }
  }, []);

  const stopExtras = useCallback(() => {
    if (flashIntervalRef.current !== null) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setIsFlashOn(false);
    if (vibrateIntervalRef.current !== null) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(0);
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Arm audio playback on the very first tap/click/keypress anywhere in the
  // app. Mobile browsers (iOS Safari especially) block programmatic audio
  // unless it was started during a real user gesture - a remote trigger
  // arrives via an async Firestore callback, which does NOT count as one,
  // and fails completely silently (no error, just no sound). Almost any
  // interaction with a tablet used daily by kids satisfies this well
  // before a "find my device" trigger would ever be needed.
  useEffect(() => {
    const handleFirstInteraction = () => sound.unlock();
    document.addEventListener('pointerdown', handleFirstInteraction, { once: true, capture: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', handleFirstInteraction, { capture: true });
      document.removeEventListener('keydown', handleFirstInteraction, { capture: true });
    };
  }, [sound.unlock]);

  // Real-time subscription to the shared command - active for as long as
  // sync is on, independent of parent/child view.
  useEffect(() => {
    if (!syncEnabled || !familyCode) {
      setIsRinging(false);
      return;
    }
    const unsubscribe = subscribeToFindDeviceCommand(familyCode, (command) => {
      setIsRinging(command.findDevice);
      if (command.findDevice) {
        sound.setVolume(command.volume ?? 1);
        sound.play(); // no-ops if this device is already playing
      } else {
        sound.stop();
      }
    });
    return () => unsubscribe();
  }, [syncEnabled, familyCode, sound.play, sound.stop, sound.setVolume]);

  // Drive vibration/flash/wake-lock off the ringing state.
  useEffect(() => {
    if (isRinging) startExtras(); else stopExtras();
  }, [isRinging, startExtras, stopExtras]);

  // Release everything if the component using this hook unmounts.
  useEffect(() => {
    return () => {
      stopExtras();
      sound.stop();
    };
  }, [stopExtras, sound.stop]);

  const ringTablet = useCallback(async () => {
    if (!familyCode) return;
    setSendError(null);
    try {
      await triggerFindDevice(familyCode, detectDeviceLabel(), sound.volume);
    } catch {
      setSendError('שליחת הפקודה נכשלה. בדקו חיבור לאינטרנט ושסנכרון בין מכשירים מופעל.');
    }
  }, [familyCode, sound.volume]);

  const stopRinging = useCallback(async () => {
    if (!familyCode) return;
    setSendError(null);
    try {
      await stopFindDevice(familyCode);
    } catch {
      setSendError('עצירת הצליל נכשלה. בדקו חיבור לאינטרנט.');
    }
  }, [familyCode]);

  return {
    isRinging,
    isFlashOn,
    ringTablet,
    stopRinging,
    retryPlayback: sound.forcePlay,
    volume: sound.volume,
    setVolume: sound.setVolume,
    sendError,
  };
}
