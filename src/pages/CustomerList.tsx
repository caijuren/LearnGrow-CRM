import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, MessageCircle, Star, Clock,
  UserPlus, Filter, Tag, Loader2, User,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  SOURCE_LABELS, IMPORTANCE_LABELS, COMMON_TAGS,
  STAGE_LABELS, WECHAT_ACCOUNT_LABELS,
  type Importance, type CustomerSource, type CustomerStage, type WechatAccount,
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

function CustomerCard({ customer, onClick }: { customer: any; onClick: () => void }) {
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
      className="cursor-pointer transition-all duration-150 group relative overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-strong)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgb(16 24 40 / 0.04), 0 4px 12px rgb(16 24 40 / 0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-default)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* VIP 左侧色条 */}
      {isVip && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: 'linear-gradient(180deg, rgb(245 158 11), rgb(234 179 8))',
          }}
        />
      )}

      <div className="flex items-start gap-3" style={{ paddingLeft: isVip ? '0.5rem' : 0 }}>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isVip ? 'rgb(245 158 11 / 0.08)' : 'var(--color-primary-soft)',
            color: isVip ? 'rgb(217 119 6)' : 'var(--color-primary)',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {customer.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h3
              className="truncate flex-1"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                lineHeight: 1.4,
              }}
            >
              {customer.name}
            </h3>
            {isVip && (
              <Star
                size={12}
                strokeWidth={2}
                style={{ color: 'rgb(245 158 11)', fill: 'currentColor', flexShrink: 0 }}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
              style={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                backgroundColor: 'var(--color-bg-subtle)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {STAGE_LABELS[customer.stage as CustomerStage]}
            </span>
            {customer.wechat_account === 'assistant' && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                助理号
              </span>
            )}
          </div>
          {customer.wechat_remark && (
            <div
              className="flex items-center gap-1 truncate"
              style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}
            >
              <MessageCircle size={11} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span className="truncate">{customer.wechat_remark}</span>
            </div>
          )}
          {customer.next_talk_topic && (
            <div
              className="mt-1.5 px-2 py-1 rounded-sm truncate"
              style={{
                fontSize: '0.6875rem',
                backgroundColor: 'rgb(245 158 11 / 0.08)',
                color: 'rgb(180 83 9)',
                lineHeight: 1.4,
              }}
            >
              {customer.next_talk_topic}
            </div>
          )}
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {customer.tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  {tag}
                </span>
              ))}
              {customer.tags.length > 3 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  +{customer.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部数据 */}
      <div
        className="grid grid-cols-3 gap-2 mt-3 pt-3"
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          marginLeft: isVip ? '0.5rem' : 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.2,
            }}
          >
            ¥{customer.total_spent?.toLocaleString() || 0}
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}
          >
            累计消费
          </div>
        </div>
        <div
          style={{
            borderLeft: '1px solid var(--color-border-subtle)',
            paddingLeft: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.2,
            }}
          >
            {customer.order_count || 0}
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}
          >
            订单数
          </div>
        </div>
        <div
          style={{
            borderLeft: '1px solid var(--color-border-subtle)',
            paddingLeft: '0.5rem',
          }}
        >
          <div
            className="flex items-center gap-0.5"
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.2,
            }}
          >
            <Clock size={10} strokeWidth={1.8} />
            {formatDate(customer.last_follow_date)}
          </div>
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}
          >
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
    loadCustomers,
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
  }, [location.search]);

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
            <p className="t-caption mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              管理您的微信私域客户，记录每一次沟通
            </p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="btn-primary"
          >
            <Plus size={15} strokeWidth={1.8} />
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
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)',
                }}
              />
              <input
                className="input pl-9"
                placeholder="搜索客户备注、微信号、手机、标签..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="btn-secondary">
              <Filter size={14} strokeWidth={1.8} />
              筛选
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="shrink-0"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--color-text-tertiary)',
                  width: '64px',
                }}
              >
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
                      className="transition-all"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive
                          ? isVipFilter
                            ? 'rgb(245 158 11 / 0.1)'
                            : 'var(--color-primary-soft)'
                          : 'transparent',
                        color: isActive
                          ? isVipFilter
                            ? 'rgb(180 83 9)'
                            : 'var(--color-primary)'
                          : 'var(--color-text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="shrink-0"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--color-text-tertiary)',
                  width: '64px',
                }}
              >
                客户阶段
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {STAGE_FILTERS.map(filter => {
                  const isActive = currentStage === filter.value;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => handleStageFilter(filter.value)}
                      className="transition-all"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive ? 'var(--color-primary-soft)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
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
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={28} strokeWidth={1.8} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p className="t-caption mt-3" style={{ color: 'var(--color-text-tertiary)' }}>加载中...</p>
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
            icon={<User size={28} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />}
            title="暂无客户"
            description={customerFilters.search || customerFilters.importance || customerFilters.stage
              ? '没有找到匹配的客户，试试调整筛选条件'
              : '开始添加您的第一位微信好友吧'}
            action={
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="btn-primary"
              >
                <Plus size={14} strokeWidth={1.8} />
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
            <button onClick={() => setShowAdd(false)} className="btn-secondary">取消</button>
            <button onClick={handleAdd} disabled={!form.name.trim() || submitting} className="btn-primary">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
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
                        className="chip"
                        style={{
                          backgroundColor: selected ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                          borderColor: selected ? 'rgb(91 92 226 / 0.3)' : 'var(--color-border-default)',
                          color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                          fontWeight: selected ? 600 : 500,
                        }}
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
                      className="chip"
                      style={{
                        backgroundColor: 'rgb(244 63 94 / 0.08)',
                        borderColor: 'rgb(244 63 94 / 0.2)',
                        color: '#E11D48',
                      }}
                    >
                      {tag}
                      <X size={12} strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    style={{ fontSize: '0.8125rem' }}
                    placeholder="自定义标签"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="btn-secondary btn-sm"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="input resize-none"
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
