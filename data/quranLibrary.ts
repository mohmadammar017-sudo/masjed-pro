import { QuranReciter, QuranSettings, QuranTrack } from '../types';

export const CUSTOM_QURAN_RECITER_ID = 'local_uploads';

export const DEFAULT_QURAN_SETTINGS: QuranSettings = {
  enabled: false,
  selectedReciterId: 'menshawy',
  volume: 0.9,
  uploadedTracks: []
};

export const QURAN_RECITERS: QuranReciter[] = [
  {
    id: 'menshawy',
    name: 'الشيخ محمد صديق المنشاوي',
    description: 'تلاوات مختارة بصوت هادئ وواضح مناسب لوضع القرآن في المسجد',
    tracks: [
      {
        id: 'baqarah-158-178',
        title: 'سورة البقرة',
        subtitle: 'الآيات 158 - 178',
        audioSrc: 'audio/quran/al-minshawi-al-baqarah-158-178.mp3'
      },
      {
        id: 'dhariyat-31-58',
        title: 'سورة الذاريات',
        subtitle: 'الآيات 31 - 58',
        audioSrc: 'audio/quran/al-minshawi-adh-dhariyat-31-58.mp3'
      }
    ]
  }
];

const sanitizeTrackId = (value: string, index: number): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || `uploaded_track_${index + 1}`;
};

const sanitizeTrackLabel = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const sanitizeAudioSrc = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUploadedTracks = (incoming: unknown): QuranTrack[] => {
  if (!Array.isArray(incoming)) return [];

  const seenIds = new Set<string>();
  const normalized: QuranTrack[] = [];

  incoming.forEach((track, index) => {
    if (!track || typeof track !== 'object') return;

    const source = sanitizeAudioSrc((track as Partial<QuranTrack>).audioSrc);
    if (!source) return;

    const rawId = sanitizeTrackId(String((track as Partial<QuranTrack>).id || ''), index);
    const dedupedId = seenIds.has(rawId) ? `${rawId}_${index + 1}` : rawId;
    seenIds.add(dedupedId);

    normalized.push({
      id: dedupedId,
      title: sanitizeTrackLabel((track as Partial<QuranTrack>).title, `تلاوة مضافة ${index + 1}`),
      subtitle: sanitizeTrackLabel((track as Partial<QuranTrack>).subtitle, 'ملف صوتي خارجي'),
      audioSrc: source
    });
  });

  return normalized;
};

export const normalizeQuranSettings = (incoming?: Partial<QuranSettings> | null): QuranSettings => {
  const uploadedTracks = normalizeUploadedTracks(incoming?.uploadedTracks);
  const requestedReciterId =
    typeof incoming?.selectedReciterId === 'string' && incoming.selectedReciterId.trim().length > 0
      ? incoming.selectedReciterId.trim()
      : DEFAULT_QURAN_SETTINGS.selectedReciterId;

  const hasBuiltInReciter = QURAN_RECITERS.some((reciter) => reciter.id === requestedReciterId);
  const hasLocalUploadsReciter = requestedReciterId === CUSTOM_QURAN_RECITER_ID && uploadedTracks.length > 0;
  const selectedReciterId =
    hasBuiltInReciter || hasLocalUploadsReciter ? requestedReciterId : DEFAULT_QURAN_SETTINGS.selectedReciterId;

  return {
    ...DEFAULT_QURAN_SETTINGS,
    ...(incoming || {}),
    selectedReciterId,
    uploadedTracks
  };
};

export const getQuranReciters = (settings?: Partial<QuranSettings> | null): QuranReciter[] => {
  const normalized = normalizeQuranSettings(settings);
  if (normalized.uploadedTracks.length <= 0) return QURAN_RECITERS;

  const uploadedReciter: QuranReciter = {
    id: CUSTOM_QURAN_RECITER_ID,
    name: 'تلاوات مضافة',
    description: 'ملفات صوتية تم إضافتها من جهازك',
    tracks: normalized.uploadedTracks
  };

  return [...QURAN_RECITERS, uploadedReciter];
};

export const getQuranReciter = (settings?: Partial<QuranSettings> | null): QuranReciter => {
  const normalized = normalizeQuranSettings(settings);
  const reciters = getQuranReciters(normalized);
  return reciters.find((reciter) => reciter.id === normalized.selectedReciterId) || reciters[0];
};
