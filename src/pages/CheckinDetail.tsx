import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, CheckCircle2, Circle, Award,
  Plus, UserPlus, Check, X, Search, ChevronLeft, ChevronRight,
  Trash2, Flame, Trophy, Target, FileText, Gift, BookOpen,
  Download, Eye, ThumbsUp, ThumbsDown, Edit2, Upload,
} from 'lucide-react';
import { useStore } from '@/store';
import { CHECKIN_STATUS_LABELS, CHECKIN_STATUS_COLORS } from '../../shared/types';
import {
  fetchCheckinRecords, reviewCheckinRecord,
  fetchEventBadges, createEventBadge, updateEventBadge, deleteEventBadge,
  fetchEventMaterials, createEventMaterial, updateEventMaterial, deleteEventMaterial,
  fetchEventRewards, distributeReward, getExportUrl,
} from '@/lib/api';
import Modal from '@/components/Modal';

type TabKey = 'checkin' | 'review' | 'badges' | 'materials' | 'rewards';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'checkin', label: '打卡管理', icon: Calendar },
  { key: 'review', label: '打卡审核', icon: Eye },
  { key: 'badges', label: '徽章管理', icon: Award },
  { key: 'materials', label: '资料管理', icon: BookOpen },
  { key: 'rewards', label: '奖励发放', icon: Gift },
];

const BADGE_TYPES = [
  { value: 'streak', label: '连续打卡' },
  { value: 'total', label: '累计打卡' },
  { value: 'milestone', label: '里程碑' },
];

const RECORD_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

const RECORD_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const REWARD_STATUS_LABELS: Record<string, string> = {
  pending: '待发放',
  distributed: '已发放',
  not_qualified: '未达标',
};

