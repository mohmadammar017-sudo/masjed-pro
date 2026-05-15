import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronLeft,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Fingerprint,
  FolderOpen,
  ImagePlus,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  MonitorSmartphone,
  Move,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2
} from 'lucide-react';
import { INITIAL_PRAYER_SCHEDULE } from '../../constants';
import { isConfigured } from '../../services/firebase';
import {
  createMosque,
  deleteMosque,
  generateMosqueCode,
  normalizeRemoteMosqueDocument,
  registerAdmin,
  signInAdmin,
  signOutAdminSession,
  subscribeAdminSession,
  subscribeGlobalConfig,
  subscribeMosques,
  updateGlobalConfig,
  updateMosque,
  uploadRemoteAsset
} from '../../services/remoteMosqueService';
import {
  AnnouncementPrayerTrigger,
  DuaWeekday,
  MonthlySchedule,
  RemoteAdminSession,
  RemoteDisplayMode,
  RemoteGlobalConfig,
  RemoteManagedPage,
  RemotePrayerFlowItem,
  RemotePrayerFlowSystemStep,
  RemoteMosqueDocument
} from '../../types';
import {
  ALL_REMOTE_PAGE_WEEKDAYS,
  buildRemoteDisplaySlides,
  createRemotePageDraft,
  filterRemotePagesForContext,
  getRemotePageWeekdayKey,
  mergeRemotePages,
  renumberRemotePages
} from '../../utils/remotePages';
import {
  createPageFlowItem,
  normalizePrayerFlows,
  PRAYER_FLOW_PRAYERS,
  PRAYER_FLOW_SYSTEM_LABELS
} from '../../utils/remotePrayerFlows';
import { hashPin } from '../../utils';

const TimetableManager = React.lazy(() => import('../TimetableManager'));

type Workspace = 'mosques' | 'mosque_detail' | 'global';
type AuthMode = 'login' | 'register';
type MosqueTab = 'overview' | 'prayers' | 'pages' | 'preview';
type MosqueSectionView = 'menu' | MosqueTab;
type PageGroup = 'general' | AnnouncementPrayerTrigger;

const ADMIN_SELECTED_MOSQUE_KEY = 'admin_selected_mosque_v2';
const ADMIN_SELECTED_TAB_KEY = 'admin_selected_tab_v2';
const ADMIN_SELECTED_PRAYER_KEY = 'admin_selected_prayer_v1';
const ADMIN_HOSTING_URL = `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'masjid-display-260423'}.web.app/#/admin`;
const ADMIN_LOGO_SRC = '/admin-logo.png';

const MODE_OPTIONS: Array<{ id: RemoteDisplayMode; label: string; helper: string }> = [
  { id: 'AUTO', label: 'تلقائي', helper: 'البرنامج يدير العرض حسب الصلاة والصفحات المضافة.' },
  { id: 'PRAYER', label: 'الصلاة', helper: 'تركيز كامل على شاشة الصلاة ومواقيتها فقط.' },
  { id: 'DUA', label: 'الأدعية', helper: 'عرض صفحات الأدعية والإعلانات بشكل متتابع.' },
  { id: 'QURAN', label: 'القرآن', helper: 'تثبيت العرض على وضع القرآن والتلاوة.' }
];

const MODE_LABELS: Record<RemoteDisplayMode, string> = {
  AUTO: 'الوضع التلقائي',
  PRAYER: 'وضع الصلاة',
  DUA: 'وضع الأدعية',
  QURAN: 'وضع القرآن'
};

const PAGE_TYPE_OPTIONS: Array<{ id: RemoteManagedPage['type']; label: string }> = [
  { id: 'dua', label: 'دعاء' },
  { id: 'quran', label: 'قرآن' },
  { id: 'announcement', label: 'إعلان' },
  { id: 'custom_text', label: 'نص مخصص' },
  { id: 'image', label: 'صورة كاملة' }
];

const PRAYER_FIELDS: Array<{ id: keyof RemoteMosqueDocument['prayerSettings']['manualTimes']; label: string }> = [
  { id: 'fajr', label: 'الفجر' },
  { id: 'dhuhr', label: 'الظهر' },
  { id: 'asr', label: 'العصر' },
  { id: 'maghrib', label: 'المغرب' },
  { id: 'isha', label: 'العشاء' }
];

const PAGE_GROUP_OPTIONS: Array<{ id: PageGroup; label: string; helper: string }> = [
  { id: 'general', label: 'عام', helper: 'يظهر في وضع الأدعية العام' },
  { id: 'fajr', label: 'بعد الفجر', helper: 'محتوى خاص بتسلسل الفجر' },
  { id: 'dhuhr', label: 'بعد الظهر', helper: 'محتوى خاص بتسلسل الظهر' },
  { id: 'asr', label: 'بعد العصر', helper: 'محتوى خاص بتسلسل العصر' },
  { id: 'maghrib', label: 'بعد المغرب', helper: 'محتوى خاص بتسلسل المغرب' },
  { id: 'isha', label: 'بعد العشاء', helper: 'محتوى خاص بتسلسل العشاء' }
];

const PRAYER_FLOW_OPTIONS: Array<{ id: AnnouncementPrayerTrigger; label: string; helper: string }> = [
  { id: 'fajr', label: 'الفجر', helper: 'بداية اليوم وما قبل الشروق' },
  { id: 'dhuhr', label: 'الظهر', helper: 'الصلاة الأولى في فترة الظهيرة' },
  { id: 'asr', label: 'العصر', helper: 'التسلسل الذي يلي الظهر في النظام' },
  { id: 'maghrib', label: 'المغرب', helper: 'فترة الغروب وما بعدها' },
  { id: 'isha', label: 'العشاء', helper: 'ختام الليلة والشاشات اللاحقة' }
];

const SYSTEM_STEP_BADGES: Record<RemotePrayerFlowSystemStep, string> = {
  dua_ahd: 'دعاء',
  dua_sabah: 'دعاء',
  pre_adhan: 'تنبيه',
  adhan: 'أذان',
  iqama: 'إقامة',
  tasbeeh: 'تسبيح',
  quran_verse: 'آية',
  ghufaylah: 'نافلة',
  announcement_builtin: 'إعلان'
};

const SYSTEM_STEP_ACCENTS: Record<RemotePrayerFlowSystemStep, string> = {
  dua_ahd: '#f0c56b',
  dua_sabah: '#f59e0b',
  pre_adhan: '#7dd3fc',
  adhan: '#34d399',
  iqama: '#f8fafc',
  tasbeeh: '#fb7185',
  quran_verse: '#60a5fa',
  ghufaylah: '#a78bfa',
  announcement_builtin: '#fb923c'
};

const WEEKDAY_OPTIONS: Array<{ id: DuaWeekday; label: string }> = [
  { id: 'sunday', label: 'الأحد' },
  { id: 'monday', label: 'الاثنين' },
  { id: 'tuesday', label: 'الثلاثاء' },
  { id: 'wednesday', label: 'الأربعاء' },
  { id: 'thursday', label: 'الخميس' },
  { id: 'friday', label: 'الجمعة' },
  { id: 'saturday', label: 'السبت' }
];

const DEFAULT_GLOBAL_CONFIG: RemoteGlobalConfig = {
  pages: [],
  systemSettings: {
    prayerSettings: {
      mode: 'manual',
      city: 'Dammam',
      adjustments: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      manualTimes: {
        fajr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'fajr')?.time || '04:56',
        dhuhr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'dhuhr')?.time || '12:03',
        asr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'asr')?.time || '',
        maghrib: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'maghrib')?.time || '17:35',
        isha: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'isha')?.time || ''
      }
    },
    schedule: [...(INITIAL_PRAYER_SCHEDULE as unknown as RemoteGlobalConfig['systemSettings']['schedule'])],
    monthlySchedule: null,
    theme: {
      homeBackgroundImage: null,
      homeBackgroundColor: '#020617',
      homeOverlayColor: '#000000',
      homeOverlayOpacity: 0.45
    },
    hijriOffset: 0
  },
  lastUpdated: Date.now()
};

const readStoredValue = (key: string, fallback = '') => {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const persistValue = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures in kiosk devices.
  }
};

const formatLastUpdated = (value?: number) => {
  if (!value) return 'غير معروف';
  return new Date(value).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const countEnabledPages = (pages: RemoteManagedPage[]) => pages.filter((page) => page.enabled).length;

const getTabLabel = (tab: MosqueTab) => {
  switch (tab) {
    case 'overview':
      return 'هوية المسجد';
    case 'prayers':
      return 'الصلوات والتسلسل';
    case 'pages':
      return 'مكتبة المحتوى';
    case 'preview':
      return 'معاينة النظام';
    default:
      return tab;
  }
};

const getTabMeta = (tab: MosqueTab) => {
  switch (tab) {
    case 'overview':
      return {
        description: 'تخصيص اسم المسجد والهوية والخلفية العامة',
        icon: <Fingerprint className="h-6 w-6" />,
        accentClass: 'admin-section-icon-gold',
        features: ['الاسم والكود', 'ألوان الشاشة', 'خلفية الرئيسية']
      };
    case 'prayers':
      return {
        description: 'إدارة تسلسل الصلاة وترتيب الأذان والإقامة والمحتوى',
        icon: <CalendarClock className="h-6 w-6" />,
        accentClass: 'admin-section-icon-emerald',
        features: ['تسلسل الصلوات', 'الأذان والإقامة', 'السحب والإفلات']
      };
    case 'pages':
      return {
        description: 'إضافة الأدعية والإعلانات والصور وتحديد أيام ظهورها',
        icon: <FolderOpen className="h-6 w-6" />,
        accentClass: 'admin-section-icon-blue',
        features: ['أدعية', 'إعلانات', 'صور شرائح']
      };
    case 'preview':
      return {
        description: 'معاينة شاشة المسجد كما ستظهر بعد الحفظ',
        icon: <Eye className="h-6 w-6" />,
        accentClass: 'admin-section-icon-slate',
        features: ['معاينة مباشرة', 'فحص الترتيب', 'اختبار المشهد']
      };
    default:
      return {
        description: '',
        icon: <LayoutDashboard className="h-6 w-6" />,
        accentClass: 'admin-section-icon-gold',
        features: []
      };
  }
};

const getPageGroup = (page: RemoteManagedPage): PageGroup => {
  if (page.placement === 'after_prayer' && page.prayerTriggers[0]) {
    return page.prayerTriggers[0];
  }
  return 'general';
};

const matchesPageGroup = (page: RemoteManagedPage, group: PageGroup) => {
  if (group === 'general') {
    return page.placement !== 'after_prayer';
  }
  return page.placement === 'after_prayer' && page.prayerTriggers.includes(group);
};

const assignPageGroup = (page: RemoteManagedPage, group: PageGroup, groupOrder: number): RemoteManagedPage => ({
  ...page,
  placement: group === 'general' ? 'general' : 'after_prayer',
  prayerTriggers: group === 'general' ? [] : [group],
  groupOrder
});

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, className = '', children }) => (
  <section className={`admin-card ${className}`}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="admin-gold-line" />
          <h2 className="admin-section-title text-xl">{title}</h2>
        </div>
        {subtitle && <p className="admin-section-subtitle text-sm">{subtitle}</p>}
      </div>
      {actions}
    </div>
    <div>{children}</div>
  </section>
);

const AdminLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img src={ADMIN_LOGO_SRC} alt="شعار نظام المساجد" className={`admin-logo ${className}`} />
);

