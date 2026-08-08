import { isRefinerySubmissionFree } from './refinery-questions';

describe('isRefinerySubmissionFree', () => {
  const originalRefinery = process.env.REFINERY_FREE_SUBMISSIONS;
  const originalBeta = process.env.BETA_ALL_FREE;

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  afterEach(() => {
    restore('REFINERY_FREE_SUBMISSIONS', originalRefinery);
    restore('BETA_ALL_FREE', originalBeta);
  });

  it('is free during beta so mobile has a way into The Refinery', () => {
    delete process.env.REFINERY_FREE_SUBMISSIONS;
    delete process.env.BETA_ALL_FREE;
    expect(isRefinerySubmissionFree()).toBe(true);
  });

  it('follows the master beta switch when unset', () => {
    delete process.env.REFINERY_FREE_SUBMISSIONS;
    process.env.BETA_ALL_FREE = 'false';
    expect(isRefinerySubmissionFree()).toBe(false);
  });

  it('can require the fee independently of the wider beta', () => {
    process.env.BETA_ALL_FREE = 'true';
    process.env.REFINERY_FREE_SUBMISSIONS = 'false';
    expect(isRefinerySubmissionFree()).toBe(false);
  });

  it('can stay free after beta ends', () => {
    process.env.BETA_ALL_FREE = 'false';
    process.env.REFINERY_FREE_SUBMISSIONS = 'true';
    expect(isRefinerySubmissionFree()).toBe(true);
  });

  it('ignores a blank override rather than treating it as off', () => {
    process.env.REFINERY_FREE_SUBMISSIONS = '   ';
    process.env.BETA_ALL_FREE = 'true';
    expect(isRefinerySubmissionFree()).toBe(true);
  });
});
