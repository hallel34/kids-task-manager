import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { savePrizeStoreToCloud, loadPrizeStoreFromCloud } from '../cloudStorage';
import type { RedemptionRecord, PendingApprovalRecord } from '../data/tasksData';

// Cross-device sync for childPoints/redeemedPrizes/pendingApprovals,
// mirroring useCloudSync's/useRewardsSync's debounce+poll+updatedAt-
// versioning pattern exactly (see useCloudSync.ts for why a plain "skip
// poll if saved recently" timing guard isn't enough - a poll can otherwise
// land while a fresh local change is still mid-save and stomp it back to
// the old value). This channel matters most for the premium-reward
// approval flow: a child's "ממש" request on one device must reach a
// parent's approval screen on a different device, and the parent's
// approve/reject must reach back to the child's device too.
export function usePrizeStoreSync(
  familyCode: string,
  syncEnabled: boolean,
  childPoints: Record<string, number>,
  setChildPoints: Dispatch<SetStateAction<Record<string, number>>>,
  redeemedPrizes: Record<string, RedemptionRecord[]>,
  setRedeemedPrizes: Dispatch<SetStateAction<Record<string, RedemptionRecord[]>>>,
  pendingApprovals: Record<string, PendingApprovalRecord[]>,
  setPendingApprovals: Dispatch<SetStateAction<Record<string, PendingApprovalRecord[]>>>
) {
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownUpdatedAt = useRef<number>(0);
  // Refs mirroring the latest state, so the debounced save always sends the
  // most current values regardless of which of the three states changed.
  const latest = useRef({ childPoints, redeemedPrizes, pendingApprovals });
  latest.current = { childPoints, redeemedPrizes, pendingApprovals };

  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(async () => {
      try {
        const { childPoints, redeemedPrizes, pendingApprovals } = latest.current;
        const writtenAt = await savePrizeStoreToCloud(familyCode, childPoints, redeemedPrizes, pendingApprovals);
        knownUpdatedAt.current = writtenAt;
      } catch {
        // silent fail - next change (or the poll picking up someone else's
        // write) will retry
      }
    }, 1500);
  }, [childPoints, redeemedPrizes, pendingApprovals, syncEnabled, familyCode]);

  useEffect(() => {
    if (!syncEnabled || !familyCode) return;
    const poll = async () => {
      try {
        const result = await loadPrizeStoreFromCloud(familyCode);
        if (result && result.updatedAt > knownUpdatedAt.current) {
          knownUpdatedAt.current = result.updatedAt;
          setChildPoints(result.childPoints);
          setRedeemedPrizes(result.redeemedPrizes as Record<string, RedemptionRecord[]>);
          setPendingApprovals(result.pendingApprovals as Record<string, PendingApprovalRecord[]>);
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
