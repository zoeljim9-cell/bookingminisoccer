import React, { useMemo } from 'react';
import { Clock, Calculator, AlertTriangle, Check } from 'lucide-react';
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
      className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs scroll-mt-4 sm:scroll-mt-6 transition-all duration-300"
      id="time-duration-picker"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2.5 sm:pb-3 mb-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Waktu Mulai & Durasi Main</span>
        </h3>
        <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
          Tentukan jam, menit mulai, dan durasi sewa
        </span>
      </div>

      {/* 1. Start Time Selection: Jam & Menit Terpisah (Tanpa :00 di Pilihan Jam) */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Hour Select: Displays ONLY the hour (e.g. Jam 16), NO confusing :00 */}
          <div>
            <label htmlFor="select-start-hour" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Pilih Jam Mulai
            </label>
            <div className="relative">
              <select
                id="select-start-hour"
                value={String(currentHour).padStart(2, '0')}
                onChange={(e) => {
                  const newHour = e.target.value;
                  onTimeChange(`${newHour}:${String(currentMinute).padStart(2, '0')}`);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-slate-900 text-sm sm:text-base border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
              >
                {availableHours.map((hStr) => (
                  <option key={hStr} value={hStr}>
                    Jam {hStr}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 font-bold text-xs">
                ▾
              </div>
            </div>
          </div>

          {/* Minute Select: Clear minute options */}
          <div>
            <label htmlFor="select-start-minute" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Pilih Menit Mulai
            </label>
            <div className="relative">
              <select
                id="select-start-minute"
                value={String(currentMinute).padStart(2, '0')}
                onChange={(e) => {
                  const newMinute = e.target.value;
                  onTimeChange(`${String(currentHour).padStart(2, '0')}:${newMinute}`);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-slate-900 text-sm sm:text-base border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
              >
                {minuteOptions.map((mStr) => (
                  <option key={mStr} value={mStr}>
                    {mStr === '00' ? 'Menit 00 (Tepat)' : `Menit ${mStr}`}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 font-bold text-xs">
                ▾
              </div>
            </div>
          </div>
        </div>

        {/* Quick Minute Selection Chips for 1-tap ease */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Pilihan cepat menit:</span>
          <div className="flex gap-1.5 flex-1">
            {minuteOptions.map((mStr) => {
              const isSelected = String(currentMinute).padStart(2, '0') === mStr;
              return (
                <button
                  key={mStr}
                  type="button"
                  onClick={() => onTimeChange(`${String(currentHour).padStart(2, '0')}:${mStr}`)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer border text-center ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  :{mStr}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Duration Selector (Clean preset cards, no custom slider) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Pilih Durasi Sewa
          </label>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
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
                className={`py-2.5 px-3 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center min-h-[52px] ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-black text-sm sm:text-base flex items-center gap-1">
                  {formatDurationFriendly(dur)}
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className={`text-[11px] font-medium ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {dur} Menit
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Schedule Summary Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-emerald-800 font-medium">Rentang Waktu Main:</div>
          <div className="text-base sm:text-lg font-black text-emerald-950">
            {normalizedStartTime} – {endTime} WIB
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-emerald-800 font-medium">Total Waktu:</div>
          <div className="text-sm sm:text-base font-extrabold text-emerald-900">
            {formatDuration(durationMinutes)}
          </div>
        </div>
      </div>

      {/* 4. Collision Warning if detected */}
      {collisionReason && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Jadwal Tidak Tersedia</div>
            <div>{collisionReason}</div>
          </div>
        </div>
      )}

      {/* 5. Itemized Price Calculation Breakdown */}
      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50" id="price-breakdown-card">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-emerald-600" />
            Rincian Estimasi Biaya
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Tarif dasar: {formatRupiah(settings.baseHourlyRate)}/jam
          </span>
        </div>

        {/* Segments list if duration spans across rate boundaries */}
        <div className="space-y-2 mb-2">
          {priceResult.segments.map((seg, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-0.5 sm:gap-2 pb-1.5 border-b border-slate-100 last:border-0 last:pb-0"
            >
              <div className="flex-1">
                <span className="font-semibold text-slate-800">
                  {seg.fromTime}–{seg.toTime}
                </span>{' '}
                ({formatDuration(seg.durationMinutes)}) •{' '}
                <span className="text-[10px] sm:text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium inline-block">
                  {seg.rateName} ({formatRupiah(seg.hourlyRate)}/jam)
                </span>
              </div>
              <div className="font-bold text-slate-800 self-end sm:self-auto">{formatRupiah(seg.amount)}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Total Estimasi Biaya</span>
          <span className="text-base sm:text-lg font-black text-emerald-700">
            {formatRupiah(priceResult.totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
};
