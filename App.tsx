import React, { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Settings, Star, User } from 'lucide-react';
import { DEFAULT_ADHAN_SETTINGS, DEFAULT_PRAYER_SETTINGS, INITIAL_PRAYER_SCHEDULE, MOSQUE_INFO, OCCASION_DATA } from './constants';
import {
  BEFORE_PRAYER_SLOT_BY_PRAYER,
  getDuaWeekdayKey,
  isDuaAllowedOnWeekday,
  normalizeRamadanDuaSystemSettings
} from './data/ramadanDuaLibrary';
import { getQuranReciters, normalizeQuranSettings } from './data/quranLibrary';
import NextPrayerCountdown from './components/NextPrayerCountdown';
import PrayerCard from './components/PrayerCard';
import PreAdhanTransition from './components/PreAdhanTransition';
import RamadanBackground from './components/RamadanBackground';
import MosqueCodeGate from './components/MosqueCodeGate';
import MosqueLaunchpad from './components/MosqueLaunchpad';
import { RAMADAN_1446_SCHEDULE } from './ramadan_schedule';
import {
  AdhanSettings,
  AnnouncementPrayerTrigger,
  AnnouncementSettings,
  DuaDisplaySlot,
  MonthlySchedule,
  MosqueInfo,
  Occasion,
  PrayerSettings,
  PrayerTime,
  RamadanDuaItem,
  RemoteGlobalConfig,
  RemoteManagedPage,
  RemotePrayerFlowItem,
  RemotePrayerFlowMap,
  RemoteMosqueDocument
} from './types';
import { fileToDataUrl, formatDateAR, formatTime, getAmPm, getHijriDay, getMinutesSinceMidnight, timeStringToMinutes } from './utils';
import { flushConfigStore, getStoredJson, getStoredNumber, getStoredString, removeStoredValue, setStoredJson, setStoredNumber, setStoredString } from './utils/configStore';
import { findMosqueByCode, normalizeRemoteMosqueDocument, subscribeGlobalConfig, subscribeMosqueByCode } from './services/remoteMosqueService';
import { filterRemotePagesForContext, getRemotePageWeekdayKey, mergeRemotePages } from './utils/remotePages';
import { getDefaultPrayerFlows, normalizePrayerFlows } from './utils/remotePrayerFlows';

interface RemoteControlStatus {
  running: boolean;
  ipAddress: string;
  port: number;
  url: string;
  qrCodeDataUrl: string | null;
  pin: string;
  clientCount: number;
}

type MobileRemoteCommandType =
  | 'NEXT_SURAH'
  | 'PREVIOUS_SURAH'
  | 'PLAY_QURAN'
  | 'STOP_QURAN'
  | 'NEXT_DUA'
  | 'PREVIOUS_DUA'
  | 'CHANGE_MODE'
  | 'GO_HOME'
  | 'BACK'
  | 'NEXT_PAGE'
  | 'PREVIOUS_PAGE'
  | 'SET_DUA_ACTIVE'
  | 'PREVIEW_DUA'
  | 'MOVE_DUA'
  | 'SET_DUA_SLOTS'
  | 'SET_DUA_LINE_DURATION'
  | 'SET_DUA_FONT_SCALE'
  | 'SET_QURAN_RECITER'
  | 'SET_QURAN_TRACK_INDEX'
  | 'SET_IMAM_NAME'
  | 'SET_PRAYER_TIME'
  | 'SET_HOME_BACKGROUND_COLOR'
  | 'SET_HOME_OVERLAY_COLOR'
  | 'SET_HOME_OVERLAY_OPACITY'
  | 'SET_HOME_BACKGROUND_IMAGE_URL'
  | 'SET_APP_ZOOM';

interface MobileRemoteCommandMessage {
  command: MobileRemoteCommandType;
  payload?: {
    mode?: 'PRAYER' | 'DUA' | 'QURAN' | string;
    imamName?: string;
    duaId?: string;
    active?: boolean;
    direction?: number;
    slots?: string[];
    lineDurationSec?: number | null;
    fontScale?: number;
    reciterId?: string;
    trackIndex?: number;
    prayerId?: string;
    time?: string;
    color?: string;
    opacity?: number;
    imageUrl?: string | null;
    zoomFactor?: number;
  };
  source?: string;
  receivedAt?: number;
}

declare global {
  interface Window {
    electron?: {
      zoom: {
        set: (factor: number) => Promise<number>;
        get: () => Promise<number>;
        getSmartLevel: () => Promise<number>;
      };
      remoteControl?: {
        getStatus: () => Promise<RemoteControlStatus>;
        onStatus: (callback: (status: RemoteControlStatus) => void) => () => void;
        onCommand: (callback: (command: MobileRemoteCommandMessage) => void) => () => void;
        publishState?: (state: unknown) => void;
      };
    };
  }
}

type AppView = 'launcher' | 'home' | 'dashboard' | 'adhan' | 'prayer' | 'tasbeeh' | 'quranVerse' | 'quran' | 'ghufaylah' | 'duaAhd' | 'duaSabah' | 'ramadanDuas' | 'announcement' | 'remotePages';
type HomeMode = 'prayer' | 'dua' | 'quran';
type RemoteMode = 'AUTO' | 'PRAYER' | 'DUA' | 'QURAN';
type RemoteKey = 'PageUp' | 'PageDown' | 'Space' | 'ArrowUp' | 'ArrowDown' | 'ArrowRight' | 'ArrowLeft' | 'Escape' | 'F5' | 'B' | 'Period';
type QuranRemoteCommandType = 'nextSurah' | 'previousSurah' | 'stopPlayback';
type AnnouncementExitPlan = { type: 'pop' } | { type: 'resumeSequence'; prayerId: PrayerSequenceId };

interface QuranRemoteCommand {
  id: number;
  type: QuranRemoteCommandType;
}

interface ActivePrayerFlow {
  prayerId: PrayerSequenceId;
  items: RemotePrayerFlowItem[];
  index: number;
  nextPrayerIdOnFinish: PrayerSequenceId | null;
}

const VALID_PRAYER_IDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type PrayerSequenceId = (typeof VALID_PRAYER_IDS)[number];
const isPrayerSequenceId = (value: string): value is PrayerSequenceId => (VALID_PRAYER_IDS as readonly string[]).includes(value);
const REMOTE_MODE_ORDER: RemoteMode[] = ['AUTO', 'PRAYER', 'DUA', 'QURAN'];
const REMOTE_MODE_TO_HOME_MODE: Record<RemoteMode, HomeMode> = {
  AUTO: 'prayer',
  PRAYER: 'prayer',
  DUA: 'dua',
  QURAN: 'quran'
};
const REMOTE_DUA_SLOT_SET = new Set<DuaDisplaySlot>([
  'general',
  'before_fajr',
  'before_dhuhr',
  'before_maghrib',
  'after_fajr',
  'after_dhuhr',
  'after_asr',
  'after_maghrib',
  'after_isha'
]);
const REMOTE_MODE_LABEL: Record<RemoteMode, string> = {
  AUTO: 'AUTO MODE',
  PRAYER: 'PRAYER MODE',
  DUA: 'DUA MODE',
  QURAN: 'QURAN MODE'
};
const REMOTE_LONG_PRESS_MS = 500;
const REMOTE_REPEAT_GUARD_MS = 120;
const HOME_MODE_INFO: Record<HomeMode, { icon: string; title: string; subtitle: string }> = {
  prayer: { icon: '🕌', title: 'وضع الصلاة', subtitle: 'عرض المواقيت والتنقّل لشاشات الصلاة' },
  dua: { icon: '📜', title: 'وضع الأدعية', subtitle: 'قائمة الأدعية والتنقّل بين الصفحات' },
  quran: { icon: '🎧', title: 'وضع القرآن', subtitle: 'تشغيل التلاوة والتحكم بالسور والصوت' }
};
const DYNAMIC_THEMES = {
  fajr: 'radial-gradient(circle at center, #1e3a8a 0%, #0f172a 100%)',
  day: 'radial-gradient(circle at center, #0ea5e9 0%, #0369a1 100%)',
  sunset: 'radial-gradient(circle at center, #c026d3 0%, #4a044e 100%)',
  night: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)'
};

const VALID_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REMOTE_MOSQUE_CODE_STORAGE_KEY = 'remoteMosqueCode';
const REMOTE_LOCAL_MODE_STORAGE_KEY = 'remoteLocalModeFallback';
const REMOTE_MOSQUE_CACHE_KEY = 'remoteMosqueCache';
const REMOTE_GLOBAL_CACHE_KEY = 'remoteGlobalCache';
const DEFAULT_REMOTE_GLOBAL_CONFIG: RemoteGlobalConfig = {
  pages: [],
  systemSettings: {
    prayerSettings: {
      mode: 'manual',
      city: 'Dammam',
      adjustments: {
        fajr: 0,
        dhuhr: 0,
        asr: 0,
        maghrib: 0,
        isha: 0
      },
      manualTimes: {
        fajr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'fajr')?.time || '04:56',
        dhuhr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'dhuhr')?.time || '12:03',
        asr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'asr')?.time || '',
        maghrib: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'maghrib')?.time || '17:35',
        isha: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'isha')?.time || ''
      }
    },
    schedule: [...(INITIAL_PRAYER_SCHEDULE as unknown as PrayerTime[])],
    monthlySchedule: null,
    theme: {
      homeBackgroundImage: null,
      homeBackgroundColor: '#020617',
      homeOverlayColor: '#000000',
      homeOverlayOpacity: 0.45
    },
    hijriOffset: 0
  },
  lastUpdated: 0
};

const normalizeTimeValue = (value?: string | null): string => {
  const trimmed = String(value || '').trim();
  return VALID_TIME_PATTERN.test(trimmed) ? trimmed : '';
};

const shiftTimeByMinutes = (timeValue: string, adjustmentMinutes = 0): string => {
  const normalized = normalizeTimeValue(timeValue);
  if (!normalized) return '';
  const [hours, minutes] = normalized.split(':').map(Number);
  const total = ((hours * 60) + minutes + adjustmentMinutes + (24 * 60)) % (24 * 60);
  const nextHours = Math.floor(total / 60);
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const buildScheduleFromRemoteMosque = (remoteMosque: RemoteMosqueDocument): PrayerTime[] => {
  const baseSchedule =
    Array.isArray(remoteMosque.displayConfig?.schedule) && remoteMosque.displayConfig.schedule.length > 0
      ? remoteMosque.displayConfig.schedule
      : (INITIAL_PRAYER_SCHEDULE as unknown as PrayerTime[]);

  return baseSchedule.map((prayer) => {
    const prayerId = prayer.id as keyof RemoteMosqueDocument['prayerSettings']['manualTimes'];
    const manualTime = remoteMosque.prayerSettings.manualTimes[prayerId] || prayer.time || '';
    const adjustedTime = shiftTimeByMinutes(
      manualTime,
      prayer.id === 'fajr' || prayer.id === 'dhuhr' || prayer.id === 'asr' || prayer.id === 'maghrib' || prayer.id === 'isha'
        ? Number(remoteMosque.prayerSettings.adjustments[prayer.id as keyof typeof remoteMosque.prayerSettings.adjustments] || 0)
        : 0
    );

    return {
      ...prayer,
      time: adjustedTime || normalizeTimeValue(manualTime)
    };
  });
};

const getRemoteKeyFromEvent = (event: KeyboardEvent): RemoteKey | null => {
  const key = event.key;
  const code = event.code;

  if (key === 'PageUp' || code === 'PageUp') return 'PageUp';
  if (key === 'PageDown' || code === 'PageDown') return 'PageDown';
  if (key === 'ArrowUp' || code === 'ArrowUp') return 'ArrowUp';
  if (key === 'ArrowDown' || code === 'ArrowDown') return 'ArrowDown';
  if (key === 'ArrowRight' || code === 'ArrowRight') return 'ArrowRight';
  if (key === 'ArrowLeft' || code === 'ArrowLeft') return 'ArrowLeft';
  if (key === 'Escape' || code === 'Escape') return 'Escape';
  if (key === 'F5' || code === 'F5') return 'F5';
  if (key === 'b' || key === 'B' || code === 'KeyB') return 'B';
  if (key === '.' || code === 'Period' || code === 'NumpadDecimal') return 'Period';

  return null;
};

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tagName = target.tagName;
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;

  if (tagName === 'INPUT') {
    const input = target as HTMLInputElement;
    if (input.disabled || input.readOnly) return false;
    return true;
  }

  return false;
};

const inferIsHijriSchedule = (monthName = '', days: { hijri_date?: string }[] = []) => {
  const text = `${monthName} ${days.map((d) => d.hijri_date || '').join(' ')}`.toLowerCase();
  return ['ramadan', 'رمضان', 'muharram', 'محرم', 'hijri', 'هجري'].some((keyword) => text.includes(keyword));
};

const DEPRECATED_RAMADAN_DAY_NUMBERS = new Set(Array.from({ length: 29 }, (_, index) => index + 2));

