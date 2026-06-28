import { useEffect, useState } from 'react';
import {
  Plus, X, Edit2, Trash2, Package, Loader2, BookOpen,
  ToggleLeft, ToggleRight, AlertTriangle, GraduationCap,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  PRODUCT_TIER_LABELS, PRODUCT_TIER_COLORS, DEFAULT_CATEGORIES,
  type ProductTier, type Product,
} from '../../shared/types';
import Empty from '@/components/Empty';

const TIER_GRADIENTS: Record<ProductTier, string> = {
  traffic: 'from-emerald-400 to-teal-500',
  main: 'from-blue-400 to-indigo-500',
  premium: 'from-purple-400 to-violet-500',
};

const CATEGORY_ICONS: Record<string, string> = {
  '语文': '📖',
  '数学': '🔢',
  '英语': '🔤',
  '科学': '🔬',
  '其他': '📚',
};

interface ProductForm {
  name: string;
  tier: ProductTier;
  category: string;
  price: string;
  commission_percent: string;
  selling_points: string;
  description: string;
  is_on_sale: boolean;
}

const emptyForm: ProductForm = {
  name: '',
  tier: 'main',
  category: '',
  price: '',
  commission_percent: '',
  selling_points: '',
  description: '',
  is_on_sale: true,
};

type TabFilter = ProductTier | 'all';
type CategoryFilter = string | 'all';

const TIER_TABS: { value: TabFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'traffic', label: '引流款' },
  { value: 'main', label: '主力款' },
  { value: 'premium', label: '高端款' },
];

