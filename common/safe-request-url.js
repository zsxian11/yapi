const URL = require('url');

const METADATA_HOSTS = {
  'metadata.google.internal': true,
  'metadata.goog': true,
  'instance-data': true
};

function parseIPv4(host) {
  if (!host || typeof host !== 'string') return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(n => n > 255)) return null;
  return parts;
}

function extractMappedIPv4(host) {
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(host);
  return m ? parseIPv4(m[1]) : null;
}

function isLoopbackIPv4(parts) {
  return parts[0] === 127 || parts[0] === 0;
}

function isLinkLocalIPv4(parts) {
  return parts[0] === 169 && parts[1] === 254;
}

function isPrivateIPv4(parts) {
  if (isLoopbackIPv4(parts) || isLinkLocalIPv4(parts)) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  return false;
}

function isMetadataIPv4(parts) {
  if (parts[0] === 169 && parts[1] === 254 && parts[2] === 169 && parts[3] === 254) return true;
  if (parts[0] === 100 && parts[1] === 100 && parts[2] === 100 && parts[3] === 200) return true;
  return false;
}

function isLoopbackIPv6(host) {
  return host === '::1' || host === '0:0:0:0:0:0:0:1';
}

function isPrivateIPv6(host) {
  if (isLoopbackIPv6(host)) return true;
  if (host === '::' || host === '::0') return true;
  if (host.indexOf('fc') === 0 || host.indexOf('fd') === 0) return true;
  if (host.indexOf('fe80:') === 0) return true;
  return false;
}

function normalizeHostname(hostname) {
  if (!hostname) return '';
  return String(hostname)
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
}

function classifyHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (!host) {
    return { kind: 'invalid' };
  }
  if (METADATA_HOSTS[host]) {
    return { kind: 'metadata', host };
  }
  if (host === 'localhost' || host === 'localhost.localdomain') {
    return { kind: 'loopback', host };
  }

  const mapped = extractMappedIPv4(host);
  const ipv4 = mapped || parseIPv4(host);
  if (ipv4) {
    if (isMetadataIPv4(ipv4)) return { kind: 'metadata', host };
    if (isLoopbackIPv4(ipv4)) return { kind: 'loopback', host };
    if (isPrivateIPv4(ipv4)) return { kind: 'private', host };
    return { kind: 'public', host };
  }

  if (host.indexOf(':') !== -1) {
    if (isLoopbackIPv6(host)) return { kind: 'loopback', host };
    if (isPrivateIPv6(host)) return { kind: 'private', host };
    return { kind: 'public', host };
  }

  return { kind: 'public', host };
}

function isLoopbackUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
    const parsed = URL.parse(normalized);
    return classifyHostname(parsed.hostname).kind === 'loopback';
  } catch (e) {
    return false;
  }
}

/**
 * 校验服务端代发目标 URL，防止 SSRF。
 * @param {string} rawUrl
 * @param {{ allowPrivateIp?: boolean }} [options]
 * @returns {{ ok: true, url: string, kind: string } | { ok: false, message: string }}
 */
function assertSafeProxyTarget(rawUrl, options = {}) {
  const allowPrivateIp = options.allowPrivateIp !== false;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, message: '请求地址不能为空' };
  }

  let parsed;
  try {
    parsed = URL.parse(rawUrl);
  } catch (e) {
    return { ok: false, message: '请求地址格式无效' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: '仅允许 http/https 协议' };
  }
  if (!parsed.hostname) {
    return { ok: false, message: '请求地址缺少主机名' };
  }

  const classified = classifyHostname(parsed.hostname);
  if (classified.kind === 'invalid') {
    return { ok: false, message: '请求地址主机名无效' };
  }
  if (classified.kind === 'metadata') {
    return { ok: false, message: '禁止访问元数据/链路本地地址' };
  }
  if (!allowPrivateIp && (classified.kind === 'loopback' || classified.kind === 'private')) {
    return {
      ok: false,
      message: '当前配置禁止服务器代理访问内网/本机地址，请改用浏览器直发或在 config.json 中设置 runProxy.allowPrivateIp 为 true'
    };
  }

  return { ok: true, url: rawUrl, kind: classified.kind };
}

module.exports = {
  assertSafeProxyTarget,
  classifyHostname,
  isLoopbackUrl
};
