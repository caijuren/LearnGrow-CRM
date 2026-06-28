import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, X, Phone, MessageCircle,
  FileText, ShoppingBag, Lightbulb, Copy, Check, Clock,
  Tag, Radio, Users, Calendar, Loader2, ChevronRight,
  Star, ShoppingCart, User, Plus, Baby, AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  SOURCE_LABELS, IMPORTANCE_LABELS, IMPORTANCE_COLORS, COMMON_TAGS,
  ORDER_TYPE_LABELS, ORDER_TYPE_COLORS, FOLLOW_UP_METHOD_LABELS, FOLLOW_UP_RESULT_LABELS,
  GRADES, GENDERS, SUBJECTS,
  type Importance, type CustomerSource, type FollowUpMethod, type FollowUpResult,
  type OrderType, type Child,
} from '../../shared/types';
import Empty from '@/components/Empty';

const AVATAR_COLORS = [
  'from-rose-400 to-pink-500',
  'from-pink-400 to-fuchsia-500',
  'from-fuchsia-400 to-purple-500',
  'from-purple-400 to-violet-500',
  'from-violet-400 to-indigo-500',
];

const METHOD_ICONS: Record<FollowUpMethod, typeof MessageCircle> = {
  wechat: MessageCircle,
  phone: Phone,
  group: Users,
  live: Radio,
  moments: Users,
};

