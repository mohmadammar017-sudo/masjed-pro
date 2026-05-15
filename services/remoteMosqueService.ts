import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { DEFAULT_ADHAN_SETTINGS, DEFAULT_PRAYER_SETTINGS, INITIAL_PRAYER_SCHEDULE, MOSQUE_INFO, OCCASION_DATA } from '../constants';
import {
  RemoteAdminSession,
  RemoteDisplayConfig,
  RemoteGlobalConfig,
  RemoteGlobalSystemSettings,
  RemoteManagedPage,
  RemoteMosqueDocument,
  RemotePrayerAdjustments,
  RemotePrayerControlSettings
} from '../types';
import { fileToDataUrl, generateMosqueId, hashPin } from '../utils';
import { auth, db, isConfigured, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ALL_REMOTE_PAGE_WEEKDAYS,
  createRemotePageDraft,
  normalizeRemotePagePrayerTriggers,
  normalizeRemotePageWeekdays,
  renumberRemotePages
} from '../utils/remotePages';
import { getDefaultPrayerFlows, normalizePrayerFlows } from '../utils/remotePrayerFlows';

const LOCAL_MOSQUES_KEY = 'remote_mosques_v1';
const LOCAL_GLOBAL_CONFIG_KEY = 'remote_global_config_v1';
const LOCAL_ADMIN_USERS_KEY = 'remote_admin_users_v1';
const LOCAL_ADMIN_SESSION_KEY = 'remote_admin_session_v1';

