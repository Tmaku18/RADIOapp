import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Child Safety Standards (CSAE) — NETWORX',
  description:
    'NETWORX standards against child sexual abuse and exploitation (CSAE), reporting, and enforcement.',
};

function Mail({ address }: { address: string }) {
  return (
    <a className="text-primary hover:underline" href={`mailto:${address}`}>
      {address}
    </a>
  );
}

export default function ChildSafetyPage() {
  return (
    <LegalLayout
      title="Child Safety Standards Against Child Sexual Abuse and Exploitation (CSAE)"
      effectiveDate="June 21, 2026"
      intro={
        <>
          <strong className="text-foreground">App / Platform:</strong> NETWORX
          <br />
          <strong className="text-foreground">Developer / Company:</strong> DISCOVERMERADIO GROUP LLC / NETWORX
          <br />
          <strong className="text-foreground">Child Safety Contact:</strong>{' '}
          <Mail address="childsafety@networxradio.com" />
        </>
      }
    >
      <LegalSection title="1. Our Commitment">
        <P>
          NETWORX is committed to maintaining a safe platform for artists, creatives, listeners,
          service providers, and community members. We have a zero-tolerance policy for child sexual
          abuse and exploitation (CSAE), child sexual abuse material (CSAM), grooming, sexualization
          of minors, sextortion, trafficking, or any behavior that harms, exploits, endangers, or
          targets children.
        </P>
        <P>
          These standards apply to all areas of NETWORX, including user profiles, posts, comments,
          messages, music uploads, artwork, livestreams, events, service listings, marketplace
          content, links, images, videos, and any other user-generated content or communication.
        </P>
      </LegalSection>

      <LegalSection title="2. Prohibited CSAE Content and Behavior">
        <P>
          NETWORX strictly prohibits users from creating, uploading, sharing, promoting, requesting,
          selling, linking to, messaging about, or otherwise engaging in any content or behavior
          involving child sexual abuse or exploitation.
        </P>
        <P>Prohibited content and behavior includes, but is not limited to:</P>
        <Bullets
          items={[
            'Child sexual abuse material (CSAM), including real, computer-generated, AI-generated, edited, illustrated, or simulated sexual content involving minors.',
            'Any sexual content involving a person under 18.',
            'Grooming or attempting to build trust with a minor for sexual purposes.',
            'Sextortion, blackmail, threats, coercion, or pressure involving sexual images, videos, messages, or acts.',
            'Trafficking, solicitation, advertisement, or commercial sexual exploitation of a minor.',
            'Sexualized comments, roleplay, captions, requests, or messages involving minors.',
            'Links to websites, groups, file shares, accounts, or services that contain, request, promote, or distribute CSAM or CSAE-related material.',
            'Attempts to evade detection, moderation, reporting, or enforcement related to CSAE.',
            'Any attempt to use NETWORX to contact, lure, exploit, manipulate, or endanger a minor.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. User-Generated Content Standards">
        <P>
          Users may not upload, post, livestream, message, list, sell, promote, or distribute content
          that violates these standards.
        </P>
        <P>
          NETWORX may remove or restrict any content that appears to involve CSAE, child endangerment,
          exploitation, suspicious minor-related sexual content, or behavior that creates a safety
          risk.
        </P>
        <P>
          We may also restrict livestreams, profiles, service listings, links, comments, direct
          messages, media uploads, or account access if they are connected to child safety risks.
        </P>
      </LegalSection>

      <LegalSection title="4. Reporting CSAE or Child Safety Concerns">
        <P>
          Users can report CSAE, CSAM, grooming, child endangerment, suspicious behavior, or any
          child safety concern through NETWORX&apos;s in-app reporting tools or by contacting our
          child safety team.
        </P>
        <P>Reports may be submitted through:</P>
        <Bullets
          items={[
            'In-app “Report” buttons on profiles, posts, comments, messages, songs, livestreams, and listings.',
            'The support or safety reporting form inside the app.',
            <>
              Email: <Mail address="childsafety@networxradio.com" />
            </>,
          ]}
        />
        <P>When submitting a report, users should include as much detail as possible, such as:</P>
        <Bullets
          items={[
            'The username or profile involved',
            'Links or screenshots if available',
            'The type of concern',
            'Date/time of the incident',
            'Any relevant messages, posts, livestreams, or content IDs',
          ]}
        />
        <P>
          Do not reshare or redistribute suspected CSAM. Report it immediately through the app or to
          the appropriate authorities.
        </P>
      </LegalSection>

      <LegalSection title="5. How NETWORX Reviews and Enforces Reports">
        <P>
          When NETWORX becomes aware of suspected CSAE, CSAM, grooming, exploitation, trafficking,
          sextortion, or child endangerment, we may take immediate action, including:
        </P>
        <Bullets
          items={[
            'Removing or disabling the content',
            'Restricting visibility of the content',
            'Suspending or terminating accounts',
            'Disabling messaging or livestream access',
            'Preserving relevant records where legally appropriate',
            'Escalating the matter to trained reviewers or leadership',
            'Reporting confirmed CSAM or child exploitation to the National Center for Missing & Exploited Children (NCMEC) or other relevant legal/regional authorities where required',
            'Cooperating with lawful requests from law enforcement',
          ]}
        />
        <P>
          NETWORX may take action without prior notice when we believe a child may be at risk or when
          content violates these standards.
        </P>
      </LegalSection>

      <LegalSection title="6. Confirmed CSAM and Legal Reporting">
        <P>CSAM is illegal. NETWORX will take appropriate action when it obtains actual knowledge of CSAM or child exploitation on the platform.</P>
        <P>
          This may include removal, account termination, preservation of information, and reporting
          to NCMEC or the relevant authority where required by law.
        </P>
        <P>
          NETWORX does not allow users to store, share, distribute, request, or promote CSAM under
          any circumstances.
        </P>
      </LegalSection>

      <LegalSection title="7. Age, Minor Safety, and Account Protection">
        <P>
          NETWORX is designed for users who meet the minimum age required by our Terms of Service and
          applicable law.
        </P>
        <P>
          Users may not misrepresent their age, create accounts to contact minors for inappropriate
          purposes, or use the platform to exploit age differences, power imbalances, fan
          relationships, artist access, service listings, livestreams, events, or direct messages.
        </P>
        <P>
          NETWORX may use safety controls, reporting tools, moderation, account restrictions, and
          content review procedures to help reduce risks to minors.
        </P>
      </LegalSection>

      <LegalSection title="8. Livestreams, Events, and Direct Interaction">
        <P>
          NETWORX prohibits CSAE-related behavior during livestreams, virtual concerts, events, chat
          rooms, comments, direct messages, and service-related communications.
        </P>
        <P>Users may not use live features or event-related features to:</P>
        <Bullets
          items={[
            'Sexualize minors',
            'Request sexual content from minors',
            'Pressure, groom, threaten, or manipulate minors',
            'Direct users to external platforms for CSAE-related behavior',
            'Promote or organize exploitation, trafficking, or illegal activity',
          ]}
        />
        <P>
          Violations may result in immediate removal from the livestream/event, account suspension,
          permanent ban, and reports to authorities where appropriate.
        </P>
      </LegalSection>

      <LegalSection title="9. Marketplace and Creative Services Safety">
        <P>PRO-NETWORX service providers and users must follow these child safety standards.</P>
        <P>
          Creative services, collaborations, bookings, photoshoots, videoshoots, studio sessions,
          mentoring, coaching, event work, or any other marketplace-related activity may not involve
          child exploitation, sexualization of minors, unsafe contact with minors, or unlawful
          activity.
        </P>
        <P>
          NETWORX may remove listings, restrict bookings, or suspend users who violate these
          standards.
        </P>
      </LegalSection>

      <LegalSection title="10. Account Enforcement">
        <P>Violations of this policy may result in one or more of the following:</P>
        <Bullets
          items={[
            'Content removal',
            'Profile restriction',
            'Messaging restriction',
            'Livestream restriction',
            'Marketplace restriction',
            'Suspension',
            'Permanent account termination',
            'Payout hold where permitted',
            'Referral to law enforcement or child safety authorities where appropriate',
          ]}
        />
        <P>Severe violations may result in immediate permanent removal from NETWORX.</P>
      </LegalSection>

      <LegalSection title="11. Appeals">
        <P>Users may contact NETWORX if they believe an enforcement action was made in error.</P>
        <P>
          Appeals may be submitted to: <Mail address="appeals@networxradio.com" />
        </P>
        <P>
          NETWORX may deny appeals involving credible child safety risks, confirmed CSAE violations,
          or legal reporting obligations.
        </P>
      </LegalSection>

      <LegalSection title="12. Child Safety Point of Contact">
        <P>
          NETWORX maintains a child safety point of contact for child safety issues and Google Play
          policy communications.
        </P>
        <Bullets
          items={[
            <>
              <strong className="text-foreground">Child Safety Contact:</strong> NETWORX Child Safety
              Team
            </>,
            <>
              <strong className="text-foreground">Email:</strong>{' '}
              <Mail address="childsafety@networxradio.com" />
            </>,
            <>
              <strong className="text-foreground">Company:</strong> DISCOVERMERADIO GROUP LLC / NETWORX
            </>,
            <>
              <strong className="text-foreground">Website:</strong>{' '}
              <a className="text-primary hover:underline" href="https://www.networxradio.com">
                https://www.networxradio.com
              </a>
            </>,
          ]}
        />
        <P>
          This contact is responsible for receiving child safety notices, coordinating review,
          supporting enforcement, and taking appropriate action when required.
        </P>
      </LegalSection>

      <LegalSection title="13. Updates to These Standards">
        <P>
          NETWORX may update these Child Safety Standards as the platform grows, as laws change, or
          as Google Play, app stores, or safety best practices evolve.
        </P>
        <P>The most current version will be publicly available on the NETWORX website.</P>
      </LegalSection>
    </LegalLayout>
  );
}
