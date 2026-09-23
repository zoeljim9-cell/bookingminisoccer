import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Booking,
  CustomerBookingInput,
  FieldClosure,
  Member,
  MemberInput,
  MemberVerifyResult,
  OwnerBookingInput,
  PriceCalculationResult,
  PublicScheduleResponse,
  PublicSlotSession,
  SlotSessionConfig,
  VenueSettings,
} from '../src/types';
import {
  checkCollision,
  calculatePrice,
  getJakartaDateString,
  getJakartaCurrentMinutes,
  generatePublicSchedule,
  timeToMinutes,
  minutesToTime,
  normalizeWhatsappNumber,
  isWeekendDay,
  getDayOfWeek,
} from '../src/utils/timeUtils';
import {
  getPrismaClient,
  mapDbToSettings,
  mapSettingsToDb,
  mapDbToBooking,
  mapBookingToDb,
  mapDbToClosure,
  mapDbToMember,
  mapMemberToDb,
} from './prisma';

// In Vercel / AWS Lambda serverless functions, only /tmp is writable; locally process.cwd()/data is used
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION ||
  process.env.LAMBDA_TASK_ROOT
);
const DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  settings: VenueSettings;
  bookings: Booking[];
  closures: FieldClosure[];
  members: Member[];
  ownerToken?: string;
}

// 14 Sesi Jadwal Tetap Resmi FalseNine Mini Soccer sesuai brosur pricelist
export const DEFAULT_FALSENINE_SLOTS: SlotSessionConfig[] = [
  {
    id: 'fn-slot-1',
    startTime: '07:00',
    endTime: '08:00',
    durationMinutes: 60,
    weekdayPrice: 350000,
    weekendPrice: 465000,
    label: 'Pagi 1',
    isActive: true,
  },
  {
    id: 'fn-slot-2',
    startTime: '08:00',
    endTime: '09:00',
    durationMinutes: 60,
    weekdayPrice: 350000,
    weekendPrice: 465000,
    label: 'Pagi 2',
    isActive: true,
  },
  {
    id: 'fn-slot-3',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    weekdayPrice: 350000,
    weekendPrice: 465000,
    label: 'Pagi 3',
    isActive: true,
  },
  {
    id: 'fn-slot-4',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    weekdayPrice: 300000,
    weekendPrice: 365000,
    label: 'Siang 1',
    isActive: true,
  },
  {
    id: 'fn-slot-5',
    startTime: '11:00',
    endTime: '12:00',
    durationMinutes: 60,
    weekdayPrice: 300000,
    weekendPrice: 365000,
    label: 'Siang 2',
    isActive: true,
  },
  {
    id: 'fn-slot-6',
    startTime: '12:00',
    endTime: '13:00',
    durationMinutes: 60,
    weekdayPrice: 300000,
    weekendPrice: 365000,
    label: 'Siang 3',
    isActive: true,
  },
  {
    id: 'fn-slot-7',
    startTime: '13:00',
    endTime: '14:00',
    durationMinutes: 60,
    weekdayPrice: 300000,
    weekendPrice: 365000,
    label: 'Siang 4',
    isActive: true,
  },
  {
    id: 'fn-slot-8',
    startTime: '14:00',
    endTime: '15:00',
    durationMinutes: 60,
    weekdayPrice: 300000,
    weekendPrice: 365000,
    label: 'Sore 1',
    isActive: true,
  },
  {
    id: 'fn-slot-9',
    startTime: '15:00',
    endTime: '16:00',
    durationMinutes: 60,
    weekdayPrice: 365000,
    weekendPrice: 365000,
    label: 'Sore 2',
    isActive: true,
  },
  {
    id: 'fn-slot-10',
    startTime: '16:00',
    endTime: '17:00',
    durationMinutes: 60,
    weekdayPrice: 435000,
    weekendPrice: 465000,
    label: 'Sore 3',
    isActive: true,
  },
  {
    id: 'fn-slot-11',
    startTime: '17:00',
    endTime: '18:30',
    durationMinutes: 90,
    weekdayPrice: 525000,
    weekendPrice: 565000,
    label: 'Senja (1.5 Jam)',
    isActive: true,
  },
  {
    id: 'fn-slot-12',
    startTime: '20:00',
    endTime: '22:00',
    durationMinutes: 120,
    weekdayPrice: 950000,
    weekendPrice: 990000,
    label: 'Prime Night 1 (2 Jam)',
    isActive: true,
  },
  {
    id: 'fn-slot-13',
    startTime: '22:00',
    endTime: '00:00',
    durationMinutes: 120,
    weekdayPrice: 950000,
    weekendPrice: 990000,
    label: 'Prime Night 2 (2 Jam)',
    isActive: true,
  },
  {
    id: 'fn-slot-14',
    startTime: '00:00',
    endTime: '02:00',
    durationMinutes: 120,
    weekdayPrice: 800000,
    weekendPrice: 950000,
    label: 'Midnight Session (2 Jam)',
    isActive: true,
  },
];

