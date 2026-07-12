// ================= SHABBAT & HEBREW DATE UTILITIES =================
// Karnei Shomron coordinates: 32.1717°N 35.0978°E
export const LOCATION = { lat: 32.1717, lon: 35.0978, name: 'קרני שומרון' };
const CANDLE_OFFSET_MINUTES = 20; // light candles 20 min before sunset

// Calculate sunset for a given date and location using simplified solar calculation
function getSunset(date: Date, lat: number, lon: number): Date {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const zenith = 90.833;
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  // Approximate time
  const lnHour = lon / 15;
  const t = dayOfYear + ((18 - lnHour) / 24);

  // Sun's mean anomaly
  const M = (0.9856 * t) - 3.289;

  // Sun's true longitude
  let L = M + (1.916 * Math.sin(M * D2R)) + (0.020 * Math.sin(2 * M * D2R)) + 282.634;
  L = ((L % 360) + 360) % 360;

  // Sun's right ascension
  let RA = R2D * Math.atan(0.91764 * Math.tan(L * D2R));
  RA = ((RA % 360) + 360) % 360;

  const Lquadrant = (Math.floor(L / 90)) * 90;
  const RAquadrant = (Math.floor(RA / 90)) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA = RA / 15;

  const sinDec = 0.39782 * Math.sin(L * D2R);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH = (Math.cos(zenith * D2R) - (sinDec * Math.sin(lat * D2R))) / (cosDec * Math.cos(lat * D2R));
  if (cosH > 1 || cosH < -1) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 30); // fallback

  const H = R2D * Math.acos(cosH);
  const T = H / 15 + RA - (0.06571 * t) - 6.622;
  let UT = ((T - lnHour) % 24 + 24) % 24;

  const hours = Math.floor(UT);
  const minutes = Math.round((UT - hours) * 60);

  // Convert to local time (Israel is UTC+2, or UTC+3 in summer)
  const israelOffset = isDST(date) ? 3 : 2;
  const localHours = hours + israelOffset;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), localHours, minutes);
}

function isDST(date: Date): boolean {
  // Israel DST: last Friday before April 2 to last Sunday of October
  // Simplified: assume DST from late March to late October
  const month = date.getMonth();
  return month >= 2 && month <= 9;
}

// Get Shabbat entry (Friday sunset - 20 min) and exit (Saturday sunset + 40 min)
function getShabbatTimes(fridayDate: Date): { candleLighting: Date; havdalah: Date } {
  const friday = new Date(fridayDate);
  friday.setHours(0, 0, 0, 0);
  // Ensure it's Friday
  if (friday.getDay() !== 5) {
    // Find next Friday
    const daysUntilFriday = (5 - friday.getDay() + 7) % 7;
    friday.setDate(friday.getDate() + daysUntilFriday);
  }

  const saturday = new Date(friday);
  saturday.setDate(saturday.getDate() + 1);

  const sunsetFriday = getSunset(friday, LOCATION.lat, LOCATION.lon);
  const sunsetSaturday = getSunset(saturday, LOCATION.lat, LOCATION.lon);

  const candleLighting = new Date(sunsetFriday.getTime() - CANDLE_OFFSET_MINUTES * 60000);
  const havdalah = new Date(sunsetSaturday.getTime() + 40 * 60000); // 40 min after sunset = 3 stars

  return { candleLighting, havdalah };
}

// Check if currently Shabbat
export function isCurrentlyShabbat(): { isShabbat: boolean; candleLighting: string; havdalah: string; nextShabbatIn?: string } {
  const now = new Date();
  const today = now.getDay(); // 0=Sun, 5=Fri, 6=Sat

  // Find this week's Friday
  const friday = new Date(now);
  const daysToFriday = today <= 5 ? 5 - today : 5 - today + 7;
  friday.setDate(now.getDate() + daysToFriday);
  friday.setHours(0, 0, 0, 0);

  // If it's already past Friday or Saturday, check this week's shabbat
  const lastFriday = new Date(now);
  const daysFromFriday = today >= 5 ? today - 5 : today + 2;
  lastFriday.setDate(now.getDate() - daysFromFriday);
  lastFriday.setHours(0, 0, 0, 0);

  const thisShabbat = getShabbatTimes(today >= 5 ? lastFriday : friday);
  const nextShabbat = getShabbatTimes(friday);

  // Use the relevant Shabbat
  const relevantShabbat = now >= thisShabbat.candleLighting && now <= thisShabbat.havdalah
    ? thisShabbat : nextShabbat;

  const isShabbat = now >= relevantShabbat.candleLighting && now <= relevantShabbat.havdalah;

  const formatTime = (d: Date) => d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return {
    isShabbat,
    candleLighting: formatTime(nextShabbat.candleLighting),
    havdalah: formatTime(nextShabbat.havdalah),
  };
}

// Get Hebrew date string with gematria (letters)
function numberToHebrewGematria(num: number): string {
  const ones = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳'];
  const tens = ['', 'י׳', 'כ׳', 'ל׳'];

  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';

  if (num >= 1 && num <= 9) return ones[num];
  if (num >= 10 && num <= 30) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    if (o === 0) return tens[t];
    return tens[t].replace('׳', '') + '״' + ones[o].replace('׳', '');
  }
  return String(num);
}

function yearToHebrewGematria(year: number): string {
  // Hebrew year like 5786 → תשפ״ו
  // We only need the last 3 digits (786)
  const y = year % 1000;
  const h = Math.floor(y / 100);
  const t = Math.floor((y % 100) / 10);
  const o = y % 10;

  const hundredsLetters = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const tensLetters = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const onesLetters = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

  // Special cases for 15 and 16
  if (t === 1 && o === 5) return hundredsLetters[h] + 'ט״ו';
  if (t === 1 && o === 6) return hundredsLetters[h] + 'ט״ז';

  const parts = [hundredsLetters[h], tensLetters[t], onesLetters[o]].filter(Boolean);
  if (parts.length <= 1) return parts.join('');
  // Insert ״ before last letter
  const last = parts.pop()!;
  return parts.join('') + '״' + last;
}

export function getHebrewDate(date?: Date): string {
  const d = date || new Date();
  // Get Hebrew calendar parts
  const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
  const parts = formatter.formatToParts(d);

  const dayNum = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const month = parts.find(p => p.type === 'month')?.value || '';
  const yearNum = parseInt(parts.find(p => p.type === 'year')?.value || '5786');

  const dayGematria = numberToHebrewGematria(dayNum);
  const yearGematria = yearToHebrewGematria(yearNum);

  return `${dayGematria} ${month} ${yearGematria}`;
}

export function getHebrewDayMonth(date?: Date): string {
  const d = date || new Date();
  const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' });
  const parts = formatter.formatToParts(d);

  const dayNum = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const month = parts.find(p => p.type === 'month')?.value || '';

  return `${numberToHebrewGematria(dayNum)} ${month}`;
}
