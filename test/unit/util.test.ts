/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import { describe, expect, it, vi } from 'vitest';
import { loadOptionalStringMap } from '../../src/util.js';

describe('loadOptionalStringMap', () => {
  it('returns the value produced by the getter', () => {
    const map = loadOptionalStringMap((key) => `value-of-${key}`);
    expect(map.foo).toBe('value-of-foo');
    expect(map['with spaces and-dashes']).toBe('value-of-with spaces and-dashes');
  });

  it('returns undefined when the getter returns undefined', () => {
    const map = loadOptionalStringMap(() => undefined);
    expect(map.foo).toBeUndefined();
  });

  it('does not call the getter until a property is accessed', () => {
    const getter = vi.fn((key: string) => key);
    loadOptionalStringMap(getter);
    expect(getter).not.toHaveBeenCalled();
  });

  it('calls the getter once per key and caches the result', () => {
    const getter = vi.fn((key: string) => ({ key }));
    const map = loadOptionalStringMap(getter);

    const first = map.foo;
    const second = map.foo;
    expect(first).toBe(second);
    expect(getter).toHaveBeenCalledTimes(1);

    map.bar;
    expect(getter).toHaveBeenCalledTimes(2);
    expect(getter).toHaveBeenNthCalledWith(1, 'foo');
    expect(getter).toHaveBeenNthCalledWith(2, 'bar');
  });

  it('caches undefined results too', () => {
    const getter = vi.fn(() => undefined);
    const map = loadOptionalStringMap(getter);
    map.missing;
    map.missing;
    'missing' in map;
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('shares the cache between get and has', () => {
    const getter = vi.fn((key: string) => key);
    const map = loadOptionalStringMap(getter);
    expect('foo' in map).toBe(true);
    expect(map.foo).toBe('foo');
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it('reports `in` based on whether the value is defined', () => {
    const map = loadOptionalStringMap((key) => (key === 'present' ? 'yes' : undefined));
    expect('present' in map).toBe(true);
    expect('missing' in map).toBe(false);
  });

  it('treats falsy but defined values as present', () => {
    const map = loadOptionalStringMap((key) => (key === 'empty' ? '' : undefined));
    expect(map.empty).toBe('');
    expect('empty' in map).toBe(true);
  });

  it('ignores symbol keys without calling the getter', () => {
    const getter = vi.fn((key: string) => key);
    const map = loadOptionalStringMap(getter) as Record<PropertyKey, unknown>;
    expect(map[Symbol.iterator]).toBeUndefined();
    expect(Symbol.toPrimitive in map).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('is not enumerable', () => {
    const map = loadOptionalStringMap((key) => key);
    map.foo;
    expect(Object.keys(map)).toEqual([]);
  });

  it('keeps separate caches per map', () => {
    let n = 0;
    const getter = () => ++n;
    const a = loadOptionalStringMap(getter);
    const b = loadOptionalStringMap(getter);
    expect(a.foo).toBe(1);
    expect(b.foo).toBe(2);
    expect(a.foo).toBe(1);
  });
});
