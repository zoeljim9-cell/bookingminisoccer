import React, { useState } from 'react';
import { CheckCircle, Copy, Check, MessageSquare, ExternalLink, X, ShieldAlert } from 'lucide-react';
import { Booking, VenueSettings } from '../types';
import { formatDuration, formatIndonesianDate, formatRupiah } from '../utils/timeUtils';

interface BookingSuccessModalProps {
  booking: Booking;
  secretToken: string;
  settings: VenueSettings;
  onClose: () => void;
}

export const BookingSuccessModal: React.FC<BookingSuccessModalProps> = ({
  booking,
  secretToken,
  settings,
  onClose,
}) => {
  const [copiedDetail, setCopiedDetail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const privateUrl = `${window.location.origin}/?token=${secretToken}`;

  const summaryText = `*KONFIRMASI BOOKING MINISOCCER*
Kode Booking: ${booking.bookingCode}
Lapangan: ${settings.name}
Tanggal: ${formatIndonesianDate(booking.date)}
Waktu: ${booking.startTime} – ${booking.endTime} WIB (${formatDuration(booking.durationMinutes)})
Nama Pemesan: ${booking.customerName}
WhatsApp: ${booking.customerWhatsapp}${booking.teamName ? `\nTim: ${booking.teamName}` : ''}
Total Biaya: ${formatRupiah(booking.totalPrice)}
Status Booking: Terkonfirmasi
Status Pembayaran: Belum Lunas (Bayar di lokasi)

Link Akses Privat:
${privateUrl}`;

  const handleCopyDetail = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedDetail(true);
    setTimeout(() => setCopiedDetail(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(privateUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // WhatsApp link preparation
  const waTarget = settings.ownerWhatsapp.replace(/[^0-9]/g, '');
  const waMessage = encodeURIComponent(
    `Halo ${settings.name}, saya ingin konfirmasi booking lapangan mini soccer:\n\n` +
      `Kode Booking: *${booking.bookingCode}*\n` +
      `Tanggal: ${booking.date}\n` +
      `Waktu: ${booking.startTime} - ${booking.endTime} WIB\n` +
      `Nama: ${booking.customerName}\n` +
      `Total: ${formatRupiah(booking.totalPrice)}\n\n` +
      `Mohon informasinya saat kedatangan. Terima kasih!`
  );
  const waUrl = `https://wa.me/${waTarget}?text=${waMessage}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4" id="booking-success-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />

        <div className="text-center pb-4 border-b border-slate-100 relative">
          <button
            type="button"
            id="btn-close-success"
            onClick={onClose}
            className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 sm:mb-3 shadow-xs">
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">Booking Berhasil Dikonfirmasi!</h2>
          <p className="text-xs text-slate-600 mt-1">
            Data Anda telah tersimpan dan jadwal lapangan langsung terkunci untuk Anda.
          </p>
        </div>

        <div className="py-4 space-y-4">
          {/* Booking Code Card */}
          <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-4 text-center">
            <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
              Kode Booking Anda
            </div>
            <div className="text-2xl font-black text-emerald-950 tracking-wider">
              {booking.bookingCode}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              Gunakan kode ini & nomor WhatsApp untuk cek booking kapan saja.
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tanggal:</span>
              <span className="font-bold text-slate-800">{formatIndonesianDate(booking.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Waktu Main:</span>
              <span className="font-black text-slate-900 text-sm">
                {booking.startTime} – {booking.endTime} WIB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Durasi:</span>
              <span className="font-bold text-slate-800">{formatDuration(booking.durationMinutes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Nama Pemesan:</span>
              <span className="font-semibold text-slate-800">{booking.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">WhatsApp:</span>
              <span className="font-semibold text-slate-800">{booking.customerWhatsapp}</span>
            </div>
            {booking.teamName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Tim:</span>
                <span className="font-semibold text-slate-800">{booking.teamName}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-slate-700 font-bold">Total Biaya:</span>
              <span className="text-base font-black text-emerald-700">
                {formatRupiah(booking.totalPrice)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status Booking:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Terkonfirmasi
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status Pembayaran:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                Belum Lunas (Bayar di lokasi)
              </span>
            </div>
          </div>

          {/* Copy details & Private Link */}
          <div className="space-y-2">
            <button
              type="button"
              id="btn-copy-booking-details"
              onClick={handleCopyDetail}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              {copiedDetail ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Detail Berhasil Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Salin Ringkasan Booking</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-copy-private-link"
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <span className="text-emerald-700 font-bold">Tautan Privat Berhasil Disalin!</span>
              ) : (
                <span>Salin Tautan Privat (Buka Booking di Perangkat Lain)</span>
              )}
            </button>
          </div>

          {/* WhatsApp Direct Action */}
          <div className="pt-2">
            <a
              id="btn-send-whatsapp"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Kirim Konfirmasi ke WhatsApp Lapangan</span>
            </a>
            <p className="text-[11px] text-center text-slate-500 mt-1.5">
              Pesan terisi otomatis. Anda tetap dapat mengirimkan pesan sendiri.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
          >
            Selesai & Kembali ke Jadwal
          </button>
        </div>
      </div>
    </div>
  );
};
