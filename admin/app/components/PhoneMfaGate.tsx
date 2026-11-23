'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface PhoneMfaGateProps {
  phoneVerified: boolean;
  phoneLast4: string | null;
  getToken: () => Promise<string | null>;
  onVerified: () => void;
  onSignOut: () => Promise<void>;
}

async function phoneRequest(
  path: string,
  token: string,
  body: Record<string, string>,
): Promise<{ phoneLast4?: string; message?: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    phoneLast4?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export default function PhoneMfaGate({
  phoneVerified,
  phoneLast4,
  getToken,
  onVerified,
  onSignOut,
}: PhoneMfaGateProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(
    phoneVerified && phoneLast4 ? phoneLast4 : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSent = useRef(false);

  const sendCode = async (nextPhone?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to get a text.');
      const data = await phoneRequest(
        '/auth/phone/send',
        token,
        nextPhone ? { phone: nextPhone } : {},
      );
      setSentTo(data.phoneLast4 || phoneLast4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the text.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!phoneVerified || autoSent.current) return;
    autoSent.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneVerified]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from the text.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again to verify the code.');
      await phoneRequest('/auth/phone/verify', token, { code: code.trim() });
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirm it&apos;s you</h1>
        <p className="text-gray-600 mb-6">
          {phoneVerified
            ? `Enter the code we text to the number ending in ${phoneLast4 ?? 'your phone'}.`
            : 'Add the mobile number for this admin account. Each number can only be used once.'}
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {sentTo == null ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode(phoneVerified ? undefined : phone.trim());
            }}
          >
            {!phoneVerified && (
              <label className="block text-sm font-medium text-gray-700">
                Mobile number
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-purple-600 text-white py-2 font-medium disabled:opacity-60"
            >
              {submitting ? 'Sending text…' : 'Text me a code'}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={verify}>
            <label className="block text-sm font-medium text-gray-700">
              Code sent to •••{sentTo}
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-purple-600 text-white py-2 font-medium disabled:opacity-60"
            >
              {submitting ? 'Checking…' : 'Verify and continue'}
            </button>
            <button
              type="button"
              disabled={submitting}
              className="w-full rounded border border-gray-300 py-2"
              onClick={() => void sendCode(phoneVerified ? undefined : phone.trim())}
            >
              Resend text
            </button>
          </form>
        )}
        <button
          type="button"
          className="w-full mt-4 text-sm text-gray-500"
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
