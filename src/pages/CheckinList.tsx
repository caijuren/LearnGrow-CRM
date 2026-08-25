import { useEffect, useState } from 'react';
import {
  Plus, Calendar, Users, CheckCircle2, Clock, Award,
  Edit2, Trash2, ChevronRight, Check, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  CHECKIN_STATUS_LABELS, CHECKIN_STATUS_COLORS,
  type CheckinEventStatus, type CheckinEvent,
} from '../../shared/types';
import Empty from '@/components/Empty';
import Modal from '@/components/Modal';

const STATUS_FILTERS: { value: CheckinEventStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' },
];

const EVENT_COLORS = [
  'bg-brand-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-slate-700',
];

interface EventForm {
  name: string;
  group_id: number | null;
  start_date: string;
  end_date: string;
  required_text: string;
  reward_rules: string;
  allow_makeup: boolean;
  makeup_window_days: number;
  makeup_limit_per_user: number;
  makeup_requires_review: boolean;
  makeup_counts_for_streak: boolean;
  status: CheckinEventStatus;
}

const emptyForm: EventForm = {
  name: '',
  group_id: null,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
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
  }, []);

  useEffect(() => {
    if (isRecycleBinView) {
      loadDeletedCheckinEvents();
    }
  }, [isRecycleBinView, loadDeletedCheckinEvents]);

  const handleSubmit = async () => {
    if (!form.name || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      if (editingEvent) {
        await editCheckinEvent(editingEvent.id, form);
        setEditingEvent(null);
      } else {
        await addCheckinEvent(form);
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
    <div className="page-shell">
      <div className="page-inner">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{
              fontSize: '1.375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {isRecycleBinView ? '打卡活动回收站' : '群打卡统计'}
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
            }}
          >
            {isRecycleBinView ? '误删的活动可以在这里恢复，也可以彻底删除' : '管理群打卡活动，一键统计打卡情况'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRecycleBinView ? (
            <button
              onClick={() => setIsRecycleBinView(false)}
              className="btn-secondary flex items-center gap-2"
            >
              <ChevronRight size={15} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} />
              返回活动列表
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsRecycleBinView(true)}
                className="btn-secondary flex items-center gap-2"
                title="回收站"
              >
                <Trash2 size={15} strokeWidth={1.8} />
                回收站
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={15} strokeWidth={2} />
                创建打卡活动
              </button>
            </>
          )}
        </div>
      </div>

      {!isRecycleBinView && (
        <div className="flex items-center gap-0.5 flex-wrap mb-5">
          {STATUS_FILTERS.map(f => {
            const isActive = (checkinFilter.status || '') === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setCheckinFilter({ status: f.value || undefined })}
                className="transition-all"
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? 'var(--color-primary-soft)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {displayedEvents.length === 0 ? (
        <div
          className="p-12 flex items-center justify-center"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Empty
            icon={<Calendar size={36} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />}
            title={isRecycleBinView ? '回收站为空' : '暂无打卡活动'}
            description={isRecycleBinView ? '删除的打卡活动会出现在这里' : '点击右上角按钮创建第一个打卡活动吧'}
            action={
              isRecycleBinView ? (
                <button
                  onClick={() => setIsRecycleBinView(false)}
                  className="btn-secondary"
                >
                  返回活动列表
                </button>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary"
                >
                  <Plus size={14} strokeWidth={2} />
                  创建打卡活动
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayedEvents.map(event => {
            const daysLeft = getDaysLeft(event.end_date);
            const progress = getProgress(event.start_date, event.end_date);
            const isActive = event.status === 'active';

            const statusStyle: Record<string, { bg: string; color: string }> = {
              active: { bg: 'rgb(16 185 129 / 0.1)', color: 'rgb(5 150 105)' },
              ended: { bg: 'rgb(107 114 128 / 0.1)', color: 'rgb(75 85 99)' },
            };
            const status = isRecycleBinView
              ? { bg: 'rgb(107 114 128 / 0.1)', color: 'rgb(75 85 99)' }
              : statusStyle[event.status] || statusStyle.ended;

            return (
              <div
                key={event.id}
                onClick={() => !isRecycleBinView && navigate(`/checkin/${event.id}`)}
                className={`group overflow-hidden transition-all duration-150 ${isRecycleBinView ? '' : 'cursor-pointer'}`}
                style={{
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
                onMouseEnter={(e) => {
                  if (!isRecycleBinView) {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgb(16 24 40 / 0.04), 0 4px 12px rgb(16 24 40 / 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <Award size={17} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h3
                          className="truncate flex-1"
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            lineHeight: 1.4,
                          }}
                        >
                          {event.name}
                        </h3>
                        <span
                          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-sm"
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            backgroundColor: status.bg,
                            color: status.color,
                          }}
                        >
                          {isRecycleBinView ? '已删除' : CHECKIN_STATUS_LABELS[event.status]}
                        </span>
                      </div>
                      {event.group_name && (
                        <div
                          className="flex items-center gap-1"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          <Users size={11} strokeWidth={1.8} />
                          <span className="truncate">{event.group_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 mb-3 pt-3"
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Users size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {event.participant_count || 0}
                      </span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        人参与
                      </span>
                    </div>
                    {!isRecycleBinView && isActive && daysLeft >= 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--color-primary)',
                          }}
                        >
                          {daysLeft}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          天后结束
                        </span>
                      </div>
                    )}
                    {!isRecycleBinView && isActive && daysLeft < 0 && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          已到期
                        </span>
                      </div>
                    )}
                    {isRecycleBinView && event.deleted_at && (
                      <div className="flex items-center gap-1.5">
                        <Trash2 size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          删除于 {event.deleted_at.split(' ')[0]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 进度条 */}
                  <div className="mb-1">
                    <div
                      className="flex items-center justify-between mb-1.5"
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <span>{event.start_date}</span>
                      <span>{event.end_date}</span>
                    </div>
                    <div
                      className="w-full overflow-hidden"
                      style={{
                        height: '4px',
                        backgroundColor: 'var(--color-border-subtle)',
                        borderRadius: '9999px',
                      }}
                    >
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: '9999px',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-tertiary)',
                        marginTop: '4px',
                      }}
                    >
                      共 {event.total_days} 天
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    backgroundColor: 'var(--color-bg-subtle)',
                  }}
                >
                  {isRecycleBinView ? (
                    <span
                      className="flex items-center gap-1"
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <AlertTriangle size={12} strokeWidth={1.8} />
                      彻底删除后无法恢复
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-0.5"
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <ChevronRight size={12} strokeWidth={1.8} />
                      点击录入打卡
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isRecycleBinView ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRestoringEventId(event.id); }}
                          className="transition-colors"
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'rgb(5 150 105)',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgb(16 185 129 / 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <RotateCcw size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPermanentlyDeletingEventId(event.id); }}
                          className="transition-colors"
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-tertiary)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.08)';
                            e.currentTarget.style.color = 'rgb(220 38 38)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleEditClick(e, event)}
                          className="transition-colors"
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-tertiary)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <Edit2 size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingEventId(event.id); }}
                          className="transition-colors"
                          style={{
                            padding: '4px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-tertiary)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.08)';
                            e.currentTarget.style.color = 'rgb(220 38 38)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal
          isOpen={showForm}
          onClose={() => { setShowForm(false); setEditingEvent(null); setForm(emptyForm); }}
          title={editingEvent ? '编辑打卡活动' : '创建打卡活动'}
          size="lg"
          footer={
            <>
              <button onClick={() => { setShowForm(false); setEditingEvent(null); setForm(emptyForm); }} className="btn-secondary">取消</button>
              <button onClick={handleSubmit} disabled={saving || !form.name || !form.start_date || !form.end_date} className="btn-primary">
                {saving ? '保存中...' : <><Check className="w-4 h-4" />{editingEvent ? '保存修改' : '创建活动'}</>}
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">活动名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：ABC Reading 6月打卡"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">关联微信群（可选）</label>
                <select
                  value={form.group_id || ''}
                  onChange={e => setForm({ ...form, group_id: e.target.value ? Number(e.target.value) : null })}
                  className="input"
                >
                  <option value="">不关联群</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">关联群后会自动导入群成员作为参与者</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">开始日期 *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">结束日期 *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">打卡要求文字</label>
                <textarea
                  value={form.required_text}
                  onChange={e => setForm({ ...form, required_text: e.target.value })}
                  placeholder="如：ABC Reading打卡DayX+照片"
                  className="input min-h-[80px] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">奖励规则</label>
                <textarea
                  value={form.reward_rules}
                  onChange={e => setForm({ ...form, reward_rules: e.target.value })}
                  placeholder="如：满21天送绘本，满15天送电子资料..."
                  className="input min-h-[80px] resize-none"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">允许补卡</div>
                    <div className="text-xs text-slate-500 mt-0.5">开启后，家长可在规则内补交过去漏打的日期</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.allow_makeup}
                    onChange={e => setForm({ ...form, allow_makeup: e.target.checked })}
                    className="h-5 w-5 accent-brand-600"
                  />
                </label>

                {form.allow_makeup && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">可补最近几天</label>
                        <input
                          type="number"
                          min={1}
                          value={form.makeup_window_days}
                          onChange={e => setForm({ ...form, makeup_window_days: Math.max(1, Number(e.target.value) || 1) })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">每人最多补卡次数</label>
                        <input
                          type="number"
                          min={1}
                          value={form.makeup_limit_per_user}
                          onChange={e => setForm({ ...form, makeup_limit_per_user: Math.max(1, Number(e.target.value) || 1) })}
                          className="input"
                        />
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-700">补卡需要老师审核</span>
                      <input
                        type="checkbox"
                        checked={form.makeup_requires_review}
                        onChange={e => setForm({ ...form, makeup_requires_review: e.target.checked })}
                        className="h-5 w-5 accent-brand-600"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-700">补卡修复连续打卡</span>
                      <input
                        type="checkbox"
                        checked={form.makeup_counts_for_streak}
                        onChange={e => setForm({ ...form, makeup_counts_for_streak: e.target.checked })}
                        className="h-5 w-5 accent-brand-600"
                      />
                    </label>
                    <p className="text-xs text-slate-500">建议默认关闭：补卡计入累计天数，但不修复连续打卡，更利于排行榜公平。</p>
                  </>
                )}
              </div>
            </div>
        </Modal>
      )}
      <Modal
        isOpen={deletingEventId !== null}
        onClose={() => !deleting && setDeletingEventId(null)}
        title="确认删除打卡活动"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletingEventId(null)} disabled={deleting} className="btn-secondary flex-1">取消</button>
            <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1 bg-red-500 text-white hover:bg-red-600">
              {deleting ? '删除中...' : '移至回收站'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">活动将移至回收站，打卡记录、参与人员等数据都会保留，可随时恢复。</p>
      </Modal>

      <Modal
        isOpen={restoringEventId !== null}
        onClose={() => !restoring && setRestoringEventId(null)}
        title="恢复打卡活动"
        size="sm"
        footer={
          <>
            <button onClick={() => setRestoringEventId(null)} disabled={restoring} className="btn-secondary flex-1">取消</button>
            <button onClick={handleRestore} disabled={restoring} className="btn-primary flex-1 bg-emerald-500 text-white hover:bg-emerald-600">
              {restoring ? '恢复中...' : '恢复活动'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">恢复后活动将重新出现在活动列表中，所有打卡数据完整保留。</p>
      </Modal>

      <Modal
        isOpen={permanentlyDeletingEventId !== null}
        onClose={() => !permanentlyDeleting && setPermanentlyDeletingEventId(null)}
        title="确认彻底删除"
        size="sm"
        footer={
          <>
            <button onClick={() => setPermanentlyDeletingEventId(null)} disabled={permanentlyDeleting} className="btn-secondary flex-1">取消</button>
            <button onClick={handlePermanentDelete} disabled={permanentlyDeleting} className="btn-danger flex-1 bg-red-500 text-white hover:bg-red-600">
              {permanentlyDeleting ? '删除中...' : '彻底删除'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">此操作会永久删除该活动及其所有打卡记录、参与人员、徽章等数据，无法恢复。</p>
      </Modal>
      </div>
    </div>
  );
}
