import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, MessageCircle, BarChart3, Package,
  FileText, GraduationCap, Library, Video, Bell, Search,
  ChevronDown, Settings, LogOut, User, Sparkles, Sun, Moon,
} from 'lucide-react';
import { useStore } from '@/store';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: '概览',
    items: [
      { to: '/', label: '驾驶舱', icon: <LayoutDashboard size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '客户运营',
    items: [
      { to: '/customers', label: '客户管理', icon: <Users size={16} strokeWidth={1.8} />, badge: '5' },
      { to: '/wx-users', label: '微信用户', icon: <User size={16} strokeWidth={1.8} /> },
      { to: '/groups', label: '微信群管理', icon: <MessageCircle size={16} strokeWidth={1.8} /> },
      { to: '/checkin', label: '打卡统计', icon: <BarChart3 size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '交易管理',
    items: [
      { to: '/products', label: '商品管理', icon: <Package size={16} strokeWidth={1.8} /> },
      { to: '/orders', label: '订单记录', icon: <FileText size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '内容中心',
    items: [
      { to: '/learning-paths', label: '学习路径', icon: <GraduationCap size={16} strokeWidth={1.8} /> },
      { to: '/materials', label: '资料库', icon: <Library size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '运营工具',
    items: [
      { to: '/live', label: '直播工作台', icon: <Video size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '系统',
    items: [
      { to: '/settings', label: '设置', icon: <Settings size={16} strokeWidth={1.8} /> },
    ],
  },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });
  const { isAuthenticated, restoreAuth } = useStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) restoreAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex h-full bg-bg-page">
      <div className="fixed inset-0 bg-mesh pointer-events-none opacity-60" />

      <aside className="app-sidebar w-64 shrink-0 flex flex-col h-full glass-sidebar relative z-10 shadow-[4px_0_24px_rgba(16,24,40,0.04)]">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-border-subtle/50">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center text-white shadow-glow">
            <Sparkles size={18} strokeWidth={2} />
          </div>
          <div className="sidebar-brand-copy">
            <div className="text-[15px] font-semibold text-text-primary leading-none">源来是糖</div>
            <div className="text-[11px] text-text-tertiary mt-1">运营后台 v3.0</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 sidebar-scroll">
          {navSections.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <div className="sidebar-section-label">{section.label}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`shrink-0 w-4 h-4 flex items-center justify-center transition-colors ${isActive ? 'text-primary' : ''}`}>
                          {item.icon}
                        </span>
                        <span className="sidebar-label flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="sidebar-count text-[10px] font-semibold text-primary
                                          bg-primary-soft px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}

                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border-subtle/50
                           glass-strong sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="relative w-80 group">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-bg-subtle flex items-center justify-center group-focus-within:bg-primary-soft transition-colors">
                <Search size={14} strokeWidth={1.8} className="text-text-tertiary group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                placeholder="搜索客户、商品、订单..."
                className="w-full h-10 pl-10 pr-3 rounded-xl bg-bg-subtle text-sm text-text-primary
                           placeholder:text-text-tertiary border border-transparent
                           focus:outline-none focus:bg-bg-surface focus:border-border-default focus:ring-2 focus:ring-primary/10
                           transition-all duration-200 ease-out"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 pl-3 border-l border-border-subtle/50">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            >
              {theme === 'dark' ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>
            <button className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all relative" aria-label="通知">
              <Bell size={16} strokeWidth={1.8} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-bg-surface" />
            </button>

            <div className="relative ml-1">
              <button
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-xl
                           hover:bg-bg-hover transition-colors duration-200 ease-out border border-transparent hover:border-border-default"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-sm font-semibold shadow-glow">
                  A
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-text-primary leading-none">管理员</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">超级管理员</div>
                </div>
                <ChevronDown size={14} strokeWidth={1.8} className={`text-text-tertiary hidden md:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="dropdown absolute right-0 top-full mt-2 z-20 min-w-[200px]"
                  >
                    <div className="px-3 py-3 border-b border-border-subtle/50">
                      <div className="text-sm font-medium text-text-primary">管理员</div>
                      <div className="text-xs text-text-tertiary mt-0.5">admin@example.com</div>
                    </div>
                    <div className="py-1">
                      <button className="dropdown-item w-full text-left" onClick={() => { setUserMenuOpen(false); }}>
                        <User size={15} strokeWidth={1.8} />
                        个人设置
                      </button>
                    </div>
                    <div className="dropdown-divider" />
                    <div className="py-1">
                      <button
                        className="dropdown-item w-full text-left text-danger"
                        onClick={() => { setUserMenuOpen(false); navigate('/login'); }}
                      >
                        <LogOut size={15} strokeWidth={1.8} />
                        退出登录
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;