const localMosqueListeners = new Set<() => void>();
const localAuthListeners = new Set<() => void>();

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[remoteMosqueService] Failed to read ${key}`, error);
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const emitMosqueChange = () => {
  localMosqueListeners.forEach((listener) => listener());
};

const emitAuthChange = () => {
  localAuthListeners.forEach((listener) => listener());
};

const getDefaultPrayerAdjustments = (): RemotePrayerAdjustments => ({
  fajr: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0
});

const getDefaultPrayerControl = (): RemotePrayerControlSettings => ({
  mode: 'manual',
  city: 'Dammam',
  adjustments: getDefaultPrayerAdjustments(),
  manualTimes: {
    fajr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'fajr')?.time || '04:56',
    dhuhr: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'dhuhr')?.time || '12:03',
    maghrib: INITIAL_PRAYER_SCHEDULE.find((item) => item.id === 'maghrib')?.time || '17:35',
    asr: '',
    isha: ''
  }
});

const getDefaultDisplayConfig = (name = MOSQUE_INFO.name, city = 'Dammam'): RemoteDisplayConfig => ({
  mosqueInfo: {
    ...MOSQUE_INFO,
    name,
    location: city
  },
  occasion: {
    ...OCCASION_DATA
  },
  schedule: [...(INITIAL_PRAYER_SCHEDULE as unknown as RemoteDisplayConfig['schedule'])],
  monthlySchedule: null,
  adhanSettings: {
    ...DEFAULT_ADHAN_SETTINGS
  },
  prayerSettings: {
    ...DEFAULT_PRAYER_SETTINGS
  },
  theme: {
    homeBackgroundImage: null,
    homeBackgroundColor: '#020617',
    homeOverlayColor: '#000000',
    homeOverlayOpacity: 0.45
  },
  hijriOffset: 0
});

const getDefaultGlobalSystemSettings = (): RemoteGlobalSystemSettings => {
  const displayDefaults = getDefaultDisplayConfig();
  return {
    prayerSettings: getDefaultPrayerControl(),
    schedule: [...(INITIAL_PRAYER_SCHEDULE as unknown as RemoteGlobalSystemSettings['schedule'])],
    monthlySchedule: null,
    theme: {
      ...displayDefaults.theme
    },
    hijriOffset: 0
  };
};

const normalizeRemotePrayerControl = (value?: Partial<RemotePrayerControlSettings> | null): RemotePrayerControlSettings => {
  const defaults = getDefaultPrayerControl();
  return {
    mode: value?.mode === 'auto' ? 'auto' : 'manual',
    city: typeof value?.city === 'string' && value.city.trim() ? value.city.trim() : defaults.city,
    adjustments: {
      ...defaults.adjustments,
      ...(value?.adjustments || {})
    },
    manualTimes: {
      ...defaults.manualTimes,
      ...(value?.manualTimes || {})
    }
  };
};

const normalizeRemoteGlobalSystemSettings = (
  value?: Partial<RemoteGlobalSystemSettings> | null
): RemoteGlobalSystemSettings => {
  const defaults = getDefaultGlobalSystemSettings();
  return {
    prayerSettings: normalizeRemotePrayerControl(value?.prayerSettings),
    schedule: Array.isArray(value?.schedule) && value.schedule.length > 0
      ? value.schedule
      : defaults.schedule,
    monthlySchedule: value?.monthlySchedule ?? defaults.monthlySchedule,
    theme: {
      ...defaults.theme,
      ...(value?.theme || {})
    },
    hijriOffset: typeof value?.hijriOffset === 'number' ? value.hijriOffset : defaults.hijriOffset
  };
};

const normalizeRemoteDisplayConfig = (value?: Partial<RemoteDisplayConfig> | null, name?: string, city?: string): RemoteDisplayConfig => {
  const defaults = getDefaultDisplayConfig(name, city);
  return {
    ...defaults,
    ...(value || {}),
    mosqueInfo: {
      ...defaults.mosqueInfo,
      ...(value?.mosqueInfo || {})
    },
    occasion: {
      ...defaults.occasion,
      ...(value?.occasion || {})
    },
    schedule: Array.isArray(value?.schedule) && value.schedule.length > 0
      ? value.schedule
      : defaults.schedule,
    adhanSettings: {
      ...defaults.adhanSettings,
      ...(value?.adhanSettings || {})
    },
    prayerSettings: {
      ...defaults.prayerSettings,
      ...(value?.prayerSettings || {})
    },
    theme: {
      ...defaults.theme,
      ...(value?.theme || {})
    },
    monthlySchedule: value?.monthlySchedule ?? defaults.monthlySchedule,
    hijriOffset: typeof value?.hijriOffset === 'number' ? value.hijriOffset : defaults.hijriOffset
  };
};

const normalizePage = (page: Partial<RemoteManagedPage>, index: number): RemoteManagedPage => ({
  ...(() => {
    const baseDraft = createRemotePageDraft(index, page.type || 'dua');
    return {
      ...baseDraft,
      ...page,
      id: typeof page.id === 'string' && page.id.trim() ? page.id : baseDraft.id,
      title: typeof page.title === 'string' && page.title.trim() ? page.title.trim() : baseDraft.title,
      content: typeof page.content === 'string' ? page.content : '',
      order: Number.isFinite(page.order) ? Number(page.order) : index + 1,
      groupOrder: Number.isFinite(page.groupOrder) ? Number(page.groupOrder) : baseDraft.groupOrder,
      enabled: page.enabled !== false,
      autoSplit: page.autoSplit !== false,
      placement: page.placement === 'after_prayer' ? 'after_prayer' : 'general',
      prayerTriggers: normalizeRemotePagePrayerTriggers(page.prayerTriggers),
      weekdays: normalizeRemotePageWeekdays(page.weekdays),
      accentColor: typeof page.accentColor === 'string' && page.accentColor.trim() ? page.accentColor : undefined,
      backgroundImage: typeof page.backgroundImage === 'string' ? page.backgroundImage : null,
      imageUrl: typeof page.imageUrl === 'string' ? page.imageUrl : null,
      textAlign: page.textAlign === 'right' ? 'right' : 'center'
    };
  })()
});

export const normalizeRemoteMosqueDocument = (value: Partial<RemoteMosqueDocument>, fallbackId?: string): RemoteMosqueDocument => {
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : fallbackId || `mosque_${generateMosqueId().toLowerCase()}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'مسجد جديد';
  const city = typeof value.city === 'string' && value.city.trim() ? value.city.trim() : 'Dammam';
  const pages = renumberRemotePages(
    (Array.isArray(value.pages) ? value.pages : [])
      .map((page, index) => normalizePage(page, index))
  );

  return {
    id,
    name,
    city,
    code: typeof value.code === 'string' && value.code.trim() ? value.code.trim().toUpperCase() : `MOSQUE_${generateMosqueId()}`,
    passwordHash: typeof value.passwordHash === 'string' ? value.passwordHash : '',
    theme: typeof value.theme === 'string' && value.theme.trim() ? value.theme : 'default',
    mode: value.mode === 'DUA' || value.mode === 'QURAN' || value.mode === 'PRAYER' ? value.mode : 'AUTO',
    pages,
    prayerFlows: normalizePrayerFlows(value.prayerFlows),
    prayerSettings: normalizeRemotePrayerControl(value.prayerSettings),
    displayConfig: normalizeRemoteDisplayConfig(value.displayConfig, name, city),
    lastUpdated: typeof value.lastUpdated === 'number' ? value.lastUpdated : Date.now()
  };
};

