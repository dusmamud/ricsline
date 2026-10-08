import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SpeakerHigh,
  SpeakerX,
  PencilSimpleLine,
  Check,
  DownloadSimple,
  CopySimple,
  BracketsCurly,
  FloppyDisk,
  ArrowLeft,
  CloudArrowUp,
  TagSimple,
  Plus,
  X,
} from 'phosphor-react';
import { formatLrcTime, parseTimeInput, parseLyrics, buildLrc, type ParsedLine } from './lrc';
import type { Dict } from '../i18n/dicts';

interface Line extends ParsedLine {
  id: number;
}

let nextId = 1;
const nid = () => nextId++;

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white';
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';

export default function MakerApp({ dict, locale }: { dict: Dict; locale: string }) {
  const m = dict.maker;
  const rtl = locale === 'ar' || locale === 'ur';
  const [phase, setPhase] = useState<'form' | 'sync'>('form');

  // form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [author, setAuthor] = useState('');
  const [rawLyrics, setRawLyrics] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // sync state
  const [lines, setLines] = useState<Line[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem('ricsline-volume');
      return v != null ? Math.min(100, Math.max(0, parseInt(v, 10))) : 100;
    } catch {
      return 100;
    }
  });
  const [offsetStr, setOffsetStr] = useState('2.75');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editText, setEditText] = useState('');
  const [savedFlag, setSavedFlag] = useState(false);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number | null>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const showToast = (msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ msg, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  // ---- audio element lifecycle ----
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume / 100;
    a.muted = muted;
  }, [volume, muted, phase]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a && !a.paused && !a.seeking) setCurrentTime(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ---- file handling ----
  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    const ok = f.type.startsWith('audio/') || /\.mp3$/i.test(f.name);
    if (!ok) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(f);
    setAudioUrl(URL.createObjectURL(f));
  };

  // ---- start syncing ----
  const startSyncing = () => {
    const { lines: parsed, meta } = parseLyrics(rawLyrics);
    if (parsed.length === 0) {
      showToast(m.lyricsHint);
      return;
    }
    if (!audioUrl) {
      showToast(m.needAudio);
      return;
    }
    if (!title && meta.title) setTitle(meta.title);
    if (!artist && meta.artist) setArtist(meta.artist);
    if (!author && meta.author) setAuthor(meta.author);
    setLines(parsed.map((l) => ({ ...l, id: nid() })));
    setCurrentTime(0);
    setSavedFlag(false);
    setPhase('sync');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backToForm = () => {
    if (lines.some((l) => l.time != null) && !window.confirm(m.confirmDiscard)) return;
    const a = audioRef.current;
    if (a) a.pause();
    setIsPlaying(false);
    setPhase('form');
  };

  // ---- tagging ----
  const tagNext = () => {
    const idx = lines.findIndex((l) => l.time == null);
    if (idx === -1) {
      showToast(m.allTagged);
      return;
    }
    const t = audioRef.current?.currentTime ?? 0;
    const bad = lines.some((l, i) => i > idx && l.time != null && l.time < t);
    if (bad) {
      showToast(m.cantTagAfter);
      return;
    }
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, time: t } : l)));
  };
  const tagNextRef = useRef(tagNext);
  tagNextRef.current = tagNext;

  const tagLine = (id: number) => {
    const t = audioRef.current?.currentTime ?? 0;
    const idx = lines.findIndex((l) => l.id === id);
    const bad = lines.some((l, i) => i > idx && l.time != null && l.time < t);
    if (bad) {
      showToast(m.cantSetTime);
      return;
    }
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, time: t } : l)));
  };

  const seekLine = (line: Line) => {
    const a = audioRef.current;
    if (!a || line.time == null) return;
    a.currentTime = line.time;
    setCurrentTime(line.time);
    a.play().catch(() => {});
  };

  // spacebar = tag next
  useEffect(() => {
    if (phase !== 'sync') return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code === 'Space' && t && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        tagNextRef.current();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase]);

  // ---- offset ----
  const applyOffset = () => {
    const d = parseFloat(offsetStr);
    if (Number.isNaN(d) || d === 0) return;
    setLines((prev) =>
      prev.map((l) =>
        l.time == null ? l : { ...l, time: Math.max(0, Math.round((l.time + d) * 100) / 100) },
      ),
    );
    const n = lines.filter((l) => l.time != null).length;
    showToast(
      m.offsetApplied.replace('{n}', String(n)).replace('{s}', `${d > 0 ? '+' : ''}${d.toFixed(2)}s`),
    );
  };

  // ---- inline edit ----
  const openEdit = (line: Line) => {
    setEditingId(line.id);
    setEditTime(line.time != null ? formatLrcTime(line.time).slice(1, -1) : '');
    setEditText(line.text);
  };
  const saveEdit = () => {
    const parsed = editTime.trim() === '' ? null : parseTimeInput(editTime);
    if (editTime.trim() !== '' && parsed == null) {
      showToast(m.editTimeTitle);
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.id === editingId ? { ...l, time: parsed, text: editText } : l)),
    );
    setEditingId(null);
  };

  // ---- export ----
  // NB: a line tagged at exactly 0.00s still counts as tagged (time != null)
  const taggedCount = lines.filter((l) => l.time != null).length;
  const totalCount = lines.length;
  const untaggedCount = totalCount - taggedCount;
  const allTagged = totalCount > 0 && taggedCount === totalCount;
  const lrcText = () => buildLrc({ title, artist, author, lengthSec: duration }, lines);

  const guardAllTagged = (): boolean => {
    if (!allTagged) {
      showToast(m.linesNeedTag.replace('{n}', String(untaggedCount)));
      return false;
    }
    return true;
  };

  const download = () => {
    if (!guardAllTagged()) return;
    const blob = new Blob([lrcText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'ricsline').replace(/[\\/:*?"<>|]/g, '_')}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async () => {
    if (!guardAllTagged()) return;
    try {
      await navigator.clipboard.writeText(lrcText());
      showToast(m.copied);
    } catch {
      showToast(m.copied);
    }
  };

  const copyJson = async () => {
    if (!guardAllTagged()) return;
    const data = {
      title,
      artist,
      author,
      lines: lines.map((l) => ({
        time: l.time != null ? formatLrcTime(l.time) : null,
        seconds: l.time,
        text: l.text,
      })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      showToast(m.jsonCopied);
    } catch {
      showToast(m.jsonCopied);
    }
  };

  const saveLocal = () => {
    if (!title.trim()) {
      showToast(m.needTitle);
      return;
    }
    if (!artist.trim()) {
      showToast(m.needArtist);
      return;
    }
    try {
      const raw = localStorage.getItem('ricsline-library');
      const lib = raw ? JSON.parse(raw) : [];
      lib.unshift({
        id: Date.now(),
        title,
        artist,
        author,
        lrc: lrcText(),
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('ricsline-library', JSON.stringify(lib.slice(0, 50)));
      setSavedFlag(true);
      showToast(m.savedLocal);
    } catch {
      showToast(m.savedLocal);
    }
  };

  // ---- player controls ----
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const seekPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const activeIdx = (() => {
    let idx = -1;
    lines.forEach((l, i) => {
      if (l.time != null && l.time <= currentTime + 0.001) idx = i;
    });
    return idx;
  })();

  useEffect(() => {
    if (activeIdx >= 0 && isPlaying) {
      const el = lineRefs.current.get(lines[activeIdx]?.id);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, isPlaying]);

  const fmtClock = (s: number) => {
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const toastEl = toast && (
    <div
      key={toast.key}
      className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900 px-5 py-3 text-center text-sm font-medium text-white shadow-2xl dark:bg-white dark:text-gray-900"
    >
      {toast.msg}
    </div>
  );

  /* ================= FORM PHASE ================= */
  if (phase === 'form') {
    return (
      <div className="mx-auto max-w-4xl" dir={rtl ? 'rtl' : 'ltr'}>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Lrc Maker
        </h1>

        <div className="mt-8 space-y-6">
          <div>
            <label className={labelCls}>{m.labelTitle}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{m.labelArtist}</label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{m.labelAuthor}</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{m.lyricsLabel}</label>
            <textarea
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
              placeholder={m.lyricsPlaceholder}
              rows={9}
              dir="auto"
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </div>

          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50 dark:border-graphite-700 dark:hover:bg-graphite-800/50'
              }`}
            >
              <CloudArrowUp className="h-10 w-10 text-gray-400 dark:text-gray-500" />
              <p className="mt-3 font-medium text-gray-700 dark:text-gray-200">{m.dropTitle}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{m.dropSub}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            {audioFile && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-graphite-700 dark:bg-graphite-800">
                <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                  {audioFile.name}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    {m.replaceFile}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioFile(null);
                      setAudioUrl(null);
                    }}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    {m.removeAudio}
                  </button>
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startSyncing}
            className="w-full rounded-lg bg-brand-500 px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-brand-600 active:scale-[0.99]"
          >
            {m.startSyncing}
          </button>
        </div>

        {toastEl}
      </div>
    );
  }

  /* ================= SYNC PHASE ================= */
  return (
    <div className="mx-auto max-w-4xl" dir={rtl ? 'rtl' : 'ltr'}>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title || 'Untitled'}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {[artist, m.linesTagged.replace('{done}', String(taggedCount)).replace('{total}', String(totalCount))]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={backToForm}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {m.backToForm}
        </button>
      </div>

      {/* player */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3 dark:bg-graphite-800">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow transition hover:bg-brand-600 active:scale-95"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" weight="fill" />
          ) : (
            <Play className="h-5 w-5" weight="fill" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => {
            const v = Number(e.target.value);
            const a = audioRef.current;
            if (a) a.currentTime = v;
            setCurrentTime(v);
          }}
          className="slider min-w-0 flex-1"
          style={{ ['--fill' as string]: `${seekPct}%` }}
          aria-label="Seek"
        />
        <span className="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">
          {fmtClock(currentTime)} / {fmtClock(duration)}
        </span>
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          aria-label={muted ? m.unmute : m.mute}
          className="shrink-0 text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {muted || volume === 0 ? (
            <SpeakerX className="h-5 w-5" />
          ) : (
            <SpeakerHigh className="h-5 w-5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (v > 0) setMuted(false);
            try {
              localStorage.setItem('ricsline-volume', String(v));
            } catch {}
          }}
          className="slider hidden w-24 shrink-0 sm:block"
          style={{ ['--fill' as string]: `${muted ? 0 : volume}%` }}
          aria-label="Volume"
        />
      </div>

      {/* instructions */}
      <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{m.tapHint}</p>

      {/* offset */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{m.offsetLabel}</span>
        <input
          type="number"
          step="0.05"
          value={offsetStr}
          onChange={(e) => setOffsetStr(e.target.value)}
          disabled={taggedCount === 0}
          dir="ltr"
          className="w-24 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm tabular-nums outline-none transition focus:border-brand-500 disabled:opacity-40 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">{m.seconds}</span>
        <button
          type="button"
          onClick={applyOffset}
          disabled={taggedCount === 0}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-gray-300"
        >
          {m.apply}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{m.offsetHint}</p>

      {/* lyric rows */}
      <div className="mt-5 space-y-3">
        {lines.map((line, i) => {
          const tagged = line.time != null;
          const isActive = i === activeIdx && tagged;
          const isEditing = editingId === line.id;
          return (
            <div
              key={line.id}
              ref={(el) => {
                if (el) lineRefs.current.set(line.id, el);
                else lineRefs.current.delete(line.id);
              }}
            >
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="mm:ss.xx"
                    title={m.editTimeTitle}
                    dir="ltr"
                    className="w-28 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 font-mono text-sm outline-none focus:border-brand-500 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
                  />
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    dir="auto"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    aria-label="Save"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-500 text-white transition hover:bg-brand-600"
                  >
                    <Check className="h-4 w-4" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 transition hover:bg-gray-100 dark:border-graphite-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => tagLine(line.id)}
                    title={m.tagNext}
                    dir="ltr"
                    className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-sm tabular-nums transition ${
                      tagged
                        ? 'border-brand-500 bg-brand-500 font-semibold text-white shadow-sm hover:bg-brand-600'
                        : 'border-gray-300 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:bg-graphite-800 dark:text-gray-400'
                    }`}
                  >
                    {tagged ? formatLrcTime(line.time!) : '[00:00.00]'}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekLine(line)}
                    dir="auto"
                    className={`min-w-0 flex-1 truncate text-start text-[15px] ${
                      tagged
                        ? `font-bold text-brand-600 hover:underline dark:text-brand-400 ${
                            isActive ? 'underline' : ''
                          }`
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {line.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(line)}
                    title={m.editLine}
                    aria-label={m.editLine}
                    className="shrink-0 p-1 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <PencilSimpleLine className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* warning banner */}
      {untaggedCount > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-100/70 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {m.linesNeedTag.replace('{n}', String(untaggedCount))}
        </div>
      )}

      {/* export row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveLocal}
          disabled={taggedCount === 0}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-40 ${
            savedFlag ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-brand-500 hover:bg-brand-600'
          }`}
        >
          <FloppyDisk className="h-4 w-4" />
          {savedFlag ? m.saved : m.saveLrc}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={!allTagged}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-gray-200"
        >
          <DownloadSimple className="h-4 w-4" />
          {m.downloadLrc}
        </button>
        <button
          type="button"
          onClick={copyText}
          disabled={!allTagged}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-gray-200"
        >
          <CopySimple className="h-4 w-4" />
          {m.copyContent}
        </button>
        <button
          type="button"
          onClick={copyJson}
          disabled={!allTagged}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-gray-200"
        >
          <BracketsCurly className="h-4 w-4" />
          {m.copyJson}
        </button>
      </div>

      {/* floating tag button */}
      <button
        type="button"
        onClick={tagNext}
        title={m.tagNext}
        aria-label={m.tagNext}
        className="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl transition hover:bg-brand-600 active:scale-95"
      >
        <TagSimple className="h-6 w-6" weight="fill" />
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-600 shadow">
          <Plus className="h-3 w-3" weight="bold" />
        </span>
      </button>

      {/* hidden file input lives on form phase; keep audio element mounted */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,.mp3"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
      {toastEl}
    </div>
  );
}
