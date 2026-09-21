import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatIndonesianDate, formatIndonesianDateShort, getJakartaDateString } from '../utils/timeUtils';

interface DatePickerProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  maxAdvanceDays?: number;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onSelectDate,
  maxAdvanceDays = 30,
}) => {
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const todayStr = getJakartaDateString();

  // Generate the next 7 days for the swipeable/scrollable tabs
  const daysList: { dateStr: string; isToday: boolean; dayName: string; dateNum: string; monthName: string }[] = [];
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayBase = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));

  for (let i = 0; i < 7; i++) {
    const d = new Date(todayBase.getTime() + i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const shortInfo = formatIndonesianDateShort(dateStr);
    daysList.push({
      dateStr,
      isToday: i === 0,
      dayName: i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : shortInfo.dayName,
      dateNum: shortInfo.dateNum,
      monthName: shortInfo.monthName,
    });
  }

  // Max selectable date
  const maxDateObj = new Date(todayBase.getTime() + maxAdvanceDays * 86400000);
  const maxDateStr = maxDateObj.toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs" id="date-picker-container">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-emerald-600" />
          <span className="text-xs sm:text-sm font-semibold text-slate-800">
            {formatIndonesianDate(selectedDate)}
          </span>
          {selectedDate === todayStr && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              Hari Ini
            </span>
          )}
        </div>

        <button
          type="button"
          id="btn-open-calendar-modal"
          onClick={() => setShowCalendarModal(true)}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>Pilih Tanggal Lain</span>
        </button>
      </div>

      {/* 7-Day scrollable pill strip */}
      <div className="relative">
        <div 
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x touch-pan-x scroll-smooth -mx-1 px-1" 
          id="seven-days-scroll"
        >
          {daysList.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            return (
              <button
                key={item.dateStr}
                id={`day-tab-${item.dateStr}`}
                type="button"
                onClick={() => onSelectDate(item.dateStr)}
                className={`flex-1 min-w-[68px] sm:min-w-[84px] py-2 px-1 rounded-xl text-center transition-all cursor-pointer snap-start border active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className={`text-[10px] sm:text-[11px] font-medium leading-tight truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {item.dayName}
                </div>
                <div className={`text-base sm:text-lg font-bold leading-tight my-0.5 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {item.dateNum}
                </div>
                <div className={`text-[9px] sm:text-[10px] font-medium uppercase tracking-wider ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                  {item.monthName}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Modal for other dates up to maxAdvanceDays */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4" id="calendar-modal">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-100 animate-in slide-in-from-bottom-5 sm:fade-in sm:zoom-in-95 duration-150 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
            {/* Grab handle for mobile bottom sheet */}
            <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">Pilih Tanggal Jadwal</h3>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <p className="text-xs text-slate-500 mb-3">
                Pemesanan dibuka hingga {maxAdvanceDays} hari ke depan ({formatIndonesianDate(maxDateStr)}).
              </p>
              <input
                type="date"
                min={todayStr}
                max={maxDateStr}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectDate(e.target.value);
                    setShowCalendarModal(false);
                  }
                }}
                className="w-full text-base font-semibold border-2 border-emerald-500 rounded-xl px-4 py-3 text-slate-800 focus:outline-hidden focus:ring-3 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] flex items-center justify-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
