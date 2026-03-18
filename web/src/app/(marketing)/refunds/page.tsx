export default function RefundsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">Refund Policy</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 18, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          This Refund Policy applies to paid products and services offered by
          DISCOVERMERADIO GROUP LLC through NETWORX.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">General Policy</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Digital purchases are generally non-refundable once consumed or delivered.</li>
          <li>
            Refunds may be issued at our discretion for duplicate charges, technical
            errors, or unauthorized transactions.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Platform-Specific Payments</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            Google Play purchases: refund handling may be subject to Google Play billing
            policies and timelines.
          </li>
          <li>
            Stripe/web purchases: requests are reviewed by NETWORX support using the
            criteria above.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">How to Request a Refund</h2>
        <p className="text-muted-foreground">
          Email
          {' '}
          <a className="text-primary hover:underline" href="mailto:billing@networxradio.com">
            billing@networxradio.com
          </a>
          {' '}
          with your account email, transaction identifier, date, and reason for request.
          We aim to respond within 5 business days.
        </p>
      </section>

      <p className="text-sm text-muted-foreground border-t border-border pt-6">
        Legal review note: this policy should be reviewed by counsel and harmonized with
        platform store terms before final launch.
      </p>
    </div>
  );
}
