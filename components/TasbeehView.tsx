import React, { useEffect } from 'react';
import { Moon, Sparkles } from 'lucide-react';
import { PrayerSettings } from '../types';

interface TasbeehViewProps {
  onExit: () => void;
  onPrevious: () => void;
  settings: PrayerSettings;
}

const toArabicDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)] || digit);

const TasbeehView: React.FC<TasbeehViewProps> = ({ onExit, onPrevious, settings }) => {
  const tasbeehBackgroundImage = settings.tasbeeh.backgroundImage;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['Space', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageUp', 'PageDown'].includes(event.code)) {
        event.preventDefault();
      }

      if (event.code === 'ArrowLeft' || event.code === 'ArrowUp' || event.code === 'PageUp') {
        onPrevious();
        return;
      }

      onExit();
    };

    window.addEventListener('keydown', handleKeyDown);
    const autoExit = window.setTimeout(onExit, 300000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(autoExit);
    };
  }, [onExit, onPrevious]);

  const tasbeehItems = [
    {
      value: 34,
      label: 'الله أكبر',
      repeatLabel: 'أربع وثلاثون مرة',
      accent: '#ba8b2d',
      soft: '#fff3d6',
      glow: 'rgba(186, 139, 45, 0.24)'
    },
    {
      value: 33,
      label: 'الحمد لله',
      repeatLabel: 'ثلاث وثلاثون مرة',
      accent: '#b56d57',
      soft: '#fbe5dc',
      glow: 'rgba(181, 109, 87, 0.22)'
    },
    {
      value: 33,
      label: 'سبحان الله',
      repeatLabel: 'ثلاث وثلاثون مرة',
      accent: '#6f84a8',
      soft: '#e4ecfb',
      glow: 'rgba(111, 132, 168, 0.22)'
    }
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f5ecdc] text-[#1c2933]" dir="rtl">
      <style>{`
        @keyframes tasbeehDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.34; }
          50% { transform: translate3d(0, -20px, 0) scale(1.05); opacity: 0.52; }
        }

        @keyframes tasbeehRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes tasbeehRise {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes tasbeehReveal {
          from { opacity: 0; transform: translateY(28px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes tasbeehShimmer {
          from { background-position: 0% 50%; }
          to { background-position: 200% 50%; }
        }

        .tasbeeh-drift {
          animation: tasbeehDrift 9s ease-in-out infinite;
        }

        .tasbeeh-shell {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 251, 244, 0.92), rgba(251, 244, 233, 0.86)),
            linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(255, 244, 222, 0.24));
          border: 1px solid rgba(155, 124, 71, 0.16);
          box-shadow:
            0 34px 90px rgba(102, 76, 43, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.74);
          backdrop-filter: blur(18px);
        }

        .tasbeeh-shell::before {
          content: '';
          position: absolute;
          inset: 1.15rem;
          border: 1px solid rgba(186, 139, 45, 0.16);
          border-radius: 2.2rem;
          pointer-events: none;
        }

        .tasbeeh-title {
          background: linear-gradient(90deg, #99660b 0%, #d3a13a 35%, #7a5511 70%, #c58b24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: tasbeehShimmer 10s linear infinite;
        }

        .tasbeeh-card {
          position: relative;
          overflow: hidden;
          opacity: 0;
          animation: tasbeehReveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 250, 244, 0.68)),
            radial-gradient(circle at top, rgba(255, 255, 255, 0.82), transparent 58%);
          border: 1px solid rgba(111, 86, 51, 0.12);
          box-shadow:
            0 22px 54px rgba(102, 76, 43, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.76);
          backdrop-filter: blur(14px);
          transition: transform 380ms ease, box-shadow 380ms ease, border-color 380ms ease;
        }

        .tasbeeh-card:hover {
          transform: translateY(-8px);
          box-shadow:
            0 28px 65px rgba(102, 76, 43, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.84);
        }

        .tasbeeh-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), transparent 26%, transparent 76%, rgba(255, 255, 255, 0.14));
          pointer-events: none;
        }

        .tasbeeh-card::after {
          content: '';
          position: absolute;
          top: -26%;
          left: 50%;
          width: 74%;
          height: 34%;
          transform: translateX(-50%);
          border-radius: 0 0 999px 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.06));
          opacity: 0.52;
          pointer-events: none;
        }

        .tasbeeh-medallion {
          animation: tasbeehRise 5.6s ease-in-out infinite;
        }

        .tasbeeh-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 9999px;
          animation: tasbeehRotate 18s linear infinite;
        }

        .tasbeeh-ring--reverse {
          animation-direction: reverse;
          animation-duration: 23s;
        }
      `}</style>

      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#fffaf0_0%,#f6ecdd_35%,#eddec7_70%,#e4cfb1_100%)]"></div>
        {tasbeehBackgroundImage ? (
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat opacity-[0.1]"
            style={{ backgroundImage: `url(${tasbeehBackgroundImage})` }}
          ></div>
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,247,235,0.08),rgba(231,214,184,0.12))]"></div>
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle,rgba(141,101,35,0.95)_1px,transparent_1.3px)] [background-size:22px_22px]"></div>
        <div className="tasbeeh-drift absolute -right-[8%] top-[5%] h-[28rem] w-[28rem] rounded-full blur-[120px]" style={{ background: 'rgba(247, 218, 164, 0.46)' }}></div>
        <div className="tasbeeh-drift absolute left-[-8%] top-[18%] h-[24rem] w-[24rem] rounded-full blur-[120px]" style={{ background: 'rgba(248, 214, 202, 0.4)', animationDelay: '2s' }}></div>
        <div className="tasbeeh-drift absolute bottom-[-10%] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full blur-[140px]" style={{ background: 'rgba(205, 219, 243, 0.34)', animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1820px] flex-col px-5 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
        <header className="mb-6 text-center lg:mb-8">
          <div className="flex items-center justify-center gap-4 text-[#c39640]">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#d3a34f]/80 md:w-28"></div>
            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
            <Moon className="h-6 w-6 md:h-7 md:w-7" />
            <Sparkles className="h-5 w-5 md:h-6 md:w-6" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#d3a34f]/80 md:w-28"></div>
          </div>

          <h1 className="tasbeeh-title font-qadasi mt-5 text-[clamp(2.6rem,5vw,5.95rem)] leading-[1.14] drop-shadow-[0_10px_24px_rgba(255,255,255,0.5)]">
            تسبيحة فاطمة الزهراء (ع)
          </h1>

          <p className="mx-auto mt-4 max-w-[58rem] font-cairo text-[clamp(1rem,1.3vw,1.38rem)] font-semibold leading-8 text-[#5b6470]">
            {toArabicDigits(34)} الله أكبر • {toArabicDigits(33)} الحمد لله • {toArabicDigits(33)} سبحان الله
          </p>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <section className="tasbeeh-shell w-full rounded-[2.6rem] px-4 py-6 md:px-6 md:py-8 lg:rounded-[3.2rem] lg:px-8 lg:py-10">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
              {tasbeehItems.map((item, index) => (
                <article
                  key={item.label}
                  className="tasbeeh-card rounded-[2.1rem] px-5 py-6 text-center md:min-h-[31rem] md:px-6 md:py-8 lg:min-h-[36rem] lg:px-7 lg:py-10"
                  style={{
                    animationDelay: `${0.16 * index}s`,
                    borderColor: `${item.accent}22`
                  }}
                >
                  <div className="relative z-10 flex justify-center">
                    <div
                      className="rounded-full px-5 py-2 font-cairo text-sm font-bold tracking-[0.15em] shadow-[0_8px_18px_rgba(0,0,0,0.03)]"
                      style={{
                        backgroundColor: item.soft,
                        color: item.accent,
                        border: `1px solid ${item.accent}33`
                      }}
                    >
                      {item.repeatLabel}
                    </div>
                  </div>

                  <div className="relative mt-8 flex justify-center">
                    <div
                      className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[72px]"
                      style={{ background: item.glow }}
                    ></div>
                    <div
                      className="tasbeeh-ring h-44 w-44 border border-dashed"
                      style={{ borderColor: `${item.accent}42` }}
                    ></div>
                    <div
                      className="tasbeeh-ring tasbeeh-ring--reverse h-36 w-36 border"
                      style={{ borderColor: `${item.accent}24` }}
                    ></div>
                    <div
                      className="tasbeeh-medallion relative flex h-36 w-36 items-center justify-center rounded-full border shadow-[0_20px_45px_rgba(106,83,48,0.1)] md:h-40 md:w-40"
                      style={{
                        borderColor: `${item.accent}50`,
                        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, ${item.soft} 46%, rgba(255,255,255,0.74) 100%)`
                      }}
                    >
                      <div
                        className="absolute inset-[10px] rounded-full border"
                        style={{ borderColor: `${item.accent}20` }}
                      ></div>
                      <span className="font-cairo text-[clamp(2.75rem,4.2vw,4.35rem)] font-black tracking-tight" style={{ color: item.accent }}>
                        {toArabicDigits(item.value)}
                      </span>
                    </div>
                  </div>

                  <h2 className="font-liftaswash mt-8 text-[clamp(2.25rem,3.6vw,4rem)] leading-[1.42] text-[#243342]">
                    {item.label}
                  </h2>

                  <div className="mx-auto mt-5 h-px w-28 max-w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-90"></div>

                  <div className="mt-5 flex justify-center">
                    <div
                      className="rounded-full px-4 py-2 font-cairo text-sm font-bold md:text-base"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.48)',
                        color: item.accent,
                        border: `1px solid ${item.accent}1c`
                      }}
                    >
                      {toArabicDigits(item.value)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default TasbeehView;
