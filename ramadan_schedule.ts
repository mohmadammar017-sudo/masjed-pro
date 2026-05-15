import { MonthlySchedule } from './types';

// Keep only the first day as a safe fallback seed.
// User schedule is expected to be managed from the timetable editor/import.
export const RAMADAN_1446_SCHEDULE: MonthlySchedule = {
  monthName: 'جدول الصلاة',
  lastUpdated: Date.now(),
  isHijri: true,
  days: [
    {
      day_number: 1,
      day_name: 'الجمعة',
      hijri_date: '1 رمضان',
      imsak: '04:46',
      fajr: '04:56',
      sunrise: '06:15',
      dhuhr: '11:56',
      asr: '',
      maghrib: '17:49',
      isha: '',
      end_isha: '',
      event: ''
    }
  ]
};
