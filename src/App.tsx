import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Timer,
  Lock,
  Unlock,
  Clock,
  Plus,
  Minus,
  Monitor,
  Gift,
  Star,
  Edit3,
  Save,
  Smile
} from 'lucide-react';

// ================= TYPES =================
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';
export type ViewMode = 'child' | 'parent';

// Lock server connection
const LOCK_SERVER_URL = 'http://localhost:3001';

interface ScreenTimer {
  childId: string;
  childName: string;
  minutes: number;
  startedAt: number;
  endsAt: number;
  remainingMs: number;
  remainingFormatted: string;
  locked: boolean;
}

export interface Task {
  id: string;
  time: TimeOfDay;
  title: string;
  emoji: string;
  completed: boolean;
  mandatory: boolean;
  notes?: string;
  photo?: string;       // Base64 Data URL or file string of captured proof
  photoTime?: string;   // Local time string when captured
  requiresPhoto?: boolean; // Requires camera photo proof to complete
}

export interface Child {
  id: string;
  name: string;
  age: number;
  initial: string;
  color: string;
  avatarEmoji: string;
  photo: string;
}

// ================= DATA CONSTANTS =================
const CHILDREN: Child[] = [
  { id: 'arava', name: 'ערבה', age: 13, initial: 'ע', color: '#5D4037', avatarEmoji: '👧', photo: '/photos/arava.jpg' },
  { id: 'hoshen', name: 'חושן', age: 10, initial: 'ח', color: '#D35400', avatarEmoji: '👧', photo: '/photos/hoshen.jpg' },
  { id: 'peer', name: 'פאר', age: 7, initial: 'פ', color: '#6A7B42', avatarEmoji: '👦', photo: '/photos/peer.jpg' },
  { id: 'rafael', name: 'רפאל', age: 5, initial: 'ר', color: '#8A9A5B', avatarEmoji: '👦', photo: '/photos/rafael.jpg' },
];

// Screen time reward (in minutes) per child for completing all mandatory tasks
// Bonus minutes for each optional task completed
const SCREEN_TIME_REWARD: Record<string, { base: number; bonusPerOptional: number }> = {
  arava: { base: 60, bonusPerOptional: 5 },
  hoshen: { base: 45, bonusPerOptional: 5 },
  peer: { base: 30, bonusPerOptional: 5 },
  rafael: { base: 20, bonusPerOptional: 3 },
};

// School schedule info
const SCHOOL_SCHEDULE: Record<string, { regular: string; tuesday: string }> = {
  arava: { regular: '15:45', tuesday: '13:45' },
  hoshen: { regular: '14:30', tuesday: '12:30' },
  peer: { regular: '14:30', tuesday: '12:30' },
  rafael: { regular: '16:00', tuesday: '16:00' },
};

function getSchoolEndTime(childId: string): string {
  const day = new Date().getDay(); // 0=Sun
  const schedule = SCHOOL_SCHEDULE[childId];
  if (!schedule) return '';
  return day === 2 ? schedule.tuesday : schedule.regular; // Tuesday = 2
}

