import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PrayerSettings } from '../types';

interface GhufaylahViewProps {
  onExit: () => void;
  onBack: () => void;
  settings: PrayerSettings;
}

interface SinglePageArabicBlockProps {
  title: string;
  text: string;
  minFontPx: number;
  maxFontPx: number;
  lineHeight: number;
  topOffsetPx: number;
  tone?: 'ayah' | 'qunut';
}

const FIRST_RAKAH_TEXT =
  'وَذَا النُّونِ إِذْ ذَهَبَ مُغَاضِبًا فَظَنَّ أَنْ لَنْ نَقْدِرَ عَلَيْهِ فَنَادَى فِي الظُّلُمَاتِ أَنْ لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ ۝ فَاسْتَجَبْنَا لَهُ وَنَجَّيْنَاهُ مِنَ الْغَمِّ وَكَذَلِكَ نُنْجِي الْمُؤْمِنِينَ';

const SECOND_RAKAH_TEXT =
  'وَعِنْدَهُ مَفَاتِحُ الْغَيْبِ لَا يَعْلَمُهَا إِلَّا هُوَ ۚ وَيَعْلَمُ مَا فِي الْبَرِّ وَالْبَحْرِ ۚ وَمَا تَسْقُطُ مِنْ وَرَقَةٍ إِلَّا يَعْلَمُهَا وَلَا حَبَّةٍ فِي ظُلُمَاتِ الْأَرْضِ وَلَا رَطْبٍ وَلَا يَابِسٍ إِلَّا فِي كِتَابٍ مُبِينٍ';

const QUNUT_TEXT =
  'اللَّهُمَّ إِنِّي أَسْأَلُكَ بِمَفَاتِحِ الْغَيْبِ الَّتِي لَا يَعْلَمُهَا إِلَّا أَنْتَ أَنْ تُصَلِّيَ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ وَأَنْ تَفْعَلَ بِي مَا أَنْتَ أَهْلُهُ، اللَّهُمَّ أَنْتَ وَلِيُّ نِعْمَتِي وَالْقَادِرُ عَلَى طَلِبَتِي، تَعْلَمُ حَاجَتِي فَأَسْأَلُكَ بِحَقِّ مُحَمَّدٍ وَآلِ مُحَمَّدٍ عَلَيْهِ وَعَلَيْهِمُ السَّلَامُ لَمَّا قَضَيْتَهَا لِي.';

const singlePageFitCache = new Map<string, number>();

