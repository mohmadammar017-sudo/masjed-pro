import React, { useState, useEffect, useRef } from 'react';
import { AdhanSettings } from '../types';

interface AdhanViewProps {
  prayerName: string;
  imamName: string;
  settings: AdhanSettings;
  onExit: () => void;
  onBack: () => void;
}

const ADHAN_LINES = [
  "الله أكبر",
  "الله أكبر",
  "الله أكبر",
  "الله أكبر",
  "أشهد أن لا إله إلا الله",
  "أشهد أن لا إله إلا الله",
  "أشهد أن محمداً رسول الله",
  "أشهد أن محمداً رسول الله",
  "أشهد أن علياً ولي الله",
  "أشهد أن علياً ولي الله",
  "حي على الصلاة",
  "حي على الصلاة",
  "حي على الفلاح",
  "حي على الفلاح",
  "حي على خير العمل",
  "حي على خير العمل",
  "الله أكبر الله أكبر",
  "لا إله إلا الله",
  "لا إله إلا الله",
  "HADITH_SLIDE"
];

const HADITH_DATA = {
  title: "عن أمير المؤمنين (عليه السلام):",
  body: "مَنْ سَجَدَ بَيْنَ الْأَذَانِ وَ الْإِقَامَةِ وَ قَالَ:\n«رَبِّ لَكَ سَجَدْتُ خَاضِعاً خَاشِعاً ذَلِيلاً»\nجَعَلَ اللَّهُ مَحَبَّتَهُ فِي قُلُوبِ الْمُؤْمِنِينَ، وَ هَيْبَتَهُ فِي قُلُوبِ الْمُنَافِقِينَ.",
  source: "بحار الأنوار – ج ٨١ ص ١٥٢"
};

