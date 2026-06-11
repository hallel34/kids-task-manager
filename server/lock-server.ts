import express from 'express';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

// CORS - allow the Vite dev server to connect
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Track active timers per child
interface TimerState {
  childId: string;
  childName: string;
  minutes: number;
  startedAt: number; // timestamp ms
  endsAt: number;    // timestamp ms
  locked: boolean;
  warned5: boolean;
  warned1: boolean;
}

const activeTimers: Map<string, TimerState> = new Map();
let checkInterval: ReturnType<typeof setInterval> | null = null;

// Lock the Windows workstation
function lockComputer(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec('rundll32.exe user32.dll,LockWorkStation', (error) => {
      if (error) {
        console.error('Failed to lock computer:', error.message);
        reject(error);
      } else {
        console.log('🔒 Computer locked!');
        resolve();
      }
    });
  });
}

// Check timers every second
function startTimerChecker() {
  if (checkInterval) return;
  checkInterval = setInterval(async () => {
    const now = Date.now();
    for (const [childId, timer] of activeTimers) {
      const remainingMs = timer.endsAt - now;
      const remainingMin = remainingMs / 60000;

      // 5-minute warning
      if (!timer.warned5 && remainingMin <= 5 && remainingMin > 1) {
        timer.warned5 = true;
        console.log(`⚠️ ${timer.childName}: 5 דקות נותרו!`);
      }

      // 1-minute warning
      if (!timer.warned1 && remainingMin <= 1 && remainingMin > 0) {
        timer.warned1 = true;
        console.log(`🚨 ${timer.childName}: דקה אחרונה!`);
      }

      // Time's up - lock!
      if (remainingMs <= 0 && !timer.locked) {
        timer.locked = true;
        console.log(`🔒 הזמן של ${timer.childName} נגמר! נועל את המחשב...`);
        try {
          await lockComputer();
        } catch (e) {
          console.error('Lock failed:', e);
        }
      }
    }

    // Clean up expired timers that have been locked for over 1 minute
    for (const [childId, timer] of activeTimers) {
      if (timer.locked && (now - timer.endsAt) > 60000) {
        activeTimers.delete(childId);
      }
    }

    // Stop checker if no active timers
    if (activeTimers.size === 0 && checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }, 1000);
}

// --- API ENDPOINTS ---

// Start a timer for a child
app.post('/api/timer/start', (req, res) => {
  const { childId, childName, minutes } = req.body;
  if (!childId || !minutes || minutes <= 0) {
    res.status(400).json({ error: 'childId and positive minutes are required' });
    return;
  }

  const now = Date.now();
  const timer: TimerState = {
    childId,
    childName: childName || childId,
    minutes,
    startedAt: now,
    endsAt: now + minutes * 60000,
    locked: false,
    warned5: false,
    warned1: false,
  };

  activeTimers.set(childId, timer);
  startTimerChecker();

  console.log(`⏱️ Timer started for ${childName}: ${minutes} דקות`);
  res.json({ success: true, timer: { ...timer } });
});

// Stop/cancel a timer for a child
app.post('/api/timer/stop', (req, res) => {
  const { childId } = req.body;
  if (!childId) {
    res.status(400).json({ error: 'childId is required' });
    return;
  }

  const existed = activeTimers.delete(childId);
  console.log(`⏹️ Timer stopped for ${childId}`);
  res.json({ success: true, existed });
});

// Extend a timer
app.post('/api/timer/extend', (req, res) => {
  const { childId, extraMinutes } = req.body;
  if (!childId || !extraMinutes || extraMinutes <= 0) {
    res.status(400).json({ error: 'childId and positive extraMinutes are required' });
    return;
  }

  const timer = activeTimers.get(childId);
  if (!timer) {
    res.status(404).json({ error: 'No active timer for this child' });
    return;
  }

  timer.endsAt += extraMinutes * 60000;
  timer.minutes += extraMinutes;
  timer.locked = false;
  timer.warned5 = false;
  timer.warned1 = false;

  console.log(`⏱️➕ Timer extended for ${timer.childName}: +${extraMinutes} דקות`);
  res.json({ success: true, timer: { ...timer } });
});

// Get status of all timers
app.get('/api/timer/status', (_req, res) => {
  const now = Date.now();
  const timers: Record<string, any> = {};

  for (const [childId, timer] of activeTimers) {
    const remainingMs = Math.max(0, timer.endsAt - now);
    timers[childId] = {
      ...timer,
      remainingMs,
      remainingMinutes: Math.ceil(remainingMs / 60000),
      remainingFormatted: formatTime(remainingMs),
    };
  }

  res.json({ timers });
});

// Lock computer immediately
app.post('/api/lock', async (_req, res) => {
  try {
    await lockComputer();
    res.json({ success: true, message: 'Computer locked' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', activeTimers: activeTimers.size });
});

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🖥️  Lock Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   POST /api/timer/start   - Start timer { childId, childName, minutes }`);
  console.log(`   POST /api/timer/stop    - Stop timer  { childId }`);
  console.log(`   POST /api/timer/extend  - Extend timer { childId, extraMinutes }`);
  console.log(`   GET  /api/timer/status  - Get all timer statuses`);
  console.log(`   POST /api/lock          - Lock computer immediately`);
  console.log(`   GET  /api/health        - Health check\n`);
});
