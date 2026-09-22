import { PrismaClient } from '@prisma/client';
import { Booking, FieldClosure, VenueSettings } from '../src/types';

// Global reference for Prisma Client to prevent multiple instances during hot reloads
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let prismaClient: PrismaClient | null = null;
let isConnected = false;

export function getPrismaClient(): PrismaClient | null {
  if (prismaClient) return prismaClient;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === '') {
    return null;
  }

  try {
    prismaClient =
      globalForPrisma.prisma ||
      new PrismaClient({
        log: ['warn'],
      });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = prismaClient;
    }

    return prismaClient;
  } catch (err) {
    console.warn('[Prisma] Inisialisasi Prisma Client dilewati:', err);
    return null;
  }
}

export async function testMySqlConnection(): Promise<{ connected: boolean; message: string }> {
  const client = getPrismaClient();
  if (!client) {
    return {
      connected: false,
      message: 'DATABASE_URL belum dikonfigurasi di file environment (.env). Aplikasi menggunakan penyimpanan file lokal yang persisten.',
    };
  }

  try {
    await client.$queryRawUnsafe('SELECT 1');
    isConnected = true;
    return { connected: true, message: 'Terhubung ke database MySQL via Prisma.' };
  } catch (err: any) {
    isConnected = false;
    return {
      connected: false,
      message: `Gagal terhubung ke MySQL: ${err.message || 'Koneksi ditolak'}. Fallback ke penyimpanan lokal aktif.`,
    };
  }
}

export function isMySqlConnected(): boolean {
  return isConnected;
}

// Convert DB VenueSetting to VenueSettings type
export function mapDbToSettings(dbSetting: any, fallback: VenueSettings): VenueSettings {
  try {
    return {
      name: dbSetting.name || fallback.name,
      address: dbSetting.address || fallback.address,
      gmapsUrl: dbSetting.gmapsUrl || fallback.gmapsUrl,
      ownerWhatsapp: dbSetting.ownerWhatsapp || fallback.ownerWhatsapp,
      openTime: dbSetting.openTime || fallback.openTime,
      closeTime: dbSetting.closeTime || fallback.closeTime,
      closedDays: dbSetting.closedDays ? JSON.parse(dbSetting.closedDays) : fallback.closedDays,
      maxAdvanceDays: dbSetting.maxAdvanceDays ?? fallback.maxAdvanceDays,
      minDurationMinutes: dbSetting.minDurationMinutes ?? fallback.minDurationMinutes,
      allowedDurations: dbSetting.allowedDurations ? JSON.parse(dbSetting.allowedDurations) : fallback.allowedDurations,
      bufferMinutes: dbSetting.bufferMinutes ?? fallback.bufferMinutes,
      baseHourlyRate: dbSetting.baseHourlyRate ?? fallback.baseHourlyRate,
      specialRates: dbSetting.specialRates ? JSON.parse(dbSetting.specialRates) : fallback.specialRates,
      paymentTerms: dbSetting.paymentTerms || fallback.paymentTerms,
      cancellationPolicy: dbSetting.cancellationPolicy || fallback.cancellationPolicy,
    };
  } catch (e) {
    console.error('[Prisma] Error parsing DB settings JSON:', e);
    return fallback;
  }
}

// Convert VenueSettings to DB payload
export function mapSettingsToDb(settings: VenueSettings) {
  return {
    name: settings.name,
    address: settings.address,
    gmapsUrl: settings.gmapsUrl,
    ownerWhatsapp: settings.ownerWhatsapp,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    closedDays: JSON.stringify(settings.closedDays || []),
    maxAdvanceDays: settings.maxAdvanceDays,
    minDurationMinutes: settings.minDurationMinutes,
    allowedDurations: JSON.stringify(settings.allowedDurations || [60, 90, 120, 180]),
    bufferMinutes: settings.bufferMinutes,
    baseHourlyRate: settings.baseHourlyRate,
    specialRates: JSON.stringify(settings.specialRates || []),
    paymentTerms: settings.paymentTerms || '',
    cancellationPolicy: settings.cancellationPolicy || '',
  };
}

// Convert DB Booking to Booking type
export function mapDbToBooking(b: any): Booking {
  return {
    id: b.id,
    bookingCode: b.bookingCode,
    secretToken: b.secretToken,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: b.durationMinutes,
    customerName: b.customerName,
    customerWhatsapp: b.customerWhatsapp,
    teamName: b.teamName || undefined,
    notes: b.notes || undefined,
    bookingSource: b.bookingSource as any,
    bookingStatus: b.bookingStatus as any,
    paymentStatus: b.paymentStatus as any,
    priceBreakdown: b.priceBreakdown ? JSON.parse(b.priceBreakdown) : [],
    totalPrice: b.totalPrice,
    cancellationReason: b.cancellationReason || undefined,
    idempotencyKey: b.idempotencyKey || undefined,
    isDemo: Boolean(b.isDemo),
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
    updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : String(b.updatedAt),
  };
}

// Convert Booking to DB payload
export function mapBookingToDb(b: Booking) {
  return {
    id: b.id,
    bookingCode: b.bookingCode,
    secretToken: b.secretToken,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: b.durationMinutes,
    customerName: b.customerName,
    customerWhatsapp: b.customerWhatsapp,
    teamName: b.teamName || null,
    notes: b.notes || null,
    bookingSource: b.bookingSource || 'online',
    bookingStatus: b.bookingStatus || 'confirmed',
    paymentStatus: b.paymentStatus || 'unpaid',
    priceBreakdown: JSON.stringify(b.priceBreakdown || []),
    totalPrice: b.totalPrice,
    cancellationReason: b.cancellationReason || null,
    idempotencyKey: b.idempotencyKey || null,
    isDemo: Boolean(b.isDemo),
  };
}

// Convert DB FieldClosure to FieldClosure type
export function mapDbToClosure(c: any): FieldClosure {
  return {
    id: c.id,
    date: c.date,
    startTime: c.startTime,
    endTime: c.endTime,
    reason: c.reason,
    isDemo: Boolean(c.isDemo),
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  };
}
