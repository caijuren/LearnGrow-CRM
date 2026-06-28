import { useState } from 'react';
import { BookOpen, Lock, User, Eye, EyeOff, Sparkles, BarChart3, Users, TrendingUp, Zap, ShieldCheck } from 'lucide-react';
import { useStore } from '@/store';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const { login, loading } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Brand Section - Dark Premium */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-[#0B1120]">
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[80px]" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />

        {/* Subtle noise */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }} />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 lg:p-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 via-indigo-500 to-violet-500 flex items-center justify-center shadow-xl shadow-brand-500/30 relative">
              <BookOpen className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">LearnGrow</h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">CRM Platform</p>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-slate-300">智能教育CRM · v2.0</span>
              </div>
              <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1]">
                让教育销售<br />
                <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">更智能</span>、更高效
              </h2>
              <p className="text-slate-400 text-base leading-relaxed max-w-md">
                专为教育机构打造的客户关系管理系统，AI驱动客户洞察、学习追踪与智能推荐，让每一次跟进都精准有效。
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                { icon: Users, label: '客户管理', desc: '全生命周期追踪' },
                { icon: TrendingUp, label: '销售漏斗', desc: '转化数据可视' },
                { icon: BarChart3, label: '学习分析', desc: '数据驱动决策' },
                { icon: Sparkles, label: 'AI推荐', desc: '智能产品匹配' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.1] transition-all cursor-default group">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500/20 to-violet-500/20 border border-brand-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4 text-brand-300" />
                  </div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />数据本地加密</span>
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />实时同步</span>
            </div>
            <p className="text-xs text-slate-600">© 2026 LearnGrow CRM</p>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full lg:w-[55%] flex items-center justify-center p-6 lg:p-12 relative">
        {/* Subtle background for form side */}
        <div className="absolute inset-0 bg-dot-slate opacity-50" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-100/30 blur-[100px] pointer-events-none" />

        {/* Mobile logo */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-600 to-violet-600 rounded-xl flex items-center justify-center shadow-xl shadow-brand-600/30 mb-3">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">LearnGrow CRM</h1>
        </div>

        <div className="w-full max-w-[400px] relative z-10 mt-16 lg:mt-0">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">欢迎回来</h2>
            <p className="text-sm text-slate-500 mt-1.5">登录您的账户，开始高效的客户管理</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50/80 border border-red-100 rounded-xl text-sm text-red-600 flex items-start gap-3 animate-slide-down">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold">!</span>
                </div>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block tracking-wide uppercase">用户名</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    className="input pl-11 pr-4 py-3 text-base bg-slate-50/50 border-slate-200/80 focus:bg-white"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block tracking-wide uppercase">密码</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-11 pr-12 py-3 text-base bg-slate-50/50 border-slate-200/80 focus:bg-white"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 -m-1"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 group cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-[18px] h-[18px] rounded-md border-2 border-slate-300 peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-all flex items-center justify-center group-hover:border-brand-400">
                  <svg className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">记住登录状态</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 hover:from-brand-700 hover:via-indigo-700 hover:to-brand-700 bg-[length:200%_100%] hover:bg-[length:100%_100%] text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-base tracking-wide"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  登录中...
                </span>
              ) : '登 录'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200/70">
            <p className="text-xs text-slate-400 text-center mb-3 font-medium">演示账号快速登录</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all border border-slate-200/70 hover:border-brand-300/50 hover:shadow-md hover:shadow-brand-500/5 flex items-center gap-2 justify-center group"
              >
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold">A</span>
                <div className="text-left">
                  <div>管理员</div>
                  <div className="text-[10px] text-slate-400 font-normal">admin / admin123</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('assistant', 'assist123')}
                className="px-4 py-3 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all border border-slate-200/70 hover:border-cyan-300/50 hover:shadow-md hover:shadow-cyan-500/5 flex items-center gap-2 justify-center group"
              >
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center text-white text-[10px] font-bold">助</span>
                <div className="text-left">
                  <div>助理运营</div>
                  <div className="text-[10px] text-slate-400 font-normal">assistant / assist123</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
