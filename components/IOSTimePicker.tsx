
import React, { useEffect, useRef, useState } from 'react';
import { convert24to12, convert12to24 } from '../utils';

interface IOSTimePickerProps {
  isOpen: boolean;
  initialValue: string; // "HH:mm" 24h format
  title: string;
  onSave: (time: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

const IOSTimePicker: React.FC<IOSTimePickerProps> = ({ isOpen, initialValue, title, onSave, onClose }) => {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [activeColumn, setActiveColumn] = useState<'hour' | 'minute' | 'period'>('hour');

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const { hour, minute, period } = convert24to12(initialValue || "12:00");
      setSelectedHour(hour);
      setSelectedMinute(minute.toString().padStart(2, '0'));
      setSelectedPeriod(period);
      setActiveColumn('hour');
      
      setTimeout(() => {
        scrollToValue(hourRef.current, HOURS.indexOf(hour));
        scrollToValue(minuteRef.current, MINUTES.indexOf(minute.toString().padStart(2, '0')));
        scrollToValue(periodRef.current, PERIODS.indexOf(period));
      }, 150);
    }
  }, [isOpen, initialValue]);

  const scrollToValue = (element: HTMLDivElement | null, index: number) => {
    if (element) {
      const ITEM_HEIGHT = 56; // Increased for better touch
      element.scrollTop = index * ITEM_HEIGHT;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, type: 'hour' | 'minute' | 'period') => {
    const ITEM_HEIGHT = 56;
    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    
    if (type === 'hour' && HOURS[index] !== undefined) setSelectedHour(HOURS[index]);
    if (type === 'minute' && MINUTES[index] !== undefined) setSelectedMinute(MINUTES[index]);
    if (type === 'period' && PERIODS[index] !== undefined) setSelectedPeriod(PERIODS[index]);
  };

  const handleSave = () => {
    const time24 = convert12to24(selectedHour, parseInt(selectedMinute), selectedPeriod);
    onSave(time24);
    onClose();
  };

  const cycleValue = <T,>(items: T[], currentIndex: number, delta: number): number => {
    const length = items.length;
    return (currentIndex + delta + length) % length;
  };

  const stepSelection = (column: 'hour' | 'minute' | 'period', delta: number) => {
    if (column === 'hour') {
      const index = HOURS.indexOf(selectedHour);
      const nextIndex = cycleValue(HOURS, index >= 0 ? index : 0, delta);
      const nextHour = HOURS[nextIndex];
      setSelectedHour(nextHour);
      scrollToValue(hourRef.current, nextIndex);
      return;
    }

    if (column === 'minute') {
      const index = MINUTES.indexOf(selectedMinute);
      const nextIndex = cycleValue(MINUTES, index >= 0 ? index : 0, delta);
      const nextMinute = MINUTES[nextIndex];
      setSelectedMinute(nextMinute);
      scrollToValue(minuteRef.current, nextIndex);
      return;
    }

    const index = PERIODS.indexOf(selectedPeriod);
    const nextIndex = cycleValue(PERIODS, index >= 0 ? index : 0, delta);
    const nextPeriod = PERIODS[nextIndex];
    setSelectedPeriod(nextPeriod);
    scrollToValue(periodRef.current, nextIndex);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.code)) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.code === 'ArrowUp') {
        stepSelection(activeColumn, -1);
        return;
      }

      if (event.code === 'ArrowDown') {
        stepSelection(activeColumn, 1);
        return;
      }

      if (event.code === 'ArrowLeft') {
        setActiveColumn((previous) => (previous === 'period' ? 'minute' : previous === 'minute' ? 'hour' : 'hour'));
        return;
      }

      if (event.code === 'ArrowRight') {
        setActiveColumn((previous) => (previous === 'hour' ? 'minute' : previous === 'minute' ? 'period' : 'period'));
        return;
      }

      if (event.code === 'Enter') {
        handleSave();
        return;
      }

      if (event.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeColumn, isOpen, onClose, selectedHour, selectedMinute, selectedPeriod]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center">
      {/* Premium Backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl transition-opacity animate-fade-in" onClick={onClose}></div>

      {/* Picker Modal: Ultra Realistic iOS Style */}
      <div className="relative w-full max-w-md bg-[#1c1c1e]/90 backdrop-blur-3xl border-t md:border border-white/10 md:rounded-[3rem] rounded-t-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden transform transition-all animate-slide-up">
        
        {/* Top Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 bg-white/5">
          <button onClick={onClose} className="text-gray-400 hover:text-white px-4 py-2 text-lg font-medium transition-all">إلغاء</button>
          <div className="flex flex-col items-center">
             <span className="text-white font-bold font-cairo text-xl">{title}</span>
             <div className="w-8 h-1 bg-gold-500 rounded-full mt-1"></div>
          </div>
          <button onClick={handleSave} className="text-gold-500 hover:text-gold-400 px-4 py-2 text-lg font-bold transition-all transform active:scale-90">تم</button>
        </div>

        {/* 3D Wheel Area */}
        <div className="relative h-[320px] flex justify-center items-center px-10" dir="ltr">
          
          {/* Highlight Lens (Magnifying effect style) */}
          <div className="absolute top-1/2 left-0 w-full h-[56px] -translate-y-1/2 bg-white/5 border-y border-white/10 pointer-events-none z-10 shadow-[0_0_20px_rgba(0,0,0,0.3)]"></div>
          
          {/* Edge Shadows for 3D effect */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#1c1c1e] via-[#1c1c1e]/80 to-transparent z-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#1c1c1e] via-[#1c1c1e]/80 to-transparent z-20 pointer-events-none"></div>

          <div className="grid grid-cols-3 w-full h-full gap-4 relative z-0">
            
            {/* Hours Wheel */}
            <div
              className={`h-full overflow-y-scroll no-scrollbar snap-y snap-mandatory py-[132px] rounded-2xl transition-shadow ${
                activeColumn === 'hour' ? 'ring-1 ring-gold-500/40 shadow-[0_0_18px_rgba(236,163,21,0.18)]' : ''
              }`}
              ref={hourRef}
              onScroll={(e) => handleScroll(e, 'hour')}
              onMouseEnter={() => setActiveColumn('hour')}
              onClick={() => setActiveColumn('hour')}
            >
              {HOURS.map((h) => (
                <div key={h} className={`h-[56px] flex items-center justify-center snap-center text-3xl font-sans transition-all duration-300 ${selectedHour === h ? 'text-white font-bold scale-125' : 'text-gray-600 scale-90 opacity-40'}`}>
                  {h}
                </div>
              ))}
            </div>

            {/* Minutes Wheel */}
            <div
              className={`h-full overflow-y-scroll no-scrollbar snap-y snap-mandatory py-[132px] rounded-2xl transition-shadow ${
                activeColumn === 'minute' ? 'ring-1 ring-gold-500/40 shadow-[0_0_18px_rgba(236,163,21,0.18)]' : ''
              }`}
              ref={minuteRef}
              onScroll={(e) => handleScroll(e, 'minute')}
              onMouseEnter={() => setActiveColumn('minute')}
              onClick={() => setActiveColumn('minute')}
            >
               {MINUTES.map((m) => (
                <div key={m} className={`h-[56px] flex items-center justify-center snap-center text-3xl font-sans transition-all duration-300 ${selectedMinute === m ? 'text-white font-bold scale-125' : 'text-gray-600 scale-90 opacity-40'}`}>
                  {m}
                </div>
              ))}
            </div>

            {/* Period Wheel */}
            <div
              className={`h-full overflow-y-scroll no-scrollbar snap-y snap-mandatory py-[132px] rounded-2xl transition-shadow ${
                activeColumn === 'period' ? 'ring-1 ring-gold-500/40 shadow-[0_0_18px_rgba(236,163,21,0.18)]' : ''
              }`}
              ref={periodRef}
              onScroll={(e) => handleScroll(e, 'period')}
              onMouseEnter={() => setActiveColumn('period')}
              onClick={() => setActiveColumn('period')}
            >
               {PERIODS.map((p) => (
                <div key={p} className={`h-[56px] flex items-center justify-center snap-center text-xl font-sans font-black transition-all duration-300 ${selectedPeriod === p ? 'text-gold-500 scale-125' : 'text-gray-600 scale-90 opacity-40'}`}>
                  {p === 'AM' ? 'ص' : 'م'}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Visual Tip */}
        <div className="pb-8 text-center text-gray-500 text-xs font-sans tracking-widest uppercase">
           Slide to select time
        </div>
      </div>
    </div>
  );
};

export default IOSTimePicker;
