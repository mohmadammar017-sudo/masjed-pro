import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { PrayerSettings } from '../types';

interface AnnouncementViewProps {
  onExit: () => void;
  settings: PrayerSettings;
  mosqueName: string;
}

const AnnouncementView: React.FC<AnnouncementViewProps> = ({ onExit, settings, mosqueName }) => {
  const announcement = settings.announcement;
  const durationSec = Math.max(5, Math.min(600, Math.round(announcement.durationSec || 30)));
  const durationMs = durationSec * 1000;
  const title = (announcement.title || '').trim() || 'إعلان المسجد';
  const body = (announcement.body || '').trim() || 'لا يوجد نص إعلان حاليًا.';

  useEffect(() => {
    const timer = window.setTimeout(onExit, durationMs);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['Escape', 'Backspace', 'ArrowRight', 'Space', 'Enter', 'PageDown'].includes(event.code)) {
        event.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [durationMs, onExit]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#08111d] text-white" dir="rtl">
      <style>{`
        @keyframes announcementDrift {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; }
          50% { transform: translateY(-22px) scale(1.05); opacity: 0.5; }
        }

        @keyframes announcementShimmer {
          from { background-position: 0% 50%; }
          to { background-position: 200% 50%; }
        }

        .announcement-drift {
          animation: announcementDrift 8s ease-in-out infinite;
        }

        .announcement-shell {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(160deg, rgba(10, 18, 34, 0.82), rgba(7, 13, 24, 0.92)),
            linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 48%);
          border: 1px solid rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(18px);
          box-shadow: 0 42px 120px rgba(0, 0, 0, 0.48);
        }

        .announcement-shell::before {
          content: '';
          position: absolute;
          inset: 1.2rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2rem;
          pointer-events: none;
        }

        .announcement-title {
          background: linear-gradient(90deg, #d4af37 0%, #fff2b6 50%, #d4af37 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: announcementShimmer 10s linear infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#132743_0%,#0a1628_42%,#07111e_100%)]"></div>
      {announcement.backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.16]"
          style={{ backgroundImage: `url(${announcement.backgroundImage})` }}
        ></div>
      ) : null}
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.85)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:52px_52px]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,0.2),rgba(5,10,18,0.5),rgba(4,8,15,0.78))]"></div>

      <div
        className="announcement-drift absolute -top-28 right-20 h-80 w-80 rounded-full blur-[130px]"
        style={{ backgroundColor: `${announcement.accentColor}50` }}
      ></div>
      <div
        className="announcement-drift absolute -bottom-20 left-16 h-96 w-96 rounded-full blur-[150px]"
        style={{ backgroundColor: `${announcement.accentColor}38`, animationDelay: '1.5s' }}
      ></div>

      <main className="relative z-10 flex h-full items-center justify-center px-6 py-10 md:px-12">
        <section className="announcement-shell w-full max-w-[1420px] rounded-[2.8rem] px-6 py-8 md:px-10 md:py-12 lg:px-14 lg:py-16">
          <div className="flex items-center justify-center gap-4 text-[color:var(--accent)]" style={{ ['--accent' as string]: announcement.accentColor }}>
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-current md:w-28"></div>
            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
            <Sparkles className="h-7 w-7 md:h-8 md:w-8" />
            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-current md:w-28"></div>
          </div>

          <h1 className="announcement-title mt-8 text-center font-cairo text-[clamp(2.1rem,4.1vw,4.5rem)] font-black leading-tight">
            {title}
          </h1>

          <div className="mx-auto mt-8 h-px w-[90%] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

          <div className="mt-8 rounded-[2.2rem] border border-white/12 bg-white/[0.05] px-5 py-7 md:px-8 md:py-10 lg:px-10 lg:py-12">
            <p className="whitespace-pre-line text-center font-amiri text-[clamp(1.8rem,3.15vw,3.35rem)] leading-[1.9] text-white">
              {body}
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="rounded-full border border-white/18 bg-white/8 px-7 py-3 font-mosque-name text-[clamp(1.35rem,2vw,2.2rem)] text-white/95 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              {mosqueName}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AnnouncementView;