const normalizeRemoteGlobalConfig = (value?: Partial<RemoteGlobalConfig> | null): RemoteGlobalConfig => ({
  pages: renumberRemotePages(
    (Array.isArray(value?.pages) ? value?.pages : []).map((page, index) => normalizePage(page, index))
  ),
  systemSettings: normalizeRemoteGlobalSystemSettings(value?.systemSettings),
  lastUpdated: typeof value?.lastUpdated === 'number' ? value.lastUpdated : Date.now()
});

const readFallbackMosques = (): RemoteMosqueDocument[] => {
  return readJson<Partial<RemoteMosqueDocument>[]>(LOCAL_MOSQUES_KEY, []).map((item) => normalizeRemoteMosqueDocument(item));
};

const writeFallbackMosques = (mosques: RemoteMosqueDocument[]) => {
  writeJson(LOCAL_MOSQUES_KEY, mosques);
  emitMosqueChange();
};

const readFallbackGlobalConfig = (): RemoteGlobalConfig => {
  return normalizeRemoteGlobalConfig(
    readJson<Partial<RemoteGlobalConfig>>(LOCAL_GLOBAL_CONFIG_KEY, {
      pages: [],
      systemSettings: getDefaultGlobalSystemSettings(),
      lastUpdated: Date.now()
    })
  );
};

const writeFallbackGlobalConfig = (config: RemoteGlobalConfig) => {
  writeJson(LOCAL_GLOBAL_CONFIG_KEY, config);
  emitMosqueChange();
};

const createSessionFromLocal = (): RemoteAdminSession | null => {
  return readJson<RemoteAdminSession | null>(LOCAL_ADMIN_SESSION_KEY, null);
};

const setLocalSession = (session: RemoteAdminSession | null) => {
  if (session) {
    writeJson(LOCAL_ADMIN_SESSION_KEY, session);
  } else {
    window.localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
  }
  emitAuthChange();
};

