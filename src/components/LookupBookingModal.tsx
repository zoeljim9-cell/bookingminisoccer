import React, { useState } from 'react';
import { Search, X, AlertCircle, CheckCircle, Clock, Calendar, MessageSquare, Copy, Check } from 'lucide-react';
import { Booking, VenueSettings } from '../types';
import { formatDuration, formatIndonesianDate, formatRupiah } from '../utils/timeUtils';
import { lookupBooking } from '../api';

interface LookupBookingModalProps {
  isOpen: boolean;
  settings: VenueSettings;
  onClose: () => void;
}

export const LookupBookingModal: React.FC<LookupBookingModalProps> = ({
  isOpen,
  settings,
  onClose,
}) => {
  const [bookingCode, setBookingCode] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundBooking, setFoundBooking] = useState<Booking | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCode.trim() || !whatsappNumber.trim()) {
      setError('Mohon masukkan Kode Booking dan Nomor WhatsApp.');
      return;
    }

    setLoading(true);
    setError(null);
    setFoundBooking(null);

    try {
      const b = await lookupBooking(bookingCode.trim(), whatsappNumber.trim());
      setFoundBooking(b);
    } catch (err: any) {
      setError(err.message || 'Booking tidak ditemukan. Periksa kembali kode dan nomor WhatsApp Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!foundBooking) return;
    const text = `Kode Booking: ${foundBooking.bookingCode}\nTanggal: ${foundBooking.date}\nWaktu: ${foundBooking.startTime} - ${foundBooking.endTime}\nTotal: ${formatRupiah(foundBooking.totalPrice)}\nStatus: ${foundBooking.bookingStatus}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-xs p-0 sm:p-4" id="lookup-booking-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-150 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-stone-300 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-lime-400 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">Cek Status Booking</h3>
          </div>
          <button
            type="button"
            id="btn-close-lookup"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!foundBooking ? (
          <form onSubmit={handleSearch} className="py-4 space-y-3.5">
            <p className="text-xs text-stone-500 leading-relaxed">
              Demi keamanan privasi, pencarian memerlukan kombinasi <strong>Kode Booking</strong> dan <strong>Nomor WhatsApp</strong> yang didaftarkan.
            </p>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="input-lookup-code" className="block text-xs font-bold text-stone-800 mb-1">
                Kode Booking
              </label>
              <input
                id="input-lookup-code"
                type="text"
                placeholder="Contoh: MS-2609-A101"
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-bold text-stone-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                required
              />
            </div>

            <div>
              <label htmlFor="input-lookup-phone" className="block text-xs font-bold text-stone-800 mb-1">
                Nomor WhatsApp
              </label>
              <input
                id="input-lookup-phone"
                type="tel"
                placeholder="Contoh: 081234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                required
              />
            </div>

            <button
              id="btn-submit-lookup"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 mt-2 border border-emerald-900"
            >
              {loading ? (
                <span>Mencari Jadwal...</span>
              ) : (
                <>
                  <Search className="w-4 h-4 text-lime-400" />
                  <span>Cari Booking Saya</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="py-4 space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <span className="font-black text-emerald-950 text-sm tracking-wider">{foundBooking.bookingCode}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    foundBooking.bookingStatus === 'confirmed'
                      ? 'bg-emerald-200 text-emerald-900'
                      : foundBooking.bookingStatus === 'cancelled'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {foundBooking.bookingStatus === 'confirmed'
                    ? 'Terkonfirmasi'
                    : foundBooking.bookingStatus === 'cancelled'
                    ? 'Dibatalkan'
                    : 'Selesai'}
                </span>
              </div>

              <div className="space-y-1.5 text-stone-700 pt-1">
                <div>
                  <span className="text-stone-500">Tanggal:</span>{' '}
                  <strong className="text-stone-900">{formatIndonesianDate(foundBooking.date)}</strong>
                </div>
                <div>
                  <span className="text-stone-500">Waktu:</span>{' '}
                  <strong className="text-stone-900">
                    {foundBooking.startTime} – {foundBooking.endTime} WIB
                  </strong>{' '}
                  ({formatDuration(foundBooking.durationMinutes)})
                </div>
                <div>
                  <span className="text-stone-500">Nama:</span> <strong className="text-stone-900">{foundBooking.customerName}</strong>
                </div>
                {foundBooking.teamName && (
                  <div>
                    <span className="text-stone-500">Tim:</span> <strong className="text-stone-900">{foundBooking.teamName}</strong>
                  </div>
                )}
                <div>
                  <span className="text-stone-500">Total Biaya:</span>{' '}
                  <strong className="text-emerald-800 text-sm">{formatRupiah(foundBooking.totalPrice)}</strong>
                </div>
                <div>
                  <span className="text-stone-500">Pembayaran:</span>{' '}
                  <span
                    className={`inline-block font-semibold px-2 py-0.5 rounded text-[11px] ${
                      foundBooking.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {foundBooking.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                {foundBooking.cancellationReason && (
                  <div className="text-rose-700 text-[11px] bg-rose-50 p-2 rounded-lg border border-rose-200 mt-1">
                    Alasan batal: {foundBooking.cancellationReason}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Disalin' : 'Salin Info'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFoundBooking(null)}
                className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Cari Lain
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
