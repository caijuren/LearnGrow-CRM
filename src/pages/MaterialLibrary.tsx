import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { MATERIAL_CATEGORY_LABELS, MATERIAL_CATEGORY_COLORS, MATERIAL_COMMON_TAGS, type MaterialCategory, type Material } from '../../shared/types';
import {
  FolderOpen, Upload, Search, FileText, FileImage, FileVideo, File, Download, Trash2,
  X, Tag, Plus, FileArchive
} from 'lucide-react';
import Modal from '@/components/Modal';
import Loading from '@/components/ui/Loading';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType: string | null, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <FileImage className="w-8 h-8" />;
  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return <FileVideo className="w-8 h-8" />;
  if (['pdf'].includes(ext)) return <FileText className="w-8 h-8 text-red-500" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-8 h-8 text-blue-600" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileText className="w-8 h-8 text-green-600" />;
  if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive className="w-8 h-8 text-yellow-600" />;
  return <File className="w-8 h-8 text-slate-400" />;
}

function getIconColor(mimeType: string | null, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'text-pink-500';
  if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv'].includes(ext)) return 'text-purple-500';
  if (['pdf'].includes(ext)) return 'text-red-500';
  if (['doc', 'docx'].includes(ext)) return 'text-blue-600';
  if (['xls', 'xlsx'].includes(ext)) return 'text-green-600';
  if (['zip', 'rar', '7z'].includes(ext)) return 'text-yellow-600';
  return 'text-slate-400';
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  ...Object.entries(MATERIAL_CATEGORY_LABELS).map(([key, label]) => ({ key, label })),
];

