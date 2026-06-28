import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { MATERIAL_CATEGORY_LABELS, MATERIAL_CATEGORY_COLORS, MATERIAL_COMMON_TAGS, type MaterialCategory } from '../../shared/types';
import {
  FolderOpen, Upload, Search, FileText, FileImage, FileVideo, File, Download, Trash2,
  X, Tag, Folder, Plus, Filter, FileArchive
} from 'lucide-react';

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
    materials, materialCategory, materialSearch, loading,
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
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setMaterialSearch(searchInput);
      loadMaterials({ search: searchInput });
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchInput]);

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

  const handleDownload = async (m: any) => {
    await recordMaterialDownload(m.id);
    window.open(`/api${m.url}`, '_blank');
  };

  const handleDelete = async (id: number) => {
    await removeMaterial(id);
    setDeleteConfirm(null);
  };

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    if (cat.key === 'all') {
      acc[cat.key] = materials.length;
    } else {
      acc[cat.key] = materials.filter(m => m.category === cat.key).length;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen className="w-7 h-7 text-indigo-600" />
            资料库
          </h1>
          <p className="text-slate-500 mt-1">管理销售资料、内部文档、商品电子内容、规划路径等</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
        >
          <Upload className="w-5 h-5" />
          上传资料
        </button>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setMaterialCategory(cat.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              materialCategory === cat.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {cat.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              materialCategory === cat.key ? 'bg-indigo-500' : 'bg-slate-100 text-slate-500'
            }`}>
              {materials.length > 0 ? (cat.key === 'all' ? materials.length : materials.filter(m => m.category === cat.key).length) : 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜索文件名、描述..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {loading && materials.length === 0 ? (
        <div className="text-center py-20 text-slate-400">加载中...</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">暂无资料</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            上传第一个资料
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {materials.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow group relative">
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
                <span className={`text-xs px-2 py-0.5 rounded-full border ${MATERIAL_CATEGORY_COLORS[m.category]}`}>
                  {MATERIAL_CATEGORY_LABELS[m.category]}
                </span>
                {m.product_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[120px]">
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
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">上传资料</h2>
              <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  selectedFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
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
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={addCustomTag}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
                  >
                    添加
                  </button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTags.map((tag, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button
                onClick={() => setShowUpload(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />上传中...</>
                ) : (
                  <><Upload className="w-4 h-4" />上传</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-500 text-sm mb-5">删除后资料文件将被移除，无法恢复。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
