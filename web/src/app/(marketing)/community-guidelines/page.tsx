export default function CommunityGuidelinesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">Community Guidelines</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 18, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          NETWORX is built for artists, listeners, and collaborators. These guidelines
          define behavior expected across content uploads, chat, comments, and profiles.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Do</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Respect other users and engage constructively.</li>
          <li>Upload content you have rights to distribute.</li>
          <li>Report abuse, harassment, scams, or impersonation.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Do Not</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Post hateful, threatening, violent, or sexually exploitative content.</li>
          <li>Harass, dox, or bully other users.</li>
          <li>Upload infringing content or misleading metadata.</li>
          <li>Use bots, spam, or manipulation of votes/engagement.</li>
          <li>Sell illegal goods/services or engage in fraud.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Enforcement</h2>
        <p className="text-muted-foreground">
          Violations may result in content removal, account restrictions, suspensions, or
          termination. We may take immediate action for severe abuse or legal risk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Report a Violation</h2>
        <p className="text-muted-foreground">
          Contact
          {' '}
          <a className="text-primary hover:underline" href="mailto:trust@networxradio.com">
            trust@networxradio.com
          </a>
          {' '}
          with screenshots, links, and context.
        </p>
      </section>
    </div>
  );
}
