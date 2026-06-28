import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { TODO_TYPE_LABELS, TODO_PRIORITY_COLORS, ORDER_TYPE_COLORS, ORDER_TYPE_LABELS } from '../../shared/types';
import { TrendingUp, Users, CheckCircle2, Clock, AlertCircle, MessageCircle, Copy, ArrowRight, ShoppingBag, Sparkles, Package, Radio, GraduationCap, ChevronRight, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loadDashboard } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const copyScript = (id: string, script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = dashboard?.stats || { today_revenue: 0, month_revenue: 0, total_customers: 0, today_new_customers: 0, pending_todos: 0 };
  const todos = dashboard?.todos || [];
  const recentOrders = dashboard?.recentOrders || [];
  const trend = dashboard?.revenueTrend || [];
  const maxRevenue = Math.max(...trend.map(t => t.revenue), 1);

  const statCards = [
    { label: '今日营收', value: `¥${stats.today_revenue.toFixed(0)}`, icon: TrendingUp, color: 'from-rose-500 to-pink-500' },
    { label: '本月营收', value: `¥${stats.month_revenue.toFixed(0)}`, icon: ShoppingBag, color: 'from-orange-500 to-amber-500' },
    { label: '客户总数', value: stats.total_customers, icon: Users, color: 'from-blue-500 to-indigo-500' },
    { label: '今日待办', value: stats.pending_todos, icon: Clock, color: 'from-emerald-500 to-teal-500' },
  ];

  const todoIcons: Record<string, any> = {
    vip_follow: <AlertCircle className="w-4 h-4 text-red-500" />,
    reminder: <Clock className="w-4 h-4 text-amber-500" />,
    repurchase: <ShoppingBag className="w-4 h-4 text-blue-500" />,
    considering: <MessageCircle className="w-4 h-4 text-purple-500" />,
    long_time_no_talk: <Users className="w-4 h-4 text-slate-400" />,
    stage_progress: <GraduationCap className="w-4 h-4 text-emerald-600" />,
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">今天要做的事</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="card p-5 card-hover">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-rose-500" />
                待办清单
              </h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {todos.length} 项待处理
              </span>
            </div>

            {todos.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-slate-600 font-medium">今天没有待办，太棒了！</p>
                <p className="text-sm text-slate-400 mt-1">去看看客户或产品吧</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todos.map((todo) => {
                  const isStageProgress = todo.type === 'stage_progress';
                  if (isStageProgress) {
                    return (
                      <div
                        key={todo.id}
                        className="rounded-xl border border-l-4 border-l-emerald-500 bg-emerald-50 p-4 transition-all hover:shadow-md cursor-pointer"
                        onClick={() => todo.child_id && navigate(`/customers/${todo.customer_id}/children/${todo.child_id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <GraduationCap className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                {TODO_TYPE_LABELS[todo.type]}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/customers/${todo.customer_id}`); }}
                                className="font-semibold text-slate-900 hover:text-rose-600 transition-colors"
                              >
                                {todo.customer_name}
                              </button>
                              {todo.child_name && (
                                <>
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    {todo.child_name}
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="font-medium text-slate-900 mb-1">
                              {todo.child_name ? `${todo.child_name} - ${todo.title}` : todo.title}
                            </p>
                            {todo.path_name && todo.stage_name ? (
                              <p className="text-sm text-emerald-700 mb-2 flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {todo.path_name} · 当前阶段：{todo.stage_name}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-600 mb-2">{todo.description}</p>
                            )}
                            {todo.suggested_script && (
                              <div className="bg-white/70 rounded-lg p-3 text-sm text-slate-700 border border-slate-200/50 relative group">
                                <p className="italic pr-8">"{todo.suggested_script}"</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyScript(todo.id, todo.suggested_script!); }}
                                  className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                  title="复制话术"
                                >
                                  {copiedId === todo.id ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); todo.child_id ? navigate(`/customers/${todo.customer_id}/children/${todo.child_id}`) : navigate(`/customers/${todo.customer_id}`); }}
                            className="btn-sm shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            查看进度 <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={todo.id}
                      className={`rounded-xl border border-l-4 p-4 transition-all hover:shadow-md cursor-pointer ${TODO_PRIORITY_COLORS[todo.priority]}`}
                      onClick={() => navigate(`/customers/${todo.customer_id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {todoIcons[todo.type]}
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 text-slate-600">
                              {TODO_TYPE_LABELS[todo.type]}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/customers/${todo.customer_id}`); }}
                              className="font-semibold text-slate-900 hover:text-rose-600 transition-colors truncate"
                            >
                              {todo.customer_name}
                            </button>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{todo.description}</p>
                          {todo.suggested_script && (
                            <div className="bg-white/70 rounded-lg p-3 text-sm text-slate-700 border border-slate-200/50 relative group">
                              <p className="italic pr-8">"{todo.suggested_script}"</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyScript(todo.id, todo.suggested_script!); }}
                                className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                title="复制话术"
                              >
                                {copiedId === todo.id ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/customers/${todo.customer_id}`); }}
                          className="btn-primary btn-sm shrink-0"
                        >
                          去处理 <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                最近成交
              </h2>
              <button onClick={() => navigate('/orders')} className="text-sm text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1">
                全部订单 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">暂无订单</p>
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-slate-500" />
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
          <div className="card p-5">
            <h2 className="font-bold text-slate-900 mb-4">7天营收趋势</h2>
            <div className="flex items-end gap-2 h-32">
              {trend.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full bg-gradient-to-t from-rose-500 to-pink-400 rounded-t-lg transition-all hover:from-rose-600 hover:to-pink-500 relative group"
                    style={{ height: `${(day.revenue / maxRevenue) * 100}%`, minHeight: day.revenue > 0 ? '8px' : '3px' }}
                  >
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      ¥{day.revenue}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{day.date}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-bold text-slate-900 mb-4">快捷操作</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/customers')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 transition-all border border-rose-100"
              >
                <Users className="w-6 h-6 text-rose-500" />
                <span className="text-sm font-medium text-slate-700">我的客户</span>
              </button>
              <button
                onClick={() => navigate('/products')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all border border-blue-100"
              >
                <Package className="w-6 h-6 text-blue-500" />
                <span className="text-sm font-medium text-slate-700">我的货</span>
              </button>
              <button
                onClick={() => navigate('/orders')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all border border-emerald-100"
              >
                <ShoppingBag className="w-6 h-6 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">订单记录</span>
              </button>
              <button
                onClick={() => navigate('/live')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-all border border-orange-100"
              >
                <Radio className="w-6 h-6 text-orange-500" />
                <span className="text-sm font-medium text-slate-700">直播台</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
