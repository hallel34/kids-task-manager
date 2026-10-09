import type { Task, Child, TimeOfDay } from '../types';
import { getLocalDateKey, getAgeFromBirthdate, getChildAge } from '../utils/date';

export function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ================= DATA CONSTANTS =================
// Ages are computed from each child's birthdate (getAgeFromBirthdate runs on
// every app load), so they update automatically on birthdays - no manual edit.
// The static `age` field stays in sync at load time for simple display reads;
// any age-dependent LOGIC should use getChildAge(child) directly.
export const CHILDREN: Child[] = [
  { id: 'arava', name: 'ערבה', age: getAgeFromBirthdate('2013-04-09'), birthdate: '2013-04-09', gender: 'female', initial: 'ע', color: '#5D4037', avatarEmoji: '👧', photo: '/photos/arava.jpg' },
  { id: 'hoshen', name: 'חושן', age: getAgeFromBirthdate('2015-09-25'), birthdate: '2015-09-25', gender: 'female', initial: 'ח', color: '#D35400', avatarEmoji: '👧', photo: '/photos/hoshen.jpg' },
  { id: 'peer', name: 'פאר', age: getAgeFromBirthdate('2019-06-24'), birthdate: '2019-06-24', gender: 'male', initial: 'פ', color: '#6A7B42', avatarEmoji: '👦', photo: '/photos/peer.jpg' },
  { id: 'rafael', name: 'רפאל', age: getAgeFromBirthdate('2021-07-12'), birthdate: '2021-07-12', gender: 'male', initial: 'ר', color: '#8A9A5B', avatarEmoji: '👦', photo: '/photos/rafael.jpg' },
];

// Maximum smileys a child can hold - reaching the cap earns a gift, and no
// further smileys accumulate until the gift is redeemed.
export const MAX_SMILEYS = 10;

// Screen time reward (in minutes) per child
// NEW: Per-task points system - each mandatory task earns points, no need to complete ALL
// Points can be spent in prize store OR converted to screen time
export const SCREEN_TIME_REWARD: Record<string, { base: number; bonusPerOptional: number; pointsPerMandatory: number; pointsPerOptional: number }> = {
  arava: { base: 60, bonusPerOptional: 5, pointsPerMandatory: 3, pointsPerOptional: 2 },
  hoshen: { base: 45, bonusPerOptional: 5, pointsPerMandatory: 3, pointsPerOptional: 2 },
  peer: { base: 30, bonusPerOptional: 5, pointsPerMandatory: 3, pointsPerOptional: 2 },
  rafael: { base: 20, bonusPerOptional: 3, pointsPerMandatory: 2, pointsPerOptional: 1 },
};

// Prize store items - redeemable with points
export interface PrizeItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  category: 'screen' | 'privilege' | 'treat' | 'family' | 'premium' | 'personal';
  childIds?: string[];        // set = item belongs to a per-child shop (only those children see it)
  cooldownHours?: number;     // undefined/0 = no cooldown, always available once affordable
  requiresApproval?: boolean; // true = redeeming only creates a pending request; a parent
                               // must approve before points are deducted and the cooldown starts
  isScreenTime?: boolean;     // true = locked while the child has an active "play first" timer
}

