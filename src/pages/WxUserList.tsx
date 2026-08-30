import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, Star, Clock, Coins, Minus,
  SlidersHorizontal, Tag, Loader2, User, Smartphone, ChevronLeft, ChevronRight, ChevronDown,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from 'lucide-react';
import { useStore, WX_USERS_PAGE_SIZE as PAGE_SIZE } from '@/store';
import { wxDisplayName as displayName } from '@/lib/utils';
import Loading from '@/components/ui/Loading';
import {
  SOURCE_LABELS, IMPORTANCE_LABELS, COMMON_TAGS,
  STAGE_LABELS, WECHAT_ACCOUNT_LABELS, POINTS_TYPE_LABELS,
  type Importance, type CustomerSource, type CustomerStage, type WechatAccount, type WxUser,
  type WxUserSortKey,
} from '../../shared/types';
import Empty from '@/components/Empty';
import Modal from '@/components/Modal';

const SORT_KEYS: WxUserSortKey[] = ['activity', 'joined', 'points'];

const IMPORTANCE_FILTERS: { value: Importance | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'vip', label: '重点' },
  { value: 'normal', label: '普通' },
  { value: 'watch', label: '观察中' },
];

const STAGE_FILTERS: { value: CustomerStage | ''; label: string }[] = [
  { value: '', label: '全部阶段' },
  { value: 'new_friend', label: '新好友' },
  { value: 'initial_chat', label: '初步沟通' },
  { value: 'interested', label: '意向客户' },
  { value: 'purchased', label: '已成交' },
  { value: 'in_group', label: '已进群' },
  { value: 'repurchased', label: '复购客户' },
  { value: 'silent', label: '沉默客户' },
];

interface UserForm {
  name: string;
  nickname: string;
  child_name: string;
  phone: string;
  wechat_id: string;
  wechat_remark: string;
  wechat_add_date: string;
  wechat_account: WechatAccount;
  douyin_nickname: string;
  source: CustomerSource | '';
  importance: Importance;
  stage: CustomerStage;
  tags: string[];
  remark: string;
  next_talk_topic: string;
}

const emptyForm: UserForm = {
  name: '',
  nickname: '',
  child_name: '',
  phone: '',
  wechat_id: '',
  wechat_remark: '',
  wechat_add_date: new Date().toISOString().split('T')[0],
  wechat_account: 'main',
  douyin_nickname: '',
  source: '',
  importance: 'normal',
  stage: 'new_friend',
  tags: [],
  remark: '',
  next_talk_topic: '',
};

