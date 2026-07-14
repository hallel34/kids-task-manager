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
