import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Zod Validation', () => {
  it('should validate login schema correctly', () => {
    const LoginSchema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    });

    const valid = LoginSchema.safeParse({ username: 'admin', password: 'admin123' });
    expect(valid.success).toBe(true);

    const invalid = LoginSchema.safeParse({ username: '', password: '' });
    expect(invalid.success).toBe(false);
  });
});

describe('JSON Field Parsing', () => {
  function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  it('should parse valid JSON', () => {
    expect(parseJsonField('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(parseJsonField('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('should return fallback for null/undefined/invalid', () => {
    expect(parseJsonField(null, [])).toEqual([]);
    expect(parseJsonField(undefined, {})).toEqual({});
    expect(parseJsonField('invalid', [])).toEqual([]);
  });
});
