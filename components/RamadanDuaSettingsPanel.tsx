import React, { memo, useMemo } from 'react';
import { RamadanDuaSystemSettings } from '../types';
import { normalizeRamadanDuaSystemSettings } from '../data/ramadanDuaLibrary';

interface RamadanDuaSettingsPanelProps {
  value: RamadanDuaSystemSettings;
  onChange: (next: RamadanDuaSystemSettings) => void;
  onPreview: (duaId?: string) => void;
  onOpenLibrary?: () => void;
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange, hint }) => (
  <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/10">
    <div className="flex flex-col">
      <span className="text-gray-200 font-bold">{label}</span>
      {hint && <span className="text-xs text-gray-400 mt-1">{hint}</span>}
    </div>
    <label className="relative inline-flex items-center cursor-pointer" dir="ltr">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div
        className={`w-[4.5rem] h-9 rounded-full transition-all duration-500 border border-white/10 backdrop-blur-md shadow-inner ${
          checked ? 'bg-gradient-to-r from-gold-500 to-gold-400 border-gold-400/50' : 'bg-black/30'
        }`}
      ></div>
      <div
        className={`absolute top-1 left-1 bg-white h-7 w-7 rounded-full shadow transition-all duration-500 ${
          checked ? 'translate-x-[2.75rem]' : 'translate-x-0'
        }`}
      ></div>
    </label>
  </div>
);

