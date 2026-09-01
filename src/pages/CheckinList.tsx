import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Calendar, Users, CheckCircle2, Clock, Award,
  Edit2, Trash2, ChevronRight, Check, RotateCcw, AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  CHECKIN_STATUS_LABELS,
  type CheckinEventStatus, type CheckinEvent,
} from '../../shared/types';
import Modal from '@/components/Modal';

const STATUS_FILTERS: { value: CheckinEventStatus; label: string }[] = [
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' },
];

const STATUS_BADGE: Record<CheckinEventStatus, string> = {
  active: 'badge-primary',
  ended: 'badge-neutral',
};

interface EventForm {
  name: string;
  group_id: number | null;
  start_date: string;
  end_date: string;
  signup_deadline?: string;
  required_text: string;
  reward_rules: string;
  allow_makeup: boolean;
  makeup_window_days: number;
  makeup_limit_per_user: number;
  makeup_requires_review: boolean;
  makeup_counts_for_streak: boolean;
  status: CheckinEventStatus;
  auto_import_members?: boolean;
}

const emptyForm: EventForm = {
  name: '',
  group_id: null,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  signup_deadline: '',
  auto_import_members: false,
  required_text: '',
  reward_rules: '',
  allow_makeup: false,
  makeup_window_days: 3,
  makeup_limit_per_user: 3,
  makeup_requires_review: true,
  makeup_counts_for_streak: false,
  status: 'active',
};

