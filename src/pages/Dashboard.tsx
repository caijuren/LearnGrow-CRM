import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart } from '@tremor/react';
import {
  Users, CheckCircle, TrendingUp, Target,
  MoreHorizontal, ArrowUpRight, ArrowDownRight,
  Award, Bell, RefreshCw, UserPlus, Calendar,
} from 'lucide-react';
import { useStore } from '@/store';
import { useNavigate } from 'react-router-dom';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

function TrendPill({ value, up }: { value: string; up: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${up ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
      {up ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <ArrowDownRight size={11} strokeWidth={2.5} />}
      {value}
    </span>
  );
}

function AvatarPlaceholder({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-8 h-8 text-[11px]', md: 'w-9 h-9 text-xs', lg: 'w-11 h-11 text-sm' };
  const firstChar = name?.trim()?.[0]?.toUpperCase() || '?';
  
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border border-border-subtle bg-gray-50`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }
  
  // 根据名字首字母生成背景色（柔和色系）
  const colors = [
    'bg-blue-50 text-blue-600',
    'bg-emerald-50 text-emerald-600',
    'bg-violet-50 text-violet-600',
    'bg-amber-50 text-amber-600',
    'bg-rose-50 text-rose-600',
    'bg-cyan-50 text-cyan-600',
  ];
  const colorIndex = firstChar.charCodeAt(0) % colors.length;
  
  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold ${colors[colorIndex]}`}>
      {firstChar}
    </div>
  );
}

