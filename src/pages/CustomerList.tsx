import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, Phone, MessageCircle, Star, Clock,
  Trash2, Edit2, UserPlus, Filter, Tag, Loader2, User,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  SOURCE_LABELS, IMPORTANCE_LABELS, IMPORTANCE_COLORS, COMMON_TAGS,
  STAGE_LABELS, STAGE_COLORS, WECHAT_ACCOUNT_LABELS,
  type Importance, type CustomerSource, type CustomerStage, type WechatAccount,
} from '../../shared/types';
import Empty from '@/components/Empty';

const IMPORTANCE_FILTERS: { value: Importance | ''; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'vip', label: '⭐重点' },
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

const AVATAR_COLORS = [
  'from-rose-400 to-pink-500',
  'from-pink-400 to-fuchsia-500',
  'from-fuchsia-400 to-purple-500',
  'from-purple-400 to-violet-500',
  'from-violet-400 to-indigo-500',
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
  const avatarColor = AVATAR_COLORS[customer.id % AVATAR_COLORS.length];
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
      className={`relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer border-2 group ${
        isVip
          ? 'border-amber-300 bg-gradient-to-br from-amber-50/50 to-white hover:border-amber-400'
          : 'border-slate-100 hover:border-rose-200'
      }`}
    >
      {isVip && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-200">
          <Star className="w-4 h-4 text-white fill-white" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform`}>
          <span className="text-lg font-bold text-white">{customer.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-rose-600 transition-colors">
              {customer.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STAGE_COLORS[customer.stage]}`}>
              {STAGE_LABELS[customer.stage as CustomerStage]}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            {customer.wechat_remark && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <MessageCircle className="w-3 h-3" />
                <span className="truncate">{customer.wechat_remark}</span>
              </div>
            )}
            {customer.wechat_account === 'assistant' && (
              <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-medium">助理号</span>
            )}
          </div>
          {customer.nickname && !customer.wechat_remark && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              <span className="truncate">{customer.nickname}</span>
            </div>
          )}
          {customer.next_talk_topic && (
            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg mt-1 line-clamp-1">
              💬 {customer.next_talk_topic}
            </div>
          )}
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {customer.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-medium">
                  {tag}
                </span>
              ))}
              {customer.tags.length > 3 && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                  +{customer.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
        <div className="text-center">
          <div className="text-sm font-bold text-rose-600">¥{customer.total_spent?.toLocaleString() || 0}</div>
          <div className="text-[10px] text-slate-400">累计消费</div>
        </div>
        <div className="text-center border-x border-slate-100">
          <div className="text-sm font-bold text-slate-700">{customer.order_count || 0}</div>
          <div className="text-[10px] text-slate-400">订单数</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-600 flex items-center justify-center gap-0.5">
            <Clock className="w-3 h-3" />
            {formatDate(customer.last_follow_date)}
          </div>
          <div className="text-[10px] text-slate-400">最后跟进</div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerList() {
  const navigate = useNavigate();
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
    loadCustomers({ page: 1 });
  }, []);

  const handleSearch = () => {
    setCustomerFilters({ search: searchValue || undefined });
  };

  const handleImportanceFilter = (importance: Importance | '') => {
    setCustomerFilters({ importance: importance || undefined });
  };

  const handleStageFilter = (stage: CustomerStage | '') => {
    setCustomerFilters({ stage: stage || undefined });
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
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent">
              我的客户
            </h1>
            <p className="text-sm text-slate-500 mt-1">管理您的微信私域客户，记录每一次沟通</p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加客户
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                placeholder="搜索备注名/微信号/微信备注/手机/抖音名/下次聊啥"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              搜索
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1">重要程度:</span>
              {IMPORTANCE_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => handleImportanceFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    currentImportance === filter.value
                      ? filter.value === 'vip'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1">客户阶段:</span>
              {STAGE_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => handleStageFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    currentStage === filter.value
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
            <p className="text-sm text-slate-500 mt-3">加载中...</p>
          </div>
        ) : customers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            icon={<User className="w-10 h-10 text-rose-300" />}
            title="暂无客户"
            description={customerFilters.search || customerFilters.importance || customerFilters.stage
              ? '没有找到匹配的客户，试试调整筛选条件'
              : '开始添加您的第一位微信好友吧'}
            action={
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-rose-200"
              >
                <Plus className="w-4 h-4" />
                添加第一位客户
              </button>
            }
          />
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-500" />
                添加微信好友
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  客户备注名 <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  placeholder="例如：轩轩妈妈-三年级"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">微信号</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    placeholder="微信号"
                    value={form.wechat_id}
                    onChange={e => setForm(f => ({ ...f, wechat_id: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">微信备注名</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    placeholder="微信上的备注"
                    value={form.wechat_remark}
                    onChange={e => setForm(f => ({ ...f, wechat_remark: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">添加微信日期</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    value={form.wechat_add_date}
                    onChange={e => setForm(f => ({ ...f, wechat_add_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">在哪个微信号</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
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
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">手机号</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    placeholder="手机号码（选填）"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">抖音昵称</label>
                  <input
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    placeholder="抖音昵称（选填）"
                    value={form.douyin_nickname}
                    onChange={e => setForm(f => ({ ...f, douyin_nickname: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">来源</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
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
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">重要程度</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                    value={form.importance}
                    onChange={e => setForm(f => ({ ...f, importance: e.target.value as Importance }))}
                  >
                    {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">客户阶段</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
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
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">下次聊啥/关注点</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  placeholder="例如：等发工资买作文、孩子要小升初、问过自然拼读"
                  value={form.next_talk_topic}
                  onChange={e => setForm(f => ({ ...f, next_talk_topic: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  标签
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        form.tags.includes(tag)
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {form.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-pink-50 text-pink-700 border-pink-200 flex items-center gap-1"
                    >
                      {tag}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-xs"
                    placeholder="自定义标签"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">备注</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="记录一些关于这个客户的信息，比如家庭情况、谁管孩子学习、预算多少..."
                  value={form.remark}
                  onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowAdd(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim() || submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
