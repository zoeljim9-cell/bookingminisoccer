import { VenueSettings, PriceCalculationResult, PriceSegment, PublicSlot, AvailableRange, Booking, FieldClosure } from '../types';

export const JAKARTA_TZ = 'Asia/Jakarta';

/**
 * Returns YYYY-MM-DD in Asia/Jakarta timezone
 */
export function getJakartaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Get current hour and minute in Asia/Jakarta
 */
export function getJakartaCurrentMinutes(): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

/**
 * Convert "HH:mm" to minutes from 00:00
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Sort slot sessions chronologically according to arena business day opening time
 * (e.g. 07:00, 08:00 ... 22:00, 00:00, 01:00)
 */
export function sortSlotSessions<T extends { startTime: string; durationMinutes?: number }>(
  sessions: T[],
  openTime: string = '07:00'
): T[] {
  const openMins = timeToMinutes(openTime || '07:00');
  return [...sessions].sort((a, b) => {
    let startA = timeToMinutes(a.startTime);
    let startB = timeToMinutes(b.startTime);

    if (startA < openMins) startA += 1440;
    if (startB < openMins) startB += 1440;

    if (startA !== startB) {
      return startA - startB;
    }
    return (a.durationMinutes || 0) - (b.durationMinutes || 0);
  });
}

/**
 * Convert minutes from 00:00 to "HH:mm"
 */
export function minutesToTime(totalMinutes: number): string {
  const bounded = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format currency to Rupiah (e.g. Rp300.000)
 */
export function formatRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `Rp${formatted}`;
}

/**
 * Format duration in minutes into friendly Indonesian text
 * e.g. 60 -> "1 jam", 90 -> "1 jam 30 menit", 120 -> "2 jam"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) {
    return `${h} jam ${m} menit`;
  }
  if (h > 0) {
    return `${h} jam`;
  }
  return `${m} menit`;
}

/**
 * Format date in Indonesian locale (e.g. "Senin, 21 September 2026")
 */
export function formatIndonesianDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Format date short (e.g. "Sen, 21 Sep")
 */
export function formatIndonesianDateShort(dateStr: string): { dayName: string; dateNum: string; monthName: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(d);
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(d);
  return { dayName, dateNum: String(day), monthName };
}

/**
 * Get Day of Week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) for YYYY-MM-DD
 */
export function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCDay();
}

/**
 * Check if a date falls on Weekend (Jumat, Sabtu, Minggu) or Weekday (Senin - Kamis)
 * According to FalseNine Mini Soccer pricelist:
 * Weekdays = Senin - Kamis
 * Weekend = Jumat - Minggu
 */
export function isWeekendDay(dateStr: string): boolean {
  const day = getDayOfWeek(dateStr);
  return day === 5 || day === 6 || day === 0; // Jumat = 5, Sabtu = 6, Minggu = 0
}

/**
 * Calculate price with support for Fixed Slot Sessions, photographer addon, and member discount
 */
