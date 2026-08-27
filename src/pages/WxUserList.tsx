import { useEffect, useMemo, useState } from 'react';
import { Search, Coins, UserCheck, UserX, Link2, Unlink, Plus, Minus, RefreshCw, Users } from 'lucide-react';
import { useStore } from '@/store';
import Modal from '@/components/Modal';
import Empty from '@/components/Empty';
import { fetchCustomers } from '@/lib/api';
import { POINTS_TYPE_LABELS, type WxUserWithPoints, type Customer } from '../../shared/types';

function formatTime(s: string | null): string {
  if (!s) return '从未登录';
  return s.slice(0, 16).replace('T', ' ');
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold"
      style={{
        fontSize: '0.75rem',
        backgroundColor: points > 0 ? 'rgb(245 158 11 / 0.12)' : 'var(--color-bg-subtle)',
        color: points > 0 ? 'rgb(180 83 9)' : 'var(--color-text-tertiary)',
      }}
    >
      <Coins size={12} strokeWidth={2} />
      {points}
    </span>
  );
}

export default function WxUserList() {
  const {
    wxUsers,
    wxUsersTotal,
    wxUserPoints,
    wxUserPointsTotal,
    loading,
    error,
    loadWxUsers,
    linkWxUser,
    adjustWxUserPoints,
    loadWxUserPoints,
  } = useStore();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);

  const [selectedUser, setSelectedUser] = useState<WxUserWithPoints | null>(null);
  const [modal, setModal] = useState<'link' | 'adjust' | 'points' | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null>(null);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    loadWxUsers({ search: search || undefined, unlinked: unlinkedOnly || undefined });
  }, [loadWxUsers, search, unlinkedOnly]);

  useEffect(() => {
    if (modal !== 'points' || !selectedUser) return;
    loadWxUserPoints(selectedUser.id);
  }, [modal, selectedUser, loadWxUserPoints]);

  const openLink = (u: WxUserWithPoints) => {
    setSelectedUser(u);
    setPickedCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setModalError('');
    setModal('link');
  };

  const openAdjust = (u: WxUserWithPoints) => {
    setSelectedUser(u);
    setAmount('');
    setNote('');
    setModalError('');
    setModal('adjust');
  };

  const openPoints = (u: WxUserWithPoints) => {
    setSelectedUser(u);
    setModal('points');
  };

  const searchCustomers = async (q: string) => {
    setCustomerLoading(true);
    try {
      const data = await fetchCustomers({ search: q, limit: 10 });
      setCustomerResults(data.customers);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setCustomerLoading(false);
    }
  };

  useEffect(() => {
    if (modal !== 'link') return;
    const timer = setTimeout(() => {
      if (customerQuery.trim()) searchCustomers(customerQuery.trim());
      else setCustomerResults([]);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerQuery, modal]);

  const handleLink = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setModalError('');
    try {
      await linkWxUser(selectedUser.id, pickedCustomer ? pickedCustomer.id : null);
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    setModalError('');
    try {
      await linkWxUser(selectedUser.id, null);
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
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
      setModal(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const unlinkedCount = useMemo(() => wxUsers.filter(u => !u.customer_id).length, [wxUsers]);

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="t-display">微信用户</h1>
            <p className="t-caption mt-1">
              小程序微信登录的用户自动出现在这里，可关联客户、管理积分
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-danger/30 bg-danger/10 text-danger text-sm">
            {error}
          </div>
        )}

        {/* 搜索与筛选 */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch((e.currentTarget as HTMLInputElement).value.trim()); }}
              onBlur={() => setSearch(searchInput.trim())}
              placeholder="搜索昵称或孩子名..."
              className="input-base w-full pl-9"
            />
          </div>
          <button
            onClick={() => setUnlinkedOnly(v => !v)}
            className={`btn ${unlinkedOnly ? 'btn-primary' : 'btn-secondary'}`}
            title="只看未关联客户的微信用户"
          >
            <UserX size={14} strokeWidth={1.8} />
            仅看未关联 {unlinkedOnly ? `(${unlinkedCount})` : ''}
          </button>
          <div className="text-xs text-text-tertiary ml-auto">
            共 {wxUsersTotal} 位用户
          </div>
        </div>

        {/* 用户列表 */}
        <div
          className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden"
        >
          {loading && wxUsers.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-text-tertiary">
              <RefreshCw size={16} strokeWidth={1.8} className="animate-spin mr-2" />
              加载中...
            </div>
          ) : wxUsers.length === 0 ? (
            <Empty
              icon={<Users size={24} strokeWidth={1.5} />}
              title={search || unlinkedOnly ? '没有符合条件的用户' : '还没有微信用户'}
              description="用户在小程序中用微信登录后会自动出现在这里"
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {wxUsers.map(u => (
                <li key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-subtle/60 transition-colors">
                  {/* 头像 */}
                  <div className="shrink-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.nickname || '用户'}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-border-default"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                        style={{ background: 'linear-gradient(135deg, rgb(245 158 11), rgb(234 88 12))' }}
                      >
                        {(u.nickname || '微').charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* 昵称 + 孩子 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {u.nickname || '微信用户'}
                      </span>
                      {u.child_name && (
                        <span className="text-xs text-text-tertiary truncate">
                          孩子：{u.child_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {formatTime(u.last_login_at)} · 登录于小程序
                    </div>
                  </div>

                  {/* 积分 */}
                  <div className="shrink-0">
                    <PointsBadge points={u.points || 0} />
                  </div>

                  {/* 关联客户 */}
                  <div className="shrink-0 w-40">
                    {u.customer_name ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                        <Link2 size={12} strokeWidth={1.8} className="text-primary" />
                        <span className="truncate">{u.customer_name}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
                        <Unlink size={12} strokeWidth={1.8} />
                        未关联
                      </span>
                    )}
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openLink(u)}
                      className="btn btn-secondary"
                      style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem', fontSize: '0.75rem' }}
                      title={u.customer_id ? '更换关联客户' : '关联客户'}
                    >
                      <UserCheck size={13} strokeWidth={1.8} />
                      {u.customer_id ? '更换' : '关联客户'}
                    </button>
                    <button
                      onClick={() => openAdjust(u)}
                      className="btn btn-secondary"
                      style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem', fontSize: '0.75rem' }}
                      title="手动调整积分"
                    >
                      <Plus size={13} strokeWidth={1.8} />
                      调积分
                    </button>
                    <button
                      onClick={() => openPoints(u)}
                      className="btn btn-secondary"
                      style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem', fontSize: '0.75rem' }}
                      title="查看积分明细"
                    >
                      明细
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 关联客户 Modal */}
      <Modal
        isOpen={modal === 'link'}
        onClose={() => setModal(null)}
        title={`关联客户 - ${selectedUser?.nickname || ''}`}
        footer={
          <>
            {selectedUser?.customer_id && (
              <button onClick={handleUnlink} disabled={submitting} className="btn btn-danger mr-auto">
                解除关联
              </button>
            )}
            <button onClick={() => setModal(null)} className="btn btn-secondary">取消</button>
            <button
              onClick={handleLink}
              disabled={submitting}
              className="btn btn-primary"
            >
              {pickedCustomer ? '确认关联' : '关联'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedUser?.customer_name && (
            <div className="px-3 py-2.5 rounded-xl bg-bg-subtle text-xs text-text-secondary flex items-center gap-2">
              <Link2 size={13} strokeWidth={1.8} className="text-primary" />
              当前已关联：{selectedUser.customer_name}
            </div>
          )}
          <div className="relative">
            <Search size={14} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="输入客户姓名/昵称搜索..."
              className="input-base w-full pl-9"
            />
          </div>
          {customerLoading && (
            <div className="text-xs text-text-tertiary py-2 text-center">搜索中...</div>
          )}
          {!customerLoading && customerResults.length === 0 && customerQuery.trim() && (
            <div className="text-xs text-text-tertiary py-2 text-center">没有找到匹配的客户</div>
          )}
          {customerResults.length > 0 && (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border-subtle rounded-xl border border-border-default">
              {customerResults.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setPickedCustomer(c);
                      setCustomerResults([]);
                      setCustomerQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-subtle transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{c.name}</div>
                      <div className="text-xs text-text-tertiary truncate">
                        {c.nickname || '无昵称'} · {c.phone || '无电话'}
                      </div>
                    </div>
                    {pickedCustomer?.id === c.id && (
                      <span className="text-xs text-primary font-medium">已选</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pickedCustomer && (
            <div className="px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-xs text-text-secondary flex items-center gap-2">
              <UserCheck size={13} strokeWidth={1.8} className="text-primary" />
              将关联到：{pickedCustomer.name}
              <button
                onClick={() => setPickedCustomer(null)}
                className="ml-auto text-text-tertiary hover:text-danger"
              >
                取消选择
              </button>
            </div>
          )}
          {modalError && <div className="text-xs text-danger">{modalError}</div>}
        </div>
      </Modal>

      {/* 调积分 Modal */}
      <Modal
        isOpen={modal === 'adjust'}
        onClose={() => setModal(null)}
        title={`调整积分 - ${selectedUser?.nickname || ''}`}
        footer={
          <>
            <button onClick={() => setModal(null)} className="btn btn-secondary">取消</button>
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
        isOpen={modal === 'points'}
        onClose={() => setModal(null)}
        title={`积分明细 - ${selectedUser?.nickname || ''}`}
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
