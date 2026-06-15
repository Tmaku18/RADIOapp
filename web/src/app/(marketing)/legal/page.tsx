import Link from 'next/link';

export const metadata = {
  title: 'Legal Center — NETWORX',
  description: 'Legal documents and policies for DISCOVERMERADIO GROUP LLC and the NETWORX platform.',
};

type Doc = { href: string; title: string; description: string };

const groups: { heading: string; docs: Doc[] }[] = [
  {
    heading: 'Core policies',
    docs: [
      { href: '/terms', title: 'Terms of Service', description: 'The agreement governing your use of NETWORX.' },
      { href: '/privacy', title: 'Privacy Policy', description: 'How we collect, use, share, and protect information.' },
      { href: '/community-guidelines', title: 'Community Guidelines', description: 'The behavior expected across the community.' },
      { href: '/prohibited-content', title: 'Prohibited Content Policy', description: 'Content and services that are not allowed.' },
    ],
  },
  {
    heading: 'Marketplace & creators',
    docs: [
      { href: '/artist-agreement', title: 'Artist / Seller Agreement', description: 'Terms for uploading and selling music and content.' },
      { href: '/buyer-license', title: 'Buyer License Terms', description: 'What buyers receive when purchasing music.' },
      { href: '/upload-rights', title: 'Music Upload Rights Confirmation', description: 'The rights you confirm before uploading music.' },
      { href: '/service-provider-terms', title: 'PRO-NETWORX Service Provider Terms', description: 'Terms for creatives and service providers.' },
      { href: '/payout-policy', title: 'Marketplace Payout Policy', description: 'How seller payouts are calculated and released.' },
      { href: '/refunds', title: 'Refund & Chargeback Policy', description: 'Refunds, chargebacks, and payout impacts.' },
    ],
  },
  {
    heading: 'Copyright & reporting',
    docs: [
      { href: '/dmca', title: 'DMCA & Copyright Policy', description: 'Copyright complaints, takedowns, and counter-notices.' },
      { href: '/copyright-policy', title: 'Copyright Policy', description: 'Uploader responsibilities and enforcement.' },
      { href: '/dmca-takedown-notice', title: 'DMCA Takedown Notice', description: 'Submit a copyright takedown notice.' },
      { href: '/dmca-counter-notice', title: 'DMCA Counter-Notice', description: 'Dispute a removal made by mistake.' },
      { href: '/report', title: 'Content Report', description: 'Report content or behavior that may violate policy.' },
    ],
  },
  {
    heading: 'Features & programs',
    docs: [
      { href: '/livestream-terms', title: 'Livestream & Events Terms', description: 'Terms for livestreams, events, tips, and donations.' },
      { href: '/beta-terms', title: 'Beta Tester Terms & Feedback License', description: 'Terms for beta access and feedback.' },
      { href: '/delete-account', title: 'Delete Your Account', description: 'How to request account and data deletion.' },
    ],
  },
];

export default function LegalIndexPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">Legal Center</h1>
      <p className="text-muted-foreground mb-10">
        Legal documents and policies for DISCOVERMERADIO GROUP LLC and the NETWORX platform. For
        questions, contact{' '}
        <a className="text-primary hover:underline" href="mailto:legal@networxradio.com">
          legal@networxradio.com
        </a>
        .
      </p>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.heading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              {group.heading}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.docs.map((doc) => (
                <Link
                  key={doc.href}
                  href={doc.href}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <span className="block font-medium text-foreground">{doc.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{doc.description}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
