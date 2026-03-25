const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const VENV_PYTHON = path.join(ROOT_DIR, 'venv', 'Scripts', 'python.exe');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');

function loadDotEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) {
    return vars;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) {
      vars[key] = value;
    }
  }
  return vars;
}

const fileEnv = loadDotEnv(ENV_FILE);
const sharedEnv = {
  ...fileEnv,
  ...process.env,
};

module.exports = {
  apps: [
    {
      name: 'orion-backend',
      cwd: BACKEND_DIR,
      script: path.join(BACKEND_DIR, 'manage.py'),
      args: 'runserver 0.0.0.0:8000',
      interpreter: VENV_PYTHON,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      pmx: false,
      error_file: path.join(LOGS_DIR, 'err.log'),
      out_file: path.join(LOGS_DIR, 'out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        ...sharedEnv,
        DJANGO_SETTINGS_MODULE: 'orion_backend.settings',
        PYTHONUNBUFFERED: '1',
      },
    },
    {
      name: 'orion-frontend',
      cwd: FRONTEND_DIR,
      script: 'cmd',
      args: '/c npm start',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      pmx: false,
      error_file: path.join(LOGS_DIR, 'err.log'),
      out_file: path.join(LOGS_DIR, 'out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        ...sharedEnv,
        PORT: sharedEnv.PORT || '3000',
      },
    },
  ],
};
