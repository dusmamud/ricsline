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
  UploadSimple,
  X,
  Clock,
} from 'phosphor-react';
import { formatLrcTime, parseTimeInput, parseLyrics, buildLrc, type ParsedLine } from './lrc';
import type { Dict } from '../i18n/dicts';

interface Line extends ParsedLine {
  id: number;
}

let nextId = 1;
const nid = () => nextId++;

export default function MakerApp({ dict, locale }: { dict: Dict; locale: string }) {
  const m = dict.maker;
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
  const [offsetStr, setOffsetStr] = useState('');
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
    setOffsetStr('');
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
  const taggedCount = lines.filter((l) => l.time != null && l.time > 0).length;
  const totalCount = lines.length;
  const lrcText = () =>
    buildLrc({ title, artist, author, lengthSec: duration }, lines);

  const guardExport = (): boolean => {
    if (taggedCount < 2) {
      showToast(m.needTwoLines);
      return false;
    }
    return true;
  };

  const download = () => {
    if (!guardExport()) return;
    const blob = new Blob([lrcText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'ricsline').replace(/[\\/:*?"<>|]/g, '_')}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async () => {
    if (!guardExport()) return;
    try {
      await navigator.clipboard.writeText(lrcText());
      showToast(m.copied);
    } catch {
      showToast(m.copied);
    }
  };

  const copyJson = async () => {
    if (!guardExport()) return;
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
      lib.unshift({ id: Date.now(), title, artist, author, lrc: lrcText(), createdAt: new Date().toISOString() });
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

  /* ================= FORM PHASE ================= */
  if (phase === 'form') {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-graphite-900 dark:text-white">
          {m.formTitle}
        </h1>
        <p className="mt-2 text-graphite-500 dark:text-graphite-400">{m.formSubtitle}</p>

        <div className="mt-8 space-y-5 rounded-3xl border border-graphite-200 bg-white p-6 sm:p-8 dark:border-graphite-800 dark:bg-graphite-900">
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-graphite-700 dark:text-graphite-200">{m.labelTitle}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={m.titlePlaceholder}
                className="w-full rounded-xl border border-graphite-200 bg-graphite-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-graphite-700 dark:text-graphite-200">{m.labelArtist}</span>
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder={m.artistPlaceholder}
                className="w-full rounded-xl border border-graphite-200 bg-graphite-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-graphite-700 dark:text-graphite-200">{m.labelAuthor}</span>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={m.authorPlaceholder}
                className="w-full rounded-xl border border-graphite-200 bg-graphite-50 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-graphite-700 dark:text-graphite-200">{m.lyricsLabel}</span>
            <textarea
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
              placeholder={m.lyricsPlaceholder}
              rows={8}
              dir="auto"
              className="w-full resize-y rounded-xl border border-graphite-200 bg-graphite-50 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
            />
            <span className="mt-1.5 block text-xs text-graphite-400 dark:text-graphite-500">{m.lyricsHint}</span>
          </label>

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
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-graphite-200 bg-graphite-50 hover:border-brand-400 hover:bg-brand-50/50 dark:border-graphite-700 dark:bg-graphite-800/50 dark:hover:border-brand-500'
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-500/25">
                <UploadSimple className="h-6 w-6" />
              </span>
              <p className="mt-4 font-semibold text-graphite-800 dark:text-graphite-100">{m.dropTitle}</p>
              <p className="mt-1 text-xs text-graphite-400 dark:text-graphite-500">{m.dropSub}</p>
              {!audioFile && (
                <span className="mt-4 rounded-xl bg-graphite-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-graphite-900">
                  {m.chooseFile}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,.mp3"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            {audioFile && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                <span className="truncate text-sm font-medium text-graphite-800 dark:text-graphite-100">
                  {audioFile.name}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-500/20"
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
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-cyan-500 px-6 py-4 text-base font-bold text-white shadow-xl shadow-brand-500/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            <Clock className="h-5 w-5" />
            {m.startSyncing}
          </button>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-graphite-900 px-5 py-3 text-sm font-medium text-white shadow-2xl dark:bg-white dark:text-graphite-900">
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  /* ================= SYNC PHASE ================= */
  return (
    <div className="mx-auto max-w-4xl" dir={locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr'}>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={backToForm}
          className="inline-flex items-center gap-1.5 rounded-xl border border-graphite-200 px-3.5 py-2 text-sm font-medium text-graphite-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-graphite-700 dark:text-graphite-300"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {m.backToForm}
        </button>
        <p className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-bold tabular-nums text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          {m.linesTagged.replace('{done}', String(taggedCount)).replace('{total}', String(totalCount))}
        </p>
      </div>

      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-graphite-900 dark:text-white">
        {title || 'Untitled'}
      </h1>
      {(artist || author) && (
        <p className="mt-1 text-graphite-500 dark:text-graphite-400">
          {[artist, author].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Player */}
      <div className="mt-6 rounded-3xl border border-graphite-200 bg-white p-5 dark:border-graphite-800 dark:bg-graphite-900">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110 active:scale-95"
          >
            {isPlaying ? <Pause className="h-6 w-6" weight="fill" /> : <Play className="h-6 w-6" weight="fill" />}
          </button>
          <div className="flex-1">
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
              className="slider w-full"
              style={{ ['--fill' as string]: `${seekPct}%` }}
              aria-label="Seek"
            />
            <div className="mt-1 flex justify-between text-xs font-medium tabular-nums text-graphite-400">
              <span>{fmtClock(currentTime)}</span>
              <span>{fmtClock(duration)}</span>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? m.unmute : m.mute}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-graphite-500 transition hover:bg-graphite-100 hover:text-graphite-800 dark:text-graphite-400 dark:hover:bg-graphite-800"
            >
              {muted || volume === 0 ? <SpeakerX className="h-5 w-5" /> : <SpeakerHigh className="h-5 w-5" />}
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
              className="slider w-24"
              style={{ ['--fill' as string]: `${muted ? 0 : volume}%` }}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>

      <p className="mt-5 rounded-2xl border border-brand-200/60 bg-brand-50/60 px-5 py-4 text-sm leading-relaxed text-graphite-600 dark:border-brand-500/20 dark:bg-brand-500/5 dark:text-graphite-300">
        {m.tapHint}
      </p>

      {/* Offset */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-graphite-200 bg-white px-5 py-4 dark:border-graphite-800 dark:bg-graphite-900">
        <span className="text-sm font-semibold text-graphite-700 dark:text-graphite-200">{m.offsetLabel}</span>
        <input
          type="number"
          step="0.1"
          value={offsetStr}
          onChange={(e) => setOffsetStr(e.target.value)}
          placeholder="±"
          disabled={taggedCount === 0}
          className="w-24 rounded-xl border border-graphite-200 bg-graphite-50 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-brand-400 disabled:opacity-40 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
        />
        <span className="text-sm text-graphite-400">{m.seconds}</span>
        <button
          type="button"
          onClick={applyOffset}
          disabled={taggedCount === 0}
          className="rounded-xl bg-graphite-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-graphite-700 disabled:opacity-40 dark:bg-white dark:text-graphite-900 dark:hover:bg-graphite-200"
        >
          {m.apply}
        </button>
        <span className="w-full text-xs text-graphite-400 dark:text-graphite-500">{m.offsetHint}</span>
      </div>

      {/* Lines */}
      <div className="mt-4 space-y-2">
        {lines.map((line, i) => {
          const isActive = i === activeIdx && line.time != null;
          const isEditing = editingId === line.id;
          return (
            <div
              key={line.id}
              ref={(el) => {
                if (el) lineRefs.current.set(line.id, el);
                else lineRefs.current.delete(line.id);
              }}
              className={`rounded-2xl border px-4 py-3 transition ${
                isActive
                  ? 'border-brand-400 bg-brand-50 shadow-md shadow-brand-500/10 dark:border-brand-500/50 dark:bg-brand-500/10'
                  : 'border-graphite-200 bg-white dark:border-graphite-800 dark:bg-graphite-900'
              }`}
            >
              {isEditing ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="mm:ss.xx"
                    title={m.editTimeTitle}
                    dir="ltr"
                    className="w-32 rounded-lg border border-graphite-200 bg-graphite-50 px-3 py-2 font-mono text-sm outline-none focus:border-brand-400 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
                  />
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    dir="auto"
                    className="flex-1 rounded-lg border border-graphite-200 bg-graphite-50 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-graphite-700 dark:bg-graphite-800 dark:text-white"
                  />
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      aria-label="Save"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:brightness-110"
                    >
                      <Check className="h-4 w-4" weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-graphite-200 text-graphite-500 transition hover:bg-graphite-100 dark:border-graphite-700 dark:hover:bg-graphite-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => tagLine(line.id)}
                    title={m.tagNext}
                    dir="ltr"
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums transition ${
                      line.time != null
                        ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30 hover:brightness-110'
                        : 'bg-graphite-100 text-graphite-400 hover:bg-brand-100 hover:text-brand-700 dark:bg-graphite-800 dark:text-graphite-500 dark:hover:bg-brand-500/20 dark:hover:text-brand-300'
                    }`}
                  >
                    {line.time != null ? formatLrcTime(line.time) : '[00:00.00]'}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekLine(line)}
                    dir="auto"
                    className={`flex-1 truncate text-start text-sm ${
                      line.time != null
                        ? 'font-medium text-graphite-800 hover:text-brand-600 dark:text-graphite-100 dark:hover:text-brand-300'
                        : 'text-graphite-400 dark:text-graphite-500'
                    }`}
                  >
                    {line.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(line)}
                    title={m.editLine}
                    aria-label={m.editLine}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-graphite-400 transition hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-graphite-800 dark:hover:text-graphite-200"
                  >
                    <PencilSimpleLine className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {taggedCount < totalCount && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          {m.linesNeedTag.replace('{n}', String(totalCount - taggedCount))}
        </p>
      )}

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveLocal}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
            savedFlag
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-graphite-900 text-white hover:bg-graphite-700 dark:bg-white dark:text-graphite-900 dark:hover:bg-graphite-200'
          }`}
        >
          <FloppyDisk className="h-4 w-4" />
          {savedFlag ? m.saved : m.saveLrc}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={taggedCount < 2}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:opacity-40 disabled:saturate-50"
        >
          <DownloadSimple className="h-4 w-4" />
          {m.downloadLrc}
        </button>
        <button
          type="button"
          onClick={copyText}
          disabled={taggedCount < 2}
          className="inline-flex items-center gap-2 rounded-xl border border-graphite-200 px-5 py-3 text-sm font-semibold text-graphite-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-graphite-200"
        >
          <CopySimple className="h-4 w-4" />
          {m.copyContent}
        </button>
        <button
          type="button"
          onClick={copyJson}
          disabled={taggedCount < 2}
          className="inline-flex items-center gap-2 rounded-xl border border-graphite-200 px-5 py-3 text-sm font-semibold text-graphite-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 dark:border-graphite-700 dark:text-graphite-200"
        >
          <BracketsCurly className="h-4 w-4" />
          {m.copyJson}
        </button>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={tagNext}
        title={m.tagNext}
        aria-label={m.tagNext}
        className="group fixed bottom-6 end-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-cyan-500 text-white shadow-2xl shadow-brand-500/40 transition hover:brightness-110 active:scale-95"
      >
        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand-500"></span>
        <Clock className="relative h-7 w-7" weight="bold" />
      </button>

      {toast && (
        <div
          key={toast.key}
          className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-graphite-900 px-5 py-3 text-center text-sm font-medium text-white shadow-2xl dark:bg-white dark:text-graphite-900"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
