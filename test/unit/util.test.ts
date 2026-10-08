/*
 * Copyright Fastly, Inc.
 * Licensed under the MIT license. See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { loadOptionalStringMap } from '../../src/util.js';

describe('loadOptionalStringMap', () => {
  it('returns the value produced by the getter', () => {
    const map = loadOptionalStringMap((key) => `value-of-${key}`);
    assert.equal(map.foo, 'value-of-foo');
    assert.equal(map['with spaces and-dashes'], 'value-of-with spaces and-dashes');
  });

  it('returns undefined when the getter returns undefined', () => {
    const map = loadOptionalStringMap(() => undefined);
    assert.equal(map.foo, undefined);
  });

  it('does not call the getter until a property is accessed', () => {
    const getter = mock.fn((key: string) => key);
    loadOptionalStringMap(getter);
    assert.equal(getter.mock.callCount(), 0);
  });

  it('calls the getter once per key and caches the result', () => {
    const getter = mock.fn((key: string) => ({ key }));
    const map = loadOptionalStringMap(getter);

    const first = map.foo;
    const second = map.foo;
    assert.equal(first, second);
    assert.equal(getter.mock.callCount(), 1);

    map.bar;
    assert.deepEqual(getter.mock.calls.map((c) => c.arguments), [['foo'], ['bar']]);
  });

  it('caches undefined results too', () => {
    const getter = mock.fn(() => undefined);
    const map = loadOptionalStringMap(getter);
    map.missing;
    map.missing;
    'missing' in map;
    assert.equal(getter.mock.callCount(), 1);
  });

  it('shares the cache between get and has', () => {
    const getter = mock.fn((key: string) => key);
    const map = loadOptionalStringMap(getter);
    assert.equal('foo' in map, true);
    assert.equal(map.foo, 'foo');
    assert.equal(getter.mock.callCount(), 1);
  });

  it('reports `in` based on whether the value is defined', () => {
    const map = loadOptionalStringMap((key) => (key === 'present' ? 'yes' : undefined));
    assert.equal('present' in map, true);
    assert.equal('missing' in map, false);
  });

  it('treats falsy but defined values as present', () => {
    const map = loadOptionalStringMap((key) => (key === 'empty' ? '' : undefined));
    assert.equal(map.empty, '');
    assert.equal('empty' in map, true);
  });

  it('ignores symbol keys without calling the getter', () => {
    const getter = mock.fn((key: string) => key);
    const map = loadOptionalStringMap(getter) as Record<PropertyKey, unknown>;
    assert.equal(map[Symbol.iterator], undefined);
    assert.equal(Symbol.toPrimitive in map, false);
    assert.equal(getter.mock.callCount(), 0);
  });

  it('is not enumerable', () => {
    const map = loadOptionalStringMap((key) => key);
    map.foo;
    assert.deepEqual(Object.keys(map), []);
  });

  it('keeps separate caches per map', () => {
    let n = 0;
    const getter = () => ++n;
    const a = loadOptionalStringMap(getter);
    const b = loadOptionalStringMap(getter);
    assert.equal(a.foo, 1);
    assert.equal(b.foo, 2);
    assert.equal(a.foo, 1);
  });
});
