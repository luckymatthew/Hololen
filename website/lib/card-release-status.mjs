// Release labels are presentation only. Catalog flags and simulator support stay intact.
const japanDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function japanDateAt(value = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(japanDateFormatter.formatToParts(date).map(part => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return isCalendarDate(day) ? day : '';
}

export function msUntilNextJapanDate(value = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : value;
  const today = japanDateAt(timestamp);
  if (!today) return null;
  // Japan's current calendar day starts at 15:00 UTC on the preceding UTC day.
  const nextMidnight = Date.parse(`${today}T00:00:00.000+09:00`) + 24 * 60 * 60 * 1000;
  return Math.max(1, nextMidnight - timestamp);
}

export function printingReleaseStatus(card, variant, today = japanDateAt()) {
  // An existing printing never inherits a sibling's preview flag or release date.
  const source = variant ?? card;
  const releaseDate = isCalendarDate(source?.releaseDate) ? source.releaseDate : '';
  const released = Boolean(releaseDate && isCalendarDate(today) && releaseDate <= today);
  const flagged = source?.preview === true;
  const official = source?.officialImportSchema === 2;
  return {
    officialPreview: official && flagged && !released,
    preview: flagged && (!official || !released),
    releaseDate,
    released,
  };
}
