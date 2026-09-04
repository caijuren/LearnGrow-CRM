const fs = require('fs');
const path = require('path');
const os = require('os');

// 解析 .env.production 文件：扫描所有候选路径并合并，路径越靠前优先级越高。
// 这样即使某个文件只含部分键（如只有 VITE_API_BASE_URL），也不会遮蔽其他文件里的密钥。
const homeDir = os.homedir();
const possiblePaths = [
  path.join(homeDir, 'learngrow-crm', '.env.production'),
  '/home/ubuntu/learngrow-crm/.env.production',
  path.join(homeDir, '.env.production'),
  path.join(homeDir, 'learngrow-crm', 'current', '.env.production'),
  '/var/www/learngrow-crm/.env.production',
  '/opt/learngrow-crm/.env.production',
  './.env.production'
];

function parseEnvFile(content) {
  return content
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      acc[key.trim()] = valueParts.join('=').trim();
      return acc;
    }, {});
}

const envConfig = {};
const envPathsFound = [];
for (const p of possiblePaths) {
  try {
    if (fs.existsSync(p)) {
      envPathsFound.push(p);
      const parsed = parseEnvFile(fs.readFileSync(p, 'utf8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (!(k in envConfig)) envConfig[k] = v;
      }
    }
  } catch (e) {
    console.error('Warning: Could not read .env.production at ' + p + ':', e.message);
  }
}
if (envPathsFound.length === 0) {
  console.warn('Warning: .env.production not found in standard locations');
} else {
  console.log('Loaded env files (precedence order):', envPathsFound.join(', '));
}

const pm2LogDir = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs');
const deployDir = process.env.DEPLOY_DIR || '/var/www/learngrow-crm';
const dataDir = process.env.DATA_DIR || envConfig.DATA_DIR || path.join(deployDir, 'data');

module.exports = {
  apps: [
    {
      name: 'learngrow-crm',
      script: 'npm',
      args: 'run start',
      cwd: deployDir,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
        DATA_DIR: dataDir,
        DATABASE_URL: dataDir + '/learngrow.db',
        JWT_SECRET: envConfig.JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key-change-in-production-min-32-chars!!!',
        INITIAL_ADMIN_PASSWORD: envConfig.INITIAL_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD,
        WX_APPID: envConfig.WX_APPID || process.env.WX_APPID,
        WX_SECRET: envConfig.WX_SECRET || process.env.WX_SECRET,
        BACKUP_ENCRYPTION_KEY: envConfig.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY,
        WECHAT_WEBHOOK_URL: envConfig.WECHAT_WEBHOOK_URL || process.env.WECHAT_WEBHOOK_URL
      },
      error_file: path.join(pm2LogDir, 'learngrow-crm-error.log'),
      out_file: path.join(pm2LogDir, 'learngrow-crm-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};
