
import React, { Suspense, lazy, memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AdhanSettings, AnnouncementPrayerTrigger, MonthlySchedule, MosqueInfo, Occasion, PrayerSettings, PrayerTime, RamadanDuaSystemSettings, TimetableDay } from '../types';
import IOSTimePicker from './IOSTimePicker';
import { convert24to12, convert12to24, fileToDataUrl } from '../utils';
import { CUSTOM_QURAN_RECITER_ID, getQuranReciters } from '../data/quranLibrary';
import { normalizeRamadanDuaSystemSettings } from '../data/ramadanDuaLibrary';

interface RemoteControlStatus {
  running: boolean;
  ipAddress: string;
  port: number;
  url: string;
  qrCodeDataUrl: string | null;
  pin: string;
  clientCount: number;
}

interface DashboardProps {
  onBack: () => void;
  variant?: 'advanced' | 'quick';
  currentMosqueInfo: MosqueInfo;
  onUpdateMosqueInfo: (info: MosqueInfo) => void;
  currentOccasion: Occasion;
  onUpdateOccasion: (occ: Occasion) => void;
  currentSchedule: PrayerTime[];
  onUpdateSchedule: (schedule: PrayerTime[]) => void;
  currentBackgroundImage: string | null;
  onUploadBackground: (file: File) => void;
  onUpdateBackgroundUrl: (url: string | null) => void;
  currentHomeBackgroundColor: string;
  onUpdateHomeBackgroundColor: (color: string) => void;
  currentHomeOverlayColor?: string;
  onUpdateHomeOverlayColor?: (color: string) => void;
  currentHomeOverlayOpacity?: number;
  onUpdateHomeOverlayOpacity?: (opacity: number) => void;
  currentAdhanSettings: AdhanSettings;
  onUpdateAdhanSettings: (settings: AdhanSettings) => void;
  onUploadAdhanBackground: (file: File) => void;
  currentPrayerSettings: PrayerSettings;
  onUpdatePrayerSettings: (settings: PrayerSettings) => void;
  onUploadPrayerBackground: (file: File) => void;
  onUpdateMonthlySchedule: (schedule: MonthlySchedule) => void;
  currentMonthlySchedule?: MonthlySchedule | null;
  onUploadTasbeehBackground: (file: File) => void;
  onUploadQuranVerseBackground: (file: File) => void;
  currentHijriOffset?: number;
  onUpdateHijriOffset?: (offset: number) => void;
  onApplyDay?: (dayNumber: number | null) => void;
  onPreviewRamadanDua?: (duaId?: string) => void;
  onPreviewAnnouncement?: () => void;
  onPreviewQuranMode?: () => void;
  remoteControlStatus?: RemoteControlStatus | null;
}

type Tab = 'dashboard' | 'schedule' | 'settings' | 'remoteControl' | 'duaLibrary';

const TimetableManager = lazy(() => import('./TimetableManager'));
const RamadanDuaSettingsPanel = lazy(() => import('./RamadanDuaSettingsPanel'));
const RamadanDuaLibraryPanel = lazy(() => import('./RamadanDuaLibraryPanel'));

const ANNOUNCEMENT_PRAYER_OPTIONS: Array<{ id: AnnouncementPrayerTrigger; label: string; helper: string }> = [
  { id: 'fajr', label: 'بعد الفجر', helper: 'بداية اليوم' },
  { id: 'dhuhr', label: 'بعد الظهر', helper: 'وقت الظهيرة' },
  { id: 'asr', label: 'بعد العصر', helper: 'الفترة التالية' },
  { id: 'maghrib', label: 'بعد المغرب', helper: 'بعد الغروب' },
  { id: 'isha', label: 'بعد العشاء', helper: 'ختام الليلة' }
];

const DashboardPanelFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[14rem] items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center text-white">
    <div className="flex items-center gap-4">
      <div className="h-3 w-3 animate-pulse rounded-full bg-gold-400"></div>
      <span className="font-bold">{label}</span>
    </div>
  </div>
);

