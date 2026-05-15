import React from 'react';
import { ChevronLeft, ScrollText } from 'lucide-react';
import { RamadanDuaItem } from '../types';

interface DuaModeListViewProps {
  duas: RamadanDuaItem[];
  selectedIndex: number;
  onOpenDua: (index: number) => void;
  onBack: () => void;
}

const DuaModeListView: React.FC<DuaModeListViewProps> = ({
  duas,
  selectedIndex,
  onOpenDua,
  onBack
}) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#0f766e_0%,#0f172a_45%,#020617_100%)] text-white" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(251,191,36,0.16),transparent_33%),radial-gradient(circle_at_12%_85%,rgba(45,212,191,0.18),transparent_40%)]" />
      <div className="relative z-10 flex h-full flex-col p-8 md:p-12">
        <header className="rounded-[2rem] border border-white/15 bg-black/20 px-8 py-7 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-amber-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                <ScrollText className="h-8 w-8" />
              </div>
              <div>
                <div className="text-xs tracking-[0.28em] text-teal-100/75">DUA MODE</div>
                <h1 className="font-amiri text-[clamp(2.3rem,4.4vw,4.8rem)] font-bold leading-tight text-amber-100">قائمة الأدعية</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-base font-semibold text-slate-100 transition hover:bg-white/20"
            >
              رجوع
            </button>
          </div>
          <p className="mt-5 text-lg text-teal-50/85">
            `PageDown` التالي • `PageUp` السابق • `ArrowRight` فتح الدعاء • `ArrowLeft / Escape` رجوع
          </p>
        </header>

        <main className="mt-8 flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-5 backdrop-blur-xl md:p-7">
          <div className="grid h-full gap-4 overflow-y-auto pr-1 md:grid-cols-2">
            {duas.map((dua, index) => {
              const selected = index === selectedIndex;
              return (
                <button
                  key={dua.id}
                  type="button"
                  onClick={() => onOpenDua(index)}
                  className={`group relative overflow-hidden rounded-3xl border px-6 py-7 text-right transition ${
                    selected
                      ? 'border-amber-300/80 bg-amber-200/15 shadow-[0_0_0_2px_rgba(251,191,36,0.4)]'
                      : 'border-white/10 bg-white/[0.05] hover:border-white/25 hover:bg-white/[0.09]'
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 right-0 w-1.5 rounded-r-3xl ${
                      selected ? 'bg-gradient-to-b from-amber-300 to-yellow-500' : 'bg-white/0'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[clamp(2rem,2.8vw,3rem)] font-bold leading-tight text-white font-amiri">{dua.title}</div>
                      <div className="mt-1 text-sm tracking-widest text-cyan-100/65">#{index + 1}</div>
                    </div>
                    <ChevronLeft className={`h-8 w-8 transition ${selected ? 'text-amber-300' : 'text-slate-300 group-hover:text-white'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DuaModeListView;
