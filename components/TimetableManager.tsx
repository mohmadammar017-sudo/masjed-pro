import React, { useState, useEffect } from 'react';
import { MonthlySchedule, TimetableDay } from '../types';
import { getHijriDay } from '../utils';
import TimetableUploader from './TimetableUploader';
import IOSTimePicker from './IOSTimePicker';
interface TimetableManagerProps {
  schedule: MonthlySchedule | null;
  onUpdate: (schedule: MonthlySchedule) => void;
  hijriOffset?: number;
  onApplyDay?: (dayNumber: number | null) => void;
}
type ViewMode = 'list' | 'ai_upload' | 'manual_entry';
const DEFAULT_DAY: TimetableDay = {
  day_number: 1,
  day_name: '',
  hijri_date: '',
  imsak: '',
  fajr: '',
  sunrise: '',
  dhuhr: '',
  asr: '',
  maghrib: '',
  isha: '',
  end_isha: '',
  event: ''
};
const inferIsHijriSchedule = (monthName: string = '', days: TimetableDay[] = []): boolean => {
  const text = `${monthName} ${days.map((d) => d.hijri_date || '').join(' ')}`.toLowerCase();
  const keywords = [
    'ramadan', 'رمضان', 'muharram', 'محرم', 'safar', 'صفر',
    'rabi', 'ربيع', 'jumada', 'جمادى', 'rajab', 'رجب',
    'shaaban', 'shaban', 'شعبان', 'shawwal', 'شوال',
    'dhul', 'ذو', 'hijri', 'هجري'
  ];
  return keywords.some((keyword) => text.includes(keyword));
};
const TimetableManager: React.FC<TimetableManagerProps> = ({ schedule, onUpdate, hijriOffset = 0, onApplyDay }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingDay, setEditingDay] = useState<TimetableDay | null>(null);
  const [manualForm, setManualForm] = useState<TimetableDay>(DEFAULT_DAY);
  const [monthName, setMonthName] = useState(schedule?.monthName || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeField, setActiveField] = useState<{key: keyof TimetableDay, label: string, icon: string} | null>(null);
  const [todayDayNum, setTodayDayNum] = useState(-1);
  const tableRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const day = schedule?.isHijri
      ? getHijriDay(new Date(), hijriOffset)
      : new Date().getDate();
    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      setTodayDayNum(day);
      return;
    }
    setTodayDayNum(-1);
  }, [schedule?.isHijri, hijriOffset]);
  const scrollToToday = () => {
    const todayElement = document.getElementById(`day-row-${todayDayNum}`);
    if (todayElement) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      todayElement.classList.add('ring-4', 'ring-gold-500', 'ring-opacity-50');
      setTimeout(() => todayElement.classList.remove('ring-4', 'ring-gold-500', 'ring-opacity-50'), 2000);
    }
  };
  // Sync monthName with schedule prop
  useEffect(() => {
    if (schedule?.monthName) {
      setMonthName(schedule.monthName);
    }
  }, [schedule?.monthName]);
  useEffect(() => {
    if (!monthName) {
        try {
            const today = new Date();
            const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { month: 'long', year: 'numeric' });
            setMonthName(formatter.format(today));
        } catch (e) {
            console.error("Date format error", e);
        }
    }
  }, [monthName]);
  const handleManualSubmit = () => {
    if (!manualForm.day_number) return alert('يرجى إدخال رقم اليوم');
    const currentDays = schedule?.days ? [...schedule.days] : [];
    // Ensure day_number is a number
    const dayNum = Number(manualForm.day_number);
    const dayData = { ...manualForm, day_number: dayNum, end_isha: '' };
    const existingIndex = currentDays.findIndex(d => Number(d.day_number) === dayNum);
    if (existingIndex >= 0) {
      currentDays[existingIndex] = dayData;
    } else {
      currentDays.push(dayData);
    }
    // Sort
    currentDays.sort((a, b) => Number(a.day_number) - Number(b.day_number));
    const isHijri = typeof schedule?.isHijri === 'boolean'
      ? schedule.isHijri
      : inferIsHijriSchedule(monthName, currentDays);
    onUpdate({
      monthName: monthName || 'جدول شهر',
      isHijri,
      days: currentDays,
      lastUpdated: Date.now()
    });
    if (dayNum === todayDayNum) {
        alert('تم حفظ التعديلات! سيتم تحديث الشاشة الرئيسية فوراً.');
    }
    setViewMode('list');
    setEditingDay(null);
    setManualForm(DEFAULT_DAY);
  };
  const handleDeleteDay = (dayNum: number) => {
    if (!window.confirm(`هل أنت متأكد من حذف بيانات اليوم ${dayNum}؟`)) return;
    const currentDays = schedule?.days || [];
    const updatedDays = currentDays.filter(d => Number(d.day_number) !== dayNum);
    const isHijri = typeof schedule?.isHijri === 'boolean'
      ? schedule.isHijri
      : inferIsHijriSchedule(monthName || schedule?.monthName || '', updatedDays);
    onUpdate({
      monthName: monthName || schedule?.monthName || 'جدول شهر',
      isHijri,
      days: updatedDays,
      lastUpdated: Date.now()
    });
  };
  const startEdit = (day: TimetableDay) => {
    setEditingDay(day);
    setManualForm(day);
    setViewMode('manual_entry');
  };
  const startAddManual = () => {
    setEditingDay(null);
    const todayExists = schedule?.days.some(d => Number(d.day_number) === todayDayNum);
    const maxDay = schedule?.days.length ? Math.max(...schedule.days.map(d => Number(d.day_number))) : 0;
    const nextDayNum = !todayExists ? todayDayNum : (maxDay + 1);
    let nextHijriDate = '';
    try {
        const targetDate = new Date();
        if (todayExists && maxDay > 0) {
             targetDate.setDate(targetDate.getDate() + (nextDayNum - todayDayNum));
        }
        nextHijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long' }).format(targetDate);
    } catch(e) {}
    setManualForm({ ...DEFAULT_DAY, day_number: nextDayNum, hijri_date: nextHijriDate });
    setViewMode('manual_entry');
    setShowAddMenu(false);
  };
  const handleAISuccess = (newSchedule: MonthlySchedule) => {
    if (schedule?.days.length && schedule.days.length > 0) {
       if (!confirm("تنبيه: سيتم استبدال الجدول الحالي بالكامل بالجدول الجديد المستخرج من الصورة.\nهل تريد المتابعة؟")) {
         return;
       }
    }
    const normalizedSchedule = {
      ...newSchedule,
      isHijri: typeof newSchedule.isHijri === 'boolean'
        ? newSchedule.isHijri
        : inferIsHijriSchedule(newSchedule.monthName, newSchedule.days || [])
    };
    onUpdate(normalizedSchedule);
    setMonthName(newSchedule.monthName);
    setViewMode('list');
  };
  const openTimePicker = (key: keyof TimetableDay, label: string, icon: string) => {
      setActiveField({ key, label, icon });
      setPickerOpen(true);
  };
  const TimeInputCard = ({ label, valueKey, icon, colorClass = "text-white", glowColor = "rgba(236,163,21,0.3)" }: { label: string, valueKey: keyof TimetableDay, icon: string, colorClass?: string, glowColor?: string }) => (
    <div 
        className={`relative bg-white/70 hover:bg-white rounded-[1.5rem] p-4 border border-slate-200 transition-all cursor-pointer group flex flex-col items-center gap-2 active:scale-95 shadow-[0_14px_34px_rgba(42,34,24,0.07)]`}
        onClick={() => openTimePicker(valueKey, label, icon)}
    >
        <div className="absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity blur-xl z-0" style={{ backgroundColor: glowColor }}></div>
        <div className={`w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl relative z-10 transition-transform group-hover:scale-110 ${colorClass}`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <div className="relative z-10 text-center">
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1 group-hover:text-slate-700 transition-colors">{label}</label>
            <div className={`text-2xl font-black font-sans tracking-tighter ${manualForm[valueKey] ? colorClass : 'text-slate-300'}`}>
                {manualForm[valueKey] || '--:--'}
            </div>
        </div>
    </div>
  );
  const todayData = schedule?.days.find(d => Number(d.day_number) === todayDayNum);
  return (
    <div className="admin-timetable-manager flex flex-col h-full space-y-6 animate-fade-in relative pb-8">
      <IOSTimePicker 
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialValue={(activeField ? manualForm[activeField.key] as string : "")}
        title={activeField?.label || "اختيار الوقت"}
        onSave={(t) => activeField && setManualForm({...manualForm, [activeField.key]: t})}
      />
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl z-10 shadow-2xl">
         <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner">
               <i className="fa-solid fa-calendar-check text-3xl"></i>
            </div>
            <div>
               <h2 className="text-xl font-bold text-white">إدارة جدول الصلاة</h2>
               <div className="flex items-center gap-3 mt-1">
                   <input 
                      type="text" 
                      value={monthName}
                      onChange={(e) => {
                         setMonthName(e.target.value);
                         if(schedule) onUpdate({ ...schedule, monthName: e.target.value, isHijri: inferIsHijriSchedule(e.target.value, schedule.days || []) });
                      }}
                      className="bg-transparent border-b border-white/20 text-gold-500 font-black text-xl focus:border-gold-500 outline-none w-56 transition-all placeholder-gray-600"
                   />
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            {todayDayNum !== -1 && viewMode === 'list' && (
               <button 
                 onClick={scrollToToday}
                 className="bg-white/5 hover:bg-gold-500 text-gold-500 hover:text-black font-bold py-4 px-6 rounded-2xl border border-white/10 transition-all flex items-center gap-3"
               >
                 <i className="fa-solid fa-location-crosshairs"></i>
                 <span>الذهاب لليوم الحالي</span>
               </button>
            )}
            <div className="relative">
            <button 
               onClick={() => setShowAddMenu(!showAddMenu)}
               className="bg-gold-600 hover:bg-gold-500 text-white font-bold py-4 px-8 rounded-2xl shadow-[0_10px_30px_rgba(212,172,13,0.3)] flex items-center gap-4 transition-all transform hover:-translate-y-1 active:scale-95"
            >
               <i className="fa-solid fa-circle-plus text-xl"></i>
               <span className="text-lg">إضافة يوم صلاة</span>
            </button>
            {showAddMenu && (
               <div className="absolute top-full left-0 mt-3 w-64 bg-[#0f172a] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-fade-in ring-1 ring-gold-500/20">
                  <button onClick={startAddManual} className="w-full text-right px-5 py-4 text-gray-200 hover:bg-gold-500 hover:text-white flex items-center gap-4 transition-all border-b border-white/5">
                     <i className="fa-solid fa-hand-pointer text-indigo-400 group-hover:text-white"></i> إضافة يدوية فخمة
                  </button>
                  <button onClick={() => { setViewMode('ai_upload'); setShowAddMenu(false); }} className="w-full text-right px-5 py-4 text-gray-200 hover:bg-gold-500 hover:text-white flex items-center gap-4 transition-all border-b border-white/5">
                     <i className="fa-solid fa-microchip text-gold-400 group-hover:text-white"></i> ذكاء اصطناعي (صورة)
                  </button>
               </div>
            )}
            {showAddMenu && <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)}></div>}
         </div>
      </div>
    </div>
      {viewMode === 'ai_upload' && (
          <div className="flex-1 bg-slate-900/40 rounded-[3rem] border border-white/10 p-8">
              <TimetableUploader onSave={handleAISuccess} onCancel={() => setViewMode('list')} />
          </div>
      )}
      {/* --- QUICK LOOK TODAY --- */}
      {todayData && viewMode === 'list' && (
          <div className="w-full bg-slate-900/40 border border-white/10 rounded-[3rem] p-8 relative overflow-hidden group backdrop-blur-md">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-gold-500/10 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="flex justify-between items-center mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-gold-500/20 rounded-full flex items-center justify-center text-gold-500 animate-pulse"><i className="fa-solid fa-bolt"></i></div>
                     <h3 className="text-white font-black text-2xl tracking-tight">أوقات اليوم ({todayData.hijri_date})</h3>
                  </div>
                  <button onClick={() => startEdit(todayData)} className="px-6 py-2 bg-white/5 hover:bg-gold-500 hover:text-white text-sm font-bold rounded-xl text-gray-300 transition-all border border-white/10">
                      تعديل سريع
                  </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative z-10">
                  {[
                      { l: 'الإمساك', v: todayData.imsak, c: 'text-gray-300' },
                      { l: 'الفجر', v: todayData.fajr, c: 'text-gold-400' }, 
                      { l: 'الشروق', v: todayData.sunrise, c: 'text-orange-300' }, 
                      { l: 'الظهر', v: todayData.dhuhr, c: 'text-white' }, 
                      { l: 'المغرب', v: todayData.maghrib, c: 'text-gold-400' }
                  ].map((t, i) => (
                      <div key={i} className="bg-black/20 rounded-2xl p-4 text-center border border-white/5 backdrop-blur-lg">
                          <div className="text-gray-500 text-[10px] font-bold uppercase mb-1">{t.l}</div>
                          <div className={`${t.c} font-black font-sans text-xl`}>{t.v || '--:--'}</div>
                      </div>
                  ))}
              </div>
          </div>
      )}
      {/* --- TABLE --- */}
      {viewMode === 'list' && (
          <div className="flex-1 overflow-hidden rounded-[3rem] border border-white/10 bg-slate-950/40 backdrop-blur-2xl flex flex-col relative z-0 shadow-2xl">
             {(!schedule?.days || schedule.days.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-20 text-center">
                   <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mb-6"><i className="fa-solid fa-calendar-xmark text-6xl opacity-30"></i></div>
                   <p className="text-2xl font-bold">الجدول فارغ</p>
                   <p className="mt-2 text-gray-600">ابدأ بإضافة أول صلاة ليرى الجميع الأوقات المباركة</p>
                </div>
             ) : (
                <div className="flex-1 overflow-auto dashboard-scroll">
                   <table className="w-full text-right border-collapse">
                      <thead className="bg-black/40 text-gray-400 text-[11px] font-black uppercase sticky top-0 backdrop-blur-3xl z-10 border-b border-white/5">
                         <tr>
                            <th className="p-6">اليوم</th>
                            <th className="p-6">الفجر</th>
                            <th className="p-6">الشروق</th>
                            <th className="p-6">الظهر</th>
                            <th className="p-6">المغرب</th>
                            <th className="p-6 hidden md:table-cell">الإمساك</th>
                            <th className="p-6 text-center">إجراءات</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {[...schedule.days].sort((a,b) => Number(a.day_number) - Number(b.day_number)).map((day) => {
                            const isToday = Number(day.day_number) === todayDayNum;
                            return (
                            <tr key={day.day_number} id={`day-row-${day.day_number}`} className={`transition-all group ${isToday ? 'today-row' : 'hover:bg-white/5'}`}>
                               <td className="p-6 font-bold text-white flex items-center gap-4">
                                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-sans font-black ${isToday ? 'bg-gold-500 text-black shadow-lg shadow-gold-500/30' : 'bg-white/5 text-gray-400'}`}>{day.day_number}</span>
                                  <div className="flex flex-col">
                                     <span className="text-sm text-gray-400 font-bold">{day.hijri_date}</span>
                                     {isToday && <span className="text-[10px] text-gold-500 font-bold uppercase tracking-wider animate-pulse">(اليوم)</span>}
                                  </div>
                               </td>
                               <td className="p-6 text-gold-400 font-black font-sans text-lg">{day.fajr || '-'}</td>
                               <td className="p-6 text-orange-200 font-bold font-sans text-lg">{day.sunrise || '-'}</td>
                               <td className="p-6 text-white font-black font-sans text-lg">{day.dhuhr || '-'}</td>
                               <td className="p-6 text-gold-400 font-black font-sans text-lg">{day.maghrib || '-'}</td>
                               <td className="p-6 text-gray-300 font-black font-sans text-lg hidden md:table-cell">{day.imsak || '-'}</td>
                               <td className="p-6 flex items-center justify-center gap-3">
                                  {onApplyDay && (
                                    <button 
                                       onClick={() => onApplyDay(Number(day.day_number))} 
                                       className="px-3 py-2 bg-gold-500/20 text-gold-500 hover:bg-gold-500 hover:text-black rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                       title="اعتماد هذا اليوم"
                                    >
                                       <i className="fa-solid fa-check-double"></i>
                                       <span>اعتماد</span>
                                    </button>
                                  )}
                                  <button onClick={() => startEdit(day)} className="w-10 h-10 flex items-center justify-center bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all"><i className="fa-solid fa-pen-to-square"></i></button>
                                  <button 
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         handleDeleteDay(Number(day.day_number));
                                     }} 
                                     className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                  >
                                     <i className="fa-solid fa-trash-can"></i>
                                  </button>
                               </td>
                            </tr>
                         )})}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      )}
      {/* --- MANUAL ENTRY --- */}
      {viewMode === 'manual_entry' && (
          <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-3 md:p-6 animate-fade-in">
             <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-md" onClick={() => setViewMode('list')}></div>
             <div className="relative my-2 w-full max-w-5xl bg-white/95 backdrop-blur-3xl border border-slate-200 rounded-[2rem] shadow-[0_40px_90px_rgba(42,34,24,0.20)] overflow-hidden animate-slide-up flex flex-col max-h-[calc(100vh-1rem)]">
                <div className="p-5 md:p-7 overflow-y-auto dashboard-scroll relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-center gap-4 mb-6">
                        <div className="flex items-center gap-4">
                             <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-2xl shadow-xl ${editingDay ? 'bg-indigo-500/10 text-indigo-500' : 'bg-green-500/10 text-green-600'}`}>
                                 <i className={`fa-solid ${editingDay ? 'fa-pen-to-square' : 'fa-plus'}`}></i>
                             </div>
                             <div>
                                 <h2 className="text-2xl md:text-3xl font-black text-slate-950">{editingDay ? 'تعديل بيانات اليوم' : 'إضافة يوم جديد'}</h2>
                                 <p className="text-slate-500 mt-1 text-sm md:text-base">أدخل الأوقات بدقة، ثم احفظ اليوم مباشرة.</p>
                             </div>
                        </div>
                        <button onClick={() => setViewMode('list')} className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 mb-6">
                        <div className="space-y-6">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">معلومات اليوم</label>
                            <div className="grid gap-4 md:grid-cols-[180px,1fr]">
                                <div className="bg-white/80 rounded-[1.35rem] p-4 border border-slate-200">
                                    <label className="block text-slate-500 text-xs font-bold mb-2">رقم اليوم</label>
                                    <input type="number" className="w-full bg-transparent text-2xl font-black text-slate-950 outline-none" value={manualForm.day_number} onChange={e => setManualForm({...manualForm, day_number: parseInt(e.target.value)})} />
                                </div>
                                <div className="bg-white/80 rounded-[1.35rem] p-4 border border-slate-200">
                                    <label className="block text-slate-500 text-xs font-bold mb-2">التاريخ الهجري</label>
                                    <input type="text" className="w-full bg-transparent text-xl font-bold text-[#9a6417] outline-none placeholder:text-slate-400" placeholder="مثال: 1 محرم" value={manualForm.hijri_date} onChange={e => setManualForm({...manualForm, hijri_date: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2 block mb-4">أوقات الصلاة</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                        <TimeInputCard label="الإمساك" valueKey="imsak" icon="fa-moon" colorClass="text-gray-300" glowColor="rgba(148,163,184,0.35)" />
                        <TimeInputCard label="الفجر" valueKey="fajr" icon="fa-cloud-sun" colorClass="text-gold-400" glowColor="rgba(250, 204, 21, 0.4)" />
                        <TimeInputCard label="الشروق" valueKey="sunrise" icon="fa-sun" colorClass="text-orange-300" />
                        <TimeInputCard label="الظهر" valueKey="dhuhr" icon="fa-circle" colorClass="text-white" />
                        <TimeInputCard label="المغرب" valueKey="maghrib" icon="fa-cloud-moon" colorClass="text-purple-400" glowColor="rgba(192, 132, 252, 0.4)" />
                    </div>
                    <div className="sticky bottom-0 mt-8 flex justify-end gap-3 border-t border-slate-100 bg-white/90 pt-4 backdrop-blur">
                        <button onClick={() => setViewMode('list')} className="px-7 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all">إلغاء</button>
                        <button onClick={handleManualSubmit} className="px-9 py-3 rounded-2xl bg-[#b8791f] hover:bg-[#9a6417] text-white font-bold shadow-lg shadow-amber-900/10 transform hover:-translate-y-0.5 transition-all flex items-center gap-3">
                            <i className="fa-solid fa-check"></i> حفظ التغييرات
                        </button>
                    </div>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};
export default TimetableManager;