function getDaysLeft(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getProgress(startDate: string, endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const total = end.getTime() - start.getTime();
  const passed = today.getTime() - start.getTime();
  if (passed < 0) return 0;
  if (passed > total) return 100;
  return Math.round((passed / total) * 100);
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function CheckinList() {
  const navigate = useNavigate();
  const {
    checkinEvents, deletedCheckinEvents, groups, checkinFilter,
    loadCheckinEvents, loadDeletedCheckinEvents, loadGroups,
    addCheckinEvent, editCheckinEvent, removeCheckinEvent,
    restoreCheckinEvent, permanentlyDeleteCheckinEvent, setCheckinFilter,
  } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [isRecycleBinView, setIsRecycleBinView] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);
  const [restoringEventId, setRestoringEventId] = useState<number | null>(null);
  const [permanentlyDeletingEventId, setPermanentlyDeletingEventId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<CheckinEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);

  useEffect(() => {
    loadCheckinEvents();
    loadGroups();
  }, [loadCheckinEvents, loadGroups]);

  useEffect(() => {
    if (isRecycleBinView) {
      loadDeletedCheckinEvents();
    }
  }, [isRecycleBinView, loadDeletedCheckinEvents]);

  const handleSubmit = async () => {
    if (!form.name || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      const payload = { ...form, signup_deadline: form.signup_deadline || undefined };
      if (editingEvent) {
        await editCheckinEvent(editingEvent.id, payload);
        setEditingEvent(null);
      } else {
        await addCheckinEvent(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent, event: CheckinEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setForm({
      name: event.name,
      group_id: event.group_id,
      start_date: event.start_date,
      end_date: event.end_date,
      signup_deadline: event.signup_deadline || '',
      auto_import_members: false,
      required_text: event.required_text || '',
      reward_rules: event.reward_rules || '',
      allow_makeup: !!event.allow_makeup,
      makeup_window_days: event.makeup_window_days ?? 3,
      makeup_limit_per_user: event.makeup_limit_per_user ?? 3,
      makeup_requires_review: !!event.makeup_requires_review,
      makeup_counts_for_streak: !!event.makeup_counts_for_streak,
      status: event.status,
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deletingEventId === null) return;
    setDeleting(true);
    try {
      await removeCheckinEvent(deletingEventId);
      setDeletingEventId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (restoringEventId === null) return;
    setRestoring(true);
    try {
      await restoreCheckinEvent(restoringEventId);
      setRestoringEventId(null);
    } finally {
      setRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (permanentlyDeletingEventId === null) return;
    setPermanentlyDeleting(true);
    try {
      await permanentlyDeleteCheckinEvent(permanentlyDeletingEventId);
      setPermanentlyDeletingEventId(null);
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  const displayedEvents = isRecycleBinView ? deletedCheckinEvents : checkinEvents;

  return (
    <div className="min-h-full bg-bg-page p-6 md:p-8">
      <div className="max-w-[1440px] mx-auto">
        {/* Header */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between mb-8"
        >
          <motion.div variants={fadeUp}>
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
              {isRecycleBinView ? '打卡活动回收站' : '群打卡统计'}
            </h1>
            <p className="text-sm text-text-tertiary mt-1">
              {isRecycleBinView
                ? '误删的活动可以在这里恢复，也可以彻底删除'
                : '管理群打卡活动，一键统计打卡情况'}
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center gap-3">
            {isRecycleBinView ? (
              <button
                onClick={() => setIsRecycleBinView(false)}
                className="btn btn-secondary"
              >
                <ChevronLeft size={15} strokeWidth={2} />
                返回活动列表
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsRecycleBinView(true)}
                  className="btn btn-secondary"
                  title="回收站"
                >
                  <Trash2 size={15} strokeWidth={1.8} />
                  回收站
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="btn btn-primary"
                >
                  <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                    <Plus size={13} strokeWidth={2.5} />
                  </span>
                  创建打卡活动
                </button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Filter Tabs */}
        {!isRecycleBinView && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6">
            <div className="inline-flex items-center gap-1 p-1 bg-bg-subtle rounded-xl border border-border-default">
              {STATUS_FILTERS.map((f) => {
                const isActive = checkinFilter.status === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setCheckinFilter({ status: f.value })}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-bg-surface text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {displayedEvents.length === 0 ? (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="clean-card p-16 flex flex-col items-center justify-center text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-bg-subtle flex items-center justify-center mb-5">
              <Calendar size={32} strokeWidth={1.5} className="text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {isRecycleBinView ? '回收站为空' : '暂无打卡活动'}
            </h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm">
              {isRecycleBinView
                ? '删除的打卡活动会出现在这里'
                : '点击右上角按钮创建第一个打卡活动，开始记录学员打卡情况'}
            </p>
            {isRecycleBinView ? (
              <button onClick={() => setIsRecycleBinView(false)} className="btn btn-secondary">
                返回活动列表
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="btn btn-primary"
              >
                <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                  <Plus size={13} strokeWidth={2.5} />
                </span>
                创建打卡活动
              </button>
            )}
          </motion.div>
        ) : (
          /* Event Cards */
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {displayedEvents.map((event) => {
              const daysLeft = getDaysLeft(event.end_date);
              const progress = getProgress(event.start_date, event.end_date);
              // 前端也根据 end_date 动态修正状态（双保险，避免依赖数据库静态 status）
              const todayStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
              const realStatus = event.end_date < todayStr ? 'ended' : 'active';
              const isActive = realStatus === 'active';

              return (
                <motion.div
                  key={event.id}
                  variants={fadeUp}
                  onClick={() => !isRecycleBinView && navigate(`/checkin/${event.id}`)}
                  className={`clean-card overflow-hidden group relative ${isRecycleBinView ? '' : 'cursor-pointer'}`}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[20px]"
                    style={{ background: isRecycleBinView ? 'linear-gradient(90deg, #9CA3AF 0%, #D1D5DB 100%)' : 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)' }}
                  />
                  <div className="p-5 pt-[22px]">
                    {/* Card Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                        <Award size={20} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary truncate">
                            {event.name}
                          </h3>
                          <span className={`badge shrink-0 whitespace-nowrap ${isRecycleBinView ? 'badge-neutral' : STATUS_BADGE[realStatus]}`}>
                            {isRecycleBinView ? '已删除' : CHECKIN_STATUS_LABELS[realStatus]}
                          </span>
                        </div>
                        {event.group_name && (
                          <div className="flex items-center gap-1 text-xs text-text-tertiary">
                            <Users size={11} strokeWidth={1.8} style={{ color: '#8B5CF6' }} />
                            <span className="truncate">{event.group_name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* KPI Row */}
                    <div className="flex items-center gap-5 py-4 border-y border-border-subtle mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEF0FF', color: '#5B5CE2' }}>
                          <Users size={14} strokeWidth={1.8} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-text-primary">{event.participant_count || 0}</span>
                          <span className="text-xs text-text-tertiary ml-1">人参与</span>
                        </div>
                      </div>

                      {!isRecycleBinView && isActive && daysLeft >= 0 && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
                            <Clock size={14} strokeWidth={1.8} />
                          </div>
                          <div>
                            <span className="text-sm font-semibold" style={{ color: '#F59E0B' }}>{daysLeft}</span>
                            <span className="text-xs text-text-tertiary ml-1">天后结束</span>
                          </div>
                        </div>
                      )}

                      {!isRecycleBinView && isActive && daysLeft < 0 && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F2F4F7', color: '#667085' }}>
                            <CheckCircle2 size={14} strokeWidth={1.8} />
                          </div>
                          <span className="text-xs text-text-secondary">已到期</span>
                        </div>
                      )}

                      {isRecycleBinView && event.deleted_at && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3F2', color: '#EF4444' }}>
                            <Trash2 size={14} strokeWidth={1.8} />
                          </div>
                          <span className="text-xs text-text-tertiary">
                            删除于 {event.deleted_at.split(' ')[0]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mb-1">
                      <div className="flex items-center justify-between text-[11px] text-text-tertiary mb-1.5">
                        <span>{event.start_date}</span>
                        <span>{event.end_date}</span>
                      </div>
                      <div className="w-full h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)' }}
                        />
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-1.5">
                        共 {event.total_days} 天
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-bg-subtle/40">
                    {isRecycleBinView ? (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <AlertTriangle size={12} strokeWidth={1.8} />
                        彻底删除后无法恢复
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-xs text-text-tertiary group-hover:text-primary transition-colors">
                        <ChevronRight size={12} strokeWidth={1.8} />
                        点击录入打卡
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      {isRecycleBinView ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setRestoringEventId(event.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-success hover:bg-success-soft transition-colors"
                            title="恢复"
                          >
                            <RotateCcw size={14} strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPermanentlyDeletingEventId(event.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                            title="彻底删除"
                          >
                            <Trash2 size={14} strokeWidth={1.8} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => handleEditClick(e, event)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-primary hover:bg-primary-soft transition-colors"
                            title="编辑"
                          >
                            <Edit2 size={14} strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingEventId(event.id); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} strokeWidth={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Create / Edit Modal */}
        {showForm && (
          <Modal
            isOpen={showForm}
            onClose={() => { setShowForm(false); setEditingEvent(null); setForm(emptyForm); }}
            title={editingEvent ? '编辑打卡活动' : '创建打卡活动'}
            size="lg"
            footer={
              <>
                <button
                  onClick={() => { setShowForm(false); setEditingEvent(null); setForm(emptyForm); }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.name || !form.start_date || !form.end_date}
                  className="btn-primary"
                >
                  {saving ? '保存中...' : <><Check size={15} strokeWidth={2} />{editingEvent ? '保存修改' : '创建活动'}</>}
                </button>
              </>
            }
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">活动名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：ABC Reading 6月打卡"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">关联微信群（可选）</label>
                <select
                  value={form.group_id || ''}
                  onChange={(e) => setForm({ ...form, group_id: e.target.value ? Number(e.target.value) : null })}
                  className="input"
                >
                  <option value="">不关联群</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {!editingEvent && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-text-tertiary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.auto_import_members}
                      onChange={(e) => setForm({ ...form, auto_import_members: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    发布时自动导入群成员为参与者（不勾选则需家长在小程序内报名）
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">开始日期 *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">结束日期 *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">报名截止时间</label>
                  <input
                    type="date"
                    value={form.signup_deadline || ''}
                    onChange={(e) => setForm({ ...form, signup_deadline: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-text-tertiary mt-1.5">留空则与开始日期相同；截止当天及之后不可报名，未报名者无法打卡</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">打卡要求文字</label>
                <textarea
                  value={form.required_text}
                  onChange={(e) => setForm({ ...form, required_text: e.target.value })}
                  placeholder="如：ABC Reading打卡DayX+照片"
                  className="input min-h-[80px] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">奖励规则</label>
                <textarea
                  value={form.reward_rules}
                  onChange={(e) => setForm({ ...form, reward_rules: e.target.value })}
                  placeholder="如：满21天送绘本，满15天送电子资料..."
                  className="input min-h-[80px] resize-none"
                />
              </div>

              <div className="rounded-xl border border-border-default bg-bg-subtle/50 p-4 space-y-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">允许补卡</div>
                    <div className="text-xs text-text-tertiary mt-0.5">开启后，家长可在规则内补交过去漏打的日期</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.allow_makeup}
                    onChange={(e) => setForm({ ...form, allow_makeup: e.target.checked })}
                    className="h-5 w-5 accent-primary"
                  />
                </label>

                {form.allow_makeup && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">可补最近几天</label>
                        <input
                          type="number"
                          min={1}
                          value={form.makeup_window_days}
                          onChange={(e) => setForm({ ...form, makeup_window_days: Math.max(1, Number(e.target.value) || 1) })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">每人最多补卡次数</label>
                        <input
                          type="number"
                          min={1}
                          value={form.makeup_limit_per_user}
                          onChange={(e) => setForm({ ...form, makeup_limit_per_user: Math.max(1, Number(e.target.value) || 1) })}
                          className="input"
                        />
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-text-primary">补卡需要老师审核</span>
                      <input
                        type="checkbox"
                        checked={form.makeup_requires_review}
                        onChange={(e) => setForm({ ...form, makeup_requires_review: e.target.checked })}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-text-primary">补卡修复连续打卡</span>
                      <input
                        type="checkbox"
                        checked={form.makeup_counts_for_streak}
                        onChange={(e) => setForm({ ...form, makeup_counts_for_streak: e.target.checked })}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                    <p className="text-xs text-text-tertiary">建议默认关闭：补卡计入累计天数，但不修复连续打卡，更利于排行榜公平。</p>
                  </>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Delete Confirm Modal */}
        <Modal
          isOpen={deletingEventId !== null}
          onClose={() => !deleting && setDeletingEventId(null)}
          title="确认删除打卡活动"
          size="sm"
          footer={
            <>
              <button onClick={() => setDeletingEventId(null)} disabled={deleting} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? '删除中...' : '移至回收站'}
              </button>
            </>
          }
        >
          <p className="text-sm text-text-secondary">活动将移至回收站，打卡记录、参与人员等数据都会保留，可随时恢复。</p>
        </Modal>

        {/* Restore Modal */}
        <Modal
          isOpen={restoringEventId !== null}
          onClose={() => !restoring && setRestoringEventId(null)}
          title="恢复打卡活动"
          size="sm"
          footer={
            <>
              <button onClick={() => setRestoringEventId(null)} disabled={restoring} className="btn-secondary flex-1">取消</button>
              <button onClick={handleRestore} disabled={restoring} className="btn-primary flex-1">
                {restoring ? '恢复中...' : '恢复活动'}
              </button>
            </>
          }
        >
          <p className="text-sm text-text-secondary">恢复后活动将重新出现在活动列表中，所有打卡数据完整保留。</p>
        </Modal>

        {/* Permanent Delete Modal */}
        <Modal
          isOpen={permanentlyDeletingEventId !== null}
          onClose={() => !permanentlyDeleting && setPermanentlyDeletingEventId(null)}
          title="确认彻底删除"
          size="sm"
          footer={
            <>
              <button onClick={() => setPermanentlyDeletingEventId(null)} disabled={permanentlyDeleting} className="btn-secondary flex-1">取消</button>
              <button onClick={handlePermanentDelete} disabled={permanentlyDeleting} className="btn-danger flex-1">
                {permanentlyDeleting ? '删除中...' : '彻底删除'}
              </button>
            </>
          }
        >
          <p className="text-sm text-text-secondary">此操作会永久删除该活动及其所有打卡记录、参与人员、徽章等数据，无法恢复。</p>
        </Modal>
      </div>
    </div>
  );
}