export default function MaterialLibrary() {
  const {
    materials, materialCategory, loading,
    loadMaterials, uploadMaterial, removeMaterial, recordMaterialDownload,
    setMaterialCategory, setMaterialSearch, products, loadProducts
  } = useStore();

  const [showUpload, setShowUpload] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<MaterialCategory>('sales');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadProductId, setUploadProductId] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadMaterials();
    loadProducts({ limit: 200 });
  }, [loadMaterials, loadProducts]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setMaterialSearch(searchInput);
      loadMaterials({ search: searchInput });
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput, loadMaterials, setMaterialSearch]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t)) {
      setSelectedTags(prev => [...prev, t]);
      setCustomTag('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await uploadMaterial(selectedFile, {
        category: uploadCategory,
        description: uploadDesc || undefined,
        tags: selectedTags,
        product_id: uploadProductId,
      });
      setShowUpload(false);
      setSelectedFile(null);
      setUploadDesc('');
      setSelectedTags([]);
      setUploadProductId(null);
      setUploadCategory('sales');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (m: Material) => {
    await recordMaterialDownload(m.id);
    window.open(`/api${m.url}`, '_blank');
  };

  const handleDelete = async (id: number) => {
    await removeMaterial(id);
    setDeleteConfirm(null);
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
            <FolderOpen size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary)' }} />
            资料库
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
              marginLeft: '28px',
            }}
          >
            管理销售资料、内部文档、商品电子内容、规划路径等
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary"
        >
          <Upload size={15} strokeWidth={1.8} />
          上传资料
        </button>
      </div>

      {/* 分类 Tab */}
      <div className="flex items-center gap-0.5 flex-wrap mb-4">
        {CATEGORIES.map(cat => {
          const isActive = materialCategory === cat.key;
          const count = materials.length > 0
            ? (cat.key === 'all' ? materials.length : materials.filter(m => m.category === cat.key).length)
            : 0;
          return (
            <button
              key={cat.key}
              onClick={() => setMaterialCategory(cat.key)}
              className="transition-all flex items-center gap-1.5"
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
              {cat.label}
              <span
                style={{
                  fontSize: '0.6875rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : 'var(--color-bg-subtle)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 搜索 */}
      <div className="relative max-w-md mb-5">
        <Search
          size={14}
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
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="搜索文件名、描述..."
          className="input pl-9"
        />
      </div>

      {loading && materials.length === 0 ? (
        <div className="panel py-16">
          <Loading />
        </div>
      ) : materials.length === 0 ? (
        <div
          className="py-16 flex flex-col items-center justify-center"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <FolderOpen size={40} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)', marginBottom: '12px' }} />
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              marginBottom: '12px',
            }}
          >
            暂无资料
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="btn-primary"
          >
            <Plus size={14} strokeWidth={2} />
            上传第一个资料
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {materials.map(m => (
            <div key={m.id} className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 shadow-card transition-colors group relative">
              <div className="flex items-start gap-3 mb-3">
                <div className={`flex-shrink-0 ${getIconColor(m.mime_type, m.original_name)}`}>
                  {getFileIcon(m.mime_type, m.original_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate text-sm" title={m.original_name}>
                    {m.original_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatFileSize(m.file_size)} · {m.download_count} 次下载
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`badge border ${MATERIAL_CATEGORY_COLORS[m.category]}`}>
                  {MATERIAL_CATEGORY_LABELS[m.category]}
                </span>
                {m.product_name && (
                  <span className="badge bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[120px]">
                    {m.product_name}
                  </span>
                )}
              </div>

              {m.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {m.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {m.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{m.description}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {m.uploader_name || '未知'} · {new Date(m.created_at).toLocaleDateString('zh-CN')}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(m)}
                    className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <Modal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          title="上传资料"
          size="lg"
          footer={
            <>
              <button onClick={() => setShowUpload(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleUpload} disabled={!selectedFile || uploading} className="btn-primary flex-1">
                {uploading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />上传中...</> : <><Upload className="w-4 h-4" />上传</>}
              </button>
            </>
          }
        >
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  selectedFile ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                {selectedFile ? (
                  <div>
                    <div className={`inline-flex items-center gap-2 ${getIconColor(selectedFile.type, selectedFile.name)}`}>
                      {getFileIcon(selectedFile.type, selectedFile.name)}
                    </div>
                    <p className="font-medium text-slate-700 mt-2">{selectedFile.name}</p>
                    <p className="text-sm text-slate-400 mt-1">{formatFileSize(selectedFile.size)}</p>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                      className="text-xs text-red-500 hover:text-red-600 mt-2"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">点击选择文件或拖拽到此处</p>
                    <p className="text-xs text-slate-400 mt-1">支持 PDF、Word、Excel、图片、视频、压缩包等，最大 50MB</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">分类 <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MATERIAL_CATEGORY_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setUploadCategory(key as MaterialCategory)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        uploadCategory === key
                          ? `${MATERIAL_CATEGORY_COLORS[key as MaterialCategory]} border-current`
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {uploadCategory === 'product' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">关联商品</label>
                  <select
                    value={uploadProductId || ''}
                    onChange={e => setUploadProductId(e.target.value ? Number(e.target.value) : null)}
                    className="select w-full"
                  >
                    <option value="">不关联</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                  <Tag className="w-4 h-4" /> 标签
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {MATERIAL_COMMON_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-brand-50 text-brand-700 border-brand-200'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                    placeholder="自定义标签"
                    className="input flex-1 py-1.5"
                  />
                  <button
                    onClick={addCustomTag}
                    className="btn-secondary btn-sm"
                  >
                    添加
                  </button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTags.map((tag, i) => (
                      <span key={i} className="badge bg-brand-50 text-brand-700">
                        {tag}
                        <button onClick={() => toggleTag(tag)} className="hover:text-indigo-800">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="简要描述资料内容..."
                  rows={2}
                  className="input resize-none"
                />
              </div>
            </div>
        </Modal>
      )}

      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除资料"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">取消</button>
            <button onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} className="btn-danger flex-1 bg-red-600 text-white hover:bg-red-700">删除</button>
          </>
        }
      >
        <p className="text-slate-600 text-sm">删除后资料文件将被移除，无法恢复。</p>
      </Modal>
      </div>
    </div>
  );
}
