import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeSlash,
  DownloadSimple,
  CopySimple,
  Trash,
  PencilSimpleLine,
  MusicNotes,
  Plus,
} from 'phosphor-react';
import type { Dict } from '../i18n/dicts';

export interface SavedEntry {
  id: number;
  title: string;
  artist: string;
  author: string;
  lrc: string;
  createdAt: string;
}

export const LIB_KEY = 'ricsline-library';
export const LOAD_KEY = 'ricsline-load-entry';

export function readLibrary(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function LibraryApp({
  dict,
  locale,
  makerUrl,
}: {
  dict: Dict;
  locale: string;
  makerUrl: string;
}) {
  const t = dict.library;
  const rtl = locale === 'ar' || locale === 'ur';
  const [entries, setEntries] = useState<SavedEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setEntries(readLibrary());
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const persist = (lib: SavedEntry[]) => {
    setEntries(lib);
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(lib));
    } catch {}
  };

  const remove = (id: number) => {
    if (!window.confirm(t.confirmDelete)) return;
    persist(entries.filter((e) => e.id !== id));
    if (expandedId === id) setExpandedId(null);
    showToast(t.deleted);
  };

  const download = (e: SavedEntry) => {
    const blob = new Blob([e.lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(e.title || 'ricsline').replace(/[\\/:*?"<>|]/g, '_')}.lrc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async (e: SavedEntry) => {
    try {
      await navigator.clipboard.writeText(e.lrc);
      showToast(t.copied);
    } catch {
      showToast(t.copied);
    }
  };

  const openInMaker = (e: SavedEntry) => {
    try {
      localStorage.setItem(LOAD_KEY, JSON.stringify(e));
    } catch {}
    window.location.href = makerUrl;
  };

  const lineCount = (e: SavedEntry) =>
    e.lrc.split('\n').filter((l) => l.trim() && !/^\s*\[[a-z]{2,}:[^\]]*\]\s*$/i.test(l.trim())).length;

  const q = query.trim().toLowerCase();
  const visible = q
    ? entries.filter(
        (e) => e.title.toLowerCase().includes(q) || e.artist.toLowerCase().includes(q)
      )
    : entries;

  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t.subtitle}</p>
      </div>

      {entries.length > 0 && (
        <div className="mb-6">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            dir="auto"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
          />
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-graphite-700 dark:bg-graphite-900">
          <MusicNotes className="mx-auto h-10 w-10 text-gray-300 dark:text-graphite-600" />
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{t.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{t.emptyHint}</p>
          <a
            href={makerUrl}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" weight="bold" />
            {t.emptyCta}
          </a>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-graphite-700 dark:bg-graphite-900">
          <MusicNotes className="mx-auto h-10 w-10 text-gray-300 dark:text-graphite-600" />
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{t.noResults}</h2>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((e) => {
            const expanded = expandedId === e.id;
            const n = lineCount(e);
            let date = '';
            try {
              date = new Date(e.createdAt).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
            } catch {}
            return (
              <article
                key={e.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-graphite-700 dark:bg-graphite-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                      {e.title || 'Untitled'}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                      {[e.artist, date].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                      {t.lines.replace('{n}', String(n))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : e.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:text-gray-300"
                  >
                    {expanded ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {expanded ? t.hide : t.view}
                  </button>
                </div>

                {expanded && (
                  <pre
                    dir="ltr"
                    className="mt-4 max-h-64 overflow-auto rounded-xl bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-700 dark:bg-graphite-800 dark:text-gray-300"
                  >
                    {e.lrc}
                  </pre>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-graphite-800">
                  <button
                    type="button"
                    onClick={() => openInMaker(e)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
                  >
                    <PencilSimpleLine className="h-4 w-4" />
                    {t.openInMaker}
                  </button>
                  <button
                    type="button"
                    onClick={() => download(e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:text-gray-300"
                  >
                    <DownloadSimple className="h-4 w-4" />
                    {t.download}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:text-gray-300"
                  >
                    <CopySimple className="h-4 w-4" />
                    {t.copy}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition hover:border-red-400 hover:text-red-600 dark:border-graphite-700 dark:text-gray-300"
                  >
                    <Trash className="h-4 w-4" />
                    {t.delete}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white shadow-2xl dark:bg-white dark:text-gray-900">
          {toast}
        </div>
      )}
    </div>
  );
}
