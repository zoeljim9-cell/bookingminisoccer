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
  Layers,
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
        bg: 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-800/20',
        textColor: 'text-white',
        subTextColor: 'text-emerald-200',
        badgeBg: 'bg-emerald-950/60 text-lime-300 border-emerald-700',
        icon: <Sparkles className="w-3.5 h-3.5 text-lime-400" />,
        label: 'Pilihan Anda',
      };
    }

    switch (status) {
      case 'available':
        return {
          bg: 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border-emerald-200/90 cursor-pointer hover:border-emerald-300',
          textColor: 'text-emerald-950',
          subTextColor: 'text-emerald-700',
          badgeBg: 'bg-white/80 text-emerald-800 border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          label: 'Tersedia',
        };
      case 'booked':
        return {
          bg: 'bg-stone-100/80 text-stone-500 border-stone-200 cursor-not-allowed opacity-85',
          textColor: 'text-stone-700',
          subTextColor: 'text-stone-400',
          badgeBg: 'bg-stone-200/60 text-stone-600 border-stone-300/60',
          icon: <XCircle className="w-3.5 h-3.5 text-stone-400" />,
          label: 'Terisi',
        };
      case 'closed':
        return {
          bg: 'bg-amber-50/70 text-amber-900 border-amber-200/90 cursor-not-allowed opacity-90',
          textColor: 'text-amber-950',
          subTextColor: 'text-amber-700',
          badgeBg: 'bg-white/80 text-amber-800 border-amber-200',
          icon: <Ban className="w-3.5 h-3.5 text-amber-600" />,
          label: 'Ditutup',
        };
      case 'past':
        return {
          bg: 'bg-stone-100/50 text-stone-400 border-stone-200/60 cursor-not-allowed opacity-60',
          textColor: 'text-stone-500',
          subTextColor: 'text-stone-400',
          badgeBg: 'bg-stone-200/40 text-stone-500 border-stone-200',
          icon: <Clock className="w-3.5 h-3.5 text-stone-400" />,
          label: 'Lewat',
        };
      default:
        return {
          bg: 'bg-stone-50 text-stone-700 border-stone-200',
          textColor: 'text-stone-900',
          subTextColor: 'text-stone-500',
          badgeBg: 'bg-stone-100 text-stone-600 border-stone-200',
          icon: <Clock className="w-3.5 h-3.5 text-stone-500" />,
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
    <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 sm:p-5 shadow-2xs" id="schedule-timeline-container">
      {/* Legend & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 mb-3.5 border-b border-stone-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-800" />
            <span>Ketersediaan Jadwal Lapangan</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Pilih rentang waktu kosong di bawah untuk menentukan jam main
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Tersedia
          </span>
          <span className="inline-flex items-center gap-1.5 text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md font-medium border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
            Terisi
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Ditutup
          </span>
          <span className="inline-flex items-center gap-1.5 text-stone-500 bg-stone-100/70 px-2 py-0.5 rounded-md font-medium border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
            Sudah Lewat
          </span>
        </div>
      </div>

      {/* When the day is completely full */}
      {isFull ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-center my-3" id="day-full-alert">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-stone-900 text-sm mb-1">
            Jadwal Tanggal Ini Sudah Penuh
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto mb-3">
            Semua rentang waktu pada tanggal ini telah terisi atau melewati jam operasional. Silakan pilih tanggal terdekat lainnya:
          </p>

          {nearestAvailableDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {nearestAvailableDates.map((dateStr) => (
                <button
                  key={dateStr}
                  onClick={() => onSelectDate(dateStr)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-xl border border-emerald-300 shadow-2xs hover:border-emerald-500 transition-colors cursor-pointer min-h-[40px]"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{dateStr}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Quick free ranges list (Fast tap options) */}
      {freeRanges.length > 0 && (
        <div className="mb-4" id="quick-free-ranges">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Slot Kosong Siap Pilih
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
              {freeRanges.length} rentang bebas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {freeRanges.map((range, idx) => (
              <button
                key={`range-${idx}`}
                id={`btn-range-${range.startTime}`}
                type="button"
                onClick={() => onSelectRange(range)}
                className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/60 text-left transition-all duration-150 cursor-pointer group hover:border-emerald-400 shadow-2xs active:scale-98"
              >
                <div>
                  <div className="text-[11px] text-emerald-800 font-medium">
                    Tersedia {formatDuration(range.durationMinutes)}
                  </div>
                  <div className="text-base font-extrabold text-emerald-950 group-hover:text-emerald-900 mt-0.5">
                    {range.startTime} – {range.endTime} WIB
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-900 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                  <span>Pilih</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Continuous Slots Grid */}
      <div>
        <div className="text-xs font-semibold text-stone-500 mb-2 flex items-center justify-between">
          <span>Rincian Seluruh Slot Waktu</span>
          <span className="text-[11px] text-stone-400">Ketuk slot tersedia untuk mengatur</span>
        </div>

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
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all duration-150 min-h-[48px] ${badge.bg} ${isClickable ? 'active:scale-98 cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-shrink-0">{badge.icon}</div>
                  <div className="truncate">
                    <div className={`font-bold text-sm tracking-tight truncate ${badge.textColor}`}>
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
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badge.badgeBg}`}>
                    {badge.label}
                  </span>
                  {isClickable && (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-800" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
