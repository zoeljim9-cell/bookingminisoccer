import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Info,
  Calendar,
  X,
} from 'lucide-react';
import { AvailableRange, Booking, PublicScheduleResponse, VenueSettings } from './types';
import {
  calculatePrice,
  checkCollision,
  formatDuration,
  formatIndonesianDate,
  formatRupiah,
  getJakartaDateString,
  minutesToTime,
  timeToMinutes,
} from './utils/timeUtils';
import { fetchPrivateBooking, fetchPublicSchedule, fetchVenueInfo } from './api';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { DatePicker } from './components/DatePicker';
import { ScheduleTimeline } from './components/ScheduleTimeline';
import { TimeDurationPicker } from './components/TimeDurationPicker';
import { StickySummaryBar } from './components/StickySummaryBar';
import { DesktopBookingSummary } from './components/DesktopBookingSummary';
import { CustomerBookingModal } from './components/CustomerBookingModal';
import { BookingSuccessModal } from './components/BookingSuccessModal';
import { LookupBookingModal } from './components/LookupBookingModal';
import { OwnerPanel } from './components/OwnerPanel';

export default function App() {
  // Current route state: '/' for customer booking, '/owner' for owner operations page
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    return p === '/owner' ? '/owner' : '/';
  });

  // Listen to browser popstate (back/forward) and route changes
  useEffect(() => {
    const handleLocationChange = () => {
      const p = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      setCurrentPath(p === '/owner' ? '/owner' : '/');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    const p = path.toLowerCase().replace(/\/+$/, '');
    setCurrentPath(p === '/owner' ? '/owner' : '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Venue Settings & Public Schedule
  const [venue, setVenue] = useState<VenueSettings | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getJakartaDateString());
  const [scheduleData, setScheduleData] = useState<PublicScheduleResponse | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Time & Duration Selection
  const [startTime, setStartTime] = useState<string>('16:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(90);

  // Customer Contact Draft (persisted during session so not lost if collision occurs)
  const [contactDraft, setContactDraft] = useState({
    name: '',
    whatsapp: '',
    teamName: '',
    notes: '',
  });

  // Modal States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);
  const [successBookingData, setSuccessBookingData] = useState<{ booking: Booking; secretToken: string } | null>(null);
  const [privateViewingBooking, setPrivateViewingBooking] = useState<Booking | null>(null);

  // Load venue info
  useEffect(() => {
    fetchVenueInfo()
      .then((v) => {
        setVenue(v);
        if (v.minDurationMinutes) {
          setDurationMinutes((prev) => Math.max(prev, v.minDurationMinutes));
        }
      })
      .catch((err) => console.error('Failed to fetch venue info:', err));

    // Check for private view token in URL query
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      fetchPrivateBooking(token)
        .then((b) => setPrivateViewingBooking(b))
        .catch((err) => console.warn('Invalid private token:', err));
    }
  }, []);

  // Load public schedule for selectedDate
  const loadSchedule = useCallback(async (dateStr: string) => {
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const data = await fetchPublicSchedule(dateStr);
      setScheduleData(data);
    } catch (err: any) {
      setScheduleError(err.message || 'Gagal memuat ketersediaan lapangan');
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule(selectedDate);
  }, [selectedDate, loadSchedule]);

  // Calculate active end time
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const endTime = minutesToTime(endMins);

  // Calculate live price
  const priceResult = useMemo(() => {
    if (!venue) {
      return { totalMinutes: durationMinutes, totalPrice: (durationMinutes * 300000) / 60, segments: [], baseHourlyRate: 300000 };
    }
    return calculatePrice(selectedDate, startTime, durationMinutes, venue);
  }, [selectedDate, startTime, durationMinutes, venue]);

  // Collision check against current public schedule slots
  const collisionState = useMemo(() => {
    if (!venue || !scheduleData) return { hasCollision: false };

    const openMins = timeToMinutes(venue.openTime || '07:00');
    const closeMins = timeToMinutes(venue.closeTime || '23:00');

    if (startMins < openMins) {
      return {
        hasCollision: true,
        reason: `Waktu mulai (${startTime}) sebelum jam buka operasional (${venue.openTime}).`,
      };
    }
    if (endMins > closeMins) {
      return {
        hasCollision: true,
        reason: `Waktu selesai (${endTime}) melewati jam tutup lapangan (${venue.closeTime}).`,
      };
    }

    // Check against occupied slots
    for (const slot of scheduleData.slots) {
      if (slot.status === 'available') continue;
      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime);

      if (startMins < sEnd && endMins > sStart) {
        return {
          hasCollision: true,
          reason: `Rentang waktu beririsan dengan jadwal "${slot.label}" (${slot.startTime}–${slot.endTime}).`,
        };
      }
    }

    return { hasCollision: false };
  }, [venue, scheduleData, startMins, endMins, startTime, endTime]);

  // When user taps a free range card on the timeline
  const handleSelectFreeRange = (range: AvailableRange) => {
    setStartTime(range.startTime);
    // If range is shorter than current duration, adapt duration
    if (range.durationMinutes < durationMinutes) {
      setDurationMinutes(range.durationMinutes);
    }

    // Smooth scroll ke section atur durasi dan jam
    requestAnimationFrame(() => {
      const pickerEl = document.getElementById('time-duration-picker');
      if (pickerEl) {
        pickerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pickerEl.classList.add('ring-2', 'ring-emerald-700', 'border-emerald-700');
        setTimeout(() => {
          pickerEl.classList.remove('ring-2', 'ring-emerald-700', 'border-emerald-700');
        }, 1200);
      }
    });
  };

  const handleScrollToBooking = () => {
    const el = document.getElementById('booking-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleUpdateContactDraft = (updates: Partial<typeof contactDraft>) => {
    setContactDraft((prev) => ({ ...prev, ...updates }));
  };

  // If current URL is /owner, render the OwnerPanel as a dedicated full-page screen
  if (currentPath === '/owner') {
    return (
      <OwnerPanel
        onBackToCustomer={() => navigateTo('/')}
        onScheduleUpdated={() => loadSchedule(selectedDate)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-stone-900 pb-32 sm:pb-36 pb-[max(8rem,calc(7rem+env(safe-area-inset-bottom)))] font-sans flex flex-col">
      {/* 1. Header with branding, check booking, and owner login */}
      <Header
        venue={venue}
        onOpenLookup={() => setIsLookupModalOpen(true)}
        onScrollToBooking={handleScrollToBooking}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4 sm:space-y-6">
        {/* 2. Hero Section with Venue Aesthetics & Quick Specs */}
        <HeroSection venue={venue} onScrollToBooking={handleScrollToBooking} />

        {/* 3. Main Booking Area: Two-Column Grid on Desktop, Single Column on Mobile */}
        <div id="booking-section" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
          {/* Left Column (Primary booking steps: Date, Timeline, Duration) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Step A: Date Picker */}
            <DatePicker
              selectedDate={selectedDate}
              onSelectDate={(newDate) => setSelectedDate(newDate)}
              maxAdvanceDays={venue?.maxAdvanceDays || 30}
            />

            {/* Step B: Daily Timeline & Availability Display */}
            {loadingSchedule ? (
              <div className="bg-white rounded-2xl border border-stone-200/90 p-10 text-center shadow-xs">
                <RefreshCw className="w-6 h-6 text-emerald-800 animate-spin mx-auto mb-2.5" />
                <div className="text-xs font-bold text-stone-700">Memeriksa ketersediaan lapangan...</div>
              </div>
            ) : scheduleError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-xs text-rose-900">
                <AlertCircle className="w-6 h-6 text-rose-600 mx-auto mb-2" />
                <div className="font-bold text-sm mb-1">Gagal Memuat Jadwal</div>
                <div>{scheduleError}</div>
                <button
                  type="button"
                  onClick={() => loadSchedule(selectedDate)}
                  className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            ) : scheduleData ? (
              <ScheduleTimeline
                slots={scheduleData.slots}
                freeRanges={scheduleData.freeRanges}
                isFull={scheduleData.isFull}
                nearestAvailableDates={scheduleData.nearestAvailableDates}
                selectedStartTime={startTime}
                selectedEndTime={endTime}
                onSelectRange={handleSelectFreeRange}
                onSelectDate={(d) => setSelectedDate(d)}
              />
            ) : null}

            {/* Step C: Flexible Start Time & Duration Picker */}
            {venue && (
              <TimeDurationPicker
                date={selectedDate}
                startTime={startTime}
                durationMinutes={durationMinutes}
                settings={venue}
                collisionReason={collisionState.reason}
                onTimeChange={(newStart) => setStartTime(newStart)}
                onDurationChange={(newDur) => setDurationMinutes(newDur)}
              />
            )}
          </div>

          {/* Right Column (Desktop sticky summary card with immediate booking trigger) */}
          <div className="hidden lg:block lg:col-span-4">
            <DesktopBookingSummary
              venue={venue}
              date={selectedDate}
              startTime={startTime}
              durationMinutes={durationMinutes}
              totalPrice={priceResult.totalPrice}
              hasCollision={collisionState.hasCollision}
              collisionReason={collisionState.reason}
              onProceed={() => setIsBookingModalOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* 4. Mobile Sticky Summary Bar */}
      <StickySummaryBar
        startTime={startTime}
        durationMinutes={durationMinutes}
        totalPrice={priceResult.totalPrice}
        hasCollision={collisionState.hasCollision}
        onProceed={() => setIsBookingModalOpen(true)}
      />

      {/* 5. Customer 3-Step Booking Wizard Modal */}
      {venue && (
        <CustomerBookingModal
          isOpen={isBookingModalOpen}
          date={selectedDate}
          startTime={startTime}
          durationMinutes={durationMinutes}
          settings={venue}
          contactDraft={contactDraft}
          onUpdateContactDraft={handleUpdateContactDraft}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={(newBooking, secretToken) => {
            setIsBookingModalOpen(false);
            setSuccessBookingData({ booking: newBooking, secretToken });
            loadSchedule(selectedDate);
          }}
          onGoBackToSchedule={() => setIsBookingModalOpen(false)}
        />
      )}

      {/* 6. Booking Success Screen */}
      {successBookingData && venue && (
        <BookingSuccessModal
          booking={successBookingData.booking}
          secretToken={successBookingData.secretToken}
          settings={venue}
          onClose={() => setSuccessBookingData(null)}
        />
      )}

      {/* 7. Cek Booking Modal */}
      {venue && (
        <LookupBookingModal
          isOpen={isLookupModalOpen}
          settings={venue}
          onClose={() => setIsLookupModalOpen(false)}
        />
      )}

      {/* 8. Private Booking Viewer Modal (When opened with ?token=...) */}
      {privateViewingBooking && venue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-900 text-base">Detail Booking Privat</h3>
              <button
                type="button"
                onClick={() => setPrivateViewingBooking(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-2 text-xs text-stone-700">
              <div className="text-sm font-black text-stone-900">
                Kode: {privateViewingBooking.bookingCode}
              </div>
              <div>Tanggal: {formatIndonesianDate(privateViewingBooking.date)}</div>
              <div>
                Waktu: {privateViewingBooking.startTime} – {privateViewingBooking.endTime} WIB
              </div>
              <div>Pemesan: {privateViewingBooking.customerName}</div>
              <div>WhatsApp: {privateViewingBooking.customerWhatsapp}</div>
              <div>Total Biaya: {formatRupiah(privateViewingBooking.totalPrice)}</div>
              <div>Status: {privateViewingBooking.bookingStatus}</div>
            </div>
            <button
              type="button"
              onClick={() => setPrivateViewingBooking(null)}
              className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
