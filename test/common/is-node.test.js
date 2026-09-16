import { describe, it, expect } from 'vitest';
import { transformWithEsbuild } from 'vite';

describe('isNode detection under Vite define', () => {
  it('keeps typeof window so the browser is not treated as Node', async () => {
    const src = 'const isNode = typeof window === "undefined";';
    const { code } = await transformWithEsbuild(src, 'postmanLib.js', {
      define: { global: 'globalThis' },
      loader: 'js'
    });
    expect(code).toContain('typeof window');
    expect(code).not.toMatch(/globalThis\.global === globalThis/);
  });

  it('rewrites the legacy global.global check into a browser-true expression', async () => {
    const src = 'const isNode = typeof global == "object" && global.global === global;';
    const { code } = await transformWithEsbuild(src, 'legacy.js', {
      define: { global: 'globalThis' },
      loader: 'js'
    });
    expect(code).toContain('globalThis.global === globalThis');
  });
});
