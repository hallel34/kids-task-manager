import type { Task, Child, TimeOfDay } from '../types';
import { getLocalDateKey } from '../utils/date';

export function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ================= DATA CONSTANTS =================
export const CHILDREN: Child[] = [
  { id: 'arava', name: 'ערבה', age: 13, gender: 'female', initial: 'ע', color: '#5D4037', avatarEmoji: '👧', photo: '/photos/arava.jpg' },
  { id: 'hoshen', name: 'חושן', age: 10, gender: 'female', initial: 'ח', color: '#D35400', avatarEmoji: '👧', photo: '/photos/hoshen.jpg' },
  { id: 'peer', name: 'פאר', age: 7, gender: 'male', initial: 'פ', color: '#6A7B42', avatarEmoji: '👦', photo: '/photos/peer.jpg' },
  { id: 'rafael', name: 'רפאל', age: 5, gender: 'male', initial: 'ר', color: '#8A9A5B', avatarEmoji: '👦', photo: '/photos/rafael.jpg' },
];

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
  category: 'screen' | 'privilege' | 'treat' | 'family';
}

export const PRIZE_STORE: PrizeItem[] = [
  { id: 'screen5', name: '5 דקות מסך', emoji: '📱', cost: 5, category: 'screen' },
  { id: 'screen10', name: '10 דקות מסך', emoji: '🎮', cost: 10, category: 'screen' },
  { id: 'screen20', name: '20 דקות מסך', emoji: '💻', cost: 20, category: 'screen' },
  { id: 'late15', name: 'לישון 15 דק׳ מאוחר', emoji: '🌙', cost: 12, category: 'privilege' },
  { id: 'choose_meal', name: 'לבחור ארוחת ערב', emoji: '🍕', cost: 15, category: 'privilege' },
  { id: 'choose_dessert', name: 'לבחור קינוח', emoji: '🍰', cost: 8, category: 'treat' },
  { id: 'no_chore', name: 'פטור ממשימה אחת מחר', emoji: '🎫', cost: 20, category: 'privilege' },
  { id: 'family_game', name: 'משחק קלפים עם הורה', emoji: '🃏', cost: 10, category: 'family' },
  { id: 'park', name: 'יציאה לפארק', emoji: '🌳', cost: 25, category: 'family' },
  { id: 'ice_cream', name: 'גלידה!', emoji: '🍦', cost: 18, category: 'treat' },
  { id: 'sticker', name: 'מדבקה מיוחדת', emoji: '⭐', cost: 5, category: 'treat' },
  { id: 'movie_night', name: 'סרט משפחתי בשבת', emoji: '🎬', cost: 30, category: 'family' },
];

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

// Deterministic LCG seeded by date string → same result all day, different every day
function _seededRand(seed: number) {
  let s = seed;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

export function getDailyDutyAssignments(): Record<string, string> {
  const today = getLocalDateKey();
  const key = `hallel_daily_duties_${today}`;
  const saved = localStorage.getItem(key);
  if (saved) { try { return JSON.parse(saved); } catch {} }

  const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = _seededRand(seed);
  const assignments: Record<string, string> = {};

  SHARED_DUTIES.forEach(duty => {
    const eligible = CHILDREN.filter(c => c.age >= duty.minAge);
    if (eligible.length > 0) {
      assignments[duty.id] = eligible[Math.floor(rand() * eligible.length)].id;
    }
  });

  localStorage.setItem(key, JSON.stringify(assignments));
  return assignments;
}

// ========== PERSONAL TASK TEMPLATES (per-child hygiene, homework, own room) ==========
// Shared household tasks are NOT in these lists – they are added separately via getDailyDutyAssignments.
export function getInitialTasksForChild(childId: string): Task[] {
  const child = CHILDREN.find(c => c.id === childId);
  const age = child?.age || 7;

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

// Friday (Erev Shabbat) special tasks
export function getFridayTasksForChild(childId: string): Task[] {
  const child = CHILDREN.find(c => c.id === childId);
  const age = child?.age || 7;
  const isOlder = age >= 10;

  const morningTasks = getInitialTasksForChild(childId).filter(t => t.time === 'morning');

  const fridayAfternoon: Task[] = [
    { id: 'f1', time: 'afternoon', title: 'סידור החדר וניקיון', emoji: '🧹', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'f2', time: 'afternoon', title: 'קיפול והכנסת כביסה', emoji: '🧺', completed: false, mandatory: true },
    { id: 'f3', time: 'afternoon', title: 'ניקיון הבית לשבת', emoji: '🏠', completed: false, mandatory: age >= 7 },
    { id: 'f4', time: 'afternoon', title: 'עריכת שולחן שבת', emoji: '🕯️', completed: false, mandatory: true },
    { id: 'f5', time: 'afternoon', title: 'סידור נרות שבת', emoji: '🕎', completed: false, mandatory: age >= 6 },
    { id: 'f6', time: 'afternoon', title: 'השקיית הגינה', emoji: '🌱', completed: false, mandatory: isOlder },
    { id: 'f7', time: 'afternoon', title: 'עזרה בהכנות לשבת', emoji: '🍲', completed: false, mandatory: isOlder },
  ];

  if (age <= 5) {
    // Simpler tasks for youngest
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

  return [...morningTasks, ...fridayAfternoon, ...fridayEvening];
}

// Build the assigned shared-duty tasks for a child given an assignments map
export function getSharedDutyTasksFor(childId: string, assignments: Record<string, string>): Task[] {
  return SHARED_DUTIES
    .filter(d => assignments[d.id] === childId)
    .map(d => ({
      id: d.id,
      time: d.time,
      title: d.title,
      emoji: d.emoji,
      completed: false,
      mandatory: d.mandatory,
    }));
}

// Single canonical builder for one child's task list on a given day-type
// (Friday vs. a regular weekday): template + shared-duty rotation (regular
// days only) + any day-template custom tasks. Every place that builds a
// day's task list - "today", the day-of-week editor preview, and the
// nightly regeneration in App.tsx - goes through this so they can't drift
// apart from one another.
export function buildTasksForDayType(
  childId: string,
  isFriday: boolean,
  dutyAssignments: Record<string, string>,
  customDayTasks: Record<string, Task[]>
): Task[] {
  const base = isFriday ? getFridayTasksForChild(childId) : getInitialTasksForChild(childId);
  const shared = isFriday ? [] : getSharedDutyTasksFor(childId, dutyAssignments);
  const customKey = `${childId}_${isFriday ? 'friday' : 'regular'}`;
  const custom = customDayTasks[customKey] || [];
  return [...base, ...shared, ...custom];
}

// Get tasks based on day of week
export function getTasksForToday(childId: string): Task[] {
  const isFriday = new Date().getDay() === 5;
  // Friday tasks never use shared-duty rotation, so skip the (cached but
  // still not-free) lookup entirely on Fridays, same as before.
  const assignments = isFriday ? {} : getDailyDutyAssignments();
  return buildTasksForDayType(childId, isFriday, assignments, {});
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
