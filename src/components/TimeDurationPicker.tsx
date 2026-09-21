import React, { useMemo } from 'react';
import { Clock, Calculator, AlertTriangle, CheckCircle2, ChevronDown, Plus, Minus } from 'lucide-react';
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
  const [currentHourStr, currentMinuteStr] = (startTime || '14:45').split(':');
  const currentHour = parseInt(currentHourStr || '14', 10);
  const currentMinute = parseInt(currentMinuteStr || '45', 10);

  const startMins = currentHour * 60 + currentMinute;
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);

  // Calculate live price breakdown
  const priceResult: PriceCalculationResult = useMemo(() => {
    return calculatePrice(date, startTime, durationMinutes, settings);
  }, [date, startTime, durationMinutes, settings]);

  const allowedDurations = settings.allowedDurations || [60, 90, 120, 180];
  const minDuration = settings.minDurationMinutes || 60;

  // Step minutes helper
  const adjustMinute = (delta: number) => {
    let total = currentHour * 60 + currentMinute + delta;
    const openMins = timeToMinutes(settings.openTime || '07:00');
    const closeMins = timeToMinutes(settings.closeTime || '23:00');

    if (total < openMins) total = openMins;
    if (total > closeMins - durationMinutes) total = closeMins - durationMinutes;

    onTimeChange(minutesToTime(total));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs" id="time-duration-picker">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2.5 sm:pb-3 mb-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Waktu Mulai & Durasi Fleksibel</span>
        </h3>
        <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Bebas jam & menit berapa pun</span>
      </div>

      {/* Start Time Selector (Hour & Minute) */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Waktu Mulai Main (WIB)
        </label>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hour Select */}
          <div className="flex-1">
            <div className="text-[11px] text-slate-500 mb-1 font-medium">Jam (00–23)</div>
            <select
              id="select-start-hour"
              value={String(currentHour).padStart(2, '0')}
              onChange={(e) => {
                const newH = e.target.value;
                onTimeChange(`${newH}:${String(currentMinute).padStart(2, '0')}`);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-slate-900 text-base border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {Array.from({ length: 24 }).map((_, h) => {
                const hStr = String(h).padStart(2, '0');
                return (
                  <option key={hStr} value={hStr}>
                    {hStr}:00
                  </option>
                );
              })}
            </select>
          </div>

          <span className="text-slate-400 font-bold text-lg pt-4">:</span>

          {/* Minute Select */}
          <div className="flex-1">
            <div className="text-[11px] text-slate-500 mb-1 font-medium">Menit (00–59)</div>
            <select
              id="select-start-minute"
              value={String(currentMinute).padStart(2, '0')}
              onChange={(e) => {
                const newM = e.target.value;
                onTimeChange(`${String(currentHour).padStart(2, '0')}:${newM}`);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 font-bold text-slate-900 text-base border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {Array.from({ length: 60 }).map((_, m) => {
                const mStr = String(m).padStart(2, '0');
                return (
                  <option key={mStr} value={mStr}>
                    :{mStr}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Quick minute adjuster chips */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-xs">
          <span className="text-[11px] text-slate-500 mr-0.5">Penyesuaian:</span>
          <button
            type="button"
            onClick={() => adjustMinute(-15)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-medium text-[11px] cursor-pointer min-h-[32px]"
          >
            -15m
          </button>
          <button
            type="button"
            onClick={() => adjustMinute(-5)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-medium text-[11px] cursor-pointer min-h-[32px]"
          >
            -5m
          </button>
          <button
            type="button"
            onClick={() => adjustMinute(5)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-medium text-[11px] cursor-pointer min-h-[32px]"
          >
            +5m
          </button>
          <button
            type="button"
            onClick={() => adjustMinute(15)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg font-medium text-[11px] cursor-pointer min-h-[32px]"
          >
            +15m
          </button>
          <span className="text-slate-300 hidden xs:inline">|</span>
          {['00', '15', '30', '45'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onTimeChange(`${String(currentHour).padStart(2, '0')}:${m}`)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer min-h-[32px] ${
                String(currentMinute).padStart(2, '0') === m
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              :{m}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Pilih Durasi Main
          </label>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
            {formatDuration(durationMinutes)}
          </span>
        </div>

        {/* Quick Duration Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {allowedDurations.map((dur) => {
            const isSelected = durationMinutes === dur;
            return (
              <button
                key={dur}
                id={`btn-duration-${dur}`}
                type="button"
                onClick={() => onDurationChange(dur)}
                className={`py-2 px-2.5 rounded-xl text-center border font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div>{formatDuration(dur)}</div>
              </button>
            );
          })}
        </div>

        {/* Custom duration slider / input */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Durasi Kustom (minimal {minDuration} menit):</span>
            <span className="font-bold text-slate-800">{durationMinutes} menit ({formatDuration(durationMinutes)})</span>
          </div>
          <input
            type="range"
            min={minDuration}
            max={360}
            step={15}
            value={durationMinutes}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Calculated Schedule Range & End Time */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-emerald-800 font-medium">Rentang Waktu Sewa:</div>
          <div className="text-base sm:text-lg font-black text-emerald-950">
            {startTime} – {endTime}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-emerald-800 font-medium">Total Durasi:</div>
          <div className="text-sm sm:text-base font-extrabold text-emerald-900">
            {formatDuration(durationMinutes)}
          </div>
        </div>
      </div>

      {/* Collision Warning if detected */}
      {collisionReason && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Jadwal Tidak Tersedia</div>
            <div>{collisionReason}</div>
          </div>
        </div>
      )}

      {/* Itemized Price Calculation Breakdown */}
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
            <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 gap-0.5 sm:gap-2 pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
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
