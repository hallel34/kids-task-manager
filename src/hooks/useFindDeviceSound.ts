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
}

// Loud, looping "find my device" sound for the Parent Dashboard.
// Tries to play public/sounds/find-device.mp3 on loop at the current
// volume; if that file is missing or fails to load, falls back to a
// repeating beep synthesized with the Web Audio API, so the feature still
// works with no audio asset shipped.
export function useFindDeviceSound(): UseFindDeviceSound {
  // Source of truth for the play() guard - a ref (not state) so a rapid
  // double-click can't race past the check before state has re-rendered.
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);

  const stopBeepFallback = useCallback(() => {
    if (beepIntervalRef.current !== null) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    if (activeOscillatorRef.current) {
      try { activeOscillatorRef.current.stop(); } catch { /* already stopped */ }
      activeOscillatorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const playBeepFallback = useCallback(() => {
    const AudioContextCtor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    audioCtxRef.current = ctx;
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
  }, []);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    stopBeepFallback();
    setIsPlaying(false);
  }, [stopBeepFallback]);

  const play = useCallback(() => {
    if (isPlayingRef.current) return; // already playing - no-op, no duplicate instance
    isPlayingRef.current = true;
    setIsPlaying(true);

    let fallbackStarted = false;
    const triggerFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      playBeepFallback();
    };

    const audio = new Audio(SOUND_URL);
    audio.loop = true;
    audio.volume = volumeRef.current;
    audio.addEventListener('error', triggerFallback);
    audioRef.current = audio;

    // Missing file, blocked autoplay, or unsupported format all reject here.
    audio.play().catch(triggerFallback);
  }, [playBeepFallback]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  // Stop and release everything (audio element, oscillator, AudioContext)
  // if the component using this hook unmounts while sound is playing.
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isPlaying, play, stop, volume, setVolume };
}
