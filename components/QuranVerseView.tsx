import React, { useEffect, useState } from 'react';
import { Moon, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { PrayerSettings } from '../types';

interface QuranVerseViewProps {
  mosqueName: string;
  onExit: () => void;
  settings: PrayerSettings;
}

interface ParticleConfig {
  id: number;
  size: number;
  left: string;
  top: string;
  duration: string;
  delay: string;
}

const DEFAULT_MOSQUE_NAME = 'مسجد الإمام الحسين';

const createParticleConfigs = (): ParticleConfig[] =>
  Array.from({ length: 20 }, (_, index) => ({
    id: index,
    size: Math.random() * 3 + 1,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: `${Math.random() * 25 + 20}s`,
    delay: `${Math.random() * 10}s`,
  }));

const QuranVerseView: React.FC<QuranVerseViewProps> = ({ mosqueName, onExit, settings }) => {
  const [mounted, setMounted] = useState(false);
  const [particleConfigs] = useState<ParticleConfig[]>(() => createParticleConfigs());
  const quranVerseBackgroundImage = settings.quranVerse.backgroundImage;

  useEffect(() => {
    setMounted(true);
    const timer = window.setTimeout(onExit, 45000);

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      onExit();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExit]);

  const displayMosqueName = mosqueName.trim() || DEFAULT_MOSQUE_NAME;

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#040D12] px-4 py-6 font-sans text-white antialiased md:px-8 md:py-8"
      dir="rtl"
    >
      <div className="absolute inset-0 z-0 bg-[#040D12]">
        <div className="absolute inset-0 bg-[#040D12]"></div>
        {quranVerseBackgroundImage ? (
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat opacity-[0.38]"
            style={{ backgroundImage: `url(${quranVerseBackgroundImage})` }}
          ></div>
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(4,13,18,0.84),rgba(6,44,48,0.74),rgba(4,13,18,0.9))]"></div>
        <div className="absolute -left-[10%] -top-[10%] h-[60%] w-[60%] rounded-full bg-[#D4AF37]/5 blur-[120px] animate-pulse-slow"></div>
        <div
          className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-[#40E0D0]/5 blur-[120px] animate-pulse-slow"
          style={{ animationDelay: '4s' }}
        ></div>
        <div className="absolute inset-0 scale-125 bg-[url('https://www.transparenttextures.com/patterns/islamic-art.png')] opacity-[0.05]"></div>
        {mounted && (
          <div className="pointer-events-none absolute inset-0">
            {particleConfigs.map((particle) => (
              <div
                key={particle.id}
                className="absolute rounded-full bg-[#D4AF37]/30 animate-float-smooth"
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
          50% { transform: translate3d(30px, -30px, 0); opacity: 0.6; }
          100% { transform: translate3d(0, 0, 0); opacity: 0.2; }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }

        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes shimmer {
          to { background-position: 200% center; }
        }

        .animate-float-smooth { animation: float-smooth linear infinite alternate; }
        .animate-pulse-slow { animation: pulse-slow 10s ease-in-out infinite; }

        .shrine-panel {
          background:
            linear-gradient(180deg, rgba(6, 44, 48, 0.84), rgba(4, 26, 29, 0.9)),
            radial-gradient(circle at top right, rgba(212, 175, 55, 0.12), transparent 30%);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(212, 175, 55, 0.24);
          box-shadow:
            0 26px 60px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          position: relative;
          overflow: hidden;
        }

        .shrine-panel::before {
          content: "";
          position: absolute;
          inset: 16px;
          border-radius: 26px;
          border: 1px solid rgba(212, 175, 55, 0.08);
          pointer-events: none;
        }

        .ayah-shell {
          display: flex;
          min-height: clamp(18rem, 34vh, 28rem);
          align-items: center;
          justify-content: center;
        }

        .ayah-copy {
          width: 100%;
          max-width: min(100%, 1560px);
          margin-inline: auto;
          display: grid;
          gap: clamp(0.9rem, 2vh, 1.5rem);
        }

        .ayah-line {
          margin: 0;
          color: #f8ebbe;
          font-family: 'Amiri', serif;
          font-size: clamp(2.1rem, 4.1vw, 4.9rem);
          font-weight: 700;
          line-height: 1.46;
          letter-spacing: 0;
          text-wrap: balance;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          font-feature-settings: "liga" 1, "rlig" 1, "calt" 1;
          text-shadow:
            0 2px 1px rgba(0, 0, 0, 0.42),
            0 12px 28px rgba(0, 0, 0, 0.24);
        }

        .ayah-accent {
          color: #dcb856;
        }

        .surah-chip {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .salawat-copy {
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          font-feature-settings: "liga" 1, "rlig" 1, "calt" 1;
        }

        .ornate-corner {
          position: absolute;
          width: 64px;
          height: 64px;
          border: 2px solid #D4AF37;
          opacity: 0.28;
        }

        .corner-tl { top: 20px; left: 20px; border-right: 0; border-bottom: 0; border-radius: 14px 0 0 0; }
        .corner-tr { top: 20px; right: 20px; border-left: 0; border-bottom: 0; border-radius: 0 14px 0 0; }
        .corner-bl { bottom: 20px; left: 20px; border-right: 0; border-top: 0; border-radius: 0 0 0 14px; }
        .corner-br { bottom: 20px; right: 20px; border-left: 0; border-top: 0; border-radius: 0 0 14px 0; }
      `}</style>

      <div className="relative z-10 flex h-full w-full max-w-[1800px] flex-col items-center justify-center gap-6 md:gap-8 xl:gap-10">
        <div
          className="text-center opacity-0"
          style={{ animation: 'reveal-up 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.5s' }}
        >
          <div className="mb-4 flex items-center justify-center gap-6">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#D4AF37] md:w-24"></div>
            <Sparkles className="h-8 w-8 text-[#D4AF37]" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#D4AF37] md:w-24"></div>
          </div>
          <h2 className="font-cairo text-[clamp(1.55rem,2vw,2.35rem)] font-black tracking-[0.22em] text-[#D4AF37] drop-shadow-lg">
            ۞ قَالَ اللهُ تَعَالَى ۞
          </h2>
        </div>

        <div
          className="shrine-panel relative w-full rounded-[2.25rem] px-6 py-8 opacity-0 md:rounded-[2.75rem] md:px-12 md:py-10 xl:px-16 xl:py-12"
          style={{ animation: 'reveal-up 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 1s' }}
        >
          <div className="ornate-corner corner-tl"></div>
          <div className="ornate-corner corner-tr"></div>
          <div className="ornate-corner corner-bl"></div>
          <div className="ornate-corner corner-br"></div>

          <div className="ayah-shell relative z-10">
            <div className="ayah-copy text-center">
              <p className="ayah-line">
                <span className="ayah-accent">﴿</span> إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ <span className="ayah-accent">﴾</span>
              </p>
              <p className="ayah-line">
                <span className="ayah-accent">﴿</span> يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا <span className="ayah-accent">﴾</span>
              </p>
            </div>
          </div>
        </div>

        <div
          className="w-full space-y-6 text-center opacity-0 md:space-y-8"
          style={{ animation: 'reveal-up 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 2.5s' }}
        >
          <div className="surah-chip inline-flex items-center gap-4 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-6 py-3 backdrop-blur-md md:px-8">
            <span className="font-cairo text-lg font-bold tracking-[0.18em] text-[#fcf6ba] md:text-xl">سورة الأحزاب - الآية ٥٦</span>
          </div>

          <div className="flex flex-col items-center gap-5 md:gap-6">
            <p className="salawat-copy font-amiri text-[clamp(2rem,3vw,4.4rem)] font-bold text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
              اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ
            </p>
            <div className="flex items-center gap-4">
              <div className="h-0.5 w-24 bg-gradient-to-r from-transparent to-[#40E0D0]/40 md:w-32"></div>
              <ShieldCheck className="h-6 w-6 text-[#40E0D0]" />
              <div className="h-0.5 w-24 bg-gradient-to-l from-transparent to-[#40E0D0]/40 md:w-32"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-4 opacity-45 md:bottom-8 md:left-8 md:right-8">
        <div className="flex items-center gap-4">
          <Moon className="h-6 w-6 text-[#D4AF37]" />
          <span className="font-mosque-name text-2xl leading-none text-white md:text-3xl">{displayMosqueName}</span>
        </div>
        <div className="flex items-center gap-2 font-cairo text-sm text-white/55">
          <Star className="h-4 w-4" />
          <span>اضغط أي زر للعودة</span>
        </div>
      </div>
    </div>
  );
};

export default QuranVerseView;
