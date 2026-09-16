'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.YAPI_CONFIG_PATH || '/yapi/config.json';
const DEFAULT_PATH = path.join(__dirname, 'config.json');

function parseBool(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseNumber(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function setIf(target, key, value) {
  if (value === undefined || value === '') {
    return;
  }
  target[key] = value;
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return readJson(CONFIG_PATH);
  }
  if (fs.existsSync(DEFAULT_PATH)) {
    return readJson(DEFAULT_PATH);
  }
  return {
    port: '3000',
    adminAccount: 'admin@admin.com',
    timeout: 120000,
    db: {
      servername: 'mongo',
      DATABASE: 'yapi',
      port: 27017
    },
    mail: { enable: false }
  };
}

const env = process.env;
const config = loadConfig();

setIf(config, 'port', env.YAPI_PORT || env.PORT);
setIf(config, 'adminAccount', env.YAPI_ADMIN_ACCOUNT);
setIf(config, 'timeout', parseNumber(env.YAPI_TIMEOUT));
setIf(config, 'closeRegister', parseBool(env.YAPI_CLOSE_REGISTER));
setIf(config, 'versionNotify', parseBool(env.YAPI_VERSION_NOTIFY));

const db = ensureObject(config, 'db');
setIf(db, 'servername', env.YAPI_DB_SERVERNAME);
setIf(db, 'port', parseNumber(env.YAPI_DB_PORT));
setIf(db, 'DATABASE', env.YAPI_DB_DATABASE);
setIf(db, 'user', env.YAPI_DB_USER);
setIf(db, 'pass', env.YAPI_DB_PASS);
setIf(db, 'authSource', env.YAPI_DB_AUTHSOURCE);
setIf(db, 'connectString', env.YAPI_DB_CONNECTSTRING);

const mail = ensureObject(config, 'mail');
setIf(mail, 'enable', parseBool(env.YAPI_MAIL_ENABLE));
setIf(mail, 'host', env.YAPI_MAIL_HOST);
setIf(mail, 'port', parseNumber(env.YAPI_MAIL_PORT));
setIf(mail, 'from', env.YAPI_MAIL_FROM);
if (env.YAPI_MAIL_USER || env.YAPI_MAIL_PASS) {
  const auth = ensureObject(mail, 'auth');
  setIf(auth, 'user', env.YAPI_MAIL_USER);
  setIf(auth, 'pass', env.YAPI_MAIL_PASS);
}

const passkey = ensureObject(config, 'passkey');
setIf(passkey, 'rpName', env.YAPI_PASSKEY_RP_NAME);
setIf(passkey, 'rpID', env.YAPI_PASSKEY_RP_ID);
setIf(passkey, 'origin', env.YAPI_PASSKEY_ORIGIN);

const runProxy = ensureObject(config, 'runProxy');
setIf(runProxy, 'timeout', parseNumber(env.YAPI_RUN_PROXY_TIMEOUT));
setIf(runProxy, 'maxBodySize', parseNumber(env.YAPI_RUN_PROXY_MAX_BODY_SIZE));
setIf(runProxy, 'allowPrivateIp', parseBool(env.YAPI_RUN_PROXY_ALLOW_PRIVATE_IP));

const configDir = path.dirname(CONFIG_PATH);
fs.mkdirSync(configDir, { recursive: true });

try {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
} catch (err) {
  if (err && (err.code === 'EACCES' || err.code === 'EROFS' || err.code === 'EPERM')) {
    console.warn(
      `[yapi] ${CONFIG_PATH} 只读，已跳过环境变量写入。如需用环境变量配置，请不要以 :ro 挂载该文件。`
    );
    process.exit(0);
  }
  throw err;
}
