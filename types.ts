
export interface PrayerTime {
  id: string;
  nameAR: string;
  nameEN: string;
  time: string; // 24h format HH:mm
  isNext: boolean;
  isCurrent: boolean;
  icon: 'sun' | 'moon' | 'sunrise' | 'sunset' | 'clock';
}

export interface Occasion {
  title: string;
  description: string;
  date: string;
  show: boolean;
  borderColor?: string;
  descriptionColor?: string;
  backgroundColor?: string;
  nextPrayerColor?: string;
}

export interface MosqueInfo {
  name: string;
  location: string;
  imamName: string;
  savedImamNames: string[];
}

export interface AdhanSettings {
  transitionMode: 'manual' | 'auto';
  autoDuration: number; // Seconds per line
  borderColor: string;
  backgroundColor: string;
  backgroundImage: string | null;
}

export interface TasbeehSettings {
  akbarColor: string;
  hamdColor: string;
  subhanColor: string;
  backgroundImage: string | null;
}

export interface DuaAhdSettings {
  backgroundImage: string | null;
}

export interface DuaSabahSettings {
  backgroundImage: string | null;
}

export interface RamadanDuasSettings {
  backgroundImage: string | null;
}

export interface QuranVerseSettings {
  backgroundImage: string | null;
}

export interface QuranTrack {
  id: string;
  title: string;
  subtitle: string;
  audioSrc: string;
}

export interface QuranReciter {
  id: string;
  name: string;
  description: string;
  tracks: QuranTrack[];
}

export interface QuranSettings {
  enabled: boolean;
  selectedReciterId: string;
  volume: number;
  uploadedTracks: QuranTrack[];
}

export type DuaDisplaySlot =
  | 'general'
  | 'before_fajr'
  | 'before_dhuhr'
  | 'before_maghrib'
  | 'after_fajr'
  | 'after_dhuhr'
  | 'after_asr'
  | 'after_maghrib'
  | 'after_isha';

export type DuaWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface RamadanDuaItem {
  id: string;
  title: string;
  text: string;
  active: boolean;
  slots: DuaDisplaySlot[];
  weekdays?: DuaWeekday[];
  lineDurationSec?: number;
  isBuiltin?: boolean;
}

export interface BeforePrayerDuaMap {
  fajr: string;
  dhuhr: string;
  maghrib: string;
}

export interface RamadanDuaAutomationSettings {
  enabled: boolean;
  minutesBeforePrayer: number;
  beforePrayerDuaByPrayer: BeforePrayerDuaMap;
}

export interface RamadanDuaSystemSettings {
  enabled: boolean;
  autoRotate: boolean;
  advanceMode: 'manual' | 'auto';
  displayDurationSec: number;
  fontScale: number;
  backgroundImage: string | null;
  backgroundColor: string;
  mosqueMode: boolean;
  hideAdminControlsInMosqueMode: boolean;
  remoteControlMode: boolean;
  ramadanTheme: boolean;
  nightMode: boolean;
  autoScrollLongDuas: boolean;
  showReadingBar: boolean;
  readingBarColor: string;
  duas: RamadanDuaItem[];
  duaOrder: string[];
  automation: RamadanDuaAutomationSettings;
}

export interface PostIshaSettings {
  backgroundImage: string | null;
}

export type AnnouncementPrayerTrigger = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface AnnouncementSettings {
  enabled: boolean;
  title: string;
  body: string;
  durationSec: number;
  accentColor: string;
  backgroundImage: string | null;
  triggerAfterPrayers: AnnouncementPrayerTrigger[];
}

export interface PrayerSettings {
  transitionMode: 'manual' | 'auto';
  autoDuration: number;
  backgroundColor: string;
  backgroundImage: string | null;
  overlayOpacity: number;
  tasbeeh: TasbeehSettings;
  quranVerse: QuranVerseSettings;
  quran: QuranSettings;
  duaAhd: DuaAhdSettings;
  duaSabah: DuaSabahSettings;
  ramadanDuas: RamadanDuasSettings;
  ramadanDuaSystem: RamadanDuaSystemSettings;
  postIsha: PostIshaSettings;
  announcement: AnnouncementSettings;
}

export interface TimeState {
  currentTime: Date;
  nextPrayerIndex: number;
  timeRemaining: number;
}

