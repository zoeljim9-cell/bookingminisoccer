import React, { useMemo } from 'react';
import { Clock, Calculator, AlertTriangle, Check, ChevronDown } from 'lucide-react';
import { PriceCalculationResult, VenueSettings } from '../types';
import { calculatePrice, formatDuration, formatRupiah, minutesToTime, timeToMinutes } from '../utils/timeUtils';

interface TimeDurationPickerProps {
  date: string;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  settings: VenueSettings;
  collisionReason?: string;
  onTimeChange: (newStartTime: string) => void;
  onDurationChange: (newDuration: number) => void;
}

export const TimeDurationPicker: React.FC<TimeDurationPickerProps> = ({
  date,
  startTime,
  durationMinutes,
  settings,
  collisionReason,
  onTimeChange,
  onDurationChange,
}) => {
  const [currentHourStr, currentMinuteStr] = (startTime || '16:00').split(':');
  const currentHour = parseInt(currentHourStr || '16', 10);
  const currentMinute = parseInt(currentMinuteStr || '00', 10);

  const startMins = currentHour * 60 + currentMinute;
  const endMins = startMins + durationMinutes;
  const normalizedStartTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const endTime = minutesToTime(endMins);

  // Calculate live price breakdown
  const priceResult: PriceCalculationResult = useMemo(() => {
    return calculatePrice(date, normalizedStartTime, durationMinutes, settings);
  }, [date, normalizedStartTime, durationMinutes, settings]);

  const allowedDurations = useMemo(() => {
    const list = settings.allowedDurations && settings.allowedDurations.length > 0
      ? settings.allowedDurations
      : [60, 90, 120, 180];
    return [...list].sort((a, b) => a - b);
  }, [settings.allowedDurations]);

  // Operational hours list without :00 in the display
  const availableHours = useMemo(() => {
    const openH = parseInt((settings.openTime || '07:00').split(':')[0], 10);
    const closeH = parseInt((settings.closeTime || '23:00').split(':')[0], 10);

    const start = isNaN(openH) ? 7 : openH;
    const end = isNaN(closeH) ? 23 : closeH;

    const hours: string[] = [];
    if (start < end) {
      for (let h = start; h <= end - 1; h++) {
        hours.push(String(h).padStart(2, '0'));
      }
    } else {
      for (let h = 0; h < 24; h++) {
        hours.push(String(h).padStart(2, '0'));
      }
    }

    const currentHStr = String(currentHour).padStart(2, '0');
    if (!hours.includes(currentHStr)) {
      hours.push(currentHStr);
      hours.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }

    return hours;
  }, [settings.openTime, settings.closeTime, currentHour]);

  const minuteOptions = ['00', '15', '30', '45'];

  const formatDurationFriendly = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    if (remainder === 0) {
      return `${hours} Jam`;
    }
    if (remainder === 30) {
      return `${hours},5 Jam`;
    }
    return `${hours} Jam ${remainder} Menit`;
  };

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs scroll-mt-4 sm:scroll-mt-6 transition-all duration-200"
      id="time-duration-picker"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-3 mb-4 border-b border-stone-100">
        <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-800" />
          <span>Waktu Mulai & Durasi Main</span>
        </h3>
        <span className="text-xs text-stone-500 font-medium">
          Tentukan jam, menit awal, dan durasi sewa
        </span>
      </div>

      {/* 1. Start Time Selection: Hour & Minute Selectors */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Hour Select: Displays ONLY the hour number (e.g. 12) without 'Pukul' or ':00' */}
          <div>
            <label htmlFor="select-start-hour" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Jam Mulai
            </label>
            <div className="relative">
              <select
                id="select-start-hour"
                value={String(currentHour).padStart(2, '0')}
                onChange={(e) => {
                  const newHour = e.target.value;
                  onTimeChange(`${newHour}:${String(currentMinute).padStart(2, '0')}`);
                }}
                className="w-full bg-stone-50/90 hover:bg-stone-100 font-bold text-stone-900 text-sm sm:text-base border border-stone-300 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 cursor-pointer appearance-none"
              >
                {availableHours.map((hStr) => (
                  <option key={hStr} value={hStr}>
                    {hStr}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-stone-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Minute Select: Displays ONLY the minute number (e.g. 00, 15) without 'Menit' */}
          <div>
            <label htmlFor="select-start-minute" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Menit Mulai
            </label>
            <div className="relative">
              <select
                id="select-start-minute"
                value={String(currentMinute).padStart(2, '0')}
                onChange={(e) => {
                  const newMinute = e.target.value;
                  onTimeChange(`${String(currentHour).padStart(2, '0')}:${newMinute}`);
                }}
                className="w-full bg-stone-50/90 hover:bg-stone-100 font-bold text-stone-900 text-sm sm:text-base border border-stone-300 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 cursor-pointer appearance-none"
              >
                {minuteOptions.map((mStr) => (
                  <option key={mStr} value={mStr}>
                    {mStr}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-stone-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Duration Selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-stone-700">
            Pilih Durasi Sewa
          </label>
          <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
            {formatDuration(durationMinutes)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {allowedDurations.map((dur) => {
            const isSelected = durationMinutes === dur;
            return (
              <button
                key={dur}
                id={`btn-duration-${dur}`}
                type="button"
                onClick={() => onDurationChange(dur)}
                className={`py-2.5 px-3 rounded-xl text-center border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center min-h-[54px] active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-800/20'
                    : 'bg-stone-50/80 hover:bg-stone-100 text-stone-800 border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="font-bold text-sm sm:text-base flex items-center gap-1">
                  {formatDurationFriendly(dur)}
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-lime-400" />}
                </div>
                <div className={`text-[11px] font-medium ${isSelected ? 'text-emerald-200' : 'text-stone-500'}`}>
                  {dur} Menit
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Schedule Summary Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-emerald-800 font-medium">Rentang Jadwal Dipilih:</div>
          <div className="text-base sm:text-lg font-black text-emerald-950">
            {normalizedStartTime} – {endTime} WIB
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-emerald-800 font-medium">Durasi:</div>
          <div className="text-sm sm:text-base font-extrabold text-emerald-900">
            {formatDuration(durationMinutes)}
          </div>
        </div>
      </div>

      {/* 4. Collision Warning if detected */}
      {collisionReason && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Jadwal Tidak Tersedia</div>
            <div>{collisionReason}</div>
          </div>
        </div>
      )}

      {/* 5. Itemized Price Calculation Breakdown */}
      <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/60" id="price-breakdown-card">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200/70">
          <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            Rincian Biaya Sewa
          </span>
          <span className="text-xs text-stone-500 font-medium">
            Tarif dasar: {formatRupiah(settings.baseHourlyRate)}/jam
          </span>
        </div>

        {/* Segments list if duration spans across rate boundaries */}
        <div className="space-y-2 mb-2">
          {priceResult.segments.map((seg, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-stone-600 gap-0.5 sm:gap-2 pb-1.5 border-b border-stone-100 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <span className="font-semibold text-stone-800">
                  {seg.fromTime}–{seg.toTime} WIB
                </span>{' '}
                ({formatDuration(seg.durationMinutes)}) •{' '}
                <span className="text-[10px] sm:text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-medium inline-block border border-emerald-200/60">
                  {seg.rateName} ({formatRupiah(seg.hourlyRate)}/jam)
                </span>
              </div>
              <div className="font-bold text-stone-800 self-end sm:self-auto">{formatRupiah(seg.amount)}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-800">Total Biaya Sewa</span>
          <span className="text-base sm:text-lg font-black text-emerald-800">
            {formatRupiah(priceResult.totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
};
