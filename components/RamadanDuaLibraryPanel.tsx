import React, { memo, useMemo, useState } from 'react';
import { RamadanDuaItem, RamadanDuaSystemSettings, DuaDisplaySlot, DuaWeekday } from '../types';
import { DEFAULT_DUA_WEEKDAYS, DUA_SLOT_OPTIONS, DUA_WEEKDAY_OPTIONS, normalizeWeekdays } from '../data/ramadanDuaLibrary';

interface RamadanDuaLibraryPanelProps {
  value: RamadanDuaSystemSettings;
  onChange: (next: RamadanDuaSystemSettings) => void;
  onPreview: (duaId?: string) => void;
}

interface ActiveSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const orderDuas = (duas: RamadanDuaItem[], order: string[]): RamadanDuaItem[] => {
  const byId = new Map(duas.map((dua) => [dua.id, dua]));
  const fromOrder = order.map((id) => byId.get(id)).filter((dua): dua is RamadanDuaItem => Boolean(dua));
  const missing = duas.filter((dua) => !order.includes(dua.id));
  return [...fromOrder, ...missing];
};

const WEEKDAY_PRESET_ALL: DuaWeekday[] = [...DEFAULT_DUA_WEEKDAYS];

const ActiveSwitch: React.FC<ActiveSwitchProps> = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer" dir="ltr">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div
      className={`w-[4.25rem] h-8 rounded-full transition-all duration-500 border border-white/10 backdrop-blur-md shadow-inner ${
        checked ? 'bg-gradient-to-r from-gold-500 to-gold-400 border-gold-400/50' : 'bg-black/30'
      }`}
    ></div>
    <div
      className={`absolute top-1 left-1 bg-white h-6 w-6 rounded-full shadow transition-all duration-500 ${
        checked ? 'translate-x-[2.5rem]' : 'translate-x-0'
      }`}
    ></div>
  </label>
);

