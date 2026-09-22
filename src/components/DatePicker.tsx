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
      dayName: i === 0 ? 'Hari Ini' : i === 1 ? 'Besok' : shortInfo.dayName,
      dateNum: shortInfo.dateNum,
      monthName: shortInfo.monthName,
    });
  }

  // Max selectable date
  const maxDateObj = new Date(todayBase.getTime() + maxAdvanceDays * 86400000);
  const maxDateStr = maxDateObj.toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 sm:p-4 shadow-2xs" id="date-picker-container">
      {/* Header bar of DatePicker */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/60">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold text-stone-900 block leading-tight">
              {formatIndonesianDate(selectedDate)}
            </span>
            <span className="text-[11px] text-stone-500 font-medium">
              {selectedDate === todayStr ? 'Jadwal operasional hari ini' : 'Pilih tanggal bermain'}
            </span>
          </div>
        </div>

        <button
          type="button"
          id="btn-open-calendar-modal"
          onClick={() => setShowCalendarModal(true)}
          className="text-xs text-emerald-800 hover:text-emerald-900 font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/70 transition-colors cursor-pointer"
        >
          <CalendarIcon className="w-3 h-3 text-emerald-700" />
          <span>Pilih Tanggal Lain</span>
        </button>
      </div>

      {/* 7-Day scrollable pill strip */}
      <div className="relative">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none snap-x touch-pan-x scroll-smooth -mx-0.5 px-0.5"
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
                className={`flex-1 min-w-[70px] sm:min-w-[84px] py-2.5 px-1.5 rounded-xl text-center transition-all duration-150 cursor-pointer snap-start border active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-800/20'
                    : 'bg-stone-50/80 hover:bg-stone-100 text-stone-700 border-stone-200/90'
                }`}
              >
                <div className={`text-[10px] sm:text-[11px] font-medium leading-tight truncate ${isSelected ? 'text-emerald-200 font-semibold' : 'text-stone-500'}`}>
                  {item.dayName}
                </div>
                <div className={`text-base sm:text-lg font-extrabold leading-tight my-0.5 ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                  {item.dateNum}
                </div>
                <div className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${isSelected ? 'text-lime-300' : 'text-stone-400'}`}>
                  {item.monthName}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar Modal for dates up to maxAdvanceDays */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-xs p-0 sm:p-4" id="calendar-modal">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-5 sm:fade-in sm:zoom-in-95 duration-150 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            {/* Grab handle for mobile bottom sheet */}
            <div className="sm:hidden w-10 h-1 bg-stone-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-stone-900 text-base">Pilih Tanggal Jadwal</h3>
                <p className="text-xs text-stone-500 mt-0.5">Maksimal pemesanan {maxAdvanceDays} hari ke depan</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <label htmlFor="calendar-date-input" className="block text-xs font-semibold text-stone-700 mb-1.5">
                Tentukan Tanggal Main:
              </label>
              <input
                id="calendar-date-input"
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
                className="w-full text-base font-semibold border-2 border-emerald-700 rounded-xl px-4 py-3 text-stone-900 focus:outline-hidden focus:ring-3 focus:ring-emerald-700/20 bg-stone-50 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl min-h-[42px] flex items-center justify-center cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