// Helper to construct personalized task list for each child based on age
function getInitialTasksForChild(childId: string): Task[] {
  switch (childId) {
    case 'arava': // ערבה, 13, responsible teenager
      return [
        // Morning
        { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰', emoji: '⏱️', completed: false, mandatory: true },
        { id: 'm2', time: 'morning', title: 'הכנת תיק לבית ספר', emoji: '🎒', completed: false, mandatory: true },
        { id: 'm3', time: 'morning', title: 'התלבשות והתארגנות', emoji: '👕', completed: false, mandatory: true },
        { id: 'm4', time: 'morning', title: 'צחצוח שיניים', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'm5', time: 'morning', title: 'נטילת ידיים וברכות', emoji: '💧', completed: false, mandatory: true },
        { id: 'm6', time: 'morning', title: 'הוצאת הכלב לטיול בוקר', emoji: '🐕', completed: false, mandatory: true },
        { id: 'm7', time: 'morning', title: 'סידור המיטה והחדר', emoji: '🛏️', completed: false, mandatory: true, requiresPhoto: true },
        // Afternoon
        { id: 'a1', time: 'afternoon', title: 'הכנת שיעורי בית (משוב) 📚', emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'a2', time: 'afternoon', title: 'הוצאת קופסאות אוכל לכיור', emoji: '🍱', completed: false, mandatory: true },
        { id: 'a3', time: 'afternoon', title: 'הכנסת כלים למדיח', emoji: '🍽️', completed: false, mandatory: true },
        { id: 'a4', time: 'afternoon', title: 'תליית כביסה רטובה', emoji: '👕', completed: false, mandatory: true },
        { id: 'a5', time: 'afternoon', title: 'קיפול כביסה יבשה', emoji: '🧺', completed: false, mandatory: true },
        { id: 'a6', time: 'afternoon', title: 'החזרת בגדים מסודרים לארון', emoji: '🚪', completed: false, mandatory: false, requiresPhoto: true },
        { id: 'a7', time: 'afternoon', title: 'הכנסת מכונת כביסה (במידה ויש)', emoji: '🧺', completed: false, mandatory: false },
        { id: 'a8', time: 'afternoon', title: 'עזרה באחים הקטנים', emoji: '👶', completed: false, mandatory: false },
        // Evening
        { id: 'e1', time: 'evening', title: 'פינוי כלים מארוחת ערב', emoji: '🍛', completed: false, mandatory: true },
        { id: 'e2', time: 'evening', title: 'הכנסת כלים למדיח וניקוי שולחן', emoji: '🍽️', completed: false, mandatory: true },
        { id: 'e3', time: 'evening', title: 'מקלחת', emoji: '🚿', completed: false, mandatory: true },
        { id: 'e4', time: 'evening', title: 'צחצוח שיניים של לילה', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'e5', time: 'evening', title: 'התלבשות פיג׳מה', emoji: '💤', completed: false, mandatory: true },
        { id: 'e6', time: 'evening', title: 'הוצאת הכלב לטיול לילה', emoji: '🐕', completed: false, mandatory: true },
        { id: 'e7', time: 'evening', title: 'האכלת הכלב ארוחת לילה', emoji: '🦴', completed: false, mandatory: false },
      ];

    case 'hoshen': // חושן, 10
      return [
        // Morning
        { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰', emoji: '⏱️', completed: false, mandatory: true },
        { id: 'm2', time: 'morning', title: 'התלבשות עצמאית', emoji: '👕', completed: false, mandatory: true },
        { id: 'm3', time: 'morning', title: 'צחצוח שיניים', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'm4', time: 'morning', title: 'נטילת ידיים וברכות', emoji: '💧', completed: false, mandatory: true },
        { id: 'm5', time: 'morning', title: 'סידור המיטה', emoji: '🛏️', completed: false, mandatory: true },
        { id: 'm6', time: 'morning', title: 'הכנת תיק לבית ספר', emoji: '🎒', completed: false, mandatory: true },
        // Afternoon
        { id: 'a1', time: 'afternoon', title: 'הוצאת הכלב לטיול צהריים', emoji: '🐕', completed: false, mandatory: true },
        { id: 'a2', time: 'afternoon', title: 'הכנת שיעורי בית (משוב) 📚', emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'a3', time: 'afternoon', title: 'הוצאת קופסאות אוכל לכיור', emoji: '🍱', completed: false, mandatory: true },
        { id: 'a4', time: 'afternoon', title: 'הכנסת כלים למדיח', emoji: '🍽️', completed: false, mandatory: true },
        { id: 'a5', time: 'afternoon', title: 'האכלת הכלב', emoji: '🦴', completed: false, mandatory: false },
        { id: 'a6', time: 'afternoon', title: 'משחק עם הכלב בחצר ⚽', emoji: '🥎', completed: false, mandatory: false },
        // Evening
        { id: 'e1', time: 'evening', title: 'פינוי כלים מארוחת ערב', emoji: '🍛', completed: false, mandatory: true },
        { id: 'e2', time: 'evening', title: 'ריקון המדיח (לפי בקשה)', emoji: '🥛', completed: false, mandatory: true },
        { id: 'e3', time: 'evening', title: 'מקלחת', emoji: '🚿', completed: false, mandatory: true },
        { id: 'e4', time: 'evening', title: 'צחצוח שיניים של לילה', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'e5', time: 'evening', title: 'התלבשות פיג׳מה', emoji: '💤', completed: false, mandatory: true },
        { id: 'e6', time: 'evening', title: 'הוצאת הכלב לטיול לילה', emoji: '🐕', completed: false, mandatory: true },
      ];

    case 'peer': // פאר, 7
      return [
        // Morning
        { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰', emoji: '⏱️', completed: false, mandatory: true },
        { id: 'm2', time: 'morning', title: 'התלבשות עצמאית', emoji: '👕', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'm3', time: 'morning', title: 'צחצוח שיניים', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'm4', time: 'morning', title: 'נטילת ידיים וברכות', emoji: '💧', completed: false, mandatory: true },
        { id: 'm5', time: 'morning', title: 'סידור המיטה', emoji: '🛏️', completed: false, mandatory: true },
        // Afternoon
        { id: 'a1', time: 'afternoon', title: 'הכנת שיעורי בית 📚', emoji: '📝', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'a2', time: 'afternoon', title: 'הוצאת קופסאות אוכל לכיור', emoji: '🍱', completed: false, mandatory: true },
        { id: 'a3', time: 'afternoon', title: 'פינוי והוצאת כלים נקיים מהמדיח', emoji: '🥛', completed: false, mandatory: true },
        { id: 'a4', time: 'afternoon', title: 'האכלת הכלב וקערית מים', emoji: '🦴', completed: false, mandatory: false },
        { id: 'a5', time: 'afternoon', title: 'משחק עם הכלב בחצר ⚽', emoji: '🥎', completed: false, mandatory: false },
        // Evening
        { id: 'e1', time: 'evening', title: 'פינוי הכלים מארוחת ערב', emoji: '🍛', completed: false, mandatory: true },
        { id: 'e2', time: 'evening', title: 'מקלחת', emoji: '🚿', completed: false, mandatory: true },
        { id: 'e3', time: 'evening', title: 'צחצוח שיניים של לילה', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'e4', time: 'evening', title: 'התלבשות פיג׳מה', emoji: '💤', completed: false, mandatory: true },
        { id: 'e5', time: 'evening', title: 'סידור הצעצועים לפני שינה', emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
      ];

    case 'rafael': // רפאל, 5, גן
      return [
        // Morning
        { id: 'm1', time: 'morning', title: 'השכמה בזמן ⏰', emoji: '⏱️', completed: false, mandatory: true },
        { id: 'm2', time: 'morning', title: 'לבישת כיפה', emoji: '🧢', completed: false, mandatory: true },
        { id: 'm3', time: 'morning', title: 'נטילת ידיים וברכות בוקר', emoji: '💧', completed: false, mandatory: true },
        { id: 'm4', time: 'morning', title: 'התלבשות (עם עזרה)', emoji: '👕', completed: false, mandatory: true },
        { id: 'm5', time: 'morning', title: 'נעילת נעליים לבד', emoji: '👟', completed: false, mandatory: true },
        { id: 'm6', time: 'morning', title: 'צחצוח שיניים', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'm7', time: 'morning', title: 'אכילת ארוחת בוקר', emoji: '🥣', completed: false, mandatory: true },
        // Afternoon
        { id: 'a1', time: 'afternoon', title: 'חליצת נעליים ושמירה במקום', emoji: '👟', completed: false, mandatory: true },
        { id: 'a2', time: 'afternoon', title: 'הוצאת קופסת אוכל לכיור', emoji: '🍱', completed: false, mandatory: true },
        { id: 'a3', time: 'afternoon', title: 'דפי ציור או יצירה 🎨', emoji: '🖍️', completed: false, mandatory: true },
        { id: 'a4', time: 'afternoon', title: 'האכלת הכלב וקערית מים', emoji: '🦴', completed: false, mandatory: true },
        { id: 'a5', time: 'afternoon', title: 'סידור הצעצועים', emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'a6', time: 'afternoon', title: 'משחק עם הכלב', emoji: '🐕', completed: false, mandatory: false },
        { id: 'a7', time: 'afternoon', title: 'עזרה לשים כלים בכיור', emoji: '🍽️', completed: false, mandatory: false },
        // Evening
        { id: 'e1', time: 'evening', title: 'פינוי הצלחת מארוחת ערב', emoji: '🍛', completed: false, mandatory: true },
        { id: 'e2', time: 'evening', title: 'מקלחת (עם עזרה)', emoji: '🚿', completed: false, mandatory: true },
        { id: 'e3', time: 'evening', title: 'צחצוח שיניים', emoji: '🪥', completed: false, mandatory: true, requiresPhoto: true },
        { id: 'e4', time: 'evening', title: 'לבישת פיג׳מה', emoji: '💤', completed: false, mandatory: true },
        { id: 'e5', time: 'evening', title: 'סידור הצעצועים לפני שינה', emoji: '🧸', completed: false, mandatory: false },
        { id: 'e6', time: 'evening', title: 'אמירת שמע ישראל', emoji: '🌙', completed: false, mandatory: true },
      ];

    default:
      return [];
  }
}

// Friday (Erev Shabbat) special tasks - replace afternoon tasks
function getFridayTasksForChild(childId: string): Task[] {
  const isOlder = childId === 'arava' || childId === 'hoshen';
  const isYoungest = childId === 'rafael';

  // Keep morning tasks as usual, but replace afternoon with Friday chores
  const morningTasks = getInitialTasksForChild(childId).filter(t => t.time === 'morning');
  
  const fridayTasks: Task[] = [
    // Friday afternoon - Shabbat prep
    { id: 'f1', time: 'afternoon', title: 'סידור החדר וניקיון', emoji: '🧹', completed: false, mandatory: true, requiresPhoto: true },
    { id: 'f2', time: 'afternoon', title: 'קיפול והכנסת כביסה לארון', emoji: '🧺', completed: false, mandatory: true },
    { id: 'f3', time: 'afternoon', title: 'ניקיון הבית לשבת', emoji: '🏠', completed: false, mandatory: true },
    { id: 'f4', time: 'afternoon', title: 'עריכת שולחן שבת', emoji: '🕯️', completed: false, mandatory: true },
    { id: 'f5', time: 'afternoon', title: 'סידור נרות שבת', emoji: '🕎', completed: false, mandatory: true },
    { id: 'f6', time: 'afternoon', title: 'השקיית הגינה', emoji: '🌱', completed: false, mandatory: isOlder },
    { id: 'f7', time: 'afternoon', title: 'הוצאת הכלב', emoji: '🐕', completed: false, mandatory: true },
    { id: 'f8', time: 'afternoon', title: 'עזרה בהכנות לשבת (בישולים)', emoji: '🍲', completed: false, mandatory: isOlder },
  ];

  // Younger kids get simpler tasks
  if (isYoungest) {
    return [
      ...morningTasks,
      { id: 'f1', time: 'afternoon', title: 'סידור הצעצועים בחדר', emoji: '🧸', completed: false, mandatory: true, requiresPhoto: true },
      { id: 'f2', time: 'afternoon', title: 'עזרה בסידור שולחן שבת', emoji: '🕯️', completed: false, mandatory: true },
      { id: 'f3', time: 'afternoon', title: 'השקיית עציצים', emoji: '🌱', completed: false, mandatory: true },
      { id: 'f4', time: 'afternoon', title: 'הוצאת הכלב', emoji: '🐕', completed: false, mandatory: true },
      { id: 'f5', time: 'afternoon', title: 'האכלת הכלב', emoji: '🦴', completed: false, mandatory: true },
      // Evening
      { id: 'fe1', time: 'evening', title: 'מקלחת לכבוד שבת', emoji: '🚿', completed: false, mandatory: true },
      { id: 'fe2', time: 'evening', title: 'לבישת בגדי שבת', emoji: '👔', completed: false, mandatory: true },
      { id: 'fe3', time: 'evening', title: 'אמירת שמע ישראל', emoji: '🌙', completed: false, mandatory: true },
    ];
  }

  const fridayEvening: Task[] = [
    { id: 'fe1', time: 'evening', title: 'מקלחת לכבוד שבת', emoji: '🚿', completed: false, mandatory: true },
    { id: 'fe2', time: 'evening', title: 'לבישת בגדי שבת', emoji: '👔', completed: false, mandatory: true },
  ];

  return [...morningTasks, ...fridayTasks, ...fridayEvening];
}

// Get tasks based on day of week
function getTasksForToday(childId: string): Task[] {
  const day = new Date().getDay(); // 5 = Friday
  if (day === 5) return getFridayTasksForChild(childId);
  return getInitialTasksForChild(childId);
}

// Calculate earned screen time for a child
function getEarnedScreenTime(childId: string, childTasks: Task[]): { earned: number; base: number; bonus: number; allMandatoryDone: boolean } {
  const reward = SCREEN_TIME_REWARD[childId] || { base: 30, bonusPerOptional: 5 };
  const mandatory = childTasks.filter(t => t.mandatory);
  const optional = childTasks.filter(t => !t.mandatory);
  const allMandatoryDone = mandatory.every(t => t.completed);
  const completedOptional = optional.filter(t => t.completed).length;
  const bonus = completedOptional * reward.bonusPerOptional;
  return {
    earned: allMandatoryDone ? reward.base + bonus : 0,
    base: reward.base,
    bonus,
    allMandatoryDone,
  };
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('child');
  const [activeChildId, setActiveChildId] = useState<string>('rafael');
  const [parentPin, setParentPin] = useState<string>('');
  const [parentPinError, setParentPinError] = useState<boolean>(false);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState<boolean>(false);
  
  // Custom router state simulated
  const [isMashovScraping, setIsMashovScraping] = useState<boolean>(false);
  const [mashovHasHomeworkText, setMashovHomeworkText] = useState<Record<string, string>>({
    arava: 'תרגילים 1-5 במתמטיקה עמ׳ 44',
    hoshen: 'קריאת פרק ה׳ בתנ״ך והעתקת שאלות',
    peer: 'אין שיעורי בית מיוחדים להיום 🌟',
  });

  // --- CAMERA OVERLAY & LIGHTBOX STATE ---
  const [captureTaskTarget, setCaptureTaskTarget] = useState<{ childId: string; taskId: string } | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  // --- SCREEN TIME LOCK AUTOMATION ---
  const [screenTimers, setScreenTimers] = useState<Record<string, ScreenTimer>>({});
  const [timerMinutesInput, setTimerMinutesInput] = useState<Record<string, number>>({
    arava: 30, hoshen: 30, peer: 30, rafael: 30
  });
  const [lockServerConnected, setLockServerConnected] = useState<boolean>(false);
  const [lockServerMessage, setLockServerMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Time of day override (null = auto by clock)
  const [overrideTimeOfDay, setOverrideTimeOfDay] = useState<TimeOfDay | null>(null);

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // --- SMILEY REWARD & GIFT SYSTEM ---
  const [smileyCount, setSmileyCount] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('hallel_smileys');
    return saved ? JSON.parse(saved) : { arava: 0, hoshen: 0, peer: 0, rafael: 0 };
  });
  const [giftsRedeemed, setGiftsRedeemed] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('hallel_gifts');
    return saved ? JSON.parse(saved) : { arava: 0, hoshen: 0, peer: 0, rafael: 0 };
  });
  const [celebrationChild, setCelebrationChild] = useState<string | null>(null);
  const [celebrationShown, setCelebrationShown] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('hallel_celebration_shown');
    return saved ? JSON.parse(saved) : {};
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

  // Track recently completed tasks (show for 5 seconds before hiding)
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());

  // Save smileys and gifts to localStorage
  useEffect(() => {
    localStorage.setItem('hallel_smileys', JSON.stringify(smileyCount));
  }, [smileyCount]);
  useEffect(() => {
    localStorage.setItem('hallel_gifts', JSON.stringify(giftsRedeemed));
  }, [giftsRedeemed]);
  useEffect(() => {
    localStorage.setItem('hallel_celebration_shown', JSON.stringify(celebrationShown));
  }, [celebrationShown]);

  const [tasks, setTasks] = useState<Record<string, Task[]>>(() => {
    return {
      rafael: getTasksForToday('rafael'),
      arava: getTasksForToday('arava'),
      hoshen: getTasksForToday('hoshen'),
      peer: getTasksForToday('peer'),
    };
  });

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

  const activeChild = CHILDREN.find((c) => c.id === activeChildId)!;
  const currentTasks = tasks[activeChildId] || [];

  // Text-to-speech for Rafael - uses server-side Google Translate TTS
  // Works on any device, no voice installation needed
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const speakTask = (text: string) => {
    // Stop any currently playing audio
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    
    const encoded = encodeURIComponent(text);
    const audio = new Audio(`/api/tts?text=${encoded}`);
    ttsAudioRef.current = audio;
    audio.play().catch(() => {});
  };

  const handleTaskClick = (childId: string, taskId: string) => {
    // For Rafael - read aloud on click (must be FIRST, directly in click handler for Android)
    if (childId === 'rafael') {
      const task = (tasks[childId] || []).find(t => t.id === taskId);
      if (task) speakTask(task.title);
    }
    toggleTask(childId, taskId);
  };

  const toggleTask = (childId: string, taskId: string) => {
    const list = tasks[childId] || [];
    const task = list.find((t) => t.id === taskId);
    
    if (task) {
      if (task.requiresPhoto && !task.completed && !task.photo) {
        setCaptureTaskTarget({ childId, taskId });
        return;
      }
      
      // If completing (not uncompleting), add to recently completed for 5s fade
      if (!task.completed) {
        const key = `${childId}-${taskId}`;
        setRecentlyCompleted(prev => new Set(prev).add(key));
        setTimeout(() => {
          setRecentlyCompleted(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 5000);
      }
      
      setTasks((prev) => {
        const newTasks = {
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
        };
        
        // Check if all evening mandatory tasks are now complete → trigger celebration
        const updatedChildTasks = newTasks[childId];
        const eveningMandatory = updatedChildTasks.filter(t => t.time === 'evening' && t.mandatory);
        const allEveningDone = eveningMandatory.length > 0 && eveningMandatory.every(t => t.completed);
        const today = new Date().toDateString();
        
        if (allEveningDone && celebrationShown[childId] !== today) {
          // Award smiley and show celebration!
          setTimeout(() => {
            setSmileyCount(prev => ({ ...prev, [childId]: (prev[childId] || 0) + 1 }));
            setCelebrationChild(childId);
            setCelebrationShown(prev => ({ ...prev, [childId]: today }));
          }, 300);
        }
        
        return newTasks;
      });
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
          updated[childKey] = updated[childKey].map(task => {
            if (task.id === 'a3' && childKey !== 'rafael') {
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
      [childId]: [...prev[childId], newTask]
    }));
    setNewTaskTitle('');
    setNewTaskEmoji('📋');
  };

  const removeTask = (childId: string, taskId: string) => {
    setTasks(prev => ({
      ...prev,
      [childId]: prev[childId].filter(t => t.id !== taskId)
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
    if ((smileyCount[childId] || 0) >= 10) {
      setSmileyCount(prev => ({ ...prev, [childId]: prev[childId] - 10 }));
      setGiftsRedeemed(prev => ({ ...prev, [childId]: (prev[childId] || 0) + 1 }));
    }
  };

  // --- MASHOV SAVE ---
  const saveMashovCredentials = () => {
    localStorage.setItem('hallel_mashov_user', mashovUsername);
    localStorage.setItem('hallel_mashov_pass', mashovPassword);
    localStorage.setItem('hallel_mashov_school', mashovSchoolCode);
  };

  // --- CAMERA UTILITY STATES & METHODS ---
  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);
  const [cameraPhotoFile, setCameraPhotoFile] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCameraStream = async () => {
    try {
      setCameraPhotoFile(null);
      // Try back camera first (environment), fall back to any camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
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

      setTasks((prev) => ({
        ...prev,
        [childId]: prev[childId].map((t) =>
          t.id === taskId ? { ...t, photo: cameraPhotoFile, photoTime: localTimeStr, completed: true } : t
        ),
      }));

      // Auto clear and close modal
      setCameraPhotoFile(null);
      setCaptureTaskTarget(null);
    }
  };

  const getDayName = () => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return 'יום ' + days[new Date().getDay()];
  };

  // --- SCREEN TIME LOCK SERVER FUNCTIONS ---
  const checkLockServerHealth = useCallback(async () => {
    try {
      const res = await fetch(`${LOCK_SERVER_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setLockServerConnected(true);
        return true;
      }
    } catch {
      setLockServerConnected(false);
    }
    return false;
  }, []);

  const fetchTimerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${LOCK_SERVER_URL}/api/timer/status`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        setScreenTimers(data.timers || {});
        setLockServerConnected(true);
      }
    } catch {
      // silent fail - server may be offline
    }
  }, []);

  // Poll lock server status every second for countdown
  useEffect(() => {
    checkLockServerHealth();
    const interval = setInterval(fetchTimerStatus, 1000);
    return () => clearInterval(interval);
  }, [checkLockServerHealth, fetchTimerStatus]);

  const startScreenTimer = async (childId: string) => {
    const child = CHILDREN.find(c => c.id === childId);
    const minutes = timerMinutesInput[childId] || 30;
    try {
      const res = await fetch(`${LOCK_SERVER_URL}/api/timer/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, childName: child?.name || childId, minutes })
      });
      if (res.ok) {
        setLockServerMessage({ text: `⏱️ טיימר של ${minutes} דקות הופעל עבור ${child?.name}`, error: false });
        fetchTimerStatus();
      } else {
        const err = await res.json();
        setLockServerMessage({ text: `שגיאה: ${err.error}`, error: true });
      }
    } catch (e: any) {
      setLockServerMessage({ text: `שגיאת חיבור לשרת הנעילה: ${e.message}`, error: true });
    }
  };

  const stopScreenTimer = async (childId: string) => {
    try {
      await fetch(`${LOCK_SERVER_URL}/api/timer/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId })
      });
      setLockServerMessage({ text: `⏹️ הטיימר בוטל`, error: false });
      fetchTimerStatus();
    } catch (e: any) {
      setLockServerMessage({ text: `שגיאת חיבור: ${e.message}`, error: true });
    }
  };

  const extendScreenTimer = async (childId: string, extraMinutes: number) => {
    try {
      await fetch(`${LOCK_SERVER_URL}/api/timer/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, extraMinutes })
      });
      setLockServerMessage({ text: `⏱️➕ הטיימר הוארך ב-${extraMinutes} דקות`, error: false });
      fetchTimerStatus();
    } catch (e: any) {
      setLockServerMessage({ text: `שגיאת חיבור: ${e.message}`, error: true });
    }
  };

  const lockComputerNow = async () => {
    try {
      await fetch(`${LOCK_SERVER_URL}/api/lock`, { method: 'POST' });
      setLockServerMessage({ text: '🔒 המחשב ננעל!', error: false });
    } catch (e: any) {
      setLockServerMessage({ text: `שגיאת חיבור: ${e.message}`, error: true });
    }
  };

  // Get active timer for the current child (for child view)
  const activeTimerForChild = screenTimers[activeChildId] || null;

  // Progress calculations for active child
  const mandatoryTasks = currentTasks.filter((t) => t.mandatory);
  const completedMandatoryTasks = mandatoryTasks.filter((t) => t.completed);
  const totalMandatory = mandatoryTasks.length;
  const completedMandatory = completedMandatoryTasks.length;
  const remainingMandatory = totalMandatory - completedMandatory;
  const isWifiUnlockedForActive = remainingMandatory === 0;

  // Screen time reward for active child
  const screenTimeInfo = getEarnedScreenTime(activeChildId, currentTasks);

  const completedTotalCount = currentTasks.filter(t => t.completed).length;
  const totalTaskCount = currentTasks.length;

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
  const timeOfDayLabels: Record<TimeOfDay, { label: string; emoji: string; subtitle: string }> = {
    morning: { label: 'משימות בוקר', emoji: '🌅', subtitle: 'השכמה וארגון' },
    afternoon: { label: isFriday ? 'הכנות לשבת' : 'אחר הצהריים', emoji: isFriday ? '🕯️' : '🌞', subtitle: isFriday ? 'ערב שבת שלום!' : 'לימודים ומשימות' },
    evening: { label: isFriday ? 'ערב שבת' : 'ערב ושינה', emoji: isFriday ? '✨' : '🌙', subtitle: isFriday ? 'התארגנות לשבת' : 'התארגנות לשינה' },
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
    // Change this PIN to your own! Default: 1234
    if (parentPin === '1234') {
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

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#4A4540] font-sans selection:bg-[#E3DCD2] flex flex-col md:flex-row-reverse" dir="rtl">
      
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
                  <p className="text-xs text-[#8C8479]">{activeChildId === 'arava' || activeChildId === 'hoshen' ? 'בת' : 'בן'} {activeChild.age} | {getDayName()}</p>
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
                מערכת ה-Mashov סורקת שיעורי בית מדי יום. לערבה וחושן עודכנו שיעורי בית.
              </p>
              <div className="text-xs bg-white/70 p-2 rounded border border-[#E3DCD2]">
                <strong className="text-xs block text-[#D35400]">שיעורי בית ל{activeChild.name}:</strong>
                <p className="text-[11px] italic mt-0.5">
                  {activeChildId === 'rafael' 
                    ? 'פטור מגיל גן! יש להכין יצירה 🎨' 
                    : mashovHasHomeworkText[activeChildId] || 'אין שיעורי בית היום 😊'}
                </p>
              </div>
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
                  <span>{Math.min(smileyCount[activeChildId] || 0, 10)}/10</span>
                </div>
                <div className="h-2.5 bg-amber-100 rounded-full overflow-hidden border border-amber-200">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, ((smileyCount[activeChildId] || 0) / 10) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Smileys visual row */}
              <div className="flex flex-wrap gap-1 justify-center">
                {Array.from({ length: Math.min(smileyCount[activeChildId] || 0, 10) }).map((_, i) => (
                  <span key={i} className="text-lg">😊</span>
                ))}
                {Array.from({ length: Math.max(0, 10 - (smileyCount[activeChildId] || 0)) }).map((_, i) => (
                  <span key={`empty-${i}`} className="text-lg opacity-20">😊</span>
                ))}
              </div>

              {(smileyCount[activeChildId] || 0) >= 10 && (
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

            {/* Help Block */}
            <div className="p-4 bg-[#8A9A5B]/10 rounded-2xl border border-[#8A9A5B]/20 text-center text-xs space-y-2">
              <p className="text-[#6A7B42] mb-0.5 font-bold">צריך עזרה עם המשימות?</p>
              <p className="text-[#8A9A5B] text-[10px]">קראו לאבא הלל או אמא מוריה</p>
              <button
                onClick={() => {
                  const audio = new Audio('/api/tts?text=' + encodeURIComponent('שלום רפאל, בדיקה אחת שתיים שלוש'));
                  audio.play().then(() => alert('הקול עובד! 🎉')).catch(e => alert('שגיאה: ' + e.message));
                }}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition-all"
              >
                🔊 בדיקת קול
              </button>
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
                  <p className="text-[10px] opacity-90">שלום אבא הלל / אמא מוריה</p>
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
                <span>שרת נעילת מסך:</span>
                <span className={`font-bold ${lockServerConnected ? 'text-green-700' : 'text-red-600'}`}>
                  {lockServerConnected ? 'מחובר ✓' : 'לא מחובר ✗'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mashov API:</span>
                <span className="text-green-700 font-bold">מחובר (OK)</span>
              </div>
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
              <div className="font-bold">{getDayName()}</div>
              <div>{currentDate} | {currentTime}</div>
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
                  setTasks({
                    rafael: getTasksForToday('rafael'),
                    arava: getTasksForToday('arava'),
                    hoshen: getTasksForToday('hoshen'),
                    peer: getTasksForToday('peer'),
                  });
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
                            {child.id === 'arava' || child.id === 'hoshen' ? 'בת' : 'בן'} {child.age}
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

                      {/* Smiley count */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-amber-700 font-bold">😊 {smileyCount[child.id] || 0}</span>
                        {childScreenTime.earned > 0 && (
                          <span className="text-indigo-600 font-bold">🎮 {childScreenTime.earned} דק׳</span>
                        )}
                      </div>

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
                                  {child.id === 'rafael' && (
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
                    <p className="text-xs text-[#8C8479] mt-1">אבא הלל ואמא מוריה - נא להקיש את קוד האימות שלכם</p>
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
                      <h3 className="text-2xl font-bold text-[#5D4037]">👨‍👩‍👧‍👦 לוח הבקרה של הלל ומוריה</h3>
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

                  {/* REAL-TIME KIDS TRACKER CARDS (4 Children grid) */}
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
                                <p className="text-[10px] text-[#8C8479]">{child.id === 'arava' || child.id === 'hoshen' ? 'בת' : 'בן'} {child.age}</p>
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
                          </div>
                        </div>
                      )
                    })}
                  </div>


                  {/* PHOTO PROOFS REVIEW PANEL */}
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                      <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
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

                  {/* SCREEN TIME LOCK AUTOMATION PANEL */}
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-[#5D4037] text-lg">ניהול זמן מסך ונעילת מחשב אוטומטית</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                          lockServerConnected 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${lockServerConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                          {lockServerConnected ? 'שרת נעילה מחובר' : 'שרת נעילה לא זמין'}
                        </span>
                        <button
                          onClick={lockComputerNow}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>נעל מחשב עכשיו</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#8C8479] leading-relaxed">
                      הגדירו זמן מסך לכל ילד. לאחר סיום הזמן המוקצב, המחשב יינעל אוטומטית.
                      הפעילו את שרת הנעילה בטרמינל: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[10px]">npm run lock-server</code>
                    </p>

                    {!lockServerConnected && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 space-y-1">
                          <p className="font-bold">שרת הנעילה אינו פעיל</p>
                          <p>כדי שהאוטומציה תעבוד, הפעילו את שרת הנעילה:</p>
                          <code className="block bg-white px-3 py-2 rounded-xl border border-amber-300 font-mono text-[11px] text-amber-800 mt-1">
                            npm run lock-server
                          </code>
                        </div>
                      </div>
                    )}

                    {/* Timer cards per child */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {CHILDREN.map((child) => {
                        const timer = screenTimers[child.id];
                        const isActive = timer && !timer.locked && timer.remainingMs > 0;
                        const isExpired = timer && (timer.locked || timer.remainingMs <= 0);
                        const remainingMin = timer ? timer.remainingMs / 60000 : 0;
                        const isWarning = isActive && remainingMin <= 5;

                        return (
                          <div key={child.id} className={`p-4 rounded-2xl border space-y-3 transition-all ${
                            isActive 
                              ? isWarning 
                                ? 'bg-red-50 border-red-300 shadow-md' 
                                : 'bg-green-50 border-green-300 shadow-md'
                              : isExpired
                              ? 'bg-slate-100 border-slate-300'
                              : 'bg-white border-[#D6CFC4]'
                          }`}>
                            {/* Child header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={child.photo} alt={child.name} className="w-7 h-7 rounded-full object-cover object-top" />
                                <span className="font-bold text-sm text-[#4A4540]">{child.name}</span>
                              </div>
                              {isActive && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse ${
                                  isWarning ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                                }`}>
                                  {isWarning ? '⚠️ כמעט נגמר!' : '🟢 פעיל'}
                                </span>
                              )}
                              {isExpired && (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                  🔒 ננעל
                                </span>
                              )}
                            </div>

                            {/* Active timer display */}
                            {isActive && timer && (
                              <div className="text-center space-y-2">
                                <div className={`text-3xl font-mono font-bold tracking-wider py-2 px-3 rounded-xl ${
                                  isWarning ? 'text-red-700 bg-red-100' : 'text-green-700 bg-green-100'
                                }`}>
                                  {timer.remainingFormatted}
                                </div>
                                <div className="flex gap-1.5 justify-center">
                                  <button
                                    onClick={() => extendScreenTimer(child.id, 10)}
                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>10 דק׳</span>
                                  </button>
                                  <button
                                    onClick={() => extendScreenTimer(child.id, 30)}
                                    className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>30 דק׳</span>
                                  </button>
                                  <button
                                    onClick={() => stopScreenTimer(child.id)}
                                    className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-[10px] font-bold transition-all"
                                  >
                                    ⏹️ עצור
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Set timer (not active) */}
                            {!isActive && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => setTimerMinutesInput(prev => ({ ...prev, [child.id]: Math.max(5, (prev[child.id] || 30) - 5) }))}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-slate-700" />
                                  </button>
                                  <div className="flex-1 text-center">
                                    <span className="text-lg font-mono font-bold text-[#5D4037]">{timerMinutesInput[child.id] || 30}</span>
                                    <span className="text-[10px] text-[#8C8479] block">דקות</span>
                                  </div>
                                  <button 
                                    onClick={() => setTimerMinutesInput(prev => ({ ...prev, [child.id]: Math.min(180, (prev[child.id] || 30) + 5) }))}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                                  </button>
                                </div>

                                {/* Quick time presets */}
                                <div className="flex gap-1 justify-center">
                                  {[15, 30, 45, 60, 90].map(min => (
                                    <button
                                      key={min}
                                      onClick={() => setTimerMinutesInput(prev => ({ ...prev, [child.id]: min }))}
                                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                                        timerMinutesInput[child.id] === min
                                          ? 'bg-[#8A9A5B] text-white'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      {min} דק׳
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={() => startScreenTimer(child.id)}
                                  disabled={!lockServerConnected}
                                  className="w-full py-2 bg-[#8A9A5B] hover:bg-[#6A7B42] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Timer className="w-3.5 h-3.5" />
                                  <span>הפעל טיימר</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Lock server status message */}
                    {lockServerMessage && (
                      <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                        lockServerMessage.error 
                          ? 'bg-red-50 border-red-200 text-red-800' 
                          : 'bg-green-50 border-green-200 text-green-800'
                      }`}>
                        <span className="shrink-0">{lockServerMessage.error ? '❌' : '⚡'}</span>
                        <span className="flex-1">{lockServerMessage.text}</span>
                        <button onClick={() => setLockServerMessage(null)} className="text-[10px] opacity-70 hover:opacity-100">✕</button>
                      </div>
                    )}
                  </div>

                  {/* SMILEY & GIFT MANAGEMENT PANEL */}
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
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
                              onClick={() => setSmileyCount(prev => ({ ...prev, [child.id]: (prev[child.id] || 0) + 1 }))}
                              className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-[10px] font-bold"
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

                          {(smileyCount[child.id] || 0) >= 10 && (
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

                  {/* PARENT TASK EDITOR */}
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-[#8A9A5B]" />
                        <h4 className="font-bold text-[#5D4037] text-lg">עריכת משימות לפי ילד</h4>
                      </div>
                    </div>

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
                          <h5 className="text-xs font-bold text-[#5D4037]">הוספת משימה חדשה ל{CHILDREN.find(c => c.id === editingChildId)?.name}:</h5>
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
                              <option value="afternoon">🌞 צהריים</option>
                              <option value="evening">🌙 ערב</option>
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
                            onClick={() => addTask(editingChildId)}
                            disabled={!newTaskTitle.trim()}
                            className="px-4 py-2 bg-[#8A9A5B] hover:bg-[#6A7B42] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>הוסף משימה</span>
                          </button>
                        </div>

                        {/* Existing tasks list */}
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                          {(['morning', 'afternoon', 'evening'] as TimeOfDay[]).map(time => (
                            <div key={time} className="space-y-1">
                              <h6 className="text-[10px] font-bold text-[#8C8479] uppercase border-b border-[#F2EDE4] pb-1">
                                {time === 'morning' ? '🌅 בוקר' : time === 'afternoon' ? '🌞 צהריים' : '🌙 ערב'}
                              </h6>
                              {(tasks[editingChildId] || []).filter(t => t.time === time).map(task => (
                                <div key={task.id} className="flex items-center justify-between bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E3DCD2]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{task.emoji}</span>
                                    <span className="text-xs font-bold text-[#4A4540]">{task.title}</span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${task.mandatory ? 'bg-[#D35400]/10 text-[#D35400]' : 'bg-[#8A9A5B]/10 text-[#8A9A5B]'}`}>
                                      {task.mandatory ? 'חובה' : 'רשות'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => toggleTaskMandatory(editingChildId, task.id)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-bold text-slate-700 transition-all"
                                    >
                                      {task.mandatory ? 'הפוך לרשות' : 'הפוך לחובה'}
                                    </button>
                                    <button
                                      onClick={() => removeTask(editingChildId, task.id)}
                                      className="p-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MASHOV INTEGRATION SETTINGS */}
                  <div className="bg-white p-6 rounded-3xl border border-[#D6CFC4] shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-[#F2EDE4] pb-3">
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

                  {/* LOWER TABS FOR SPECIFICATIONS AND TECHNICAL INTEGRATIONS */}
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
    sheet.appendRow([Utilities.getUuid(), new Date(), "arava", "homework_task", "פתוח"]);
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
              )}

            </div>
          )}

        </div>

        {/* BOTTOM GLOBAL FOOTER */}
        <footer className="bg-[#E9E4DB] border-t border-[#D6CFC4] p-4 text-center text-xs text-[#8C8479] space-y-1">
          <p className="font-bold text-[#5D544A]">&copy; 2026 אפליקציית ניהול משימות לטאבלטים - משפחת הלל ומוריה</p>
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
                  LIVE CAMERA COMPONENT
                </div>
              </div>

              {/* Action row */}
              <div className="space-y-3">
                <div className="flex gap-2 justify-center">
                  {!cameraStreamActive ? (
                    <button
                      onClick={startCameraStream}
                      className="px-4 py-2 bg-[#8A9A5B] hover:bg-[#6A7B42] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-sans"
                    >
                      <Camera className="w-4 h-4" />
                      <span>הפעל מצלמת מכשיר</span>
                    </button>
                  ) : (
                    <button
                      onClick={capturePhotoFromStream}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-sans"
                    >
                      <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                      <span>צלם תמונה מהווידאו</span>
                    </button>
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
                  <span className="text-sm font-bold text-amber-800 block">קיבלת סמיילי! +1</span>
                  <span className="text-xs text-amber-600">
                    סה״כ: {smileyCount[celebrationChild] || 0} סמיילים
                    {(smileyCount[celebrationChild] || 0) >= 10 && ' — 🎁 מגיעה לך מתנה!'}
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

    </div>
  );
}
