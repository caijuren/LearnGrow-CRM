import {
  useEffect, useState } from 'react';

import {
  motion } from 'framer-motion';
import {
  LineChart,
} from '@tremor/react';
import {
  Download,
  Users, Wallet, Clock, UserPlus,
  ChevronRight, MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Sparkles, Star, Store, Boxes, Truck,
  BookOpen, Calculator, Languages, FlaskConical, GraduationCap,
} from 'lucide-react';
import {
  useStore } from '@/store';
import {
  type OrderWithCustomer } from '../../shared/types';
import type { LucideIcon } from 'lucide-react';

const profitData = [
  { date: '1 Jan', profit: 4200, last: 3800 },
  { date: '5 Jan', profit: 5100, last: 4500 },
  { date: '8 Jan', profit: 4800, last: 4700 },
  { date: '12 Jan', profit: 6200, last: 5000 },
  { date: '15 Jan', profit: 5900, last: 5200 },
  { date: '19 Jan', profit: 7800, last: 5600 },
  { date: '22 Jan', profit: 8200, last: 6100 },
  { date: '26 Jan', profit: 8900, last: 6400 },
  { date: '29 Jan', profit: 9400, last: 6800 },
];

const weeklyData = [
  { day: 'Sun', active: 120 },
  { day: 'Mon', active: 180 },
  { day: 'Tue', active: 240 },
  { day: 'Wed', active: 160 },
  { day: 'Thu', active: 200 },
  { day: 'Fri', active: 280 },
  { day: 'Sat', active: 150 },
];

const productIcons: Record<string, LucideIcon> = {
  '语文·作文提升营': BookOpen,
  '数学·思维训练课': Calculator,
  '英语·自然拼读': Languages,
  '科学·实验探索': FlaskConical,
  '小升初衔接班': GraduationCap,
};

const products = [
  { id: '#83009', name: '语文·作文提升营', sold: 2310, revenue: 245000, rating: 4.9, icon: '语文·作文提升营' },
  { id: '#83001', name: '数学·思维训练课', sold: 1230, revenue: 189000, rating: 4.8, icon: '数学·思维训练课' },
  { id: '#83004', name: '英语·自然拼读', sold: 812, revenue: 156000, rating: 4.7, icon: '英语·自然拼读' },
  { id: '#83002', name: '科学·实验探索', sold: 645, revenue: 98000, rating: 4.5, icon: '科学·实验探索' },
  { id: '#83012', name: '小升初衔接班', sold: 572, revenue: 86000, rating: 4.6, icon: '小升初衔接班' },
];

const customerSegments = [
  { name: '零售客户', value: 2884, color: '#2563EB', icon: Store },
  { name: '分销客户', value: 1432, color: '#22C55E', icon: Boxes },
  { name: '批发客户', value: 562, color: '#F59E0B', icon: Truck },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

function SegmentedGauge({ value }: { value: number }) {
  const totalBars = 40;
  const activeBars = Math.round((value / 100) * totalBars);
  return (
    <div className="flex items-end justify-center gap-[3px] h-[70px]">
      {Array.from({ length: totalBars }).map((_, i) => {
        const isActive = i < activeBars;
        const angle = (i / (totalBars - 1)) * 180;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.3, delay: i * 0.01, ease: [0.16, 1, 0.3, 1] }}
            className="w-[4px] rounded-full origin-bottom"
            style={{
              height: `${10 + Math.sin((angle * Math.PI) / 180) * 45}px`,
              backgroundColor: isActive ? '#22C55E' : '#E4E7EC',
            }}
          />
        );
      })}
    </div>
  );
}

