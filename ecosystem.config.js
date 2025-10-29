module.exports = {
  apps: [{
    name: 'bild-api-oracle-fusion',
    script: 'dist/main.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Configurações de log
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Configurações de restart
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '1G',
    
    // Configurações de cluster
    min_uptime: '10s',
    max_restarts: 10,
    
    // Configurações de health check
    health_check_grace_period: 3000,
    
    // Configurações de timeout
    kill_timeout: 5000,
    
    // Configurações de merge logs
    merge_logs: true,
    
    // Configurações de autorestart
    autorestart: true,
    
    // Configurações de cron restart (opcional)
    // cron_restart: '0 2 * * *', // Restart diário às 2h
    
    // Configurações de variáveis de ambiente
    env_file: '.env'
  }]
};
