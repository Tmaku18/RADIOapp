import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Your Account — NETWORX',
  description:
    'Request deletion of your NETWORX account and associated personal data.',
};

export default function DeleteAccountPage() {
  const subject = encodeURIComponent('Delete My NETWORX Account');
  const body = encodeURIComponent(
    [
      'Hello NETWORX Support,',
      '',
      'I would like to permanently delete my NETWORX account and associated personal data.',
      '',
      'Account email: ',
      'Display name (optional): ',
      'Reason (optional): ',
      '',
      'Thank you.',
    ].join('\n'),
  );
  const mailto = `mailto:support@networxradio.com?subject=${subject}&body=${body}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
      <header>
        <h1 className="text-4xl font-bold text-foreground">
          Delete Your Account
        </h1>
        <p className="text-muted-foreground mt-3">
          Last updated: March 28, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          You can permanently delete your NETWORX account and associated personal
          data at any time. Account deletion is irreversible. Once deleted, you
          will lose access to your profile, library, uploads, purchase history,
          credits, and any in-app earnings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">In-App Deletion</h2>
        <p className="text-muted-foreground">
          The fastest way to delete your account is from inside the NETWORX app:
        </p>
        <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
          <li>Open the NETWORX app and sign in.</li>
          <li>
            Go to <strong>Settings</strong> → <strong>Account</strong>.
          </li>
          <li>
            Tap <strong>Delete account</strong> and confirm.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Request by Email</h2>
        <p className="text-muted-foreground">
          If you cannot access the app, send a deletion request to our support
          team. We verify the request against the account on file and process it
          within 30 days.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Email a deletion request
        </a>
        <p className="text-sm text-muted-foreground">
          Or write to{' '}
          <a
            className="text-primary hover:underline"
            href="mailto:support@networxradio.com"
          >
            support@networxradio.com
          </a>{' '}
          from the email address linked to your NETWORX account, with the
          subject line <em>&ldquo;Delete My NETWORX Account.&rdquo;</em>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">What Gets Deleted</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Your account profile (display name, bio, profile photo).</li>
          <li>Authentication records (email/password, Google, or Apple link).</li>
          <li>
            Uploaded songs, posts, livestream recordings, chat messages, and
            reactions.
          </li>
          <li>Library items, favorites, follows, and play history.</li>
          <li>
            Stored payment metadata held by NETWORX (transactions completed via
            Google Play or Stripe will retain their own records as required by
            those processors and applicable law).
          </li>
          <li>
            Push notification tokens and device-linked preferences.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">What May Be Retained</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            Aggregated, de-identified analytics that cannot be linked back to
            you.
          </li>
          <li>
            Records we are legally required to keep (e.g., financial records,
            tax records, anti-fraud, copyright dispute records) for the period
            required by law.
          </li>
          <li>
            Backups, which are securely overwritten on our regular rotation
            schedule (typically within 90 days).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Timeline</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong>In-app requests:</strong> deletion is queued immediately and
            completed within 24 hours.
          </li>
          <li>
            <strong>Email requests:</strong> we acknowledge within 5 business
            days and complete deletion within 30 days of verification.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Questions</h2>
        <p className="text-muted-foreground">
          For any questions about account deletion or your data, contact{' '}
          <a
            className="text-primary hover:underline"
            href="mailto:support@networxradio.com"
          >
            support@networxradio.com
          </a>
          . You can also review our{' '}
          <a className="text-primary hover:underline" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>
      </section>
    </div>
  );
}
