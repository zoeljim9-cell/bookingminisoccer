import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { AvailableRange, PublicSlot, SlotStatus } from '../types';
import { formatDuration, timeToMinutes } from '../utils/timeUtils';

interface ScheduleTimelineProps {
  slots: PublicSlot[];
  freeRanges: AvailableRange[];
  isFull: boolean;
  nearestAvailableDates?: string[];
  selectedStartTime?: string;
  selectedEndTime?: string;
  onSelectRange: (range: AvailableRange) => void;
  onSelectDate: (dateStr: string) => void;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
  slots,
  freeRanges,
  isFull,
  nearestAvailableDates = [],
  selectedStartTime,
  selectedEndTime,
  onSelectRange,
  onSelectDate,
}) => {
  const getStatusBadge = (status: SlotStatus, isUserSelected?: boolean) => {
    if (isUserSelected) {
      return {
        bg: 'bg-emerald-500 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/30',
        barColor: 'bg-emerald-500',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        label: 'Pilihan Anda',
      };
    }

    switch (status) {
      case 'available':
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border-emerald-200 cursor-pointer',
          barColor: 'bg-emerald-500',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          label: 'Tersedia',
        };
      case 'booked':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200 cursor-not-allowed opacity-90',
          barColor: 'bg-rose-500',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Terisi',
        };
      case 'closed':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200 cursor-not-allowed opacity-90',
          barColor: 'bg-amber-500',
          icon: <Ban className="w-3.5 h-3.5 text-amber-600" />,
          label: 'Ditutup',
        };
      case 'past':
        return {
          bg: 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed opacity-60',
          barColor: 'bg-slate-400',
          icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
          label: 'Sudah lewat',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          barColor: 'bg-slate-400',
          icon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
          label: status,
        };
    }
  };

  // Helper to determine if a slot overlaps user's chosen start and end time
  const isSlotUserSelected = (slot: PublicSlot) => {
    if (!selectedStartTime || !selectedEndTime) return false;
    const sStart = timeToMinutes(slot.startTime);
    const sEnd = timeToMinutes(slot.endTime);
    const uStart = timeToMinutes(selectedStartTime);
    const uEnd = timeToMinutes(selectedEndTime);
    return uStart < sEnd && uEnd > sStart && slot.status === 'available';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs" id="schedule-timeline-container">
      {/* Legend & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 sm:pb-3 mb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span>Ketersediaan Lapangan</span>
            <span className="text-[11px] sm:text-xs font-normal text-slate-500">
              (Waktu aktual jam & menit)
            </span>
          </h2>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md font-medium border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Tersedia
          </span>
          <span className="inline-flex items-center gap-1 text-rose-800 bg-rose-50 px-1.5 sm:px-2 py-0.5 rounded-md font-medium border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Terisi
          </span>
          <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md font-medium border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Ditutup
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md font-medium border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Sudah lewat
          </span>
        </div>
      </div>

      {/* When the day is completely full */}
      {isFull ? (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-center my-3" id="day-full-alert">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm mb-1">
            Jadwal Tanggal Ini Sudah Penuh
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-3">
            Semua rentang waktu pada tanggal ini telah terisi atau melewati jam operasional. Silakan pilih tanggal terdekat lainnya:
          </p>

          {nearestAvailableDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {nearestAvailableDates.map((dateStr) => (
                <button
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-700 font-semibold text-xs rounded-lg border border-emerald-300 shadow-2xs hover:border-emerald-500 transition-colors cursor-pointer min-h-[40px]"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{dateStr}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Visual Continuous Timeline Bar */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
          <span>Timeline Harian</span>
          <span className="text-[11px] text-slate-400">Ketuk rentang untuk memilih</span>
        </div>

        {/* Stacked timeline representation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" id="slots-grid">
          {slots.map((slot, idx) => {
            const isSelected = isSlotUserSelected(slot);
            const badge = getStatusBadge(slot.status, isSelected);
            const isClickable = slot.status === 'available';

            return (
              <div
                key={`${slot.startTime}-${slot.endTime}-${idx}`}
                id={`slot-card-${idx}`}
                onClick={() => {
                  if (isClickable) {
                    const span = timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
                    onSelectRange({
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      durationMinutes: span,
                    });
                  }
                }}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all min-h-[48px] ${badge.bg} ${isClickable ? 'active:scale-98 cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0">{badge.icon}</div>
                  <div className="truncate">
                    <div className="font-bold text-sm tracking-tight truncate">
                      {slot.startTime} – {slot.endTime}
                    </div>
                    {slot.reason && (
                      <div className="text-[11px] text-amber-800 truncate">
                        {slot.reason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/70 backdrop-blur-2xs shadow-2xs">
                    {badge.label}
                  </span>
                  {isClickable && (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick free ranges list (Easy touch list for mobile) */}
      {freeRanges.length > 0 && (
        <div className="pt-3 border-t border-slate-100" id="quick-free-ranges">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Pilihan Cepat Rentang Kosong
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">
              {freeRanges.length} rentang tersedia
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {freeRanges.map((range, idx) => (
              <button
                key={`range-${idx}`}
                id={`btn-range-${range.startTime}`}
                type="button"
                onClick={() => onSelectRange(range)}
                className="flex items-center justify-between p-3 rounded-xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/80 text-left transition-all cursor-pointer group hover:border-emerald-500 shadow-2xs"
              >
                <div>
                  <div className="text-xs text-emerald-800 font-medium">
                    Tersedia {formatDuration(range.durationMinutes)}
                  </div>
                  <div className="text-base font-extrabold text-emerald-950 group-hover:text-emerald-900">
                    {range.startTime} – {range.endTime}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <span>Pilih</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
