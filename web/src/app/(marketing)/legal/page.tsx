import Link from 'next/link';

const docs = [
  { href: '/privacy', title: 'Privacy Policy' },
  { href: '/terms', title: 'Terms of Service' },
  { href: '/refunds', title: 'Refund Policy' },
  { href: '/dmca', title: 'DMCA Takedown Policy' },
  { href: '/community-guidelines', title: 'Community Guidelines' },
  { href: '/copyright-policy', title: 'Copyright Policy' },
  { href: '/delete-account', title: 'Delete Your Account' },
];

export default function LegalIndexPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">Legal Center</h1>
      <p className="text-muted-foreground mb-8">
        Legal documents for DISCOVERMERADIO GROUP LLC and the NETWORX platform.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        <ul className="space-y-3">
          {docs.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="text-primary hover:underline font-medium"
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
