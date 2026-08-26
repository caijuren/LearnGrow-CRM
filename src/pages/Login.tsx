import { useState } from 'react';
import { BookOpen, Lock, User, Eye, EyeOff, BarChart3, Users, TrendingUp, ShieldCheck } from 'lucide-react';
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

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] bg-slate-50">
      <section className="hidden lg:flex bg-white text-slate-900 border-r border-slate-200 flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">源来是糖</h1>
              <p className="text-[10px] text-slate-400 font-medium mt-1">运营后台</p>
            </div>
          </div>

          <div className="mt-24">
            <div className="inline-flex items-center gap-2 rounded-md border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs text-brand-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              源来是糖 · 运营后台
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight leading-tight text-slate-950">
              教育私域运营
              <br />
              从客户跟进开始
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500 max-w-sm">
              管理微信客户、跟进记录、订单转化和学习路径，让销售和教务协作有清晰的数据底座。
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: '客户管理', desc: '全生命周期追踪' },
              { icon: TrendingUp, label: '转化分析', desc: '销售数据可视' },
              { icon: BarChart3, label: '学习分析', desc: '数据驱动决策' },
              { icon: ShieldCheck, label: '权限安全', desc: '账号角色隔离' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-brand-600" />
                </div>
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs text-slate-400 mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />生产环境安全校验已启用</span>
          <span>© 2026 源来是糖</span>
        </div>
      </section>

      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-950 tracking-tight">欢迎回来</h2>
            <p className="text-sm text-slate-500 mt-2">登录您的账户，进入客户管理工作台</p>
          </div>

          <div className="panel p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-start gap-3 animate-slide-down">
                  <div className="w-5 h-5 rounded-md bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">用户名</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    className="input pl-10 py-2.5"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">密码</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-11 py-2.5"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 -m-1"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
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
                  <div className="w-[18px] h-[18px] rounded-md border border-slate-300 peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-all flex items-center justify-center group-hover:border-brand-400">
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
                className="btn-primary w-full py-2.5"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    登录中...
                  </span>
                ) : '登录'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
