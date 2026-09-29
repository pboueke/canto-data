'use strict';

const { parseArgs } = require('../lib/args');

describe('parseArgs', () => {
  test('parses --name value pairs', () => {
    expect(parseArgs(['--a', '1', '--b', 'two'], ['a', 'b'])).toEqual({ a: '1', b: 'two' });
  });

  test('rejects malformed pairs', () => {
    expect(() => parseArgs(['a', '1'], ['a'])).toThrow(/expected --name value arguments/);
    expect(() => parseArgs(['--a'], ['a'])).toThrow(/expected --name value arguments/);
  });

  test('rejects missing and empty required values', () => {
    expect(() => parseArgs([], ['a'])).toThrow(/missing --a/);
    expect(() => parseArgs(['--a', ''], ['a'])).toThrow(/missing --a/);
  });
});
