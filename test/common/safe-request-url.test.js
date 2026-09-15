import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertSafeProxyTarget,
  classifyHostname,
  isLoopbackUrl
} = require('../../common/safe-request-url.js');

describe('assertSafeProxyTarget', () => {
  it('allows public http/https urls', () => {
    expect(assertSafeProxyTarget('https://httpbin.org/get').ok).toBe(true);
    expect(assertSafeProxyTarget('http://example.com/api').ok).toBe(true);
  });

  it('rejects empty or non-http protocols', () => {
    expect(assertSafeProxyTarget('').ok).toBe(false);
    expect(assertSafeProxyTarget('ftp://example.com/a').ok).toBe(false);
    expect(assertSafeProxyTarget('file:///etc/passwd').ok).toBe(false);
    expect(assertSafeProxyTarget('javascript:alert(1)').ok).toBe(false);
  });

  it('always blocks cloud metadata addresses', () => {
    expect(assertSafeProxyTarget('http://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(assertSafeProxyTarget('http://metadata.google.internal/').ok).toBe(false);
    expect(assertSafeProxyTarget('http://100.100.100.200/latest/meta-data', { allowPrivateIp: true }).ok).toBe(
      false
    );
    expect(assertSafeProxyTarget('http://[::ffff:169.254.169.254]/', { allowPrivateIp: true }).ok).toBe(false);
  });

  it('allows private and loopback addresses when allowPrivateIp is true', () => {
    expect(assertSafeProxyTarget('http://127.0.0.1:3001/api', { allowPrivateIp: true }).ok).toBe(true);
    expect(assertSafeProxyTarget('http://localhost:8080/api', { allowPrivateIp: true }).ok).toBe(true);
    expect(assertSafeProxyTarget('http://192.168.1.10/v1', { allowPrivateIp: true }).ok).toBe(true);
    expect(assertSafeProxyTarget('http://10.0.0.8:8080/', { allowPrivateIp: true }).ok).toBe(true);
  });

  it('rejects private and loopback addresses when allowPrivateIp is false', () => {
    expect(assertSafeProxyTarget('http://127.0.0.1:3001/api', { allowPrivateIp: false }).ok).toBe(false);
    expect(assertSafeProxyTarget('http://localhost:8080/api', { allowPrivateIp: false }).ok).toBe(false);
    expect(assertSafeProxyTarget('http://192.168.1.10/v1', { allowPrivateIp: false }).ok).toBe(false);
    expect(assertSafeProxyTarget('http://10.0.0.8:8080/', { allowPrivateIp: false }).ok).toBe(false);
  });
});

describe('classifyHostname / isLoopbackUrl', () => {
  it('classifies loopback hosts', () => {
    expect(classifyHostname('localhost').kind).toBe('loopback');
    expect(classifyHostname('127.0.0.1').kind).toBe('loopback');
    expect(classifyHostname('::1').kind).toBe('loopback');
  });

  it('detects loopback urls', () => {
    expect(isLoopbackUrl('http://localhost:3001/users')).toBe(true);
    expect(isLoopbackUrl('http://127.0.0.1/')).toBe(true);
    expect(isLoopbackUrl('localhost:3001')).toBe(true);
    expect(isLoopbackUrl('https://api.example.com/')).toBe(false);
  });
});
