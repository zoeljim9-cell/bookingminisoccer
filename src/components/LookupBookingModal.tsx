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
      setError(err.message || 'Booking tidak ditemukan.');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4" id="lookup-booking-modal">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-150 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Cek Status Booking</h3>
          </div>
          <button
            type="button"
            id="btn-close-lookup"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!foundBooking ? (
          <form onSubmit={handleSearch} className="py-4 space-y-3.5">
            <p className="text-xs text-slate-500">
              Demi keamanan privasi, pencarian membutuhkan kombinasi <strong>Kode Booking</strong> dan <strong>Nomor WhatsApp</strong> yang digunakan saat mendaftar.
            </p>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kode Booking
              </label>
              <input
                id="input-lookup-code"
                type="text"
                placeholder="Contoh: MS-2609-A101"
                value={bookingCode}
                onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 uppercase focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Nomor WhatsApp
              </label>
              <input
                id="input-lookup-phone"
                type="tel"
                placeholder="Contoh: 081234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
              />
            </div>

            <button
              id="btn-submit-lookup"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Mencari...</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Cari Booking Saya</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="py-4 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-emerald-200">
                <span className="font-extrabold text-emerald-950 text-sm">{foundBooking.bookingCode}</span>
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

              <div className="space-y-1 text-slate-700">
                <div>
                  <span className="text-slate-500">Tanggal:</span>{' '}
                  <strong>{formatIndonesianDate(foundBooking.date)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Waktu:</span>{' '}
                  <strong className="text-slate-900">
                    {foundBooking.startTime} – {foundBooking.endTime} WIB
                  </strong>{' '}
                  ({formatDuration(foundBooking.durationMinutes)})
                </div>
                <div>
                  <span className="text-slate-500">Nama:</span> <strong>{foundBooking.customerName}</strong>
                </div>
                {foundBooking.teamName && (
                  <div>
                    <span className="text-slate-500">Tim:</span> <strong>{foundBooking.teamName}</strong>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Total Biaya:</span>{' '}
                  <strong className="text-emerald-800 text-sm">{formatRupiah(foundBooking.totalPrice)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Pembayaran:</span>{' '}
                  <span
                    className={`inline-block font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                      foundBooking.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {foundBooking.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                {foundBooking.cancellationReason && (
                  <div className="text-rose-700 text-[11px] bg-rose-50 p-2 rounded-lg border border-rose-200">
                    Alasan batal: {foundBooking.cancellationReason}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Disalin' : 'Salin Info'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFoundBooking(null)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
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