function TrendPill({ value, up }: { value: string; up: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${up ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
      {up ? <ArrowUpRight size={12} strokeWidth={2} /> : <ArrowDownRight size={12} strokeWidth={2} />}
      {value}
    </span>
  );
}

export default function Dashboard() {
  const { dashboard, loadDashboard } = useStore();

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = dashboard?.stats || {
    total_customers: 0, today_new_customers: 0, need_follow_count: 0, today_revenue: 0,
  };
  const recentOrders = dashboard?.recentOrders || [];
  const monthTotal = recentOrders.reduce((s, o: OrderWithCustomer) => s + (o.amount || 0), 0);
  const maxDay = Math.max(...weeklyData.map(d => d.active));

  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<{ role: string; text: string }[]>([]);

  const handleSend = () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiMessages((prev) => [...prev, { role: 'user', text }]);
    setAiInput('');
    setTimeout(() => {
      setAiMessages((prev) => [...prev, { role: 'ai', text: '收到：' + text + '。AI 正在处理中...' }]);
    }, 600);
  };

  const exportToCSV = () => {
    const headers = ['编号', '产品名称', '销量', '营收', '评分'];
    const rows = products.map((p) => [p.id, p.name, p.sold, p.revenue, p.rating]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '热销产品_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: '客户总数', value: stats.total_customers, trend: '5.0%', up: true, icon: Users, iconColor: '#2563EB', iconBg: '#EFF6FF' },
    { label: '本月成交', value: monthTotal, trend: '18.0%', up: true, prefix: '¥', icon: Wallet, iconColor: '#1D4ED8', iconBg: '#DBEAFE' },
    { label: '待跟进', value: stats.need_follow_count, trend: '12.0%', up: false, icon: Clock, iconColor: '#F59E0B', iconBg: '#FFFBEB' },
    { label: '今日新增', value: stats.today_new_customers, trend: '8.0%', up: true, icon: UserPlus, iconColor: '#22C55E', iconBg: '#F0FDF4' },
  ];

  const segmentTotal = customerSegments.reduce((s, x) => s + x.value, 0);

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
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">驾驶舱</h1>
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg bg-bg-surface border border-border-default text-sm text-text-secondary">
              <span>2025年1月1日 - 2月1日</span>
            </div>
            <button
              onClick={() => alert('日期范围选择功能开发中')}
              className="hidden md:flex btn btn-secondary"
            >
              近30天 <ChevronRight size={14} className="-rotate-90" />
            </button>
            <button
              onClick={() => alert('打开添加组件面板')}
              className="hidden md:flex btn btn-secondary"
            >
              <span className="text-text-tertiary">⊞</span> 添加组件
            </button>
            <button
              onClick={exportToCSV}
              className="btn btn-primary"
            >
              <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                <Download size={13} strokeWidth={2.5} />
              </span>
              导出
            </button>
          </motion.div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6"
        >
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.label}
              variants={fadeUp}
              className="bg-bg-surface border border-border-default rounded-[20px] p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm font-medium text-text-secondary">{kpi.label}</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: kpi.iconBg, color: kpi.iconColor }}
                >
                  <kpi.icon size={18} strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="text-[28px] font-bold text-text-primary tracking-tight">
                  {kpi.prefix || ''}{kpi.value.toLocaleString()}
                </span>
                <TrendPill value={kpi.trend} up={kpi.up} />
              </div>
              <p className="text-xs text-text-tertiary">较上期 {(kpi.value * 0.9).toLocaleString()}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 mb-6">
          {/* Left */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* 本月成交 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] p-6 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2">本月成交</p>
                  <div className="text-[40px] font-bold text-text-primary tracking-tight mb-2">
                    ¥{monthTotal.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendPill value="24.4%" up={true} />
                    <span className="text-xs text-text-tertiary">vs. 上月同期</span>
                  </div>
                </div>
                <div className="min-h-[240px]">
                  <LineChart
                    data={profitData}
                    categories={['profit', 'last']}
                    index="date"
                    colors={['blue', 'gray']}
                    className="h-64 w-full"
                    showLegend={false}
                    showGridLines={false}
                    showYAxis={true}
                    showXAxis={true}
                    autoMinValue={true}
                    curveType="monotone"
                  />
                </div>
              </div>

              {/* 客户结构 Sub-card */}
              <div className="mt-6 pt-6 border-t border-border-subtle">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">客户结构</h3>
                  <button
                    onClick={() => alert(`客户结构 - 更多操作`)}
                    className="text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    <MoreHorizontal size={18} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {customerSegments.map((seg) => (
                    <div key={seg.name} className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center border"
                        style={{ backgroundColor: '#FFFFFF', borderColor: `${seg.color}30`, color: seg.color }}
                      >
                        <seg.icon size={18} strokeWidth={1.8} />
                      </div>
                      <div>
                        <div className="text-base font-bold text-text-primary">{seg.value.toLocaleString()}</div>
                        <div className="text-[11px] text-text-tertiary">{seg.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full overflow-hidden flex">
                  {customerSegments.map((seg) => (
                    <motion.div
                      key={seg.name}
                      initial={{ width: 0 }}
                      animate={{ width: `${(seg.value / segmentTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ backgroundColor: seg.color }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* 热销产品 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">热销产品</h3>
                <button
                  onClick={() => alert('更多操作')}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <MoreHorizontal size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">
                      <th className="px-6 py-3">编号</th>
                      <th className="px-6 py-3">产品名称</th>
                      <th className="px-6 py-3 text-right">销量</th>
                      <th className="px-6 py-3 text-right">营收</th>
                      <th className="px-6 py-3 text-right">评分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-border-subtle last:border-b-0 hover:bg-bg-hover/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-text-tertiary">{p.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {(() => {
                              const Icon = productIcons[p.icon];
                              return (
                                <div className="w-9 h-9 rounded-lg bg-bg-subtle flex items-center justify-center text-primary">
                                  <Icon size={18} strokeWidth={1.5} />
                                </div>
                              );
                            })()}
                            <span className="text-sm font-medium text-text-primary">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right">{p.sold.toLocaleString()} 单</td>
                        <td className="px-6 py-4 text-sm font-semibold text-success text-right">¥{p.revenue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right">
                          <span className="inline-flex items-center gap-1">
                            <Star size={12} strokeWidth={2} className="text-warning fill-warning" />
                            {p.rating}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>

          {/* Right */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* 周活跃 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-text-primary">周活跃</h3>
                <button
                  onClick={() => alert('更多操作')}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <MoreHorizontal size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex items-end justify-between h-44 gap-3 mb-2">
                {weeklyData.map((d, i) => {
                  const height = (d.active / maxDay) * 100;
                  const isMax = d.active === maxDay;
                  return (
                    <div key={d.day} className="flex flex-col items-center flex-1 relative">
                      {isMax && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                          className="absolute -top-6 text-sm font-bold text-text-primary"
                        >
                          {d.active.toLocaleString()}
                        </motion.div>
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className={`w-full max-w-[36px] rounded-full ${isMax ? 'bg-primary' : 'bg-bg-subtle'}`}
                      />
                      <span className={`text-[11px] mt-3 ${isMax ? 'text-primary font-semibold' : 'text-text-tertiary'}`}>{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* 复购率 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary">复购率</h3>
                <button
                  onClick={() => alert('更多操作')}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <MoreHorizontal size={18} strokeWidth={1.8} />
                </button>
              </div>
              <SegmentedGauge value={68} />
              <div className="text-center mt-2">
                <div className="text-4xl font-bold text-text-primary">68%</div>
                <p className="text-xs text-text-tertiary mt-1">目标 80%</p>
              </div>
              <button
                onClick={() => alert('查看复购率详情')}
                className="w-full mt-5 py-2 text-xs font-semibold text-text-primary bg-bg-subtle rounded-lg hover:bg-bg-hover transition-colors border border-border-default"
              >
                查看详情
              </button>
            </motion.div>

            {/* AI 助手 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-text-primary">AI 助手</h3>
                <button
                  onClick={() => alert('展开 AI 助手')}
                  className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors"
                >
                  <ArrowUpRight size={14} strokeWidth={2} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Sparkles size={22} strokeWidth={1.5} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">AI 助手</p>
                  <p className="text-xs text-text-tertiary">有问题随时问我</p>
                </div>
              </div>
              <div className="space-y-3">
                {aiMessages.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {aiMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded-lg ${m.role === 'user' ? 'bg-bg-subtle text-text-primary ml-6' : 'bg-primary/10 text-primary mr-6'}`}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="问我任何问题..."
                    className="w-full h-10 pl-4 pr-10 rounded-full bg-bg-subtle text-sm text-text-primary placeholder:text-text-tertiary border border-transparent focus:outline-none focus:border-border-strong transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors disabled:opacity-50"
                    disabled={!aiInput.trim()}
                  >
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
