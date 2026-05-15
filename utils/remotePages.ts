import { AnnouncementPrayerTrigger, DuaWeekday, RemoteManagedPage } from '../types';

export interface RemoteDisplaySlide {
  id: string;
  pageId: string;
  title: string;
  type: RemoteManagedPage['type'];
  content: string;
  imageUrl: string | null;
  backgroundImage: string | null;
  accentColor: string;
  textAlign: 'center' | 'right';
  chunkIndex: number;
  chunkCount: number;
}

export interface FilterRemotePagesOptions {
  weekday?: DuaWeekday;
  prayerId?: AnnouncementPrayerTrigger | null;
  includeGeneral?: boolean;
}

const DEFAULT_ACCENT_BY_TYPE: Record<RemoteManagedPage['type'], string> = {
  dua: '#d4af37',
  quran: '#4fd1c5',
  announcement: '#f97316',
  custom_text: '#7dd3fc',
  image: '#f5f5f4'
};

export const ALL_REMOTE_PAGE_WEEKDAYS: DuaWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

const PRAYER_ORDER: AnnouncementPrayerTrigger[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const normalizeRemotePageWeekdays = (weekdays?: DuaWeekday[] | null): DuaWeekday[] => {
  const normalized = (Array.isArray(weekdays) ? weekdays : [])
    .filter((weekday): weekday is DuaWeekday => ALL_REMOTE_PAGE_WEEKDAYS.includes(weekday as DuaWeekday));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...ALL_REMOTE_PAGE_WEEKDAYS];
};

export const normalizeRemotePagePrayerTriggers = (
  prayerTriggers?: AnnouncementPrayerTrigger[] | null
): AnnouncementPrayerTrigger[] => {
  const normalized = (Array.isArray(prayerTriggers) ? prayerTriggers : [])
    .filter((prayerId): prayerId is AnnouncementPrayerTrigger => PRAYER_ORDER.includes(prayerId as AnnouncementPrayerTrigger));

  return Array.from(new Set(normalized));
};

export const getRemotePageWeekdayKey = (date: Date = new Date()): DuaWeekday => {
  const map: DuaWeekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()] || 'sunday';
};

export const isRemotePageAllowedOnWeekday = (page: RemoteManagedPage, weekday: DuaWeekday): boolean => {
  return normalizeRemotePageWeekdays(page.weekdays).includes(weekday);
};

export const matchesRemotePagePrayer = (
  page: RemoteManagedPage,
  prayerId?: AnnouncementPrayerTrigger | null
): boolean => {
  if (page.placement !== 'after_prayer') return false;
  if (!prayerId) return false;
  return normalizeRemotePagePrayerTriggers(page.prayerTriggers).includes(prayerId);
};

const getPlacementSortValue = (page: RemoteManagedPage) => {
  if (page.placement === 'general') return 0;
  const firstTrigger = normalizeRemotePagePrayerTriggers(page.prayerTriggers)[0];
  return 10 + Math.max(PRAYER_ORDER.indexOf(firstTrigger || 'fajr'), 0);
};

const splitParagraphByWords = (paragraph: string, maxWords: number, maxChars: number): string[] => {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && paragraph.length <= maxChars) {
    return [paragraph.trim()];
  }

  const chunks: string[] = [];
  let currentWords: string[] = [];

  words.forEach((word) => {
    const candidate = [...currentWords, word].join(' ');
    if (currentWords.length > 0 && (currentWords.length >= maxWords || candidate.length > maxChars)) {
      chunks.push(currentWords.join(' ').trim());
      currentWords = [word];
      return;
    }
    currentWords.push(word);
  });

  if (currentWords.length > 0) {
    chunks.push(currentWords.join(' ').trim());
  }

  return chunks.filter(Boolean);
};