const REWARD_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  distributed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  not_qualified: 'bg-slate-100 text-slate-500 border-slate-200',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[new Date(dateStr).getDay()];
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function CheckinDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);
  const { selectedCheckinEvent, loadCheckinEvent, addCheckinParticipant, removeCheckinParticipant, doCheckin, doUncheckin, doBatchCheckin } = useStore();

  const [activeTab, setActiveTab] = useState<TabKey>('checkin');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantChild, setNewParticipantChild] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // 审核相关
  const [reviewStatus, setReviewStatus] = useState<string>('pending');
  const [reviewRecordType, setReviewRecordType] = useState<string>('');
  const [reviewRecords, setReviewRecords] = useState<any[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [showReviewModal, setShowReviewModal] = useState<{ record: any; action: 'approve' | 'reject' } | null>(null);

  // 徽章相关
  const [badges, setBadges] = useState<any[]>([]);
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null);
  const [badgeForm, setBadgeForm] = useState({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });

  // 资料相关
  const [materials, setMaterials] = useState<any[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', file_url: '', file_type: 'pdf', sort_order: 0, is_active: true });

  // 奖励相关
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardStatus, setRewardStatus] = useState<string>('');
  const [rewardSearch, setRewardSearch] = useState('');
  const [showRewardModal, setShowRewardModal] = useState<any>(null);
  const [rewardNote, setRewardNote] = useState('');

  useEffect(() => {
    if (eventId) loadCheckinEvent(eventId);
  }, [eventId]);

  useEffect(() => {
    if (selectedCheckinEvent && !selectedCheckinEvent.calendar.some((c: any) => c.date === selectedDate)) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedCheckinEvent.calendar.some((c: any) => c.date === today)) {
        setSelectedDate(today);
      } else if (selectedCheckinEvent.calendar.length > 0) {
        setSelectedDate(selectedCheckinEvent.calendar[selectedCheckinEvent.calendar.length - 1].date);
      }
    }
  }, [selectedCheckinEvent]);

  useEffect(() => {
    if (activeTab === 'review' && eventId) {
      loadReviewRecords();
    }
  }, [activeTab, reviewStatus, reviewRecordType, reviewPage, eventId]);

  useEffect(() => {
    if (activeTab === 'badges' && eventId) {
      loadBadges();
    }
  }, [activeTab, eventId]);

  useEffect(() => {
    if (activeTab === 'materials' && eventId) {
      loadMaterials();
    }
  }, [activeTab, eventId]);

  useEffect(() => {
    if (activeTab === 'rewards' && eventId) {
      loadRewards();
    }
  }, [activeTab, rewardStatus, rewardSearch, eventId]);

  const loadReviewRecords = async () => {
    setLoadingReview(true);
    try {
      const data = await fetchCheckinRecords(eventId, { status: reviewStatus, record_type: reviewRecordType, page: reviewPage, limit: 20 });
      setReviewRecords(data.records);
      setReviewTotal(data.total);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingReview(false);
    }
  };

  const loadBadges = async () => {
    try {
      const data = await fetchEventBadges(eventId);
      setBadges(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await fetchEventMaterials(eventId);
      setMaterials(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const loadRewards = async () => {
    try {
      const data = await fetchEventRewards(eventId, { status: rewardStatus || undefined, search: rewardSearch || undefined });
      setRewards(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleReview = async () => {
    if (!showReviewModal) return;
    try {
      await reviewCheckinRecord(eventId, showReviewModal.record.id, showReviewModal.action === 'approve' ? 'approved' : 'rejected', reviewNote || undefined);
      setShowReviewModal(null);
      setReviewNote('');
      loadReviewRecords();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveBadge = async () => {
    if (!badgeForm.name || !badgeForm.target_days) return;
    try {
      if (editingBadge) {
        await updateEventBadge(eventId, editingBadge.id, badgeForm);
      } else {
        await createEventBadge(eventId, badgeForm);
      }
      setShowBadgeForm(false);
      setEditingBadge(null);
      setBadgeForm({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });
      loadBadges();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteBadge = async (id: number) => {
    if (!confirm('确定删除这个徽章吗？')) return;
    try {
      await deleteEventBadge(eventId, id);
      loadBadges();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.title) return;
    try {
      if (editingMaterial) {
        await updateEventMaterial(eventId, editingMaterial.id, materialForm);
      } else {
        await createEventMaterial(eventId, materialForm);
      }
      setShowMaterialForm(false);
      setEditingMaterial(null);
      setMaterialForm({ title: '', description: '', file_url: '', file_type: 'pdf', sort_order: 0, is_active: true });
      loadMaterials();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm('确定删除这个资料吗？')) return;
    try {
      await deleteEventMaterial(eventId, id);
      loadMaterials();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDistributeReward = async () => {
    if (!showRewardModal) return;
    try {
      await distributeReward(eventId, showRewardModal.id, rewardNote || undefined);
      setShowRewardModal(null);
      setRewardNote('');
      loadRewards();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!selectedCheckinEvent) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const event = selectedCheckinEvent as any;

  const todayCount = event.calendar.find((c: any) => c.date === selectedDate)?.count || 0;
  const totalCheckinDays = event.participants.reduce((sum: number, p: any) => sum + p.checkin_days, 0);
  const avgCheckinRate = event.participant_count && event.total_days
    ? Math.round((totalCheckinDays / (event.participant_count * event.total_days)) * 100)
    : 0;

  const topParticipants = [...event.participants].sort((a: any, b: any) => b.checkin_days - a.checkin_days).slice(0, 5);
  const filteredParticipants = event.participants.filter((p: any) =>
    !searchQuery ||
    p.participant.nickname.includes(searchQuery) ||
    (p.participant.child_name && p.participant.child_name.includes(searchQuery))
  );

  const getParticipantCheckedOnDate = (participantId: number, date: string): number | null => {
    const p = event.participants.find((x: any) => x.participant.id === participantId);
    if (!p) return null;
    const record = p.records.find((r: any) => r.checkin_date === date);
    return record?.id || null;
  };

  const getParticipantRecordOnDate = (participantId: number, date: string): any | null => {
    const p = event.participants.find((x: any) => x.participant.id === participantId);
    if (!p) return null;
    return p.records.find((r: any) => r.checkin_date === date) || null;
  };

  const handleToggleCheckin = async (participantId: number) => {
    const recordId = getParticipantCheckedOnDate(participantId, selectedDate);
    if (recordId) {
      await doUncheckin(eventId, recordId);
    } else {
      await doCheckin(eventId, participantId, selectedDate);
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) return;
    await addCheckinParticipant(eventId, {
      nickname: newParticipantName.trim(),
      child_name: newParticipantChild.trim() || null,
    });
    setNewParticipantName('');
    setNewParticipantChild('');
    setShowAddParticipant(false);
  };

  const handleRemoveParticipant = async (participantId: number) => {
    if (confirm('确定移除这个参与者吗？TA的打卡记录也会被删除。')) {
      await removeCheckinParticipant(eventId, participantId);
    }
  };

  const toggleSelectParticipant = (pid: number) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(pid)) {
      newSet.delete(pid);
    } else {
      newSet.add(pid);
    }
    setSelectedParticipants(newSet);
  };

  const handleBatchCheckin = async () => {
    if (selectedParticipants.size === 0) return;
    await doBatchCheckin(eventId, selectedDate, Array.from(selectedParticipants));
    setSelectedParticipants(new Set());
    setBatchMode(false);
  };

  const selectAllUnchecked = () => {
    const newSet = new Set<number>();
    filteredParticipants.forEach((p: any) => {
      if (!getParticipantCheckedOnDate(p.participant.id, selectedDate)) {
        newSet.add(p.participant.id);
      }
    });
    setSelectedParticipants(newSet);
  };

  const getCalendarDays = () => {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
    const lastDay = new Date(calendarMonth.year, calendarMonth.month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: { date: string | null; count?: number; isEventDay?: boolean; isSelected?: boolean }[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const calendarDay = event.calendar.find((c: any) => c.date === dateStr);
      const isEventDay = dateStr >= event.start_date && dateStr <= event.end_date;
      days.push({
        date: dateStr,
        count: calendarDay?.count || 0,
        isEventDay,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  };

  const prevMonth = () => {
    setCalendarMonth(m => {
      if (m.month === 0) return { year: m.year - 1, month: 11 };
      return { year: m.year, month: m.month - 1 };
    });
  };

  const nextMonth = () => {
    setCalendarMonth(m => {
      if (m.month === 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: m.month + 1 };
    });
  };

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/checkin')}
            className="inline-flex items-center gap-1.5 text-sm mb-3"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            返回活动列表
          </button>

          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="t-display mb-2">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-4">
                {event.group_name && (
                  <span className="t-caption flex items-center gap-1.5">
                    <Users size={13} strokeWidth={1.8} />
                    {event.group_name}
                  </span>
                )}
                <span className="t-caption flex items-center gap-1.5">
                  <Calendar size={13} strokeWidth={1.8} />
                  {formatDate(event.start_date)} — {formatDate(event.end_date)}
                </span>
                <span className={`badge ${
                  event.status === 'active' ? 'badge-success' :
                  event.status === 'ended' ? 'badge-neutral' : 'badge-warning'
                }`}>
                  {CHECKIN_STATUS_LABELS[event.status]}
                </span>
              </div>
            </div>
            <a
              href={getExportUrl(eventId)}
              className="btn-secondary"
              download
            >
              <Download size={15} strokeWidth={1.8} />
              导出数据
            </a>
          </div>
        </div>

        {/* KPI Overview */}
        <div className="panel mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { label: '参与人数', value: event.participant_count, icon: Users },
              { label: '活动天数', value: event.total_days, icon: Calendar },
              { label: '今日打卡', value: todayCount, icon: CheckCircle2 },
              { label: '平均打卡率', value: `${avgCheckinRate}%`, icon: Target },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                className={`px-5 py-4
                           ${idx < 3 ? 'md:border-r border-border-subtle' : ''}
                           ${idx < 2 ? 'border-b md:border-b-0 border-border-subtle' : ''}`}
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center"
                       style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                    <stat.icon size={14} strokeWidth={1.8} />
                  </div>
                  <span className="t-caption">{stat.label}</span>
                </div>
                <p className="t-kpi">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reward Rules */}
        {event.reward_rules && (
          <div className="panel mb-6" style={{ background: 'linear-gradient(180deg, #FFFCF5 0%, #FFFFFF 100%)' }}>
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                   style={{ backgroundColor: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                <Trophy size={16} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="t-body-strong mb-1">奖励规则</h3>
                <p className="t-caption whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                  {event.reward_rules}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="tab-list">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`tab-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
          {/* Left: Calendar + Leaderboard */}
          <div className="space-y-6">
            {/* Calendar */}
            <div className="panel">
              <div className="px-5 py-3.5 flex items-center justify-between border-b"
                   style={{ borderColor: 'var(--color-border-subtle)' }}>
                <h3 className="panel-title">打卡日历</h3>
                <div className="flex items-center gap-0.5">
                  <button onClick={prevMonth} className="btn-icon-sm">
                    <ChevronLeft size={15} strokeWidth={1.8} />
                  </button>
                  <span className="t-body-strong min-w-[80px] text-center">
                    {calendarMonth.year}年{calendarMonth.month + 1}月
                  </span>
                  <button onClick={nextMonth} className="btn-icon-sm">
                    <ChevronRight size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="py-1 t-small">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((day, i) => (
                    <div key={i} className="aspect-square">
                      {day.date ? (
                        <button
                          onClick={() => day.isEventDay && setSelectedDate(day.date)}
                          disabled={!day.isEventDay}
                          className={`w-full h-full rounded-md flex flex-col items-center justify-center transition-all duration-150
                                     ${day.isEventDay ? 'cursor-pointer' : 'cursor-default'}`}
                          style={{
                            backgroundColor: day.isSelected
                              ? 'var(--color-primary-soft)'
                              : day.isEventDay && day.count && day.count > 0
                              ? 'var(--color-success-soft)'
                              : 'transparent',
                            color: day.isSelected
                              ? 'var(--color-primary)'
                              : day.isEventDay && day.count && day.count > 0
                              ? 'var(--color-success)'
                              : day.isEventDay
                              ? 'var(--color-text-secondary)'
                              : 'var(--color-text-disabled)',
                            fontWeight: day.isSelected ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (day.isEventDay && !day.isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (day.isEventDay && !day.isSelected) {
                              e.currentTarget.style.backgroundColor = day.count && day.count > 0
                                ? 'var(--color-success-soft)'
                                : 'transparent';
                            }
                          }}
                        >
                          <span className="text-xs leading-none">{new Date(day.date).getDate()}</span>
                          {day.isEventDay && day.count && day.count > 0 && (
                            <span className="text-[10px] mt-0.5 leading-none font-medium">{day.count}人</span>
                          )}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 t-small">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-success-soft)' }} />
                    <span>已打卡</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-primary-soft)' }} />
                    <span>选中</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            {topParticipants.length > 0 && (
              <div className="panel">
                <div className="px-5 py-3.5 flex items-center justify-between border-b"
                     style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <h3 className="panel-title">
                    <Trophy size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                    打卡排行
                  </h3>
                </div>
                <div className="py-1">
                  {topParticipants.map((p: any, idx: number) => {
                    const medals = ['🥇', '🥈', '🥉', '4', '5'];
                    const medalColors = [
                      'var(--color-warning)',
                      'var(--color-text-tertiary)',
                      '#C97B50',
                      'var(--color-text-tertiary)',
                      'var(--color-text-tertiary)',
                    ];
                    return (
                      <div key={p.participant.id}
                           className="flex items-center gap-3 px-5 py-2.5 hover:bg-bg-subtle/60 transition-colors duration-150"
                           onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(248 249 252 / 0.6)'}
                           onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="w-5 text-center font-semibold text-sm"
                              style={{ color: medalColors[idx], fontFamily: 'Manrope, sans-serif' }}>
                          {idx < 3 ? medals[idx] : idx + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                             style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                          {p.participant.nickname[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="t-body-strong truncate">
                            {p.participant.nickname}
                            {p.participant.child_name && (
                              <span className="t-small ml-1">({p.participant.child_name})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm kpi-value" style={{ color: 'var(--color-text-primary)' }}>
                            {p.checkin_days}天
                          </span>
                          {p.current_streak > 1 && (
                            <span className="flex items-center gap-0.5" style={{ color: 'var(--color-warning)' }}>
                              <Flame size={12} strokeWidth={2} />
                              <span className="text-xs font-medium">{p.current_streak}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Participant List */}
          <div className="panel">
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="panel-title">
                    <Calendar size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                    {formatDate(selectedDate)} 周{getDayOfWeek(selectedDate)}
                    {isToday(selectedDate) && (
                      <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>今天</span>
                    )}
                  </h3>
                  <p className="t-caption mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    点击人员可快速标记打卡
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {batchMode ? (
                    <>
                      <button onClick={selectAllUnchecked} className="btn-secondary">
                        全选未打卡
                      </button>
                      <button
                        onClick={handleBatchCheckin}
                        disabled={selectedParticipants.size === 0}
                        className="btn-primary"
                      >
                        <Check size={14} strokeWidth={1.8} />
                        批量打卡 ({selectedParticipants.size})
                      </button>
                      <button onClick={() => { setBatchMode(false); setSelectedParticipants(new Set()); }} className="btn-secondary">
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setBatchMode(true)} className="btn-secondary">
                        批量操作
                      </button>
                      <button onClick={() => setShowAddParticipant(true)} className="btn-primary">
                        <UserPlus size={14} strokeWidth={1.8} />
                        添加人员
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <div className="relative">
                <Search size={15} strokeWidth={1.8}
                        style={{
                          position: 'absolute',
                          left: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--color-text-tertiary)',
                        }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索参与者..."
                  className="input pl-9"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[600px] overflow-y-auto">
              {filteredParticipants.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                       style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                    <Users size={22} strokeWidth={1.5} />
                  </div>
                  <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                    暂无参与者，点击上方添加
                  </p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {filteredParticipants.map((p: any) => {
                    const isChecked = !!getParticipantCheckedOnDate(p.participant.id, selectedDate);
                    const record = getParticipantRecordOnDate(p.participant.id, selectedDate);
                    return (
                      <div
                        key={p.participant.id}
                        className={`flex items-center gap-3 px-5 py-3 transition-colors duration-150 group
                                   ${isChecked ? 'bg-success-soft/30' : ''}`}
                        style={{ backgroundColor: isChecked ? 'rgb(225 244 232 / 0.3)' : undefined }}
                        onMouseEnter={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {batchMode && (
                          <button
                            onClick={() => toggleSelectParticipant(p.participant.id)}
                            className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all"
                            style={{
                              backgroundColor: selectedParticipants.has(p.participant.id) ? 'var(--color-primary)' : 'transparent',
                              borderColor: selectedParticipants.has(p.participant.id) ? 'var(--color-primary)' : 'var(--color-border-default)',
                              color: 'white',
                            }}
                          >
                            {selectedParticipants.has(p.participant.id) && <Check size={12} strokeWidth={2.5} />}
                          </button>
                        )}
                        <button
                          onClick={() => !batchMode && handleToggleCheckin(p.participant.id)}
                          className="flex-1 flex items-center gap-3 text-left min-w-0"
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm"
                               style={{
                                 backgroundColor: isChecked ? 'var(--color-success-soft)' : 'var(--color-bg-subtle)',
                                 color: isChecked ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                               }}>
                            {isChecked
                              ? <CheckCircle2 size={18} strokeWidth={2} />
                              : (p.participant.nickname[0] || '?')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="t-body-strong"
                                    style={{ color: isChecked ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                                {p.participant.nickname}
                              </span>
                              {record?.display_name && (
                                <span className="badge badge-success" style={{ fontWeight: 500 }}>
                                  {record.display_name}
                                </span>
                              )}
                              {p.participant.child_name && (
                                <span className="t-small">({p.participant.child_name})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="t-small">
                                累计 <span className="font-medium" style={{ color: isChecked ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{p.checkin_days}</span> 天
                              </span>
                              {p.current_streak >= 2 && (
                                <span className="flex items-center gap-0.5 t-small" style={{ color: 'var(--color-warning)' }}>
                                  <Flame size={11} strokeWidth={2} />
                                  连续{p.current_streak}天
                                </span>
                              )}
                              {p.max_streak > p.current_streak && p.max_streak >= 3 && (
                                <span className="t-small" style={{ color: 'var(--color-text-tertiary)' }}>
                                  最长{p.max_streak}天
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0" style={{ color: isChecked ? 'var(--color-success)' : 'var(--color-text-disabled)' }}>
                            {isChecked ? <CheckCircle2 size={20} strokeWidth={1.8} /> : <Circle size={20} strokeWidth={1.5} />}
                          </div>
                        </button>
                        {!batchMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(p.participant.id); }}
                            className="opacity-0 group-hover:opacity-100 btn-icon-sm transition-opacity"
                            style={{ color: 'var(--color-text-tertiary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                          >
                            <Trash2 size={14} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="panel">
          <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
               style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {['pending', 'approved', 'rejected', ''].map(s => (
                  <button
                    key={s || 'all'}
                    onClick={() => { setReviewStatus(s); setReviewPage(1); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      reviewStatus === s
                        ? 'bg-primary text-white'
                        : 'text-secondary hover:bg-bg-subtle'
                    }`}
                    style={{
                      backgroundColor: reviewStatus === s ? 'var(--color-primary)' : 'transparent',
                      color: reviewStatus === s ? 'white' : 'var(--color-text-secondary)',
                    }}
                  >
                    {s ? RECORD_STATUS_LABELS[s] : '全部'}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              {[
                { value: '', label: '全部类型' },
                { value: 'makeup', label: '补卡' },
                { value: 'normal', label: '正常打卡' },
              ].map(t => (
                <button
                  key={t.value || 'all-type'}
                  onClick={() => { setReviewRecordType(t.value); setReviewPage(1); }}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: reviewRecordType === t.value ? 'var(--color-bg-elevated)' : 'transparent',
                    color: reviewRecordType === t.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: reviewRecordType === t.value ? 600 : 500,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>共 {reviewTotal} 条记录</div>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {loadingReview ? (
              <div className="px-5 py-12 text-center t-caption" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</div>
            ) : reviewRecords.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                  <FileText size={22} strokeWidth={1.5} />
                </div>
                <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>暂无打卡记录</p>
              </div>
            ) : (
              reviewRecords.map((r: any) => (
                <div key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-bg-subtle/60 transition-colors duration-150"
                     onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(248 249 252 / 0.6)'}
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                       style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                    {r.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="t-body-strong">{r.display_name || r.nickname}</span>
                      {r.child_name && <span className="t-small">({r.child_name})</span>}
                      <span className={`badge ${
                        r.status === 'approved' ? 'badge-success' :
                        r.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {RECORD_STATUS_LABELS[r.status]}
                      </span>
                      {r.is_makeup && <span className="badge badge-warning">补卡</span>}
                    </div>
                    <div className="t-caption mb-2" style={{ color: 'var(--color-text-tertiary)' }}>{r.checkin_date}</div>
                    {r.note && <p className="t-body mb-2" style={{ color: 'var(--color-text-secondary)' }}>{r.note}</p>}
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="打卡图片"
                        className="w-24 h-24 object-cover rounded-md"
                        style={{ border: '1px solid var(--color-border-subtle)' }}
                      />
                    )}
                    {r.review_note && (
                      <div className="mt-2 t-caption rounded-md p-2"
                           style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                        审核备注：{r.review_note}
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'approve' }); setReviewNote(''); }}
                        className="btn-icon-sm"
                        style={{ color: 'var(--color-success)' }}
                        title="通过"
                      >
                        <ThumbsUp size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'reject' }); setReviewNote(''); }}
                        className="btn-icon-sm"
                        style={{ color: 'var(--color-danger)' }}
                        title="拒绝"
                      >
                        <ThumbsDown size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {reviewTotal > 20 && (
            <div className="px-5 py-3 border-t flex items-center justify-center gap-2"
                 style={{ borderColor: 'var(--color-border-subtle)' }}>
              <button
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="btn-secondary"
              >
                上一页
              </button>
              <span className="t-small" style={{ color: 'var(--color-text-tertiary)' }}>第 {reviewPage} 页</span>
              <button
                onClick={() => setReviewPage(p => p + 1)}
                disabled={reviewPage * 20 >= reviewTotal}
                className="btn-secondary"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'badges' && (
        <div className="panel">
          <div className="px-5 py-4 border-b flex items-center justify-between"
               style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="panel-title">
              <Award size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
              徽章管理
            </h3>
            <button
              onClick={() => {
                setEditingBadge(null);
                setBadgeForm({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });
                setShowBadgeForm(true);
              }}
              className="btn-primary"
            >
              <Plus size={14} strokeWidth={1.8} />
              添加徽章
            </button>
          </div>

          <div className="px-5 py-5">
            {badges.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                  <Award size={22} strokeWidth={1.5} />
                </div>
                <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  还没有徽章，点击右上角添加第一个吧
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((b: any) => (
                  <div key={b.id}
                       className="rounded-xl p-4 group transition-all duration-150"
                       style={{
                         border: '1px solid var(--color-border-subtle)',
                         backgroundColor: 'var(--color-bg-elevated)',
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.borderColor = 'var(--color-border-default)';
                         e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                         e.currentTarget.style.boxShadow = 'none';
                       }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{b.icon || '🏅'}</div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingBadge(b);
                            setBadgeForm({ name: b.name, description: b.description || '', icon: b.icon || '🏅', type: b.type, target_days: b.target_days });
                            setShowBadgeForm(true);
                          }}
                          className="btn-icon-sm"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                        >
                          <Edit2 size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => handleDeleteBadge(b.id)}
                          className="btn-icon-sm"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                    <div className="t-body-strong mb-1">{b.name}</div>
                    <div className="t-caption mb-2 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                      {b.description || '暂无描述'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-warning">
                        {BADGE_TYPES.find(t => t.value === b.type)?.label}
                      </span>
                      <span className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>{b.target_days}天</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="panel">
          <div className="px-5 py-4 border-b flex items-center justify-between"
               style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="panel-title">
              <BookOpen size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
              资料管理
            </h3>
            <button
              onClick={() => {
                setEditingMaterial(null);
                setMaterialForm({ title: '', description: '', file_url: '', file_type: 'pdf', sort_order: 0, is_active: true });
                setShowMaterialForm(true);
              }}
              className="btn-primary"
            >
              <Plus size={14} strokeWidth={1.8} />
              添加资料
            </button>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {materials.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                  <BookOpen size={22} strokeWidth={1.5} />
                </div>
                <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                  还没有资料，点击右上角添加第一个吧
                </p>
              </div>
            ) : (
              materials.map((m: any) => (
                <div key={m.id}
                     className="px-5 py-4 flex items-start gap-4 group transition-colors duration-150"
                     onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                       style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                    <span className="text-lg">
                      {m.file_type === 'pdf' ? '📄' : m.file_type === 'video' ? '🎬' : m.file_type === 'audio' ? '🎵' : '📎'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="t-body-strong mb-1 flex items-center gap-2">
                      {m.title}
                      {!m.is_active && (
                        <span className="badge badge-neutral">已下架</span>
                      )}
                    </div>
                    {m.description && <p className="t-caption mb-1" style={{ color: 'var(--color-text-secondary)' }}>{m.description}</p>}
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noreferrer"
                         className="t-small truncate block"
                         style={{ color: 'var(--color-primary)' }}>
                        {m.file_url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingMaterial(m);
                        setMaterialForm({ title: m.title, description: m.description || '', file_url: m.file_url || '', file_type: m.file_type || 'pdf', sort_order: m.sort_order || 0, is_active: !!m.is_active });
                        setShowMaterialForm(true);
                      }}
                      className="btn-icon-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                    >
                      <Edit2 size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id)}
                      className="btn-icon-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="panel">
          <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
               style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-1">
              {['', 'pending', 'distributed', 'not_qualified'].map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => setRewardStatus(s)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    backgroundColor: rewardStatus === s ? 'var(--color-primary)' : 'transparent',
                    color: rewardStatus === s ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  {s ? REWARD_STATUS_LABELS[s] : '全部'}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} strokeWidth={1.8}
                      style={{
                        position: 'absolute',
                        left: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--color-text-tertiary)',
                      }} />
              <input
                type="text"
                value={rewardSearch}
                onChange={e => setRewardSearch(e.target.value)}
                placeholder="搜索..."
                className="input pl-9 w-48"
                style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}
              />
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {rewards.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                  <Gift size={22} strokeWidth={1.5} />
                </div>
                <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>暂无数据</p>
              </div>
            ) : (
              rewards.map((p: any) => (
                <div key={p.id}
                     className="px-5 py-4 flex items-center gap-4 transition-colors duration-150"
                     onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                       style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                    {p.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="t-body-strong">{p.nickname}</span>
                      {p.child_name && <span className="t-small">({p.child_name})</span>}
                    </div>
                    <div className="flex items-center gap-4 t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                      <span>打卡 <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{p.checkin_days}</span> 天</span>
                      <span>加入 {p.joined_at?.split(' ')[0] || ''}</span>
                    </div>
                    {p.reward_note && (
                      <div className="t-caption mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        奖励备注：{p.reward_note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`badge ${
                      p.reward_status === 'distributed' ? 'badge-success' :
                      p.reward_status === 'not_qualified' ? 'badge-neutral' : 'badge-warning'
                    }`}>
                      {REWARD_STATUS_LABELS[p.reward_status || 'pending']}
                    </span>
                    {(p.reward_status === 'pending' || !p.reward_status) && (
                      <button
                        onClick={() => { setShowRewardModal(p); setRewardNote(''); }}
                        className="btn-primary"
                        style={{ paddingTop: '0.375rem', paddingBottom: '0.375rem' }}
                      >
                        <Gift size={13} strokeWidth={1.8} />
                        发放
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAddParticipant && (
        <Modal
          isOpen={showAddParticipant}
          onClose={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }}
          title="添加参与者"
          footer={
            <>
              <button onClick={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }} className="btn-secondary">取消</button>
              <button onClick={handleAddParticipant} disabled={!newParticipantName.trim()} className="btn-primary"><Plus className="w-4 h-4" />添加</button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="form-label">家长昵称 *</label>
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={e => setNewParticipantName(e.target.value)}
                  placeholder="如：轩轩妈妈"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">孩子昵称（选填）</label>
                <input
                  type="text"
                  value={newParticipantChild}
                  onChange={e => setNewParticipantChild(e.target.value)}
                  placeholder="如：轩轩"
                  className="input"
                />
              </div>
            </div>
        </Modal>
      )}

      {showReviewModal && (
        <Modal
          isOpen={!!showReviewModal}
          onClose={() => setShowReviewModal(null)}
          title={showReviewModal.action === 'approve' ? '通过审核' : '拒绝审核'}
          footer={
            <>
              <button onClick={() => setShowReviewModal(null)} className="btn-secondary">取消</button>
              <button onClick={handleReview} className={showReviewModal.action === 'approve' ? 'btn-primary' : 'btn-danger-solid'}>
                {showReviewModal.action === 'approve' ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                {showReviewModal.action === 'approve' ? '通过' : '拒绝'}
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="form-label">审核备注（选填）</label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={showReviewModal.action === 'approve' ? '写点鼓励的话...' : '说明拒绝原因...'}
                  className="input min-h-[100px]"
                />
              </div>
            </div>
        </Modal>
      )}

      {showBadgeForm && (
        <Modal
          isOpen={showBadgeForm}
          onClose={() => { setShowBadgeForm(false); setEditingBadge(null); }}
          title={editingBadge ? '编辑徽章' : '添加徽章'}
          footer={
            <>
              <button onClick={() => { setShowBadgeForm(false); setEditingBadge(null); }} className="btn-secondary">取消</button>
              <button onClick={handleSaveBadge} disabled={!badgeForm.name || !badgeForm.target_days} className="btn-primary"><Check className="w-4 h-4" />保存</button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="form-label">徽章图标</label>
                <div className="flex items-center gap-2">
                  <div className="text-3xl w-14 h-14 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: 'var(--color-warning-soft)', border: '1px solid var(--color-border-subtle)' }}>
                    {badgeForm.icon}
                  </div>
                  <input
                    type="text"
                    value={badgeForm.icon}
                    onChange={e => setBadgeForm({ ...badgeForm, icon: e.target.value })}
                    placeholder="输入emoji，如 🏅"
                    className="input flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">徽章名称 *</label>
                <input
                  type="text"
                  value={badgeForm.name}
                  onChange={e => setBadgeForm({ ...badgeForm, name: e.target.value })}
                  placeholder="如：连续打卡7天"
                  className="input"
                />
              </div>
              <div>
                <label className="form-label">徽章描述</label>
                <textarea
                  value={badgeForm.description}
                  onChange={e => setBadgeForm({ ...badgeForm, description: e.target.value })}
                  placeholder="简短描述一下这个徽章"
                  className="input min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">类型</label>
                  <select
                    value={badgeForm.type}
                    onChange={e => setBadgeForm({ ...badgeForm, type: e.target.value })}
                    className="input"
                  >
                    {BADGE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">目标天数</label>
                  <input
                    type="number"
                    value={badgeForm.target_days}
                    onChange={e => setBadgeForm({ ...badgeForm, target_days: parseInt(e.target.value) || 0 })}
                    min={1}
                    className="input"
                  />
                </div>
              </div>
            </div>
        </Modal>
      )}

      {showMaterialForm && (
        <Modal
          isOpen={showMaterialForm}
          onClose={() => { setShowMaterialForm(false); setEditingMaterial(null); }}
          title={editingMaterial ? '编辑资料' : '添加资料'}
          footer={
            <>
              <button onClick={() => { setShowMaterialForm(false); setEditingMaterial(null); }} className="btn-secondary">取消</button>
              <button onClick={handleSaveMaterial} disabled={!materialForm.title} className="btn-primary"><Check className="w-4 h-4" />保存</button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="form-label">资料标题 *</label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                  placeholder="如：第1周学习资料"
                  className="input"
                />
              </div>
              <div>
                <label className="form-label">资料描述</label>
                <textarea
                  value={materialForm.description}
                  onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })}
                  placeholder="简短介绍一下这个资料"
                  className="input min-h-[80px]"
                />
              </div>
              <div>
                <label className="form-label">文件类型</label>
                <select
                  value={materialForm.file_type}
                  onChange={e => setMaterialForm({ ...materialForm, file_type: e.target.value })}
                  className="input"
                >
                  <option value="pdf">PDF文档</option>
                  <option value="video">视频</option>
                  <option value="audio">音频</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="form-label">文件链接</label>
                <input
                  type="text"
                  value={materialForm.file_url}
                  onChange={e => setMaterialForm({ ...materialForm, file_url: e.target.value })}
                  placeholder="https://..."
                  className="input"
                />
                <p className="text-xs text-slate-400 mt-1">先把文件上传到服务器或云存储，然后把链接填在这里</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">排序</label>
                  <input
                    type="number"
                    value={materialForm.sort_order}
                    onChange={e => setMaterialForm({ ...materialForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="form-label">状态</label>
                  <select
                    value={materialForm.is_active ? '1' : '0'}
                    onChange={e => setMaterialForm({ ...materialForm, is_active: e.target.value === '1' })}
                    className="input"
                  >
                    <option value="1">上架</option>
                    <option value="0">下架</option>
                  </select>
                </div>
              </div>
            </div>
        </Modal>
      )}

      {showRewardModal && (
        <Modal
          isOpen={!!showRewardModal}
          onClose={() => setShowRewardModal(null)}
          title="发放奖励"
          footer={
            <>
              <button onClick={() => setShowRewardModal(null)} className="btn-secondary">取消</button>
              <button onClick={handleDistributeReward} className="btn-primary"><Gift className="w-4 h-4" />确认发放</button>
            </>
          }
        >
            <div className="space-y-4">
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                <div className="t-body-strong mb-1">{showRewardModal.nickname}</div>
                <div className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>累计打卡 {showRewardModal.checkin_days} 天</div>
              </div>
              <div>
                <label className="form-label">奖励备注（选填）</label>
                <textarea
                  value={rewardNote}
                  onChange={e => setRewardNote(e.target.value)}
                  placeholder="如：已发放绘本一套"
                  className="input min-h-[80px]"
                />
              </div>
            </div>
        </Modal>
      )}
      </div>
    </div>
  );
}
