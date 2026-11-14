import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useCloudSync } from './hooks/useCloudSync';
import { useRewardsSync } from './hooks/useRewardsSync';
import { useFindDevice } from './hooks/useFindDevice';
import { useParentVoice } from './hooks/useParentVoice';
import { EmojiConfettiBurst } from './components/EmojiConfettiBurst';
import { BreakfastPicker } from './components/BreakfastPicker';
import { isCurrentlyShabbat, getHebrewDate, getHebrewDayMonth, LOCATION } from './utils/hebrewDate';
import { getLocalDateKey, getChildAge, getAgeFromBirthdate } from './utils/date';
import type { Task, Child, TimeOfDay, ViewMode } from './types';
import {
  safeParseJSON,
  CHILDREN,
  SCREEN_TIME_REWARD,
  PRIZE_STORE,
  SHARED_DUTIES,
  FRIDAY_DUTIES,
  STREAK_BONUS_PER_DAY,
  STREAK_WEEKLY_BONUS,
  WEEKLY_EXCELLENCE_THRESHOLD,
  WEEKLY_EXCELLENCE_BONUS,
  MAX_SMILEYS,
  getSchoolEndTime,
  getDailyDutyAssignments,
  reshuffleDailyDutyAssignments,
  previewDutyAssignments,
  getSharedDutyTasksFor,
  getTasksForToday,
  getEarnedScreenTime,
  buildTasksForDayType,
  isPrizeOnCooldown,
  getPrizeCooldownRemainingMs,
  formatCooldownRemaining,
  getAvailablePrizes,
  getPrizesOnCooldown,
  computeRedemptionStats,
  isPlayTimerActive,
} from './data/tasksData';
import type { PrizeItem, RedemptionRecord, PendingApprovalRecord, PlayTimerRecord } from './data/tasksData';
import { usePrizeStoreSync } from './hooks/usePrizeStoreSync';
import { loadFamilyConfigFromCloud } from './cloudStorage';
import { defaultScreenTimeReward } from './data/tasksData';
import { FamilySetup } from './components/FamilySetup';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  ClipboardList, 
  ShieldCheck, 
  RotateCcw, 
  Database, 
  Code, 
  BookOpen, 
  Sliders, 
  CheckCircle, 
  Circle, 
  X, 
  RefreshCw, 
  FileText, 
  HelpCircle,
  AlertTriangle,
  Camera,
  Trash2,
  Sparkles,
  CheckCheck,
  Clock,
  Plus,
  Minus,
  Gift,
  Star,
  Edit3,
  Save,
  Smile
} from 'lucide-react';

interface AppProps {
  familyData?: import('./useAuth').FamilyData;
  userId?: string;
  onSignOut?: () => void;
}

// mm:ss countdown display for the play-first timer badge - separate from
// formatCooldownRemaining (tasksData.ts), which is day/hour granularity for
// prize cooldowns, not the second-by-second precision this needs.
function formatPlayTimerRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ================= FAMILY CONFIG GATE (family-code sync path) =================
// Routing, in order:
//  1. familyData prop (Firebase Auth path, AppWrapper) -> straight to AppMain.
//  2. Session-only demo flag (set from the landing page) -> AppMain with the
//     compiled-in defaults, for visitors who just want to look.
//  3. Sync on + a family code on this device -> load the family's roster from
//     the cloud at families/{code}/config/current BEFORE the app mounts and
//     hand it over through the same `familyData` prop, so the roster-override
//     logic inside AppMain is shared by both paths. No config there -> AppMain
//     with the compiled-in defaults, exactly as before this gate existed.
//  4. Anything else (a brand-new device) -> the Stage 2 landing + setup flow
//     (components/FamilySetup): create a family or join one with its code.
//     FamilySetup finishes by setting localStorage + reloading, which lands
//     the device in path 3. Enrolled family devices never reach path 4.
interface GateState {
  status: 'loading' | 'ready' | 'setup';
  familyData?: import('./useAuth').FamilyData;
}

export default function App(props: AppProps = {}) {
  const [gate, setGate] = useState<GateState>(() => {
    if (props.familyData) return { status: 'ready', familyData: props.familyData };
    if (sessionStorage.getItem('kids_demo_mode') === '1') return { status: 'ready' };
    const syncOn = localStorage.getItem('hallel_sync_enabled') === 'true';
    const code = localStorage.getItem('hallel_family_code');
    return syncOn && code ? { status: 'loading' } : { status: 'setup' };
  });

  useEffect(() => {
    if (gate.status !== 'loading') return;
    const code = localStorage.getItem('hallel_family_code');
    if (!code) { setGate({ status: 'ready' }); return; }
    let cancelled = false;
    loadFamilyConfigFromCloud(code)
      .then((res) => {
        if (cancelled) return;
        const cfg = res?.config;
        if (cfg && Array.isArray(cfg.children) && cfg.children.length > 0) {
          const screenTimeRewards: Record<string, { base: number; bonusPerOptional: number; pointsPerMandatory: number; pointsPerOptional: number }> = {};
          cfg.children.forEach((c) => {
            const effAge = c.birthdate ? getAgeFromBirthdate(c.birthdate) : c.age;
            screenTimeRewards[c.id] = { ...defaultScreenTimeReward(effAge), ...(cfg.screenTimeRewards?.[c.id] || {}) };
          });
          setGate({
            status: 'ready',
            familyData: {
              familyName: cfg.familyName || '',
              parentPin: cfg.parentPin || '',
              children: cfg.children.map((c) => ({
                id: c.id,
                name: c.name,
                age: c.birthdate ? getAgeFromBirthdate(c.birthdate) : c.age,
                birthdate: c.birthdate,
                gender: c.gender === 'male' ? 'male' : 'female',
                color: c.color,
                avatarEmoji: c.avatarEmoji,
                photo: c.photo,
              })),
              screenTimeRewards,
              createdAt: 0,
            },
          });
        } else {
          setGate({ status: 'ready' });
        }
      })
      .catch(() => { if (!cancelled) setGate({ status: 'ready' }); });
    return () => { cancelled = true; };
  }, [gate.status]);

  if (gate.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <span className="text-5xl block animate-bounce">📋</span>
          <p className="text-[#8C8479] font-bold">טוען...</p>
        </div>
      </div>
    );
  }

  if (gate.status === 'setup') {
    return <FamilySetup />;
  }

  return <AppMain {...props} familyData={gate.familyData ?? props.familyData} />;
}

