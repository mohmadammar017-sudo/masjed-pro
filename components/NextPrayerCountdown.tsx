
import React from 'react';
import { formatDuration } from '../utils';

interface Props {
  timeRemaining: number;
  nextPrayerName: string;
  nextPrayerTime: string;
  nameColor?: string;
  labelText?: string; // New Prop
}

const NextPrayerCountdown: React.FC<Props> = ({ timeRemaining, nextPrayerName, nextPrayerTime, nameColor, labelText }) => {
  const { hours, minutes, seconds } = formatDuration(timeRemaining);
  const [h, m] = nextPrayerTime.split(':');
  const date = new Date();
  date.setHours(Number(h), Number(m));
  const formattedNextTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(" AM", "").replace(" PM", "");
  const amPm = date.getHours() >= 12 ? 'م' : 'ص';

  return (
    <div className="flex flex-col items-center lg:items-start">
      {/* Label */}
      <div className="flex items-center gap-3 mb-4">
         <div className="h-[2px] w-12 bg-gold-500"></div>
         <span className="text-gold-200 text-lg font-bold tracking-widest uppercase font-sans">
            {labelText || 'الصلاة القادمة'}
         </span>
      </div>

      {/* Prayer Name */}
      <h2 
        className="text-6xl md:text-8xl font-black font-cairo mb-8 leading-none drop-shadow-lg"
        style={{ 
            color: nameColor || '#ffffff',
            textShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}
      >
        {nextPrayerName}
      </h2>

      {/* Countdown Digits */}
      <div className="flex items-end gap-4 md:gap-6 mb-8" dir="ltr">
         <TimeBox value={hours} label="ساعة" />
         <span className="text-5xl md:text-6xl text-white/20 font-light mb-8">:</span>
         <TimeBox value={minutes} label="دقيقة" />
         <span className="text-5xl md:text-6xl text-white/20 font-light mb-8">:</span>
         <TimeBox value={seconds} label="ثانية" active />
      </div>

      {/* Prayer Time Pill */}
      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 flex items-center gap-3 text-white shadow-lg">
          <i className="fa-regular fa-clock text-gold-500"></i>
          <span className="text-lg opacity-80">الوقت:</span>
          <span className="text-2xl font-bold font-sans tracking-wider" dir="ltr">{formattedNextTime} <span className="text-base">{amPm}</span></span>
      </div>
    </div>
  );
};

const TimeBox = ({ value, label, active }: { value: string, label: string, active?: boolean }) => (
  <div className="flex flex-col items-center gap-2">
    <div className={`
       relative w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center text-5xl md:text-7xl font-bold font-sans tracking-tighter shadow-2xl overflow-hidden group
       ${active ? 'bg-gradient-to-b from-white/20 to-white/5 text-white border border-white/20' : 'bg-black/20 text-gray-300 border border-white/5'}
    `}>
       {/* Inner Gloss */}
       <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
       <span className={`z-10 ${active ? 'text-gold-100' : 'text-gray-200'}`}>{value}</span>
       {active && <div className="absolute bottom-0 left-0 w-full h-1 bg-gold-500 animate-pulse"></div>}
    </div>
    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default NextPrayerCountdown;