const RamadanDuaLibraryPanel: React.FC<RamadanDuaLibraryPanelProps> = ({ value, onChange, onPreview }) => {
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [expandedDuaId, setExpandedDuaId] = useState<string | null>(null);

  const orderedDuas = useMemo(() => orderDuas(value.duas, value.duaOrder), [value.duas, value.duaOrder]);

  const update = (patch: Partial<RamadanDuaSystemSettings>) => {
    onChange({ ...value, ...patch });
  };

  const updateDua = (id: string, patch: Partial<RamadanDuaItem>) => {
    update({
      duas: value.duas.map((dua) => (dua.id === id ? { ...dua, ...patch } : dua))
    });
  };

  const moveDua = (id: string, dir: -1 | 1) => {
    const order = [...value.duaOrder];
    const index = order.indexOf(id);
    if (index < 0) return;
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    update({ duaOrder: order });
  };

  const toggleSlot = (dua: RamadanDuaItem, slot: DuaDisplaySlot) => {
    const currentSlots: DuaDisplaySlot[] = Array.isArray(dua.slots) ? dua.slots : ['general'];
    const hasSlot = currentSlots.includes(slot);
    const nextSlots = hasSlot ? currentSlots.filter((s) => s !== slot) : [...currentSlots, slot];
    updateDua(dua.id, { slots: nextSlots.length > 0 ? nextSlots : ['general'] });
  };

  const toggleWeekday = (dua: RamadanDuaItem, weekday: DuaWeekday) => {
    const currentWeekdays = normalizeWeekdays(dua.weekdays);
    const hasWeekday = currentWeekdays.includes(weekday);
    const nextWeekdays = hasWeekday
      ? currentWeekdays.filter((day) => day !== weekday)
      : [...currentWeekdays, weekday];
    updateDua(dua.id, { weekdays: nextWeekdays.length > 0 ? nextWeekdays : [...DEFAULT_DUA_WEEKDAYS] });
  };

  const applyAllWeekdays = (dua: RamadanDuaItem) => {
    updateDua(dua.id, { weekdays: [...WEEKDAY_PRESET_ALL] });
  };

  const addDua = () => {
    const title = newTitle.trim();
    const text = newText.trim();
    if (!title || !text) return;
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const created: RamadanDuaItem = {
      id,
      title,
      text,
      active: true,
      slots: ['general'],
      weekdays: [...DEFAULT_DUA_WEEKDAYS],
      isBuiltin: false
    };
    update({
      duas: [...value.duas, created],
      duaOrder: [...value.duaOrder, id]
    });
    setNewTitle('');
    setNewText('');
  };

  const removeDua = (id: string) => {
    const target = value.duas.find((dua) => dua.id === id);
    if (!target || target.isBuiltin) return;
    if (expandedDuaId === id) setExpandedDuaId(null);
    update({
      duas: value.duas.filter((dua) => dua.id !== id),
      duaOrder: value.duaOrder.filter((itemId) => itemId !== id)
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-white">مكتبة الأدعية</h3>
          <button onClick={() => onPreview()} className="px-4 py-2 rounded-xl bg-gold-500 text-black font-bold hover:bg-gold-400">
            معاينة النظام
          </button>
        </div>
        <p className="text-sm text-gray-400">
          أضف أدعية جديدة، حدد وقت الظهور قبل/بعد الصلاة، واضبط سرعة السطر لكل دعاء.
        </p>
      </div>

      <div className="bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
        <h4 className="text-lg font-bold text-white">إضافة دعاء جديد</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
            placeholder="اسم الدعاء"
          />
          <button
            onClick={addDua}
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            إضافة الدعاء للمكتبة
          </button>
          <div className="text-xs text-gray-400 flex items-center">
            بعد الإضافة يمكنك تحديد وقت الظهور من خيارات كل دعاء.
          </div>
        </div>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          rows={4}
          className="w-full p-3 rounded-xl bg-slate-950 border border-white/10 text-white font-amiri leading-8"
          placeholder="نص الدعاء الكامل..."
        />
      </div>

      <div className="space-y-4">
        {orderedDuas.map((dua) => {
          const isExpanded = expandedDuaId === dua.id;
          const selectedWeekdays = normalizeWeekdays(dua.weekdays);
          const allDaysSelected = selectedWeekdays.length === DEFAULT_DUA_WEEKDAYS.length;

          return (
            <div key={dua.id} className="rounded-3xl border border-white/10 bg-slate-900/40 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <ActiveSwitch checked={dua.active} onChange={(checked) => updateDua(dua.id, { active: checked })} />
                  <input
                    type="text"
                    value={dua.title}
                    onChange={(e) => updateDua(dua.id, { title: e.target.value })}
                    className="bg-transparent border-b border-white/20 text-white font-bold outline-none min-w-[260px]"
                  />
                  {dua.isBuiltin && <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">أساسي</span>}
                  <button
                    type="button"
                    onClick={() => setExpandedDuaId((previous) => (previous === dua.id ? null : dua.id))}
                    className="h-8 w-8 rounded-full border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 transition flex items-center justify-center"
                    title={isExpanded ? 'إخفاء الإعدادات' : 'إظهار الإعدادات'}
                    aria-label={isExpanded ? 'إخفاء إعدادات الدعاء' : 'إظهار إعدادات الدعاء'}
                  >
                    <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}></i>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => moveDua(dua.id, -1)} className="px-3 py-1 rounded-lg bg-white/10 text-white">أعلى</button>
                  <button onClick={() => moveDua(dua.id, 1)} className="px-3 py-1 rounded-lg bg-white/10 text-white">أسفل</button>
                  <button onClick={() => onPreview(dua.id)} className="px-3 py-1 rounded-lg bg-gold-500 text-black font-bold">معاينة</button>
                  {!dua.isBuiltin && (
                    <button onClick={() => removeDua(dua.id)} className="px-3 py-1 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-bold">
                      حذف
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-fade-in">
                  <div className="bg-black/20 p-3 rounded-2xl border border-white/10">
                    <label className="text-sm text-gray-300 block mb-2">سرعة السطر لهذا الدعاء (اختياري)</label>
                    <input
                      type="number"
                      min={4}
                      max={60}
                      value={dua.lineDurationSec ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (!raw) {
                          updateDua(dua.id, { lineDurationSec: undefined });
                          return;
                        }
                        const numeric = Math.max(4, Math.min(60, Number(raw) || 12));
                        updateDua(dua.id, { lineDurationSec: numeric });
                      }}
                      className="w-full p-3 rounded-xl bg-slate-900 border border-white/10 text-white"
                      placeholder={`افتراضي: ${value.displayDurationSec} ثانية`}
                    />
                  </div>

                  <div className="bg-black/20 p-3 rounded-2xl border border-white/10">
                    <div className="text-sm text-gray-300 mb-2">أوقات الظهور</div>
                    <div className="flex flex-wrap gap-2">
                      {DUA_SLOT_OPTIONS.map((slot) => {
                        const enabled = (dua.slots || []).includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            onClick={() => toggleSlot(dua, slot.id)}
                            className={`px-3 py-1 rounded-full text-xs border transition ${
                              enabled
                                ? 'bg-gold-500 text-black border-gold-400 font-bold'
                                : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/10'
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-black/20 p-3 rounded-2xl border border-white/10 space-y-3">
                    <div className="text-sm text-gray-300">أيام تشغيل الدعاء</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyAllWeekdays(dua)}
                        className={`px-3 py-1 rounded-full text-xs border transition ${
                          allDaysSelected
                            ? 'bg-gold-500 text-black border-gold-400 font-bold'
                            : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/10'
                        }`}
                      >
                        كل الأيام
                      </button>
                      <button
                        type="button"
                        onClick={() => undefined}
                        className="hidden px-3 py-1 rounded-full text-xs border transition bg-white/5 text-gray-300 border-white/20"
                      >
                        الجمعة فقط
                      </button>
                      <button
                        type="button"
                        onClick={() => undefined}
                        className="hidden px-3 py-1 rounded-full text-xs border transition bg-white/5 text-gray-300 border-white/20"
                      >
                        كل الأيام ما عدا الجمعة
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DUA_WEEKDAY_OPTIONS.map((day) => {
                        const enabled = selectedWeekdays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleWeekday(dua, day.id)}
                            className={`px-3 py-1 rounded-full text-xs border transition ${
                              enabled
                                ? 'bg-gold-500 text-black border-gold-400 font-bold'
                                : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/10'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(RamadanDuaLibraryPanel);
