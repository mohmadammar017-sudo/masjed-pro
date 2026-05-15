
import React, { useEffect, useState } from 'react';

const RamadanBackground: React.FC = () => {
  const [stars, setStars] = useState<Array<{id: number, size: string, top: string, left: string, duration: string, delay: string}>>([]);

  useEffect(() => {
    const starCount = 150;
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      newStars.push({
        id: i,
        size: Math.random() * 2 + 1 + 'px',
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        duration: Math.random() * 3 + 2 + 's',
        delay: Math.random() * 5 + 's'
      });
    }
    setStars(newStars);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-[#050a1f]">
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scale(1); filter: blur(4px) brightness(1.2); }
          50% { opacity: 0.8; transform: scale(0.95); filter: blur(6px) brightness(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes stars-twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes mist-move {
          0% { transform: translateX(-5%); }
          100% { transform: translateX(5%); }
        }
        .animate-flicker { animation: flicker 3s ease-in-out infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>

      {/* Sky Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#1e293b]">
         {stars.map(star => (
            <div 
               key={star.id} 
               className="absolute bg-white rounded-full"
               style={{
                  width: star.size,
                  height: star.size,
                  left: star.left,
                  top: star.top,
                  animation: `stars-twinkle ${star.duration} ease-in-out infinite`,
                  animationDelay: star.delay
               }}
            />
         ))}
      </div>

      {/* Moon */}
      <div className="absolute top-[5%] left-1/2 -translate-x-1/2 z-10 opacity-80">
         <svg className="w-48 h-48 md:w-64 md:h-64 text-yellow-100 drop-shadow-[0_0_40px_rgba(253,224,71,0.4)]" fill="currentColor" viewBox="0 0 100 100">
             <path d="M50 10 A40 40 0 1 0 90 50 A32 32 0 1 1 50 10 Z"></path>
         </svg>
      </div>

      {/* Lanterns - Left */}
      <div className="absolute top-0 left-[5%] z-20 hidden md:block opacity-90">
          <div className="flex gap-12">
             <div className="flex flex-col items-center animate-float" style={{animationDelay: '0s'}}>
                <div className="w-px h-32 bg-gray-600/50"></div>
                <div className="relative w-12 h-20 bg-amber-600/80 rounded-b-lg rounded-t-sm animate-flicker flex items-center justify-center shadow-[0_0_50px_rgba(251,191,36,0.4)]">
                   <div className="w-4 h-10 bg-yellow-200 rounded-full blur-sm"></div>
                </div>
             </div>
             <div className="flex flex-col items-center animate-float" style={{animationDelay: '1.5s'}}>
                <div className="w-px h-48 bg-gray-600/50"></div>
                <div className="relative w-10 h-16 bg-amber-700/80 rounded-b-lg rounded-t-sm animate-flicker flex items-center justify-center shadow-[0_0_40px_rgba(217,119,6,0.3)]">
                   <div className="w-3 h-8 bg-yellow-100 rounded-full blur-sm"></div>
                </div>
             </div>
          </div>
      </div>
      
      {/* Lanterns - Right */}
      <div className="absolute top-0 right-[5%] z-20 hidden md:block opacity-90">
         <div className="flex gap-12">
            <div className="flex flex-col items-center animate-float" style={{animationDelay: '0.5s'}}>
               <div className="w-px h-40 bg-gray-600/50"></div>
               <div className="relative w-10 h-16 bg-amber-700/80 rounded-b-lg rounded-t-sm animate-flicker flex items-center justify-center shadow-[0_0_40px_rgba(217,119,6,0.3)]">
                  <div className="w-3 h-8 bg-yellow-100 rounded-full blur-sm"></div>
               </div>
            </div>
            <div className="flex flex-col items-center animate-float" style={{animationDelay: '2s'}}>
               <div className="w-px h-24 bg-gray-600/50"></div>
               <div className="relative w-12 h-20 bg-amber-600/80 rounded-b-lg rounded-t-sm animate-flicker flex items-center justify-center shadow-[0_0_50px_rgba(251,191,36,0.4)]">
                  <div className="w-4 h-10 bg-yellow-200 rounded-full blur-sm"></div>
               </div>
            </div>
         </div>
      </div>

      {/* Clouds */}
      <div className="absolute top-[20%] left-0 w-full h-full opacity-30 z-10">
          <div className="absolute top-10 left-[-10%] w-96 h-64 bg-blue-400/20 blur-[100px] rounded-full animate-float"></div>
          <div className="absolute top-40 right-[-5%] w-80 h-80 bg-purple-500/10 blur-[100px] rounded-full animate-float" style={{animationDelay: '-3s'}}></div>
      </div>

      {/* Mosque Silhouette */}
      <div className="absolute bottom-0 w-full z-10 flex flex-col items-center">
          <div className="w-full max-w-7xl px-4 translate-y-4 opacity-60 mix-blend-multiply">
              <svg className="w-full h-auto text-[#020617] fill-current drop-shadow-[0_-20px_50px_rgba(30,41,59,0.8)]" viewBox="0 0 800 300">
                  <rect height="200" width="10" x="150" y="100"></rect>
                  <path d="M145 100 L165 100 L155 70 Z"></path>
                  <rect height="250" width="15" x="250" y="50"></rect>
                  <path d="M242 50 L272 50 L257.5 10 Z"></path>
                  <path d="M300 300 Q400 100 500 300 Z"></path>
                  <circle cx="400" cy="180" r="60"></circle>
                  <path d="M550 150 Q600 80 650 150 L650 300 L550 300 Z"></path>
                  <rect height="180" width="10" x="680" y="120"></rect>
                  <path d="M675 120 L695 120 L685 90 Z"></path>
                  <rect height="20" width="800" x="0" y="280"></rect>
              </svg>
          </div>
          
          {/* Mist */}
          <div className="absolute bottom-0 w-full h-64 overflow-hidden pointer-events-none">
             <div className="absolute bottom-0 w-[200%] h-full bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-90" style={{animation: 'mist-move 20s linear infinite'}}></div>
             <div className="absolute -bottom-10 w-[200%] h-full bg-gradient-to-t from-blue-900/40 via-transparent to-transparent opacity-60" style={{animation: 'mist-move 15s linear infinite reverse'}}></div>
          </div>
      </div>
    </div>
  );
};

export default RamadanBackground;
