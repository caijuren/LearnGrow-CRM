import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import {
  STAGE_LABELS, WECHAT_ACCOUNT_LABELS, ORDER_TYPE_LABELS,
  IMPORTANCE_LABELS
} from '../../shared/types';
import {
  Users, MessageCircle, Clock, AlertTriangle, ShoppingBag, Sparkles, ArrowRight,
  ChevronRight, UserPlus, UserMinus, CheckCircle2, Lightbulb, Phone,
  TrendingUp, TrendingDown
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

  const overviewStats = [
    { label: '待跟进客户', value: stats.need_follow_count, trend: '+12%', trendUp: true, trendLabel: '较昨日', onClick: () => navigate('/customers?need_follow=true') },
    { label: '客户总数', value: stats.total_customers, trend: '+5%', trendUp: true, trendLabel: '较上月', onClick: () => navigate('/customers') },
    { label: '新增好友', value: stats.new_friends_count, trend: '+8%', trendUp: true, trendLabel: '近3天', onClick: () => navigate('/customers?stage=new_friend') },
    { label: '沉默客户', value: stats.silent_count, trend: '-3%', trendUp: false, trendLabel: '较上周', onClick: () => navigate('/customers?stage=silent') },
  ];

  const getDaysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 86400000);
  };

  const getFollowReason = (c: typeof needFollowCustomers[0]) => {
    const days = getDaysSince(c.last_follow_date);
    if (c.next_talk_topic) return { icon: Lightbulb, text: '预设话题', variant: 'warning' as const };
    if (c.last_follow_date === null) return { icon: AlertTriangle, text: '从未跟进', variant: 'danger' as const };
    if (days !== null && days >= 7) return { icon: Clock, text: `${days}天未跟进`, variant: 'warning' as const };
    if (c.stage === 'new_friend') return { icon: UserPlus, text: '新好友待破冰', variant: 'success' as const };
    return { icon: MessageCircle, text: '建议跟进', variant: 'info' as const };
  };

  const stageTotal = stageStats.reduce((sum, x) => sum + x.count, 0) || 1;

  return (
    <div className="page-shell">
      <div className="page-inner">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">运营概览</h1>
            <p className="page-subtitle">
              {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/customers?showAdd=true')} className="btn-primary">
              <UserPlus size={15} strokeWidth={1.8} />
              添加客户
            </button>
          </div>
        </div>

        {/* KPI Overview — 一体化数据区域 */}
        <div className="panel mb-6">
          <div className="px-5 pt-4 pb-1">
            <h2 className="t-title">核心数据</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {overviewStats.map((stat, idx) => (
              <button
                key={stat.label}
                onClick={stat.onClick}
                className={`text-left px-5 py-4 transition-colors duration-150 ease-out
                           hover:bg-bg-subtle group
                           ${idx < overviewStats.length - 1 ? 'border-r border-border-subtle' : ''}
                           ${idx < 2 ? 'md:border-b-0 border-b border-border-subtle' : ''}`}
              >
                <p className="t-caption mb-1.5">{stat.label}</p>
                <p className="t-kpi text-text-primary mb-2 group-hover:text-primary transition-colors duration-150">
                  {stat.value}
                </p>
                <div className="flex items-center gap-1">
                  {stat.trendUp ? (
                    <TrendingUp size={12} strokeWidth={2} className="text-success" />
                  ) : (
                    <TrendingDown size={12} strokeWidth={2} className="text-text-tertiary" />
                  )}
                  <span className={`text-xs font-medium ${stat.trendUp ? 'text-success' : 'text-text-tertiary'}`}>
                    {stat.trend}
                  </span>
                  <span className="text-xs text-text-tertiary">{stat.trendLabel}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content + Right Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* 今日待跟进客户 */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <Clock size={15} strokeWidth={1.8} className="text-text-secondary" />
                  今日待跟进
                </h2>
                <button
                  onClick={() => navigate('/customers')}
                  className="btn-tertiary btn-sm"
                >
                  全部 <ChevronRight size={14} strokeWidth={1.8} />
                </button>
              </div>

              {needFollowCustomers.length === 0 ? (
                <div className="py-10 px-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 rounded-md bg-success-soft flex items-center justify-center text-success mb-3">
                      <CheckCircle2 size={18} strokeWidth={1.8} />
                    </div>
                    <p className="t-body-strong">今天没有需要跟进的客户</p>
                    <p className="t-small mt-1">客户维护节奏正常</p>
                  </div>
                </div>
              ) : (
                <div>
                  {needFollowCustomers.slice(0, 8).map((c, idx) => {
                    const reason = getFollowReason(c);
                    const isLast = idx === Math.min(needFollowCustomers.length, 8) - 1;
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-bg-subtle/60
                                   transition-colors duration-150 text-left group
                                   ${!isLast ? 'border-b border-border-subtle' : ''}`}
                      >
                        {/* Avatar */}
                        <div className="avatar avatar-md bg-primary-soft text-primary font-semibold">
                          {c.name[0]}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="t-body-strong">{c.name}</span>
                            <span className="badge badge-neutral" style={{ height: 18, fontSize: 11, padding: '0 6px' }}>
                              {STAGE_LABELS[c.stage]}
                            </span>
                            {c.importance === 'vip' && (
                              <span className="badge badge-warning" style={{ height: 18, fontSize: 11, padding: '0 6px' }}>
                                {IMPORTANCE_LABELS[c.importance]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge badge-${reason.variant}`} style={{ height: 18, fontSize: 11, padding: '0 6px' }}>
                              <reason.icon size={10} strokeWidth={2} />
                              {reason.text}
                            </span>
                            {c.next_talk_topic && (
                              <span className="t-small text-text-tertiary truncate">
                                {c.next_talk_topic.length > 24 ? c.next_talk_topic.slice(0, 24) + '...' : c.next_talk_topic}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-1.5 text-text-tertiary shrink-0">
                          <MessageCircle size={13} strokeWidth={1.8} />
                          <span className="t-small">{WECHAT_ACCOUNT_LABELS[c.wechat_account]}</span>
                          <ChevronRight size={14} strokeWidth={1.8} className="text-text-disabled group-hover:text-text-tertiary transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 最近成交 */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <ShoppingBag size={15} strokeWidth={1.8} className="text-text-secondary" />
                  最近成交
                </h2>
                <button onClick={() => navigate('/orders')} className="btn-tertiary btn-sm">
                  全部订单 <ChevronRight size={14} strokeWidth={1.8} />
                </button>
              </div>
              {recentOrders.length === 0 ? (
                <div className="py-10">
                  <p className="t-small text-center text-text-tertiary">暂无订单记录</p>
                </div>
              ) : (
                <div>
                  {recentOrders.slice(0, 5).map((order, idx) => (
                    <div
                      key={order.id}
                      className={`flex items-center justify-between px-5 py-3
                                 ${idx < recentOrders.length - 1 && idx < 4 ? 'border-b border-border-subtle' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-bg-subtle flex items-center justify-center text-text-tertiary">
                          <ShoppingBag size={15} strokeWidth={1.8} />
                        </div>
                        <div>
                          <button
                            onClick={() => navigate(`/customers/${order.customer_id}`)}
                            className="t-body-strong hover:text-primary transition-colors duration-150"
                          >
                            {order.customer_name}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="t-small">{order.product_name}</span>
                            <span className="badge badge-neutral" style={{ height: 16, fontSize: 10, padding: '0 5px', borderRadius: 4 }}>
                              {ORDER_TYPE_LABELS[order.order_type]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-text-primary text-sm kpi-value">¥{order.amount}</p>
                        <p className="t-small">{order.purchase_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* 客户阶段分布 — Pipeline 风格 */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <Users size={15} strokeWidth={1.8} className="text-text-secondary" />
                  客户阶段分布
                </h2>
              </div>
              <div className="px-5 py-4 space-y-3.5">
                {stageStats.map((s) => {
                  const pct = Math.round((s.count / stageTotal) * 100);
                  return (
                    <button
                      key={s.stage}
                      onClick={() => navigate(`/customers?stage=${s.stage}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors duration-150">
                          {STAGE_LABELS[s.stage]}
                        </span>
                        <span className="text-[13px] font-medium text-text-primary kpi-value">{s.count}人</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 快捷操作 */}
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">快捷操作</h2>
              </div>
              <div className="px-2 py-2">
                <button
                  onClick={() => navigate('/customers')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
                             text-sm text-text-secondary hover:text-text-primary hover:bg-bg-subtle
                             transition-colors duration-150"
                >
                  <Users size={15} strokeWidth={1.8} />
                  <span>客户列表</span>
                </button>
                <button
                  onClick={() => navigate('/customers?showAdd=true')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
                             text-sm text-text-secondary hover:text-text-primary hover:bg-bg-subtle
                             transition-colors duration-150"
                >
                  <UserPlus size={15} strokeWidth={1.8} />
                  <span>添加客户</span>
                </button>
                <button
                  onClick={() => navigate('/products')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
                             text-sm text-text-secondary hover:text-text-primary hover:bg-bg-subtle
                             transition-colors duration-150"
                >
                  <ShoppingBag size={15} strokeWidth={1.8} />
                  <span>产品库</span>
                </button>
                <button
                  onClick={() => navigate('/orders')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md
                             text-sm text-text-secondary hover:text-text-primary hover:bg-bg-subtle
                             transition-colors duration-150"
                >
                  <Sparkles size={15} strokeWidth={1.8} />
                  <span>订单记录</span>
                </button>
              </div>
            </div>

            {/* 运营建议 */}
            <div className="panel" style={{ background: 'linear-gradient(180deg, #FAFBFF 0%, #FFFFFF 100%)' }}>
              <div className="px-5 py-4">
                <h3 className="t-title mb-1.5 flex items-center gap-2">
                  <Phone size={15} strokeWidth={1.8} className="text-primary" />
                  今日运营建议
                </h3>
                <p className="t-caption">
                  打开微信前先查看待跟进列表，点击客户卡片进入详情，记录跟进内容并推进客户阶段。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