interface SidebarItemProps {
  active: boolean;
  icon: string;
  id: Tab;
  label: string;
  onSelect: (id: Tab) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = memo(({ active, icon, id, label, onSelect }) => (
  <li>
    <button onClick={() => onSelect(id)} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl mb-1 transition-all ${active ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white'}`}>
      <i className={`${icon} w-5`}></i><span>{label}</span>
    </button>
  </li>
));

const Dashboard: React.FC<DashboardProps> = ({ 
  onBack, variant = 'advanced', currentMosqueInfo, onUpdateMosqueInfo, currentOccasion, onUpdateOccasion,
  currentSchedule, onUpdateSchedule, currentBackgroundImage, onUploadBackground,
  onUpdateBackgroundUrl, currentHomeBackgroundColor, onUpdateHomeBackgroundColor,
  currentHomeOverlayColor = '#000000', onUpdateHomeOverlayColor, currentHomeOverlayOpacity = 0.4,
  onUpdateHomeOverlayOpacity, currentAdhanSettings, onUpdateAdhanSettings,
  onUploadAdhanBackground, currentPrayerSettings, onUpdatePrayerSettings,
  onUploadPrayerBackground, onUpdateMonthlySchedule, currentMonthlySchedule, onUploadTasbeehBackground, onUploadQuranVerseBackground,
  currentHijriOffset = 0, onUpdateHijriOffset, onApplyDay, onPreviewRamadanDua, onPreviewAnnouncement, onPreviewQuranMode, remoteControlStatus
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isExiting, setIsExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedRamadanDuaSystem = useMemo(
    () => normalizeRamadanDuaSystemSettings(currentPrayerSettings.ramadanDuaSystem),
    [currentPrayerSettings.ramadanDuaSystem]
  );
  const deferredRamadanDuaSystem = useDeferredValue(normalizedRamadanDuaSystem as RamadanDuaSystemSettings);
  
  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [autoScale, setAutoScale] = useState(false);
  const availableTabs = useMemo<Tab[]>(
    () => (variant === 'quick' ? ['dashboard', 'duaLibrary'] : ['dashboard', 'schedule', 'settings', 'remoteControl', 'duaLibrary']),
    [variant]
  );

  useEffect(() => {
     const fetchZoom = async () => {
         if (window.electron && window.electron.zoom) {
             const current = await window.electron.zoom.get();
             setZoomLevel(current);
         }
     };
     fetchZoom();
  }, []);

  const handleZoomChange = useCallback(async (newZoom: number) => {
    const safeZoom = Math.min(Math.max(newZoom, 0.5), 3.0);
    const roundedZoom = parseFloat(safeZoom.toFixed(2));
    setZoomLevel(roundedZoom);
    setAutoScale(false);
    if (window.electron && window.electron.zoom) {
        await window.electron.zoom.set(roundedZoom);
    }
  }, []);

  const handleAutoScaleToggle = useCallback(async (checked: boolean) => {
     setAutoScale(checked);
     if (checked && window.electron && window.electron.zoom) {
         const smart = await window.electron.zoom.getSmartLevel();
         setZoomLevel(smart);
         await window.electron.zoom.set(smart);
     }
  }, []);
  
  // Helper to update specific nested setting
  const updateDuaBg = useCallback(async (duaKey: 'duaAhd' | 'duaSabah', file: File) => {
      const dataUrl = await fileToDataUrl(file);
      const newSettings = { ...currentPrayerSettings };
      if (!newSettings[duaKey]) newSettings[duaKey] = { backgroundImage: null };
      newSettings[duaKey] = { ...newSettings[duaKey], backgroundImage: dataUrl };
      onUpdatePrayerSettings(newSettings);
  }, [currentPrayerSettings, onUpdatePrayerSettings]);

  const updateRamadanDuaBackground = useCallback(async (file: File) => {
      const dataUrl = await fileToDataUrl(file);
      onUpdatePrayerSettings({
        ...currentPrayerSettings,
        ramadanDuas: {
          ...currentPrayerSettings.ramadanDuas,
          backgroundImage: dataUrl
        },
        ramadanDuaSystem: {
          ...currentPrayerSettings.ramadanDuaSystem,
          backgroundImage: dataUrl
        }
      });
  }, [currentPrayerSettings, onUpdatePrayerSettings]);

  const updateAnnouncementBackground = useCallback(async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    onUpdatePrayerSettings({
      ...currentPrayerSettings,
      announcement: {
        ...currentPrayerSettings.announcement,
        backgroundImage: dataUrl
      }
    });
  }, [currentPrayerSettings, onUpdatePrayerSettings]);

  const handleExit = useCallback(() => { setIsExiting(true); setTimeout(onBack, 400); }, [onBack]);

  const toggleAnnouncementPrayer = useCallback((prayerId: AnnouncementPrayerTrigger) => {
    const currentSelections = Array.isArray(currentPrayerSettings.announcement.triggerAfterPrayers)
      ? currentPrayerSettings.announcement.triggerAfterPrayers
      : [];
    const nextSelections = currentSelections.includes(prayerId)
      ? currentSelections.filter((item) => item !== prayerId)
      : ANNOUNCEMENT_PRAYER_OPTIONS
          .map((option) => option.id)
          .filter((item) => item === prayerId || currentSelections.includes(item));

    onUpdatePrayerSettings({
      ...currentPrayerSettings,
      announcement: {
        ...currentPrayerSettings.announcement,
        triggerAfterPrayers: nextSelections
      }
    });
  }, [currentPrayerSettings, onUpdatePrayerSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;

      if (['Escape', 'Backspace'].includes(event.code)) {
        event.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExit]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      void import('./TimetableManager');
      return;
    }

    if (activeTab === 'settings') {
      void import('./RamadanDuaSettingsPanel');
      return;
    }

    if (activeTab === 'duaLibrary') {
      void import('./RamadanDuaLibraryPanel');
    }
  }, [activeTab]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, availableTabs]);

  const handleTabSelect = useCallback((tab: Tab) => {
    startTransition(() => setActiveTab(tab));
  }, []);

  const quranReciters = useMemo(
    () => getQuranReciters(currentPrayerSettings.quran),
    [currentPrayerSettings.quran]
  );

  const selectedReciter = useMemo(
    () =>
      quranReciters.find((reciter) => reciter.id === currentPrayerSettings.quran.selectedReciterId) ||
      quranReciters[0] || {
        id: 'fallback',
        name: 'لا توجد تلاوات',
        description: '',
        tracks: []
      },
    [currentPrayerSettings.quran.selectedReciterId, quranReciters]
  );

  const uploadedQuranTracks = useMemo(
    () => Array.isArray(currentPrayerSettings.quran.uploadedTracks) ? currentPrayerSettings.quran.uploadedTracks : [],
    [currentPrayerSettings.quran.uploadedTracks]
  );

  const addExternalQuranTracks = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextTracks = Array.from(files)
      .map((file, index) => {
        const maybeElectronFile = file as File & { path?: string };
        const nativePath = typeof maybeElectronFile.path === 'string' ? maybeElectronFile.path.trim() : '';
        if (!nativePath) return null;

        const normalizedPath = nativePath.replace(/\\/g, '/');
        const encodedPath = encodeURI(normalizedPath).replace(/#/g, '%23');
        const title = file.name.replace(/\.[^/.]+$/, '').trim() || `تلاوة خارجية ${index + 1}`;
        const id = `uploaded_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;

        return {
          id,
          title,
          subtitle: 'ملف صوتي خارجي',
          audioSrc: `file:///${encodedPath}`
        };
      })
      .filter((track): track is NonNullable<typeof track> => Boolean(track));

    if (nextTracks.length <= 0) return;

