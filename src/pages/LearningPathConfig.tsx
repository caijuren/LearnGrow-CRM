import { useEffect, useRef, useState } from 'react';
import {
  Plus, Save, Trash2, ChevronUp, ChevronDown, AlertTriangle, Loader2,
  Route, Layers, X, Check,
} from 'lucide-react';
import { useStore } from '@/store';
import * as api from '@/lib/api';
import type { LearningPath, Product } from '../../shared/types';

const SUBJECT_OPTIONS = [
  { value: '英语', label: '英语', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  { value: '语文', label: '语文', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  { value: '数学', label: '数学', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
];

interface StageForm {
  id?: number;
  name: string;
  description: string;
  duration_days: string;
  key_milestones: string;
  target_product_ids: number[];
}

interface PathForm {
  name: string;
  subject: string;
  description: string;
  is_active: boolean;
  stages: StageForm[];
}

const emptyStage = (): StageForm => ({
  name: '',
  description: '',
  duration_days: '',
  key_milestones: '',
  target_product_ids: [],
});

const emptyForm = (): PathForm => ({
  name: '',
  subject: '英语',
  description: '',
  is_active: true,
  stages: [],
});

export default function LearningPathConfig() {
  const {
    learningPaths,
    loading,
    loadLearningPaths,
    addLearningPath,
    editLearningPath,
    removeLearningPath,
  } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<PathForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [productDropdownOpen, setProductDropdownOpen] = useState<number | null>(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    loadLearningPaths();
    api.fetchAllProducts().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productDropdownOpen != null) {
        const ref = dropdownRefs.current[productDropdownOpen];
        if (ref && !ref.contains(e.target as Node)) {
          setProductDropdownOpen(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [productDropdownOpen]);

  const handleSelectPath = (path: LearningPath) => {
    setSelectedId(path.id);
    setIsNew(false);
    setProductDropdownOpen(null);
    setForm({
      name: path.name,
      subject: path.subject,
      description: path.description || '',
      is_active: path.is_active,
      stages: (path.stages || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map(s => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          duration_days: s.duration_days != null ? String(s.duration_days) : '',
          key_milestones: s.key_milestones || '',
          target_product_ids: s.target_product_ids || [],
        })),
    });
  };

  const handleNewPath = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm(emptyForm());
  };

  const handleAddStage = () => {
    setForm(f => ({ ...f, stages: [...f.stages, emptyStage()] }));
  };

  const handleRemoveStage = (idx: number) => {
    setForm(f => ({ ...f, stages: f.stages.filter((_, i) => i !== idx) }));
  };

  const handleMoveStage = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= form.stages.length) return;
    const newStages = [...form.stages];
    [newStages[idx], newStages[newIdx]] = [newStages[newIdx], newStages[idx]];
    setForm(f => ({ ...f, stages: newStages }));
  };

  const handleStageChange = (idx: number, field: keyof StageForm, value: string | number[]) => {
    setForm(f => {
      const newStages = [...f.stages];
      newStages[idx] = { ...newStages[idx], [field]: value };
      return { ...f, stages: newStages };
    });
  };

  const toggleProduct = (stageIdx: number, productId: number) => {
    setForm(f => {
      const newStages = [...f.stages];
      const current = newStages[stageIdx].target_product_ids;
      newStages[stageIdx] = {
        ...newStages[stageIdx],
        target_product_ids: current.includes(productId)
          ? current.filter(id => id !== productId)
          : [...current, productId],
      };
      return { ...f, stages: newStages };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const hasEmptyStageName = form.stages.some(s => !s.name.trim());
    if (hasEmptyStageName) return;

    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        subject: form.subject,
        description: form.description || null,
        is_active: form.is_active,
        stages: form.stages.map((s, i) => ({
          id: s.id,
          name: s.name,
          description: s.description || null,
          duration_days: s.duration_days ? Number(s.duration_days) : null,
          key_milestones: s.key_milestones || null,
          target_product_ids: s.target_product_ids,
          order_index: i,
        })),
      };

      if (isNew) {
        await addLearningPath(payload);
        setIsNew(false);
      } else if (selectedId) {
        await editLearningPath(selectedId, payload);
      }

      await loadLearningPaths();
    } catch (e) {
      console.error('保存学习路径失败:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId == null) return;
    setSaving(true);
    try {
      await removeLearningPath(deletingId);
      if (selectedId === deletingId) {
        setSelectedId(null);
        setIsNew(false);
        setForm(emptyForm());
      }
      setDeletingId(null);
    } catch (e) {
      console.error('删除学习路径失败:', e);
    } finally {
      setSaving(false);
    }
  };

  const getProductName = (id: number) => products.find(p => p.id === id)?.name || `产品#${id}`;
  const getProductPrice = (id: number) => products.find(p => p.id === id)?.price ?? 0;
  const getSubjectConfig = (subject: string) =>
    SUBJECT_OPTIONS.find(s => s.value === subject) || SUBJECT_OPTIONS[0];

  const hasContent = isNew || selectedId != null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
              <Route className="w-6 h-6 text-indigo-500" />
              学习路径配置
            </h1>
            <p className="text-sm text-slate-500 mt-1">规划学科学习阶段，关联产品，驱动自动跟进</p>
          </div>
          <button
            onClick={handleNewPath}
            className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            新建路径
          </button>
        </div>

        <div className="flex gap-4 h-[calc(100vh-160px)]">
          <div className="w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                路径列表 ({learningPaths.length})
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading && learningPaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-sm text-slate-400 mt-2">加载中...</p>
                </div>
              ) : learningPaths.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <Layers className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">暂无学习路径</p>
                  <button
                    onClick={handleNewPath}
                    className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    + 创建第一个路径
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {learningPaths.map(path => {
                    const subjectConf = getSubjectConfig(path.subject);
                    const isSelected = selectedId === path.id && !isNew;
                    return (
                      <button
                        key={path.id}
                        onClick={() => handleSelectPath(path)}
                        className={`w-full text-left p-3 rounded-xl transition-all group ${
                          isSelected
                            ? 'bg-indigo-50 border-2 border-indigo-200'
                            : 'hover:bg-slate-50 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${subjectConf.dot}`} />
                              <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-800'} truncate`}>
                                {path.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${subjectConf.color}`}>
                                {subjectConf.label}
                              </span>
                              {!path.is_active && (
                                <span className="text-[10px] text-slate-400">未启用</span>
                              )}
                              {path.stages && path.stages.length > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  {path.stages.length}个阶段
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <ChevronUp className="w-4 h-4 text-indigo-400 rotate-90 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            {!hasContent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                  <Route className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-1">选择或创建学习路径</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  从左侧列表选择一个路径进行编辑，或点击"新建路径"创建新的学习路径
                </p>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isNew ? '新建学习路径' : '编辑学习路径'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isNew ? '配置路径基本信息和阶段' : `路径ID: ${selectedId}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isNew && selectedId && (
                      <button
                        onClick={() => setDeletingId(selectedId)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || !form.name.trim() || form.stages.some(s => !s.name.trim())}
                      className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      保存
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                        路径名称 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                        placeholder="如：小学英语启蒙路径"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">学科</label>
                      <select
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm bg-white"
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      >
                        {SUBJECT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">路径描述</label>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm resize-none"
                      rows={2}
                      placeholder="描述此学习路径的适用人群、学习目标等..."
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-slate-700">是否启用</div>
                      <div className="text-xs text-slate-500">禁用后不会在学员进度中显示</div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        form.is_active ? 'bg-indigo-500' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        form.is_active ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        学习阶段 ({form.stages.length})
                      </label>
                      <button
                        onClick={handleAddStage}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加阶段
                      </button>
                    </div>

                    {form.stages.length === 0 ? (
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">暂无阶段，点击"添加阶段"开始配置</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.stages.map((stage, idx) => (
                          <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">
                                  {stage.name || `阶段 ${idx + 1}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveStage(idx, -1)}
                                  disabled={idx === 0}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                </button>
                                <button
                                  onClick={() => handleMoveStage(idx, 1)}
                                  disabled={idx === form.stages.length - 1}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                </button>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <button
                                  onClick={() => handleRemoveStage(idx)}
                                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">
                                  阶段名称 <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                                  placeholder="如：兴趣引导期"
                                  value={stage.name}
                                  onChange={e => handleStageChange(idx, 'name', e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">阶段描述</label>
                                <textarea
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm resize-none"
                                  rows={2}
                                  placeholder="描述此阶段的学习重点..."
                                  value={stage.description}
                                  onChange={e => handleStageChange(idx, 'description', e.target.value)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-slate-600 mb-1 block">预计天数</label>
                                  <input
                                    type="number"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                                    placeholder="如：30"
                                    value={stage.duration_days}
                                    onChange={e => handleStageChange(idx, 'duration_days', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600 mb-1 block">关键里程碑</label>
                                  <input
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm"
                                    placeholder="如：完成自然拼读"
                                    value={stage.key_milestones}
                                    onChange={e => handleStageChange(idx, 'key_milestones', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                                  目标产品 ({stage.target_product_ids.length})
                                </label>
                                <div className="relative" ref={el => { dropdownRefs.current[idx] = el; }}>
                                  <button
                                    type="button"
                                    onClick={() => setProductDropdownOpen(productDropdownOpen === idx ? null : idx)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-300 outline-none transition-all text-sm text-left bg-white hover:border-slate-300 flex items-center justify-between"
                                  >
                                    <span className={stage.target_product_ids.length === 0 ? 'text-slate-400' : 'text-slate-700'}>
                                      {stage.target_product_ids.length === 0
                                        ? '选择关联产品...'
                                        : `已选 ${stage.target_product_ids.length} 个产品`
                                      }
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${productDropdownOpen === idx ? 'rotate-180' : ''}`} />
                                  </button>
                                  {productDropdownOpen === idx && (
                                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                      {products.map(product => {
                                        const selected = stage.target_product_ids.includes(product.id);
                                        return (
                                          <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => toggleProduct(idx, product.id)}
                                            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${
                                              selected ? 'bg-indigo-50/50' : ''
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                                selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                                              }`}>
                                                {selected && <Check className="w-3 h-3 text-white" />}
                                              </div>
                                              <span className="text-slate-700 truncate">{product.name}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-indigo-600 shrink-0 ml-2">
                                              ¥{product.price}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {stage.target_product_ids.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {stage.target_product_ids.map(pid => (
                                      <span
                                        key={pid}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100"
                                      >
                                        {getProductName(pid)}
                                        <span className="text-indigo-400">¥{getProductPrice(pid)}</span>
                                        <button
                                          type="button"
                                          onClick={() => toggleProduct(idx, pid)}
                                          className="w-3.5 h-3.5 rounded-full hover:bg-indigo-200 flex items-center justify-center"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {deletingId != null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !saving && setDeletingId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除学习路径？</h3>
              <p className="text-sm text-slate-500 mb-1">
                即将删除路径 <span className="font-semibold text-slate-700">
                  {learningPaths.find(p => p.id === deletingId)?.name}
                </span>
              </p>
              <p className="text-xs text-red-500">此操作不可撤销</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setDeletingId(null)}
                disabled={saving}
                className="flex-1 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
