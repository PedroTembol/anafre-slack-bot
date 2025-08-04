module.exports = {
  apps: [
    {
      name: 'whatsapp-cron-bot',
      script: 'whatsapp-slack-bot.js',
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 10000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/whatsapp-cron-err.log',
      out_file: './logs/whatsapp-cron-out.log',
      log_file: './logs/whatsapp-cron-combined.log',
      time: true
    },
    {
      name: 'slack-server',
      script: 'slack-server.js',
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/slack-server-err.log',
      out_file: './logs/slack-server-out.log',
      log_file: './logs/slack-server-combined.log',
      time: true
    }
  ]
};