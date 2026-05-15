import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Layers3, Sparkles } from 'lucide-react';
import { RemoteManagedPage } from '../types';
import { buildRemoteDisplaySlides } from '../utils/remotePages';

interface RemoteManagedPagesViewProps {
  pages: RemoteManagedPage[];
  mosqueName: string;
  onExit: () => void;
}

const RemoteManagedPagesView: React.FC<RemoteManagedPagesViewProps> = ({ pages, mosqueName, onExit }) => {
  const slides = useMemo(() => buildRemoteDisplaySlides(pages), [pages]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.key === 'Escape') {
        event.preventDefault();
        onExit();
        return;
      }

      if (event.code === 'ArrowRight' || event.code === 'PageDown') {
        event.preventDefault();
        setActiveIndex((previous) => Math.min(Math.max(slides.length - 1, 0), previous + 1));
        return;
      }

      if (event.code === 'ArrowLeft' || event.code === 'PageUp') {
        event.preventDefault();
        setActiveIndex((previous) => Math.max(0, previous - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, slides.length]);

  const activeSlide = slides[Math.max(0, Math.min(activeIndex, Math.max(slides.length - 1, 0)))] || null;
  const backgroundStyle = activeSlide?.backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.66), rgba(2, 6, 23, 0.88)), url(${activeSlide.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : undefined;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 text-white" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_72%)]"></div>
      <div className="absolute inset-0 opacity-70" style={backgroundStyle}></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/islamic-art.png')] opacity-[0.04]"></div>
      <div className="absolute -top-24 left-[-12rem] h-[26rem] w-[26rem] rounded-full bg-gold-400/10 blur-[140px]"></div>
      <div className="absolute bottom-[-8rem] right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-[140px]"></div>

      <div className="relative z-10 flex h-full flex-col p-8 lg:p-12">
        <header className="flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black tracking-[0.24em] text-gold-100">
              <Sparkles className="h-4 w-4" />
              صفحات المسجد المركزية
            </div>
            <h1 className="mt-4 text-[clamp(2.4rem,4vw,4.8rem)] font-black leading-none">{mosqueName}</h1>
          </div>
          <div className="text-left">
            <div className="text-sm text-slate-400">الصفحة الحالية</div>
            <div className="mt-2 rounded-full border px-4 py-2 text-sm font-black tracking-[0.2em]" style={{ borderColor: activeSlide?.accentColor || '#f1bd36', color: activeSlide?.accentColor || '#f1bd36' }}>
              {activeSlide ? `${activeIndex + 1} / ${slides.length}` : '0 / 0'}
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="flex h-full w-full max-w-[1600px] flex-col justify-center rounded-[3rem] border border-white/10 bg-slate-950/35 px-8 py-8 shadow-[0_35px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl lg:px-14 lg:py-10">
            {activeSlide ? (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">نوع الصفحة</div>
                    <div className="mt-2 text-2xl font-black" style={{ color: activeSlide.accentColor }}>
                      {activeSlide.title}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">
                    <Eye className="h-4 w-4" />
                    <span>{activeSlide.type}</span>
                    {activeSlide.chunkCount > 1 && (
                      <>
                        <span>•</span>
                        <Layers3 className="h-4 w-4" />
                        <span>{activeSlide.chunkIndex + 1} / {activeSlide.chunkCount}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={`flex flex-1 items-center justify-center ${activeSlide.textAlign === 'right' ? 'text-right' : 'text-center'}`}>
                  {activeSlide.imageUrl ? (
                    <img
                      src={activeSlide.imageUrl}
                      alt={activeSlide.title}
                      className="max-h-full max-w-full rounded-[2.4rem] border border-white/10 object-contain shadow-[0_30px_70px_rgba(2,6,23,0.45)]"
                    />
                  ) : (
                    <div className="mx-auto w-full max-w-[1200px]">
                      <div
                        className="whitespace-pre-line text-[clamp(2.2rem,3vw,4.6rem)] font-black leading-[1.7] drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
                        style={{ color: activeSlide.accentColor, textAlign: activeSlide.textAlign }}
                      >
                        {activeSlide.content}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-3xl font-black text-slate-400">
                لا توجد صفحات مفعلة لهذا المسجد حاليًا.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default RemoteManagedPagesView;
