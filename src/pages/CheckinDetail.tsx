import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Calendar, CheckCircle2, XCircle, Award,
  Plus, UserPlus, Check, X, Search, ChevronLeft, ChevronRight,
  Trash2, Flame, Trophy, Target,
} from 'lucide-react';
import { useStore } from '@/store';
import { CHECKIN_STATUS_LABELS, CHECKIN_STATUS_COLORS } from '../../shared/types';

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

  useEffect(() => {
    if (eventId) loadCheckinEvent(eventId);
  }, [eventId]);

  useEffect(() => {
    if (selectedCheckinEvent && !selectedCheckinEvent.calendar.some(c => c.date === selectedDate)) {
      const today = new Date().toISOString().split('T')[0];
      if (selectedCheckinEvent.calendar.some(c => c.date === today)) {
        setSelectedDate(today);
      } else if (selectedCheckinEvent.calendar.length > 0) {
        setSelectedDate(selectedCheckinEvent.calendar[selectedCheckinEvent.calendar.length - 1].date);
      }
    }
  }, [selectedCheckinEvent]);

  if (!selectedCheckinEvent) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const event = selectedCheckinEvent;
  const eventStart = new Date(event.start_date);
  const eventEnd = new Date(event.end_date);

  const todayCount = event.calendar.find(c => c.date === selectedDate)?.count || 0;
  const totalCheckinDays = event.participants.reduce((sum, p) => sum + p.checkin_days, 0);
  const avgCheckinRate = event.participant_count && event.total_days
    ? Math.round((totalCheckinDays / (event.participant_count * event.total_days)) * 100)
    : 0;

  const topParticipants = [...event.participants].sort((a, b) => b.checkin_days - a.checkin_days).slice(0, 5);
  const filteredParticipants = event.participants.filter(p =>
    !searchQuery ||
    p.participant.nickname.includes(searchQuery) ||
    (p.participant.child_name && p.participant.child_name.includes(searchQuery))
  );

  const getParticipantCheckedOnDate = (participantId: number, date: string): number | null => {
    const p = event.participants.find(x => x.participant.id === participantId);
    if (!p) return null;
    const record = p.records.find(r => r.checkin_date === date);
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
    filteredParticipants.forEach(p => {
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
      const calendarDay = event.calendar.find(c => c.date === dateStr);
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
                {topParticipants.map((p, idx) => {
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
                filteredParticipants.map(p => {
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
    </div>
  );
}
