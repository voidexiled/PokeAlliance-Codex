import { describe, expect, it } from 'vitest';

import {
  classifyReturn,
  codeDigits,
  composeBirthDate,
  confirmationArrival,
  formatCountdown,
  passwordLength,
  secondsLeft,
  withoutConfirmedMark,
} from '@/components/account/auth/logic';

describe('auth card rules', () => {
  it('keeps six digits of a typed or pasted code', () => {
    expect(codeDigits('48 19-02')).toBe('481902');
    expect(codeDigits('1234567890')).toBe('123456');
    expect(codeDigits('abc')).toBe('');
  });

  it('counts down in whole seconds and prints m:ss', () => {
    expect(secondsLeft(10_500, 10_000)).toBe(1);
    expect(secondsLeft(9_000, 10_000)).toBe(0);
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });

  it('counts password characters as code points', () => {
    expect(passwordLength('ñandú12345')).toBe(10);
    expect(passwordLength('🔑🔑')).toBe(2);
  });

  it('composes only real calendar dates', () => {
    expect(composeBirthDate('14', '3', '2001')).toBe('2001-03-14');
    expect(composeBirthDate('29', '2', '2004')).toBe('2004-02-29');
    expect(composeBirthDate('29', '2', '2003')).toBeNull();
    expect(composeBirthDate('31', '4', '2001')).toBeNull();
    expect(composeBirthDate('1', '13', '2001')).toBeNull();
    expect(composeBirthDate('1', '1', '01')).toBeNull();
    expect(composeBirthDate('', '1', '2001')).toBeNull();
  });

  it('classifies what a return to the page brought', () => {
    expect(classifyReturn(null, 'discord')).toBeNull();
    expect(classifyReturn('identity_already_exists', 'discord')).toBe('taken');
    expect(classifyReturn('access_denied', 'google')).toBe('cancelled');
    expect(classifyReturn('access_denied', null)).toBe('linkUsed');
    expect(classifyReturn('otp_expired', null)).toBe('linkUsed');
    expect(classifyReturn('server_error', 'discord')).toBe('down');
    expect(classifyReturn('server_error', null)).toBe('other');
  });

  it('reads and removes the confirmation mark', () => {
    const base = 'https://pokealliancewiki.com/es/cuenta/';
    expect(confirmationArrival(`${base}?confirmado=1&code=abc`)).toBe('confirmed');
    expect(
      confirmationArrival(`${base}?confirmado=1#error=access_denied&error_code=otp_expired`),
    ).toBe('linkUsed');
    expect(confirmationArrival(base)).toBeNull();
    expect(withoutConfirmedMark(`${base}?confirmado=1&code=abc`)).toBe(`${base}?code=abc`);
  });
});