const KNOWN_ARABIC_MOJIBAKE_MAP: Record<string, string> = {
  'ظ…ط³ط¬ط¯ ط§ظ„ط¥ظ…ط§ظ… ط§ظ„ط­ط³ظٹظ†': 'مسجد الإمام الحسين',
  'ط­ظٹ ط§ظ„ط®ط±ط³': 'حي الخرس',
  'ط§ظ„ط´ظٹط® ط¹ظ„ظٹ ط±ط¶ط§': 'الشيخ علي رضا',
  'ظ…ظ†ط§ط³ط¨ط© ط§ظ„ظٹظˆظ…': 'مناسبة اليوم',
  'ظ…ظˆظ„ط¯ ط§ظ„ظ‚ط§ط³ظ… ط¨ظ† ط§ظ„ط¥ظ…ط§ظ… ط§ظ„ط­ط³ظ† (ط¹)': 'مولد القاسم بن الإمام الحسن (ع)',
  'ط§ظ„ط¥ظ…ط³ط§ظƒ': 'الإمساك',
  'ط§ظ„ظپط¬ط±': 'الفجر',
  'ط§ظ„ط´ط±ظˆظ‚': 'الشروق',
  'ط§ظ„ط¸ظ‡ط±': 'الظهر',
  'ط§ظ„ط¹طµط±': 'العصر',
  'ط§ظ„ظ…ط؛ط±ط¨': 'المغرب',
  'ط§ظ„ط¹ط´ط§ط،': 'العشاء',
  'ظ†ظ‡ط§ظٹط© ط§ظ„ط¹ط´ط§ط¦ظٹظ†': 'نهاية العشائين'
};

const fixKnownArabicMojibake = (value: string): string => KNOWN_ARABIC_MOJIBAKE_MAP[value] ?? value;

const sanitizeMonthlySchedule = (incoming: MonthlySchedule | null | undefined): MonthlySchedule | null => {
  if (!incoming || typeof incoming !== 'object') return null;
  if (!Array.isArray(incoming.days)) return incoming;

  const filteredDays = incoming.days.filter((day) => {
    const dayNumber = Number(day.day_number);
    if (!Number.isFinite(dayNumber) || !DEPRECATED_RAMADAN_DAY_NUMBERS.has(dayNumber)) {
      return true;
    }

    const hijriDate = fixKnownArabicMojibake(String(day.hijri_date || '')).toLowerCase();
    return !(hijriDate.includes('رمضان') || hijriDate.includes('ط±ظ…ط¶ط§ظ†'));
  });

  return {
    ...incoming,
    days: filteredDays
  };
};

const normalizeSavedImamNames = (names: unknown): string[] => {
  if (!Array.isArray(names)) return [];

  const uniqueNames = Array.from(
    new Set(
      names
        .filter((name): name is string => typeof name === 'string')
        .map((name) => fixKnownArabicMojibake(name.trim()))
        .filter(Boolean)
    )
  );

  if (uniqueNames.length <= 1) {
    return uniqueNames.slice(0, 20);
  }

  const compactNames = uniqueNames.map((name) => name.replace(/\s+/g, ''));
  const typingArtifacts = new Set<string>();

  compactNames.forEach((candidate, index) => {
    if (!candidate) return;
    const longerMatches = compactNames.reduce((count, current, currentIndex) => {
      if (currentIndex === index) return count;
      if (current.length > candidate.length && current.startsWith(candidate)) {
        return count + 1;
      }
      return count;
    }, 0);

    // If many longer names start with this exact prefix, this is usually a keystroke artifact.
    if (longerMatches >= 3) {
      typingArtifacts.add(uniqueNames[index]);
    }
  });

  return uniqueNames.filter((name) => !typingArtifacts.has(name)).slice(0, 20);
};

const VALID_ANNOUNCEMENT_TRIGGERS = new Set<AnnouncementPrayerTrigger>(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);

const normalizeAnnouncementTriggerList = (value: unknown): AnnouncementPrayerTrigger[] => {
  if (!Array.isArray(value)) return [];

  const normalized: AnnouncementPrayerTrigger[] = [];

  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const candidate = item as AnnouncementPrayerTrigger;
    if (!VALID_ANNOUNCEMENT_TRIGGERS.has(candidate) || normalized.includes(candidate)) return;
    normalized.push(candidate);
  });

  return normalized;
};

const normalizeAnnouncementSettings = (incoming?: Partial<AnnouncementSettings> | null): AnnouncementSettings => {
  const defaults = DEFAULT_PRAYER_SETTINGS.announcement;
  const legacyAnnouncement = incoming as (Partial<AnnouncementSettings> & { triggerAfterPrayer?: string }) | null | undefined;
  const hasTriggerList = Boolean(incoming && Object.prototype.hasOwnProperty.call(incoming, 'triggerAfterPrayers'));
  const rawLegacyTrigger = typeof legacyAnnouncement?.triggerAfterPrayer === 'string' ? legacyAnnouncement.triggerAfterPrayer : null;
  const legacyTriggerAfterPrayers =
    rawLegacyTrigger && VALID_ANNOUNCEMENT_TRIGGERS.has(rawLegacyTrigger as AnnouncementPrayerTrigger)
      ? [rawLegacyTrigger as AnnouncementPrayerTrigger]
      : [];
  const triggerAfterPrayers = hasTriggerList
    ? normalizeAnnouncementTriggerList(incoming?.triggerAfterPrayers)
    : legacyTriggerAfterPrayers.length > 0
      ? legacyTriggerAfterPrayers
      : defaults.triggerAfterPrayers;
  const rawDuration = Number(incoming?.durationSec ?? defaults.durationSec);
  const durationSec = Math.max(5, Math.min(600, Number.isFinite(rawDuration) ? Math.round(rawDuration) : defaults.durationSec));

  return {
    ...defaults,
    ...(incoming || {}),
    triggerAfterPrayers,
    durationSec,
    title: typeof incoming?.title === 'string' ? incoming.title : defaults.title,
    body: typeof incoming?.body === 'string' ? incoming.body : defaults.body
  };
};

const normalizePrayerSettings = (incoming?: Partial<PrayerSettings> | null): PrayerSettings => ({
  ...DEFAULT_PRAYER_SETTINGS,
  ...(incoming || {}),
  tasbeeh: { ...DEFAULT_PRAYER_SETTINGS.tasbeeh, ...(incoming?.tasbeeh || {}) },
  quranVerse: {
    ...DEFAULT_PRAYER_SETTINGS.quranVerse,
    ...(incoming?.quranVerse || {}),
    backgroundImage:
      incoming?.quranVerse && Object.prototype.hasOwnProperty.call(incoming.quranVerse, 'backgroundImage')
        ? incoming.quranVerse.backgroundImage ?? null
        : incoming?.backgroundImage ?? DEFAULT_PRAYER_SETTINGS.quranVerse.backgroundImage ?? null
  },
  quran: normalizeQuranSettings(incoming?.quran),
  duaAhd: { ...DEFAULT_PRAYER_SETTINGS.duaAhd, ...(incoming?.duaAhd || {}) },
  duaSabah: { ...DEFAULT_PRAYER_SETTINGS.duaSabah, ...(incoming?.duaSabah || {}) },
  ramadanDuas: { ...DEFAULT_PRAYER_SETTINGS.ramadanDuas, ...(incoming?.ramadanDuas || {}) },
  ramadanDuaSystem: normalizeRamadanDuaSystemSettings({
    ...(incoming?.ramadanDuaSystem || {}),
    backgroundImage:
      incoming?.ramadanDuaSystem && Object.prototype.hasOwnProperty.call(incoming.ramadanDuaSystem, 'backgroundImage')
        ? incoming.ramadanDuaSystem.backgroundImage ?? null
        : incoming?.ramadanDuas?.backgroundImage ?? DEFAULT_PRAYER_SETTINGS.ramadanDuas.backgroundImage ?? null
  }),
  postIsha: { ...DEFAULT_PRAYER_SETTINGS.postIsha, ...(incoming?.postIsha || {}) },
  announcement: normalizeAnnouncementSettings(incoming?.announcement)
});

const normalizeMosqueInfo = (incoming?: Partial<MosqueInfo> | null): MosqueInfo => {
  const normalizedName =
    typeof incoming?.name === 'string' && incoming.name.length > 0
      ? fixKnownArabicMojibake(incoming.name)
      : MOSQUE_INFO.name;
  const normalizedLocation =
    typeof incoming?.location === 'string' && incoming.location.length > 0
      ? fixKnownArabicMojibake(incoming.location)
      : MOSQUE_INFO.location;
  const normalizedImamName =
    typeof incoming?.imamName === 'string'
      ? fixKnownArabicMojibake(incoming.imamName)
      : (typeof MOSQUE_INFO.imamName === 'string' ? MOSQUE_INFO.imamName.trim() : '');

  const seedSavedNames = Array.isArray(incoming?.savedImamNames)
    ? incoming.savedImamNames
    : (Array.isArray(MOSQUE_INFO.savedImamNames) ? MOSQUE_INFO.savedImamNames : []);

  const dedupedSavedNames = normalizeSavedImamNames(seedSavedNames);

  return {
    ...MOSQUE_INFO,
    ...(incoming || {}),
    name: normalizedName,
    location: normalizedLocation,
    imamName: normalizedImamName,
    savedImamNames: dedupedSavedNames
  };
};

const DEFAULT_PRAYER_NAME_BY_ID = new Map<string, string>(
  INITIAL_PRAYER_SCHEDULE.map((prayer) => [prayer.id, prayer.nameAR])
);

const normalizeScheduleData = (incoming?: PrayerTime[] | null): PrayerTime[] => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return [...(INITIAL_PRAYER_SCHEDULE as unknown as PrayerTime[])];
  }

  const incomingById = new Map<string, PrayerTime>();
  incoming.forEach((prayer) => {
    if (DEFAULT_PRAYER_NAME_BY_ID.has(prayer.id)) {
      incomingById.set(prayer.id, prayer);
    }
  });

  return (INITIAL_PRAYER_SCHEDULE as unknown as PrayerTime[]).map((basePrayer) => {
    const incomingPrayer = incomingById.get(basePrayer.id);
    const fallbackNameAR = DEFAULT_PRAYER_NAME_BY_ID.get(basePrayer.id) ?? basePrayer.nameAR;
    const rawNameAR = typeof incomingPrayer?.nameAR === 'string' ? incomingPrayer.nameAR.trim() : '';
    const fixedNameAR = rawNameAR ? fixKnownArabicMojibake(rawNameAR) : fallbackNameAR;

    return {
      ...basePrayer,
      ...(incomingPrayer || {}),
      nameAR: fixedNameAR || fallbackNameAR
    };
  });
};

const normalizeOccasionData = (incoming?: Partial<Occasion> | null): Occasion => {
  const normalizedTitle =
    typeof incoming?.title === 'string' && incoming.title.trim()
      ? fixKnownArabicMojibake(incoming.title.trim())
      : OCCASION_DATA.title;
  const normalizedDescription =
    typeof incoming?.description === 'string' && incoming.description.trim()
      ? fixKnownArabicMojibake(incoming.description.trim())
      : OCCASION_DATA.description;

  return {
    ...OCCASION_DATA,
    ...(incoming || {}),
    title: normalizedTitle,
    description: normalizedDescription
  };
};

const Dashboard = lazy(() => import('./components/Dashboard'));
const AdhanView = lazy(() => import('./components/AdhanView'));
const PrayerView = lazy(() => import('./components/PrayerView'));
const TasbeehView = lazy(() => import('./components/TasbeehView'));
const QuranVerseView = lazy(() => import('./components/QuranVerseView'));
const QuranAudioOverlay = lazy(() => import('./components/QuranAudioOverlay'));
const GhufaylahView = lazy(() => import('./components/GhufaylahView'));
const DuaAhdView = lazy(() => import('./components/DuaAhdView'));
const DuaSabahView = lazy(() => import('./components/DuaSabahView'));
const RamadanDuasView = lazy(() => import('./components/RamadanDuasView'));
const AnnouncementView = lazy(() => import('./components/AnnouncementView'));
const RemoteManagedPagesView = lazy(() => import('./components/RemoteManagedPagesView'));

const DashboardOverlayFallback: React.FC = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12" dir="rtl">
    <div className="absolute inset-0 bg-black/30 backdrop-blur-md"></div>
    <div className="relative flex h-full w-full max-w-[1600px] items-center justify-center rounded-[3rem] border border-white/10 bg-slate-900/90 px-8 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white">
        <div className="h-3 w-3 animate-pulse rounded-full bg-gold-400"></div>
        <span className="font-cairo text-lg font-bold">جاري تحميل الإعدادات...</span>
      </div>
    </div>
  </div>
);

