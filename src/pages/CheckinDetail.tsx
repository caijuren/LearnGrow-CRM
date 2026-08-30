/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, CheckCircle2, Circle, Award,
  Plus, UserPlus, Check, Search, ChevronLeft, ChevronRight,
  Trash2, Flame, Trophy, Target, FileText, Gift,
  Download, Eye, ThumbsUp, ThumbsDown, Edit2,
} from 'lucide-react';
import { useStore } from '@/store';
import Loading from '@/components/ui/Loading';
import { CHECKIN_STATUS_LABELS } from '../../shared/types';
import {
  fetchCheckinRecords, reviewCheckinRecord,
  fetchEventBadges, createEventBadge, updateEventBadge, deleteEventBadge,
  fetchEventRewards, distributeReward, getExportUrl,
} from '@/lib/api';
import Modal from '@/components/Modal';

type TabKey = 'checkin' | 'review' | 'badges' | 'rewards';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'checkin', label: '打卡管理', icon: Calendar },
  { key: 'review', label: '打卡审核', icon: Eye },
  { key: 'badges', label: '徽章管理', icon: Award },
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

const REWARD_STATUS_LABELS: Record<string, string> = {
  pending: '待发放',
  distributed: '已发放',
  not_qualified: '未达标',
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


const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

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
  const [participantFilter, setParticipantFilter] = useState<'all' | 'checked' | 'unchecked'>('all');
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

  // 奖励相关
  const [rewards, setRewards] = useState<any[]>([]);
  const [rewardStatus, setRewardStatus] = useState<string>('');
  const [rewardSearch, setRewardSearch] = useState('');
  const [showRewardModal, setShowRewardModal] = useState<any>(null);
  const [rewardNote, setRewardNote] = useState('');
  const [showCheckinConfirm, setShowCheckinConfirm] = useState<{ participantId: number; action: 'checkin' | 'uncheckin'; date: string } | null>(null);

  const loadReviewRecords = useCallback(async () => {
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
  }, [eventId, reviewStatus, reviewRecordType, reviewPage]);

  const loadBadges = useCallback(async () => {
    try {
      const data = await fetchEventBadges(eventId);
      setBadges(data);
    } catch (e: any) {
      console.error(e);
    }
  }, [eventId]);

  const loadRewards = useCallback(async () => {
    try {
      const data = await fetchEventRewards(eventId, { status: rewardStatus || undefined, search: rewardSearch || undefined });
      setRewards(data);
    } catch (e: any) {
      console.error(e);
    }
  }, [eventId, rewardStatus, rewardSearch]);

  useEffect(() => {
    if (eventId) loadCheckinEvent(eventId);
  }, [eventId, loadCheckinEvent]);

  useEffect(() => {
    if (selectedCheckinEvent && !selectedCheckinEvent.calendar.some((c: any) => c.date === selectedDate)) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedCheckinEvent.calendar.some((c: any) => c.date === today)) {
        setSelectedDate(today);
      } else if (selectedCheckinEvent.calendar.length > 0) {
        setSelectedDate(selectedCheckinEvent.calendar[selectedCheckinEvent.calendar.length - 1].date);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCheckinEvent]);

  useEffect(() => {
    if (activeTab === 'review' && eventId) {
      loadReviewRecords();
    }
  }, [activeTab, reviewStatus, reviewRecordType, reviewPage, eventId, loadReviewRecords]);

  useEffect(() => {
    if (activeTab === 'badges' && eventId) {
      loadBadges();
    }
  }, [activeTab, eventId, loadBadges]);

  useEffect(() => {
    if (activeTab === 'rewards' && eventId) {
      loadRewards();
    }
  }, [activeTab, rewardStatus, rewardSearch, eventId, loadRewards]);

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
        <Loading text="" size="sm" />
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
  const filteredParticipants = event.participants.filter((p: any) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      p.participant.nickname.includes(searchQuery) ||
      (p.participant.child_name && p.participant.child_name.includes(searchQuery));
    
    // Status filter
    let matchesFilter = true;
    if (participantFilter === 'checked') {
      matchesFilter = !!getParticipantCheckedOnDate(p.participant.id, selectedDate);
    } else if (participantFilter === 'unchecked') {
      matchesFilter = !getParticipantCheckedOnDate(p.participant.id, selectedDate);
    }
    
    return matchesSearch && matchesFilter;
  });

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
    const action = recordId ? 'uncheckin' : 'checkin';
    setShowCheckinConfirm({ participantId, action, date: selectedDate });
  };

  const confirmToggleCheckin = async () => {
    if (!showCheckinConfirm) return;
    try {
      if (showCheckinConfirm.action === 'uncheckin') {
        const recordId = getParticipantCheckedOnDate(showCheckinConfirm.participantId, showCheckinConfirm.date);
        if (recordId) {
          await doUncheckin(eventId, recordId);
        }
      } else {
        await doCheckin(eventId, showCheckinConfirm.participantId, showCheckinConfirm.date);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setShowCheckinConfirm(null);
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) return;
    await addCheckinParticipant(eventId, {
      nickname: newParticipantName.trim(),
      child_name: newParticipantChild.trim() || undefined,
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
        date: dateStr || null,
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
    <motion.div
      className="page-shell"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <motion.div variants={fadeUp} className="mb-6">
          <button
            onClick={() => navigate('/checkin')}
            className="inline-flex items-center gap-1.5 text-[13px] mb-3 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            返回活动列表
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-4">
                {event.group_name && (
                  <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
                    <Users size={13} strokeWidth={1.8} style={{ color: '#8B5CF6' }} />
                    {event.group_name}
                  </span>
                )}
                <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
                  <Calendar size={13} strokeWidth={1.8} className="text-blue-600" />
                  {formatDate(event.start_date)} — {formatDate(event.end_date)}
                </span>
                <span className={`badge ${
                  event.status === 'active' ? 'badge-primary' :
                  event.status === 'ended' ? 'badge-neutral' : 'badge-warning'
                }`}>
                  {CHECKIN_STATUS_LABELS[event.status as keyof typeof CHECKIN_STATUS_LABELS]}
                </span>
              </div>
            </div>
            <a
              href={getExportUrl(eventId)}
              className="btn btn-primary shrink-0"
              download
            >
              <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                <Download size={13} strokeWidth={2.5} />
              </span>
              导出数据
            </a>
          </div>
        </motion.div>

        {/* KPI Overview */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { 
              label: '参与人数', 
              value: event.participant_count, 
              subtext: `共${event.total_days}天`,
              icon: Users, 
              iconBg: '#EEF0FF', 
              iconColor: '#5B5CE2' 
            },
            { 
              label: '活动天数', 
              value: event.total_days, 
              subtext: `${formatDate(event.start_date)}起`,
              icon: Calendar, 
              iconBg: '#EFF6FF', 
              iconColor: '#2563EB' 
            },
            { 
              label: '今日打卡', 
              value: todayCount, 
              subtext: event.participant_count ? `${Math.round((todayCount / event.participant_count) * 100)}%` : '-',
              icon: CheckCircle2, 
              iconBg: '#ECFDF3', 
              iconColor: '#22C55E' 
            },
            { 
              label: '平均打卡率', 
              value: `${avgCheckinRate}%`, 
              subtext: avgCheckinRate >= 80 ? '🎯 优秀' : avgCheckinRate >= 60 ? '👍 良好' : '⚠️ 待提升',
              icon: Target, 
              iconBg: '#FFFBEB', 
              iconColor: '#F59E0B' 
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100 px-4 py-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                     style={{ backgroundColor: stat.iconBg, color: stat.iconColor }}>
                  <stat.icon size={14} strokeWidth={1.8} />
                </div>
                <span className="text-[12px] text-gray-500">{stat.label}</span>
              </div>
              <p className="text-[28px] font-bold text-gray-900 leading-none mb-0.5">{stat.value}</p>
              <p className="text-[11px] text-gray-400">{stat.subtext}</p>
            </div>
          ))}
        </motion.div>

        {/* Reward Rules */}
        {event.reward_rules && (
          <motion.div variants={fadeUp} className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100 mb-5 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)' }} />
            <div className="px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                <Trophy size={16} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-gray-900 mb-0.5">奖励规则</h3>
                <p className="text-[12px] whitespace-pre-wrap text-gray-500">
                  {event.reward_rules}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="inline-flex items-center gap-1 p-1 bg-gray-50 rounded-xl border border-gray-200">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </motion.div>

      {activeTab === 'checkin' && (
        <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-[400px_300px_minmax(0,1fr)] gap-4">
          {/* Column 1: Calendar */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
                <Calendar size={14} strokeWidth={1.8} className="text-blue-600" />
                打卡日历
              </h3>
              <div className="flex items-center gap-0.5">
                <button onClick={prevMonth} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <ChevronLeft size={13} strokeWidth={1.8} />
                </button>
                <span className="text-[12px] font-medium text-gray-900 min-w-[60px] text-center">
                  {calendarMonth.year}.{calendarMonth.month + 1}
                </span>
                <button onClick={nextMonth} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <ChevronRight size={13} strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <div className="px-2.5 py-2.5">
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="py-0.5 text-[10px] font-medium text-gray-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day, i) => {
                  const maxCount = Math.max(...event.calendar.map((c: any) => c.count || 0), 1);
                  const intensity = day.count ? day.count / maxCount : 0;
                  let bgColor = '';
                  let textColor = '';
                  
                  if (day.isSelected && day.isEventDay) {
                    bgColor = 'bg-blue-50';
                    textColor = 'text-blue-600';
                  } else if (!day.isEventDay) {
                    textColor = 'text-gray-300';
                  } else if (day.count && day.count > 0) {
                    if (intensity > 0.7) {
                      bgColor = 'bg-green-200 hover:bg-green-300';
                      textColor = 'text-green-800';
                    } else if (intensity > 0.4) {
                      bgColor = 'bg-green-100 hover:bg-green-200';
                      textColor = 'text-green-700';
                    } else {
                      bgColor = 'bg-green-50 hover:bg-green-100';
                      textColor = 'text-green-600';
                    }
                  } else {
                    textColor = 'text-gray-500';
                  }
                  
                  return (
                    <div key={i} className="aspect-square">
                      {day.date ? (
                        <button
                          onClick={() => day.isEventDay && setSelectedDate(day.date!)}
                          disabled={!day.isEventDay}
                          className={`w-full h-full rounded flex flex-col items-center justify-center transition-all duration-150 ${bgColor} ${textColor}
                            ${!day.isEventDay ? 'cursor-default' : 'cursor-pointer'}
                            ${day.isSelected && day.isEventDay ? 'font-semibold ring-1 ring-blue-500' : ''}
                          `}
                        >
                          <span className="text-[11px] leading-none">{new Date(day.date).getDate()}</span>
                          {day.isEventDay && day.count && day.count > 0 && (
                            <span className="text-[8px] mt-0.5 leading-none font-medium">{day.count}</span>
                          )}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded bg-green-50" />
                  <span>少</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded bg-green-100" />
                  <span>中</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded bg-green-200" />
                  <span>密</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Leaderboard */}
          {topParticipants.length > 0 && (
            <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
                  <Trophy size={14} strokeWidth={1.8} style={{ color: '#F59E0B' }} />
                  TOP 5
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {topParticipants.map((p: any, idx: number) => {
                  const medalColors = [
                    { bg: '#FFFBEB', color: '#F59E0B', label: '🥇' },
                    { bg: '#F2F4F7', color: '#667085', label: '🥈' },
                    { bg: '#FFF7ED', color: '#C97B50', label: '🥉' },
                    { bg: '#F9FAFB', color: '#9CA3AF', label: '4' },
                    { bg: '#F9FAFB', color: '#9CA3AF', label: '5' },
                  ];
                  const medal = medalColors[idx] || medalColors[3];
                  
                  return (
                    <div key={p.participant.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        {/* Medal badge */}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                             style={{ backgroundColor: medal.bg, color: medal.color }}>
                          {medal.label}
                        </div>
                        
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {p.participant.avatar_url ? (
                            <img 
                              src={p.participant.avatar_url.startsWith('/uploads/') 
                                ? p.participant.avatar_url.replace('/uploads/', '/api/uploads/') 
                                : p.participant.avatar_url} 
                              alt="" 
                              className="w-7 h-7 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallbackDiv) fallbackDiv.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                               style={{ 
                                 backgroundColor: p.participant.avatar_url ? '#F3F4F6' : '#EEF0FF', 
                                 color: p.participant.avatar_url ? '#9CA3AF' : '#5B5CE2',
                                 display: p.participant.avatar_url ? 'none' : 'flex'
                               }}>
                            {p.participant.nickname[0] || '?'}
                          </div>
                        </div>
                        
                        {/* Name and stats */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-900 truncate">
                            {p.participant.nickname}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{p.checkin_days}天</span>
                            {p.current_streak > 1 && (
                              <span className="flex items-center gap-0.5 text-[11px] text-orange-500">
                                <Flame size={10} strokeWidth={2} />
                                {p.current_streak}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Column 3: Participant List */}
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar size={15} strokeWidth={1.8} className="text-blue-600" />
                    {formatDate(selectedDate)} 周{getDayOfWeek(selectedDate)}
                    {isToday(selectedDate) && (
                      <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full ml-1">今天</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    点击快速标记打卡
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {batchMode ? (
                    <>
                      <button onClick={selectAllUnchecked} className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        全选未打卡
                      </button>
                      <button
                        onClick={handleBatchCheckin}
                        disabled={selectedParticipants.size === 0}
                        className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Check size={13} strokeWidth={1.8} />
                        批量 ({selectedParticipants.size})
                      </button>
                      <button onClick={() => { setBatchMode(false); setSelectedParticipants(new Set()); }} className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setBatchMode(true)} className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        批量操作
                      </button>
                      <button onClick={() => setShowAddParticipant(true)} className="px-2.5 py-1.5 text-[12px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1">
                        <UserPlus size={13} strokeWidth={1.8} />
                        添加
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="px-4 py-2.5 border-b border-gray-100 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-gray-400">筛选：</span>
                {[
                  { key: 'all', label: '全部' },
                  { key: 'checked', label: '已打卡' },
                  { key: 'unchecked', label: '未打卡' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setParticipantFilter(f.key as any)}
                    className={`px-2.5 py-0.5 rounded text-[12px] font-medium transition-all ${
                      participantFilter === f.key
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-[600px] overflow-y-auto">
              {filteredParticipants.length === 0 ? (
                <div className="px-5 py-20 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-50">
                    <Users size={32} strokeWidth={1.5} className="text-gray-300" />
                  </div>
                  <p className="text-[14px] font-medium text-gray-900 mb-1">
                    {searchQuery || participantFilter !== 'all' ? '没有找到匹配的参与者' : '暂无参与者'}
                  </p>
                  <p className="text-[13px] text-gray-400">
                    {searchQuery || participantFilter !== 'all' 
                      ? '试试调整筛选条件' 
                      : '点击上方"添加人员"按钮开始吧'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredParticipants.map((p: any) => {
                    const isChecked = !!getParticipantCheckedOnDate(p.participant.id, selectedDate);
                    const record = getParticipantRecordOnDate(p.participant.id, selectedDate);
                    
                    // Avatar placeholder with first letter
                    const avatarLetter = p.participant.nickname?.[0] || '?';
                    const avatarColors = [
                      { bg: '#EEF0FF', color: '#5B5CE2' },
                      { bg: '#ECFDF3', color: '#22C55E' },
                      { bg: '#FEF3C7', color: '#F59E0B' },
                      { bg: '#FEE2E2', color: '#EF4444' },
                      { bg: '#E0E7FF', color: '#6366F1' },
                    ];
                    const colorIndex = avatarLetter.charCodeAt(0) % avatarColors.length;
                    const avatarStyle = avatarColors[colorIndex];
                    
                    return (
                      <div
                        key={p.participant.id}
                        className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 group hover:bg-gray-50 ${isChecked ? 'bg-green-50/50' : ''}`}
                      >
                        {batchMode && (
                          <button
                            onClick={() => toggleSelectParticipant(p.participant.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              selectedParticipants.has(p.participant.id)
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-transparent border-gray-300'
                            }`}
                          >
                            {selectedParticipants.has(p.participant.id) && <Check size={10} strokeWidth={2.5} />}
                          </button>
                        )}
                        <button
                          onClick={() => !batchMode && handleToggleCheckin(p.participant.id)}
                          className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                        >
                          {/* Avatar */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                            isChecked ? 'ring-2 ring-green-500 ring-offset-1' : ''
                          }`}>
                            {p.participant.avatar_url ? (
                              <img 
                                src={p.participant.avatar_url.startsWith('/uploads/') 
                                  ? p.participant.avatar_url.replace('/uploads/', '/api/uploads/') 
                                  : p.participant.avatar_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className="w-full h-full flex items-center justify-center font-semibold text-[11px]"
                              style={{ 
                                backgroundColor: p.participant.avatar_url ? '#F3F4F6' : avatarStyle.bg, 
                                color: p.participant.avatar_url ? '#9CA3AF' : avatarStyle.color,
                                display: p.participant.avatar_url ? 'none' : 'flex'
                              }}
                            >
                              {avatarLetter}
                            </div>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[13px] font-medium ${isChecked ? 'text-green-600' : 'text-gray-900'}`}>
                                {p.participant.nickname}
                              </span>
                              {record?.display_name && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                                  {record.display_name}
                                </span>
                              )}
                              {p.participant.child_name && (
                                <span className="text-[11px] text-gray-400">({p.participant.child_name})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400">
                                {p.checkin_days}天
                              </span>
                              {p.current_streak >= 2 && (
                                <span className="flex items-center gap-0.5 text-[11px] text-orange-500">
                                  <Flame size={10} strokeWidth={2} />
                                  {p.current_streak}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Check status icon */}
                          <div className={`shrink-0 ${isChecked ? 'text-green-500' : 'text-gray-300'}`}>
                            {isChecked ? <CheckCircle2 size={18} strokeWidth={1.8} /> : <Circle size={18} strokeWidth={1.5} />}
                          </div>
                        </button>
                        
                        {!batchMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(p.participant.id); }}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={13} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'review' && (
        <motion.div variants={fadeUp} className="clean-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-bg-subtle rounded-xl border border-border-default">
                {['pending', 'approved', 'rejected', ''].map(s => (
                  <button
                    key={s || 'all'}
                    onClick={() => { setReviewStatus(s); setReviewPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      reviewStatus === s
                        ? 'bg-bg-surface text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {s ? RECORD_STATUS_LABELS[s] : '全部'}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-border-subtle" />
              {[
                { value: '', label: '全部类型' },
                { value: 'makeup', label: '补卡' },
                { value: 'normal', label: '正常打卡' },
              ].map(t => (
                <button
                  key={t.value || 'all-type'}
                  onClick={() => { setReviewRecordType(t.value); setReviewPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    reviewRecordType === t.value
                      ? 'bg-bg-surface text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="t-caption text-text-tertiary">共 {reviewTotal} 条记录</div>
          </div>

          <div className="divide-y divide-border-subtle">
            {loadingReview ? (
              <div className="px-5 py-12 flex justify-center">
                <Loading text="" size="sm" />
              </div>
            ) : reviewRecords.length === 0 ? (
              <div className="px-5 py-20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-50">
                  <FileText size={32} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <p className="text-[14px] font-medium text-gray-900 mb-1">暂无打卡记录</p>
                <p className="text-[13px] text-gray-400">
                  {reviewStatus ? '试试切换筛选条件' : '等待用户提交打卡'}
                </p>
              </div>
            ) : (
              reviewRecords.map((r: any) => (
                <div key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors duration-150 group">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 relative">
                    {r.avatar_url ? (
                      <>
                        <img 
                          src={r.avatar_url.startsWith('/uploads/') 
                            ? r.avatar_url.replace('/uploads/', '/api/uploads/') 
                            : r.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallbackDiv = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallbackDiv) {
                              fallbackDiv.style.display = 'flex';
                            }
                          }}
                        />
                        <div 
                          className="w-full h-full absolute inset-0 flex items-center justify-center font-semibold text-sm bg-gray-100 text-gray-400"
                          style={{ display: 'none' }}
                        >
                          {r.nickname?.[0] || '?'}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-semibold text-sm bg-blue-50 text-blue-600">
                        {r.nickname?.[0] || '?'}
                      </div>
                    )}
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
                    <div className="t-caption mb-2 text-text-tertiary">{r.checkin_date}</div>
                    {r.note && <p className="t-body mb-2 text-text-secondary">{r.note}</p>}
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="打卡图片"
                        className="w-24 h-24 object-cover rounded-lg border border-border-subtle"
                      />
                    )}
                    {r.review_note && (
                      <div className="mt-2 t-caption rounded-lg p-2 bg-bg-subtle text-text-secondary">
                        审核备注：{r.review_note}
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'approve' }); setReviewNote(''); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-success hover:bg-success-soft transition-colors"
                        title="通过"
                      >
                        <ThumbsUp size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'reject' }); setReviewNote(''); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-danger hover:bg-danger-soft transition-colors"
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
            <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-center gap-2">
              <button
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                上一页
              </button>
              <span className="t-small text-text-tertiary">第 {reviewPage} 页</span>
              <button
                onClick={() => setReviewPage(p => p + 1)}
                disabled={reviewPage * 20 >= reviewTotal}
                className="btn btn-secondary disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'badges' && (
        <motion.div variants={fadeUp} className="clean-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 className="panel-title">
              <Award size={15} strokeWidth={1.8} style={{ color: '#F59E0B' }} />
              徽章管理
            </h3>
            <button
              onClick={() => {
                setEditingBadge(null);
                setBadgeForm({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });
                setShowBadgeForm(true);
              }}
              className="btn btn-primary"
            >
              <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                <Plus size={13} strokeWidth={2.5} />
              </span>
              添加徽章
            </button>
          </div>

          <div className="px-5 py-5">
            {badges.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-50">
                  <Award size={32} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <p className="text-[14px] font-medium text-gray-900 mb-1">还没有徽章</p>
                <p className="text-[13px] text-gray-400 mb-4">创建你的第一个打卡徽章吧</p>
                <button
                  onClick={() => {
                    setEditingBadge(null);
                    setBadgeForm({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });
                    setShowBadgeForm(true);
                  }}
                  className="px-4 py-2 text-[13px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  添加徽章
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((b: any) => (
                  <div key={b.id}
                       className="rounded-xl p-4 group transition-all duration-150 bg-bg-surface border border-border-subtle hover:border-border-default hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#FFFBEB' }}>
                        {b.icon || '🏅'}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingBadge(b);
                            setBadgeForm({ name: b.name, description: b.description || '', icon: b.icon || '🏅', type: b.type, target_days: b.target_days });
                            setShowBadgeForm(true);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-primary hover:bg-primary-soft transition-colors"
                        >
                          <Edit2 size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => handleDeleteBadge(b.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                    <div className="t-body-strong mb-1">{b.name}</div>
                    <div className="t-caption mb-2 line-clamp-2 text-text-tertiary">
                      {b.description || '暂无描述'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-warning">
                        {BADGE_TYPES.find(t => t.value === b.type)?.label}
                      </span>
                      <span className="t-caption text-text-tertiary">{b.target_days}天</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'rewards' && (
        <motion.div variants={fadeUp} className="clean-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-bg-subtle rounded-xl border border-border-default">
              {[
                { value: '', label: '全部' },
                { value: 'pending', label: '待发放' },
                { value: 'distributed', label: '已发放' },
                { value: 'not_qualified', label: '未达标' },
              ].map(t => (
                <button
                  key={t.value || 'all'}
                  onClick={() => setRewardStatus(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    rewardStatus === t.value
                      ? 'bg-bg-surface text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} strokeWidth={1.8} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={rewardSearch}
                onChange={e => setRewardSearch(e.target.value)}
                placeholder="搜索参与者..."
                className="input pl-9 w-48 h-9 text-[13px]"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {rewards.length === 0 ? (
              <div className="px-5 py-20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-50">
                  <Gift size={32} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <p className="text-[14px] font-medium text-gray-900 mb-1">暂无数据</p>
                <p className="text-[13px] text-gray-400">
                  {rewardStatus ? '试试切换筛选条件' : '活动结束后会为参与者发放奖励'}
                </p>
              </div>
            ) : (
              rewards.map((p: any) => (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4 transition-colors duration-150 hover:bg-bg-hover group">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 bg-bg-subtle text-text-secondary">
                    {p.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="t-body-strong">{p.nickname}</span>
                      {p.child_name && <span className="t-small">({p.child_name})</span>}
                    </div>
                    <div className="flex items-center gap-4 t-caption text-text-tertiary">
                      <span>打卡 <span className="font-medium text-text-secondary">{p.checkin_days}</span> 天</span>
                      <span>加入 {p.joined_at?.split(' ')[0] || ''}</span>
                    </div>
                    {p.reward_note && (
                      <div className="t-caption mt-1 text-text-tertiary">
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
                        className="btn btn-primary btn-sm"
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
        </motion.div>
      )}

      {showAddParticipant && (
        <Modal
          isOpen={showAddParticipant}
          onClose={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }}
          title="添加参与者"
          footer={
            <>
              <button onClick={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }} className="btn btn-secondary">取消</button>
              <button onClick={handleAddParticipant} disabled={!newParticipantName.trim()} className="btn btn-primary"><Plus className="w-4 h-4" />添加</button>
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
              <button onClick={() => setShowReviewModal(null)} className="btn btn-secondary">取消</button>
              <button onClick={handleReview} className={showReviewModal.action === 'approve' ? 'btn btn-primary' : 'btn btn-danger-solid'}>
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
              <button onClick={() => { setShowBadgeForm(false); setEditingBadge(null); }} className="btn btn-secondary">取消</button>
              <button onClick={handleSaveBadge} disabled={!badgeForm.name || !badgeForm.target_days} className="btn btn-primary"><Check className="w-4 h-4" />保存</button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="form-label">徽章图标</label>
                <div className="flex items-center gap-2">
                  <div className="text-3xl w-14 h-14 rounded-lg flex items-center justify-center bg-warning-soft border border-border-subtle">
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

      {showRewardModal && (
        <Modal
          isOpen={!!showRewardModal}
          onClose={() => setShowRewardModal(null)}
          title="发放奖励"
          footer={
            <>
              <button onClick={() => setShowRewardModal(null)} className="btn btn-secondary">取消</button>
              <button onClick={handleDistributeReward} className="btn btn-primary"><Gift className="w-4 h-4" />确认发放</button>
            </>
          }
        >
            <div className="space-y-4">
              <div className="rounded-lg p-3 bg-bg-subtle">
                <div className="t-body-strong mb-1">{showRewardModal.nickname}</div>
                <div className="t-caption text-text-tertiary">累计打卡 {showRewardModal.checkin_days} 天</div>
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

      {showCheckinConfirm && (
        <Modal
          isOpen={!!showCheckinConfirm}
          onClose={() => setShowCheckinConfirm(null)}
          title={showCheckinConfirm.action === 'checkin' ? '确认打卡' : '确认取消打卡'}
          footer={
            <>
              <button onClick={() => setShowCheckinConfirm(null)} className="btn btn-secondary">取消</button>
              <button 
                onClick={confirmToggleCheckin} 
                className={showCheckinConfirm.action === 'checkin' ? 'btn btn-primary' : 'btn btn-danger-solid'}
              >
                {showCheckinConfirm.action === 'checkin' ? '确认打卡' : '确认取消'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-[14px] text-gray-700">
              {showCheckinConfirm.action === 'checkin' 
                ? `确定为该用户补卡 ${formatDate(showCheckinConfirm.date)} 的打卡吗？`
                : `确定取消该用户 ${formatDate(showCheckinConfirm.date)} 的打卡记录吗？`}
            </p>
            <p className="text-[12px] text-gray-400">
              {showCheckinConfirm.action === 'checkin' 
                ? '此操作将记录到打卡日志中'
                : '此操作不可撤销'}
            </p>
          </div>
        </Modal>
      )}
      </div>
    </motion.div>
  );
}
