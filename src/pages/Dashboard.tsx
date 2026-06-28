import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  STAGE_LABELS, STAGE_COLORS, WECHAT_ACCOUNT_LABELS, ORDER_TYPE_COLORS, ORDER_TYPE_LABELS,
  IMPORTANCE_COLORS, IMPORTANCE_LABELS
} from '../../shared/types';
import {
  Users, MessageCircle, Clock, AlertTriangle, ShoppingBag, Sparkles, ArrowRight,
  ChevronRight, UserPlus, UserMinus, CheckCircle2, Lightbulb, Phone
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loadDashboard } = useStore();

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = dashboard?.stats || {
    today_revenue: 0, month_revenue: 0, total_customers: 0, today_new_customers: 0,
    pending_todos: 0, need_follow_count: 0, new_friends_count: 0, silent_count: 0
  };
  const stageStats = dashboard?.stageStats || [];
  const needFollowCustomers = dashboard?.needFollowCustomers || [];
  const recentOrders = dashboard?.recentOrders || [];

  const statCards = [
    { label: '待跟进', value: stats.need_follow_count, icon: MessageCircle, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-50', text: 'text-rose-600', action: () => navigate('/customers?stage=need_follow') },
    { label: '新好友(3天)', value: stats.new_friends_count, icon: UserPlus, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-600', action: () => navigate('/customers?stage=new_friend') },
    { label: '客户总数', value: stats.total_customers, icon: Users, color: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-600', action: () => navigate('/customers') },
    { label: '沉默客户', value: stats.silent_count, icon: UserMinus, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-50', text: 'text-slate-500', action: () => navigate('/customers?stage=silent') },
  ];

  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 86400000);
  };

  const getFollowReason = (c: typeof needFollowCustomers[0]) => {
    const days = getDaysSince(c.last_follow_date);
    if (c.next_talk_topic) return { icon: Lightbulb, text: '有预设话题', color: 'text-amber-500 bg-amber-50' };
    if (c.last_follow_date === null) return { icon: AlertTriangle, text: '从未跟进', color: 'text-red-500 bg-red-50' };
    if (days !== null && days >= 7) return { icon: Clock, text: `${days}天未跟进`, color: 'text-orange-500 bg-orange-50' };
    if (c.stage === 'new_friend') return { icon: UserPlus, text: '新好友待破冰', color: 'text-emerald-500 bg-emerald-50' };
    return { icon: MessageCircle, text: '建议跟进', color: 'text-blue-500 bg-blue-50' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-emerald-500" />
            微信私域工作台
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statCards.map((card) => (
            <button
              key={card.label}
              onClick={card.action}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all text-left group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.text}`}>{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-rose-500" />
                  今日待跟进客户
                </h2>
                <button
                  onClick={() => navigate('/customers')}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1"
                >
                  全部客户 <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {needFollowCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-slate-600 font-medium">今天没有需要跟进的客户</p>
                  <p className="text-sm text-slate-400 mt-1">客户维护得不错！</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {needFollowCustomers.slice(0, 10).map((c) => {
                    const reason = getFollowReason(c);
                    const days = getDaysSince(c.last_follow_date);
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 transition-colors border border-transparent hover:border-rose-100 text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {c.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-slate-800 text-sm">{c.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${STAGE_COLORS[c.stage]}`}>
                              {STAGE_LABELS[c.stage]}
                            </span>
                            {c.importance === 'vip' && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${IMPORTANCE_COLORS[c.importance]}`}>
                                {IMPORTANCE_LABELS[c.importance]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${reason.color}`}>
                              <reason.icon className="w-3 h-3" />
                              {reason.text}
                            </span>
                            {c.next_talk_topic && (
                              <span className="truncate text-amber-600">
                                💬 {c.next_talk_topic.length > 15 ? c.next_talk_topic.slice(0, 15) + '...' : c.next_talk_topic}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{WECHAT_ACCOUNT_LABELS[c.wechat_account]}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  最近成交
                </h2>
                <button onClick={() => navigate('/orders')} className="text-xs text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1">
                  全部订单 <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">暂无订单记录</p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <button
                            onClick={() => navigate(`/customers/${order.customer_id}`)}
                            className="font-medium text-slate-800 hover:text-rose-600 text-sm"
                          >
                            {order.customer_name}
                          </button>
                          <p className="text-xs text-slate-500">
                            {order.product_name}
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${ORDER_TYPE_COLORS[order.order_type]}`}>
                              {ORDER_TYPE_LABELS[order.order_type]}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">¥{order.amount}</p>
                        <p className="text-[10px] text-slate-400">{order.purchase_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                客户阶段分布
              </h2>
              <div className="space-y-3">
                {stageStats.map((s) => {
                  const total = stageStats.reduce((sum, x) => sum + x.count, 0) || 1;
                  const pct = Math.round((s.count / total) * 100);
                  return (
                    <button
                      key={s.stage}
                      onClick={() => navigate(`/customers?stage=${s.stage}`)}
                      className="w-full group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 group-hover:text-rose-600 transition-colors">
                          {STAGE_LABELS[s.stage]}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{s.count}人</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            s.stage === 'new_friend' ? 'bg-blue-400' :
                            s.stage === 'initial_chat' ? 'bg-cyan-400' :
                            s.stage === 'interested' ? 'bg-amber-400' :
                            s.stage === 'purchased' ? 'bg-emerald-400' :
                            s.stage === 'in_group' ? 'bg-teal-400' :
                            s.stage === 'repurchased' ? 'bg-rose-400' :
                            'bg-slate-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="font-bold text-slate-900 mb-3">快捷操作</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/customers')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 transition-all border border-rose-100"
                >
                  <Users className="w-6 h-6 text-rose-500" />
                  <span className="text-sm font-medium text-slate-700">客户列表</span>
                </button>
                <button
                  onClick={() => navigate('/customers?showAdd=true')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-100"
                >
                  <UserPlus className="w-6 h-6 text-emerald-500" />
                  <span className="text-sm font-medium text-slate-700">添加客户</span>
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all border border-blue-100"
                >
                  <ShoppingBag className="w-6 h-6 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">产品库</span>
                </button>
                <button
                  onClick={() => navigate('/orders')}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-all border border-amber-100"
                >
                  <Sparkles className="w-6 h-6 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700">订单记录</span>
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 shadow-lg text-white">
              <h3 className="font-bold text-base mb-2 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                微信跟进提醒
              </h3>
              <p className="text-sm text-emerald-50 mb-3 leading-relaxed">
                每天打开微信前，先看看这里的待跟进列表。点击客户卡片直接进入详情，记录跟进内容并推进客户阶段。
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <div className="flex -space-x-1">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">💬</div>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">📱</div>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">👥</div>
                </div>
                <span>私域运营从每个有效沟通开始</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