export const PRIZE_STORE: PrizeItem[] = [
  { id: 'screen5', name: '5 דקות מסך', emoji: '📱', cost: 5, category: 'screen', cooldownHours: 6, isScreenTime: true },
  { id: 'screen10', name: '10 דקות מסך', emoji: '🎮', cost: 10, category: 'screen', cooldownHours: 12, isScreenTime: true },
  { id: 'screen20', name: '20 דקות מסך', emoji: '💻', cost: 20, category: 'screen', cooldownHours: 24, isScreenTime: true },
  { id: 'late15', name: 'לישון 15 דק׳ מאוחר', emoji: '🌙', cost: 12, category: 'privilege', cooldownHours: 24 },
  { id: 'choose_meal', name: 'לבחור ארוחת ערב', emoji: '🍕', cost: 15, category: 'privilege', cooldownHours: 168 },
  { id: 'choose_dessert', name: 'לבחור קינוח', emoji: '🍰', cost: 8, category: 'treat', cooldownHours: 48 },
  { id: 'no_chore', name: 'פטור ממשימה אחת מחר', emoji: '🎫', cost: 20, category: 'privilege', cooldownHours: 48 },
  { id: 'family_game', name: 'משחק קלפים עם הורה', emoji: '🃏', cost: 10, category: 'family', cooldownHours: 24 },
  { id: 'park', name: 'יציאה לפארק', emoji: '🌳', cost: 25, category: 'family', cooldownHours: 72 },
  { id: 'ice_cream', name: 'גלידה!', emoji: '🍦', cost: 18, category: 'treat', cooldownHours: 72 },
  { id: 'sticker', name: 'מדבקה מיוחדת', emoji: '⭐', cost: 5, category: 'treat', cooldownHours: 12 },
  { id: 'movie_night', name: 'סרט משפחתי בשבת', emoji: '🎬', cost: 30, category: 'family', cooldownHours: 168 },

  // Premium tier - expensive, requires saving points, and requires a parent's
  // explicit approval before points are deducted (see requestPrizeApproval /
  // approvePendingRedemption / rejectPendingRedemption in App.tsx).
  { id: 'movie_family_night', name: 'ערב סרט משפחתי', emoji: '🎬', cost: 80, category: 'premium', requiresApproval: true },
  { id: 'choose_restaurant', name: 'לבחור מסעדה', emoji: '🍔', cost: 100, category: 'premium', requiresApproval: true },
  { id: 'parent_surprise', name: 'הפתעת הורים', emoji: '🎁', cost: 120, category: 'premium', requiresApproval: true },
  { id: 'sleep_late_hour', name: 'לישון שעה מאוחר יותר', emoji: '🛏️', cost: 90, category: 'premium', requiresApproval: true },
  { id: 'family_bowling', name: 'באולינג משפחתי', emoji: '🎳', cost: 150, category: 'premium', requiresApproval: true },
  { id: 'amusement_park', name: 'פארק שעשועים', emoji: '🎡', cost: 250, category: 'premium', requiresApproval: true },
  { id: 'screen_full_hour', name: 'שעה שלמה של מסך', emoji: '🎮', cost: 80, category: 'premium', requiresApproval: true, isScreenTime: true },
  { id: 'small_toy', name: 'צעצוע קטן לבחירה', emoji: '🛍️', cost: 200, category: 'premium', requiresApproval: true },
  { id: 'family_pizza', name: 'להזמין פיצה משפחתית', emoji: '🍕', cost: 180, category: 'premium', requiresApproval: true },
  { id: 'special_day_parent', name: 'יום מיוחד עם אבא או אמא', emoji: '🏆', cost: 300, category: 'premium', requiresApproval: true },
  // Per-child shops (age and taste adapted). Physical items - a parent approves each.
  { id: 'ribbons', name: 'אביזרי שיער יפים', emoji: '🎀', cost: 100, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'nails', name: 'לק ומדבקות לציפורניים', emoji: '💅', cost: 110, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'jewelry', name: 'תכשיט קטן לבחירה', emoji: '💍', cost: 200, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'bag', name: 'תיק או ארנק', emoji: '👜', cost: 280, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'shirt', name: 'חולצה לבחירה', emoji: '👚', cost: 300, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'mall', name: 'יציאה עם אמא לקפה וקניות', emoji: '☕', cost: 160, category: 'personal', childIds: ['arava'], requiresApproval: true },
  { id: 'h_hair', name: 'גומיות וסיכות מיוחדות', emoji: '🎀', cost: 90, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'h_beads', name: 'ערכת צמידי חרוזים', emoji: '📿', cost: 120, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'h_notebook', name: 'מחברת ומדבקות חמודות', emoji: '🦄', cost: 100, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'h_craft', name: 'ערכת יצירה', emoji: '🎨', cost: 150, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'h_hat', name: 'כובע או צעיף לבחירה', emoji: '🧢', cost: 180, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'h_dress', name: 'שמלה או חולצה לבחירה', emoji: '👗', cost: 280, category: 'personal', childIds: ['hoshen'], requiresApproval: true },
  { id: 'p_car', name: 'מכונית צעצוע', emoji: '🚗', cost: 100, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'p_cards', name: 'חבילת קלפי משחק', emoji: '🃏', cost: 100, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'p_lego', name: 'לגו קטן', emoji: '🧱', cost: 200, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'p_ball', name: 'כדורגל', emoji: '⚽', cost: 220, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'p_hero', name: 'חולצת גיבור על', emoji: '🦸', cost: 250, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'p_dad', name: 'יום מיוחד עם אבא', emoji: '🏆', cost: 300, category: 'personal', childIds: ['peer'], requiresApproval: true },
  { id: 'r_bubbles', name: 'בועות סבון', emoji: '🫧', cost: 60, category: 'personal', childIds: ['rafael'], requiresApproval: true },
  { id: 'r_stickers', name: 'מדבקות רכבים', emoji: '🚒', cost: 90, category: 'personal', childIds: ['rafael'], requiresApproval: true },
  { id: 'r_dino', name: 'דינוזאור צעצוע', emoji: '🦖', cost: 120, category: 'personal', childIds: ['rafael'], requiresApproval: true },
  { id: 'r_puzzle', name: 'פאזל', emoji: '🧩', cost: 150, category: 'personal', childIds: ['rafael'], requiresApproval: true },
  { id: 'r_blocks', name: 'קוביות בנייה', emoji: '🧱', cost: 180, category: 'personal', childIds: ['rafael'], requiresApproval: true },
  { id: 'r_shirt', name: 'חולצה עם רכב', emoji: '🚜', cost: 220, category: 'personal', childIds: ['rafael'], requiresApproval: true },
];

