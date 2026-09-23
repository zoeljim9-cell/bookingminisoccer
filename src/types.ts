export interface SlotSessionConfig {
  id: string;
  startTime: string; // "07:00"
  endTime: string;   // "08:00"
  durationMinutes: number; // 60, 90, 120
  weekdayPrice: number; // e.g. 350000 (Senin - Kamis)
  weekendPrice: number; // e.g. 465000 (Jumat - Minggu & Libur)
  label?: string; // e.g. "Sesi Pagi", "Peak Malam (2 Jam)"
  isActive: boolean;
}

export interface SpecialRateRule {
  id: string;
  name: string;
  hourlyRate: number;
  days: number[]; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isActive: boolean;
}

export interface VenueSettings {
  name: string;
  address: string;
  gmapsUrl: string;
  ownerWhatsapp: string;
  openTime: string; // "07:00"
  closeTime: string; // "02:00"
  closedDays: number[]; // e.g. []
  maxAdvanceDays: number; // e.g. 30
  minDurationMinutes: number; // e.g. 60
  allowedDurations: number[]; // e.g. [60, 90, 120, 180]
  bufferMinutes: number; // Jeda antarsewa (default 0)
  baseHourlyRate: number; // default 350000
  specialRates: SpecialRateRule[];
  paymentTerms: string;
  cancellationPolicy: string;
  slotSessions?: SlotSessionConfig[];
}

export interface PriceSegment {
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  hourlyRate: number;
  amount: number;
  rateName: string;
}

export interface PriceCalculationResult {
  totalMinutes: number;
  totalPrice: number;
  segments: PriceSegment[];
  baseHourlyRate: number;
  discountAmount?: number;
  photographerPrice?: number;
  addonPrice?: number;
  matchedSlotSession?: SlotSessionConfig;
}

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid';
export type BookingSource = 'online' | 'phone' | 'whatsapp' | 'walk-in';

export interface Booking {
  id: string;
  bookingCode: string; // e.g. MS-260921-A7B8
  secretToken: string; // Private viewing token
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  customerName: string;
  customerWhatsapp: string;
  teamName?: string;
  notes?: string;
  bookingSource: BookingSource;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  priceBreakdown: PriceSegment[];
  totalPrice: number;
  discountAmount?: number;
  memberId?: string;
  memberCode?: string;
  photographerAddon?: 'none' | '1jam' | '2jam';
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
  isDemo?: boolean;
}

export interface FieldClosure {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  reason: string;
  createdAt: string;
  isDemo?: boolean;
}

export type SlotStatus = 'available' | 'booked' | 'closed' | 'past' | 'selected';

export interface PublicSlot {
  startTime: string;
  endTime: string;
  status: SlotStatus;
  label: string;
  reason?: string;
}

export interface PublicSlotSession extends SlotSessionConfig {
  status: SlotStatus; // 'available' | 'booked' | 'closed' | 'past' | 'selected'
  effectivePrice: number; // calculated according to date (weekday vs weekend)
  isWeekend: boolean;
  bookedBy?: string;
  reason?: string;
}

export interface AvailableRange {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface PublicScheduleResponse {
  date: string;
  venueName: string;
  openTime: string;
  closeTime: string;
  bufferMinutes: number;
  baseHourlyRate: number;
  isWeekend: boolean;
  dayName: string;
  slots: PublicSlot[];
  slotSessions: PublicSlotSession[];
  freeRanges: AvailableRange[];
  isFull: boolean;
  nearestAvailableDates?: string[];
}

export interface CustomerBookingInput {
  date: string;
  startTime: string;
  durationMinutes: number;
  customerName: string;
  customerWhatsapp: string;
  teamName?: string;
  notes?: string;
  idempotencyKey?: string;
  memberCode?: string;
  photographerAddon?: 'none' | '1jam' | '2jam';
}

export interface OwnerBookingInput {
  date: string;
  startTime: string;
  durationMinutes: number;
  customerName: string;
  customerWhatsapp: string;
  teamName?: string;
  notes?: string;
  bookingSource: BookingSource;
  paymentStatus: PaymentStatus;
  memberCode?: string;
  photographerAddon?: 'none' | '1jam' | '2jam';
  discountAmount?: number;
}

export interface OwnerStats {
  todayBookingsCount: number;
  todayTotalHours: number;
  unpaidCount: number;
  unpaidTotalAmount: number;
}

// Member System interfaces
export interface Member {
  id: string;
  memberCode: string;
  name: string;
  whatsapp: string;
  teamName?: string;
  tier: string; // "Regular" | "VIP" | "Komunitas"
  discountPercentage: number;
  status: 'active' | 'inactive';
  isActive?: boolean;
  notes?: string;
  totalBookings: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberInput {
  name: string;
  whatsapp: string;
  teamName?: string;
  tier?: string;
  discountPercentage?: number;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  notes?: string;
}

export interface MemberVerifyResult {
  valid: boolean;
  member?: {
    id: string;
    memberCode: string;
    name: string;
    whatsapp: string;
    teamName?: string;
    tier: string;
    discountPercentage: number;
  };
  message?: string;
}
