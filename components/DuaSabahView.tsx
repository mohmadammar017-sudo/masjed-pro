import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PrayerSettings } from '../types';
import { paginatePreFajrDuaSegments, PreFajrDuaPage, PreFajrDuaSegment } from '../utils/preFajrDuaPaging';
import '../styles/pre-fajr-dua-display.css';
import SajdatAlShukrView from './SajdatAlShukrView';

interface DuaSabahViewProps {
  mosqueName: string;
  onExit: () => void;
  onBack: () => void;
  settings?: PrayerSettings;
}

// Segmentation of Dua Al-Sabah
const SUJOOD_DUA = "إلهِي قَلْبِي مَحْجُوبٌ ، وَنَفْسِي مَعْيُوبٌ ، وَعَقْلِي مَغْلُوبٌ ، وَهَوائِي غالِبٌ ، وَطاعَتِي قَلِيلٌ ، وَمَعْصِيَتِي كَثِيرٌ ، وَلِسانِي مُقِرٌّ بِالذُّنُوبِ ، فَكَيْفَ حِيلَتِي يا سَتَّارَ الْعُيُوبِ ، وَيا عَلَّامَ الْغُيُوبِ ، وَيا كاشِفَ الْكُرُوبِ ، اغْفِرْ ذُنُوبِي كُلَّها بِحُرْمَةِ مُحَمَّدٍ وَآلِ مُحَمَّدٍ ، يا غَفَّارُ يا غَفَّارُ يا غَفَّارُ ، بِرَحْمَتِكَ يا أَرْحَمَ الرَّاحِمِينَ.";
const SUJOOD_SECTIONS = {
  opening:
    "إلهِي قَلْبِي مَحْجُوبٌ ، وَنَفْسِي مَعْيُوبٌ ، وَعَقْلِي مَغْلُوبٌ ، وَهَوائِي غالِبٌ ، وَطاعَتِي قَلِيلٌ ، وَمَعْصِيَتِي كَثِيرٌ ، وَلِسانِي مُقِرٌّ بِالذُّنُوبِ ، فَكَيْفَ حِيلَتِي يا سَتَّارَ الْعُيُوبِ ، وَيا عَلَّامَ الْغُيُوبِ ، وَيا كاشِفَ الْكُرُوبِ ،",
  plea: "اغْفِرْ ذُنُوبِي كُلَّها بِحُرْمَةِ مُحَمَّدٍ وَآلِ مُحَمَّدٍ ،",
  closing: "بِرَحْمَتِكَ يا أَرْحَمَ الرَّاحِمِينَ."
};
const SUJOOD_CHANT = ['يا غَفَّارُ', 'يا غَفَّارُ', 'يا غَفَّارُ'];

