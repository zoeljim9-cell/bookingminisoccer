import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { formatDuration, formatRupiah, minutesToTime, timeToMinutes } from '../utils/timeUtils';

interface StickySummaryBarProps {
  startTime: string;
  durationMinutes: number;
  totalPrice: number;
  hasCollision: boolean;
  onProceed: () => void;
}

export const StickySummaryBar: React.FC<StickySummaryBarProps> = ({
  startTime,
  durationMinutes,
  totalPrice,
  hasCollision,
  onProceed,
}) => {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-lg px-3.5 sm:px-5 py-2.5 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      id="sticky-summary-bar"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Summary info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-stone-500 font-medium truncate">
            {hasCollision ? (
              <span className="inline-flex items-center text-rose-700 font-bold text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 mr-1 inline flex-shrink-0" /> Jadwal Bentrok
              </span>
            ) : (
              <>
                <span className="font-bold text-stone-900">{startTime}–{endTime} WIB</span>
                <span className="text-stone-300">·</span>
                <span className="text-emerald-800 font-semibold">{formatDuration(durationMinutes)}</span>
              </>
            )}
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-800 tracking-tight truncate mt-0.5">
            {formatRupiah(totalPrice)}
          </div>
        </div>

        {/* Right: Proceed Button */}
        <button
          id="btn-sticky-continue"
          type="button"
          disabled={hasCollision}
          onClick={onProceed}
          className={`inline-flex items-center justify-center gap-1.5 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xs cursor-pointer whitespace-nowrap min-h-[44px] active:scale-95 ${
            hasCollision
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-200'
              : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white border border-emerald-900'
          }`}
        >
          <span>Lanjutkan</span>
          <ArrowRight className="w-4 h-4 text-lime-400" />
        </button>
      </div>
    </div>
  );
};
