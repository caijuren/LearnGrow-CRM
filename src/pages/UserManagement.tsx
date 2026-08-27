import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Shield, Users, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useStore } from '@/store';
import Modal from '@/components/Modal';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  assistant: '助理',
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
  const { currentUser, users, loadUsers, addUser, editUser, removeUser } = useStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: '', display_name: '', role: 'assistant' as 'admin' | 'assistant', password: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
    <div className="page-shell page-enter">
      <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center transition-colors"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <div>
          <h1
            style={{
              fontSize: '1.375rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            成员管理
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}
          >
            管理团队成员账号
          </p>
        </div>
      </div>

      {/* 成员卡片 */}
      <div
        className="p-5"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-2"
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            <Users size={16} strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
            团队成员 ({users.length})
          </div>
          <button onClick={openAdd} className="btn-primary" style={{ paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.75rem' }}>
            <Plus size={13} strokeWidth={2} /> 添加成员
          </button>
        </div>

        {users.length === 0 ? (
          <div
            className="text-center py-10"
            style={{ color: 'var(--color-text-tertiary)', fontSize: '0.8125rem' }}
          >
            暂无成员
          </div>
        ) : (
          <div className="space-y-1">
            {users.map((u) => {
              const isMe = u.username === currentUser?.username;
              const roleColor = u.role === 'admin'
                ? { bg: 'rgb(139 92 246 / 0.1)', color: 'rgb(109 40 217)', avatar: 'linear-gradient(135deg, rgb(139 92 246), rgb(109 40 217))' }
                : { bg: 'rgb(59 130 246 / 0.1)', color: 'rgb(37 99 235)', avatar: 'linear-gradient(135deg, rgb(59 130 246), rgb(37 99 235))' };
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-md group transition-colors"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center text-white font-semibold shrink-0"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        background: roleColor.avatar,
                        fontSize: '0.8125rem',
                      }}
                    >
                      {(u.display_name || u.username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {u.display_name || u.username}
                        </span>
                        {isMe && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 500,
                              backgroundColor: 'var(--color-primary-soft)',
                              color: 'var(--color-primary)',
                            }}
                          >
                            我
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-sm"
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            backgroundColor: roleColor.bg,
                            color: roleColor.color,
                          }}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          @{u.username}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(u)}
                      className="flex items-center justify-center transition-colors"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-tertiary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                      }}
                    >
                      <Edit2 size={13} strokeWidth={1.8} />
                    </button>
                    {u.username !== currentUser?.username && (
                      <button
                        onClick={() => openDelete(u)}
                        className="flex items-center justify-center transition-colors"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--color-text-tertiary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgb(239 68 68 / 0.08)';
                          e.currentTarget.style.color = 'rgb(220 38 38)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={selectedUser ? '编辑成员' : '添加成员'}
        footer={
          <>
            <button onClick={() => setShowFormModal(false)} className="btn-secondary">取消</button>
            <button onClick={handleSave} disabled={saving || !form.username.trim() || (!selectedUser && !form.password.trim())} className="btn-primary">
              {saving ? '保存中...' : '保存'}
            </button>
          </>
        }
      >
            <div className="space-y-4">
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
                      className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${form.role === r ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <Shield className={`w-4 h-4 ${form.role === r ? 'text-brand-500' : 'text-slate-400'}`} />
                      <span className={form.role === r ? 'text-brand-700 font-medium' : 'text-slate-600'}>{ROLE_LABELS[r]}</span>
                      {form.role === r && <Check className="w-4 h-4 text-brand-500 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal && !!selectedUser}
        onClose={() => setShowDeleteModal(false)}
        title="确认删除成员"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">取消</button>
            <button onClick={handleDelete} className="btn-danger flex-1">
              <Trash2 className="w-4 h-4" /> 删除
            </button>
          </>
        }
      >
            <div className="text-center py-1">
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-slate-500 text-sm">将删除成员 "{selectedUser?.display_name || selectedUser?.username}"，此操作不可恢复。</p>
            </div>
      </Modal>
      </div>
    </div>
  );
}
