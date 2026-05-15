import React, { useEffect, useState } from 'react';
import { Moon, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { PrayerSettings } from '../types';

interface SajdatAlShukrViewProps {
  mosqueName: string;
  onExit: () => void;
  settings?: PrayerSettings;
}

interface Particle {
  id: number;
  size: number;
  left: string;
  top: string;
  duration: string;
  delay: string;
}

const DEFAULT_MOSQUE_NAME = 'الإمام الحسين (ع)';

const createParticles = (): Particle[] =>
  Array.from({ length: 25 }, (_, index) => ({
    id: index,
    size: Math.random() * 4 + 1,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: `${Math.random() * 25 + 20}s`,
    delay: `${Math.random() * 10}s`,
  }));

const SajdatAlShukrView: React.FC<SajdatAlShukrViewProps> = ({ mosqueName, onExit, settings }) => {
  const [mounted, setMounted] = useState(false);
  const [particles] = useState<Particle[]>(() => createParticles());
  const displayMosqueName = mosqueName.trim() || DEFAULT_MOSQUE_NAME;

  useEffect(() => {
    setMounted(true);
    const timer = window.setTimeout(onExit, 60000);

    const handleKeyDown = (event: KeyboardEvent) => {
      if ([
        'Escape',
        'Backspace',
        'Enter',
        'Space',
        'ArrowRight',
        'ArrowLeft',
        'ArrowUp',
        'ArrowDown',
        'PageDown',
        'PageUp'
      ].includes(event.code)) {
        event.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExit]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#1A0F0A] text-white" dir="rtl">
      <div className="absolute inset-0 z-0 overflow-hidden">
        {settings?.duaSabah?.backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.14] mix-blend-screen"
            style={{ backgroundImage: `url(${settings.duaSabah.backgroundImage})` }}
          ></div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A0F0A] via-[#2D1B14] to-[#1A0F0A]"></div>
        <div className="absolute -left-[10%] -top-[10%] h-[70%] w-[70%] rounded-full bg-orange-500/10 blur-[150px] animate-pulse-slow"></div>
        <div
          className="absolute -bottom-[10%] -right-[10%] h-[60%] w-[60%] rounded-full bg-amber-500/5 blur-[150px] animate-pulse-slow"
          style={{ animationDelay: '5s' }}
        ></div>
        <div className="pointer-events-none absolute inset-0 scale-150 bg-[url('https://www.transparenttextures.com/patterns/islamic-art.png')] opacity-[0.04]"></div>
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-30">
          <div className="h-[200vh] w-[200vw] animate-spin-very-slow bg-[conic-gradient(from_0deg_at_50%_50%,rgba(249,115,22,0.1)_0deg,transparent_20deg,rgba(249,115,22,0.1)_40deg,transparent_60deg)] mix-blend-screen"></div>
        </div>
        {mounted && (
          <div className="pointer-events-none absolute inset-0">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="absolute rounded-full bg-orange-200/20 animate-float-smooth"
                style={{
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  left: particle.left,
                  top: particle.top,
                  animationDuration: particle.duration,
                  animationDelay: particle.delay,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes float-smooth {
          0% { transform: translate3d(0, 0, 0); opacity: 0.2; }
          50% { transform: translate3d(30px, -30px, 0); opacity: 0.5; }
          100% { transform: translate3d(0, 0, 0); opacity: 0.2; }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        .animate-float-smooth { animation: float-smooth linear infinite alternate; }
        .animate-pulse-slow { animation: pulse-slow 10s ease-in-out infinite; }
        .animate-spin-very-slow { animation: spin-very-slow 120s linear infinite; }
        .reveal-up { animation: reveal-up 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .shrine-panel {
          background:
            linear-gradient(180deg, rgba(34, 18, 10, 0.84), rgba(20, 9, 6, 0.92)),
            radial-gradient(circle at top right, rgba(212, 175, 55, 0.1), transparent 30%);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(212, 175, 55, 0.22);
          box-shadow:
            0 26px 60px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          position: relative;
          overflow: hidden;
        }

        .shrine-panel::before {
          content: "";
          position: absolute;
          inset: 14px;
          border-radius: 28px;
          border: 1px solid rgba(212, 175, 55, 0.08);
          pointer-events: none;
        }

        .animated-border {
          position: absolute;
          inset: -2px;
          background: linear-gradient(60deg, #d4af37, #7c2d12, #ea580c, #7c2d12, #d4af37);
          background-size: 300% 300%;
          animation: border-flow 8s alternate infinite;
          z-index: -1;
          opacity: 0.5;
        }

        @keyframes border-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        .gold-glow {
          color: #D4AF37;
          text-shadow: 0 0 25px rgba(212, 175, 55, 0.4);
        }

        .sajdah-shell {
          display: flex;
          min-height: clamp(16rem, 31vh, 24rem);
          align-items: center;
          justify-content: center;
        }

        .sajdah-copy {
          width: 100%;
          max-width: min(100%, 1450px);
          margin-inline: auto;
        }

        .sajdah-text {
          margin: 0;
          color: #fff3dc;
          font-size: clamp(1.8rem, 3.05vw, 3.45rem);
          line-height: 1.9;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          font-feature-settings: "liga" 1, "rlig" 1, "calt" 1;
          text-shadow:
            0 2px 1px rgba(0, 0, 0, 0.42),
            0 12px 28px rgba(0, 0, 0, 0.22);
        }

        .ornate-corner {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 2px solid #D4AF37;
          opacity: 0.3;
        }

        .corner-tl { top: 20px; left: 20px; border-right: 0; border-bottom: 0; border-radius: 15px 0 0 0; }
        .corner-tr { top: 20px; right: 20px; border-left: 0; border-bottom: 0; border-radius: 0 15px 0 0; }
        .corner-bl { bottom: 20px; left: 20px; border-right: 0; border-top: 0; border-radius: 0 0 0 15px; }
        .corner-br { bottom: 20px; right: 20px; border-left: 0; border-top: 0; border-radius: 0 0 15px 0; }
      `}</style>

      <div className="relative z-10 flex h-full flex-col p-6 md:p-8 xl:p-10">
        <header className="reveal-up mb-8 flex flex-col items-center text-center md:mb-10">
          <div className="mb-6 inline-flex items-center gap-4 rounded-full border border-orange-500/20 bg-orange-500/10 px-6 py-2 text-orange-400">
            <Sparkles className="h-5 w-5 fill-current" />
            <span className="font-cairo text-sm font-bold uppercase tracking-[0.3em]">خِتامُ دُعاءِ الصَّباح</span>
            <Sparkles className="h-5 w-5 fill-current" />
          </div>
          <h1 className="font-cairo text-[clamp(2.3rem,4vw,4.9rem)] font-black leading-tight text-white drop-shadow-2xl">
            سَجْدَةُ <span className="gold-glow">الشُّكْر</span>
          </h1>
          <div className="mt-4 rounded-full border border-orange-500/30 bg-orange-500/20 px-6 py-1.5">
            <span className="font-cairo text-base font-bold text-orange-200 md:text-lg">يُستحبُّ السُّجودُ هنا</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center">
          <div className="shrine-panel reveal-up flex w-full max-w-[112rem] flex-col items-center justify-center rounded-[2.25rem] px-6 py-8 text-center md:rounded-[2.75rem] md:px-10 md:py-10 xl:px-14 xl:py-12" style={{ animationDelay: '0.5s' }}>
            <div className="animated-border"></div>
            <div className="ornate-corner corner-tl"></div>
            <div className="ornate-corner corner-tr"></div>
            <div className="ornate-corner corner-bl"></div>
            <div className="ornate-corner corner-br"></div>

            <div className="sajdah-shell relative z-10">
              <div className="sajdah-copy text-center">
                <p className="sajdah-text font-liftaswash">
                « إلهِي قَلْبِي مَحْجُوبٌ ، وَنَفْسِي مَعْيُوبٌ ، وَعَقْلِي مَغْلُوبٌ ، وَهَوائِي غالِبٌ ، وَطاعَتِي قَلِيلٌ ، وَمَعْصِيَتِي كَثِيرٌ ، وَلِسانِي مُقِرٌّ بِالذُّنُوبِ ، فَكَيْفَ حِيلَتِي يا سَتَّارَ الْعُيُوبِ ، وَيا عَلَّامَ الْغُيُوبِ ، وَيا كاشِفَ الْكُرُوبِ ، اغْفِرْ ذُنُوبِي كُلَّها بِحُرْمَةِ مُحَمَّدٍ وَآلِ مُحَمَّدٍ ، يا غَفَّارُ يا غَفَّارُ يا غَفَّارُ ، بِرَحْمَتِكَ يا أرْحَمَ الرَّاحِمِينَ »
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="reveal-up mt-8 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 opacity-60 md:flex-row" style={{ animationDelay: '1s' }}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-3">
              <ShieldCheck className="h-6 w-6 text-orange-500" />
              <span className="font-cairo text-sm font-bold text-gray-300">تقبل الله أعمالكم في صلاة الصبح</span>
            </div>
            <div className="flex items-center gap-3 font-cairo text-sm text-gray-500">
              <Star className="h-4 w-4 text-orange-500" />
              <span>اضغط أي زر للعودة</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">المسجد</p>
              <p className="font-mosque-name text-3xl text-white">{displayMosqueName}</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-orange-500/20 bg-orange-500/10 shadow-inner">
              <Moon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SajdatAlShukrView;
