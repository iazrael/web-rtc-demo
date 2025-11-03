module.exports = {
  apps: [
    {
      name: 'rtc-demo-server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      cwd: '/data/azrael/workspaces/agent_web_rtc_sample/server',
      env: {
        NODE_ENV: 'production',
        HTTP_PORT: 3333,
        HTTPS_PORT: 3333
      },
      env_development: {
        NODE_ENV: 'development'
      },
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true
    }
  ]
};