const SUGGESTION_COLORS = [
  { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'bg-rose-100 text-rose-600', badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-100 text-blue-600', badge: 'bg-blue-100 text-blue-700' },
];

interface FollowUpForm {
  method: FollowUpMethod | '';
  content: string;
  result: FollowUpResult | '';
  next_follow_date: string;
  child_id: string;
}

interface OrderForm {
  product_id: string;
  amount: string;
  order_type: OrderType | '';
  remark: string;
  child_id: string;
}

interface EditForm {
  name: string;
  nickname: string;
  phone: string;
  douyin_nickname: string;
  source: CustomerSource | '';
  importance: Importance;
  tags: string[];
  remark: string;
}

interface ChildForm {
  nickname: string;
  gender: 'boy' | 'girl' | '';
  birth_date: string;
  grade: string;
  region: string;
  textbook_version: string;
  weak_subjects: string[];
  notes: string;
  custom_subject: string;
}

const emptyFollowUpForm: FollowUpForm = {
  method: '',
  content: '',
  result: '',
  next_follow_date: '',
  child_id: '',
};

const emptyOrderForm: OrderForm = {
  product_id: '',
  amount: '',
  order_type: '',
  remark: '',
  child_id: '',
};

const emptyChildForm: ChildForm = {
  nickname: '',
  gender: '',
  birth_date: '',
  grade: '',
  region: '',
  textbook_version: '',
  weak_subjects: [],
  notes: '',
  custom_subject: '',
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedCustomer: customer,
    loading,
    allProducts,
    textbooks,
    textbookRegions,
    loadCustomer,
    loadProducts,
    loadTextbooks,
    loadTextbookRegions,
    editCustomer,
    removeCustomer,
    addFollowUp,
    removeFollowUp,
    addOrder,
    removeOrder,
    addChild,
    editChild,
    clearSelectedCustomer,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'followups'>(
    (searchParams.get('tab') as 'orders' | 'followups') || 'orders'
  );
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>(emptyFollowUpForm);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', nickname: '', phone: '', douyin_nickname: '',
    source: '', importance: 'normal', tags: [], remark: '',
  });
  const [customTag, setCustomTag] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [childForm, setChildForm] = useState<ChildForm>(emptyChildForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'order' | 'followup'; id: number } | null>(null);

  useEffect(() => {
    if (id) {
      loadCustomer(Number(id));
      loadProducts({ limit: 100 });
    }
    return () => clearSelectedCustomer();
  }, [id]);

  useEffect(() => {
    if (customer) {
      setEditForm({
        name: customer.name,
        nickname: customer.nickname || '',
        phone: customer.phone || '',
        douyin_nickname: customer.douyin_nickname || '',
        source: customer.source || '',
        importance: customer.importance,
        tags: customer.tags || [],
        remark: customer.remark || '',
      });
    }
  }, [customer]);

  useEffect(() => {
    if (orderForm.product_id && allProducts.length > 0) {
      const product = allProducts.find(p => p.id === Number(orderForm.product_id));
      if (product) {
        setOrderForm(f => ({ ...f, amount: String(product.price) }));
        if (!orderForm.order_type && customer) {
          const orderType: OrderType = customer.order_count === 0 ? 'first' : 'repurchase';
          setOrderForm(f => ({ ...f, order_type: orderType }));
        }
      }
    }
  }, [orderForm.product_id, allProducts, customer?.order_count, orderForm.order_type]);

  useEffect(() => {
    loadTextbookRegions();
  }, []);

  useEffect(() => {
    if (childForm.region) {
      loadTextbooks({ region: childForm.region });
      setChildForm(f => ({ ...f, textbook_version: '' }));
    }
  }, [childForm.region]);

  const copyScript = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      console.error('复制失败:', e);
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const addEditCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setCustomTag('');
    }
  };

  const handleAddFollowUp = async () => {
    if (!followUpForm.method || !followUpForm.content.trim() || !id) return;
    setSubmitting(true);
    try {
      await addFollowUp(Number(id), {
        method: followUpForm.method as FollowUpMethod,
        content: followUpForm.content,
        result: followUpForm.result || null,
        next_follow_date: followUpForm.next_follow_date || null,
        is_live_note: followUpForm.method === 'live',
        child_id: followUpForm.child_id ? Number(followUpForm.child_id) : null,
      });
      setShowFollowUp(false);
      setFollowUpForm(emptyFollowUpForm);
    } catch (e) {
      console.error('添加跟进失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddOrder = async () => {
    if (!orderForm.product_id || !orderForm.amount || !id) return;
    setSubmitting(true);
    try {
      await addOrder(Number(id), {
        product_id: Number(orderForm.product_id),
        amount: Number(orderForm.amount),
        order_type: orderForm.order_type || (customer?.order_count === 0 ? 'first' : 'repurchase'),
        remark: orderForm.remark || null,
        child_id: orderForm.child_id ? Number(orderForm.child_id) : null,
      });
      setShowOrder(false);
      setOrderForm(emptyOrderForm);
    } catch (e) {
      console.error('添加订单失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editForm.name.trim() || !id) return;
    setSubmitting(true);
    try {
      await editCustomer(Number(id), {
        name: editForm.name,
        nickname: editForm.nickname || null,
        phone: editForm.phone || null,
        douyin_nickname: editForm.douyin_nickname || null,
        source: editForm.source || null,
        importance: editForm.importance,
        tags: editForm.tags,
        remark: editForm.remark || null,
      });
      setShowEdit(false);
    } catch (e) {
      console.error('编辑客户失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await removeCustomer(Number(id));
      navigate('/customers');
    } catch (e) {
      console.error('删除客户失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const openAddChild = () => {
    setEditingChild(null);
    setChildForm(emptyChildForm);
    setShowAddChild(true);
  };

  const openEditChild = (child: Child) => {
    setEditingChild(child);
    setChildForm({
      nickname: child.nickname,
      gender: child.gender || '',
      birth_date: child.birth_date || '',
      grade: child.grade,
      region: child.region || '',
      textbook_version: child.textbook_version || '',
      weak_subjects: child.weak_subjects || [],
      notes: child.notes || '',
      custom_subject: '',
    });
    if (child.region) {
      loadTextbooks({ region: child.region });
    }
    setShowAddChild(true);
  };

  const toggleWeakSubject = (subject: string) => {
    setChildForm(prev => ({
      ...prev,
      weak_subjects: prev.weak_subjects.includes(subject)
        ? prev.weak_subjects.filter(s => s !== subject)
        : [...prev.weak_subjects, subject],
    }));
  };

  const addCustomSubject = () => {
    const subject = childForm.custom_subject.trim();
    if (subject && !childForm.weak_subjects.includes(subject)) {
      setChildForm(prev => ({ ...prev, weak_subjects: [...prev.weak_subjects, subject], custom_subject: '' }));
    }
  };

  const handleSaveChild = async () => {
    if (!childForm.nickname.trim() || !childForm.grade || !id) return;
    setSubmitting(true);
    try {
      const data = {
        nickname: childForm.nickname.trim(),
        gender: childForm.gender || null,
        birth_date: childForm.birth_date || null,
        grade: childForm.grade,
        region: childForm.region || null,
        textbook_version: childForm.textbook_version || null,
        weak_subjects: childForm.weak_subjects,
        notes: childForm.notes || null,
      };
      if (editingChild) {
        await editChild(editingChild.id, data);
      } else {
        await addChild({ ...data, customer_id: Number(id) });
      }
      setShowAddChild(false);
      setChildForm(emptyChildForm);
      setEditingChild(null);
    } catch (e) {
      console.error('保存孩子失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading && !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-rose-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/customers')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md flex items-center justify-center mb-6 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <Empty
            icon={<User className="w-10 h-10 text-rose-300" />}
            title="客户不存在"
            description="该客户可能已被删除"
            action={
              <button
                onClick={() => navigate('/customers')}
                className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                返回客户列表
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const avatarColor = AVATAR_COLORS[customer.id % AVATAR_COLORS.length];
  const sortedFollowUps = [...(customer.follow_ups || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const sortedOrders = [...(customer.orders || [])].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customers')}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${IMPORTANCE_COLORS[customer.importance]}`}>
                  {IMPORTANCE_LABELS[customer.importance]}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">客户详情</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md hover:bg-rose-50 flex items-center justify-center transition-all text-slate-600 hover:text-rose-600"
              title="编辑"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md hover:bg-red-50 flex items-center justify-center transition-all text-slate-600 hover:text-red-600"
              title="删除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center shadow-lg shrink-0`}>
              <span className="text-2xl font-bold text-white">{customer.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${IMPORTANCE_COLORS[customer.importance]}`}>
                  {IMPORTANCE_LABELS[customer.importance]}
                </span>
                {customer.source && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    {SOURCE_LABELS[customer.source]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                {customer.nickname && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {customer.nickname}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {customer.phone}
                  </span>
                )}
                {customer.douyin_nickname && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    {customer.douyin_nickname}
                  </span>
                )}
              </div>
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {customer.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {customer.remark && (
                <p className="text-sm text-slate-600 mt-3 p-3 bg-slate-50 rounded-xl">
                  {customer.remark}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="text-center p-3 bg-rose-50/50 rounded-xl">
              <div className="text-xl font-bold text-rose-600">¥{customer.total_spent?.toLocaleString() || 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">累计消费</div>
            </div>
            <div className="text-center p-3 bg-pink-50/50 rounded-xl">
              <div className="text-xl font-bold text-pink-600">{customer.order_count || 0}</div>
              <div className="text-xs text-slate-500 mt-0.5">订单数</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setShowFollowUp(true)}
            className="bg-white hover:bg-rose-50 border-2 border-rose-100 hover:border-rose-200 rounded-2xl p-4 flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-md shadow-rose-200 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-800">记跟进</div>
              <div className="text-xs text-slate-500">记录沟通内容</div>
            </div>
          </button>
          <button
            onClick={() => setShowOrder(true)}
            className="bg-white hover:bg-amber-50 border-2 border-amber-100 hover:border-amber-200 rounded-2xl p-4 flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-slate-800">记订单</div>
              <div className="text-xs text-slate-500">记录购买</div>
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Baby className="w-4 h-4 text-emerald-500" />
              孩子
            </h3>
            <button
              onClick={openAddChild}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              添加孩子
            </button>
          </div>
          {customer.children && customer.children.length > 0 ? (
            <div className="space-y-3">
              {customer.children.map(child => {
                const childAvatarColor = AVATAR_COLORS[child.id % AVATAR_COLORS.length];
                const childEmoji = child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒';
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/customers/${customer.id}/children/${child.id}`)}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${childAvatarColor} flex items-center justify-center shadow-md shrink-0 text-xl relative`}>
                      <span>{childEmoji}</span>
                      <span className="absolute -bottom-1 -right-1 bg-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold text-slate-700 shadow-sm border border-slate-200">
                        {child.nickname[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{child.nickname}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          {child.grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        {child.region && <span>{child.region}</span>}
                        {child.textbook_version && <span>· {child.textbook_version}</span>}
                      </div>
                      {child.weak_subjects && child.weak_subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {child.weak_subjects.map(subject => (
                            <span key={subject} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-medium">
                              {subject}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openEditChild(child); }}
                      className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Baby className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">还没添加孩子信息</p>
            </div>
          )}
        </div>

        {customer.suggestions && customer.suggestions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              可以推什么
            </h3>
            <div className="space-y-3">
              {customer.suggestions.map((suggestion, index) => {
                const color = SUGGESTION_COLORS[index % SUGGESTION_COLORS.length];
                return (
                  <div key={index} className={`${color.bg} border ${color.border} rounded-2xl p-4`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${color.icon} flex items-center justify-center shrink-0`}>
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{suggestion.title}</span>
                          {suggestion.product && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${color.badge}`}>
                              {suggestion.product.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{suggestion.reason}</p>
                        <div className="bg-white/70 rounded-xl p-3 relative group">
                          <p className="text-xs text-slate-700 leading-relaxed pr-8">{suggestion.script}</p>
                          <button
                            onClick={() => copyScript(suggestion.script, index)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white shadow-sm hover:shadow flex items-center justify-center transition-all"
                          >
                            {copiedIndex === index ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => { setActiveTab('orders'); setSearchParams({ tab: 'orders' }); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              买过啥
              {sortedOrders.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'orders' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sortedOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('followups'); setSearchParams({ tab: 'followups' }); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'followups'
                  ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              聊过啥
              {sortedFollowUps.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'followups' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sortedFollowUps.length}
                </span>
              )}
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'orders' ? (
              sortedOrders.length > 0 ? (
                <div className="space-y-3">
                  {sortedOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{order.product_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ORDER_TYPE_COLORS[order.order_type]}`}>
                              {ORDER_TYPE_LABELS[order.order_type]}
                            </span>
                            {order.child_name && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-700">
                                给{order.child_name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.purchase_date)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-base font-bold text-slate-900">¥{order.amount?.toLocaleString()}</div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'order', id: order.id })}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title="删除订单"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<ShoppingCart className="w-8 h-8 text-slate-300" />}
                  title="暂无订单记录"
                  description="还没有记录过订单"
                />
              )
            ) : (
              sortedFollowUps.length > 0 ? (
                <div className="relative pl-10">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-rose-200 via-pink-200 to-transparent" />
                  {sortedFollowUps.map((followUp, index) => {
                    const Icon = METHOD_ICONS[followUp.method];
                    const isLive = followUp.is_live_note || followUp.method === 'live';
                    return (
                      <div key={followUp.id} className="relative mb-5 last:mb-0">
                        <div className={`absolute -left-10 top-1 w-8 h-8 rounded-full ${
                          isLive ? 'bg-gradient-to-br from-rose-400 to-pink-500' : 'bg-gradient-to-br from-slate-200 to-slate-300'
                        } border-4 border-white shadow-md flex items-center justify-center z-10`}>
                          <Icon className={`w-4 h-4 ${isLive ? 'text-white' : 'text-slate-600'}`} />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 group relative">
                          <button
                            onClick={() => setDeleteConfirm({ type: 'followup', id: followUp.id })}
                            className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                            title="删除跟进"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              isLive ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {isLive && <Radio className="w-3 h-3 inline mr-0.5" />}
                              {FOLLOW_UP_METHOD_LABELS[followUp.method]}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(followUp.date)}</span>
                            {followUp.result && (
                              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                followUp.result === 'closed' ? 'bg-emerald-100 text-emerald-700' :
                                followUp.result === 'considering' ? 'bg-sky-100 text-sky-700' :
                                followUp.result === 'no_need' ? 'bg-slate-100 text-slate-600' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {FOLLOW_UP_RESULT_LABELS[followUp.result]}
                              </span>
                            )}
                            {followUp.next_follow_date && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                                <Clock className="w-3 h-3" />
                                下次: {formatDate(followUp.next_follow_date)}
                              </span>
                            )}
                            {followUp.child_name && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-sky-100 text-sky-700">
                                给{followUp.child_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{followUp.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={<MessageCircle className="w-8 h-8 text-slate-300" />}
                  title="暂无跟进记录"
                  description="记录与客户的每一次沟通"
                />
              )
            )}
          </div>
        </div>
      </div>

      {showFollowUp && (
        <Modal title="记跟进" onClose={() => setShowFollowUp(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">跟进方式 *</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.entries(FOLLOW_UP_METHOD_LABELS) as [FollowUpMethod, string][]).map(([method, label]) => {
                  const Icon = METHOD_ICONS[method];
                  return (
                    <button
                      key={method}
                      onClick={() => setFollowUpForm(f => ({ ...f, method }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                        followUpForm.method === method
                          ? 'border-rose-300 bg-rose-50 text-rose-600'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">跟进内容 *</label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm resize-none"
                rows={4}
                placeholder="记录沟通内容..."
                value={followUpForm.content}
                onChange={e => setFollowUpForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">跟进结果</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                  value={followUpForm.result}
                  onChange={e => setFollowUpForm(f => ({ ...f, result: e.target.value as FollowUpResult | '' }))}
                >
                  <option value="">请选择</option>
                  {Object.entries(FOLLOW_UP_RESULT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">下次跟进日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  value={followUpForm.next_follow_date}
                  onChange={e => setFollowUpForm(f => ({ ...f, next_follow_date: e.target.value }))}
                />
              </div>
            </div>
            {customer.children && customer.children.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">关联孩子</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                  value={followUpForm.child_id}
                  onChange={e => setFollowUpForm(f => ({ ...f, child_id: e.target.value }))}
                >
                  <option value="">不关联</option>
                  {customer.children.map(child => (
                    <option key={child.id} value={child.id}>{child.nickname}（{child.grade}）</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 mt-5">
            <button
              onClick={() => setShowFollowUp(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddFollowUp}
              disabled={!followUpForm.method || !followUpForm.content.trim() || submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </Modal>
      )}

      {showOrder && (
        <Modal title="记订单" onClose={() => setShowOrder(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">选择产品 *</label>
              <select
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                value={orderForm.product_id}
                onChange={e => setOrderForm(f => ({ ...f, product_id: e.target.value }))}
              >
                <option value="">请选择产品</option>
                {allProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - ¥{p.price}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">金额 *</label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  placeholder="订单金额"
                  value={orderForm.amount}
                  onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">订单类型</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                  value={orderForm.order_type}
                  onChange={e => setOrderForm(f => ({ ...f, order_type: e.target.value as OrderType | '' }))}
                >
                  <option value="">自动判断</option>
                  {Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">备注</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                placeholder="订单备注（选填）"
                value={orderForm.remark}
                onChange={e => setOrderForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
            {customer.children && customer.children.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">为哪个孩子购买</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                  value={orderForm.child_id}
                  onChange={e => setOrderForm(f => ({ ...f, child_id: e.target.value }))}
                >
                  <option value="">不指定</option>
                  {customer.children.map(child => (
                    <option key={child.id} value={child.id}>{child.nickname}（{child.grade}）</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 mt-5">
            <button
              onClick={() => setShowOrder(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddOrder}
              disabled={!orderForm.product_id || !orderForm.amount || submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="编辑客户" onClose={() => setShowEdit(false)}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">备注名 *</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">微信名</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  value={editForm.nickname}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">手机号</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">抖音昵称</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                value={editForm.douyin_nickname}
                onChange={e => setEditForm(f => ({ ...f, douyin_nickname: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">来源</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                  value={editForm.source}
                  onChange={e => setEditForm(f => ({ ...f, source: e.target.value as CustomerSource | '' }))}
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
                  value={editForm.importance}
                  onChange={e => setEditForm(f => ({ ...f, importance: e.target.value as Importance }))}
                >
                  {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
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
                    onClick={() => toggleEditTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      editForm.tags.includes(tag)
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {editForm.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEditTag(tag)}
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
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditCustomTag())}
                />
                <button
                  type="button"
                  onClick={addEditCustomTag}
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
                value={editForm.remark}
                onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 mt-5">
            <button
              onClick={() => setShowEdit(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleEdit}
              disabled={!editForm.name.trim() || submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </Modal>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowDelete(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除客户？</h3>
              <p className="text-sm text-slate-500 mb-1">
                即将删除客户 <span className="font-semibold text-slate-700">{customer.name}</span>
              </p>
              <p className="text-xs text-red-500">此操作不可撤销</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowDelete(false)}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                确认删除{deleteConfirm.type === 'order' ? '订单' : '跟进记录'}？
              </h3>
              <p className="text-sm text-slate-500">此操作不可撤销</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!deleteConfirm || !customer || !id) return;
                  setSubmitting(true);
                  try {
                    if (deleteConfirm.type === 'order') {
                      await removeOrder(deleteConfirm.id);
                    } else {
                      await removeFollowUp(deleteConfirm.id, customer.id);
                    }
                    await loadCustomer(Number(id));
                    setDeleteConfirm(null);
                  } catch (e) {
                    console.error('删除失败:', e);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex-1 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddChild && (
        <Modal title={editingChild ? '编辑孩子' : '添加孩子'} onClose={() => { if (!submitting) { setShowAddChild(false); setChildForm(emptyChildForm); setEditingChild(null); } }}>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">昵称 *</label>
              <input
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                placeholder="孩子昵称"
                value={childForm.nickname}
                onChange={e => setChildForm(f => ({ ...f, nickname: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">性别</label>
              <div className="grid grid-cols-2 gap-2">
                {(['boy', 'girl'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setChildForm(f => ({ ...f, gender: g }))}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                      childForm.gender === g
                        ? g === 'boy' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-pink-300 bg-pink-50 text-pink-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-lg">{g === 'boy' ? '👦' : '👧'}</span>
                    {GENDERS[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">年级 *</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white"
                  value={childForm.grade}
                  onChange={e => setChildForm(f => ({ ...f, grade: e.target.value }))}
                >
                  <option value="">请选择</option>
                  {GRADES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">出生日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  value={childForm.birth_date}
                  onChange={e => setChildForm(f => ({ ...f, birth_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">地区</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white"
                  value={childForm.region}
                  onChange={e => setChildForm(f => ({ ...f, region: e.target.value }))}
                >
                  <option value="">请选择</option>
                  {textbookRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">教材版本</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  placeholder="如：人教PEP版"
                  value={childForm.textbook_version}
                  onChange={e => setChildForm(f => ({ ...f, textbook_version: e.target.value }))}
                  list="textbook-versions"
                />
                <datalist id="textbook-versions">
                  {[...new Set(textbooks.filter(t => t.subject === '英语').map(t => t.version))].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">薄弱科目</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {SUBJECTS.map(subject => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleWeakSubject(subject)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      childForm.weak_subjects.includes(subject)
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {subject}
                  </button>
                ))}
                {childForm.weak_subjects.filter(s => !SUBJECTS.includes(s)).map(subject => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleWeakSubject(subject)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1"
                  >
                    {subject}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-xs"
                  placeholder="自定义科目"
                  value={childForm.custom_subject}
                  onChange={e => setChildForm(f => ({ ...f, custom_subject: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSubject())}
                />
                <button
                  type="button"
                  onClick={addCustomSubject}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">备注</label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm resize-none"
                rows={3}
                placeholder="其他备注信息（选填）"
                value={childForm.notes}
                onChange={e => setChildForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 mt-5">
            <button
              onClick={() => { setShowAddChild(false); setChildForm(emptyChildForm); setEditingChild(null); }}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveChild}
              disabled={!childForm.nickname.trim() || !childForm.grade || submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
