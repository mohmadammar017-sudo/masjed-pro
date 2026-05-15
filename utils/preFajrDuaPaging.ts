export interface PreFajrDuaSegment {
  subtitle: string;
  text: string;
  isSpecial?: boolean;
}

export interface PreFajrDuaPage {
  key: string;
  subtitle: string;
  text: string;
  segmentIndex: number;
  partIndex: number;
  isSpecial?: boolean;
}

const splitChunkByWords = (value: string, maxWords: number, maxChars: number): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];

  words.forEach((word) => {
    const next = [...current, word];
    const candidate = next.join(' ');
    if (current.length > 0 && (next.length > maxWords || candidate.length > maxChars)) {
      chunks.push(current.join(' '));
      current = [word];
      return;
    }
    current = next;
  });

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return chunks;
};

export const splitPreFajrDuaUnits = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  return normalized
    .split(/(?<=[،؛:,.!؟…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const words = part.split(/\s+/).filter(Boolean);
      if (words.length <= 7 && part.length <= 54) {
        return [part];
      }
      return splitChunkByWords(part, 6, 42);
    });
};

export const paginatePreFajrDuaSegments = (
  segments: PreFajrDuaSegment[],
  fits: (text: string) => boolean
): PreFajrDuaPage[] => {
  const pages: PreFajrDuaPage[] = [];

  segments.forEach((segment, segmentIndex) => {
    if (segment.isSpecial) {
      pages.push({
        key: `${segmentIndex}-0-special`,
        subtitle: segment.subtitle,
        text: segment.text,
        segmentIndex,
        partIndex: 0,
        isSpecial: true
      });
      return;
    }

    const units = splitPreFajrDuaUnits(segment.text);
    if (units.length === 0) {
      pages.push({
        key: `${segmentIndex}-0-empty`,
        subtitle: segment.subtitle,
        text: '',
        segmentIndex,
        partIndex: 0
      });
      return;
    }

    let currentUnits: string[] = [];
    let partIndex = 0;

    const flush = () => {
      if (currentUnits.length === 0) return;
      pages.push({
        key: `${segmentIndex}-${partIndex}`,
        subtitle: segment.subtitle,
        text: currentUnits.join(' '),
        segmentIndex,
        partIndex
      });
      partIndex += 1;
      currentUnits = [];
    };

    units.forEach((unit) => {
      const candidateUnits = [...currentUnits, unit];
      const candidateText = candidateUnits.join(' ');

      if (currentUnits.length > 0 && !fits(candidateText)) {
        flush();
        currentUnits = [unit];
        return;
      }

      currentUnits = candidateUnits;
    });

    flush();
  });

  return pages;
};
