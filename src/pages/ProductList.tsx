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
import Modal from '@/components/Modal';

const TIER_ACCENTS: Record<ProductTier, string> = {
  traffic: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  main: 'bg-sky-50 text-sky-700 border-sky-100',
  premium: 'bg-violet-50 text-violet-700 border-violet-100',
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
    <div className="page-shell">
      <div className="page-inner">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="flex items-center gap-2"
              style={{
                fontSize: '1.375rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                lineHeight: 1.3,
              }}
            >
              <BookOpen size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />
              我的商品库
            </h1>
            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
                marginLeft: '28px',
              }}
            >
              管理您的教辅资料和课程，按学科分层运营
            </p>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setShowAdd(true); }}
            className="btn-primary"
          >
            <Plus size={15} strokeWidth={2} />
            添加商品
          </button>
        </div>

        {/* 分层筛选 */}
        <div className="mb-4">
          <div
            className="mb-2"
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--color-text-tertiary)',
            }}
          >
            按分层
          </div>
          <div className="flex items-center gap-0.5 flex-wrap">
            {TIER_TABS.map(tab => {
              const isActive = activeTier === tab.value;
              const count = getTierCount(tab.value);
              const tierColors: Record<string, { bg: string; color: string }> = {
                all: { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
                traffic: { bg: 'rgb(16 185 129 / 0.12)', color: 'rgb(5 150 105)' },
                main: { bg: 'rgb(59 130 246 / 0.12)', color: 'rgb(37 99 235)' },
                premium: { bg: 'rgb(139 92 246 / 0.12)', color: 'rgb(109 40 217)' },
              };
              const colors = tierColors[tab.value] || tierColors.all;

              return (
                <button
                  key={tab.value}
                  onClick={() => handleTierChange(tab.value)}
                  className="transition-all flex items-center gap-1.5"
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? colors.bg : 'transparent',
                    color: isActive ? colors.color : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                  <span
                    style={{
                      fontSize: '0.625rem',
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : 'var(--color-bg-subtle)',
                      color: isActive ? colors.color : 'var(--color-text-tertiary)',
                      fontWeight: 500,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 学科筛选 */}
        <div className="mb-5">
          <div
            className="mb-2"
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--color-text-tertiary)',
            }}
          >
            按学科
          </div>
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className="transition-all"
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: activeCategory === 'all' ? 600 : 500,
                backgroundColor: activeCategory === 'all' ? 'var(--color-primary-soft)' : 'transparent',
                color: activeCategory === 'all' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              全部学科 ({getCategoryCount('all')})
            </button>
            {DEFAULT_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="transition-all"
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? 'var(--color-primary-soft)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {cat} ({getCategoryCount(cat)})
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Loader2 size={20} strokeWidth={1.8} className="animate-spin" style={{ color: 'var(--color-primary)', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>加载中...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const tierColors: Record<string, { bg: string; color: string; label: string }> = {
                traffic: { bg: 'rgb(16 185 129 / 0.12)', color: 'rgb(5 150 105)', label: PRODUCT_TIER_LABELS.traffic },
                main: { bg: 'rgb(59 130 246 / 0.12)', color: 'rgb(37 99 235)', label: PRODUCT_TIER_LABELS.main },
                premium: { bg: 'rgb(139 92 246 / 0.12)', color: 'rgb(109 40 217)', label: PRODUCT_TIER_LABELS.premium },
              };
              const tier = tierColors[product.tier] || tierColors.traffic;

              return (
                <div
                  key={product.id}
                  onClick={() => openEdit(product)}
                  className={`overflow-hidden transition-all duration-150 cursor-pointer group ${
                    !product.is_on_sale ? 'opacity-60' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
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
                  {/* 封面区 */}
                  <div
                    className="flex items-center justify-center relative"
                    style={{
                      height: '80px',
                      backgroundColor: tier.bg,
                      borderBottom: '1px solid var(--color-border-subtle)',
                      color: tier.color,
                    }}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <GraduationCap size={22} strokeWidth={1.8} />
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                          }}
                        >
                          教辅资料
                        </span>
                      </div>
                    )}
                    {!product.is_on_sale && (
                      <div
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-sm"
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          backgroundColor: 'var(--color-text-tertiary)',
                          color: 'white',
                        }}
                      >
                        已下架
                      </div>
                    )}
                  </div>

                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3
                        className="line-clamp-1 flex-1"
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          lineHeight: 1.4,
                        }}
                      >
                        {product.name}
                      </h3>
                      <span
                        className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-sm"
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          backgroundColor: tier.bg,
                          color: tier.color,
                        }}
                      >
                        {tier.label}
                      </span>
                    </div>

                    {product.selling_points && (
                      <p
                        className="line-clamp-2 mb-3"
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-tertiary)',
                          lineHeight: 1.5,
                        }}
                      >
                        {product.selling_points}
                      </p>
                    )}

                    <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                      <span
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 700,
                          color: 'var(--color-primary)',
                          lineHeight: 1.2,
                        }}
                      >
                        ¥{product.price?.toLocaleString() || 0}
                      </span>
                      {product.commission_percent > 0 && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 500,
                            backgroundColor: 'rgb(245 158 11 / 0.1)',
                            color: 'rgb(180 83 9)',
                          }}
                        >
                          佣金 {product.commission_percent}%
                        </span>
                      )}
                      {product.sales_count > 0 && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          已售 {product.sales_count}
                        </span>
                      )}
                    </div>

                    {product.category && (
                      <div className="mb-3">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-default)',
                          }}
                        >
                          {product.category}
                        </span>
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEdit(product)}
                        className="flex items-center gap-1 transition-colors"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--color-text-secondary)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                          e.currentTarget.style.color = 'var(--color-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }}
                      >
                        <Edit2 size={12} strokeWidth={1.8} />
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
            icon={<BookOpen className="w-10 h-10 text-brand-300" />}
            title="暂无商品"
            description="开始添加您的第一个教辅商品吧"
            action={
              <button
                onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                添加第一个商品
              </button>
            }
          />
        )}
      </div>

      {showAdd && (
        <Modal
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          title="添加商品"
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
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  商品名称 <span className="text-brand-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
                  placeholder="比如：小学语文阅读理解专项训练"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">产品分层</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm bg-white"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm bg-white"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
                  placeholder="比如：分年级版本，答题技巧+80篇练习+答案解析，提分明显"
                  value={form.selling_points}
                  onChange={e => setForm(f => ({ ...f, selling_points: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">商品描述</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm resize-none"
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
                    form.is_on_sale ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form.is_on_sale ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
        </Modal>
      )}

      {editingProduct && (
        <Modal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          title="编辑商品"
          footer={
            <>
              <button onClick={() => setEditingProduct(null)} className="btn-secondary">取消</button>
              <button onClick={handleEdit} disabled={!editForm.name.trim() || submitting} className="btn-primary">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                保存修改
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                  商品名称 <span className="text-brand-500">*</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block">产品分层</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm bg-white"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm bg-white"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm"
                  value={editForm.selling_points}
                  onChange={e => setEditForm(f => ({ ...f, selling_points: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">商品描述</label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition-all text-sm resize-none"
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
                    editForm.is_on_sale ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    editForm.is_on_sale ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
        </Modal>
      )}

      <Modal
        isOpen={deletingProduct !== null}
        onClose={() => !submitting && setDeletingProduct(null)}
        title="确认删除商品"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeletingProduct(null)} disabled={submitting} className="btn-secondary flex-1">取消</button>
            <button onClick={handleDelete} disabled={submitting} className="btn-danger flex-1 bg-red-500 text-white hover:bg-red-600">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              确认删除
            </button>
          </>
        }
      >
        <div className="text-center py-1">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          {deletingProduct && <p className="text-sm text-slate-600">即将删除商品 <span className="font-semibold text-slate-800">{deletingProduct.name}</span></p>}
          <p className="text-xs text-red-500 mt-1">此操作不可撤销</p>
        </div>
      </Modal>
    </div>
  );
}
