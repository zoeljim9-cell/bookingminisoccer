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

export async function testMySqlConnection(): Promise<{ connected: boolean; tablesReady?: boolean; message: string }> {
  const client = getPrismaClient();
  if (!client) {
    return {
      connected: false,
      tablesReady: false,
      message: 'DATABASE_URL belum dikonfigurasi di file environment (.env). Aplikasi menggunakan penyimpanan file lokal yang persisten.',
    };
  }

  try {
    await client.$queryRawUnsafe('SELECT 1');
    isConnected = true;

    // Verify whether all tables (VenueSetting, Booking, FieldClosure) exist and are readable
    try {
      await Promise.all([
        client.venueSetting.findFirst(),
        client.booking.findFirst(),
        client.fieldClosure.findFirst(),
      ]);
      return {
        connected: true,
        tablesReady: true,
        message: 'Terhubung ke database MySQL via Prisma & semua tabel (VenueSetting, Booking, FieldClosure) siap digunakan.',
      };
    } catch (tableErr: any) {
      if (
        tableErr.message?.toLowerCase().includes("doesn't exist") ||
        tableErr.message?.toLowerCase().includes('table') ||
        tableErr.message?.includes('P2021')
      ) {
        return {
          connected: true,
          tablesReady: false,
          message: 'Terhubung ke MySQL, tetapi beberapa tabel belum dibuat di database. Harap jalankan: npx prisma db push',
        };
      }
      return {
        connected: true,
        tablesReady: true,
        message: 'Terhubung ke database MySQL via Prisma.',
      };
    }
  } catch (err: any) {
    isConnected = false;
    return {
      connected: false,
      tablesReady: false,
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
      closedDays: dbSetting.closedDays
        ? (typeof dbSetting.closedDays === 'string' ? JSON.parse(dbSetting.closedDays) : dbSetting.closedDays)
        : fallback.closedDays,
      maxAdvanceDays: typeof dbSetting.maxAdvanceDays === 'number' ? dbSetting.maxAdvanceDays : (Number(dbSetting.maxAdvanceDays) || fallback.maxAdvanceDays),
      minDurationMinutes: typeof dbSetting.minDurationMinutes === 'number' ? dbSetting.minDurationMinutes : (Number(dbSetting.minDurationMinutes) || fallback.minDurationMinutes),
      allowedDurations: dbSetting.allowedDurations
        ? (typeof dbSetting.allowedDurations === 'string' ? JSON.parse(dbSetting.allowedDurations) : dbSetting.allowedDurations)
        : fallback.allowedDurations,
      bufferMinutes: typeof dbSetting.bufferMinutes === 'number' ? dbSetting.bufferMinutes : (Number(dbSetting.bufferMinutes) || fallback.bufferMinutes),
      baseHourlyRate: typeof dbSetting.baseHourlyRate === 'number' ? dbSetting.baseHourlyRate : (Number(dbSetting.baseHourlyRate) || fallback.baseHourlyRate),
      specialRates: dbSetting.specialRates
        ? (typeof dbSetting.specialRates === 'string' ? JSON.parse(dbSetting.specialRates) : dbSetting.specialRates)
        : fallback.specialRates,
      paymentTerms: dbSetting.paymentTerms ?? fallback.paymentTerms,
      cancellationPolicy: dbSetting.cancellationPolicy ?? fallback.cancellationPolicy,
    };
  } catch (e) {
    console.error('[Prisma] Error parsing DB settings JSON:', e);
    return fallback;
  }
}

// Convert VenueSettings to DB payload with strict type coercion for MySQL Prisma schema
export function mapSettingsToDb(settings: VenueSettings) {
  let closedDaysStr = '[]';
  if (Array.isArray(settings.closedDays)) {
    closedDaysStr = JSON.stringify(settings.closedDays);
  } else if (typeof settings.closedDays === 'string') {
    closedDaysStr = settings.closedDays;
  }

  let allowedDurationsStr = '[60,90,120,180]';
  if (Array.isArray(settings.allowedDurations)) {
    allowedDurationsStr = JSON.stringify(settings.allowedDurations);
  } else if (typeof settings.allowedDurations === 'string') {
    allowedDurationsStr = settings.allowedDurations;
  }

  let specialRatesStr = '[]';
  if (Array.isArray(settings.specialRates)) {
    specialRatesStr = JSON.stringify(settings.specialRates);
  } else if (typeof settings.specialRates === 'string') {
    specialRatesStr = settings.specialRates;
  }

  return {
    name: String(settings.name || 'MiniSoccer Arena'),
    address: String(settings.address || ''),
    gmapsUrl: String(settings.gmapsUrl || ''),
    ownerWhatsapp: String(settings.ownerWhatsapp || ''),
    ownerPin: '1234',
    openTime: String(settings.openTime || '07:00'),
    closeTime: String(settings.closeTime || '23:00'),
    closedDays: closedDaysStr,
    maxAdvanceDays: Math.round(Number(settings.maxAdvanceDays)) || 30,
    minDurationMinutes: Math.round(Number(settings.minDurationMinutes)) || 60,
    allowedDurations: allowedDurationsStr,
    bufferMinutes: Math.round(Number(settings.bufferMinutes)) || 0,
    baseHourlyRate: Math.round(Number(settings.baseHourlyRate)) || 300000,
    specialRates: specialRatesStr,
    paymentTerms: String(settings.paymentTerms || ''),
    cancellationPolicy: String(settings.cancellationPolicy || ''),
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
