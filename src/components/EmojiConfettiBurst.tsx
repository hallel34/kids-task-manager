import { motion } from 'motion/react';

interface EmojiConfettiBurstProps {
  emojis?: string[];
  count?: number;
}

// Lightweight "confetti" made of falling/fading emoji particles, extracted
// from the celebration modal's original inline effect so both it and the
// prize-redemption success popup can share one implementation. Deliberately
// not a real particle/confetti library - this stays consistent with the
// rest of the app's animation idiom (motion.span + AnimatePresence) and
// avoids adding a new dependency to an already-large bundle.
export function EmojiConfettiBurst({ emojis = ['⭐', '🎉', '🎊', '✨', '💫'], count = 20 }: EmojiConfettiBurstProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 400, opacity: [0, 1, 0] }}
          transition={{ delay: i * 0.1, duration: 2, repeat: Infinity }}
          style={{ left: `${Math.random() * 100}%` }}
        >
          {emojis[i % emojis.length]}
        </motion.span>
      ))}
    </div>
  );
}
