export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 29, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          These Terms of Service govern your use of NETWORX products and services
          operated by DISCOVERMERADIO GROUP LLC. By using NETWORX, you agree to these
          terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Eligibility and Accounts</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>You must be at least 13 years old to use the service.</li>
          <li>You must provide accurate account information and keep it current.</li>
          <li>You are responsible for safeguarding account credentials.</li>
          <li>You are responsible for activity under your account.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">User Content and Rights</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>You retain ownership of content you submit to NETWORX.</li>
          <li>
            You grant us a non-exclusive license to host, display, distribute, and
            process your content to operate and improve the service.
          </li>
          <li>
            You represent that you have the rights required to upload and use your
            content.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">User Safety and Moderation</h2>
        <p className="text-muted-foreground">
          NETWORX supports creator-uploaded audio and community interactions. We may
          monitor, moderate, remove, or restrict content/accounts that violate these
          terms, our policies, legal requirements, or safety standards.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Payments</h2>
        <p className="text-muted-foreground">
          Paid features may include one-time purchases and subscriptions. Charges are
          processed by third-party payment processors or platform stores. Pricing,
          availability, and feature entitlements may change over time.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Prohibited Conduct</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>No copyright infringement, piracy, or rights violations.</li>
          <li>No harassment, hate speech, threats, or abusive behavior.</li>
          <li>No unauthorized access, scraping, fraud, or service disruption.</li>
          <li>No use of NETWORX to violate laws or third-party rights.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Intellectual Property</h2>
        <p className="text-muted-foreground">
          The NETWORX service, branding, software, and related materials are owned by
          DISCOVERMERADIO GROUP LLC or its licensors and are protected by applicable
          intellectual property laws. Except as permitted by law, you may not copy,
          modify, reverse engineer, or distribute service materials without permission.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Termination</h2>
        <p className="text-muted-foreground">
          We may suspend or terminate access for terms or policy violations, legal risk,
          abuse, or security concerns. You may stop using the service at any time.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Changes to the Service</h2>
        <p className="text-muted-foreground">
          We may modify, suspend, or discontinue all or part of the service at any time,
          with or without notice, as permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Disclaimers and Liability Limits</h2>
        <p className="text-muted-foreground">
          The service is provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent
          allowed by law, DISCOVERMERADIO GROUP LLC disclaims warranties and limits
          liability for indirect, incidental, special, consequential, or punitive damages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Indemnification</h2>
        <p className="text-muted-foreground">
          To the extent permitted by law, you agree to indemnify and hold harmless
          DISCOVERMERADIO GROUP LLC and its affiliates from claims, damages, losses, and
          expenses arising from your content, your use of the service, or your violation
          of these terms or applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Governing Law</h2>
        <p className="text-muted-foreground">
          These terms are governed by applicable law in the United States and the State
          of Georgia, without regard to conflict-of-law rules, unless otherwise required
          by non-waivable consumer law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Changes to These Terms</h2>
        <p className="text-muted-foreground">
          We may update these Terms of Service from time to time. If we make material
          changes, we will update the effective date and provide notice where required
          by law.
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
