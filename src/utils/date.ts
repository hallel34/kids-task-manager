// Local (not UTC) calendar-date key, e.g. "2026-07-13".
// `date.toISOString().split('T')[0]` is UTC-based, and Israel is UTC+2/+3 -
// so it rolls over to "tomorrow" while it is still today in local time
// (roughly 21:00-22:00 onward). Any "is this still today's saved data?"
// comparison built on that UTC string can falsely say no and discard
// today's progress. This always reflects the browser's local calendar day.
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


import type { Child } from '../types';

// Age in whole years on `today` for a local "yyyy-mm-dd" birthdate. Uses the
// same local-calendar logic as getLocalDateKey - a birthday counts from
// midnight local time, not UTC.
export function getAgeFromBirthdate(birthdate: string, today: Date = new Date()): number {
  const [year, month, day] = birthdate.split('-').map(Number);
  if (!year || !month || !day) return 0;
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1;
  const d = today.getDate();
  if (m < month || (m === month && d < day)) age--;
  return age;
}

// Effective age of a child: computed live from the birthdate when one is set,
// otherwise the manually-entered static age (e.g. children added in onboarding).
export function getChildAge(child: Pick<Child, 'age' | 'birthdate'>, today: Date = new Date()): number {
  return child.birthdate ? getAgeFromBirthdate(child.birthdate, today) : child.age;
}
