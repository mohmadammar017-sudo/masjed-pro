(() => {
  const $ = (id) => document.getElementById(id);
  const MODE_ORDER = ['PRAYER', 'DUA', 'QURAN'];
  const PAGE_IDS = { PRAYER: 'pagePrayer', DUA: 'pageDua', QURAN: 'pageQuran' };
  const EDITABLE_PRAYER_IDS = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'maghrib', 'end_isha'];
  const SLOT_OPTIONS = [
    ['general', 'عام'],
    ['before_fajr', 'قبل الفجر'],
    ['before_dhuhr', 'قبل الظهر'],
    ['before_maghrib', 'قبل المغرب'],
    ['after_fajr', 'بعد الفجر'],
    ['after_dhuhr', 'بعد الظهر'],
    ['after_asr', 'بعد العصر'],
    ['after_maghrib', 'بعد المغرب'],
    ['after_isha', 'بعد العشاء']
  ];

  let token = '';
  let socket = null;
  let state = null;
  let pollTimer = null;
  let activeMode = 'QURAN';
  let activeView = 'mode'; // mode | settings
  let activeQuranFilter = 'surahs';
  let quranSearchQuery = '';
  let activeDuaFilter = 'active';
  let duaSearchQuery = '';
  let selectedPrayerId = 'imsak';
  let activePrayerWheelDrag = null;

  const QURAN_FAVORITES_KEY = 'masjid-display-quran-favorites';
  const QURAN_RECENTS_KEY = 'masjid-display-quran-recents';
  const SLOT_LABEL_MAP = new Map(SLOT_OPTIONS);
  const PRAYER_WHEEL_DRAG_STEP_PX = 18;
  const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const PRAYER_META = {
    imsak: { icon: 'bedtime', description: 'اضبط وقت الإمساك كما يظهر في الجدول المعتمد داخل التطبيق.' },
    fajr: { icon: 'dark_mode', description: 'سيتم اعتماد هذا الوقت كبداية لصلاة الفجر ويمكنك تعديل الساعة أو الدقيقة مباشرة.' },
    sunrise: { icon: 'light_mode', description: 'هذا هو وقت الشروق الظاهر في التطبيق ويمكن تعديله من هنا.' },
    dhuhr: { icon: 'sunny', description: 'اضبط وقت الظهر المعتمد في الجدول الرئيسي للتطبيق.' },
    asr: { icon: 'wb_twilight', description: 'عدل توقيت صلاة العصر مع تحديث مباشر في التطبيق.' },
    maghrib: { icon: 'wb_sunny', description: 'اختر وقت المغرب كما تريد ظهوره على شاشة المسجد.' },
    isha: { icon: 'nights_stay', description: 'يمكنك اعتماد وقت العشاء النهائي من هذا القسم.' },
    end_isha: { icon: 'hourglass_bottom', description: 'هذا هو توقيت نهاية العشائين المعتمد في التطبيق.' }
  };

  const modeButtons = {
    PRAYER: $('modePrayerBtn'),
    DUA: $('modeDuaBtn'),
    QURAN: $('modeQuranBtn')
  };

  const arabicNumberFormatter = new Intl.NumberFormat('ar-EG');

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  const toArabicNumber = (value) => arabicNumberFormatter.format(Number(value) || 0);
  const getSlotLabel = (slotId) => SLOT_LABEL_MAP.get(slotId) || slotId;
  const toArabicDigitsString = (value) => String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)] || digit);
  const toArabicPadded = (value) => toArabicDigitsString(String(Math.max(0, Number(value) || 0)).padStart(2, '0'));
  const wrapValue = (value, size) => ((value % size) + size) % size;
  const clampDuaFontScale = (value) => Math.max(0.8, Math.min(1.8, Math.round(Number(value) * 100) / 100));
  const clampAppZoom = (value) => Math.max(0.5, Math.min(2.0, Math.round(Number(value) * 100) / 100));
  const formatZoomPercent = (value) => `${toArabicNumber(Math.round(clampAppZoom(value) * 100))}%`;

  const loadStoredList = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch (_) {
      return [];
    }
  };

  const saveStoredList = (key, values) => {
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch (_) {}
  };

  const getFavoriteTrackKeys = () => new Set(loadStoredList(QURAN_FAVORITES_KEY));
  const getRecentTrackKeys = () => loadStoredList(QURAN_RECENTS_KEY);
  const trackStorageKey = (reciterId, trackId) => `${reciterId}:${trackId}`;

  const rememberRecentTrack = (reciterId, trackId) => {
    if (!reciterId || !trackId) return;
    const key = trackStorageKey(reciterId, trackId);
    const next = [key, ...getRecentTrackKeys().filter((item) => item !== key)].slice(0, 20);
    saveStoredList(QURAN_RECENTS_KEY, next);
  };

  const toggleFavoriteTrack = (reciterId, trackId) => {
    if (!reciterId || !trackId) return false;
    const key = trackStorageKey(reciterId, trackId);
    const favorites = loadStoredList(QURAN_FAVORITES_KEY);
    const isFavorite = favorites.includes(key);
    const next = isFavorite ? favorites.filter((item) => item !== key) : [key, ...favorites].slice(0, 40);
    saveStoredList(QURAN_FAVORITES_KEY, next);
    return !isFavorite;
  };

  const getSelectedQuranContext = () => {
    const quran = state?.quran;
    if (!quran) return null;

    const reciters = Array.isArray(quran.reciters) ? quran.reciters : [];
    const selectedReciter = reciters.find((item) => item.id === quran.selectedReciterId) || reciters[0] || null;
    const tracks = Array.isArray(selectedReciter?.tracks) ? selectedReciter.tracks : [];
    const selectedTrackIndex = Number.isFinite(Number(quran.trackIndex)) ? Number(quran.trackIndex) : 0;
    const safeTrackIndex = Math.max(0, Math.min(tracks.length - 1, selectedTrackIndex));
    const currentTrack = tracks[safeTrackIndex] || null;

    return {
      quran,
      reciters,
      selectedReciter,
      tracks,
      selectedTrackIndex: safeTrackIndex,
      currentTrack
    };
  };

  const getEditablePrayers = () => EDITABLE_PRAYER_IDS.map((id) => findPrayerById(id)).filter(Boolean);

  const getSelectedPrayerContext = () => {
    const prayers = getEditablePrayers();
    if (!prayers.length) return null;
    if (!prayers.some((prayer) => prayer.id === selectedPrayerId)) {
      selectedPrayerId = prayers[0].id;
    }
    const selectedIndex = Math.max(0, prayers.findIndex((prayer) => prayer.id === selectedPrayerId));
    return {
      prayers,
      selectedIndex,
      selectedPrayer: prayers[selectedIndex]
    };
  };

  const parsePrayerTimeParts = (time) => {
    const minutes = toMinutes(time);
    if (minutes === null) return { hour: 0, minute: 0 };
    return {
      hour: Math.floor(minutes / 60),
      minute: minutes % 60
    };
  };

  const formatPrayerCardTime = (time) => {
    const minutes = toMinutes(time);
    if (minutes === null) return '--:--';
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const period = hour24 >= 12 ? 'م' : 'ص';
    const hour12 = hour24 % 12 || 12;
    return `${toArabicPadded(hour12)}:${toArabicPadded(minute)} ${period}`;
  };

  const setPrayerTimeLocally = (prayerId, nextTime) => {
    if (!state?.schedule) return;
    state = {
      ...state,
      schedule: state.schedule.map((prayer) => (prayer.id === prayerId ? { ...prayer, time: nextTime } : prayer))
    };
  };

  const commitPrayerTime = (prayerId, nextTime) => {
    setPrayerTimeLocally(prayerId, nextTime);
    renderPrayer();
    renderSettings();
    emitCommand('SET_PRAYER_TIME', { prayerId, time: nextTime });
  };

  const buildPrayerTime = (hour, minute) =>
    `${String(wrapValue(hour, 24)).padStart(2, '0')}:${String(wrapValue(minute, 60)).padStart(2, '0')}`;

  const stopPrayerWheelDrag = () => {
    if (!activePrayerWheelDrag) return;

    const { container, pointerId, moveHandler, endHandler } = activePrayerWheelDrag;
    document.removeEventListener('pointermove', moveHandler);
    document.removeEventListener('pointerup', endHandler);
    document.removeEventListener('pointercancel', endHandler);

    if (container) {
      container.classList.remove('cursor-grabbing', 'scale-[0.99]');
      container.classList.add('cursor-grab');
      if (typeof container.releasePointerCapture === 'function' && pointerId !== undefined && pointerId !== null) {
        try {
          container.releasePointerCapture(pointerId);
        } catch (_) {}
      }
    }

    activePrayerWheelDrag = null;
  };

  const renderPrayerWheel = (container, selectedValue, moduloBase, onSelect) => {
    if (!container) return;
    stopPrayerWheelDrag();
    container.innerHTML = '';
    container.classList.add('cursor-grab');
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';

    [-2, -1, 0, 1, 2].forEach((offset) => {
      const value = wrapValue(selectedValue + offset, moduloBase);
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        offset === 0
          ? 'py-1 text-2xl font-black text-primary transition'
          : Math.abs(offset) === 1
            ? 'py-1 text-xl font-bold text-white/55 transition'
            : 'py-1 text-lg font-bold text-white/20 transition';
      button.textContent = toArabicPadded(value);
      button.addEventListener('click', () => onSelect(value));
      container.appendChild(button);
    });

    container.onwheel = (event) => {
      event.preventDefault();
      onSelect(wrapValue(selectedValue + (event.deltaY > 0 ? 1 : -1), moduloBase));
    };

    container.onpointerdown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      stopPrayerWheelDrag();

      let anchorY = event.clientY;
      let currentValue = selectedValue;

      const moveHandler = (moveEvent) => {
        const deltaY = anchorY - moveEvent.clientY;
        const steps = Math.trunc(deltaY / PRAYER_WHEEL_DRAG_STEP_PX);
        if (!steps) return;

        currentValue = wrapValue(currentValue + steps, moduloBase);
        anchorY -= steps * PRAYER_WHEEL_DRAG_STEP_PX;
        onSelect(currentValue);
        moveEvent.preventDefault();
      };

      const endHandler = () => {
        stopPrayerWheelDrag();
      };

      activePrayerWheelDrag = {
        container,
        pointerId: event.pointerId,
        moveHandler,
        endHandler
      };

      container.classList.remove('cursor-grab');
      container.classList.add('cursor-grabbing', 'scale-[0.99]');

      if (typeof container.setPointerCapture === 'function') {
        try {
          container.setPointerCapture(event.pointerId);
        } catch (_) {}
      }

      document.addEventListener('pointermove', moveHandler, { passive: false });
      document.addEventListener('pointerup', endHandler);
      document.addEventListener('pointercancel', endHandler);
    };
  };

  const getQuranTrackEntries = (selectedReciter, tracks) =>
    tracks.map((track, index) => ({
      ...track,
      index,
      storageKey: trackStorageKey(selectedReciter?.id || '', track.id)
    }));

  const getFilteredQuranTrackEntries = (selectedReciter, tracks) => {
    const entries = getQuranTrackEntries(selectedReciter, tracks);
    const favorites = getFavoriteTrackKeys();
    const recentKeys = getRecentTrackKeys();
    const byKey = new Map(entries.map((entry) => [entry.storageKey, entry]));

    let filtered = entries;

    if (activeQuranFilter === 'favorites') {
      filtered = entries.filter((entry) => favorites.has(entry.storageKey));
    } else if (activeQuranFilter === 'recent') {
      filtered = recentKeys.map((key) => byKey.get(key)).filter(Boolean);
    } else if (activeQuranFilter === 'segments') {
      filtered = entries.filter((entry) => String(entry.subtitle || '').trim().length > 0);
    }

    const normalizedQuery = quranSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return filtered;

    return filtered.filter((entry) => {
      const haystack = `${entry.title || ''} ${entry.subtitle || ''} ${selectedReciter?.name || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  };

  const updateQuranFilterButtons = () => {
    document.querySelectorAll('.quran-filter-btn').forEach((button) => {
      const isActive = String(button.dataset.quranFilter || '') === activeQuranFilter;
      button.classList.toggle('quran-tab-active', isActive);
      button.classList.toggle('bg-slate-100', !isActive);
      button.classList.toggle('dark:bg-primary/10', !isActive);
      button.classList.toggle('text-slate-600', !isActive);
      button.classList.toggle('dark:text-slate-400', !isActive);
    });
  };

  const updateDuaFilterButtons = () => {
    document.querySelectorAll('.dua-filter-btn').forEach((button) => {
      const isActive = String(button.dataset.duaFilter || '') === activeDuaFilter;
      button.classList.toggle('quran-tab-active', isActive);
      button.classList.toggle('bg-slate-100', !isActive);
      button.classList.toggle('dark:bg-primary/10', !isActive);
      button.classList.toggle('text-slate-600', !isActive);
      button.classList.toggle('dark:text-slate-400', !isActive);
    });
  };

  const setDuaFontScaleLocally = (nextFontScale) => {
    if (!state?.dua) return;
    state = {
      ...state,
      dua: {
        ...state.dua,
        fontScale: clampDuaFontScale(nextFontScale)
      }
    };
  };

  const setAppZoomLocally = (nextZoomFactor) => {
    if (!state) return;
    state = {
      ...state,
      zoom: {
        ...(state.zoom || {}),
        factor: clampAppZoom(nextZoomFactor),
        auto: false
      }
    };
  };

  const setStatus = (text, level = 'ok') => {
    $('statusText').textContent = text;
    if (level === 'ok') $('statusDot').className = 'size-2 rounded-full bg-primary';
    else if (level === 'warn') $('statusDot').className = 'size-2 rounded-full bg-amber-400';
    else $('statusDot').className = 'size-2 rounded-full bg-rose-500';
  };

  const emitCommand = (command, payload = {}) => {
    if (!socket || !socket.connected) {
      setStatus('غير متصل • جاري إعادة المحاولة', 'warn');
      return false;
    }
    socket.emit('command', { command, payload });
    return true;
  };

  const toMinutes = (time) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || ''));
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const fromMinutes = (minutes) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const findPrayerById = (id) => {
    const schedule = Array.isArray(state?.schedule) ? state.schedule : [];
    return schedule.find((item) => item.id === id) || null;
  };

  const orderedDuas = () => {
    const dua = state?.dua;
    if (!dua || !Array.isArray(dua.duas)) return [];
    const byId = new Map(dua.duas.map((item) => [item.id, item]));
    const ordered = Array.isArray(dua.duaOrder)
      ? dua.duaOrder.map((id) => byId.get(id)).filter(Boolean)
      : [];
    const used = new Set(ordered.map((item) => item.id));
    return [...ordered, ...dua.duas.filter((item) => !used.has(item.id))];
  };

  const applyLayout = () => {
    Object.entries(modeButtons).forEach(([mode, btn]) => {
      if (!btn) return;
      const active = activeView === 'mode' && mode === activeMode;
      btn.classList.toggle('bg-primary', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('shadow-lg', active);
      btn.classList.toggle('shadow-primary/20', active);
      btn.classList.toggle('text-slate-500', !active);
      btn.classList.toggle('dark:text-slate-400', !active);
    });

    Object.values(PAGE_IDS).forEach((id) => $(id)?.classList.add('panel-hidden'));
    $('pageSettings')?.classList.add('panel-hidden');

    if (activeView === 'settings') {
      $('pageSettings')?.classList.remove('panel-hidden');
      return;
    }

    $(PAGE_IDS[activeMode])?.classList.remove('panel-hidden');
  };

  const renderQuran = () => {
    const context = getSelectedQuranContext();
    if (!context) return;

    const { reciters, selectedReciter, tracks, selectedTrackIndex, currentTrack } = context;
    const favorites = getFavoriteTrackKeys();
    const entries = getFilteredQuranTrackEntries(selectedReciter, tracks);

    $('quranCurrentReciterName').textContent = selectedReciter?.name || '-';
    $('quranCurrentReciterDesc').textContent = selectedReciter?.description || 'لا توجد بيانات إضافية لهذا القارئ.';
    $('quranCurrentSurah').textContent = currentTrack?.title || 'لا يوجد مقطع محدد';
    $('quranCurrentTrackSubtitle').textContent = currentTrack?.subtitle || 'اختر مقطعًا من القائمة';
    $('quranPlayerTitle').textContent = currentTrack?.title || 'لا يوجد مقطع محدد';
    $('quranPlayerReciter').textContent = selectedReciter ? `القارئ ${selectedReciter.name}` : '-';

    $('quranTrackPositionLabel').textContent = tracks.length
      ? `${toArabicNumber(selectedTrackIndex + 1)} / ${toArabicNumber(tracks.length)}`
      : '0 / 0';
    $('quranTrackMetaLabel').textContent = currentTrack?.subtitle || (tracks.length ? `${toArabicNumber(tracks.length)} مقطع` : 'لا توجد عناصر');
    $('quranProgressStartLabel').textContent = currentTrack?.subtitle || 'اختيار';
    $('quranProgressEndLabel').textContent = tracks.length
      ? `${toArabicNumber(selectedTrackIndex + 1)} / ${toArabicNumber(tracks.length)}`
      : '0 / 0';
    $('quranTrackProgress').style.width = `${tracks.length ? ((selectedTrackIndex + 1) / tracks.length) * 100 : 0}%`;

    const favoriteToggleIcon = $('quranFavoriteToggleBtn')?.querySelector('.material-symbols-outlined');
    if (favoriteToggleIcon) {
      favoriteToggleIcon.textContent =
        currentTrack && selectedReciter && favorites.has(trackStorageKey(selectedReciter.id, currentTrack.id))
          ? 'favorite'
          : 'favorite_border';
    }

    $('quranReciterSelect').innerHTML = '';
    reciters.forEach((reciter) => {
      const option = document.createElement('option');
      option.value = reciter.id;
      option.textContent = reciter.name;
      if (selectedReciter && reciter.id === selectedReciter.id) option.selected = true;
      $('quranReciterSelect').appendChild(option);
    });

    updateQuranFilterButtons();

    const list = $('quranTrackList');
    list.innerHTML = '';
    $('quranEmptyState')?.classList.toggle('panel-hidden', entries.length > 0);

    entries.forEach((entry) => {
      const isActive = entry.index === selectedTrackIndex;
      const isFavorite = favorites.has(entry.storageKey);
      const card = document.createElement('div');
      card.className = isActive
        ? 'rounded-[1.5rem] border border-primary/35 bg-primary/10 p-4 shadow-[0_18px_40px_rgba(16,188,111,0.14)] transition-all'
        : 'rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm transition-all hover:border-primary/20 hover:bg-primary/5 dark:border-primary/10 dark:bg-primary/5';
      card.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="${isActive ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-600 dark:bg-primary/15 dark:text-primary'} flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-black">
            ${escapeHtml(toArabicNumber(entry.index + 1))}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate text-sm font-black text-slate-900 dark:text-white">${escapeHtml(entry.title)}</h3>
              ${isActive ? '<span class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">الحالي</span>' : ''}
            </div>
            <p class="truncate text-xs text-slate-500 dark:text-slate-300">${escapeHtml(entry.subtitle || 'مقطع قرآني')}</p>
          </div>
          <button type="button" class="quran-track-favorite rounded-full p-2 text-slate-400 transition hover:bg-primary/10 hover:text-primary">
            <span class="material-symbols-outlined text-[20px]">${isFavorite ? 'favorite' : 'favorite_border'}</span>
          </button>
          <button type="button" class="quran-track-play rounded-full p-2 ${isActive ? 'text-primary' : 'text-slate-400'} transition hover:bg-primary/10 hover:text-primary">
            <span class="material-symbols-outlined text-[28px]">play_circle</span>
          </button>
        </div>
      `;

      const selectTrack = (shouldPlay = false) => {
        if (!selectedReciter) return;
        rememberRecentTrack(selectedReciter.id, entry.id);
        emitCommand('SET_QURAN_TRACK_INDEX', { trackIndex: entry.index });
        if (shouldPlay) {
          emitCommand('PLAY_QURAN');
        }
      };

      card.addEventListener('click', () => selectTrack(false));
      card.querySelector('.quran-track-play').addEventListener('click', (event) => {
        event.stopPropagation();
        selectTrack(true);
      });
      card.querySelector('.quran-track-favorite').addEventListener('click', (event) => {
        event.stopPropagation();
        if (!selectedReciter) return;
        toggleFavoriteTrack(selectedReciter.id, entry.id);
        renderQuran();
      });

      list.appendChild(card);
    });
  };

  const renderDua = () => {
    const duaState = state?.dua;
    const list = $('duaManagerList');
    list.innerHTML = '';
    if (!duaState) return;

    const ordered = orderedDuas();
    const activeCount = ordered.filter((dua) => dua.active).length;
    const normalizedQuery = duaSearchQuery.trim().toLowerCase();
    const filtered = ordered.filter((dua) => {
      if (activeDuaFilter === 'active' && !dua.active) return false;
      if (activeDuaFilter === 'inactive' && dua.active) return false;
      if (activeDuaFilter === 'scheduled' && !(Array.isArray(dua.slots) && dua.slots.some((slot) => slot !== 'general'))) return false;

      if (!normalizedQuery) return true;
      const haystack = `${dua.title || ''} ${dua.textPreview || ''} ${(dua.slots || []).map(getSlotLabel).join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    $('duaActiveCount').textContent = toArabicNumber(activeCount);
    $('duaTotalCount').textContent = toArabicNumber(ordered.length);
    $('duaVisibleCount').textContent = toArabicNumber(filtered.length);
    $('duaDefaultDuration').textContent = `${toArabicNumber(duaState.displayDurationSec || 12)} ث`;
    $('duaNavigationLabel').textContent = filtered.length
      ? `تصفية ${activeDuaFilter === 'active' ? 'الأدعية النشطة' : activeDuaFilter === 'inactive' ? 'الأدعية المعطلة' : activeDuaFilter === 'scheduled' ? 'الأدعية المجدولة' : 'كل الأدعية'}`
      : 'لا توجد نتائج حالياً';
    $('duaEmptyState')?.classList.toggle('panel-hidden', filtered.length > 0);
    updateDuaFilterButtons();

    const currentFontScale = clampDuaFontScale(duaState.fontScale ?? 1);

    filtered.forEach((dua, filteredIndex) => {
      const slots = Array.isArray(dua.slots) ? [...dua.slots] : ['general'];
      const primarySlot = slots.find((slot) => slot !== 'general') || slots[0] || 'general';
      const lineCount = Number.isFinite(Number(dua.lineCount)) ? Math.max(1, Number(dua.lineCount)) : 1;
      const wordCount = Number.isFinite(Number(dua.wordCount)) ? Math.max(0, Number(dua.wordCount)) : 0;
      const previewText = String(dua.textPreview || '').trim() || 'معاينة نصية غير متاحة لهذا الدعاء.';
      const card = document.createElement('div');
      card.className = dua.active
        ? 'rounded-[1.5rem] border border-primary/25 bg-white/90 p-4 shadow-sm dark:bg-primary/5'
        : 'rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4 opacity-80 shadow-sm dark:border-primary/10 dark:bg-slate-900/45';
      card.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="pt-1 text-slate-400 ${dua.active ? 'dark:text-primary/50' : 'dark:text-primary/20'}">
            <span class="material-symbols-outlined">drag_indicator</span>
          </div>
          <div class="min-w-0 flex-1 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="truncate text-lg font-black text-slate-900 dark:text-slate-100">${escapeHtml(dua.title)}</h3>
                  ${dua.isBuiltin ? '<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">مضمن</span>' : ''}
                </div>
                <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">${escapeHtml(previewText)}</p>
              </div>
              <label class="relative inline-flex shrink-0 cursor-pointer items-center">
                <input type="checkbox" class="dua-active peer sr-only" ${dua.active ? 'checked' : ''}>
                <div class="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-primary dark:bg-slate-700"></div>
                <div class="absolute right-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-all peer-checked:right-[22px] dark:border-gray-600"></div>
              </label>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <select class="dua-primary-slot appearance-none rounded-full bg-slate-100 px-3 py-1.5 pr-8 text-xs font-bold text-slate-700 outline-none ring-0 transition focus:ring-2 focus:ring-primary/15 dark:bg-primary/20 dark:text-slate-200">
                  ${SLOT_OPTIONS.map(([slotId, slotLabel]) => `<option value="${escapeHtml(slotId)}" ${slotId === primarySlot ? 'selected' : ''}>${escapeHtml(slotLabel)}</option>`).join('')}
                </select>
                <span class="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] opacity-50">schedule</span>
              </div>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-primary/10 dark:text-slate-300">${escapeHtml(toArabicNumber(lineCount))} سطر</span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-primary/10 dark:text-slate-300">${escapeHtml(toArabicNumber(wordCount))} كلمة</span>
              <span class="rounded-full ${dua.active ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'} px-3 py-1 text-xs font-black">${dua.active ? 'مفعّل' : 'متوقف'}</span>
            </div>

            <div class="grid grid-cols-4 gap-2">
              <button type="button" class="dua-up rounded-xl bg-primary/10 py-2 text-xs font-bold text-primary">أعلى</button>
              <button type="button" class="dua-down rounded-xl bg-primary/10 py-2 text-xs font-bold text-primary">أسفل</button>
              <button type="button" class="dua-preview rounded-xl border border-primary/30 py-2 text-xs font-bold text-primary">معاينة</button>
              <input type="number" min="0.8" max="1.8" step="0.05" class="dua-font-scale rounded-xl border border-primary/25 bg-white px-2 py-2 text-center text-xs font-bold dark:bg-background-dark" value="${currentFontScale.toFixed(2)}" title="حجم الخط">
            </div>

            <div class="dua-slots flex flex-wrap gap-1.5"></div>

            <div class="flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px] font-bold text-slate-400 dark:border-primary/10">
              <span>الترتيب الحالي: ${escapeHtml(toArabicNumber(filteredIndex + 1))}</span>
              <span>${escapeHtml(getSlotLabel(primarySlot))}</span>
            </div>
          </div>
        </div>
      `;

      const slotWrap = card.querySelector('.dua-slots');
      SLOT_OPTIONS.forEach(([slotId, slotLabel]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
          slots.includes(slotId) ? 'slot-chip-active' : 'border-primary/20 text-slate-500 dark:text-slate-400'
        }`;
        chip.textContent = slotLabel;
        chip.addEventListener('click', () => {
          const next = new Set(slots);
          if (next.has(slotId)) next.delete(slotId);
          else next.add(slotId);
          if (!next.size) next.add('general');
          emitCommand('SET_DUA_SLOTS', { duaId: dua.id, slots: [...next] });
        });
        slotWrap.appendChild(chip);
      });

      card.querySelector('.dua-active').addEventListener('change', (event) =>
        emitCommand('SET_DUA_ACTIVE', { duaId: dua.id, active: event.target.checked })
      );
      card.querySelector('.dua-up').addEventListener('click', () =>
        emitCommand('MOVE_DUA', { duaId: dua.id, direction: -1 })
      );
      card.querySelector('.dua-down').addEventListener('click', () =>
        emitCommand('MOVE_DUA', { duaId: dua.id, direction: 1 })
      );
      card.querySelector('.dua-preview').addEventListener('click', () =>
        emitCommand('PREVIEW_DUA', { duaId: dua.id })
      );
      card.querySelector('.dua-primary-slot').addEventListener('change', (event) => {
        const nextPrimarySlot = String(event.target.value || 'general');
        const nextSlots = nextPrimarySlot === 'general'
          ? ['general']
          : Array.from(new Set([nextPrimarySlot, ...(slots.includes('general') ? ['general'] : [])]));
        emitCommand('SET_DUA_SLOTS', { duaId: dua.id, slots: nextSlots });
      });
      card.querySelector('.dua-font-scale').addEventListener('change', (event) => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        const nextFontScale = clampDuaFontScale(value);
        event.target.value = nextFontScale.toFixed(2);
        setDuaFontScaleLocally(nextFontScale);
        renderDua();
        emitCommand('SET_DUA_FONT_SCALE', { fontScale: nextFontScale });
      });

      list.appendChild(card);
    });
  };

  const renderPrayer = () => {
    const context = getSelectedPrayerContext();
    const list = $('prayerListGrid');
    list.innerHTML = '';
    if (!context) return;

    const { prayers, selectedIndex, selectedPrayer } = context;
    const prayerMeta = PRAYER_META[selectedPrayer.id] || { icon: 'schedule', description: 'يمكنك تعديل وقت الصلاة من هذه الشاشة.' };
    const { hour, minute } = parsePrayerTimeParts(selectedPrayer.time);

    $('prayerStepLabel').textContent = `الخطوة ${toArabicNumber(selectedIndex + 1)} من ${toArabicNumber(prayers.length)}`;
    $('prayerCurrentStepName').textContent = selectedPrayer.nameAR || selectedPrayer.id;
    $('prayerStepProgress').style.width = `${((selectedIndex + 1) / prayers.length) * 100}%`;
    $('prayerCurrentIcon').textContent = prayerMeta.icon;
    $('prayerCurrentName').textContent = selectedPrayer.nameAR || selectedPrayer.id;
    $('prayerCurrentDescription').textContent = prayerMeta.description;

    renderPrayerWheel($('prayerHourWheel'), hour, 24, (nextHour) => {
      commitPrayerTime(selectedPrayer.id, buildPrayerTime(nextHour, minute));
    });
    renderPrayerWheel($('prayerMinuteWheel'), minute, 60, (nextMinute) => {
      commitPrayerTime(selectedPrayer.id, buildPrayerTime(hour, nextMinute));
    });

    prayers.forEach((prayer, index) => {
      const isSelected = prayer.id === selectedPrayer.id;
      const meta = PRAYER_META[prayer.id] || { icon: 'schedule' };
      const card = document.createElement('button');
      card.type = 'button';
      card.className = isSelected
        ? 'flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 text-right shadow-sm'
        : 'flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-right opacity-70 transition hover:opacity-100 dark:border-slate-700/50 dark:bg-slate-800/50';
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined ${isSelected ? 'text-primary' : 'text-slate-400 dark:text-slate-300'}">${escapeHtml(meta.icon)}</span>
          <span class="font-bold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}">${escapeHtml(prayer.nameAR || prayer.id)}</span>
        </div>
        <span class="${isSelected ? 'text-primary' : 'text-slate-400 dark:text-slate-300'} font-bold">${escapeHtml(formatPrayerCardTime(prayer.time))}</span>
      `;
      card.addEventListener('click', () => {
        selectedPrayerId = prayer.id;
        renderPrayer();
      });
      list.appendChild(card);
    });
  };

  const renderSettings = () => {
    $('imamNameInput').value = state?.mosque?.imamName || '';
    $('backgroundColorInput').value = state?.theme?.homeBackgroundColor || '#07111f';
    $('overlayColorInput').value = state?.theme?.homeOverlayColor || '#000000';
    $('overlayOpacityInput').value = String(state?.theme?.homeOverlayOpacity ?? 0.4);
    $('backgroundImageInput').value = state?.theme?.backgroundImage || '';
    const currentZoomFactor = clampAppZoom(state?.zoom?.factor ?? 1);
    $('appZoomInput').value = String(currentZoomFactor);
    $('appZoomValue').textContent = formatZoomPercent(currentZoomFactor);
    $('appZoomHint').textContent = state?.zoom?.auto ? 'تلقائي' : 'الحجم الحالي';
  };

  const applyState = (nextState) => {
    if (!nextState || typeof nextState !== 'object') return;
    state = nextState;

    const remoteMode = String(state.mode || '').toUpperCase();
    if (MODE_ORDER.includes(remoteMode)) activeMode = remoteMode;

    renderQuran();
    renderDua();
    renderPrayer();
    renderSettings();
    applyLayout();
  };

  const fetchState = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/state', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.ok) applyState(data.state);
    } catch (_) {}
  };

  const connectSocket = () => {
    socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500
    });

    socket.on('connect', () => {
      setStatus('متصل • شبكة WiFi المحلية', 'ok');
      fetchState();
    });
    socket.on('disconnect', () => setStatus('انقطع الاتصال • جاري إعادة المحاولة', 'warn'));
    socket.on('connect_error', () => setStatus('فشل الاتصال • تحقق من PIN', 'danger'));
    socket.on('state', (nextState) => applyState(nextState));
  };

  $('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('authError').textContent = '';
    const pin = String($('pinInput').value || '').trim();
    if (!/^\d{4}$/.test(pin)) {
      $('authError').textContent = 'أدخل PIN صحيح من 4 أرقام.';
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        $('authError').textContent = 'PIN غير صحيح.';
        return;
      }

      const data = await response.json();
      token = typeof data?.token === 'string' ? data.token : '';
      if (!token) {
        $('authError').textContent = 'تعذر تسجيل الدخول.';
        return;
      }

      $('authLayer').classList.add('panel-hidden');
      setStatus('جاري الاتصال...', 'warn');
      connectSocket();
      fetchState();

      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(fetchState, 10000);
    } catch (_) {
      $('authError').textContent = 'تعذر الوصول إلى خادم التحكم.';
    }
  });

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = String(btn.dataset.mode || '').toUpperCase();
      if (!MODE_ORDER.includes(mode)) return;
      activeMode = mode;
      activeView = 'mode';
      applyLayout();
      emitCommand('CHANGE_MODE', { mode });
    });
  });

  $('refreshStateBtn').addEventListener('click', fetchState);
  $('quranNextBtn').addEventListener('click', () => emitCommand('NEXT_SURAH'));
  $('quranPrevBtn').addEventListener('click', () => emitCommand('PREVIOUS_SURAH'));
  $('quranPlayBtn').addEventListener('click', () => {
    const context = getSelectedQuranContext();
    if (context?.selectedReciter && context.currentTrack) {
      rememberRecentTrack(context.selectedReciter.id, context.currentTrack.id);
    }
    emitCommand('PLAY_QURAN');
  });
  $('quranStopBtn').addEventListener('click', () => emitCommand('STOP_QURAN'));
  $('quranReciterSelect').addEventListener('change', (event) => {
    const reciterId = String(event.target.value || '').trim();
    if (reciterId) emitCommand('SET_QURAN_RECITER', { reciterId });
  });
  $('quranSearchInput').addEventListener('input', (event) => {
    quranSearchQuery = String(event.target.value || '');
    renderQuran();
  });
  document.querySelectorAll('.quran-filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = String(button.dataset.quranFilter || '').trim();
      if (!nextFilter) return;
      activeQuranFilter = nextFilter;
      renderQuran();
    });
  });
  $('quranFavoriteToggleBtn').addEventListener('click', () => {
    const context = getSelectedQuranContext();
    if (!context?.selectedReciter || !context.currentTrack) return;
    toggleFavoriteTrack(context.selectedReciter.id, context.currentTrack.id);
    renderQuran();
  });

  $('duaSearchInput').addEventListener('input', (event) => {
    duaSearchQuery = String(event.target.value || '');
    renderDua();
  });
  document.querySelectorAll('.dua-filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextFilter = String(button.dataset.duaFilter || '').trim();
      if (!nextFilter) return;
      activeDuaFilter = nextFilter;
      renderDua();
    });
  });
  $('duaPageNextBtn').addEventListener('click', () => emitCommand('NEXT_DUA'));
  $('duaPagePrevBtn').addEventListener('click', () => emitCommand('PREVIOUS_DUA'));
  $('prayerModeNextBtn').addEventListener('click', () => emitCommand('NEXT_PAGE'));
  $('prayerModePrevBtn').addEventListener('click', () => emitCommand('PREVIOUS_PAGE'));
  $('prayerNextPageBtn').addEventListener('click', () => {
    const context = getSelectedPrayerContext();
    if (!context) return;
    const nextIndex = Math.min(context.prayers.length - 1, context.selectedIndex + 1);
    selectedPrayerId = context.prayers[nextIndex].id;
    renderPrayer();
  });
  $('prayerPrevPageBtn').addEventListener('click', () => {
    const context = getSelectedPrayerContext();
    if (!context) return;
    const nextIndex = Math.max(0, context.selectedIndex - 1);
    selectedPrayerId = context.prayers[nextIndex].id;
    renderPrayer();
  });
  $('prayerHeaderBackBtn').addEventListener('click', () => {
    activeView = 'mode';
    applyLayout();
  });
  $('prayerHeaderDoneBtn').addEventListener('click', () => {
    setStatus('تم حفظ أوقات الصلاة تلقائياً', 'ok');
    activeView = 'mode';
    applyLayout();
    fetchState();
  });

  $('saveImamBtn').addEventListener('click', () => {
    const imamName = String($('imamNameInput').value || '').trim();
    if (imamName) emitCommand('SET_IMAM_NAME', { imamName });
  });
  $('appZoomInput').addEventListener('input', (event) => {
    const nextZoomFactor = clampAppZoom(event.target.value);
    event.target.value = String(nextZoomFactor);
    if (!emitCommand('SET_APP_ZOOM', { zoomFactor: nextZoomFactor })) {
      renderSettings();
      return;
    }
    setAppZoomLocally(nextZoomFactor);
    renderSettings();
  });
  $('backgroundColorInput').addEventListener('change', (event) =>
    emitCommand('SET_HOME_BACKGROUND_COLOR', { color: event.target.value })
  );
  $('overlayColorInput').addEventListener('change', (event) =>
    emitCommand('SET_HOME_OVERLAY_COLOR', { color: event.target.value })
  );
  $('overlayOpacityInput').addEventListener('change', (event) =>
    emitCommand('SET_HOME_OVERLAY_OPACITY', { opacity: Number(event.target.value) })
  );
  $('saveBackgroundImageBtn').addEventListener('click', () => {
    const imageUrl = String($('backgroundImageInput').value || '').trim();
    emitCommand('SET_HOME_BACKGROUND_IMAGE_URL', { imageUrl: imageUrl || null });
  });

  $('navHome').addEventListener('click', (event) => {
    event.preventDefault();
    activeView = 'mode';
    applyLayout();
    emitCommand('GO_HOME');
  });
  $('navBack').addEventListener('click', (event) => {
    event.preventDefault();
    emitCommand('BACK');
  });
  $('navSettings').addEventListener('click', (event) => {
    event.preventDefault();
    activeView = activeView === 'settings' ? 'mode' : 'settings';
    applyLayout();
  });
  $('navAdmin').addEventListener('click', (event) => {
    event.preventDefault();
    activeView = 'mode';
    activeMode = 'QURAN';
    applyLayout();
  });

  applyLayout();
  setStatus('بانتظار تسجيل الدخول...', 'warn');
})();
