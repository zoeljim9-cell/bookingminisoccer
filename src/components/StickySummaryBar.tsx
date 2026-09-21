import React from 'react';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
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
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-3 sm:px-4 py-2.5 sm:py-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      id="sticky-summary-bar"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left: Summary info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
            {hasCollision ? (
              <span className="inline-flex items-center text-rose-600 font-bold text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 mr-0.5 inline flex-shrink-0" /> Jadwal Bentrok
              </span>
            ) : (
              <>
                <span className="font-semibold text-slate-800">{startTime}–{endTime}</span>
                <span className="text-slate-300">·</span>
                <span className="text-emerald-800 font-medium">{formatDuration(durationMinutes)}</span>
              </>
            )}
          </div>
          <div className="text-sm sm:text-base font-black text-emerald-700 tracking-tight truncate mt-0.5">
            {formatRupiah(totalPrice)}
          </div>
        </div>

        {/* Right: Proceed Button */}
        <button
          id="btn-sticky-continue"
          type="button"
          disabled={hasCollision}
          onClick={onProceed}
          className={`inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm transition-all shadow-sm cursor-pointer whitespace-nowrap min-h-[44px] ${
            hasCollision
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
          }`}
        >
          <span>Lanjutkan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
