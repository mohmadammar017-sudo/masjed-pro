import React from 'react';
import { PrayerTime } from '../types';
import { Moon, Sun, Sunrise, Sunset, Clock } from 'lucide-react';

interface PrayerCardProps {
  prayer: PrayerTime;
}

const PrayerCard: React.FC<PrayerCardProps> = ({ prayer }) => {
  const Icon = () => {
    switch (prayer.icon) {
      case 'moon': return <Moon className="w-5 h-5" />;
      case 'sun': return <Sun className="w-5 h-5" />;
      case 'sunrise': return <Sunrise className="w-5 h-5" />;
      case 'sunset': return <Sunset className="w-5 h-5" />;
      case 'clock': return <Clock className="w-5 h-5" />;
      default: return <Sun className="w-5 h-5" />;
    }
  };

  // Safe parsing
  const [hours, mins] = prayer.time ? prayer.time.split(':') : ['0', '0'];
  const date = new Date();
  date.setHours(parseInt(hours || '0'), parseInt(mins || '0'));
  
  // Format using 'ar-SA' to get "4:30 م" style automatically
  const formattedTime = date.toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' });
  
  const isActive = prayer.isNext || prayer.isCurrent;

  return (
    <div 
      className={`
        relative group rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-500 overflow-hidden
        ${isActive 
           ? 'bg-gradient-to-b from-gold-500 to-gold-600 shadow-[0_0_30px_rgba(236,163,21,0.4)] scale-105 -translate-y-2 z-10' 
           : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20'
        }
      `}
    >
      {/* Icon Circle */}
      <div className={`
         w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors
         ${isActive ? 'bg-white text-gold-600 shadow-lg' : 'bg-white/10 text-gray-400 group-hover:text-white'}
      `}>
        <Icon />
      </div>

      {/* Prayer Name */}
      <div className={`text-sm md:text-base font-bold font-cairo ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
        {prayer.nameAR}
      </div>

      {/* Time */}
      <div className={`text-xl md:text-2xl font-bold font-sans tracking-wide ${isActive ? 'text-white drop-shadow-md' : 'text-gray-300'}`} dir="ltr">
        {formattedTime}
      </div>
      
      {/* Active Indicator Line */}
      {isActive && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-white/50"></div>
      )}
      
      {/* Inactive Highlight on Hover */}
      {!isActive && (
         <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      )}
    </div>
  );
};

export default PrayerCard;