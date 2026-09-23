import React, { useState, useMemo } from 'react';
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
  Tag,
  Gift,
  Shield,
  Zap,
  Moon,
  Timer,
  Filter,
} from 'lucide-react';
import { AvailableRange, PublicSlot, PublicSlotSession, SlotStatus } from '../types';
import { formatDuration, formatRupiah, sortSlotSessions, timeToMinutes } from '../utils/timeUtils';

interface ScheduleTimelineProps {
  slots: PublicSlot[];
  freeRanges: AvailableRange[];
  slotSessions?: PublicSlotSession[];
  isFull: boolean;
  nearestAvailableDates?: string[];
  selectedStartTime?: string;
  selectedEndTime?: string;
  selectedDurationMinutes?: number;
  onSelectRange: (range: AvailableRange) => void;
  onSelectSession?: (session: PublicSlotSession) => void;
  onSelectDate: (dateStr: string) => void;
  onBookNow?: (session: PublicSlotSession) => void;
}

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
  slots,
  freeRanges,
  slotSessions = [],
  isFull,
  nearestAvailableDates = [],
  selectedStartTime,
  selectedEndTime,
  selectedDurationMinutes,
  onSelectRange,
  onSelectSession,
  onSelectDate,
  onBookNow,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | '60' | '120' | 'prime'>('all');

  const filteredSessions = useMemo(() => {
    if (!slotSessions || slotSessions.length === 0) return [];
    const list = slotSessions.filter((s) => {
      if (activeFilter === '60') return s.durationMinutes === 60;
      if (activeFilter === '120') return s.durationMinutes >= 120;
      if (activeFilter === 'prime') {
        return (
          s.startTime >= '19:00' ||
          (s.label ? s.label.toLowerCase().includes('prime') : false)
        );
      }
      return true;
    });
    return sortSlotSessions(list, '07:00');
  }, [slotSessions, activeFilter]);

  const selectedSession = useMemo(() => {
    if (!slotSessions || slotSessions.length === 0) return null;
    return slotSessions.find(
      (s) => s.startTime === selectedStartTime && s.durationMinutes === selectedDurationMinutes
    );
  }, [slotSessions, selectedStartTime, selectedDurationMinutes]);

  const availableCount = useMemo(() => {
    return (slotSessions || []).filter((s) => s.status === 'available').length;
  }, [slotSessions]);

  const getStatusBadge = (status: SlotStatus, isUserSelected?: boolean) => {
    if (isUserSelected) {
      return {
        bg: 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-800/20',
        textColor: 'text-white',
        subTextColor: 'text-emerald-200',
        badgeBg: 'bg-emerald-950/60 text-emerald-300 border-emerald-700',
        icon: <Sparkles className="w-3.5 h-3.5 text-amber-300" />,
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

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 sm:p-5 shadow-xs space-y-4" id="schedule-timeline-container">
      {/* Legend & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
              FalseNine Arena
            </span>
            <span className="text-xs text-stone-500 font-medium">Jadwal Sesi Resmi Lapangan</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2 mt-0.5">
            <Layers className="w-4 h-4 text-emerald-800" />
            <span>Pilihan Sesi Jadwal Lapangan</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Jadwal disesuaikan dengan jam operasional resmi owner. Ketuk sesi (1 Jam atau 2 Jam) yang masih tersedia untuk memesan.
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Tersedia ({availableCount})
          </span>
          <span className="inline-flex items-center gap-1.5 text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md font-medium border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
            Terisi
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Ditutup
          </span>
        </div>
      </div>

      {/* FILTER TABS (1 Jam, 2 Jam Match, Prime Night, Semua) */}
      {slotSessions && slotSessions.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Semua Sesi ({slotSessions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('120')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === '120'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sesi 2 Jam (Paket Match)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('60')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === '60'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Sesi 1 Jam</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('prime')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilter === 'prime'
                ? 'bg-indigo-900 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-700" />
            <span>Prime Night (Malam)</span>
          </button>
        </div>
      )}

      {/* When the day is completely full */}
      {isFull ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-center my-2" id="day-full-alert">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-stone-900 text-sm mb-1">
            Jadwal Tanggal Ini Sudah Penuh
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto mb-3">
            Semua rentang sesi pada tanggal ini telah terisi atau melewati jam operasional. Silakan pilih tanggal terdekat lainnya:
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

      {/* PRIMARY VIEW: Official FalseNine Slot Sessions */}
      {slotSessions && slotSessions.length > 0 ? (
        <div className="space-y-3" id="official-slot-sessions-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
            {filteredSessions.map((session) => {
              const isSelected =
                selectedStartTime === session.startTime &&
                selectedDurationMinutes === session.durationMinutes;

              const isAvailable = session.status === 'available';
              const isPrime = session.startTime >= '19:00' || (session.label ? session.label.toLowerCase().includes('prime') : false);
              const is2Hours = session.durationMinutes >= 120;

              return (
                <div
                  key={session.id}
                  id={`session-card-${session.id}`}
                  onClick={() => {
                    if (isAvailable && onSelectSession) {
                      onSelectSession(session);
                    }
                  }}
                  className={`relative rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-950 text-white border-emerald-500 shadow-lg ring-2 ring-emerald-500 scale-[1.01]'
                      : isAvailable
                      ? 'bg-white hover:bg-emerald-50/40 border-stone-200 hover:border-emerald-400 cursor-pointer shadow-xs hover:shadow-sm'
                      : session.status === 'booked'
                      ? 'bg-stone-100/90 border-stone-200 opacity-80 cursor-not-allowed'
                      : session.status === 'closed'
                      ? 'bg-amber-50/80 border-amber-200 opacity-85 cursor-not-allowed'
                      : 'bg-stone-100/60 border-stone-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Top Bar: Label & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                          isSelected
                            ? 'bg-emerald-800 text-emerald-200'
                            : isPrime
                            ? 'bg-indigo-100 text-indigo-950 border border-indigo-200'
                            : 'bg-stone-100 text-stone-800 border border-stone-200'
                        }`}
                      >
                        {session.label}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-emerald-900 text-emerald-100'
                            : is2Hours
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {formatDuration(session.durationMinutes)}
                      </span>
                      {is2Hours && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isSelected ? 'bg-amber-400 text-stone-950' : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                        >
                          <Gift className="w-3 h-3" />
                          Free Rompi & Bola
                        </span>
                      )}
                    </div>

                    <div>
                      {isAvailable ? (
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                            isSelected
                              ? 'bg-emerald-500 text-stone-950 font-black'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tersedia
                        </span>
                      ) : session.status === 'booked' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 border border-stone-300 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {session.bookedBy ? `Terisi (${session.bookedBy})` : 'Terisi'}
                        </span>
                      ) : session.status === 'closed' ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          {session.reason || 'Ditutup'}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-500 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Lewat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Session Time & Price */}
                  <div className="my-2 flex items-baseline justify-between">
                    <div>
                      <div
                        className={`text-xl sm:text-2xl font-black tracking-tight ${
                          isSelected ? 'text-white' : isAvailable ? 'text-stone-900' : 'text-stone-500'
                        }`}
                      >
                        {session.startTime} – {session.endTime}{' '}
                        <span className="text-xs font-normal opacity-70">WIB</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-base sm:text-lg font-black ${
                          isSelected
                            ? 'text-amber-300'
                            : isAvailable
                            ? 'text-emerald-800'
                            : 'text-stone-500'
                        }`}
                      >
                        {formatRupiah(session.effectivePrice)}
                      </div>
                      <div
                        className={`text-[10px] ${
                          isSelected ? 'text-emerald-200' : 'text-stone-400'
                        }`}
                      >
                        {session.isWeekend ? 'Tarif Weekend' : 'Tarif Weekday'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action */}
                  {isAvailable && (
                    <div className="mt-2 pt-2.5 border-t border-stone-100 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                      <span
                        className={`font-semibold ${
                          isSelected ? 'text-emerald-200 font-bold' : 'text-stone-500'
                        }`}
                      >
                        {isSelected ? '✓ Sesi ini terpilih' : 'Klik untuk memilih sesi ini'}
                      </span>

                      {onBookNow && isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookNow(session);
                          }}
                          className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl text-xs shadow-sm cursor-pointer flex items-center gap-1 transition-transform active:scale-95"
                        >
                          <span>Lanjut Pesan</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="text-center py-8 bg-stone-50 rounded-xl border border-stone-200">
              <p className="text-xs text-stone-500 font-medium">
                Tidak ada sesi dengan kategori filter ini pada tanggal yang dipilih.
              </p>
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="mt-2 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
              >
                Tampilkan Semua Sesi
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Fallback / Continuous Raw Slots Breakdown (if no slotSessions configured) */}
      {(!slotSessions || slotSessions.length === 0) && (
        <div>
          <div className="text-xs font-semibold text-stone-500 mb-2 flex items-center justify-between">
            <span>Rincian Seluruh Slot Waktu</span>
            <span className="text-[11px] text-stone-400">Ketuk slot tersedia untuk mengatur</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" id="slots-grid">
            {slots.map((slot, idx) => {
              const badge = getStatusBadge(slot.status, false);
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
      )}
    </div>
  );
};
