import React from 'react';
import { MapPin, Search } from 'lucide-react';
import { VenueSettings } from '../types';
import { formatRupiah } from '../utils/timeUtils';

interface HeaderProps {
  venue: VenueSettings | null;
  onOpenLookup: () => void;
}

export const Header: React.FC<HeaderProps> = ({ venue, onOpenLookup }) => {
  const venueName = venue?.name || 'MiniSoccer Arena';
  const baseRate = venue?.baseHourlyRate || 300000;
  const address = venue?.address || 'Jakarta Selatan';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs" id="app-header">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-2">
          {/* Brand Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-xs flex-shrink-0">
                ⚽
              </div>
              <div className="truncate">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate leading-tight">
                  {venueName}
                </h1>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-0.5 flex-wrap sm:flex-nowrap">
                  <span className="inline-flex items-center gap-1 truncate max-w-[130px] sm:max-w-xs">
                    <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span className="truncate">{address}</span>
                  </span>
                  <span className="text-slate-300 hidden xs:inline">•</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] whitespace-nowrap">
                    Mulai {formatRupiah(baseRate)}/jam
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              id="btn-cek-booking"
              type="button"
              onClick={onOpenLookup}
              className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-3 sm:px-3.5 py-2 min-h-[40px] rounded-lg transition-colors cursor-pointer border border-slate-200 hover:border-emerald-200 active:scale-95 shadow-2xs"
              title="Cek Booking dengan Kode Booking"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
              <span>Cek Booking</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
