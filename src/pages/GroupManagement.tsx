import { useEffect, useState } from 'react';
import {
  Plus, Search, Users, MessageSquare, Edit2, Trash2, X, UserPlus,
  Flame, Star, Crown, Moon, Lock, Hammer, ChevronRight,
  FileText, Tag, TrendingUp, Hash, Upload, CheckCircle, AlertCircle,
} from 'lucide-react';
import { useStore } from '@/store';
import {
  GROUP_STATUS_LABELS, GROUP_STATUS_COLORS, GROUP_COMMON_TAGS,
  GROUP_MEMBER_ROLE_LABELS, GROUP_MEMBER_ROLE_COLORS,
  type GroupStatus, type GroupMemberRole, type WechatGroup,
} from '../../shared/types';
import Empty from '@/components/Empty';

const STATUS_FILTERS: { value: GroupStatus | ''; label: string; icon: any }[] = [
  { value: '', label: '全部', icon: Hash },
  { value: 'active', label: '运营中', icon: Flame },
  { value: 'building', label: '建群中', icon: Hammer },
  { value: 'dormant', label: '休眠', icon: Moon },
  { value: 'closed', label: '已解散', icon: Lock },
];

const GROUP_COLORS = [
  'from-rose-400 to-pink-500',
  'from-pink-400 to-fuchsia-500',
  'from-fuchsia-400 to-purple-500',
  'from-violet-400 to-indigo-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
];

const MEMBER_ROLES: { value: GroupMemberRole; label: string }[] = [
  { value: 'active', label: '🔥 活跃粉' },
  { value: 'koc', label: '⭐ KOC/意见领袖' },
  { value: 'admin', label: '👑 群管/助理' },
  { value: 'new', label: '🆕 新粉' },
  { value: 'silent_vip', label: '💰 潜水大佬' },
  { value: 'assistant', label: '🤝 气氛组' },
];

interface GroupForm {
  name: string;
  purpose: string;
  description: string;
  member_count: number;
  status: GroupStatus;
  tags: string[];
  group_rules: string;
  owner_note: string;
  notes: string;
}

interface MemberForm {
  wechat_name: string;
  nickname: string;
  role: GroupMemberRole;
  tags: string[];
  activity_score: number;
  remark: string;
}

const emptyGroupForm: GroupForm = {
  name: '',
  purpose: '',
  description: '',
  member_count: 0,
  status: 'active',
  tags: [],
  group_rules: '',
  owner_note: '',
  notes: '',
};

const emptyMemberForm: MemberForm = {
  wechat_name: '',
  nickname: '',
  role: 'active',
  tags: [],
  activity_score: 50,
  remark: '',
};

