import { useCallback, useEffect, useMemo, useState } from 'react';
import { DuaDisplaySlot, RamadanDuaItem } from '../types';
import { getDuaWeekdayKey, isDuaAllowedOnWeekday } from '../data/ramadanDuaLibrary';

interface PlaybackOptions {
  duas: RamadanDuaItem[];
  order: string[];
  forcedDuaId?: string | null;
  contextSlot?: DuaDisplaySlot | null;
  chunkCharLimit?: number;
  autoRotate: boolean;
  advanceMode: 'manual' | 'auto';
  lineDurationSec: number;
  enabled: boolean;
}

const splitChunkByWords = (value: string, limit: number): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const splitLongToken = (token: string): string[] => {
    if (token.length <= limit) return [token];
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < token.length) {
      chunks.push(token.slice(cursor, cursor + limit));
      cursor += limit;
    }
    return chunks;
  };

  const chunks: string[] = [];
  let current = '';

  words.forEach((word) => {
    const pieces = splitLongToken(word);

    pieces.forEach((piece) => {
      const candidate = current ? `${current} ${piece}` : piece;
      if (candidate.length > limit && current) {
        chunks.push(current.trim());
        current = piece;
        return;
      }
      current = candidate;
    });
  });

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
};

const splitLines = (text: string, chunkCharLimit = 72): string[] => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
  if (!normalized) return [];

  const safeChunkLimit = Math.max(8, Math.min(140, Math.round(chunkCharLimit || 72)));

  return normalized
    .split(/\n+/)
    .flatMap((paragraph) => {
      const compact = paragraph.replace(/\s+/g, ' ').trim();
      if (!compact) return [];

      return compact.length > safeChunkLimit ? splitChunkByWords(compact, safeChunkLimit) : [compact];
    })
    .filter(Boolean);
};

const hasSlot = (dua: RamadanDuaItem, slot?: DuaDisplaySlot | null) => {
  if (!slot || slot === 'general') return true;
  const slots = Array.isArray(dua.slots) ? dua.slots : [];
  return slots.includes(slot);
};