const SinglePageArabicBlock: React.FC<SinglePageArabicBlockProps> = ({
  title,
  text,
  minFontPx,
  maxFontPx,
  lineHeight,
  topOffsetPx,
  tone = 'ayah'
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const measureTextRef = useRef<HTMLParagraphElement | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [fontSizePx, setFontSizePx] = useState(minFontPx);

  useEffect(() => {
    const target = viewportRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setLayoutTick((prev) => prev + 1);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    const measureText = measureTextRef.current;

    if (!viewport || !measure || !measureText || viewport.clientHeight === 0 || viewport.clientWidth === 0) {
      return;
    }

    const availableWidth = Math.max(1, Math.floor(viewport.clientWidth));
    const availableHeight = Math.max(1, Math.floor(viewport.clientHeight - topOffsetPx));
    const cacheKey = [
      title,
      text,
      availableWidth,
      availableHeight,
      minFontPx,
      maxFontPx,
      lineHeight,
      tone
    ].join('|');

    const cached = singlePageFitCache.get(cacheKey);
    if (typeof cached === 'number') {
      setFontSizePx((prev) => (Math.abs(prev - cached) < 0.2 ? prev : cached));
      return;
    }

    measure.style.width = `${availableWidth}px`;
    measure.style.height = `${availableHeight}px`;

    const fitsAt = (candidatePx: number) => {
      measureText.style.fontSize = `${candidatePx}px`;
      measureText.style.lineHeight = `${lineHeight}`;
      measureText.textContent = text;
      return measureText.scrollHeight <= availableHeight && measureText.scrollWidth <= availableWidth + 2;
    };

    const safeMinFont = Math.min(minFontPx, maxFontPx);
    const absoluteMin = Math.min(24, safeMinFont);
    let low = absoluteMin;
    let high = maxFontPx;
    let best = absoluteMin;

    if (!fitsAt(absoluteMin)) {
      best = absoluteMin;
    } else {
      best = absoluteMin;
      while (high - low > 0.5) {
        const candidate = (low + high) / 2;
        if (fitsAt(candidate)) {
          best = candidate;
          low = candidate;
          continue;
        }
        high = candidate;
      }
    }

    singlePageFitCache.set(cacheKey, best);
    setFontSizePx((prev) => (Math.abs(prev - best) < 0.2 ? prev : best));
  }, [layoutTick, lineHeight, maxFontPx, minFontPx, text, title, topOffsetPx, tone]);

  return (
    <article className="ghufaylah-card">
      <div className="ghufaylah-card-body">
        <div className={`ghufaylah-pill font-cairo font-black ${tone === 'qunut' ? 'ghufaylah-pill--qunut' : ''}`}>
          {title}
        </div>

        <div
          ref={viewportRef}
          className={`ghufaylah-text-viewport ${tone === 'qunut' ? 'ghufaylah-text-viewport--qunut' : ''}`}
          style={{ '--ghufaylah-top-offset': `${topOffsetPx}px` } as React.CSSProperties}
        >
          <div className="ghufaylah-page-stack">
            <p
              className={`ghufaylah-reading-text ${tone === 'qunut' ? 'ghufaylah-reading-text--qunut' : ''}`}
              style={{ fontSize: `${fontSizePx}px`, lineHeight }}
            >
              {text}
            </p>
          </div>
        </div>
      </div>

      <div ref={measureRef} className="ghufaylah-measure" aria-hidden="true">
        <p
          ref={measureTextRef}
          className={`ghufaylah-reading-text ghufaylah-reading-text--measure ${tone === 'qunut' ? 'ghufaylah-reading-text--qunut' : ''}`}
          style={{ lineHeight }}
        />
      </div>
    </article>
  );
};

const GhufaylahView: React.FC<GhufaylahViewProps> = ({ onExit, onBack, settings }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'Space'].includes(event.code)) {
        onExit();
        return;
      }

      if (['ArrowLeft', 'Escape', 'Backspace'].includes(event.code)) {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onExit]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f8f2e8] text-[#0f172a]" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#fffdf8_0%,#faf4e8_40%,#efdfc6_100%)]" />
      {settings.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.05]"
          style={{ backgroundImage: `url(${settings.backgroundImage})` }}
        />
      )}
      <div className="absolute inset-0 opacity-[0.035] bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')]" />
      <div className="absolute left-[-9%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-[#f4d28f]/30 blur-[130px]" />
      <div className="absolute bottom-[-10%] right-[-7%] h-[30rem] w-[30rem] rounded-full bg-[#dfc086]/22 blur-[120px]" />

      <style>{`
        .ghufaylah-stage {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-rows: auto minmax(0, 1.18fr) minmax(0, 0.86fr);
          gap: 0.58rem;
          height: 100%;
          padding: 0.46rem 0.64rem 0.64rem;
        }

        .ghufaylah-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          padding: 0.58rem 0.74rem;
          border-radius: 1.2rem;
          border: 1px solid rgba(180, 134, 11, 0.18);
          background: linear-gradient(135deg, rgba(255, 252, 246, 0.96), rgba(255, 245, 225, 0.84));
          box-shadow: 0 14px 32px rgba(120, 82, 17, 0.08);
        }

        .ghufaylah-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.34rem 0.72rem;
          border-radius: 999px;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.22);
          color: #8b5e11;
          font-size: 0.78rem;
        }

        .ghufaylah-title {
          font-size: clamp(1.8rem, 2.35vw, 3rem);
          line-height: 1.02;
        }

        .ghufaylah-niyyah {
          padding: 0.48rem 0.62rem;
          border-radius: 0.9rem;
          border: 1px solid rgba(180, 134, 11, 0.16);
          background: rgba(255, 255, 255, 0.56);
          min-width: min(16rem, 24vw);
        }

        .ghufaylah-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.58rem;
          min-height: 0;
        }

        .ghufaylah-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.55rem;
          border: 1px solid rgba(180, 134, 11, 0.18);
          background: linear-gradient(180deg, rgba(255, 253, 248, 0.98), rgba(255, 248, 237, 0.95));
          box-shadow:
            0 16px 44px rgba(107, 76, 19, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.88);
        }

        .ghufaylah-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), transparent 44%, rgba(255, 255, 255, 0.2));
          pointer-events: none;
        }

        .ghufaylah-card-body {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 0.32rem;
          height: 100%;
          padding: 0.46rem 0.56rem 0.52rem;
        }

        .ghufaylah-pill {
          align-self: center;
          padding: 0.32rem 0.74rem;
          border-radius: 999px;
          background: rgba(180, 134, 11, 0.1);
          border: 1px solid rgba(180, 134, 11, 0.2);
          color: #8b5e11;
          font-size: 0.84rem;
          line-height: 1.2;
        }

        .ghufaylah-pill--qunut {
          font-size: 0.82rem;
        }

        .ghufaylah-text-viewport {
          position: relative;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          padding: var(--ghufaylah-top-offset, 12px) 0.08rem 0.08rem;
          overflow: hidden;
        }

        .ghufaylah-text-viewport--qunut {
          padding-top: calc(var(--ghufaylah-top-offset, 10px) * 0.9);
        }

        .ghufaylah-page-stack {
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          text-align: center;
          transform: translateY(-3%);
        }

        .ghufaylah-reading-text {
          font-family: "Liftaswash Fixed", "Noto Naskh Arabic", "Amiri", serif;
          width: 100%;
          margin: 0;
          color: #0b1320;
          text-align: center;
          text-wrap: balance;
          word-break: normal;
          overflow-wrap: break-word;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .ghufaylah-reading-text--qunut {
          text-wrap: pretty;
        }

        .ghufaylah-reading-text--measure {
          text-shadow: none;
        }

        .ghufaylah-measure {
          position: absolute;
          inset: 0 auto auto -99999px;
          visibility: hidden;
          pointer-events: none;
          overflow: hidden;
        }

        @media (max-width: 1320px) {
          .ghufaylah-grid {
            grid-template-columns: 1fr;
          }

          .ghufaylah-stage {
            grid-template-rows: auto minmax(0, 1fr) minmax(0, 0.92fr);
          }
        }

        @media (max-width: 980px) {
          .ghufaylah-header {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .ghufaylah-niyyah {
            min-width: 0;
          }
        }

        @media (max-height: 930px) {
          .ghufaylah-stage {
            gap: 0.46rem;
            padding: 0.38rem 0.5rem 0.52rem;
          }

          .ghufaylah-header {
            padding: 0.46rem 0.6rem;
          }

          .ghufaylah-card-body {
            gap: 0.24rem;
            padding: 0.38rem 0.46rem 0.44rem;
          }
        }
      `}</style>

      <main className="ghufaylah-stage">
        <header className="ghufaylah-header">
          <div className="flex items-center gap-3">
            <div className="flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-[1.15rem] border border-[#d7b56c]/40 bg-white/70 text-[#b8860b] shadow-[0_12px_28px_rgba(184,134,11,0.12)]">
              <i className="fa-solid fa-moon text-[1.45rem]"></i>
            </div>
            <div>
              <div className="ghufaylah-badge font-cairo font-black">نافلة ما بين المغرب والعشاء</div>
              <h1 className="ghufaylah-title mt-1.5 font-liftaswash text-[#223044]">صلاة الغفيلة</h1>
            </div>
          </div>

          <div className="ghufaylah-niyyah text-right shadow-[0_12px_24px_rgba(123,91,20,0.05)]">
            <div className="font-cairo text-[0.64rem] font-black tracking-[0.16em] text-[#9b7a2f]">النية</div>
            <div className="mt-1 font-liftaswash text-[clamp(1.05rem,1.15vw,1.35rem)] leading-[1.28] text-[#6d4f12]">
              ركعتان قربةً إلى الله تعالى
            </div>
          </div>
        </header>

        <section className="ghufaylah-grid">
          <SinglePageArabicBlock
            title="الركعة الأولى بعد سورة الفاتحة"
            text={FIRST_RAKAH_TEXT}
            minFontPx={44}
            maxFontPx={98}
            lineHeight={1.48}
            topOffsetPx={12}
          />
          <SinglePageArabicBlock
            title="الركعة الثانية بعد سورة الفاتحة"
            text={SECOND_RAKAH_TEXT}
            minFontPx={44}
            maxFontPx={98}
            lineHeight={1.48}
            topOffsetPx={12}
          />
        </section>

        <SinglePageArabicBlock
          title="دعاء القنوت"
          text={QUNUT_TEXT}
          tone="qunut"
          minFontPx={30}
          maxFontPx={66}
          lineHeight={1.52}
          topOffsetPx={10}
        />
      </main>
    </div>
  );
};

export default GhufaylahView;
