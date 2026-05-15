
import React, { useEffect, useState } from 'react';
import { PrayerSettings } from '../types';
import { MoonStar, ListOrdered, Sparkles, Monitor, ArrowRight } from 'lucide-react';

interface PostIshaViewProps {
  onExit: () => void;
  onBack: () => void;
  settings?: PrayerSettings;
}

const PostIshaView: React.FC<PostIshaViewProps> = ({ onExit, onBack, settings }) => {
  const [isLargeMode, setIsLargeMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'Space'].includes(e.code)) {
        onExit();
        return;
      }
      if (['ArrowLeft', 'Escape', 'Backspace'].includes(e.code)) {
        e.preventDefault();
        onBack();
        return;
      }
      if (e.key.toLowerCase() === 'l') {
        setIsLargeMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onExit]);

  return (
    <div className="h-screen w-screen bg-[#0B1121] text-white font-sans flex flex-col overflow-hidden" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Inter:wght@400;500;600;700&display=swap');
        
        body {
          font-family: 'Cairo', 'Inter', sans-serif;
        }
        .glow-box {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), inset 0 0 10px rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.4);
        }
        .text-glow {
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
        }
        .glass-panel {
          background: rgba(22, 32, 50, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .font-arabic {
          font-family: 'Cairo', sans-serif;
        }
        .tv-title {
          font-size: ${isLargeMode ? '9vh' : '6vh'};
        }
        .tv-subtitle {
          font-size: ${isLargeMode ? '6vh' : '4.5vh'};
        }
        .tv-body {
          font-size: ${isLargeMode ? '5vh' : '3.5vh'};
        }
        .tv-body-lg {
          font-size: ${isLargeMode ? '6vh' : '4.5vh'};
        }
      `}</style>

      <main className="flex flex-1 w-full h-full p-6 gap-6 overflow-hidden">
        {/* RIGHT SIDEBAR (In RTL) */}
        <section className="hidden lg:flex flex-col w-1/3 h-full rounded-2xl relative overflow-hidden group shadow-2xl">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" 
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCiPdKKGbcnjJXvVfNWbayfuHd4lwDLpvWo9_2URId94WQ98FiB7nCPHBDai4nt62s57DLfAmFSPdSHR_vMGaMIH1EQF6pn0VL8zxfS_dzKvwXPgxBuuUFVpEUxYeRXQR5w-pGgq4entgS0W7bYWkOmikldKu4smTJpRoaSoFkUnnIjNRr6v6gzC83mKfRRBBQF76jkEHFSl9X5Ld-PcLKeIqXNCVgcx6crh1L78vh5ntUINUeBh7MaNNH97T1Fq3tRa48ISGEobcPb')" }}
          >
          </div>
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0B1121] via-[#0B1121]/80 to-transparent"></div>
          <div className="absolute inset-0 z-10 bg-[#1978e5]/20 mix-blend-overlay"></div>
          
          <div className="relative z-20 flex flex-col justify-between h-full p-10 text-center items-center">
            <div className="mt-12 bg-white/10 p-6 rounded-full backdrop-blur-sm border border-white/10 shadow-[0_0_15px_rgba(25,120,229,0.5)]">
              <MoonStar className="w-16 h-16 text-white" />
            </div>
            
            <div className="mb-20">
              <h1 className={`font-black text-white leading-tight text-glow mb-6 tv-title`}>
                صلاة ركعتين <br/>
                في كل ليلة من <br/>
                <span className="text-[#1978e5]">شهر رمضان</span>
              </h1>
              <div className="w-16 h-1 bg-[#1978e5] mx-auto rounded-full"></div>
              <p className={`mt-6 text-blue-100 opacity-90 leading-relaxed max-w-xs mx-auto font-bold tv-body`}>
                تقبل الله أعمالكم وصيامكم وقيامكم في هذا الشهر الفضيل
              </p>
            </div>
          </div>
        </section>

        {/* MAIN CONTENT AREA */}
        <section className="flex-1 h-full flex flex-col justify-center rounded-2xl bg-[#0B1121]/50 p-2 lg:p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className={`font-bold text-white flex items-center gap-3 tv-subtitle`}>
              <ListOrdered className="text-[#1978e5] w-10 h-10" />
              كيفية الصلاة
            </h3>
            <div className="flex items-center gap-2 bg-[#162032] px-4 py-2 rounded-full border border-white/5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm font-arabic text-blue-200">بث مباشر</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 h-full justify-center">
            {/* Step 1 */}
            <div className="glass-panel flex items-center justify-between p-4 rounded-xl transition-transform hover:scale-[1.01]">
              <div className="flex items-center gap-4 w-full">
                <div className="bg-[#1978e5]/20 text-[#1978e5] w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-2xl border border-[#1978e5]/30">1</div>
                <h4 className={`font-bold text-white leading-snug tv-body`}>
                  في كل ركعة: سورة الحمد + سورة التوحيد <span className="text-[#1978e5] mx-2">(٣ مرات)</span>
                </h4>
              </div>
            </div>

            {/* Step 2 - Highlighted */}
            <div className="bg-gradient-to-br from-[#1978e5]/20 to-[#162032] p-5 rounded-2xl glow-box relative overflow-hidden flex-grow flex flex-col justify-center">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#1978e5] to-transparent opacity-50"></div>
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className="bg-[#1978e5] text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/50">2</div>
                  <span className="text-blue-300 text-lg font-semibold uppercase tracking-wider">بعد التسليم</span>
                </div>
                <Sparkles className="text-[#1978e5]/50 w-10 h-10" />
              </div>
              <p className={`leading-loose text-center font-black text-white py-2 px-2 font-arabic text-glow tv-body-lg`}>
                سُبْحانَ مَنْ هُوَ حَفيظٌ لا يَغْفُلُ، سُبْحانَ مَنْ هُوَ رَحيمٌ لا يَعْجَلُ،<br/> سُبْحانَ مَنْ هُوَ قائِمٌ لا يَسْهو، سُبْحانَ مَنْ هُوَ دائِمٌ لا يَلْهو
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-panel flex items-center p-4 rounded-xl">
              <div className="flex items-center gap-4 w-full">
                <div className="bg-white/5 text-gray-400 w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-2xl border border-white/5">3</div>
                <div className="flex-1">
                  <h4 className={`font-bold text-gray-100 tv-body`}>
                    <span className="text-blue-300 ml-2">التسبيحات الأربعة (٧ مرات):</span>
                    سُبْحانَ اللهِ وَالْحَمْدُ للهِ وَلا اِلهَ اِلاَّ اللهُ وَاللهُ اَكْبَرُ
                  </h4>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="glass-panel flex items-center p-4 rounded-xl">
              <div className="flex items-center gap-4 w-full">
                <div className="bg-white/5 text-gray-400 w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-2xl border border-white/5">4</div>
                <h4 className={`font-bold text-gray-100 leading-snug tv-body`}>
                  سُبْحانَكَ سُبْحانَكَ سُبْحانَكَ يا عَظيمُ اغْفِرْ لِيَ الذَّنْبَ الْعَظيمَ
                </h4>
              </div>
            </div>

            {/* Step 5 */}
            <div className="glass-panel flex items-center p-4 rounded-xl">
              <div className="flex items-center gap-4 w-full">
                <div className="bg-white/5 text-gray-400 w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-2xl border border-white/5">5</div>
                <h4 className={`font-bold text-gray-100 leading-snug tv-body`}>
                  <span className="text-blue-300 ml-2">الصلوات (١٠ مرات):</span>
                  اَللّهُمَّ صَلِّ عَلى مُحَمَّد وَآلِ مُحَمَّد
                </h4>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full px-8 py-2 flex justify-between items-center text-xs text-blue-400/50 border-t border-white/5 bg-[#0B1121]">
        <div className="flex gap-4">
          <span>رمضان ١٤٤٦هـ</span>
          <span>وضع العرض: {isLargeMode ? 'كبير جداً' : 'قياسي'}</span>
          <span className="opacity-50">(اضغط 'L' لتغيير الحجم)</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            <span>محسن لشاشات LED</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            <span>اضغط سهم يمين للمتابعة</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PostIshaView;
