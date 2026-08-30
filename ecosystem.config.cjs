const fs = require('fs');
const path = require('path');
const os = require('os');

// 解析 .env.production 文件（支持多个路径）
const possiblePaths = [
  '/var/www/learngrow-crm/.env.production',
  '/opt/learngrow-crm/.env.production',
  './.env.production'
];

let envPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

let envConfig = {};
if (envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envConfig = envContent
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        acc[key.trim()] = valueParts.join('=').trim();
        return acc;
      }, {});
  } catch (e) {
    console.error('Warning: Could not read .env.production:', e.message);
  }
} else {
  console.warn('Warning: .env.production not found in standard locations');
}

const pm2LogDir = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs');
const deployDir = process.env.DEPLOY_DIR || '/opt/learngrow-crm';
const dataDir = process.env.DATA_DIR || envConfig.DATA_DIR || '/opt/learngrow-crm/data';

module.exports = {
  apps: [
    {
      name: 'learngrow-crm',
      script: 'npm',
      args: 'run start',
      cwd: deployDir + '/current',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
        DATA_DIR: dataDir,
        DATABASE_URL: dataDir + '/learngrow.db',
        JWT_SECRET: envConfig.JWT_SECRET,
        INITIAL_ADMIN_PASSWORD: envConfig.INITIAL_ADMIN_PASSWORD,
        WX_APPID: envConfig.WX_APPID,
        WX_SECRET: envConfig.WX_SECRET,
        BACKUP_ENCRYPTION_KEY: envConfig.BACKUP_ENCRYPTION_KEY,
        WECHAT_WEBHOOK_URL: envConfig.WECHAT_WEBHOOK_URL
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
