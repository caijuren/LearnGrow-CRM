import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Clock, Flag, ShoppingCart, ArrowRight,
  Loader2, X, Calendar, FileText, ChevronRight, CheckCircle2,
  PlayCircle, PauseCircle, Target, TrendingUp, Package,
  Plus, Trash2, Edit3,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  ORDER_TYPE_LABELS, ORDER_TYPE_COLORS, FOLLOW_UP_METHOD_LABELS, FOLLOW_UP_RESULT_LABELS,
  GRADES, GENDERS, SUBJECTS,
  type FollowUpMethod, type ProgressStatus, type ChildLearningProgress,
} from '../../shared/types';
import Empty from '@/components/Empty';

const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  paused: '已暂停',
};

const PROGRESS_STATUS_COLORS: Record<ProgressStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
};

const METHOD_ICONS: Record<FollowUpMethod, typeof FileText> = {
  wechat: FileText,
  phone: FileText,
  group: FileText,
  live: FileText,
  moments: FileText,
};

interface AdvanceForm {
  completed_date: string;
  notes: string;
}

interface EditChildForm {
  nickname: string;
  gender: 'boy' | 'girl' | '';
  birth_date: string;
  grade: string;
  textbook_version: string;
  weak_subjects: string[];
  notes: string;
  custom_subject: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyEditChildForm: EditChildForm = {
  nickname: '',
  gender: '',
  birth_date: '',
  grade: '',
  textbook_version: '',
  weak_subjects: [],
  notes: '',
  custom_subject: '',
};

export default function ChildDetail() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const {
    selectedChild: child,
    loading,
    learningPaths,
    loadChild,
    advanceProgress,
    clearSelectedChild,
    loadLearningPaths,
    addChildProgress,
    editChild,
    removeChild,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'progress' | 'orders' | 'followups'>('progress');
  const [showAdvance, setShowAdvance] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<ChildLearningProgress | null>(null);
  const [advanceForm, setAdvanceForm] = useState<AdvanceForm>({
    completed_date: todayStr(),
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [editChildForm, setEditChildForm] = useState<EditChildForm>(emptyEditChildForm);
  const [showDeleteChild, setShowDeleteChild] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [showAddPath, setShowAddPath] = useState(false);
  const [addPathSubmitting, setAddPathSubmitting] = useState(false);

  useEffect(() => {
    if (childId) {
      loadChild(Number(childId));
    }
    return () => clearSelectedChild();
  }, [childId]);

  useEffect(() => {
    if (child) {
      setEditChildForm({
        nickname: child.nickname,
        gender: child.gender || '',
        birth_date: child.birth_date || '',
        grade: child.grade,
        textbook_version: child.textbook_version || '',
        weak_subjects: child.weak_subjects || [],
        notes: child.notes || '',
        custom_subject: '',
      });
    }
  }, [child]);

  useEffect(() => {
    if (activeTab === 'progress' && learningPaths.length === 0) {
      loadLearningPaths({ subject: '英语', is_active: true });
    }
  }, [activeTab, learningPaths.length]);

  const handleAdvance = async () => {
    if (!childId || !currentProgress) return;
    setSubmitting(true);
    try {
      await advanceProgress(Number(childId), currentProgress.id, {
        completed_date: advanceForm.completed_date || null,
        notes: advanceForm.notes || null,
        next_stage_id: currentProgress.next_stage?.id ?? null,
      });
      setShowAdvance(false);
      setCurrentProgress(null);
      setAdvanceForm({ completed_date: todayStr(), notes: '' });
    } catch (e) {
      console.error('推进阶段失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const openAdvanceDialog = (progress: ChildLearningProgress) => {
    setCurrentProgress(progress);
    setAdvanceForm({ completed_date: todayStr(), notes: '' });
    setShowAdvance(true);
  };

  const hasUnpurchasedProducts = (progress: ChildLearningProgress) => {
    if (!progress.target_products || progress.target_products.length === 0) return false;
    const purchasedProductIds = new Set(
      (child?.orders || []).map(o => o.product_id)
    );
    return progress.target_products.some(p => !purchasedProductIds.has(p.id));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusIcon = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress': return <PlayCircle className="w-4 h-4" />;
      case 'paused': return <PauseCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const calculateProgress = (progress: ChildLearningProgress) => {
    if (!progress.path?.stages || progress.path.stages.length === 0) return 0;
    const stages = progress.path.stages;
    if (progress.status === 'completed') return 100;
    if (!progress.current_stage) return 0;
    const currentIndex = stages.findIndex(s => s.id === progress.current_stage!.id);
    if (currentIndex === -1) return 0;
    return Math.round(((currentIndex) / stages.length) * 100);
  };

  const getCurrentStageNumber = (progress: ChildLearningProgress) => {
    if (!progress.path?.stages) return 0;
    if (progress.status === 'completed') return progress.path.stages.length;
    if (!progress.current_stage) return 0;
    const index = progress.path.stages.findIndex(s => s.id === progress.current_stage!.id);
    return index >= 0 ? index + 1 : 0;
  };

  const toggleWeakSubject = (subject: string) => {
    setEditChildForm(prev => ({
      ...prev,
      weak_subjects: prev.weak_subjects.includes(subject)
        ? prev.weak_subjects.filter(s => s !== subject)
        : [...prev.weak_subjects, subject],
    }));
  };

  const addCustomSubject = () => {
    const subject = editChildForm.custom_subject.trim();
    if (subject && !editChildForm.weak_subjects.includes(subject)) {
      setEditChildForm(prev => ({ ...prev, weak_subjects: [...prev.weak_subjects, subject], custom_subject: '' }));
    }
  };

  const handleSaveEditChild = async () => {
    if (!editChildForm.nickname.trim() || !editChildForm.grade || !childId) return;
    setSubmitting(true);
    try {
      await editChild(Number(childId), {
        nickname: editChildForm.nickname.trim(),
        gender: editChildForm.gender || null,
        birth_date: editChildForm.birth_date || null,
        grade: editChildForm.grade,
        textbook_version: editChildForm.textbook_version || null,
        weak_subjects: editChildForm.weak_subjects,
        notes: editChildForm.notes || null,
      });
      setShowEditChild(false);
    } catch (e) {
      console.error('编辑孩子失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChild = async () => {
    if (!childId || !child) return;
    setDeleteSubmitting(true);
    try {
      await removeChild(Number(childId), child.customer_id);
      navigate(`/customers/${child.customer_id}`);
    } catch (e) {
      console.error('删除孩子失败:', e);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleStartPath = async (pathId: number) => {
    if (!childId) return;
    setAddPathSubmitting(true);
    try {
      await addChildProgress(Number(childId), pathId);
      setShowAddPath(false);
    } catch (e) {
      console.error('开始学习路径失败:', e);
    } finally {
      setAddPathSubmitting(false);
    }
  };

  const hasLearningProgress = child?.learning_progress && child.learning_progress.length > 0;
  const addedPathIds = new Set((child?.learning_progress || []).map(p => p.path_id));
  const availablePaths = learningPaths.filter(p => !addedPathIds.has(p.id));

  if (loading && !child) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">加载中...</p>
        </div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 to-white p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/customers')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md flex items-center justify-center mb-6 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <Empty
            icon={<BookOpen className="w-10 h-10 text-emerald-300" />}
            title="孩子信息不存在"
            description="该孩子信息可能已被删除"
            action={
              <button
                onClick={() => navigate('/customers')}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                返回客户列表
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const sortedOrders = [...(child.orders || [])].sort(
    (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
  );
  const sortedFollowUps = [...(child.follow_ups || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const genderEmoji = child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒';
  const genderLabel = child.gender === 'boy' ? '男孩' : child.gender === 'girl' ? '女孩' : '未知';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 to-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/customers/${child.customer_id}`)}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{child.nickname}</h1>
                <span className="text-2xl">{genderEmoji}</span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">孩子详情</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditChild(true)}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md hover:bg-emerald-50 flex items-center justify-center transition-all text-slate-600 hover:text-emerald-600"
              title="编辑孩子资料"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDeleteChild(true)}
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:shadow-md hover:bg-red-50 flex items-center justify-center transition-all text-slate-600 hover:text-red-600"
              title="删除孩子"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shrink-0 text-3xl">
              {genderEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{child.nickname}</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {genderLabel}
                </span>
                {child.grade && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <BookOpen className="w-3 h-3" />
                    {child.grade}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                {child.birth_date && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="text-slate-400">生日:</span>
                    <span>{formatDate(child.birth_date)}</span>
                  </div>
                )}
                {child.textbook_version && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="text-slate-400">教材:</span>
                    <span>{child.textbook_version}</span>
                  </div>
                )}
              </div>
              {child.weak_subjects && child.weak_subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-xs text-slate-400 mr-1">薄弱科目:</span>
                  {child.weak_subjects.map(subject => (
                    <span key={subject} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium">
                      {subject}
                    </span>
                  ))}
                </div>
              )}
              {child.notes && (
                <p className="text-sm text-slate-600 mt-3 p-3 bg-slate-50 rounded-xl">
                  {child.notes}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'progress'
                  ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              学习进度
              {child.learning_progress?.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'progress' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {child.learning_progress.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              订单
              {sortedOrders.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'orders' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sortedOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('followups')}
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'followups'
                  ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              跟进
              {sortedFollowUps.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === 'followups' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {sortedFollowUps.length}
                </span>
              )}
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'progress' ? (
              <div>
                {hasLearningProgress ? (
                  <div>
                    <div className="flex items-center justify-end mb-4">
                      <button
                        onClick={() => setShowAddPath(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加路径
                      </button>
                    </div>
                    <div className="space-y-4">
                      {child.learning_progress!.map(progress => (
                        <div key={progress.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-800">
                                    {progress.path?.subject} · {progress.path?.name}
                                  </span>
                                </div>
                                {progress.current_stage && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs text-slate-500">当前阶段:</span>
                                    <span className="text-xs font-medium text-emerald-700">{progress.current_stage.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${PROGRESS_STATUS_COLORS[progress.status]}`}>
                              {getStatusIcon(progress.status)}
                              {PROGRESS_STATUS_LABELS[progress.status]}
                            </span>
                          </div>

                          {progress.path?.stages && progress.path.stages.length > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">阶段进度</span>
                                <span className="text-xs font-medium text-slate-700">
                                  {getCurrentStageNumber(progress)} / {progress.path.stages.length}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                                  style={{ width: `${calculateProgress(progress)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {progress.current_stage?.key_milestones && (
                            <div className="mb-3 p-3 bg-white rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Flag className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-semibold text-slate-700">关键里程碑</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{progress.current_stage.key_milestones}</p>
                            </div>
                          )}

                          {progress.target_products && progress.target_products.length > 0 && (
                            <div className="mb-3 p-3 bg-white rounded-xl">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Package className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-semibold text-slate-700">目标产品</span>
                              </div>
                              <div className="space-y-2">
                                {progress.target_products.map(product => {
                                  const isPurchased = (child.orders || []).some(o => o.product_id === product.id);
                                  return (
                                    <div key={product.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        {isPurchased ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <Target className="w-4 h-4 text-rose-400" />
                                        )}
                                        <span className={`text-sm font-medium ${isPurchased ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                          {product.name}
                                        </span>
                                      </div>
                                      <span className="text-sm font-bold text-slate-900">¥{product.price}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {progress.next_stage && progress.status !== 'completed' && (
                            <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                              <div className="flex items-center gap-1.5 mb-1">
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-semibold text-emerald-700">下一阶段</span>
                              </div>
                              <p className="text-xs text-emerald-700 font-medium">{progress.next_stage.name}</p>
                              {progress.next_stage.description && (
                                <p className="text-xs text-emerald-600 mt-1">{progress.next_stage.description}</p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-3">
                            {progress.status !== 'completed' && (
                              <button
                                onClick={() => openAdvanceDialog(progress)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-md shadow-emerald-200 transition-all"
                              >
                                <ChevronRight className="w-4 h-4" />
                                推进到下一阶段
                              </button>
                            )}
                            {hasUnpurchasedProducts(progress) && (
                              <button
                                onClick={() => navigate(`/customers/${child.customer_id}?tab=orders`)}
                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium shadow-md shadow-rose-200 transition-all"
                              >
                                <ShoppingCart className="w-4 h-4" />
                                推荐购买
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-slate-600 mb-3 font-medium">选择学习路径开始</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {learningPaths.map(path => (
                        <button
                          key={path.id}
                          onClick={() => handleStartPath(path.id)}
                          disabled={addPathSubmitting}
                          className="p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl border border-slate-200 hover:border-emerald-200 text-left transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 group-hover:from-emerald-200 group-hover:to-teal-200 transition-colors">
                              <BookOpen className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                                {path.subject} · {path.name}
                              </div>
                              {path.description && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{path.description}</p>
                              )}
                              {path.stages && path.stages.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                                  <Flag className="w-3 h-3" />
                                  {path.stages.length}个阶段
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'orders' ? (
              sortedOrders.length > 0 ? (
                <div className="space-y-3">
                  {sortedOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{order.product_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ORDER_TYPE_COLORS[order.order_type]}`}>
                              {ORDER_TYPE_LABELS[order.order_type]}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.purchase_date)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-slate-900">¥{order.amount?.toLocaleString()}</div>
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
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-200 via-teal-200 to-transparent" />
                  {sortedFollowUps.map((followUp, index) => {
                    const Icon = METHOD_ICONS[followUp.method] || FileText;
                    return (
                      <div key={followUp.id} className="relative mb-5 last:mb-0">
                        <div className="absolute -left-10 top-1 w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 border-4 border-white shadow-md flex items-center justify-center z-10">
                          <Icon className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-200 text-slate-700">
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
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{followUp.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={<FileText className="w-8 h-8 text-slate-300" />}
                  title="暂无跟进记录"
                  description="记录与该孩子相关的跟进内容"
                />
              )
            )}
          </div>
        </div>
      </div>

      {showAdvance && currentProgress && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowAdvance(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">推进到下一阶段</h2>
              <button
                onClick={() => setShowAdvance(false)}
                disabled={submitting}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      {currentProgress.path?.subject} · {currentProgress.path?.name}
                    </div>
                    {currentProgress.current_stage && currentProgress.next_stage && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <span className="text-emerald-700 font-medium">{currentProgress.current_stage.name}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-emerald-700 font-medium">{currentProgress.next_stage.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">完成日期</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  value={advanceForm.completed_date}
                  onChange={e => setAdvanceForm(f => ({ ...f, completed_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">备注</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="阶段完成备注（选填）"
                  value={advanceForm.notes}
                  onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowAdvance(false)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleAdvance}
                disabled={submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认推进
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditChild && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowEditChild(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">编辑孩子资料</h2>
              <button
                onClick={() => setShowEditChild(false)}
                disabled={submitting}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">昵称 *</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  placeholder="孩子昵称"
                  value={editChildForm.nickname}
                  onChange={e => setEditChildForm(f => ({ ...f, nickname: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">性别</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['boy', 'girl'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditChildForm(f => ({ ...f, gender: g }))}
                      className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-sm font-medium ${
                        editChildForm.gender === g
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
                    value={editChildForm.grade}
                    onChange={e => setEditChildForm(f => ({ ...f, grade: e.target.value }))}
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
                    value={editChildForm.birth_date}
                    onChange={e => setEditChildForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">教材版本</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  placeholder="如：人教PEP版"
                  value={editChildForm.textbook_version}
                  onChange={e => setEditChildForm(f => ({ ...f, textbook_version: e.target.value }))}
                />
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
                        editChildForm.weak_subjects.includes(subject)
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {subject}
                    </button>
                  ))}
                  {editChildForm.weak_subjects.filter(s => !SUBJECTS.includes(s)).map(subject => (
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
                    value={editChildForm.custom_subject}
                    onChange={e => setEditChildForm(f => ({ ...f, custom_subject: e.target.value }))}
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
                  value={editChildForm.notes}
                  onChange={e => setEditChildForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowEditChild(false)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditChild}
                disabled={!editChildForm.nickname.trim() || !editChildForm.grade || submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteChild && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !deleteSubmitting && setShowDeleteChild(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除孩子？</h3>
              <p className="text-sm text-slate-500 mb-1">
                即将删除孩子 <span className="font-semibold text-slate-700">{child.nickname}</span>
              </p>
              <p className="text-xs text-red-500">此操作不可撤销</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setShowDeleteChild(false)}
                disabled={deleteSubmitting}
                className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteChild}
                disabled={deleteSubmitting}
                className="flex-1 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPath && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !addPathSubmitting && setShowAddPath(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">选择学习路径</h2>
              <button
                onClick={() => setShowAddPath(false)}
                disabled={addPathSubmitting}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {availablePaths.length > 0 ? (
                <div className="space-y-3">
                  {availablePaths.map(path => (
                    <button
                      key={path.id}
                      onClick={() => handleStartPath(path.id)}
                      disabled={addPathSubmitting}
                      className="w-full p-4 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-200 text-left transition-all group disabled:opacity-50 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0 group-hover:from-emerald-200 group-hover:to-teal-200 transition-colors">
                        <BookOpen className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                          {path.subject} · {path.name}
                        </div>
                        {path.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{path.description}</p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-slate-500 py-8">暂无更多可用学习路径</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
