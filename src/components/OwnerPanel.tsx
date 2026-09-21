import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Lock,
  LogOut,
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  MessageSquare,
  DollarSign,
  Shield,
  Settings as SettingsIcon,
  RefreshCw,
  Edit2,
  Trash2,
  ChevronRight,
  User,
  Info,
  CalendarDays,
  ListFilter,
  Ban,
  ArrowLeft,
} from 'lucide-react';
import { Booking, BookingSource, BookingStatus, FieldClosure, PaymentStatus, SpecialRateRule, VenueSettings } from '../types';
import {
  calculatePrice,
  formatDuration,
  formatIndonesianDate,
  formatRupiah,
  getJakartaDateString,
  minutesToTime,
  timeToMinutes,
} from '../utils/timeUtils';
import {
  fetchOwnerDashboard,
  ownerAddClosure,
  ownerCancelBooking,
  ownerCreateBooking,
  ownerDeleteClosure,
  ownerLogin,
  ownerLogout,
  ownerRescheduleBooking,
  ownerResetDemo,
  ownerUpdateContact,
  ownerUpdatePayment,
  ownerUpdateSettings,
} from '../api';

interface OwnerPanelProps {
  onBackToCustomer?: () => void;
  onScheduleUpdated?: () => void;
}

export const OwnerPanel: React.FC<OwnerPanelProps> = ({ onBackToCustomer, onScheduleUpdated }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ms_owner_token'));
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard Data
  const [loadingDashboard, setLoadingLoading] = useState(false);
  const [todayDate, setTodayDate] = useState(getJakartaDateString());
  const [stats, setStats] = useState({
    todayBookingsCount: 0,
    todayTotalHours: 0,
    unpaidCount: 0,
    unpaidTotalAmount: 0,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [closures, setClosures] = useState<FieldClosure[]>([]);
  const [settings, setSettings] = useState<VenueSettings | null>(null);

  // Current tab in owner panel
  const [activeTab, setActiveTab] = useState<'daily' | 'closures' | 'settings'>('daily');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(getJakartaDateString());
  const [filterBookingStatus, setFilterBookingStatus] = useState<string>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');

  // Modals inside Owner Panel
  const [showAddBookingModal, setShowAddBookingModal] = useState(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);
  const [rescheduleBookingTarget, setRescheduleBookingTarget] = useState<Booking | null>(null);
  const [editContactTarget, setEditContactTarget] = useState<Booking | null>(null);
  const [showAddClosureModal, setShowAddClosureModal] = useState(false);

  // Feedback notifications
  const [noticeMessage, setNoticeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNoticeMessage({ type, text });
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  const loadDashboardData = async (activeAuthToken: string) => {
    setLoadingLoading(true);
    try {
      const data = await fetchOwnerDashboard(activeAuthToken);
      setTodayDate(data.todayDate);
      setStats(data.stats);
      setBookings(data.bookings);
      setClosures(data.closures);
      setSettings(data.settings);
      if (onScheduleUpdated) onScheduleUpdated();
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('sesi')) {
        localStorage.removeItem('ms_owner_token');
        setToken(null);
      } else {
        showNotice('error', err.message || 'Gagal mengambil data dashboard');
      }
    } finally {
      setLoadingLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboardData(token);
    }
  }, [token]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const sessionToken = await ownerLogin(passwordInput);
      localStorage.setItem('ms_owner_token', sessionToken);
      setToken(sessionToken);
      setPasswordInput('');
      await loadDashboardData(sessionToken);
    } catch (err: any) {
      setLoginError(err.message || 'Kata sandi salah.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await ownerLogout(token);
    }
    localStorage.removeItem('ms_owner_token');
    setToken(null);
  };

  // Filtered Bookings for the Daily View
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Date filter
      if (filterDate && b.date !== filterDate) return false;
      // Status filter
      if (filterBookingStatus !== 'all' && b.bookingStatus !== filterBookingStatus) return false;
      // Payment filter
      if (filterPaymentStatus !== 'all' && b.paymentStatus !== filterPaymentStatus) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = b.customerName.toLowerCase().includes(q);
        const matchesCode = b.bookingCode.toLowerCase().includes(q);
        const matchesPhone = b.customerWhatsapp.includes(q);
        const matchesTeam = b.teamName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesPhone && !matchesTeam) return false;
      }
      return true;
    }).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [bookings, filterDate, filterBookingStatus, filterPaymentStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" id="owner-panel-page">
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col bg-white sm:my-4 sm:rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Top Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBackToCustomer && (
              <button
                type="button"
                id="btn-owner-back-to-booking"
                onClick={onBackToCustomer}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors mr-1 cursor-pointer"
                title="Kembali ke Halaman Booking Pelanggan"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Ke Booking</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-sm">
              👑
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight flex items-center gap-2 leading-tight">
                <span>Panel Pengelola Lapangan</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                  Owner
                </span>
              </h1>
              <div className="text-xs text-slate-400">
                {settings?.name || 'MiniSoccer Arena'} • Zona Waktu Asia/Jakarta (WIB)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {token && (
              <button
                type="button"
                id="btn-owner-logout"
                onClick={handleLogout}
                className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Notice Toast */}
        {noticeMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              noticeMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {noticeMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{noticeMessage.text}</span>
          </div>
        )}

        {/* Auth Guard: If not logged in, show Login Screen */}
        {!token ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-sm w-full bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 text-center mb-1">
                Masuk Panel Owner
              </h3>
              <p className="text-xs text-slate-500 text-center mb-5">
                Masukkan kata sandi pengelola untuk mengelola booking dan jadwal lapangan.
              </p>

              {loginError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl mb-4">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kata Sandi Owner
                  </label>
                  <input
                    id="input-owner-password"
                    type="password"
                    placeholder="Masukkan kata sandi..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <div className="text-[11px] text-slate-500 mt-1.5 bg-slate-100 p-2 rounded-lg">
                    Kata sandi bawaan demo: <strong className="text-emerald-800 font-mono">arena2026</strong>
                  </div>
                </div>

                <button
                  id="btn-submit-owner-login"
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loginLoading ? 'Memeriksa...' : 'Masuk ke Dashboard'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Logged In: Owner Operations Center */
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Action Bar & Daily Operational Stats (Section 6: Utamakan pekerjaan harian) */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
              {/* Daily Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Booking Aktif Hari Ini</div>
                  <div className="text-lg font-black text-slate-900">{stats.todayBookingsCount} pesanan</div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Total Jam Terpesan</div>
                  <div className="text-lg font-black text-emerald-800">{stats.todayTotalHours} jam</div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Belum Lunas</div>
                  <div className="text-lg font-black text-amber-700">{stats.unpaidCount} booking</div>
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500">Total Belum Terbayar</div>
                  <div className="text-lg font-black text-rose-700">{formatRupiah(stats.unpaidTotalAmount)}</div>
                </div>
              </div>

              {/* Navigation Tabs & Primary Action */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none touch-pan-x -mx-1 px-1">
                  <button
                    type="button"
                    id="tab-owner-daily"
                    onClick={() => setActiveTab('daily')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] active:scale-95 ${
                      activeTab === 'daily'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Jadwal & Booking Harian
                  </button>
                  <button
                    type="button"
                    id="tab-owner-closures"
                    onClick={() => setActiveTab('closures')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] active:scale-95 ${
                      activeTab === 'closures'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Penutupan Lapangan ({closures.length})
                  </button>
                  <button
                    type="button"
                    id="tab-owner-settings"
                    onClick={() => setActiveTab('settings')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] active:scale-95 ${
                      activeTab === 'settings'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Pengaturan
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-owner-add-booking"
                    onClick={() => setShowAddBookingModal(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Tambah Booking Manual</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TAB 1: DAILY BOOKINGS & TIMELINE */}
            {activeTab === 'daily' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Filter & Search Toolbar */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="owner-search-input"
                        type="text"
                        placeholder="Cari nama, kode booking, tim, atau WA..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Date Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">Tanggal:</span>
                      <input
                        id="owner-date-filter"
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setFilterDate(todayDate)}
                        className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Hari Ini
                      </button>
                    </div>
                  </div>

                  {/* Status & Payment Filters */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">Status:</span>
                    {['all', 'confirmed', 'completed', 'cancelled'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFilterBookingStatus(st)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          filterBookingStatus === st
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st === 'all'
                          ? 'Semua Status'
                          : st === 'confirmed'
                          ? 'Terkonfirmasi'
                          : st === 'completed'
                          ? 'Selesai'
                          : 'Dibatalkan'}
                      </button>
                    ))}

                    <span className="text-slate-400 mx-1">|</span>
                    <span className="text-slate-500 font-medium">Pembayaran:</span>
                    {['all', 'paid', 'unpaid'].map((pst) => (
                      <button
                        key={pst}
                        type="button"
                        onClick={() => setFilterPaymentStatus(pst)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          filterPaymentStatus === pst
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pst === 'all' ? 'Semua' : pst === 'paid' ? 'Lunas' : 'Belum Lunas'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bookings List (Optimized for Mobile & Desktop) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>
                      Daftar Jadwal Tanggal {formatIndonesianDate(filterDate)} ({filteredBookings.length} booking)
                    </span>
                    <button
                      type="button"
                      onClick={() => loadDashboardData(token)}
                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Muat Ulang</span>
                    </button>
                  </div>

                  {filteredBookings.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                      Tidak ada booking pada tanggal ini yang sesuai kriteria pencarian.
                    </div>
                  ) : (
                    filteredBookings.map((b) => (
                      <div
                        key={b.id}
                        id={`owner-booking-card-${b.bookingCode}`}
                        className={`bg-white rounded-xl border p-4 shadow-2xs transition-all ${
                          b.bookingStatus === 'cancelled'
                            ? 'border-slate-200 bg-slate-50/70 opacity-60'
                            : b.paymentStatus === 'paid'
                            ? 'border-emerald-200 hover:border-emerald-400'
                            : 'border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              {b.bookingCode}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.bookingStatus === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.bookingStatus === 'cancelled'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {b.bookingStatus === 'confirmed'
                                ? 'Terkonfirmasi'
                                : b.bookingStatus === 'cancelled'
                                ? 'Dibatalkan'
                                : 'Selesai'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {b.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-medium">
                              via {b.bookingSource}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-500">
                            {formatIndonesianDate(b.date)}
                          </div>
                        </div>

                        {/* Customer & Schedule Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                          <div>
                            <div className="text-slate-500 text-[11px]">Waktu Sewa:</div>
                            <div className="font-black text-slate-900 text-sm">
                              {b.startTime} – {b.endTime} WIB
                            </div>
                            <div className="text-emerald-800 font-semibold">
                              Durasi: {formatDuration(b.durationMinutes)}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-[11px]">Pemesan:</div>
                            <div className="font-bold text-slate-900">{b.customerName}</div>
                            <div className="text-slate-600 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{b.customerWhatsapp}</span>
                            </div>
                            {b.teamName && (
                              <div className="text-slate-500 text-[11px]">Tim: {b.teamName}</div>
                            )}
                          </div>

                          <div>
                            <div className="text-slate-500 text-[11px]">Total Tarif:</div>
                            <div className="font-black text-emerald-700 text-base">
                              {formatRupiah(b.totalPrice)}
                            </div>
                            {b.notes && (
                              <div className="text-[11px] text-slate-500 bg-slate-100 p-1.5 rounded mt-1 italic">
                                "{b.notes}"
                              </div>
                            )}
                            {b.cancellationReason && (
                              <div className="text-[11px] text-rose-700 font-semibold mt-1">
                                Alasan batal: {b.cancellationReason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions for this booking */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {/* Toggle Payment */}
                          {b.bookingStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus = b.paymentStatus === 'paid' ? 'unpaid' : 'paid';
                                try {
                                  await ownerUpdatePayment(token, b.id, nextStatus);
                                  showNotice('success', `Status pembayaran diubah ke ${nextStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}`);
                                  loadDashboardData(token);
                                } catch (err: any) {
                                  showNotice('error', err.message);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                                b.paymentStatus === 'paid'
                                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              {b.paymentStatus === 'paid' ? 'Tandai Belum Lunas' : 'Tandai Lunas'}
                            </button>
                          )}

                          {/* Reschedule */}
                          {b.bookingStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => setRescheduleBookingTarget(b)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            >
                              Ubah Jadwal
                            </button>
                          )}

                          {/* Edit Contact / Notes */}
                          <button
                            type="button"
                            onClick={() => setEditContactTarget(b)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            Ubah Kontak
                          </button>

                          {/* WhatsApp Customer */}
                          <a
                            href={`https://wa.me/${b.customerWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Halo Kak ${b.customerName}, kami dari pengelola ${settings?.name || 'MiniSoccer Arena'} terkait booking ${b.bookingCode} jadwal ${b.date} pukul ${b.startTime} WIB.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WA Pelanggan</span>
                          </a>

                          {/* Cancel Booking */}
                          {b.bookingStatus !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const confirmCancel = window.confirm(
                                  `Apakah Anda yakin ingin membatalkan booking ${b.bookingCode} atas nama ${b.customerName}? Rentang waktu akan terbuka kembali pada jadwal publik.`
                                );
                                if (confirmCancel) {
                                  const reason = prompt('Masukkan alasan pembatalan (opsional):') || undefined;
                                  try {
                                    await ownerCancelBooking(token, b.id, reason);
                                    showNotice('success', `Booking ${b.bookingCode} berhasil dibatalkan.`);
                                    loadDashboardData(token);
                                  } catch (err: any) {
                                    showNotice('error', err.message);
                                  }
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                            >
                              Batalkan Booking
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: FIELD CLOSURES (Section 7) */}
            {activeTab === 'closures' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Penutupan Lapangan Khusus
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tutup waktu tertentu untuk perawatan rumput, perbaikan lampu, atau acara khusus.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddClosureModal(true)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Tutup Jadwal</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {closures.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                      Belum ada penutupan jadwal khusus.
                    </div>
                  ) : (
                    closures.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white rounded-xl border border-amber-200 p-3.5 flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                            <Ban className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {formatIndonesianDate(c.date)} • {c.startTime} – {c.endTime} WIB
                            </div>
                            <div className="text-xs text-amber-900 font-medium">{c.reason}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('Buka kembali jadwal yang ditutup ini?')) {
                              try {
                                await ownerDeleteClosure(token, c.id);
                                showNotice('success', 'Penutupan dihapus, jadwal kembali tersedia.');
                                loadDashboardData(token);
                              } catch (err: any) {
                                showNotice('error', err.message);
                              }
                            }
                          }}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1.5 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Penutupan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SETTINGS (Section 7) */}
            {activeTab === 'settings' && settings && (
              <OwnerSettingsForm
                settings={settings}
                token={token}
                onSaved={(newS) => {
                  setSettings(newS);
                  showNotice('success', 'Pengaturan arena berhasil disimpan.');
                  loadDashboardData(token);
                }}
                onResetDemo={async () => {
                  if (window.confirm('Apakah Anda yakin ingin mereset seluruh data ke data demo standar?')) {
                    try {
                      await ownerResetDemo(token);
                      showNotice('success', 'Data demo berhasil direset.');
                      loadDashboardData(token);
                    } catch (err: any) {
                      showNotice('error', err.message);
                    }
                  }
                }}
              />
            )}
          </div>
        )}

        {/* MODAL: ADD MANUAL BOOKING (Section 6) */}
        {showAddBookingModal && settings && (
          <OwnerAddBookingModal
            settings={settings}
            token={token!}
            onClose={() => setShowAddBookingModal(false)}
            onSuccess={() => {
              setShowAddBookingModal(false);
              showNotice('success', 'Booking manual berhasil ditambahkan dan langsung terisi di jadwal.');
              loadDashboardData(token!);
            }}
          />
        )}

        {/* MODAL: RESCHEDULE BOOKING (Section 6) */}
        {rescheduleBookingTarget && settings && (
          <OwnerRescheduleModal
            booking={rescheduleBookingTarget}
            settings={settings}
            token={token!}
            onClose={() => setRescheduleBookingTarget(null)}
            onSuccess={() => {
              setRescheduleBookingTarget(null);
              showNotice('success', 'Jadwal booking berhasil diperbarui.');
              loadDashboardData(token!);
            }}
          />
        )}

        {/* MODAL: EDIT CONTACT / NOTES */}
        {editContactTarget && (
          <OwnerEditContactModal
            booking={editContactTarget}
            token={token!}
            onClose={() => setEditContactTarget(null)}
            onSuccess={() => {
              setEditContactTarget(null);
              showNotice('success', 'Informasi kontak berhasil diperbarui.');
              loadDashboardData(token!);
            }}
          />
        )}

        {/* MODAL: ADD CLOSURE (Section 7) */}
        {showAddClosureModal && (
          <OwnerAddClosureModal
            token={token!}
            onClose={() => setShowAddClosureModal(false)}
            onSuccess={() => {
              setShowAddClosureModal(false);
              showNotice('success', 'Penutupan jadwal berhasil ditambahkan.');
              loadDashboardData(token!);
            }}
          />
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// SUB-MODALS & SUB-COMPONENTS FOR OWNER PANEL
// -------------------------------------------------------------

function OwnerSettingsForm({
  settings,
  token,
  onSaved,
  onResetDemo,
}: {
  settings: VenueSettings;
  token: string;
  onSaved: (s: VenueSettings) => void;
  onResetDemo: () => void;
}) {
  const [formData, setFormData] = useState<VenueSettings>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await ownerUpdateSettings(token, formData);
      onSaved(updated);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* 1. Identitas Tempat */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Identitas Lapangan
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Tempat</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
              required
            />
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
            <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>Nomor WhatsApp Pengelola / Admin</span>
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                Tujuan Chat Pelanggan
              </span>
            </label>
            <input
              type="text"
              id="input-owner-whatsapp"
              value={formData.ownerWhatsapp}
              onChange={(e) => setFormData({ ...formData, ownerWhatsapp: e.target.value })}
              className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              placeholder="Contoh: 081234567890 atau 6281234567890"
              required
            />
            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              Nomor ini digunakan pelanggan untuk konfirmasi booking otomatis dan chat WhatsApp langsung setelah booking selesai. Gunakan format diawali <strong>08...</strong> atau <strong>62...</strong>
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              required
            />
          </div>
        </div>
      </div>

      {/* 2. Operasional & Jeda */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Jam Operasional & Ketentuan Sewa
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Jam Buka (HH:mm)</label>
            <input
              type="text"
              value={formData.openTime}
              onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Jam Tutup (HH:mm)</label>
            <input
              type="text"
              value={formData.closeTime}
              onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Durasi Min (menit)</label>
            <input
              type="number"
              value={formData.minDurationMinutes}
              onChange={(e) => setFormData({ ...formData, minDurationMinutes: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Jeda Antarsewa (menit)</label>
            <input
              type="number"
              value={formData.bufferMinutes}
              onChange={(e) => setFormData({ ...formData, bufferMinutes: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold text-emerald-800"
              min={0}
              step={5}
            />
          </div>
        </div>
      </div>

      {/* 3. Tarif Dasar & Aturan Khusus */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Tarif Sewa Lapangan
        </h4>
        <div className="text-xs">
          <label className="block font-bold text-slate-700 mb-1">Tarif Dasar per Jam (Rp)</label>
          <input
            type="number"
            value={formData.baseHourlyRate}
            onChange={(e) => setFormData({ ...formData, baseHourlyRate: Number(e.target.value) })}
            className="w-full sm:w-1/2 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-extrabold text-sm"
            required
            step={10000}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Tarif awal Rp300.000 per jam. Pecahan jam dihitung proporsional per menit.
          </p>
        </div>

        {/* Special Rate Rules Preview / Toggle */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Aturan Tarif Khusus (Peak / Weekend):</span>
          </div>
          <div className="space-y-2 text-xs">
            {formData.specialRates.map((rule, idx) => (
              <div key={rule.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{rule.name}</div>
                  <div className="text-slate-500 text-[11px]">
                    {rule.startTime} – {rule.endTime} • {formatRupiah(rule.hourlyRate)}/jam
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={(e) => {
                      const copy = [...formData.specialRates];
                      copy[idx].isActive = e.target.checked;
                      setFormData({ ...formData, specialRates: copy });
                    }}
                    className="accent-emerald-600 rounded"
                  />
                  <span>{rule.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Ketentuan & Kebijakan */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
          Ketentuan & Kebijakan Pelanggan
        </h4>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ketentuan Pembayaran</label>
            <input
              type="text"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ketentuan Pembatalan</label>
            <input
              type="text"
              value={formData.cancellationPolicy}
              onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onResetDemo}
          className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer"
        >
          Reset Seluruh Data ke Demo Awal
        </button>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan Pengaturan'}
        </button>
      </div>
    </form>
  );
}

// Modal: Owner Manual Booking (Phone, WA, Walk-in)
function OwnerAddBookingModal({
  settings,
  token,
  onClose,
  onSuccess,
}: {
  settings: VenueSettings;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(getJakartaDateString());
  const [startTime, setStartTime] = useState('14:45');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [teamName, setTeamName] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingSource, setBookingSource] = useState<BookingSource>('whatsapp');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCalc = calculatePrice(date, startTime, durationMinutes, settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerWhatsapp.trim()) {
      setError('Nama dan WhatsApp pelanggan wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await ownerCreateBooking(token, {
        date,
        startTime,
        durationMinutes,
        customerName,
        customerWhatsapp,
        teamName,
        notes,
        bookingSource,
        paymentStatus,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan booking manual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-base">Tambah Booking Manual</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="py-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Waktu Mulai</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="14:45"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Durasi (Menit)</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                <option value={60}>60 menit (1 jam)</option>
                <option value={90}>90 menit (1.5 jam)</option>
                <option value={120}>120 menit (2 jam)</option>
                <option value={180}>180 menit (3 jam)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Sumber Booking</label>
              <select
                value={bookingSource}
                onChange={(e) => setBookingSource(e.target.value as any)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Telepon</option>
                <option value="walk-in">Datang Langsung</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center">
            <span className="font-medium text-emerald-900">Total Tarif Otomatis:</span>
            <span className="font-black text-emerald-800 text-sm">{formatRupiah(priceCalc.totalPrice)}</span>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Pemesan</label>
            <input
              type="text"
              placeholder="Nama pelanggan"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp</label>
            <input
              type="tel"
              placeholder="0812..."
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Tim (Opsional)</label>
              <input
                type="text"
                placeholder="Nama tim"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Status Pembayaran</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
              >
                <option value="unpaid">Belum Lunas</option>
                <option value="paid">Lunas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan</label>
            <input
              type="text"
              placeholder="Catatan kebutuhan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal: Reschedule Booking (Section 6: Validasi jadwal & harga baru sebelum simpan, jika gagal jadwal lama utuh)
function OwnerRescheduleModal({
  booking,
  settings,
  token,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  settings: VenueSettings;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(booking.date);
  const [startTime, setStartTime] = useState(booking.startTime);
  const [durationMinutes, setDurationMinutes] = useState(booking.durationMinutes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCalc = calculatePrice(date, startTime, durationMinutes, settings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await ownerRescheduleBooking(token, booking.id, date, startTime, durationMinutes);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah jadwal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-base">Ubah Jadwal Booking</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-500 py-2">
          Booking: <strong>{booking.bookingCode}</strong> ({booking.customerName})
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tanggal Baru</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Waktu Mulai</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Durasi</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              >
                <option value={60}>60 menit (1 jam)</option>
                <option value={90}>90 menit (1.5 jam)</option>
                <option value={120}>120 menit (2 jam)</option>
                <option value={180}>180 menit (3 jam)</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex justify-between text-slate-500">
              <span>Tarif Lama:</span>
              <span className="line-through">{formatRupiah(booking.totalPrice)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800">
              <span>Tarif Baru Sesuai Jadwal:</span>
              <span className="text-emerald-700 text-sm">{formatRupiah(priceCalc.totalPrice)}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Jadwal Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal: Edit Contact / Notes
function OwnerEditContactModal({
  booking,
  token,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customerName, setCustomerName] = useState(booking.customerName);
  const [customerWhatsapp, setCustomerWhatsapp] = useState(booking.customerWhatsapp);
  const [teamName, setTeamName] = useState(booking.teamName || '');
  const [notes, setNotes] = useState(booking.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await ownerUpdateContact(token, booking.id, {
        customerName,
        customerWhatsapp,
        teamName,
        notes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan kontak.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-base">Ubah Kontak & Catatan</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="py-3 space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp</label>
            <input
              type="tel"
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nama Tim</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Catatan</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal: Add Closure (Section 7: checks collision with active bookings, does not auto-cancel)
function OwnerAddClosureModal({
  token,
  onClose,
  onSuccess,
}: {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(getJakartaDateString());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [reason, setReason] = useState('Perawatan Rumput Berkala');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await ownerAddClosure(token, date, startTime, endTime, reason);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan penutupan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-base">Tutup Rentang Jadwal</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="py-3 space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jam Mulai Tutup</label>
              <input
                type="text"
                placeholder="08:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jam Selesai Tutup</label>
              <input
                type="text"
                placeholder="11:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Alasan Penutupan</label>
            <input
              type="text"
              placeholder="Contoh: Perawatan Rumput, Turnamen Khusus..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
            >
              {loading ? 'Menyimpan...' : 'Simpan Penutupan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
