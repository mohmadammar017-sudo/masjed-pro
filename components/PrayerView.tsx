import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PrayerSettings, PrayerTime } from '../types';
import { convert24to12, formatTime, formatDateAR } from '../utils';

interface PrayerViewProps {
  currentPrayer: PrayerTime;
  imamName: string;
  settings: PrayerSettings;
  onExit: () => void;
  onNext: () => void;
  onBack: () => void;
}

const PrayerView: React.FC<PrayerViewProps> = ({ currentPrayer, imamName, settings, onExit, onNext, onBack }) => {
  const [rakah, setRakah] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs to keep callbacks stable across renders (fixes timer reset issue)
  const onNextRef = useRef(onNext);
  const onExitRef = useRef(onExit);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onNextRef.current = onNext;
    onExitRef.current = onExit;
    onBackRef.current = onBack;
  }, [onBack, onNext, onExit]);

  // Determine Max Rakahs based on Prayer ID
  const getMaxRakahs = (id: string) => {
    if (id === 'fajr') return 2;
    if (id === 'maghrib') return 3;
    return 4; // Dhuhr, Asr, Isha
  };
  
  const maxRakahs = getMaxRakahs(currentPrayer.id);
  const prayerTimeLabel = convert24to12(currentPrayer.time).label;

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- TRANSITION LOGIC ---
  const handleNextStep = useCallback(() => {
    if (rakah < maxRakahs) {
      // Move to next Rakah
      setIsTransitioning(true);
      setTimeout(() => {
          setRakah(prev => prev + 1);
          setIsTransitioning(false);
      }, 300);
    } else {
      // Finish Prayer -> Go to Tasbeeh
      if (onNextRef.current) onNextRef.current();
    }
  }, [rakah, maxRakahs]);

  const handlePrevStep = useCallback(() => {
    if (rakah > 1) {
      setIsTransitioning(true);
      setTimeout(() => {
          setRakah(prev => prev - 1);
          setIsTransitioning(false);
      }, 300);
      return;
    }
    onBackRef.current?.();
  }, [rakah]);

  // --- AUTO TIMER LOGIC ---
  useEffect(() => {
    if (settings.transitionMode === 'manual') return;

    // The timer was resetting every second because the parent App component re-renders on clock tick.
    // By making handleNextStep stable (via refs inside it), this effect won't re-run unnecessarily.
    const timer = setTimeout(() => {
        handleNextStep();
    }, settings.autoDuration * 1000);

    return () => clearTimeout(timer);
  }, [rakah, settings.transitionMode, settings.autoDuration, handleNextStep]);

  // --- KEYBOARD CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling
      if (['Space', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'Space':
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          handleNextStep();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          handlePrevStep();
          break;
        case 'Escape':
          if (onExitRef.current) onExitRef.current();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStep, handlePrevStep]);

  // Default opacity
  const overlayOpacity = settings.overlayOpacity !== undefined ? settings.overlayOpacity : 0.5;

  return (
    <div 
      className="h-screen w-full relative overflow-hidden flex flex-col font-sans select-none"
      dir="rtl"
      style={{ backgroundColor: settings.backgroundColor || '#020617' }}
    >
      
      {/* --- LAYER 1: BACKGROUND --- */}
      <div className="absolute inset-0 z-0">
          {settings.backgroundImage ? (
             <>
               <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url(${settings.backgroundImage})` }}></div>
               <div className="absolute inset-0 bg-black transition-opacity duration-500" style={{ opacity: overlayOpacity }}></div>
             </>
          ) : (
             <div 
                className="absolute inset-0"
                style={{ 
                    background: `radial-gradient(circle at center, ${settings.backgroundColor || '#1e293b'} 0%, #000000 100%)`
                }}
             ></div>
          )}

          {/* Rotating Pattern */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vh] h-[150vh] opacity-[0.03] animate-[spin_120s_linear_infinite]">
             <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-gold-200 w-full h-full">
                <circle cx="50" cy="50" r="45" strokeWidth="0.2" strokeDasharray="2 2" />
                <rect x="25" y="25" width="50" height="50" strokeWidth="0.2" transform="rotate(45 50 50)" />
                <rect x="25" y="25" width="50" height="50" strokeWidth="0.2" />
             </svg>
          </div>
      </div>

      <style>{`
        @keyframes number-enter {
           from { opacity: 0; transform: translateY(50px) scale(0.5); filter: blur(20px); }
           to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes number-exit {
           from { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
           to { opacity: 0; transform: translateY(-50px) scale(1.5); filter: blur(20px); }
        }
        
        .gold-gradient-text {
           background: linear-gradient(to bottom, #fff 30%, #fcd34d 100%);
           -webkit-background-clip: text;
           -webkit-text-fill-color: transparent;
           filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
        }

	        .glass-panel {
	           background: rgba(255, 255, 255, 0.05);
	           backdrop-filter: blur(15px);
	           border: 1px solid rgba(255, 255, 255, 0.1);
	           box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
	        }

          @font-face {
             font-family: 'Liftaswash Fixed';
             src: url('/fonts/Liftaswashfixed-Regular.otf') format('opentype');
             font-weight: 400;
             font-style: normal;
             font-display: swap;
          }

          .imam-name-shell {
             position: relative;
             min-width: min(78vw, 780px);
             padding: 1.2rem 2rem 1.5rem;
             border-radius: 2rem;
             background:
               linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)),
               linear-gradient(135deg, rgba(236,163,21,0.18), rgba(2,6,23,0.2));
             border: 1px solid rgba(236,163,21,0.22);
             box-shadow:
               0 22px 50px rgba(0, 0, 0, 0.32),
               inset 0 1px 0 rgba(255,255,255,0.08),
               0 0 34px rgba(236,163,21,0.08);
             overflow: hidden;
          }

          .imam-name-shell::before,
          .imam-name-shell::after {
             content: '';
             position: absolute;
             inset: 14px;
             border-radius: 1.4rem;
             pointer-events: none;
          }

          .imam-name-shell::before {
             border: 1px solid rgba(236,163,21,0.16);
          }

          .imam-name-shell::after {
             inset: auto 2.2rem 0.9rem;
             height: 1px;
             background: linear-gradient(90deg, transparent, rgba(236,163,21,0.55), transparent);
          }

          .imam-name-kicker {
             font-family: 'Cairo', sans-serif;
             font-size: 0.78rem;
             font-weight: 800;
             letter-spacing: 0.38em;
             color: rgba(252, 211, 77, 0.78);
             text-transform: uppercase;
          }

          .imam-name-display {
             font-family: 'Liftaswash Fixed', 'Amiri', serif;
             font-size: clamp(2.2rem, 4vw, 4.5rem);
             line-height: 1.18;
             color: #fffaf0;
             text-align: center;
             text-shadow:
               0 0 16px rgba(255,255,255,0.12),
               0 0 30px rgba(252, 211, 77, 0.1),
               0 16px 30px rgba(0,0,0,0.4);
             direction: rtl;
             font-feature-settings: "liga" 1, "rlig" 1, "calt" 1;
             -webkit-font-smoothing: antialiased;
          }

          .current-prayer-shell {
             width: min(62vw, 760px);
             max-width: min(calc(100vw - 3rem), 760px);
             padding: 1rem 2.1rem 1.25rem;
             border-radius: 2rem;
             background:
               linear-gradient(180deg, rgba(2, 6, 23, 0.9), rgba(2, 6, 23, 0.72)),
               radial-gradient(circle at top, rgba(252, 211, 77, 0.16), transparent 58%);
             border: 1px solid rgba(252, 211, 77, 0.28);
             box-shadow:
               0 18px 44px rgba(0, 0, 0, 0.32),
               inset 0 1px 0 rgba(255,255,255,0.08),
               0 0 34px rgba(252, 211, 77, 0.08);
             backdrop-filter: blur(16px);
          }

          .current-prayer-kicker {
             font-family: 'Cairo', sans-serif;
             font-size: 0.8rem;
             font-weight: 900;
             letter-spacing: 0.34em;
             color: rgba(252, 211, 77, 0.78);
             text-transform: uppercase;
          }

          .current-prayer-display {
             font-family: 'Cairo', sans-serif;
             font-size: clamp(2.2rem, 3.7vw, 4.4rem);
             font-weight: 900;
             line-height: 1.1;
             color: #ffffff;
             text-shadow:
               0 0 16px rgba(255,255,255,0.1),
               0 12px 24px rgba(0,0,0,0.36);
          }

          .current-prayer-time {
             font-family: 'Amiri', serif;
             font-size: clamp(1.2rem, 1.8vw, 2rem);
             color: rgba(253, 230, 138, 0.88);
             letter-spacing: 0.08em;
          }
	      `}</style>
      
      {/* --- LAYER 2: HEADER --- */}
      <header className="relative z-10 w-full p-8 flex justify-between items-center">
         <div className="text-right">
             <div className="text-5xl font-bold font-cairo text-white tracking-tighter drop-shadow-lg tabular-nums">
                 {formatTime(currentTime)}
             </div>
             <div className="text-gold-200 font-amiri text-xl mt-1 opacity-80">{formatDateAR(currentTime)}</div>
         </div>

	         <div className="absolute left-1/2 top-10 -translate-x-1/2">
	             <div className="current-prayer-shell flex items-center justify-center gap-5 shadow-[0_0_30px_rgba(236,163,21,0.12)]">
	                 <span className="relative flex h-4 w-4 shrink-0">
	                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
	                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
	                 </span>
	                 <div className="flex flex-col items-center leading-none">
	                     <span className="current-prayer-kicker mb-2">الصلاة الحالية</span>
	                     <span className="current-prayer-display">{currentPrayer.nameAR}</span>
                       <span className="current-prayer-time mt-2">{prayerTimeLabel}</span>
	                 </div>
	             </div>
	         </div>

	         <div className="text-left">
	             <h2 className="text-gold-400 font-bold text-lg tracking-wider uppercase mb-1">Prayer Time</h2>
	             <h1 className="text-4xl font-bold text-white font-amiri">{prayerTimeLabel}</h1>
	         </div>
	      </header>


      {/* --- LAYER 3: MAIN STAGE (Rakah Counter) --- */}
	      <main className="flex-1 relative z-10 flex flex-col items-center justify-center gap-10 -mt-10">
	         
	         <div className="relative w-[500px] h-[500px] flex items-center justify-center">
             
             {/* Animations */}
             <div className="absolute inset-0 rounded-full border border-gold-500/10 animate-[spin_20s_linear_infinite]"></div>
             <div className="absolute inset-4 rounded-full border border-gold-500/20 border-dashed animate-[spin_30s_linear_infinite_reverse]"></div>
             <div className="absolute inset-16 rounded-full border-2 border-gold-500/40 animate-pulse"></div>
             <div className="absolute inset-0 bg-gold-500/5 blur-3xl rounded-full"></div>

             {/* Inner Circle */}
             <div className="w-64 h-64 rounded-full glass-panel flex flex-col items-center justify-center relative z-20 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                 <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none"></div>
                 
                 {/* The Number - Using key to force re-render animation */}
                 <div key={rakah} className={`${isTransitioning ? 'animate-[number-exit_0.3s_forwards]' : 'animate-[number-enter_0.5s_forwards]'}`}>
                     <span className="text-[10rem] font-bold font-cairo gold-gradient-text leading-none block -mt-4">
                        {rakah}
                     </span>
                 </div>
                 <span className="text-gold-300 font-amiri text-2xl font-bold -mt-2 tracking-wide z-10">الركعة الحالية</span>
             </div>

             <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent to-gold-500/50"></div>
	             <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-24 h-[1px] bg-gradient-to-l from-transparent to-gold-500/50"></div>
	         </div>

           <div className="flex flex-col items-center gap-4 px-6">
             <div className="imam-name-kicker">إمام الجماعة</div>
             <div className="imam-name-shell">
               <div className="imam-name-display">{imamName || 'يُحدَّد من الإعدادات'}</div>
             </div>
           </div>

	      </main>
	    
	    </div>
	  );
};

export default PrayerView;