interface LocalAdminUser {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

interface FirestoreAdminUser {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  lastUpdated: number;
}

const readLocalAdminUsers = (): LocalAdminUser[] => readJson<LocalAdminUser[]>(LOCAL_ADMIN_USERS_KEY, []);

const writeLocalAdminUsers = (users: LocalAdminUser[]) => {
  writeJson(LOCAL_ADMIN_USERS_KEY, users);
  emitAuthChange();
};

const normalizeAdminEmail = (email: string): string => email.trim().toLowerCase();

const buildAdminSession = (
  admin: Pick<LocalAdminUser, 'uid' | 'email' | 'displayName'>,
  provider: RemoteAdminSession['provider']
): RemoteAdminSession => ({
  uid: admin.uid,
  email: admin.email,
  displayName: admin.displayName,
  provider
});

const readFirestoreAdmin = async (_email: string): Promise<FirestoreAdminUser | null> => null;

const writeFirestoreAdmin = async (_admin: FirestoreAdminUser): Promise<void> => {};

const shouldFallbackFromFirebaseAuth = (_error?: unknown): boolean => false;

export const generateMosqueCode = (name: string, city: string): string => {
  const normalizeCodePart = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\u0600-\u06FF]+/g, '')
      .slice(0, 6);

  const cityPart = normalizeCodePart(city) || 'MOSQUE';
  const namePart = normalizeCodePart(name) || 'MASJID';
  return `${cityPart}_${namePart}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
};

export const subscribeAdminSession = (callback: (session: RemoteAdminSession | null) => void) => {
  if (isConfigured && auth) {
    return onAuthStateChanged(auth, (user) => {
      if (!user?.email) {
        callback(null);
        return;
      }

      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0] || 'Admin',
        provider: 'firebase'
      });
    });
  }

  const emitLocalSession = () => callback(createSessionFromLocal());
  localAuthListeners.add(emitLocalSession);
  emitLocalSession();
  return () => localAuthListeners.delete(emitLocalSession);
};

export const signInAdmin = async (email: string, password: string): Promise<RemoteAdminSession> => {
  const normalizedEmail = normalizeAdminEmail(email);
  const passwordHash = await hashPin(password);

  if (isConfigured && auth) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: credential.user.displayName || email.split('@')[0] || 'Admin',
      provider: 'firebase'
    };
  }

  if (isConfigured && db) {
    const firestoreAdmin = await readFirestoreAdmin(normalizedEmail);
    if (firestoreAdmin) {
      if (firestoreAdmin.passwordHash !== passwordHash) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      const session = buildAdminSession(firestoreAdmin, 'firestore');
      setLocalSession(session);
      return session;
    }
  }

  const users = readLocalAdminUsers();
  const user = users.find((item) => item.email.toLowerCase() === normalizedEmail && item.passwordHash === passwordHash);
  if (!user) {
    throw new Error('بيانات الدخول غير صحيحة');
  }

  const session = buildAdminSession(user, 'local');
  setLocalSession(session);
  return session;
};

export const registerAdmin = async (email: string, password: string, displayName: string): Promise<RemoteAdminSession> => {
  const normalizedEmail = normalizeAdminEmail(email);
  const normalizedDisplayName = displayName.trim() || normalizedEmail.split('@')[0] || 'Admin';

  if (isConfigured && auth) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (credential.user.displayName !== normalizedDisplayName) {
        await updateProfile(credential.user, { displayName: normalizedDisplayName });
      }
      return {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: normalizedDisplayName,
        provider: 'firebase'
      };
    } catch (error) {
      if (!shouldFallbackFromFirebaseAuth(error)) {
        throw error;
      }
    }
  }

  if (isConfigured && db) {
    const existingFirestoreAdmin = await readFirestoreAdmin(normalizedEmail);
    if (existingFirestoreAdmin) {
      throw new Error('هذا البريد مسجل مسبقًا');
    }

    const firestoreAdmin: FirestoreAdminUser = {
      uid: `admin_${generateMosqueId().toLowerCase()}`,
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      passwordHash: await hashPin(password),
      lastUpdated: Date.now()
    };

    await writeFirestoreAdmin(firestoreAdmin);
    const session = buildAdminSession(firestoreAdmin, 'firestore');
    setLocalSession(session);
    return session;
  }

  const users = readLocalAdminUsers();
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('هذا البريد مسجل مسبقًا');
  }

  const nextUser: LocalAdminUser = {
    uid: `admin_${generateMosqueId().toLowerCase()}`,
    email: normalizedEmail,
    displayName: normalizedDisplayName,
    passwordHash: await hashPin(password)
  };

  writeLocalAdminUsers([...users, nextUser]);
  const session = buildAdminSession(nextUser, 'local');
  setLocalSession(session);
  return session;
};

export const signOutAdminSession = async (): Promise<void> => {
  if (isConfigured && auth) {
    try {
      await signOut(auth);
    } catch (error) {
      if (!shouldFallbackFromFirebaseAuth(error)) {
        throw error;
      }
    }
  }

  setLocalSession(null);
};

export const subscribeMosques = (callback: (mosques: RemoteMosqueDocument[]) => void) => {
  if (isConfigured && db) {
    const mosquesQuery = query(collection(db, 'mosques'), orderBy('lastUpdated', 'desc'));
    return onSnapshot(mosquesQuery, (snapshot) => {
      callback(snapshot.docs.map((item) => normalizeRemoteMosqueDocument(item.data() as RemoteMosqueDocument, item.id)));
    });
  }

  callback(readFallbackMosques());
  const listener = () => callback(readFallbackMosques());
  localMosqueListeners.add(listener);
  return () => localMosqueListeners.delete(listener);
};

export const subscribeMosqueByCode = (code: string, callback: (mosque: RemoteMosqueDocument | null) => void) => {
  const normalizedCode = code.trim().toUpperCase();

  if (isConfigured && db) {
    const mosquesQuery = query(collection(db, 'mosques'), where('code', '==', normalizedCode));
    return onSnapshot(mosquesQuery, (snapshot) => {
      const first = snapshot.docs[0];
      callback(first ? normalizeRemoteMosqueDocument(first.data() as RemoteMosqueDocument, first.id) : null);
    });
  }

  const emit = () => {
    const mosque = readFallbackMosques().find((item) => item.code === normalizedCode) || null;
    callback(mosque);
  };

  emit();
  localMosqueListeners.add(emit);
  return () => localMosqueListeners.delete(emit);
};

export const findMosqueByCode = async (code: string): Promise<RemoteMosqueDocument | null> => {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  if (isConfigured && db) {
    const snapshot = await getDocs(query(collection(db, 'mosques'), where('code', '==', normalizedCode)));
    const first = snapshot.docs[0];
    return first ? normalizeRemoteMosqueDocument(first.data() as RemoteMosqueDocument, first.id) : null;
  }

  return readFallbackMosques().find((item) => item.code === normalizedCode) || null;
};

export const subscribeGlobalConfig = (callback: (config: RemoteGlobalConfig) => void) => {
  if (isConfigured && db) {
    const globalRef = doc(db, 'system', 'global');
    return onSnapshot(globalRef, (snapshot) => {
      callback(normalizeRemoteGlobalConfig(snapshot.data() as RemoteGlobalConfig | undefined));
    });
  }

  callback(readFallbackGlobalConfig());
  const listener = () => callback(readFallbackGlobalConfig());
  localMosqueListeners.add(listener);
  return () => localMosqueListeners.delete(listener);
};

interface CreateMosqueInput {
  name: string;
  city: string;
  password: string;
  code?: string;
}

export const createMosque = async (input: CreateMosqueInput): Promise<RemoteMosqueDocument> => {
  const id = `mosque_${generateMosqueId().toLowerCase()}`;
  const normalizedName = input.name.trim() || 'مسجد جديد';
  const normalizedCity = input.city.trim() || 'Dammam';
  const code = (input.code?.trim() || generateMosqueCode(normalizedName, normalizedCity)).toUpperCase();
  const globalConfig = isConfigured && db
    ? normalizeRemoteGlobalConfig((await getDoc(doc(db, 'system', 'global'))).data() as RemoteGlobalConfig | undefined)
    : readFallbackGlobalConfig();
  const mosque = normalizeRemoteMosqueDocument({
    id,
    name: normalizedName,
    city: normalizedCity,
    code,
    passwordHash: await hashPin(input.password.trim() || '1234'),
    pages: [createRemotePageDraft(0, 'announcement')],
    prayerFlows: getDefaultPrayerFlows(),
    prayerSettings: globalConfig.systemSettings.prayerSettings,
    displayConfig: {
      ...getDefaultDisplayConfig(normalizedName, normalizedCity),
      schedule: globalConfig.systemSettings.schedule,
      monthlySchedule: globalConfig.systemSettings.monthlySchedule,
      theme: globalConfig.systemSettings.theme,
      hijriOffset: globalConfig.systemSettings.hijriOffset
    }
  }, id);

  if (isConfigured && db) {
    await setDoc(doc(db, 'mosques', id), mosque);
    return mosque;
  }

  const mosques = readFallbackMosques();
  writeFallbackMosques([mosque, ...mosques]);
  return mosque;
};

export const updateMosque = async (mosqueId: string, partial: Partial<RemoteMosqueDocument>) => {
  if (isConfigured && db) {
    const snapshot = await getDoc(doc(db, 'mosques', mosqueId));
    const currentValue = snapshot.exists()
      ? normalizeRemoteMosqueDocument(snapshot.data() as RemoteMosqueDocument, snapshot.id)
      : undefined;
    const next = normalizeRemoteMosqueDocument({
      ...(currentValue || { id: mosqueId }),
      ...partial,
      id: mosqueId,
      lastUpdated: Date.now()
    }, mosqueId);
    await setDoc(doc(db, 'mosques', mosqueId), next, { merge: true });
    return next;
  }

  const mosques = readFallbackMosques();
  const nextMosques = mosques.map((mosque) =>
    mosque.id === mosqueId
      ? normalizeRemoteMosqueDocument({
          ...mosque,
          ...partial,
          id: mosqueId,
          lastUpdated: Date.now()
        }, mosqueId)
      : mosque
  );
  writeFallbackMosques(nextMosques);
  return nextMosques.find((item) => item.id === mosqueId) || null;
};

export const deleteMosque = async (mosqueId: string) => {
  if (isConfigured && db) {
    await deleteDoc(doc(db, 'mosques', mosqueId));
    return;
  }

  writeFallbackMosques(readFallbackMosques().filter((mosque) => mosque.id !== mosqueId));
};

export const updateGlobalConfig = async (config: Partial<RemoteGlobalConfig>) => {
  const current = readFallbackGlobalConfig();
  const next = normalizeRemoteGlobalConfig({
    ...current,
    ...config,
    systemSettings: {
      ...current.systemSettings,
      ...(config.systemSettings || {})
    },
    lastUpdated: Date.now()
  });

  if (isConfigured && db) {
    await setDoc(doc(db, 'system', 'global'), next, { merge: true });
    return next;
  }

  writeFallbackGlobalConfig(next);
  return next;
};

export const uploadRemoteAsset = async (file: File, folder: string): Promise<string> => {
  if (isConfigured && storage) {
    try {
      const safeFolder = folder.replace(/[^a-z0-9/_-]+/gi, '-');
      const storageRef = ref(storage, `${safeFolder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return getDownloadURL(snapshot.ref);
    } catch (error) {
      console.warn('[remoteMosqueService] Firebase Storage upload failed, falling back to inline asset', error);
    }
  }

  return fileToDataUrl(file);
};
