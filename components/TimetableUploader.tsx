
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { TimetableDay, MonthlySchedule } from '../types';

interface TimetableUploaderProps {
  onSave: (schedule: MonthlySchedule) => void;
  onCancel: () => void;
}

type ProcessingStage = 'idle' | 'uploading' | 'analyzing' | 'validating' | 'done';

const TimetableUploader: React.FC<TimetableUploaderProps> = ({ onSave, onCancel }) => {
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<TimetableDay[]>([]);
  const [monthName, setMonthName] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});

  // --- STAGE 4: VALIDATION LOGIC ---
  const validateTimeFormat = (time: string) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  
  const parseTimeValue = (time: string) => {
    if (!time || !validateTimeFormat(time)) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const validateData = (days: TimetableDay[]) => {
    const errors: Record<number, string[]> = {};
    
    days.forEach(day => {
        const dayErrors: string[] = [];
        const times = {
            fajr: parseTimeValue(day.fajr),
            sunrise: parseTimeValue(day.sunrise),
            dhuhr: parseTimeValue(day.dhuhr),
            asr: parseTimeValue(day.asr || ''),
            maghrib: parseTimeValue(day.maghrib),
            isha: parseTimeValue(day.isha || '')
        };

        // Logical Checks (Simplified)
        if (times.fajr && times.sunrise && times.fajr >= times.sunrise) dayErrors.push("الفجر بعد الشروق!");
        if (times.sunrise && times.dhuhr && times.sunrise >= times.dhuhr) dayErrors.push("الشروق بعد الظهر!");
        if (times.dhuhr && times.asr && times.dhuhr >= times.asr) dayErrors.push("الظهر بعد العصر!");
        if (times.asr && times.maghrib && times.asr >= times.maghrib) dayErrors.push("العصر بعد المغرب!");
        if (times.maghrib && times.isha && times.maghrib >= times.isha) dayErrors.push("المغرب بعد العشاء!");
        
        // Format Checks
        if (day.fajr && !validateTimeFormat(day.fajr)) dayErrors.push("صيغة وقت الفجر خاطئة");
        
        if (dayErrors.length > 0) {
            errors[day.day_number] = dayErrors;
        }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractedData([]);
    setError(null);
    setStage('uploading');
    setProgressMessage("جاري رفع الصورة وتحسين الجودة...");

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setStage('analyzing');
      setProgressMessage("الذكاء الاصطناعي يقوم بتحليل الجدول واستخراج الأوقات...");

      // Use process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // --- STAGE 2 & 3: ADVANCED PROMPT ENGINEERING ---
      const prompt = `
        SYSTEM ROLE: You are an expert OCR AI specialized in Islamic Prayer Timetables.
        
        TASK: Extract prayer times from the provided image.
        
        STRICT OUTPUT FORMAT: Return ONLY valid JSON. No markdown formatting.
        
        EXTRACT THESE COLUMNS:
        1. Imsak (الإمساك)
        1. Fajr (الفجر)
        2. Sunrise (الشروق)
        3. Dhuhr (الظهر)
        4. Asr (العصر) - IF PRESENT, otherwise empty string
        5. Maghrib (المغرب)
        6. Isha (العشاء) - IF PRESENT, otherwise empty string
        
        DATA STRUCTURE:
        {
          "month_name": "Month Name (e.g. Ramadan 1446)",
          "is_hijri": boolean, // true if the schedule is for a Hijri month like Ramadan
          "days": [
            {
              "day_number": number,
              "hijri_date": "string",
              "imsak": "HH:mm",
              "fajr": "HH:mm",
              "sunrise": "HH:mm",
              "dhuhr": "HH:mm",
              "asr": "HH:mm",
              "maghrib": "HH:mm",
              "isha": "HH:mm"
            }
          ]
        }

        CORRECTION RULES (SMART AI LOGIC):
        1. **OCR Fixes**: Correct common visual errors (e.g., 'O' -> '0', 'l' -> '1', 'S' -> '5').
        2. **Time Format**: Convert ALL times to 24-hour format (HH:mm). 
           - Fajr/Sunrise/Imsak are always AM.
           - Maghrib/Isha are always PM.
           - Dhuhr/Asr are usually PM (12:00+).
        3. **Row Integrity**: Ensure every day of the month visible is extracted.
      `;

      const base64Content = base64Data.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Strong vision capabilities for table structure
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Content } },
                { text: prompt }
            ]
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      // Clean JSON (remove ```json if present)
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(jsonStr);

      if (result.days && Array.isArray(result.days)) {
        setStage('validating');
        setProgressMessage("التحقق من صحة الأوقات وتصحيح الأخطاء المنطقية...");
        
        // Artificial delay for UX perception of "thinking"
        await new Promise(r => setTimeout(r, 800));
        
        const normalizedDays: TimetableDay[] = result.days.map((day: Partial<TimetableDay>) => ({
          day_number: Number(day.day_number) || 0,
          day_name: typeof day.day_name === 'string' ? day.day_name : '',
          hijri_date: typeof day.hijri_date === 'string' ? day.hijri_date : '',
          imsak: typeof day.imsak === 'string' ? day.imsak : '',
          fajr: typeof day.fajr === 'string' ? day.fajr : '',
          sunrise: typeof day.sunrise === 'string' ? day.sunrise : '',
          dhuhr: typeof day.dhuhr === 'string' ? day.dhuhr : '',
          asr: typeof day.asr === 'string' ? day.asr : '',
          maghrib: typeof day.maghrib === 'string' ? day.maghrib : '',
          isha: typeof day.isha === 'string' ? day.isha : '',
          end_isha: '',
          event: typeof day.event === 'string' ? day.event : ''
        }));

        setExtractedData(normalizedDays);
        if (result.month_name) setMonthName(result.month_name);
        
        // Run validation
        validateData(normalizedDays);
        
        setStage('done');
      } else {
        throw new Error("Invalid format");
      }

    } catch (err: any) {
      console.error(err);
      setError("حدث خطأ أثناء المعالجة. يرجى التأكد من وضوح الصورة.");
      setStage('idle');
    }
  };

  const handleDataChange = (index: number, field: keyof TimetableDay, value: any) => {
    const updated = [...extractedData];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedData(updated);
    // Re-validate on change
    validateData(updated);
  };

  const handleApprove = () => {
    if (!monthName) {
        if(!confirm("لم يتم تحديد اسم الشهر. هل تريد المتابعة؟")) return;
    }
    
    if (extractedData.length === 0) {
        alert("لا توجد بيانات للحفظ");
        return;
    }

    // Final Validation Warning
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
        if(!confirm("يوجد بعض الأوقات التي قد تكون غير منطقية (باللون الأحمر). هل أنت متأكد من الحفظ؟")) return;
    }

    onSave({
      monthName: monthName || "Unknown",
      isHijri: extractedData.length > 0 ? (extractedData[0].hijri_date.includes('رمضان') || extractedData[0].hijri_date.includes('Ramadan')) : false,
      days: extractedData,
      lastUpdated: Date.now()
    });
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-robot text-gold-400"></i>
              نظام الاستخراج الذكي (AI OCR)
           </h2>
           <p className="text-sm text-gray-400">استخراج وتدقيق أوقات الصلاة تلقائياً</p>
        </div>
        <button 
           onClick={onCancel}
           className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors"
        >
           إلغاء
        </button>
      </div>

      {stage === 'idle' || stage === 'uploading' || stage === 'analyzing' || stage === 'validating' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 hover:border-gold-500/50 transition-colors cursor-pointer group relative">
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={stage !== 'idle'}
            />
            
            {stage === 'idle' ? (
                <>
                  <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-camera text-4xl text-gold-400"></i>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">اضغط لرفع صورة الجدول</h3>
                  <p className="text-gray-400">يدعم الصور المطبوعة، الملصقات، وجداول الأوقات الشهرية</p>
                </>
            ) : (
                <div className="flex flex-col items-center">
                   {/* Advanced Loading Animation */}
                   <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-gold-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                         <i className={`fa-solid ${stage === 'analyzing' ? 'fa-brain' : 'fa-list-check'} text-2xl text-white animate-pulse`}></i>
                      </div>
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">{stage === 'uploading' ? 'جاري الرفع...' : stage === 'analyzing' ? 'تحليل البيانات...' : 'تدقيق الأوقات...'}</h3>
                   <p className="text-gold-400 font-mono text-sm animate-pulse">{progressMessage}</p>
                </div>
            )}
            
            {error && <p className="mt-6 text-red-200 bg-red-900/40 border border-red-500/30 px-6 py-3 rounded-xl font-bold">{error}</p>}
          </div>
      ) : (
        /* --- STAGE 6: USER CONFIRMATION UI --- */
        <div className="flex-1 flex flex-col overflow-hidden bg-white/5 backdrop-blur rounded-xl border border-white/10 shadow-sm">
           <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <div className="flex items-center gap-3">
                 <span className="font-bold text-gray-300">اسم الشهر المستخرج:</span>
                 <input 
                   type="text" 
                   value={monthName}
                   onChange={(e) => setMonthName(e.target.value)}
                   className="bg-black/20 border border-white/10 rounded px-3 py-1 text-sm outline-none focus:border-gold-500 text-white w-48 font-bold"
                 />
              </div>
              <div className="flex gap-2">
                 <button onClick={() => { setStage('idle'); setExtractedData([]); }} className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-bold">
                    رفض وإعادة المحاولة
                 </button>
                 <button onClick={handleApprove} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold shadow-md flex items-center gap-2">
                    <i className="fa-solid fa-check-double"></i>
                    اعتماد وحفظ
                 </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto dashboard-scroll">
              <table className="w-full text-sm text-center text-gray-300">
                 <thead className="bg-black/40 sticky top-0 z-10 font-bold text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                       <th className="px-2 py-4">#</th>
                       <th className="px-2 py-4">الإمساك</th>
                       <th className="px-2 py-4">الهجري</th>
                       <th className="px-2 py-4 text-white">الفجر</th>
                       <th className="px-2 py-4">الشروق</th>
                       <th className="px-2 py-4 text-white">الظهر</th>
                       <th className="px-2 py-4 text-white">المغرب</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {extractedData.map((day, idx) => {
                       const hasError = validationErrors[day.day_number];
                       return (
                       <tr key={idx} className={`hover:bg-white/5 transition-colors ${hasError ? 'bg-red-900/10' : ''}`}>
                          <td className="py-2 font-bold relative group">
                              {day.day_number}
                              {hasError && (
                                  <div className="absolute left-full top-0 w-48 bg-red-900 text-white text-xs p-2 rounded shadow-lg z-20 hidden group-hover:block">
                                      {hasError.join(', ')}
                                  </div>
                              )}
                              {hasError && <i className="fa-solid fa-circle-exclamation text-red-500 text-[10px] absolute top-1 right-1"></i>}
                          </td>
                          <td className="py-2"><input type="time" className="w-full text-center bg-transparent outline-none font-mono text-gray-300 focus:text-white" value={day.imsak} onChange={(e) => handleDataChange(idx, 'imsak', e.target.value)} /></td>
                          <td className="py-2"><input className="w-full text-center bg-transparent outline-none text-white focus:text-gold-400" value={day.hijri_date} onChange={(e) => handleDataChange(idx, 'hijri_date', e.target.value)} /></td>
                          <td className="py-2"><input type="time" className="w-full text-center bg-transparent outline-none font-mono font-bold text-gold-400 focus:bg-white/10 rounded" value={day.fajr} onChange={(e) => handleDataChange(idx, 'fajr', e.target.value)} /></td>
                          <td className="py-2"><input type="time" className="w-full text-center bg-transparent outline-none font-mono text-orange-300 focus:text-white" value={day.sunrise} onChange={(e) => handleDataChange(idx, 'sunrise', e.target.value)} /></td>
                          <td className="py-2"><input type="time" className="w-full text-center bg-transparent outline-none font-mono text-white focus:bg-white/10 rounded" value={day.dhuhr} onChange={(e) => handleDataChange(idx, 'dhuhr', e.target.value)} /></td>
                          <td className="py-2"><input type="time" className="w-full text-center bg-transparent outline-none font-mono font-bold text-gold-400 focus:bg-white/10 rounded" value={day.maghrib} onChange={(e) => handleDataChange(idx, 'maghrib', e.target.value)} /></td>
                       </tr>
                    )})}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default TimetableUploader;
