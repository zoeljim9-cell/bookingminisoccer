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
  closeTime: string; // "23:00"
  closedDays: number[]; // e.g. []
  maxAdvanceDays: number; // e.g. 30
  minDurationMinutes: number; // e.g. 60
  allowedDurations: number[]; // e.g. [60, 90, 120, 180]
  bufferMinutes: number; // Jeda antarsewa (default 0)
  baseHourlyRate: number; // default 300000
  specialRates: SpecialRateRule[];
  paymentTerms: string;
  cancellationPolicy: string;
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
  slots: PublicSlot[];
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
}

export interface OwnerStats {
  todayBookingsCount: number;
  todayTotalHours: number;
  unpaidCount: number;
  unpaidTotalAmount: number;
}
