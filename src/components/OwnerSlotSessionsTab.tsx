import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  Plus,
  Clock,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  Tag,
  Layers,
  Database,
  Sparkles,
  Loader2,
  Pencil,
  Timer,
} from 'lucide-react';
import { SlotSessionConfig } from '../types';
import { ownerResetSlotSessionsDefault, ownerUpdateSlotSessions } from '../api';
import { formatDuration, formatRupiah, sortSlotSessions, timeToMinutes, minutesToTime } from '../utils/timeUtils';

interface OwnerSlotSessionsTabProps {
  token: string;
  initialSessions: SlotSessionConfig[];
  onSessionsUpdated: (newSessions: SlotSessionConfig[]) => void;
  showNotice: (type: 'success' | 'error', text: string) => void;
}

export const OwnerSlotSessionsTab: React.FC<OwnerSlotSessionsTabProps> = ({
  token,
  initialSessions,
  onSessionsUpdated,
  showNotice,
}) => {
  const [sessions, setSessions] = useState<SlotSessionConfig[]>(() =>
    sortSlotSessions(initialSessions || [], '07:00')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // New session modal / inline form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStartTime, setNewStartTime] = useState('18:30');
  const [newEndTime, setNewEndTime] = useState('20:00');
  const [newDuration, setNewDuration] = useState(90);
  const [newLabel, setNewLabel] = useState('Sore Khusus');
  const [newWeekdayPrice, setNewWeekdayPrice] = useState(600000);
  const [newWeekendPrice, setNewWeekendPrice] = useState(700000);

  // Edit session modal state
  const [editingSession, setEditingSession] = useState<SlotSessionConfig | null>(null);

  const handleUpdateField = (id: string, field: keyof SlotSessionConfig, value: any) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
    setIsDirty(true);
  };

  const handleToggleActive = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
    setIsDirty(true);
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      showNotice('error', 'Minimal harus ada 1 sesi jadwal.');
      return;
    }
    const sessionToDelete = sessions.find((s) => s.id === id);
    const confirmMsg = sessionToDelete
      ? `Hapus sesi ${sessionToDelete.startTime}–${sessionToDelete.endTime} (${sessionToDelete.label})?`
      : 'Hapus sesi ini?';
    if (!window.confirm(confirmMsg)) return;

    setSessions((prev) => prev.filter((s) => s.id !== id));
    setIsDirty(true);
    showNotice('success', 'Sesi dihapus dari daftar sementara. Klik "Simpan Perubahan ke MySQL" untuk menyimpan.');
  };

  const handleOpenEditModal = (session: SlotSessionConfig) => {
    setEditingSession({ ...session });
  };

  const handleSaveEditedSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    // Calculate duration based on start and end time if not custom
    let sStart = timeToMinutes(editingSession.startTime);
    let sEnd = timeToMinutes(editingSession.endTime);
    if (sEnd <= sStart && sEnd <= 360) sEnd += 1440;
    const computedDuration = sEnd > sStart ? sEnd - sStart : editingSession.durationMinutes;

    const updated: SlotSessionConfig = {
      ...editingSession,
      startTime: editingSession.startTime.trim(),
      endTime: editingSession.endTime.trim(),
      durationMinutes: editingSession.durationMinutes || computedDuration,
      label: (editingSession.label || '').trim() || 'Sesi Lapangan',
      weekdayPrice: Number(editingSession.weekdayPrice),
      weekendPrice: Number(editingSession.weekendPrice),
    };

    setSessions((prev) =>
      sortSlotSessions(
        prev.map((s) => (s.id === updated.id ? updated : s)),
        '07:00'
      )
    );
    setIsDirty(true);
    setEditingSession(null);
    showNotice(
      'success',
      `Sesi ${updated.startTime}–${updated.endTime} (${formatDuration(updated.durationMinutes)}) berhasil diperbarui. Klik "Simpan Perubahan ke MySQL" untuk menyimpan permanen.`
    );
  };

  const handleSaveToMySQL = async () => {
    setIsSaving(true);
    try {
      const res = await ownerUpdateSlotSessions(token, sessions);
      setSessions(res.slotSessions);
      onSessionsUpdated(res.slotSessions);
      setIsDirty(false);
      setLastSaved(new Date().toLocaleTimeString('id-ID'));
      showNotice(
        'success',
        res.mysqlSynced
          ? 'Jadwal sesi berhasil disimpan dan disinkronkan ke database MySQL!'
          : 'Jadwal sesi berhasil diperbarui.'
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menyimpan sesi jadwal ke MySQL.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToStandard = async () => {
    if (!window.confirm('Reset semua jadwal sesi ke standar brosur FalseNine resmi?')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await ownerResetSlotSessionsDefault(token);
      setSessions(res.slotSessions);
      onSessionsUpdated(res.slotSessions);
      setIsDirty(false);
      setLastSaved(new Date().toLocaleTimeString('id-ID'));
      showNotice('success', 'Jadwal sesi berhasil direset ke standar Pricelist FalseNine!');
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal mereset sesi ke standar.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession: SlotSessionConfig = {
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startTime: newStartTime.trim(),
      endTime: newEndTime.trim(),
      durationMinutes: Number(newDuration),
      label: newLabel.trim() || 'Sesi Kustom',
      weekdayPrice: Number(newWeekdayPrice),
      weekendPrice: Number(newWeekendPrice),
      isActive: true,
    };

    setSessions((prev) => sortSlotSessions([...prev, newSession], '07:00'));
    setIsDirty(true);
    setShowAddModal(false);
    showNotice(
      'success',
      `Sesi ${newSession.startTime}–${newSession.endTime} berhasil ditambahkan. Klik "Simpan Perubahan ke MySQL" untuk menyimpan permanen.`
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" id="owner-slot-sessions-tab">
      {/* Blueprint Header & Flyer Reference */}
      <div className="bg-emerald-950 text-white rounded-2xl p-4 sm:p-5 border border-emerald-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                FalseNine Arena Management
              </span>
              <span className="text-xs text-stone-300">Konfigurasi Jadwal Resmi</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              Kelola Sesi Jadwal Lapangan & Pricelist
            </h3>
            <p className="text-xs text-stone-300 mt-1 max-w-2xl">
              Jadwal lapangan <strong>mengikuti paket sesi resmi</strong> di bawah ini. Anda dapat mengedit jam mulai, jam selesai, durasi, nama sesi, serta tarif weekday/weekend secara fleksibel.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="btn-reset-sessions-default"
              onClick={handleResetToStandard}
              disabled={isResetting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl border border-stone-700 cursor-pointer transition-all disabled:opacity-50 min-h-[38px]"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Standar Brosur</span>
            </button>

            <button
              type="button"
              id="btn-save-sessions-mysql"
              onClick={handleSaveToMySQL}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer transition-all disabled:opacity-50 min-h-[38px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke MySQL...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan ke MySQL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {lastSaved && (
          <div className="text-[11px] text-emerald-300/80 mt-2">
            Terakhir disimpan: {lastSaved}
          </div>
        )}
      </div>

      {/* Pricing Flyer Quick Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-700" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Panduan Standar Brosur FalseNine Arena
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Brosur Resmi</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-3">
            <div className="font-black text-emerald-950 mb-1 flex items-center justify-between">
              <span>🗓️ TARIF WEEKDAY (Senin – Kamis)</span>
              <span className="text-[10px] bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-md font-bold">Resmi</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <div className="bg-white p-2 rounded-lg border border-emerald-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Pagi (07-10)</div>
                <div className="font-extrabold text-slate-900">Rp 300.000 <span className="font-normal text-[10px]">/ jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Siang (10-15)</div>
                <div className="font-extrabold text-slate-900">Rp 250.000 <span className="font-normal text-[10px]">/ jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Sore (15-18)</div>
                <div className="font-extrabold text-slate-900">Rp 350.000 <span className="font-normal text-[10px]">/ jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Prime (20-00)</div>
                <div className="font-extrabold text-emerald-800">Rp 900.000 <span className="font-normal text-[10px]">/ 2 jam</span></div>
              </div>
            </div>
          </div>

          <div className="border border-amber-100 bg-amber-50/40 rounded-xl p-3">
            <div className="font-black text-amber-950 mb-1 flex items-center justify-between">
              <span>🌟 TARIF WEEKEND (Jumat – Minggu)</span>
              <span className="text-[10px] bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-md font-bold">Resmi</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              <div className="bg-white p-2 rounded-lg border border-amber-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Pagi (07-10)</div>
                <div className="font-extrabold text-slate-900">Rp 350.000 <span className="font-normal text-[10px]">/ jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Siang (10-15)</div>
                <div className="font-extrabold text-slate-900">Rp 300.000 <span className="font-normal text-[10px]">/ jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Sore (17-18:30)</div>
                <div className="font-extrabold text-slate-900">Rp 650.000 <span className="font-normal text-[10px]">/ 1.5 jam</span></div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-200/60">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Prime (20-00)</div>
                <div className="font-extrabold text-amber-800">Rp 1.100.000 <span className="font-normal text-[10px]">/ 2 jam</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slot Sessions List & Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Daftar Sesi Jadwal Aktif ({sessions.length} Sesi)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik tombol <strong>Edit (✏️)</strong> untuk mengubah jam atau durasi sesi, atau sesuaikan tarif dan label langsung pada tabel.
            </p>
          </div>

          <button
            type="button"
            id="btn-open-add-session-modal"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Sesi Baru</span>
          </button>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Jam Sesi</th>
                <th className="py-3 px-3">Durasi</th>
                <th className="py-3 px-3">Kategori Label</th>
                <th className="py-3 px-3">Harga Weekday</th>
                <th className="py-3 px-3">Harga Weekend</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => {
                const isPrime =
                  session.startTime >= '20:00' ||
                  (session.label ? session.label.toLowerCase().includes('prime') : false);

                return (
                  <tr
                    key={session.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !session.isActive ? 'bg-slate-50/50 opacity-60' : ''
                    }`}
                  >
                    {/* Time Range with quick Edit button */}
                    <td className="py-3 px-4 font-black text-slate-900 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors">
                          <Clock className="w-3.5 h-3.5 text-emerald-800" />
                          <span>
                            {session.startTime} – {session.endTime}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(session)}
                          className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          title="Ubah jam atau durasi sesi ini"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(session)}
                        className="font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        title="Klik untuk ubah durasi"
                      >
                        <Timer className="w-3 h-3 text-slate-500" />
                        <span>{formatDuration(session.durationMinutes)}</span>
                      </button>
                    </td>

                    {/* Label */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={session.label}
                        onChange={(e) => handleUpdateField(session.id, 'label', e.target.value)}
                        className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs text-slate-800 w-32 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                      />
                    </td>

                    {/* Weekday Price */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[11px]">Rp</span>
                        <input
                          type="number"
                          step={10000}
                          value={session.weekdayPrice}
                          onChange={(e) =>
                            handleUpdateField(session.id, 'weekdayPrice', Number(e.target.value))
                          }
                          className="w-28 px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                    </td>

                    {/* Weekend Price */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[11px]">Rp</span>
                        <input
                          type="number"
                          step={10000}
                          value={session.weekendPrice}
                          onChange={(e) =>
                            handleUpdateField(session.id, 'weekendPrice', Number(e.target.value))
                          }
                          className="w-28 px-2 py-1 bg-white border border-slate-300 rounded font-bold text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                        />
                      </div>
                    </td>

                    {/* Active toggle */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(session.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer transition-colors ${
                          session.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {session.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(session)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-800 hover:bg-emerald-50 rounded-lg font-bold text-[11px] transition-colors cursor-pointer border border-emerald-200"
                          title="Edit Jam & Durasi Sesi"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus sesi ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer save banner */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {isDirty ? (
              <span className="text-amber-700 font-bold">
                ⚠️ Ada perubahan jam, tarif, atau status sesi yang belum disimpan ke MySQL!
              </span>
            ) : (
              <span>Semua data sesi sinkron dengan database server.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToMySQL}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Perubahan ke MySQL</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Edit Sesi Jadwal (Jam, Durasi, Label, Tarif) */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Edit Sesi Jadwal Lapangan
                  </h3>
                  <p className="text-[11px] text-slate-500">Ubah jam mulai, jam selesai, durasi, dan tarif</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveEditedSession} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai (HH:mm)</label>
                  <input
                    type="text"
                    value={editingSession.startTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setEditingSession((prev) => {
                        if (!prev) return null;
                        return { ...prev, startTime: newStart };
                      });
                    }}
                    placeholder="07:00"
                    pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Format 24 jam (misal 07:00)</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai (HH:mm)</label>
                  <input
                    type="text"
                    value={editingSession.endTime}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setEditingSession((prev) => {
                        if (!prev) return null;
                        return { ...prev, endTime: newEnd };
                      });
                    }}
                    placeholder="08:00"
                    pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Format 24 jam (misal 08:00)</span>
                </div>
              </div>

              {/* Quick Preset Buttons for Duration */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Durasi Sesi Main</span>
                  <span className="text-[11px] text-emerald-800 font-bold">
                    {formatDuration(editingSession.durationMinutes)} ({editingSession.durationMinutes} menit)
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[60, 90, 120, 180].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => {
                        setEditingSession((prev) => {
                          if (!prev) return null;
                          const sStart = timeToMinutes(prev.startTime);
                          const calculatedEnd = minutesToTime((sStart + dur) % 1440);
                          return {
                            ...prev,
                            durationMinutes: dur,
                            endTime: calculatedEnd,
                          };
                        });
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-colors cursor-pointer border ${
                        editingSession.durationMinutes === dur
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      {dur === 60 ? '1 Jam' : dur === 90 ? '1.5 Jam' : dur === 120 ? '2 Jam' : '3 Jam'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">Atau input manual:</span>
                  <input
                    type="number"
                    min={30}
                    step={15}
                    value={editingSession.durationMinutes}
                    onChange={(e) =>
                      setEditingSession((prev) =>
                        prev ? { ...prev, durationMinutes: Number(e.target.value) } : null
                      )
                    }
                    className="w-24 p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                  />
                  <span className="text-[11px] text-slate-500">menit</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama / Kategori Label</label>
                <input
                  type="text"
                  value={editingSession.label}
                  onChange={(e) =>
                    setEditingSession((prev) =>
                      prev ? { ...prev, label: e.target.value } : null
                    )
                  }
                  placeholder="Misal: Pagi 1, Prime Night 1, Sore"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tarif Weekday (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={editingSession.weekdayPrice}
                    onChange={(e) =>
                      setEditingSession((prev) =>
                        prev ? { ...prev, weekdayPrice: Number(e.target.value) } : null
                      )
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tarif Weekend (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={editingSession.weekendPrice}
                    onChange={(e) =>
                      setEditingSession((prev) =>
                        prev ? { ...prev, weekendPrice: Number(e.target.value) } : null
                      )
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl cursor-pointer shadow-sm transition-all"
                >
                  Terapkan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Sesi Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-extrabold text-slate-900 text-base mb-3 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Tambah Sesi Jadwal Baru</span>
            </h3>

            <form onSubmit={handleAddSessionSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Mulai (HH:mm)</label>
                  <input
                    type="text"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    placeholder="18:30"
                    pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Selesai (HH:mm)</label>
                  <input
                    type="text"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    placeholder="20:00"
                    pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi (Menit)</label>
                  <select
                    value={newDuration}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      setNewDuration(dur);
                      const sStart = timeToMinutes(newStartTime);
                      setNewEndTime(minutesToTime((sStart + dur) % 1440));
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value={60}>60 menit (1 jam)</option>
                    <option value={90}>90 menit (1.5 jam)</option>
                    <option value={120}>120 menit (2 jam)</option>
                    <option value={180}>180 menit (3 jam)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori / Label</label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Misal: Sore Khusus"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tarif Weekday (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={newWeekdayPrice}
                    onChange={(e) => setNewWeekdayPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tarif Weekend (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={newWeekendPrice}
                    onChange={(e) => setNewWeekendPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl cursor-pointer shadow-sm"
                >
                  Tambahkan Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
