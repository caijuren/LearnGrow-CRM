import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, MessageCircle, Star, Clock,
  Filter, Tag, Loader2, User,
} from 'lucide-react';
import { useStore } from '@/store';
import Loading from '@/components/ui/Loading';
import {
  SOURCE_LABELS, IMPORTANCE_LABELS, COMMON_TAGS,
  STAGE_LABELS, WECHAT_ACCOUNT_LABELS,
  type Importance, type CustomerSource, type CustomerStage, type WechatAccount, type Customer,
} from '../../shared/types';
import Empty from '@/components/Empty';
import Modal from '@/components/Modal';

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

interface CustomerForm {
  name: string;
  nickname: string;
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

const emptyForm: CustomerForm = {
  name: '',
  nickname: '',
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

function CustomerCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const isVip = customer.importance === 'vip';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未跟进';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      onClick={onClick}
      className="clean-card cursor-pointer group relative overflow-hidden p-4 pt-[22px]"
    >
      {/* 顶部渐变 accent 线 */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[20px]"
        style={{
          background: isVip
            ? 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)'
            : 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)',
        }}
      />
      {/* VIP 左侧色条 */}
      {isVip && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-warning to-yellow-500" />
      )}

      <div className={`flex items-start gap-3 ${isVip ? 'pl-2' : ''}`}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-semibold"
          style={{
            backgroundColor: isVip ? 'var(--color-warning-soft)' : 'var(--color-primary-soft)',
            color: isVip ? 'var(--color-warning)' : 'var(--color-primary)',
          }}
        >
          {customer.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3 className="truncate flex-1 text-sm font-semibold text-text-primary leading-snug">
              {customer.name}
            </h3>
            {isVip && (
              <Star size={12} strokeWidth={2} className="shrink-0" style={{ color: 'var(--color-warning)' }} fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[11px] text-text-tertiary">
              {STAGE_LABELS[customer.stage as CustomerStage]}
            </span>
            {customer.wechat_account === 'assistant' && (
              <span className="text-[11px] text-text-tertiary bg-bg-subtle px-1.5 py-0.5 rounded">
                助理号
              </span>
            )}
          </div>
          {customer.wechat_remark && (
            <div className="flex items-center gap-1 truncate text-xs text-text-tertiary">
              <MessageCircle size={11} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{customer.wechat_remark}</span>
            </div>
          )}
          {customer.next_talk_topic && (
            <div className="mt-1.5 px-2 py-1 rounded truncate text-[11px] leading-relaxed bg-warning-soft text-warning">
              {customer.next_talk_topic}
            </div>
          )}
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {customer.tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="badge badge-neutral text-[11px] px-1.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
              {customer.tags.length > 3 && (
                <span className="text-[11px] font-medium text-text-tertiary px-1">
                  +{customer.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部数据 */}
      <div className={`grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-dashed border-border-subtle ${isVip ? 'ml-2' : ''}`}>
        <div className="text-center">
          <div className="text-[15px] font-bold text-text-primary leading-tight">
            ¥{customer.total_spent?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            累计消费
          </div>
        </div>
        <div className="text-center border-l border-border-subtle">
          <div className="text-[15px] font-bold text-text-primary leading-tight">
            {customer.order_count || 0}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            订单数
          </div>
        </div>
        <div className="text-center border-l border-border-subtle">
          <div className="flex items-center justify-center gap-0.5 text-xs font-medium text-text-secondary leading-tight">
            <Clock size={10} strokeWidth={1.8} />
            {formatDate(customer.last_follow_date)}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            最后跟进
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerList() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    customers,
    loading,
    customerFilters,
    addCustomer,
    setCustomerFilters,
  } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [customTag, setCustomTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const search = params.get('search') || undefined;
    const importance = params.get('importance') || undefined;
    const stageParam = params.get('stage') || undefined;
    const stage = STAGE_FILTERS.some(f => f.value === stageParam) ? stageParam : undefined;
    const needFollow = params.get('need_follow') === 'true' ? 'true' : undefined;
    const tag = params.get('tag') || undefined;

    setSearchValue(search || '');
    if (params.get('showAdd') === 'true') {
      setForm(emptyForm);
      setShowAdd(true);
    }
    setCustomerFilters({ search, importance, stage, need_follow: needFollow, tag });
  }, [location.search, setCustomerFilters]);

  const handleSearch = () => {
    const params = new URLSearchParams(location.search);
    if (searchValue) params.set('search', searchValue);
    else params.delete('search');
    navigate(`/customers?${params.toString()}`);
  };

  const handleImportanceFilter = (importance: Importance | '') => {
    const params = new URLSearchParams(location.search);
    if (importance) params.set('importance', importance);
    else params.delete('importance');
    navigate(`/customers?${params.toString()}`);
  };

  const handleStageFilter = (stage: CustomerStage | '') => {
    const params = new URLSearchParams(location.search);
    params.delete('need_follow');
    if (stage) params.set('stage', stage);
    else params.delete('stage');
    navigate(`/customers?${params.toString()}`);
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
      await addCustomer({
        name: form.name,
        nickname: form.nickname || null,
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
      console.error('添加客户失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const currentImportance = customerFilters.importance || '';
  const currentStage = customerFilters.stage || '';

  return (
    <div className="page-shell">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="t-display">我的客户</h1>
            <p className="t-caption mt-1">
              管理您的微信私域客户，记录每一次沟通
            </p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="btn btn-primary"
          >
            <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            添加客户
          </button>
        </div>

        {/* 搜索 + 筛选区 */}
        <div className="mb-6">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search
                size={15}
                strokeWidth={1.8}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <input
                className="input pl-9"
                placeholder="搜索客户备注、微信号、手机、标签..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="btn btn-secondary">
              <Filter size={14} strokeWidth={1.8} />
              筛选
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="shrink-0 w-16 text-xs font-medium text-text-tertiary">
                重要程度
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {IMPORTANCE_FILTERS.map(filter => {
                  const isActive = currentImportance === filter.value;
                  const isVipFilter = filter.value === 'vip';
                  return (
                    <button
                      key={filter.value}
                      onClick={() => handleImportanceFilter(filter.value)}
                      className={`filter-chip ${isActive ? 'filter-chip-active' : ''} ${isVipFilter && isActive ? 'filter-chip-warning' : ''}`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="shrink-0 w-16 text-xs font-medium text-text-tertiary">
                客户阶段
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {STAGE_FILTERS.map(filter => {
                  const isActive = currentStage === filter.value;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => handleStageFilter(filter.value)}
                      className={`filter-chip ${isActive ? 'filter-chip-active' : ''}`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20">
            <Loading />
          </div>
        ) : customers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {customers.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => navigate(`/customers/${customer.id}`)}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<User size={28} strokeWidth={1.5} className="text-text-tertiary" />}
            title="暂无客户"
            description={customerFilters.search || customerFilters.importance || customerFilters.stage
              ? '没有找到匹配的客户，试试调整筛选条件'
              : '开始添加您的第一位微信好友吧'}
            action={
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="btn btn-primary"
              >
                <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center">
                  <Plus size={13} strokeWidth={2.5} />
                </span>
                添加第一位客户
              </button>
            }
          />
        )}
      </div>

      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="添加微信好友"
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
                客户备注名 <span className="text-brand-500">*</span>
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
                  <label className="form-label">客户阶段</label>
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
                  placeholder="记录一些关于这个客户的信息，比如家庭情况、谁管孩子学习、预算多少..."
                  value={form.remark}
                  onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                />
              </div>
            </div>
      </Modal>
    </div>
  );
}
