import { describe, expect, it } from 'vitest';
import { resolveJwtSecret } from '../api/services/auth';

describe('production security config', () => {
  it('rejects missing production JWT_SECRET', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
  });

  it('rejects short production JWT_SECRET', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' })).toThrow('JWT_SECRET');
  });

  it('accepts a strong production JWT_SECRET', () => {
    const secret = 'abcdefghijklmnopqrstuvwxyz1234567890';
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret })).toBe(secret);
  });

  it('keeps the development fallback for local startup', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'development' })).toBeTruthy();
  });
});
