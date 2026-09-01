import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Sparkles } from 'lucide-react';
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
      await login(username.trim(), password, rememberMe);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || '登录失败，请检查用户名和密码');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(420px,480px)_minmax(0,1fr)] bg-bg-page relative overflow-hidden">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />

      {/* Left panel — brand */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-col relative z-10
                   bg-gradient-to-br from-bg-surface via-bg-surface to-bg-subtle
                   border-r border-border-subtle"
      >
        <div className="absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-[320px] h-[320px] rounded-full bg-primary/8 blur-[80px] pointer-events-none" />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-text-primary">源来是糖</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10 -mt-8">
          <h1 className="text-4xl font-semibold tracking-tight leading-[1.15] text-text-primary">
            家庭教育执行系统
            <br />
            <span className="text-gradient">让成长看得见</span>
          </h1>
          <p className="mt-5 text-sm leading-7 text-text-secondary max-w-[360px]">
            连接孩子的学习路径、习惯养成与家庭陪伴，为每一位家长提供清晰、可执行的教育数据支撑。
          </p>
        </div>

        <div className="relative z-10 p-10 text-xs text-text-tertiary">
          © 2026 源来是糖
        </div>
      </motion.section>

      {/* Right panel — form */}
      <main className="flex items-center justify-center p-5 sm:p-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary tracking-tight">欢迎回来</h2>
            <p className="text-sm text-text-secondary mt-2">登录进入您的教育陪伴工作台</p>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent opacity-60 blur-sm group-hover:opacity-80 transition-opacity pointer-events-none" />
            <div className="relative glass p-6 rounded-xl border border-border-strong/50 shadow-elevated">
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
                  <div className="relative group/input">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary group-focus-within/input:text-primary transition-colors" />
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
                  <div className="relative group/input">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary group-focus-within/input:text-primary transition-colors" />
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
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="checkbox"
                    />
                    <span className="text-sm text-text-secondary hover:text-text-primary transition-colors">记住登录状态</span>
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
                  ) : '进入工作台'}
                </button>
              </form>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
