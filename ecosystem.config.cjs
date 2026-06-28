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
        PORT: 3456
      },
      error_file: '/var/log/learngrow-crm/error.log',
      out_file: '/var/log/learngrow-crm/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
