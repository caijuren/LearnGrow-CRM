import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, BarChart3, Users, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';
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
    } catch (err) {
      setError((err as Error).message || '登录失败，请检查用户名和密码');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] bg-bg-page relative">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      {/* Left panel */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-col justify-between p-10 relative z-10 overflow-hidden
                   bg-gradient-to-br from-bg-surface via-bg-subtle to-bg-surface
                   border-r border-border-subtle"
      >
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-text-primary">源来是糖</h1>
              <p className="text-[10px] text-text-tertiary font-medium mt-1">运营后台 v{import.meta.env.VITE_APP_VERSION || '2.7.0'}</p>
            </div>
          </div>

          <div className="mt-24">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary-soft bg-primary-soft px-3 py-1.5 text-xs text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              源来是糖 · 运营后台
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight leading-tight text-text-primary">
              教育私域运营
              <br />
              <span className="text-gradient">从用户跟进开始</span>
            </h2>
            <p className="mt-5 text-sm leading-7 text-text-secondary max-w-sm">
              管理微信用户、跟进记录、订单转化和学习路径，让销售和教务协作有清晰的数据底座。
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: '微信用户', desc: '全生命周期追踪' },
              { icon: TrendingUp, label: '转化分析', desc: '销售数据可视' },
              { icon: BarChart3, label: '学习分析', desc: '数据驱动决策' },
              { icon: ShieldCheck, label: '权限安全', desc: '账号角色隔离' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-border-subtle bg-bg-subtle/60 p-4 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-bg-surface border border-border-subtle flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="text-sm font-semibold text-text-primary">{label}</div>
                <div className="text-xs text-text-tertiary mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-text-tertiary relative">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />生产环境安全校验已启用</span>
          <span>© 2026 源来是糖</span>
        </div>
      </motion.section>

      {/* Right panel - form */}
      <main className="flex items-center justify-center p-5 sm:p-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary tracking-tight">欢迎回来</h2>
            <p className="text-sm text-text-secondary mt-2">登录您的账户，进入用户运营工作台</p>
          </div>

          <div className="glass p-6 rounded-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-danger-soft border border-danger/30 rounded-lg text-sm text-danger flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-md bg-danger/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <span className="leading-relaxed">{error}</span>
                </motion.div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">用户名</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary group-focus-within:text-primary transition-colors" />
                  <input
                    className="input pl-10 py-2.5 w-full"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary mb-2 block">密码</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-11 py-2.5 w-full"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors p-1 -m-1"
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
                  <div className="w-[18px] h-[18px] rounded-md border border-border-default peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center group-hover:border-border-strong">
                    <svg className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">记住登录状态</span>
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
        </motion.div>
      </main>
    </div>
  );
}
