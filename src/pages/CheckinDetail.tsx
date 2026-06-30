import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, CheckCircle2, XCircle, Award,
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
  }, [activeTab, reviewStatus, reviewPage, eventId]);

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
      const data = await fetchCheckinRecords(eventId, { status: reviewStatus, page: reviewPage, limit: 20 });
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
    <div className="p-6 max-w-7xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/checkin')} className="btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {event.group_name && (
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Users className="w-4 h-4" />
                {event.group_name}
              </span>
            )}
            <span className="text-sm text-slate-500">
              {formatDate(event.start_date)} - {formatDate(event.end_date)}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${CHECKIN_STATUS_COLORS[event.status]}`}>
              {CHECKIN_STATUS_LABELS[event.status]}
            </span>
          </div>
        </div>
        <a
          href={getExportUrl(eventId)}
          className="btn-secondary flex items-center gap-2"
          download
        >
          <Download className="w-4 h-4" />
          导出数据
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{event.participant_count}</div>
              <div className="text-xs text-slate-500">参与人数</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{event.total_days}</div>
              <div className="text-xs text-slate-500">活动天数</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{todayCount}</div>
              <div className="text-xs text-slate-500">{formatDate(selectedDate)}打卡</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{avgCheckinRate}%</div>
              <div className="text-xs text-slate-500">平均打卡率</div>
            </div>
          </div>
        </div>
      </div>

      {event.reward_rules && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-800 mb-1">奖励规则</div>
              <div className="text-sm text-amber-700 whitespace-pre-wrap">{event.reward_rules}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-x-auto">
        <div className="flex p-1.5 gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-6">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">打卡日历</h3>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} className="btn-icon-sm">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-slate-600 min-w-[80px] text-center">
                    {calendarMonth.year}年{calendarMonth.month + 1}月
                  </span>
                  <button onClick={nextMonth} className="btn-icon-sm">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-2">
                  {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((day, i) => (
                    <div key={i} className="aspect-square">
                      {day.date ? (
                        <button
                          onClick={() => day.isEventDay && setSelectedDate(day.date)}
                          disabled={!day.isEventDay}
                          className={`w-full h-full rounded-lg text-xs font-medium flex flex-col items-center justify-center transition-all relative ${
                            !day.isEventDay
                              ? 'text-slate-300 cursor-default'
                              : day.isSelected
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                              : isToday(day.date)
                              ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-200 hover:bg-rose-100'
                              : day.count && day.count > 0
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{new Date(day.date).getDate()}</span>
                          {day.isEventDay && day.count && day.count > 0 && !day.isSelected && (
                            <span className="text-[10px] font-bold">{day.count}人</span>
                          )}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-100" />
                  <span>有人打卡</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-rose-500" />
                  <span>当前选中</span>
                </div>
              </div>
            </div>

            {topParticipants.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-4 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    打卡排行榜
                  </h3>
                </div>
                <div className="p-2">
                  {topParticipants.map((p: any, idx: number) => {
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    return (
                      <div key={p.participant.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-lg">
                        <span className="text-lg w-6 text-center">{medals[idx]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {p.participant.nickname}
                            {p.participant.child_name && (
                              <span className="text-slate-400 text-xs ml-1">({p.participant.child_name})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">{p.checkin_days}天</div>
                          </div>
                          {p.current_streak > 1 && (
                            <div className="flex items-center gap-1 text-orange-500">
                              <Flame className="w-4 h-4" />
                              <span className="text-xs font-bold">{p.current_streak}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-rose-500" />
                      {formatDate(selectedDate)} 周{getDayOfWeek(selectedDate)}
                      {isToday(selectedDate) && (
                        <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">今天</span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">点击人员姓名可快速标记打卡</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {batchMode ? (
                      <>
                        <button onClick={selectAllUnchecked} className="btn-secondary text-sm py-1.5">
                          全选未打卡
                        </button>
                        <button
                          onClick={handleBatchCheckin}
                          disabled={selectedParticipants.size === 0}
                          className="btn-primary text-sm py-1.5 flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          批量打卡 ({selectedParticipants.size})
                        </button>
                        <button onClick={() => { setBatchMode(false); setSelectedParticipants(new Set()); }} className="btn-secondary text-sm py-1.5">
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setBatchMode(true)} className="btn-secondary text-sm py-1.5">
                          批量操作
                        </button>
                        <button onClick={() => setShowAddParticipant(true)} className="btn-primary text-sm py-1.5 flex items-center gap-1">
                          <UserPlus className="w-4 h-4" />
                          添加人员
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索参与者昵称..."
                    className="input pl-9"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {filteredParticipants.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400">暂无参与者，请先添加</p>
                  </div>
                ) : (
                  filteredParticipants.map((p: any) => {
                    const isChecked = !!getParticipantCheckedOnDate(p.participant.id, selectedDate);
                    return (
                      <div
                        key={p.participant.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                          isChecked ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        {batchMode && (
                          <button
                            onClick={() => toggleSelectParticipant(p.participant.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              selectedParticipants.has(p.participant.id)
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'border-slate-300 hover:border-rose-400'
                            }`}
                          >
                            {selectedParticipants.has(p.participant.id) && <Check className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => !batchMode && handleToggleCheckin(p.participant.id)}
                          className="flex-1 flex items-center gap-3 text-left"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {isChecked ? <CheckCircle2 className="w-5 h-5" /> : (p.participant.nickname[0] || '?')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isChecked ? 'text-emerald-700' : 'text-slate-900'}`}>
                                {p.participant.nickname}
                              </span>
                              {p.participant.child_name && (
                                <span className="text-xs text-slate-400">({p.participant.child_name})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500">累计 <b className={isChecked ? 'text-emerald-600' : 'text-slate-700'}>{p.checkin_days}</b> 天</span>
                              {p.current_streak >= 2 && (
                                <span className="text-xs text-orange-500 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />
                                  连续{p.current_streak}天
                                </span>
                              )}
                              {p.max_streak > p.current_streak && p.max_streak >= 3 && (
                                <span className="text-xs text-slate-400">最长{p.max_streak}天</span>
                              )}
                            </div>
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isChecked ? 'text-emerald-500' : 'text-slate-300'
                          }`}>
                            {isChecked ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                          </div>
                        </button>
                        {!batchMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveParticipant(p.participant.id); }}
                            className="btn-icon-sm text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 hover:opacity-100 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {['pending', 'approved', 'rejected', ''].map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => { setReviewStatus(s); setReviewPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    reviewStatus === s
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s ? RECORD_STATUS_LABELS[s] : '全部'}
                </button>
              ))}
            </div>
            <div className="text-sm text-slate-500">共 {reviewTotal} 条记录</div>
          </div>

          <div className="divide-y divide-slate-50">
            {loadingReview ? (
              <div className="p-12 text-center text-slate-400">加载中...</div>
            ) : reviewRecords.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">暂无打卡记录</p>
              </div>
            ) : (
              reviewRecords.map((r: any) => (
                <div key={r.id} className="p-4 flex items-start gap-4 hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
                    {r.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{r.nickname}</span>
                      {r.child_name && <span className="text-xs text-slate-400">({r.child_name})</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RECORD_STATUS_COLORS[r.status]}`}>
                        {RECORD_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{r.checkin_date}</div>
                    {r.note && <p className="text-sm text-slate-600 mb-2">{r.note}</p>}
                    {r.image_url && (
                      <img
                        src={r.image_url}
                        alt="打卡图片"
                        className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                      />
                    )}
                    {r.review_note && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                        审核备注：{r.review_note}
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'approve' }); setReviewNote(''); }}
                        className="btn-icon-sm text-emerald-600 hover:bg-emerald-50"
                        title="通过"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setShowReviewModal({ record: r, action: 'reject' }); setReviewNote(''); }}
                        className="btn-icon-sm text-red-500 hover:bg-red-50"
                        title="拒绝"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {reviewTotal > 20 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2">
              <button
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                上一页
              </button>
              <span className="text-sm text-slate-500">第 {reviewPage} 页</span>
              <button
                onClick={() => setReviewPage(p => p + 1)}
                disabled={reviewPage * 20 >= reviewTotal}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'badges' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              徽章管理
            </h3>
            <button
              onClick={() => {
                setEditingBadge(null);
                setBadgeForm({ name: '', description: '', icon: '🏅', type: 'streak', target_days: 7 });
                setShowBadgeForm(true);
              }}
              className="btn-primary text-sm py-1.5 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              添加徽章
            </button>
          </div>

          <div className="p-4">
            {badges.length === 0 ? (
              <div className="p-12 text-center">
                <Award className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">还没有徽章，点击右上角添加第一个吧</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((b: any) => (
                  <div key={b.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{b.icon || '🏅'}</div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingBadge(b);
                            setBadgeForm({ name: b.name, description: b.description || '', icon: b.icon || '🏅', type: b.type, target_days: b.target_days });
                            setShowBadgeForm(true);
                          }}
                          className="btn-icon-sm text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBadge(b.id)}
                          className="btn-icon-sm text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 mb-1">{b.name}</div>
                    <div className="text-xs text-slate-500 mb-2 line-clamp-2">{b.description || '暂无描述'}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {BADGE_TYPES.find(t => t.value === b.type)?.label}
                      </span>
                      <span className="text-xs text-slate-500">{b.target_days}天</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              资料管理
            </h3>
            <button
              onClick={() => {
                setEditingMaterial(null);
                setMaterialForm({ title: '', description: '', file_url: '', file_type: 'pdf', sort_order: 0, is_active: true });
                setShowMaterialForm(true);
              }}
              className="btn-primary text-sm py-1.5 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              添加资料
            </button>
          </div>

          <div className="divide-y divide-slate-50">
            {materials.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">还没有资料，点击右上角添加第一个吧</p>
              </div>
            ) : (
              materials.map((m: any) => (
                <div key={m.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 group">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-xl">
                      {m.file_type === 'pdf' ? '📄' : m.file_type === 'video' ? '🎬' : m.file_type === 'audio' ? '🎵' : '📎'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 mb-1 flex items-center gap-2">
                      {m.title}
                      {!m.is_active && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">已下架</span>
                      )}
                    </div>
                    {m.description && <p className="text-sm text-slate-500 mb-1">{m.description}</p>}
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
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
                      className="btn-icon-sm text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMaterial(m.id)}
                      className="btn-icon-sm text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {['', 'pending', 'distributed', 'not_qualified'].map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => setRewardStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    rewardStatus === s
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s ? REWARD_STATUS_LABELS[s] : '全部'}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={rewardSearch}
                onChange={e => setRewardSearch(e.target.value)}
                placeholder="搜索..."
                className="input pl-9 py-1.5 text-sm w-48"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {rewards.length === 0 ? (
              <div className="p-12 text-center">
                <Gift className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">暂无数据</p>
              </div>
            ) : (
              rewards.map((p: any) => (
                <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 shrink-0">
                    {p.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{p.nickname}</span>
                      {p.child_name && <span className="text-xs text-slate-400">({p.child_name})</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>打卡 <b className="text-slate-700">{p.checkin_days}</b> 天</span>
                      <span>加入 {p.joined_at?.split(' ')[0] || ''}</span>
                    </div>
                    {p.reward_note && (
                      <div className="text-xs text-slate-500 mt-1">奖励备注：{p.reward_note}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${REWARD_STATUS_COLORS[p.reward_status || 'pending']}`}>
                      {REWARD_STATUS_LABELS[p.reward_status || 'pending']}
                    </span>
                    {(p.reward_status === 'pending' || !p.reward_status) && (
                      <button
                        onClick={() => { setShowRewardModal(p); setRewardNote(''); }}
                        className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1"
                      >
                        <Gift className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">添加参与者</h3>
              <button onClick={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">家长昵称 *</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">孩子昵称（选填）</label>
                <input
                  type="text"
                  value={newParticipantChild}
                  onChange={e => setNewParticipantChild(e.target.value)}
                  placeholder="如：轩轩"
                  className="input"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowAddParticipant(false); setNewParticipantName(''); setNewParticipantChild(''); }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddParticipant}
                disabled={!newParticipantName.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showReviewModal.action === 'approve' ? '通过审核' : '拒绝审核'}
              </h3>
              <button onClick={() => setShowReviewModal(null)} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">审核备注（选填）</label>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder={showReviewModal.action === 'approve' ? '写点鼓励的话...' : '说明拒绝原因...'}
                  className="input min-h-[100px]"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowReviewModal(null)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleReview}
                className={`${showReviewModal.action === 'approve' ? 'btn-primary' : 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-medium transition-colors'} flex items-center gap-2`}
              >
                {showReviewModal.action === 'approve' ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                {showReviewModal.action === 'approve' ? '通过' : '拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBadgeForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900">
                {editingBadge ? '编辑徽章' : '添加徽章'}
              </h3>
              <button onClick={() => { setShowBadgeForm(false); setEditingBadge(null); }} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">徽章图标</label>
                <div className="flex items-center gap-2">
                  <div className="text-3xl w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">徽章名称 *</label>
                <input
                  type="text"
                  value={badgeForm.name}
                  onChange={e => setBadgeForm({ ...badgeForm, name: e.target.value })}
                  placeholder="如：连续打卡7天"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">徽章描述</label>
                <textarea
                  value={badgeForm.description}
                  onChange={e => setBadgeForm({ ...badgeForm, description: e.target.value })}
                  placeholder="简短描述一下这个徽章"
                  className="input min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">类型</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">目标天数</label>
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
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setShowBadgeForm(false); setEditingBadge(null); }} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleSaveBadge}
                disabled={!badgeForm.name || !badgeForm.target_days}
                className="btn-primary flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showMaterialForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMaterial ? '编辑资料' : '添加资料'}
              </h3>
              <button onClick={() => { setShowMaterialForm(false); setEditingMaterial(null); }} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">资料标题 *</label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                  placeholder="如：第1周学习资料"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">资料描述</label>
                <textarea
                  value={materialForm.description}
                  onChange={e => setMaterialForm({ ...materialForm, description: e.target.value })}
                  placeholder="简短介绍一下这个资料"
                  className="input min-h-[80px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">文件类型</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">文件链接</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">排序</label>
                  <input
                    type="number"
                    value={materialForm.sort_order}
                    onChange={e => setMaterialForm({ ...materialForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">状态</label>
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
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setShowMaterialForm(false); setEditingMaterial(null); }} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleSaveMaterial}
                disabled={!materialForm.title}
                className="btn-primary flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showRewardModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">发放奖励</h3>
              <button onClick={() => setShowRewardModal(null)} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-sm font-medium text-slate-900 mb-1">{showRewardModal.nickname}</div>
                <div className="text-xs text-slate-500">累计打卡 {showRewardModal.checkin_days} 天</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">奖励备注（选填）</label>
                <textarea
                  value={rewardNote}
                  onChange={e => setRewardNote(e.target.value)}
                  placeholder="如：已发放绘本一套"
                  className="input min-h-[80px]"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowRewardModal(null)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleDistributeReward}
                className="btn-primary flex items-center gap-2"
              >
                <Gift className="w-4 h-4" />
                确认发放
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
