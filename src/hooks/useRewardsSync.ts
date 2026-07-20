import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { saveRewardsToCloud, loadRewardsFromCloud } from '../cloudStorage';

// Cross-device sync for smileys/gifts/celebration-shown-today, mirroring
// useCloudSync's debounce+poll+updatedAt-versioning pattern exactly (see
// that file for why a plain "skip poll if saved recently" guard isn't
// enough - a poll can otherwise land while a fresh local award is still
// mid-save and stomp it back to the old count). Without this, smileys and
// the celebration popup only ever lived in this device's localStorage -
// a smiley earned on the kids' tablet would never show up when a parent
// checks progress on their phone, and a second device could show the
// "כל הכבוד" popup again since it had no idea it already fired elsewhere.
export function useRewardsSync(
  familyCode: string,
  syncEnabled: boolean,
  smileyCount: Record<string, number>,
  setSmileyCount: Dispatch<SetStateAction<Record<string, number>>>,
  giftsRedeemed: Record<string, number>,
  setGiftsRedeemed: Dispatch<SetStateAction<Record<string, number>>>,
  celebrationShown: Record<string, string>,
  setCelebrationShown: Dispatch<SetStateAction<Record<string, string>>>
) {
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownUpdatedAt = useRef<number>(0);
  // Refs mirroring the latest state, so the debounced save always sends the
  // most current values regardless of which of the three states changed.
  const latest = useRef({ smileyCount, giftsRedeemed, celebrationShown });
  latest.current = { smileyCount, giftsRedeemed, celebrationShown };

  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(async () => {
      try {
        const { smileyCount, giftsRedeemed, celebrationShown } = latest.current;
        const writtenAt = await saveRewardsToCloud(familyCode, smileyCount, giftsRedeemed, celebrationShown);
        knownUpdatedAt.current = writtenAt;
      } catch {
        // silent fail - next change (or the poll picking up someone else's
        // write) will retry
      }
    }, 1500);
  }, [smileyCount, giftsRedeemed, celebrationShown, syncEnabled, familyCode]);

  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    const poll = async () => {
      try {
        const result = await loadRewardsFromCloud(familyCode);
        if (result && result.updatedAt > knownUpdatedAt.current) {
          knownUpdatedAt.current = result.updatedAt;
          setSmileyCount(result.smileys);
          setGiftsRedeemed(result.gifts);
          setCelebrationShown(result.celebrationShown);
        }
      } catch {
        // silent fail - will retry in 30s
      }
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [syncEnabled, familyCode]);
}