// Member Awal Bawaan
export const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'mem-f9-001',
    memberCode: 'FN-MBR-001',
    name: 'Garuda Muda FC',
    whatsapp: '081234567890',
    teamName: 'Garuda Muda FC',
    tier: 'VIP',
    discountPercentage: 10,
    status: 'active',
    notes: 'Member aktif rutin main tiap Selasa & Jumat malam',
    totalBookings: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-f9-002',
    memberCode: 'FN-MBR-002',
    name: 'Komunitas MiniSoccer Batavia',
    whatsapp: '085712345678',
    teamName: 'Batavia Squad',
    tier: 'Komunitas',
    discountPercentage: 10,
    status: 'active',
    notes: 'Komunitas rutin akhir pekan',
    totalBookings: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-f9-003',
    memberCode: 'FN-MBR-003',
    name: 'FalseNine Academy',
    whatsapp: '082276079061',
    teamName: 'F9 Youngsters',
    tier: 'Gold',
    discountPercentage: 15,
    status: 'active',
    notes: 'Akademi binaan internal FalseNine',
    totalBookings: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_SETTINGS: VenueSettings = {
  name: 'Almansuri Arena',
  address: 'Jl. Lapangan Hijau No. 9, Jakarta',
  gmapsUrl: 'https://maps.google.com/?q=Almansuri+Arena',
  ownerWhatsapp: '0822-7607-9061',
  openTime: '07:00',
  closeTime: '02:00',
  closedDays: [],
  maxAdvanceDays: 30,
  minDurationMinutes: 60,
  allowedDurations: [60, 90, 120],
  bufferMinutes: 0,
  baseHourlyRate: 350000,
  specialRates: [],
  paymentTerms: 'Pembayaran DP / Lunas dilakukan sebelum kick-off via Transfer Bank atau QRIS.',
  cancellationPolicy: 'Pembatalan bebas biaya dapat dilakukan maksimal 6 jam sebelum jadwal kick-off.',
  slotSessions: DEFAULT_FALSENINE_SLOTS,
};