// A finalized redemption. `cooldownUntil` (epoch ms) is only present if the
// prize had a cooldownHours - checking it is what keeps a prize out of the
// store until the cooldown expires (see isPrizeOnCooldown below).
export interface RedemptionRecord {
  id: string;
  prizeId: string;
  date: string; // ISO - when the redemption became final (purchase time for
                // non-premium, approval time for premium)
  cooldownUntil?: number;
}

// A premium-reward request awaiting a parent's approve/reject - no points
// have been deducted yet.
export interface PendingApprovalRecord {
  id: string;
  prizeId: string;
  requestedAt: string; // ISO
}

// "Play first, screen later": a per-child timer started the moment they
// finish all mandatory tasks for a time period (see toggleTask in App.tsx).
// `key` (e.g. "2026-08-10_evening") identifies which period triggered it,
// so re-completing tasks in an already-finished period doesn't restart it.
// `endsAt` is an absolute epoch-ms timestamp so the countdown survives a
// page refresh with no special handling.
export interface PlayTimerRecord {
  key: string;
  endsAt: number;
}

export function isPlayTimerActive(childId: string, playTimers: Record<string, PlayTimerRecord>, now: number = Date.now()): boolean {
  const record = playTimers[childId];
  return !!record && record.endsAt > now;
}

// ========== PRIZE STORE COOLDOWN / STATS HELPERS ==========
// A prize can be redeemed many times over the app's lifetime - use the MOST
// RECENT redemption's cooldownUntil, not just the last array entry (order
// isn't guaranteed after a cancellation removes an earlier one).
function _latestCooldownUntil(prizeId: string, records: RedemptionRecord[]): number {
  return records
    .filter((r) => r.prizeId === prizeId && r.cooldownUntil)
    .reduce((max, r) => Math.max(max, r.cooldownUntil || 0), 0);
}

export function isPrizeOnCooldown(prize: PrizeItem, childId: string, redeemedPrizes: Record<string, RedemptionRecord[]>, now: number = Date.now()): boolean {
  if (!prize.cooldownHours) return false;
  const records = redeemedPrizes[childId] || [];
  return _latestCooldownUntil(prize.id, records) > now;
}

export function getPrizeCooldownRemainingMs(prize: PrizeItem, childId: string, redeemedPrizes: Record<string, RedemptionRecord[]>, now: number = Date.now()): number {
  if (!prize.cooldownHours) return 0;
  const records = redeemedPrizes[childId] || [];
  return Math.max(0, _latestCooldownUntil(prize.id, records) - now);
}

export function formatCooldownRemaining(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `זמין שוב בעוד: ${minutes} דק׳`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `זמין שוב בעוד: ${hours} שעות`;
  const days = Math.ceil(hours / 24);
  return `זמין שוב בעוד: ${days} ${days === 1 ? 'יום' : 'ימים'}`;
}

export function getAvailablePrizes(childId: string, redeemedPrizes: Record<string, RedemptionRecord[]>, now: number = Date.now()): PrizeItem[] {
  return PRIZE_STORE.filter((p) => (!p.childIds || p.childIds.includes(childId)) && !isPrizeOnCooldown(p, childId, redeemedPrizes, now));
}

export function getPrizesOnCooldown(childId: string, redeemedPrizes: Record<string, RedemptionRecord[]>, now: number = Date.now()): (PrizeItem & { remainingMs: number })[] {
  return PRIZE_STORE
    .filter((p) => (!p.childIds || p.childIds.includes(childId)) && isPrizeOnCooldown(p, childId, redeemedPrizes, now))
    .map((p) => ({ ...p, remainingMs: getPrizeCooldownRemainingMs(p, childId, redeemedPrizes, now) }))
    .sort((a, b) => a.remainingMs - b.remainingMs);
}

export interface RedemptionStats {
  totalRedemptions: number;
  totalPointsSpent: number;
  mostRedeemed: { prizeId: string; count: number } | null;
  favoriteCategory: { category: PrizeItem['category']; count: number } | null;
  perChild: Record<string, { count: number; pointsSpent: number; mostRedeemedPrizeId: string | null }>;
}