const AdminMosqueDome: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 200 200" className={`admin-dome ${className}`} aria-hidden="true">
    <defs>
      <radialGradient id="adminDomeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#f2c66d" stopOpacity="0.38" />
        <stop offset="100%" stopColor="#f2c66d" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="adminDomeGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f7d889" />
        <stop offset="100%" stopColor="#b8791f" />
      </linearGradient>
      <linearGradient id="adminDomeEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="92" fill="url(#adminDomeGlow)" />
    <path d="M39 140 Q42 82 100 59 Q158 82 161 140 L161 147 L39 147 Z" fill="url(#adminDomeGold)" />
    <rect x="35" y="145" width="130" height="16" rx="4" fill="#a86818" opacity="0.95" />
    <rect x="24" y="101" width="16" height="60" rx="3" fill="#b8791f" />
    <path d="M24 101 L32 74 L40 101 Z" fill="#d99b32" />
    <rect x="160" y="101" width="16" height="60" rx="3" fill="#b8791f" />
    <path d="M160 101 L168 74 L176 101 Z" fill="#d99b32" />
    <ellipse cx="80" cy="121" rx="8" ry="13" fill="url(#adminDomeEmerald)" opacity="0.62" />
    <ellipse cx="100" cy="117" rx="10" ry="16" fill="url(#adminDomeEmerald)" opacity="0.68" />
    <ellipse cx="120" cy="121" rx="8" ry="13" fill="url(#adminDomeEmerald)" opacity="0.62" />
    <path d="M94 51 A9 9 0 1 1 107 51 A11 11 0 1 0 94 51" fill="#f8e7b1" />
    <polygon points="100,34 102,39 107,39 103,42 105,47 100,44 95,47 97,42 93,39 98,39" fill="#f8e7b1" />
  </svg>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string;
  helper: string;
}> = ({ icon, title, value, helper }) => (
  <div className="admin-stat-card">
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-bold text-slate-300">{title}</div>
      <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5 text-[#f4d58d]">{icon}</div>
    </div>
    <div className="mt-4 text-3xl font-black text-white">{value}</div>
    <div className="mt-2 text-xs leading-6 text-slate-400">{helper}</div>
  </div>
);

const EmptyState: React.FC<{
  title: string;
  subtitle: string;
}> = ({ title, subtitle }) => (
  <div className="admin-empty-card border-dashed px-5 py-14 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-gold-200">
      <Sparkles className="h-7 w-7" />
    </div>
    <div className="mt-5 text-lg font-black text-white">{title}</div>
    <div className="mt-2 text-sm leading-7 text-slate-400">{subtitle}</div>
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <label className="block space-y-2.5">
    <span className="text-sm font-bold text-slate-200">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="admin-input w-full rounded-[1.1rem] px-4 py-3.5 outline-none transition"
    />
  </label>
);

const TextAreaField: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}> = ({ label, value, onChange, rows = 5, placeholder }) => (
  <label className="block space-y-2.5">
    <span className="text-sm font-bold text-slate-200">{label}</span>
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="admin-input w-full rounded-[1.2rem] px-4 py-3.5 outline-none transition"
    />
  </label>
);

const SegmentedButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-4 py-2.5 text-sm font-black transition ${
      active ? 'admin-action-gold shadow-[0_10px_25px_rgba(199,161,91,0.18)]' : 'text-slate-300 hover:bg-white/8'
    }`}
  >
    {label}
  </button>
);

const MosqueCard: React.FC<{
  mosque: RemoteMosqueDocument;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}> = ({ mosque, selected, onSelect, onDelete }) => (
  <div
    data-selected={selected ? 'true' : 'false'}
    className={`admin-mosque-card admin-mosque-square group w-full text-right transition ${
      selected
        ? 'translate-y-[-2px]'
        : 'hover:-translate-y-1'
    }`}
  >
    <button type="button" onClick={onSelect} className="flex min-h-[244px] w-full flex-col text-right">
      <div className="admin-row-icon shrink-0">
        <Building2 className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-black text-slate-950 transition-colors group-hover:text-[#b8791f]">{mosque.name}</div>
        <div className="admin-square-meta mt-4 grid grid-cols-2 gap-3">
          <div className="admin-square-metric">
            <span>الصفحات</span>
            <strong>{countEnabledPages(mosque.pages)} / {mosque.pages.length}</strong>
          </div>
          <div className="admin-square-metric">
            <span>الجدول</span>
            <strong>{mosque.displayConfig.monthlySchedule?.days?.length ? 'مضاف' : 'غير مضاف'}</strong>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#b8791f]" />
            {mosque.city}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            {countEnabledPages(mosque.pages)} / {mosque.pages.length} صفحة
          </span>
          <span>{mosque.displayConfig.monthlySchedule?.days?.length ? 'جدول شهري مضاف' : 'بدون جدول شهري'}</span>
        </div>
      </div>

      <div className="hidden text-left md:block">
        <div className="admin-code-badge mb-1 font-mono text-sm font-black">{mosque.code}</div>
        <div className="text-xs font-bold text-slate-500">{formatLastUpdated(mosque.lastUpdated)}</div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`hidden rounded-full px-3 py-1 text-[11px] font-black md:block ${selected ? 'bg-amber-100 text-[#8a5a13]' : 'bg-slate-100 text-slate-600'}`}>
          {MODE_LABELS[mosque.mode]}
        </div>
        <div className="admin-row-arrow">
          <ChevronLeft className="h-5 w-5" />
        </div>
      </div>
    </button>

    {onDelete && (
      <div className="mt-3 flex justify-end md:mt-0">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100"
        >
          <Trash2 className="ml-1 inline h-3.5 w-3.5" />
          حذف
        </button>
      </div>
    )}
  </div>
);

const PageEditor: React.FC<{
  title: string;
  pages: RemoteManagedPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string | null) => void;
  onChangePages: (pages: RemoteManagedPage[]) => void;
}> = ({ title, pages, selectedPageId, onSelectPage, onChangePages }) => {
  const orderedPages = useMemo(() => renumberRemotePages(pages), [pages]);
  const [activeGroup, setActiveGroup] = useState<PageGroup>('general');
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const groupPages = useMemo(
    () => orderedPages.filter((page) => matchesPageGroup(page, activeGroup)).sort((left, right) => left.groupOrder - right.groupOrder),
    [activeGroup, orderedPages]
  );
  const selectedPage =
    groupPages.find((page) => page.id === selectedPageId) ||
    groupPages[0] ||
    null;

  useEffect(() => {
    if (!selectedPage && groupPages.length === 0) {
      onSelectPage(null);
      return;
    }
    if (!selectedPage && groupPages[0]) {
      onSelectPage(groupPages[0].id);
    }
  }, [groupPages, onSelectPage, selectedPage]);

  const updatePagesForGroup = (nextGroupPages: RemoteManagedPage[]) => {
    const otherPages = orderedPages.filter((page) => !matchesPageGroup(page, activeGroup));
    const normalizedGroupPages = nextGroupPages.map((page, index) => assignPageGroup(page, activeGroup, index + 1));
    onChangePages(renumberRemotePages([...otherPages, ...normalizedGroupPages]));
  };

  const updateSelectedPage = (partial: Partial<RemoteManagedPage>) => {
    if (!selectedPage) return;
    onChangePages(renumberRemotePages(
      orderedPages.map((page) => (page.id === selectedPage.id ? { ...page, ...partial } : page))
    ));
  };

  const appendPage = (type: RemoteManagedPage['type']) => {
    const nextPage = assignPageGroup(createRemotePageDraft(groupPages.length, type), activeGroup, groupPages.length + 1);
    updatePagesForGroup([...groupPages, nextPage]);
    onSelectPage(nextPage.id);
  };

  const removeSelectedPage = () => {
    if (!selectedPage) return;
    const nextPages = groupPages.filter((page) => page.id !== selectedPage.id);
    updatePagesForGroup(nextPages);
    onSelectPage(nextPages[0]?.id || null);
  };

  const handleAssetUpload = async (file: File, field: 'imageUrl' | 'backgroundImage') => {
    if (!selectedPage) return;
    const url = await uploadRemoteAsset(file, `remote-pages/${selectedPage.id}`);
    updateSelectedPage({ [field]: url } as Partial<RemoteManagedPage>);
  };

  const moveSelectedPageToGroup = (group: PageGroup) => {
    if (!selectedPage) return;
    const nextPages = orderedPages.map((page) =>
      page.id === selectedPage.id ? assignPageGroup(page, group, 1) : page
    );
    onChangePages(renumberRemotePages(nextPages));
    setActiveGroup(group);
    onSelectPage(selectedPage.id);
  };

  return (
    <SectionCard
      title={title}
      actions={
        <div className="flex flex-wrap gap-2">
          {PAGE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => appendPage(option.id)}
              className="rounded-xl border border-gold-400/20 bg-gold-500/10 px-3 py-2 text-xs font-bold text-gold-100 transition hover:bg-gold-500/20"
            >
              <Plus className="ml-1 inline h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-5 grid gap-3 lg:grid-cols-6">
        {PAGE_GROUP_OPTIONS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => {
              setActiveGroup(group.id);
              onSelectPage(null);
            }}
            className={`rounded-[1.3rem] border px-4 py-4 text-right transition ${
              activeGroup === group.id
                ? 'border-gold-400/45 bg-gold-500/12'
                : 'border-white/10 bg-white/5 hover:bg-white/8'
            }`}
          >
            <div className="text-sm font-black text-white">{group.label}</div>
            <div className="mt-1 text-xs leading-6 text-slate-400">{group.helper}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
        <div className="space-y-3">
          {groupPages.length === 0 && (
            <EmptyState title="لا توجد صفحات بعد" subtitle="أضف أول دعاء أو إعلان أو صورة، ثم ستظهر هنا في القائمة." />
          )}

          {groupPages.map((page) => (
            <button
              key={page.id}
              type="button"
              draggable
              onDragStart={() => setDragPageId(page.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!dragPageId || dragPageId === page.id) return;
                const currentIndex = groupPages.findIndex((item) => item.id === dragPageId);
                const targetIndex = groupPages.findIndex((item) => item.id === page.id);
                if (currentIndex < 0 || targetIndex < 0) return;
                const next = [...groupPages];
                const [moved] = next.splice(currentIndex, 1);
                next.splice(targetIndex, 0, moved);
                updatePagesForGroup(next.map((item, index) => ({ ...item, groupOrder: index + 1 })));
                setDragPageId(null);
              }}
              onClick={() => onSelectPage(page.id)}
              className={`w-full rounded-[1.5rem] border px-4 py-4 text-right transition ${
                selectedPage?.id === page.id
                  ? 'border-gold-400/50 bg-gold-500/12 text-white'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/8'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Move className="h-3.5 w-3.5" />
                    <span>#{page.groupOrder}</span>
                    <span>•</span>
                    <span>{PAGE_TYPE_OPTIONS.find((item) => item.id === page.type)?.label || page.type}</span>
                  </div>
                  <div className="mt-2 truncate text-base font-bold">{page.title || 'بدون عنوان'}</div>
                  <div className="mt-2 line-clamp-2 text-xs text-slate-400">
                    {page.type === 'image' ? 'شريحة صورة كاملة' : page.content || 'لا يوجد محتوى بعد'}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${page.enabled ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-400'}`}>
                  {page.enabled ? 'مفعلة' : 'متوقفة'}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5">
          {selectedPage ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">تحرير الصفحة الحالية</div>
                  <div className="text-lg font-black text-white">{selectedPage.title || 'صفحة جديدة'}</div>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedPage}
                  className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20"
                >
                  <Trash2 className="ml-1 inline h-4 w-4" />
                  حذف الصفحة
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="عنوان الصفحة" value={selectedPage.title} onChange={(value) => updateSelectedPage({ title: value })} />
                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">نوع الصفحة</span>
                  <select
                    value={selectedPage.type}
                    onChange={(event) => updateSelectedPage({ type: event.target.value as RemoteManagedPage['type'] })}
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3.5 text-white outline-none"
                  >
                    {PAGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">موضع الصفحة في النظام</span>
                  <select
                    value={getPageGroup(selectedPage)}
                    onChange={(event) => moveSelectedPageToGroup(event.target.value as PageGroup)}
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3.5 text-white outline-none"
                  >
                    {PAGE_GROUP_OPTIONS.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="text-sm font-bold text-slate-200">ترتيبها داخل المجموعة</div>
                  <div className="mt-2 text-xs leading-6 text-slate-400">
                    هذه الصفحة ستظهر في الترتيب رقم {selectedPage.groupOrder} ضمن مجموعة {PAGE_GROUP_OPTIONS.find((group) => group.id === getPageGroup(selectedPage))?.label}.
                  </div>
                </div>
              </div>

              {selectedPage.type !== 'image' && (
                <TextAreaField
                  label="المحتوى"
                  rows={selectedPage.type === 'announcement' ? 5 : 12}
                  value={selectedPage.content}
                  onChange={(value) => updateSelectedPage({ content: value })}
                  placeholder="اكتب النص الذي تريد عرضه هنا"
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="لون الإبراز"
                  value={selectedPage.accentColor || ''}
                  onChange={(value) => updateSelectedPage({ accentColor: value })}
                  placeholder="#D4AF37"
                />
                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">محاذاة النص</span>
                  <select
                    value={selectedPage.textAlign || 'center'}
                    onChange={(event) => updateSelectedPage({ textAlign: event.target.value as RemoteManagedPage['textAlign'] })}
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3.5 text-white outline-none"
                  >
                    <option value="center">وسط</option>
                    <option value="right">يمين</option>
                  </select>
                </label>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-3 text-sm font-bold text-slate-200">أيام الظهور</div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((weekday) => {
                    const active = selectedPage.weekdays.includes(weekday.id);
                    const nextWeekdays = active
                      ? selectedPage.weekdays.filter((item) => item !== weekday.id)
                      : [...selectedPage.weekdays, weekday.id];
                    return (
                      <button
                        key={weekday.id}
                        type="button"
                        onClick={() =>
                          updateSelectedPage({
                            weekdays: nextWeekdays.length > 0 ? nextWeekdays : [...ALL_REMOTE_PAGE_WEEKDAYS]
                          })
                        }
                        className={`rounded-full px-4 py-2 text-xs font-black transition ${
                          active ? 'bg-gold-500 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        {weekday.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateSelectedPage({ enabled: !selectedPage.enabled })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    selectedPage.enabled
                      ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {selectedPage.enabled ? 'الصفحة مفعلة' : 'تفعيل الصفحة'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedPage({ autoSplit: !selectedPage.autoSplit })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    selectedPage.autoSplit
                      ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {selectedPage.autoSplit ? 'التقسيم التلقائي مفعّل' : 'تفعيل التقسيم التلقائي'}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">صورة الخلفية</span>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                      <ImagePlus className="ml-1 inline h-4 w-4" />
                      رفع خلفية
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (file) await handleAssetUpload(file, 'backgroundImage');
                          event.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => updateSelectedPage({ backgroundImage: null })}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                    >
                      إزالة
                    </button>
                  </div>
                  {selectedPage.backgroundImage && <div className="truncate text-xs text-slate-500">{selectedPage.backgroundImage}</div>}
                </label>

                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">الصورة الرئيسية</span>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                      <ImagePlus className="ml-1 inline h-4 w-4" />
                      رفع صورة
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (file) await handleAssetUpload(file, 'imageUrl');
                          event.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => updateSelectedPage({ imageUrl: null })}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                    >
                      إزالة
                    </button>
                  </div>
                  {selectedPage.imageUrl && <div className="truncate text-xs text-slate-500">{selectedPage.imageUrl}</div>}
                </label>
              </div>
            </div>
          ) : (
            <EmptyState title="اختر صفحة من القائمة" subtitle="أو أضف صفحة جديدة لتبدأ في بناء العرض الخاص بالمسجد." />
          )}
        </div>
      </div>
    </SectionCard>
  );
};

const PrayerFlowPreviewPane: React.FC<{
  mosqueName: string;
  prayerId: AnnouncementPrayerTrigger;
  flowItems: RemotePrayerFlowItem[];
  pages: RemoteManagedPage[];
  selectedFlowItemId: string | null;
}> = ({ mosqueName, prayerId, flowItems, pages, selectedFlowItemId }) => {
  const selectedItem =
    flowItems.find((item) => item.id === selectedFlowItemId) ||
    flowItems[0] ||
    null;
  const selectedPage = selectedItem?.type === 'page'
    ? pages.find((page) => page.id === selectedItem.pageId)
    : null;
  const selectedPageSlides = useMemo(
    () => (selectedPage ? buildRemoteDisplaySlides([selectedPage]) : []),
    [selectedPage]
  );
  const selectedSlide = selectedPageSlides[0] || null;
  const prayerLabel = PRAYER_FLOW_OPTIONS.find((option) => option.id === prayerId)?.label || prayerId;
  const selectedSystemStep = selectedItem?.type === 'system' ? selectedItem.systemStep : undefined;
  const systemAccent = selectedSystemStep ? SYSTEM_STEP_ACCENTS[selectedSystemStep] : '#d4af37';

  return (
    <SectionCard
      title="معاينة شاشة الصلاة"
      subtitle="هنا ترى شكل التسلسل بعد التعديل: العناصر في الأعلى، والشاشة الفعلية في الأسفل كما ستظهر في النظام."
    >
      <div className="admin-tv-preview rounded-[2rem] border border-white/10 bg-slate-950/85 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
        <div className="mb-4 flex flex-wrap gap-2">
          {flowItems.map((item, index) => {
            const isSystem = item.type === 'system';
            const linkedPage = item.type === 'page' ? pages.find((page) => page.id === item.pageId) : null;
            const label = isSystem
              ? PRAYER_FLOW_SYSTEM_LABELS[item.systemStep as RemotePrayerFlowSystemStep]
              : linkedPage?.title || 'صفحة مخصصة';
            const accent = isSystem
              ? SYSTEM_STEP_ACCENTS[item.systemStep as RemotePrayerFlowSystemStep]
              : linkedPage?.accentColor || '#d4af37';

            return (
              <div
                key={item.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
                  item.enabled ? 'text-white' : 'text-slate-500'
                }`}
                style={{
                  borderColor: `${accent}55`,
                  background: `${accent}18`
                }}
              >
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-white/70">#{index + 1}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_top,#132238_0%,#040b16_74%)] p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_42%)]" />
          <div className="relative z-10 rounded-[2rem] border border-white/8 bg-slate-950/60 p-4">
            <div className="mb-4 flex items-center justify-between text-[11px] font-black tracking-[0.22em] text-slate-400">
              <span>LIVE MOSQUE SCREEN</span>
              <span>{prayerLabel}</span>
            </div>

            <div
              className="relative aspect-video overflow-hidden rounded-[1.8rem] border border-white/10"
              style={{
                backgroundImage: selectedSlide?.backgroundImage
                  ? `linear-gradient(rgba(4,12,24,0.76), rgba(2,8,18,0.92)), url(${selectedSlide.backgroundImage})`
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,24,39,0.28),rgba(2,6,23,0.94))]" />
              <div className="relative z-10 flex h-full flex-col justify-between p-7 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-black">{mosqueName}</div>
                    <div className="mt-2 text-sm text-slate-300">معاينة {prayerLabel}</div>
                  </div>
                  <div
                    className="rounded-full border px-4 py-2 text-[11px] font-black tracking-[0.24em]"
                    style={{ borderColor: systemAccent, color: systemAccent }}
                  >
                    {selectedItem?.type === 'system'
                      ? SYSTEM_STEP_BADGES[selectedSystemStep as RemotePrayerFlowSystemStep]
                      : selectedPage?.type || 'PAGE'}
                  </div>
                </div>

                <div className={`flex flex-1 items-center justify-center ${selectedSlide?.textAlign === 'right' ? 'text-right' : 'text-center'}`}>
                  {selectedItem?.type === 'system' ? (
                    <div className="mx-auto max-w-5xl space-y-6 text-center">
                      <div
                        className="text-[clamp(2rem,3.1vw,4.6rem)] font-black leading-[1.25]"
                        style={{ color: systemAccent }}
                      >
                        {PRAYER_FLOW_SYSTEM_LABELS[selectedSystemStep as RemotePrayerFlowSystemStep]}
                      </div>
                      <div className="mx-auto max-w-3xl text-lg leading-8 text-slate-300">
                        {selectedSystemStep === 'pre_adhan' && 'مشهد تنبيه واضح قبل بدء الأذان مع تركيز عالٍ على اسم الصلاة والانتقال الهادئ.'}
                        {selectedSystemStep === 'adhan' && 'شاشة الأذان الرسمية بخلفية الأذان وإظهار اسم الإمام واسم الصلاة.'}
                        {selectedSystemStep === 'iqama' && 'صفحة إقامة الصلاة مع النص الكبير والواضح التي يراها المصلون قبل الاصطفاف.'}
                        {selectedSystemStep === 'tasbeeh' && 'صفحة تسبيحة الزهراء بالشكل المعتمد في النظام بعد الصلاة.'}
                        {selectedSystemStep === 'quran_verse' && 'صفحة الآية الشريفة كما ستظهر على الشاشة مع نفس هوية المسجد.'}
                        {selectedSystemStep === 'ghufaylah' && 'صفحة صلاة الغفيلة بعد المغرب في حال كانت ضمن التسلسل.'}
                        {selectedSystemStep === 'dua_ahd' && 'دعاء العهد ضمن بداية تسلسل الفجر قبل شاشات الصلاة.'}
                        {selectedSystemStep === 'dua_sabah' && 'دعاء الصباح ضمن التسلسل قبل بدء صلاة الفجر.'}
                        {selectedSystemStep === 'announcement_builtin' && 'صفحة الإعلان المدمجة في النظام باستخدام إعدادات الإعلان الحالية للمسجد.'}
                      </div>
                    </div>
                  ) : selectedSlide?.imageUrl ? (
                    <img src={selectedSlide.imageUrl} alt={selectedSlide.title} className="max-h-[60vh] rounded-[1.8rem] border border-white/10 object-contain shadow-2xl" />
                  ) : (
                    <div className="mx-auto max-w-5xl space-y-6">
                      <div
                        className="text-[clamp(1.8rem,2.8vw,4.2rem)] font-black leading-[1.65]"
                        style={{ color: selectedSlide?.accentColor || '#ffffff' }}
                      >
                        {selectedSlide?.content || selectedPage?.content || 'أضف محتوى لهذه الصفحة ليظهر في المعاينة.'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>
                    {selectedItem?.type === 'page'
                      ? `صفحة مخصصة: ${selectedPage?.title || 'بدون عنوان'}`
                      : `عنصر نظام: ${PRAYER_FLOW_SYSTEM_LABELS[selectedSystemStep as RemotePrayerFlowSystemStep]}`}
                  </span>
                  <span>سيصل هذا الترتيب إلى شاشة المسجد فور الحفظ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

const PrayerFlowBuilder: React.FC<{
  mosqueName: string;
  prayerId: AnnouncementPrayerTrigger;
  onPrayerChange: (prayerId: AnnouncementPrayerTrigger) => void;
  flowItems: RemotePrayerFlowItem[];
  pages: RemoteManagedPage[];
  prayerSettings: RemoteMosqueDocument['displayConfig']['prayerSettings'];
  adhanSettings: RemoteMosqueDocument['displayConfig']['adhanSettings'];
  selectedFlowItemId: string | null;
  onSelectFlowItem: (flowItemId: string | null) => void;
  onChangeFlowItems: (items: RemotePrayerFlowItem[]) => void;
  onChangePages: (pages: RemoteManagedPage[]) => void;
  onChangePrayerSettings: (settings: RemoteMosqueDocument['displayConfig']['prayerSettings']) => void;
  onChangeAdhanSettings: (settings: RemoteMosqueDocument['displayConfig']['adhanSettings']) => void;
  onUploadSystemBackground: (step: RemotePrayerFlowSystemStep, file: File) => Promise<void>;
}> = ({
  mosqueName,
  prayerId,
  onPrayerChange,
  flowItems,
  pages,
  prayerSettings,
  adhanSettings,
  selectedFlowItemId,
  onSelectFlowItem,
  onChangeFlowItems,
  onChangePages,
  onChangePrayerSettings,
  onChangeAdhanSettings,
  onUploadSystemBackground
}) => {
  const selectedItem = flowItems.find((item) => item.id === selectedFlowItemId) || flowItems[0] || null;
  const selectedPage = selectedItem?.type === 'page'
    ? pages.find((page) => page.id === selectedItem.pageId) || null
    : null;
  const [dragFlowItemId, setDragFlowItemId] = useState<string | null>(null);
  const [pendingImagePageId, setPendingImagePageId] = useState<string | null>(null);
  const flowImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedItem && flowItems[0]) {
      onSelectFlowItem(flowItems[0].id);
    }
  }, [flowItems, onSelectFlowItem, selectedItem]);

  const updatePageById = (pageId: string, partial: Partial<RemoteManagedPage>) => {
    onChangePages(renumberRemotePages(pages.map((page) => (page.id === pageId ? { ...page, ...partial } : page))));
  };

  const uploadPageImage = async (pageId: string, file: File) => {
    const url = await uploadRemoteAsset(file, `remote-pages/${pageId}`);
    updatePageById(pageId, { imageUrl: url, type: 'image', autoSplit: false });
  };

  const updateItem = (itemId: string, partial: Partial<RemotePrayerFlowItem>) => {
    onChangeFlowItems(
      flowItems.map((item) => (item.id === itemId ? { ...item, ...partial } : item))
        .sort((left, right) => left.order - right.order)
        .map((item, index) => ({ ...item, order: index + 1 }))
    );
  };

  const addCustomPageToFlow = (type: RemoteManagedPage['type']) => {
    const prayerPageCount = pages.filter(
      (page) => page.placement === 'after_prayer' && page.prayerTriggers.includes(prayerId)
    ).length;
    const nextPage = {
      ...createRemotePageDraft(pages.length, type),
      placement: 'after_prayer' as const,
      prayerTriggers: [prayerId],
      groupOrder: prayerPageCount + 1,
      title:
        type === 'dua' ? `دعاء ${PRAYER_FLOW_OPTIONS.find((item) => item.id === prayerId)?.label}`
        : type === 'announcement' ? `إعلان ${PRAYER_FLOW_OPTIONS.find((item) => item.id === prayerId)?.label}`
        : type === 'image' ? `شريحة ${PRAYER_FLOW_OPTIONS.find((item) => item.id === prayerId)?.label}`
        : 'صفحة مخصصة'
    };
    const insertIndex = selectedItem ? flowItems.findIndex((item) => item.id === selectedItem.id) + 1 : flowItems.length;
    const nextFlow = [...flowItems];
    nextFlow.splice(insertIndex, 0, createPageFlowItem(prayerId, nextPage.id, insertIndex + 1));
    onChangePages(renumberRemotePages([...pages, nextPage]));
    onChangeFlowItems(nextFlow.map((item, index) => ({ ...item, order: index + 1 })));
    onSelectFlowItem(nextFlow[insertIndex]?.id || null);

    if (type === 'image') {
      setPendingImagePageId(nextPage.id);
      window.setTimeout(() => flowImageInputRef.current?.click(), 0);
    }
  };

  const removeSelectedFlowItem = () => {
    if (!selectedItem) return;

    const nextFlow = flowItems
      .filter((item) => item.id !== selectedItem.id)
      .map((item, index) => ({ ...item, order: index + 1 }));

    onChangeFlowItems(nextFlow);

    if (selectedItem.type === 'page' && selectedItem.pageId) {
      onChangePages(renumberRemotePages(pages.filter((page) => page.id !== selectedItem.pageId)));
    }

    onSelectFlowItem(nextFlow[0]?.id || null);
  };

  const moveFlowItemByDrag = (sourceItemId: string, targetItemId: string) => {
    if (sourceItemId === targetItemId) return;
    const currentIndex = flowItems.findIndex((item) => item.id === sourceItemId);
    const targetIndex = flowItems.findIndex((item) => item.id === targetItemId);
    if (currentIndex < 0 || targetIndex < 0) return;

    const next = [...flowItems];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChangeFlowItems(next.map((item, index) => ({ ...item, order: index + 1 })));
  };

  const selectedSystemStep = selectedItem?.type === 'system'
    ? selectedItem.systemStep as RemotePrayerFlowSystemStep
    : null;
  const selectedSystemBackground = (() => {
    switch (selectedSystemStep) {
      case 'pre_adhan':
      case 'adhan':
        return adhanSettings.backgroundImage;
      case 'iqama':
      case 'ghufaylah':
        return prayerSettings.backgroundImage;
      case 'tasbeeh':
        return prayerSettings.tasbeeh.backgroundImage;
      case 'quran_verse':
        return prayerSettings.quranVerse.backgroundImage;
      case 'dua_ahd':
        return prayerSettings.duaAhd.backgroundImage;
      case 'dua_sabah':
        return prayerSettings.duaSabah.backgroundImage;
      case 'announcement_builtin':
        return prayerSettings.announcement.backgroundImage;
      default:
        return null;
    }
  })();

  const clearSelectedSystemBackground = () => {
    switch (selectedSystemStep) {
      case 'pre_adhan':
      case 'adhan':
        onChangeAdhanSettings({ ...adhanSettings, backgroundImage: null });
        break;
      case 'iqama':
      case 'ghufaylah':
        onChangePrayerSettings({ ...prayerSettings, backgroundImage: null });
        break;
      case 'tasbeeh':
        onChangePrayerSettings({ ...prayerSettings, tasbeeh: { ...prayerSettings.tasbeeh, backgroundImage: null } });
        break;
      case 'quran_verse':
        onChangePrayerSettings({ ...prayerSettings, quranVerse: { ...prayerSettings.quranVerse, backgroundImage: null } });
        break;
      case 'dua_ahd':
        onChangePrayerSettings({ ...prayerSettings, duaAhd: { ...prayerSettings.duaAhd, backgroundImage: null } });
        break;
      case 'dua_sabah':
        onChangePrayerSettings({ ...prayerSettings, duaSabah: { ...prayerSettings.duaSabah, backgroundImage: null } });
        break;
      case 'announcement_builtin':
        onChangePrayerSettings({
          ...prayerSettings,
          announcement: { ...prayerSettings.announcement, backgroundImage: null }
        });
        break;
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="محرر تسلسل الصلاة"
        actions={
          <div className="flex flex-wrap gap-2">
            {(['dua', 'announcement', 'custom_text', 'image'] as RemoteManagedPage['type'][]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addCustomPageToFlow(type)}
                className="rounded-xl border border-gold-400/25 bg-gold-500/10 px-3 py-2 text-xs font-black text-gold-100 transition hover:bg-gold-500/20"
              >
                <Plus className="ml-1 inline h-4 w-4" />
                {type === 'dua' ? 'إضافة دعاء' : type === 'announcement' ? 'إضافة إعلان' : type === 'image' ? 'إضافة صورة' : 'إضافة نص'}
              </button>
            ))}
          </div>
        }
      >
        <input
          ref={flowImageInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file && pendingImagePageId) {
              await uploadPageImage(pendingImagePageId, file);
            }
            setPendingImagePageId(null);
            event.target.value = '';
          }}
        />
        <div className="mb-6 grid gap-3 lg:grid-cols-5">
          {PRAYER_FLOW_OPTIONS.map((option) => {
            const active = option.id === prayerId;
            const enabledCount = flowItems.filter((item) => item.enabled).length;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onPrayerChange(option.id);
                  onSelectFlowItem(null);
                }}
                className={`rounded-[1.5rem] border px-4 py-4 text-right transition ${
                  active
                    ? 'border-gold-400/45 bg-gradient-to-br from-gold-500/18 via-white/[0.08] to-white/[0.04]'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-white">{option.label}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-400">{option.helper}</div>
                  </div>
                  {active && (
                    <div className="rounded-2xl border border-gold-400/30 bg-gold-500/10 px-3 py-2 text-[11px] font-black text-gold-100">
                      {enabledCount} عنصر
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[390px,1fr]">
          <div className="space-y-3">
            {flowItems.map((item, index) => {
              const linkedPage = item.type === 'page' ? pages.find((page) => page.id === item.pageId) : null;
              const isSelected = selectedItem?.id === item.id;
              const label = item.type === 'system'
                ? PRAYER_FLOW_SYSTEM_LABELS[item.systemStep as RemotePrayerFlowSystemStep]
                : linkedPage?.title || 'صفحة مخصصة';
              const badge = item.type === 'system'
                ? SYSTEM_STEP_BADGES[item.systemStep as RemotePrayerFlowSystemStep]
                : linkedPage?.type || 'page';
              const accent = item.type === 'system'
                ? SYSTEM_STEP_ACCENTS[item.systemStep as RemotePrayerFlowSystemStep]
                : linkedPage?.accentColor || '#d4af37';

              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={() => setDragFlowItemId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!dragFlowItemId) return;
                    moveFlowItemByDrag(dragFlowItemId, item.id);
                    setDragFlowItemId(null);
                  }}
                  onDragEnd={() => setDragFlowItemId(null)}
                  onClick={() => onSelectFlowItem(item.id)}
                  className={`w-full cursor-grab rounded-[1.6rem] border px-4 py-4 text-right transition active:cursor-grabbing ${
                    isSelected
                      ? 'border-gold-400/50 bg-gold-500/10'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-black text-slate-400">
                        <Move className="h-3.5 w-3.5" />
                        <span>#{index + 1}</span>
                        <span>•</span>
                        <span>{badge}</span>
                      </div>
                      <div className="mt-2 truncate text-base font-black text-white">{label}</div>
                      <div className="mt-2 line-clamp-2 text-xs leading-6 text-slate-400">
                        {item.type === 'system'
                          ? 'عنصر نظام'
                          : linkedPage?.content || (linkedPage?.type === 'image' ? 'شريحة صورة كاملة' : 'عدّل محتوى هذه الصفحة من اللوحة الجانبية.')}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div
                        className="rounded-full border px-2.5 py-1 text-[11px] font-black"
                        style={{ borderColor: `${accent}66`, color: accent }}
                      >
                        {badge}
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.enabled ? 'bg-emerald-500/18 text-emerald-100' : 'bg-white/10 text-slate-400'}`}>
                        {item.enabled ? 'مفعّل' : 'متوقف'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-black/20 p-5">
            {selectedItem ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-white">
                      {selectedItem.type === 'system'
                        ? PRAYER_FLOW_SYSTEM_LABELS[selectedItem.systemStep as RemotePrayerFlowSystemStep]
                        : selectedPage?.title || 'صفحة مخصصة'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => undefined}
                      className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white"
                    >
                      <Move className="ml-1 inline h-4 w-4" />
                      رفع
                    </button>
                    <button
                      type="button"
                      onClick={() => undefined}
                      className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white"
                    >
                      <Move className="ml-1 inline h-4 w-4" />
                      خفض
                    </button>
                    {(
                      <button
                        type="button"
                        onClick={removeSelectedFlowItem}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100"
                      >
                        <Trash2 className="ml-1 inline h-4 w-4" />
                        إزالة العنصر
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-200">حالة العنصر</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateItem(selectedItem.id, { enabled: !selectedItem.enabled })}
                      className={`rounded-full px-4 py-2 text-xs font-black ${
                        selectedItem.enabled ? 'bg-emerald-500 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      {selectedItem.enabled ? 'مفعّل' : 'إعادة التفعيل'}
                    </button>
                  </div>
                </div>

                {selectedItem.type === 'system' ? (
                  <div className="space-y-4">
                    {selectedSystemStep === 'tasbeeh' && (
                      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-4 text-sm font-black text-white">ألوان تسبيحة الزهراء</div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <TextField
                            label="لون الله أكبر"
                            value={prayerSettings.tasbeeh.akbarColor}
                            onChange={(value) =>
                              onChangePrayerSettings({
                                ...prayerSettings,
                                tasbeeh: { ...prayerSettings.tasbeeh, akbarColor: value }
                              })
                            }
                            placeholder="#f8dca0"
                          />
                          <TextField
                            label="لون الحمد لله"
                            value={prayerSettings.tasbeeh.hamdColor}
                            onChange={(value) =>
                              onChangePrayerSettings({
                                ...prayerSettings,
                                tasbeeh: { ...prayerSettings.tasbeeh, hamdColor: value }
                              })
                            }
                            placeholder="#d8e8ff"
                          />
                          <TextField
                            label="لون سبحان الله"
                            value={prayerSettings.tasbeeh.subhanColor}
                            onChange={(value) =>
                              onChangePrayerSettings({
                                ...prayerSettings,
                                tasbeeh: { ...prayerSettings.tasbeeh, subhanColor: value }
                              })
                            }
                            placeholder="#f4c7bd"
                          />
                        </div>
                      </div>
                    )}

                    {selectedSystemStep && (
                      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                        <div className="mb-3 text-sm font-black text-white">
                          خلفية {PRAYER_FLOW_SYSTEM_LABELS[selectedSystemStep]}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                            <ImagePlus className="ml-1 inline h-4 w-4" />
                            رفع خلفية
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (file && selectedSystemStep) await onUploadSystemBackground(selectedSystemStep, file);
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={clearSelectedSystemBackground}
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                          >
                            إزالة الخلفية
                          </button>
                        </div>
                        {selectedSystemBackground && (
                          <div className="mt-3 truncate text-xs text-slate-500">{selectedSystemBackground}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : selectedPage ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField
                        label="عنوان الصفحة"
                        value={selectedPage.title}
                        onChange={(value) => updatePageById(selectedPage.id, { title: value })}
                      />
                      <TextField
                        label="لون الإبراز"
                        value={selectedPage.accentColor || ''}
                        onChange={(value) => updatePageById(selectedPage.id, { accentColor: value })}
                        placeholder="#D4AF37"
                      />
                    </div>

                    {selectedPage.type !== 'image' && (
                      <TextAreaField
                        label="المحتوى"
                        rows={8}
                        value={selectedPage.content}
                        onChange={(value) => updatePageById(selectedPage.id, { content: value })}
                      />
                    )}

                    {selectedPage.type === 'image' && (
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                        <div className="mb-3 text-sm font-bold text-slate-200">الصورة الرئيسية</div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                            <ImagePlus className="ml-1 inline h-4 w-4" />
                            رفع صورة
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (file) await uploadPageImage(selectedPage.id, file);
                                event.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => updatePageById(selectedPage.id, { imageUrl: null })}
                            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                          >
                            إزالة
                          </button>
                        </div>
                        {selectedPage.imageUrl && (
                          <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/25">
                            <img src={selectedPage.imageUrl} alt={selectedPage.title} className="max-h-72 w-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-slate-200">أيام الظهور لهذه الصفحة</div>
                        <div className="text-xs text-slate-400">ستظهر فقط في {PRAYER_FLOW_OPTIONS.find((item) => item.id === prayerId)?.label}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((weekday) => {
                          const active = selectedPage.weekdays.includes(weekday.id);
                          const nextWeekdays = active
                            ? selectedPage.weekdays.filter((item) => item !== weekday.id)
                            : [...selectedPage.weekdays, weekday.id];
                          return (
                            <button
                              key={weekday.id}
                              type="button"
                              onClick={() =>
                                updatePageById(selectedPage.id, {
                                  weekdays: nextWeekdays.length > 0 ? nextWeekdays : [...ALL_REMOTE_PAGE_WEEKDAYS]
                                })
                              }
                              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                                active ? 'bg-gold-500 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'
                              }`}
                            >
                              {weekday.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ) : (
                  <EmptyState title="الصفحة غير موجودة" subtitle="هذا العنصر يشير إلى صفحة غير متاحة حاليًا. يمكنك حذف العنصر أو إضافة صفحة جديدة بدلًا منه." />
                )}
              </div>
            ) : (
              <EmptyState title="اختر عنصرًا من التسلسل" subtitle="عند اختيار أي عنصر من اليمين ستظهر أدوات التعديل المباشر هنا." />
            )}
          </div>
        </div>
      </SectionCard>

      <PrayerFlowPreviewPane
        mosqueName={mosqueName}
        prayerId={prayerId}
        flowItems={flowItems}
        pages={pages}
        selectedFlowItemId={selectedFlowItemId}
      />
    </div>
  );
};

const PreviewPane: React.FC<{
  title: string;
  pages: RemoteManagedPage[];
  mosqueName?: string;
  modeLabel?: string;
}> = ({ title, pages, mosqueName = 'معاينة المسجد', modeLabel = 'معاينة مباشرة' }) => {
  const [previewGroup, setPreviewGroup] = useState<PageGroup>('general');
  const [previewWeekday, setPreviewWeekday] = useState<DuaWeekday>(() => getRemotePageWeekdayKey(new Date()));
  const filteredPages = useMemo(() => {
    if (previewGroup === 'general') {
      return filterRemotePagesForContext(pages, { weekday: previewWeekday });
    }
    return filterRemotePagesForContext(pages, {
      weekday: previewWeekday,
      prayerId: previewGroup,
      includeGeneral: false
    });
  }, [pages, previewGroup, previewWeekday]);
  const slides = useMemo(() => buildRemoteDisplaySlides(filteredPages), [filteredPages]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(slides.length - 1, 0)));
  const activeSlide = slides[safeIndex] || null;

  return (
    <SectionCard
      title={title}
      subtitle="هذه معاينة تلفزيونية للشاشة الفعلية قبل الحفظ."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={previewGroup}
            onChange={(event) => setPreviewGroup(event.target.value as PageGroup)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none"
          >
            {PAGE_GROUP_OPTIONS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
          <select
            value={previewWeekday}
            onChange={(event) => setPreviewWeekday(event.target.value as DuaWeekday)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none"
          >
            {WEEKDAY_OPTIONS.map((weekday) => (
              <option key={weekday.id} value={weekday.id}>
                {weekday.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setActiveIndex((previous) => Math.max(0, previous - 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white"
          >
            السابق
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((previous) => Math.min(Math.max(slides.length - 1, 0), previous + 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white"
          >
            التالي
          </button>
        </div>
      }
    >
      <div className="admin-tv-preview rounded-[2.2rem] border border-white/10 bg-slate-950/80 p-5 shadow-[0_30px_90px_rgba(2,6,23,0.5)]">
        <div className="mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
          <span>{modeLabel}</span>
          <span>{slides.length > 0 ? `${safeIndex + 1} / ${slides.length}` : '0 / 0'}</span>
        </div>

        <div
          className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/8 bg-slate-900"
          style={{
            backgroundImage: activeSlide?.backgroundImage
              ? `linear-gradient(rgba(2,6,23,0.72), rgba(2,6,23,0.9)), url(${activeSlide.backgroundImage})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_72%)] opacity-80" />
          <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black">{mosqueName}</div>
                <div className="mt-2 text-sm text-slate-300">
                  {PAGE_GROUP_OPTIONS.find((group) => group.id === previewGroup)?.label} • {WEEKDAY_OPTIONS.find((weekday) => weekday.id === previewWeekday)?.label}
                </div>
              </div>
              <div
                className="rounded-full border px-4 py-2 text-[11px] font-black tracking-[0.28em]"
                style={{
                  borderColor: activeSlide?.accentColor || '#f1bd36',
                  color: activeSlide?.accentColor || '#f1bd36'
                }}
              >
                {activeSlide?.type || 'EMPTY'}
              </div>
            </div>

            <div className={`mx-auto flex w-full max-w-5xl flex-1 items-center justify-center ${activeSlide?.textAlign === 'right' ? 'text-right' : 'text-center'}`}>
              {activeSlide?.imageUrl ? (
                <img src={activeSlide.imageUrl} alt={activeSlide.title} className="max-h-[60vh] rounded-[2rem] border border-white/10 object-contain shadow-2xl" />
              ) : (
                <div className="space-y-6">
                  <div
                    className="text-[clamp(1.8rem,2.9vw,4.2rem)] font-black leading-[1.65]"
                    style={{ color: activeSlide?.accentColor || '#ffffff' }}
                  >
                    {activeSlide?.content || 'أضف صفحات لعرض المعاينة هنا'}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{activeSlide ? `الشريحة ${activeSlide.chunkIndex + 1} من ${activeSlide.chunkCount}` : 'لا توجد شرائح بعد'}</span>
              <span>ستتحدث شاشة المسجد فور الحفظ من هذه اللوحة</span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
};

const AdminApp: React.FC = () => {
  const [authResolved, setAuthResolved] = useState(false);
  const [session, setSession] = useState<RemoteAdminSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [mosques, setMosques] = useState<RemoteMosqueDocument[]>([]);
  const [globalConfig, setGlobalConfig] = useState<RemoteGlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const [globalDraft, setGlobalDraft] = useState<RemoteGlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const [workspace, setWorkspace] = useState<Workspace>('mosques');
  const [mosqueTab, setMosqueTab] = useState<MosqueTab>(() => {
    const stored = readStoredValue(ADMIN_SELECTED_TAB_KEY, 'prayers');
    return stored === 'overview' || stored === 'pages' || stored === 'preview' ? stored : 'prayers';
  });
  const [mosqueSectionView, setMosqueSectionView] = useState<MosqueSectionView>('menu');
  const [search, setSearch] = useState('');
  const [selectedMosqueId, setSelectedMosqueId] = useState<string | null>(() => readStoredValue(ADMIN_SELECTED_MOSQUE_KEY) || null);
  const [mosqueDraft, setMosqueDraft] = useState<RemoteMosqueDocument | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPrayerId, setSelectedPrayerId] = useState<AnnouncementPrayerTrigger>(() => {
    const stored = readStoredValue(ADMIN_SELECTED_PRAYER_KEY, 'fajr');
    return PRAYER_FLOW_PRAYERS.includes(stored as AnnouncementPrayerTrigger) ? stored as AnnouncementPrayerTrigger : 'fajr';
  });
  const [selectedFlowItemId, setSelectedFlowItemId] = useState<string | null>(null);
  const [selectedGlobalPageId, setSelectedGlobalPageId] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('Dammam');
  const [createPassword, setCreatePassword] = useState('1234');
  const [createCode, setCreateCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAdminSession((nextSession) => {
      setSession(nextSession);
      setAuthResolved(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!session) return;
    setWorkspace('mosques');
    setShowGlobalSettings(false);
    setMosqueSectionView('menu');
  }, [session]);

  useEffect(() => {
    const unsubscribe = subscribeMosques((nextMosques) => {
      setMosques(nextMosques);
      setSelectedMosqueId((previous) => {
        if (previous && nextMosques.some((mosque) => mosque.id === previous)) {
          return previous;
        }
        return nextMosques[0]?.id || null;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeGlobalConfig((nextConfig) => {
      setGlobalConfig(nextConfig);
      setGlobalDraft(nextConfig);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedMosqueId) {
      setMosqueDraft(null);
      setSelectedPageId(null);
      setMosqueSectionView('menu');
      return;
    }

    const nextMosque = mosques.find((mosque) => mosque.id === selectedMosqueId) || null;
    setMosqueDraft(nextMosque ? normalizeRemoteMosqueDocument(nextMosque, nextMosque.id) : null);
    setSelectedPageId(nextMosque?.pages?.[0]?.id || null);
    setSelectedFlowItemId(nextMosque?.prayerFlows?.[selectedPrayerId]?.[0]?.id || null);
    setResetPassword('');
    setMosqueSectionView('menu');
  }, [mosques, selectedMosqueId, selectedPrayerId]);

  useEffect(() => {
    if (workspace !== 'mosque_detail') {
      setMosqueSectionView('menu');
    }
  }, [workspace]);

  useEffect(() => {
    if (statusMessage) {
      const timer = window.setTimeout(() => setStatusMessage(null), 5000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [statusMessage]);

  useEffect(() => {
    persistValue(ADMIN_SELECTED_TAB_KEY, mosqueTab);
  }, [mosqueTab]);

  useEffect(() => {
    persistValue(ADMIN_SELECTED_PRAYER_KEY, selectedPrayerId);
  }, [selectedPrayerId]);

  useEffect(() => {
    if (selectedMosqueId) {
      persistValue(ADMIN_SELECTED_MOSQUE_KEY, selectedMosqueId);
    }
  }, [selectedMosqueId]);

  useEffect(() => {
    if (mosqueTab === 'prayers') {
      void import('../TimetableManager');
    }
  }, [mosqueTab]);

  const filteredMosques = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return mosques;
    return mosques.filter((mosque) =>
      [mosque.name, mosque.city, mosque.code].some((value) => value.toLowerCase().includes(needle))
    );
  }, [mosques, search]);

  const previewPages = useMemo(() => {
    if (!mosqueDraft) return [];
    return mergeRemotePages(globalDraft.pages, mosqueDraft.pages);
  }, [globalDraft.pages, mosqueDraft]);

  const currentPrayerFlowItems = useMemo(() => {
    if (!mosqueDraft) return [];
    return normalizePrayerFlows(mosqueDraft.prayerFlows)[selectedPrayerId] || [];
  }, [mosqueDraft, selectedPrayerId]);

  useEffect(() => {
    if (!currentPrayerFlowItems.length) {
      setSelectedFlowItemId(null);
      return;
    }
    if (!selectedFlowItemId || !currentPrayerFlowItems.some((item) => item.id === selectedFlowItemId)) {
      setSelectedFlowItemId(currentPrayerFlowItems[0].id);
    }
  }, [currentPrayerFlowItems, selectedFlowItemId]);

  const totalEnabledPages = useMemo(
    () => mosques.reduce((sum, mosque) => sum + countEnabledPages(mosque.pages), 0),
    [mosques]
  );

  const mosquesWithMonthlySchedule = useMemo(
    () => mosques.filter((mosque) => Boolean(mosque.displayConfig.monthlySchedule?.days?.length)).length,
    [mosques]
  );

  const autoModeCount = useMemo(
    () => mosques.filter((mosque) => mosque.mode === 'AUTO').length,
    [mosques]
  );

  const updateMosqueDraft = (partial: Partial<RemoteMosqueDocument>) => {
    if (!mosqueDraft) return;
    setMosqueDraft(normalizeRemoteMosqueDocument({ ...mosqueDraft, ...partial }, mosqueDraft.id));
  };

  const updateSelectedPrayerFlow = (items: RemotePrayerFlowItem[]) => {
    if (!mosqueDraft) return;
    updateMosqueDraft({
      prayerFlows: {
        ...normalizePrayerFlows(mosqueDraft.prayerFlows),
        [selectedPrayerId]: items
      }
    });
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittingAuth(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        await signInAdmin(email, password);
      } else {
        await registerAdmin(email, password, displayName);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'تعذر تنفيذ عملية الدخول');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleCreateMosque = async () => {
    if (!createName.trim()) return;
    setSaving(true);
    try {
      const created = await createMosque({
        name: createName,
        city: createCity,
        password: createPassword,
        code: createCode
      });
      setWorkspace('mosques');
      setSelectedMosqueId(created.id);
      setMosqueTab('prayers');
      setCreateName('');
      setCreateCity('Dammam');
      setCreatePassword('1234');
      setCreateCode('');
      setShowCreatePanel(false);
      setStatusMessage(`تم إنشاء ${created.name} وربطه بالكود ${created.code}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMosque = async () => {
    if (!mosqueDraft) return;
    setSaving(true);
    try {
      const nextPayload: Partial<RemoteMosqueDocument> = {
        ...mosqueDraft,
        code: mosqueDraft.code.trim().toUpperCase(),
        pages: renumberRemotePages(mosqueDraft.pages),
        displayConfig: {
          ...mosqueDraft.displayConfig,
          mosqueInfo: {
            ...mosqueDraft.displayConfig.mosqueInfo,
            name: mosqueDraft.name,
            location: mosqueDraft.city
          }
        },
        lastUpdated: Date.now()
      };

      if (resetPassword.trim()) {
        nextPayload.passwordHash = await hashPin(resetPassword.trim());
      }

      await updateMosque(mosqueDraft.id, nextPayload);
      setStatusMessage(`تم حفظ إعدادات ${mosqueDraft.name} وإرسالها إلى المسجد مباشرة`);
      setResetPassword('');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      await updateGlobalConfig({
        pages: renumberRemotePages(globalDraft.pages),
        systemSettings: globalDraft.systemSettings,
        lastUpdated: Date.now()
      });
      setStatusMessage('تم حفظ الصفحات العامة لجميع المساجد');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMosque = async () => {
    if (!mosqueDraft) return;
    await deleteMosqueQuickly(mosqueDraft);
  };

  const updateGlobalPrayerManualTime = (
    prayerId: keyof RemoteGlobalConfig['systemSettings']['prayerSettings']['manualTimes'],
    value: string
  ) => {
    setGlobalDraft((previous) => ({
      ...previous,
      systemSettings: {
        ...previous.systemSettings,
        prayerSettings: {
          ...previous.systemSettings.prayerSettings,
          manualTimes: {
            ...previous.systemSettings.prayerSettings.manualTimes,
            [prayerId]: value
          }
        },
        schedule: previous.systemSettings.schedule.map((prayer) =>
          prayer.id === prayerId ? { ...prayer, time: value } : prayer
        )
      }
    }));
  };

  const deleteMosqueQuickly = async (mosque: Pick<RemoteMosqueDocument, 'id' | 'name'>) => {
    if (!window.confirm(`هل تريد حذف ${mosque.name} نهائيًا؟`)) return;
    await deleteMosque(mosque.id);
    if (selectedMosqueId === mosque.id) {
      setSelectedMosqueId(null);
      setWorkspace('mosques');
    }
    setStatusMessage(`تم حذف ${mosque.name}`);
  };

  const updateGlobalMonthlySchedule = (schedule: MonthlySchedule) => {
    setGlobalDraft((previous) => ({
      ...previous,
      systemSettings: {
        ...previous.systemSettings,
        monthlySchedule: schedule
      }
    }));
  };

  const uploadGlobalThemeBackground = async (file: File) => {
    const url = await uploadRemoteAsset(file, 'system/theme');
    setGlobalDraft((previous) => ({
      ...previous,
      systemSettings: {
        ...previous.systemSettings,
        theme: {
          ...previous.systemSettings.theme,
          homeBackgroundImage: url
        }
      }
    }));
  };

  const uploadThemeBackground = async (file: File) => {
    if (!mosqueDraft) return;
    const url = await uploadRemoteAsset(file, `mosques/${mosqueDraft.id}/theme`);
    updateMosqueDraft({
      displayConfig: {
        ...mosqueDraft.displayConfig,
        theme: {
          ...mosqueDraft.displayConfig.theme,
          homeBackgroundImage: url
        }
      }
    });
  };

  const updateMosquePrayerSettings = (prayerSettings: RemoteMosqueDocument['displayConfig']['prayerSettings']) => {
    if (!mosqueDraft) return;
    updateMosqueDraft({
      displayConfig: {
        ...mosqueDraft.displayConfig,
        prayerSettings
      }
    });
  };

  const updateMosqueAdhanSettings = (adhanSettings: RemoteMosqueDocument['displayConfig']['adhanSettings']) => {
    if (!mosqueDraft) return;
    updateMosqueDraft({
      displayConfig: {
        ...mosqueDraft.displayConfig,
        adhanSettings
      }
    });
  };

  const uploadSystemBackground = async (step: RemotePrayerFlowSystemStep, file: File) => {
    if (!mosqueDraft) return;
    const url = await uploadRemoteAsset(file, `mosques/${mosqueDraft.id}/system-pages/${step}`);
    const prayerSettings = mosqueDraft.displayConfig.prayerSettings;
    const adhanSettings = mosqueDraft.displayConfig.adhanSettings;

    if (step === 'pre_adhan' || step === 'adhan') {
      updateMosqueAdhanSettings({
        ...adhanSettings,
        backgroundImage: url
      });
    }

    if (step === 'iqama' || step === 'ghufaylah') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        backgroundImage: url
      });
    }

    if (step === 'tasbeeh') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        tasbeeh: { ...prayerSettings.tasbeeh, backgroundImage: url }
      });
    }

    if (step === 'quran_verse') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        quranVerse: { ...prayerSettings.quranVerse, backgroundImage: url }
      });
    }

    if (step === 'dua_ahd') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        duaAhd: { ...prayerSettings.duaAhd, backgroundImage: url }
      });
    }

    if (step === 'dua_sabah') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        duaSabah: { ...prayerSettings.duaSabah, backgroundImage: url }
      });
    }

    if (step === 'announcement_builtin') {
      updateMosquePrayerSettings({
        ...prayerSettings,
        announcement: { ...prayerSettings.announcement, backgroundImage: url }
      });
    }
  };

  const copyMosqueCode = async () => {
    if (!mosqueDraft?.code) return;
    try {
      await navigator.clipboard.writeText(mosqueDraft.code);
      setStatusMessage(`تم نسخ كود ${mosqueDraft.name}`);
    } catch {
      setStatusMessage('تعذر نسخ الكود من المتصفح الحالي');
    }
  };

  if (!authResolved) {
    return (
      <div className="admin-root geo-pattern px-6 py-10 text-white" dir="rtl">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
          <div className="admin-card px-8 py-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-gold-400/25 bg-gold-500/10 text-gold-100">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="mt-6 text-2xl font-black">جارٍ تجهيز لوحة التحكم</div>
            <div className="mt-3 text-sm text-slate-400">نراجع حالة تسجيل الدخول والاتصال بالمشروع قبل فتح الإدارة.</div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-root geo-pattern px-6 py-10 text-white" dir="rtl">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="admin-hero p-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-gold-400/20 bg-gold-500/10 px-5 py-2 text-sm font-black text-gold-100">
                <ShieldCheck className="h-4 w-4" />
                لوحة تحكم مركزية لإدارة المساجد
              </div>
              <h1 className="mt-6 text-4xl font-black leading-tight md:text-5xl">
                إدارة كل الشاشات من مكان واحد وبواجهة أوضح وأسرع
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
                أضف المساجد، اربط كل مسجد بكوده، أنشئ الأدعية والإعلانات والصور، وعدل أوقات الصلاة اليومية أو الشهرية.
                كل تغيير تحفظه هنا يصل إلى شاشة المسجد مباشرة عبر Firebase.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={<Building2 className="h-5 w-5" />}
                  title="إدارة متعددة"
                  value="كل المساجد"
                  helper="كل مسجد يظهر لك في الرئيسية لتدخل عليه مباشرة بعد تسجيل الدخول."
                />
                <StatCard
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="مواقيت يومية"
                  value="جدول شهري"
                  helper="تقدر تضيف مواقيت لكل أيام الشهر، وليس فقط أوقات ثابتة."
                />
                <StatCard
                  icon={<MonitorSmartphone className="h-5 w-5" />}
                  title="مزامنة مباشرة"
                  value={isConfigured ? 'Firebase Live' : 'وضع محلي'}
                  helper="الدخول محفوظ على نفس الجهاز، وتعديلاتك تصل للشاشة بدون الذهاب للمسجد."
                />
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="admin-card p-8">
              <div className="mb-6 flex gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                <SegmentedButton active={authMode === 'login'} label="تسجيل الدخول" onClick={() => setAuthMode('login')} />
                <SegmentedButton active={authMode === 'register'} label="إنشاء حساب" onClick={() => setAuthMode('register')} />
              </div>

              <div className="space-y-4">
                {authMode === 'register' && (
                  <TextField label="اسم المسؤول" value={displayName} onChange={setDisplayName} placeholder="اسمك أو اسم الجهة" />
                )}
                <TextField label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} placeholder="admin@example.com" />
                <TextField label="كلمة المرور" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              </div>

              {authError && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {authError}
                </div>
              )}

              <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-7 text-slate-300">
                بعد أول تسجيل دخول، ستبقى الجلسة محفوظة على هذا الجهاز، وتفتح لك لوحة المساجد مباشرة غالبًا بدون إعادة كتابة البريد وكلمة المرور.
              </div>

              <button
                type="submit"
                disabled={submittingAuth}
                className="admin-action-gold mt-6 w-full rounded-[1.3rem] px-4 py-4 text-base font-black transition hover:opacity-95 disabled:opacity-60"
              >
                {submittingAuth ? 'جارٍ التنفيذ...' : authMode === 'login' ? 'دخول لوحة الإدارة' : 'إنشاء الحساب وبدء الإدارة'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-root geo-pattern admin-scrollbar text-slate-900" dir="rtl">
      {workspace === 'mosques' && (
      <button
        type="button"
        onClick={() => signOutAdminSession()}
        className="fixed left-4 top-4 z-[120] rounded-[1rem] border border-red-200 bg-white/85 px-3 py-2 text-xs font-black text-red-600 shadow-[0_14px_34px_rgba(148,27,27,0.12)] backdrop-blur-xl"
      >
        <LogOut className="ml-1 inline h-4 w-4" />
        تسجيل الخروج
      </button>
      )}
      <div className="mx-auto max-w-[1850px] px-5 py-6 lg:px-8">
        <header className="admin-hero mb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="admin-brand-orb">
                <AdminLogo className="h-12 w-12" />
              </div>
              <div>
                <div className="text-xs font-black tracking-[0.28em] text-[#b8791f]">MASJID ADMIN</div>
                <h1 className="mt-1 text-3xl font-black leading-tight md:text-4xl">
                  {workspace === 'mosque_detail' && mosqueDraft ? mosqueDraft.name : workspace === 'global' ? 'أوقات الصلاة العامة' : 'المساجد'}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {workspace === 'mosques' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCreatePanel(true)}
                    className="admin-action-gold rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
                  >
                    <Plus className="ml-1 inline h-4 w-4" />
                    إضافة مسجد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspace('global');
                      setShowGlobalSettings(false);
                    }}
                    className="admin-action-ghost rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
                  >
                    <CalendarClock className="ml-1 inline h-4 w-4" />
                    أوقات الصلاة
                  </button>
                  <a
                    href={ADMIN_HOSTING_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-action-ghost rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
                  >
                    <ExternalLink className="ml-1 inline h-4 w-4" />
                    فتح على الآيباد
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setWorkspace('mosques');
                    setShowGlobalSettings(false);
                  }}
                  className="admin-action-ghost rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
                >
                  رجوع للمساجد
                </button>
              )}
            </div>
          </div>
        </header>

        {false && workspace !== 'mosque_detail' && (
        <div className="mb-6 grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
          <button
            type="button"
            onClick={() => {
              setWorkspace('mosques');
              setShowGlobalSettings(false);
            }}
            className={`rounded-[1.2rem] border px-4 py-3 text-sm font-black transition ${
              workspace !== 'global'
                ? 'admin-tab-active'
                : 'admin-action-ghost'
            }`}
          >
            <Building2 className="ml-2 inline h-4 w-4" />
            المساجد
          </button>
          <button
            type="button"
            onClick={() => setShowCreatePanel(true)}
            className="admin-action-gold rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
          >
            <Plus className="ml-2 inline h-4 w-4" />
            إضافة مسجد جديد
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkspace('global');
              setShowGlobalSettings(false);
            }}
            className={`rounded-[1.2rem] border px-4 py-3 text-sm font-black transition ${
              workspace === 'global'
                ? 'admin-tab-active'
                : 'admin-action-ghost'
            }`}
          >
            <CalendarClock className="ml-2 inline h-4 w-4" />
            أوقات الصلاة العامة
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkspace('global');
              setShowGlobalSettings(true);
            }}
            className="admin-action-ghost rounded-[1.2rem] px-4 py-3 text-sm font-black transition"
          >
            <LayoutDashboard className="ml-2 inline h-4 w-4" />
            الإعدادات المتقدمة
          </button>
        </div>
        )}

        {statusMessage && (
          <div className="mb-6 rounded-[1.6rem] border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {statusMessage}
          </div>
        )}

        {workspace === 'global' && showGlobalSettings && (
        <SectionCard
          title="مركز النظام العام"
          subtitle="كل ما تعدله هنا ينعكس على جميع المساجد: المواقيت الموحدة، خلفية الصفحة الرئيسية، وجدول الشهر العام."
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowGlobalSettings(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white"
              >
                إخفاء الإعدادات المتقدمة
              </button>
              <button
                type="button"
                onClick={handleSaveGlobal}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                <Save className="ml-1 inline h-4 w-4" />
                حفظ النظام العام
              </button>
            </div>
          }
        >
          <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2.5">
                  <span className="text-sm font-bold text-slate-200">نمط المواقيت العام</span>
                  <select
                    value={globalDraft.systemSettings.prayerSettings.mode}
                    onChange={(event) =>
                      setGlobalDraft((previous) => ({
                        ...previous,
                        systemSettings: {
                          ...previous.systemSettings,
                          prayerSettings: {
                            ...previous.systemSettings.prayerSettings,
                            mode: event.target.value as RemoteGlobalConfig['systemSettings']['prayerSettings']['mode']
                          }
                        }
                      }))
                    }
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3.5 text-white outline-none"
                  >
                    <option value="manual">يدوي موحّد</option>
                    <option value="auto">تلقائي موحّد</option>
                  </select>
                </label>
                <TextField
                  label="المدينة العامة"
                  value={globalDraft.systemSettings.prayerSettings.city}
                  onChange={(value) =>
                    setGlobalDraft((previous) => ({
                      ...previous,
                      systemSettings: {
                        ...previous.systemSettings,
                        prayerSettings: {
                          ...previous.systemSettings.prayerSettings,
                          city: value
                        }
                      }
                    }))
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                {PRAYER_FIELDS.map((field) => (
                  <TextField
                    key={field.id}
                    label={field.label}
                    value={globalDraft.systemSettings.prayerSettings.manualTimes[field.id] || ''}
                    onChange={(value) => updateGlobalPrayerManualTime(field.id, value)}
                    placeholder="HH:mm"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <TextField
                  label="لون خلفية الصفحة الرئيسية"
                  value={globalDraft.systemSettings.theme.homeBackgroundColor}
                  onChange={(value) =>
                    setGlobalDraft((previous) => ({
                      ...previous,
                      systemSettings: {
                        ...previous.systemSettings,
                        theme: {
                          ...previous.systemSettings.theme,
                          homeBackgroundColor: value
                        }
                      }
                    }))
                  }
                />
                <TextField
                  label="لون الغطاء"
                  value={globalDraft.systemSettings.theme.homeOverlayColor}
                  onChange={(value) =>
                    setGlobalDraft((previous) => ({
                      ...previous,
                      systemSettings: {
                        ...previous.systemSettings,
                        theme: {
                          ...previous.systemSettings.theme,
                          homeOverlayColor: value
                        }
                      }
                    }))
                  }
                />
              </div>

              <TextField
                label="شفافية الغطاء"
                value={String(globalDraft.systemSettings.theme.homeOverlayOpacity)}
                onChange={(value) =>
                  setGlobalDraft((previous) => ({
                    ...previous,
                    systemSettings: {
                      ...previous.systemSettings,
                      theme: {
                        ...previous.systemSettings.theme,
                        homeOverlayOpacity: Number(value) || 0
                      }
                    }
                  }))
                }
              />

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-sm font-bold text-slate-200">خلفية الصفحة الرئيسية العامة</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                    <ImagePlus className="ml-1 inline h-4 w-4" />
                    رفع صورة
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) await uploadGlobalThemeBackground(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setGlobalDraft((previous) => ({
                        ...previous,
                        systemSettings: {
                          ...previous.systemSettings,
                          theme: {
                            ...previous.systemSettings.theme,
                            homeBackgroundImage: null
                          }
                        }
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                  >
                    إزالة الصورة
                  </button>
                </div>
                {globalDraft.systemSettings.theme.homeBackgroundImage && (
                  <div className="mt-3 truncate text-xs text-slate-500">{globalDraft.systemSettings.theme.homeBackgroundImage}</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
        )}

        {workspace === 'mosques' && (
        <div className="admin-page-enter grid gap-6 xl:grid-cols-1">
          <div className="space-y-6">
            <div className="admin-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Building2 className="h-5 w-5" />}
                title="المساجد"
                value={String(mosques.length)}
                helper="كل مسجد يظهر كبطاقة مستقلة في الرئيسية لتدخل عليه بسرعة."
              />
              <StatCard
                icon={<FileText className="h-5 w-5" />}
                title="الصفحات المفعلة"
                value={String(totalEnabledPages)}
                helper="مجموع الصفحات الخاصة بكل المساجد، بدون الصفحات العامة."
              />
              <StatCard
                icon={<CalendarClock className="h-5 w-5" />}
                title="الجداول الشهرية"
                value={String(mosquesWithMonthlySchedule)}
                helper="عدد المساجد التي لديها مواقيت شهرية لكل الأيام."
              />
              <StatCard
                icon={<LayoutDashboard className="h-5 w-5" />}
                title="الوضع التلقائي"
                value={String(autoModeCount)}
                helper="عدد المساجد التي تعمل حاليًا في وضع تلقائي كامل."
              />
            </div>

            <div className="admin-dashboard-actions grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowCreatePanel(true)}
                className="admin-action-tile admin-action-tile-primary group"
              >
                <div className="admin-action-tile-icon">
                  <Plus className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-lg font-black">إضافة مسجد جديد</div>
                  <div className="mt-1 text-sm opacity-80">أضف مسجدًا للنظام واربطه بكود شاشة المسجد</div>
                </div>
                <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspace('global');
                  setShowGlobalSettings(false);
                }}
                className="admin-action-tile group"
              >
                <div className="admin-action-tile-icon admin-action-tile-icon-accent">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-lg font-black">أوقات الصلاة العامة</div>
                  <div className="mt-1 text-sm text-slate-500">إدارة الجدول الشهري والمواقيت لكل المساجد</div>
                </div>
                <ChevronLeft className="h-5 w-5 text-[#0f766e] transition-transform group-hover:-translate-x-1" />
              </button>
            </div>

            <SectionCard
              title="المساجد المسجلة"
              actions={
                <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-[#8a5a13]">
                  {filteredMosques.length} مسجد
                </div>
              }
            >
              <div className="mb-5 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ابحث باسم المسجد أو المدينة أو الكود"
                    className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              {workspace === 'mosques' ? (
                filteredMosques.length > 0 ? (
                  <div className="admin-mosque-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredMosques.map((mosque) => (
                      <MosqueCard
                        key={mosque.id}
                        mosque={mosque}
                        selected={selectedMosqueId === mosque.id}
                        onSelect={() => {
                          setSelectedMosqueId(mosque.id);
                          setWorkspace('mosque_detail');
                          setMosqueTab('prayers');
                          setMosqueSectionView('menu');
                        }}
                        onDelete={() => {
                          void deleteMosqueQuickly(mosque);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="لا يوجد مسجد مطابق للبحث" subtitle="جرّب اسمًا آخر، أو أضف مسجدًا جديدًا من اللوحة الجانبية." />
                )
              ) : null}
            </SectionCard>
          </div>

          {false && showCreatePanel && (
          <SectionCard
            title="إضافة مسجد جديد"
            subtitle="أنشئ المسجد مرة واحدة فقط، وبعدها سيظهر لك دائمًا في الرئيسية لتدخل عليه مباشرة."
          >
            <div className="space-y-4">
              <TextField label="اسم المسجد" value={createName} onChange={setCreateName} placeholder="مثال: مسجد الإمام الحسين" />
              <TextField label="المدينة" value={createCity} onChange={setCreateCity} placeholder="Dammam" />
              <TextField label="كلمة مرور المسجد" type="password" value={createPassword} onChange={setCreatePassword} placeholder="1234" />

              <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                <TextField label="كود الربط" value={createCode} onChange={setCreateCode} placeholder="DAMMAM_IMAM_01" />
                <button
                  type="button"
                  onClick={() => setCreateCode(generateMosqueCode(createName || 'Masjid', createCity || 'Dammam'))}
                  className="mt-[1.95rem] rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
                >
                  <RefreshCw className="ml-1 inline h-4 w-4" />
                  توليد كود
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreateMosque}
                disabled={saving || !createName.trim()}
                className="w-full rounded-[1.3rem] bg-gradient-to-r from-gold-500 to-amber-400 px-4 py-4 text-base font-black text-slate-950 disabled:opacity-60"
              >
                <Plus className="ml-1 inline h-5 w-5" />
                إنشاء المسجد
              </button>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-300">
                بعد إنشاء المسجد سيظهر لك ضمن البطاقات في الرئيسية. خذ الكود وضعه في تطبيق شاشة المسجد مرة واحدة فقط، وبعدها كل التحكم يتم من هنا.
              </div>
            </div>
          </SectionCard>
          )}
        </div>
        )}

        <div className={`mt-6 ${workspace === 'mosques' ? 'hidden' : ''}`}>
          {workspace === 'global' ? (
            <div className="admin-page-enter space-y-6">
              <SectionCard
                title="الجدول الشهري العام"
                subtitle="هذا الجدول يورّث إلى جميع المساجد في النظام، ويُستخدم عندما تحتاج مواقيت مفصلة لكل أيام الشهر."
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkspace('mosques')}
                      className="admin-action-ghost rounded-xl px-4 py-2 text-sm font-black"
                    >
                      رجوع للمساجد
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGlobalSettings((previous) => !previous)}
                      className="admin-action-ghost rounded-xl px-4 py-2 text-sm font-black"
                    >
                      إعدادات عامة متقدمة
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGlobal}
                      disabled={saving}
                      className="admin-action-gold rounded-xl px-4 py-2 text-sm font-black disabled:opacity-60"
                    >
                      <Save className="ml-1 inline h-4 w-4" />
                      حفظ أوقات الصلاة
                    </button>
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="rounded-[1.8rem] border border-white/10 bg-black/20 px-5 py-12 text-center text-slate-400">
                      جارٍ تجهيز مدير الجدول الشهري...
                    </div>
                  }
                >
                  <TimetableManager
                    schedule={globalDraft.systemSettings.monthlySchedule}
                    onUpdate={updateGlobalMonthlySchedule}
                    hijriOffset={globalDraft.systemSettings.hijriOffset}
                  />
                </Suspense>
              </SectionCard>

              <details className="admin-card">
                <summary className="cursor-pointer text-lg font-black text-white">
                  محتوى عام اختياري لكل المساجد
                  <span className="mr-3 text-sm font-bold text-slate-400">
                    افتحه فقط إذا أردت إعلانًا أو شريحة مشتركة تظهر في كل مسجد.
                  </span>
                </summary>
                <div className="mt-5 space-y-6">
                  <PageEditor
                    title="الصفحات العامة"
                    pages={globalDraft.pages}
                    selectedPageId={selectedGlobalPageId}
                    onSelectPage={setSelectedGlobalPageId}
                    onChangePages={(pages) => setGlobalDraft((previous) => ({ ...previous, pages }))}
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveGlobal}
                      disabled={saving}
                      className="admin-action-gold rounded-[1.3rem] px-5 py-4 text-base font-black disabled:opacity-60"
                    >
                      <Save className="ml-1 inline h-5 w-5" />
                      حفظ الصفحات العامة
                    </button>
                  </div>

                  <PreviewPane title="معاينة الصفحات العامة" pages={globalDraft.pages} modeLabel="GLOBAL PREVIEW" />
                </div>
              </details>
            </div>
          ) : workspace === 'mosque_detail' && mosqueDraft ? (
            <div className="admin-page-enter space-y-6">
              {mosqueSectionView === 'menu' && (
              <SectionCard
                title={`مركز إدارة ${mosqueDraft.name}`}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWorkspace('mosques')}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white"
                    >
                      رجوع إلى المساجد
                    </button>
                    <button
                      type="button"
                      onClick={copyMosqueCode}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white"
                    >
                      <Copy className="ml-1 inline h-4 w-4" />
                      نسخ الكود
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteMosque}
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-50"
                    >
                      <Trash2 className="ml-1 inline h-4 w-4" />
                      حذف المسجد
                    </button>
                  </div>
                }
              >
                <div className="admin-mosque-identity-card mb-5">
                  <div className="admin-mosque-identity-icon">
                    <AdminLogo className="h-16 w-16" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-2xl font-black text-slate-950 md:text-3xl">مركز إدارة {mosqueDraft.name}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-[#b8791f]" />{mosqueDraft.city}</span>
                      <span className="flex items-center gap-1"><Layers className="h-4 w-4 text-emerald-600" />{countEnabledPages(mosqueDraft.pages)} / {mosqueDraft.pages.length} صفحة مفعلة</span>
                    </div>
                  </div>
                  <div className="admin-code-panel">
                    <div className="text-xs font-black text-slate-500">كود الربط</div>
                    <div className="mt-1 font-mono text-sm font-black text-[#9a6417]">{mosqueDraft.code}</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="text-xs font-black text-slate-500">المدينة</div>
                    <div className="mt-2 text-lg font-black text-white">{mosqueDraft.city}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="text-xs font-black text-slate-500">كود الربط</div>
                    <div className="mt-2 text-lg font-black text-gold-200">{mosqueDraft.code}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="text-xs font-black text-slate-500">الصفحات المفعلة</div>
                    <div className="mt-2 text-lg font-black text-white">{countEnabledPages(mosqueDraft.pages)} / {mosqueDraft.pages.length}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
                    <div className="text-xs font-black text-slate-500">آخر تحديث</div>
                    <div className="mt-2 text-sm font-bold text-white">{formatLastUpdated(mosqueDraft.lastUpdated)}</div>
                  </div>
                </div>
              </SectionCard>
              )}

              {mosqueSectionView === 'menu' ? (
                <SectionCard
                  title="أقسام إدارة المسجد"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {(['overview', 'prayers', 'pages', 'preview'] as MosqueTab[]).map((tab, index) => {
                      const tabMeta = getTabMeta(tab);
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setMosqueTab(tab);
                            setMosqueSectionView(tab);
                          }}
                          className="admin-management-section group"
                          style={{ animationDelay: `${index * 80}ms` }}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`admin-management-icon ${tabMeta.accentClass}`}>
                              {tabMeta.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-base font-black text-slate-950 transition-colors group-hover:text-[#b8791f]">{getTabLabel(tab)}</div>
                                <ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition-all group-hover:-translate-x-1 group-hover:text-[#b8791f]" />
                              </div>
                              <div className="mt-2 text-sm leading-7 text-slate-500">{tabMeta.description}</div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {tabMeta.features.map((feature) => (
                                  <span key={feature} className="admin-mini-badge">{feature}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              ) : (
                <div className="admin-page-enter flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-slate-950/45 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMosqueSectionView('menu')}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    رجوع إلى الأقسام
                  </button>
                  <div className="rounded-xl border border-gold-400/25 bg-gold-500/10 px-3 py-2 text-sm font-black text-gold-100">
                    {getTabLabel(mosqueTab)}
                  </div>
                </div>
              )}

              {mosqueSectionView !== 'menu' && mosqueTab === 'overview' && (
                <div className="space-y-6">
                  <SectionCard title="بيانات المسجد الأساسية" subtitle="هذه البيانات تظهر في شاشة المسجد وتُستخدم كذلك لربط الفرع وإدارته.">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <TextField label="اسم المسجد" value={mosqueDraft.name} onChange={(value) => updateMosqueDraft({ name: value })} />
                      <TextField
                        label="المدينة"
                        value={mosqueDraft.city}
                        onChange={(value) =>
                          updateMosqueDraft({
                            city: value,
                            prayerSettings: { ...mosqueDraft.prayerSettings, city: value },
                            displayConfig: {
                              ...mosqueDraft.displayConfig,
                              mosqueInfo: { ...mosqueDraft.displayConfig.mosqueInfo, location: value }
                            }
                          })
                        }
                      />
                      <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                        <TextField label="كود الربط" value={mosqueDraft.code} onChange={(value) => updateMosqueDraft({ code: value.toUpperCase() })} />
                        <button
                          type="button"
                          onClick={() => updateMosqueDraft({ code: generateMosqueCode(mosqueDraft.name, mosqueDraft.city) })}
                          className="mt-[1.95rem] rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
                        >
                          <RefreshCw className="ml-1 inline h-4 w-4" />
                          توليد
                        </button>
                      </div>
                      <TextField
                        label="اسم الإمام"
                        value={mosqueDraft.displayConfig.mosqueInfo.imamName}
                        onChange={(value) =>
                          updateMosqueDraft({
                            displayConfig: {
                              ...mosqueDraft.displayConfig,
                              mosqueInfo: { ...mosqueDraft.displayConfig.mosqueInfo, imamName: value }
                            }
                          })
                        }
                      />
                      <TextField
                        label="إعادة تعيين كلمة مرور المسجد"
                        type="password"
                        value={resetPassword}
                        onChange={setResetPassword}
                        placeholder="اتركها فارغة إذا لم ترد تغييرها"
                      />
                      <TextAreaField
                        label="عنوان المناسبة"
                        rows={3}
                        value={mosqueDraft.displayConfig.occasion.title}
                        onChange={(value) =>
                          updateMosqueDraft({
                            displayConfig: {
                              ...mosqueDraft.displayConfig,
                              occasion: { ...mosqueDraft.displayConfig.occasion, title: value }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="mt-4">
                      <TextAreaField
                        label="نص المناسبة"
                        rows={4}
                        value={mosqueDraft.displayConfig.occasion.description}
                        onChange={(value) =>
                          updateMosqueDraft({
                            displayConfig: {
                              ...mosqueDraft.displayConfig,
                              occasion: {
                                ...mosqueDraft.displayConfig.occasion,
                                description: value,
                                show: Boolean(value.trim())
                              }
                            }
                          })
                        }
                      />
                    </div>
                  </SectionCard>

                  <SectionCard title="وضع الشاشة والمشهد البصري" subtitle="اختر وضع العرض الحالي واضبط خلفية الصفحة الرئيسية بما يناسب المسجد.">
                    <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                      <div className="space-y-4">
                        <div className="grid gap-3 lg:grid-cols-2">
                          {MODE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => updateMosqueDraft({ mode: option.id })}
                              className={`rounded-[1.5rem] border px-4 py-4 text-right transition ${
                                mosqueDraft.mode === option.id
                                  ? 'border-gold-400/50 bg-gold-500/12'
                                  : 'border-white/10 bg-white/5 hover:bg-white/8'
                              }`}
                            >
                              <div className="text-base font-black text-white">{option.label}</div>
                              <div className="mt-2 text-sm leading-7 text-slate-400">{option.helper}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField
                            label="لون الخلفية"
                            value={mosqueDraft.displayConfig.theme.homeBackgroundColor}
                            onChange={(value) =>
                              updateMosqueDraft({
                                displayConfig: {
                                  ...mosqueDraft.displayConfig,
                                  theme: { ...mosqueDraft.displayConfig.theme, homeBackgroundColor: value }
                                }
                              })
                            }
                          />
                          <TextField
                            label="لون الغطاء"
                            value={mosqueDraft.displayConfig.theme.homeOverlayColor}
                            onChange={(value) =>
                              updateMosqueDraft({
                                displayConfig: {
                                  ...mosqueDraft.displayConfig,
                                  theme: { ...mosqueDraft.displayConfig.theme, homeOverlayColor: value }
                                }
                              })
                            }
                          />
                        </div>
                        <TextField
                          label="شفافية الغطاء"
                          value={String(mosqueDraft.displayConfig.theme.homeOverlayOpacity)}
                          onChange={(value) =>
                            updateMosqueDraft({
                              displayConfig: {
                                ...mosqueDraft.displayConfig,
                                theme: { ...mosqueDraft.displayConfig.theme, homeOverlayOpacity: Number(value) || 0 }
                              }
                            })
                          }
                        />

                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                          <div className="text-sm font-bold text-slate-200">خلفية الصفحة الرئيسية</div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                              <ImagePlus className="ml-1 inline h-4 w-4" />
                              رفع صورة
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];
                                  if (file) await uploadThemeBackground(file);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateMosqueDraft({
                                  displayConfig: {
                                    ...mosqueDraft.displayConfig,
                                    theme: { ...mosqueDraft.displayConfig.theme, homeBackgroundImage: null }
                                  }
                                })
                              }
                              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-300"
                            >
                              إزالة الصورة
                            </button>
                          </div>
                          {mosqueDraft.displayConfig.theme.homeBackgroundImage && (
                            <div className="mt-3 truncate text-xs text-slate-500">{mosqueDraft.displayConfig.theme.homeBackgroundImage}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {mosqueSectionView !== 'menu' && mosqueTab === 'prayers' && (
                <div className="space-y-6">
                  <PrayerFlowBuilder
                    mosqueName={mosqueDraft.name}
                    prayerId={selectedPrayerId}
                    onPrayerChange={setSelectedPrayerId}
                    flowItems={currentPrayerFlowItems}
                    pages={mosqueDraft.pages}
                    prayerSettings={mosqueDraft.displayConfig.prayerSettings}
                    adhanSettings={mosqueDraft.displayConfig.adhanSettings}
                    selectedFlowItemId={selectedFlowItemId}
                    onSelectFlowItem={setSelectedFlowItemId}
                    onChangeFlowItems={updateSelectedPrayerFlow}
                    onChangePages={(pages) => updateMosqueDraft({ pages })}
                    onChangePrayerSettings={updateMosquePrayerSettings}
                    onChangeAdhanSettings={updateMosqueAdhanSettings}
                    onUploadSystemBackground={uploadSystemBackground}
                  />
                </div>
              )}

              {mosqueSectionView !== 'menu' && mosqueTab === 'pages' && (
                <PageEditor
                  title="مكتبة محتوى المسجد"
                  pages={mosqueDraft.pages}
                  selectedPageId={selectedPageId}
                  onSelectPage={setSelectedPageId}
                  onChangePages={(pages) => updateMosqueDraft({ pages })}
                />
              )}

              {mosqueSectionView !== 'menu' && mosqueTab === 'preview' && (
                <div className="space-y-6">
                  <PrayerFlowPreviewPane
                    mosqueName={mosqueDraft.name}
                    prayerId={selectedPrayerId}
                    flowItems={currentPrayerFlowItems}
                    pages={mosqueDraft.pages}
                    selectedFlowItemId={selectedFlowItemId}
                  />
                  <PreviewPane
                    title="المعاينة العامة للصفحات"
                    pages={previewPages}
                    mosqueName={mosqueDraft.name}
                    modeLabel={`معاينة ${MODE_LABELS[mosqueDraft.mode]}`}
                  />
                </div>
              )}

              {mosqueSectionView !== 'menu' && (
              <div className="sticky bottom-4 z-20">
                <div className="flex justify-end rounded-[1.8rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMosqueDraft(
                          normalizeRemoteMosqueDocument(
                            mosques.find((item) => item.id === mosqueDraft.id) || mosqueDraft,
                            mosqueDraft.id
                          )
                        )
                      }
                      className="rounded-[1.2rem] border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-black text-white"
                    >
                      <RefreshCw className="ml-1 inline h-4 w-4" />
                      استرجاع آخر نسخة محفوظة
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMosque}
                      disabled={saving}
                      className="rounded-[1.2rem] bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3.5 text-sm font-black text-slate-950 disabled:opacity-60"
                    >
                      <Save className="ml-1 inline h-4 w-4" />
                      حفظ وإرسال للمسجد
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
          ) : (
            <SectionCard title="ابدأ باختيار مسجد" subtitle="اختر مسجدًا من البطاقات في الأعلى، أو أنشئ مسجدًا جديدًا من لوحة الإضافة.">
              <EmptyState title="لا يوجد مسجد محدد الآن" subtitle="بمجرد اختيار المسجد ستظهر لك تبويبات الإدارة الكاملة: البيانات، الأوقات، الصفحات، والمعاينة." />
            </SectionCard>
          )}
        </div>

        {showCreatePanel && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="إغلاق نافذة إضافة المسجد"
              onClick={() => setShowCreatePanel(false)}
              className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
            />
            <div className="relative z-10 w-full max-w-3xl">
              <SectionCard
                title="إضافة مسجد جديد"
                subtitle="أدخل بيانات المسجد مرة واحدة، وبعدها يظهر مباشرة في الرئيسية لتديره من هذه اللوحة."
                actions={
                  <button
                    type="button"
                    onClick={() => setShowCreatePanel(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white"
                  >
                    إغلاق
                  </button>
                }
              >
                <div className="space-y-4">
                  <TextField label="اسم المسجد" value={createName} onChange={setCreateName} placeholder="مثال: مسجد الإمام الحسين" />
                  <TextField label="المدينة" value={createCity} onChange={setCreateCity} placeholder="Dammam" />
                  <TextField label="كلمة مرور المسجد" type="password" value={createPassword} onChange={setCreatePassword} placeholder="1234" />

                  <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                    <TextField label="كود الربط" value={createCode} onChange={setCreateCode} placeholder="DAMMAM_IMAM_01" />
                    <button
                      type="button"
                      onClick={() => setCreateCode(generateMosqueCode(createName || 'Masjid', createCity || 'Dammam'))}
                      className="mt-[1.95rem] rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
                    >
                      <RefreshCw className="ml-1 inline h-4 w-4" />
                      توليد كود
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateMosque}
                    disabled={saving || !createName.trim()}
                    className="w-full rounded-[1.3rem] bg-gradient-to-r from-gold-500 to-amber-400 px-4 py-4 text-base font-black text-slate-950 disabled:opacity-60"
                  >
                    <Plus className="ml-1 inline h-5 w-5" />
                    إنشاء المسجد
                  </button>
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminApp;
