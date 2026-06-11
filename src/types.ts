export type Role = 'Admin' | 'Child';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface User {
  id: string;
  name: string;
  role: Role;
  age: number;
}

export interface Task {
  id: string;
  name: string;
  timeOfDay: TimeOfDay;
  icon: string;
  isMandatory: boolean;
  requiresPhoto?: boolean;
}

export interface DailyAssignment {
  id: string;
  userId: string;
  taskId: string;
  status: 'open' | 'done';
}
