export default function DmcaPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">DMCA Takedown Policy</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 18, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          DISCOVERMERADIO GROUP LLC respects intellectual property rights and responds
          to valid copyright notices under the Digital Millennium Copyright Act (DMCA).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Submitting a DMCA Notice</h2>
        <p className="text-muted-foreground">
          Send notices to
          {' '}
          <a className="text-primary hover:underline" href="mailto:dmca@networxradio.com">
            dmca@networxradio.com
          </a>
          {' '}
          and include:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Your full legal name and contact information.</li>
          <li>Identification of the copyrighted work.</li>
          <li>Identification of the allegedly infringing material and its location.</li>
          <li>A statement of good-faith belief unauthorized use is occurring.</li>
          <li>A statement under penalty of perjury that your notice is accurate.</li>
          <li>Your physical or electronic signature.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Counter-Notices</h2>
        <p className="text-muted-foreground">
          Users who believe material was removed by mistake may submit a valid
          counter-notice. If a valid counter-notice is received, we may restore content
          as permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Repeat Infringers</h2>
        <p className="text-muted-foreground">
          NETWORX may suspend or terminate accounts for repeat infringement consistent
          with applicable law.
        </p>
      </section>

      <p className="text-sm text-muted-foreground border-t border-border pt-6">
        Legal review note: assign a named DMCA agent and registered address with counsel
        before scale launch.
      </p>
    </div>
  );
}