function AppMain({ familyData, userId, onSignOut }: AppProps = {}) {
  // If familyData is provided (from Firebase), override CHILDREN and settings
  // We reassign the module-level CHILDREN so all references work
  if (familyData) {
    CHILDREN.length = 0;
    familyData.children.forEach(c => {
      CHILDREN.push({ ...c, initial: c.name[0] || '?' } as Child);
    });
    Object.keys(SCREEN_TIME_REWARD).forEach(k => delete SCREEN_TIME_REWARD[k]);
    Object.assign(SCREEN_TIME_REWARD, familyData.screenTimeRewards);
  }

  const [savedPin, setSavedPin] = useState<string>(() => localStorage.getItem('hallel_parent_pin') || familyData?.parentPin || '1234');
  const appPin = savedPin;

  // --- FAMILY CODE (cross-device sync via Firestore) ---
  const [familyCodeInput, setFamilyCodeInput] = useState<string>('');

  const [viewMode, setViewMode] = useState<ViewMode>('child');
  const [activeChildId, setActiveChildId] = useState<string>(CHILDREN[0]?.id || 'child1');
  const [parentPin, setParentPin] = useState<string>('');
  const [parentPinError, setParentPinError] = useState<boolean>(false);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string>('');
  
  // Custom router state simulated
  const [isMashovScraping, setIsMashovScraping] = useState<boolean>(false);
  const [mashovHasHomeworkText, setMashovHomeworkText] = useState<Record<string, string>>({
    noa: 'תרגילים 1-5 במתמטיקה עמ׳ 44',
    michal: 'קריאת פרק ה׳ בתנ״ך והעתקת שאלות',
    uri: 'אין שיעורי בית מיוחדים להיום 🌟',
  });

  // --- CAMERA OVERLAY & LIGHTBOX STATE ---
  const [captureTaskTarget, setCaptureTaskTarget] = useState<{ childId: string; taskId: string } | null>(null);
  const [breakfastTarget, setBreakfastTarget] = useState<string | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  // Time of day override (null = auto by clock)
  const [overrideTimeOfDay, setOverrideTimeOfDay] = useState<TimeOfDay | null>(null);

  // Daily shared duty assignments (seeded by date, stored in localStorage)
  const [dailyDutyAssignments, setDailyDutyAssignments] = useState<Record<string, string>>(() => getDailyDutyAssignments());

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // --- SMILEY REWARD & GIFT SYSTEM ---
  const [smileyCount, setSmileyCount] = useLocalStorage<Record<string, number>>('hallel_smileys', () => {
    const t: Record<string, number> = {};
    CHILDREN.forEach(c => { t[c.id] = 0; });
    return t;
  });
  const [giftsRedeemed, setGiftsRedeemed] = useLocalStorage<Record<string, number>>('hallel_gifts', () => {
    const t: Record<string, number> = {};
    CHILDREN.forEach(c => { t[c.id] = 0; });
    return t;
  });
  const [celebrationChild, setCelebrationChild] = useState<string | null>(null);
  const [celebrationShown, setCelebrationShown] = useLocalStorage<Record<string, string>>('hallel_celebration_shown', {});

  // --- POINTS & PRIZE STORE SYSTEM ---
  const [childPoints, setChildPoints] = useLocalStorage<Record<string, number>>('hallel_points', () => {
    const t: Record<string, number> = {};
    CHILDREN.forEach(c => { t[c.id] = 0; });
    return t;
  });
  const [redeemedPrizes, setRedeemedPrizes] = useLocalStorage<Record<string, RedemptionRecord[]>>('hallel_redeemed_prizes', () => {
    const t: Record<string, RedemptionRecord[]> = {};
    CHILDREN.forEach(c => { t[c.id] = []; });
    return t;
  });
  const [pendingApprovals, setPendingApprovals] = useLocalStorage<Record<string, PendingApprovalRecord[]>>('hallel_pending_approvals', () => {
    const t: Record<string, PendingApprovalRecord[]> = {};
    CHILDREN.forEach(c => { t[c.id] = []; });
    return t;
  });
  const [showPrizeStore, setShowPrizeStore] = useState<boolean>(false);
  // Transient UI state for the redemption animation - not persisted, purely visual.
  const [redemptionSuccessInfo, setRedemptionSuccessInfo] = useState<{ prize: PrizeItem; awaitingApproval: boolean } | null>(null);
  const [pointsTickDisplay, setPointsTickDisplay] = useState<number | null>(null);

  // "Play first, screen later" - a 30-minute per-child timer that starts the
  // moment a child finishes all mandatory tasks for a time period; screen-
  // time prizes stay locked in the store until it ends. Local-only (not
  // cloud-synced) since redemption happens on the same device the tasks
  // were completed on.
  const PLAY_TIMER_MINUTES = 30;
  const [playTimers, setPlayTimers] = useLocalStorage<Record<string, PlayTimerRecord>>('hallel_play_timers', {});
  const [playTimerPopupChild, setPlayTimerPopupChild] = useState<string | null>(null);
  const [tickNow, setTickNow] = useState<number>(Date.now());

  // --- STREAK SYSTEM ---
  const [streaks, setStreaks] = useLocalStorage<Record<string, { count: number; lastDate: string }>>('hallel_streaks', () => {
    const t: Record<string, { count: number; lastDate: string }> = {};
    CHILDREN.forEach(c => { t[c.id] = { count: 0, lastDate: '' }; });
    return t;
  });

  // --- WEEKLY STATS ---
  const [weeklyStats, setWeeklyStats] = useLocalStorage<Record<string, { completedDays: number; totalTasks: number; completedTasks: number }>>('hallel_weekly_stats', () => {
    const t: Record<string, { completedDays: number; totalTasks: number; completedTasks: number }> = {};
    CHILDREN.forEach(c => { t[c.id] = { completedDays: 0, totalTasks: 0, completedTasks: 0 }; });
    return t;
  });

  // --- MASHOV CREDENTIALS (stored locally only, never in code) ---
  const [mashovUsername, setMashovUsername] = useState<string>(() => localStorage.getItem('hallel_mashov_user') || '');
  const [mashovPassword, setMashovPassword] = useState<string>(() => localStorage.getItem('hallel_mashov_pass') || '');
  const [mashovSchoolCode, setMashovSchoolCode] = useState<string>(() => localStorage.getItem('hallel_mashov_school') || '');

  // --- PARENT TASK EDITOR ---
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskEmoji, setNewTaskEmoji] = useState<string>('📋');
  const [newTaskTime, setNewTaskTime] = useState<TimeOfDay>('afternoon');
  const [newTaskMandatory, setNewTaskMandatory] = useState<boolean>(true);
  // Day-of-week selector for editing (0=Sun..5=Fri, 6=Sat)
  type EditDay = 'today' | '0' | '1' | '2' | '3' | '4' | '5';
  const [editDayOfWeek, setEditDayOfWeek] = useState<EditDay>('today');

  // Custom tasks per day-of-week (persisted) - key: `${childId}_${dayNum}` or `${childId}_regular`
  const [customDayTasks, setCustomDayTasks] = useLocalStorage<Record<string, Task[]>>('hallel_custom_day_tasks', {});

  // Get tasks for a specific day-of-week for a child (template + custom).
  // Delegates to the canonical buildTasksForDayType() (tasksData.ts) so
  // this preview can never drift from what buildFreshTasksForToday()
  // actually builds into live state.
  const getTasksForDayOfWeek = (childId: string, day: EditDay): Task[] => {
    if (day === 'today') return tasks[childId] || [];
    const dayNum = parseInt(day);
    const assignments = previewDutyAssignments(dayNum === 5);
    return buildTasksForDayType(childId, dayNum, assignments, customDayTasks);
  };

  // Add task to a specific day template
  const addTaskToDay = (childId: string, day: EditDay) => {
    if (!newTaskTitle.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newTask: Task = {
      id: newId,
      time: newTaskTime,
      title: newTaskTitle.trim(),
      emoji: newTaskEmoji,
      completed: false,
      mandatory: newTaskMandatory,
    };
    if (day === 'today') {
      // Add to today's live tasks
      setTasks(prev => ({
        ...prev,
        [childId]: [...(prev[childId] || []), newTask]
      }));
    } else {
      const dayNum = parseInt(day);
      const customKey = `${childId}_${dayNum === 5 ? 'friday' : 'regular'}`;
      setCustomDayTasks(prev => ({
        ...prev,
        [customKey]: [...(prev[customKey] || []), newTask]
      }));
      // If editing the same day type as today, also add to live
      const todayDay = new Date().getDay();
      const editingFriday = dayNum === 5;
      const todayIsFriday = todayDay === 5;
      if ((editingFriday && todayIsFriday) || (!editingFriday && !todayIsFriday)) {
        setTasks(prev => ({
          ...prev,
          [childId]: [...(prev[childId] || []), newTask]
        }));
      }
    }
    setNewTaskTitle('');
    setNewTaskEmoji('📋');
  };

  // Remove task from day template
  const removeTaskFromDay = (childId: string, taskId: string, day: EditDay) => {
    if (day === 'today') {
      setTasks(prev => ({
        ...prev,
        [childId]: (prev[childId] || []).filter(t => t.id !== taskId)
      }));
    } else {
      const dayNum = parseInt(day);
      const customKey = `${childId}_${dayNum === 5 ? 'friday' : 'regular'}`;
      setCustomDayTasks(prev => ({
        ...prev,
        [customKey]: (prev[customKey] || []).filter(t => t.id !== taskId)
      }));
    }
  };

  // --- DASHBOARD PANEL COLLAPSE STATE ---
  const [collapsedPanels, setCollapsedPanels] = useLocalStorage<Record<string, boolean>>('hallel_collapsed_panels', {});
  const togglePanel = (id: string) => setCollapsedPanels(prev => ({ ...prev, [id]: !prev[id] }));

  // --- DASHBOARD PANEL DRAG & DROP ORDER ---
  const DEFAULT_PANEL_ORDER = ['tracker', 'photos', 'smileys', 'prizeRedemptions', 'prizeApprovals', 'prizeStats', 'editor', 'mashov', 'technical', 'findDevice'];
  const [panelOrder, setPanelOrder] = useLocalStorage<string[]>('hallel_panel_order', () => {
    const saved = localStorage.getItem('hallel_panel_order');
    if (saved) {
      const parsed = safeParseJSON<string[]>(saved, []);
      // Merge with defaults in case new panels were added
      const merged = [...parsed];
      DEFAULT_PANEL_ORDER.forEach(p => { if (!merged.includes(p)) merged.push(p); });
      return merged;
    }
    return DEFAULT_PANEL_ORDER;
  });

  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<string | null>(null);

  const handlePanelDragStart = (panelId: string) => {
    setDraggedPanel(panelId);
  };
  const handlePanelDragOver = (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    if (draggedPanel && draggedPanel !== panelId) {
      setDragOverPanel(panelId);
    }
  };
  const handlePanelDrop = (panelId: string) => {
    if (draggedPanel && draggedPanel !== panelId) {
      setPanelOrder(prev => {
        const newOrder = [...prev];
        const fromIdx = newOrder.indexOf(draggedPanel);
        const toIdx = newOrder.indexOf(panelId);
        if (fromIdx !== -1 && toIdx !== -1) {
          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, draggedPanel);
        }
        return newOrder;
      });
    }
    setDraggedPanel(null);
    setDragOverPanel(null);
  };
  const handlePanelDragEnd = () => {
    setDraggedPanel(null);
    setDragOverPanel(null);
  };

  // --- PARENT DASHBOARD TABS ---
  type ParentTab = 'dashboard' | 'history';
  const [parentTab, setParentTab] = useState<ParentTab>('dashboard');

  // --- TASK HISTORY (daily completion records) ---
  interface DayRecord {
    date: string; // YYYY-MM-DD
    children: Record<string, { completed: number; total: number; points: number }>;
  }
  const [taskHistory, setTaskHistory] = useLocalStorage<DayRecord[]>('hallel_task_history', []);

  // Track recently completed tasks (show for 5 seconds before hiding)
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());

  // Build a brand-new task list for today's calendar date: the generated
  // template (personal + shared-duty, or Friday) plus any day-template
  // custom tasks a parent added for "regular"/"friday". This is the ONLY
  // path that should ever be used to (re)create tasks - it must run once
  // when there is no saved state for today's date, and again if the
  // calendar date rolls over while the app stays open. Routes through the
  // same buildTasksForDayType() the day-of-week editor preview uses, so
  // the two can never disagree about what a given day's tasks are.
  const buildFreshTasksForToday = (): Record<string, Task[]> => {
    const todayDayOfWeek = new Date().getDay();
    const dutyAssignments = getDailyDutyAssignments();
    const base: Record<string, Task[]> = {};
    CHILDREN.forEach(c => {
      base[c.id] = buildTasksForDayType(c.id, todayDayOfWeek, dutyAssignments, customDayTasks);
    });
    return base;
  };

  const [tasks, setTasks] = useState<Record<string, Task[]>>(() => {
    const today = getLocalDateKey();
    // Restore today's full task state (completion, photos, mandatory
    // overrides, custom tasks - everything) if we already have it; only
    // regenerate when there is nothing saved for today's calendar date.
    const saved = safeParseJSON<{ date: string; tasks: Record<string, Task[]> } | null>(
      localStorage.getItem('hallel_tasks_progress'), null
    );
    if (saved && saved.date === today && saved.tasks) {
      // Reconcile against the current CHILDREN roster: every child that
      // already has saved tasks keeps them completely untouched: only a
      // child MISSING from the snapshot (e.g. added to CHILDREN after the
      // snapshot was saved) gets a freshly generated list. This is what
      // prevents a stale/incomplete snapshot from ever crashing a
      // roster-wide action like "mark all complete" for that child.
      const fresh = buildFreshTasksForToday();
      const reconciled: Record<string, Task[]> = { ...saved.tasks };
      CHILDREN.forEach(c => {
        if (!reconciled[c.id]) {
          reconciled[c.id] = fresh[c.id];
        }
      });
      return reconciled;
    }
    return buildFreshTasksForToday();
  });

  const { familyCode, setFamilyCode, syncEnabled, setSyncEnabled, syncStatus } = useCloudSync(tasks, setTasks);

  // Smileys/gifts/celebration-shown-today didn't cross devices before this -
  // a smiley earned on the kids' tablet never showed up on a parent's phone,
  // and a device that didn't see today's celebration yet could show the
  // "כל הכבוד" popup again for something another device already celebrated.
  useRewardsSync(familyCode, syncEnabled, smileyCount, setSmileyCount, giftsRedeemed, setGiftsRedeemed, celebrationShown, setCelebrationShown);

  // Points/redemption-history/pending-approvals cross-device sync - critical
  // for the premium-reward approval flow, where a child's request on one
  // device must reach a parent's approval screen on another.
  usePrizeStoreSync(familyCode, syncEnabled, childPoints, setChildPoints, redeemedPrizes, setRedeemedPrizes, pendingApprovals, setPendingApprovals);

  // Subscribes in real time regardless of parent/child view - the device
  // must ring the moment a family member remotely triggers it, no matter
  // which screen is currently showing.
  const {
    isRinging: isFindDeviceRinging,
    isFlashOn: isFindDeviceFlashOn,
    ringTablet,
    stopRinging,
    retryPlayback: retryFindDevicePlayback,
    volume: findDeviceVolume,
    setVolume: setFindDeviceVolume,
    sendError: findDeviceSendError,
  } = useFindDevice(familyCode, syncEnabled);

  // Parent voice messages relayed into the family (recorded outside the
  // app, e.g. as a WhatsApp voice note) - each device plays a new message
  // once and shows a banner until it is heard; see hooks/useParentVoice.
  const parentVoice = useParentVoice(familyCode, syncEnabled);

  const [currentDate, setCurrentDate] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Drives the play-timer countdown display (1s resolution, unlike the 60s
  // clock tick above) - only runs while at least one child actually has an
  // active timer, and self-clears the moment the last one expires so it
  // doesn't tick forever in the background once nobody needs it.
  useEffect(() => {
    const hasActiveTimer = () => CHILDREN.some(c => isPlayTimerActive(c.id, playTimers));
    if (!hasActiveTimer()) return;
    const tickInterval = setInterval(() => {
      setTickNow(Date.now());
      if (!hasActiveTimer()) clearInterval(tickInterval);
    }, 1000);
    return () => clearInterval(tickInterval);
  }, [playTimers]);

  // Regenerate tasks ONLY when the calendar date actually advances (e.g. a
  // tablet left open past midnight) - never on a time-of-day (morning/
  // afternoon/evening) change, which is just a display filter and doesn't
  // touch this state at all. `currentDate` ticks every 60s via the effect
  // above, so this check runs on the same cadence without polling itself.
  const todayKeyRef = useRef<string>(getLocalDateKey());
  useEffect(() => {
    const nowKey = getLocalDateKey();
    if (nowKey !== todayKeyRef.current) {
      todayKeyRef.current = nowKey;
      setDailyDutyAssignments(getDailyDutyAssignments());
      setTasks(buildFreshTasksForToday());
    }
  }, [currentDate]);

  // Save history on end of day (update today's record)
  const updateTodayHistory = useCallback(() => {
    const today = getLocalDateKey();
    setTaskHistory(prev => {
      const existing = prev.find(r => r.date === today);
      const childrenRecord: Record<string, { completed: number; total: number; points: number }> = {};
      CHILDREN.forEach(c => {
        const childTasks = tasks[c.id] || [];
        const completed = childTasks.filter((t: any) => t.completed).length;
        childrenRecord[c.id] = { completed, total: childTasks.length, points: childPoints[c.id] || 0 };
      });
      if (existing) {
        return prev.map(r => r.date === today ? { ...r, children: childrenRecord } : r);
      }
      return [...prev, { date: today, children: childrenRecord }];
    });
  }, [tasks, childPoints]);

  // Update history every minute
  useEffect(() => {
    updateTodayHistory();
    const interval = setInterval(updateTodayHistory, 60000);
    return () => clearInterval(interval);
  }, [updateTodayHistory]);

  // Save today's full task state (survives pull-to-refresh / page reload).
  // Storing the whole Task objects - not just id/completed - is what lets
  // this restore completed, photo, photoTime, mandatory overrides and
  // custom tasks verbatim instead of merging onto a freshly-generated
  // template.
  useEffect(() => {
    localStorage.setItem('hallel_tasks_progress', JSON.stringify({ date: getLocalDateKey(), tasks }));
  }, [tasks]);

  const activeChild = CHILDREN.find((c) => c.id === activeChildId)!;
  const currentTasks = tasks[activeChildId] || [];

  // Text-to-speech for young children (Daniel age 5, Uri age 7)
  // Primary: /api/tts proxy → Google Translate TTS (works on all devices, no Hebrew voice needed)
  // Fallback: browser speechSynthesis
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Pre-load speech voices (Android Chrome loads them async)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speakTask = (text: string) => {
    // Primary: API proxy to Google Translate TTS - works on any device/language
    const encoded = encodeURIComponent(text);
    const apiAudio = new Audio(`/api/tts?text=${encoded}`);
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); }
    ttsAudioRef.current = apiAudio;
    apiAudio.play().then(() => {
      // API worked - nothing more to do
    }).catch(() => {
      // Fallback: browser speechSynthesis (may need Hebrew TTS installed on device)
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
      const heVoice = voices.find(v => v.lang.startsWith('he'));
      if (heVoice) utterance.voice = heVoice;
      utterance.lang = 'he-IL';
      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleTaskClick = (childId: string, taskId: string) => {
    // For young children (up to age 8) - read task aloud on click
    const clickedChild = CHILDREN.find(c => c.id === childId);
    if (clickedChild && getChildAge(clickedChild) <= 8) {
      const task = (tasks[childId] || []).find(t => t.id === taskId);
      if (task) speakTask(task.title);
    }
    toggleTask(childId, taskId);
  };

  // Shared side effects the moment a task actually becomes completed:
  // 5s "recently completed" highlight, points, the play-first timer trigger,
  // and the evening celebration. Called from BOTH toggleTask (direct
  // checkbox) and saveCapturedTaskPhotoProof (photo-proof confirmation) -
  // this used to live only inside toggleTask, which meant a photo-gated
  // task (toggleTask short-circuits to open the camera instead of
  // completing it directly) silently skipped points/celebration/timer
  // entirely when confirmed via the camera flow instead of a plain click.
  // `updatedList` is this child's task list with `task` already marked
  // completed - callers compute it synchronously since they already know
  // exactly what's about to change, rather than reaching into a setTasks
  // updater (which React can in principle invoke more than once).
  const runTaskCompletionEffects = (childId: string, task: Task, updatedList: Task[]) => {
    const key = `${childId}-${task.id}`;
    setRecentlyCompleted(prev => new Set(prev).add(key));
    setTimeout(() => {
      setRecentlyCompleted(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 5000);

    awardPointsForTask(childId, task);

    // "Play first, screen later": does this complete ALL mandatory tasks
    // for this task's time period? Keyed per date+period so re-completing
    // tasks in an already-finished period never restarts it, and each
    // period (morning/afternoon/evening) gets its own independent timer.
    const periodMandatory = updatedList.filter((t) => t.time === task.time && t.mandatory);
    const periodNowDone = periodMandatory.length > 0 && periodMandatory.every((t) => t.completed);
    if (periodNowDone) {
      const triggerKey = `${getLocalDateKey()}_${task.time}`;
      const existingTimer = playTimers[childId];
      if (!existingTimer || existingTimer.key !== triggerKey) {
        setPlayTimers(prev => ({ ...prev, [childId]: { key: triggerKey, endsAt: Date.now() + PLAY_TIMER_MINUTES * 60000 } }));
        setPlayTimerPopupChild(childId);
      }
    }

    // Evening celebration: all evening-mandatory tasks done today?
    const eveningMandatory = updatedList.filter(t => t.time === 'evening' && t.mandatory);
    const allEveningDone = eveningMandatory.length > 0 && eveningMandatory.every(t => t.completed);
    const today = new Date().toDateString();
    if (allEveningDone && celebrationShown[childId] !== today) {
      setTimeout(() => {
        setSmileyCount(prev => ({ ...prev, [childId]: Math.min(MAX_SMILEYS, (prev[childId] || 0) + 1) }));
        setCelebrationChild(childId);
        setCelebrationShown(prev => ({ ...prev, [childId]: today }));

        const allMandatory = updatedList.filter(t => t.mandatory);
        const completedAll = allMandatory.filter(t => t.completed).length;
        const completionPercent = allMandatory.length > 0 ? completedAll / allMandatory.length : 0;
        updateStreak(childId, completionPercent);

        const childStreak = streaks[childId];
        if (childStreak && childStreak.count > 0 && childStreak.count % 7 === 0) {
          setChildPoints(prev => ({ ...prev, [childId]: (prev[childId] || 0) + STREAK_WEEKLY_BONUS }));
        }
      }, 300);
    }
  };

  const toggleTask = (childId: string, taskId: string, bypassBreakfast = false) => {
    const list = tasks[childId] || [];
    const task = list.find((t) => t.id === taskId);

    if (task) {
      // Breakfast task cannot be ticked directly: it opens the picker, which
      // completes it only after veg + fruit + bread + spread are chosen.
      if (task.id === 'breakfast_choice' && !task.completed && !bypassBreakfast) {
        setBreakfastTarget(childId);
        return;
      }
      if (task.requiresPhoto && !task.completed && !task.photo) {
        setCaptureTaskTarget({ childId, taskId });
        return;
      }

      if (!task.completed) {
        const updatedList = list.map((t) => (t.id === taskId ? { ...t, completed: true } : t));
        runTaskCompletionEffects(childId, task, updatedList);
      }

      setTasks((prev) => ({
        ...prev,
        [childId]: prev[childId].map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: !t.completed,
                photo: !t.completed ? t.photo : undefined,
                photoTime: !t.completed ? t.photoTime : undefined
              }
            : t
        ),
      }));
    }
  };

  const overrideAllCompleted = (childId: string, value: boolean) => {
    setTasks((prev) => ({
      ...prev,
      [childId]: prev[childId].map((t) => ({ ...t, completed: value })),
    }));
  };

  const simulateMashovScrape = () => {
    setIsMashovScraping(true);
    setTimeout(() => {
      setIsMashovScraping(false);
      // Ensure homework task gets highlighted or checked
      setTasks((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach(childKey => {
          const childObj = CHILDREN.find(c => c.id === childKey);
          updated[childKey] = updated[childKey].map(task => {
            if (task.id === 'a3' && (!childObj || getChildAge(childObj) >= 7)) {
              return { 
                ...task, 
                completed: false, 
                mandatory: true,
                title: `שיעורי בית (עודכן ממשוב): ${mashovHasHomeworkText[childKey] || 'מטלות כתיבה'}` 
              };
            }
            return task;
          });
        });
        return updated;
      });
    }, 1500);
  };

  // --- PARENT TASK MANAGEMENT ---
  const addTask = (childId: string) => {
    if (!newTaskTitle.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newTask: Task = {
      id: newId,
      time: newTaskTime,
      title: newTaskTitle.trim(),
      emoji: newTaskEmoji,
      completed: false,
      mandatory: newTaskMandatory,
    };
    setTasks(prev => ({
      ...prev,
      [childId]: [...(prev[childId] || []), newTask]
    }));
    setNewTaskTitle('');
    setNewTaskEmoji('📋');
  };

  const removeTask = (childId: string, taskId: string) => {
    setTasks(prev => ({
      ...prev,
      [childId]: (prev[childId] || []).filter(t => t.id !== taskId)
    }));
  };

  const toggleTaskMandatory = (childId: string, taskId: string) => {
    setTasks(prev => ({
      ...prev,
      [childId]: prev[childId].map(t => t.id === taskId ? { ...t, mandatory: !t.mandatory } : t)
    }));
  };

  // --- GIFT REDEMPTION ---
  const redeemGift = (childId: string) => {
    if ((smileyCount[childId] || 0) >= MAX_SMILEYS) {
      setSmileyCount(prev => ({ ...prev, [childId]: prev[childId] - MAX_SMILEYS }));
      setGiftsRedeemed(prev => ({ ...prev, [childId]: (prev[childId] || 0) + 1 }));
    }
  };

  // --- PRIZE STORE REDEMPTION ---
  // Non-premium items only - premium (requiresApproval) items go through
  // requestPrizeApproval() instead, see below.
  const redeemPrize = (childId: string, prize: PrizeItem) => {
    if (prize.requiresApproval) return;
    if (isPrizeOnCooldown(prize, childId, redeemedPrizes)) return;
    if ((childPoints[childId] || 0) >= prize.cost) {
      setChildPoints(prev => ({ ...prev, [childId]: (prev[childId] || 0) - prize.cost }));
      const now = Date.now();
      setRedeemedPrizes(prev => ({
        ...prev,
        [childId]: [...(prev[childId] || []), {
          id: `redeem_${now}_${Math.random().toString(36).slice(2, 8)}`,
          prizeId: prize.id,
          date: new Date(now).toISOString(),
          ...(prize.cooldownHours ? { cooldownUntil: now + prize.cooldownHours * 3600_000 } : {}),
        }]
      }));
    }
  };

  // Cancel a purchase from the prize store (parent-only, see the "ביטול
  // רכישות" panel) - refunds the points it cost, removes the record, and
  // (since the cooldown lives on the record itself) automatically lifts
  // whatever cooldown it had started. Older redemptions saved before the
  // `id` field existed have no id to match on, so fall back to matching by
  // array position instead (an `id` match must never fall back to position -
  // two undefined ids would otherwise both "match" the first record found).
  const cancelPrizeRedemption = (childId: string, redemptionId: string | undefined, fallbackIndex: number) => {
    const list = redeemedPrizes[childId] || [];
    const record = redemptionId ? list.find((r) => r.id === redemptionId) : list[fallbackIndex];
    if (!record) return;
    const prize = PRIZE_STORE.find((p) => p.id === record.prizeId);
    setRedeemedPrizes(prev => ({
      ...prev,
      [childId]: (prev[childId] || []).filter((r) => r !== record),
    }));
    if (prize) {
      setChildPoints(prev => ({ ...prev, [childId]: (prev[childId] || 0) + prize.cost }));
    }
  };

  // --- PREMIUM PRIZE APPROVAL FLOW ---
  // Child-initiated: creates a pending request, does NOT touch points yet.
  // Only one outstanding request per prize per child at a time.
  const requestPrizeApproval = (childId: string, prize: PrizeItem) => {
    if (!prize.requiresApproval) return;
    const alreadyPending = (pendingApprovals[childId] || []).some((p) => p.prizeId === prize.id);
    if (alreadyPending) return;
    setPendingApprovals(prev => ({
      ...prev,
      [childId]: [...(prev[childId] || []), {
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        prizeId: prize.id,
        requestedAt: new Date().toISOString(),
      }]
    }));
  };

  // Parent-initiated (see the "אישור פרסים" panel): only now do points get
  // deducted and the cooldown (if any) start.
  const approvePendingRedemption = (childId: string, approvalId: string) => {
    const record = (pendingApprovals[childId] || []).find((p) => p.id === approvalId);
    if (!record) return;
    const prize = PRIZE_STORE.find((p) => p.id === record.prizeId);
    if (!prize || (childPoints[childId] || 0) < prize.cost) return;
    const now = Date.now();
    setChildPoints(prev => ({ ...prev, [childId]: (prev[childId] || 0) - prize.cost }));
    setRedeemedPrizes(prev => ({
      ...prev,
      [childId]: [...(prev[childId] || []), {
        id: `redeem_${now}_${Math.random().toString(36).slice(2, 8)}`,
        prizeId: prize.id,
        date: new Date(now).toISOString(),
        ...(prize.cooldownHours ? { cooldownUntil: now + prize.cooldownHours * 3600_000 } : {}),
      }]
    }));
    setPendingApprovals(prev => ({ ...prev, [childId]: (prev[childId] || []).filter((p) => p.id !== approvalId) }));
  };

  // Parent-initiated: discard the request, no point change.
  const rejectPendingRedemption = (childId: string, approvalId: string) => {
    setPendingApprovals(prev => ({ ...prev, [childId]: (prev[childId] || []).filter((p) => p.id !== approvalId) }));
  };

  // Child-facing store click handler: routes to the premium (pending-approval)
  // or normal redeem path, and drives the redemption animation (points
  // counting down + success popup). The clicked card's own fade-out is
  // handled separately by AnimatePresence once it naturally drops out of
  // getAvailablePrizes()/gains a pending entry - no manual "is this card
  // currently animating out" state needed here.
  const handleRedeemClick = (prize: PrizeItem) => {
    if (prize.isScreenTime && isPlayTimerActive(activeChildId, playTimers)) return;
    if (prize.requiresApproval) {
      const alreadyPending = (pendingApprovals[activeChildId] || []).some((p) => p.prizeId === prize.id);
      if (alreadyPending) return;
      requestPrizeApproval(activeChildId, prize);
      setRedemptionSuccessInfo({ prize, awaitingApproval: true });
      setTimeout(() => setRedemptionSuccessInfo(null), 2500);
      return;
    }
    if (isPrizeOnCooldown(prize, activeChildId, redeemedPrizes)) return;
    const before = childPoints[activeChildId] || 0;
    if (before < prize.cost) return;
    redeemPrize(activeChildId, prize);

    // Points-counting-down animation: step a locally-displayed value from
    // the old balance to the new one over ~400ms.
    const after = before - prize.cost;
    let step = 0;
    const totalSteps = 10;
    const tick = setInterval(() => {
      step++;
      setPointsTickDisplay(Math.round(before - (before - after) * (step / totalSteps)));
      if (step >= totalSteps) {
        clearInterval(tick);
        setPointsTickDisplay(null);
      }
    }, 40);

    setRedemptionSuccessInfo({ prize, awaitingApproval: false });
    setTimeout(() => setRedemptionSuccessInfo(null), 2200);
  };

  // --- STREAK UPDATE (called at end of day or when all tasks done) ---
  const updateStreak = (childId: string, completionPercent: number) => {
    const today = new Date().toDateString();
    setStreaks(prev => {
      const current = prev[childId] || { count: 0, lastDate: '' };
      if (current.lastDate === today) return prev; // Already updated today
      
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (completionPercent >= 0.8) {
        // Good day! Continue or start streak
        const newCount = current.lastDate === yesterday ? current.count + 1 : 1;
        return { ...prev, [childId]: { count: newCount, lastDate: today } };
      } else {
        // Streak broken
        return { ...prev, [childId]: { count: 0, lastDate: today } };
      }
    });
  };

  // --- AWARD DAILY POINTS (called when task completed) ---
  // Weekly missions (e.g. the Monday cooking task) carry a fixed task.points
  // value that overrides the child's flat mandatory/optional rate.
  const awardPointsForTask = (childId: string, task: Task) => {
    const reward = SCREEN_TIME_REWARD[childId] || { pointsPerMandatory: 3, pointsPerOptional: 2 };
    const points = task.points != null ? task.points : (task.mandatory ? reward.pointsPerMandatory : reward.pointsPerOptional);

    // Add streak bonus
    const streak = streaks[childId];
    const streakBonus = streak && streak.count > 0 ? STREAK_BONUS_PER_DAY : 0;

    setChildPoints(prev => ({ ...prev, [childId]: (prev[childId] || 0) + points + streakBonus }));
  };

  // --- CHECK WEEKLY EXCELLENCE ---
  const getWeeklyExcellenceStatus = (childId: string) => {
    const stats = weeklyStats[childId] || { completedDays: 0, totalTasks: 0, completedTasks: 0 };
    const ratio = stats.totalTasks > 0 ? stats.completedTasks / stats.totalTasks : 0;
    return {
      ...stats,
      ratio,
      isExcellent: ratio >= WEEKLY_EXCELLENCE_THRESHOLD,
      bonusEarned: ratio >= WEEKLY_EXCELLENCE_THRESHOLD ? WEEKLY_EXCELLENCE_BONUS : 0,
    };
  };

  // --- MASHOV SAVE ---
  const saveMashovCredentials = () => {
    localStorage.setItem('hallel_mashov_user', mashovUsername);
    localStorage.setItem('hallel_mashov_pass', mashovPassword);
    localStorage.setItem('hallel_mashov_school', mashovSchoolCode);
  };

  // --- CAMERA UTILITY STATES & METHODS ---
  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraPhotoFile, setCameraPhotoFile] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCameraStream = async (facing: 'user' | 'environment' = cameraFacing) => {
    try {
      setCameraPhotoFile(null);
      // Stop any running stream first (needed when switching cameras).
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      // Requested camera first: front ('user') is selfie-style, for the child
      // photographing themselves doing the task; back ('environment') is for
      // photographing the room/bed. Fall back to the other camera, then to
      // any camera available.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing === 'user' ? 'environment' : 'user' } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      streamRef.current = stream;
      setCameraFacing(facing);
      setCameraStreamActive(true);
      // Wait for next render so videoRef is mounted, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error('Error opening camera:', err);
      alert('גישה למצלמה נכשלה. ודאו שהרשאת המצלמה מופעלת בהגדרות הטאבלט.');
    }
  };

  const switchCamera = () => {
    startCameraStream(cameraFacing === 'user' ? 'environment' : 'user');
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraStreamActive(false);
  };

  const capturePhotoFromStream = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCameraPhotoFile(dataUrl);
        stopCameraStream();
      }
    }
  };

  const handlePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCameraPhotoFile(reader.result as string);
        stopCameraStream();
      };
      reader.readAsDataURL(file);
    }
  };

  const saveCapturedTaskPhotoProof = () => {
    if (captureTaskTarget && cameraPhotoFile) {
      const { childId, taskId } = captureTaskTarget;
      const localTimeStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const list = tasks[childId] || [];
      const task = list.find((t) => t.id === taskId);

      setTasks((prev) => ({
        ...prev,
        [childId]: prev[childId].map((t) =>
          t.id === taskId ? { ...t, photo: cameraPhotoFile, photoTime: localTimeStr, completed: true } : t
        ),
      }));

      // Same completion side effects as a direct checkbox toggle (points,
      // play-timer, evening celebration) - photo-gated tasks completing
      // via this camera flow must not skip them.
      if (task && !task.completed) {
        const updatedList = list.map((t) => (t.id === taskId ? { ...t, completed: true } : t));
        runTaskCompletionEffects(childId, task, updatedList);
      }

      // Auto clear and close modal
      setCameraPhotoFile(null);
      setCaptureTaskTarget(null);
    }
  };

  const getDayName = () => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return 'יום ' + days[new Date().getDay()];
  };

  // Progress calculations for active child
  const mandatoryTasks = currentTasks.filter((t) => t.mandatory);
  const completedMandatoryTasks = mandatoryTasks.filter((t) => t.completed);
  const totalMandatory = mandatoryTasks.length;
  const completedMandatory = completedMandatoryTasks.length;
  const remainingMandatory = totalMandatory - completedMandatory;
  const isWifiUnlockedForActive = remainingMandatory === 0;

  // Screen time reward for active child
  const screenTimeInfo = getEarnedScreenTime(activeChildId, currentTasks);

  const completedTotalCount = CHILDREN.reduce((sum, c) => sum + (tasks[c.id] || []).filter(t => t.completed).length, 0);
  const totalTaskCount = CHILDREN.reduce((sum, c) => sum + (tasks[c.id] || []).length, 0);

  const getTasksByTime = (childId: string, time: TimeOfDay) => {
    return (tasks[childId] || []).filter((t) => t.time === time);
  };

  // Auto-detect current time of day based on clock
  const getCurrentTimeOfDay = (): TimeOfDay => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 13) return 'morning';
    if (hour >= 13 && hour < 19) return 'afternoon';
    return 'evening';
  };

  const currentTimeOfDay = getCurrentTimeOfDay();
  const isFriday = new Date().getDay() === 5;
  const isSaturday = new Date().getDay() === 6;
  const timeOfDayLabels: Record<TimeOfDay, { label: string; emoji: string; subtitle: string }> = {
    morning: { label: 'משימות בוקר', emoji: '🌅', subtitle: 'השכמה וארגון' },
    afternoon: { label: isFriday ? 'הכנות לשבת' : 'אחר הצהריים', emoji: isFriday ? '🕯️' : '🌞', subtitle: isFriday ? 'ערב שבת שלום!' : 'לימודים ומשימות' },
    evening: { label: isSaturday ? 'מוצאי שבת' : isFriday ? 'ערב שבת' : 'ערב ושינה', emoji: isFriday ? '✨' : '🌙', subtitle: isSaturday ? 'סידור הבית והתארגנות לשבוע חדש' : isFriday ? 'התארגנות לשבת' : 'התארגנות לשינה' },
  };

  // Progress score per child for parent view
  const getChildProgress = (childId: string) => {
    const childTasks = tasks[childId] || [];
    const mand = childTasks.filter(t => t.mandatory);
    const completedMand = mand.filter(t => t.completed).length;
    const totalMand = mand.length;
    const isUnlocked = completedMand === totalMand;
    const percentage = totalMand > 0 ? Math.round((completedMand / totalMand) * 100) : 100;
    const screenTime = getEarnedScreenTime(childId, childTasks);
    
    return {
      completedMand,
      totalMand,
      isUnlocked,
      percentage,
      totalCompleted: childTasks.filter(t => t.completed).length,
      totalCount: childTasks.length,
      screenTime,
    };
  };

  const handleParentAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (parentPin === appPin) {
      setIsParentAuthenticated(true);
      setParentPinError(false);
      setViewMode('parent');
    } else {
      setParentPinError(true);
      setTimeout(() => setParentPinError(false), 2000);
    }
  };

  const handleLogoutParent = () => {
    setIsParentAuthenticated(false);
    setViewMode('child');
    setParentPin('');
  };

  // --- SHABBAT STATUS ---
  const shabbatStatus = isCurrentlyShabbat();
  const hebrewDate = getHebrewDate();

  // --- JOURNAL FILTER STATE ---
  type JournalFilter = 'day' | 'week' | 'month';
  const [journalFilter, setJournalFilter] = useState<JournalFilter>('week');
  const [journalChildFilter, setJournalChildFilter] = useState<string>('all');
  const [journalDate, setJournalDate] = useState<string>(getLocalDateKey());

  // If Shabbat - show Shabbat screen
  if (shabbatStatus.isShabbat) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-lg w-full text-center space-y-8">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="text-8xl"
          >
            🕯️
          </motion.div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-amber-200 font-serif">שבת שלום!</h1>
            <p className="text-xl text-amber-100/80">{hebrewDate}</p>
            <p className="text-lg text-white/60">{LOCATION.name}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-3xl border border-white/20 space-y-4">
            <div className="flex justify-between items-center text-amber-100">
              <span className="text-sm">🕯️ הדלקת נרות:</span>
              <span className="font-bold text-lg">{shabbatStatus.candleLighting}</span>
            </div>
            <div className="flex justify-between items-center text-amber-100">
              <span className="text-sm">✨ צאת שבת (הבדלה):</span>
              <span className="font-bold text-lg">{shabbatStatus.havdalah}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-white/50 text-sm">האפליקציה תחזור לפעילות בצאת השבת</p>
            <p className="text-white/30 text-xs">שבת שלום למשפחה 💛</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#4A4540] font-sans selection:bg-[#E3DCD2] flex flex-col md:flex-row-reverse" dir="rtl">

      {/* Parent voice message banner - a newly relayed recording auto-plays
          when the browser allows it; otherwise the banner stays on top until
          a kid taps play (the tap is a user gesture, so it always works). */}
      {parentVoice.pending && (
        <div className="fixed top-3 inset-x-3 z-[9998] flex justify-center pointer-events-none px-1">
          <div className="pointer-events-auto bg-[#5D4037] text-white rounded-2xl px-5 py-4 shadow-2xl w-full max-w-sm text-center space-y-2.5">
            <p className="text-base font-bold">🎧 הודעה קולית מההורים!</p>
            <button
              onClick={parentVoice.play}
              className="w-full px-4 py-3 bg-[#8A9A5B] hover:bg-[#7A8A4B] text-white rounded-xl text-base font-bold transition-all"
            >
              {parentVoice.isPlaying ? '🔊 מתנגן...' : '▶️ שמעו את ההודעה'}
            </button>
            <button
              onClick={parentVoice.dismiss}
              className="w-full px-4 py-1 text-white/70 hover:text-white text-xs transition-all"
            >
              סגירה
            </button>
          </div>
        </div>
      )}

      {/* Find-the-tablet overlay - background flashes every 500ms while ringing, on top of whatever screen is currently showing.
          Every device that's part of the sync group rings, including the one that pressed the button, so this needs its own
          Stop control rather than just blocking clicks to whatever's underneath. */}
      {isFindDeviceRinging && (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center transition-colors duration-200 ${isFindDeviceFlashOn ? 'bg-red-600/80' : 'bg-red-900/50'}`}>
          <div className="bg-white/95 rounded-2xl px-6 py-5 text-center shadow-2xl max-w-xs mx-4 space-y-3">
            <span className="text-4xl block">📍🔊</span>
            <p className="text-lg font-bold text-red-700">מחפשים את המכשיר הזה!</p>
            <button
              onClick={retryFindDevicePlayback}
              className="w-full px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all"
            >
              🔊 אין קול? הקישו כאן
            </button>
            <button
              onClick={stopRinging}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>⏹️</span>
              <span>עצור צליל</span>
            </button>
          </div>
        </div>
      )}

      {/* SIDEBAR - Collapsible */}
      {!sidebarCollapsed && (
      <aside className="w-full md:w-72 bg-[#E9E4DB] border-l border-[#D6CFC4] flex flex-col p-5 space-y-5 shrink-0 md:h-screen md:sticky md:top-0 h-auto overflow-y-auto relative">
        
        {/* Collapse button */}
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/60 hover:bg-white text-[#8C8479] hover:text-[#5D4037] transition-all border border-[#D6CFC4] z-10"
          title="מזער תפריט"
        >
          <X className="w-4 h-4" />
        </button>
        
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-[#D6CFC4] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <div>
              <h1 className="font-serif italic text-lg font-bold text-[#5D4037]">לוח משימות הבית</h1>
              <p className="text-xs text-[#8C8479]">גרסה מותאמת לטאבלט</p>
            </div>
          </div>
          
          <div className="bg-[#FAF8F5] px-2 py-1 rounded-md text-xs font-mono font-bold text-[#8A9A5B] flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>RTL - פעיל</span>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-[#DCD4C7] p-1.5 rounded-xl">
          <button
            onClick={() => setViewMode('child')}
            className={`py-2 rounded-lg text-sm font-bold transition-all text-center flex items-center justify-center gap-1 ${
              viewMode === 'child'
                ? 'bg-white text-[#5D4037] shadow-sm'
                : 'text-[#8C8479] hover:text-[#5D544A]'
            }`}
          >
            <span>🧒</span>
            <span>מבט ילד</span>
          </button>
          <button
            onClick={() => {
              if (isParentAuthenticated) {
                setViewMode('parent');
              } else {
                setViewMode('parent'); // Trigger pin screen
              }
            }}
            className={`py-2 rounded-lg text-sm font-bold transition-all text-center flex items-center justify-center gap-1 ${
              viewMode === 'parent'
                ? 'bg-[#8A9A5B] text-white shadow-sm'
                : 'text-[#8C8479] hover:text-[#5D544A]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>בקרה להורים</span>
          </button>
        </div>

        {/* Dynamic Sidebar Content - Child Mode */}
        {viewMode === 'child' && (
          <div className="flex-1 flex flex-col justify-between space-y-6">
            
            {/* Active Child Profile */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E958A] border-b border-[#D6CFC4] pb-1">
                הילד הפעיל כרגע
              </h3>
              <div className="flex items-center gap-3 bg-white/40 p-3 rounded-2xl border border-[#D6CFC4]">
                <img 
                  src={activeChild.photo}
                  alt={activeChild.name}
                  className="w-12 h-12 rounded-full object-cover object-top shadow-sm border-2"
                  style={{ borderColor: activeChild.color }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-bold text-[#4A4540]">{activeChild.name}</span>
                  </div>
                  <p className="text-xs text-[#8C8479]">{activeChild.gender === 'female' ? 'בת' : 'בן'} {getChildAge(activeChild)} | {getDayName()}</p>
                </div>
              </div>

              {/* Children Quick Switcher - LARGE easy-tap vertical pills for tablet */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#8C8479]">הקש להחלפת פרופיל ילד/ה:</p>
                <div className="grid grid-cols-2 gap-2">
                  {CHILDREN.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActiveChildId(child.id)}
                      className={`p-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                        activeChildId === child.id
                          ? 'bg-white border-[#8A9A5B] text-[#5D4037] shadow-sm scale-102'
                          : 'bg-[#F2EDE4]/50 hover:bg-white/50 border-[#D6CFC4] text-[#8C8479]'
                      }`}
                    >
                      <img 
                        src={child.photo}
                        alt={child.name}
                        className="w-6 h-6 rounded-full object-cover object-top border"
                        style={{ borderColor: child.color }}
                      />
                      <span>{child.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live mashov feed in sidebar */}
            <div className="bg-white/50 p-4 rounded-2xl border border-[#D6CFC4] space-y-3">
              <div className="flex items-center justify-between border-b border-[#D6CFC4] pb-2">
                <h4 className="text-xs font-bold text-[#8C8479] uppercase flex items-center gap-1">
                  <span>🎓</span>
                  <span>סנכרון מול ביה״ס (משוב)</span>
                </h4>
                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono font-bold">LIVE</span>
              </div>
              <p className="text-xs text-[#5D544A] leading-relaxed">
                מערכת ה-Mashov סורקת שיעורי בית מדי יום. ל{CHILDREN.slice(0, 2).map(c => c.name).join(' ו')} עודכנו שיעורי בית.
              </p>
              <div className="text-xs bg-white/70 p-2 rounded border border-[#E3DCD2]">
                <strong className="text-xs block text-[#D35400]">שיעורי בית ל{activeChild.name}:</strong>
                <p className="text-[11px] italic mt-0.5">
                  {getChildAge(activeChild) <= 6
                    ? 'פטור מגיל גן! יש להכין יצירה 🎨'
                    : mashovHasHomeworkText[activeChildId] || 'אין שיעורי בית היום 😊'}
                </p>
              </div>
            </div>

            {/* Points & Rewards Dashboard */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                  <span>⭐</span>
                  <span>הנקודות שלי</span>
                </h4>
                <span className="text-xl font-bold text-indigo-700">{childPoints[activeChildId] || 0}</span>
              </div>
              
              {/* Today's earned */}
              <div className="bg-white/60 p-2 rounded-lg border border-indigo-100">
                <p className="text-[10px] text-indigo-600 font-bold">
                  📊 היום: {getEarnedScreenTime(activeChildId, tasks[activeChildId] || []).points} נק׳ נצברו
                </p>
                <p className="text-[10px] text-indigo-500">
                  🎮 זמן מסך שנצבר: {getEarnedScreenTime(activeChildId, tasks[activeChildId] || []).earned} דק׳
                </p>
              </div>

              {/* Streak display */}
              <div className="flex items-center justify-between bg-orange-50/80 p-2 rounded-lg border border-orange-200">
                <div className="flex items-center gap-1">
                  <span className="text-sm">🔥</span>
                  <span className="text-[10px] font-bold text-orange-700">רצף ימים:</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-orange-700">{streaks[activeChildId]?.count || 0}</span>
                  {(streaks[activeChildId]?.count || 0) >= 3 && <span className="text-xs">🌟</span>}
                  {(streaks[activeChildId]?.count || 0) >= 7 && <span className="text-xs">🏆</span>}
                </div>
              </div>

              {/* Prize store button */}
              <button
                onClick={() => setShowPrizeStore(true)}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>🏪</span>
                <span>חנות הפרסים</span>
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{childPoints[activeChildId] || 0} נק׳</span>
              </button>
            </div>

            {/* Smiley & Gift Tracker */}
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <span>😊</span>
                  <span>הסמיילים שלי</span>
                </h4>
                <span className="text-lg font-bold text-amber-700">{smileyCount[activeChildId] || 0}</span>
              </div>
              
              {/* Smiley progress to gift */}
              <div>
                <div className="flex justify-between text-[10px] text-amber-700 mb-1 font-bold">
                  <span>התקדמות למתנה:</span>
                  <span>{Math.min(smileyCount[activeChildId] || 0, MAX_SMILEYS)}/{MAX_SMILEYS}</span>
                </div>
                <div className="h-2.5 bg-amber-100 rounded-full overflow-hidden border border-amber-200">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((smileyCount[activeChildId] || 0) / MAX_SMILEYS) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Smileys visual row */}
              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from({ length: Math.min(smileyCount[activeChildId] || 0, MAX_SMILEYS) }).map((_, i) => (
                  <span key={i} className="text-lg">😊</span>
                ))}
                {Array.from({ length: Math.max(0, MAX_SMILEYS - (smileyCount[activeChildId] || 0)) }).map((_, i) => (
                  <span key={`empty-${i}`} className="text-lg opacity-20">😊</span>
                ))}
              </div>

              {(smileyCount[activeChildId] || 0) >= MAX_SMILEYS && (
                <div className="bg-gradient-to-r from-pink-100 to-amber-100 p-2.5 rounded-xl border border-pink-200 text-center">
                  <span className="text-sm font-bold text-pink-700">🎁 מגיעה לך מתנה מאבא ואמא!</span>
                </div>
              )}

              {(giftsRedeemed[activeChildId] || 0) > 0 && (
                <p className="text-[10px] text-amber-600 text-center">
                  🎁 מתנות שהתקבלו: {giftsRedeemed[activeChildId]}
                </p>
              )}
            </div>

            {/* Weekly Excellence */}
            {(() => {
              const weekly = getWeeklyExcellenceStatus(activeChildId);
              return (
                <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                      <span>🏅</span>
                      <span>בונוס שבועי</span>
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-600">
                      {weekly.completedDays}/7 ימים
                    </span>
                  </div>
                  <div className="h-2 bg-emerald-100 rounded-full overflow-hidden border border-emerald-200">
                    <div 
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (weekly.completedDays / 7) * 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-[9px] text-emerald-600">
                    {weekly.isExcellent 
                      ? `🎉 הצטיינות! קיבלת ${WEEKLY_EXCELLENCE_BONUS} נקודות בונוס!` 
                      : `90%+ השלמה = ${WEEKLY_EXCELLENCE_BONUS} נקודות בונוס`}
                  </p>
                </div>
              );
            })()}

            {/* Help Block */}
            <div className="p-4 bg-[#8A9A5B]/10 rounded-2xl border border-[#8A9A5B]/20 text-center text-xs space-y-2">
              <p className="text-[#6A7B42] mb-0.5 font-bold">צריך עזרה עם המשימות?</p>
              <p className="text-[#8A9A5B] text-[10px]">קראו לאבא או אמא</p>
              <button
                onClick={() => {
                  const audio = new Audio('/api/tts?text=' + encodeURIComponent(`שלום ${activeChild.name}, בדיקה אחת שתיים שלוש`));
                  audio.play().then(() => alert('הקול עובד! 🎉')).catch(e => alert('שגיאה: ' + e.message));
                }}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition-all"
              >
                🔊 בדיקת קול
              </button>
            </div>

            {/* Sync Panel - always visible regardless of mode */}
            <div className="bg-[#E3DCD2] p-3 rounded-2xl space-y-2 text-[11px] text-[#5D544A]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">☁️ סנכרון</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    syncStatus === 'ok' ? 'bg-green-500' :
                    syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' :
                    syncStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-[9px] text-[#8C8479]">
                    {syncStatus === 'ok' ? 'מסונכרן ✓' : syncStatus === 'syncing' ? 'שומר...' : syncStatus === 'error' ? 'שגיאה' : 'כבוי'}
                  </span>
                  <button
                    onClick={() => {
                      setSyncEnabled(!syncEnabled);
                    }}
                    className={`relative w-8 h-4 rounded-full transition-colors ${syncEnabled ? 'bg-[#8A9A5B]' : 'bg-[#C5BDB4]'}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${syncEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              {syncEnabled && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 bg-white border border-[#D6CFC4] rounded px-1.5 py-1 text-center font-mono font-bold text-xs text-[#5D4037] tracking-widest">{familyCode}</code>
                    <button onClick={() => navigator.clipboard?.writeText(familyCode)} className="text-[10px] p-1 bg-white border border-[#D6CFC4] rounded" title="העתק">📋</button>
                  </div>
                  <div className="flex gap-1">
                    <input
                      value={familyCodeInput}
                      onChange={e => setFamilyCodeInput(e.target.value.toUpperCase().slice(0, 9))}
                      placeholder="קוד ממכשיר אחר"
                      className="flex-1 bg-white border border-[#D6CFC4] rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-[#8A9A5B]"
                    />
                    <button
                      onClick={() => {
                        const code = familyCodeInput.trim();
                        if (code.length < 8) return;
                        setFamilyCode(code);
                        setFamilyCodeInput('');
                      }}
                      className="px-2 py-1 bg-[#8A9A5B] text-white rounded text-[10px] font-bold hover:bg-[#6A7B42]"
                    >קבע</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Sidebar Content - Parent Mode Status */}
        {viewMode === 'parent' && (
          <div className="flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="bg-[#8A9A5B] text-white p-3 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold">מורשה הורים: מחובר</h4>
                  <p className="text-[10px] opacity-90">שלום אבא / אמא</p>
                </div>
              </div>

              {isParentAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[#8C8479]">קישורים מהירים למנהלים:</p>
                  <button
                    onClick={simulateMashovScrape}
                    disabled={isMashovScraping}
                    className="w-full text-right p-3 bg-white rounded-xl hover:bg-slate-50 transition-colors border border-[#D6CFC4] text-xs font-bold text-[#4A4540] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🔄</span>
                      <span>סימולציה של סורק משוב</span>
                    </span>
                    {isMashovScraping && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                  </button>

                  <button 
                    onClick={handleLogoutParent}
                    className="w-full py-2 bg-[#D35400] text-white rounded-xl font-bold text-xs hover:bg-[#b84a00] transition-colors"
                  >
                    התנתק ממצב הורה
                  </button>

                  {/* Change PIN */}
                  <div className="border-t border-[#D6CFC4] pt-3 space-y-2">
                    <p className="text-[10px] font-bold text-[#8C8479]">שינוי קוד PIN:</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="קוד חדש (4 ספרות)"
                        value={newPinInput}
                        onChange={e => setNewPinInput(e.target.value.slice(0, 4))}
                        className="flex-1 px-2 py-1.5 border border-[#D6CFC4] rounded-lg text-xs text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
                      />
                      <button
                        onClick={() => {
                          if (newPinInput.length < 4) {
                            setPinChangeMsg('קוד חייב להיות 4 ספרות');
                            return;
                          }
                          localStorage.setItem('hallel_parent_pin', newPinInput);
                          setSavedPin(newPinInput);
                          setNewPinInput('');
                          setPinChangeMsg('✅ קוד עודכן!');
                          setTimeout(() => setPinChangeMsg(''), 3000);
                        }}
                        className="px-3 py-1.5 bg-[#8A9A5B] text-white rounded-lg text-xs font-bold hover:bg-[#6A7B42] transition-colors"
                      >
                        שמור
                      </button>
                    </div>
                    {pinChangeMsg && <p className="text-[10px] text-center font-bold text-[#8A9A5B]">{pinChangeMsg}</p>}
                  </div>
                  
                  {onSignOut && (
                    <button 
                      onClick={onSignOut}
                      className="w-full py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-300 transition-colors mt-1"
                    >
                      🚪 התנתק מהחשבון
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#8C8479] leading-relaxed">
                  הזן PIN הורים כדי לגשת להגדרות מאסטר, עקיפת משימות ושליטה בזמן מסך.
                </p>
              )}
            </div>

            {/* Quick System Info indicators */}
            <div className="bg-[#E3DCD2] p-4 rounded-2xl space-y-1.5 text-[11px] font-mono text-[#5D544A]">
              <div className="font-bold border-b border-[#D6CFC4] pb-1 mb-1 text-xs">סטטוס אינטגרציות:</div>
              <div className="flex justify-between">
                <span>Mashov API:</span>
                <span className="text-green-700 font-bold">מחובר (OK)</span>
              </div>
            </div>

            {/* Family Sync Panel */}
            <div className="bg-[#E3DCD2] p-4 rounded-2xl space-y-3 text-[11px] text-[#5D544A]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">סנכרון בין מכשירים ☁️</span>
                <button
                  onClick={() => {
                    setSyncEnabled(!syncEnabled);
                  }}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    syncEnabled ? 'bg-[#8A9A5B]' : 'bg-[#C5BDB4]'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    syncEnabled ? 'right-0.5' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {syncEnabled && (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] text-[#8C8479]">קוד משפחה שלך:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border border-[#D6CFC4] rounded-lg px-2 py-1.5 text-center font-mono font-bold text-sm tracking-widest text-[#5D4037]">
                        {familyCode}
                      </code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(familyCode)}
                        className="p-1.5 bg-white border border-[#D6CFC4] rounded-lg hover:bg-[#F2EDE4] text-[10px]"
                        title="העתק"
                      >
                        📋
                      </button>
                    </div>
                    <p className="text-[9px] text-[#8C8479] leading-snug">
                      הכנס את אותו הקוד בכל המכשירים והדק סינכרון.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-[#8C8479]">או הכנס קוד ממכשיר אחר:</p>
                    <div className="flex gap-1.5">
                      <input
                        value={familyCodeInput}
                        onChange={e => setFamilyCodeInput(e.target.value.toUpperCase().slice(0, 9))}
                        placeholder="XXXX-XXXX"
                        className="flex-1 bg-white border border-[#D6CFC4] rounded-lg px-2 py-1 text-[11px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#8A9A5B]"
                      />
                      <button
                        onClick={() => {
                          const code = familyCodeInput.trim();
                          if (code.length < 8) return;
                          setFamilyCode(code);
                          setFamilyCodeInput('');
                        }}
                        className="px-2 py-1 bg-[#8A9A5B] text-white rounded-lg text-[10px] font-bold hover:bg-[#6A7B42]"
                      >
                        קבע
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      syncStatus === 'ok' ? 'bg-green-500 animate-pulse' :
                      syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' :
                      syncStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-[10px]">
                      {syncStatus === 'ok' ? 'מסונכרן ✓' :
                       syncStatus === 'syncing' ? 'שומר...' :
                       syncStatus === 'error' ? 'שגיאת סינכרון' : 'מחכה'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </aside>
      )}
      
      {/* Sidebar expand button (when collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed top-4 right-4 z-30 p-2.5 bg-[#E9E4DB] hover:bg-[#D6CFC4] border border-[#D6CFC4] rounded-xl shadow-md transition-all flex items-center gap-1.5"
          title="פתח תפריט"
        >
          <span className="text-sm">📋</span>
          <span className="text-[10px] font-bold text-[#5D4037]">תפריט</span>
        </button>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* TOP COMPACT HEADER */}
        <header className="h-20 px-6 lg:px-8 border-b border-[#D6CFC4] flex items-center justify-between bg-white sticky top-0 z-20 shadow-sm">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl lg:text-2xl font-serif italic text-[#5D4037]">ניהול משימות לילדים</h2>
            {viewMode === 'child' && (
              <div className="bg-[#F2EDE4] px-2.5 py-0.5 rounded-full text-xs font-bold text-[#8C8479] hidden sm:block">
                {completedTotalCount} מתוך {totalTaskCount} הושלמו
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-left text-xs text-[#8C8479] leading-tight hidden lg:block">
              <div className="font-bold">{getDayName()} | {hebrewDate}</div>
              <div>{currentDate} | {currentTime}</div>
              <div className="text-[9px] text-amber-700">🕯️ {shabbatStatus.candleLighting} | ✨ {shabbatStatus.havdalah}</div>
            </div>

            {/* Quick Toggle for Parent Mode in Header */}
            <button
              onClick={() => {
                if (viewMode === 'child') {
                  setViewMode('parent');
                } else {
                  setViewMode('child');
                }
              }}
              className={`px-3 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                viewMode === 'parent'
                  ? 'bg-[#8A9A5B] border-[#8A9A5B] text-white hover:bg-[#6A7B42]'
                  : 'bg-white border-[#DCD4C7] text-[#5D4037] hover:bg-[#FAF8F5]'
              }`}
              title={viewMode === 'parent' ? "חזרה למבט ילד" : "כניסה לאזור הורים שליטה"}
            >
              {viewMode === 'parent' ? (
                <>
                  <span>🧒</span>
                  <span>מבט ילדים</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A9A5B]" />
                  <span className="text-[#8A9A5B]">בקרה להורים</span>
                </>
              )}
            </button>
            
            {/* Reset button - only visible in parent mode */}
            {viewMode === 'parent' && isParentAuthenticated && (
            <button
              onClick={() => {
                if (window.confirm('האם ברצונך לאפס את המשימות של כל הילדים להתחלה?')) {
                  const t: Record<string, Task[]> = {};
                  CHILDREN.forEach(c => { t[c.id] = getTasksForToday(c.id); });
                  setTasks(t);
                }
              }}
              className="p-2 border border-[#D6CFC4] rounded-lg bg-white text-xs hover:bg-[#F2EDE4] text-[#8C8479] flex items-center gap-1.5 transition-all"
              title="איפוס משימות"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">אתחל</span>
            </button>
            )}
          </div>
        </header>

        {/* CONTAINER CONDITIONAL VIEWS */}
        <div className="flex-1 p-6 lg:p-8">
          
          {/* A. CHILD INSTRUCTIONS VIEW - 4 columns, one per child, filtered by time of day */}
          {viewMode === 'child' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              
              {/* Time of day header with time period selector */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#D6CFC4] shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{timeOfDayLabels[currentTimeOfDay].emoji}</span>
                  <div>
                    <h2 className="text-xl font-bold text-[#5D4037]">{timeOfDayLabels[currentTimeOfDay].label}</h2>
                    <p className="text-xs text-[#8C8479]">{getDayName()} | {currentTime} | {timeOfDayLabels[currentTimeOfDay].subtitle}</p>
                  </div>
                </div>
                
                {/* Manual time period switch */}
                <div className="flex gap-1.5 bg-[#E9E4DB] p-1 rounded-xl">
                  {(['morning', 'afternoon', 'evening'] as TimeOfDay[]).map(time => (
                    <button
                      key={time}
                      onClick={() => {
                        // Override time by storing in state
                        setOverrideTimeOfDay(overrideTimeOfDay === time ? null : time);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        (overrideTimeOfDay || currentTimeOfDay) === time
                          ? 'bg-white text-[#5D4037] shadow-sm'
                          : 'text-[#8C8479] hover:text-[#5D544A]'
                      }`}
                    >
                      <span>{timeOfDayLabels[time].emoji}</span>
                      <span className="hidden sm:inline">{timeOfDayLabels[time].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-COLUMN KIDS TASK GRID */}
              <div className="grid grid-cols-4 gap-3 items-start">
                {CHILDREN.map((child) => {
                  const activeTime = overrideTimeOfDay || currentTimeOfDay;
                  const childTasks = getTasksByTime(child.id, activeTime);
                  const childMandatory = childTasks.filter(t => t.mandatory);
                  const childCompletedMandatory = childMandatory.filter(t => t.completed).length;
                  const childAllDone = childMandatory.length > 0 && childCompletedMandatory === childMandatory.length;
                  const childScreenTime = getEarnedScreenTime(child.id, tasks[child.id] || []);

                  return (
                    <div key={child.id} className={`rounded-3xl border p-4 space-y-3 transition-all ${
                      childAllDone 
                        ? 'bg-green-50/50 border-green-300' 
                        : 'bg-white border-[#D6CFC4]'
                    }`}>
                      {/* Child header */}
                      <div className="flex items-center gap-2 border-b border-[#E3DCD2] pb-2">
                        <img 
                          src={child.photo}
                          alt={child.name}
                          className="w-10 h-10 rounded-full object-cover object-top border-2 shadow-sm"
                          style={{ borderColor: child.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-[#4A4540] truncate">{child.name}</h3>
                          <p className="text-[10px] text-[#8C8479]">
                            {child.gender === 'female' ? 'בת' : 'בן'} {getChildAge(child)}
                          </p>
                        </div>
                        <div className="text-center shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            childAllDone ? 'bg-green-100 text-green-700' : 'bg-[#D35400]/10 text-[#D35400]'
                          }`}>
                            {childCompletedMandatory}/{childMandatory.length}
                          </span>
                        </div>
                      </div>

                      {/* Points, Smiley & Streak count */}
                      <div className="flex items-center justify-between text-[10px] flex-wrap gap-1">
                        <span className="text-indigo-700 font-bold">⭐ {childPoints[child.id] || 0}</span>
                        <span className="text-amber-700 font-bold">😊 {smileyCount[child.id] || 0}</span>
                        {(streaks[child.id]?.count || 0) > 0 && (
                          <span className="text-orange-600 font-bold">🔥 {streaks[child.id]?.count}</span>
                        )}
                        {childScreenTime.earned > 0 && (
                          <span className="text-indigo-600 font-bold">🎮 {childScreenTime.earned} דק׳</span>
                        )}
                      </div>

                      {/* Play-first timer countdown - screen-time prizes are locked until this hits 0 */}
                      {isPlayTimerActive(child.id, playTimers, tickNow) && (
                        <div className="flex items-center justify-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-xl py-1.5">
                          <span className="text-xs">⏳</span>
                          <span className="text-[10px] font-bold text-indigo-700">
                            זמן משחק · מסך בעוד {formatPlayTimerRemaining(playTimers[child.id].endsAt - tickNow)}
                          </span>
                        </div>
                      )}

                      {/* Tasks list */}
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {childTasks.filter(task => !task.completed || recentlyCompleted.has(`${child.id}-${task.id}`)).map((task) => (
                          <div
                            key={task.id}
                            onClick={() => !task.completed ? handleTaskClick(child.id, task.id) : undefined}
                            className={`p-1.5 rounded-lg border transition-all duration-500 ${
                              task.completed
                                ? 'opacity-40 border-green-300 bg-green-50 scale-95 cursor-default'
                                : task.mandatory
                                ? 'border-[#D35400]/40 bg-white shadow-sm cursor-pointer'
                                : 'border-[#D6CFC4] bg-white cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {/* Checkbox */}
                              <div 
                                onClick={(e) => { e.stopPropagation(); toggleTask(child.id, task.id); }}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                  task.completed ? 'bg-[#8A9A5B] border-[#8A9A5B]' : 'border-[#D6CFC4]'
                                }`}
                              >
                                <Check className={`w-3 h-3 text-white transition-opacity ${task.completed ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
                              </div>

                              {/* Emoji + title */}
                              <span className="text-sm shrink-0">{task.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-bold leading-tight ${task.completed ? 'line-through text-[#8C8479]' : 'text-[#4A4540]'}`}>
                                  {task.title}
                                </p>
                                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                                  {task.mandatory && !task.completed && (
                                    <span className="text-[8px] font-bold text-[#D35400] bg-[#D35400]/10 px-1 py-0.5 rounded">חובה ⚡</span>
                                  )}
                                  {task.requiresPhoto && !task.photo && (
                                    <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">📸</span>
                                  )}
                                  {task.photo && (
                                    <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">✓📸</span>
                                  )}
                                  {getChildAge(child) <= 6 && (
                                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">🔊</span>
                                  )}
                                </div>
                              </div>

                              {/* Camera button */}
                              {task.requiresPhoto && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCaptureTaskTarget({ childId: child.id, taskId: task.id }); }}
                                  className={`p-1 rounded-lg shrink-0 ${
                                    task.photo ? 'bg-green-100 border border-green-300' : 'bg-slate-100'
                                  }`}
                                >
                                  <Camera className="w-3.5 h-3.5 text-[#5D4037]" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {childTasks.length === 0 && (
                          <div className="text-center py-4 text-[#8C8479]">
                            <span className="text-2xl block mb-1">✅</span>
                            <span className="text-xs">אין משימות כרגע</span>
                          </div>
                        )}

                        {childTasks.length > 0 && childTasks.every(t => t.completed) && (
                          <div className="text-center py-4 text-green-700">
                            <span className="text-3xl block mb-1">🎉</span>
                            <span className="text-xs font-bold">כל המשימות בוצעו!</span>
                          </div>
                        )}
                      </div>

                      {/* Completion status */}
                      {childAllDone && childTasks.length > 0 && (
                        <div className="bg-green-100 px-3 py-2 rounded-xl text-center">
                          <span className="text-xs font-bold text-green-700">✅ כל החובות בוצעו!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* B. PARENT MODE VIEW */}
          {viewMode === 'parent' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              
              {/* Authenticator Check (or simulation) */}
              {!isParentAuthenticated ? (
                <div id="parent-auth-form" className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#D6CFC4] shadow-md space-y-6 text-center">
                  <div className="w-16 h-16 bg-red-50 text-[#D35400] rounded-full flex items-center justify-center mx-auto text-3xl">
                    🔐
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-[#5D4037]">לוח בקרה למבוגרים בלבד</h3>
                    <p className="text-xs text-[#8C8479] mt-1">אבא ואמא - נא להקיש את קוד האימות שלכם</p>
                  </div>

                  <form onSubmit={handleParentAuth} className="space-y-4">
                    <div>
                      <input
                        id="parent-pin-input"
                        type="password"
                        placeholder="הקש קוד PIN (לדוגמה 1234)"
                        value={parentPin}
                        onChange={(e) => setParentPin(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-[#D6CFC4] rounded-xl text-center font-mono text-xl tracking-wider focus:outline-none focus:ring-2 focus:ring-[#8A9A5B]"
                      />
                      {parentPinError && (
                        <p className="text-xs text-red-500 font-bold mt-1.5">❌ קוד שגוי! נסו שוב</p>
                      )}
                    </div>
                    
                    <button
                      id="parent-auth-btn"
                      type="submit"
                      className="w-full py-3 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl font-bold transition-colors"
                    >
                      כניסה ללוח בקרה
                    </button>
                  </form>

                  <div className="text-[11px] text-[#8C8479] border-t pt-4">
                    <span>* ההרשאות מנוהלות ב-AppSheet לפי מייל ההורה המחובר ({`hallel34@gmail.com`}).</span>
                  </div>
                </div>
              ) : (
                <div id="parent-dashboard" className="space-y-8">
                  
                  {/* Dynamic Parent Control Bar */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm">
                    <div>
                      <h3 className="text-2xl font-bold text-[#5D4037]">👨‍👩‍👧‍👦 לוח הבקרה של ההורים</h3>
                      <p className="text-sm text-[#8C8479]">מעקב התקדמות הילדים בזמן אמת, אישור משימות מרחוק ושליטה בזמן מסך</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={simulateMashovScrape}
                        disabled={isMashovScraping}
                        className="px-4 py-2.5 bg-[#5D4037] hover:bg-[#432d27] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                      >
                        {isMashovScraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>🎓</span>}
                        <span>סנכרן משוב (Mashov API)</span>
                      </button>
                    </div>
                  </div>

                  {/* PARENT DASHBOARD TABS */}
                  <div className="flex gap-2 bg-[#E9E4DB] p-1.5 rounded-xl">
                    <button
                      onClick={() => setParentTab('dashboard')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                        parentTab === 'dashboard'
                          ? 'bg-white text-[#5D4037] shadow-sm'
                          : 'text-[#8C8479] hover:text-[#5D544A]'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>לוח בקרה</span>
                    </button>
                    <button
                      onClick={() => setParentTab('history')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                        parentTab === 'history'
                          ? 'bg-white text-[#5D4037] shadow-sm'
                          : 'text-[#8C8479] hover:text-[#5D544A]'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>📅 היסטוריה וגרפים</span>
                    </button>
                  </div>

                  {/* TAB CONTENT: HISTORY & CALENDAR */}
                  {parentTab === 'history' && (
                    <div className="space-y-6">

                      {/* HEBREW DATE & SHABBAT INFO HEADER */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-3xl border border-amber-200 shadow-sm">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">📅</span>
                            <div>
                              <h3 className="text-lg font-bold text-[#5D4037]">{hebrewDate}</h3>
                              <p className="text-xs text-[#8C8479]">{getDayName()} | {currentDate} | {LOCATION.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 bg-white/60 px-4 py-2 rounded-xl border border-amber-200">
                            <div className="text-center">
                              <span className="text-[10px] text-[#8C8479] block">🕯️ כניסת שבת</span>
                              <span className="text-sm font-bold text-[#5D4037]">{shabbatStatus.candleLighting}</span>
                            </div>
                            <div className="w-px h-8 bg-amber-200"></div>
                            <div className="text-center">
                              <span className="text-[10px] text-[#8C8479] block">✨ צאת שבת</span>
                              <span className="text-sm font-bold text-[#5D4037]">{shabbatStatus.havdalah}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* JOURNAL FILTERS */}
                      <div className="bg-white p-4 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-3">
                        <h4 className="font-bold text-[#5D4037] text-sm flex items-center gap-2">
                          <span>🔍</span> סינון וניהול
                        </h4>
                        <div className="flex flex-wrap gap-3 items-center">
                          {/* Child filter */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-[#8C8479]">ילד/ה:</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setJournalChildFilter('all')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  journalChildFilter === 'all' ? 'bg-[#8A9A5B] text-white' : 'bg-[#F2EDE4] text-[#5D4037] hover:bg-[#E9E4DB]'
                                }`}
                              >כולם</button>
                              {CHILDREN.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setJournalChildFilter(c.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                    journalChildFilter === c.id ? 'bg-[#8A9A5B] text-white' : 'bg-[#F2EDE4] text-[#5D4037] hover:bg-[#E9E4DB]'
                                  }`}
                                >
                                  <img src={c.photo} alt={c.name} className="w-4 h-4 rounded-full object-cover object-top" />
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Time filter */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-[#8C8479]">תקופה:</span>
                            <div className="flex gap-1">
                              {([['day', 'יום'], ['week', 'שבוע'], ['month', 'חודש']] as [JournalFilter, string][]).map(([key, label]) => (
                                <button
                                  key={key}
                                  onClick={() => setJournalFilter(key)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    journalFilter === key ? 'bg-indigo-600 text-white' : 'bg-[#F2EDE4] text-[#5D4037] hover:bg-[#E9E4DB]'
                                  }`}
                                >{label}</button>
                              ))}
                            </div>
                          </div>

                          {/* Date picker */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-[#8C8479]">תאריך:</span>
                            <input
                              type="date"
                              value={journalDate}
                              onChange={e => setJournalDate(e.target.value)}
                              className="px-2 py-1 text-[10px] border border-[#D6CFC4] rounded-lg bg-white"
                            />
                            <button
                              onClick={() => setJournalDate(getLocalDateKey())}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >היום</button>
                          </div>
                        </div>
                      </div>

                      {/* JOURNAL - Task records for filtered period */}
                      <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                        <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2 border-b border-[#F2EDE4] pb-3">
                          <span>📖</span> יומן משימות
                          <span className="text-xs font-normal text-[#8C8479]">
                            ({journalFilter === 'day' ? 'יום' : journalFilter === 'week' ? 'שבוע' : 'חודש'}
                            {journalChildFilter !== 'all' && ` — ${CHILDREN.find(c => c.id === journalChildFilter)?.name}`})
                          </span>
                        </h4>

                        {(() => {
                          // Filter history based on selections
                          const baseDate = new Date(journalDate);
                          let filteredHistory = taskHistory;
                          
                          if (journalFilter === 'day') {
                            filteredHistory = taskHistory.filter(r => r.date === journalDate);
                          } else if (journalFilter === 'week') {
                            const weekStart = new Date(baseDate);
                            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                            const weekEnd = new Date(weekStart);
                            weekEnd.setDate(weekEnd.getDate() + 6);
                            filteredHistory = taskHistory.filter(r => {
                              const d = new Date(r.date);
                              return d >= weekStart && d <= weekEnd;
                            });
                          } else {
                            const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
                            const monthEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
                            filteredHistory = taskHistory.filter(r => {
                              const d = new Date(r.date);
                              return d >= monthStart && d <= monthEnd;
                            });
                          }

                          if (filteredHistory.length === 0) {
                            return (
                              <div className="text-center py-8 text-[#8C8479]">
                                <span className="text-4xl block mb-2">📭</span>
                                <p className="text-sm font-bold">אין נתונים לתקופה שנבחרה</p>
                                <p className="text-xs">משימות יתחילו להיאסף מרגע שהילדים ישלימו אותן</p>
                              </div>
                            );
                          }

                          const childrenToShow = journalChildFilter === 'all' 
                            ? CHILDREN 
                            : CHILDREN.filter(c => c.id === journalChildFilter);

                          return (
                            <div className="space-y-3">
                              {filteredHistory.map((day, idx) => {
                                const dayDate = new Date(day.date);
                                const hebrewDay = getHebrewDayMonth(dayDate);
                                const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
                                const isToday = day.date === getLocalDateKey();
                                
                                return (
                                  <div key={idx} className={`p-3 rounded-xl border ${isToday ? 'border-[#8A9A5B] bg-green-50/30' : 'border-[#E3DCD2] bg-[#FAF8F5]'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#5D4037]">
                                          יום {dayNames[dayDate.getDay()]} | {dayDate.toLocaleDateString('he-IL')}
                                        </span>
                                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{hebrewDay}</span>
                                        {isToday && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">היום</span>}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                      {childrenToShow.map(child => {
                                        const rec = day.children[child.id];
                                        if (!rec) return null;
                                        const pct = rec.total > 0 ? Math.round((rec.completed / rec.total) * 100) : 0;
                                        return (
                                          <div key={child.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#E3DCD2]">
                                            <img src={child.photo} alt={child.name} className="w-6 h-6 rounded-full object-cover object-top border" style={{ borderColor: child.color }} />
                                            <div className="flex-1 min-w-0">
                                              <span className="text-[10px] font-bold text-[#5D4037] block truncate">{child.name}</span>
                                              <div className="flex items-center gap-1">
                                                <div className="flex-1 h-1.5 bg-[#E9E4DB] rounded-full overflow-hidden">
                                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: child.color }}></div>
                                                </div>
                                                <span className="text-[9px] font-bold" style={{ color: child.color }}>{pct}%</span>
                                              </div>
                                              <span className="text-[9px] text-[#8C8479]">{rec.completed}/{rec.total} | ⭐{rec.points}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* WEEKLY COMPLETION GRAPH (Bar chart) */}
                      <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                          <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                            <span>📊</span> גרף השלמת משימות - 7 ימים אחרונים
                          </h4>
                        </div>
                        
                        {/* Bar Chart */}
                        <div className="flex items-end gap-1 h-48 p-4 bg-[#FAF8F5] rounded-2xl border border-[#E3DCD2]">
                          {taskHistory.slice(-7).map((day, idx) => {
                            const dayDate = new Date(day.date);
                            const dayNames = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
                            const dayName = dayNames[dayDate.getDay()];
                            const dayNum = dayDate.getDate();
                            
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                {/* Bars per child */}
                                <div className="flex gap-0.5 items-end flex-1 w-full justify-center">
                                  {CHILDREN.map(child => {
                                    const record = day.children[child.id];
                                    const pct = record ? Math.round((record.completed / record.total) * 100) : 0;
                                    return (
                                      <div
                                        key={child.id}
                                        className="w-3 rounded-t-sm transition-all duration-300"
                                        style={{ 
                                          height: `${pct}%`, 
                                          backgroundColor: child.color,
                                          minHeight: '4px',
                                          opacity: pct > 0 ? 1 : 0.2
                                        }}
                                        title={`${child.name}: ${pct}%`}
                                      ></div>
                                    );
                                  })}
                                </div>
                                {/* Day label */}
                                <div className="text-center">
                                  <span className="text-[9px] font-bold text-[#8C8479] block">{dayName}</span>
                                  <span className="text-[8px] text-[#8C8479]">{dayNum}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-3 justify-center flex-wrap">
                          {CHILDREN.map(child => (
                            <div key={child.id} className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: child.color }}></div>
                              <span className="text-[10px] font-bold text-[#5D4037]">{child.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* POINTS TREND (Line-like chart using dots) */}
                      <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                          <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                            <span>⭐</span> נקודות שנצברו - 14 ימים אחרונים
                          </h4>
                        </div>
                        
                        <div className="space-y-3">
                          {CHILDREN.map(child => {
                            const last14 = taskHistory.slice(-14);
                            const maxPoints = Math.max(...last14.map(d => d.children[child.id]?.points || 0), 1);
                            return (
                              <div key={child.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <img src={child.photo} alt={child.name} className="w-5 h-5 rounded-full object-cover object-top border" style={{ borderColor: child.color }} />
                                  <span className="text-xs font-bold text-[#5D4037]">{child.name}</span>
                                  <span className="text-[10px] text-[#8C8479]">
                                    סה״כ: {last14.reduce((acc, d) => acc + (d.children[child.id]?.points || 0), 0)} נק׳
                                  </span>
                                </div>
                                <div className="flex items-end gap-0.5 h-8 bg-[#FAF8F5] rounded-lg p-1 border border-[#E3DCD2]">
                                  {last14.map((day, i) => {
                                    const pts = day.children[child.id]?.points || 0;
                                    const h = Math.max(4, (pts / maxPoints) * 100);
                                    return (
                                      <div
                                        key={i}
                                        className="flex-1 rounded-t-sm transition-all"
                                        style={{ height: `${h}%`, backgroundColor: child.color, opacity: 0.7 }}
                                        title={`${day.date}: ${pts} נק׳`}
                                      ></div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* CALENDAR VIEW - 30 days */}
                      <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                          <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                            <span>📅</span> לוח שנה - חודש אחרון
                          </h4>
                        </div>
                        
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1.5">
                          {/* Day headers */}
                          {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-[#8C8479] py-1">{d}</div>
                          ))}
                          
                          {/* Fill empty days at start */}
                          {(() => {
                            const firstDay = taskHistory.length > 0 ? new Date(taskHistory[0].date).getDay() : 0;
                            return Array.from({ length: firstDay }).map((_, i) => (
                              <div key={`empty-${i}`} className="aspect-square"></div>
                            ));
                          })()}
                          
                          {/* Day cells */}
                          {taskHistory.slice(-30).map((day, idx) => {
                            const date = new Date(day.date);
                            const dayChildren = Object.values(day.children) as { completed: number; total: number; points: number }[];
                            const totalCompleted = dayChildren.reduce((acc, c) => acc + c.completed, 0);
                            const totalAll = dayChildren.reduce((acc, c) => acc + c.total, 0);
                            const pct = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;
                            const isToday = day.date === getLocalDateKey();
                            
                            let bgColor = 'bg-red-100 border-red-200';
                            let emoji = '😟';
                            if (pct >= 90) { bgColor = 'bg-green-100 border-green-300'; emoji = '🌟'; }
                            else if (pct >= 70) { bgColor = 'bg-yellow-100 border-yellow-200'; emoji = '😊'; }
                            else if (pct >= 50) { bgColor = 'bg-orange-100 border-orange-200'; emoji = '😐'; }
                            
                            return (
                              <div
                                key={idx}
                                className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-center text-center transition-all ${bgColor} ${isToday ? 'ring-2 ring-[#8A9A5B] ring-offset-1' : ''}`}
                                title={`${day.date}: ${pct}% (${totalCompleted}/${totalAll})`}
                              >
                                <span className="text-[9px] font-bold text-[#5D4037]">{date.getDate()}</span>
                                <span className="text-sm">{emoji}</span>
                                <span className="text-[8px] font-bold text-[#8C8479]">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-3 justify-center flex-wrap pt-2 border-t border-[#F2EDE4]">
                          <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> 90%+ 🌟</span>
                          <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></span> 70-89% 😊</span>
                          <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></span> 50-69% 😐</span>
                          <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200"></span> &lt;50% 😟</span>
                        </div>
                      </div>

                      {/* PER-CHILD STATS SUMMARY */}
                      <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                          <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                            <span>📈</span> סיכום ביצועים לפי ילד
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {CHILDREN.map(child => {
                            const last30 = taskHistory.slice(-30);
                            const totalCompleted = last30.reduce((acc, d) => acc + (d.children[child.id]?.completed || 0), 0);
                            const totalAll = last30.reduce((acc, d) => acc + (d.children[child.id]?.total || 0), 0);
                            const avgPct = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;
                            const totalPts = last30.reduce((acc, d) => acc + (d.children[child.id]?.points || 0), 0);
                            const bestDay = last30.reduce((best, d) => {
                              const rec = d.children[child.id];
                              if (!rec) return best;
                              const pct = rec.total > 0 ? rec.completed / rec.total : 0;
                              return pct > best.pct ? { pct, date: d.date } : best;
                            }, { pct: 0, date: '' });
                            const daysAbove80 = last30.filter(d => {
                              const rec = d.children[child.id];
                              return rec && rec.total > 0 && (rec.completed / rec.total) >= 0.8;
                            }).length;

                            return (
                              <div key={child.id} className="p-4 rounded-2xl border space-y-3" style={{ borderColor: child.color + '40', backgroundColor: child.color + '08' }}>
                                <div className="flex items-center gap-2">
                                  <img src={child.photo} alt={child.name} className="w-8 h-8 rounded-full object-cover object-top border-2" style={{ borderColor: child.color }} />
                                  <div>
                                    <h5 className="font-bold text-sm text-[#5D4037]">{child.name}</h5>
                                    <p className="text-[10px] text-[#8C8479]">30 ימים אחרונים</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-[#8C8479]">ממוצע השלמה:</span>
                                    <span className="font-bold" style={{ color: child.color }}>{avgPct}%</span>
                                  </div>
                                  <div className="h-2 bg-[#E9E4DB] rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${avgPct}%`, backgroundColor: child.color }}></div>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-[#8C8479]">סה״כ נקודות:</span>
                                    <span className="font-bold text-indigo-700">⭐ {totalPts}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-[#8C8479]">ימים מעל 80%:</span>
                                    <span className="font-bold text-green-700">{daysAbove80}/30</span>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-[#8C8479]">היום הכי טוב:</span>
                                    <span className="font-bold text-amber-700">{bestDay.date ? `${Math.round(bestDay.pct * 100)}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-[#8C8479]">רצף נוכחי:</span>
                                    <span className="font-bold text-orange-600">🔥 {streaks[child.id]?.count || 0} ימים</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB CONTENT: MAIN DASHBOARD - Draggable panels */}
                  {parentTab === 'dashboard' && (<div className="space-y-8 flex flex-col">
                  
                  {/* Kids Tracker */}
                  <div style={{ order: panelOrder.indexOf('tracker') }} 
                    draggable onDragStart={() => handlePanelDragStart('tracker')} onDragOver={(e) => handlePanelDragOver(e, 'tracker')} onDrop={() => handlePanelDrop('tracker')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'tracker' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'tracker' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white rounded-3xl border border-[#D6CFC4] shadow-sm overflow-hidden">
                    <div className="flex items-center">
                      <div className="px-3 py-4 cursor-grab active:cursor-grabbing text-[#D6CFC4] hover:text-[#8C8479] select-none" title="גרור לשינוי סדר">⠿</div>
                      <button onClick={() => togglePanel('tracker')} className="flex-1 p-4 pl-0 flex items-center justify-between hover:bg-[#FAF8F5] transition-all">
                        <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">📊 מעקב ילדים בזמן אמת</h4>
                        <span className={`text-[#8C8479] transition-transform ${collapsedPanels['tracker'] ? '' : 'rotate-180'}`}>▼</span>
                      </button>
                    </div>
                    {!collapsedPanels['tracker'] && (
                  <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {CHILDREN.map((child) => {
                      const stats = getChildProgress(child.id);
                      return (
                        <div key={child.id} className="bg-white p-5 rounded-2xl border border-[#D6CFC4] shadow-sm flex flex-col justify-between space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={child.photo} alt={child.name} className="w-8 h-8 rounded-full object-cover object-top border" style={{ borderColor: child.color }} />
                              <div>
                                <h4 className="font-bold text-[#4A4540]">{child.name}</h4>
                                <p className="text-[10px] text-[#8C8479]">{child.gender === 'female' ? 'בת' : 'בן'} {getChildAge(child)}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              stats.isUnlocked 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-[#D35400]/10 text-[#D35400]'
                            }`}>
                              {stats.isUnlocked ? 'מסך פתוח ✅' : 'מסך נעול 🔒'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span>התקדמות חובה:</span>
                              <span className={stats.isUnlocked ? 'text-green-600' : 'text-[#D35400]'}>
                                {stats.completedMand}/{stats.totalMand} ({stats.percentage}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-[#E9E4DB] rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${stats.isUnlocked ? 'bg-[#8A9A5B]' : 'bg-[#D35400]'}`}
                                style={{ width: `${stats.percentage}%` }}
                              ></div>
                            </div>
                            <p className="text-[10px] text-[#8C8479]">סה״כ משימות שבוצעו: {stats.totalCompleted}/{stats.totalCount}</p>
                            <p className={`text-[10px] font-bold ${stats.screenTime.allMandatoryDone ? 'text-indigo-700' : 'text-[#8C8479]'}`}>
                              🎮 זמן מסך: {stats.screenTime.earned > 0 ? `${stats.screenTime.earned} דק׳` : `0 / ${stats.screenTime.base} דק׳`}
                              {stats.screenTime.bonus > 0 && ` (+${stats.screenTime.bonus} בונוס)`}
                            </p>
                            <p className="text-[10px] text-indigo-700 font-bold">
                              ⭐ נקודות: {childPoints[child.id] || 0} | 🔥 רצף: {streaks[child.id]?.count || 0} ימים
                            </p>
                            <p className="text-[10px] text-amber-700 font-bold">
                              😊 סמיילים: {smileyCount[child.id] || 0} | 🎁 מתנות: {giftsRedeemed[child.id] || 0}
                            </p>
                          </div>

                          {/* Quick Admin Override Actions */}
                          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#F2EDE4]">
                            <button
                              onClick={() => overrideAllCompleted(child.id, true)}
                              className="py-1 px-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              אישור גורף ✅
                            </button>
                            <button
                              onClick={() => overrideAllCompleted(child.id, false)}
                              className="py-1 px-2 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              אפס משימות 🔄
                            </button>
                            <button
                              onClick={() => setChildPoints(prev => ({ ...prev, [child.id]: (prev[child.id] || 0) + 10 }))}
                              className="py-1 px-2 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              +10 נקודות ⭐
                            </button>
                            <button
                              onClick={() => setChildPoints(prev => ({ ...prev, [child.id]: Math.max(0, (prev[child.id] || 0) - 10) }))}
                              className="py-1 px-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-all text-center"
                            >
                              -10 נקודות 📉
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  </div>
                    )}
                  </div>
                  </div>

                    {/* Photos */}
                    <div style={{ order: panelOrder.indexOf('photos') }}
                      draggable onDragStart={() => handlePanelDragStart('photos')} onDragOver={(e) => handlePanelDragOver(e, 'photos')} onDrop={() => handlePanelDrop('photos')} onDragEnd={handlePanelDragEnd}
                      className={`transition-all duration-200 ${draggedPanel === 'photos' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'photos' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing text-[#D6CFC4] hover:text-[#8C8479] select-none" title="גרור">⠿</div>
                        <div className="flex-1 flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                        <div className="flex items-center gap-2">
                          <Camera className="w-5 h-5 text-green-700" />
                          <h4 className="font-bold text-[#5D4037] text-lg">לוח בקרת אישור תמונות של הילדים</h4>
                        </div>
                        <span className="text-[11px] bg-slate-100 rounded-full px-2.5 py-1 text-slate-700 font-bold">
                          הוכחות: {(() => {
                            const found: any[] = [];
                            CHILDREN.forEach(child => {
                              (tasks[child.id] || []).forEach(t => {
                                if (t.photo) found.push(t);
                              });
                            });
                            return found.length;
                          })()}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs text-[#8C8479] leading-relaxed">
                          להלן תמונות שהילדים צילמו על מנת לקבל אישור למטלות חובה ורשות. אבא ואמא יכולים לצפות בהוכחות, למחוק אותן או לבטל/לאשר משימות במקום.
                        </p>

                        {(() => {
                          const proofs: any[] = [];
                          CHILDREN.forEach(child => {
                            (tasks[child.id] || []).forEach(t => {
                              if (t.photo) {
                                proofs.push({
                                  childId: child.id,
                                  childName: child.name,
                                  childAvatar: child.avatarEmoji,
                                  task: t
                                });
                              }
                            });
                          });

                          if (proofs.length === 0) {
                            return (
                              <div className="p-8 text-center border border-dashed border-[#D6CFC4] bg-slate-50/50 rounded-2xl">
                                <span className="text-3xl block mb-2">📸</span>
                                <p className="text-xs font-bold text-[#8C8479]">עדיין לא צולמו תמונות הוכחה להיום</p>
                                <p className="text-[10px] text-[#A69D92] mt-1">ילדים יכולים לצלם תמונות של המשימות על ידי לחיצה על כפתור המצלמה בדף המשימות שלהם במכשירי הטאבלט בסלון.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="divide-y divide-[#F2EDE4] max-h-[300px] overflow-y-auto pr-1">
                              {proofs.map(({ childId, childName, childAvatar, task }) => (
                                <div key={`${childId}-${task.id}`} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                                  <div className="flex items-center gap-3">
                                    <div className="relative shrink-0">
                                      <img
                                        src={task.photo}
                                        alt="child proof"
                                        onClick={() => setPhotoViewerUrl(task.photo || null)}
                                        className="w-12 h-12 object-cover rounded-xl border border-[#D6CFC4] cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                                      />
                                      <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-md px-0.5 shadow-xs">{childAvatar}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs text-[#5D4037]">{childName}</span>
                                        <span className="text-[10px] text-[#8C8479] font-sans">| {task.photoTime || 'היום'}</span>
                                      </div>
                                      <p className="text-xs font-bold text-[#4A4540] mt-0.5">{task.title}</p>
                                      <span className="text-[9px] bg-green-50 px-1.5 py-0.5 text-green-700 font-bold rounded-md inline-block">
                                        📸 תמונת הוכחה התקבלה
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => setPhotoViewerUrl(task.photo || null)}
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#5D544A] rounded-lg text-[10px] font-bold transition-all font-sans"
                                      title="הגדל הוכחה"
                                    >
                                      הצג תמונה
                                    </button>

                                    <button
                                      onClick={() => {
                                        // Remove photo proof from task
                                        setTasks(prev => ({
                                          ...prev,
                                          [childId]: prev[childId].map(t => 
                                            t.id === task.id ? { ...t, photo: undefined, photoTime: undefined } : t
                                          )
                                        }));
                                      }}
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center font-sans"
                                      title="מחק הוכחה"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  </div>

                    {/* Smileys */}
                    <div style={{ order: panelOrder.indexOf('smileys') }}
                      draggable onDragStart={() => handlePanelDragStart('smileys')} onDragOver={(e) => handlePanelDragOver(e, 'smileys')} onDrop={() => handlePanelDrop('smileys')} onDragEnd={handlePanelDragEnd}
                      className={`transition-all duration-200 ${draggedPanel === 'smileys' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'smileys' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>

                    {/* Daily duty rotation panel */}
                    <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4 mb-4">
                      <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎲</span>
                          <h4 className="font-bold text-[#5D4037] text-lg">{isFriday ? 'גלגול משימות שישי' : 'גלגול משימות בית יומי'}</h4>
                        </div>
                        <button
                          onClick={() => {
                            const newAssignments = reshuffleDailyDutyAssignments();
                            setDailyDutyAssignments(newAssignments);
                            // Swap out only the duty-rotation tasks (SHARED_DUTIES or
                            // FRIDAY_DUTIES ids) for the new assignment - every other
                            // task (hygiene, homework, custom, already-completed ones)
                            // must stay exactly as it was. Rebuilding via
                            // getTasksForToday() here would wipe the whole day's
                            // progress for every child, not just re-roll the chore.
                            const dutyPool = isFriday ? FRIDAY_DUTIES : SHARED_DUTIES;
                            const dutyIds = new Set(dutyPool.map(d => d.id));
                            setTasks(prev => {
                              const next: Record<string, Task[]> = {};
                              CHILDREN.forEach(c => {
                                const keep = (prev[c.id] || []).filter(t => !dutyIds.has(t.id));
                                const newDuty = getSharedDutyTasksFor(c.id, newAssignments, dutyPool);
                                next[c.id] = [...keep, ...newDuty];
                              });
                              return next;
                            });
                          }}
                          className="px-3 py-1.5 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          title="הגרל מחדש משימות היום"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>הגרל מחדש</span>
                        </button>
                      </div>
                      <p className="text-xs text-[#8C8479]">
                        {isFriday
                          ? 'כל שישי נבחר באקראי ילד שיבצע כל משימת הכנה לשבת. הגרלה חדשה מתרחשת אוטומטית כל שבוע.'
                          : 'כל יום נבחר באקראי ילד שיבצע כל משימת בית כללית. הגרלה חדשה מתרחשת אוטומטית בחצות.'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(isFriday ? FRIDAY_DUTIES : SHARED_DUTIES).map(duty => {
                          const assignedId = dailyDutyAssignments[duty.id];
                          const assignedChild = CHILDREN.find(c => c.id === assignedId);
                          if (!assignedChild) return null;
                          return (
                            <div key={duty.id} className="flex items-center gap-3 p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2]">
                              <span className="text-lg">{duty.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#4A4540] truncate">{duty.title}</p>
                                <p className="text-[10px] text-[#8C8479]">{duty.time === 'afternoon' ? 'אחה"צ' : 'ערב'} • {duty.mandatory ? 'חובה' : 'רשות'}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <img src={assignedChild.photo} alt={assignedChild.name} className="w-6 h-6 rounded-full object-cover object-top border" style={{ borderColor: assignedChild.color }} />
                                <span className="text-xs font-bold" style={{ color: assignedChild.color }}>{assignedChild.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center gap-2 border-b border-[#F2EDE4] pb-3">
                      <div className="cursor-grab active:cursor-grabbing text-[#D6CFC4] hover:text-[#8C8479] select-none" title="גרור">⠿</div>
                      <div className="flex items-center gap-2">
                        <Smile className="w-5 h-5 text-amber-500" />
                        <h4 className="font-bold text-[#5D4037] text-lg">ניהול סמיילים ומתנות</h4>
                      </div>
                    </div>
                    <p className="text-xs text-[#8C8479]">כל ילד שמשלים את משימות אחר הצהריים מקבל סמיילי. ב-10 סמיילים מגיעה מתנה!</p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {CHILDREN.map(child => (
                        <div key={child.id} className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 text-center">
                          <img src={child.photo} alt={child.name} className="w-10 h-10 rounded-full object-cover object-top mx-auto border-2 border-amber-300" />
                          <h5 className="font-bold text-sm text-[#5D4037]">{child.name}</h5>
                          <div className="text-2xl font-bold text-amber-700">{smileyCount[child.id] || 0} 😊</div>
                          <p className="text-[10px] text-amber-600">מתנות: {giftsRedeemed[child.id] || 0} 🎁</p>
                          
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => setSmileyCount(prev => ({ ...prev, [child.id]: Math.min(MAX_SMILEYS, (prev[child.id] || 0) + 1) }))}
                              disabled={(smileyCount[child.id] || 0) >= MAX_SMILEYS}
                              className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-[10px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              +1 😊
                            </button>
                            <button
                              onClick={() => setSmileyCount(prev => ({ ...prev, [child.id]: Math.max(0, (prev[child.id] || 0) - 1) }))}
                              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-[10px] font-bold"
                            >
                              -1
                            </button>
                          </div>

                          {(smileyCount[child.id] || 0) >= MAX_SMILEYS && (
                            <button
                              onClick={() => redeemGift(child.id)}
                              className="w-full py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-[10px] font-bold transition-all animate-pulse"
                            >
                              🎁 מימוש מתנה!
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>

                  {/* Prize store redemption cancellations */}
                  <div style={{ order: panelOrder.indexOf('prizeRedemptions') }}
                    draggable onDragStart={() => handlePanelDragStart('prizeRedemptions')} onDragOver={(e) => handlePanelDragOver(e, 'prizeRedemptions')} onDrop={() => handlePanelDrop('prizeRedemptions')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'prizeRedemptions' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'prizeRedemptions' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white rounded-3xl border border-[#D6CFC4] shadow-sm overflow-hidden mb-4">
                    <button onClick={() => togglePanel('prizeRedemptions')} className="w-full p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-all">
                      <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                        <span className="text-xl">🧾</span>
                        <span>ביטול רכישות מהחנות</span>
                      </h4>
                      <span className={`text-[#8C8479] transition-transform ${collapsedPanels['prizeRedemptions'] ? '' : 'rotate-180'}`}>▼</span>
                    </button>
                    {!collapsedPanels['prizeRedemptions'] && (
                    <div className="p-6 pt-0 space-y-4">
                      <p className="text-xs text-[#8C8479]">ביטול רכישה מחזיר לילד את הנקודות שהוציא עליה.</p>
                      {CHILDREN.every(c => (redeemedPrizes[c.id] || []).length === 0) ? (
                        <p className="text-xs text-[#8C8479] text-center py-2">אין עדיין רכישות מהחנות.</p>
                      ) : (
                        CHILDREN.map(child => {
                          const childHistory = redeemedPrizes[child.id] || [];
                          if (childHistory.length === 0) return null;
                          return (
                            <div key={child.id} className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <img src={child.photo} alt={child.name} className="w-5 h-5 rounded-full object-cover object-top" />
                                <span className="text-xs font-bold text-[#5D4037]">{child.name}</span>
                              </div>
                              <div className="space-y-1">
                                {childHistory.slice().reverse().map((r, i) => {
                                  const prize = PRIZE_STORE.find(p => p.id === r.prizeId);
                                  if (!prize) return null;
                                  const originalIndex = childHistory.length - 1 - i;
                                  return (
                                    <div key={r.id || `${child.id}-${originalIndex}`} className="flex items-center justify-between gap-2 p-2 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2]">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg">{prize.emoji}</span>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-[#4A4540] truncate">{prize.name}</p>
                                          <p className="text-[10px] text-[#8C8479]">
                                            {new Date(r.date).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • {prize.cost} נק׳
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => cancelPrizeRedemption(child.id, r.id, originalIndex)}
                                        className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all"
                                        title="בטל רכישה והחזר נקודות"
                                      >
                                        <span>↩️</span>
                                        <span>בטל</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}
                  </div>
                  </div>

                  {/* Premium prize approval requests */}
                  <div style={{ order: panelOrder.indexOf('prizeApprovals') }}
                    draggable onDragStart={() => handlePanelDragStart('prizeApprovals')} onDragOver={(e) => handlePanelDragOver(e, 'prizeApprovals')} onDrop={() => handlePanelDrop('prizeApprovals')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'prizeApprovals' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'prizeApprovals' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white rounded-3xl border border-[#D6CFC4] shadow-sm overflow-hidden mb-4">
                    <button onClick={() => togglePanel('prizeApprovals')} className="w-full p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-all">
                      <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                        <span className="text-xl">💎</span>
                        <span>אישור פרסים</span>
                        {CHILDREN.reduce((sum, c) => sum + (pendingApprovals[c.id] || []).length, 0) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                            {CHILDREN.reduce((sum, c) => sum + (pendingApprovals[c.id] || []).length, 0)}
                          </span>
                        )}
                      </h4>
                      <span className={`text-[#8C8479] transition-transform ${collapsedPanels['prizeApprovals'] ? '' : 'rotate-180'}`}>▼</span>
                    </button>
                    {!collapsedPanels['prizeApprovals'] && (
                    <div className="p-6 pt-0 space-y-4">
                      <p className="text-xs text-[#8C8479]">פרסי-על דורשים אישור לפני שהנקודות יורדות ותקופת ההמתנה מתחילה.</p>
                      {CHILDREN.every(c => (pendingApprovals[c.id] || []).length === 0) ? (
                        <p className="text-xs text-[#8C8479] text-center py-2">אין בקשות ממתינות לאישור.</p>
                      ) : (
                        CHILDREN.map(child => {
                          const requests = pendingApprovals[child.id] || [];
                          if (requests.length === 0) return null;
                          return (
                            <div key={child.id} className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <img src={child.photo} alt={child.name} className="w-5 h-5 rounded-full object-cover object-top" />
                                <span className="text-xs font-bold text-[#5D4037]">{child.name}</span>
                              </div>
                              <div className="space-y-1">
                                {requests.map((req) => {
                                  const prize = PRIZE_STORE.find(p => p.id === req.prizeId);
                                  if (!prize) return null;
                                  const canAfford = (childPoints[child.id] || 0) >= prize.cost;
                                  return (
                                    <div key={req.id} className="flex items-center justify-between gap-2 p-2 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2]">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg">{prize.emoji}</span>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-[#4A4540] truncate">{prize.name}</p>
                                          <p className="text-[10px] text-[#8C8479]">
                                            {new Date(req.requestedAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • {prize.cost} נק׳
                                            {!canAfford && <span className="text-red-600 font-bold"> • אין מספיק נקודות</span>}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => approvePendingRedemption(child.id, req.id)}
                                          disabled={!canAfford}
                                          title={canAfford ? 'אשר' : 'אין מספיק נקודות'}
                                          className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed text-green-700 rounded-lg text-[10px] font-bold transition-all"
                                        >
                                          ✅
                                        </button>
                                        <button
                                          onClick={() => rejectPendingRedemption(child.id, req.id)}
                                          title="דחה"
                                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold transition-all"
                                        >
                                          ❌
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}
                  </div>
                  </div>

                  {/* Prize store statistics */}
                  <div style={{ order: panelOrder.indexOf('prizeStats') }}
                    draggable onDragStart={() => handlePanelDragStart('prizeStats')} onDragOver={(e) => handlePanelDragOver(e, 'prizeStats')} onDrop={() => handlePanelDrop('prizeStats')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'prizeStats' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'prizeStats' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white rounded-3xl border border-[#D6CFC4] shadow-sm overflow-hidden mb-4">
                    <button onClick={() => togglePanel('prizeStats')} className="w-full p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-all">
                      <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <span>סטטיסטיקות פרסים</span>
                      </h4>
                      <span className={`text-[#8C8479] transition-transform ${collapsedPanels['prizeStats'] ? '' : 'rotate-180'}`}>▼</span>
                    </button>
                    {!collapsedPanels['prizeStats'] && (() => {
                      const stats = computeRedemptionStats(redeemedPrizes);
                      const categoryNames: Record<string, string> = {
                        screen: '📱 זמן מסך', privilege: '👑 פריבילגיות', treat: '🍬 פינוקים', family: '👨‍👩‍👧‍👦 פעילות משפחתית', premium: '💎 פרסי על', personal: '⭐ חנות אישית',
                      };
                      return (
                        <div className="p-6 pt-0 space-y-4">
                          {stats.totalRedemptions === 0 ? (
                            <p className="text-xs text-[#8C8479] text-center py-2">עדיין אין נתונים להצגה.</p>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2] text-center">
                                  <p className="text-lg font-bold text-[#5D4037]">{stats.totalRedemptions}</p>
                                  <p className="text-[10px] text-[#8C8479]">סה״כ פרסים שנפדו</p>
                                </div>
                                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2] text-center">
                                  <p className="text-lg font-bold text-[#5D4037]">{stats.totalPointsSpent}</p>
                                  <p className="text-[10px] text-[#8C8479]">נקודות שהוצאו</p>
                                </div>
                                {stats.mostRedeemed && (
                                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2] text-center">
                                    <p className="text-sm font-bold text-[#5D4037]">
                                      {PRIZE_STORE.find(p => p.id === stats.mostRedeemed!.prizeId)?.emoji} {PRIZE_STORE.find(p => p.id === stats.mostRedeemed!.prizeId)?.name}
                                    </p>
                                    <p className="text-[10px] text-[#8C8479]">הפרס הפופולרי ({stats.mostRedeemed.count} פעמים)</p>
                                  </div>
                                )}
                                {stats.favoriteCategory && (
                                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2] text-center">
                                    <p className="text-sm font-bold text-[#5D4037]">{categoryNames[stats.favoriteCategory.category]}</p>
                                    <p className="text-[10px] text-[#8C8479]">הקטגוריה המועדפת ({stats.favoriteCategory.count} פעמים)</p>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {CHILDREN.map(child => {
                                  const childStats = stats.perChild[child.id];
                                  if (!childStats || childStats.count === 0) return null;
                                  const topPrize = childStats.mostRedeemedPrizeId ? PRIZE_STORE.find(p => p.id === childStats.mostRedeemedPrizeId) : null;
                                  return (
                                    <div key={child.id} className="flex items-center justify-between gap-2 p-2 bg-[#FAF8F5] rounded-xl border border-[#E3DCD2]">
                                      <div className="flex items-center gap-2">
                                        <img src={child.photo} alt={child.name} className="w-5 h-5 rounded-full object-cover object-top" />
                                        <span className="text-xs font-bold text-[#5D4037]">{child.name}</span>
                                      </div>
                                      <span className="text-[10px] text-[#8C8479]">
                                        {childStats.count} פרסים • {childStats.pointsSpent} נק׳{topPrize ? ` • הכי אהוב: ${topPrize.emoji} ${topPrize.name}` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  </div>

                  {/* Task Editor */}
                  <div style={{ order: panelOrder.indexOf('editor') }}
                    draggable onDragStart={() => handlePanelDragStart('editor')} onDragOver={(e) => handlePanelDragOver(e, 'editor')} onDrop={() => handlePanelDrop('editor')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'editor' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'editor' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white rounded-3xl border border-[#D6CFC4] shadow-sm overflow-hidden">
                    <button onClick={() => togglePanel('editor')} className="w-full p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-all">
                      <h4 className="font-bold text-[#5D4037] text-lg flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-[#8A9A5B]" />
                        עריכת משימות לפי ילד ויום
                      </h4>
                      <span className={`text-[#8C8479] transition-transform ${collapsedPanels['editor'] ? '' : 'rotate-180'}`}>▼</span>
                    </button>
                    {!collapsedPanels['editor'] && (
                    <div className="p-6 pt-0 space-y-4">

                    {/* Day-of-week selector */}
                    <div className="flex flex-wrap gap-1.5 bg-[#FAF8F5] p-2 rounded-xl border border-[#E3DCD2]">
                      <span className="text-[10px] font-bold text-[#8C8479] flex items-center px-2">📅 יום:</span>
                      {([
                        ['today', '📌 היום'],
                        ['0', 'א׳ ראשון'],
                        ['1', 'ב׳ שני'],
                        ['2', 'ג׳ שלישי'],
                        ['3', 'ד׳ רביעי'],
                        ['4', 'ה׳ חמישי'],
                        ['5', '🕯️ ו׳ שישי'],
                      ] as [EditDay, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setEditDayOfWeek(key)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            editDayOfWeek === key
                              ? key === '5' ? 'bg-amber-500 text-white shadow-sm' : 'bg-[#8A9A5B] text-white shadow-sm'
                              : 'bg-white text-[#5D4037] hover:bg-[#E9E4DB] border border-[#D6CFC4]'
                          }`}
                        >{label}</button>
                      ))}
                    </div>

                    {editDayOfWeek === '5' && (
                      <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
                        🕯️ <strong>עריכת משימות ערב שבת</strong> — משימות אלה ייטענו אוטומטית ביום שישי
                      </div>
                    )}

                    {/* Child selector for editing */}
                    <div className="flex gap-2 flex-wrap">
                      {CHILDREN.map(child => (
                        <button
                          key={child.id}
                          onClick={() => setEditingChildId(editingChildId === child.id ? null : child.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            editingChildId === child.id
                              ? 'bg-[#8A9A5B] text-white shadow-sm'
                              : 'bg-[#F2EDE4] text-[#5D4037] hover:bg-[#E9E4DB]'
                          }`}
                        >
                          <img src={child.photo} alt={child.name} className="w-5 h-5 rounded-full object-cover object-top" />
                          <span>{child.name}</span>
                        </button>
                      ))}
                    </div>

                    {editingChildId && (
                      <div className="space-y-4">
                        {/* Add new task form */}
                        <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#D6CFC4] space-y-3">
                          <h5 className="text-xs font-bold text-[#5D4037]">
                            הוספת משימה ל{CHILDREN.find(c => c.id === editingChildId)?.name}
                            {editDayOfWeek === '5' ? ' (יום שישי)' : editDayOfWeek === 'today' ? ' (היום)' : ` (${['ראשון','שני','שלישי','רביעי','חמישי'][parseInt(editDayOfWeek)]})`}:
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={e => setNewTaskTitle(e.target.value)}
                              placeholder="שם המשימה..."
                              className="md:col-span-2 px-3 py-2 bg-white border border-[#D6CFC4] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#8A9A5B]"
                            />
                            <select
                              value={newTaskTime}
                              onChange={e => setNewTaskTime(e.target.value as TimeOfDay)}
                              className="px-3 py-2 bg-white border border-[#D6CFC4] rounded-xl text-xs"
                            >
                              <option value="morning">🌅 בוקר</option>
                              <option value="afternoon">{editDayOfWeek === '5' ? '🕯️ הכנות לשבת' : '🌞 צהריים'}</option>
                              <option value="evening">{editDayOfWeek === '5' ? '✨ ערב שבת' : '🌙 ערב'}</option>
                            </select>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newTaskEmoji}
                                onChange={e => setNewTaskEmoji(e.target.value)}
                                className="w-12 px-2 py-2 bg-white border border-[#D6CFC4] rounded-xl text-center text-lg"
                                maxLength={2}
                              />
                              <label className="flex items-center gap-1 text-[10px] text-[#5D4037]">
                                <input
                                  type="checkbox"
                                  checked={newTaskMandatory}
                                  onChange={e => setNewTaskMandatory(e.target.checked)}
                                  className="rounded"
                                />
                                <span>חובה</span>
                              </label>
                            </div>
                          </div>
                          <button
                            onClick={() => addTaskToDay(editingChildId, editDayOfWeek)}
                            disabled={!newTaskTitle.trim()}
                            className="px-4 py-2 bg-[#8A9A5B] hover:bg-[#6A7B42] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>הוסף משימה</span>
                          </button>
                        </div>

                        {/* Existing tasks list for selected day */}
                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                          {(['morning', 'afternoon', 'evening'] as TimeOfDay[]).map(time => {
                            const dayTasks = getTasksForDayOfWeek(editingChildId, editDayOfWeek).filter(t => t.time === time);
                            if (dayTasks.length === 0) return null;
                            return (
                            <div key={time} className="space-y-1">
                              <h6 className="text-[10px] font-bold text-[#8C8479] uppercase border-b border-[#F2EDE4] pb-1">
                                {time === 'morning' ? '🌅 בוקר' : time === 'afternoon' ? (editDayOfWeek === '5' ? '🕯️ הכנות לשבת' : '🌞 צהריים') : (editDayOfWeek === '5' ? '✨ ערב שבת' : '🌙 ערב')}
                              </h6>
                              {dayTasks.map(task => {
                                const isCustom = task.id.startsWith('custom_');
                                return (
                                <div key={task.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${isCustom ? 'bg-indigo-50/50 border-indigo-200' : 'bg-[#FAF8F5] border-[#E3DCD2]'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{task.emoji}</span>
                                    <span className="text-xs font-bold text-[#4A4540]">{task.title}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${task.mandatory ? 'bg-[#D35400]/10 text-[#D35400]' : 'bg-[#8A9A5B]/10 text-[#8A9A5B]'}`}>
                                      {task.mandatory ? 'חובה' : 'רשות'}
                                    </span>
                                    {isCustom && <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">מותאם</span>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {editDayOfWeek === 'today' && (
                                      <button
                                        onClick={() => toggleTaskMandatory(editingChildId, task.id)}
                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-bold text-slate-700 transition-all"
                                      >
                                        {task.mandatory ? 'רשות' : 'חובה'}
                                      </button>
                                    )}
                                    {isCustom && (
                                      <button
                                        onClick={() => removeTaskFromDay(editingChildId, task.id, editDayOfWeek)}
                                        className="p-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>
                    )}
                  </div>
                  </div>

                  {/* Mashov */}
                  <div style={{ order: panelOrder.indexOf('mashov') }}
                    draggable onDragStart={() => handlePanelDragStart('mashov')} onDragOver={(e) => handlePanelDragOver(e, 'mashov')} onDrop={() => handlePanelDrop('mashov')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'mashov' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'mashov' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center gap-2 border-b border-[#F2EDE4] pb-3">
                      <div className="cursor-grab active:cursor-grabbing text-[#D6CFC4] hover:text-[#8C8479] select-none" title="גרור">⠿</div>
                      <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-[#5D4037] text-lg">חיבור למערכת משוב (Mashov)</h4>
                      </div>
                      <a
                        href="https://web.mashov.info/students/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
                      >
                        פתח משוב ↗
                      </a>
                    </div>
                    </div>

                    <p className="text-xs text-[#8C8479] leading-relaxed">
                      הזינו את פרטי ההתחברות למשוב כדי לסנכרן שיעורי בית אוטומטית. הפרטים נשמרים רק במכשיר שלכם ולא מועברים לשום מקום אחר.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#5D4037] block mb-1">סמל בית ספר:</label>
                        <input
                          type="text"
                          value={mashovSchoolCode}
                          onChange={e => setMashovSchoolCode(e.target.value)}
                          placeholder="לדוגמה: 460030"
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-[#D6CFC4] rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#5D4037] block mb-1">שם משתמש (ת.ז.):</label>
                        <input
                          type="text"
                          value={mashovUsername}
                          onChange={e => setMashovUsername(e.target.value)}
                          placeholder="תעודת זהות"
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-[#D6CFC4] rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#5D4037] block mb-1">סיסמה:</label>
                        <input
                          type="password"
                          value={mashovPassword}
                          onChange={e => setMashovPassword(e.target.value)}
                          placeholder="סיסמת משוב"
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-[#D6CFC4] rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          saveMashovCredentials();
                          simulateMashovScrape();
                        }}
                        disabled={!mashovUsername || !mashovPassword}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>שמור וסנכרן שיעורי בית</span>
                      </button>
                      <button
                        onClick={simulateMashovScrape}
                        disabled={isMashovScraping}
                        className="px-4 py-2.5 bg-[#5D4037] hover:bg-[#432d27] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        {isMashovScraping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>סנכרן עכשיו</span>
                      </button>
                    </div>

                    <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 text-xs text-indigo-800 space-y-1">
                      <strong className="block">🔒 אבטחה:</strong>
                      <p>הפרטים נשמרים רק בדפדפן שלכם (localStorage) ולא נשלחים לשום שרת חיצוני. החיבור מתבצע ישירות מהאפליקציה למשוב.</p>
                    </div>
                  </div>
                  </div>

                  {/* Technical */}
                  <div style={{ order: panelOrder.indexOf('technical') }}
                    draggable onDragStart={() => handlePanelDragStart('technical')} onDragOver={(e) => handlePanelDragOver(e, 'technical')} onDrop={() => handlePanelDrop('technical')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'technical' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'technical' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Database & AppSheet Setup spec */}
                    <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                      <div className="flex items-center gap-2 border-b border-[#F2EDE4] pb-3">
                        <Database className="w-5 h-5 text-[#8A9A5B]" />
                        <h4 className="font-bold text-[#5D4037] text-lg">1. אפיון מסד נתונים וסנכרון תצוגה (AppSheet)</h4>
                      </div>

                      <p className="text-xs text-[#5D544A] leading-relaxed">
                        במודול זה מוצג פירוט העמודות מגיליון ה-Google Sheets שלנו שישמשו את גוגל AppSheet. להקלת העבודה ושמירת תקינות נתונים, שמות העמודות הפיזיים הם באנגלית, בעוד שתוויות התצוגה RTL הוגדרו ידנית בעברית.
                      </p>

                      <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-[#E3DCD2] space-y-2.5">
                          <h5 className="text-xs font-bold text-[#D35400]">טבלת Task_Logs (יומן ההשלמה היומי):</h5>
                          <div className="grid grid-cols-3 gap-1 text-[11px] font-mono border-b border-[#D6CFC4] pb-1 font-bold text-[#8C8479]">
                            <span>שם עמודה בגיליון</span>
                            <span>טיפוס נתונים</span>
                            <span>תווית בעברית (Label)</span>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <div className="grid grid-cols-3 gap-1"><strong>LogID</strong><span>Text (Key)</span><span className="font-sans text-green-700">מזהה רשומה</span></div>
                            <div className="grid grid-cols-3 gap-1"><strong>Date</strong><span>Date (Today)</span><span className="font-sans text-green-700">תאריך הרשומה</span></div>
                            <div className="grid grid-cols-3 gap-1"><strong>UserID</strong><span>Ref (Users)</span><span className="font-sans text-green-700">הילד המבצע</span></div>
                            <div className="grid grid-cols-3 gap-1"><strong>TaskID</strong><span>Ref (Tasks)</span><span className="font-sans text-green-700">משימת יעד</span></div>
                            <div className="grid grid-cols-3 gap-1"><strong>Status</strong><span>Enum ('פתוח'/'בוצע'/'מאושר')</span><span className="font-sans text-green-700">מצב המשימה</span></div>
                          </div>
                        </div>

                        <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#D6CFC4] text-xs space-y-1">
                          <strong className="text-[#5D4037] block">🤖 אוטומציה מומלצת AppSheet Bot (משימות אוטומטיות לכל בוקר):</strong>
                          <p className="text-[11px] leading-relaxed">
                            צרו Event מסוג Scheduled, הגדירו את השעה ל-00:01 מדי יום. צרו בקשה (Run Data Action) שרצה על טבלת <code>Users</code> ומריצה עבור כל משתמש הוספת סט משימות ברירת מגדיר המאסטר לתוך טבלת <code>Task_Logs</code>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* API mashov WORKAROUND & Home assistant router setup code */}
                    <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                      <div className="flex items-center gap-2 border-b border-[#F2EDE4] pb-3">
                        <Code className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-[#5D4037] text-lg">2. מעקף קוד ממשק (Mashov APIScraper)</h4>
                      </div>

                      <p className="text-xs text-[#5D544A] leading-relaxed">
                        גוגל Apps Script יכול להתחבר עצמאית למערכת משוב מדי יום בצהריים כדי לבדוק אם למורה של הילד יש שיעורי בית. הנה קוד Boilerplate שניתן לשלב בתוך Google Spreadsheet להשלמת האוטומציה.
                      </p>

                      <div className="bg-[#1e1e2e] text-[#a6adc8] p-4 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed" dir="ltr">
<pre>{`// Google Apps Script - Scheduled Trigger (14:00)
function syncMashovToAppSheet() {
  const MASHOV_API = "https://web.mashov.info/api/login";
  const payload = {
    semel: "123456", // סמל בית הספר מורשה
    year: 2026,
    username: "CHILD_USERNAME",
    password: "CHILD_PASSWORD"
  };
  
  // API Authentication Web-Call
  const res = UrlFetchApp.fetch(MASHOV_API, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const headers = res.getHeaders();
  const sessionToken = headers['Set-Cookie']; // Session Extraction
  
  // Fetch dynamic homework endpoint
  const homeworkRes = UrlFetchApp.fetch("https://web.mashov.info/api/students/homework", {
    headers: { "Cookie": sessionToken }
  });
  
  const tasks = JSON.parse(homeworkRes.getContentText());
  const hasHomework = tasks.length > 0;
  
  if (hasHomework) {
    // Append homework task flag to google sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Task_Logs");
    sheet.appendRow([Utilities.getUuid(), new Date(), "noa", "homework_task", "פתוח"]);
  }
}`}</pre>
                      </div>

                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 text-xs">
                        <strong className="text-blue-900 block flex items-center gap-1">
                          <span>📡</span>
                          <span>אינטגרציית הנתבים ו-Guest Password:</span>
                        </strong>
                        <p className="text-[11px] text-blue-800 leading-relaxed mt-1">
                          ה-AppSheet Bot שולח Webhook ל-Home Assistant בעת השלמה יוונית של 100% ממשימות החובה, ה-Home Assistant מג׳נרט סיסמה חמודה מקטלוג (כמו <code>PANDA42</code>), מעדכן את ה-SSID הראוטי, ושולח REST API קריאה חזרה ל-AppSheet לעדכון השדה והצגתו לילד המנצח!
                        </p>
                      </div>
                    </div>

                  </div>
                  </div>
                  </div>)}

                  {/* Find the Tablet */}
                  <div style={{ order: panelOrder.indexOf('findDevice') }}
                    draggable onDragStart={() => handlePanelDragStart('findDevice')} onDragOver={(e) => handlePanelDragOver(e, 'findDevice')} onDrop={() => handlePanelDrop('findDevice')} onDragEnd={handlePanelDragEnd}
                    className={`transition-all duration-200 ${draggedPanel === 'findDevice' ? 'opacity-40 scale-[0.98]' : ''} ${dragOverPanel === 'findDevice' ? 'ring-2 ring-[#8A9A5B] ring-offset-2 rounded-3xl' : ''}`}>
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="cursor-grab active:cursor-grabbing text-[#D6CFC4] hover:text-[#8C8479] select-none" title="גרור">⠿</div>
                      <div className="flex-1 flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📍</span>
                          <h4 className="font-bold text-[#5D4037] text-lg">איתור הטאבלט</h4>
                        </div>
                        <span className={`text-[11px] rounded-full px-2.5 py-1 font-bold flex items-center gap-1 ${
                          isFindDeviceRinging ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {isFindDeviceRinging ? '🔴 הצליל מתנגן' : '🟢 הצליל כבוי'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#8C8479] leading-relaxed">
                      אם הטאבלט הלך לאיבוד בבית, אפשר להפעיל צליל חזק מכל מכשיר מחובר (מהמחשב, מהטלפון וכו') וכל המכשירים המסונכרנים - כולל הטאבלט - ישמיעו אותו מיד.
                    </p>

                    {!syncEnabled && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                        יש להפעיל קודם "סנכרון בין מכשירים" (בפאנל הסנכרון למעלה) כדי שהמכשירים יוכלו לצלצל אחד לשני.
                      </div>
                    )}

                    {findDeviceSendError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700">
                        {findDeviceSendError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={ringTablet}
                        disabled={!syncEnabled || isFindDeviceRinging}
                        className="flex-1 px-4 py-2.5 bg-[#8A9A5B] hover:bg-[#6A7B42] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>🔊</span>
                        <span>השמע צליל</span>
                      </button>
                      <button
                        onClick={stopRinging}
                        disabled={!syncEnabled || !isFindDeviceRinging}
                        className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>⏹️</span>
                        <span>עצור צליל</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-[#8C8479] font-bold">
                        <span>עוצמת קול</span>
                        <span>{Math.round(findDeviceVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(findDeviceVolume * 100)}
                        onChange={(e) => setFindDeviceVolume(Number(e.target.value) / 100)}
                        className="w-full accent-[#8A9A5B]"
                      />
                    </div>
                  </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* BOTTOM GLOBAL FOOTER */}
        <footer className="bg-[#E9E4DB] border-t border-[#D6CFC4] p-4 text-center text-xs text-[#8C8479] space-y-1">
          <p className="font-bold text-[#5D544A]">&copy; 2026 אפליקציית ניהול משימות לטאבלטים</p>
          <p className="text-[10px]">מערכת יציבה מבוססת Google Sheets + AppSheet + Google Apps Script + Docker Container Host</p>
        </footer>

      </main>

      {/* 1. CAMERA CAPTURE LIVE DIALOG MODAL */}
      <AnimatePresence>
        {captureTaskTarget && (
          <div className="fixed inset-0 bg-[#3E2723]/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-2 sm:p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-[#D6CFC4] shadow-2xl p-4 max-w-md w-full text-center space-y-3 relative my-2"
            >
              <button
                onClick={() => {
                  stopCameraStream();
                  setCaptureTaskTarget(null);
                }}
                className="absolute top-2 left-2 p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 z-10 border border-red-300"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-[#5D4037]">📸 צילום הוכחה</h3>
                <p className="text-xs text-[#8C8479]">
                  משימה: <strong>{
                    (() => {
                      const list = tasks[captureTaskTarget.childId] || [];
                      const target = list.find(t => t.id === captureTaskTarget.taskId);
                      return target ? `${target.emoji} ${target.title}` : '';
                    })()
                  }</strong>
                </p>
              </div>

              {/* Dynamic camera screen */}
              <div className="bg-slate-900 aspect-[4/3] max-h-[40vh] rounded-xl relative overflow-hidden border border-slate-700 flex flex-col items-center justify-center text-white">
                {cameraStreamActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : cameraPhotoFile ? (
                  <img
                    src={cameraPhotoFile}
                    alt="captured preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <Camera className="w-12 h-12 mx-auto text-slate-500 animate-pulse" />
                    <div className="text-xs space-y-1 text-slate-400">
                      <p>המצלמה אינה מופעלת כעת</p>
                      <p className="text-[10px]">לחצו "הפעל מצלמה" או בחרו מהקטלוג למטה במקרה של סימולטור</p>
                    </div>
                  </div>
                )}

                {/* Corner watermarks */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-[9px] px-2 py-0.5 rounded text-white/80 font-mono">
                  {cameraStreamActive ? (cameraFacing === 'user' ? 'מצלמה קדמית' : 'מצלמה אחורית') : 'LIVE CAMERA COMPONENT'}
                </div>
              </div>

              {/* Action row */}
              <div className="space-y-3">
                <div className="flex gap-2 justify-center">
                  {!cameraStreamActive ? (
                    <button
                      onClick={() => startCameraStream()}
                      className="px-4 py-2 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-sans"
                    >
                      <Camera className="w-4 h-4" />
                      <span>הפעל מצלמת מכשיר</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={capturePhotoFromStream}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-sans"
                      >
                        <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                        <span>צלם תמונה מהווידאו</span>
                      </button>
                      <button
                        onClick={switchCamera}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-sans"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>החלף מצלמה</span>
                      </button>
                    </>
                  )}


                </div>

                <div className="flex gap-2 justify-between pt-2 border-t">
                  <button
                    onClick={() => {
                      stopCameraStream();
                      setCaptureTaskTarget(null);
                    }}
                    className="px-4 py-2.5 border border-red-200 bg-red-50 rounded-xl text-xs font-bold text-red-700 hover:bg-red-100 transition-all font-sans flex-1"
                  >
                    ✕ ביטול
                  </button>
                  <button
                    onClick={saveCapturedTaskPhotoProof}
                    disabled={!cameraPhotoFile}
                    className="px-4 py-2.5 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 font-sans flex-1"
                  >
                    ✓ שמור הוכחה
                  </button>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. IMAGE FULL-SCREEN LIGHTBOX */}
      <AnimatePresence>
        {photoViewerUrl && (
          <div
            onClick={() => setPhotoViewerUrl(null)}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-3xl max-h-[85vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPhotoViewerUrl(null)}
                className="absolute -top-12 right-0 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={photoViewerUrl}
                alt="Enlarged child task proof"
                className="max-w-full max-h-[80vh] rounded-2xl border border-white/20 shadow-2xl object-contain"
              />
              <div className="text-center text-white/80 text-xs mt-3">
                לחצו בכל מקום מחוץ לתמונה על מנת לסגור
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. CELEBRATION MODAL - Shows when afternoon tasks are completed */}
      <AnimatePresence>
        {celebrationChild && (
          <div className="fixed inset-0 bg-[#3E2723]/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-3xl border-2 border-yellow-400 shadow-2xl p-8 max-w-md w-full text-center space-y-5 relative overflow-hidden"
            >
              {/* Confetti-like background */}
              <div className="absolute inset-0 opacity-10">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-2xl"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 400, opacity: [0, 1, 0] }}
                    transition={{ delay: i * 0.1, duration: 2, repeat: Infinity }}
                    style={{ left: `${Math.random() * 100}%` }}
                  >
                    {['⭐', '🎉', '🎊', '✨', '💫'][i % 5]}
                  </motion.span>
                ))}
              </div>

              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-7xl relative z-10"
              >
                😄
              </motion.div>

              <div className="relative z-10 space-y-2">
                <h2 className="text-3xl font-bold text-amber-800">
                  כל הכבוד {CHILDREN.find(c => c.id === celebrationChild)?.name}! 🎉
                </h2>
                <p className="text-lg text-amber-700">
                  סיימת את כל המשימות של אחר הצהריים!
                </p>
                <p className="text-base text-amber-600">
                  🌙 עכשיו הזמן ללכת לישון ולבחור סיפור לפני השינה
                </p>
              </div>

              <div className="relative z-10 flex items-center justify-center gap-3 bg-white/60 px-4 py-3 rounded-2xl border border-yellow-300">
                <motion.span 
                  animate={{ rotate: [0, 20, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-3xl"
                >
                  😊
                </motion.span>
                <div className="text-right">
                  <span className="text-sm font-bold text-amber-800 block">
                    {(smileyCount[celebrationChild] || 0) >= MAX_SMILEYS ? 'צברת 10 סמיילים! 🎉' : 'קיבלת סמיילי! +1'}
                  </span>
                  <span className="text-xs text-amber-600">
                    סה״כ: {smileyCount[celebrationChild] || 0} סמיילים
                    {(smileyCount[celebrationChild] || 0) >= MAX_SMILEYS && ' — 🎁 מגיעה לך מתנה!'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setCelebrationChild(null)}
                className="relative z-10 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg"
              >
                תודה! 🌟
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3b. PLAY-FIRST TIMER POPUP - shown when a time period's mandatory
          tasks are just finished; the countdown itself lives on the child's
          card in the main grid below so it stays visible after this closes. */}
      <AnimatePresence>
        {playTimerPopupChild && (
          <div className="fixed inset-0 bg-indigo-950/60 backdrop-blur-sm z-[62] flex items-center justify-center p-4" dir="rtl" onClick={() => setPlayTimerPopupChild(null)}>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl border-2 border-indigo-400 shadow-2xl p-8 max-w-md w-full text-center space-y-4"
            >
              <span className="text-6xl block">🎮⏳</span>
              <h2 className="text-2xl font-bold text-indigo-800">
                עכשיו זמן משחק חופשי, {CHILDREN.find(c => c.id === playTimerPopupChild)?.name}!
              </h2>
              <p className="text-base text-indigo-700">
                כל הכבוד על סיום המשימות! זמן המסך ייפתח בעוד {PLAY_TIMER_MINUTES} דקות.
              </p>
              <button
                onClick={() => setPlayTimerPopupChild(null)}
                className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg"
              >
                הבנתי! 👍
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PRIZE STORE MODAL */}
      <AnimatePresence>
        {showPrizeStore && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-300 shadow-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto space-y-4 relative"
            >
              <button
                onClick={() => setShowPrizeStore(false)}
                className="absolute top-3 left-3 p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 z-10 border border-red-300"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold text-purple-800">🏪 חנות הפרסים</h2>
                <p className="text-sm text-purple-600">
                  {activeChild.name} — יתרה:{' '}
                  <motion.span
                    key={pointsTickDisplay ?? childPoints[activeChildId] ?? 0}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="font-bold text-lg inline-block"
                  >
                    {pointsTickDisplay ?? (childPoints[activeChildId] || 0)}
                  </motion.span>{' '}
                  נקודות ⭐
                </p>
                {(streaks[activeChildId]?.count || 0) > 0 && (
                  <p className="text-xs text-orange-600 font-bold">
                    🔥 רצף של {streaks[activeChildId]?.count} ימים! (+{STREAK_BONUS_PER_DAY} נק׳ בונוס לכל משימה)
                  </p>
                )}
              </div>

              {/* Prize categories */}
              <p className="text-center text-[11px] font-bold text-purple-500">🏪 חנות כללית לכולם, ובסוף החנות האישית שלך ⭐</p>
              {(['screen', 'privilege', 'treat', 'family', 'premium', 'personal'] as const).map(category => {
                const categoryNames: Record<string, { name: string; emoji: string }> = {
                  screen: { name: 'זמן מסך', emoji: '📱' },
                  privilege: { name: 'פריבילגיות', emoji: '👑' },
                  treat: { name: 'פינוקים', emoji: '🍬' },
                  family: { name: 'פעילות משפחתית', emoji: '👨‍👩‍👧‍👦' },
                  premium: { name: 'פרסי על', emoji: '💎' },
                  personal: { name: `החנות של ${activeChild.name}`, emoji: '⭐' },
                };
                const prizes = getAvailablePrizes(activeChildId, redeemedPrizes).filter(p => p.category === category);
                if (prizes.length === 0) return null;
                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-bold text-purple-700 flex items-center gap-1 border-b border-purple-200 pb-1">
                      <span>{categoryNames[category].emoji}</span>
                      <span>{categoryNames[category].name}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <AnimatePresence mode="popLayout">
                        {prizes.map(prize => {
                          const canAfford = (childPoints[activeChildId] || 0) >= prize.cost;
                          const isPending = (pendingApprovals[activeChildId] || []).some(p => p.prizeId === prize.id);
                          if (isPending) {
                            return (
                              <motion.div
                                key={prize.id}
                                layout
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="p-3 rounded-xl border text-center space-y-1 bg-amber-50 border-amber-300"
                              >
                                <span className="text-2xl block">{prize.emoji}</span>
                                <span className="text-[11px] font-bold text-amber-800 block">{prize.name}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 inline-flex items-center gap-1">
                                  <span>⏳</span>
                                  <span>ממתין לאישור הורה</span>
                                </span>
                              </motion.div>
                            );
                          }
                          if (prize.isScreenTime && isPlayTimerActive(activeChildId, playTimers, tickNow)) {
                            return (
                              <motion.div
                                key={prize.id}
                                layout
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="p-3 rounded-xl border text-center space-y-1 bg-indigo-50 border-indigo-200 opacity-80"
                              >
                                <span className="text-2xl block grayscale">{prize.emoji}</span>
                                <span className="text-[11px] font-bold text-indigo-700 block">{prize.name}</span>
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 inline-flex items-center gap-1">
                                  <span>🔒</span>
                                  <span>קודם זמן משחק · {formatPlayTimerRemaining(playTimers[activeChildId].endsAt - tickNow)}</span>
                                </span>
                              </motion.div>
                            );
                          }
                          return (
                            <motion.button
                              key={prize.id}
                              layout
                              exit={{ opacity: 0, scale: 0.8 }}
                              onClick={() => handleRedeemClick(prize)}
                              disabled={!canAfford}
                              className={`p-3 rounded-xl border text-center transition-all space-y-1 ${
                                !canAfford ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                                : prize.category === 'premium' ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                                : 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-md cursor-pointer'
                              }`}
                            >
                              <span className="text-2xl block">{prize.emoji}</span>
                              <span className="text-[11px] font-bold text-purple-800 block">{prize.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                canAfford ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {prize.cost} נק׳
                              </span>
                            </motion.button>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}

              {/* Coming back soon (on cooldown) */}
              {getPrizesOnCooldown(activeChildId, redeemedPrizes).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-purple-700 flex items-center gap-1 border-b border-purple-200 pb-1">
                    <span>🕒</span>
                    <span>יחזור בקרוב</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {getPrizesOnCooldown(activeChildId, redeemedPrizes).map(prize => (
                      <div key={prize.id} className="p-3 rounded-xl border text-center space-y-1 bg-gray-100 border-gray-200 opacity-70">
                        <span className="text-2xl block grayscale">{prize.emoji}</span>
                        <span className="text-[11px] font-bold text-gray-600 block">{prize.name}</span>
                        <span className="text-[9px] font-bold text-gray-500 block">{formatCooldownRemaining(prize.remainingMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent redemptions */}
              {(redeemedPrizes[activeChildId] || []).length > 0 && (
                <div className="border-t border-purple-200 pt-3 space-y-1">
                  <h4 className="text-xs font-bold text-purple-600">🎁 פרסים אחרונים שנפדו:</h4>
                  <div className="flex flex-wrap gap-1">
                    {(redeemedPrizes[activeChildId] || []).slice(-5).reverse().map((r, i) => {
                      const prize = PRIZE_STORE.find(p => p.id === r.prizeId);
                      return prize ? (
                        <span key={i} className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {prize.emoji} {prize.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* How to earn more */}
              <div className="bg-white/60 p-3 rounded-xl border border-purple-100 space-y-1">
                <h4 className="text-[11px] font-bold text-purple-700">💡 איך צוברים נקודות?</h4>
                <ul className="text-[10px] text-purple-600 space-y-0.5">
                  <li>• משימת חובה = {SCREEN_TIME_REWARD[activeChildId]?.pointsPerMandatory || 3} נק׳</li>
                  <li>• משימת בחירה = {SCREEN_TIME_REWARD[activeChildId]?.pointsPerOptional || 2} נק׳</li>
                  <li>• בונוס רצף = +{STREAK_BONUS_PER_DAY} נק׳ לכל משימה</li>
                  <li>• שבוע רצוף = +{STREAK_WEEKLY_BONUS} נק׳ בונוס!</li>
                  <li>• הצטיינות שבועית (90%+) = +{WEEKLY_EXCELLENCE_BONUS} נק׳</li>
                </ul>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {breakfastTarget && (
        <BreakfastPicker
          childId={breakfastTarget}
          familyCode={familyCode}
          onClose={() => setBreakfastTarget(null)}
          onDone={() => { const id = breakfastTarget; setBreakfastTarget(null); toggleTask(id, 'breakfast_choice', true); }}
        />
      )}

      {/* Prize redemption success popup */}
      <AnimatePresence>
        {redemptionSuccessInfo && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 pointer-events-none" dir="rtl">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border-2 border-emerald-400 shadow-2xl p-6 max-w-xs w-full text-center space-y-2 relative overflow-hidden"
            >
              <EmojiConfettiBurst />
              <span className="text-5xl block relative z-10">{redemptionSuccessInfo.prize.emoji}</span>
              <p className="text-lg font-bold text-emerald-800 relative z-10">
                {redemptionSuccessInfo.awaitingApproval ? 'הבקשה נשלחה לאישור ⏳' : 'הפרס מומש בהצלחה! 🎉'}
              </p>
              <p className="text-xs text-emerald-700 relative z-10">{redemptionSuccessInfo.prize.name}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

