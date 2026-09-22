import React from 'react';
import { MapPin, Search, Phone, Trophy, ArrowRight, ShieldCheck } from 'lucide-react';
import { VenueSettings } from '../types';
import { formatRupiah, normalizeWhatsappNumber } from '../utils/timeUtils';

interface HeaderProps {
  venue: VenueSettings | null;
  onOpenLookup: () => void;
  onScrollToBooking?: () => void;
  onOpenOwner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  venue,
  onOpenLookup,
  onScrollToBooking,
  onOpenOwner,
}) => {
  const venueName = venue?.name || 'MiniSoccer Arena';
  const baseRate = venue?.baseHourlyRate || 300000;
  const address = venue?.address || 'Jakarta Selatan';
  const waFormatted = normalizeWhatsappNumber(venue?.ownerWhatsapp || '');

  const handleBookingClick = () => {
    if (onScrollToBooking) {
      onScrollToBooking();
    } else {
      const el = document.getElementById('booking-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 transition-all" id="app-header">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold shadow-xs flex-shrink-0 border border-emerald-700/50">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-lime-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate leading-tight">
                  {venueName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Buka Hari Ini
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 truncate">
                <span className="inline-flex items-center gap-1 truncate max-w-[140px] sm:max-w-xs">
                  <MapPin className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                  <span className="truncate">{address}</span>
                </span>
                <span className="text-stone-300 hidden xs:inline">•</span>
                <span className="text-stone-600 font-medium hidden xs:inline">
                  Mulai <span className="font-bold text-stone-900">{formatRupiah(baseRate)}</span>/jam
                </span>
              </div>
            </div>
          </div>

          {/* Navigation & Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Quick WhatsApp */}
            {waFormatted && (
              <a
                id="btn-header-whatsapp"
                href={`https://wa.me/${waFormatted}?text=${encodeURIComponent(`Halo ${venueName}, saya ingin bertanya perihal jadwal booking lapangan.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 px-3 py-2 min-h-[38px] rounded-lg transition-colors cursor-pointer"
                title="Hubungi Pengelola via WhatsApp"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>Bantuan WA</span>
              </a>
            )}

            {/* Cek Booking Button */}
            <button
              id="btn-cek-booking"
              type="button"
              onClick={onOpenLookup}
              className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-stone-700 hover:text-emerald-900 bg-stone-100/80 hover:bg-stone-200/70 px-3 py-2 min-h-[38px] rounded-lg transition-colors cursor-pointer border border-stone-200"
              title="Cek Booking dengan Kode Booking"
            >
              <Search className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden xs:inline">Cek Booking</span>
            </button>

            {/* Primary CTA: Booking Sekarang */}
            <button
              id="btn-header-booking"
              type="button"
              onClick={handleBookingClick}
              className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 px-3.5 sm:px-4 py-2 min-h-[38px] rounded-lg transition-colors cursor-pointer shadow-xs border border-emerald-900"
            >
              <span>Booking Sekarang</span>
              <ArrowRight className="w-3.5 h-3.5 text-lime-400" />
            </button>

            {/* Owner Portal Quick Link */}
            {onOpenOwner && (
              <button
                type="button"
                onClick={onOpenOwner}
                className="text-stone-400 hover:text-stone-700 p-2 rounded-lg hover:bg-stone-100 transition-colors ml-0.5"
                title="Portal Pengelola Lapangan"
                aria-label="Portal Pengelola"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