const normalizeParagraphs = (content: string): string[] => {
  const paragraphs = String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs;

  return String(content || '')
    .split(/(?<=[،؛:,.!؟…])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const splitTextForSlides = (page: RemoteManagedPage): string[] => {
  const content = String(page.content || '').trim();
  if (!content) return [''];
  if (!page.autoSplit) return [content];
  if (page.type === 'image') return [''];

  const maxChars =
    page.type === 'announcement' ? 260
    : page.type === 'quran' ? 380
    : page.type === 'dua' ? 520
    : 440;
  const maxWords =
    page.type === 'announcement' ? 34
    : page.type === 'quran' ? 52
    : page.type === 'dua' ? 72
    : 56;
  const maxParagraphs =
    page.type === 'announcement' ? 2
    : page.type === 'quran' ? 3
    : page.type === 'dua' ? 4
    : 3;

  const paragraphs = normalizeParagraphs(content).flatMap((paragraph) => splitParagraphByWords(paragraph, maxWords, maxChars));
  if (paragraphs.length <= maxParagraphs) {
    return [paragraphs.join('\n\n').trim()];
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  paragraphs.forEach((paragraph) => {
    const nextLength = currentLength + paragraph.length;
    if (current.length > 0 && (current.length >= maxParagraphs || nextLength > maxChars * maxParagraphs)) {
      chunks.push(current.join('\n\n').trim());
      current = [paragraph];
      currentLength = paragraph.length;
      return;
    }

    current.push(paragraph);
    currentLength = nextLength;
  });

  if (current.length > 0) {
    chunks.push(current.join('\n\n').trim());
  }

  return chunks.filter(Boolean);
};

export const sortRemotePages = (pages: RemoteManagedPage[]): RemoteManagedPage[] => {
  return [...pages].sort((left, right) => {
    const leftPlacement = getPlacementSortValue(left);
    const rightPlacement = getPlacementSortValue(right);
    if (leftPlacement !== rightPlacement) return leftPlacement - rightPlacement;

    const leftOrder = Number.isFinite(left.groupOrder) ? left.groupOrder : left.order;
    const rightOrder = Number.isFinite(right.groupOrder) ? right.groupOrder : right.order;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    if (left.order !== right.order) return left.order - right.order;
    return left.title.localeCompare(right.title, 'ar');
  });
};

export const renumberRemotePages = (pages: RemoteManagedPage[]): RemoteManagedPage[] => {
  return sortRemotePages(pages).map((page, index) => ({
    ...page,
    order: index + 1,
    groupOrder: Number.isFinite(page.groupOrder) ? Number(page.groupOrder) : index + 1,
    weekdays: normalizeRemotePageWeekdays(page.weekdays),
    prayerTriggers: normalizeRemotePagePrayerTriggers(page.prayerTriggers)
  }));
};

export const filterRemotePagesForContext = (
  pages: RemoteManagedPage[],
  options: FilterRemotePagesOptions = {}
): RemoteManagedPage[] => {
  const weekday = options.weekday || getRemotePageWeekdayKey();
  const includeGeneral = options.includeGeneral !== false;

  return renumberRemotePages(
    pages.filter((page) => {
      if (!page.enabled) return false;
      if (!isRemotePageAllowedOnWeekday(page, weekday)) return false;

      if (page.placement === 'general') {
        return includeGeneral;
      }

      return matchesRemotePagePrayer(page, options.prayerId);
    })
  );
};

export const buildRemoteDisplaySlides = (pages: RemoteManagedPage[]): RemoteDisplaySlide[] => {
  const orderedPages = renumberRemotePages(pages.filter((page) => page.enabled));

  return orderedPages.flatMap((page) => {
    const chunks = splitTextForSlides(page);
    const chunkCount = Math.max(1, chunks.length);

    return chunks.map((content, index) => ({
      id: `${page.id}_${index + 1}`,
      pageId: page.id,
      title: page.title,
      type: page.type,
      content,
      imageUrl: page.imageUrl || null,
      backgroundImage: page.backgroundImage || null,
      accentColor: page.accentColor || DEFAULT_ACCENT_BY_TYPE[page.type],
      textAlign: page.textAlign || 'center',
      chunkIndex: index,
      chunkCount
    }));
  });
};

export const mergeRemotePages = (
  globalPages: RemoteManagedPage[],
  mosquePages: RemoteManagedPage[]
): RemoteManagedPage[] => {
  const normalizedGlobal = renumberRemotePages(globalPages).map((page, index) => ({
    ...page,
    id: page.id.startsWith('global_') ? page.id : `global_${page.id}`,
    order: index + 1
  }));

  const normalizedMosque = renumberRemotePages(mosquePages).map((page, index) => ({
    ...page,
    order: normalizedGlobal.length + index + 1
  }));

  return [...normalizedGlobal, ...normalizedMosque];
};

export const reorderRemotePages = (
  pages: RemoteManagedPage[],
  sourcePageId: string,
  targetPageId: string
): RemoteManagedPage[] => {
  if (!sourcePageId || !targetPageId || sourcePageId === targetPageId) {
    return renumberRemotePages(pages);
  }

  const ordered = renumberRemotePages(pages);
  const sourceIndex = ordered.findIndex((page) => page.id === sourcePageId);
  const targetIndex = ordered.findIndex((page) => page.id === targetPageId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return ordered;
  }

  const next = [...ordered];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);

  return renumberRemotePages(
    next.map((page, index) => ({
      ...page,
      groupOrder: index + 1
    }))
  );
};

export const createRemotePageDraft = (index: number, type: RemoteManagedPage['type'] = 'dua'): RemoteManagedPage => ({
  id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  title:
    type === 'announcement' ? 'إعلان جديد'
    : type === 'quran' ? 'آية أو مقطع'
    : type === 'image' ? 'صورة'
    : 'صفحة جديدة',
  content: '',
  order: index + 1,
  groupOrder: index + 1,
  enabled: true,
  autoSplit: type !== 'image',
  placement: 'general',
  prayerTriggers: [],
  weekdays: [...ALL_REMOTE_PAGE_WEEKDAYS],
  accentColor: DEFAULT_ACCENT_BY_TYPE[type],
  backgroundImage: null,
  imageUrl: null,
  textAlign: 'center'
});
