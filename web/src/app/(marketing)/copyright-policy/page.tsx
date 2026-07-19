export default function CopyrightPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">Copyright Policy</h1>
        <p className="text-muted-foreground mt-3">
          Effective date: March 18, 2026
        </p>
      </header>

      <section className="space-y-3">
        <p className="text-muted-foreground">
          Users may only upload and distribute works they own or are authorized to use.
          Copyright infringement is prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Uploader Responsibilities</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            Confirm all recordings, compositions, and samples are original or properly
            licensed.
          </li>
          <li>Do not upload third-party content without authorization.</li>
          <li>Provide accurate ownership metadata where requested.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Enforcement Actions</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Content removal or access restriction.</li>
          <li>Account warnings, suspensions, or termination.</li>
          <li>Rights-holder notifications and legal cooperation as required.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Notices</h2>
        <p className="text-muted-foreground">
          Rights holders can submit notices to
          {' '}
          <a className="text-primary hover:underline" href="mailto:copyright@networxradio.com">
            copyright@networxradio.com
          </a>
          .
          For formal U.S. takedown requests, use the DMCA process in the DMCA policy.
        </p>
      </section>
    </div>
  );
}
