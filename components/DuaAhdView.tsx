import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PrayerSettings } from '../types';
import { paginatePreFajrDuaSegments, PreFajrDuaPage } from '../utils/preFajrDuaPaging';
import '../styles/pre-fajr-dua-display.css';

interface DuaAhdViewProps {
  onExit: () => void;
  onBack: () => void;
  settings?: PrayerSettings;
}

const DUA_TEXT = `
بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ : اَللَّهُمَّ رَبَّ النُّورِ الْعَظِيمِ وَرَبَّ الْكُرْسِيِّ الرَّفِيعِ وَرَبَّ الْبَحْرِ الْمَسْجُورِ وَمُنْزِلَ التَّوْرَاةِ وَالإِنْجِيلِ وَالزَّبُورِ وَرَبَّ الظِّلِّ وَالْحَرُورِ وَمُنْزِلَ الْقُرْآنِ العَظِيمِ وَرَبَّ الْمَلائِكَةِ الْمُقَرَّبِينَ وَالأَنْبِيَاءِ وَالْمُرْسَلِينَ .

اَللَّهُمَّ إِنِّي أَسْأَلُكَ بِوَجْهِكَ الْكَرِيمِ وَبِنُورِ وَجْهِكَ الْمُنِيرِ وَمُلْكِكَ القَدِيمِ ، يَا حَيُّ يَا قَيُّومُ أَسْأَلُكَ بِاسْمِكَ الَّذِي أَشْرَقَتْ بِهِ السَّمَاوَاتُ وَالأَرَضُونَ وَبِاسْمِكَ الَّذِي يَصْلُحُ بِهِ الأوَّلُونَ وَالآخِرُونَ ، يَا حَيًّا قَبْلَ كُلِّ حَيٍّ وَيَا حَيًّا بَعْدَ كُلِّ حَيٍّ وَيَا حَيًّا حِينَ لا حَيَّ يَا مُحْيِيَ الْمَوْتَى وَمُمِيتَ الأَحْيَاءِ يَا حَيُّ لا إِلَهَ إِلَّا أَنْتَ .

اَللَّهُمَّ بَلِّغْ مَوْلانَا الإِمَامَ الْهَادِيَ الْمَهْدِيَّ الْقَائِمَ بِأَمْرِكَ ـ صَلوَاتُ اللهِ عَلَيْهِ وَعَلَى آبَائِهِ الطَّاهِرِينَ ـ عَنْ جَمِيعِ الْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ فِي مَشَارِقِ الأَرْضِ وَمَغَارِبِهَا سَهْلِهَا وَجَبَلِهَا وَبَرِّهَا وَبَحْرِهَا وَعَنِّي وَعَنْ وَالِدَيَّ مِنَ الصَّلَوَاتِ زِنَةَ عَرْشِ اللهِ وَمِدَادَ كَلِمَاتِهِ وَمَا أَحْصَاهُ عِلْمُهُ وَأَحَاطَ بِهِ كِتَابُهُ .

اَللَّهُمَّ إِنِّي أُجَدِّدُ لَهُ فِي صَبِيحَةِ يَوْمِي هَذَا وَمَا عِشْتُ مِنْ أَيَّامِي عَهْداً وَعَقْداً وَبَيْعَةً لَهُ فِي عُنُقِي لا أَحُولُ عَنْهَا وَلا أَزُولُ أَبَداً ، اَللَّهُمَّ اجْعَلْنِي مِنْ أَنْصَارِهِ وَأَعْوَانِهِ وَالذَّابِّينَ عَنْهُ وَالْمُسَارِعِينَ إِلَيْهِ فِي قَضاءِ حَوَائِجِهِ وَالْمُمْتَثِلِينَ لِأَوَامِرِهِ وَالْمُحَامِينَ عَنْهُ وَالسَّابِقِينَ إِلَى إِرَادَتِهِ وَالْمُسْتَشْهَدِينَ بَيْنَ يَدَيْهِ .

اَللَّهُمَّ إِنْ حَالَ بَيْنِي وَبَيْنَهُ الْمَوْتُ الَّذِي جَعَلْتَهُ عَلَى عِبَادِكَ حَتْماً مَقْضِيًّا فَأَخْرِجْنِي مِنْ قَبْرِي مُؤْتَزِراً كَفَنِي شَاهِراً سَيْفِي مُجَرِّداً قَنَاتِي مُلَبِّياً دَعْوَةَ الدَّاعِي فِي الْحَاضِرِ وَالْبَادِي .

اَللَّهُمَّ أَرِنِي الطَّلْعَةَ الرَّشِيدَةَ وَالْغُرَّةَ الْحَمِيدَةَ وَاكْحُلْ نَاظِرِي بِنَظْرَةٍ مِنِّي إِلَيْهِ وَعَجِّلْ فَرَجَهُ وَسَهِّلْ مَخْرَجَهُ وَأَوْسِعْ مَنْهَجَهُ وَاسْلُكْ بِي مَحَجَّتَهُ وَأَنْفِذْ أَمْرَهُ وَاشْدُدْ أَزْرَهُ .

وَاعْمُرِ ـ اللَّهُمَّ ـ بِهِ بِلادَكَ وَأَحْيِ بِهِ عِبَادَكَ فَإِنَّكَ قُلْتَ ـ وَقَوْلُكَ الْحَقُّ ـ : (( ظَهَرَ الْفَسَادُ فِي الْبَرِّ وَالْبَحْرِ بِمَا كَسَبَتْ أَيْدِي النَّاسِ )) ، فَأَظْهِرِ ـ اللَّهُمَّ ـ لَنا وَلِيَّكَ وَابْنَ بِنْتِ نَبِيِّكَ الْمُسَمّى بِاسْمِ رَسُولِكَ حَتَّى لا يَظْفَرَ بِشَيْءٍ مِنَ الْبَاطِلِ إِلَّا مَزَّقَهُ وَيَحِقَّ الْحَقَّ وَيُحَقِّقَهُ .

وَاجْعَلْهُ ـ اللّهُمَّ ـ مَفْزَعاً لِمَظْلُومِ عِبَادِكَ وَنَاصِراً لِمَنْ لا يَجِدُ لَهُ ناصِراً غَيْرَكَ وَمُجَدِّداً لِمَا عُطِّلَ مِنْ أَحْكَامِ كِتَابِكَ وَمُشَيِّداً لِمَا وَرَدَ مِنْ أَعْلامِ دِينِكَ وَسُنَنِ نَبِيِّكَ ـ صَلَّى اللهُ عَلَيْهِ وَآلِهِ ـ ، وَاجْعَلْهُ ـ اللَّهُمَّ ـ مِمَّنْ حَصَّنْتَهُ مِنْ بَأْسِ الْمُعْتَدِينَ .

اَللَّهُمَّ وَسُرَّ نَبِيَّكَ مُحَمَّداً ـ صَلَّى اللهُ عَلَيْهِ وَآلِهِ ـ بِرُؤْيَتِهِ وَمَنْ تَبِعَهُ عَلَى دَعْوَتِهِ وَارْحَمِ اسْتِكانَتَنَا بَعْدَهُ ، اَللَّهُمَّ اكْشِفْ هَذِهِ الْغُمَّةَ عَنْ هَذِهِ الأُمَّةِ بِحُضُورِهِ وَعَجِّل لَنَا ظُهُورَهُ (( إِنَّهُمْ يَرَوْنَهُ بَعِيداً وَنَرَاهُ قَرِيباً )) بِرَحْمَتِكَ يَا أَرْحَمَ الرَّاحِمِينَ .

ثُمَّ تَضْرِبُ عَلَى فَخِذِكَ الأَيْمَنِ بِيَدِكَ ثَلاثَ مَرَّاتٍ وَتَقُولُ كُلَّ مَرَّةٍ : الْعَجَلَ الْعَجَلَ يَا مَوْلايَ يَا صَاحِبَ الزَّمَانِ . الْعَجَلَ الْعَجَلَ يَا مَوْلايَ يَا صَاحِبَ الزَّمَانِ . الْعَجَلَ الْعَجَلَ يَا مَوْلايَ يَا صَاحِبَ الزَّمَانِ .
`;

