import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { BadRequestException } from '@nestjs/common';

const E164 = /^\+[1-9]\d{7,14}$/;

/** Last four digits for display. Never log or return the full number. */
export function phoneLast4(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function maskPhone(e164: string): string {
  return `***${phoneLast4(e164) ?? '????'}`;
}

/**
 * Accept a US local number or an international number and return E.164.
 * Rejects anything that is not a plausible mobile number.
 */
export function normalizePhone(raw: string): string {
  const compact = raw.trim().replace(/[^\d+]/g, '');
  let e164 = compact;
  if (!e164.startsWith('+')) {
    if (e164.length === 10) e164 = `+1${e164}`;
    else if (e164.length === 11 && e164.startsWith('1')) e164 = `+${e164}`;
    else e164 = `+${e164}`;
  }
  if (!E164.test(e164)) {
    throw new BadRequestException(
      'Enter a valid mobile number, including the area code.',
    );
  }
  return e164;
}

export function generatePhoneCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashPhoneCode(
  pepper: string,
  phone: string,
  code: string,
): string {
  return createHmac('sha256', pepper).update(`${phone}:${code}`).digest('hex');
}

export function phoneCodesMatch(expectedHash: string, actualHash: string): boolean {
  const expected = Buffer.from(expectedHash);
  const actual = Buffer.from(actualHash);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
