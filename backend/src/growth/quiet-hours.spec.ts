import { isQuietHour, makeReferralCode } from './growth.service';

describe('growth helpers', () => {
  it('treats a window that crosses midnight as quiet', () => {
    expect(isQuietHour(22, 7, 23)).toBe(true);
    expect(isQuietHour(22, 7, 6)).toBe(true);
    expect(isQuietHour(22, 7, 12)).toBe(false);
  });

  it('builds an 8 character referral code', () => {
    expect(makeReferralCode()).toMatch(/^[A-Z0-9]{8}$/);
  });
});
