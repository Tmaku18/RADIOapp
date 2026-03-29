export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 29, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          This Privacy Policy explains how DISCOVERMERADIO GROUP LLC
          (&quot;NETWORX,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;) collects, uses, discloses, and
          protects information when you use NETWORX applications, websites, and
          related services (collectively, the &quot;Services&quot;).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Information We Collect</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Account data (email, display name, role, authentication identifiers).</li>
          <li>
            Content and activity (uploads, messages, reactions, comments, and profile data).
          </li>
          <li>Payment and purchase metadata used for transaction processing and verification.</li>
          <li>
            Device and usage information (logs, crash diagnostics, app interactions).
          </li>
          <li>
            Approximate/precise location data when you use nearby discovery features.
          </li>
          <li>
            Push token and notification interaction data for artist/listener notifications.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">How We Use Information</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Provide and secure the service, including account authentication.</li>
          <li>Enable radio playback, creator tools, messaging, and analytics features.</li>
          <li>Process purchases and detect fraud, abuse, and policy violations.</li>
          <li>Send transactional and product notifications.</li>
          <li>Comply with legal obligations and enforce our terms and policies.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Legal Bases and Consent</h2>
        <p className="text-muted-foreground">
          Depending on your location, we process personal data under one or more legal
          bases: your consent, performance of a contract, legitimate interests, and
          legal obligations. You can withdraw consent for optional processing at any
          time by changing app/device settings where available.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Creator Content, Safety, and Explicit Labels</h2>
        <p className="text-muted-foreground">
          NETWORX supports creator-uploaded audio and community interactions. We process
          creator metadata, including explicit-content labels, to help provide appropriate
          station experiences and enforce safety standards. We may review, moderate, remove,
          or restrict content and accounts for legal, policy, or safety reasons.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Sharing of Information</h2>
        <p className="text-muted-foreground">
          We may share data with service providers that help operate authentication,
          infrastructure, analytics, notifications, and payments. We may also disclose
          data when required by law, to enforce rights, or in connection with a business
          transfer.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">International Transfers</h2>
        <p className="text-muted-foreground">
          We and our service providers may process data in the United States and other
          countries that may have different data protection laws than your country.
          Where required, we use appropriate safeguards for cross-border data transfers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Data Retention</h2>
        <p className="text-muted-foreground">
          We retain personal data only as long as needed for business, legal, and security
          purposes. Some records may be retained after account closure where required by
          law or for fraud/security prevention.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Your Rights and Choices</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Access, update, or delete your account information where available.</li>
          <li>Control push notifications in app settings.</li>
          <li>Control location permission at the device level.</li>
          <li>
            Request account deletion by contacting support at
            {' '}
            <a className="text-primary hover:underline" href="mailto:support@networxradio.com">
              support@networxradio.com
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Account Deletion</h2>
        <p className="text-muted-foreground">
          You may request deletion of your account and associated personal data by
          contacting support. We may retain limited information as required by law,
          to resolve disputes, or for fraud and security prevention.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Security</h2>
        <p className="text-muted-foreground">
          We use reasonable administrative, technical, and organizational measures to
          protect personal data. No system is perfectly secure, and we cannot guarantee
          absolute security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Changes To This Policy</h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time. If we make material changes,
          we will update the effective date and provide notice where required by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Children&apos;s Privacy</h2>
        <p className="text-muted-foreground">
          NETWORX is not directed to children under 13, and we do not knowingly collect
          personal data from children under 13.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          DISCOVERMERADIO GROUP LLC
          <br />
          Email:
          {' '}
          <a className="text-primary hover:underline" href="mailto:legal@networxradio.com">
            legal@networxradio.com
          </a>
        </p>
      </section>
    </div>
  );
}
