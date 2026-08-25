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
  STAGE_LABELS, STAGE_COLORS, WECHAT_ACCOUNT_LABELS,
  GRADES, GENDERS, SUBJECTS,
  type Importance, type CustomerSource, type FollowUpMethod, type FollowUpResult,
  type OrderType, type Child, type CustomerStage, type WechatAccount,
} from '../../shared/types';
import Empty from '@/components/Empty';
import SharedModal from '@/components/Modal';

const AVATAR_COLORS = [
  'bg-brand-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-slate-500',
];

const METHOD_ICONS: Record<FollowUpMethod, typeof MessageCircle> = {
  wechat: MessageCircle,
  phone: Phone,
  group: Users,
  live: Radio,
  moments: Users,
};

const SUGGESTION_COLORS = [
  { bg: 'bg-brand-50', border: 'border-brand-200', icon: 'bg-brand-100 text-brand-600', badge: 'bg-brand-100 text-brand-700' },
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
    name: '', nickname: '', phone: '', wechat_id: '', wechat_remark: '',
    wechat_add_date: '', wechat_account: 'main', douyin_nickname: '',
    source: '', importance: 'normal', stage: 'new_friend', tags: [], remark: '',
    next_talk_topic: '',
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
        wechat_id: customer.wechat_id || '',
        wechat_remark: customer.wechat_remark || '',
        wechat_add_date: customer.wechat_add_date || '',
        wechat_account: customer.wechat_account || 'main',
        douyin_nickname: customer.douyin_nickname || '',
        source: customer.source || '',
        importance: customer.importance,
        stage: customer.stage || 'new_friend',
        tags: customer.tags || [],
        remark: customer.remark || '',
        next_talk_topic: customer.next_talk_topic || '',
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
        wechat_id: editForm.wechat_id || null,
        wechat_remark: editForm.wechat_remark || null,
        wechat_add_date: editForm.wechat_add_date || null,
        wechat_account: editForm.wechat_account,
        douyin_nickname: editForm.douyin_nickname || null,
        source: editForm.source || null,
        importance: editForm.importance,
        stage: editForm.stage,
        tags: editForm.tags,
        remark: editForm.remark || null,
        next_talk_topic: editForm.next_talk_topic || null,
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page-shell page-enter">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/customers')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md flex items-center justify-center mb-6 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <Empty
            icon={<User className="w-10 h-10 text-brand-300" />}
            title="客户不存在"
            description="该客户可能已被删除"
            action={
              <button
                onClick={() => navigate('/customers')}
                className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm"
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
    <div className="page-shell page-enter">
      <div className="max-w-5xl mx-auto">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-1.5 mb-4 t-caption">
          <button onClick={() => navigate('/customers')}
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  className="transition-colors">
            客户管理
          </button>
          <ChevronRight size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
          <span className="t-body-strong" style={{ color: 'var(--color-text-primary)' }}>客户详情</span>
        </div>

        {/* 客户信息卡 */}
        <div className="panel mb-4">
          <div className="px-5 py-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                   style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
                <span className="text-lg font-semibold">{customer.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h2 className="t-title">{customer.name}</h2>
                  <span className={`badge ${
                    customer.stage === 'purchased' || customer.stage === 'repurchased' ? 'badge-success' :
                    customer.stage === 'interested' ? 'badge-warning' :
                    customer.stage === 'in_group' ? 'badge-primary' : 'badge-neutral'
                  }`}>
                    {STAGE_LABELS[customer.stage]}
                  </span>
                  <span className={`badge ${
                    customer.importance === 'vip' ? 'badge-warning' :
                    customer.importance === 'watch' ? 'badge-neutral' : 'badge-success'
                  }`}>
                    {IMPORTANCE_LABELS[customer.importance]}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-wrap t-small" style={{ color: 'var(--color-text-secondary)' }}>
                  {customer.wechat_id && (
                    <span className="flex items-center gap-1.5">
                      <MessageCircle size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span style={{ color: 'var(--color-text-primary)' }}>{customer.wechat_id}</span>
                      {customer.wechat_remark && <span style={{ color: 'var(--color-text-tertiary)' }}>({customer.wechat_remark})</span>}
                    </span>
                  )}
                  {customer.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span style={{ color: 'var(--color-text-primary)' }}>{customer.phone}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                    {WECHAT_ACCOUNT_LABELS[customer.wechat_account]}
                  </span>
                  {customer.source && (
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      {SOURCE_LABELS[customer.source]}
                    </span>
                  )}
                  {customer.wechat_add_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                      {customer.wechat_add_date} 添加
                    </span>
                  )}
                </div>
              </div>
              {/* 关键指标 */}
              <div className="hidden sm:flex items-center gap-6 shrink-0 pl-5"
                   style={{ borderLeft: '1px solid var(--color-border-subtle)' }}>
                <div className="text-center">
                  <div className="t-kpi">¥{customer.total_spent?.toLocaleString() || 0}</div>
                  <div className="t-caption mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>累计消费</div>
                </div>
                <div className="text-center">
                  <div className="t-kpi">{customer.order_count || 0}</div>
                  <div className="t-caption mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>订单数</div>
                </div>
              </div>
            </div>

            {/* 标签 & 备注 */}
            {(customer.tags?.length > 0 || customer.remark || customer.next_talk_topic) && (
              <div className="mt-4 pt-4 space-y-2.5"
                   style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                {customer.next_talk_topic && (
                  <div className="flex items-start gap-2">
                    <Lightbulb size={14} strokeWidth={1.8} style={{ color: 'var(--color-warning)', marginTop: '2px' }} className="shrink-0" />
                    <div className="t-small">
                      <span className="t-body-strong">下次跟进话题：</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{customer.next_talk_topic}</span>
                    </div>
                  </div>
                )}
                {customer.tags && customer.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag size={14} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)', marginTop: '2px' }} className="shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                      {customer.tags.map(tag => (
                        <span key={tag} className="chip chip-outline">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {customer.remark && (
                  <div className="flex items-start gap-2">
                    <FileText size={14} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)', marginTop: '2px' }} className="shrink-0" />
                    <p className="t-small flex-1" style={{ color: 'var(--color-text-secondary)' }}>{customer.remark}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 操作栏 */}
          <div className="px-5 py-3 border-t flex items-center justify-between"
               style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-subtle)' }}>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowFollowUp(true)} className="btn-primary btn-sm">
                <FileText size={14} strokeWidth={1.8} />
                记录跟进
              </button>
              <button onClick={() => setShowOrder(true)} className="btn-secondary btn-sm">
                <ShoppingBag size={14} strokeWidth={1.8} />
                记录订单
              </button>
              <button onClick={() => setShowEdit(true)} className="btn-ghost btn-sm">
                <Edit2 size={14} strokeWidth={1.8} />
                编辑资料
              </button>
              <button
                onClick={() => {
                  setEditForm(f => ({ ...f, stage: customer.stage }));
                  setShowEdit(true);
                }}
                className="btn-ghost btn-sm"
              >
                <ChevronRight size={14} strokeWidth={1.8} />
                推进阶段
              </button>
            </div>
            <button
              onClick={() => setShowDelete(true)}
              className="btn-ghost btn-sm"
              style={{ color: 'var(--color-danger)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-danger-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <Trash2 size={14} strokeWidth={1.8} />
              删除
            </button>
          </div>
        </div>

        {/* 移动端关键指标 */}
        <div className="sm:hidden grid grid-cols-2 gap-3 mb-4">
          <div className="panel py-3 px-4 text-center">
            <p className="t-caption mb-1" style={{ color: 'var(--color-text-tertiary)' }}>累计消费</p>
            <p className="t-kpi">¥{customer.total_spent?.toLocaleString() || 0}</p>
          </div>
          <div className="panel py-3 px-4 text-center">
            <p className="t-caption mb-1" style={{ color: 'var(--color-text-tertiary)' }}>订单数</p>
            <p className="t-kpi">{customer.order_count || 0}</p>
          </div>
        </div>

        <div className="panel mb-4">
          <div className="px-5 py-4 border-b flex items-center justify-between"
               style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="panel-title">
              <Baby size={15} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
              孩子
            </h3>
            <button
              onClick={openAddChild}
              className="btn-secondary btn-sm"
            >
              <Plus size={13} strokeWidth={1.8} />
              添加孩子
            </button>
          </div>
          <div className="px-5 py-4">
          {customer.children && customer.children.length > 0 ? (
            <div className="space-y-3">
              {customer.children.map(child => {
                const childEmoji = child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒';
                return (
                  <div
                    key={child.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer group"
                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    onClick={() => navigate(`/customers/${customer.id}/children/${child.id}`)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 relative"
                         style={{ backgroundColor: 'var(--color-primary-soft)' }}>
                      <span className="text-xl">{childEmoji}</span>
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{
                              backgroundColor: 'var(--color-bg-surface)',
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border-subtle)',
                            }}>
                        {child.nickname[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="t-body-strong">{child.nickname}</span>
                        <span className="badge badge-success">
                          {child.grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                        {child.region && <span>{child.region}</span>}
                        {child.textbook_version && <span>· {child.textbook_version}</span>}
                      </div>
                      {child.weak_subjects && child.weak_subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {child.weak_subjects.map(subject => (
                            <span key={subject} className="chip chip-outline">{subject}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openEditChild(child); }}
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 btn-icon-sm"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                    >
                      <Edit2 size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                <Baby size={20} strokeWidth={1.5} />
              </div>
              <p className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>还没添加孩子信息</p>
            </div>
          )}
          </div>
        </div>

        {customer.suggestions && customer.suggestions.length > 0 && (
          <div className="mb-4">
            <h3 className="panel-title mb-3 flex items-center gap-2">
              <Lightbulb size={15} strokeWidth={1.8} style={{ color: 'var(--color-warning)' }} />
              可以推什么
            </h3>
            <div className="space-y-3">
              {customer.suggestions.map((suggestion, index) => {
                const bgColors = [
                  { bg: 'rgb(91 92 226 / 0.06)', border: 'rgb(91 92 226 / 0.15)', icon: 'var(--color-primary-soft)', iconColor: 'var(--color-primary)' },
                  { bg: 'rgb(232 178 78 / 0.1)', border: 'rgb(232 178 78 / 0.25)', icon: 'var(--color-warning-soft)', iconColor: 'var(--color-warning-text)' },
                  { bg: 'rgb(41 167 102 / 0.08)', border: 'rgb(41 167 102 / 0.2)', icon: 'var(--color-success-soft)', iconColor: 'var(--color-success)' },
                  { bg: 'rgb(59 130 246 / 0.08)', border: 'rgb(59 130 246 / 0.2)', icon: 'rgb(59 130 246 / 0.12)', iconColor: 'rgb(37 99 235)' },
                ];
                const color = bgColors[index % bgColors.length];
                return (
                  <div key={index} className="panel p-4"
                       style={{ backgroundColor: color.bg, borderColor: color.border }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                           style={{ backgroundColor: color.icon, color: color.iconColor }}>
                        <Lightbulb size={15} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="t-body-strong">{suggestion.title}</span>
                          {suggestion.product && (
                            <span className="badge badge-primary">{suggestion.product.name}</span>
                          )}
                        </div>
                        <p className="t-caption mb-2" style={{ color: 'var(--color-text-secondary)' }}>{suggestion.reason}</p>
                        <div className="rounded-lg p-3 relative group"
                             style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                          <p className="t-small leading-relaxed pr-8" style={{ color: 'var(--color-text-primary)' }}>{suggestion.script}</p>
                          <button
                            onClick={() => copyScript(suggestion.script, index)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-all btn-icon-sm"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                          >
                            {copiedIndex === index ? (
                              <Check size={13} strokeWidth={2} style={{ color: 'var(--color-success)' }} />
                            ) : (
                              <Copy size={13} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
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

        <div className="panel overflow-hidden">
          <div className="tab-list" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
            <button
              onClick={() => { setActiveTab('orders'); setSearchParams({ tab: 'orders' }); }}
              className={`tab-item ${activeTab === 'orders' ? 'active' : ''}`}
            >
              <ShoppingCart size={14} strokeWidth={1.8} />
              订单记录
              {sortedOrders.length > 0 && (
                <span className="tab-count">{sortedOrders.length}</span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('followups'); setSearchParams({ tab: 'followups' }); }}
              className={`tab-item ${activeTab === 'followups' ? 'active' : ''}`}
            >
              <MessageCircle size={14} strokeWidth={1.8} />
              跟进记录
              {sortedFollowUps.length > 0 && (
                <span className="tab-count">{sortedFollowUps.length}</span>
              )}
            </button>
          </div>

          <div className="px-5 py-4">
            {activeTab === 'orders' ? (
              sortedOrders.length > 0 ? (
                <div className="divide-y -mx-5 -mt-4" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  {sortedOrders.map(order => (
                    <div key={order.id} className="px-5 py-3 flex items-center justify-between transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                             style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-tertiary)' }}>
                          <ShoppingBag size={14} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="t-body-strong">{order.product_name}</span>
                            <span className={`badge ${
                              order.order_type === 'first' ? 'badge-primary' :
                              order.order_type === 'repurchase' ? 'badge-success' : 'badge-warning'
                            }`}>
                              {ORDER_TYPE_LABELS[order.order_type]}
                            </span>
                            {order.child_name && (
                              <span className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>· {order.child_name}</span>
                            )}
                          </div>
                          <div className="t-caption mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                            <Calendar size={11} strokeWidth={1.8} />
                            {formatDate(order.purchase_date)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="t-kpi-sm">¥{order.amount?.toLocaleString()}</span>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'order', id: order.id })}
                          className="p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 btn-icon-sm"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                          title="删除订单"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<ShoppingCart size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />}
                  title="暂无订单记录"
                  description="点击上方「记录订单」添加第一笔订单"
                />
              )
            ) : (
              sortedFollowUps.length > 0 ? (
                <div className="relative pl-6 -mx-5 -mt-4">
                  <div className="absolute left-[22px] top-4 bottom-4 w-px" style={{ backgroundColor: 'var(--color-border-default)' }} />
                  {sortedFollowUps.map((followUp, index) => {
                    const Icon = METHOD_ICONS[followUp.method];
                    const isLive = followUp.is_live_note || followUp.method === 'live';
                    return (
                      <div key={followUp.id} className="relative pl-8 pr-4 py-3 last:pb-0 first:pt-4 group">
                        <div className="absolute left-3 top-3.5 w-4 h-4 rounded-full border-2 z-10"
                             style={{
                               backgroundColor: isLive ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                               borderColor: 'var(--color-bg-surface)',
                               boxShadow: `0 0 0 1px ${isLive ? 'var(--color-primary)' : 'var(--color-border-default)'}`,
                             }} />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="t-caption flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                              <Icon size={12} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
                              {isLive && <Radio size={11} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />}
                              {FOLLOW_UP_METHOD_LABELS[followUp.method]}
                            </span>
                            <span className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>· {formatDate(followUp.date)}</span>
                            {followUp.result && (
                              <>
                                <span className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                                <span className="t-small font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                  {FOLLOW_UP_RESULT_LABELS[followUp.result]}
                                </span>
                              </>
                            )}
                            {followUp.next_follow_date && (
                              <>
                                <span className="t-caption" style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                                <span className="flex items-center gap-1 t-caption" style={{ color: 'var(--color-text-tertiary)' }}>
                                  <Clock size={11} strokeWidth={1.8} />
                                  下次: {formatDate(followUp.next_follow_date)}
                                </span>
                              </>
                            )}
                            <button
                              onClick={() => setDeleteConfirm({ type: 'followup', id: followUp.id })}
                              className="ml-auto p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 btn-icon-sm"
                              style={{ color: 'var(--color-text-tertiary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
                              title="删除跟进"
                            >
                              <Trash2 size={13} strokeWidth={1.8} />
                            </button>
                          </div>
                          <p className="t-small leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>{followUp.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={<MessageCircle size={22} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />}
                  title="暂无跟进记录"
                  description="点击上方「记录跟进」开始记录沟通内容"
                />
              )
            )}
          </div>
        </div>
      </div>

      {showFollowUp && (
        <Modal
          title="记跟进"
          onClose={() => setShowFollowUp(false)}
          footer={
            <>
              <button onClick={() => setShowFollowUp(false)} className="btn-secondary">取消</button>
              <button
                onClick={handleAddFollowUp}
                disabled={!followUpForm.method || !followUpForm.content.trim() || submitting}
                className="btn-primary"
              >
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                保存
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="form-label">跟进方式 *</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.entries(FOLLOW_UP_METHOD_LABELS) as [FollowUpMethod, string][]).map(([method, label]) => {
                  const Icon = METHOD_ICONS[method];
                  const selected = followUpForm.method === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setFollowUpForm(f => ({ ...f, method }))}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all"
                      style={{
                        borderColor: selected ? 'rgb(91 92 226 / 0.4)' : 'var(--color-border-default)',
                        backgroundColor: selected ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                        color: selected ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                      }}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span style={{ fontSize: '0.6875rem', fontWeight: 500 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="form-label">跟进内容 *</label>
              <textarea
                className="input resize-none"
                style={{ minHeight: '100px', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                rows={4}
                placeholder="记录沟通内容..."
                value={followUpForm.content}
                onChange={e => setFollowUpForm(f => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">跟进结果</label>
                <select
                  className="input"
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
                <label className="form-label">下次跟进日期</label>
                <input
                  type="date"
                  className="input"
                  value={followUpForm.next_follow_date}
                  onChange={e => setFollowUpForm(f => ({ ...f, next_follow_date: e.target.value }))}
                />
              </div>
            </div>
            {customer.children && customer.children.length > 0 && (
              <div>
                <label className="form-label">关联孩子</label>
                <select
                  className="input"
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
        </Modal>
      )}

      {showOrder && (
        <Modal
          title="记订单"
          onClose={() => setShowOrder(false)}
          footer={
            <>
              <button onClick={() => setShowOrder(false)} className="btn-secondary">取消</button>
              <button
                onClick={handleAddOrder}
                disabled={!orderForm.product_id || !orderForm.amount || submitting}
                className="btn-primary"
              >
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                保存
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="form-label">选择产品 *</label>
              <select
                className="input"
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
                <label className="form-label">金额 *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="订单金额"
                  value={orderForm.amount}
                  onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">订单类型</label>
                <select
                  className="input"
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
              <label className="form-label">备注</label>
              <input
                className="input"
                placeholder="订单备注（选填）"
                value={orderForm.remark}
                onChange={e => setOrderForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
            {customer.children && customer.children.length > 0 && (
              <div>
                <label className="form-label">为哪个孩子购买</label>
                <select
                  className="input"
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
        </Modal>
      )}

      {showEdit && (
        <Modal
          title="编辑客户信息"
          onClose={() => setShowEdit(false)}
          footer={
            <>
              <button onClick={() => setShowEdit(false)} className="btn-secondary">取消</button>
              <button
                onClick={handleEdit}
                disabled={!editForm.name.trim() || submitting}
                className="btn-primary"
              >
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                保存
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 微信私域 */}
            <div
              className="p-3 rounded-lg border"
              style={{ backgroundColor: 'rgb(16 185 129 / 0.04)', borderColor: 'rgb(16 185 129 / 0.12)' }}
            >
              <div className="flex items-center gap-1.5 mb-3" style={{ color: 'rgb(5 150 105)' }}>
                <Users size={14} strokeWidth={2} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>微信私域信息</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">微信号</label>
                  <input
                    className="input"
                    value={editForm.wechat_id}
                    onChange={e => setEditForm(f => ({ ...f, wechat_id: e.target.value }))}
                    placeholder="客户微信号"
                  />
                </div>
                <div>
                  <label className="form-label">微信备注名</label>
                  <input
                    className="input"
                    value={editForm.wechat_remark}
                    onChange={e => setEditForm(f => ({ ...f, wechat_remark: e.target.value }))}
                    placeholder="你的微信备注"
                  />
                </div>
                <div>
                  <label className="form-label">添加日期</label>
                  <input
                    type="date"
                    className="input"
                    value={editForm.wechat_add_date}
                    onChange={e => setEditForm(f => ({ ...f, wechat_add_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">所属微信</label>
                  <select
                    className="input"
                    value={editForm.wechat_account}
                    onChange={e => setEditForm(f => ({ ...f, wechat_account: e.target.value as WechatAccount }))}
                  >
                    {Object.entries(WECHAT_ACCOUNT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 客户阶段 */}
            <div
              className="p-3 rounded-lg border"
              style={{ backgroundColor: 'var(--color-primary-soft)', borderColor: 'rgb(91 92 226 / 0.12)' }}
            >
              <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-primary)' }}>
                <ChevronRight size={14} strokeWidth={2} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>客户阶段管理</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {Object.entries(STAGE_LABELS).map(([k, v]) => {
                  const active = editForm.stage === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, stage: k as CustomerStage }))}
                      className="px-2 py-1.5 rounded-md text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: active ? 'var(--color-bg-surface)' : 'transparent',
                        borderColor: active ? 'rgb(91 92 226 / 0.4)' : 'transparent',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        boxShadow: active ? '0 1px 2px rgb(16 24 40 / 0.04)' : 'none',
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="form-label flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <Lightbulb size={12} strokeWidth={1.8} style={{ color: 'rgb(245 158 11)' }} />
                  下次聊什么话题
                </label>
                <input
                  className="input"
                  value={editForm.next_talk_topic}
                  onChange={e => setEditForm(f => ({ ...f, next_talk_topic: e.target.value }))}
                  placeholder="记录下次聊天的切入点"
                />
              </div>
            </div>

            {/* 基础信息 */}
            <div>
              <label className="form-label">客户称呼 *</label>
              <input
                className="input"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">微信昵称</label>
                <input
                  className="input"
                  value={editForm.nickname}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">手机号</label>
                <input
                  className="input"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="form-label">抖音昵称</label>
              <input
                className="input"
                value={editForm.douyin_nickname}
                onChange={e => setEditForm(f => ({ ...f, douyin_nickname: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">来源渠道</label>
                <select
                  className="input"
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
                <label className="form-label">重要程度</label>
                <select
                  className="input"
                  value={editForm.importance}
                  onChange={e => setEditForm(f => ({ ...f, importance: e.target.value as Importance }))}
                >
                  {Object.entries(IMPORTANCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 标签 */}
            <div>
              <label className="form-label flex items-center gap-1">
                <Tag size={12} strokeWidth={1.8} />
                标签
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_TAGS.map(tag => {
                  const active = editForm.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleEditTag(tag)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: active ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                        borderColor: active ? 'rgb(91 92 226 / 0.3)' : 'var(--color-border-default)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
                {editForm.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEditTag(tag)}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1"
                    style={{
                      backgroundColor: 'rgb(236 72 153 / 0.06)',
                      borderColor: 'rgb(236 72 153 / 0.2)',
                      color: 'rgb(219 39 119)',
                    }}
                  >
                    {tag}
                    <X size={10} strokeWidth={2} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  style={{ fontSize: '0.75rem' }}
                  placeholder="自定义标签"
                  value={customTag}
                  onChange={e => setCustomTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditCustomTag())}
                />
                <button
                  type="button"
                  onClick={addEditCustomTag}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
                >
                  添加
                </button>
              </div>
            </div>

            {/* 备注 */}
            <div>
              <label className="form-label">备注</label>
              <textarea
                className="input resize-none"
                style={{ paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                rows={2}
                value={editForm.remark}
                onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {showDelete && (
        <Modal
          title="确认删除客户"
          onClose={() => !submitting && setShowDelete(false)}
          footer={
            <>
              <button onClick={() => setShowDelete(false)} disabled={submitting} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDelete} disabled={submitting} className="btn-danger-solid flex-1">
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                确认删除
              </button>
            </>
          }
        >
          <div className="text-center py-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(239 68 68 / 0.08)' }}
            >
              <Trash2 size={24} strokeWidth={1.8} style={{ color: 'rgb(239 68 68)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              即将删除客户 <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{customer.name}</span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgb(239 68 68)' }}>此操作不可撤销</p>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          title={`确认删除${deleteConfirm.type === 'order' ? '订单' : '跟进记录'}`}
          onClose={() => !submitting && setDeleteConfirm(null)}
          footer={
            <>
              <button onClick={() => setDeleteConfirm(null)} disabled={submitting} className="btn-secondary flex-1">取消</button>
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
                className="btn-danger-solid flex-1"
              >
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                确认删除
              </button>
            </>
          }
        >
          <div className="text-center py-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgb(239 68 68 / 0.08)' }}
            >
              <AlertTriangle size={24} strokeWidth={1.8} style={{ color: 'rgb(239 68 68)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>此操作不可撤销</p>
          </div>
        </Modal>
      )}

      {showAddChild && (
        <Modal
          title={editingChild ? '编辑孩子' : '添加孩子'}
          onClose={() => { if (!submitting) { setShowAddChild(false); setChildForm(emptyChildForm); setEditingChild(null); } }}
          footer={
            <>
              <button
                onClick={() => { setShowAddChild(false); setChildForm(emptyChildForm); setEditingChild(null); }}
                disabled={submitting}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSaveChild}
                disabled={!childForm.nickname.trim() || !childForm.grade || submitting}
                className="btn-primary"
              >
                {submitting && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
                保存
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="form-label">昵称 *</label>
              <input
                className="input"
                placeholder="孩子昵称"
                value={childForm.nickname}
                onChange={e => setChildForm(f => ({ ...f, nickname: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">性别</label>
              <div className="grid grid-cols-2 gap-2">
                {(['boy', 'girl'] as const).map(g => {
                  const active = childForm.gender === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setChildForm(f => ({ ...f, gender: g }))}
                      className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-all text-sm font-medium"
                      style={{
                        borderColor: active
                          ? g === 'boy' ? 'rgb(56 189 248 / 0.5)' : 'rgb(244 114 182 / 0.5)'
                          : 'var(--color-border-default)',
                        backgroundColor: active
                          ? g === 'boy' ? 'rgb(56 189 248 / 0.08)' : 'rgb(244 114 182 / 0.08)'
                          : 'var(--color-bg-surface)',
                        color: active
                          ? g === 'boy' ? 'rgb(14 165 233)' : 'rgb(236 72 153)'
                          : 'var(--color-text-tertiary)',
                      }}
                    >
                      <span className="text-lg">{g === 'boy' ? '👦' : '👧'}</span>
                      {GENDERS[g]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">年级 *</label>
                <select
                  className="input"
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
                <label className="form-label">出生日期</label>
                <input
                  type="date"
                  className="input"
                  value={childForm.birth_date}
                  onChange={e => setChildForm(f => ({ ...f, birth_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">地区</label>
                <select
                  className="input"
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
                <label className="form-label">教材版本</label>
                <input
                  className="input"
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
              <label className="form-label">薄弱科目</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUBJECTS.map(subject => {
                  const active = childForm.weak_subjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleWeakSubject(subject)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: active ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                        borderColor: active ? 'rgb(91 92 226 / 0.3)' : 'var(--color-border-default)',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {subject}
                    </button>
                  );
                })}
                {childForm.weak_subjects.filter(s => !SUBJECTS.includes(s)).map(subject => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleWeakSubject(subject)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1"
                    style={{
                      backgroundColor: 'var(--color-primary-soft)',
                      borderColor: 'rgb(91 92 226 / 0.3)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {subject}
                    <X size={10} strokeWidth={2} />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  style={{ fontSize: '0.75rem' }}
                  placeholder="自定义科目"
                  value={childForm.custom_subject}
                  onChange={e => setChildForm(f => ({ ...f, custom_subject: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSubject())}
                />
                <button
                  type="button"
                  onClick={addCustomSubject}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
                >
                  添加
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">备注</label>
              <textarea
                className="input resize-none"
                style={{ paddingTop: '0.625rem', paddingBottom: '0.625rem', minHeight: '80px' }}
                rows={3}
                placeholder="其他备注信息（选填）"
                value={childForm.notes}
                onChange={e => setChildForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return <SharedModal isOpen onClose={onClose} title={title} size="lg" footer={footer}>{children}</SharedModal>;
}
