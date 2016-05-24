import requireResolve from '../requireResolve';

describe('requireResolve', () => {
  it('returns relative paths', () => {
    expect(requireResolve('eslint')).toEqual('node_modules/eslint/lib/api.js');
  });
});
