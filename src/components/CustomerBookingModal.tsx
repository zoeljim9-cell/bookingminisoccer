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
  Loader2,
  Users,
  Camera,
  Award,
  Sparkles,
  Gift,
  Tag,
} from 'lucide-react';
import { Booking, PriceCalculationResult, VenueSettings } from '../types';
import {
  calculatePrice,
  formatDuration,
  formatIndonesianDate,
  formatRupiah,
  isWeekendDay,
  minutesToTime,
  timeToMinutes,
} from '../utils/timeUtils';
import { submitCustomerBooking, verifyMemberApi } from '../api';

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

  // FalseNine System: Member & Photographer Addon
  const [memberQuery, setMemberQuery] = useState('');
  const [verifiedMember, setVerifiedMember] = useState<{
    id: string;
    memberCode: string;
    name: string;
    tier: string;
    discountPercentage: number;
    teamName?: string;
  } | null>(null);
  const [memberMessage, setMemberMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isVerifyingMember, setIsVerifyingMember] = useState(false);
  const [photographerAddon, setPhotographerAddon] = useState<'none' | '1jam' | '2jam'>('none');

  if (!isOpen) return null;

  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);
  const isWeekend = isWeekendDay(date);

  // Match owner defined slot session
  const matchingSession = (settings.slotSessions || []).find(
    (s) => s.startTime === startTime && s.durationMinutes === durationMinutes
  );

  const priceResult: PriceCalculationResult = calculatePrice(
    date,
    startTime,
    durationMinutes,
    settings,
    {
      memberDiscountPercent: verifiedMember?.discountPercentage || 0,
      photographerAddon,
    }
  );

  const handleVerifyMember = async () => {
    if (!memberQuery.trim()) {
      setMemberMessage({ text: 'Masukkan kode member atau nomor WA terdaftar', isError: true });
      return;
    }

    setIsVerifyingMember(true);
    setMemberMessage(null);

    try {
      const res = await verifyMemberApi(memberQuery.trim());
      if (res.valid && res.member) {
        setVerifiedMember(res.member as any);
        setMemberMessage({ text: res.message || 'Member aktif!', isError: false });
        if (res.member.teamName && !contactDraft.teamName) {
          onUpdateContactDraft({ teamName: res.member.teamName });
        }
      } else {
        setVerifiedMember(null);
        setMemberMessage({ text: res.message || 'Member tidak ditemukan.', isError: true });
      }
    } catch (err: any) {
      setVerifiedMember(null);
      setMemberMessage({ text: err.message || 'Gagal memverifikasi member.', isError: true });
    } finally {
      setIsVerifyingMember(false);
    }
  };

  const handleRemoveMember = () => {
    setVerifiedMember(null);
    setMemberMessage(null);
    setMemberQuery('');
  };

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
        memberCode: verifiedMember?.memberCode,
        photographerAddon,
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/70 backdrop-blur-xs p-0 sm:p-4"
      id="customer-booking-modal"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1 bg-stone-300 rounded-full mx-auto mt-2.5 -mb-1" />

        {/* Header */}
        <div className="px-5 py-3.5 sm:py-4 border-b border-stone-200 flex items-center justify-between bg-stone-900 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-stone-950">
                Langkah {step} dari 3
              </span>
              <span className="text-xs text-stone-300 font-medium">{settings.name || 'Almansuri Arena'}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
              {step === 1 && 'Sesi Lapangan & Paket Tambahan'}
              {step === 2 && 'Informasi Kontak Pemesan'}
              {step === 3 && 'Periksa & Konfirmasi Booking'}
            </h2>
          </div>

          <button
            id="btn-close-booking-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="h-1.5 w-full bg-stone-200">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold mb-0.5">Pemberitahuan</div>
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
                    Kembali pilih jadwal lain
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Jadwal Recap + Member + Addon */}
          {step === 1 && (
            <div className="space-y-3.5">
              {/* Session Overview Card */}
              <div className="bg-emerald-950 text-white rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {matchingSession?.label || `Sesi ${startTime}–${endTime}`}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">
                      {isWeekend ? 'Tarif Weekend (Jum-Min)' : 'Tarif Weekday (Sen-Kam)'}
                    </span>
                  </div>
                </div>

                <div className="text-lg sm:text-xl font-black text-white">
                  {formatIndonesianDate(date)}
                </div>

                <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-emerald-800/60">
                  <div>
                    <div className="text-[11px] text-emerald-300 font-semibold">Jam Main Sesi:</div>
                    <div className="text-xl sm:text-2xl font-black text-amber-400">
                      {startTime} – {endTime} <span className="text-xs text-stone-300 font-normal">WIB</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-emerald-300 font-semibold">Durasi:</div>
                    <div className="text-sm sm:text-base font-bold text-white">
                      {formatDuration(durationMinutes)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Free Amenities Promo Banner if >= 2 Jam */}
              {durationMinutes >= 120 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <Gift className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-stone-800">
                    <span className="font-extrabold text-amber-800 block mb-0.5">
                      🎁 FREE FASILITAS BOOKING 2 JAM:
                    </span>
                    <span>Gratis Rompi Tim (2 Warna), Air Mineral Galon Dingin, dan Peluit Wasit pertandingan!</span>
                  </div>
                </div>
              )}

              {/* Member Code Verification Section */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                    <Award className="w-4 h-4 text-emerald-700" />
                    <span>Member & Komunitas {settings.name || 'Almansuri Arena'}</span>
                  </div>
                  {verifiedMember && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Terverifikasi Diskon {verifiedMember.discountPercentage}%
                    </span>
                  )}
                </div>

                {!verifiedMember ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        id="input-member-code"
                        type="text"
                        placeholder="Masukkan Kode Member / No. WA..."
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyMember();
                          }
                        }}
                        className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 uppercase"
                      />
                      <button
                        type="button"
                        id="btn-verify-member"
                        onClick={handleVerifyMember}
                        disabled={isVerifyingMember || !memberQuery.trim()}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer transition-colors disabled:opacity-50 min-h-[38px] flex items-center gap-1"
                      >
                        {isVerifyingMember ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Cek Member'
                        )}
                      </button>
                    </div>
                    {memberMessage && (
                      <p
                        className={`text-xs ${
                          memberMessage.isError ? 'text-rose-600' : 'text-emerald-700 font-semibold'
                        }`}
                      >
                        {memberMessage.text}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-900">
                        {verifiedMember.name} • {verifiedMember.memberCode}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Tier {verifiedMember.tier} • Diskon {verifiedMember.discountPercentage}% otomatis diterapkan
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveMember}
                      className="text-xs text-rose-700 hover:text-rose-900 font-semibold underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Photographer Addon Section */}
              <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                  <Camera className="w-4 h-4 text-emerald-800" />
                  <span>Jasa Dokumentasi Foto Lapangan</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  Fotografer profesional resmi lapangan untuk mengabadikan aksi tim & highlight pertandingan Anda.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <label
                    className={`border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                      photographerAddon === 'none'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-800">Tanpa Foto</span>
                      <input
                        type="radio"
                        name="photographerAddon"
                        checked={photographerAddon === 'none'}
                        onChange={() => setPhotographerAddon('none')}
                        className="accent-emerald-700"
                      />
                    </div>
                    <div className="text-xs font-semibold text-stone-500">Rp 0</div>
                  </label>

                  <label
                    className={`border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                      photographerAddon === '1jam'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-800">Foto 1 Jam</span>
                      <input
                        type="radio"
                        name="photographerAddon"
                        checked={photographerAddon === '1jam'}
                        onChange={() => setPhotographerAddon('1jam')}
                        className="accent-emerald-700"
                      />
                    </div>
                    <div className="text-xs font-bold text-emerald-800">+Rp 250.000</div>
                  </label>

                  <label
                    className={`border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                      photographerAddon === '2jam'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-800">Foto 2 Jam Full</span>
                      <input
                        type="radio"
                        name="photographerAddon"
                        checked={photographerAddon === '2jam'}
                        onChange={() => setPhotographerAddon('2jam')}
                        className="accent-emerald-700"
                      />
                    </div>
                    <div className="text-xs font-bold text-emerald-800">+Rp 350.000</div>
                  </label>
                </div>
              </div>

              {/* Price Calculation Summary Box */}
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-2">
                <div className="text-xs font-bold text-stone-800">Rincian Perhitungan Biaya:</div>
                <div className="space-y-1.5 text-xs">
                  {priceResult.segments.map((seg, idx) => (
                    <div key={idx} className="flex items-center justify-between text-stone-600">
                      <span>
                        {seg.fromTime}–{seg.toTime} ({formatDuration(seg.durationMinutes)})
                      </span>
                      <span className="font-bold text-stone-800">{formatRupiah(seg.amount)}</span>
                    </div>
                  ))}

                  {/* Addon row */}
                  {(priceResult.addonPrice || priceResult.photographerPrice) && (priceResult.addonPrice || priceResult.photographerPrice || 0) > 0 ? (
                    <div className="flex items-center justify-between text-emerald-800 font-medium">
                      <span>
                        {photographerAddon === '1jam'
                          ? 'Dokumentasi Foto Lapangan (1 Jam)'
                          : 'Dokumentasi Foto Lapangan (2 Jam Full)'}
                      </span>
                      <span className="font-bold">+{formatRupiah(priceResult.addonPrice || priceResult.photographerPrice || 0)}</span>
                    </div>
                  ) : null}

                  {/* Member discount row */}
                  {priceResult.discountAmount && priceResult.discountAmount > 0 ? (
                    <div className="flex items-center justify-between text-rose-700 font-semibold">
                      <span>Diskon Member ({verifiedMember?.discountPercentage || 0}%)</span>
                      <span>-{formatRupiah(priceResult.discountAmount)}</span>
                    </div>
                  ) : null}
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">Total Biaya:</span>
                  <span className="font-black text-emerald-900 text-xl">
                    {formatRupiah(priceResult.totalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Kontak */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nama Lengkap Pemesan <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="input-customer-name"
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={contactDraft.name}
                    onChange={(e) => onUpdateContactDraft({ name: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-stone-50/80 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nomor WhatsApp <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    id="input-customer-whatsapp"
                    type="tel"
                    placeholder="Contoh: 081234567890"
                    value={contactDraft.whatsapp}
                    onChange={(e) => onUpdateContactDraft({ whatsapp: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 bg-stone-50/80 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700 focus:bg-white"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Nomor WhatsApp digunakan untuk konfirmasi kedatangan dan pencarian kode booking di {settings.name || 'Almansuri Arena'}.
                </p>
              </div>

              {/* Optional Collapsible Section */}
              <div className="pt-2 border-t border-stone-200">
                <button
                  type="button"
                  id="btn-toggle-optional-fields"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-stone-700 py-2 hover:text-emerald-800 cursor-pointer min-h-[40px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span>Informasi Tim & Catatan Tambahan (Opsional)</span>
                  </span>
                  {showOptionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showOptionalFields && (
                  <div className="space-y-3 mt-2 pt-2 border-t border-stone-100">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Nama Tim / Komunitas
                      </label>
                      <input
                        id="input-team-name"
                        type="text"
                        placeholder={`Contoh: ${settings.name || 'Almansuri'} FC / Garuda Muda`}
                        value={contactDraft.teamName}
                        onChange={(e) => onUpdateContactDraft({ teamName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Catatan Khusus ke Lapangan
                      </label>
                      <textarea
                        id="input-customer-notes"
                        rows={2}
                        placeholder="Contoh: Mohon siapkan rompi hijau dan bola match ball"
                        value={contactDraft.notes}
                        onChange={(e) => onUpdateContactDraft({ notes: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
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
              <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span>RINGKASAN BOOKING RESMI</span>
                  <span className="bg-emerald-800 text-white px-2 py-0.5 rounded text-[10px]">
                    {settings.name || 'Almansuri Arena'}
                  </span>
                </div>

                <div className="text-base font-black text-stone-900">
                  {formatIndonesianDate(date)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-emerald-200">
                  <div>
                    <span className="text-stone-500 block">Waktu Sesi:</span>
                    <span className="font-extrabold text-stone-900 text-sm">
                      {startTime} – {endTime} WIB
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Durasi Sesi:</span>
                    <span className="font-bold text-stone-800 text-sm">
                      {formatDuration(durationMinutes)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Nama Pemesan:</span>
                    <span className="font-bold text-stone-800">{contactDraft.name}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">WhatsApp:</span>
                    <span className="font-bold text-stone-800">{contactDraft.whatsapp}</span>
                  </div>
                  {contactDraft.teamName && (
                    <div className="col-span-2">
                      <span className="text-stone-500 block">Tim / Komunitas:</span>
                      <span className="font-bold text-stone-800">{contactDraft.teamName}</span>
                    </div>
                  )}
                  {verifiedMember && (
                    <div className="col-span-2 text-emerald-800">
                      <span className="font-bold">Member Terdaftar:</span> {verifiedMember.name} ({verifiedMember.memberCode}) - Diskon {verifiedMember.discountPercentage}%
                    </div>
                  )}
                  {photographerAddon !== 'none' && (
                    <div className="col-span-2 text-stone-700">
                      <span className="font-bold">Addon Foto:</span>{' '}
                      {photographerAddon === '1jam' ? 'Dokumentasi Foto 1 Jam (+Rp 250.000)' : 'Dokumentasi Foto 2 Jam Full (+Rp 350.000)'}
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown */}
                <div className="pt-2 border-t border-emerald-200 space-y-1 text-xs">
                  {priceResult.segments.map((seg, i) => (
                    <div key={i} className="flex justify-between text-stone-600">
                      <span>
                        Sesi {seg.fromTime}–{seg.toTime} ({formatDuration(seg.durationMinutes)})
                      </span>
                      <span className="font-semibold text-stone-800">{formatRupiah(seg.amount)}</span>
                    </div>
                  ))}
                  {(priceResult.addonPrice || priceResult.photographerPrice) && (priceResult.addonPrice || priceResult.photographerPrice || 0) > 0 ? (
                    <div className="flex justify-between text-emerald-800 font-medium">
                      <span>Dokumentasi Foto</span>
                      <span className="font-bold">+{formatRupiah(priceResult.addonPrice || priceResult.photographerPrice || 0)}</span>
                    </div>
                  ) : null}
                  {priceResult.discountAmount && priceResult.discountAmount > 0 ? (
                    <div className="flex justify-between text-rose-700 font-semibold">
                      <span>Diskon Member</span>
                      <span>-{formatRupiah(priceResult.discountAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm font-black text-emerald-950 pt-1.5 border-t border-emerald-300">
                    <span>Total Pembayaran:</span>
                    <span className="text-lg text-emerald-900">{formatRupiah(priceResult.totalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Terms */}
              <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50 space-y-1.5 text-xs text-stone-600">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <Shield className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Ketentuan Pembayaran {settings.name || 'Almansuri Arena'}</span>
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
        <div className="p-3.5 sm:p-4 border-t border-stone-200 bg-white flex items-center justify-between gap-2.5 sm:gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {step > 1 ? (
            <button
              id="btn-modal-back"
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep((s) => (s - 1) as any)}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-semibold text-xs sm:text-sm hover:bg-stone-50 cursor-pointer min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
          ) : (
            <button
              id="btn-modal-cancel"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-600 font-semibold text-xs sm:text-sm hover:bg-stone-100 rounded-xl cursor-pointer min-h-[44px]"
            >
              Batal
            </button>
          )}

          {step < 3 ? (
            <button
              id="btn-modal-next"
              type="button"
              onClick={handleNextStep}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer min-h-[44px]"
            >
              <span>Lanjutkan</span>
              <ChevronRight className="w-4 h-4 text-emerald-300" />
            </button>
          ) : (
            <button
              id="btn-confirm-booking"
              type="button"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
              className="flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-black text-xs sm:text-base shadow-xs transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Booking...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 flex-shrink-0" />
                  <span className="truncate">Konfirmasi Booking • {formatRupiah(priceResult.totalPrice)}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
