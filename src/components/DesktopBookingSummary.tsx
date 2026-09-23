import React from 'react';
import { Calendar, Clock, MapPin, ShieldCheck, AlertCircle, ArrowRight, Check, Trophy } from 'lucide-react';
import { VenueSettings } from '../types';
import { formatDuration, formatIndonesianDate, formatRupiah, minutesToTime, timeToMinutes } from '../utils/timeUtils';

interface DesktopBookingSummaryProps {
  venue: VenueSettings | null;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalPrice: number;
  hasCollision: boolean;
  collisionReason?: string;
  onProceed: () => void;
}

export const DesktopBookingSummary: React.FC<DesktopBookingSummaryProps> = ({
  venue,
  date,
  startTime,
  durationMinutes,
  totalPrice,
  hasCollision,
  collisionReason,
  onProceed,
}) => {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);

  const venueName = venue?.name || 'Almansuri Arena';
  const baseRate = venue?.baseHourlyRate || 300000;

  return (
    <div
      className="hidden lg:block sticky top-20 bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 space-y-4"
      id="desktop-booking-summary"
    >
      {/* Venue Header */}
      <div className="pb-3 border-b border-stone-100 flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 inline-block mb-1">
            Ringkasan Pesanan
          </span>
          <h3 className="font-extrabold text-stone-900 text-lg leading-tight">
            {venueName}
          </h3>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-800 text-lime-400 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-4 h-4" />
        </div>
      </div>

      {/* Selected Schedule Details */}
      <div className="space-y-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-emerald-800 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-stone-500 block text-[11px]">Tanggal Bermain</span>
            <span className="font-bold text-stone-900 text-sm">
              {formatIndonesianDate(date)}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-emerald-800 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-stone-500 block text-[11px]">Jam & Waktu Main</span>
            <span className="font-bold text-stone-900 text-sm">
              {startTime} – {endTime} WIB
            </span>
            <span className="text-[11px] text-stone-500 block mt-0.5">
              Durasi: <strong className="text-stone-800">{formatDuration(durationMinutes)}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-800 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-stone-500 block text-[11px]">Fasilitas Lengkap</span>
            <span className="font-semibold text-stone-800">
              Rumput Standar FIFA • Bola & Rompi Disediakan
            </span>
          </div>
        </div>
      </div>

      {/* Availability Status */}
      <div className="pt-2">
        {hasCollision ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="w-4 h-4" />
              <span>Jadwal Bentrok</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-tight">
              {collisionReason || 'Jadwal yang Anda pilih telah terisi atau melewati jam operasional. Silakan geser jam atau pilih tanggal lain.'}
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-800 text-white flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3] text-lime-400" />
            </div>
            <div>
              <div className="font-bold text-emerald-950">Jadwal Tersedia</div>
              <div className="text-[11px] text-emerald-800">Slot siap langsung dikonfirmasi</div>
            </div>
          </div>
        )}
      </div>

      {/* Total Payment Amount Box */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90">
        <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
          <span>Tarif Dasar</span>
          <span className="font-medium text-stone-700">{formatRupiah(baseRate)}/jam</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
          <div>
            <span className="text-xs font-bold text-stone-800 block">Total Pembayaran</span>
            <span className="text-[11px] text-stone-500">Bayar langsung di lokasi</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-extrabold text-emerald-800 tracking-tight block">
              {formatRupiah(totalPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        id="btn-desktop-proceed"
        type="button"
        disabled={hasCollision}
        onClick={onProceed}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all duration-150 shadow-xs cursor-pointer ${
          hasCollision
            ? 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-200'
            : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white border border-emerald-900 active:scale-98'
        }`}
      >
        <span>Lanjutkan Booking</span>
        <ArrowRight className="w-4 h-4 text-lime-400" />
      </button>

      <p className="text-[11px] text-stone-500 text-center leading-tight">
        Tanpa DP wajib di muka. Pembatalan mudah dengan kode booking Anda.
      </p>
    </div>
  );
};