export function calculatePrice(
  dateStr: string,
  startTime: string,
  durationMinutes: number,
  settings: VenueSettings,
  options?: {
    memberDiscountPercent?: number;
    photographerAddon?: 'none' | '1jam' | '2jam';
  }
): PriceCalculationResult {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const isWeekend = isWeekendDay(dateStr);
  const dayOfWeek = getDayOfWeek(dateStr);

  // Check if matches a configured Slot Session in VenueSettings
  const slotSessions = settings.slotSessions || [];
  const matchedSlot = slotSessions.find(s => {
    if (!s.isActive) return false;
    const sStart = timeToMinutes(s.startTime);
    // Match start time and duration
    return sStart === startMins && s.durationMinutes === durationMinutes;
  });

  let basePrice = 0;
  let segments: PriceSegment[] = [];

  if (matchedSlot) {
    basePrice = isWeekend ? matchedSlot.weekendPrice : matchedSlot.weekdayPrice;
    const hourlyEquivalent = Math.round((basePrice / matchedSlot.durationMinutes) * 60);
    segments.push({
      fromTime: matchedSlot.startTime,
      toTime: matchedSlot.endTime,
      durationMinutes: matchedSlot.durationMinutes,
      hourlyRate: hourlyEquivalent,
      amount: basePrice,
      rateName: `${matchedSlot.label || 'Sesi Lapangan'} (${isWeekend ? 'Weekend' : 'Weekdays'})`,
    });
  } else {
    // Fallback: rule-based or proportional calculation
    const applicableRules = (settings.specialRates || []).filter(
      rule => rule.isActive && rule.days.includes(dayOfWeek)
    );

    const cutPoints = new Set<number>([startMins, endMins]);
    for (const rule of applicableRules) {
      const rStart = timeToMinutes(rule.startTime);
      const rEnd = timeToMinutes(rule.endTime);
      if (rStart > startMins && rStart < endMins) cutPoints.add(rStart);
      if (rEnd > startMins && rEnd < endMins) cutPoints.add(rEnd);
    }

    const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);

    for (let i = 0; i < sortedCuts.length - 1; i++) {
      const segStart = sortedCuts[i];
      const segEnd = sortedCuts[i + 1];
      const segDuration = segEnd - segStart;
      const midpoint = (segStart + segEnd) / 2;

      let activeRate = settings.baseHourlyRate || 350000;
      let rateName = 'Tarif Dasar';

      for (const rule of applicableRules) {
        const rStart = timeToMinutes(rule.startTime);
        const rEnd = timeToMinutes(rule.endTime);
        if (midpoint >= rStart && midpoint < rEnd) {
          activeRate = rule.hourlyRate;
          rateName = rule.name;
          break;
        }
      }

      const segAmount = (segDuration * activeRate) / 60;
      basePrice += segAmount;

      segments.push({
        fromTime: minutesToTime(segStart),
        toTime: minutesToTime(segEnd),
        durationMinutes: segDuration,
        hourlyRate: activeRate,
        amount: Math.round(segAmount),
        rateName,
      });
    }
  }

  // Calculate Member Discount (if applicable)
  let discountAmount = 0;
  const discountPercent = options?.memberDiscountPercent || 0;
  if (discountPercent > 0 && discountPercent <= 100) {
    discountAmount = Math.round((basePrice * discountPercent) / 100);
  }

  // Calculate Photographer Addon
  let photographerPrice = 0;
  if (options?.photographerAddon === '1jam') {
    photographerPrice = 250000;
  } else if (options?.photographerAddon === '2jam') {
    photographerPrice = 350000;
  }

  const finalTotalPrice = Math.max(0, Math.round(basePrice - discountAmount + photographerPrice));

  return {
    totalMinutes: durationMinutes,
    totalPrice: finalTotalPrice,
    segments,
    baseHourlyRate: settings.baseHourlyRate,
    discountAmount,
    photographerPrice,
    matchedSlotSession: matchedSlot,
  };
}

/**
 * Collision check formula:
 * Returns null if no collision, or a string describing the collision
 */
