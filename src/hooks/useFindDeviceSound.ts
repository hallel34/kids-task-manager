import { useCallback, useEffect, useRef, useState } from 'react';

const SOUND_URL = '/sounds/find-device.mp3';
const FALLBACK_BEEP_INTERVAL_MS = 700;
const FALLBACK_BEEP_DURATION_S = 0.4;
const FALLBACK_BEEP_FREQUENCY_HZ = 1000;

interface UseFindDeviceSound {
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
  volume: number; // 0-1
  setVolume: (v: number) => void;
  unlock: () => void;
  forcePlay: () => void;
}

function getAudioContextCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

// Loud, looping "find my device" sound for the Parent Dashboard.
// Tries to play public/sounds/find-device.mp3 on loop at the current
// volume; if that file is missing or fails to load, falls back to a
// repeating beep synthesized with the Web Audio API, so the feature still
// works with no audio asset shipped.
//
// Mobile browsers (iOS Safari in particular) only allow an <audio>
// element or AudioContext to be driven programmatically if it was
// started/resumed during a real user gesture (tap/click) - once armed
// that way it keeps working from later async code (like a Firestore
// listener callback triggered by a DIFFERENT device), but a brand-new
// element/context created from that async callback with no prior gesture
// is silently blocked with no error at all. That's why the audio element
// and AudioContext here are created ONCE and reused via ensureAudioEl()/
// ensureAudioCtx(), and why unlock()/forcePlay() exist - callers should
// invoke unlock() from any real user tap as early as possible (see
// useFindDevice), and forcePlay() from a manual "tap to retry" affordance
// if a remote trigger still didn't produce audible sound.
export function useFindDeviceSound(): UseFindDeviceSound {
  // Source of truth for the play() guard - a ref (not state) so a rapid
  // double-click can't race past the check before state has re-rendered.
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);

  const ensureAudioEl = useCallback((): HTMLAudioElement => {
    if (!audioElRef.current) {
      const el = new Audio(SOUND_URL);
      el.loop = true;
      audioElRef.current = el;
    }
    return audioElRef.current;
  }, []);

  const ensureAudioCtx = useCallback((): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    const ctx = new Ctor();
    audioCtxRef.current = ctx;
    return ctx;
  }, []);

  // Call from within a real click/tap handler, as early as possible (see
  // useFindDevice's one-time document listener), to arm both audio paths
  // ahead of any later remote trigger.
  const unlock = useCallback(() => {
    const el = ensureAudioEl();
    el.muted = true;
    el.play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      })
      .catch(() => { el.muted = false; });

    const ctx = ensureAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, [ensureAudioEl, ensureAudioCtx]);

  const stopBeepFallback = useCallback(() => {
    if (beepIntervalRef.current !== null) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    if (activeOscillatorRef.current) {
      try { activeOscillatorRef.current.stop(); } catch { /* already stopped */ }
      activeOscillatorRef.current = null;
    }
    // Deliberately NOT closing the AudioContext - keeping it alive (just
    // idle) means it stays unlocked and reusable for the next alarm
    // without needing another user gesture.
  }, []);

  const playBeepFallback = useCallback(() => {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const playOneBeep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = FALLBACK_BEEP_FREQUENCY_HZ;
      gain.gain.value = volumeRef.current;
      osc.connect(gain);
      gain.connect(ctx.destination);
      activeOscillatorRef.current = osc;
      osc.start();
      osc.stop(ctx.currentTime + FALLBACK_BEEP_DURATION_S);
    };

    playOneBeep(); // first beep immediately, then loop
    beepIntervalRef.current = setInterval(playOneBeep, FALLBACK_BEEP_INTERVAL_MS);
  }, [ensureAudioCtx]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    stopBeepFallback();
    setIsPlaying(false);
  }, [stopBeepFallback]);

  const attemptPlay = useCallback(() => {
    let fallbackStarted = false;
    const triggerFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (audioElRef.current) audioElRef.current.pause();
      playBeepFallback();
    };

    const el = ensureAudioEl();
    el.onerror = triggerFallback;
    el.volume = volumeRef.current;
    el.currentTime = 0;

    // Missing file, blocked autoplay, or unsupported format all reject here.
    el.play().catch(triggerFallback);
  }, [ensureAudioEl, playBeepFallback]);

  const play = useCallback(() => {
    if (isPlayingRef.current) return; // already playing - no-op, no duplicate instance
    isPlayingRef.current = true;
    setIsPlaying(true);
    attemptPlay();
  }, [attemptPlay]);

  // Retries playback even if state already says "playing" - for a manual
  // "tap here if you don't hear anything" affordance. The tap itself is a
  // real user gesture, so it can succeed even after an earlier
  // programmatic play() was silently blocked.
  const forcePlay = useCallback(() => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    stopBeepFallback();
    attemptPlay();
  }, [attemptPlay, stopBeepFallback]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (audioElRef.current) audioElRef.current.volume = clamped;
  }, []);

  // Full teardown (including the AudioContext this time) if the component
  // using this hook unmounts.
  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      audioElRef.current = null;
    };
  }, [stop]);

  return { isPlaying, play, stop, volume, setVolume, unlock, forcePlay };
}