const RamadanDuaSettingsPanel: React.FC<RamadanDuaSettingsPanelProps> = ({ value, onChange, onPreview, onOpenLibrary }) => {
  const normalized = useMemo(() => normalizeRamadanDuaSystemSettings(value), [value]);
  const orderedDuas = useMemo(() => {
    const byId = new Map(normalized.duas.map((dua) => [dua.id, dua]));
    const fromOrder = normalized.duaOrder
      .map((id) => byId.get(id))
      .filter((dua): dua is (typeof normalized.duas)[number] => Boolean(dua));
    const missing = normalized.duas.filter((dua) => !normalized.duaOrder.includes(dua.id));
    return [...fromOrder, ...missing];
  }, [normalized.duas, normalized.duaOrder]);

  const update = (patch: Partial<RamadanDuaSystemSettings>) => {
    onChange({ ...normalized, ...patch });
  };

  const onBackgroundUpload = async (file?: File) => {
    if (!file) return;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('failed to read image'));
      reader.readAsDataURL(file);
    });
    update({ backgroundImage: base64 });
  };

  const availableDuas = normalized.duas.length;
  const activeDuas = normalized.duas.filter((dua) => dua.active).length;

  return (
    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">نظام أدعية رمضان</h3>
          <p className="text-sm text-gray-400 mt-1">مفعّل: {activeDuas} من {availableDuas} دعاء</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPreview()} className="px-4 py-2 rounded-xl bg-gold-500 text-black font-bold hover:bg-gold-400">
            معاينة
          </button>
          <button
            onClick={() => onOpenLibrary?.()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            مكتبة الأدعية
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToggleRow label="تفعيل عرض الأدعية" checked={normalized.enabled} onChange={(checked) => update({ enabled: checked })} />
        <ToggleRow label="تدوير تلقائي للأدعية" checked={normalized.autoRotate} onChange={(checked) => update({ autoRotate: checked })} />
        <ToggleRow label="وضع التحكم عن بعد" checked={normalized.remoteControlMode} onChange={(checked) => update({ remoteControlMode: checked })} />
        <ToggleRow label="ثيم رمضان" checked={normalized.ramadanTheme} onChange={(checked) => update({ ramadanTheme: checked })} />
        <ToggleRow label="الوضع الليلي" checked={normalized.nightMode} onChange={(checked) => update({ nightMode: checked })} />
        <ToggleRow
          label="تقليب الصفحات مع السطر"
          checked={normalized.autoScrollLongDuas}
          onChange={(checked) => update({ autoScrollLongDuas: checked })}
          hint="عند الانتقال بالريموت ينتقل الدعاء تلقائيًا إلى الصفحة التالية أو السابقة حسب موقع السطر"
        />
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/10 space-y-3">
        <h4 className="text-white font-bold">أسلوب التنقل داخل الدعاء</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => update({ advanceMode: 'manual' })}
            className={`p-4 rounded-2xl border text-right transition ${
              normalized.advanceMode === 'manual'
                ? 'bg-gradient-to-br from-gold-500/30 to-amber-200/10 border-gold-400 text-gold-100 shadow-lg shadow-gold-500/10'
                : 'bg-slate-900/70 border-white/10 text-gray-200 hover:border-gold-500/40'
            }`}
          >
            <div className="font-bold">يدوي بالريموت</div>
            <div className="text-sm mt-1 text-gray-300">السطر والمؤشر ينزلان فقط عند الضغط من الريموت</div>
          </button>
          <button
            onClick={() => update({ advanceMode: 'auto' })}
            className={`p-4 rounded-2xl border text-right transition ${
              normalized.advanceMode === 'auto'
                ? 'bg-gradient-to-br from-cyan-500/25 to-sky-200/10 border-cyan-400 text-cyan-100 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900/70 border-white/10 text-gray-200 hover:border-cyan-500/40'
            }`}
          >
            <div className="font-bold">تلقائي</div>
            <div className="text-sm mt-1 text-gray-300">يتقدم السطر تلقائيًا حسب المدة المحددة بالأسفل</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm text-gray-300 block mb-2">
            مدة الانتقال التلقائي لكل سطر (ثانية): {normalized.displayDurationSec}
          </label>
          <input
            type="range"
            min={4}
            max={40}
            step={1}
            value={normalized.displayDurationSec}
            onChange={(e) => update({ displayDurationSec: Number(e.target.value) })}
            disabled={normalized.advanceMode !== 'auto'}
            className={`w-full ${normalized.advanceMode !== 'auto' ? 'opacity-40 cursor-not-allowed' : ''}`}
          />
          {normalized.advanceMode !== 'auto' && (
            <p className="text-xs text-gray-400 mt-2">الوضع اليدوي مفعل، لذلك لن يتم التحريك التلقائي إلا إذا غيّرته إلى تلقائي.</p>
          )}
        </div>
        <div>
          <label className="text-sm text-gray-300 block mb-2">حجم نص الدعاء فقط: {normalized.fontScale.toFixed(2)}x</label>
          <input
            type="range"
            min={0.8}
            max={1.8}
            step={0.05}
            value={normalized.fontScale}
            onChange={(e) => update({ fontScale: Number(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-gray-400 mt-2">الإطار واسم الدعاء يبقيان ثابتين. عند التصغير يستوعب الصندوق نصاً أكثر، وعند التكبير يزيد عدد الصفحات تلقائيًا.</p>
        </div>
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/10 space-y-3">
        <h4 className="text-white font-bold">أتمتة قبل الصلاة</h4>
        <ToggleRow
          label="تفعيل عرض دعاء قبل وقت الصلاة"
          checked={normalized.automation.enabled}
          onChange={(checked) => update({ automation: { ...normalized.automation, enabled: checked } })}
          hint="يظهر الدعاء تلقائيًا قبل الصلاة بالوقت المحدد"
        />
        <div>
          <label className="text-gray-300 text-sm block mb-1">قبل الصلاة بـ (دقائق)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={normalized.automation.minutesBeforePrayer}
            onChange={(e) => update({ automation: { ...normalized.automation, minutesBeforePrayer: Number(e.target.value) || 1 } })}
            className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
          />
        </div>
        {(['fajr', 'dhuhr', 'maghrib'] as const).map((prayer) => (
          <div key={prayer}>
            <label className="text-gray-300 text-sm block mb-1">
              دعاء {prayer === 'fajr' ? 'الفجر' : prayer === 'dhuhr' ? 'الظهر' : 'المغرب'}
            </label>
            <select
              value={normalized.automation.beforePrayerDuaByPrayer[prayer]}
              onChange={(e) =>
                update({
                  automation: {
                    ...normalized.automation,
                    beforePrayerDuaByPrayer: {
                      ...normalized.automation.beforePrayerDuaByPrayer,
                      [prayer]: e.target.value
                    }
                  }
                })
              }
              className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
            >
              {orderedDuas.map((dua) => (
                <option key={dua.id} value={dua.id}>
                  {dua.title}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/10 space-y-3">
        <h4 className="text-white font-bold">خلفية صفحة الأدعية</h4>
        <div>
          <label className="text-sm text-gray-300 block mb-2">لون الخلفية والتدرج</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={normalized.backgroundColor}
              onChange={(e) => update({ backgroundColor: e.target.value })}
              className="h-12 w-20 bg-transparent rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={normalized.backgroundColor}
              onChange={(e) => update({ backgroundColor: e.target.value || '#07111f' })}
              className="flex-1 p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
              placeholder="#07111f"
            />
          </div>
        </div>
        <input
          type="text"
          value={normalized.backgroundImage || ''}
          onChange={(e) => update({ backgroundImage: e.target.value || null })}
          className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
          placeholder="رابط صورة الخلفية (اختياري)"
        />
        <input type="file" accept="image/*" onChange={(e) => onBackgroundUpload(e.target.files?.[0])} className="text-sm text-gray-200" />
        <button
          type="button"
          onClick={() => update({ backgroundImage: null })}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
        >
          حذف صورة الخلفية والاعتماد على اللون
        </button>
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/10 space-y-3">
        <h4 className="text-white font-bold">شريط القراءة</h4>
        <ToggleRow
          label="إظهار شريط القراءة"
          checked={normalized.showReadingBar}
          onChange={(checked) => update({ showReadingBar: checked })}
          hint="إذا أطفأته يتحول الريموت إلى تقليب الصفحات مباشرة بدل التحرك سطرًا بسطر"
        />
        <div>
          <label className="text-sm text-gray-300 block mb-2">لون الشريط</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={normalized.readingBarColor}
              onChange={(e) => update({ readingBarColor: e.target.value })}
              className="h-12 w-20 bg-transparent rounded-lg cursor-pointer"
              disabled={!normalized.showReadingBar}
            />
            <input
              type="text"
              value={normalized.readingBarColor}
              onChange={(e) => update({ readingBarColor: e.target.value || '#f6c657' })}
              className={`flex-1 p-3 rounded-xl bg-slate-900 border border-white/10 text-white ${!normalized.showReadingBar ? 'opacity-50' : ''}`}
              placeholder="#f6c657"
              disabled={!normalized.showReadingBar}
            />
          </div>
          {!normalized.showReadingBar && <p className="text-xs text-gray-400 mt-2">فعّل شريط القراءة أولاً حتى يظهر على النص أثناء التنقل.</p>}
        </div>
      </div>
    </div>
  );
};

export default memo(RamadanDuaSettingsPanel);