export function checkCollision(
  dateStr: string,
  startTime: string,
  endTime: string,
  bookings: Booking[],
  closures: FieldClosure[],
  settings: VenueSettings,
  excludeBookingId?: string
): { hasCollision: boolean; reason?: string; conflictingBooking?: Booking; conflictingClosure?: FieldClosure } {
  let newStart = timeToMinutes(startTime);
  let newEnd = timeToMinutes(endTime);
  const openMins = timeToMinutes(settings.openTime || '07:00');
  let closeMins = timeToMinutes(settings.closeTime || '02:00');

  // Handle midnight / overnight closing (e.g. 00:00 -> 1440, 02:00 -> 1560)
  if (closeMins <= openMins || settings.closeTime === '00:00' || settings.closeTime === '24:00') {
    closeMins += 1440;
  }

  // If end time wrapped past midnight (e.g. 22:00 to 00:00 or 02:00)
  if (newEnd <= newStart && newEnd <= 360) {
    newEnd += 1440;
  } else if (endTime === '00:00' || endTime === '24:00') {
    newEnd = Math.max(newEnd, 1440);
  }

  // 1. If this exact slot matches an active slot session defined by owner, skip artificial boundary failure
  const isMatchingDefinedSession = (settings.slotSessions || []).some(
    (s) => s.isActive && s.startTime === startTime && (s.endTime === endTime || s.durationMinutes === (newEnd - newStart))
  );

  // 1. Operating hours
  if (!isMatchingDefinedSession) {
    if (newStart < openMins) {
      return {
        hasCollision: true,
        reason: `Waktu mulai (${startTime}) sebelum jam operasional (${settings.openTime}).`,
      };
    }
    if (newEnd > closeMins) {
      return {
        hasCollision: true,
        reason: `Waktu selesai (${endTime}) melewati jam tutup lapangan (${settings.closeTime}).`,
      };
    }
  }

  // 2. Closed days
  const dayOfWeek = getDayOfWeek(dateStr);
  if (settings.closedDays && settings.closedDays.includes(dayOfWeek)) {
    return {
      hasCollision: true,
      reason: `Lapangan tutup rutin pada hari ini.`,
    };
  }

  // 3. Past time check (for today in Jakarta)
  const todayJakarta = getJakartaDateString();
  if (dateStr < todayJakarta) {
    return {
      hasCollision: true,
      reason: `Tanggal pemesanan sudah lewat.`,
    };
  }
  if (dateStr === todayJakarta) {
    const currentMins = getJakartaCurrentMinutes();
    if (newStart < currentMins) {
      return {
        hasCollision: true,
        reason: `Waktu mulai (${startTime}) sudah terlewat (waktu sekarang: ${minutesToTime(currentMins)} WIB).`,
      };
    }
  }

  // 4. Closures check
  for (const closure of closures) {
    if (closure.date !== dateStr) continue;
    let cStart = timeToMinutes(closure.startTime);
    let cEnd = timeToMinutes(closure.endTime);
    if (cEnd <= cStart && cEnd <= 360) cEnd += 1440;

    // Overlap: newStart < cEnd && newEnd > cStart
    if (newStart < cEnd && newEnd > cStart) {
      return {
        hasCollision: true,
        reason: `Lapangan ditutup (${closure.startTime}–${closure.endTime}) untuk: ${closure.reason}.`,
        conflictingClosure: closure,
      };
    }
  }

  // 5. Active Bookings check with buffer
  const buffer = settings.bufferMinutes || 0;
  for (const b of bookings) {
    if (b.id === excludeBookingId) continue;
    if (b.date !== dateStr) continue;
    if (b.bookingStatus === 'cancelled') continue;

    let bStart = timeToMinutes(b.startTime);
    let bEnd = timeToMinutes(b.endTime);
    if (bEnd <= bStart && bEnd <= 360) bEnd += 1440;

    // Overlap rule with buffer:
    // Collision if newStart < (bEnd + buffer) AND newEnd > (bStart - buffer)
    if (newStart < (bEnd + buffer) && newEnd > (bStart - buffer)) {
      let detail = `Bertabrakan dengan jadwal terisi (${b.startTime}–${b.endTime}).`;
      if (buffer > 0) {
        if (newStart < bEnd + buffer && newStart >= bEnd) {
          detail = `Membutuhkan jeda antarsewa minimal ${buffer} menit setelah booking ${b.startTime}–${b.endTime} (paling cepat mulai ${minutesToTime(bEnd + buffer)}).`;
        } else if (newEnd > bStart - buffer && newEnd <= bStart) {
          detail = `Membutuhkan jeda antarsewa minimal ${buffer} menit sebelum booking ${b.startTime}–${b.endTime} (paling lambat selesai ${minutesToTime(bStart - buffer)}).`;
        }
      }
      return {
        hasCollision: true,
        reason: detail,
        conflictingBooking: b,
      };
    }
  }

  return { hasCollision: false };
}

/**
 * Generate public schedule timeline slots & free ranges for a given date
 */
