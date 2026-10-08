/** LRC time format: [mm:ss.xx] with centisecond precision */
export function formatLrcTime(totalSeconds: number): string {
  const totalCs = Math.max(0, Math.round(totalSeconds * 100));
  const mm = Math.floor(totalCs / 6000);
  const ss = Math.floor((totalCs % 6000) / 100);
  const xx = totalCs % 100;
  return `[${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(xx).padStart(2, '0')}]`;
}

/** Parse "mm:ss.xx" / "mm:ss" / "ss.xx" -> seconds, or null */
export function parseTimeInput(input: string): number | null {
  const t = input.trim().replace(',', '.');
  let m = t.match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const mm = m[1] ? parseInt(m[1], 10) : 0;
  const ss = parseInt(m[2], 10);
  const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
  if (ss >= 60 && m[1]) return null;
  return mm * 60 + ss + frac;
}

export interface ParsedLine {
  text: string;
  time: number | null;
}

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
const META_TAG = /^\s*\[[a-z]{2,}:[^\]]*\]\s*$/i;

function tagToSeconds(m: RegExpMatchArray): number {
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
  return mm * 60 + ss + frac;
}

/** Parse pasted lyrics / .lrc content into lines. Returns lines + detected meta. */
export function parseLyrics(raw: string): { lines: ParsedLine[]; meta: { title?: string; artist?: string; author?: string } } {
  const lines: ParsedLine[] = [];
  const meta: { title?: string; artist?: string; author?: string } = {};
  for (const row of raw.split('\n')) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    if (META_TAG.test(trimmed)) {
      const mm = trimmed.match(/^\s*\[(ti|ar|au):([^\]]*)\]\s*$/i);
      if (mm) {
        const key = mm[1].toLowerCase();
        if (key === 'ti') meta.title = mm[2].trim();
        if (key === 'ar') meta.artist = mm[2].trim();
        if (key === 'au') meta.author = mm[2].trim();
      }
      continue;
    }
    const tag = trimmed.match(TIME_TAG);
    if (tag) {
      const text = trimmed.replace(TIME_TAG, '').trim();
      lines.push({ text, time: tagToSeconds(tag) });
    } else {
      lines.push({ text: trimmed, time: null });
    }
  }
  return { lines, meta };
}

export interface LrcMeta {
  title: string;
  artist: string;
  author: string;
  lengthSec: number;
}

/** Build a standard .lrc document */
export function buildLrc(meta: LrcMeta, lines: ParsedLine[]): string {
  const out: string[] = [];
  if (meta.title) out.push(`[ti:${meta.title}]`);
  if (meta.artist) out.push(`[ar:${meta.artist}]`);
  if (meta.author) out.push(`[au:${meta.author}]`);
  if (meta.lengthSec > 0) {
    const mm = Math.floor(meta.lengthSec / 60);
    const ss = Math.floor(meta.lengthSec % 60);
    out.push(`[length:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}]`);
  }
  out.push('[re:ricsline.com/maker]');
  out.push('[ve:1.0.0]');
  for (const l of lines) {
    out.push(`${l.time != null ? formatLrcTime(l.time) : '[00:00.00]'}${l.text}`);
  }
  return out.join('\n');
}
