const fs = require('fs');
const path = require('path');
const os = require('os');

// 手动解析 .env.production 文件
const envPath = '/var/www/learngrow-crm/.env.production';
let envConfig = {};
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

const pm2LogDir = path.join(os.homedir(), '.pm2', 'logs');

module.exports = {
  apps: [
    {
      name: 'learngrow-crm',
      script: 'npm',
      args: 'run start',
      cwd: '/var/www/learngrow-crm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
        DATA_DIR: envConfig.DATA_DIR || '/var/www/learngrow-crm/data',
        JWT_SECRET: envConfig.JWT_SECRET,
        INITIAL_ADMIN_PASSWORD: envConfig.INITIAL_ADMIN_PASSWORD,
        WX_APPID: envConfig.WX_APPID,
        WX_SECRET: envConfig.WX_SECRET,
        BACKUP_ENCRYPTION_KEY: envConfig.BACKUP_ENCRYPTION_KEY
      },
      error_file: path.join(pm2LogDir, 'learngrow-crm-error.log'),
      out_file: path.join(pm2LogDir, 'learngrow-crm-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
