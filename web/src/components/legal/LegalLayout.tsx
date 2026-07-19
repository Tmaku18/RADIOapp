import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared page shell for legal / policy documents. */
export function LegalLayout({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  effectiveDate?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <header>
        <h1 className="text-4xl font-bold text-foreground">{title}</h1>
        {effectiveDate ? (
          <p className="text-muted-foreground mt-3">Effective date: {effectiveDate}</p>
        ) : null}
      </header>

      {intro ? (
        <section className="space-y-3">
          <p className="text-muted-foreground">{intro}</p>
        </section>
      ) : null}

      {children}

      <div className="pt-6 border-t border-border">
        <Link href="/legal" className="text-primary hover:underline font-medium">
          ← Back to Legal Center
        </Link>
      </div>
    </div>
  );
}

/** A titled section with optional body paragraph(s) and children. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Muted paragraph helper. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

/** Bulleted list of strings. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const CONTACT_EMAILS: Record<string, string> = {
  legal: 'legal@networxradio.com',
  support: 'support@networxradio.com',
  copyright: 'copyright@networxradio.com',
};

/** Standard contact block. */
export function LegalContact({
  emails = ['legal', 'support'],
  note,
}: {
  emails?: Array<keyof typeof CONTACT_EMAILS>;
  note?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Contact</h2>
      <p className="text-muted-foreground">
        DISCOVERMERADIO GROUP LLC / NETWORX
        {note ? <><br />{note}</> : null}
        <br />
        {emails.map((key, i) => (
          <span key={key}>
            {i > 0 ? <br /> : null}
            <a
              className="text-primary hover:underline"
              href={`mailto:${CONTACT_EMAILS[key]}`}
            >
              {CONTACT_EMAILS[key]}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
