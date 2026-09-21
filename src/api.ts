import {
  Booking,
  CustomerBookingInput,
  FieldClosure,
  OwnerBookingInput,
  PriceCalculationResult,
  PublicScheduleResponse,
  VenueSettings,
} from './types';

export const API_BASE = '/api';

/**
 * Safely executes fetch with retry logic for transient 429 rate limits or network glitches.
 */
async function safeFetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  backoffMs = 500
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // If rate limited (HTTP 429) and retry attempts remain, wait with backoff and retry
      if (res.status === 429 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
        continue;
      }

      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error('Gagal terhubung ke server.');
}

/**
 * Safely parses API responses, handling plain text (e.g. "Rate exceeded."),
 * non-JSON error pages, and structured JSON payloads without throwing SyntaxError.
 */
async function handleApiResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Body is not valid JSON (e.g., plain text "Rate exceeded.", gateway errors, HTML)
      const cleanText = text.trim();
      if (!res.ok) {
        if (res.status === 429 || cleanText.toLowerCase().includes('rate')) {
          throw new Error('Terlalu banyak permintaan (Batas frekuensi terlampaui). Harap tunggu beberapa saat lalu coba lagi.');
        }
        if (res.status >= 500) {
          throw new Error(`Server sedang sibuk (${res.status}). Silakan coba beberapa saat lagi.`);
        }
        throw new Error(cleanText || fallbackError);
      }
      throw new Error('Respon dari server tidak valid.');
    }
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(data?.error || 'Terlalu banyak permintaan. Harap tunggu beberapa saat sebelum mencoba lagi.');
    }
    throw new Error(data?.error || fallbackError);
  }

  return data as T;
}

export async function fetchVenueInfo(): Promise<VenueSettings> {
  const res = await safeFetchWithRetry(`${API_BASE}/venue-info`);
  return handleApiResponse<VenueSettings>(res, 'Gagal mengambil informasi lapangan');
}

export async function fetchPublicSchedule(date: string): Promise<PublicScheduleResponse> {
  const res = await safeFetchWithRetry(`${API_BASE}/schedule?date=${encodeURIComponent(date)}`);
  return handleApiResponse<PublicScheduleResponse>(res, 'Gagal memuat jadwal ketersediaan');
}

export async function calculatePricePreview(
  date: string,
  startTime: string,
  durationMinutes: number
): Promise<PriceCalculationResult> {
  const res = await safeFetchWithRetry(`${API_BASE}/bookings/calculate-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, startTime, durationMinutes }),
  });
  return handleApiResponse<PriceCalculationResult>(res, 'Gagal menghitung estimasi biaya');
}

export async function submitCustomerBooking(
  input: CustomerBookingInput
): Promise<{ booking: Booking; secretToken: string }> {
  const idempotencyKey = input.idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const res = await safeFetchWithRetry(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...input, idempotencyKey }),
  });

  return handleApiResponse<{ booking: Booking; secretToken: string }>(res, 'Gagal membuat booking.');
}

export async function lookupBooking(bookingCode: string, whatsappNumber: string): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/bookings/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingCode, whatsappNumber }),
  });

  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Booking tidak ditemukan');
  return data.booking;
}

export async function fetchPrivateBooking(token: string): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/bookings/private/${encodeURIComponent(token)}`);
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal memuat detail booking');
  return data.booking;
}

// -------------------------------------------------------------
// OWNER API HELPERS
// -------------------------------------------------------------

export async function ownerLogin(password: string): Promise<string> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await handleApiResponse<{ success: boolean; token: string }>(res, 'Kata sandi salah');
  return data.token;
}

export async function ownerLogout(token: string): Promise<void> {
  await safeFetchWithRetry(`${API_BASE}/owner/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, 1).catch(() => {});
}

export async function fetchOwnerDashboard(token: string) {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleApiResponse<any>(res, 'Gagal memuat data owner');
}

export async function ownerCreateBooking(token: string, input: OwnerBookingInput): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal menambah booking manual');
  return data.booking;
}

export async function ownerRescheduleBooking(
  token: string,
  id: string,
  date: string,
  startTime: string,
  durationMinutes: number
): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/bookings/${id}/schedule`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, startTime, durationMinutes }),
  });
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal mengubah jadwal booking');
  return data.booking;
}

export async function ownerUpdateContact(
  token: string,
  id: string,
  contact: { customerName?: string; customerWhatsapp?: string; teamName?: string; notes?: string }
): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/bookings/${id}/contact`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(contact),
  });
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal mengubah kontak booking');
  return data.booking;
}

export async function ownerUpdatePayment(
  token: string,
  id: string,
  paymentStatus: 'paid' | 'unpaid'
): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/bookings/${id}/payment`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ paymentStatus }),
  });
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal memperbarui status pembayaran');
  return data.booking;
}

export async function ownerCancelBooking(token: string, id: string, reason?: string): Promise<Booking> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/bookings/${id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  });
  const data = await handleApiResponse<{ success: boolean; booking: Booking }>(res, 'Gagal membatalkan booking');
  return data.booking;
}

export async function ownerAddClosure(
  token: string,
  date: string,
  startTime: string,
  endTime: string,
  reason: string
): Promise<FieldClosure> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/closures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, startTime, endTime, reason }),
  });
  const data = await handleApiResponse<{ success: boolean; closure: FieldClosure }>(res, 'Gagal menutup rentang waktu');
  return data.closure;
}

export async function ownerDeleteClosure(token: string, id: string): Promise<void> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/closures/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleApiResponse<any>(res, 'Gagal menghapus penutupan');
}

export async function ownerUpdateSettings(token: string, settings: Partial<VenueSettings>): Promise<VenueSettings> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });
  const data = await handleApiResponse<{ success: boolean; settings: VenueSettings }>(res, 'Gagal menyimpan pengaturan');
  return data.settings;
}

export async function ownerResetDemo(token: string): Promise<void> {
  const res = await safeFetchWithRetry(`${API_BASE}/owner/reset-demo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await handleApiResponse<any>(res, 'Gagal mereset data demo');
}
