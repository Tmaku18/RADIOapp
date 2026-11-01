import { normalizeFanEmail } from './fans.service';

describe('normalizeFanEmail', () => {
  it('lowercases a valid address', () => {
    expect(normalizeFanEmail('  Fan@Example.com ')).toBe('fan@example.com');
  });

  it('rejects a missing domain', () => {
    expect(normalizeFanEmail('not-an-email')).toBeNull();
  });
});