    onUpdatePrayerSettings({
      ...currentPrayerSettings,
      quran: {
        ...currentPrayerSettings.quran,
        selectedReciterId: CUSTOM_QURAN_RECITER_ID,
        uploadedTracks: [...uploadedQuranTracks, ...nextTracks]
      }
    });
  }, [currentPrayerSettings, onUpdatePrayerSettings, uploadedQuranTracks]);

  const removeExternalQuranTrack = useCallback((trackId: string) => {
    if (!trackId) return;
    const nextUploadedTracks = uploadedQuranTracks.filter((track) => track.id !== trackId);
    const nextSelectedReciterId =
      currentPrayerSettings.quran.selectedReciterId === CUSTOM_QURAN_RECITER_ID && nextUploadedTracks.length === 0
        ? 'menshawy'
        : currentPrayerSettings.quran.selectedReciterId;

    onUpdatePrayerSettings({
      ...currentPrayerSettings,
      quran: {
        ...currentPrayerSettings.quran,
        selectedReciterId: nextSelectedReciterId,
        uploadedTracks: nextUploadedTracks
      }
    });
  }, [currentPrayerSettings, onUpdatePrayerSettings, uploadedQuranTracks]);

  const savedImamNames = useMemo(() => {
    if (!Array.isArray(currentMosqueInfo.savedImamNames)) return [];
    return currentMosqueInfo.savedImamNames
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);
  }, [currentMosqueInfo.savedImamNames]);

  const normalizedImamName = currentMosqueInfo.imamName.trim();
  const canSaveImamName = normalizedImamName.length > 0 && !savedImamNames.includes(normalizedImamName);

  const saveCurrentImamName = useCallback(() => {
    const nextName = currentMosqueInfo.imamName.trim();
    if (!nextName) return;
    const nextSavedNames = [nextName, ...savedImamNames.filter((name) => name !== nextName)].slice(0, 20);
    onUpdateMosqueInfo({
      ...currentMosqueInfo,
      imamName: nextName,
      savedImamNames: nextSavedNames
    });
  }, [currentMosqueInfo, onUpdateMosqueInfo, savedImamNames]);

  const applySavedImamName = useCallback((name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    onUpdateMosqueInfo({
      ...currentMosqueInfo,
      imamName: nextName
    });
  }, [currentMosqueInfo, onUpdateMosqueInfo]);

  const removeSavedImamName = useCallback((name: string) => {
    const nextSavedNames = savedImamNames.filter((item) => item !== name);
    const nextImamName = currentMosqueInfo.imamName === name ? '' : currentMosqueInfo.imamName;
    onUpdateMosqueInfo({
      ...currentMosqueInfo,
      imamName: nextImamName,
      savedImamNames: nextSavedNames
    });
  }, [currentMosqueInfo, onUpdateMosqueInfo, savedImamNames]);

  const currentTab: Tab = activeTab;
  const isDashboardTab = currentTab === 'dashboard';
  const isScheduleTab = currentTab === 'schedule';
  const isSettingsTab = currentTab === 'settings';
  const isRemoteControlTab = currentTab === 'remoteControl';
  const isDuaLibraryTab = currentTab === 'duaLibrary';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 animate-fade-in" dir="rtl">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={handleExit}></div>
        
        <div className={`relative w-full h-full ${variant === 'quick' ? 'max-w-[1120px]' : 'max-w-[1600px]'} rounded-[3rem] bg-slate-900/90 backdrop-blur-2xl border border-white/10 flex overflow-hidden shadow-2xl transition-all duration-500 transform ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
            <aside className={`${variant === 'quick' ? 'w-64' : 'w-72'} bg-black/20 border-l border-white/5 text-white flex flex-col shrink-0`}>
                <div className="h-32 flex flex-col items-center justify-center border-b border-white/5">
                    <h2 className="text-xl font-bold font-cairo">{variant === 'quick' ? 'الخدمات السريعة' : 'الإعدادات'}</h2>
                </div>
	                <nav className="flex-1 py-6 px-4">
	                    <ul className="space-y-1">
	                        <SidebarItem active={isDashboardTab} id="dashboard" icon="fa-solid fa-chart-pie" label={variant === 'quick' ? 'الإمام السريع' : 'الرئيسية'} onSelect={handleTabSelect} />
                          {variant === 'advanced' && (
                            <>
	                            <SidebarItem active={isScheduleTab} id="schedule" icon="fa-regular fa-calendar-days" label="جدول الصلاة" onSelect={handleTabSelect} />
	                            <SidebarItem active={isSettingsTab} id="settings" icon="fa-solid fa-brush" label="المظهر والعرض" onSelect={handleTabSelect} />
	                            <SidebarItem active={isRemoteControlTab} id="remoteControl" icon="fa-solid fa-mobile-screen-button" label="التحكم عن بعد" onSelect={handleTabSelect} />
                          </>
                          )}
	                        <SidebarItem active={isDuaLibraryTab} id="duaLibrary" icon="fa-solid fa-book-quran" label="مكتبة الأدعية" onSelect={handleTabSelect} />
	                    </ul>
	                </nav>
                <div className="p-4 border-t border-white/5"><button onClick={handleExit} className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold">{variant === 'quick' ? 'إغلاق' : 'حفظ وإغلاق'}</button></div>
            </aside>

            <main className="flex-1 overflow-y-auto p-8 lg:p-12 dashboard-scroll bg-transparent relative">
                {isDashboardTab && (
                  <>
                    {variant === 'quick' ? (
                      <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
                        <div className="rounded-[2.2rem] border border-gold-400/20 bg-gradient-to-br from-gold-500/10 via-white/5 to-white/5 p-7">
                          <div className="text-sm font-bold text-gold-100">وضع مبسّط داخل المسجد</div>
                          <div className="mt-3 text-3xl font-black text-white">الإمام والمكتبة فقط</div>
                          <div className="mt-3 text-sm leading-8 text-slate-300">
                            أبقينا هذه الصفحة خفيفة جدًا داخل شاشة المسجد حتى لا تضيع الخيارات على المستخدم. الإعدادات المتقدمة بالكامل موجودة قبل الدخول إلى التطبيق.
                          </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                          <h3 className="text-lg font-bold text-gray-200 mb-6">اسم الإمام</h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm text-gray-400 block mb-2">إمام الجماعة</label>
                              <input
                                type="text"
                                className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
                                value={currentMosqueInfo.imamName}
                                onChange={e => onUpdateMosqueInfo({...currentMosqueInfo, imamName: e.target.value})}
                                placeholder="اكتب اسم الإمام"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={saveCurrentImamName}
                                disabled={!canSaveImamName}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                                  canSaveImamName
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-white/10 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                حفظ الاسم الحالي
                              </button>
                              {savedImamNames.length > 0 && (
                                <select
                                  defaultValue=""
                                  className="flex-1 min-w-[170px] p-2 rounded-lg bg-black/20 border border-white/10 text-white outline-none"
                                  onChange={(event) => {
                                    const selectedName = event.target.value;
                                    if (selectedName) applySavedImamName(selectedName);
                                    event.target.value = '';
                                  }}
                                >
                                  <option value="">اختيار اسم محفوظ</option>
                                  {savedImamNames.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-lg font-black text-white">مكتبة الأدعية</div>
                              <div className="mt-2 text-sm leading-7 text-cyan-100/85">
                                لإضافة أو ترتيب الأدعية انتقل إلى تبويب مكتبة الأدعية من القائمة الجانبية.
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTabSelect('duaLibrary')}
                              className="rounded-2xl border border-cyan-300/30 bg-white/10 px-4 py-3 text-sm font-black text-white"
                            >
                              فتح المكتبة
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-gray-200 mb-6">البيانات الأساسية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">اسم المسجد</label>
                                    <input type="text" className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none" value={currentMosqueInfo.name} onChange={e => onUpdateMosqueInfo({...currentMosqueInfo, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">إمام الجماعة</label>
                                    <input
                                      type="text"
                                      className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
                                      value={currentMosqueInfo.imamName}
                                      onChange={e => onUpdateMosqueInfo({...currentMosqueInfo, imamName: e.target.value})}
                                      placeholder="اكتب اسم الإمام"
                                    />
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={saveCurrentImamName}
                                        disabled={!canSaveImamName}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                                          canSaveImamName
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            : 'bg-white/10 text-gray-400 cursor-not-allowed'
                                        }`}
                                      >
                                        حفظ الاسم الحالي
                                      </button>
                                      {savedImamNames.length > 0 && (
                                        <select
                                          defaultValue=""
                                          className="flex-1 min-w-[170px] p-2 rounded-lg bg-black/20 border border-white/10 text-white outline-none"
                                          onChange={(event) => {
                                            const selectedName = event.target.value;
                                            if (selectedName) applySavedImamName(selectedName);
                                            event.target.value = '';
                                          }}
                                        >
                                          <option value="">اختيار اسم محفوظ</option>
                                          {savedImamNames.map((name) => (
                                            <option key={name} value={name}>
                                              {name}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                    {savedImamNames.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {savedImamNames.map((name) => (
                                          <div key={name} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                            <button
                                              type="button"
                                              onClick={() => applySavedImamName(name)}
                                              className="text-xs text-gray-200 hover:text-white"
                                            >
                                              {name}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => removeSavedImamName(name)}
                                              className="h-5 w-5 rounded-full bg-red-600/80 text-[10px] text-white hover:bg-red-500"
                                              aria-label={`حذف ${name}`}
                                              title="حذف"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-gray-200 mb-6">ضبط التاريخ</h3>
                             <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl">
                                  <label className="text-sm text-gray-400">تعديل التاريخ الهجري (بالأيام)</label>
                                  <div className="flex items-center gap-3">
                                      <button onClick={() => onUpdateHijriOffset?.((currentHijriOffset || 0) - 1)} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white">-</button>
                                      <span className="font-bold text-xl text-gold-400 w-8 text-center">{currentHijriOffset}</span>
                                      <button onClick={() => onUpdateHijriOffset?.((currentHijriOffset || 0) + 1)} className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white">+</button>
                                  </div>
                             </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-gray-200 mb-6">المناسبات والألوان</h3>
                            <div className="space-y-4">
                                <label className="text-sm text-gray-400 block">وصف المناسبة</label>
                                <textarea className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none" rows={2} value={currentOccasion.description} onChange={e => onUpdateOccasion({...currentOccasion, description: e.target.value})} />
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">لون الخط</label>
                                        <input type="color" className="w-full h-12 bg-transparent rounded-lg cursor-pointer" value={currentOccasion.descriptionColor || '#fef3c6'} onChange={e => onUpdateOccasion({...currentOccasion, descriptionColor: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">لون الإطار</label>
                                        <input type="color" className="w-full h-12 bg-transparent rounded-lg cursor-pointer" value={currentOccasion.borderColor || '#d4ac0d'} onChange={e => onUpdateOccasion({...currentOccasion, borderColor: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">لون الخلفية</label>
                                        <input type="color" className="w-full h-12 bg-transparent rounded-lg cursor-pointer" value={currentOccasion.backgroundColor || '#eca315'} onChange={e => onUpdateOccasion({...currentOccasion, backgroundColor: e.target.value})} />
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between bg-gradient-to-r from-white/5 to-white/0 p-4 rounded-2xl border border-white/5 mt-6 transition-all hover:bg-white/5">
                                    <div className="flex items-center gap-3">
                                       <div className={`p-3 rounded-full transition-colors duration-500 ${currentOccasion.show ? 'bg-gold-500/20 text-gold-400 shadow-[0_0_15px_rgba(236,163,21,0.3)]' : 'bg-white/5 text-gray-500'}`}>
                                          <i className="fa-solid fa-calendar-star text-lg"></i>
                                       </div>
                                       <div className="flex flex-col">
                                           <span className={`font-bold transition-colors duration-300 ${currentOccasion.show ? 'text-white' : 'text-gray-400'}`}>إظهار شريط المناسبة</span>
                                           <span className="text-xs text-gray-500">عرض الشريط في الشاشة الرئيسية</span>
                                       </div>
                                    </div>

                                    <label className="relative inline-flex items-center cursor-pointer group" dir="ltr">
                                        <input type="checkbox" className="sr-only peer" checked={currentOccasion.show} onChange={e => onUpdateOccasion({...currentOccasion, show: e.target.checked})} />
                                        <div className={`w-[4.5rem] h-9 rounded-full peer transition-all duration-500 border border-white/10 backdrop-blur-md shadow-inner ${currentOccasion.show ? 'bg-gradient-to-r from-gold-500 to-gold-400 border-gold-400/50' : 'bg-black/30'}`}></div>
                                        <div className={`absolute top-1 left-1 bg-white border-gray-100 h-7 w-7 rounded-full shadow transition-all duration-500 flex items-center justify-center ${currentOccasion.show ? 'translate-x-[2.75rem]' : 'translate-x-0'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${currentOccasion.show ? 'bg-gold-500' : 'bg-gray-300'}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <h3 className="text-lg font-bold text-gray-200">صفحة الإعلانات</h3>
                                {onPreviewAnnouncement && (
                                  <button
                                    type="button"
                                    onClick={onPreviewAnnouncement}
                                    className="px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-300/30 text-amber-100 font-bold hover:bg-amber-500/30"
                                  >
                                    عرض الإعلان الآن
                                  </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-gradient-to-r from-white/5 to-white/0 p-4 rounded-2xl border border-white/5">
                                    <span className="font-bold text-white">تفعيل صفحة الإعلانات</span>
                                    <label className="relative inline-flex items-center cursor-pointer" dir="ltr">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={currentPrayerSettings.announcement.enabled}
                                          onChange={(e) => onUpdatePrayerSettings({
                                            ...currentPrayerSettings,
                                            announcement: {
                                              ...currentPrayerSettings.announcement,
                                              enabled: e.target.checked
                                            }
                                          })}
                                        />
                                        <div className={`w-[4.5rem] h-9 rounded-full peer transition-all duration-500 border border-white/10 ${currentPrayerSettings.announcement.enabled ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-black/30'}`}></div>
                                        <div className={`absolute top-1 left-1 bg-white h-7 w-7 rounded-full shadow transition-all duration-500 ${currentPrayerSettings.announcement.enabled ? 'translate-x-[2.75rem]' : 'translate-x-0'}`}></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">عنوان الإعلان</label>
                                    <input
                                      type="text"
                                      className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
                                      value={currentPrayerSettings.announcement.title}
                                      onChange={(e) => onUpdatePrayerSettings({
                                        ...currentPrayerSettings,
                                        announcement: {
                                          ...currentPrayerSettings.announcement,
                                          title: e.target.value
                                        }
                                      })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-gray-400 block mb-2">نص الإعلان</label>
                                    <textarea
                                      rows={5}
                                      className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
                                      value={currentPrayerSettings.announcement.body}
                                      onChange={(e) => onUpdatePrayerSettings({
                                        ...currentPrayerSettings,
                                        announcement: {
                                          ...currentPrayerSettings.announcement,
                                          body: e.target.value
                                        }
                                      })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">مدة الظهور (بالثواني)</label>
                                        <input
                                          type="number"
                                          min={5}
                                          max={600}
                                          className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
                                          value={currentPrayerSettings.announcement.durationSec}
                                          onChange={(e) => {
                                            const raw = Number(e.target.value);
                                            const durationSec = Math.max(5, Math.min(600, Number.isFinite(raw) ? Math.round(raw) : 30));
                                            onUpdatePrayerSettings({
                                              ...currentPrayerSettings,
                                              announcement: {
                                                ...currentPrayerSettings.announcement,
                                                durationSec
                                              }
                                            });
                                          }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-400 block mb-2">لون الهوية</label>
                                        <input
                                          type="color"
                                          className="w-full h-12 bg-transparent rounded-lg cursor-pointer"
                                          value={currentPrayerSettings.announcement.accentColor}
                                          onChange={(e) => onUpdatePrayerSettings({
                                            ...currentPrayerSettings,
                                            announcement: {
                                              ...currentPrayerSettings.announcement,
                                              accentColor: e.target.value
                                            }
                                          })}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between gap-4 mb-2">
                                          <label className="text-sm text-gray-400 block">أوقات الظهور التلقائي</label>
                                          <button
                                            type="button"
                                            onClick={() => onUpdatePrayerSettings({
                                              ...currentPrayerSettings,
                                              announcement: {
                                                ...currentPrayerSettings.announcement,
                                                triggerAfterPrayers: []
                                              }
                                            })}
                                            className="text-xs font-bold text-amber-300 hover:text-amber-200 transition-colors"
                                          >
                                            مسح الاختيار
                                          </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-4">اختر صلاة واحدة أو أكثر ليظهر الإعلان بعدها تلقائيًا.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                          {ANNOUNCEMENT_PRAYER_OPTIONS.map((option) => {
                                            const active = currentPrayerSettings.announcement.triggerAfterPrayers.includes(option.id);
                                            return (
                                              <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => toggleAnnouncementPrayer(option.id)}
                                                className={`rounded-2xl border px-4 py-4 text-right transition-all duration-300 ${
                                                  active
                                                    ? 'border-amber-300/60 bg-amber-400/15 shadow-[0_16px_40px_rgba(245,158,11,0.12)]'
                                                    : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-3">
                                                  <span className={`text-sm font-black ${active ? 'text-amber-100' : 'text-white'}`}>
                                                    {option.label}
                                                  </span>
                                                  <span className={`text-[0.68rem] px-2 py-1 rounded-full border ${
                                                    active
                                                      ? 'text-amber-200 border-amber-300/40 bg-amber-500/10'
                                                      : 'text-gray-400 border-white/10 bg-white/5'
                                                  }`}>
                                                    {active ? 'مفعل' : 'متوقف'}
                                                  </span>
                                                </div>
                                                <div className={`mt-2 text-xs ${active ? 'text-amber-200/90' : 'text-gray-500'}`}>
                                                  {option.helper}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = (event: Event) => {
                                          const file = (event.target as HTMLInputElement)?.files?.[0];
                                          if (file) {
                                            void updateAnnouncementBackground(file);
                                          }
                                        };
                                        input.click();
                                      }}
                                      className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2"
                                    >
                                      <i className="fa-solid fa-image"></i>
                                      رفع خلفية الإعلان
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onUpdatePrayerSettings({
                                        ...currentPrayerSettings,
                                        announcement: {
                                          ...currentPrayerSettings.announcement,
                                          backgroundImage: null
                                        }
                                      })}
                                      className="p-4 bg-red-900/20 border border-red-400/20 rounded-2xl text-red-200 hover:bg-red-900/35 flex items-center justify-center gap-2"
                                    >
                                      <i className="fa-solid fa-trash"></i>
                                      إزالة الخلفية
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

	                {isScheduleTab && (
	                    <Suspense fallback={<DashboardPanelFallback label="جاري تحميل جدول الصلاة..." />}>
	                      <div className="h-full">
	                         <TimetableManager 
	                            schedule={currentMonthlySchedule || { monthName: '', days: [], lastUpdated: 0 }} 
	                            onUpdate={onUpdateMonthlySchedule} 
	                            hijriOffset={currentHijriOffset}
	                            onApplyDay={onApplyDay}
	                         />
	                      </div>
	                    </Suspense>
	                )}

                {isSettingsTab && (
                    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                        {/* Zoom Control */}
                        <div className="bg-gradient-to-br from-white/10 to-white/5 p-8 rounded-[2rem] border border-white/10 shadow-lg relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-full blur-[50px]"></div>
                           <div className="flex items-center gap-4 mb-8">
                              <div className="w-12 h-12 rounded-xl bg-gold-500 flex items-center justify-center text-black text-xl shadow-lg"><i className="fa-solid fa-expand"></i></div>
                              <div>
                                 <h3 className="text-2xl font-bold text-white">التحكم في حجم العرض (Zoom)</h3>
                                 <p className="text-gray-400 text-sm">تكبير حقيقي للعناصر والنصوص (Native Browser Zoom)</p>
                              </div>
                           </div>
                           <div className="flex flex-col gap-6">
                              <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                 <div className="flex items-center gap-3">
                                     <i className="fa-solid fa-wand-magic-sparkles text-purple-400"></i>
                                     <div>
                                        <span className="text-white font-bold block">الضبط التلقائي الذكي (Smart Scaling)</span>
                                        <span className="text-xs text-gray-500">يتعرف على حجم الشاشة (TV, Laptop, Tablet) ويضبط الزوم</span>
                                     </div>
                                 </div>
                                 <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={autoScale} onChange={(e) => handleAutoScaleToggle(e.target.checked)} />
                                    <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gold-500"></div>
                                 </label>
                              </div>
                              <div className={`transition-all duration-300 ${autoScale ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                                  <div className="flex items-center justify-between mb-4">
                                      <span className="text-gray-300 font-bold">مستوى التكبير: {Math.round(zoomLevel * 100)}%</span>
                                      <button onClick={() => handleZoomChange(1.0)} className="text-xs text-gold-400 hover:text-white border border-gold-500/30 px-3 py-1 rounded-full">إعادة ضبط (100%)</button>
                                  </div>
                                  <input type="range" min="0.5" max="2.0" step="0.05" value={zoomLevel} onChange={(e) => handleZoomChange(parseFloat(e.target.value))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gold-500 hover:accent-gold-400" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono"><span>50%</span><span>100%</span><span>150%</span><span>200%</span></div>
                              </div>
                           </div>
                        </div>

                        {/* Background Settings */}
                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                            <h3 className="text-lg font-bold text-gray-200 mb-6">الخلفية الرئيسية</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-sm text-gray-400 block">رفع صورة من الجهاز</label>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && onUploadBackground(e.target.files[0])} />
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full p-4 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-500">اختر صورة</button>
                                    <label className="text-sm text-gray-400 block mt-4">أو رابط مباشر</label>
                                    <input type="text" className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white" value={currentBackgroundImage || ''} onChange={e => onUpdateBackgroundUrl(e.target.value)} />
                                </div>
                                <div className="space-y-4">
                                     <label className="text-sm text-gray-400 block">لون الخلفية (في حال عدم وجود صورة)</label>
                                     <input type="color" className="w-full h-12 bg-transparent rounded-lg cursor-pointer" value={currentHomeBackgroundColor} onChange={e => onUpdateHomeBackgroundColor(e.target.value)} />
                                     <label className="text-sm text-gray-400 block mt-4">شفافية التغطية (Overlay)</label>
                                     <input type="range" min="0" max="1" step="0.1" className="w-full" value={currentHomeOverlayOpacity} onChange={e => onUpdateHomeOverlayOpacity?.(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* Other Screens Backgrounds */}
	                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
	                            <h3 className="text-lg font-bold text-gray-200 mb-6">خلفيات الشاشات</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) onUploadAdhanBackground(file); }; f.click(); }} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2"><i className="fa-solid fa-mosque"></i> خلفية الأذان</button>
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) onUploadPrayerBackground(file); }; f.click(); }} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2"><i className="fa-solid fa-person-praying"></i> خلفية الصلاة</button>
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) onUploadTasbeehBackground(file); }; f.click(); }} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2"><i className="fa-solid fa-fingerprint"></i> خلفية التسبيح</button>
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) onUploadQuranVerseBackground(file); }; f.click(); }} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 hover:bg-white/10 flex items-center justify-center gap-2"><i className="fa-solid fa-book-quran"></i> خلفية الآية الشريفة</button>
                            </div>
                        </div>
                        
                        {/* New: Custom Dua Backgrounds */}
	                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
	                            <h3 className="text-lg font-bold text-gray-200 mb-6">خلفيات الأدعية الخاصة</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) updateDuaBg('duaAhd', file); }; f.click(); }} className="p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-2xl text-indigo-200 hover:bg-indigo-900/40 flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-sun"></i> خلفية دعاء العهد
                                </button>
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) updateDuaBg('duaSabah', file); }; f.click(); }} className="p-4 bg-sky-900/20 border border-sky-500/20 rounded-2xl text-sky-200 hover:bg-sky-900/40 flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-cloud-sun"></i> خلفية دعاء الصباح
                                </button>
                                <button onClick={() => { const f = document.createElement('input'); f.type='file'; f.onchange=(e:any)=>{ const file = e?.target?.files?.[0]; if (file) updateRamadanDuaBackground(file); }; f.click(); }} className="p-4 bg-gold-900/20 border border-gold-500/20 rounded-2xl text-gold-200 hover:bg-gold-900/40 flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-moon"></i> خلفية أدعية رمضان
                                </button>
                            </div>
	                        </div>

		                        <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
		                            <div className="flex flex-col gap-6">
		                                <div className="flex items-center justify-between gap-4">
		                                    <div>
		                                        <h3 className="text-lg font-bold text-gray-200">وضع القرآن الصوتي</h3>
		                                        <p className="text-sm text-gray-400 mt-1">يمكنك تشغيله أو إيقافه بالكامل حتى لا يعمل تلقائياً داخل تسلسل الصلوات</p>
		                                    </div>
		                                    {onPreviewQuranMode && (
		                                      <button onClick={onPreviewQuranMode} className="px-4 py-2 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 font-bold hover:bg-cyan-500/30">
		                                        معاينة وضع القرآن
		                                      </button>
		                                    )}
		                                </div>

                                <div className="flex items-center justify-between bg-gradient-to-r from-white/5 to-white/0 p-4 rounded-2xl border border-white/5 transition-all hover:bg-white/5">
                                    <div className="flex items-center gap-3">
                                       <div className={`p-3 rounded-full transition-colors duration-500 ${currentPrayerSettings.quran.enabled ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]' : 'bg-white/5 text-gray-500'}`}>
                                          <i className="fa-solid fa-volume-high text-lg"></i>
                                       </div>
                                       <div className="flex flex-col">
                                           <span className={`font-bold transition-colors duration-300 ${currentPrayerSettings.quran.enabled ? 'text-white' : 'text-gray-400'}`}>تفعيل وضع القرآن</span>
                                           <span className="text-xs text-gray-500">عند الإيقاف لن يعمل القرآن تلقائياً بعد التسبيح</span>
                                       </div>
                                    </div>

                                    <label className="relative inline-flex items-center cursor-pointer group" dir="ltr">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={currentPrayerSettings.quran.enabled}
                                          onChange={e => onUpdatePrayerSettings({
                                            ...currentPrayerSettings,
                                            quran: {
                                              ...currentPrayerSettings.quran,
                                              enabled: e.target.checked
                                            }
                                          })}
                                        />
                                        <div className={`w-[4.5rem] h-9 rounded-full peer transition-all duration-500 border border-white/10 backdrop-blur-md shadow-inner ${currentPrayerSettings.quran.enabled ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 border-cyan-400/50' : 'bg-black/30'}`}></div>
                                        <div className={`absolute top-1 left-1 bg-white border-gray-100 h-7 w-7 rounded-full shadow transition-all duration-500 flex items-center justify-center ${currentPrayerSettings.quran.enabled ? 'translate-x-[2.75rem]' : 'translate-x-0'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${currentPrayerSettings.quran.enabled ? 'bg-cyan-500' : 'bg-gray-300'}`}></div>
                                        </div>
                                    </label>
                                </div>

		                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
		                                    <div>
		                                        <label className="text-sm text-gray-400 block mb-2">القارئ الحالي</label>
	                                        <select
	                                          className="w-full p-4 bg-black/20 rounded-xl border border-white/10 text-white outline-none"
	                                          value={currentPrayerSettings.quran.selectedReciterId}
	                                          onChange={(e) => onUpdatePrayerSettings({
	                                            ...currentPrayerSettings,
	                                            quran: {
	                                              ...currentPrayerSettings.quran,
	                                              selectedReciterId: e.target.value
	                                            }
	                                          })}
	                                        >
	                                          {quranReciters.map((reciter) => (
	                                            <option key={reciter.id} value={reciter.id}>
	                                              {reciter.name}
	                                            </option>
	                                          ))}
	                                        </select>
	                                    </div>

	                                    <div>
	                                        <label className="text-sm text-gray-400 block mb-2">مستوى الصوت</label>
	                                        <input
	                                          type="range"
	                                          min="0.2"
	                                          max="1"
	                                          step="0.05"
	                                          className="w-full"
	                                          value={currentPrayerSettings.quran.volume}
	                                          onChange={(e) => onUpdatePrayerSettings({
	                                            ...currentPrayerSettings,
	                                            quran: {
	                                              ...currentPrayerSettings.quran,
	                                              volume: Number(e.target.value)
	                                            }
	                                          })}
	                                        />
	                                        <div className="mt-2 text-sm text-gold-300">{Math.round(currentPrayerSettings.quran.volume * 100)}%</div>
	                                    </div>
	                                </div>

	                                <div className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-4">
	                                    <div className="text-sm font-bold text-white">التلاوات المتاحة لهذا القارئ</div>
	                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
		                                        {selectedReciter.tracks.map((track) => (
		                                          <div key={track.id} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
		                                            <div className="flex items-start justify-between gap-3">
		                                              <div>
		                                                <div className="text-white font-bold">{track.title}</div>
		                                                <div className="text-xs text-gray-400 mt-1">{track.subtitle}</div>
		                                              </div>
		                                              {selectedReciter.id === CUSTOM_QURAN_RECITER_ID && (
		                                                <button
		                                                  type="button"
		                                                  onClick={() => removeExternalQuranTrack(track.id)}
		                                                  className="shrink-0 px-2 py-1 rounded-lg bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold"
		                                                >
		                                                  حذف
		                                                </button>
		                                              )}
		                                            </div>
	                                          </div>
	                                        ))}
	                                    </div>
	                                    <div className="pt-3 border-t border-white/10">
	                                      <div className="text-sm text-gray-300 mb-3">إضافة تلاوات من خارج التطبيق</div>
	                                      <div className="flex flex-wrap items-center gap-3">
	                                        <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
	                                          إضافة ملفات صوتية
	                                          <input
	                                            type="file"
	                                            className="hidden"
	                                            accept="audio/*,.mp3,.wav,.m4a,.ogg"
	                                            multiple
	                                            onChange={(event) => {
	                                              addExternalQuranTracks(event.target.files);
	                                              event.target.value = '';
	                                            }}
	                                          />
	                                        </label>
	                                        <span className="text-xs text-gray-400">
	                                          الملفات المضافة: {uploadedQuranTracks.length}
	                                        </span>
	                                      </div>
	                                      <p className="text-xs text-gray-500 mt-2">
	                                        يدعم رفع MP3 / WAV / M4A / OGG، وبعد الإضافة يظهر قارئ جديد باسم "تلاوات مضافة".
	                                      </p>
	                                    </div>
	                                </div>
	                            </div>
	                        </div>

	                        <Suspense fallback={<DashboardPanelFallback label="جاري تحميل إعدادات الأدعية..." />}>
	                          <RamadanDuaSettingsPanel
	                            value={deferredRamadanDuaSystem}
	                            onChange={(ramadanDuaSystem) => onUpdatePrayerSettings({ ...currentPrayerSettings, ramadanDuaSystem })}
	                            onPreview={(duaId) => onPreviewRamadanDua?.(duaId)}
	                            onOpenLibrary={() => handleTabSelect('duaLibrary')}
	                          />
	                        </Suspense>

                    </div>
                    )}
                  </>
                )}

	                {isRemoteControlTab && (
	                    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
	                        <div className="bg-gradient-to-br from-cyan-600/20 via-slate-900/70 to-slate-900/80 p-8 rounded-[2rem] border border-cyan-300/20 shadow-[0_20px_70px_rgba(14,116,144,0.2)]">
	                            <div className="flex items-start justify-between gap-6 mb-6">
	                                <div>
	                                    <h3 className="text-2xl font-bold text-white">التحكم عن بعد</h3>
	                                    <p className="text-cyan-100/80 text-sm mt-2">ربط الجوال للتحكم بالتطبيق (التنقل، تغيير الوضع، وتشغيل القرآن).</p>
	                                </div>
	                                <div className={`rounded-full px-4 py-2 text-xs font-black tracking-[0.2em] ${remoteControlStatus?.running ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-300/30' : 'bg-red-500/20 text-red-200 border border-red-300/30'}`}>
	                                    {remoteControlStatus?.running ? 'ONLINE' : 'OFFLINE'}
	                                </div>
	                            </div>

	                            {remoteControlStatus?.running ? (
	                                <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-6 items-start">
	                                    <div className="rounded-2xl border border-white/15 bg-white p-3 flex items-center justify-center min-h-[220px]">
	                                        {remoteControlStatus.qrCodeDataUrl ? (
	                                            <img
	                                              src={remoteControlStatus.qrCodeDataUrl}
	                                              alt="QR للتحكم عن بعد"
	                                              className="w-full max-w-[190px] rounded-xl"
	                                            />
	                                        ) : (
	                                            <div className="text-slate-500 text-sm font-bold">QR</div>
	                                        )}
	                                    </div>
	                                    <div className="space-y-4">
	                                        <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
	                                            <div className="text-xs text-cyan-100/70 mb-1">رابط الجوال</div>
	                                            <div className="font-mono text-sm text-white break-all">{remoteControlStatus.url}</div>
	                                        </div>
	                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
	                                            <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
	                                                <div className="text-xs text-cyan-100/70 mb-1">PIN</div>
	                                                <div className="text-2xl font-black tracking-[0.28em] text-amber-200">{remoteControlStatus.pin}</div>
	                                            </div>
	                                            <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
	                                                <div className="text-xs text-cyan-100/70 mb-1">الأجهزة المتصلة</div>
	                                                <div className="text-2xl font-black text-cyan-100">{remoteControlStatus.clientCount}</div>
	                                            </div>
	                                        </div>
	                                        <div className="rounded-2xl bg-black/20 border border-white/10 p-4 text-sm text-cyan-50/90">
	                                            تأكد أن الجوال والتطبيق على نفس شبكة الـ Wi-Fi ثم امسح الـ QR وأدخل رمز PIN.
	                                        </div>
	                                    </div>
	                                </div>
	                            ) : (
	                                <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-gray-200">
	                                    خدمة التحكم عن بعد غير متاحة حاليًا. أعد تشغيل التطبيق ثم افتح هذه الصفحة مرة أخرى.
	                                </div>
	                            )}
	                        </div>
	                    </div>
	                )}

	                {isDuaLibraryTab && (
	                    <div className="space-y-8">
	                        <Suspense fallback={<DashboardPanelFallback label="جاري تحميل مكتبة الأدعية..." />}>
	                          <RamadanDuaLibraryPanel
	                            value={deferredRamadanDuaSystem}
	                            onChange={(ramadanDuaSystem) => onUpdatePrayerSettings({ ...currentPrayerSettings, ramadanDuaSystem })}
	                            onPreview={(duaId) => onPreviewRamadanDua?.(duaId)}
	                          />
	                        </Suspense>
	                    </div>
	                )}
            </main>
        </div>
    </div>
  );
};

export default memo(Dashboard);