function KPICard({
  title,
  value,
  subtext,
  trend,
  up,
  icon: Icon,
  iconColor,
  iconBg,
  onClick,
}: {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  up?: boolean;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all cursor-pointer ${onClick ? 'hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[13px] font-medium text-gray-500">{title}</span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[32px] font-bold text-gray-900 tracking-tight leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {trend && <TrendPill value={trend} up={up || false} />}
      </div>
      {subtext && <p className="text-[12px] text-gray-400 mt-0.5">{subtext}</p>}
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loadDashboard } = useStore();
  const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>();

  useEffect(() => {
    loadDashboard();
    setLastRefreshTime(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = dashboard?.stats || {
    total_wx_users: 0,
    today_new_wx_users: 0,
    yesterday_new_wx_users: 0,
    total_checkins: 0,
    today_checkins: 0,
    week_checkins: 0,
    active_users_7d: 0,
    checkin_rate: 0,
    total_participants: 0,
  };

  // 计算趋势
  const userTrendValue = stats.yesterday_new_wx_users > 0
    ? Math.round(((stats.today_new_wx_users - stats.yesterday_new_wx_users) / stats.yesterday_new_wx_users) * 100)
    : 0;
  const userTrendUp = userTrendValue >= 0;

  const kpis = [
    {
      title: '微信用户总数',
      value: stats.total_wx_users,
      subtext: `今日新增 +${stats.today_new_wx_users}`,
      trend: `${Math.abs(userTrendValue)}%`,
      up: userTrendUp,
      icon: Users,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
      onClick: () => navigate('/wx-users'),
    },
    {
      title: '累计打卡人次',
      value: stats.total_checkins,
      subtext: `今日 ${stats.today_checkins} · 本周 ${stats.week_checkins}`,
      icon: CheckCircle,
      iconColor: '#22C55E',
      iconBg: '#F0FDF4',
      onClick: () => navigate('/checkin'),
    },
    {
      title: '活跃用户数',
      value: stats.active_users_7d,
      subtext: stats.total_wx_users > 0
        ? `占总用户 ${Math.round((stats.active_users_7d / stats.total_wx_users) * 100)}%`
        : '近 7 天有打卡',
      icon: TrendingUp,
      iconColor: '#8B5CF6',
      iconBg: '#F5F3FF',
    },
    {
      title: '打卡率',
      value: `${stats.checkin_rate}%`,
      subtext: stats.total_participants > 0
        ? `目标 80% · 差距 ${(80 - stats.checkin_rate).toFixed(1)}%`
        : '今日打卡人数 / 已报名用户数',
      icon: Target,
      iconColor: '#F59E0B',
      iconBg: '#FFFBEB',
    },
  ];

  // 准备趋势图表数据
  const combinedTrendData = dashboard?.newUserTrend.map((item, i) => ({
    date: item.date,
    newUsers: item.count,
    checkins: dashboard.checkinTrend[i]?.count || 0,
  })) || [];

  return (
    <div className="min-h-full bg-gray-50/80 p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between mb-6"
        >
          <motion.div variants={fadeUp}>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">驾驶舱</h1>
            {lastRefreshTime && (
              <p className="text-[11px] text-gray-400 mt-1">
                最后更新：{lastRefreshTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <button
              onClick={() => {
                loadDashboard();
                setLastRefreshTime(new Date());
              }}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl bg-white border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <RefreshCw size={14} strokeWidth={2} />
              刷新
            </button>
          </motion.div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          {kpis.map((kpi) => (
            <KPICard key={kpi.title} {...kpi} />
          ))}
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-5">
          {/* Left Panel */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            {/* 近 N 天增长&打卡趋势 */}
            <motion.div variants={fadeUp} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-gray-900">用户增长 & 打卡趋势</h3>
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
                  {([7, 30, 90] as const).map((days) => (
                    <button
                      key={days}
                      onClick={() => setTrendDays(days)}
                      className={`px-3 py-1 text-[12px] font-medium rounded-md transition-all ${
                        trendDays === days
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {days}天
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-[280px]">
                <LineChart
                  data={combinedTrendData.slice(-trendDays)}
                  categories={['newUsers', 'checkins']}
                  index="date"
                  colors={['blue', 'green']}
                  className="h-72 w-full"
                  showLegend={false}
                  showGridLines={false}
                  curveType="monotone"
                />
                {/* 自定义图例 */}
                <div className="flex items-center justify-end gap-4 mt-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>新增用户</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>打卡人次</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 用户阶段分布 */}
            <motion.div variants={fadeUp} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-gray-900">用户阶段分布</h3>
                <button
                  onClick={() => navigate('/wx-users')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
              </div>
              <div className="space-y-3.5">
                {dashboard?.stageStats.map((stage) => {
                  const total = dashboard.stageStats.reduce((sum, s) => sum + s.count, 0);
                  const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                  const stageLabels: Record<string, string> = {
                    new_friend: '新朋友',
                    initial_chat: '初步沟通',
                    interested: '感兴趣',
                    purchased: '已购买',
                    in_group: '在群里',
                    repurchased: '复购',
                    silent: '沉默用户',
                  };
                  const stageColors: Record<string, string> = {
                    new_friend: '#2563EB',
                    initial_chat: '#3B82F6',
                    interested: '#22C55E',
                    purchased: '#10B981',
                    in_group: '#F59E0B',
                    repurchased: '#8B5CF6',
                    silent: '#6B7280',
                  };
                  
                  if (stage.count === 0) return null; // 隐藏人数为 0 的阶段
                  
                  return (
                    <div
                      key={stage.stage}
                      className="group cursor-pointer hover:bg-gray-50 rounded-xl p-2.5 -mx-2.5 transition-colors"
                      onClick={() => navigate(`/wx-users?stage=${stage.stage}`)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: stageColors[stage.stage] || '#2563EB' }}
                          />
                          <span className="text-[13px] font-medium text-gray-700">{stageLabels[stage.stage] || stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-gray-900">{stage.count}</span>
                          <span className="text-[11px] text-gray-400">({percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: stageColors[stage.stage] || '#2563EB' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* 热门打卡活动排行 */}
            <motion.div variants={fadeUp} className="bg-bg-surface border border-border-default rounded-[20px] overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-base font-semibold text-text-primary">热门打卡活动排行</h3>
                <button
                  onClick={() => alert('查看更多')}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <MoreHorizontal size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">
                      <th className="px-6 py-3">排名</th>
                      <th className="px-6 py-3">活动名称</th>
                      <th className="px-6 py-3 text-right">参与人数</th>
                      <th className="px-6 py-3 text-right">累计打卡</th>
                      <th className="px-6 py-3 text-right">人均打卡</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.popularActivities.map((activity, index) => (
                      <tr key={index} className="border-b border-border-subtle last:border-b-0 hover:bg-bg-hover/30 transition-colors">
                        <td className="px-6 py-4">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : <span className="text-text-tertiary">{index + 1}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-text-primary">{activity.name}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right">
                          {activity.participant_count}人
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-success text-right">
                          {activity.checkin_count}次
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary text-right">
                          {activity.avg_checkins_per_user}次
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Panel */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            {/* 今日实时动态 */}
            <motion.div variants={fadeUp} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-gray-900">今日实时动态</h3>
                <Bell size={16} strokeWidth={2} className="text-gray-400" />
              </div>
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                {/* 最新用户 */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <UserPlus size={11} strokeWidth={2.5} />
                    最新加入
                  </p>
                  <div className="space-y-2">
                    {dashboard?.recentUsers.map((user, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <AvatarPlaceholder name={user.display_name} avatarUrl={user.avatar_url} size="sm" />
                        <span className="text-[13px] text-gray-700 truncate flex-1">{user.display_name}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {new Date(user.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 最新打卡 */}
                <div className="pt-3.5 border-t border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Calendar size={11} strokeWidth={2.5} />
                    最新打卡
                  </p>
                  <div className="space-y-2">
                    {dashboard?.recentCheckins.slice(0, 5).map((record, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex-1 truncate pr-2">
                          <span className="text-[13px] text-gray-700">{record.user_name}</span>
                          <span className="text-[11px] text-gray-400 ml-1.5">{record.activity_name}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {new Date(record.checkin_date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 用户来源渠道分析 */}
            {dashboard?.sourceChannels && dashboard.sourceChannels.length > 0 && (
              <motion.div variants={fadeUp} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold text-gray-900">用户来源渠道</h3>
                  <button
                    onClick={() => navigate('/wx-users')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <MoreHorizontal size={16} strokeWidth={2} />
                  </button>
                </div>
                <div className="space-y-3">
                  {dashboard.sourceChannels.slice(0, 5).map((channel, i) => {
                    const total = dashboard.sourceChannels.reduce((sum, c) => sum + c.count, 0);
                    const percentage = total > 0 ? Math.round((channel.count / total) * 100) : 0;
                    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px] text-gray-600">{channel.channel}</span>
                          <span className="text-[13px] font-bold text-gray-900">
                            {channel.count}<span className="text-[11px] font-normal text-gray-400 ml-0.5">({percentage}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 打卡达人榜 */}
            <motion.div variants={fadeUp} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-gray-900">打卡达人榜</h3>
                <Award size={16} strokeWidth={2} className="text-amber-500" />
              </div>
              <div className="space-y-2.5">
                {dashboard?.topCheckinUsers.slice(0, 10).map((user, index) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2.5 transition-colors"
                    onClick={() => navigate(`/wx-users/${user.id}`)}
                  >
                    {/* 序号 */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{
                        backgroundColor: index === 0 ? '#FEF3C7' : index === 1 ? '#E5E7EB' : index === 2 ? '#FED7AA' : 'transparent',
                        color: index < 3 ? '#92400E' : '#9CA3AF',
                      }}
                    >
                      {index + 1}
                    </div>
                    
                    {/* 头像 */}
                    <AvatarPlaceholder name={user.display_name || user.child_name || '?'} avatarUrl={user.avatar_url} size="sm" />
                    
                    {/* 名字信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate leading-tight">{user.display_name}</p>
                      {user.child_name && (
                        <p className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">{user.child_name}</p>
                      )}
                    </div>
                    
                    {/* 打卡次数 */}
                    <div className="text-[13px] font-bold text-primary flex-shrink-0">
                      {user.checkin_count}次
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
