import { BadRequestException } from '@nestjs/common';
import {
  hashPhoneCode,
  normalizePhone,
  phoneCodesMatch,
  phoneLast4,
} from './phone-mfa.util';

describe('phone MFA helpers', () => {
  it('normalizes US numbers to E.164', () => {
    expect(normalizePhone('(415) 555-2671')).toBe('+14155552671');
    expect(normalizePhone('14155552671')).toBe('+14155552671');
    expect(normalizePhone('+44 7911 123456')).toBe('+447911123456');
  });

  it('rejects numbers that are too short to be a real mobile', () => {
    expect(() => normalizePhone('12345')).toThrow(BadRequestException);
    expect(() => normalizePhone('not a phone')).toThrow(BadRequestException);
  });

  it('compares codes without keeping the plaintext', () => {
    const hash = hashPhoneCode('pepper', '+14155552671', '042013');
    expect(phoneCodesMatch(hash, hashPhoneCode('pepper', '+14155552671', '042013'))).toBe(
      true,
    );
    expect(phoneCodesMatch(hash, hashPhoneCode('pepper', '+14155552671', '000000'))).toBe(
      false,
    );
    expect(phoneLast4('+14155552671')).toBe('2671');
  });
});