export default function ProductList() {
  const {
    products,
    totalProducts,
    loading,
    loadProducts,
    addProduct,
    editProduct,
    deleteProduct,
    setProductTier,
    productTier,
  } = useStore();

  const [activeTier, setActiveTier] = useState<TabFilter>('all');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editForm, setEditForm] = useState<ProductForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts({ page: 1, limit: 100 });
  }, []);

  const filteredProducts = products.filter(p => {
    if (activeTier !== 'all' && p.tier !== activeTier) return false;
    if (activeCategory !== 'all' && p.category !== activeCategory) return false;
    return true;
  });

  const handleTierChange = (tier: TabFilter) => {
    setActiveTier(tier);
    if (tier === 'all') {
      setProductTier(null);
    } else {
      setProductTier(tier);
    }
  };

  const getTierCount = (tier: TabFilter) => {
    if (tier === 'all') return totalProducts;
    return products.filter(p => p.tier === tier).length;
  };

  const getCategoryCount = (cat: CategoryFilter) => {
    if (cat === 'all') return totalProducts;
    return products.filter(p => p.category === cat).length;
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      tier: product.tier,
      category: product.category || '',
      price: String(product.price),
      commission_percent: String(product.commission_percent || 0),
      selling_points: product.selling_points || '',
      description: product.description || '',
      is_on_sale: product.is_on_sale,
    });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await addProduct({
        name: form.name,
        tier: form.tier,
        category: form.category || null,
        price: Number(form.price) || 0,
        commission_percent: Number(form.commission_percent) || 0,
        selling_points: form.selling_points || null,
        description: form.description || null,
        is_on_sale: form.is_on_sale,
        sales_count: 0,
        image_url: null,
        related_product_ids: [],
      });
      setShowAdd(false);
      setForm(emptyForm);
    } catch (e) {
      console.error('添加商品失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingProduct || !editForm.name.trim()) return;
    setSubmitting(true);
    try {
      await editProduct(editingProduct.id, {
        name: editForm.name,
        tier: editForm.tier,
        category: editForm.category || null,
        price: Number(editForm.price) || 0,
        commission_percent: Number(editForm.commission_percent) || 0,
        selling_points: editForm.selling_points || null,
        description: editForm.description || null,
        is_on_sale: editForm.is_on_sale,
      });
      setEditingProduct(null);
    } catch (e) {
      console.error('编辑商品失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSale = async (product: Product) => {
    try {
      await editProduct(product.id, { is_on_sale: !product.is_on_sale });
    } catch (e) {
      console.error('切换上架状态失败:', e);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setSubmitting(true);
    try {
      await deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
    } catch (e) {
      console.error('删除商品失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 to-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-rose-500" />
              我的商品库
            </h1>
            <p className="text-sm text-slate-500 mt-1">管理您的教辅资料和课程，按学科分层运营</p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加商品
          </button>
        </div>

        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-4">
          <div className="text-xs text-slate-400 font-medium px-1 mb-2">按分层</div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {TIER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => handleTierChange(tab.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTier === tab.value
                    ? tab.value === 'traffic'
                      ? 'bg-emerald-100 text-emerald-700'
                      : tab.value === 'main'
                        ? 'bg-blue-100 text-blue-700'
                        : tab.value === 'premium'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-rose-100 text-rose-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTier === tab.value
                    ? 'bg-white/60'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {getTierCount(tab.value)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-6">
          <div className="text-xs text-slate-400 font-medium px-1 mb-2">按学科</div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              全部学科 <span className="opacity-60">({getCategoryCount('all')})</span>
            </button>
            {DEFAULT_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                  activeCategory === cat
                    ? 'bg-rose-100 text-rose-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{CATEGORY_ICONS[cat] || '📚'}</span>
                {cat} <span className="opacity-60">({getCategoryCount(cat)})</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
            <p className="text-sm text-slate-500 mt-3">加载中...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => {
              const gradient = TIER_GRADIENTS[product.tier];
              return (
                <div
                  key={product.id}
                  onClick={() => openEdit(product)}
                  className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer ${
                    product.is_on_sale
                      ? 'border-slate-100 hover:border-rose-200'
                      : 'border-slate-200 opacity-70'
                  }`}
                >
                  <div className={`h-32 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="w-10 h-10 text-white/80" />
                        <span className="text-xs text-white/60 font-medium">教辅资料</span>
                      </div>
                    )}
                    {!product.is_on_sale && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-slate-800/70 rounded-lg text-[10px] font-medium text-white">
                        已下架
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base font-bold text-slate-900 line-clamp-1 flex-1">
                        {product.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${PRODUCT_TIER_COLORS[product.tier]}`}>
                        {PRODUCT_TIER_LABELS[product.tier]}
                      </span>
                    </div>

                    {product.selling_points && (
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{product.selling_points}</p>
                    )}

                    <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                        <span className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent">
                          ¥{product.price?.toLocaleString() || 0}
                        </span>
                        {product.commission_percent > 0 && (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            佣金 {product.commission_percent}%
                          </span>
                        )}
                        {product.sales_count > 0 && (
                          <span className="text-xs text-slate-400">已售 {product.sales_count}</span>
                        )}
                      </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {product.category && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          <span>{CATEGORY_ICONS[product.category] || '📚'}</span>
                          {product.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(product)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleSale(product)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          product.is_on_sale
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {product.is_on_sale ? (
                          <><ToggleRight className="w-4 h-4" /> 下架</>
                        ) : (
                          <><ToggleLeft className="w-4 h-4" /> 上架</>
                        )}
                      </button>
                      <button
                        onClick={() => setDeletingProduct(product)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            icon={<BookOpen className="w-10 h-10 text-rose-300" />}
            title="暂无商品"
            description="开始添加您的第一个教辅商品吧"
            action={
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-rose-200"
              >
                <Plus className="w-4 h-4" />
                添加第一个商品
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
                <Plus className="w-5 h-5 text-rose-500" />
                添加商品
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
                  商品名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  placeholder="比如：小学语文阅读理解专项训练"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">产品分层</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                    value={form.tier}
                    onChange={e => setForm(f => ({ ...f, tier: e.target.value as ProductTier }))}
                  >
                    {Object.entries(PRODUCT_TIER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">所属学科</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="">请选择学科</option>
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">价格（元）</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    placeholder="0"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>

              <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">佣金比例（%）</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
                    placeholder="0"
                    value={form.commission_percent}
                    onChange={e => setForm(f => ({ ...f, commission_percent: e.target.value }))}
                  />
                </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">一句话卖点</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  placeholder="比如：分年级版本，答题技巧+80篇练习+答案解析，提分明显"
                  value={form.selling_points}
                  onChange={e => setForm(f => ({ ...f, selling_points: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">商品描述</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm resize-none"
                  rows={3}
                  placeholder="详细描述资料/课程特点、适合年级、包含内容等..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-slate-700">是否在售</div>
                  <div className="text-xs text-slate-500">下架后不在商品列表显示</div>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, is_on_sale: !f.is_on_sale }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    form.is_on_sale ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form.is_on_sale ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
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

      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingProduct(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-rose-500" />
                编辑商品
              </h2>
              <button
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  商品名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">产品分层</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                    value={editForm.tier}
                    onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as ProductTier }))}
                  >
                    {Object.entries(PRODUCT_TIER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">所属学科</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm bg-white"
                    value={editForm.category}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="">请选择学科</option>
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">价格（元）</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                    value={editForm.price}
                    onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>

              <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">佣金比例（%）</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
                    value={editForm.commission_percent}
                    onChange={e => setEditForm(f => ({ ...f, commission_percent: e.target.value }))}
                  />
                </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">一句话卖点</label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm"
                  value={editForm.selling_points}
                  onChange={e => setEditForm(f => ({ ...f, selling_points: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">商品描述</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-sm resize-none"
                  rows={3}
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-slate-700">是否在售</div>
                  <div className="text-xs text-slate-500">下架后不在商品列表显示</div>
                </div>
                <button
                  onClick={() => setEditForm(f => ({ ...f, is_on_sale: !f.is_on_sale }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    editForm.is_on_sale ? 'bg-rose-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    editForm.is_on_sale ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setEditingProduct(null)}
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
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !submitting && setDeletingProduct(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">确认删除商品？</h3>
              <p className="text-sm text-slate-500 mb-1">
                即将删除商品 <span className="font-semibold text-slate-700">{deletingProduct.name}</span>
              </p>
              <p className="text-xs text-red-500">此操作不可撤销</p>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setDeletingProduct(null)}
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
    </div>
  );
}
