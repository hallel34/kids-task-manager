import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToParentVoiceMessage, type ParentVoiceMessage } from '../services/parentVoice';

interface UseParentVoice {
  pending: ParentVoiceMessage | null; // a message this device hasn't played or dismissed yet
  isPlaying: boolean;
  play: () => void; // manual play - also the escape hatch when autoplay was blocked
  dismiss: () => void; // close the banner without listening (counts as handled on THIS device)
}

function lastPlayedKey(familyCode: string): string {
  return `parent_voice_last_seq_${familyCode}`;
}

// Plays a parent's relayed voice message on this device, once per
// message. "Handled" is tracked per device in localStorage, so each
// tablet/phone in the family plays the message once, independently.
//
// Autoplay is attempted the moment a new message lands. Mobile browsers
// block programmatic audio that wasn't preceded by a user gesture on
// the page; in that case the play() promise rejects silently and the
// banner (rendered by App.tsx from `pending`) stays up with a big play
// button - a tap on it IS a gesture, so playback from there always
// works. On a tablet the kids have been tapping all day, autoplay
// usually succeeds directly.
export function useParentVoice(familyCode: string, syncEnabled: boolean): UseParentVoice {
  const [pending, setPending] = useState<ParentVoiceMessage | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingRef = useRef<ParentVoiceMessage | null>(null);
  pendingRef.current = pending;

  const getLastPlayed = useCallback((): number => {
    try {
      return Number(localStorage.getItem(lastPlayedKey(familyCode)) || 0) || 0;
    } catch {
      return 0;
    }
  }, [familyCode]);

  const markHandled = useCallback(
    (seq: number) => {
      try {
        localStorage.setItem(lastPlayedKey(familyCode), String(seq));
      } catch {
        /* storage unavailable (private mode) - banner may reappear, harmless */
      }
      setPending(null);
    },
    [familyCode]
  );

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.onended = () => {
        setIsPlaying(false);
        const p = pendingRef.current;
        if (p) markHandled(p.seq);
      };
      el.onpause = () => setIsPlaying(false);
      audioRef.current = el;
    }
    return audioRef.current;
  }, [markHandled]);

  const tryPlay = useCallback(
    (msg: ParentVoiceMessage) => {
      const el = ensureAudio();
      el.src = `data:${msg.mime || 'audio/mpeg'};base64,${msg.audio}`;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay blocked - the banner's play button handles it on tap.
          setIsPlaying(false);
        });
    },
    [ensureAudio]
  );

  const play = useCallback(() => {
    const p = pendingRef.current;
    if (p) tryPlay(p);
  }, [tryPlay]);

  const dismiss = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    const p = pendingRef.current;
    if (p) markHandled(p.seq);
  }, [markHandled]);

  // Real-time subscription - active in parent and child views alike: the
  // message is for whichever family device is in front of a child.
  useEffect(() => {
    if (!syncEnabled || !familyCode) {
      setPending(null);
      return;
    }
    const unsubscribe = subscribeToParentVoiceMessage(familyCode, (msg) => {
      if (msg.seq > 0 && msg.audio && msg.seq > getLastPlayed()) {
        setPending(msg);
        tryPlay(msg);
      }
    });
    return () => unsubscribe();
  }, [syncEnabled, familyCode, getLastPlayed, tryPlay]);

  // Stop playback if the component using this hook unmounts.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { pending, isPlaying, play, dismiss };
}
