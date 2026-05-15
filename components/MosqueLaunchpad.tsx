import React from 'react';
import { ArrowLeftCircle, Building2, Cog, DoorOpen, Sparkles, UserRound } from 'lucide-react';

interface MosqueLaunchpadProps {
  mosqueName: string;
  city: string;
  imamName?: string;
  code?: string | null;
  onEnter: () => void;
  onOpenSettings: () => void;
  overlay?: React.ReactNode;
}

const MosqueLaunchpad: React.FC<MosqueLaunchpadProps> = ({
  mosqueName,
  city,
  imamName,
  code,
  onEnter,
  onOpenSettings,
  overlay
}) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#102037_0%,#020617_70%)] px-6 py-8 text-white" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center">
        <div className="grid w-full gap-8 xl:grid-cols-[1.12fr,0.88fr]">
          <section className="rounded-[2.8rem] border border-white/10 bg-slate-950/50 p-8 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-gold-400/20 bg-gold-500/10 px-5 py-2 text-sm font-black text-gold-100">
              <Sparkles className="h-4 w-4" />
              منصة المسجد جاهزة
            </div>
            <h1 className="mt-6 text-[clamp(2.5rem,4vw,4.8rem)] font-black leading-[1.05] text-white">
              أهلًا بكم في
              <span className="mt-3 block bg-gradient-to-r from-gold-50 via-gold-300 to-gold-100 bg-clip-text text-transparent">
                {mosqueName}
              </span>
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-9 text-slate-300">
              هذه الصفحة هي نقطة الدخول البسيطة للمسجد. زر الدخول يفتح شاشة العرض مباشرة، بينما الإعدادات تحتوي كل الخيارات المتقدمة مثل الخلفيات والألوان والتهيئة التفصيلية.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-5">
                <Building2 className="h-6 w-6 text-gold-200" />
                <div className="mt-4 text-sm text-slate-400">المسجد</div>
                <div className="mt-1 text-xl font-black text-white">{mosqueName}</div>
              </div>
              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-5">
                <ArrowLeftCircle className="h-6 w-6 text-cyan-200" />
                <div className="mt-4 text-sm text-slate-400">المدينة</div>
                <div className="mt-1 text-xl font-black text-white">{city}</div>
              </div>
              <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-5">
                <UserRound className="h-6 w-6 text-emerald-200" />
                <div className="mt-4 text-sm text-slate-400">الإمام الحالي</div>
                <div className="mt-1 text-xl font-black text-white">{imamName || 'غير محدد'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[2.8rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
            <div className="text-sm font-bold text-slate-400">بوابة المسجد</div>
            <div className="mt-2 text-3xl font-black text-white">اختر ما تريد</div>
            <div className="mt-3 text-sm leading-7 text-slate-300">
              أبقينا المسار واضحًا جدًا: إعدادات متقدمة قبل الدخول، ثم زر مباشر لبدء شاشة المسجد.
            </div>

            <div className="mt-8 space-y-4">
              <button
                type="button"
                onClick={onEnter}
                className="flex w-full items-center justify-between rounded-[1.9rem] border border-gold-400/25 bg-gradient-to-r from-gold-500 to-amber-400 px-6 py-5 text-right text-slate-950 shadow-[0_20px_40px_rgba(212,175,55,0.28)]"
              >
                <div>
                  <div className="text-base font-black">الدخول إلى شاشة المسجد</div>
                  <div className="mt-1 text-sm text-slate-900/75">يفتح واجهة العرض الرئيسية مباشرة</div>
                </div>
                <DoorOpen className="h-7 w-7" />
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="flex w-full items-center justify-between rounded-[1.9rem] border border-white/10 bg-white/[0.05] px-6 py-5 text-right text-white transition hover:bg-white/[0.08]"
              >
                <div>
                  <div className="text-base font-black">الإعدادات المتقدمة</div>
                  <div className="mt-1 text-sm text-slate-400">الخلفيات والألوان ومواقيت الصلاة وباقي التفاصيل</div>
                </div>
                <Cog className="h-7 w-7 text-gold-200" />
              </button>
            </div>

            <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-black tracking-[0.22em] text-slate-500">MOSQUE CODE</div>
              <div className="mt-2 text-2xl font-black text-gold-100">{code || 'LOCAL MODE'}</div>
              <div className="mt-3 text-sm leading-7 text-slate-400">
                إذا احتجت التعديل الكامل من خارج المسجد، استخدم نسخة الإدارة على جهازك وسيصل التحديث إلى هذه الشاشة مباشرة.
              </div>
            </div>
          </section>
        </div>
      </div>
      {overlay}
    </div>
  );
};

export default MosqueLaunchpad;