function formatTime(s: string | null): string {
  if (!s) return '从未登录';
  return s.slice(0, 16).replace('T', ' ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/** 直接截取 YYYY-MM-DD 的月/日，不走 Date 解析（created_at 是 SQLite 的 datetime 文本） */
function formatMonthDay(s: string | null | undefined): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(s || '');
  return m ? `${Number(m[1])}/${Number(m[2])}` : '—';
}

function UserAvatar({ user }: { user: WxUser }) {
  const name = displayName(user);
  const isVip = user.importance === 'vip';
  // 记录失败的那个 src 而不是布尔值：表格行会复用组件实例，布尔值会串到别人身上
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = user.avatar_url && failedSrc !== user.avatar_url ? user.avatar_url : null;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailedSrc(user.avatar_url)}
        className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-border-default"
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold"
      style={{
        backgroundColor: isVip ? 'var(--color-warning-soft)' : 'var(--color-primary-soft)',
        color: isVip ? 'var(--color-warning)' : 'var(--color-primary)',
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

function UserRow({ user, onOpen, onAdjust, onLedger }: {
  user: WxUser; onOpen: () => void; onAdjust: () => void; onLedger: () => void;
}) {
  const name = displayName(user);
  const isVip = user.importance === 'vip';
  const loginDate = (user.last_login_at || '').slice(0, 10);
  const lastCheckin = user.last_checkin_date || '';
  const activityAt = lastCheckin > loginDate ? lastCheckin : loginDate;
  const checkins = user.checkin_count ?? 0;
  const signups = user.signup_count ?? 0;
  const activitySub = checkins > 0
    ? `打卡 ${checkins} · 报名 ${signups}`
    : signups > 0
      ? `报名 ${signups} · 未打卡`
      : '未参加活动';
  const sub = [
    user.wechat_id || user.wechat_remark,
    user.child_name ? `孩子：${user.child_name}` : '',
    user.wechat_account === 'assistant' ? '助理号' : '',
    ...(user.tags || []).map(t => `#${t}`),
  ].filter(Boolean).join('  ');

  return (
    <tr onClick={onOpen} className="cursor-pointer">
      <td
        style={isVip ? { boxShadow: 'inset 2px 0 0 var(--color-warning)' } : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="max-w-[200px] truncate text-sm font-semibold text-text-primary">{name}</span>
              {isVip && (
                <Star size={11} strokeWidth={2} className="shrink-0" style={{ color: 'var(--color-warning)' }} fill="currentColor" />
              )}
              {user.last_login_at && (
                <Smartphone size={11} strokeWidth={1.8} className="shrink-0 text-text-tertiary" aria-label="小程序登录过" />
              )}
            </div>
            {sub && (
              <div className="mt-0.5 max-w-[300px] truncate text-[11px] text-text-tertiary" title={sub}>{sub}</div>
            )}
            {user.next_talk_topic && (
              <div
                className="mt-1 inline-block max-w-[280px] truncate rounded px-1.5 py-0.5 text-[11px] bg-warning-soft text-warning"
                title={user.next_talk_topic}
              >
                下次聊：{user.next_talk_topic}
              </div>
            )}
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap">
        <div className="inline-flex items-center gap-1 text-[13px] text-text-secondary">
          <Clock size={10} strokeWidth={1.8} />
          {formatDate(activityAt)}
        </div>
        <div className="mt-0.5 text-[11px] text-text-tertiary">{activitySub}</div>
      </td>

      <td className="whitespace-nowrap">
        <span className="text-[13px] text-text-tertiary" title={user.created_at}>
          {formatMonthDay(user.created_at)}
        </span>
      </td>

      <td>
        <button
          onClick={e => { e.stopPropagation(); onAdjust(); }}
          className="inline-flex items-center gap-1 text-sm font-bold hover:opacity-70"
          style={{ color: (user.points || 0) > 0 ? 'rgb(180 83 9)' : 'var(--color-text-tertiary)' }}
          title="调整积分"
        >
          <Coins size={12} strokeWidth={2} />
          {user.points || 0}
        </button>
      </td>

      <td>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={e => { e.stopPropagation(); onLedger(); }}
            className="btn btn-tertiary btn-sm"
            title="积分明细"
          >
            明细
          </button>
          <button onClick={e => { e.stopPropagation(); onOpen(); }} className="btn btn-tertiary btn-sm">
            详情
          </button>
        </div>
      </td>
    </tr>
  );
}

function SortHeader({ label, sortKey, currentSort, dir, onClick }: {
  label: string; sortKey: WxUserSortKey; currentSort: string; dir: 'asc' | 'desc'; onClick: () => void;
}) {
  const isActive = currentSort === sortKey;
  const Icon = !isActive ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`sortable ${isActive ? 'is-active' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        title={isActive ? (dir === 'desc' ? `按${label}升序` : `按${label}降序`) : `按${label}排序`}
      >
        <span>{label}</span>
        <Icon size={12} strokeWidth={2} className="shrink-0 opacity-70" />
      </button>
    </th>
  );
}

interface FilterOption {
  value: string;
  label: string;
  count?: number;
  warning?: boolean;
}

function FilterRow({ label, options, activeValue, onSelect }: {
  label: string; options: FilterOption[]; activeValue: string; onSelect: (value: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="shrink-0 w-16 pt-1 text-xs font-medium text-text-tertiary">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {options.map(option => {
          const isActive = activeValue === option.value;
          const isDead = !isActive && option.count === 0;
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              disabled={isDead}
              title={isDead ? '当前条件下没有符合的人' : undefined}
              className={`filter-chip ${isActive ? 'filter-chip-active' : ''} ${option.warning && isActive ? 'filter-chip-warning' : ''} disabled:opacity-40 disabled:pointer-events-none`}
            >
              {option.label}
              {option.count !== undefined && (
                <span className="ml-1 text-[10px] tabular-nums opacity-60">{option.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WxUserList() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    wxUsers,
    totalWxUsers,
    wxUserPage,
    loading,
    error,
    wxUserFilters,
    wxUserFacets,
    addWxUser,
    loadWxUsers,
    setWxUserFilters,
    adjustWxUserPoints,
    loadWxUserPoints,
    wxUserPoints,
    wxUserPointsTotal,
  } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showFilters, setShowFilters] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return ['importance', 'stage', 'need_follow', 'tag'].some(k => p.get(k));
  });

  const [selectedUser, setSelectedUser] = useState<WxUser | null>(null);
  const [pointsModal, setPointsModal] = useState<'adjust' | 'ledger' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const search = params.get('search') || undefined;
    const importance = params.get('importance') || undefined;
    const stageParam = params.get('stage') || undefined;
    const stage = STAGE_FILTERS.some(f => f.value === stageParam) ? stageParam : undefined;
    const needFollow = params.get('need_follow') === 'true' ? 'true' : undefined;
    const tag = params.get('tag') || undefined;
    const sortParam = params.get('sort') || undefined;
    const sort = SORT_KEYS.includes(sortParam as WxUserSortKey) ? sortParam : undefined;
    const dirParam = params.get('dir');
    const dir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : undefined;

    setSearchValue(search || '');
    if (params.get('showAdd') === 'true') {
      setForm(emptyForm);
      setShowAdd(true);
    }
    setWxUserFilters({ search, importance, stage, need_follow: needFollow, tag, sort, dir });
  }, [location.search, setWxUserFilters]);

  useEffect(() => {
    if (pointsModal !== 'ledger' || !selectedUser) return;
    loadWxUserPoints(selectedUser.id);
  }, [pointsModal, selectedUser, loadWxUserPoints]);

  // 筛选条件统一写在 URL 上：刷新、分享链接后状态一致；改任一条件都回到第 1 页
  const patchQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete('page');
    params.delete('showAdd');
    navigate(`/wx-users?${params.toString()}`);
  };

  const handleSearch = () => patchQuery({ search: searchValue || null });
  const handleImportanceFilter = (value: string) => patchQuery({ importance: value || null });
  const handleStageFilter = (value: string) => patchQuery({ stage: value || null });
  const toggleNeedFollow = () => patchQuery({ need_follow: wxUserFilters.need_follow ? null : 'true' });
  const clearAllFilters = () => {
    setSearchValue('');
    patchQuery({ search: null, importance: null, stage: null, need_follow: null, tag: null });
  };

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setCustomTag('');
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await addWxUser({
        name: form.name,
        nickname: form.nickname || null,
        child_name: form.child_name || null,
        phone: form.phone || null,
        wechat_id: form.wechat_id || null,
        wechat_remark: form.wechat_remark || null,
        wechat_add_date: form.wechat_add_date || null,
        wechat_account: form.wechat_account,
        douyin_nickname: form.douyin_nickname || null,
        source: form.source || null,
        importance: form.importance,
        stage: form.stage,
        tags: form.tags,
        remark: form.remark || null,
        next_talk_topic: form.next_talk_topic || null,
      });
      setShowAdd(false);
      setForm(emptyForm);
    } catch (e) {
      console.error('添加微信用户失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjust = (u: WxUser) => {
    setSelectedUser(u);
    setAmount('');
    setNote('');
    setModalError('');
    setPointsModal('adjust');
  };

  const openLedger = (u: WxUser) => {
    setSelectedUser(u);
    setModalError('');
    setPointsModal('ledger');
  };

  const handleAdjust = async () => {
    if (!selectedUser) return;
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt === 0) {
      setModalError('请输入非零整数');
      return;
    }
    if (!note.trim()) {
      setModalError('请填写调整原因');
      return;
    }
    setSubmitting(true);
    setModalError('');
    try {
      await adjustWxUserPoints(selectedUser.id, amt, note.trim());
      setPointsModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const currentImportance = wxUserFilters.importance || '';
  const currentStage = wxUserFilters.stage || '';
  const currentNeedFollow = !!wxUserFilters.need_follow;
  const facets = wxUserFacets;

  // 排序状态同样放 URL：换列回到该列默认方向（降序），重复点同一列才翻转
  const currentSort: WxUserSortKey = SORT_KEYS.includes(wxUserFilters.sort as WxUserSortKey)
    ? (wxUserFilters.sort as WxUserSortKey)
    : 'activity';
  const currentDir: 'asc' | 'desc' = wxUserFilters.dir === 'asc' ? 'asc' : 'desc';
  const handleSort = (key: WxUserSortKey) => {
    if (currentSort !== key) patchQuery({ sort: key, dir: null });
    else patchQuery({ dir: currentDir === 'desc' ? 'asc' : null });
  };

  const importanceOptions: FilterOption[] = IMPORTANCE_FILTERS.map(f => ({
    value: f.value,
    label: f.label,
    warning: f.value === 'vip',
    count: f.value ? facets?.importance?.[f.value as Importance] ?? 0 : undefined,
  }));
  const stageOptions: FilterOption[] = STAGE_FILTERS.map(f => ({
    value: f.value,
    label: f.label,
    count: f.value ? facets?.stage?.[f.value as CustomerStage] ?? 0 : undefined,
  }));
  const needFollowOptions: FilterOption[] = [
    { value: 'need', label: '需跟进', count: facets?.need_follow ?? 0 },
  ];

  const appliedChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (wxUserFilters.search) {
    appliedChips.push({
      key: 'search',
      label: `搜索「${wxUserFilters.search}」`,
      onRemove: () => { setSearchValue(''); patchQuery({ search: null }); },
    });
  }
  if (wxUserFilters.importance) {
    appliedChips.push({
      key: 'importance',
      label: `重要程度：${IMPORTANCE_FILTERS.find(f => f.value === wxUserFilters.importance)?.label ?? wxUserFilters.importance}`,
      onRemove: () => patchQuery({ importance: null }),
    });
  }
  if (wxUserFilters.stage) {
    appliedChips.push({
      key: 'stage',
      label: `用户阶段：${STAGE_FILTERS.find(f => f.value === wxUserFilters.stage)?.label ?? wxUserFilters.stage}`,
      onRemove: () => patchQuery({ stage: null }),
    });
  }
  if (currentNeedFollow) {
    appliedChips.push({ key: 'need_follow', label: '需跟进', onRemove: () => patchQuery({ need_follow: null }) });
  }
  if (wxUserFilters.tag) {
    appliedChips.push({ key: 'tag', label: `标签 #${wxUserFilters.tag}`, onRemove: () => patchQuery({ tag: null }) });
  }
  const hasFilters = appliedChips.length > 0;
  const panelFilterCount = appliedChips.filter(c => c.key !== 'search').length;

  const totalPages = Math.max(1, Math.ceil(totalWxUsers / PAGE_SIZE));
  const gotoPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    loadWxUsers({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="t-display">微信用户</h1>
            <p className="t-caption mt-1">
              {hasFilters ? `筛选出 ${totalWxUsers} 位` : `共 ${totalWxUsers} 位`} · 小程序登录的用户会自动出现在这里，可直接编辑资料、记录跟进与订单
            </p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="btn btn-primary"
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            添加用户
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
            {error}
          </div>
        )}

        {/* 搜索 + 筛选区 */}
        <div className="mb-6 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                strokeWidth={1.8}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <input
                className="input pl-9 pr-9"
                placeholder="搜索姓名、昵称、孩子、微信号、手机、标签..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              {searchValue && (
                <button
                  onClick={() => { setSearchValue(''); patchQuery({ search: null }); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  title="清空搜索"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
            <button onClick={handleSearch} className="btn btn-secondary shrink-0">
              搜索
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className="btn btn-secondary shrink-0"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={14} strokeWidth={1.8} />
              更多筛选
              {panelFilterCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold leading-4 text-center"
                      style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                  {panelFilterCount}
                </span>
              )}
              <ChevronDown size={13} strokeWidth={2}
                className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="rounded-xl border border-border-default bg-bg-surface px-4 py-3.5 space-y-2.5">
              <FilterRow
                label="重要程度"
                options={importanceOptions}
                activeValue={currentImportance}
                onSelect={handleImportanceFilter}
              />
              <FilterRow
                label="用户阶段"
                options={stageOptions}
                activeValue={currentStage}
                onSelect={handleStageFilter}
              />
              <FilterRow
                label="跟进状态"
                options={needFollowOptions}
                activeValue={currentNeedFollow ? 'need' : ''}
                onSelect={() => toggleNeedFollow()}
              />
              <p className="pl-[4.5rem] text-[11px] leading-relaxed text-text-tertiary">
                需跟进 = 加好友满 3 天还没记录过跟进，或上次跟进距今满 7 天。
                选项后的数字是「套用其他已选条件后」命中的人数，灰色不可点是当前条件下没人符合。
              </p>
            </div>
          )}

          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5"
                 style={{ backgroundColor: 'var(--color-primary-soft)' }}>
              <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                已筛选
              </span>
              {appliedChips.map(chip => (
                <button
                  key={chip.key}
                  onClick={chip.onRemove}
                  className="chip chip-neutral"
                  title="点击移除这个条件"
                >
                  {chip.label}
                  <X size={11} strokeWidth={2.4} />
                </button>
              ))}
              <span className="text-xs text-text-secondary">匹配 {totalWxUsers} 位</span>
              <button onClick={clearAllFilters} className="btn btn-tertiary btn-sm ml-auto shrink-0">
                清除全部
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20">
            <Loading />
          </div>
        ) : wxUsers.length > 0 ? (
          <div className="table-card dense">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>用户</th>
                    <SortHeader label="最近活跃" sortKey="activity" currentSort={currentSort} dir={currentDir} onClick={() => handleSort('activity')} />
                    <SortHeader label="加入" sortKey="joined" currentSort={currentSort} dir={currentDir} onClick={() => handleSort('joined')} />
                    <SortHeader label="积分" sortKey="points" currentSort={currentSort} dir={currentDir} onClick={() => handleSort('points')} />
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {wxUsers.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onOpen={() => navigate(`/wx-users/${user.id}`)}
                      onAdjust={() => openAdjust(user)}
                      onLedger={() => openLedger(user)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <span className="text-xs text-text-tertiary">
                {hasFilters ? '匹配' : '共'} {totalWxUsers} 位 · 每页 {PAGE_SIZE} 位
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => gotoPage(wxUserPage - 1)}
                    disabled={wxUserPage <= 1 || loading}
                    className="btn btn-secondary btn-sm disabled:opacity-40"
                  >
                    <ChevronLeft size={13} strokeWidth={2} />
                    上一页
                  </button>
                  <span className="t-small text-text-tertiary">第 {wxUserPage} / {totalPages} 页</span>
                  <button
                    onClick={() => gotoPage(wxUserPage + 1)}
                    disabled={wxUserPage >= totalPages || loading}
                    className="btn btn-secondary btn-sm disabled:opacity-40"
                  >
                    下一页
                    <ChevronRight size={13} strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Empty
            icon={hasFilters
              ? <Search size={26} strokeWidth={1.5} className="text-text-tertiary" />
              : <User size={28} strokeWidth={1.5} className="text-text-tertiary" />}
            title={hasFilters ? '没有符合条件的用户' : '暂无用户'}
            description={hasFilters
              ? `没有同时满足「${appliedChips.map(c => c.label).join(' + ')}」的用户，放宽或清除条件再看看`
              : '小程序端有人登录后会自动出现在这里，也可以手动添加一位微信好友'}
            action={hasFilters ? (
              <button onClick={clearAllFilters} className="btn btn-secondary">
                清除筛选条件
              </button>
            ) : (
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="btn btn-primary"
              >
                <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                  <Plus size={13} strokeWidth={2.5} />
                </span>
                添加第一位用户
              </button>
            )}
          />
        )}
      </div>

      {/* 添加用户 Modal */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="添加微信用户"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary">取消</button>
            <button onClick={handleAdd} disabled={!form.name.trim() || submitting} className="btn btn-primary">
              {submitting && <Loader2 size={15} strokeWidth={1.8} className="animate-spin" />}
              确认添加
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">
              备注名 <span className="text-brand-500">*</span>
            </label>
            <input
              className="input"
              placeholder="例如：轩轩妈妈-三年级"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">微信昵称</label>
              <input
                className="input"
                placeholder="对方微信昵称（选填）"
                value={form.nickname}
                onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">孩子名字</label>
              <input
                className="input"
                placeholder="孩子名字（选填）"
                value={form.child_name}
                onChange={e => setForm(f => ({ ...f, child_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">微信号</label>
              <input
                className="input"
                placeholder="微信号"
                value={form.wechat_id}
                onChange={e => setForm(f => ({ ...f, wechat_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">微信备注名</label>
              <input
                className="input"
                placeholder="微信上的备注"
                value={form.wechat_remark}
                onChange={e => setForm(f => ({ ...f, wechat_remark: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">添加微信日期</label>
              <input
                type="date"
                className="input"
                value={form.wechat_add_date}
                onChange={e => setForm(f => ({ ...f, wechat_add_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">在哪个微信号</label>
              <select
                className="select w-full"
                value={form.wechat_account}
                onChange={e => setForm(f => ({ ...f, wechat_account: e.target.value as WechatAccount }))}
              >
                {Object.entries(WECHAT_ACCOUNT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">手机号</label>
              <input
                className="input"
                placeholder="手机号码（选填）"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">抖音昵称</label>
              <input
                className="input"
                placeholder="抖音昵称（选填）"
                value={form.douyin_nickname}
                onChange={e => setForm(f => ({ ...f, douyin_nickname: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">来源</label>
              <select
                className="select w-full"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value as CustomerSource | '' }))}
              >
                <option value="">请选择</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">重要程度</label>
              <select
                className="select w-full"
                value={form.importance}
                onChange={e => setForm(f => ({ ...f, importance: e.target.value as Importance }))}
              >
                {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">用户阶段</label>
              <select
                className="select w-full"
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value as CustomerStage }))}
              >
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">下次聊啥/关注点</label>
            <input
              className="input"
              placeholder="例如：等发工资买作文、孩子要小升初、问过自然拼读"
              value={form.next_talk_topic}
              onChange={e => setForm(f => ({ ...f, next_talk_topic: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label flex items-center gap-1">
              <Tag size={13} strokeWidth={1.8} />
              标签
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_TAGS.map(tag => {
                const selected = form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`chip ${selected ? 'chip-primary' : 'chip-neutral'}`}
                  >
                    {tag}
                  </button>
                );
              })}
              {form.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="chip chip-danger"
                >
                  {tag}
                  <X size={12} strokeWidth={1.8} />
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-[13px]"
                placeholder="自定义标签"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="btn btn-secondary"
              >
                添加
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">备注</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="记录一些关于这个用户的信息，比如家庭情况、谁管孩子学习、预算多少..."
              value={form.remark}
              onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* 调积分 Modal */}
      <Modal
        isOpen={pointsModal === 'adjust'}
        onClose={() => setPointsModal(null)}
        title={`调整积分 - ${selectedUser ? displayName(selectedUser) : ''}`}
        footer={
          <>
            <button onClick={() => setPointsModal(null)} className="btn btn-secondary">取消</button>
            {selectedUser && (
              <button
                onClick={() => { openLedger(selectedUser); }}
                className="btn btn-secondary"
              >
                看明细
              </button>
            )}
            <button onClick={handleAdjust} disabled={submitting} className="btn btn-primary">
              {submitting ? '提交中...' : '确认调整'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="px-3 py-2.5 rounded-xl bg-bg-subtle text-xs text-text-secondary flex items-center gap-2">
            <Coins size={13} strokeWidth={1.8} className="text-amber-600" />
            当前积分余额：{selectedUser?.points ?? 0} 分
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              积分数量（正数加分，负数扣分）
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAmount(String(-Math.abs(parseInt(amount || '1', 10) || 1)))}
                className="btn btn-secondary shrink-0"
                title="扣分"
              >
                <Minus size={14} strokeWidth={2} />
              </button>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例如 50 或 -10"
                className="input-base flex-1"
              />
              <button
                onClick={() => setAmount(String(Math.abs(parseInt(amount || '1', 10) || 1)))}
                className="btn btn-secondary shrink-0"
                title="加分"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              调整原因
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="例如：线下购书奖励、活动补偿"
              className="input-base w-full"
            />
          </div>
          {modalError && <div className="text-xs text-danger">{modalError}</div>}
        </div>
      </Modal>

      {/* 积分明细 Modal */}
      <Modal
        isOpen={pointsModal === 'ledger'}
        onClose={() => setPointsModal(null)}
        title={`积分明细 - ${selectedUser ? displayName(selectedUser) : ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="px-3 py-3 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-between">
            <span className="text-xs text-amber-700">当前余额</span>
            <span className="text-lg font-bold text-amber-700 flex items-center gap-1.5">
              <Coins size={16} strokeWidth={2} />
              {selectedUser?.points ?? 0} 分
            </span>
          </div>
          {loading && wxUserPoints.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-tertiary">加载中...</div>
          ) : wxUserPoints.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-tertiary">暂无积分记录</div>
          ) : (
            <ul className="divide-y divide-border-subtle max-h-80 overflow-y-auto rounded-xl border border-border-default">
              {wxUserPoints.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span
                    className="shrink-0 px-1.5 py-0.5 rounded-md text-[0.6875rem] font-medium"
                    style={{
                      backgroundColor: item.type === 'adjust'
                        ? 'rgb(139 92 246 / 0.1)'
                        : item.type === 'order'
                          ? 'rgb(59 130 246 / 0.1)'
                          : 'rgb(16 185 129 / 0.1)',
                      color: item.type === 'adjust'
                        ? 'rgb(109 40 217)'
                        : item.type === 'order'
                          ? 'rgb(37 99 235)'
                          : 'rgb(4 120 87)',
                    }}
                  >
                    {POINTS_TYPE_LABELS[item.type]}
                  </span>
                  <span
                    className={`text-sm font-semibold ${item.amount > 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {item.amount > 0 ? '+' : ''}{item.amount}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-secondary truncate">{item.note || '—'}</div>
                    <div className="text-[0.6875rem] text-text-tertiary mt-0.5">
                      {formatTime(item.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {wxUserPointsTotal > wxUserPoints.length && (
            <div className="text-center text-xs text-text-tertiary">
              仅显示最近 {wxUserPoints.length} 条（共 {wxUserPointsTotal} 条）
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