export function getInitialDemoData(): DatabaseSchema {
  const today = getJakartaDateString();
  const [y, m, d] = today.split('-').map(Number);
  const tomorrowDate = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const demoBookings: Booking[] = [
    {
      id: 'demo-b1',
      bookingCode: 'MS-2609-A101',
      secretToken: 'demo-token-1111-aaaa-bbbb',
      date: today,
      startTime: '14:45',
      endTime: '16:15',
      durationMinutes: 90,
      customerName: 'Budi Santoso',
      customerWhatsapp: '081234567891',
      teamName: 'Garuda FC',
      notes: 'Rompi disediakan pihak lapangan ya min',
      bookingSource: 'online',
      bookingStatus: 'confirmed',
      paymentStatus: 'unpaid',
      priceBreakdown: [
        {
          fromTime: '14:45',
          toTime: '16:15',
          durationMinutes: 90,
          hourlyRate: 300000,
          amount: 450000,
          rateName: 'Tarif Dasar',
        },
      ],
      totalPrice: 450000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'demo-b2',
      bookingCode: 'MS-2609-A102',
      secretToken: 'demo-token-2222-cccc-dddd',
      date: today,
      startTime: '19:00',
      endTime: '21:00',
      durationMinutes: 120,
      customerName: 'Reza Pratama',
      customerWhatsapp: '081987654321',
      teamName: 'Senayan Ballers',
      bookingSource: 'whatsapp',
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      priceBreakdown: [
        {
          fromTime: '19:00',
          toTime: '21:00',
          durationMinutes: 120,
          hourlyRate: 350000,
          amount: 700000,
          rateName: 'Tarif Malam (Peak Hour)',
        },
      ],
      totalPrice: 700000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'demo-b3',
      bookingCode: 'MS-2609-A103',
      secretToken: 'demo-token-3333-eeee-ffff',
      date: tomorrow,
      startTime: '16:00',
      endTime: '18:00',
      durationMinutes: 120,
      customerName: 'Dimas Setiawan',
      customerWhatsapp: '085712345678',
      teamName: 'Kelapa Gading United',
      bookingSource: 'phone',
      bookingStatus: 'confirmed',
      paymentStatus: 'unpaid',
      priceBreakdown: [
        {
          fromTime: '16:00',
          toTime: '18:00',
          durationMinutes: 120,
          hourlyRate: 300000,
          amount: 600000,
          rateName: 'Tarif Dasar',
        },
      ],
      totalPrice: 600000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
  ];

  const demoClosures: FieldClosure[] = [
    {
      id: 'demo-c1',
      date: today,
      startTime: '11:45',
      endTime: '13:00',
      reason: 'Perawatan Rumput & Penyiraman',
      createdAt: new Date().toISOString(),
      isDemo: true,
    },
  ];

  return {
    settings: { ...DEFAULT_SETTINGS },
    bookings: demoBookings,
    closures: demoClosures,
    members: DEFAULT_MEMBERS,
  };
}

class Store {
  private data: DatabaseSchema;
  private locks = new Map<string, Promise<void>>();
  private idempotencyCache = new Map<string, { booking: Booking; timestamp: number }>();
  public readonly isMySqlConfigured: boolean;

  constructor() {
    this.isMySqlConfigured = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');

    // If MySQL is configured, start clean without injecting demo fixtures into state
    if (this.isMySqlConfigured) {
      this.data = this.loadFromDiskClean();
    } else {
      this.data = this.loadFromDisk();
    }

    // Initialize MySQL Prisma sync as primary source of truth
    this.initPrismaSync().catch((err) => {
      console.warn('[Prisma] Inisialisasi awal database dilewati:', err.message);
    });
  }

  private async initPrismaSync() {
    const prisma = getPrismaClient();
    if (!prisma) return;
    try {
      // 1. Sync settings
      const existingSetting = await prisma.venueSetting.findFirst();
      if (existingSetting) {
        const loadedSettings = mapDbToSettings(existingSetting, this.data.settings);
        // Preserve customized name or use Almansuri Arena
        let venueName = loadedSettings.name;
        if (!venueName || venueName === 'MiniSoccer Arena' || venueName === 'FalseNine Mini Soccer') {
          venueName = this.data.settings.name || 'Almansuri Arena';
        }

        const hasSlotSessions = loadedSettings.slotSessions && loadedSettings.slotSessions.length > 0;
        this.data.settings = {
          ...this.data.settings,
          ...loadedSettings,
          name: venueName,
          slotSessions: hasSlotSessions ? loadedSettings.slotSessions : (this.data.settings.slotSessions || DEFAULT_FALSENINE_SLOTS),
        };

        const payload = mapSettingsToDb(this.data.settings);
        await prisma.venueSetting.update({
          where: { id: existingSetting.id },
          data: payload,
        });
        console.log('[Prisma] Pengaturan venue disinkronkan dari MySQL:', {
          id: existingSetting.id,
          name: this.data.settings.name,
        });
      } else {
        const payload = mapSettingsToDb(this.data.settings);
        await prisma.venueSetting.upsert({
          where: { id: 'default' },
          create: { id: 'default', ...payload },
          update: payload,
        });
        console.log('[Prisma] Pengaturan venue Almansuri Arena berhasil diinisialisasi ke MySQL.');
      }

      // 2. Sync bookings - MySQL is primary Source of Truth
      const count = await prisma.booking.count();
      if (count > 0) {
        const dbBookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
        this.data.bookings = dbBookings.map(mapDbToBooking);
      } else if (!this.isMySqlConfigured && this.data.bookings.length > 0) {
        for (const b of this.data.bookings) {
          await prisma.booking.create({ data: mapBookingToDb(b) }).catch(() => {});
        }
      } else if (this.isMySqlConfigured) {
        this.data.bookings = [];
      }

      // 3. Sync closures - MySQL is primary Source of Truth
      const closureCount = await prisma.fieldClosure.count();
      if (closureCount > 0) {
        const dbClosures = await prisma.fieldClosure.findMany();
        this.data.closures = dbClosures.map(mapDbToClosure);
      } else if (!this.isMySqlConfigured && this.data.closures.length > 0) {
        for (const c of this.data.closures) {
          await prisma.fieldClosure.create({
            data: {
              id: c.id,
              date: c.date,
              startTime: c.startTime,
              endTime: c.endTime,
              reason: c.reason,
              isDemo: Boolean(c.isDemo),
            },
          }).catch(() => {});
        }
      } else if (this.isMySqlConfigured) {
        this.data.closures = [];
      }

      // 4. Sync members - MySQL is Source of Truth
      const memberCount = await prisma.member.count();
      if (memberCount > 0) {
        const dbMembers = await prisma.member.findMany({ orderBy: { createdAt: 'desc' } });
        this.data.members = dbMembers.map(mapDbToMember);
      } else {
        const seeds = (this.data.members && this.data.members.length > 0) ? this.data.members : DEFAULT_MEMBERS;
        for (const m of seeds) {
          await prisma.member.create({ data: mapMemberToDb(m) }).catch(() => {});
        }
        const dbMembers = await prisma.member.findMany({ orderBy: { createdAt: 'desc' } });
        this.data.members = dbMembers.map(mapDbToMember);
      }

      this.saveToDisk(this.data);
      console.log('[Store] Berhasil sinkronisasi dengan database MySQL via Prisma (MySQL is Source of Truth).');
    } catch (err: any) {
      console.warn('[Store] MySQL Prisma sync skipped (tabel belum siap atau db:push diperlukan):', err.message);
    }
  }

  private loadFromDiskClean(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        const nonDemoBookings = (parsed.bookings || []).filter((b: any) => !b.isDemo && !b.id?.startsWith('demo-'));
        const nonDemoClosures = (parsed.closures || []).filter((c: any) => !c.isDemo && !c.id?.startsWith('demo-'));
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          bookings: nonDemoBookings,
          closures: nonDemoClosures,
          members: parsed.members || DEFAULT_MEMBERS,
        };
      }
    } catch (err) {
      console.warn('Could not read db file, initializing with clean schema', err);
    }
    const clean: DatabaseSchema = {
      settings: { ...DEFAULT_SETTINGS },
      bookings: [],
      closures: [],
      members: DEFAULT_MEMBERS,
    };
    this.saveToDisk(clean);
    return clean;
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          bookings: parsed.bookings || [],
          closures: parsed.closures || [],
          members: parsed.members || DEFAULT_MEMBERS,
        };
      }
    } catch (err) {
      console.warn('Could not read db file, initializing with demo data', err);
    }
    if (this.isMySqlConfigured) {
      const clean: DatabaseSchema = {
        settings: { ...DEFAULT_SETTINGS },
        bookings: [],
        closures: [],
        members: DEFAULT_MEMBERS,
      };
      this.saveToDisk(clean);
      return clean;
    }
    const initial = getInitialDemoData();
    this.saveToDisk(initial);
    return initial;
  }

  private saveToDisk(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db file', err);
    }
  }

  public async withDateLock<T>(dateStr: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(dateStr)) {
      await this.locks.get(dateStr);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(dateStr, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(dateStr);
      resolveLock();
    }
  }

  public getSettings(): VenueSettings {
    return { ...this.data.settings };
  }

  public async updateSettings(newSettings: Partial<VenueSettings>): Promise<{ settings: VenueSettings; mysqlSynced: boolean; mysqlError?: string }> {
    const sanitized = { ...newSettings };
    if (sanitized.ownerWhatsapp) {
      sanitized.ownerWhatsapp = normalizeWhatsappNumber(sanitized.ownerWhatsapp) || sanitized.ownerWhatsapp.trim();
    }
    this.data.settings = { ...this.data.settings, ...sanitized };
    this.saveToDisk(this.data);

    let mysqlSynced = false;
    let mysqlError: string | undefined;

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const payload = mapSettingsToDb(this.data.settings);
        const existing = await prisma.venueSetting.findFirst();
        const targetId = existing?.id || 'default';
        await prisma.venueSetting.upsert({
          where: { id: targetId },
          create: { id: targetId, ...payload },
          update: payload,
        });
        mysqlSynced = true;
        console.log('[Prisma] Sukses memperbarui pengaturan VenueSetting di database MySQL:', payload.name);
      } catch (e: any) {
        mysqlError = e.message || 'Gagal update di MySQL';
        console.error('[Prisma] Gagal update VenueSetting di MySQL:', e.message);
      }
    }

    return {
      settings: this.getSettings(),
      mysqlSynced,
      mysqlError,
    };
  }

  public async syncSettingsToMySql(): Promise<{ success: boolean; message: string; settings: VenueSettings }> {
    const prisma = getPrismaClient();
    if (!prisma) {
      return {
        success: false,
        message: 'DATABASE_URL belum dikonfigurasi di file environment (.env).',
        settings: this.getSettings(),
      };
    }

    try {
      const payload = mapSettingsToDb(this.data.settings);
      const existing = await prisma.venueSetting.findFirst();
      const targetId = existing?.id || 'default';
      await prisma.venueSetting.upsert({
        where: { id: targetId },
        create: { id: targetId, ...payload },
        update: payload,
      });
      return {
        success: true,
        message: 'Pengaturan berhasil disinkronkan ke database MySQL via Prisma.',
        settings: this.getSettings(),
      };
    } catch (err: any) {
      console.error('[Prisma] Sync settings manual gagal:', err);
      return {
        success: false,
        message: `Gagal sinkronisasi ke MySQL: ${err.message || 'Kesalahan database'}`,
        settings: this.getSettings(),
      };
    }
  }

  public getAllBookings(): Booking[] {
    return [...this.data.bookings];
  }

  public getAllClosures(): FieldClosure[] {
    return [...this.data.closures];
  }

  public getPublicSchedule(dateStr: string): PublicScheduleResponse {
    const { slots, freeRanges, isFull: legacyIsFull } = generatePublicSchedule(
      dateStr,
      this.data.bookings,
      this.data.closures,
      this.data.settings
    );

    const isWeekend = isWeekendDay(dateStr);
    const day = getDayOfWeek(dateStr);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[day];

    const slotConfigs = (this.data.settings.slotSessions && this.data.settings.slotSessions.length > 0)
      ? this.data.settings.slotSessions
      : DEFAULT_FALSENINE_SLOTS;

    const todayJakarta = getJakartaDateString();
    const currentMins = dateStr === todayJakarta ? getJakartaCurrentMinutes() : -1;

    const slotSessions: PublicSlotSession[] = slotConfigs.map((cfg) => {
      const startM = timeToMinutes(cfg.startTime);
      let endM = timeToMinutes(cfg.endTime);
      if (endM <= startM) {
        endM += 1440; // overnight slots (e.g. 22:00-00:00 or 00:00-02:00)
      }
      const effectivePrice = isWeekend ? cfg.weekendPrice : cfg.weekdayPrice;

      if (!cfg.isActive) {
        return {
          ...cfg,
          effectivePrice,
          isWeekend,
          status: 'closed',
          reason: 'Sesi dinonaktifkan',
        };
      }

      // Past check
      if (dateStr < todayJakarta || (dateStr === todayJakarta && currentMins > startM)) {
        return {
          ...cfg,
          effectivePrice,
          isWeekend,
          status: 'past',
          reason: 'Waktu sesi sudah lewat',
        };
      }

      // Closure check
      const conflictingClosure = this.data.closures.find(c => {
        if (c.date !== dateStr) return false;
        const cStart = timeToMinutes(c.startTime);
        let cEnd = timeToMinutes(c.endTime);
        if (cEnd <= cStart) cEnd += 1440;
        return startM < cEnd && endM > cStart;
      });
      if (conflictingClosure) {
        return {
          ...cfg,
          effectivePrice,
          isWeekend,
          status: 'closed',
          reason: `Ditutup: ${conflictingClosure.reason}`,
        };
      }

      // Booking check
      const conflictingBooking = this.data.bookings.find(b => {
        if (b.date !== dateStr || b.bookingStatus === 'cancelled') return false;
        const bStart = timeToMinutes(b.startTime);
        let bEnd = timeToMinutes(b.endTime);
        if (bEnd <= bStart) bEnd += 1440;
        return startM < bEnd && endM > bStart;
      });
      if (conflictingBooking) {
        return {
          ...cfg,
          effectivePrice,
          isWeekend,
          status: 'booked',
          bookedBy: conflictingBooking.teamName || conflictingBooking.customerName,
          reason: 'Sudah dipesan',
        };
      }

      return {
        ...cfg,
        effectivePrice,
        isWeekend,
        status: 'available',
      };
    });

    const openM = timeToMinutes(this.data.settings.openTime || '07:00');
    slotSessions.sort((a, b) => {
      let startA = timeToMinutes(a.startTime);
      let startB = timeToMinutes(b.startTime);
      if (startA < openM) startA += 1440;
      if (startB < openM) startB += 1440;
      if (startA !== startB) return startA - startB;
      return a.durationMinutes - b.durationMinutes;
    });

    const isFull = slotSessions.length > 0
      ? slotSessions.every(s => s.status !== 'available')
      : legacyIsFull;

    // If full, find nearest available dates
    let nearestAvailableDates: string[] = [];
    if (isFull) {
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const baseDate = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(baseDate.getTime() + i * 86400000);
        const checkStr = checkDate.toISOString().slice(0, 10);
        const checkSched = generatePublicSchedule(checkStr, this.data.bookings, this.data.closures, this.data.settings);
        if (!checkSched.isFull) {
          nearestAvailableDates.push(checkStr);
          if (nearestAvailableDates.length >= 3) break;
        }
      }
    }

    return {
      date: dateStr,
      venueName: this.data.settings.name,
      openTime: this.data.settings.openTime,
      closeTime: this.data.settings.closeTime,
      bufferMinutes: this.data.settings.bufferMinutes,
      baseHourlyRate: this.data.settings.baseHourlyRate,
      isWeekend,
      dayName,
      slots,
      slotSessions,
      freeRanges,
      isFull,
      nearestAvailableDates,
    };
  }

  public findBookingById(id: string): Booking | undefined {
    return this.data.bookings.find(b => b.id === id);
  }

  public findBookingBySecretToken(token: string): Booking | undefined {
    return this.data.bookings.find(b => b.secretToken === token);
  }

  public findBookingByCodeAndPhone(code: string, phone: string): Booking | undefined {
    const cleanCode = code.trim().toUpperCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.data.bookings.find(b => {
      const bCode = b.bookingCode.trim().toUpperCase();
      const bPhone = b.customerWhatsapp.replace(/[^0-9]/g, '');
      const phoneMatch = bPhone.endsWith(cleanPhone) || cleanPhone.endsWith(bPhone);
      return bCode === cleanCode && phoneMatch;
    });
  }

  public async createBookingAtomic(
    input: CustomerBookingInput & { bookingSource?: any; paymentStatus?: any }
  ): Promise<Booking> {
    return this.withDateLock(input.date, async () => {
      // Check idempotency cache
      if (input.idempotencyKey) {
        const cached = this.idempotencyCache.get(input.idempotencyKey);
        if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
          return cached.booking;
        }
      }

      const startMins = timeToMinutes(input.startTime);
      const endMins = startMins + input.durationMinutes;
      const endTimeStr = minutesToTime(endMins);

      // Validate duration
      const minDur = this.data.settings.minDurationMinutes || 60;
      if (input.durationMinutes < minDur) {
        throw new Error(`Durasi sewa minimal adalah ${minDur} menit.`);
      }

      // Check collision
      const collision = checkCollision(
        input.date,
        input.startTime,
        endTimeStr,
        this.data.bookings,
        this.data.closures,
        this.data.settings
      );

      if (collision.hasCollision) {
        throw new Error(collision.reason || 'Jadwal yang dipilih sudah terisi atau tidak tersedia.');
      }

      // Check member if provided
      let matchedMember: Member | undefined = undefined;
      let memberDiscountPercent = 0;
      if (input.memberCode) {
        const verifyRes = this.verifyMember(input.memberCode);
        if (verifyRes.valid && verifyRes.member) {
          matchedMember = (this.data.members || []).find(m => m.id === verifyRes.member!.id);
          if (matchedMember) {
            memberDiscountPercent = matchedMember.discountPercentage || 10;
          }
        }
      }

      // Calculate price with options (slot sessions, member discount, photographer)
      const priceCalc = calculatePrice(
        input.date,
        input.startTime,
        input.durationMinutes,
        this.data.settings,
        {
          memberDiscountPercent,
          photographerAddon: input.photographerAddon,
        }
      );

      // Generate booking code & secret token
      const datePart = input.date.replace(/-/g, '').slice(2); // e.g. 260921
      const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
      const bookingCode = `FN-${datePart}-${randPart}`;
      const secretToken = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

      const newBooking: Booking = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `b-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        bookingCode,
        secretToken,
        date: input.date,
        startTime: input.startTime,
        endTime: endTimeStr,
        durationMinutes: input.durationMinutes,
        customerName: input.customerName.trim(),
        customerWhatsapp: input.customerWhatsapp.trim(),
        teamName: input.teamName?.trim(),
        notes: input.notes?.trim(),
        bookingSource: input.bookingSource || 'online',
        bookingStatus: 'confirmed',
        paymentStatus: input.paymentStatus || 'unpaid',
        priceBreakdown: priceCalc.segments,
        totalPrice: priceCalc.totalPrice,
        discountAmount: priceCalc.discountAmount || 0,
        memberId: matchedMember?.id,
        memberCode: matchedMember?.memberCode,
        photographerAddon: input.photographerAddon || 'none',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };

      this.data.bookings.push(newBooking);

      // If member used, increment totalBookings
      if (matchedMember) {
        matchedMember.totalBookings = (matchedMember.totalBookings || 0) + 1;
        matchedMember.updatedAt = new Date().toISOString();
        const prisma = getPrismaClient();
        if (prisma) {
          prisma.member
            .updateMany({
              where: { id: matchedMember.id },
              data: { totalBookings: matchedMember.totalBookings, updatedAt: new Date(matchedMember.updatedAt) },
            })
            .catch(() => {});
        }
      }

      this.saveToDisk(this.data);

      const prisma = getPrismaClient();
      if (prisma) {
        prisma.booking.create({ data: mapBookingToDb(newBooking) }).catch((e) => {
          console.warn('[Prisma] Gagal menyimpan booking ke MySQL:', e.message);
        });
      }

      if (input.idempotencyKey) {
        this.idempotencyCache.set(input.idempotencyKey, {
          booking: newBooking,
          timestamp: Date.now(),
        });
      }

      return newBooking;
    });
  }

  // -----------------------------------------------------------------
  // MEMBER MANAGEMENT METHODS (MySQL + Memory)
  // -----------------------------------------------------------------
  public getAllMembers(): Member[] {
    return [...(this.data.members || [])];
  }

  public getMemberById(id: string): Member | undefined {
    return (this.data.members || []).find(m => m.id === id);
  }

  public verifyMember(query: string): MemberVerifyResult {
    if (!query || typeof query !== 'string') {
      return { valid: false, message: 'Masukkan Kode Member atau Nomor WhatsApp' };
    }
    const cleanQ = query.trim().toUpperCase();
    const cleanPhone = normalizeWhatsappNumber(query);

    const member = (this.data.members || []).find(m => {
      const matchCode = m.memberCode.toUpperCase() === cleanQ;
      const matchPhone = Boolean(
        cleanPhone && (
          normalizeWhatsappNumber(m.whatsapp) === cleanPhone ||
          m.whatsapp.replace(/[^0-9]/g, '').endsWith(cleanPhone.slice(-8))
        )
      );
      return matchCode || matchPhone;
    });

    if (!member) {
      return {
        valid: false,
        message: 'Member tidak ditemukan. Pastikan Kode Member atau Nomor WhatsApp sudah terdaftar.',
      };
    }

    if (member.status !== 'active') {
      return {
        valid: false,
        message: `Member "${member.name}" saat ini berstatus non-aktif.`,
      };
    }

    return {
      valid: true,
      member: {
        id: member.id,
        memberCode: member.memberCode,
        name: member.name,
        whatsapp: member.whatsapp,
        teamName: member.teamName,
        tier: member.tier,
        discountPercentage: member.discountPercentage,
      },
      message: `Member ${member.tier} aktif: ${member.name} (Diskon ${member.discountPercentage}%)`,
    };
  }

  public async createMember(input: MemberInput): Promise<Member> {
    const members = this.data.members || [];
    const nextNum = members.length + 1;
    const memberCode = `FN-MBR-${String(nextNum).padStart(3, '0')}`;
    const newMember: Member = {
      id: crypto.randomUUID(),
      memberCode,
      name: input.name.trim(),
      whatsapp: normalizeWhatsappNumber(input.whatsapp) || input.whatsapp.trim(),
      teamName: input.teamName?.trim(),
      tier: input.tier || 'Regular',
      discountPercentage: typeof input.discountPercentage === 'number' ? input.discountPercentage : 10,
      status: input.status || 'active',
      notes: input.notes?.trim(),
      totalBookings: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    members.unshift(newMember);
    this.data.members = members;
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.member.create({ data: mapMemberToDb(newMember) });
      } catch (err: any) {
        console.warn('[Prisma] Gagal simpan member ke MySQL:', err.message);
      }
    }

    return newMember;
  }

  public async updateMember(id: string, input: Partial<MemberInput>): Promise<Member> {
    const member = this.getMemberById(id);
    if (!member) throw new Error('Member tidak ditemukan.');

    if (input.name !== undefined) member.name = input.name.trim();
    if (input.whatsapp !== undefined) member.whatsapp = normalizeWhatsappNumber(input.whatsapp) || input.whatsapp.trim();
    if (input.teamName !== undefined) member.teamName = input.teamName.trim();
    if (input.tier !== undefined) member.tier = input.tier;
    if (input.discountPercentage !== undefined) member.discountPercentage = Number(input.discountPercentage);
    if (input.status !== undefined) member.status = input.status;
    if (input.notes !== undefined) member.notes = input.notes.trim();
    member.updatedAt = new Date().toISOString();

    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.member.updateMany({
          where: { id },
          data: {
            name: member.name,
            whatsapp: member.whatsapp,
            teamName: member.teamName || null,
            tier: member.tier,
            discountPercentage: member.discountPercentage,
            status: member.status,
            notes: member.notes || null,
            updatedAt: new Date(member.updatedAt),
          },
        });
      } catch (err: any) {
        console.warn('[Prisma] Gagal update member di MySQL:', err.message);
      }
    }

    return member;
  }

  public async deleteMember(id: string): Promise<boolean> {
    this.data.members = (this.data.members || []).filter(m => m.id !== id);
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.member.deleteMany({ where: { id } });
      } catch (err: any) {
        console.warn('[Prisma] Gagal hapus member di MySQL:', err.message);
      }
    }

    return true;
  }

  // -----------------------------------------------------------------
  // SLOT SESSIONS MANAGEMENT (Owner defined)
  // -----------------------------------------------------------------
  public getSlotSessions(): SlotSessionConfig[] {
    const raw = this.data.settings.slotSessions || DEFAULT_FALSENINE_SLOTS;
    const openM = timeToMinutes(this.data.settings.openTime || '07:00');
    return [...raw].sort((a, b) => {
      let startA = timeToMinutes(a.startTime);
      let startB = timeToMinutes(b.startTime);
      if (startA < openM) startA += 1440;
      if (startB < openM) startB += 1440;
      if (startA !== startB) return startA - startB;
      return a.durationMinutes - b.durationMinutes;
    });
  }

  public async updateSlotSessions(newSlots: SlotSessionConfig[]): Promise<{ slotSessions: SlotSessionConfig[]; mysqlSynced: boolean }> {
    const openM = timeToMinutes(this.data.settings.openTime || '07:00');
    const sorted = [...newSlots].sort((a, b) => {
      let startA = timeToMinutes(a.startTime);
      let startB = timeToMinutes(b.startTime);
      if (startA < openM) startA += 1440;
      if (startB < openM) startB += 1440;
      if (startA !== startB) return startA - startB;
      return a.durationMinutes - b.durationMinutes;
    });

    this.data.settings.slotSessions = sorted;
    const res = await this.updateSettings({ slotSessions: sorted });
    return {
      slotSessions: this.getSlotSessions(),
      mysqlSynced: res.mysqlSynced,
    };
  }

  public async resetSlotsToDefault(): Promise<{ slotSessions: SlotSessionConfig[]; mysqlSynced: boolean }> {
    return this.updateSlotSessions(DEFAULT_FALSENINE_SLOTS);
  }

  public async updateBookingScheduleAtomic(
    id: string,
    newDate: string,
    newStartTime: string,
    newDurationMinutes: number
  ): Promise<Booking> {
    // Lock both old and new date if different
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');

    const lockDate1 = booking.date;
    const lockDate2 = newDate;

    return this.withDateLock(lockDate1, async () => {
      return this.withDateLock(lockDate2, async () => {
        const startMins = timeToMinutes(newStartTime);
        const endMins = startMins + newDurationMinutes;
        const endTimeStr = minutesToTime(endMins);

        const collision = checkCollision(
          newDate,
          newStartTime,
          endTimeStr,
          this.data.bookings,
          this.data.closures,
          this.data.settings,
          id // exclude self!
        );

        if (collision.hasCollision) {
          throw new Error(collision.reason || 'Jadwal baru bertabrakan dengan jadwal lain.');
        }

        const priceCalc = calculatePrice(newDate, newStartTime, newDurationMinutes, this.data.settings);

        booking.date = newDate;
        booking.startTime = newStartTime;
        booking.endTime = endTimeStr;
        booking.durationMinutes = newDurationMinutes;
        booking.priceBreakdown = priceCalc.segments;
        booking.totalPrice = priceCalc.totalPrice;
        booking.updatedAt = new Date().toISOString();

        this.saveToDisk(this.data);

        const prisma = getPrismaClient();
        if (prisma) {
          prisma.booking
            .updateMany({
              where: { id },
              data: {
                date: newDate,
                startTime: newStartTime,
                endTime: endTimeStr,
                durationMinutes: newDurationMinutes,
                priceBreakdown: JSON.stringify(priceCalc.segments),
                totalPrice: priceCalc.totalPrice,
                updatedAt: new Date(booking.updatedAt),
              },
            })
            .catch((e) => console.warn('[Prisma] Gagal update jadwal booking di MySQL:', e.message));
        }

        return booking;
      });
    });
  }

  public async updateBookingDetails(
    id: string,
    updates: { customerName?: string; customerWhatsapp?: string; teamName?: string; notes?: string }
  ): Promise<Booking> {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');

    if (updates.customerName !== undefined) booking.customerName = updates.customerName.trim();
    if (updates.customerWhatsapp !== undefined) booking.customerWhatsapp = updates.customerWhatsapp.trim();
    if (updates.teamName !== undefined) booking.teamName = updates.teamName.trim();
    if (updates.notes !== undefined) booking.notes = updates.notes.trim();
    booking.updatedAt = new Date().toISOString();

    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.booking.updateMany({
          where: { id },
          data: {
            customerName: booking.customerName,
            customerWhatsapp: booking.customerWhatsapp,
            teamName: booking.teamName || null,
            notes: booking.notes || null,
            updatedAt: new Date(booking.updatedAt),
          },
        });
      } catch (e: any) {
        console.warn('[Prisma] Gagal update detail kontak di MySQL:', e.message);
      }
    }

    return booking;
  }

  public async updatePaymentStatus(id: string, status: 'paid' | 'unpaid'): Promise<Booking> {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');
    booking.paymentStatus = status;
    booking.updatedAt = new Date().toISOString();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.booking.updateMany({
          where: { id },
          data: { paymentStatus: status, updatedAt: new Date(booking.updatedAt) },
        });
      } catch (e: any) {
        console.warn('[Prisma] Gagal update payment status di MySQL:', e.message);
      }
    }

    return booking;
  }

  public async cancelBooking(id: string, reason?: string): Promise<Booking> {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');
    booking.bookingStatus = 'cancelled';
    booking.cancellationReason = reason || 'Dibatalkan oleh pengelola.';
    booking.updatedAt = new Date().toISOString();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.booking.updateMany({
          where: { id },
          data: {
            bookingStatus: 'cancelled',
            cancellationReason: booking.cancellationReason,
            updatedAt: new Date(booking.updatedAt),
          },
        });
      } catch (e: any) {
        console.warn('[Prisma] Gagal update cancel booking di MySQL:', e.message);
      }
    }

    return booking;
  }

  public async addClosure(date: string, startTime: string, endTime: string, reason: string): Promise<FieldClosure> {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    // Check if overlaps any ACTIVE booking
    const overlappingBookings = this.data.bookings.filter(b => {
      if (b.date !== date || b.bookingStatus === 'cancelled') return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return startMins < bEnd && endMins > bStart;
    });

    if (overlappingBookings.length > 0) {
      const codes = overlappingBookings.map(b => `${b.bookingCode} (${b.startTime}–${b.endTime}, ${b.customerName})`).join(', ');
      throw new Error(`Penutupan bertabrakan dengan booking aktif: ${codes}. Harap ubah jadwal atau batalkan booking terlebih dahulu.`);
    }

    const closure: FieldClosure = {
      id: crypto.randomUUID(),
      date,
      startTime,
      endTime,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.data.closures.push(closure);
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.fieldClosure.create({
          data: {
            id: closure.id,
            date: closure.date,
            startTime: closure.startTime,
            endTime: closure.endTime,
            reason: closure.reason,
            isDemo: false,
          },
        });
      } catch (e: any) {
        console.warn('[Prisma] Gagal menyimpan closure di MySQL:', e.message);
      }
    }

    return closure;
  }

  public async removeClosure(id: string): Promise<void> {
    this.data.closures = this.data.closures.filter(c => c.id !== id);
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.fieldClosure.deleteMany({ where: { id } });
      } catch (e: any) {
        console.warn('[Prisma] Gagal hapus closure di MySQL:', e.message);
      }
    }
  }

  public resetDemoData() {
    this.data = getInitialDemoData();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      (async () => {
        try {
          await prisma.booking.deleteMany();
          await prisma.fieldClosure.deleteMany();
          for (const b of this.data.bookings) {
            await prisma.booking.create({ data: mapBookingToDb(b) }).catch(() => {});
          }
          for (const c of this.data.closures) {
            await prisma.fieldClosure.create({
              data: {
                id: c.id,
                date: c.date,
                startTime: c.startTime,
                endTime: c.endTime,
                reason: c.reason,
                isDemo: Boolean(c.isDemo),
              },
            }).catch(() => {});
          }
        } catch (e: any) {
          console.warn('[Prisma] Reset demo di MySQL dilewati:', e.message);
        }
      })();
    }

    return this.data;
  }

  public clearDemoData(clearAllBookings = false): { removedBookings: number; removedClosures: number } {
    const beforeB = this.data.bookings.length;
    const beforeC = this.data.closures.length;

    if (clearAllBookings) {
      this.data.bookings = [];
      this.data.closures = [];
    } else {
      // Remove all bookings and closures marked as demo or with demo- prefix
      this.data.bookings = this.data.bookings.filter(b => !b.isDemo && !b.id.startsWith('demo-'));
      this.data.closures = this.data.closures.filter(c => !c.id.startsWith('demo-'));
    }

    const removedBookings = beforeB - this.data.bookings.length;
    const removedClosures = beforeC - this.data.closures.length;

    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      if (clearAllBookings) {
        prisma.booking.deleteMany().catch(() => {});
        prisma.fieldClosure.deleteMany().catch(() => {});
      } else {
        prisma.booking.deleteMany({ where: { isDemo: true } }).catch(() => {});
        prisma.fieldClosure.deleteMany({ where: { isDemo: true } }).catch(() => {});
      }
    }

    return { removedBookings, removedClosures };
  }
}

export const store = new Store();
