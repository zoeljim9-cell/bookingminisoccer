import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Phone,
  Shield,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Booking, PriceCalculationResult, VenueSettings } from '../types';
import { calculatePrice, formatDuration, formatIndonesianDate, formatRupiah, minutesToTime, timeToMinutes } from '../utils/timeUtils';
import { submitCustomerBooking } from '../api';

interface CustomerBookingModalProps {
  isOpen: boolean;
  date: string;
  startTime: string;
  durationMinutes: number;
  settings: VenueSettings;
  contactDraft: {
    name: string;
    whatsapp: string;
    teamName: string;
    notes: string;
  };
  onUpdateContactDraft: (updates: Partial<{ name: string; whatsapp: string; teamName: string; notes: string }>) => void;
  onClose: () => void;
  onSuccess: (booking: Booking, secretToken: string) => void;
  onGoBackToSchedule: () => void;
}

export const CustomerBookingModal: React.FC<CustomerBookingModalProps> = ({
  isOpen,
  date,
  startTime,
  durationMinutes,
  settings,
  contactDraft,
  onUpdateContactDraft,
  onClose,
  onSuccess,
  onGoBackToSchedule,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);

  const priceResult: PriceCalculationResult = calculatePrice(date, startTime, durationMinutes, settings);

  // Input validations for Step 2
  const validateContact = (): boolean => {
    setErrorMessage(null);
    if (!contactDraft.name.trim()) {
      setErrorMessage('Mohon masukkan nama lengkap Anda.');
      return false;
    }
    const cleanPhone = contactDraft.whatsapp.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 15) {
      setErrorMessage('Mohon masukkan nomor WhatsApp yang aktif dan valid (minimal 10 digit).');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (validateContact()) {
        setStep(3);
      }
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitCustomerBooking({
        date,
        startTime,
        durationMinutes,
        customerName: contactDraft.name,
        customerWhatsapp: contactDraft.whatsapp,
        teamName: contactDraft.teamName,
        notes: contactDraft.notes,
      });

      onSuccess(res.booking, res.secretToken);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Terjadi kendala saat konfirmasi booking. Jadwal mungkin baru saja diambil oleh pelanggan lain.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4" id="customer-booking-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 -mb-1" />

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Langkah {step} dari 3
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Booking Cepat</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
              {step === 1 && 'Pilih & Tinjau Jadwal'}
              {step === 2 && 'Isi Informasi Kontak'}
              {step === 3 && 'Periksa & Konfirmasi'}
            </h2>
          </div>

          <button
            id="btn-close-booking-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold mb-0.5">Perhatian</div>
                <div>{errorMessage}</div>
                {step === 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      onGoBackToSchedule();
                    }}
                    className="mt-2 text-rose-900 font-bold underline cursor-pointer"
                  >
                    Kembali pilih waktu lain
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Jadwal Recap */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Jadwal yang Dipilih</span>
                </div>
                <div className="text-base sm:text-lg font-extrabold text-slate-900">
                  {formatIndonesianDate(date)}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-medium text-slate-600">Jam Main:</span>
                  <span className="font-black text-slate-900 text-base">
                    {startTime} – {endTime} WIB
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">Durasi:</span>
                  <span className="font-bold text-emerald-800">
                    {formatDuration(durationMinutes)}
                  </span>
                </div>
              </div>

              {/* Rate Breakdown */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                <div className="text-xs font-bold text-slate-700">Rincian Perhitungan Biaya:</div>
                <div className="space-y-1.5 text-xs">
                  {priceResult.segments.map((seg, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-600">
                      <span>
                        {seg.fromTime}–{seg.toTime} ({formatDuration(seg.durationMinutes)}) @{' '}
                        {formatRupiah(seg.hourlyRate)}/jam
                      </span>
                      <span className="font-bold text-slate-800">{formatRupiah(seg.amount)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">Total Biaya:</span>
                  <span className="font-black text-emerald-700 text-lg">
                    {formatRupiah(priceResult.totalPrice)}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Info Ketersediaan:</span> Memilih waktu pada layar ini{' '}
                  <strong>belum mengunci jadwal</strong>. Ketersediaan dipastikan saat Anda menyelesaikan konfirmasi di langkah terakhir.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Kontak */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nama Pemesan <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    id="input-customer-name"
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={contactDraft.name}
                    onChange={(e) => onUpdateContactDraft({ name: e.target.value })}
                    className="w-full pl-9 pr-3 py-3 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nomor WhatsApp <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    id="input-customer-whatsapp"
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={contactDraft.whatsapp}
                    onChange={(e) => onUpdateContactDraft({ whatsapp: e.target.value })}
                    className="w-full pl-9 pr-3 py-3 sm:py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Nomor ini digunakan untuk verifikasi dan cek status booking.
                </p>
              </div>

              {/* Optional Collapsible Section */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  id="btn-toggle-optional-fields"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 py-2 hover:text-emerald-700 cursor-pointer min-h-[40px]"
                >
                  <span>Informasi Tambahan (Opsional)</span>
                  {showOptionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showOptionalFields && (
                  <div className="space-y-3 mt-2 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Nama Tim / Klub
                      </label>
                      <input
                        id="input-team-name"
                        type="text"
                        placeholder="Contoh: Garuda Muda FC"
                        value={contactDraft.teamName}
                        onChange={(e) => onUpdateContactDraft({ teamName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Catatan Khusus
                      </label>
                      <textarea
                        id="input-customer-notes"
                        rows={2}
                        placeholder="Contoh: Tolong siapkan rompi 2 warna dan bola 2 pcs"
                        value={contactDraft.notes}
                        onChange={(e) => onUpdateContactDraft({ notes: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Periksa & Konfirmasi */}
          {step === 3 && (
            <div className="space-y-3.5">
              {/* Comprehensive Summary Card */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                  <span>RINGKASAN PESANAN</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]">
                    1 Lapangan
                  </span>
                </div>

                <div className="text-base font-extrabold text-slate-900">
                  {formatIndonesianDate(date)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-100">
                  <div>
                    <span className="text-slate-500 block">Waktu Sewa:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {startTime} – {endTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Durasi:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatDuration(durationMinutes)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nama Pemesan:</span>
                    <span className="font-bold text-slate-800">{contactDraft.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">WhatsApp:</span>
                    <span className="font-bold text-slate-800">{contactDraft.whatsapp}</span>
                  </div>
                  {contactDraft.teamName && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Tim:</span>
                      <span className="font-bold text-slate-800">{contactDraft.teamName}</span>
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown */}
                <div className="pt-2 border-t border-emerald-200 space-y-1 text-xs">
                  {priceResult.segments.map((seg, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>
                        {seg.fromTime}–{seg.toTime} ({formatDuration(seg.durationMinutes)})
                      </span>
                      <span className="font-semibold text-slate-800">{formatRupiah(seg.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-black text-emerald-950 pt-1 border-t border-emerald-200">
                    <span>Total Pembayaran:</span>
                    <span className="text-base text-emerald-700">{formatRupiah(priceResult.totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Cancellation Policy */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Metode Pembayaran & Ketentuan</span>
                </div>
                <p>
                  <strong>Metode:</strong> {settings.paymentTerms}
                </p>
                <p>
                  <strong>Ketentuan Pembatalan:</strong> {settings.cancellationPolicy}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2.5 sm:gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step > 1 ? (
            <button
              id="btn-modal-back"
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1 px-3.5 sm:px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 cursor-pointer min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
          ) : (
            <button
              id="btn-modal-cancel"
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2.5 text-slate-600 font-semibold text-xs sm:text-sm hover:bg-slate-100 rounded-xl cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
          )}

          {step < 3 ? (
            <button
              id="btn-modal-next"
              type="button"
              onClick={handleNextStep}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer min-h-[44px]"
            >
              <span>Lanjutkan</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="btn-confirm-booking"
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-base shadow-md transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="truncate">Konfirmasi • {formatRupiah(priceResult.totalPrice)}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