const SceneLoadingFallback: React.FC = () => (
  <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950 text-white" dir="rtl">
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
      <div className="h-3 w-3 animate-pulse rounded-full bg-gold-400"></div>
      <span className="font-cairo text-base font-bold">جاري تحميل الصفحة...</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [navigationStack, setNavigationStack] = useState<AppView[]>(['launcher']);
  const view = navigationStack[navigationStack.length - 1] || 'launcher';
  const [currentMode, setCurrentMode] = useState<RemoteMode>('AUTO');
  const [modeOverlayLabel, setModeOverlayLabel] = useState<string | null>(null);
  const [ramadanRemoteMode, setRamadanRemoteMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [remoteMosqueCode, setRemoteMosqueCode] = useState<string | null>(() => getStoredString(REMOTE_MOSQUE_CODE_STORAGE_KEY, null));
  const [localModeFallback, setLocalModeFallback] = useState<boolean>(() => getStoredString(REMOTE_LOCAL_MODE_STORAGE_KEY, null) === '1');
  const [remoteBindingLoading, setRemoteBindingLoading] = useState(false);
  const [remoteBindingError, setRemoteBindingError] = useState<string | null>(null);
  const [remoteMosqueDoc, setRemoteMosqueDoc] = useState<RemoteMosqueDocument | null>(() => {
    const cached = getStoredJson<RemoteMosqueDocument | null>(REMOTE_MOSQUE_CACHE_KEY, null);
    return cached ? normalizeRemoteMosqueDocument(cached, cached.id) : null;
  });
  const [remoteGlobalSettings, setRemoteGlobalSettings] = useState<RemoteGlobalConfig>(() =>
    getStoredJson<RemoteGlobalConfig>(REMOTE_GLOBAL_CACHE_KEY, DEFAULT_REMOTE_GLOBAL_CONFIG)
  );
  const [remotePagesSession, setRemotePagesSession] = useState<RemoteManagedPage[] | null>(null);
  const [dashboardVariant, setDashboardVariant] = useState<'advanced' | 'quick'>('quick');
  const [activePrayerFlow, setActivePrayerFlow] = useState<ActivePrayerFlow | null>(null);
  const [mosqueData, setMosqueData] = useState<MosqueInfo>(() =>
    normalizeMosqueInfo(getStoredJson('mosqueInfo', MOSQUE_INFO))
  );
  const [occasionData, setOccasionData] = useState<Occasion>(() =>
    normalizeOccasionData(getStoredJson('occasionData', OCCASION_DATA))
  );
  const [scheduleData, setScheduleData] = useState<PrayerTime[]>(() =>
    normalizeScheduleData(getStoredJson('scheduleData', INITIAL_PRAYER_SCHEDULE as unknown as PrayerTime[]))
  );
  const [monthlySchedule, setMonthlySchedule] = useState<MonthlySchedule | null>(() => {
    return getStoredJson<MonthlySchedule | null>('prayerTimes', sanitizeMonthlySchedule(RAMADAN_1446_SCHEDULE) ?? RAMADAN_1446_SCHEDULE, (parsed) => {
      if (!parsed || typeof parsed !== 'object') return RAMADAN_1446_SCHEDULE;
      const schedule = sanitizeMonthlySchedule(parsed as MonthlySchedule) ?? RAMADAN_1446_SCHEDULE;
      if (typeof schedule.isHijri !== 'boolean') {
        schedule.isHijri = inferIsHijriSchedule(schedule.monthName || '', schedule.days || []);
      }
      return schedule;
    });
  });
  const [hijriOffset, setHijriOffset] = useState<number>(() => getStoredNumber('hijriOffset', 0));
  const [adhanSettings, setAdhanSettings] = useState<AdhanSettings>(() => getStoredJson('adhanSettings', DEFAULT_ADHAN_SETTINGS));
  const [prayerSettings, setPrayerSettings] = useState<PrayerSettings>(() => normalizePrayerSettings(getStoredJson('prayerSettings', null)));
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => getStoredString('homeBackgroundImage', null));
  const [homeBackgroundColor, setHomeBackgroundColor] = useState<string>(() => getStoredString('homeBackgroundColor', '#020617') || '#020617');
  const [homeOverlayColor, setHomeOverlayColor] = useState<string>(() => getStoredString('homeOverlayColor', '#000000') || '#000000');
  const [homeOverlayOpacity, setHomeOverlayOpacity] = useState<number>(() => getStoredNumber('homeOverlayOpacity', 0.4));
  const [todayDayNum, setTodayDayNum] = useState(-1);
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [nextPrayerIndex, setNextPrayerIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [overridePrayer, setOverridePrayer] = useState<PrayerTime | null>(null);
  const [showPreAdhanTransition, setShowPreAdhanTransition] = useState(false);
  const [dynamicBg, setDynamicBg] = useState(DYNAMIC_THEMES.night);
  const [ramadanForcedDuaId, setRamadanForcedDuaId] = useState<string | null>(null);
  const [ramadanContextSlot, setRamadanContextSlot] = useState<DuaDisplaySlot | null>(null);
  const [ramadanPreviewMode, setRamadanPreviewMode] = useState(false);
  const [postDuaNextPrayerId, setPostDuaNextPrayerId] = useState<string | null>(null);
  const [announcementExitPlan, setAnnouncementExitPlan] = useState<AnnouncementExitPlan>({ type: 'pop' });
  const [quranTrackIndex, setQuranTrackIndex] = useState(0);
  const [quranSequenceMode, setQuranSequenceMode] = useState(true);
  const [quranVolume, setQuranVolume] = useState(0.9);
  const [quranRemoteCommand, setQuranRemoteCommand] = useState<QuranRemoteCommand | null>(null);
  const [remoteControlStatus, setRemoteControlStatus] = useState<RemoteControlStatus | null>(null);
  const lastAutomationTriggerRef = useRef('');
  const lastRemoteActionRef = useRef<number>(Date.now());
  const modeOverlayTimeoutRef = useRef<number | null>(null);
  const quranRemoteCommandIdRef = useRef(0);
  const activePrayerFlowRef = useRef<ActivePrayerFlow | null>(null);
  const keyPressedRef = useRef<Partial<Record<RemoteKey, { startedAt: number; timerId: number; reachedLongPress: boolean }>>>({});
  const lastKeyActionAtRef = useRef<Partial<Record<RemoteKey, number>>>({});

  const ramadanDuaSystemSettings = useMemo(() => normalizeRamadanDuaSystemSettings(prayerSettings.ramadanDuaSystem), [prayerSettings.ramadanDuaSystem]);
  const orderedRamadanDuas = useMemo(() => {
    const byId = new Map(ramadanDuaSystemSettings.duas.map((dua) => [dua.id, dua]));
    const ordered = ramadanDuaSystemSettings.duaOrder
      .map((id) => byId.get(id))
      .filter((dua): dua is RamadanDuaItem => Boolean(dua));
    const orderedIds = new Set(ordered.map((dua) => dua.id));
    const trailing = ramadanDuaSystemSettings.duas.filter((dua) => !orderedIds.has(dua.id));
    return [...ordered, ...trailing];
  }, [ramadanDuaSystemSettings.duaOrder, ramadanDuaSystemSettings.duas]);
  const quranReciters = useMemo(() => getQuranReciters(prayerSettings.quran), [prayerSettings.quran]);
  const quranReciter = useMemo(
    () =>
      quranReciters.find((reciter) => reciter.id === prayerSettings.quran.selectedReciterId) ||
      quranReciters[0] || {
        id: 'fallback',
        name: 'لا توجد تلاوات',
        description: '',
        tracks: []
      },
    [prayerSettings.quran.selectedReciterId, quranReciters]
  );
  const isQuranEnabled = prayerSettings.quran.enabled;
  const selectedHomeMode = REMOTE_MODE_TO_HOME_MODE[currentMode];
  const presenterDuas = useMemo(() => {
    const weekdayKey = getDuaWeekdayKey(currentTime);
    return orderedRamadanDuas.filter(
      (dua) => dua.active && isDuaAllowedOnWeekday(dua, weekdayKey)
    );
  }, [currentTime, orderedRamadanDuas]);
  const currentRemotePageWeekday = useMemo(() => getRemotePageWeekdayKey(currentTime), [currentTime]);
  const remoteManagedPages = useMemo(
    () => mergeRemotePages(remoteGlobalSettings.pages || [], remoteMosqueDoc?.pages || []),
    [remoteGlobalSettings.pages, remoteMosqueDoc?.pages]
  );
  const remotePrayerFlows = useMemo<RemotePrayerFlowMap>(
    () => normalizePrayerFlows(remoteMosqueDoc?.prayerFlows || getDefaultPrayerFlows()),
    [remoteMosqueDoc?.prayerFlows]
  );
  const generalRemoteManagedPages = useMemo(
    () => filterRemotePagesForContext(remoteManagedPages, { weekday: currentRemotePageWeekday }),
    [currentRemotePageWeekday, remoteManagedPages]
  );

  useEffect(() => {
    activePrayerFlowRef.current = activePrayerFlow;
  }, [activePrayerFlow]);

  const pushView = useCallback((nextView: AppView) => {
    setNavigationStack((previous) => {
      if (previous[previous.length - 1] === nextView) return previous;
      return [...previous, nextView];
    });
  }, []);

  const replaceView = useCallback((nextView: AppView) => {
    setNavigationStack((previous) => {
      if (previous.length === 0) return [nextView];
      if (previous[previous.length - 1] === nextView) return previous;
      return [...previous.slice(0, -1), nextView];
    });
  }, []);

  const resetToView = useCallback((target: AppView = 'home') => {
    setNavigationStack([target]);
  }, []);

  const popView = useCallback((fallback: AppView = 'home') => {
    setNavigationStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : [fallback]));
  }, []);

  const dispatchSyntheticKeyDown = useCallback((code: string, key = code) => {
    const syntheticEvent = new KeyboardEvent('keydown', {
      key,
      code,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(syntheticEvent);
  }, []);

  const issueQuranRemoteCommand = useCallback((type: QuranRemoteCommandType) => {
    quranRemoteCommandIdRef.current += 1;
    setQuranRemoteCommand({ id: quranRemoteCommandIdRef.current, type });
  }, []);

  const goHomeFromAnywhere = useCallback(() => {
    setShowPreAdhanTransition(false);
    setOverridePrayer(null);
    setActivePrayerFlow(null);
    activePrayerFlowRef.current = null;
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(null);
    setAnnouncementExitPlan({ type: 'pop' });
    setQuranRemoteCommand(null);
    setRemotePagesSession(null);
    resetToView('home');
  }, [resetToView]);

  const showModeOverlay = useCallback((mode: RemoteMode) => {
    if (modeOverlayTimeoutRef.current !== null) {
      window.clearTimeout(modeOverlayTimeoutRef.current);
    }
    setModeOverlayLabel(REMOTE_MODE_LABEL[mode]);
    modeOverlayTimeoutRef.current = window.setTimeout(() => {
      setModeOverlayLabel(null);
      modeOverlayTimeoutRef.current = null;
    }, 2000);
  }, []);

  const switchMode = useCallback((nextMode: RemoteMode) => {
    setCurrentMode(nextMode);
    showModeOverlay(nextMode);
    goHomeFromAnywhere();
  }, [goHomeFromAnywhere, showModeOverlay]);

  const cycleRemoteMode = useCallback(() => {
    setCurrentMode((previousMode) => {
      const nextIndex = (REMOTE_MODE_ORDER.indexOf(previousMode) + 1) % REMOTE_MODE_ORDER.length;
      const nextMode = REMOTE_MODE_ORDER[nextIndex];
      showModeOverlay(nextMode);
      return nextMode;
    });
    goHomeFromAnywhere();
  }, [goHomeFromAnywhere, showModeOverlay]);

  const handleBindMosqueScreen = useCallback(async (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;

    setRemoteBindingLoading(true);
    setRemoteBindingError(null);

    try {
      const mosque = await findMosqueByCode(normalizedCode);
      if (!mosque) {
        setRemoteBindingError('لم يتم العثور على مسجد بهذا الكود.');
        return;
      }

      const normalizedMosque = normalizeRemoteMosqueDocument(mosque, mosque.id);
      setRemoteMosqueCode(normalizedCode);
      setRemoteMosqueDoc(normalizedMosque);
      setNavigationStack(['launcher']);
      setLocalModeFallback(false);
      setStoredString(REMOTE_MOSQUE_CODE_STORAGE_KEY, normalizedCode);
      setStoredString(REMOTE_LOCAL_MODE_STORAGE_KEY, null);
      setStoredJson(REMOTE_MOSQUE_CACHE_KEY, normalizedMosque);
    } catch (error) {
      setRemoteBindingError(error instanceof Error ? error.message : 'تعذر ربط المسجد الآن.');
    } finally {
      setRemoteBindingLoading(false);
    }
  }, []);

  const handleUseLocalModeFallback = useCallback(() => {
    setLocalModeFallback(true);
    setNavigationStack(['launcher']);
    setStoredString(REMOTE_LOCAL_MODE_STORAGE_KEY, '1');
  }, []);

  const updateData = useCallback((key: string, value: any, setter: React.Dispatch<any>) => {
    setter(value);
    setStoredJson(key === 'monthlySchedule' ? 'prayerTimes' : key, value);
  }, []);
  const updateSimpleValue = useCallback((key: string, value: any, setter: React.Dispatch<any>) => {
    setter(value);
    setStoredNumber(key, Number(value));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => flushConfigStore();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (modeOverlayTimeoutRef.current !== null) {
        window.clearTimeout(modeOverlayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setQuranVolume(prayerSettings.quran.volume);
  }, [prayerSettings.quran.volume]);

  useEffect(() => {
    const preloadDashboard = () => {
      void import('./components/Dashboard');
    };

    if ('requestIdleCallback' in window) {
      const idleId = (window as Window & {
        requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      }).requestIdleCallback(preloadDashboard, { timeout: 1200 });

      return () => {
        (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(preloadDashboard, 450);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (localModeFallback || !remoteMosqueCode) return;

    setRemoteBindingLoading(true);
    const detachMosque = subscribeMosqueByCode(remoteMosqueCode, (nextMosque) => {
      if (nextMosque) {
        const normalized = normalizeRemoteMosqueDocument(nextMosque, nextMosque.id);
        setRemoteMosqueDoc(normalized);
        setStoredJson(REMOTE_MOSQUE_CACHE_KEY, normalized);
        setRemoteBindingError(null);
      } else {
        setRemoteBindingError('تعذر العثور على مسجد بهذا الكود. تأكد من الكود ثم حاول مرة أخرى.');
        setRemoteMosqueDoc((previous) => previous);
      }
      setRemoteBindingLoading(false);
    });

    const detachGlobal = subscribeGlobalConfig((nextGlobalSettings) => {
      setRemoteGlobalSettings(nextGlobalSettings);
      setStoredJson(REMOTE_GLOBAL_CACHE_KEY, nextGlobalSettings);
    });

    return () => {
      detachMosque();
      detachGlobal();
    };
  }, [localModeFallback, remoteMosqueCode]);

  useEffect(() => {
    if (localModeFallback || !remoteMosqueDoc) return;

    const normalizedRemoteMosque = normalizeRemoteMosqueDocument(remoteMosqueDoc, remoteMosqueDoc.id);
    const globalSystemSettings = remoteGlobalSettings.systemSettings || DEFAULT_REMOTE_GLOBAL_CONFIG.systemSettings;
    const effectiveRemoteMosque = normalizeRemoteMosqueDocument({
      ...normalizedRemoteMosque,
      prayerSettings: globalSystemSettings.prayerSettings || normalizedRemoteMosque.prayerSettings,
      displayConfig: {
        ...normalizedRemoteMosque.displayConfig,
        schedule:
          Array.isArray(globalSystemSettings.schedule) && globalSystemSettings.schedule.length > 0
            ? globalSystemSettings.schedule
            : normalizedRemoteMosque.displayConfig.schedule,
        monthlySchedule: globalSystemSettings.monthlySchedule ?? normalizedRemoteMosque.displayConfig.monthlySchedule,
        theme: {
          ...normalizedRemoteMosque.displayConfig.theme,
          ...(globalSystemSettings.theme || {})
        },
        hijriOffset: Number.isFinite(globalSystemSettings.hijriOffset)
          ? globalSystemSettings.hijriOffset
          : normalizedRemoteMosque.displayConfig.hijriOffset
      }
    }, normalizedRemoteMosque.id);
    const nextSchedule = normalizeScheduleData(buildScheduleFromRemoteMosque(effectiveRemoteMosque));
    const nextMosqueInfo = normalizeMosqueInfo({
      ...effectiveRemoteMosque.displayConfig.mosqueInfo,
      name: effectiveRemoteMosque.name,
      location: effectiveRemoteMosque.city
    });

    setCurrentMode(effectiveRemoteMosque.mode);
    setMosqueData(nextMosqueInfo);
    setOccasionData(normalizeOccasionData(effectiveRemoteMosque.displayConfig.occasion));
    setScheduleData(nextSchedule);
    setMonthlySchedule(sanitizeMonthlySchedule(effectiveRemoteMosque.displayConfig.monthlySchedule));
    setAdhanSettings({ ...DEFAULT_ADHAN_SETTINGS, ...effectiveRemoteMosque.displayConfig.adhanSettings });
    setPrayerSettings(normalizePrayerSettings(effectiveRemoteMosque.displayConfig.prayerSettings));
    setBackgroundImage(effectiveRemoteMosque.displayConfig.theme.homeBackgroundImage ?? null);
    setHomeBackgroundColor(effectiveRemoteMosque.displayConfig.theme.homeBackgroundColor || '#020617');
    setHomeOverlayColor(effectiveRemoteMosque.displayConfig.theme.homeOverlayColor || '#000000');
    setHomeOverlayOpacity(Number.isFinite(effectiveRemoteMosque.displayConfig.theme.homeOverlayOpacity)
      ? effectiveRemoteMosque.displayConfig.theme.homeOverlayOpacity
      : 0.45);
    setHijriOffset(Number.isFinite(effectiveRemoteMosque.displayConfig.hijriOffset)
      ? effectiveRemoteMosque.displayConfig.hijriOffset
      : 0);
  }, [localModeFallback, remoteGlobalSettings, remoteMosqueDoc]);

  const activePrayer = overridePrayer || (prayers[nextPrayerIndex] || INITIAL_PRAYER_SCHEDULE[0] as unknown as PrayerTime);

  useEffect(() => {
    const day = monthlySchedule?.isHijri ? getHijriDay(new Date(), hijriOffset) : new Date().getDate();
    setTodayDayNum(Number.isFinite(day) ? day : -1);
  }, [hijriOffset, monthlySchedule?.isHijri]);

  const getActiveSchedule = useCallback(() => {
    if (monthlySchedule?.days?.length) {
      const todayRow = monthlySchedule.days.find((day) => Number(day.day_number) === todayDayNum);
      if (todayRow) {
        const base = [...scheduleData];
        const makePrayer = (id: string, nameAR: string, nameEN: string, time: string, icon: any) => {
          const existing = base.find((item) => item.id === id);
          return {
            id,
            nameAR: existing?.nameAR || nameAR,
            nameEN: existing?.nameEN || nameEN,
            time: normalizeTimeValue(time) || normalizeTimeValue(existing?.time) || '',
            isNext: false,
            isCurrent: false,
            icon: existing?.icon || icon
          };
        };

        return [
          todayRow.imsak && makePrayer('imsak', 'الإمساك', 'Imsak', todayRow.imsak, 'moon'),
          todayRow.fajr && makePrayer('fajr', 'الفجر', 'Fajr', todayRow.fajr, 'moon'),
          todayRow.sunrise && makePrayer('sunrise', 'الشروق', 'Sunrise', todayRow.sunrise, 'sunrise'),
          todayRow.dhuhr && makePrayer('dhuhr', 'الظهر', 'Dhuhr', todayRow.dhuhr, 'sun'),
          makePrayer('asr', 'العصر', 'Asr', todayRow.asr || '', 'sun'),
          todayRow.maghrib && makePrayer('maghrib', 'المغرب', 'Maghrib', todayRow.maghrib, 'sunset'),
          makePrayer('isha', 'العشاء', 'Isha', todayRow.isha || '', 'moon')
        ].filter(Boolean) as PrayerTime[];
      }
    }
    const order = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    return [...scheduleData].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [monthlySchedule, scheduleData, todayDayNum]);

  const mobileRemoteStateSnapshot = useMemo(() => {
    const activeSchedule = getActiveSchedule().map((prayer) => ({
      id: prayer.id,
      nameAR: prayer.nameAR,
      time: prayer.time
    }));

    return {
      updatedAt: Date.now(),
      view,
      mode: currentMode,
      mosque: {
        name: mosqueData.name,
        imamName: mosqueData.imamName
      },
      theme: {
        backgroundImage,
        homeBackgroundColor,
        homeOverlayColor,
        homeOverlayOpacity
      },
      schedule: activeSchedule,
      quran: {
        enabled: prayerSettings.quran.enabled,
        selectedReciterId: prayerSettings.quran.selectedReciterId,
        trackIndex: quranTrackIndex,
        volume: prayerSettings.quran.volume,
        reciters: quranReciters.map((reciter) => ({
          id: reciter.id,
          name: reciter.name,
          description: reciter.description,
          tracks: reciter.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            subtitle: track.subtitle
          }))
        }))
      },
      dua: {
        enabled: ramadanDuaSystemSettings.enabled,
        displayDurationSec: ramadanDuaSystemSettings.displayDurationSec,
        fontScale: ramadanDuaSystemSettings.fontScale,
        duaOrder: ramadanDuaSystemSettings.duaOrder,
        duas: ramadanDuaSystemSettings.duas.map((dua) => ({
          id: dua.id,
          title: dua.title,
          textPreview: String(dua.text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 2)
            .join(' '),
          lineCount: Math.max(
            1,
            String(dua.text || '')
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean).length
          ),
          wordCount: String(dua.text || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean).length,
          isBuiltin: Boolean(dua.isBuiltin),
          active: dua.active,
          slots: dua.slots,
          weekdays: dua.weekdays,
          lineDurationSec: dua.lineDurationSec ?? null
        }))
      }
    };
  }, [
    backgroundImage,
    currentMode,
    getActiveSchedule,
    homeBackgroundColor,
    homeOverlayColor,
    homeOverlayOpacity,
    mosqueData.imamName,
    mosqueData.name,
    prayerSettings.quran.enabled,
    prayerSettings.quran.selectedReciterId,
    prayerSettings.quran.volume,
    quranReciters,
    quranTrackIndex,
    ramadanDuaSystemSettings.displayDurationSec,
    ramadanDuaSystemSettings.fontScale,
    ramadanDuaSystemSettings.duaOrder,
    ramadanDuaSystemSettings.duas,
    ramadanDuaSystemSettings.enabled,
    view
  ]);

  const resolveDuaSelectionForSlot = useCallback((
    slot: DuaDisplaySlot,
    fallbackId?: string | null,
    options?: { includeGeneralFallback?: boolean }
  ) => {
    const includeGeneralFallback = options?.includeGeneralFallback ?? true;
    const weekdayKey = getDuaWeekdayKey(new Date());
    const activeDuas = orderedRamadanDuas.filter(
      (dua) => dua.active && isDuaAllowedOnWeekday(dua, weekdayKey)
    );
    const byId = new Map(activeDuas.map((dua) => [dua.id, dua]));

    if (fallbackId && byId.has(fallbackId)) {
      return {
        found: true,
        forcedDuaId: fallbackId,
        contextSlot: slot as DuaDisplaySlot | null
      };
    }

    const slotSpecific = activeDuas.filter((dua) => (dua.slots || []).includes(slot));
    if (slotSpecific.length > 0) {
      return {
        found: true,
        forcedDuaId: null,
        contextSlot: slot as DuaDisplaySlot | null
      };
    }

    if (!includeGeneralFallback) {
      return {
        found: false,
        forcedDuaId: null,
        contextSlot: null as DuaDisplaySlot | null
      };
    }

    const generalDuas = activeDuas.filter((dua) => (dua.slots || []).includes('general'));
    if (generalDuas.length > 0) {
      return {
        found: true,
        forcedDuaId: null,
        contextSlot: 'general' as DuaDisplaySlot
      };
    }

    return {
      found: false,
      forcedDuaId: null,
      contextSlot: null as DuaDisplaySlot | null
    };
  }, [orderedRamadanDuas]);

  useEffect(() => {
    const run = () => {
      const now = new Date();
      const currentMinutes = getMinutesSinceMidnight(now);
      const schedule = getActiveSchedule();
      const candidates = schedule.map((prayer, index) => prayer.time ? ({ index, prayer, diff: timeStringToMinutes(prayer.time) - currentMinutes, prayerMinutes: timeStringToMinutes(prayer.time) }) : null).filter(Boolean) as Array<{ index: number; prayer: PrayerTime; diff: number; prayerMinutes: number }>;
      const upcoming = candidates.filter((item) => item.diff >= 0).sort((a, b) => a.diff - b.diff)[0] || candidates.sort((a, b) => a.prayerMinutes - b.prayerMinutes)[0];
      if (upcoming) {
        const target = new Date();
        const [hours, minutes] = upcoming.prayer.time.split(':').map(Number);
        if (upcoming.diff < 0) target.setDate(target.getDate() + 1);
        target.setHours(hours, minutes, 0, 0);
        setPrayers(schedule.map((prayer, index) => ({ ...prayer, isNext: index === upcoming.index, isCurrent: false })) as PrayerTime[]);
        setNextPrayerIndex(upcoming.index);
        setTimeRemaining(Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000)));
      }
      const minutesOf = (id: string, fallback: string) => timeStringToMinutes(schedule.find((item) => item.id === id)?.time || fallback);
      const fajr = minutesOf('fajr', '05:00');
      const sunrise = minutesOf('sunrise', '06:30');
      const dhuhr = minutesOf('dhuhr', '12:00');
      const maghrib = minutesOf('maghrib', '18:00');
      const isha = minutesOf('isha', '19:30');
      if (currentMinutes >= fajr && currentMinutes < sunrise) setDynamicBg(DYNAMIC_THEMES.fajr);
      else if (currentMinutes >= maghrib && currentMinutes < isha) setDynamicBg(DYNAMIC_THEMES.sunset);
      else if (currentMinutes >= sunrise && currentMinutes < maghrib) setDynamicBg(DYNAMIC_THEMES.day);
      else setDynamicBg(DYNAMIC_THEMES.night);
    };
    run();
    const interval = setInterval(run, 1000);
    return () => clearInterval(interval);
  }, [getActiveSchedule]);

  const openQuranMode = useCallback((options?: { returnView?: AppView; sequenceMode?: boolean }) => {
    setQuranTrackIndex(0);
    setQuranSequenceMode(options?.sequenceMode ?? true);
    setQuranRemoteCommand(null);
    pushView('quran');
  }, [pushView]);

  const openRemotePages = useCallback((pages?: RemoteManagedPage[], options?: { nextPrayerIdOnExit?: string | null }) => {
    const nextPages = Array.isArray(pages) && pages.length > 0 ? pages : remoteManagedPages;
    if (nextPages.length === 0) return;
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(true);
    setPostDuaNextPrayerId(options?.nextPrayerIdOnExit || null);
    setRemotePagesSession(nextPages);
    pushView('remotePages');
  }, [pushView, remoteManagedPages]);

  const openPrayerManagedPages = useCallback((
    prayerId: AnnouncementPrayerTrigger,
    options?: { nextPrayerIdOnExit?: string | null }
  ) => {
    const prayerPages = filterRemotePagesForContext(remoteManagedPages, {
      weekday: currentRemotePageWeekday,
      prayerId,
      includeGeneral: false
    });
    if (prayerPages.length === 0) return false;
    openRemotePages(prayerPages, options);
    return true;
  }, [currentRemotePageWeekday, openRemotePages, remoteManagedPages]);

  const executePrayerFlowStep = useCallback((flow: ActivePrayerFlow, index: number) => {
    const item = flow.items[index];
    if (!item) return;

    const nextFlow: ActivePrayerFlow = { ...flow, index };
    activePrayerFlowRef.current = nextFlow;
    setActivePrayerFlow(nextFlow);
    setShowPreAdhanTransition(false);
    setRemotePagesSession(null);

    if (item.type === 'page') {
      const linkedPage = remoteManagedPages.find((page) => page.id === item.pageId && page.enabled);
      if (linkedPage) {
        setRamadanForcedDuaId(null);
        setRamadanContextSlot(null);
        setRamadanPreviewMode(false);
        setRamadanRemoteMode(true);
        setPostDuaNextPrayerId(null);
        setRemotePagesSession([linkedPage]);
        pushView('remotePages');
      }
      return;
    }

    switch (item.systemStep) {
      case 'dua_ahd':
        pushView('duaAhd');
        return;
      case 'dua_sabah':
        pushView('duaSabah');
        return;
      case 'pre_adhan':
        setShowPreAdhanTransition(true);
        return;
      case 'adhan':
        pushView('adhan');
        return;
      case 'iqama':
        pushView('prayer');
        return;
      case 'tasbeeh':
        pushView('tasbeeh');
        return;
      case 'quran_verse':
        pushView('quranVerse');
        return;
      case 'ghufaylah':
        pushView('ghufaylah');
        return;
      case 'announcement_builtin':
        pushView('announcement');
        return;
      default:
        return;
    }
  }, [pushView, remoteManagedPages]);

  const startPrayerFlow = useCallback((targetPrayer: PrayerTime) => {
    if (!isPrayerSequenceId(targetPrayer.id)) return;

    const weekday = currentRemotePageWeekday;
    const sourceItems = remotePrayerFlows[targetPrayer.id] || [];
    const runtimeItems = sourceItems.filter((item) => {
      if (!item.enabled) return false;
      if (item.type === 'system') return Boolean(item.systemStep);
      const linkedPage = remoteManagedPages.find((page) => page.id === item.pageId);
      if (!linkedPage || !linkedPage.enabled) return false;
      return linkedPage.weekdays.includes(weekday);
    });

    const flow: ActivePrayerFlow = {
      prayerId: targetPrayer.id,
      items: runtimeItems,
      index: -1,
      nextPrayerIdOnFinish:
        targetPrayer.id === 'dhuhr' ? 'asr'
        : targetPrayer.id === 'maghrib' ? 'isha'
        : null
    };

    setOverridePrayer(targetPrayer);
    setNavigationStack(['home']);
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(null);
    setAnnouncementExitPlan({ type: 'pop' });
    setShowPreAdhanTransition(false);

    if (runtimeItems.length === 0) {
      activePrayerFlowRef.current = null;
      setActivePrayerFlow(null);
      setOverridePrayer(null);
      resetToView('home');
      return;
    }

    executePrayerFlowStep(flow, 0);
  }, [currentRemotePageWeekday, executePrayerFlowStep, remoteManagedPages, remotePrayerFlows, resetToView]);

  const advancePrayerFlow = useCallback(() => {
    const flow = activePrayerFlowRef.current;
    if (!flow) return false;

    const nextIndex = flow.index + 1;
    if (nextIndex < flow.items.length) {
      setNavigationStack(['home']);
      executePrayerFlowStep(flow, nextIndex);
      return true;
    }

    activePrayerFlowRef.current = null;
    setActivePrayerFlow(null);
    setShowPreAdhanTransition(false);
    setRemotePagesSession(null);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(null);

    if (flow.nextPrayerIdOnFinish) {
      const nextPrayer =
        prayers.find((item) => item.id === flow.nextPrayerIdOnFinish) ||
        INITIAL_PRAYER_SCHEDULE.find((item) => item.id === flow.nextPrayerIdOnFinish);
      if (nextPrayer) {
        startPrayerFlow(nextPrayer as PrayerTime);
        return true;
      }
    }

    setOverridePrayer(null);
    resetToView('home');
    return true;
  }, [executePrayerFlowStep, prayers, resetToView, startPrayerFlow]);

  const openDuaById = useCallback((duaId: string, presenterMode = false) => {
    setRamadanForcedDuaId(duaId);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(presenterMode);
    setPostDuaNextPrayerId(null);
    pushView('ramadanDuas');
  }, [pushView]);

  const openFirstActiveDua = useCallback(() => {
    if (generalRemoteManagedPages.length > 0) {
      openRemotePages(generalRemoteManagedPages);
      return;
    }
    if (presenterDuas.length > 0) {
      openDuaById(presenterDuas[0].id, true);
      return;
    }
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(true);
    setPostDuaNextPrayerId(null);
    pushView('ramadanDuas');
  }, [generalRemoteManagedPages, openDuaById, openRemotePages, presenterDuas, pushView]);

  const exitRemotePages = useCallback(() => {
    if (advancePrayerFlow()) {
      return;
    }
    const pendingPrayerId = postDuaNextPrayerId;
    setPostDuaNextPrayerId(null);
    setRemotePagesSession(null);
    setRamadanRemoteMode(false);
    if (pendingPrayerId && isPrayerSequenceId(pendingPrayerId)) {
      const nextPrayer = prayers.find((item) => item.id === pendingPrayerId) || INITIAL_PRAYER_SCHEDULE.find((item) => item.id === pendingPrayerId);
      if (nextPrayer) {
        setOverridePrayer(nextPrayer as PrayerTime);
        setNavigationStack(['home']);
        setShowPreAdhanTransition(true);
        return;
      }
    }
    setNavigationStack((previous) => {
      if (previous.length > 1 && previous[previous.length - 2] === 'dashboard') {
        return previous.slice(0, -1);
      }
      return ['home'];
    });
  }, [advancePrayerFlow, postDuaNextPrayerId, prayers]);

  const exitRamadanViewer = useCallback(() => {
    if (advancePrayerFlow()) {
      return;
    }
    const pendingPrayerId = postDuaNextPrayerId;
    setPostDuaNextPrayerId(null);
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(false);
    setRemotePagesSession(null);
    if (pendingPrayerId && isPrayerSequenceId(pendingPrayerId)) {
      const nextPrayer = prayers.find((item) => item.id === pendingPrayerId) || INITIAL_PRAYER_SCHEDULE.find((item) => item.id === pendingPrayerId);
      if (nextPrayer) {
        setOverridePrayer(nextPrayer as PrayerTime);
        setNavigationStack(['home']);
        setShowPreAdhanTransition(true);
        return;
      }
    }
    setOverridePrayer(null);
    setNavigationStack((previous) => {
      if (previous.length > 1 && previous[previous.length - 2] === 'dashboard') {
        return previous.slice(0, -1);
      }
      return ['home'];
    });
  }, [advancePrayerFlow, postDuaNextPrayerId, prayers]);

  const beginPrayerLeadIn = useCallback((targetPrayer: PrayerTime) => {
    startPrayerFlow(targetPrayer);
  }, [startPrayerFlow]);

  const activateHomeMode = useCallback((mode: HomeMode) => {
    if (mode === 'dua') {
      openFirstActiveDua();
      return;
    }
    if (mode === 'quran') {
      openQuranMode({ returnView: 'home', sequenceMode: false });
      return;
    }
    const targetPrayer = prayers[nextPrayerIndex];
    if (targetPrayer && isPrayerSequenceId(targetPrayer.id)) {
      beginPrayerLeadIn(targetPrayer as PrayerTime);
    }
  }, [beginPrayerLeadIn, nextPrayerIndex, openFirstActiveDua, openQuranMode, prayers]);

  const openSlotDua = useCallback((
    slot: DuaDisplaySlot,
    fallbackToGeneral = true,
    options?: { nextPrayerIdOnExit?: string | null }
  ) => {
    const selection = resolveDuaSelectionForSlot(slot, null, { includeGeneralFallback: fallbackToGeneral });
    if (!selection.found) return false;

    setRamadanContextSlot(selection.contextSlot);
    setRamadanForcedDuaId(selection.forcedDuaId);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(options?.nextPrayerIdOnExit || null);
    pushView('ramadanDuas');
    return true;
  }, [pushView, resolveDuaSelectionForSlot]);

  const runPostPrayerSequence = useCallback((
    prayerId: PrayerSequenceId,
    options?: { skipAnnouncement?: boolean; fromAnnouncement?: boolean }
  ) => {
    const shouldShowAnnouncement =
      !options?.skipAnnouncement &&
      prayerSettings.announcement.enabled &&
      prayerSettings.announcement.triggerAfterPrayers.includes(prayerId);

    if (shouldShowAnnouncement) {
      setAnnouncementExitPlan({ type: 'resumeSequence', prayerId });
      pushView('announcement');
      return;
    }

    if (options?.fromAnnouncement) {
      setNavigationStack(['home']);
    }

    if (prayerId === 'fajr') {
      if (openPrayerManagedPages('fajr')) {
        return;
      }
      if (openSlotDua('after_fajr', false)) {
        return;
      }
    }

    if (prayerId === 'dhuhr') {
      if (openPrayerManagedPages('dhuhr', { nextPrayerIdOnExit: 'asr' })) {
        return;
      }
      if (openSlotDua('after_dhuhr', false, { nextPrayerIdOnExit: 'asr' })) {
        return;
      }
      const asrPrayer = prayers.find((item) => item.id === 'asr') || INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'asr');
      if (asrPrayer) {
        setOverridePrayer(asrPrayer as PrayerTime);
        setShowPreAdhanTransition(true);
      } else {
        setOverridePrayer(null);
        resetToView('home');
      }
      return;
    }
    if (prayerId === 'asr') {
      if (openPrayerManagedPages('asr')) {
        return;
      }
      if (openSlotDua('after_asr', false)) {
        return;
      }
      setOverridePrayer(null);
      resetToView('home');
      return;
    }
    if (prayerId === 'maghrib') {
      if (openPrayerManagedPages('maghrib', { nextPrayerIdOnExit: 'isha' })) {
        return;
      }
      if (openSlotDua('after_maghrib', false, { nextPrayerIdOnExit: 'isha' })) {
        return;
      }
      pushView('ghufaylah');
      return;
    }
    if (prayerId === 'isha') {
      if (openPrayerManagedPages('isha')) {
        return;
      }
      if (openSlotDua('after_isha', false)) {
        return;
      }
      setOverridePrayer(null);
      resetToView('home');
      return;
    }
    setOverridePrayer(null);
    resetToView('home');
  }, [openPrayerManagedPages, openSlotDua, prayerSettings.announcement.enabled, prayerSettings.announcement.triggerAfterPrayers, prayers, pushView, resetToView]);

  const handleSequenceCompletion = useCallback(() => {
    if (!isPrayerSequenceId(activePrayer.id)) {
      setOverridePrayer(null);
      resetToView('home');
      return;
    }
    runPostPrayerSequence(activePrayer.id);
  }, [activePrayer.id, resetToView, runPostPrayerSequence]);

  const closeAnnouncement = useCallback(() => {
    if (advancePrayerFlow()) {
      return;
    }
    const currentPlan = announcementExitPlan;
    setAnnouncementExitPlan({ type: 'pop' });

    if (currentPlan.type === 'resumeSequence') {
      runPostPrayerSequence(currentPlan.prayerId, { skipAnnouncement: true, fromAnnouncement: true });
      return;
    }

    popView('home');
  }, [advancePrayerFlow, announcementExitPlan, popView, runPostPrayerSequence]);

  const advanceAfterTasbeeh = useCallback(() => {
    if (advancePrayerFlow()) {
      return;
    }
    pushView('quranVerse');
  }, [advancePrayerFlow, pushView]);

  const advanceAfterQuranVerse = useCallback(() => {
    if (advancePrayerFlow()) {
      return;
    }
    if (isQuranEnabled && currentMode === 'QURAN') {
      openQuranMode({ returnView: 'home', sequenceMode: true });
      return;
    }
    handleSequenceCompletion();
  }, [advancePrayerFlow, currentMode, handleSequenceCompletion, isQuranEnabled, openQuranMode]);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (showPreAdhanTransition) return;
      const schedule = getActiveSchedule();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      if (view === 'home' && ramadanDuaSystemSettings.enabled && ramadanDuaSystemSettings.automation.enabled) {
        const beforeMinutes = Math.max(1, Number(ramadanDuaSystemSettings.automation.minutesBeforePrayer) || 1);
        for (const prayerId of ['fajr', 'dhuhr', 'maghrib'] as const) {
          const prayer = schedule.find((item) => item.id === prayerId && item.time);
          if (!prayer?.time) continue;
          const triggerMinute = timeStringToMinutes(prayer.time) - beforeMinutes;
          const triggerKey = `${now.toDateString()}:${prayerId}:${triggerMinute}`;
          if (triggerMinute === currentMinute && lastAutomationTriggerRef.current !== triggerKey) {
            lastAutomationTriggerRef.current = triggerKey;
            const slot = BEFORE_PRAYER_SLOT_BY_PRAYER[prayerId];
            const selection = resolveDuaSelectionForSlot(
              slot,
              ramadanDuaSystemSettings.automation.beforePrayerDuaByPrayer[prayerId] || null
            );
            if (!selection.found) continue;
            setRamadanForcedDuaId(selection.forcedDuaId);
            setRamadanContextSlot(selection.contextSlot);
            setRamadanPreviewMode(false);
            setRamadanRemoteMode(false);
            setPostDuaNextPrayerId(null);
            pushView('ramadanDuas');
            return;
          }
        }
      }
      const matchedPrayer = schedule.find((item) => item.time && now.getSeconds() === 0 && (() => {
        const [hours, minutes] = item.time.split(':').map(Number);
        return hours === now.getHours() && minutes === now.getMinutes();
      })());
      if (matchedPrayer && (view === 'home' || view === 'ramadanDuas') && isPrayerSequenceId(matchedPrayer.id)) beginPrayerLeadIn(matchedPrayer as PrayerTime);
    }, 1000);
    return () => clearInterval(tick);
  }, [beginPrayerLeadIn, getActiveSchedule, pushView, ramadanDuaSystemSettings, resolveDuaSelectionForSlot, showPreAdhanTransition, view]);

  const handleRemoteShortPress = useCallback((remoteKey: RemoteKey) => {
    if (remoteKey === 'F5') {
      goHomeFromAnywhere();
      return;
    }

    if (remoteKey === 'B' || remoteKey === 'Period') {
      cycleRemoteMode();
      return;
    }

    if (remoteKey === 'Escape') {
      setShowPreAdhanTransition(false);
      if (view === 'announcement') {
        closeAnnouncement();
        return;
      }
      popView('home');
      return;
    }

    const isNextNavigation = remoteKey === 'PageDown' || remoteKey === 'ArrowRight' || remoteKey === 'ArrowDown';
    const isPreviousNavigation = remoteKey === 'PageUp' || remoteKey === 'ArrowUp' || remoteKey === 'ArrowLeft';
    if (!isNextNavigation && !isPreviousNavigation) return;

    if (showPreAdhanTransition) {
      if (isNextNavigation) {
        setShowPreAdhanTransition(false);
        pushView('adhan');
      }
      return;
    }

    if (view === 'announcement') {
      closeAnnouncement();
      return;
    }

    if (currentMode === 'AUTO' || currentMode === 'PRAYER') {
      if (view === 'home') {
        activateHomeMode('prayer');
        return;
      }
      if (view === 'ghufaylah') {
        dispatchSyntheticKeyDown(isNextNavigation ? 'ArrowRight' : 'ArrowLeft');
        return;
      }
      dispatchSyntheticKeyDown(isNextNavigation ? 'PageDown' : 'PageUp');
      return;
    }

    if (currentMode === 'DUA') {
      if (view === 'home') {
        openFirstActiveDua();
        return;
      }

      if (view === 'ramadanDuas') {
        dispatchSyntheticKeyDown(isNextNavigation ? 'ArrowRight' : 'ArrowLeft');
        return;
      }

      if (view === 'remotePages') {
        dispatchSyntheticKeyDown(isNextNavigation ? 'ArrowRight' : 'ArrowLeft');
        return;
      }

      if (isNextNavigation) {
        openFirstActiveDua();
      } else {
        popView('home');
      }
      return;
    }

    if (view === 'home') {
      openQuranMode({ returnView: 'home', sequenceMode: false });
      return;
    }

    if (view !== 'quran') return;

    issueQuranRemoteCommand(isPreviousNavigation ? 'previousSurah' : 'nextSurah');
  }, [
    activateHomeMode,
    currentMode,
    cycleRemoteMode,
    dispatchSyntheticKeyDown,
    issueQuranRemoteCommand,
    openFirstActiveDua,
    openQuranMode,
    popView,
    pushView,
    showPreAdhanTransition,
    setShowPreAdhanTransition,
    closeAnnouncement,
    view
  ]);

  const handleRemoteLongPress = useCallback((remoteKey: RemoteKey) => {
    if (remoteKey === 'PageUp') {
      cycleRemoteMode();
      return;
    }
    handleRemoteShortPress(remoteKey);
  }, [cycleRemoteMode, handleRemoteShortPress]);

  const handleMobileRemoteCommand = useCallback((message: MobileRemoteCommandMessage) => {
    const command = message?.command;
    const payload = message?.payload || {};
    if (!command) return;

    lastRemoteActionRef.current = Date.now();

    if (command === 'GO_HOME') {
      goHomeFromAnywhere();
      return;
    }

    if (command === 'BACK') {
      setShowPreAdhanTransition(false);
      if (view === 'announcement') {
        closeAnnouncement();
        return;
      }
      popView('home');
      return;
    }

    if (command === 'CHANGE_MODE') {
      const nextMode = String(payload.mode || '').toUpperCase();
      if (nextMode === 'AUTO' || nextMode === 'PRAYER' || nextMode === 'DUA' || nextMode === 'QURAN') {
        switchMode(nextMode as RemoteMode);
      }
      return;
    }

    if (command === 'NEXT_PAGE' || command === 'PREVIOUS_PAGE') {
      const goNext = command === 'NEXT_PAGE';

      if (view === 'announcement') {
        closeAnnouncement();
        return;
      }

      if (showPreAdhanTransition) {
        if (goNext) {
          setShowPreAdhanTransition(false);
          pushView('adhan');
        }
        return;
      }

      if (currentMode === 'AUTO' || currentMode === 'PRAYER') {
        if (view === 'home') {
          activateHomeMode('prayer');
          return;
        }
        dispatchSyntheticKeyDown(goNext ? 'PageDown' : 'PageUp');
        return;
      }

      if (currentMode === 'DUA') {
        if (view !== 'ramadanDuas' && view !== 'remotePages') {
          openFirstActiveDua();
          return;
        }
        setRamadanRemoteMode(true);
        dispatchSyntheticKeyDown(goNext ? 'ArrowRight' : 'ArrowLeft');
        return;
      }

      if (view !== 'quran') {
        openQuranMode({ returnView: 'home', sequenceMode: false });
        return;
      }

      issueQuranRemoteCommand(goNext ? 'nextSurah' : 'previousSurah');
      return;
    }

    if (command === 'PLAY_QURAN') {
      if (currentMode !== 'QURAN') {
        setCurrentMode('QURAN');
        showModeOverlay('QURAN');
      }

      if (view === 'quran') {
        dispatchSyntheticKeyDown('PageUp');
        return;
      }

      openQuranMode({ returnView: 'home', sequenceMode: false });
      return;
    }

    if (command === 'STOP_QURAN') {
      if (view === 'quran') {
        issueQuranRemoteCommand('stopPlayback');
      } else {
        goHomeFromAnywhere();
      }
      return;
    }

    if (command === 'NEXT_SURAH' || command === 'PREVIOUS_SURAH') {
      if (currentMode !== 'QURAN') {
        setCurrentMode('QURAN');
        showModeOverlay('QURAN');
      }

      if (view !== 'quran') {
        openQuranMode({ returnView: 'home', sequenceMode: false });
        return;
      }

      issueQuranRemoteCommand(command === 'NEXT_SURAH' ? 'nextSurah' : 'previousSurah');
      return;
    }

    if (command === 'NEXT_DUA' || command === 'PREVIOUS_DUA') {
      if (currentMode !== 'DUA') {
        setCurrentMode('DUA');
        showModeOverlay('DUA');
      }

      if (view !== 'ramadanDuas' && view !== 'remotePages') {
        openFirstActiveDua();
        return;
      }

      setRamadanRemoteMode(true);
      dispatchSyntheticKeyDown(command === 'NEXT_DUA' ? 'ArrowRight' : 'ArrowLeft');
      return;
    }

    if (command === 'SET_IMAM_NAME') {
      const nextImamName = String(payload.imamName || '').trim();
      if (!nextImamName) return;
      setMosqueData((previous) => {
        const next = normalizeMosqueInfo({
          ...previous,
          imamName: nextImamName
        });
        setStoredJson('mosqueInfo', next);
        return next;
      });
      return;
    }

    if (command === 'SET_QURAN_RECITER') {
      const nextReciterId = String(payload.reciterId || '').trim();
      if (!quranReciters.some((reciter) => reciter.id === nextReciterId)) return;
      setQuranTrackIndex(0);
      setPrayerSettings((previous) => {
        const next = normalizePrayerSettings({
          ...previous,
          quran: {
            ...previous.quran,
            selectedReciterId: nextReciterId
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'SET_QURAN_TRACK_INDEX') {
      const requestedTrackIndex = Number(payload.trackIndex);
      if (!Number.isFinite(requestedTrackIndex)) return;
      if (quranReciter.tracks.length <= 0) return;

      const nextTrackIndex = Math.max(
        0,
        Math.min(quranReciter.tracks.length - 1, Math.round(requestedTrackIndex))
      );

      if (currentMode !== 'QURAN') {
        setCurrentMode('QURAN');
        showModeOverlay('QURAN');
      }

      if (view !== 'quran') {
        openQuranMode({ returnView: 'home', sequenceMode: false });
        setQuranTrackIndex(nextTrackIndex);
        return;
      }

      setQuranTrackIndex(nextTrackIndex);
      return;
    }

    if (command === 'SET_DUA_ACTIVE') {
      const targetDuaId = String(payload.duaId || '').trim();
      if (!targetDuaId) return;
      const nextActive = Boolean(payload.active);
      setPrayerSettings((previous) => {
        const normalizedSystem = normalizeRamadanDuaSystemSettings(previous.ramadanDuaSystem);
        const nextDuas = normalizedSystem.duas.map((dua) =>
          dua.id === targetDuaId ? { ...dua, active: nextActive } : dua
        );
        const next = normalizePrayerSettings({
          ...previous,
          ramadanDuaSystem: {
            ...normalizedSystem,
            duas: nextDuas
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'PREVIEW_DUA') {
      const targetDuaId = String(payload.duaId || '').trim();
      if (!targetDuaId) return;
      if (!ramadanDuaSystemSettings.duas.some((dua) => dua.id === targetDuaId)) return;

      if (currentMode !== 'DUA') {
        setCurrentMode('DUA');
        showModeOverlay('DUA');
      }

      openDuaById(targetDuaId, true);
      return;
    }

    if (command === 'MOVE_DUA') {
      const targetDuaId = String(payload.duaId || '').trim();
      if (!targetDuaId) return;
      const direction = Number(payload.direction || 0);
      if (!Number.isFinite(direction) || direction === 0) return;

      setPrayerSettings((previous) => {
        const normalizedSystem = normalizeRamadanDuaSystemSettings(previous.ramadanDuaSystem);
        const nextOrder = [...normalizedSystem.duaOrder];
        const currentIndex = nextOrder.indexOf(targetDuaId);
        if (currentIndex < 0) return previous;

        const targetIndex = direction > 0 ? currentIndex + 1 : currentIndex - 1;
        if (targetIndex < 0 || targetIndex >= nextOrder.length) return previous;

        [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];

        const next = normalizePrayerSettings({
          ...previous,
          ramadanDuaSystem: {
            ...normalizedSystem,
            duaOrder: nextOrder
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'SET_DUA_SLOTS') {
      const targetDuaId = String(payload.duaId || '').trim();
      if (!targetDuaId) return;
      const requestedSlots = Array.isArray(payload.slots)
        ? payload.slots.filter((slot): slot is DuaDisplaySlot => REMOTE_DUA_SLOT_SET.has(slot as DuaDisplaySlot))
        : [];
      const nextSlots: DuaDisplaySlot[] = requestedSlots.length > 0 ? Array.from(new Set(requestedSlots)) : ['general'];

      setPrayerSettings((previous) => {
        const normalizedSystem = normalizeRamadanDuaSystemSettings(previous.ramadanDuaSystem);
        const nextDuas = normalizedSystem.duas.map((dua) =>
          dua.id === targetDuaId ? { ...dua, slots: nextSlots } : dua
        );
        const next = normalizePrayerSettings({
          ...previous,
          ramadanDuaSystem: {
            ...normalizedSystem,
            duas: nextDuas
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'SET_DUA_LINE_DURATION') {
      const targetDuaId = String(payload.duaId || '').trim();
      if (!targetDuaId) return;
      const requested = payload.lineDurationSec;
      const normalizedDuration =
        typeof requested === 'number' && Number.isFinite(requested)
          ? Math.max(4, Math.min(60, Math.round(requested)))
          : undefined;

      setPrayerSettings((previous) => {
        const normalizedSystem = normalizeRamadanDuaSystemSettings(previous.ramadanDuaSystem);
        const nextDuas = normalizedSystem.duas.map((dua) =>
          dua.id === targetDuaId ? { ...dua, lineDurationSec: normalizedDuration } : dua
        );
        const next = normalizePrayerSettings({
          ...previous,
          ramadanDuaSystem: {
            ...normalizedSystem,
            duas: nextDuas
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'SET_DUA_FONT_SCALE') {
      const requested = Number(payload.fontScale);
      if (!Number.isFinite(requested)) return;
      const normalizedFontScale = Math.max(0.8, Math.min(1.8, Math.round(requested * 100) / 100));

      setPrayerSettings((previous) => {
        const normalizedSystem = normalizeRamadanDuaSystemSettings(previous.ramadanDuaSystem);
        const next = normalizePrayerSettings({
          ...previous,
          ramadanDuaSystem: {
            ...normalizedSystem,
            fontScale: normalizedFontScale
          }
        });
        setStoredJson('prayerSettings', next);
        return next;
      });
      return;
    }

    if (command === 'SET_APP_ZOOM') {
      const requested = Number(payload.zoomFactor);
      if (!Number.isFinite(requested)) return;
      const normalizedZoomFactor = Math.max(0.5, Math.min(2.0, Math.round(requested * 100) / 100));
      const zoomApi = window.electron?.zoom;
      if (!zoomApi) return;
      void zoomApi.set(normalizedZoomFactor).catch(() => {});
      return;
    }

    if (command === 'SET_HOME_BACKGROUND_COLOR' || command === 'SET_HOME_OVERLAY_COLOR') {
      const nextColor = String(payload.color || '').trim();
      if (!nextColor) return;
      if (command === 'SET_HOME_BACKGROUND_COLOR') {
        setHomeBackgroundColor(nextColor);
        setStoredString('homeBackgroundColor', nextColor);
      } else {
        setHomeOverlayColor(nextColor);
        setStoredString('homeOverlayColor', nextColor);
      }
      return;
    }

    if (command === 'SET_HOME_OVERLAY_OPACITY') {
      const nextOpacity = Number(payload.opacity);
      if (!Number.isFinite(nextOpacity)) return;
      const normalizedOpacity = Math.max(0, Math.min(1, nextOpacity));
      setHomeOverlayOpacity(normalizedOpacity);
      setStoredNumber('homeOverlayOpacity', normalizedOpacity);
      return;
    }

    if (command === 'SET_HOME_BACKGROUND_IMAGE_URL') {
      const nextImageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
      const nextValue = nextImageUrl.length > 0 ? nextImageUrl : null;
      setBackgroundImage(nextValue);
      if (nextValue) {
        setStoredString('homeBackgroundImage', nextValue);
      } else {
        removeStoredValue('homeBackgroundImage');
      }
      return;
    }

    if (command === 'SET_PRAYER_TIME') {
      const prayerId = String(payload.prayerId || '').trim();
      const nextTime = String(payload.time || '').trim();
      const isValidTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(nextTime);
      if (!prayerId || !isValidTime) return;

      setScheduleData((previous) => {
        const next = normalizeScheduleData(
          previous.map((prayer) => (prayer.id === prayerId ? { ...prayer, time: nextTime } : prayer))
        );
        setStoredJson('scheduleData', next);
        return next;
      });

      setMonthlySchedule((previous) => {
        if (!previous?.days?.length) return previous;
        const todayNumber = previous.isHijri ? getHijriDay(new Date(), hijriOffset) : new Date().getDate();
        const targetIndex = previous.days.findIndex((day) => Number(day.day_number) === todayNumber);
        if (targetIndex < 0) return previous;

        const fieldByPrayerId: Record<string, string> = {
          imsak: 'imsak',
          fajr: 'fajr',
          sunrise: 'sunrise',
          dhuhr: 'dhuhr',
          asr: 'asr',
          maghrib: 'maghrib',
          isha: 'isha'
        };

        const targetField = fieldByPrayerId[prayerId];
        if (!targetField) return previous;

        const nextDays = previous.days.map((day, index) =>
          index === targetIndex ? { ...day, [targetField]: nextTime } : day
        );
        const next = {
          ...previous,
          days: nextDays,
          lastUpdated: Date.now()
        };
        setStoredJson('prayerTimes', next);
        return next;
      });
    }
  }, [
    activateHomeMode,
    currentMode,
    dispatchSyntheticKeyDown,
    goHomeFromAnywhere,
    hijriOffset,
    issueQuranRemoteCommand,
    closeAnnouncement,
    openDuaById,
    openFirstActiveDua,
    openQuranMode,
    popView,
    quranReciters,
    ramadanDuaSystemSettings.duas,
    quranReciter.tracks.length,
    setRamadanRemoteMode,
    showPreAdhanTransition,
    pushView,
    setShowPreAdhanTransition,
    showModeOverlay,
    switchMode,
    view
  ]);

  useEffect(() => {
    if (!window.electron?.remoteControl) return;

    let disposed = false;
    window.electron.remoteControl
      .getStatus()
      .then((status) => {
        if (!disposed) {
          setRemoteControlStatus(status);
        }
      })
      .catch(() => {});

    const detachStatus = window.electron.remoteControl.onStatus((status) => {
      setRemoteControlStatus(status);
    });

    const detachCommand = window.electron.remoteControl.onCommand((command) => {
      handleMobileRemoteCommand(command);
    });

    return () => {
      disposed = true;
      detachStatus();
      detachCommand();
    };
  }, [handleMobileRemoteCommand]);

  useEffect(() => {
    if (!window.electron?.remoteControl?.publishState) return;
    window.electron.remoteControl.publishState(mobileRemoteStateSnapshot);
  }, [mobileRemoteStateSnapshot]);

  useEffect(() => {
    const clearPressedKeys = () => {
      Object.values(keyPressedRef.current).forEach((state) => {
        if (!state) return;
        window.clearTimeout(state.timerId);
      });
      keyPressedRef.current = {};
      lastKeyActionAtRef.current = {};
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted) return;
      if (view === 'dashboard') return;
      if (isEditableKeyboardTarget(event.target)) return;

      const remoteKey = getRemoteKeyFromEvent(event);
      if (!remoteKey) return;

      console.log('Remote key:', event.key);
      event.preventDefault();
      event.stopPropagation();

      const now = Date.now();
      lastRemoteActionRef.current = now;

      if (remoteKey !== 'PageUp') {
        const lastActionAt = lastKeyActionAtRef.current[remoteKey] ?? 0;
        if (now - lastActionAt < REMOTE_REPEAT_GUARD_MS) return;
        lastKeyActionAtRef.current[remoteKey] = now;
        handleRemoteShortPress(remoteKey);
        return;
      }

      if (keyPressedRef.current.PageUp) return;
      if (event.repeat) return;

      const pressState = {
        startedAt: now,
        reachedLongPress: false,
        timerId: window.setTimeout(() => {
          const activeState = keyPressedRef.current.PageUp;
          if (!activeState || activeState.reachedLongPress) return;
          activeState.reachedLongPress = true;
          handleRemoteLongPress('PageUp');
        }, REMOTE_LONG_PRESS_MS)
      };

      keyPressedRef.current.PageUp = pressState;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.isTrusted) return;
      if (view === 'dashboard') return;
      if (isEditableKeyboardTarget(event.target)) return;

      const remoteKey = getRemoteKeyFromEvent(event);
      if (!remoteKey) return;

      event.preventDefault();
      event.stopPropagation();

      if (remoteKey !== 'PageUp') return;

      const pressState = keyPressedRef.current.PageUp;
      if (!pressState) return;

      delete keyPressedRef.current.PageUp;
      window.clearTimeout(pressState.timerId);

      const pressDuration = Date.now() - pressState.startedAt;
      const isLongPress = pressState.reachedLongPress || pressDuration >= REMOTE_LONG_PRESS_MS;

      if (isLongPress) {
        return;
      }

      handleRemoteShortPress('PageUp');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPressedKeys();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', clearPressedKeys);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearPressedKeys();
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', clearPressedKeys);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRemoteLongPress, handleRemoteShortPress, view]);

  const renderHome = (overlay?: React.ReactNode) => {
    const nextPrayer = prayers[nextPrayerIndex];
    const currentModeInfo = HOME_MODE_INFO[selectedHomeMode];
    return (
      <div className="relative h-full w-full overflow-hidden font-sans text-slate-100">
        <div className="absolute inset-0 z-0 transition-all duration-1000" style={{ background: dynamicBg }}>
          <RamadanBackground />
          {backgroundImage ? (
            <>
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }}></div>
              <div className="absolute inset-0" style={{ backgroundColor: homeOverlayColor, opacity: homeOverlayOpacity }}></div>
            </>
          ) : (
            <div className="absolute inset-0" style={{ backgroundColor: homeBackgroundColor }}></div>
          )}
        </div>
        <div className="relative z-10 flex h-full flex-col gap-8 p-6 md:p-8 lg:p-12">
          <header className="flex min-h-[7.5rem] items-center gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-7 py-5 backdrop-blur-xl md:px-8">
	            <div className="flex shrink-0 items-center gap-4">
	              <button onClick={openDashboard} className="rounded-xl bg-white/10 p-3 text-gray-300 transition hover:bg-gold-500 hover:text-white"><Settings className="w-6 h-6" /></button>
	              <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }} className="hidden rounded-xl bg-white/10 p-3 text-gray-300 transition hover:bg-gold-500 hover:text-white md:block"><Maximize className="w-6 h-6" /></button>
	              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/8 px-4 py-2">
	                <span className="text-2xl leading-none">{currentModeInfo.icon}</span>
	                <div className="text-right">
	                  <div className="text-sm font-black text-amber-100">{currentModeInfo.title}</div>
	                  <div className="text-[10px] text-slate-300">{currentModeInfo.subtitle}</div>
	                </div>
	              </div>
	            </div>
            <div className="min-w-0 flex-1 px-4 text-center">
              <h1 className="font-mosque-name mx-auto max-w-[26ch] bg-gradient-to-r from-gold-50 via-gold-300 to-gold-100 bg-clip-text text-[clamp(3.25rem,5vw,7.35rem)] leading-[0.92] text-transparent break-words drop-shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
                {mosqueData.name}
              </h1>
              {occasionData.show && (
                <div className="pointer-events-none mt-4 flex justify-center">
                  <div
                    className="occasion-pill inline-flex max-w-[min(92vw,58rem)] items-center justify-center gap-3 rounded-[1.4rem] border px-6 py-3 text-center shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                    style={{
                      borderColor: occasionData.borderColor || '#d4ac0d',
                      background: occasionData.backgroundColor
                        ? `linear-gradient(135deg, ${occasionData.backgroundColor}55, ${occasionData.backgroundColor}22)`
                        : 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(19,28,45,0.75))'
                    }}
                  >
                    <Star className="h-5 w-5 shrink-0 text-gold-200/90" />
                    <span
                      className="font-qadasi text-[clamp(1.4rem,2.1vw,2.3rem)] leading-[1.2] tracking-[0.01em]"
                      style={{ color: occasionData.descriptionColor || '#fef3c6' }}
                    >
                      {occasionData.description}
                    </span>
                    <Star className="h-5 w-5 shrink-0 text-gold-200/90" />
                  </div>
                </div>
              )}
            </div>
            <div className="max-w-[18rem] shrink-0 text-right">
              <div className="text-2xl font-bold text-white font-amiri">{formatDateAR(currentTime, hijriOffset)}</div>
              <div className="text-sm uppercase tracking-widest text-gold-300/80">{currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </header>
          <main className="flex flex-1 flex-col items-center justify-center gap-16 lg:flex-row lg:gap-36 xl:gap-44">
            <div className="flex flex-col items-center lg:items-end">
              <div className="relative">
                <div className="font-sans text-[9rem] font-bold leading-[0.9] tracking-tighter text-white md:text-[12rem]">
                  {formatTime(currentTime).split(':')[0]}<span className="text-gold-500">:</span>{formatTime(currentTime).split(':')[1]}
                </div>
                <div className="absolute -top-4 -right-12 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-4xl font-light text-gold-400">{getAmPm(currentTime) === 'AM' ? 'ص' : 'م'}</div>
              </div>
              {mosqueData.imamName && (
                <div className="mt-6 flex items-center gap-4 rounded-full border border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-3 shadow-2xl">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-slate-900"><User className="w-5 h-5" /></div>
                  <div className="text-right">
                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-400">إمام الجماعة</span>
                    <span className="block text-xl font-bold text-white font-amiri">{mosqueData.imamName}</span>
                  </div>
                </div>
              )}
            </div>
            <NextPrayerCountdown
              timeRemaining={timeRemaining}
              nextPrayerName={nextPrayer?.nameAR || ''}
              nextPrayerTime={nextPrayer?.time || ''}
              nameColor="#ffffff"
              labelText={nextPrayer && ['fajr', 'dhuhr', 'maghrib'].includes(nextPrayer.id) ? 'الصلاة القادمة' : 'الموعد القادم'}
            />
          </main>
	          <footer className="w-full">
	            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-2xl">
	              <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">{prayers.filter((prayer) => prayer.time && prayer.time !== '--:--').map((prayer) => <PrayerCard key={prayer.id} prayer={prayer} />)}</div>
	            </div>
	          </footer>
	        </div>
	        {overlay}
	      </div>
	    );
	  };

  const openDashboard = useCallback(() => {
    setDashboardVariant('quick');
    startTransition(() => pushView('dashboard'));
  }, [pushView]);

  const openAdvancedSettings = useCallback(() => {
    setDashboardVariant('advanced');
    startTransition(() => pushView('dashboard'));
  }, [pushView]);

  const closeDashboard = useCallback(() => {
    popView('launcher');
  }, [popView]);

  const updateMosqueInfo = useCallback((value: MosqueInfo) => {
    updateData('mosqueInfo', normalizeMosqueInfo(value), setMosqueData);
  }, [updateData]);
  const updateOccasionInfo = useCallback(
    (value: Occasion) => updateData('occasionData', normalizeOccasionData(value), setOccasionData),
    [updateData]
  );
  const updateScheduleInfo = useCallback(
    (value: PrayerTime[]) => updateData('scheduleData', normalizeScheduleData(value), setScheduleData),
    [updateData]
  );
  const updateMonthlyScheduleInfo = useCallback((value: MonthlySchedule) => {
    const sanitized = sanitizeMonthlySchedule(value) ?? value;
    updateData('monthlySchedule', sanitized, setMonthlySchedule);
  }, [updateData]);
  const updateAdhanSettingsInfo = useCallback((value: AdhanSettings) => updateData('adhanSettings', value, setAdhanSettings), [updateData]);
  const updatePrayerSettingsInfo = useCallback((value: PrayerSettings) => updateData('prayerSettings', normalizePrayerSettings(value), setPrayerSettings), [updateData]);
  const updateQuranVolume = useCallback((nextVolume: number) => {
    const normalized = Math.max(0, Math.min(1, Number.isFinite(nextVolume) ? nextVolume : prayerSettings.quran.volume));
    setQuranVolume(normalized);
    const nextSettings = normalizePrayerSettings({
      ...prayerSettings,
      quran: {
        ...prayerSettings.quran,
        volume: normalized
      }
    });
    setPrayerSettings(nextSettings);
    setStoredJson('prayerSettings', nextSettings);
  }, [prayerSettings]);
  const updateBackgroundColorInfo = useCallback((value: string) => {
    setHomeBackgroundColor(value);
    setStoredString('homeBackgroundColor', value);
  }, []);
  const updateOverlayColorInfo = useCallback((value: string) => {
    setHomeOverlayColor(value);
    setStoredString('homeOverlayColor', value);
  }, []);
  const updateOverlayOpacityInfo = useCallback((value: number) => {
    setHomeOverlayOpacity(value);
    setStoredNumber('homeOverlayOpacity', value);
  }, []);
  const updateHijriOffsetInfo = useCallback((value: number) => updateSimpleValue('hijriOffset', value, setHijriOffset), [updateSimpleValue]);
  const handleUploadBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    setBackgroundImage(dataUrl);
    setStoredString('homeBackgroundImage', dataUrl);
  }, []);
  const handleUpdateBackgroundUrl = useCallback((url: string | null) => {
    setBackgroundImage(url);
    if (url) setStoredString('homeBackgroundImage', url);
    else removeStoredValue('homeBackgroundImage');
  }, []);
  const handleUploadAdhanBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    updateAdhanSettingsInfo({ ...adhanSettings, backgroundImage: dataUrl });
  }, [adhanSettings, updateAdhanSettingsInfo]);
  const handleUploadPrayerBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    updatePrayerSettingsInfo({ ...prayerSettings, backgroundImage: dataUrl });
  }, [prayerSettings, updatePrayerSettingsInfo]);
  const handleUploadTasbeehBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    updatePrayerSettingsInfo({ ...prayerSettings, tasbeeh: { ...prayerSettings.tasbeeh, backgroundImage: dataUrl } });
  }, [prayerSettings, updatePrayerSettingsInfo]);
  const handleUploadQuranVerseBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    updatePrayerSettingsInfo({ ...prayerSettings, quranVerse: { ...prayerSettings.quranVerse, backgroundImage: dataUrl } });
  }, [prayerSettings, updatePrayerSettingsInfo]);
  const previewRamadanDua = useCallback((duaId?: string) => {
    setRamadanForcedDuaId(duaId || null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(true);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(null);
    pushView('ramadanDuas');
  }, [pushView]);

  const previewAnnouncement = useCallback(() => {
    setShowPreAdhanTransition(false);
    setRamadanForcedDuaId(null);
    setRamadanContextSlot(null);
    setRamadanPreviewMode(false);
    setRamadanRemoteMode(false);
    setPostDuaNextPrayerId(null);
    setAnnouncementExitPlan({ type: 'pop' });
    pushView('announcement');
  }, [pushView]);

  const dashboardOverlay = useMemo(() => (
    <Suspense fallback={<DashboardOverlayFallback />}>
      <Dashboard
        onBack={closeDashboard}
        variant={dashboardVariant}
        currentMosqueInfo={mosqueData}
        onUpdateMosqueInfo={updateMosqueInfo}
        currentOccasion={occasionData}
        onUpdateOccasion={updateOccasionInfo}
        currentSchedule={scheduleData}
        onUpdateSchedule={updateScheduleInfo}
        currentBackgroundImage={backgroundImage}
        onUploadBackground={handleUploadBackground}
        onUpdateBackgroundUrl={handleUpdateBackgroundUrl}
        currentHomeBackgroundColor={homeBackgroundColor}
        onUpdateHomeBackgroundColor={updateBackgroundColorInfo}
        currentHomeOverlayColor={homeOverlayColor}
        onUpdateHomeOverlayColor={updateOverlayColorInfo}
        currentHomeOverlayOpacity={homeOverlayOpacity}
        onUpdateHomeOverlayOpacity={updateOverlayOpacityInfo}
        currentAdhanSettings={adhanSettings}
        onUpdateAdhanSettings={updateAdhanSettingsInfo}
        onUploadAdhanBackground={handleUploadAdhanBackground}
        currentPrayerSettings={prayerSettings}
        onUpdatePrayerSettings={updatePrayerSettingsInfo}
        onUploadPrayerBackground={handleUploadPrayerBackground}
        currentMonthlySchedule={monthlySchedule}
        onUpdateMonthlySchedule={updateMonthlyScheduleInfo}
        onUploadTasbeehBackground={handleUploadTasbeehBackground}
        onUploadQuranVerseBackground={handleUploadQuranVerseBackground}
        currentHijriOffset={hijriOffset}
        onUpdateHijriOffset={updateHijriOffsetInfo}
        onPreviewRamadanDua={previewRamadanDua}
        onPreviewAnnouncement={previewAnnouncement}
        onPreviewQuranMode={() => openQuranMode({ returnView: 'dashboard', sequenceMode: false })}
        remoteControlStatus={remoteControlStatus}
      />
    </Suspense>
  ), [
    adhanSettings,
    backgroundImage,
    closeDashboard,
    dashboardVariant,
    handleUpdateBackgroundUrl,
    handleUploadAdhanBackground,
    handleUploadBackground,
    handleUploadPrayerBackground,
    handleUploadQuranVerseBackground,
    handleUploadTasbeehBackground,
    hijriOffset,
    homeBackgroundColor,
    homeOverlayColor,
    homeOverlayOpacity,
    monthlySchedule,
    mosqueData,
    occasionData,
    openQuranMode,
    prayerSettings,
    previewAnnouncement,
    previewRamadanDua,
    remoteControlStatus,
    scheduleData,
    updateAdhanSettingsInfo,
    updateBackgroundColorInfo,
    updateHijriOffsetInfo,
    updateMonthlyScheduleInfo,
    updateOccasionInfo,
    updateOverlayColorInfo,
    updateOverlayOpacityInfo,
    updatePrayerSettingsInfo,
    updateMosqueInfo,
    updateScheduleInfo
  ]);

  const remoteModeIndicator = null;

  const modeChangeOverlay = null;

  const renderScene = (sceneView: AppView) => {
    switch (sceneView) {
      case 'launcher':
        return (
          <MosqueLaunchpad
            mosqueName={mosqueData.name}
            city={mosqueData.location}
            imamName={mosqueData.imamName}
            code={remoteMosqueCode}
            onEnter={() => resetToView('home')}
            onOpenSettings={openAdvancedSettings}
          />
        );
      case 'dashboard':
        return (navigationStack[navigationStack.length - 2] || 'launcher') === 'launcher'
          ? (
            <MosqueLaunchpad
              mosqueName={mosqueData.name}
              city={mosqueData.location}
              imamName={mosqueData.imamName}
              code={remoteMosqueCode}
              onEnter={() => resetToView('home')}
              onOpenSettings={openAdvancedSettings}
              overlay={dashboardOverlay}
            />
          )
          : renderHome(dashboardOverlay);
      case 'quran':
        return renderHome(
          <QuranAudioOverlay
            reciter={quranReciter}
            trackIndex={quranTrackIndex}
            volume={quranVolume}
            onTrackChange={setQuranTrackIndex}
            onVolumeChange={updateQuranVolume}
            onBack={() => popView('home')}
            onComplete={() => {
              if (quranSequenceMode) {
                handleSequenceCompletion();
                return;
              }
              popView('home');
            }}
            remoteCommand={quranRemoteCommand}
          />
        );
      case 'adhan':
        return <AdhanView prayerName={`أذان صلاة ${activePrayer.nameAR}`} imamName={mosqueData.imamName} settings={adhanSettings} onExit={() => { if (advancePrayerFlow()) return; replaceView('prayer'); }} onBack={() => { setOverridePrayer(null); setActivePrayerFlow(null); activePrayerFlowRef.current = null; resetToView('home'); }} />;
      case 'prayer':
        return <PrayerView currentPrayer={activePrayer} imamName={mosqueData.imamName} settings={prayerSettings} onExit={() => { if (advancePrayerFlow()) return; resetToView('home'); }} onBack={() => { setActivePrayerFlow(null); activePrayerFlowRef.current = null; popView('home'); }} onNext={() => { if (advancePrayerFlow()) return; pushView('tasbeeh'); }} />;
      case 'tasbeeh':
        return <TasbeehView settings={prayerSettings} onExit={advanceAfterTasbeeh} onPrevious={() => popView('home')} />;
      case 'quranVerse':
        return <QuranVerseView mosqueName={mosqueData.name} settings={prayerSettings} onExit={advanceAfterQuranVerse} />;
      case 'ghufaylah':
        return <GhufaylahView settings={prayerSettings} onExit={() => { if (advancePrayerFlow()) return; const ishaPrayer = prayers.find((item) => item.id === 'isha') || INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'isha'); if (ishaPrayer) { setOverridePrayer(ishaPrayer as PrayerTime); replaceView('prayer'); } else replaceView('home'); }} onBack={() => popView('home')} />;
      case 'duaAhd':
        return <DuaAhdView settings={prayerSettings} onExit={() => { if (advancePrayerFlow()) return; pushView('duaSabah'); }} onBack={() => popView('home')} />;
      case 'duaSabah':
        return <DuaSabahView mosqueName={mosqueData.name} settings={prayerSettings} onBack={() => popView('home')} onExit={() => { if (advancePrayerFlow()) return; if (activePrayer.id === 'fajr') { setShowPreAdhanTransition(true); return; } setOverridePrayer(null); resetToView('home'); }} />;
      case 'ramadanDuas':
        if (ramadanForcedDuaId === 'dua_sabah') {
          return (
            <DuaSabahView
              mosqueName={mosqueData.name}
              settings={prayerSettings}
              onBack={exitRamadanViewer}
              onExit={exitRamadanViewer}
            />
          );
        }
        if (ramadanForcedDuaId === 'dua_ahd') {
          return (
            <DuaAhdView
              settings={prayerSettings}
              onBack={exitRamadanViewer}
              onExit={exitRamadanViewer}
            />
          );
        }
        return <RamadanDuasView settings={prayerSettings} forcedDuaId={ramadanForcedDuaId} contextSlot={ramadanContextSlot} previewMode={ramadanPreviewMode} controlScheme={ramadanRemoteMode ? 'presenter' : 'legacy'} onExit={exitRamadanViewer} onBack={exitRamadanViewer} />;
      case 'remotePages':
        return (
          <RemoteManagedPagesView
            pages={remotePagesSession || remoteManagedPages}
            mosqueName={mosqueData.name}
            onExit={exitRemotePages}
          />
        );
      case 'announcement':
        return (
          <AnnouncementView
            settings={prayerSettings}
            mosqueName={mosqueData.name}
            onExit={closeAnnouncement}
          />
        );
      default:
        return renderHome();
    }
  };

  if (!localModeFallback && (!remoteMosqueCode || !remoteMosqueDoc)) {
    return (
      <MosqueCodeGate
        loading={remoteBindingLoading}
        error={remoteBindingError}
        onSubmit={handleBindMosqueScreen}
        onUseLocalMode={handleUseLocalModeFallback}
      />
    );
  }

  if (showPreAdhanTransition && activePrayer) {
    return (
      <>
        <PreAdhanTransition prayer={activePrayer} settings={adhanSettings} onComplete={() => { setShowPreAdhanTransition(false); if (advancePrayerFlow()) return; pushView('adhan'); }} />
        {remoteModeIndicator}
        {modeChangeOverlay}
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<SceneLoadingFallback />}>
        {renderScene(view)}
      </Suspense>
      {remoteModeIndicator}
      {modeChangeOverlay}
    </>
  );
};

export default App;
