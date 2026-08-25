import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  BarChart3,
  Package,
  FileText,
  GraduationCap,
  Library,
  Video,
  Bell,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';

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
      { to: '/wechat-groups', label: '微信群管理', icon: <MessageCircle size={16} strokeWidth={1.8} /> },
      { to: '/checkin-stats', label: '群打卡统计', icon: <BarChart3 size={16} strokeWidth={1.8} /> },
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
      { to: '/library', label: '资料库', icon: <Library size={16} strokeWidth={1.8} /> },
    ],
  },
  {
    label: '运营工具',
    items: [
      { to: '/live-studio', label: '直播工作台', icon: <Video size={16} strokeWidth={1.8} /> },
    ],
  },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="flex h-full bg-bg-page">
      {/* Sidebar */}
      <aside className="app-sidebar w-64 shrink-0 flex flex-col h-full border-r border-border-subtle"
             style={{ background: '#FBFBFD' }}>
        {/* Brand */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border-subtle">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-primary-hover
                          flex items-center justify-center text-white shadow-subtle">
            <Sparkles size={16} strokeWidth={2} />
          </div>
          <div className="sidebar-brand-copy">
            <div className="text-[15px] font-semibold text-text-primary leading-none">源来是糖</div>
            <div className="text-[11px] text-text-tertiary mt-0.5">运营后台</div>
          </div>
        </div>

        {/* Nav */}
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
                    <span className="shrink-0 w-4 h-4 flex items-center justify-center">{item.icon}</span>
                    <span className="sidebar-label flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="sidebar-count text-[10px] font-semibold text-text-tertiary
                                       bg-bg-hover px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border-subtle">
          <button className="sidebar-link w-full">
            <Settings size={16} strokeWidth={1.8} />
            <span className="sidebar-label flex-1 text-left">设置</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border-subtle
                           bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search size={15} strokeWidth={1.8}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="搜索客户、商品、订单..."
                className="w-full h-10 pl-9 pr-3 rounded-md bg-bg-subtle text-sm text-text-primary
                           placeholder:text-text-tertiary border border-transparent
                           focus:outline-none focus:bg-bg-surface focus:border-border-default
                           transition-all duration-150 ease-out"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Notifications */}
            <button className="btn-icon relative" aria-label="通知">
              <Bell size={16} strokeWidth={1.8} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-bg-surface" />
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-border-subtle mx-1" />

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md
                           hover:bg-bg-hover transition-colors duration-150 ease-out"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover
                                flex items-center justify-center text-white text-sm font-semibold">
                  A
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-text-primary leading-none">管理员</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">超级管理员</div>
                </div>
                <ChevronDown size={14} strokeWidth={1.8} className="text-text-tertiary hidden md:block" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="dropdown absolute right-0 top-full mt-2 z-20 animate-slide-down" style={{ minWidth: 200 }}>
                    <div className="px-3 py-3 border-b border-border-subtle">
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
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/login');
                        }}
                      >
                        <LogOut size={15} strokeWidth={1.8} />
                        退出登录
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="page-enter"><Outlet /></div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