const DUA_SEGMENTS: PreFajrDuaSegment[] = [
  {
    subtitle: "إشراقة الصباح",
    text: "أَللَّهُمَّ يا مَنْ دَلَعَ لِسانَ الصَّباحِ بِنُطْقِ تَبَلُّجِهِ ، وَسَرَّحَ قِطَعَ اللَّيْلِ الْمُظْلِمِ بِغَياهِبِ تَلَجْلُجِهِ"
  },
  {
    subtitle: "عظمة الخالق",
    text: "وَأَتْقَنَ صُنْعَ الْفَلَكِ الدَّوَّارِ فِي مَقادِيرِ تَبَرُّجِهِ ، وَشَعْشَعَ ضِياءَ الشَّمْسِ بِنُورِ تَأَجُّجِهِ"
  },
  {
    subtitle: "تنزيه الذات الإلهية",
    text: "يا مَنْ دَلَّ عَلَى ذاتِهِ بِذاتِهِ ، وَتَنَزَّهَ عَنْ مُجانَسَةِ مَخْلُوقاتِهِ ، وَجَلَّ عَنْ مُلائمَةِ كَيْفِيَّاتِهِ"
  },
  {
    subtitle: "العلم الإلهي",
    text: "يا مَنْ قَرُبَ مِنْ خَطَراتِ الظُّنُونِ ، وَبَعُدَ عَنْ لَحَظاتِ الْعُيُونِ ، وَعَلِمَ بِما كانَ قَبْلَ أَنْ يَكُونَ"
  },
  {
    subtitle: "شكر النعم",
    text: "يا مَنْ أَرْقَدَنِي فِي مِهادِ أَمْنِهِ وَأَمانِهِ ، وَأَيْقَظَنِي إلَى ما مَنَحَنِي بِهِ مِنْ مِنَنِهِ وَإحْسانِهِ ، وَكَفَّ أَكُفَّ السُّوءِ عَنِّي بِيَدِهِ وَسُلْطانِهِ"
  },
  {
    subtitle: "الصلاة على النبي وآله",
    text: "صَلِّ اللَّهُمَّ عَلَى الدَّلِيلِ إلَيْكَ فِي اللَّيْلِ الأَلْيَلِ ، وَالْماسِكِ مِنْ أَسْبابِكَ بِحَبْلِ الشَّرَفِ الْأَطْوَلِ"
  },
  {
    subtitle: "أوصاف النبي (ص)",
    text: "وَالنَّاصِعِ الْحَسَبِ فِي ذِرْوَةِ الْكاهِلِ الْأَعْبَلِ ، وَالثَّابِتِ الْقَدَمِ عَلَى زَحالِيفِها فِي الزَّمَنِ الأَوَّلِ ، وَعَلَى آلِهِ الأَخْيارِ الْمُصْطَفَينَ الْأَبْرارِ"
  },
  {
    subtitle: "مفاتيح الرحمة",
    text: "وَافْتَحِ اللَّهُمَّ لَنا مَصارِيعَ الصَّباحِ بِمَفاتِيحِ الرَّحْمَةِ وَالْفَلاحِ ، وَأَلْبِسْنِي اللَّهُمَّ مِنْ أَفْضَلِ خِلَعِ الْهِدايَةِ وَالصَّلاحِ"
  },
  {
    subtitle: "خشوع القلب",
    text: "وَاغْرُسِ اللَّهُمَّ بِعَظَمَتِكَ فِي شِرْبِ جَنانِي يَنابِيعَ الْخُشُوعِ ، وَأَجْرِ اللَّهُمَّ لِهَيْبَتِكَ مِنْ آمَاقِي زَفَراتِ الدُّمُوعِ"
  },
  {
    subtitle: "تأديب النفس",
    text: "وَأَدِّبِ اللَّهُمَّ نَزَقَ الْخُرْقِ مِنِّي بِأَزِمَّةِ الْقُنُوعِ"
  },
  {
    subtitle: "الافتقار للتوفيق",
    text: "إِلهِي إنْ لَمْ تَبْتَدِئْنِي الرَّحْمَةُ مِنْكَ بِحُسْنِ التَّوْفِيقِ ، فَمَنِ السَّالِكُ بِي إلَيْكَ فِي واضِحِ الطَّرِيْقِ ؟"
  },
  {
    subtitle: "الاستقالة من العثرات",
    text: "وَإنْ أَسْلَمَتْنِي أَناتُكَ لِقائِدِ الْأَمَلِ وَالْمُنَى فَمَنِ الْمُقِيلُ عَثَراتِي مِنْ كَبَواتِ الْهَوَى ؟"
  },
  {
    subtitle: "الحرمان والخذلان",
    text: "وَإنْ خَذَلَنِي نَصْرُكَ عِنْدَ مُحارَبَةِ النَّفْسِ وَالشَّيْطانِ ، فَقَدْ وَكَلَنِي خِذْلانُكَ إلَى حَيْثُ النَّصَبُ وَالْحِرْمانُ"
  },
  {
    subtitle: "التعلق بحبال الله",
    text: "إلهِي أَتَرانِي مَا أَتَيْتُكَ إلا مِنْ حَيْثُ الآمالُ ، أَمْ عَلِقْتُ بَأَطْرافِ حِبالِكَ إلَّا حِيْنَ باعَدَتْنِي ذُنُوبِي عَنْ دارِ الْوِصالِ"
  },
  {
    subtitle: "مخاطبة النفس",
    text: "فَبِئْسَ الْمَطِيَّةُ الَّتِي امْتَطَتْ نَفْسِي مِنْ هَواها ، فَواهاً لَها لِما سَوَّلَتْ لَها ظُنُونُها وَمُناها ، وَتَبّاً لَها لِجُرأَتِها عَلَى سَيِّدِها وَمَوْلاها"
  },
  {
    subtitle: "اللجوء والرجاء",
    text: "إِلهِي قَرَعْتُ بابَ رَحْمَتِكَ بِيَدِ رَجائِي ، وَهَرَبْتُ إلَيْكَ لاجِئاً مِنْ فَرْطِ أَهْوائِي ، وَعَلَّقْتُ بِأَطْرافِ حِبالِكَ أَنامِلَ وَلائِي"
  },
  {
    subtitle: "طلب الصفح",
    text: "فَاصْفَحِ اللَّهُمَّ عَمَّا كُنتُ أَجْرَمْتُهُ مِنْ زَلَلِي وَخَطائِي ، وَأَقِلْنِي مِنْ صَرْعَةِ رِدائِي ، فَإنَّكَ سَيِّدِي وَمَوْلايَ وَمُعْتَمَدِي وَرَجائِي"
  },
  {
    subtitle: "الغاية والمنى",
    text: "وَأَنْتَ غايَةُ مَطْلُوبِي وَمُنايَ فِي مُنْقَلَبِي وَمَثْوايَ"
  },
  {
    subtitle: "حسن الظن بالله",
    text: "إلهِي كَيْفَ تَطْرُدُ مِسْكِيناً الْتَجَأَ إلَيْكَ مِنَ الذُّنُوبِ هارِباً ، أَمْ كَيْفَ تُخَيِّبُ مُسْتَرْشِداً قَصَدَ إلَى جَنابِكَ ساعِياً"
  },
  {
    subtitle: "كرم الضيافة الإلهية",
    text: "أَمْ كَيْفَ تَرُدُّ ظَمْآناً وَرَدَ إلَى حِياضِكَ شارِباً ؟ كَلَّا وَحِياضُكَ مُتْرَعَةٌ فِي ضَنْكِ المُحُولِ ، وَبابُكَ مَفْتُوحٌ لِلطَّلَبِ وَالْوُغُولِ"
  },
  {
    subtitle: "غاية المسؤول",
    text: "وَأَنْتَ غايةُ السُّؤُلِ ونِهايَةُ الْمأْمُولِ"
  },
  {
    subtitle: "التوكل",
    text: "إِلهِي هذِهِ أَزِمَّةُ نَفْسِي عَقَلْتُها بِعِقالِ مَشِيئَتِكَ ، وَهذِهِ أَعْباءُ ذُنُوبِي دَرَأْتُها بِعَفْوِكَ وَرَحْمَتِكَ ، وَهذِهِ أَهْوائِي الْمُضِلَّةُ وَكَلْتُها إلَى جَنابِ لُطْفِكَ وَرَأْفَتِكَ"
  },
  {
    subtitle: "دعاء الصباح والمساء",
    text: "فَاجْعَلِ اللَّهُمَّ صَباحِي هَذا نازِلاً عَلَيَّ بِضِياءِ الْهُدَى ، وَبِالسَّلامَةِ فِي الدِّينِ وَالدُّنْيا ، وَمَسائِي جُنَّةً مِنْ كَيْدِ الْعِدَى ، وَوِقايَةً مِنْ مُرْدِياتِ الْهَوَى"
  },
  {
    subtitle: "القدرة المطلقة",
    text: "إنَّكَ قادِرٌ عَلَى ما تَشاءُ ، تُؤْتِي الْمُلْكَ مَنْ تَشاءُ ، وَتَنْزِعُ الْمُلْكَ مِمَّنْ تَشاءُ ، وَتُعِزُّ مَنْ تَشاءُ ، وَتُذِلُّ مَنْ تَشاءُ"
  },
  {
    subtitle: "الخير كله بيدك",
    text: "بِيَدِكَ الْخَيْرُ إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ ، تُولِجُ اللَّيْلَ فِي النَّهارِ ، وَتُولِجُ النَّهارَ فِي اللَّيْلِ"
  },
  {
    subtitle: "الحياة والموت",
    text: "وَتُخْرِجُ الْحَيَّ مِنَ الْمَيِّتِ ، وَتُخْرِجُ الْمَيِّتَ مِنَ الْحَيِّ ، وَتَرْزُقُ مَنْ تَشاءُ بِغَيْرِ حِسابٍ"
  },
  {
    subtitle: "التعظيم والتسبيح",
    text: "لا إلهَ إلَّا أَنْتَ سُبْحانَكَ اللَّهُمَّ وَبِحَمْدِكَ ، مَنْ ذا يَعْرِفُ قَدْرَكَ فَلا يَخافُكَ ، وَمَنْ ذا يَعْلَمُ ما أَنْتَ فَلا يَهابُكَ"
  },
  {
    subtitle: "آثار القدرة",
    text: "أَلَّفْتَ بِقُدْرَتِكَ الْفِرَقَ ، وَفَلَقْتَ بِلُطْفِكَ الْفَلَقَ ، وَأَنَرْتَ بِكَرَمِكَ دَياجِيَ الْغَسَقِ"
  },
  {
    subtitle: "تسخير الكون",
    text: "وَأَنْهَرْتَ الْمِياهَ مِنَ الصُّمِّ الصَّياخِيدِ عَذْباً وَأُجاجاً ، وَأَنْزَلْتَ مِنَ الْمُعْصِراتِ ماءً ثَجَّاجاً ، وَجَعَلْتَ الشَّمْسَ وَالْقَمَرَ لِلْبَرِيَّةِ سِراجاً وَهَّاجاً"
  },
  {
    subtitle: "الخلق بلا تعب",
    text: "مِنْ غَيْرِ أَنْ تُمارِسَ فِيما ابْتَدَأْتَ بِهِ لُغُوباً وَلا عِلاجاً"
  },
  {
    subtitle: "العز والبقاء",
    text: "فَيا مَنْ تَوَحَّدَ بِالْعِزِّ وَالْبَقاءِ ، وَقَهَرَ عِبادَهُ بِالْمَوْتِ وَالْفَناءِ ، صَلِّ عَلَى مُحَمَّدٍ وَآلِهِ الْأَتْقِياءِ"
  },
  {
    subtitle: "استجابة الدعاء",
    text: "وَاسْمَعْ نِدائِي ، وَاسْتَجِبْ دُعائِي ، وَحَقِّقْ بِفَضْلِكَ أَمَلِي وَرَجائِي"
  },
  {
    subtitle: "يا خير مسؤول",
    text: "يا خَيْرَ مَنْ دُعِيَ لِكَشْفِ الضُّرِ وَالْمَأْمُولِ في كُلِّ عُسْرٍ وَيُسْرٍ ، بِكَ أَنْزَلْتُ حاجَتِي فَلا تَرُدَّنِي مِنْ سَنِيِّ مَواهِبِكَ خائِباً"
  },
  {
    subtitle: "سجدة الشكر",
    isSpecial: true,
    text: SUJOOD_DUA
  }
];

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

