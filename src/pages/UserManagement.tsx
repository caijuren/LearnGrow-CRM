import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, X, Shield, Users, Check, AlertTriangle, Lock, ArrowLeft } from 'lucide-react';
import { useStore } from '@/store';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  assistant: '助理',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; avatar: string }> = {
  admin: { bg: 'bg-violet-100', text: 'text-violet-700', avatar: 'from-violet-500 to-purple-600' },
  assistant: { bg: 'bg-sky-100', text: 'text-sky-700', avatar: 'from-sky-500 to-blue-600' },
};

interface UserItem {
  id: number;
  username: string;
  role: string;
  display_name?: string;
  created_at: string;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { currentUser, users, loading, loadUsers, addUser, editUser, removeUser } = useStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: '', display_name: '', role: 'assistant' as 'admin' | 'assistant', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const openAdd = () => {
    setSelectedUser(null);
    setForm({ username: '', display_name: '', role: 'assistant', password: '' });
    setShowFormModal(true);
  };

  const openEdit = (u: UserItem) => {
    setSelectedUser(u);
    setForm({ username: u.username, display_name: u.display_name || '', role: u.role as 'admin' | 'assistant', password: '' });
    setShowFormModal(true);
  };

  const openDelete = (u: UserItem) => {
    setSelectedUser(u);
    setShowDeleteModal(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) return;
    if (!selectedUser && !form.password.trim()) return;
    setSaving(true);
    try {
      if (selectedUser) {
        await editUser(selectedUser.id, { display_name: form.display_name, role: form.role, ...(form.password ? { password: form.password } : {}) });
      } else {
        await addUser({ username: form.username, password: form.password, role: form.role, display_name: form.display_name });
      }
      setShowFormModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    await removeUser(selectedUser.id);
    setShowDeleteModal(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">成员管理</h1>
          <p className="text-slate-500 text-sm">管理团队成员账号</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <span className="font-semibold text-slate-900">团队成员 ({users.length})</span>
          </div>
          <button onClick={openAdd} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> 添加成员
          </button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12 text-slate-400">暂无成员</div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${ROLE_COLORS[u.role]?.avatar || ROLE_COLORS.assistant.avatar} flex items-center justify-center text-white font-bold`}>
                    {(u.display_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{u.display_name || u.username}</span>
                      {u.username === currentUser?.username && <span className="text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">我</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[u.role]?.bg || ROLE_COLORS.assistant.bg} ${ROLE_COLORS[u.role]?.text || ROLE_COLORS.assistant.text}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                      <span className="text-xs text-slate-400">@{u.username}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <Edit2 className="w-4 h-4 text-slate-500" />
                  </button>
                  {u.username !== currentUser?.username && (
                    <button onClick={() => openDelete(u)} className="p-2 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFormModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">{selectedUser ? '编辑成员' : '添加成员'}</h3>
              <button onClick={() => setShowFormModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">用户名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!selectedUser}
                  className="input-base w-full disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder="登录用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">显示名</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="input-base w-full"
                  placeholder="展示用的名字"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码 {selectedUser ? '(留空不修改)' : '*'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-base w-full"
                  placeholder={selectedUser ? '新密码' : '登录密码'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">角色</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['admin', 'assistant'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm({ ...form, role: r })}
                      className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${form.role === r ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <Shield className={`w-4 h-4 ${form.role === r ? 'text-rose-500' : 'text-slate-400'}`} />
                      <span className={form.role === r ? 'text-rose-700 font-medium' : 'text-slate-600'}>{ROLE_LABELS[r]}</span>
                      {form.role === r && <Check className="w-4 h-4 text-rose-500 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2 justify-end">
              <button onClick={() => setShowFormModal(false)} className="btn-ghost">取消</button>
              <button onClick={handleSave} disabled={saving || !form.username.trim() || (!selectedUser && !form.password.trim())} className="btn-primary">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">确认删除？</h3>
              <p className="text-slate-500 text-sm">将删除成员 "{selectedUser.display_name || selectedUser.username}"，此操作不可恢复。</p>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-ghost flex-1">取消</button>
              <button onClick={handleDelete} className="btn-danger flex-1">
                <Trash2 className="w-4 h-4" /> 删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
