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
 * Calculate price with proportional minutes and boundary splitting
 */
export function calculatePrice(
  dateStr: string,
  startTime: string,
  durationMinutes: number,
  settings: VenueSettings
): PriceCalculationResult {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const dayOfWeek = getDayOfWeek(dateStr);

  // Active special rules for this day
  const applicableRules = (settings.specialRates || []).filter(
    rule => rule.isActive && rule.days.includes(dayOfWeek)
  );

  // Find all boundary cut points in [startMins, endMins]
  const cutPoints = new Set<number>([startMins, endMins]);
  for (const rule of applicableRules) {
    const rStart = timeToMinutes(rule.startTime);
    const rEnd = timeToMinutes(rule.endTime);
    if (rStart > startMins && rStart < endMins) cutPoints.add(rStart);
    if (rEnd > startMins && rEnd < endMins) cutPoints.add(rEnd);
  }

  const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);
  const segments: PriceSegment[] = [];
  let totalPrice = 0;

  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const segStart = sortedCuts[i];
    const segEnd = sortedCuts[i + 1];
    const segDuration = segEnd - segStart;
    const midpoint = (segStart + segEnd) / 2;

    // Determine matching rate rule
    let activeRate = settings.baseHourlyRate;
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

    // Proportional formula: (duration in minutes * hourlyRate) / 60
    const segAmount = (segDuration * activeRate) / 60;
    totalPrice += segAmount;

    segments.push({
      fromTime: minutesToTime(segStart),
      toTime: minutesToTime(segEnd),
      durationMinutes: segDuration,
      hourlyRate: activeRate,
      amount: Math.round(segAmount),
      rateName,
    });
  }

  return {
    totalMinutes: durationMinutes,
    totalPrice: Math.round(totalPrice),
    segments,
    baseHourlyRate: settings.baseHourlyRate,
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
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  const openMins = timeToMinutes(settings.openTime);
  const closeMins = timeToMinutes(settings.closeTime);

  // 1. Operating hours
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
    const cStart = timeToMinutes(closure.startTime);
    const cEnd = timeToMinutes(closure.endTime);
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

    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);

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
