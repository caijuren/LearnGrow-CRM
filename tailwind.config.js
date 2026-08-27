/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"PingFang SC"',
               '"Microsoft YaHei"', 'Manrope', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        display: ['Manrope', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
                  '"PingFang SC"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
        // 英文/数字专用字体
        numeric: ['Manrope', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 语义化背景色
        bg: {
          page: 'var(--color-bg-page)',
          surface: 'var(--color-bg-surface)',
          subtle: 'var(--color-bg-subtle)',
          hover: 'var(--color-bg-hover)',
        },
        // 语义化文字色
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          disabled: 'var(--color-text-disabled)',
        },
        // 语义化边框色
        border: {
          subtle: 'var(--color-border-subtle)',
          default: 'var(--color-border-default)',
        },
        // 品牌色
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
        },
        // 语义色
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
        },
        cyan: {
          DEFAULT: 'var(--color-cyan)',
          soft: 'var(--color-cyan-soft)',
        },
        // 保留旧 brand 命名，用于过渡兼容
        brand: {
          50: '#EEF0FF',
          100: '#E0E3FF',
          200: '#C7CAFF',
          300: '#A5A9FF',
          400: '#8186FF',
          500: '#5B5CE2',
          600: '#4F50D8',
          700: '#4344C0',
          800: '#3738A8',
          900: '#2C2D90',
          950: '#1E1F60',
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px rgb(16 24 40 / 0.025), 0 4px 12px rgb(16 24 40 / 0.025)',
        'elevated': '0 4px 12px rgb(16 24 40 / 0.04), 0 12px 32px rgb(16 24 40 / 0.06)',
        // 兼容旧名称
        'card': '0 1px 2px rgb(16 24 40 / 0.025), 0 4px 12px rgb(16 24 40 / 0.025)',
        'card-hover': '0 4px 12px rgb(16 24 40 / 0.04), 0 12px 32px rgb(16 24 40 / 0.06)',
      },
      borderRadius: {
        // 语义化圆角
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s linear infinite',
      },
      letterSpacing: {
        'tightest': '-0.03em',
      },
    },
  },
  plugins: [],
};