const AdhanView: React.FC<AdhanViewProps> = ({ prayerName, imamName, settings, onExit, onBack }) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false); // Global exit (end of adhan)
  
  // New state for line-to-line transitions
  const [transitionState, setTransitionState] = useState<'entering' | 'exiting' | 'idle'>('entering');
  const [pulseTrigger, setPulseTrigger] = useState(0); 
  
  const onExitRef = useRef(onExit);
  
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  // Handle Cinematic Exit (End of Adhan)
  const handleExit = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
        onExitRef.current();
    }, 1500); 
  };

  // Logic to advance lines with smooth transition
  const advanceLine = () => {
    if (transitionState !== 'idle' && transitionState !== 'entering') return; // Prevent double trigger

    if (currentLineIndex < ADHAN_LINES.length - 1) {
        // 1. Trigger Exit Animation for current line
        setTransitionState('exiting');
        
        // 2. Wait for animation, then switch text and trigger Enter
        setTimeout(() => {
            setCurrentLineIndex(prev => prev + 1);
            setPulseTrigger(prev => prev + 1);
            setTransitionState('entering');
            
            // 3. Reset to idle after enter animation completes
            setTimeout(() => {
                setTransitionState('idle');
            }, 600); // Matches CSS enter duration
        }, 500); // Matches CSS exit duration
    } else {
        handleExit();
    }
  };

  // Logic to retreat lines
  const retreatLine = () => {
    if (currentLineIndex > 0) {
        setTransitionState('exiting');
        setTimeout(() => {
            setCurrentLineIndex(prev => prev - 1);
            setPulseTrigger(prev => prev + 1);
            setTransitionState('entering');
            setTimeout(() => setTransitionState('idle'), 600);
        }, 500);
    } else {
        onBack();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (settings.transitionMode === 'auto') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExiting) return;
      if (['Space', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'Space':
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          advanceLine();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          retreatLine();
          break;
        case 'Escape':
          handleExit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLineIndex, transitionState, isExiting, settings.transitionMode]); // Added transitionState deps

  // Auto Transition
  useEffect(() => {
    if (settings.transitionMode === 'manual') return;

    const isHadith = ADHAN_LINES[currentLineIndex] === "HADITH_SLIDE";
    const duration = isHadith ? Math.max(settings.autoDuration * 3, 20) : settings.autoDuration;

    const interval = setInterval(() => {
        advanceLine();
    }, duration * 1000);

    return () => clearInterval(interval);
  }, [currentLineIndex, settings.transitionMode, settings.autoDuration]); 

  const isHadithSlide = ADHAN_LINES[currentLineIndex] === "HADITH_SLIDE";
  const nextLine = !isHadithSlide && currentLineIndex < ADHAN_LINES.length - 1 ? ADHAN_LINES[currentLineIndex + 1] : null;

  // Helper function to colorize text between parentheses/quotes
  const renderFormattedHadith = (text: string) => {
    // Regex matches «...» OR (...) including the brackets
    const parts = text.split(/(«[^»]+»|\([^)]+\))/g);
    return parts.map((part, i) => {
        // Check if this part is the quoted text
        if (part.startsWith('«') || part.startsWith('(')) {
            return (
                <span key={i} className="text-cyan-300 drop-shadow-[0_0_15px_rgba(103,232,249,0.6)] font-bold mx-1 inline-block transform hover:scale-105 transition-transform duration-300">
                    {part}
                </span>
            );
        }
        return <span key={i}>{part}</span>;
    });
  };

  return (
    <div 
        className="h-screen w-full overflow-hidden flex flex-col items-center justify-center relative font-amiri" 
        dir="rtl"
        style={{ backgroundColor: settings.backgroundColor || '#020617' }}
    >
      
      {/* 1. Dynamic Background Layers */}
      <div 
        className={`absolute inset-0 z-0 bg-cover bg-center transition-all duration-[2s] ease-in-out ${isHadithSlide ? 'scale-105 brightness-[0.2] blur-sm' : 'scale-110 brightness-[0.3] blur-[2px]'}`}
        style={{ 
             backgroundImage: settings.backgroundImage 
                ? `url(${settings.backgroundImage})` 
                : `radial-gradient(circle at center, ${settings.backgroundColor || '#1e1b4b'} 0%, #000000 100%)`,
        }}
      ></div>

      {!isHadithSlide && (
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-1000">
           <svg className="animate-[spin_60s_linear_infinite] w-[150vmax] h-[150vmax] text-gold-500" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.2">
              <circle cx="50" cy="50" r="40" strokeDasharray="4 4" />
              <path d="M50 10 L90 50 L50 90 L10 50 Z" />
           </svg>
        </div>
      )}

      {/* God Rays for Hadith */}
      {isHadithSlide && (
         <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center animate-fade-in">
             <div className="w-[200vw] h-[200vh] bg-[conic-gradient(from_0deg_at_50%_50%,rgba(212,172,13,0.1)_0deg,transparent_20deg,rgba(212,172,13,0.1)_40deg,transparent_60deg)] animate-[spin_40s_linear_infinite] opacity-30 mix-blend-screen"></div>
         </div>
      )}

      {/* Pulse Effect */}
      <div key={pulseTrigger} className="absolute inset-0 z-0 bg-gold-500/10 animate-[ping_1s_cubic-bezier(0,0,0.2,1)_1] opacity-0 pointer-events-none"></div>
      
      {/* Exit Overlay */}
      <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-[1.5s] ease-in-out ${isExiting ? 'opacity-100' : 'opacity-0'}`}></div>


      {/* Styles & Keyframes */}
      <style>{`
        @keyframes liquidGold {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .text-gold-liquid {
          background: linear-gradient(to right, #bf953f 20%, #fcf6ba 40%, #b38728 60%, #fbf5b7 80%, #aa771c 100%);
          background-size: 200% auto;
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          animation: liquidGold 4s linear infinite;
        }

        /* Smooth Text Transitions */
        @keyframes blurOutUp {
            0% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
            100% { opacity: 0; transform: translateY(-50px) scale(0.9); filter: blur(20px); }
        }
        @keyframes blurInUp {
            0% { opacity: 0; transform: translateY(50px) scale(1.1); filter: blur(20px); }
            100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        .animate-blur-out {
            animation: blurOutUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .animate-blur-in {
            animation: blurInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Border Flow for Hadith Box */
        @keyframes borderFlow {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
        }
        .animated-border-box {
            position: relative;
            background: rgba(2, 6, 23, 0.7);
            border-radius: 1rem;
        }
        .animated-border-box::before {
            content: '';
            position: absolute;
            inset: -2px;
            z-index: -1;
            background: linear-gradient(60deg, #d4ac0d, #020617, #06b6d4, #020617, #d4ac0d);
            background-size: 300% 300%;
            border-radius: inherit;
            animation: borderFlow 6s alternate infinite;
            filter: blur(5px);
            opacity: 0.6;
        }

        .audio-bar {
           width: 6px;
           background: linear-gradient(to top, #d4ac0d, #fff);
           border-radius: 99px;
           animation: audioWave 1s ease-in-out infinite;
        }
        @keyframes audioWave {
           0%, 100% { height: 10%; }
           50% { height: 100%; }
        }
      `}</style>

      {/* 2. Main Content */}
      <main className="relative z-10 w-full h-full flex flex-col items-center justify-between py-12 px-4">
        
        {/* Header */}
	        <header className={`w-full max-w-7xl flex flex-wrap justify-between items-start gap-6 transition-all duration-700 ${isHadithSlide ? 'opacity-0 -translate-y-10' : 'opacity-100'}`}>
	           <div className="flex min-w-0 flex-1 flex-col">
	              <span className="text-gold-300 font-sans font-bold tracking-widest text-sm uppercase mb-1 opacity-80">Now Calling</span>
	              <h1 className="max-w-full break-words text-3xl md:text-5xl lg:text-6xl font-bold leading-tight text-white drop-shadow-md">{prayerName}</h1>
	              <div className="h-1 w-24 bg-gradient-to-r from-gold-500 to-transparent mt-2 rounded-full"></div>
	           </div>
	           {!isHadithSlide && (
	              <div className="flex shrink-0 items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/20 shadow-lg">
	                 <div className="text-right">
	                    <span className="block text-xs text-gold-200 font-sans">إمام الجماعة</span>
	                    <span className="block text-lg font-bold text-white leading-none">{imamName}</span>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-white shadow-inner"><i className="fa-solid fa-user"></i></div>
              </div>
           )}
        </header>


        {/* CENTER STAGE with TRANSITIONS */}
        <section className="flex-1 flex flex-col items-center justify-center w-full relative z-20">
           
           {/* Determine Animation Class based on State */}
           <div className={`w-full flex justify-center transform transition-all duration-300 ${transitionState === 'exiting' ? 'animate-blur-out' : 'animate-blur-in'}`}>
              
              {isHadithSlide ? (
                  /* --- RECTANGULAR & BEAUTIFUL HADITH SLIDE --- */
                  <div className="w-full max-w-[90rem] px-4 md:px-0">
                      
                      <div className="animated-border-box rounded-[20px] backdrop-blur-xl p-1"> {/* Wrapper for border */}
                          <div className="bg-[#0f172a]/80 rounded-[18px] w-full h-full p-10 md:p-16 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 shadow-2xl">
                             
                             {/* Decorative Background inside box */}
                             <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                             <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-500/10 blur-[100px] rounded-full pointer-events-none"></div>

                             {/* Right Side: Icon & Title */}
                             <div className="flex flex-col items-center md:items-start text-center md:text-right border-b md:border-b-0 md:border-l border-white/10 pb-8 md:pb-0 md:pl-12 md:w-1/4">
                                 <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-700 flex items-center justify-center shadow-[0_0_30px_rgba(236,163,21,0.3)] mb-6 transform rotate-3">
                                    <i className="fa-solid fa-book-open text-4xl text-white"></i>
                                 </div>
                                 <h2 className="text-xl md:text-2xl text-cyan-200 font-bold font-sans tracking-wide uppercase opacity-90 mb-2">
                                    قبسات من النور
                                 </h2>
                                 <h3 className="text-2xl md:text-3xl text-white font-bold font-amiri leading-relaxed">
                                    {HADITH_DATA.title}
                                 </h3>
                             </div>

                             {/* Left Side: The Content */}
                             <div className="flex-1 flex flex-col items-center md:items-start justify-center gap-8 relative z-10">
                                 
                                 {/* Body Text with Smart Highlighting */}
                                 <p className="text-3xl md:text-5xl lg:text-[3.5rem] leading-[1.8] md:leading-[1.8] text-white font-scheherazade font-bold drop-shadow-md text-center md:text-right w-full">
                                    {renderFormattedHadith(HADITH_DATA.body)}
                                 </p>

                                 {/* Source */}
                                 <div className="w-full flex justify-end mt-4">
                                     <div className="px-6 py-2 bg-white/5 rounded-lg border border-white/10 flex items-center gap-3 text-gray-400 hover:text-white transition-colors cursor-default">
                                        <span className="font-sans text-lg tracking-wide">{HADITH_DATA.source}</span>
                                        <i className="fa-solid fa-bookmark text-gold-500 text-sm"></i>
                                     </div>
                                 </div>
                             </div>

                          </div>
                      </div>
                  </div>

	              ) : (
	                  /* --- STANDARD ADHAN LINES --- */
	                  <div className="w-full max-w-[92rem] text-center px-4">
	                      <h1 className="text-[4rem] md:text-[7rem] lg:text-[9rem] font-bold leading-[1.18] text-gold-liquid filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] font-amiri break-words">
	                          {ADHAN_LINES[currentLineIndex]}
	                      </h1>
	                  </div>
              )}

           </div>

           {/* Ghost Text (Preview) */}
           {nextLine && !isHadithSlide && nextLine !== "HADITH_SLIDE" && (
               <div className={`absolute bottom-[10%] transition-opacity duration-300 ${transitionState === 'exiting' ? 'opacity-0' : 'opacity-30'} transform scale-75 blur-[1px]`}>
                   <p className="text-3xl md:text-4xl text-gray-400 font-amiri animate-pulse">{nextLine}</p>
                   <i className="fa-solid fa-chevron-down text-gold-500 mt-2 block mx-auto"></i>
               </div>
           )}

        </section>


        {/* Footer (Controls) */}
        <footer className={`w-full max-w-5xl flex flex-col items-center gap-6 z-20 transition-all duration-1000 ${isHadithSlide ? 'opacity-0 translate-y-10' : 'opacity-100'}`}>
            {/* Visualizer */}
            <div className="h-12 flex items-center justify-center gap-1.5 opacity-80">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="audio-bar" style={{ height: '20%', animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${0.5 + Math.random() * 0.5}s` }}></div>
                ))}
            </div>
            {/* Progress */}
            <div className="w-full flex items-center gap-1.5 px-4">
                {ADHAN_LINES.map((_, idx) => (
                    <div key={idx} className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentLineIndex ? 'flex-[3] bg-gold-500 shadow-[0_0_10px_#ECA315]' : idx < currentLineIndex ? 'flex-1 bg-gold-500/40' : 'flex-1 bg-gray-800'}`}></div>
                ))}
            </div>
        </footer>

      </main>
    </div>
  );
};

export default AdhanView;