const DUA_SEGMENTS = DUA_TEXT
  .trim()
  .split(/\n\s*\n/)
  .map((text) => ({
    subtitle: '',
    text: text.trim()
  }));

const fitsAhdPageDensity = (candidate: string) => {
  const normalized = candidate.replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ').filter(Boolean).length;
  return normalized.length <= 124 && words <= 26;
};

const arePagesEqual = (left: PreFajrDuaPage[], right: PreFajrDuaPage[]) => {
  if (left.length !== right.length) return false;
  return left.every((page, index) => {
    const other = right[index];
    return (
      !!other &&
      page.key === other.key &&
      page.subtitle === other.subtitle &&
      page.text === other.text &&
      page.isSpecial === other.isSpecial
    );
  });
};

const DuaAhdView: React.FC<DuaAhdViewProps> = ({ onExit, onBack, settings }) => {
  const bgImage = settings?.duaAhd?.backgroundImage;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const measureTextRef = useRef<HTMLParagraphElement | null>(null);
  const fallbackPages = useMemo(
    () => paginatePreFajrDuaSegments(DUA_SEGMENTS, fitsAhdPageDensity),
    []
  );
  const [pages, setPages] = useState<PreFajrDuaPage[]>(fallbackPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [layoutTick, setLayoutTick] = useState(0);

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
      setPages((prev) => (arePagesEqual(prev, fallbackPages) ? prev : fallbackPages));
      return;
    }

    measure.style.width = `${viewport.clientWidth}px`;
    const resolvedPages = paginatePreFajrDuaSegments(DUA_SEGMENTS, (candidate) => {
      measureText.textContent = candidate;
      return fitsAhdPageDensity(candidate) && measureText.scrollHeight <= viewport.clientHeight - 8;
    });

    const nextPages = resolvedPages.length > 0 ? resolvedPages : fallbackPages;
    setPages((prev) => (arePagesEqual(prev, nextPages) ? prev : nextPages));
  }, [fallbackPages, layoutTick]);

  useEffect(() => {
    setCurrentPageIndex((prev) => Math.min(prev, Math.max(pages.length - 1, 0)));
  }, [pages.length]);

  const nextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setDirection(1);
      setCurrentPageIndex((prev) => prev + 1);
      return;
    }
    onExit();
  }, [currentPageIndex, onExit, pages.length]);

  const prevPage = useCallback(() => {
    if (currentPageIndex === 0) {
      onBack();
      return;
    }
    setDirection(-1);
    setCurrentPageIndex((prev) => prev - 1);
  }, [currentPageIndex, onBack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'PageDown', 'PageUp'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case 'Enter':
        case 'Space':
          nextPage();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          prevPage();
          break;
        case 'Escape':
          onExit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, onExit, prevPage]);

  const currentPage = pages[currentPageIndex] || fallbackPages[0];
  const showSubtitle = !!currentPage?.subtitle?.trim();
  const viewerStyle = {
    '--dua-base-bg': '#020617',
    '--dua-fallback-bg': 'radial-gradient(circle at center, #112344 0%, #020617 100%)',
    '--dua-halo': 'rgba(250, 204, 21, 0.12)',
    '--dua-title-start': '#fcd34d',
    '--dua-title-mid': '#fff7db',
    '--dua-title-end': '#fcd34d',
    '--dua-divider-color': 'rgba(250, 204, 21, 0.9)',
    '--dua-subtitle-color': 'rgba(253, 230, 138, 0.84)',
    '--dua-text-start': '#ffffff',
    '--dua-text-end': '#fef3c7',
    '--dua-dot-active': '#facc15',
    '--dua-dot-glow': 'rgba(250, 204, 21, 0.5)',
    '--dua-dot-idle': 'rgba(255, 255, 255, 0.2)',
    '--dua-particles-opacity': 0.1,
    '--dua-viewport-width': 'min(100%, 1280px)',
    '--dua-viewport-height': 'min(74vh, 920px)',
    '--dua-text-size-min': '2.75rem',
    '--dua-text-size-fluid': '4.9vw',
    '--dua-text-size-max': '6.35rem',
    '--dua-text-line-height': '1.98'
  } as React.CSSProperties;

  return (
    <div className="pre-fajr-dua-viewer" dir="rtl" style={viewerStyle}>
      <div className="pre-fajr-dua-background">
        {bgImage ? (
          <img src={bgImage} className="pre-fajr-dua-background-image" alt="" />
        ) : (
          <div className="pre-fajr-dua-background-fallback"></div>
        )}
        <div className="pre-fajr-dua-overlay"></div>
        <div className="pre-fajr-dua-vignette"></div>
        <div className="pre-fajr-dua-particles"></div>
      </div>

      <div className="pre-fajr-dua-content">
        <header className="pre-fajr-dua-header">
          <div className="pre-fajr-dua-title-stack">
            <h1 className="pre-fajr-dua-title">دُعَاءُ العَهْد</h1>
            <div className="pre-fajr-dua-divider"></div>
          </div>
        </header>

        <section className="pre-fajr-dua-stage">
          <div ref={viewportRef} className="pre-fajr-dua-viewport">
            <div key={currentPage?.key || 'empty'} className={`pre-fajr-dua-page ${direction > 0 ? 'is-next' : 'is-prev'} ${showSubtitle ? '' : 'is-titleless'}`}>
              {showSubtitle ? <h2 className="pre-fajr-dua-subtitle">{currentPage?.subtitle}</h2> : null}
              <p className="pre-fajr-dua-text">{currentPage?.text || ''}</p>
            </div>
          </div>
        </section>

        <footer className="pre-fajr-dua-progress">
          {pages.map((page, index) => (
            <div key={page.key} className={`pre-fajr-dua-dot ${index === currentPageIndex ? 'is-active' : ''}`}></div>
          ))}
        </footer>
      </div>

      <div ref={measureRef} className="pre-fajr-dua-measure" aria-hidden="true">
        <p ref={measureTextRef} className="pre-fajr-dua-measure-text"></p>
      </div>
    </div>
  );
};

export default DuaAhdView;
