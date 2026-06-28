import { useEffect, useState } from 'react';
import {
  Plus, Calendar, Users, CheckCircle2, Clock, Award,
  Edit2, Trash2, ChevronRight, X, Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  CHECKIN_STATUS_LABELS, CHECKIN_STATUS_COLORS,
  type CheckinEventStatus, type WechatGroup,
} from '../../shared/types';
import Empty from '@/components/Empty';

const STATUS_FILTERS: { value: CheckinEventStatus | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'ended', label: '已结束' },
];

const EVENT_COLORS = [
  'from-rose-400 to-pink-500',
  'from-orange-400 to-amber-500',
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-cyan-500',
  'from-violet-400 to-purple-500',
  'from-fuchsia-400 to-pink-500',
];

interface EventForm {
  name: string;
  group_id: number | null;
  start_date: string;
  end_date: string;
  required_text: string;
  reward_rules: string;
  status: CheckinEventStatus;
}

const emptyForm: EventForm = {
  name: '',
  group_id: null,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  required_text: '',
  reward_rules: '',
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
  const { checkinEvents, groups, checkinFilter, loadCheckinEvents, loadGroups, addCheckinEvent, removeCheckinEvent, setCheckinFilter } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCheckinEvents();
    loadGroups();
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      await addCheckinEvent(form);
      setShowForm(false);
      setForm(emptyForm);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定删除这个打卡活动吗？所有打卡记录都会被删除。')) {
      await removeCheckinEvent(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">群打卡统计</h1>
          <p className="text-sm text-slate-500 mt-1">管理群打卡活动，一键统计打卡情况</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          创建打卡活动
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setCheckinFilter({ status: f.value || undefined })}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              (checkinFilter.status || '') === f.value
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {checkinEvents.length === 0 ? (
        <Empty
          icon={Calendar}
          title="暂无打卡活动"
          description="点击右上角按钮创建第一个打卡活动吧"
          action={{ label: '创建打卡活动', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {checkinEvents.map(event => {
            const color = EVENT_COLORS[event.id % EVENT_COLORS.length];
            const daysLeft = getDaysLeft(event.end_date);
            const progress = getProgress(event.start_date, event.end_date);
            const isActive = event.status === 'active';

            return (
              <div
                key={event.id}
                onClick={() => navigate(`/checkin/${event.id}`)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-slate-100 hover:border-rose-200 group overflow-hidden"
              >
                <div className={`h-28 bg-gradient-to-br ${color} relative p-4`}>
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
                  <div className="relative flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${CHECKIN_STATUS_COLORS[event.status]}`}>
                      {CHECKIN_STATUS_LABELS[event.status]}
                    </span>
                  </div>
                </div>

                <div className="p-4 -mt-4 relative">
                  <div className="bg-white rounded-xl p-3 mb-3 shadow-sm border border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 mb-1 truncate group-hover:text-rose-600 transition-colors">
                      {event.name}
                    </h3>
                    {event.group_name && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event.group_name}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold">{event.participant_count || 0}</span>
                      <span className="text-slate-400 text-xs">人参与</span>
                    </div>
                    {isActive && daysLeft >= 0 && (
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-semibold">{daysLeft}</span>
                        <span className="text-rose-400 text-xs">天后结束</span>
                      </div>
                    )}
                    {isActive && daysLeft < 0 && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-semibold">已到期</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{event.start_date}</span>
                      <span>{event.end_date}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">共 {event.total_days} 天</div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      点击录入打卡
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => e.stopPropagation()} className="btn-icon-sm">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => handleDelete(event.id, e)} className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900">创建打卡活动</h3>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="btn-icon-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
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
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name || !form.start_date || !form.end_date}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? '创建中...' : <><Check className="w-4 h-4" />创建活动</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
