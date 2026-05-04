import { redirect } from 'next/navigation';

/**
 * The full profile editor lives at /pro-networx/onboarding. The new tab nav
 * exposes it as "My profile" via /pro-networx/me; both URLs are valid.
 */
export default function ProNetworxMeRedirectPage() {
  redirect('/pro-networx/onboarding');
}