const DuaSabahView: React.FC<DuaSabahViewProps> = ({ mosqueName, onExit, onBack, settings }) => {
  const bgImage = settings?.duaSabah?.backgroundImage;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const measureTextRef = useRef<HTMLParagraphElement | null>(null);
  const displaySegments = useMemo(
    () =>
      DUA_SEGMENTS.map((segment) => (segment.isSpecial ? segment : { ...segment, subtitle: '' })),
    []
  );
  const fallbackPages = useMemo(
    () => paginatePreFajrDuaSegments(displaySegments, (candidate) => candidate.length <= 170),
    [displaySegments]
  );
  const [pages, setPages] = useState<PreFajrDuaPage[]>(fallbackPages);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [layoutTick, setLayoutTick] = useState(0);
  const currentPageKeyRef = useRef<string | null>(fallbackPages[0]?.key ?? null);

  useEffect(() => {
    currentPageKeyRef.current = pages[currentPageIndex]?.key ?? null;
  }, [currentPageIndex, pages]);

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

    measure.style.width = `${viewport.clientWidth}px`;
    const resolvedPages = paginatePreFajrDuaSegments(displaySegments, (candidate) => {
      measureText.textContent = candidate;
      return measureText.scrollHeight <= viewport.clientHeight + 1;
    });

    const nextPages = resolvedPages.length > 0 ? resolvedPages : fallbackPages;
    setPages((prev) => (arePagesEqual(prev, nextPages) ? prev : nextPages));
    setCurrentPageIndex((prev) => {
      const activeKey = currentPageKeyRef.current;
      if (activeKey) {
        const matchIndex = nextPages.findIndex((page) => page.key === activeKey);
        if (matchIndex >= 0) return matchIndex;
      }
      return Math.min(prev, Math.max(nextPages.length - 1, 0));
    });
  }, [displaySegments, fallbackPages, layoutTick]);

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
  const isSujood = !!currentPage?.isSpecial;
  const viewerStyle = {
    '--dua-base-bg': isSujood ? '#271005' : '#0c4a6e',
    '--dua-fallback-bg': isSujood
      ? 'linear-gradient(180deg, #2f1408 0%, #160804 100%)'
      : 'linear-gradient(180deg, #0c4a6e 0%, #0284c7 100%)',
    '--dua-halo': isSujood ? 'rgba(249, 115, 22, 0.16)' : 'rgba(56, 189, 248, 0.16)',
    '--dua-title-start': isSujood ? '#fdba74' : '#bae6fd',
    '--dua-title-mid': '#ffffff',
    '--dua-title-end': isSujood ? '#fdba74' : '#bae6fd',
    '--dua-divider-color': isSujood ? 'rgba(251, 146, 60, 0.92)' : 'rgba(56, 189, 248, 0.92)',
    '--dua-subtitle-color': isSujood ? 'rgba(253, 186, 116, 0.88)' : 'rgba(186, 230, 253, 0.86)',
    '--dua-text-start': '#ffffff',
    '--dua-text-end': isSujood ? '#ffedd5' : '#e0f2fe',
    '--dua-dot-active': isSujood ? '#fb923c' : '#38bdf8',
    '--dua-dot-glow': isSujood ? 'rgba(251, 146, 60, 0.44)' : 'rgba(56, 189, 248, 0.45)',
    '--dua-dot-idle': 'rgba(255, 255, 255, 0.2)',
    '--dua-particles-opacity': isSujood ? 0.2 : 0.18,
    '--dua-special-border': 'rgba(251, 146, 60, 0.28)',
    '--dua-special-title': '#fdba74'
  } as React.CSSProperties;

  if (isSujood) {
    return <SajdatAlShukrView mosqueName={mosqueName} onExit={onExit} settings={settings} />;
  }

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
            <h1 className="pre-fajr-dua-title">دُعَاءُ الصَّبَاح</h1>
            <div className="pre-fajr-dua-divider"></div>
          </div>
        </header>

        <section className="pre-fajr-dua-stage">
          <div ref={viewportRef} className="pre-fajr-dua-viewport">
            <div key={currentPage?.key || 'empty'} className={`pre-fajr-dua-page ${direction > 0 ? 'is-next' : 'is-prev'} ${isSujood ? 'is-special' : 'is-titleless'}`}>
              {isSujood ? (
                <div className="pre-fajr-dua-special-card pre-fajr-dua-sujood-card">
                  <div className="pre-fajr-dua-sujood-aura pre-fajr-dua-sujood-aura-top"></div>
                  <div className="pre-fajr-dua-sujood-aura pre-fajr-dua-sujood-aura-bottom"></div>
                  <div className="pre-fajr-dua-sujood-shell">
                    <div className="pre-fajr-dua-sujood-side">
                      <div className="pre-fajr-dua-sujood-icon-shell">
                        <div className="pre-fajr-dua-sujood-icon-ring"></div>
                        <div className="pre-fajr-dua-sujood-icon">
                          <i className="fa-solid fa-person-praying"></i>
                        </div>
                      </div>
                      <div className="pre-fajr-dua-sujood-kicker">خاتمة دعاء الصباح</div>
                      <div className="pre-fajr-dua-sujood-label">سُجُودُ تَذَلُّلٍ وَإِنَابَة</div>
                      <div className="pre-fajr-dua-sujood-line"></div>
                    </div>

                    <div className="pre-fajr-dua-sujood-body">
                      <div className="pre-fajr-dua-sujood-badge">سجدة مناجاة</div>
                      <p className="pre-fajr-dua-special-text pre-fajr-dua-sujood-text">
                        {SUJOOD_SECTIONS.opening}
                      </p>
                      <p className="pre-fajr-dua-special-text pre-fajr-dua-sujood-text pre-fajr-dua-sujood-plea">
                        {SUJOOD_SECTIONS.plea}
                      </p>
                      <div className="pre-fajr-dua-sujood-chant-row" aria-label={SUJOOD_CHANT.join(' ')}>
                        {SUJOOD_CHANT.map((phrase, index) => (
                          <span key={`${phrase}-${index}`} className="pre-fajr-dua-sujood-chant-pill">
                            {phrase}
                          </span>
                        ))}
                      </div>
                      <p className="pre-fajr-dua-special-text pre-fajr-dua-sujood-text pre-fajr-dua-sujood-closing">
                        {SUJOOD_SECTIONS.closing}
                      </p>
                      <div className="pre-fajr-dua-sujood-floor">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="pre-fajr-dua-text">{currentPage?.text || ''}</p>
              )}
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

export default DuaSabahView;
