
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PrayerTime, AdhanSettings } from '../types';

interface PreAdhanTransitionProps {
  prayer: PrayerTime;
  settings?: AdhanSettings;
  onComplete: () => void;
}

const PreAdhanTransition: React.FC<PreAdhanTransitionProps> = ({ prayer, settings, onComplete }) => {
  const [exiting, setExiting] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  const DURATION = 8000;
  
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const updateTime = () => {
        const now = new Date();
        // 24-hour format like 18:43
        setTimeStr(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
        if (onCompleteRef.current) {
            onCompleteRef.current();
        }
    }, 1500); 
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        triggerExit();
    }, DURATION);
    return () => clearTimeout(timer);
  }, [triggerExit]); 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['ArrowRight', 'Enter', 'Space'].includes(e.code)) {
             triggerExit();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerExit]);

  return (
    <div className={`fixed inset-0 z-[100] w-full h-screen overflow-hidden bg-[#111821] text-white transition-opacity duration-1000 ${exiting ? 'opacity-0' : 'opacity-100'}`}>
        
        <style>{`
            .glass-panel {
                background: rgba(17, 24, 33, 0.4);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .text-glow-white {
                text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
            }

            .gold-gradient-text {
                background: linear-gradient(to bottom, #fcd34d, #d97706);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 0 8px rgba(217, 119, 6, 0.5));
            }

            .particle {
                position: absolute;
                background: white;
                border-radius: 50%;
                opacity: 0;
                pointer-events: none;
            }

            .god-rays {
                background: linear-gradient(
                    45deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(255, 255, 255, 0.05) 30%,
                    rgba(255, 255, 255, 0) 60%
                );
                filter: blur(20px);
            }

            @keyframes pulse-slow {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            @keyframes glow {
                from { text-shadow: 0 0 10px #fbbf24, 0 0 20px #fbbf24; }
                to { text-shadow: 0 0 20px #fbbf24, 0 0 30px #d97706; }
            }
            @keyframes rise {
                0% { transform: translateY(100vh) scale(0); opacity: 0; }
                50% { opacity: 0.6; }
                100% { transform: translateY(-10vh) scale(1); opacity: 0; }
            }

            .animate-pulse-slow { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            .animate-float { animation: float 6s ease-in-out infinite; }
            .animate-glow { animation: glow 3s ease-in-out infinite alternate; }
            .animate-particle-rise { animation: rise 10s linear infinite; }
        `}</style>

        {/* Background Layer: Updated Image */}
        <div className="absolute inset-0 w-full h-full z-0">
            <img alt="" className="w-full h-full object-cover opacity-90" src={settings?.backgroundImage || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbIaLr3XNueni1GZ-07T8u9TuUhODIEyJHEVpu8Hrj_TKMVq6m7v-h478xV0bmghG3fdth2nTjMOcIIT9Enp7bKOa-nPtUmGC2xM7IEkDcH-MguKdbmWDCVOZzvAKkPXXiyLM6BeeGM-FtTqs91rTw8i-ySjStBvK2aFM16geCknnP8PYR5MDOieG1YFSr4cU5X524L-YhVwFTTjO0u4lmfC8PRcdpU4zP_56Uthtf99Rs_2YFmhuFkiYxeGh17n8DtkbkjLxBUiAS'}/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#111821]/90 via-[#1978e5]/20 to-transparent"></div>
            <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* God Rays Effect Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="god-rays absolute top-[-50%] left-[-20%] w-[150%] h-[200%] rotate-12 animate-pulse-slow"></div>
            <div className="god-rays absolute top-[-50%] right-[-20%] w-[150%] h-[200%] -rotate-12 animate-pulse-slow delay-1000"></div>
        </div>

        {/* Floating Dust Particles */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="particle w-1 h-1 left-[10%] animate-particle-rise" style={{animationDuration: '15s', animationDelay: '0s'}}></div>
            <div className="particle w-2 h-2 left-[20%] animate-particle-rise" style={{animationDuration: '12s', animationDelay: '2s'}}></div>
            <div className="particle w-1 h-1 left-[40%] animate-particle-rise" style={{animationDuration: '18s', animationDelay: '1s'}}></div>
            <div className="particle w-3 h-3 left-[60%] animate-particle-rise" style={{animationDuration: '20s', animationDelay: '4s'}}></div>
            <div className="particle w-1 h-1 left-[80%] animate-particle-rise" style={{animationDuration: '14s', animationDelay: '3s'}}></div>
            <div className="particle w-2 h-2 left-[90%] animate-particle-rise" style={{animationDuration: '16s', animationDelay: '5s'}}></div>
        </div>

        {/* Main Content Container */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between items-center py-12 px-8">
            
            {/* Header: Minimal Clock */}
            <div className="w-full flex justify-end">
                <div className="glass-panel rounded-full px-6 py-2 flex items-center gap-3 shadow-lg border-[#1978e5]/20">
                    <i className="fa-regular fa-clock text-[#1978e5]/80 text-xl"></i>
                    <span className="text-2xl font-semibold tracking-widest text-white/90 font-vietnam">{timeStr}</span>
                </div>
            </div>

            {/* Center: Prayer Notification */}
            <div className="flex-1 flex flex-col justify-center items-center w-full max-w-5xl text-center space-y-8 mt-10">
                <div className="space-y-4 animate-float">
                    <h1 className="font-amiri text-6xl md:text-8xl lg:text-9xl text-white text-glow-white leading-tight opacity-95">
                        حَانَ وَقْتُ الصَّلَاةِ
                    </h1>
                    <h2 className="font-amiri text-5xl md:text-7xl lg:text-8xl font-bold mt-4 gold-gradient-text animate-pulse-slow">
                        صَلَاةُ {prayer.nameAR}
                    </h2>
                </div>
                <div className="opacity-60 text-sm tracking-[0.3em] uppercase mt-8 font-light font-vietnam">
                    It is time for {prayer.nameEN} Prayer
                </div>
            </div>

            {/* Mosque Silhouette Layer */}
            <div className="absolute bottom-0 left-0 right-0 z-0 flex justify-center items-end pointer-events-none">
                <div className="relative w-full max-w-6xl mx-auto h-64 md:h-96 opacity-90">
                    <img alt="Silhouette of a mosque minaret" className="w-full h-full object-cover object-bottom [mask-image:linear-gradient(to_top,black_60%,transparent)] brightness-50 contrast-125 grayscale mix-blend-multiply" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB29HXXMvS7Fw5-IjjyHXfDgFAkZxbF9EK_pHAGCp-p0SCl5gYjlkycNTI9t3CcB_EVCcPB-zu1RS-D_g-DzuE_MlpcBzx8P64dErS_VdwvlgR_rpZW4GH05D2V19R2jQPvr9cpvZ3fem_M9UrDDylSrhHd07w8aTD553ZLLHUjdzF_uX3UbOyK5aJ5uAyujwtFRB5ey4gtazbL66YrVbntupRTF8rklMsQ5BpvMVwUU3uarbWonG4f6dOEj0G1WpdLN3paEi9Q7M0"/>
                    
                    {/* The "Illuminated Balcony" Light Effect */}
                    <div className="absolute bottom-[40%] left-1/2 -translate-x-1/2 w-8 h-8 bg-orange-400 rounded-full blur-[20px] opacity-80 animate-pulse"></div>
                    <div className="absolute bottom-[40%] left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full blur-[2px] opacity-90"></div>
                </div>
            </div>

            {/* Footer: Reminder Text */}
            <div className="relative z-20 mb-8 animate-pulse-slow">
                <div className="glass-panel px-10 py-4 rounded-xl border-t border-[#1978e5]/30 shadow-2xl">
                    <p className="font-amiri text-3xl md:text-4xl text-white/90 text-center drop-shadow-md">
                        يُرجى الاستعداد للصلاة
                    </p>
                    <p className="text-xs text-center text-white/50 mt-2 font-vietnam uppercase tracking-widest">
                        Please prepare for prayer
                    </p>
                </div>
            </div>
            
        </div>
    </div>
  );
};

export default PreAdhanTransition;
