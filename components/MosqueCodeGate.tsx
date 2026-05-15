import React, { useState } from 'react';
import { KeyRound, Link2, LogIn, ShieldCheck } from 'lucide-react';

interface MosqueCodeGateProps {
  loading?: boolean;
  error?: string | null;
  onSubmit: (code: string) => void;
  onUseLocalMode?: () => void;
}

const MosqueCodeGate: React.FC<MosqueCodeGateProps> = ({
  loading = false,
  error = null,
  onSubmit,
  onUseLocalMode
}) => {
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_72%)] px-6 py-10 text-white" dir="rtl">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-gold-400/20 bg-gold-500/10 px-5 py-2 text-sm font-black text-gold-100">
              <ShieldCheck className="h-4 w-4" />
              ربط شاشة المسجد بالنظام المركزي
            </div>
            <div>
              <h1 className="text-4xl font-black leading-tight">أدخل كود المسجد مرة واحدة فقط</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                بعد إدخال الكود سيحفظ الجهاز الربط محليًا، وبعدها ستصل جميع التحديثات والإعلانات والأدعية من لوحة التحكم مباشرة.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">الخطوة 1</div>
                <div className="mt-2 text-lg font-black">احصل على الكود</div>
                <div className="mt-2 text-sm text-slate-400">الكود يظهر في لوحة التحكم المركزية.</div>
              </div>
              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">الخطوة 2</div>
                <div className="mt-2 text-lg font-black">اربط الشاشة</div>
                <div className="mt-2 text-sm text-slate-400">أدخل الكود هنا وسيتم حفظه على هذا الجهاز.</div>
              </div>
              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">الخطوة 3</div>
                <div className="mt-2 text-lg font-black">تحديث لحظي</div>
                <div className="mt-2 text-sm text-slate-400">من الآن لن يحتاج المسجد لأي تعديل يدوي يومي.</div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.4rem] border border-white/10 bg-slate-950/55 p-7 shadow-[0_30px_90px_rgba(2,6,23,0.45)]">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gold-500/15 text-gold-200">
              <KeyRound className="h-8 w-8" />
            </div>
            <div className="text-2xl font-black">ربط المسجد</div>
            <div className="mt-2 text-sm leading-7 text-slate-400">
              اكتب الكود كما هو ثم اضغط ربط. إذا كان الكود صحيحًا سيتم تحميل بيانات المسجد فورًا.
            </div>

            <label className="mt-6 block space-y-2">
              <span className="text-sm font-bold text-slate-200">كود المسجد</span>
              <div className="flex items-center gap-3 rounded-[1.3rem] border border-white/10 bg-black/25 px-4 py-3">
                <Link2 className="h-4 w-4 text-slate-500" />
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="DAMMAM_IMAM_01"
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </label>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => onSubmit(code)}
              disabled={loading || !code.trim()}
              className="mt-6 w-full rounded-[1.3rem] bg-gradient-to-r from-gold-500 to-amber-400 px-4 py-4 text-base font-black text-slate-950 disabled:opacity-60"
            >
              <LogIn className="ml-1 inline h-5 w-5" />
              {loading ? 'جاري الربط...' : 'ربط الشاشة'}
            </button>

            {onUseLocalMode && (
              <button
                type="button"
                onClick={onUseLocalMode}
                className="mt-3 w-full rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-4 text-base font-black text-white"
              >
                تشغيل محلي مؤقت
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MosqueCodeGate;
