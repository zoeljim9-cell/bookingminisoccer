import React from 'react';
import { Clock, MapPin, ExternalLink, Phone, ShieldCheck, Sparkles, Check, ChevronDown, Award } from 'lucide-react';
import { VenueSettings } from '../types';
import { formatRupiah, normalizeWhatsappNumber } from '../utils/timeUtils';

interface HeroSectionProps {
  venue: VenueSettings | null;
  onScrollToBooking: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ venue, onScrollToBooking }) => {
  const venueName = venue?.name || 'MiniSoccer Arena';
  const baseRate = venue?.baseHourlyRate || 300000;
  const openTime = venue?.openTime || '07:00';
  const closeTime = venue?.closeTime || '23:00';
  const address = venue?.address || 'Jakarta Selatan';
  const gmapsUrl = venue?.gmapsUrl || '#';
  const waFormatted = normalizeWhatsappNumber(venue?.ownerWhatsapp || '');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-900 text-white shadow-sm" id="hero-section">
      {/* Background Sport Image with subtle dark gradient overlay for optimal legibility */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=1600&q=80"
          alt="Lapangan Mini Soccer Rumput Sintetis"
          className="w-full h-full object-cover object-center opacity-35 filter brightness-95"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/80 to-stone-950/60" />
      </div>

      <div className="relative z-10 px-4 sm:px-8 py-7 sm:py-9">
        <div className="max-w-2xl">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mb-3.5 backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span>
            <span>Lapangan Rumput Sintetis Premium</span>
          </div>

          {/* Headline (natural & human-crafted) */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Main lebih mudah, pesan lapangan tanpa ribet.
          </h2>

          <p className="mt-2.5 text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Jadwal transparan dengan fleksibilitas jam dan menit per 15 menit. Pilih waktu senggang tim Anda, harga otomatis terhitung, dan slot langsung terkunci tanpa bentrok.
          </p>

          {/* Key venue features */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-stone-200">
              <Clock className="w-3.5 h-3.5 text-lime-400" />
              <span>Buka {openTime} – {closeTime} WIB</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-stone-200">
              <span className="font-semibold text-lime-400">Mulai {formatRupiah(baseRate)}</span>
              <span className="text-stone-400">/ jam</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-stone-200">
              <Award className="w-3.5 h-3.5 text-lime-400" />
              <span>Bola & Rompi Disediakan</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-stone-200">
              <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
              <span>Standar FIFA Turf</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onScrollToBooking}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-lime-400 hover:bg-lime-300 text-stone-950 shadow-sm transition-all cursor-pointer border border-lime-300 active:scale-95"
            >
              <span>Pilih Jadwal Lapangan</span>
              <ChevronDown className="w-4 h-4 text-stone-900" />
            </button>

            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 cursor-pointer backdrop-blur-xs"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lokasi Maps</span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </a>

            {waFormatted && (
              <a
                href={`https://wa.me/${waFormatted}?text=${encodeURIComponent(`Halo ${venueName}, saya ingin menanyakan info lapangan mini soccer.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 cursor-pointer backdrop-blur-xs"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kontak WA</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
