
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/AM|PM/, '');
};

export const getAmPm = (date: Date): string => {
  return date.getHours() >= 12 ? 'PM' : 'AM';
};

export const formatDateAR = (date: Date, offset: number = 0): string => {
  const baseDate = new Date(date);
  const adjustedDate = new Date(date);
  adjustedDate.setDate(adjustedDate.getDate() + offset);

  try {
    const weekday = new Intl.DateTimeFormat('ar-SA', {
      weekday: 'long'
    }).format(baseDate);

    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const parts = formatter.formatToParts(adjustedDate);
    const day = parts.find((part) => part.type === 'day')?.value || '';
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const year = parts.find((part) => part.type === 'year')?.value || '';
    const hijriDate = [day, month, year].filter(Boolean).join(' ').trim();

    return `${weekday} ${hijriDate} هـ`.trim();
  } catch (e) {
    // Fallback if Intl fails
    const weekday = baseDate.toLocaleDateString('ar-SA', { weekday: 'long' });
    const hijriDate = adjustedDate.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return `${weekday} ${hijriDate} هـ`.trim();
  }
};

const normalizeLocaleDigits = (value: string): string => {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0));
};

const extractNumericValue = (value: string): number => {
  const normalized = normalizeLocaleDigits(value || '');
  const match = normalized.match(/\d+/);
  return match ? parseInt(match[0], 10) : NaN;
};

export const getHijriDay = (date: Date, offset: number = 0): number => {
  const adjustedDate = new Date(date);
  adjustedDate.setDate(adjustedDate.getDate() + offset);
  try {
    const locales = ['ar-SA-u-ca-islamic-umalqura', 'en-u-ca-islamic-umalqura'];

    for (const locale of locales) {
      try {
        const parts = new Intl.DateTimeFormat(locale, { day: 'numeric' }).formatToParts(adjustedDate);
        const dayPart = parts.find((part) => part.type === 'day');
        if (dayPart) {
          const parsed = extractNumericValue(dayPart.value);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
            return parsed;
          }
        }
      } catch (e) {}
    }

    for (const locale of locales) {
      try {
        const str = adjustedDate.toLocaleDateString(locale, { day: 'numeric' });
        const parsed = extractNumericValue(str);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
          return parsed;
        }
      } catch (e) {}
    }

    return -1;
  } catch (e) {
    return -1;
  }
};

// Convert "HH:mm" string to Date object for today
export const parseTime = (timeStr: string): Date => {
  if (!timeStr) return new Date(); // Fallback
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

// --- PRECISION TIME HELPERS ---
export const getMinutesSinceMidnight = (date: Date): number => {
  return date.getHours() * 60 + date.getMinutes();
};

export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image'));
    image.src = src;
  });
};

const optimizeImageFile = async (file: File): Promise<string> => {
  if (typeof document === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return readFileAsDataUrl(file);
  }

  const shouldKeepOriginal = file.size <= 450 * 1024;
  if (shouldKeepOriginal) {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 1920 / Math.max(1, maxDimension));
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      return readFileAsDataUrl(file);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const preferredType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const optimized = canvas.toDataURL(preferredType, preferredType === 'image/jpeg' ? 0.84 : 0.88);

    return optimized.length > 64 ? optimized : readFileAsDataUrl(file);
  } catch (error) {
    console.error('[utils] Failed to optimize image, falling back to original data URL', error);
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const fileToDataUrl = async (file: File): Promise<string> => {
  return optimizeImageFile(file);
};

// Convert "HH:mm" (24h) to "hh:mm" (12h) + "AM/PM"
export const convert24to12 = (time24: string) => {
  if (!time24) return { hour: 12, minute: 0, period: 'AM', label: '--:--' };
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12; // Convert 0 to 12
  return { hour, minute: m, period, label: `${hour}:${m.toString().padStart(2, '0')} ${period === 'AM' ? 'ص' : 'م'}` };
};

// Convert 12h components back to "HH:mm" string
export const convert12to24 = (hour: number, minute: number, period: string) => {
  let h = hour;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    hours: h.toString().padStart(2, '0'),
    minutes: m.toString().padStart(2, '0'),
    seconds: s.toString().padStart(2, '0')
  };
};

// --- NEW EXPORTS FOR AUTH/ID ---

export const generateMosqueId = (): string => {
  // Generate a random 6-character alphanumeric ID
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const hashPin = async (pin: string): Promise<string> => {
  // Simple non-secure hash for client-side storage
  // In a production app with real auth, use bcrypt on server or Firebase Auth
  let hash = 0;
  if (pin.length === 0) return hash.toString();
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
};