function GroupCard({ group, onClick, onEdit, onDelete }: {
  group: WechatGroup;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const color = GROUP_COLORS[group.id % GROUP_COLORS.length];
  const activeCount = group.active_members?.filter(m => m.role === 'active' || m.role === 'koc').length || 0;
  const kocCount = group.active_members?.filter(m => m.role === 'koc').length || 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-slate-100 hover:border-rose-200 group overflow-hidden"
    >
      <div className={`h-24 bg-gradient-to-br ${color} relative p-4`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${GROUP_STATUS_COLORS[group.status]}`}>
            {GROUP_STATUS_LABELS[group.status]}
          </span>
        </div>
      </div>

      <div className="p-4 -mt-4 relative">
        <div className="bg-white rounded-xl p-3 mb-3 shadow-sm border border-slate-100">
          <h3 className="text-base font-bold text-slate-900 mb-1 truncate group-hover:text-rose-600 transition-colors">
            {group.name}
          </h3>
          {group.purpose && (
            <p className="text-xs text-slate-500 line-clamp-2">{group.purpose}</p>
          )}
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">{group.member_count}</span>
            <span className="text-slate-400 text-xs">人</span>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-orange-600">
              <Flame className="w-4 h-4" />
              <span className="font-semibold">{activeCount}</span>
              <span className="text-orange-400 text-xs">活跃</span>
            </div>
          )}
          {kocCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-amber-600">
              <Star className="w-4 h-4" />
              <span className="font-semibold">{kocCount}</span>
              <span className="text-amber-400 text-xs">KOC</span>
            </div>
          )}
        </div>

        {group.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {group.tags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-600">
                {tag}
              </span>
            ))}
            {group.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500">
                +{group.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {group.active_members && group.active_members.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 mr-1">核心成员:</span>
            <div className="flex -space-x-2">
              {group.active_members.slice(0, 5).map((m, i) => (
                <div
                  key={m.id}
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${GROUP_COLORS[(group.id + i) % GROUP_COLORS.length]} flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm`}
                  title={m.nickname || m.wechat_name}
                >
                  {(m.nickname || m.wechat_name)[0]}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            点击查看详情
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="btn-icon-sm">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children, footer }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="btn-icon-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function TagInput({ tags, setTags, suggestions }: {
  tags: string[];
  setTags: (tags: string[]) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-slate-200 rounded-xl bg-white">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-xs font-medium">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-rose-800">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder={tags.length === 0 ? '输入标签按回车添加' : ''}
          className="flex-1 min-w-[80px] text-sm outline-none bg-transparent placeholder:text-slate-400"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
          <button
            key={s}
            onClick={() => addTag(s)}
            className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GroupManagement() {
  const {
    groups, loadGroups, addGroup, editGroup, removeGroup,
    selectedGroup, loadGroup, clearSelectedGroup,
    addGroupMember, batchAddGroupMembers, editGroupMember, removeGroupMember,
    groupFilters, setGroupFilters, loading, error,
  } = useStore();

  const [search, setSearch] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WechatGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'member'; id: number; memberId?: number } | null>(null);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchResult, setBatchResult] = useState<{ added: number; skipped: number } | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroup(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  const openAddGroup = () => {
    setGroupForm(emptyGroupForm);
    setEditingGroup(null);
    setShowGroupForm(true);
  };

  const openEditGroup = (group: WechatGroup) => {
    setGroupForm({
      name: group.name,
      purpose: group.purpose || '',
      description: group.description || '',
      member_count: group.member_count,
      status: group.status,
      tags: [...group.tags],
      group_rules: group.group_rules || '',
      owner_note: group.owner_note || '',
      notes: group.notes || '',
    });
    setEditingGroup(group);
    setShowGroupForm(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return;
    try {
      if (editingGroup) {
        await editGroup(editingGroup.id, groupForm);
      } else {
        await addGroup(groupForm);
      }
      setShowGroupForm(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openAddMember = () => {
    setMemberForm(emptyMemberForm);
    setEditingMember(null);
    setShowMemberForm(true);
  };

  const openBatchImport = () => {
    setBatchText('');
    setBatchResult(null);
    setShowBatchImport(true);
  };

  const handleBatchImport = async () => {
    if (!selectedGroup) return;
    const names = batchText
      .split(/[\n,，]/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
    if (names.length === 0) {
      alert('请输入至少一个昵称');
      return;
    }
    setBatchImporting(true);
    try {
      const result = await batchAddGroupMembers(selectedGroup.id, names, 'new');
      setBatchResult({ added: result.added, skipped: result.skipped });
      setBatchText('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBatchImporting(false);
    }
  };

  const openEditMember = (member: any) => {
    setMemberForm({
      wechat_name: member.wechat_name,
      nickname: member.nickname || '',
      role: member.role,
      tags: [...member.tags],
      activity_score: member.activity_score,
      remark: member.remark || '',
    });
    setEditingMember(member);
    setShowMemberForm(true);
  };

  const handleSaveMember = async () => {
    if (!selectedGroup || !memberForm.wechat_name.trim()) return;
    try {
      if (editingMember) {
        await editGroupMember(selectedGroup.id, editingMember.id, memberForm);
      } else {
        await addGroupMember(selectedGroup.id, memberForm);
      }
      setShowMemberForm(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'group') {
      removeGroup(deleteConfirm.id);
      if (selectedGroup?.id === deleteConfirm.id) clearSelectedGroup();
    } else if (deleteConfirm.type === 'member' && selectedGroup) {
      removeGroupMember(selectedGroup.id, deleteConfirm.memberId!);
    }
    setDeleteConfirm(null);
  };

  const handleSearch = () => {
    setGroupFilters({ search: search || undefined });
  };

  const stats = {
    total: groups.length,
    active: groups.filter(g => g.status === 'active').length,
    building: groups.filter(g => g.status === 'building').length,
    totalMembers: groups.reduce((sum, g) => sum + g.member_count, 0),
  };

  if (selectedGroup) {
    const groupColor = GROUP_COLORS[selectedGroup.id % GROUP_COLORS.length];
    return (
      <div className="page-container page-enter">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={clearSelectedGroup} className="btn-secondary btn-sm">
            ← 返回列表
          </button>
        </div>

        <div className={`bg-gradient-to-br ${groupColor} rounded-3xl p-6 text-white relative overflow-hidden shadow-xl`}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQyIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gMCAxMCBMIDQwIDEwIE0gMTAgMCBMIDEwIDQwIE0gMCAyMCBMIDQwIDIwIE0gMjAgMCBMIDIwIDQwIE0gMCAzMCBMIDQwIDMwIE0gMzAgMCBMIDMwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQyKSIvPjwvc3ZnPg==')] opacity-40" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold">{selectedGroup.name}</h1>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-white/20 text-white mt-1`}>
                    {GROUP_STATUS_LABELS[selectedGroup.status]}
                  </span>
                </div>
              </div>
              {selectedGroup.purpose && (
                <p className="text-white/90 text-base mb-2">{selectedGroup.purpose}</p>
              )}
              {selectedGroup.description && (
                <p className="text-white/70 text-sm">{selectedGroup.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEditGroup(selectedGroup)} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white text-sm font-medium transition-colors flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                编辑群信息
              </button>
              <button onClick={() => setDeleteConfirm({ type: 'group', id: selectedGroup.id })} className="px-4 py-2 bg-white/10 hover:bg-red-500/30 backdrop-blur-sm rounded-xl text-white/80 hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                解散群
              </button>
            </div>
          </div>

          <div className="relative grid grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">群人数</div>
              <div className="text-2xl font-extrabold">{selectedGroup.member_count}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">活跃成员</div>
              <div className="text-2xl font-extrabold text-orange-200">
                {selectedGroup.active_members?.filter(m => m.role === 'active' || m.role === 'koc').length || 0}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">KOC数量</div>
              <div className="text-2xl font-extrabold text-amber-200">
                {selectedGroup.active_members?.filter(m => m.role === 'koc').length || 0}
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-white/70 text-xs mb-1">群管/助理</div>
              <div className="text-2xl font-extrabold text-emerald-200">
                {selectedGroup.active_members?.filter(m => m.role === 'admin' || m.role === 'assistant').length || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-rose-500" />
                  群成员管理
                </h3>
                <div className="flex items-center gap-2">
                  <button onClick={openBatchImport} className="btn-secondary btn-sm">
                    <Upload className="w-4 h-4" />
                    批量导入
                  </button>
                  <button onClick={openAddMember} className="btn-primary btn-sm">
                    <UserPlus className="w-4 h-4" />
                    添加成员
                  </button>
                </div>
              </div>

              {!selectedGroup.active_members || selectedGroup.active_members.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>还没有记录群成员，点击添加开始记录</p>
                  <p className="text-xs mt-1">重点记录活跃粉、KOC、群管等关键人物</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedGroup.active_members.map(member => {
                    const mc = GROUP_COLORS[(selectedGroup.id + member.id) % GROUP_COLORS.length];
                    return (
                      <div key={member.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-rose-50/50 transition-colors group">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${mc} flex items-center justify-center shadow-sm shrink-0`}>
                          <span className="text-white font-bold">{(member.nickname || member.wechat_name)[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">{member.nickname || member.wechat_name}</span>
                            {member.nickname && member.wechat_name !== member.nickname && (
                              <span className="text-xs text-slate-400">({member.wechat_name})</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${GROUP_MEMBER_ROLE_COLORS[member.role]}`}>
                              {GROUP_MEMBER_ROLE_LABELS[member.role]}
                            </span>
                          </div>
                          {member.remark && (
                            <p className="text-xs text-slate-500 truncate">{member.remark}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-slate-400" />
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${member.activity_score >= 80 ? 'bg-orange-500' : member.activity_score >= 50 ? 'bg-amber-400' : 'bg-slate-300'}`}
                                  style={{ width: `${member.activity_score}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-400">{member.activity_score}</span>
                            </div>
                            {member.tags.length > 0 && (
                              <div className="flex gap-1">
                                {member.tags.slice(0, 2).map(t => (
                                  <span key={t} className="px-1.5 py-0.5 bg-white rounded text-xs text-slate-500">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditMember(member)} className="btn-icon-sm">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm({ type: 'member', id: selectedGroup.id, memberId: member.id })} className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedGroup.owner_note && (
              <div className="card p-5 border-l-4 border-l-amber-400">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  群主备注
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedGroup.owner_note}</p>
              </div>
            )}

            {selectedGroup.notes && (
              <div className="card p-5 border-l-4 border-l-rose-400">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-rose-500" />
                  运营笔记
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedGroup.notes}</p>
              </div>
            )}

            {selectedGroup.group_rules && (
              <div className="card p-5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  群规
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedGroup.group_rules}</p>
              </div>
            )}

            {selectedGroup.tags.length > 0 && (
              <div className="card p-5">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-slate-500" />
                  群标签
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGroup.tags.map(t => (
                    <span key={t} className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Modal
          isOpen={showMemberForm}
          onClose={() => setShowMemberForm(false)}
          title={editingMember ? '编辑成员' : '添加活跃成员'}
          footer={
            <>
              <button onClick={() => setShowMemberForm(false)} className="btn-secondary">取消</button>
              <button onClick={handleSaveMember} className="btn-primary">保存</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">微信昵称 *</label>
              <input
                type="text"
                value={memberForm.wechat_name}
                onChange={e => setMemberForm({ ...memberForm, wechat_name: e.target.value })}
                className="input"
                placeholder="对方的微信昵称"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">备注名</label>
              <input
                type="text"
                value={memberForm.nickname}
                onChange={e => setMemberForm({ ...memberForm, nickname: e.target.value })}
                className="input"
                placeholder="你对TA的称呼，如：轩妈"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">成员角色</label>
              <select
                value={memberForm.role}
                onChange={e => setMemberForm({ ...memberForm, role: e.target.value as GroupMemberRole })}
                className="select w-full"
              >
                {MEMBER_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                活跃度评分: <span className="text-rose-500 font-bold">{memberForm.activity_score}</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={memberForm.activity_score}
                onChange={e => setMemberForm({ ...memberForm, activity_score: parseInt(e.target.value) })}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>潜水</span>
                <span>一般</span>
                <span>很活跃</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">标签</label>
              <TagInput
                tags={memberForm.tags}
                setTags={tags => setMemberForm({ ...memberForm, tags })}
                suggestions={['宝妈', '爽快', '高消费', '爱分享', '事多', '价格敏感', '成绩好', '基础弱']}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">备注</label>
              <textarea
                value={memberForm.remark}
                onChange={e => setMemberForm({ ...memberForm, remark: e.target.value })}
                className="input min-h-[80px] resize-none"
                placeholder="记录TA的特点、喜好、注意事项等..."
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showBatchImport}
          onClose={() => setShowBatchImport(false)}
          title="批量导入群成员"
          footer={
            <>
              <button onClick={() => setShowBatchImport(false)} className="btn-secondary">关闭</button>
              {!batchResult && (
                <button onClick={handleBatchImport} disabled={batchImporting} className="btn-primary disabled:opacity-50">
                  {batchImporting ? '导入中...' : '开始导入'}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                使用方法
              </h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>打开微信群聊 → 点右上角"..." → 查看全部群成员</li>
                <li>把群成员昵称复制下来（或截图OCR识别）</li>
                <li>粘贴到下面的输入框，每行一个昵称，或用逗号分隔</li>
                <li>点击"开始导入"即可批量添加，已存在的成员会自动跳过</li>
              </ol>
            </div>

            {batchResult ? (
              <div className={`rounded-xl p-6 text-center ${batchResult.added > 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${batchResult.added > 0 ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {batchResult.added > 0 ? (
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  ) : (
                    <AlertCircle className="w-7 h-7 text-amber-600" />
                  )}
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1">导入完成</h4>
                <p className="text-sm text-slate-600">
                  成功新增 <span className="font-bold text-green-600">{batchResult.added}</span> 人
                  {batchResult.skipped > 0 && (
                    <>，跳过已存在/空行 <span className="font-bold text-amber-600">{batchResult.skipped}</span> 个</>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  群成员昵称列表 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  className="input min-h-[200px] resize-none font-mono text-sm"
                  placeholder={'轩轩妈妈\n朵朵爸爸\n萌萌妈妈\n浩浩外婆\n...'}
                />
                <p className="text-xs text-slate-400 mt-2">
                  支持换行或逗号/中文逗号分隔，导入后统一标记为"🆕 新粉"，你可以后续逐个编辑角色和标签
                </p>
              </div>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="page-container page-enter">
      <div className="page-header mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">微信群管理</h1>
          <p className="text-slate-500 mt-1">管理你的微信群，记录群定位、活跃成员，方便私域运营</p>
        </div>
        <button onClick={openAddGroup} className="btn-primary">
          <Plus className="w-5 h-5" />
          新建群
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card" style={{ '--stat-accent': 'rgba(244,63,94,0.08)' } as any}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900 kpi-value">{stats.total}</div>
              <div className="text-xs text-slate-500">微信群总数</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': 'rgba(34,197,94,0.08)' } as any}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <Flame className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900 kpi-value">{stats.active}</div>
              <div className="text-xs text-slate-500">运营中</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': 'rgba(59,130,246,0.08)' } as any}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900 kpi-value">{stats.building}</div>
              <div className="text-xs text-slate-500">建群中</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': 'rgba(139,92,246,0.08)' } as any}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-900 kpi-value">{stats.totalMembers}</div>
              <div className="text-xs text-slate-500">总群成员</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索群名称、定位..."
                className="input pl-9"
              />
            </div>
            <button onClick={handleSearch} className="btn-secondary btn-sm">搜索</button>
          </div>
          <div className="tab-list">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setGroupFilters({ status: f.value || undefined })}
                className={`tab-item flex items-center gap-1.5 ${(groupFilters.status || '') === f.value ? 'active' : ''}`}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card p-12">
          <Empty
            icon={<MessageSquare className="w-9 h-9 text-slate-300" />}
            title="还没有微信群"
            description="点击右上角「新建群」开始记录你的微信群，方便管理群定位和活跃成员"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onClick={() => loadGroup(group.id)}
              onEdit={e => { e.stopPropagation(); openEditGroup(group); }}
              onDelete={e => { e.stopPropagation(); setDeleteConfirm({ type: 'group', id: group.id }); }}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={showGroupForm}
        onClose={() => setShowGroupForm(false)}
        title={editingGroup ? '编辑群信息' : '新建微信群'}
        footer={
          <>
            <button onClick={() => setShowGroupForm(false)} className="btn-secondary">取消</button>
            <button onClick={handleSaveGroup} className="btn-primary">{editingGroup ? '保存修改' : '创建群'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群名称 *</label>
            <input
              type="text"
              value={groupForm.name}
              onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
              className="input"
              placeholder="如：3年级家长学习交流群"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">群状态</label>
              <select
                value={groupForm.status}
                onChange={e => setGroupForm({ ...groupForm, status: e.target.value as GroupStatus })}
                className="select w-full"
              >
                <option value="active">🔥 运营中</option>
                <option value="building">🔨 建群中</option>
                <option value="dormant">💤 休眠</option>
                <option value="closed">🔒 已解散</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">群人数</label>
              <input
                type="number"
                value={groupForm.member_count}
                onChange={e => setGroupForm({ ...groupForm, member_count: parseInt(e.target.value) || 0 })}
                className="input"
                min="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群定位</label>
            <input
              type="text"
              value={groupForm.purpose}
              onChange={e => setGroupForm({ ...groupForm, purpose: e.target.value })}
              className="input"
              placeholder="如：VIP客户深度维护，高客单价转化"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群用途说明</label>
            <textarea
              value={groupForm.description}
              onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
              className="input min-h-[70px] resize-none"
              placeholder="这个群主要是做什么的？拉什么人进来？怎么运营？"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群主备注（仅自己可见）</label>
            <input
              type="text"
              value={groupForm.owner_note}
              onChange={e => setGroupForm({ ...groupForm, owner_note: e.target.value })}
              className="input"
              placeholder="如：核心利润群，要好好维护，每周至少发1次福利"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">运营笔记</label>
            <textarea
              value={groupForm.notes}
              onChange={e => setGroupForm({ ...groupForm, notes: e.target.value })}
              className="input min-h-[70px] resize-none"
              placeholder="记录运营想法、注意事项、下次要做的活动等..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群规（可选）</label>
            <textarea
              value={groupForm.group_rules}
              onChange={e => setGroupForm({ ...groupForm, group_rules: e.target.value })}
              className="input min-h-[70px] resize-none"
              placeholder="群规内容，如：禁止广告、每周三分享等"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">群标签</label>
            <TagInput
              tags={groupForm.tags}
              setTags={tags => setGroupForm({ ...groupForm, tags })}
              suggestions={GROUP_COMMON_TAGS}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
        footer={
          <>
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">取消</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">确认删除</button>
          </>
        }
      >
        <p className="text-slate-600">
          {deleteConfirm?.type === 'group'
            ? '确定要删除这个群吗？群内所有成员记录也会被删除，此操作不可撤销。'
            : '确定要删除这个成员记录吗？'}
        </p>
      </Modal>
    </div>
  );
}
