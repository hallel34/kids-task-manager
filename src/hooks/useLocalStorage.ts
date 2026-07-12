import { useEffect, useState } from 'react';
import { safeParseJSON } from '../data/tasksData';

// Mirrors a piece of React state into localStorage under `key`, JSON-encoded.
// `initialValue` (or its lazy form) is used both as the state's default and
// as the fallback when nothing is stored yet / stored JSON fails to parse.
export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fallback = initialValue instanceof Function ? initialValue() : initialValue;
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : safeParseJSON<T>(saved, fallback);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