// Pure derivation over the full (already-persisted) redemption history - no
// separate stats state to keep in sync.
export function computeRedemptionStats(redeemedPrizes: Record<string, RedemptionRecord[]>): RedemptionStats {
  const prizeCounts: Record<string, number> = {};
  const categoryCounts: Partial<Record<PrizeItem['category'], number>> = {};
  const perChild: RedemptionStats['perChild'] = {};
  let totalRedemptions = 0;
  let totalPointsSpent = 0;

  Object.entries(redeemedPrizes).forEach(([childId, records]) => {
    const childPrizeCounts: Record<string, number> = {};
    let childPoints = 0;
    records.forEach((r) => {
      const prize = PRIZE_STORE.find((p) => p.id === r.prizeId);
      if (!prize) return;
      totalRedemptions++;
      totalPointsSpent += prize.cost;
      childPoints += prize.cost;
      prizeCounts[r.prizeId] = (prizeCounts[r.prizeId] || 0) + 1;
      childPrizeCounts[r.prizeId] = (childPrizeCounts[r.prizeId] || 0) + 1;
      categoryCounts[prize.category] = (categoryCounts[prize.category] || 0) + 1;
    });
    const topChildPrize = Object.entries(childPrizeCounts).sort((a, b) => b[1] - a[1])[0];
    perChild[childId] = {
      count: records.length,
      pointsSpent: childPoints,
      mostRedeemedPrizeId: topChildPrize ? topChildPrize[0] : null,
    };
  });

  const topPrize = Object.entries(prizeCounts).sort((a, b) => b[1] - a[1])[0];
  const topCategory = (Object.entries(categoryCounts) as [PrizeItem['category'], number][]).sort((a, b) => b[1] - a[1])[0];

  return {
    totalRedemptions,
    totalPointsSpent,
    mostRedeemed: topPrize ? { prizeId: topPrize[0], count: topPrize[1] } : null,
    favoriteCategory: topCategory ? { category: topCategory[0], count: topCategory[1] } : null,
    perChild,
  };
}

// ========== WEEKLY MISSIONS - fixed-assignee recurring tasks (unlike the
// randomly-rotated SHARED_DUTIES/FRIDAY_DUTIES) ==========
export interface WeeklyMission {
  id: string;
  title: string;
  emoji: string;
  time: TimeOfDay;
  mandatory: boolean;
  requiresPhoto?: boolean;
  points: number;      // fixed point value, overriding the child's flat rate
  dayOfWeek: number;    // 0=Sun..6=Sat
  childIds: string[];   // exactly which children get this mission
}

export const WEEKLY_MISSIONS: WeeklyMission[] = [
  { id: 'wm_cook_dinner', title: 'בישול ארוחת ערב', emoji: '🍳', time: 'evening', mandatory: true, requiresPhoto: true, points: 30, dayOfWeek: 1, childIds: ['arava', 'hoshen'] },
];

export function getWeeklyMissionTasksFor(childId: string, dayOfWeek: number): Task[] {
  return WEEKLY_MISSIONS
    .filter((m) => m.dayOfWeek === dayOfWeek && m.childIds.includes(childId))
    .map((m) => ({
      id: m.id,
      time: m.time,
      title: m.title,
      emoji: m.emoji,
      completed: false,
      mandatory: m.mandatory,
      requiresPhoto: m.requiresPhoto,
      points: m.points,
    }));
}

// Streak bonus: consecutive days with 80%+ completion
export const STREAK_BONUS_PER_DAY = 2; // extra points per streak day
export const STREAK_WEEKLY_BONUS = 15; // bonus points for 7-day streak

// Weekly excellence threshold
export const WEEKLY_EXCELLENCE_THRESHOLD = 0.9; // 90% completion for weekly bonus
export const WEEKLY_EXCELLENCE_BONUS = 20; // bonus points for weekly excellence

// School schedule info
const SCHOOL_SCHEDULE: Record<string, { regular: string; tuesday: string }> = {
  arava: { regular: '15:45', tuesday: '13:45' },
  hoshen: { regular: '14:30', tuesday: '12:30' },
  peer: { regular: '14:30', tuesday: '12:30' },
  rafael: { regular: '16:00', tuesday: '16:00' },
};

export function getSchoolEndTime(childId: string): string {
  const day = new Date().getDay(); // 0=Sun
  const schedule = SCHOOL_SCHEDULE[childId];
  if (!schedule) return '';
  return day === 2 ? schedule.tuesday : schedule.regular; // Tuesday = 2
}

// ========== SHARED HOUSEHOLD DUTIES - rotate daily between children ==========
// Each duty is assigned to one eligible child per day, seeded by the date.
interface SharedDuty {
  id: string;
  title: string;
  emoji: string;
  time: TimeOfDay;
  mandatory: boolean;
  minAge: number; // minimum child age to be eligible
  requiresPhoto?: boolean;
}

