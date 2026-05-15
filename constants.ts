
import { MosqueInfo, Occasion, AdhanSettings, PrayerSettings } from './types';
import { createDefaultRamadanDuaSystemSettings } from './data/ramadanDuaLibrary';
import { DEFAULT_QURAN_SETTINGS } from './data/quranLibrary';

export const MOSQUE_INFO: MosqueInfo = {
  name: "مسجد الإمام الحسين",
  location: "حي الخرس",
  imamName: "الشيخ علي رضا",
  savedImamNames: []
};

export const OCCASION_DATA: Occasion = {
  title: "مناسبة اليوم",
  description: "مولد القاسم بن الإمام الحسن (ع)",
  date: "2026-02-03",
  show: true, // Default to visible
  borderColor: "#d4ac0d",
  nextPrayerColor: "#ffffff" // Updated to white
};

export const DEFAULT_ADHAN_SETTINGS: AdhanSettings = {
  transitionMode: 'manual',
  autoDuration: 5, // 5 seconds default
  borderColor: '#D4AF37', // Updated to match new theme
  backgroundColor: '#0f172a', // Updated to darker slate
  // Updated to the new cinematic background image
  backgroundImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuAquU6G9DMdhZyxB7k4wWchKJHndTwMu84pGJzTctak8Lor2RRvQLMOGyFQ4QaR_Ma62USNdvCUCEa3vaT0tv51VaXitcDq7cZyDZggzExqE0YlGqPX7rSYSJa_Q6rs4lPdyNWF_v7RQmiDt-zTXw4bDxNTsFBrx9hovGAlgUx3B0azXyreQgtEyaY-xoIGcRH0aPlOWfdSh1u2-vou1T8ZY4xlHc0XIsDAZiw59Eot7SP1lKngfNnr088rU2m6FjGXi5NkrYa2yuY"
};

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  transitionMode: 'manual',
  autoDuration: 120, // 2 minutes per rakah default
  backgroundColor: '#020617', // Default Deep Dark Blue
  // Updated default background for Prayer (Iqama) view
  backgroundImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbIaLr3XNueni1GZ-07T8u9TuUhODIEyJHEVpu8Hrj_TKMVq6m7v-h478xV0bmghG3fdth2nTjMOcIIT9Enp7bKOa-nPtUmGC2xM7IEkDcH-MguKdbmWDCVOZzvAKkPXXiyLM6BeeGM-FtTqs91rTw8i-ySjStBvK2aFM16geCknnP8PYR5MDOieG1YFSr4cU5X524L-YhVwFTTjO0u4lmfC8PRcdpU4zP_56Uthtf99Rs_2YFmhuFkiYxeGh17n8DtkbkjLxBUiAS',
  overlayOpacity: 0.5, // Default overlay opacity
  tasbeeh: {
    akbarColor: '#166534', // Green-800
    hamdColor: '#92400e',  // Amber-800
    subhanColor: '#1e40af', // Blue-800
    backgroundImage: null
  },
  quranVerse: {
    backgroundImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbIaLr3XNueni1GZ-07T8u9TuUhODIEyJHEVpu8Hrj_TKMVq6m7v-h478xV0bmghG3fdth2nTjMOcIIT9Enp7bKOa-nPtUmGC2xM7IEkDcH-MguKdbmWDCVOZzvAKkPXXiyLM6BeeGM-FtTqs91rTw8i-ySjStBvK2aFM16geCknnP8PYR5MDOieG1YFSr4cU5X524L-YhVwFTTjO0u4lmfC8PRcdpU4zP_56Uthtf99Rs_2YFmhuFkiYxeGh17n8DtkbkjLxBUiAS'
  },
  quran: DEFAULT_QURAN_SETTINGS,
  duaAhd: {
    // Default High-Quality Sunrise Image
    backgroundImage: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?q=80&w=2741&auto=format&fit=crop'
  },
  duaSabah: {
    // Default Soft Morning Sky
    backgroundImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop'
  },
  ramadanDuas: {
    // Updated to use the local file path as requested
    backgroundImage: 'file:///C:/Users/mohlb/Downloads/Prompt_english__202602071919.jpeg'
  },
  ramadanDuaSystem: createDefaultRamadanDuaSystemSettings(),
  postIsha: {
    backgroundImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKt-AgcXvnmu-r1LP0mxgN2aGTi_XwCs6RxQUa3huujCLACJ0fhDR2AMUxQqwQZfdq63Aa1x3B9jFzIVxMZrMSXFiEqZuTOS9h2TEo6-qaNgf0HqyRvviftpfoSPl9ik4Ox6KZXVgw_4JKWGYzCZjTsozf7RqiTTeRZSJIMY26etRnxl4wXTtZd_cg-CMYyqrbXmYTOR6J-HZU9bTJGGJmQPo8RoK12ztKkmpkyrdYLNAkPSjvZ19pG0pANbAEDLx-s1GD23iBMzg'
  },
  announcement: {
    enabled: true,
    title: 'إعلان المسجد',
    body: 'هنا يمكنك كتابة فقرة الشيخ أو أي تنبيه مهم للمصلين.',
    durationSec: 30,
    accentColor: '#f4c95d',
    backgroundImage: null,
    triggerAfterPrayers: []
  }
};

// SHIA PRAYER STRUCTURE - Restored Asr and Isha
export const INITIAL_PRAYER_SCHEDULE = [
  { id: 'imsak', nameAR: 'الإمساك', nameEN: 'Imsak', time: '04:40', icon: 'moon' },
  { id: 'fajr', nameAR: 'الفجر', nameEN: 'Fajr', time: '04:56', icon: 'moon' },
  { id: 'sunrise', nameAR: 'الشروق', nameEN: 'Sunrise', time: '06:22', icon: 'sunrise' },
  { id: 'dhuhr', nameAR: 'الظهر', nameEN: 'Dhuhr', time: '12:03', icon: 'sun' },
  { id: 'asr', nameAR: 'العصر', nameEN: 'Asr', time: '', icon: 'sun' }, // No default time
  { id: 'maghrib', nameAR: 'المغرب', nameEN: 'Maghrib', time: '17:35', icon: 'sunset' },
  { id: 'isha', nameAR: 'العشاء', nameEN: 'Isha', time: '', icon: 'moon' }, // No default time
] as const;