export const useRamadanDuaPlayback = ({
  duas,
  order,
  forcedDuaId,
  contextSlot = null,
  chunkCharLimit = 72,
  autoRotate,
  advanceMode,
  lineDurationSec,
  enabled
}: PlaybackOptions) => {
  const orderedDuas = useMemo(() => {
    const byId = new Map(duas.map((dua) => [dua.id, dua]));
    const fromOrder = order.map((id) => byId.get(id)).filter((dua): dua is RamadanDuaItem => Boolean(dua));
    const orderedIds = new Set(order);
    const missing = duas.filter((dua) => !orderedIds.has(dua.id));
    return [...fromOrder, ...missing];
  }, [duas, order]);

  const [weekdayKey, setWeekdayKey] = useState(() => getDuaWeekdayKey(new Date()));

  useEffect(() => {
    const refreshWeekday = () => {
      setWeekdayKey(getDuaWeekdayKey(new Date()));
    };

    refreshWeekday();
    const timer = window.setInterval(refreshWeekday, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeDuas = useMemo(() => orderedDuas.filter((dua) => dua.active), [orderedDuas]);
  const weekdayDuas = useMemo(
    () => activeDuas.filter((dua) => isDuaAllowedOnWeekday(dua, weekdayKey)),
    [activeDuas, weekdayKey]
  );
  const slotDuas = useMemo(() => weekdayDuas.filter((dua) => hasSlot(dua, contextSlot)), [weekdayDuas, contextSlot]);

  const playlist = useMemo(() => {
    if (!enabled) return [];
    if (forcedDuaId) {
      const forced = orderedDuas.find((dua) => dua.id === forcedDuaId);
      return forced ? [forced] : [];
    }
    if (contextSlot) return slotDuas;
    if (slotDuas.length > 0) return slotDuas;
    return weekdayDuas;
  }, [contextSlot, enabled, forcedDuaId, orderedDuas, slotDuas, weekdayDuas]);

  const [duaIndex, setDuaIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    setDuaIndex(0);
    setLineIndex(0);
    setTransitionKey((prev) => prev + 1);
  }, [chunkCharLimit, contextSlot, forcedDuaId, playlist.length]);

  const currentDua = playlist[duaIndex];
  const lines = useMemo(
    () => (currentDua ? splitLines(currentDua.text, chunkCharLimit) : []),
    [chunkCharLimit, currentDua?.id, currentDua?.text]
  );
  const currentLine = lines[lineIndex] || '';

  useEffect(() => {
    if (lines.length === 0) return;
    if (lineIndex <= lines.length - 1) return;
    setLineIndex(lines.length - 1);
    setTransitionKey((prev) => prev + 1);
  }, [lineIndex, lines.length]);

  const jumpToLine = useCallback((targetIndex: number) => {
    if (!currentDua || lines.length === 0) return;
    const safeIndex = Math.max(0, Math.min(lines.length - 1, Math.round(targetIndex)));
    setLineIndex(safeIndex);
    setTransitionKey((prev) => prev + 1);
  }, [currentDua, lines.length]);

  const goToNextDua = useCallback((trigger: 'user' | 'auto' = 'user') => {
    if (playlist.length <= 1) return;

    if (trigger === 'auto') {
      if (!autoRotate) return;
      setDuaIndex((prev) => (prev + 1) % playlist.length);
      setLineIndex(0);
      setTransitionKey((prev) => prev + 1);
      return;
    }

    if (duaIndex >= playlist.length - 1) {
      if (!autoRotate) return;
      setDuaIndex(0);
      setLineIndex(0);
      setTransitionKey((prev) => prev + 1);
      return;
    }

    setDuaIndex((prev) => prev + 1);
    setLineIndex(0);
    setTransitionKey((prev) => prev + 1);
  }, [autoRotate, duaIndex, playlist.length]);

  const goToPreviousDua = useCallback(() => {
    if (playlist.length <= 1) return;

    if (duaIndex === 0) {
      if (!autoRotate) return;
      const previousDua = playlist[playlist.length - 1];
      const previousLines = splitLines(previousDua.text, chunkCharLimit);
      setDuaIndex(playlist.length - 1);
      setLineIndex(Math.max(0, previousLines.length - 1));
      setTransitionKey((prev) => prev + 1);
      return;
    }

    const previousDuaIndex = duaIndex - 1;
    const previousDua = playlist[previousDuaIndex];
    const previousLines = splitLines(previousDua.text, chunkCharLimit);

    setDuaIndex(previousDuaIndex);
    setLineIndex(Math.max(0, previousLines.length - 1));
    setTransitionKey((prev) => prev + 1);
  }, [autoRotate, chunkCharLimit, duaIndex, playlist]);

  const goNext = useCallback((trigger: 'user' | 'auto' = 'user') => {
    if (!currentDua || lines.length === 0) return;

    if (lineIndex < lines.length - 1) {
      setLineIndex((prev) => prev + 1);
      setTransitionKey((prev) => prev + 1);
      return;
    }

    goToNextDua(trigger);
  }, [currentDua, goToNextDua, lineIndex, lines.length]);

  const goPrev = useCallback(() => {
    if (!currentDua || lines.length === 0) return;

    if (lineIndex > 0) {
      setLineIndex((prev) => prev - 1);
      setTransitionKey((prev) => prev + 1);
      return;
    }

    goToPreviousDua();
  }, [currentDua, goToPreviousDua, lineIndex, lines.length]);

  useEffect(() => {
    if (!enabled || !currentDua || advanceMode !== 'auto') return;

    const activeDurationSec = currentDua.lineDurationSec ?? lineDurationSec;
    if (activeDurationSec <= 0) return;

    const timer = window.setTimeout(() => {
      goNext('auto');
    }, Math.max(1, activeDurationSec) * 1000);

    return () => window.clearTimeout(timer);
  }, [advanceMode, autoRotate, currentDua, currentLine, duaIndex, enabled, goNext, lineDurationSec, lineIndex]);

  return {
    playlist,
    currentDua,
    currentLine,
    lines,
    lineIndex,
    duaIndex,
    transitionKey,
    jumpToLine,
    goToNextDua,
    goToPreviousDua,
    goNext,
    goPrev
  };
};
