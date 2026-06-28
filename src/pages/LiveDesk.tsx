import { useState, useEffect, useRef } from 'react';
import {
  Search, Copy, Check, MessageCircle, ShoppingBag,
  Lightbulb, X, Send, Star, Clock, Loader2, Mic2, Baby,
} from 'lucide-react';
import { useStore } from '@/store';
import { IMPORTANCE_LABELS, IMPORTANCE_COLORS, ORDER_TYPE_COLORS, ORDER_TYPE_LABELS } from '../../shared/types';
import type { LiveCustomerCard } from '../../shared/types';

export default function LiveDesk() {
  const {
    liveSearchResults,
    liveSearch,
    liveQuickNote,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [quickNoteCustomer, setQuickNoteCustomer] = useState<LiveCustomerCard | null>(null);
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [quickNoteChildId, setQuickNoteChildId] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<{ [customerId: number]: number | null }>({});
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (quickNoteCustomer && noteInputRef.current) {
      setTimeout(() => noteInputRef.current?.focus(), 100);
    }
  }, [quickNoteCustomer]);

  useEffect(() => {
    const timer = setTimeout(() => {
      liveSearch(searchQuery);
    }, searchQuery.length > 0 ? 150 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const copyScript = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      console.error('复制失败:', e);
    }
  };

  const handleQuickNote = async () => {
    if (!quickNoteCustomer || !quickNoteContent.trim()) return;
    setSubmitting(true);
    try {
      await liveQuickNote(quickNoteCustomer.id, quickNoteContent, quickNoteChildId);
      await liveSearch(searchQuery);
      setQuickNoteCustomer(null);
      setQuickNoteContent('');
      setQuickNoteChildId(null);
      searchInputRef.current?.focus();
    } catch (e) {
      console.error('记录失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const AVATAR_COLORS = [
    'from-amber-400 to-orange-500',
    'from-orange-400 to-red-500',
    'from-yellow-400 to-amber-500',
    'from-rose-400 to-orange-500',
    'from-red-400 to-rose-500',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-orange-50/30 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Mic2 className="w-8 h-8 text-orange-500" />
            直播工作台
          </h1>
          <p className="text-base text-slate-500 mt-2">直播时快速搜人，看完就记得</p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl blur-lg opacity-30" />
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-amber-500" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full pl-14 pr-5 py-4 text-lg md:text-xl rounded-2xl border-2 border-amber-200 bg-white shadow-lg shadow-amber-100/50 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all"
              placeholder="输入微信名/抖音名/备注，快速找到客户"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        {!searchQuery ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-5 border-2 border-amber-200/50">
              <Search className="w-12 h-12 text-amber-400" />
            </div>
            <p className="text-lg font-semibold text-slate-600 mb-2">输入客户信息开始搜索</p>
            <p className="text-sm text-slate-400">支持微信名、抖音名、备注模糊搜索</p>
          </div>
        ) : liveSearchResults.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mx-auto mb-5 border-2 border-slate-200/50">
              <Search className="w-12 h-12 text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-500 mb-2">没找到匹配的客户</p>
            <p className="text-sm text-slate-400">换个关键词试试</p>
          </div>
        ) : (
          <div className="space-y-4">
            {liveSearchResults.map(customer => {
              const avatarColor = AVATAR_COLORS[customer.id % AVATAR_COLORS.length];
              const isVip = customer.importance === 'vip';
              return (
                <div
                  key={customer.id}
                  className={`bg-white rounded-2xl shadow-md border-2 overflow-hidden transition-all ${
                    isVip
                      ? 'border-amber-300 bg-gradient-to-br from-amber-50/30 to-white'
                      : 'border-slate-100'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shadow-lg shrink-0`}>
                        <span className="text-xl font-bold text-white">{customer.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-xl font-bold text-slate-900">
                            {customer.name}
                          </h3>
                          {isVip && <Star className="w-5 h-5 text-amber-500 fill-amber-400" />}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${IMPORTANCE_COLORS[customer.importance]}`}>
                            {IMPORTANCE_LABELS[customer.importance]}
                          </span>
                        </div>
                        {customer.nickname && (
                          <p className="text-sm text-slate-500 mb-2">{customer.nickname}</p>
                        )}
                        {customer.tags && customer.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {customer.tags.slice(0, 4).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                                {tag}
                              </span>
                            ))}
                            {customer.tags.length > 4 && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">
                                +{customer.tags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        {customer.children && customer.children.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Baby className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs text-slate-500 font-medium">孩子：</span>
                            {customer.children.map(child => {
                              const isSelected = selectedChildId[customer.id] === child.id;
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => setSelectedChildId(prev => ({
                                    ...prev,
                                    [customer.id]: isSelected ? null : child.id
                                  }))}
                                  className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                                    isSelected
                                      ? 'bg-sky-500 text-white shadow-sm'
                                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                                  }`}
                                >
                                  {child.nickname} · {child.grade}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-orange-600">¥{customer.total_spent?.toLocaleString() || 0}</div>
                        <div className="text-xs text-slate-400">{customer.order_count || 0}单</div>
                      </div>
                    </div>

                    {customer.recent_orders && customer.recent_orders.length > 0 && (
                      <div className="mb-4 p-4 bg-orange-50/50 rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <ShoppingBag className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-bold text-slate-700">买过</span>
                        </div>
                        <div className="space-y-2">
                          {customer.recent_orders.slice(0, 3).map((order, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-slate-700 truncate">{order.product_name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold text-orange-600">¥{order.amount}</span>
                                <span className="text-xs text-slate-400">{formatDate(order.purchase_date)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {customer.recent_follow_up && (
                      <div className="mb-4 p-4 bg-blue-50/50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageCircle className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-slate-700">上次聊</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(customer.recent_follow_up.date)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 bg-white rounded-lg px-3 py-2">
                          {customer.recent_follow_up.content}
                        </p>
                      </div>
                    )}

                    {customer.suggestions && customer.suggestions.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-slate-700">可以推</span>
                        </div>
                        <div className="space-y-2">
                          {customer.suggestions.map((suggestion, idx) => {
                            const key = `${customer.id}-${idx}`;
                            return (
                              <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-sm font-semibold text-slate-800">{suggestion.title}</span>
                                  <button
                                    onClick={() => copyScript(suggestion.script, key)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      copiedIndex === key
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-200'
                                    }`}
                                  >
                                    {copiedIndex === key ? (
                                      <><Check className="w-3.5 h-3.5" /> 已复制</>
                                    ) : (
                                      <><Copy className="w-3.5 h-3.5" /> 复制话术</>
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed bg-white rounded-lg px-3 py-2">
                                  {suggestion.script}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setQuickNoteCustomer(customer);
                        setQuickNoteContent('');
                        setQuickNoteChildId(selectedChildId[customer.id] ?? null);
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-base shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <MessageCircle className="w-5 h-5" />
                      快速记一句
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {quickNoteCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => { if (!submitting) { setQuickNoteCustomer(null); setQuickNoteChildId(null); } }}>
          <div
            className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[quickNoteCustomer.id % AVATAR_COLORS.length]} flex items-center justify-center shadow`}>
                    <span className="text-base font-bold text-white">{quickNoteCustomer.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">快速记一句</h3>
                    <p className="text-xs text-slate-500">给 {quickNoteCustomer.name} 记一条直播笔记</p>
                  </div>
                </div>
                <button
                  onClick={() => { setQuickNoteCustomer(null); setQuickNoteChildId(null); }}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                ref={noteInputRef}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 outline-none transition-all text-base resize-none"
                rows={4}
                placeholder="快速记录，比如：问了XX产品、想要套装、对价格敏感..."
                value={quickNoteContent}
                onChange={e => setQuickNoteContent(e.target.value)}
              />
              {quickNoteCustomer.children && quickNoteCustomer.children.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block flex items-center gap-1">
                    <Baby className="w-3.5 h-3.5 text-emerald-500" />
                    关联孩子
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm bg-white"
                    value={quickNoteChildId ?? ''}
                    onChange={e => setQuickNoteChildId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">不关联</option>
                    {quickNoteCustomer.children.map(child => (
                      <option key={child.id} value={child.id}>{child.nickname}（{child.grade}）</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-5 pt-0">
              <button
                onClick={handleQuickNote}
                disabled={!quickNoteContent.trim() || submitting}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> 保存中...</>
                ) : (
                  <><Send className="w-5 h-5" /> 保存笔记</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
