module.exports = {
    apps: [{
        name: 'cupsize-api',
        script: 'dist/server.js',
        cwd: '/var/www/lifonmusic/backend',
        // env берётся из .env файла рядом с server.js
        env_file: '/var/www/lifonmusic/backend/.env',
        error_file: '/var/log/pm2/cupsize-api-error.log',
        out_file:   '/var/log/pm2/cupsize-api-out.log',
        restart_delay: 3000,
        max_restarts: 10,
        watch: false,
    }],
};
