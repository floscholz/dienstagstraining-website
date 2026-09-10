const POLL_ID = 'zEF2odgzCry7VOLm';
const POLL_URL = `https://nuudel.digitalcourage.de/${POLL_ID}`;
const CSV_URL = `https://nuudel.digitalcourage.de/exportcsv.php?poll=${POLL_ID}`;
const BERLIN_TIME_ZONE = 'Europe/Berlin';

const csvRows = (input) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = []; value = '';
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
};

const berlinDate = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
  .formatToParts(now).reduce((result, part) => part.type === 'literal' ? result : { ...result, [part.type]: part.value }, {});

const isoBerlinDate = (now) => {
  const parts = berlinDate(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const addDay = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const formatDateLabel = (date) => new Intl.DateTimeFormat('de-DE', { timeZone: BERLIN_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const normalizeTime = (value) => {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?/);
  return match ? `${match[1].padStart(2, '0')}:${match[2] ?? '00'}` : null;
};
const decode = (value) => value.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (_, hex, decimal) => String.fromCodePoint(Number.parseInt(hex ?? decimal, hex ? 16 : 10))).replace(/<[^>]*>/g, '').trim();
const berlinDateTime = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: BERLIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
const parseBerlinTimestamp = (value) => {
  const candidates = ['+01:00', '+02:00'].map((offset) => new Date(`${value.replace(' ', 'T')}:00${offset}`)).filter((date) => berlinDateTime(date) === value);
  return candidates.length === 1 ? candidates[0].toISOString() : null;
};

const parseComments = (html) => {
  const comments = [];
  const pattern = /<div class="comment">([\s\S]*?)<\/div>/g;
  for (const match of html.matchAll(pattern)) {
    const date = match[1].match(/class="comment_date">\s*([^<]+)\s*</)?.[1]?.trim();
    const author = match[1].match(/<b>([\s\S]*?)<\/b>/)?.[1];
    const text = match[1].match(/<b>[\s\S]*?<\/b>\s*&nbsp;\s*<span>([\s\S]*?)<\/span>/)?.[1];
    const createdAt = date && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date) ? parseBerlinTimestamp(date) : null;
    if (!createdAt || !author || !text) continue;
    comments.push({ author: decode(author), text: decode(text), createdAt, localDate: date.slice(0, 10) });
  }
  return comments.filter((comment) => comment.author && comment.text);
};

export const selectCommentForCycle = (comments, previousDate) => {
  if (!previousDate) return null;
  const cycleStart = addDay(previousDate);
  return comments.filter((comment) => (comment.localDate ?? comment.createdAt.slice(0, 10)) >= cycleStart).sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
};

export const parseNuudel = (csv, html, now = new Date()) => {
  const rows = csvRows(csv);
  const dates = (rows[0] ?? []).slice(1);
  const times = (rows[1] ?? []).slice(1);
  const today = isoBerlinDate(now);
  const index = dates.findIndex((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today);
  if (index < 0) throw new Error('Kein aktueller Termin im Nuudel-Poll');
  const date = dates[index];
  const statuses = rows.slice(2).map((row) => row[index + 1]);
  const description = decode(html.match(/class="[^"]*poll-description[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
  const selectedComment = selectCommentForCycle(parseComments(html), index > 0 ? dates[index - 1] : null);
  return {
    date,
    dateLabel: formatDateLabel(date),
    time: normalizeTime(times[index]) ?? '20:00',
    locationText: description.replace(/^Immer\s+Dienstags?\s+\d{1,2}(?::\d{2})?\s*/i, '').trim() || null,
    yes: statuses.filter((status) => status === 'Ja').length,
    maybe: statuses.filter((status) => status === 'Unter Vorbehalt').length,
    comment: selectedComment ? { author: selectedComment.author, text: selectedComment.text, createdAt: selectedComment.createdAt } : null,
    sourceUrl: POLL_URL,
    updatedAt: new Date().toISOString(),
  };
};

export default async () => {
  const [csvResponse, htmlResponse] = await Promise.all([fetch(CSV_URL, { cache: 'no-store' }), fetch(POLL_URL, { cache: 'no-store' })]);
  if (!csvResponse.ok || !htmlResponse.ok) throw new Error('Nuudel-Abruf fehlgeschlagen');
  const data = parseNuudel(await csvResponse.text(), await htmlResponse.text());
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
};
