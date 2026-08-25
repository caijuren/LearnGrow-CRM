require('dotenv').config({ path: '/var/www/learngrow-crm/.env.production', quiet: true });

const path = require('path');
const os = require('os');
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
        DATA_DIR: process.env.DATA_DIR || '/var/www/learngrow-crm/data',
        JWT_SECRET: process.env.JWT_SECRET,
        INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,
        WX_APPID: process.env.WX_APPID,
        WX_SECRET: process.env.WX_SECRET
      },
      error_file: path.join(pm2LogDir, 'learngrow-crm-error.log'),
      out_file: path.join(pm2LogDir, 'learngrow-crm-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