export interface TimetableDay {
  day_number: number;
  day_name: string;
  hijri_date: string;
  imsak: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr?: string;      // Added for full support
  maghrib: string;
  isha?: string;     // Added for full support
  end_isha: string;
  event: string;
}

export interface MonthlySchedule {
  monthName: string;
  days: TimetableDay[];
  lastUpdated: number;
  isHijri?: boolean;
}

// --- Added for Full App State Management ---

export interface MosqueTheme {
  homeBackgroundImage: string | null;
  homeBackgroundColor: string;
  homeOverlayColor: string;
  homeOverlayOpacity: number;
}

export interface MosqueData {
  mosqueInfo: MosqueInfo;
  occasion: Occasion;
  schedule: PrayerTime[];
  monthlySchedule: MonthlySchedule | null;
  adhanSettings: AdhanSettings;
  prayerSettings: PrayerSettings;
  theme: MosqueTheme;
  hijriOffset: number;
}

export interface MosqueProfile {
  id: string;
  pin: string; // Hashed PIN
  data: MosqueData;
  lastUpdated: number;
}

export type RemoteDisplayMode = 'AUTO' | 'PRAYER' | 'DUA' | 'QURAN';

export type RemoteManagedPageType =
  | 'dua'
  | 'quran'
  | 'announcement'
  | 'custom_text'
  | 'image';

export type RemotePagePlacement = 'general' | 'after_prayer';

export type RemotePrayerFlowSystemStep =
  | 'dua_ahd'
  | 'dua_sabah'
  | 'pre_adhan'
  | 'adhan'
  | 'iqama'
  | 'tasbeeh'
  | 'quran_verse'
  | 'ghufaylah'
  | 'announcement_builtin';

export interface RemotePrayerFlowItem {
  id: string;
  type: 'system' | 'page';
  enabled: boolean;
  order: number;
  systemStep?: RemotePrayerFlowSystemStep;
  pageId?: string;
}

export type RemotePrayerFlowMap = Record<AnnouncementPrayerTrigger, RemotePrayerFlowItem[]>;

export interface RemoteManagedPage {
  id: string;
  type: RemoteManagedPageType;
  title: string;
  content: string;
  order: number;
  groupOrder: number;
  enabled: boolean;
  autoSplit: boolean;
  placement: RemotePagePlacement;
  prayerTriggers: AnnouncementPrayerTrigger[];
  weekdays: DuaWeekday[];
  accentColor?: string;
  backgroundImage?: string | null;
  imageUrl?: string | null;
  textAlign?: 'center' | 'right';
}

export interface RemotePrayerAdjustments {
  fajr: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface RemotePrayerControlSettings {
  mode: 'auto' | 'manual';
  city: string;
  adjustments: RemotePrayerAdjustments;
  manualTimes: Partial<Record<AnnouncementPrayerTrigger, string>>;
}

export interface RemoteGlobalSystemSettings {
  prayerSettings: RemotePrayerControlSettings;
  schedule: PrayerTime[];
  monthlySchedule: MonthlySchedule | null;
  theme: MosqueTheme;
  hijriOffset: number;
}

export interface RemoteDisplayConfig {
  mosqueInfo: MosqueInfo;
  occasion: Occasion;
  schedule: PrayerTime[];
  monthlySchedule: MonthlySchedule | null;
  adhanSettings: AdhanSettings;
  prayerSettings: PrayerSettings;
  theme: MosqueTheme;
  hijriOffset: number;
}

export interface RemoteMosqueDocument {
  id: string;
  name: string;
  city: string;
  code: string;
  passwordHash: string;
  theme: string;
  mode: RemoteDisplayMode;
  pages: RemoteManagedPage[];
  prayerFlows: RemotePrayerFlowMap;
  prayerSettings: RemotePrayerControlSettings;
  displayConfig: RemoteDisplayConfig;
  lastUpdated: number;
}

export interface RemoteGlobalConfig {
  pages: RemoteManagedPage[];
  systemSettings: RemoteGlobalSystemSettings;
  lastUpdated: number;
}

export interface RemoteAdminSession {
  uid: string;
  email: string;
  displayName: string;
  provider: 'firebase' | 'firestore' | 'local';
}
