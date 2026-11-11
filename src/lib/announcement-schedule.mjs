import { announcements, seasonalGreetings } from '../data/announcements.mjs';

export const BERLIN_TIME_ZONE = 'Europe/Berlin';

const pad = (value) => String(value).padStart(2, '0');
const isoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

export const berlinWallTime = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

const shiftDate = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const easterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
};

const lastTrainingBefore = (trainings, date, notBefore) => trainings
  .filter((training) => training.date >= notBefore && training.date < date)
  .map((training) => training.date)
  .sort()
  .at(-1) ?? null;

export const seasonalEntriesForYear = (year, trainings = []) => {
  const christmasDate = `${year}-12-24`;
  const yearStart = `${year}-01-01`;
  const christmasTraining = lastTrainingBefore(trainings, christmasDate, yearStart);
  const christmasStart = christmasTraining ? shiftDate(christmasTraining, 1) : `${year}-12-20`;
  const easter = easterSunday(year);
  const goodFriday = shiftDate(easter, -2);
  const easterTraining = lastTrainingBefore(trainings, goodFriday, yearStart);
  const easterStart = easterTraining ? shiftDate(easterTraining, 1) : shiftDate(goodFriday, -2);

  return [
    { ...seasonalGreetings.christmas, displayFrom: `${christmasStart}T00:00:00`, displayUntil: `${year}-12-26T23:59:59` },
    { ...seasonalGreetings.newyearEve, displayFrom: `${year}-12-27T00:00:00`, displayUntil: `${year}-12-31T23:59:59` },
    { ...seasonalGreetings.newyear, displayFrom: `${year}-01-01T00:00:00`, displayUntil: `${year}-01-07T23:59:59` },
    { ...seasonalGreetings.easter, displayFrom: `${easterStart}T00:00:00`, displayUntil: `${shiftDate(easter, 2)}T23:59:59` },
  ];
};

const isActive = (entry, wallTime) => entry.displayFrom <= wallTime && wallTime <= entry.displayUntil;

export const selectAnnouncement = ({ now = new Date(), trainings = [], preview = null, allowPreview = false } = {}) => {
  if (allowPreview && preview === 'none') return null;

  const wallTime = berlinWallTime(now);
  const year = Number(wallTime.slice(0, 4));
  const entries = [
    ...announcements,
    ...seasonalEntriesForYear(year - 1, trainings),
    ...seasonalEntriesForYear(year, trainings),
    ...seasonalEntriesForYear(year + 1, trainings),
  ];

  if (allowPreview && preview && preview !== 'auto') {
    return entries.find((entry) => entry.preview === preview) ?? null;
  }

  return entries.filter((entry) => isActive(entry, wallTime)).sort((first, second) => first.priority - second.priority)[0] ?? null;
};
