import { validate, getDefaultConfig } from '../configurationSchema.js';

it('should export defaults as an object', () => {
  const config = getDefaultConfig();

  expect(config.aliases).toEqual({});
});

it('should validate successfully', () => {
  const result = validate({
    aliases: {
      _: 'third-party-libs/underscore',
    },
  });
  expect(result.error).toEqual(false);
  expect(result.messages).toEqual([]);
});

it('should notify about unknown identifiers, and remove them', () => {
  const data = {
    thisAintRight: 'better fail',
  };
  const result = validate(data);
  expect(result.error).toEqual(true);
  expect(result.messages[0]).toEqual('Unknown configuration: `thisAintRight`');
  expect(Object.prototype.hasOwnProperty.call(data, 'thisAintRight')).toBe(
    false,
  );
});

it('should handle functions', () => {
  const result = validate({
    aliases: () => ({ _: 'third-party-libs/underscore' }),
  });
  expect(result.error).toEqual(false);
});

it('should notify about invalid identifiers, and remove them', () => {
  const data = {
    aliases: 123,
  };
  const result = validate(data);
  expect(result.error).toEqual(true);
  expect(result.messages.length).toEqual(1);
  expect(result.messages[0]).toEqual('Invalid configuration: `aliases`');
  expect(Object.prototype.hasOwnProperty.call(data, 'aliases')).toBe(false);
});
