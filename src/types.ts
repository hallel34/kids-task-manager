export type TimeOfDay = 'morning' | 'afternoon' | 'evening';
export type ViewMode = 'child' | 'parent';

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
  points?: number; // Fixed point value overriding the child's flat mandatory/optional
                    // rate (SCREEN_TIME_REWARD) - used by weekly missions.
}

export interface Child {
  id: string;
  name: string;
  age: number;
  gender?: 'male' | 'female';
  initial: string;
  color: string;
  avatarEmoji: string;
  photo: string;
}