export function generatePublicSchedule(
  dateStr: string,
  bookings: Booking[],
  closures: FieldClosure[],
  settings: VenueSettings
): { slots: PublicSlot[]; freeRanges: AvailableRange[]; isFull: boolean } {
  const openMins = timeToMinutes(settings.openTime);
  const closeMins = timeToMinutes(settings.closeTime);
  const buffer = settings.bufferMinutes || 0;
  const todayJakarta = getJakartaDateString();
  const currentMins = dateStr === todayJakarta ? getJakartaCurrentMinutes() : -1;

  // Collect all occupied intervals [start, end, type, reason]
  interface BusyInterval {
    start: number;
    end: number;
    type: 'booked' | 'closed' | 'past';
    label: string;
    reason?: string;
  }
  const busy: BusyInterval[] = [];

  // Active bookings on this date
  for (const b of bookings) {
    if (b.date === dateStr && b.bookingStatus !== 'cancelled') {
      busy.push({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
        type: 'booked',
        label: 'Terisi',
      });
    }
  }

  // Closures on this date
  for (const c of closures) {
    if (c.date === dateStr) {
      busy.push({
        start: timeToMinutes(c.startTime),
        end: timeToMinutes(c.endTime),
        type: 'closed',
        label: 'Ditutup',
        reason: c.reason,
      });
    }
  }

  // If today, mark past hours
  if (currentMins > openMins) {
    const pastEnd = Math.min(closeMins, currentMins);
    busy.push({
      start: openMins,
      end: pastEnd,
      type: 'past',
      label: 'Sudah lewat',
    });
  }

  // Merge and sort busy intervals
  busy.sort((a, b) => a.start - b.start);

  // Build sequential slots covering openMins to closeMins
  const slots: PublicSlot[] = [];
  let pointer = openMins;

  for (const interval of busy) {
    const iStart = Math.max(openMins, interval.start);
    const iEnd = Math.min(closeMins, interval.end);
    if (iEnd <= pointer) continue;

    if (iStart > pointer) {
      // Free slot before this interval
      slots.push({
        startTime: minutesToTime(pointer),
        endTime: minutesToTime(iStart),
        status: 'available',
        label: 'Tersedia',
      });
    }

    // Busy slot
    slots.push({
      startTime: minutesToTime(iStart),
      endTime: minutesToTime(iEnd),
      status: interval.type,
      label: interval.label,
      reason: interval.reason,
    });

    pointer = iEnd;
  }

  if (pointer < closeMins) {
    slots.push({
      startTime: minutesToTime(pointer),
      endTime: minutesToTime(closeMins),
      status: 'available',
      label: 'Tersedia',
    });
  }

  // Calculate free ranges accounting for buffer
  // A customer booking needs at least minDurationMinutes
  const minDuration = settings.minDurationMinutes || 60;
  const freeRanges: AvailableRange[] = [];

  for (const slot of slots) {
    if (slot.status === 'available') {
      const sMins = timeToMinutes(slot.startTime);
      const eMins = timeToMinutes(slot.endTime);
      const span = eMins - sMins;
      if (span >= minDuration) {
        freeRanges.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMinutes: span,
        });
      }
    }
  }

  const isFull = freeRanges.length === 0;

  return { slots, freeRanges, isFull };
}

/**
 * Normalizes any Indonesian WhatsApp/phone number into international format without '+' or '0' (e.g. 6281234567890)
 * Works with 0812..., +62812..., 62812..., 812..., with spaces or dashes.
 */
export function normalizeWhatsappNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

/**
 * Format phone for display (e.g. +62 812-3456-7890)
 */
export function formatPhoneDisplay(rawPhone: string): string {
  const norm = normalizeWhatsappNumber(rawPhone);
  if (!norm) return rawPhone || '-';
  if (norm.startsWith('62') && norm.length >= 9) {
    const prefix = '+62';
    const rest = norm.slice(2);
    if (rest.length <= 4) return `${prefix} ${rest}`;
    if (rest.length <= 8) return `${prefix} ${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `${prefix} ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
  }
  return rawPhone;
}
