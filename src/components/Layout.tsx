import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Radio,
  Settings, ChevronLeft, ChevronRight, LogOut, Search, Bell,
  ChevronsUpDown, Store, MessagesSquare, GraduationCap, CalendarCheck,
  FolderOpen,
} from 'lucide-react';
import { useStore } from '@/store';
import type { TodoItem } from '@/../shared/types';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '驾驶舱' },
  { to: '/customers', icon: Users, label: '客户管理' },
  { to: '/groups', icon: MessagesSquare, label: '微信群管理' },
  { to: '/checkin', icon: CalendarCheck, label: '群打卡' },
  { to: '/products', icon: Package, label: '商品管理' },
  { to: '/orders', icon: ShoppingCart, label: '订单记录' },
  { to: '/learning-paths', icon: GraduationCap, label: '学习路径' },
  { to: '/materials', icon: FolderOpen, label: '资料库' },
  { to: '/live', icon: Radio, label: '直播台' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { currentUser, logout, todos } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setNotifOpen(false);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setNotifOpen(false);
        setUserMenuOpen(false);
        navigate('/live');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const pendingCount = todos?.length || 0;

  const pageTitleMap: Record<string, string> = {
    '/': '驾驶舱',
    '/customers': '客户管理',
    '/groups': '微信群管理',
    '/checkin': '群打卡统计',
    '/products': '商品管理',
    '/orders': '订单记录',
    '/learning-paths': '学习路径配置',
    '/materials': '资料库',
    '/live': '直播工作台',
    '/users': '用户管理',
  };

  const currentPageTitle = pageTitleMap[location.pathname] || '详情';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside
        className={`${collapsed ? 'w-[72px]' : 'w-60'} bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30`}
      >
        <div className="h-16 flex items-center px-3 shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 via-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30 relative">
              <Store className="w-[18px] h-[18px] text-white" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-[15px] font-extrabold text-white tracking-tight leading-none">
                  LearnGrow
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider mt-1">
                  智能CRM
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all shrink-0"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto overflow-x-hidden sidebar-scroll">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active text-white' : 'text-slate-400'}`
              }
              title={collapsed ? label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand-400' : ''}`} />
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && to === '/' && pendingCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md shadow-brand-500/30">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {currentPageTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setNotifOpen(false); setUserMenuOpen(false); navigate('/live'); }} className="flex items-center gap-2 w-64 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl text-sm text-slate-400 transition-all">
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">快速搜索...</span>
              <kbd className="text-[10px] font-mono font-semibold bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">⌘K</kbd>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <div className="relative" ref={notifRef}>
              <button
                className="topbar-icon-btn relative"
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
              >
                <Bell className="w-[18px] h-[18px]" />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full ring-2 ring-white" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200/80 overflow-hidden animate-slide-down z-50">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">通知中心</span>
                    <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">
                      {pendingCount} 条待办
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {todos && todos.length > 0 ? (
                      todos.slice(0, 10).map((todo: TodoItem) => (
                        <button
                          key={todo.id}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                          onClick={() => {
                            setNotifOpen(false);
                            if (todo.child_id) {
                              navigate(`/customers/${todo.customer_id}/children/${todo.child_id}`);
                            } else {
                              navigate(`/customers/${todo.customer_id}`);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${todo.priority === 'high' ? 'bg-red-500' : todo.priority === 'medium' ? 'bg-orange-500' : 'bg-brand-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 font-medium truncate">{todo.title}</p>
                              {todo.customer_name && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{todo.customer_name}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">暂无待办通知</p>
                      </div>
                    )}
                  </div>
                  {todos && todos.length > 0 && (
                    <button
                      className="w-full px-4 py-2.5 text-xs text-brand-600 font-semibold hover:bg-brand-50 transition-colors border-t border-slate-100"
                      onClick={() => { setNotifOpen(false); navigate('/'); }}
                    >
                      查看全部待办 →
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-slate-100 transition-colors"
              >
                {currentUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                    {(currentUser.display_name || currentUser.username).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser?.display_name || currentUser?.username}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {currentUser?.role === 'admin' ? '管理员' : '助理运营'}
                  </div>
                </div>
                <ChevronsUpDown className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 overflow-hidden animate-slide-down">
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-800">
                      {currentUser?.display_name || currentUser?.username}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      @{currentUser?.username}
                    </div>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/users');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      用户管理
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
