import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  MessageSquare,
  CheckCircle,
  XCircle,
  Database,
  ExternalLink,
  Shield,
  Sparkles,
  Loader2,
  X,
  Filter,
} from 'lucide-react';
import { Member, MemberInput } from '../types';
import {
  fetchOwnerMembers,
  ownerCreateMember,
  ownerDeleteMember,
  ownerUpdateMember,
} from '../api';
import { formatPhoneDisplay, normalizeWhatsappNumber } from '../utils/timeUtils';

interface OwnerMembersTabProps {
  token: string;
  showNotice: (type: 'success' | 'error', text: string) => void;
}

export const OwnerMembersTab: React.FC<OwnerMembersTabProps> = ({ token, showNotice }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [savingMember, setSavingMember] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formTeamName, setFormTeamName] = useState('');
  const [formTier, setFormTier] = useState<string>('COMMUNITY');
  const [formDiscount, setFormDiscount] = useState<number>(10);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  const isMemberActive = (m: Member): boolean => {
    if (typeof m.isActive === 'boolean') return m.isActive;
    return m.status === 'active';
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await fetchOwnerMembers(token);
      setMembers(data);
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal memuat data member.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [token]);

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setFormName('');
    setFormWhatsapp('');
    setFormTeamName('');
    setFormTier('COMMUNITY');
    setFormDiscount(10);
    setFormIsActive(true);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormWhatsapp(member.whatsapp);
    setFormTeamName(member.teamName || '');
    setFormTier(member.tier);
    setFormDiscount(member.discountPercentage);
    setFormIsActive(isMemberActive(member));
    setFormNotes(member.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formWhatsapp.trim()) {
      showNotice('error', 'Nama dan WhatsApp member wajib diisi.');
      return;
    }

    setSavingMember(true);
    try {
      const input: MemberInput = {
        name: formName.trim(),
        whatsapp: formWhatsapp.trim(),
        teamName: formTeamName.trim() || undefined,
        tier: formTier,
        discountPercentage: Number(formDiscount),
        status: formIsActive ? 'active' : 'inactive',
        isActive: formIsActive,
        notes: formNotes.trim() || undefined,
      };

      if (editingMember) {
        const updated = await ownerUpdateMember(token, editingMember.id, input);
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        showNotice('success', `Data member ${updated.name} (${updated.memberCode}) berhasil diperbarui.`);
      } else {
        const created = await ownerCreateMember(token, input);
        setMembers((prev) => [created, ...prev]);
        showNotice('success', `Member baru ${created.name} berhasil didaftarkan dengan kode ${created.memberCode}!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menyimpan member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`Yakin ingin menghapus member ${member.name} (${member.memberCode})?`)) {
      return;
    }

    try {
      await ownerDeleteMember(token, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      showNotice('success', `Member ${member.name} berhasil dihapus dari sistem.`);
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal menghapus member.');
    }
  };

  const handleToggleStatus = async (member: Member) => {
    try {
      const currentlyActive = isMemberActive(member);
      const nextActive = !currentlyActive;
      const updated = await ownerUpdateMember(token, member.id, {
        status: nextActive ? 'active' : 'inactive',
        isActive: nextActive,
      });
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      showNotice(
        'success',
        `Status member ${member.name} diubah menjadi ${isMemberActive(updated) ? 'Aktif' : 'Nonaktif'}.`
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Gagal mengubah status member.');
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchCode = m.memberCode.toLowerCase().includes(q);
        const matchTeam = (m.teamName || '').toLowerCase().includes(q);
        const matchPhone = m.whatsapp.includes(q);
        if (!matchName && !matchCode && !matchTeam && !matchPhone) return false;
      }

      // Tier
      if (filterTier !== 'all' && m.tier !== filterTier) return false;

      // Status
      const active = isMemberActive(m);
      if (filterStatus === 'active' && !active) return false;
      if (filterStatus === 'inactive' && active) return false;

      return true;
    });
  }, [members, searchQuery, filterTier, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => isMemberActive(m)).length;
    const totalBookings = members.reduce((sum, m) => sum + (m.totalBookings || 0), 0);
    const avgDiscount =
      total > 0
        ? Math.round(members.reduce((sum, m) => sum + m.discountPercentage, 0) / total)
        : 10;
    return { total, active, totalBookings, avgDiscount };
  }, [members]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'VIP':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'GOLD':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'COMMUNITY':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'REGULAR':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" id="owner-members-tab">
      {/* Header & Stats Banner */}
      <div className="bg-emerald-950 text-white rounded-2xl p-4 sm:p-5 border border-emerald-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Almansuri Community
              </span>
              <span className="text-xs text-stone-300 font-medium">Sistem Keanggotaan</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Sistem Member & Komunitas</span>
            </h3>
            <p className="text-xs text-stone-300 mt-1 max-w-2xl">
              Kelola daftar anggota tim langganan dan komunitas mini soccer. Member yang terdaftar dapat memasukkan Kode Member saat booking untuk mendapatkan diskon resmi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-add-member-top"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer transition-all min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Member Baru</span>
            </button>
          </div>
        </div>

        {/* Database notice */}
        <div className="mt-3 pt-3 border-t border-emerald-900/80 flex items-center justify-between text-xs text-stone-300">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Tersimpan di tabel MySQL: <code className="bg-emerald-900 px-1.5 py-0.5 rounded text-[11px] text-emerald-200">Member</code></span>
          </div>
          <span className="text-emerald-300 font-semibold text-[11px]">
            {stats.active} Member Aktif dari {stats.total} Terdaftar
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Total Member</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total} Orang</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Member Aktif</div>
          <div className="text-xl font-black text-emerald-800 mt-0.5">{stats.active} Aktif</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Total Booking Member</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">{stats.totalBookings} Booking</div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Rata-rata Diskon</div>
          <div className="text-xl font-black text-purple-700 mt-0.5">{stats.avgDiscount}% OFF</div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-search-members"
            type="text"
            placeholder="Cari kode member, nama, tim, atau nomor WhatsApp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Tier</option>
            <option value="COMMUNITY">Tier Komunitas</option>
            <option value="VIP">Tier VIP</option>
            <option value="GOLD">Tier Gold</option>
            <option value="REGULAR">Tier Reguler</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Saja</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <button
            type="button"
            id="btn-add-member"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
            <div className="text-xs font-bold">Memuat data member...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
            <div className="font-bold text-sm text-slate-700 mb-1">Belum Ada Member yang Cocok</div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
              {searchQuery ? 'Tidak ada member dengan kata kunci pencarian tersebut.' : 'Daftarkan tim atau komunitas langganan Anda sekarang.'}
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              + Daftarkan Member Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Kode Member</th>
                  <th className="py-3 px-3">Nama & Tim</th>
                  <th className="py-3 px-3">WhatsApp</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Diskon</th>
                  <th className="py-3 px-3 text-center">Total Booking</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((member) => {
                  const cleanWa = normalizeWhatsappNumber(member.whatsapp);
                  const waUrl = `https://wa.me/${cleanWa}?text=Halo%20${encodeURIComponent(
                    member.name
                  )},%20terima%20kasih%20telah%20menjadi%20member%20Almansuri%20Arena!`;

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isMemberActive(member) ? 'bg-slate-50/50 opacity-65' : ''
                      }`}
                    >
                      {/* Member Code */}
                      <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-bold text-slate-800">
                          {member.memberCode}
                        </span>
                      </td>

                      {/* Name & Team */}
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-slate-900 text-sm">{member.name}</div>
                        {member.teamName && (
                          <div className="text-[11px] text-emerald-800 font-semibold">
                            Tim: {member.teamName}
                          </div>
                        )}
                        {member.notes && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            {member.notes}
                          </div>
                        )}
                      </td>

                      {/* WhatsApp */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">
                            {formatPhoneDisplay(member.whatsapp)}
                          </span>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded"
                            title="Chat WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getTierBadge(
                            member.tier
                          )}`}
                        >
                          {member.tier}
                        </span>
                      </td>

                      {/* Discount */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                          {member.discountPercentage}% OFF
                        </span>
                      </td>

                      {/* Total Bookings */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800">
                          {member.totalBookings || 0}x main
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer transition-colors ${
                            isMemberActive(member)
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isMemberActive(member) ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(member)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Edit Member"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Hapus Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add or Edit Member */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingMember ? 'Edit Data Member' : 'Daftarkan Member Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingMember
                    ? `Perbarui profil dan tier diskon ${editingMember.memberCode}`
                    : 'Member akan mendapatkan kode unik untuk diskon booking'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Pemesan / Perwakilan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Capt. Andi Wijaya"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor WhatsApp <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Tim / Komunitas
                </label>
                <input
                  type="text"
                  placeholder="Contoh: FalseNine All-Star / Kemang FC"
                  value={formTeamName}
                  onChange={(e) => setFormTeamName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tier Keanggotaan</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="COMMUNITY">Komunitas (Standar 10%)</option>
                    <option value="VIP">VIP (15%)</option>
                    <option value="GOLD">Gold (20%)</option>
                    <option value="REGULAR">Reguler (5%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Diskon (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-black text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Rutin main setiap Kamis jam 20:00"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="form-is-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <label htmlFor="form-is-active" className="font-bold text-slate-800 cursor-pointer">
                  Status Member Aktif (Dapat menggunakan diskon)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{editingMember ? 'Simpan Perubahan' : 'Daftarkan Member'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