export const SHARED_DUTIES: SharedDuty[] = [
  { id: 'sd_boxes',      title: 'הוצאת קופסאות אוכל לכיור',    emoji: '🍱', time: 'afternoon', mandatory: true,  minAge: 5  },
  { id: 'sd_dishload',   title: 'הכנסת כלים למדיח',             emoji: '🍽️', time: 'afternoon', mandatory: true,  minAge: 7  },
  { id: 'sd_dishunload', title: 'ריקון המדיח',                  emoji: '🥛', time: 'afternoon', mandatory: true,  minAge: 7  },
  { id: 'sd_clear',      title: 'פינוי כלים מארוחת ערב',        emoji: '🍛', time: 'evening',   mandatory: true,  minAge: 5  },
  { id: 'sd_laundry',    title: 'כביסה (תליה/קיפול)',           emoji: '🧺', time: 'afternoon', mandatory: true,  minAge: 10 },
  { id: 'sd_washer',     title: 'הכנסת מכונת כביסה',           emoji: '🧺', time: 'afternoon', mandatory: false, minAge: 10 },
  { id: 'sd_siblings',   title: 'עזרה באחים הקטנים',           emoji: '👶', time: 'afternoon', mandatory: false, minAge: 7  },
];

// Friday (Erev Shabbat) chores - same rotation mechanism as SHARED_DUTIES,
// but a separate pool: each duty goes to exactly one eligible child per
// Friday instead of every child doing all of them.
export const FRIDAY_DUTIES: SharedDuty[] = [
  { id: 'f1', title: 'סידור החדר וניקיון',    emoji: '🧹', time: 'afternoon', mandatory: true, minAge: 6, requiresPhoto: true },
  { id: 'f2', title: 'קיפול והכנסת כביסה',    emoji: '🧺', time: 'afternoon', mandatory: true, minAge: 6  },
  { id: 'f3', title: 'ניקיון הבית לשבת',      emoji: '🏠', time: 'afternoon', mandatory: true, minAge: 6  },
  { id: 'f4', title: 'עריכת שולחן שבת',       emoji: '🕯️', time: 'afternoon', mandatory: true, minAge: 6  },
  { id: 'f5', title: 'סידור נרות שבת',        emoji: '🕎', time: 'afternoon', mandatory: true, minAge: 6  },
  { id: 'f6', title: 'השקיית הגינה',          emoji: '🌱', time: 'afternoon', mandatory: true, minAge: 10 },
  { id: 'f7', title: 'עזרה בהכנות לשבת',      emoji: '🍲', time: 'afternoon', mandatory: true, minAge: 10 },
];

// Deterministic LCG seeded by date string → same result all day, different every day
function _seededRand(seed: number) {
  let s = seed;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function _rollDutyAssignments(rand: () => number, duties: SharedDuty[]): Record<string, string> {
  const assignments: Record<string, string> = {};
  duties.forEach(duty => {
    const eligible = CHILDREN.filter(c => getChildAge(c) >= duty.minAge);
    if (eligible.length > 0) {
      assignments[duty.id] = eligible[Math.floor(rand() * eligible.length)].id;
    }
  });
  return assignments;
}

function _isDateFriday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 5;
}

export function getDailyDutyAssignments(): Record<string, string> {
  const today = getLocalDateKey();
  const key = `hallel_daily_duties_${today}`;
  const saved = localStorage.getItem(key);
  if (saved) { try { return JSON.parse(saved); } catch {} }

  const duties = _isDateFriday(today) ? FRIDAY_DUTIES : SHARED_DUTIES;
  const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const assignments = _rollDutyAssignments(_seededRand(seed), duties);
  localStorage.setItem(key, JSON.stringify(assignments));
  return assignments;
}

// Manually re-roll today's duty assignments (the "הגרל מחדש" button). Unlike
// getDailyDutyAssignments(), the seed here is NOT derived from the date -
// that would make every reroll land on the same result, since the date
// hasn't changed. Uses Math.random() instead so each click actually
// produces a different assignment, then overwrites today's cached value.
export function reshuffleDailyDutyAssignments(): Record<string, string> {
  const today = getLocalDateKey();
  const key = `hallel_daily_duties_${today}`;
  const duties = _isDateFriday(today) ? FRIDAY_DUTIES : SHARED_DUTIES;
  const assignments = _rollDutyAssignments(Math.random, duties);
  localStorage.setItem(key, JSON.stringify(assignments));
  return assignments;
}

// Preview a duty rotation for a day-type that may not be today (e.g. a
// parent editing Friday's template on a Tuesday). If the requested type
// matches today, this is just today's real (cached) assignment; otherwise
// it's a deterministic-but-uncached roll, since it isn't actually "today"'s
// assignment and shouldn't be persisted as such.
export function previewDutyAssignments(isFriday: boolean): Record<string, string> {
  const today = getLocalDateKey();
  if (isFriday === _isDateFriday(today)) return getDailyDutyAssignments();
  const duties = isFriday ? FRIDAY_DUTIES : SHARED_DUTIES;
  const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return _rollDutyAssignments(_seededRand(seed), duties);
}

// ========== PERSONAL TASK TEMPLATES (per-child hygiene, homework, own room) ==========
// Shared household tasks are NOT in these lists – they are added separately via getDailyDutyAssignments.
export function getInitialTasksForChild(childId: string): Task[] {
  const child = CHILDREN.find(c => c.id === childId);
  const age = child ? getChildAge(child) : 7;

  // === TODDLER (2-4) ===
  if (age <= 4) {
    return [
      { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰',      emoji: '⏱️', completed: false, mandatory: true },
      { id: 'm2', time: 'morning', title: 'נטילת ידיים',         emoji: '💧', completed: false, mandatory: true },
      { id: 'm3', time: 'morning', title: 'התלבשות (עם עזרה)',   emoji: '👕', completed: false, mandatory: true },
      { id: 'm4', time: 'morning', title: 'נעילת נעליים',        emoji: '👟', completed: false, mandatory: true },
      { id: 'm5', time: 'morning', title: 'צחצוח שיניים',        emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'm6', time: 'morning', title: 'אכילת ארוחת בוקר',   emoji: '🥣', completed: false, mandatory: true },
      { id: 'a2', time: 'afternoon', title: 'ציור או יצירה 🎨',  emoji: '🖍️', completed: false, mandatory: true },
      { id: 'a3', time: 'afternoon', title: 'סידור הצעצועים',    emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'e2', time: 'evening', title: 'מקלחת (עם עזרה)',     emoji: '🚿', completed: false, mandatory: true },
      { id: 'e3', time: 'evening', title: 'צחצוח שיניים',        emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'e4', time: 'evening', title: 'לבישת פיג׳מה',        emoji: '💤', completed: false, mandatory: true },
      { id: 'e5', time: 'evening', title: 'סידור צעצועים לפני שינה', emoji: '🧸', completed: false, mandatory: false },
    ];
  }

  // === KINDERGARTEN (5-6) ===
  if (age <= 6) {
    return [
      { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰',          emoji: '⏱️', completed: false, mandatory: true },
      { id: 'm2', time: 'morning', title: 'נטילת ידיים וברכות',     emoji: '💧', completed: false, mandatory: true },
      { id: 'm3', time: 'morning', title: 'התלבשות עצמאית',         emoji: '👕', completed: false, mandatory: true },
      { id: 'm4', time: 'morning', title: 'נעילת נעליים לבד',       emoji: '👟', completed: false, mandatory: true },
      { id: 'm5', time: 'morning', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'm6', time: 'morning', title: 'אכילת ארוחת בוקר',       emoji: '🥣', completed: false, mandatory: true },
      { id: 'm7', time: 'morning', title: 'סידור המיטה',            emoji: '🛏️', completed: false, mandatory: true },
      { id: 'a2', time: 'afternoon', title: 'ציור או יצירה 🎨',     emoji: '🖍️', completed: false, mandatory: true },
      { id: 'a3', time: 'afternoon', title: 'סידור הצעצועים',       emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'a4', time: 'afternoon', title: 'סידור החדר',           emoji: '🧹', completed: false, mandatory: true },
      { id: 'e2', time: 'evening', title: 'מקלחת',                  emoji: '🚿', completed: false, mandatory: true },
      { id: 'e3', time: 'evening', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'e4', time: 'evening', title: 'לבישת פיג׳מה',           emoji: '💤', completed: false, mandatory: true },
      { id: 'e5', time: 'evening', title: 'סידור צעצועים לפני שינה', emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
    ];
  }

  // === ELEMENTARY (7-9) ===
  if (age <= 9) {
    return [
      { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰',      emoji: '⏱️', completed: false, mandatory: true },
      { id: 'm2', time: 'morning', title: 'התלבשות עצמאית',     emoji: '👕', completed: false, mandatory: true },
      { id: 'm3', time: 'morning', title: 'צחצוח שיניים',       emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'm4', time: 'morning', title: 'נטילת ידיים וברכות', emoji: '💧', completed: false, mandatory: true },
      { id: 'm5', time: 'morning', title: 'סידור המיטה',        emoji: '🛏️', completed: false, mandatory: true },
      { id: 'm6', time: 'morning', title: 'הכנת תיק לבית ספר',  emoji: '🎒', completed: false, mandatory: true },
      { id: 'a1', time: 'afternoon', title: 'הכנת שיעורי בית 📚', emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'a3', time: 'afternoon', title: 'סידור החדר',        emoji: '🧹', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'a5', time: 'afternoon', title: 'פעילות חוגים / ספורט', emoji: '⚽', completed: false, mandatory: false },
      { id: 'e2', time: 'evening', title: 'מקלחת',              emoji: '🚿', completed: false, mandatory: true },
      { id: 'e3', time: 'evening', title: 'צחצוח שיניים',       emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'e4', time: 'evening', title: 'לבישת פיג׳מה',       emoji: '💤', completed: false, mandatory: true },
      { id: 'e5', time: 'evening', title: 'הכנת תיק למחר',      emoji: '🎒', completed: false, mandatory: false },
    ];
  }

  // === PRE-TEEN (10-12) ===
  if (age <= 12) {
    return [
      { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰',          emoji: '⏱️', completed: false, mandatory: true },
      { id: 'm2', time: 'morning', title: 'התלבשות והתארגנות',      emoji: '👕', completed: false, mandatory: true },
      { id: 'm3', time: 'morning', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'm4', time: 'morning', title: 'נטילת ידיים וברכות',     emoji: '💧', completed: false, mandatory: true },
      { id: 'm5', time: 'morning', title: 'סידור המיטה והחדר',      emoji: '🛏️', completed: false, mandatory: true },
      { id: 'm6', time: 'morning', title: 'הכנת תיק לבית ספר',      emoji: '🎒', completed: false, mandatory: true },
      { id: 'a1', time: 'afternoon', title: 'הכנת שיעורי בית 📚',   emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'a4', time: 'afternoon', title: 'סידור החדר',           emoji: '🧹', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'a6', time: 'afternoon', title: 'פעילות חוגים / ספורט', emoji: '⚽', completed: false, mandatory: false },
      { id: 'e3', time: 'evening', title: 'מקלחת',                  emoji: '🚿', completed: false, mandatory: true },
      { id: 'e4', time: 'evening', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'e5', time: 'evening', title: 'לבישת פיג׳מה',           emoji: '💤', completed: false, mandatory: true },
    ];
  }

  // === TEENAGER (13+) ===
  return [
    { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰',          emoji: '⏱️', completed: false, mandatory: true },
    { id: 'm2', time: 'morning', title: 'הכנת תיק לבית ספר',      emoji: '🎒', completed: false, mandatory: true },
    { id: 'm3', time: 'morning', title: 'התלבשות והתארגנות',      emoji: '👕', completed: false, mandatory: true },
    { id: 'm4', time: 'morning', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'm5', time: 'morning', title: 'נטילת ידיים וברכות',     emoji: '💧', completed: false, mandatory: true },
    { id: 'm6', time: 'morning', title: 'סידור המיטה והחדר',      emoji: '🛏️', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'a1', time: 'afternoon', title: 'הכנת שיעורי בית 📚',   emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'a5', time: 'afternoon', title: 'סידור החדר וניקיון',   emoji: '🧹', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'e3', time: 'evening', title: 'מקלחת',                  emoji: '🚿', completed: false, mandatory: true },
    { id: 'e4', time: 'evening', title: 'צחצוח שיניים',           emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'e5', time: 'evening', title: 'לבישת פיג׳מה',           emoji: '💤', completed: false, mandatory: true },
  ];
}

// Friday (Erev Shabbat) special tasks. The Friday chore itself (room
// cleaning, table setting, etc.) is NOT included here - it comes from the
// FRIDAY_DUTIES rotation via buildTasksForDayType(), same as weekday shared
// duties, so each eligible child gets one assigned chore instead of all of
// them getting the full list.
export function getFridayTasksForChild(childId: string): Task[] {
  const child = CHILDREN.find(c => c.id === childId);
  const age = child ? getChildAge(child) : 7;

  const morningTasks = getInitialTasksForChild(childId).filter(t => t.time === 'morning');

  if (age <= 5) {
    // Too young for the rotation (FRIDAY_DUTIES minAge is 6) - simpler fixed tasks.
    return [
      ...morningTasks,
      { id: 'f1', time: 'afternoon', title: 'סידור הצעצועים', emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'f2', time: 'afternoon', title: 'עזרה בסידור שולחן שבת', emoji: '🕯️', completed: false, mandatory: true },
      { id: 'f3', time: 'afternoon', title: 'השקיית עציצים', emoji: '🌱', completed: false, mandatory: true },
      { id: 'fe1', time: 'evening', title: 'מקלחת לכבוד שבת', emoji: '🚿', completed: false, mandatory: true },
      { id: 'fe2', time: 'evening', title: 'לבישת בגדי שבת', emoji: '👔', completed: false, mandatory: true },
    ];
  }

  const fridayEvening: Task[] = [
    { id: 'fe1', time: 'evening', title: 'מקלחת לכבוד שבת', emoji: '🚿', completed: false, mandatory: true },
    { id: 'fe2', time: 'evening', title: 'לבישת בגדי שבת', emoji: '👔', completed: false, mandatory: true },
  ];

  return [...morningTasks, ...fridayEvening];
}

// Build the assigned duty tasks for a child given an assignments map and a
// duty pool (SHARED_DUTIES for weekdays, FRIDAY_DUTIES for Friday).
export function getSharedDutyTasksFor(childId: string, assignments: Record<string, string>, duties: SharedDuty[] = SHARED_DUTIES): Task[] {
  return duties
    .filter(d => assignments[d.id] === childId)
    .map(d => ({
      id: d.id,
      time: d.time,
      title: d.title,
      emoji: d.emoji,
      completed: false,
      mandatory: d.mandatory,
      ...(d.requiresPhoto ? { requiresPhoto: true } : {}),
    }));
}

// Single canonical builder for one child's task list on a given day of week
// (0=Sun..6=Sat): template (Friday vs. a regular weekday) + duty rotation
// (SHARED_DUTIES on weekdays, FRIDAY_DUTIES on Friday) + weekly missions
// (WEEKLY_MISSIONS, fixed-assignee tasks tied to a specific day) + any
// day-template custom tasks. Every place that builds a day's task list -
// "today", the day-of-week editor preview, and the nightly regeneration in
// App.tsx - goes through this so they can't drift apart from one another.
export function buildTasksForDayType(
  childId: string,
  dayOfWeek: number,
  dutyAssignments: Record<string, string>,
  customDayTasks: Record<string, Task[]>
): Task[] {
  const isFriday = dayOfWeek === 5;
  const base = isFriday ? getFridayTasksForChild(childId) : getInitialTasksForChild(childId);
  const shared = getSharedDutyTasksFor(childId, dutyAssignments, isFriday ? FRIDAY_DUTIES : SHARED_DUTIES);
  const missions = getWeeklyMissionTasksFor(childId, dayOfWeek);
  const customKey = `${childId}_${isFriday ? 'friday' : 'regular'}`;
  const custom = customDayTasks[customKey] || [];
  // Mandatory end-of-day task for every child: pick tomorrow's breakfast.
  // Skip Friday evenings because the family does not use the tablet then.
  // Saturday evening still picks Sunday breakfast (and Arava's lunch).
  const breakfast: Task = { id: 'breakfast_choice', time: 'evening', title: 'בחירת ארוחת בוקר למחר', emoji: '🥣', completed: false, mandatory: true };
  return [...base, ...shared, ...missions, ...custom, ...(isFriday ? [] : [breakfast])];
}

// Get tasks based on day of week
export function getTasksForToday(childId: string): Task[] {
  const dayOfWeek = new Date().getDay();
  const assignments = getDailyDutyAssignments();
  return buildTasksForDayType(childId, dayOfWeek, assignments, {});
}

// Calculate earned screen time for a child - NEW: per-task points system
export function getEarnedScreenTime(childId: string, childTasks: Task[]): { earned: number; base: number; bonus: number; allMandatoryDone: boolean; points: number; mandatoryCompleted: number; totalMandatory: number } {
  const reward = SCREEN_TIME_REWARD[childId] || { base: 30, bonusPerOptional: 5, pointsPerMandatory: 3, pointsPerOptional: 2 };
  const mandatory = childTasks.filter(t => t.mandatory);
  const optional = childTasks.filter(t => !t.mandatory);
  const completedMandatory = mandatory.filter(t => t.completed).length;
  const completedOptional = optional.filter(t => t.completed).length;
  const allMandatoryDone = mandatory.every(t => t.completed);

  // Points system: earn points per task (not all-or-nothing)
  const mandatoryPoints = completedMandatory * reward.pointsPerMandatory;
  const optionalPoints = completedOptional * reward.pointsPerOptional;
  const totalPoints = mandatoryPoints + optionalPoints;

  // Screen time: minimum 3 mandatory tasks to unlock, then scale by completion
  const minTasksForScreen = Math.min(3, mandatory.length);
  const screenUnlocked = completedMandatory >= minTasksForScreen;

  // Calculate earned screen time proportionally
  const completionRatio = mandatory.length > 0 ? completedMandatory / mandatory.length : 1;
  const baseEarned = screenUnlocked ? Math.round(reward.base * completionRatio) : 0;
  const bonus = completedOptional * reward.bonusPerOptional;

  return {
    earned: baseEarned + (screenUnlocked ? bonus : 0),
    base: reward.base,
    bonus: screenUnlocked ? bonus : 0,
    allMandatoryDone,
    points: totalPoints,
    mandatoryCompleted: completedMandatory,
    totalMandatory: mandatory.length,
  };
}
