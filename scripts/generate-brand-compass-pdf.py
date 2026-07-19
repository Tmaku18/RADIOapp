"""One-off generator: NETWORX Brand Identity Build Compass PDF."""
from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = REPO_ROOT / "docs" / "NETWORX_Brand_Identity_Build_Compass.pdf"
DOWNLOADS_OUT = Path.home() / "Downloads" / "NETWORX_Brand_Identity_30_Day_Build_Compass (1).pdf"


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), style)


def build_pdf(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="NETWORX Brand Identity & Build Compass",
        author="DISCOVERMERADIO GROUP LLC",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "NXTitle",
        parent=styles["Title"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0A0A0A"),
        spaceAfter=12,
    )
    h1 = ParagraphStyle(
        "NXH1",
        parent=styles["Heading1"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#FF007F"),
        spaceBefore=14,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "NXH2",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#00F0FF"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "NXBody",
        parent=styles["BodyText"],
        fontSize=9.5,
        leading=13,
        alignment=TA_LEFT,
        spaceAfter=6,
    )
    small = ParagraphStyle(
        "NXSmall",
        parent=body,
        fontSize=8.5,
        textColor=colors.HexColor("#334155"),
    )

    story: list = []

    story.append(p("NETWORX", title))
    story.append(p("Brand Identity &amp; Build Compass", title))
    story.append(Spacer(1, 0.15 * inch))
    story.append(
        p(
            "The creator operating system, live discovery network, and music marketplace "
            "for independent audio creators — <b>plus Pro-Networx</b>, the professional "
            "networking layer for every kind of creative.",
            body,
        )
    )
    story.append(Spacer(1, 0.1 * inch))
    story.append(p("<b>Version:</b> June 2026 (updated to match shipped product)", small))
    story.append(
        p(
            "<b>Brand status:</b> The name is not changing. NETWORX is the app, the brand, "
            "the platform, the marketplace, the live radio network, and the creator operating system.",
            small,
        )
    )
    story.append(
        p(
            "<b>Replaces prior draft:</b> storefront-first 30-day MVP compass with outdated "
            "palette (Royal Amethyst) and missing shipped features.",
            small,
        )
    )

    # 1. Brand Architecture
    story.append(PageBreak())
    story.append(p("1. Brand Architecture", h1))
    arch = [
        ["Item", "Direction"],
        ["Brand Name", "NETWORX"],
        ["Product Line", "NETWORX Radio: The Butterfly Effect"],
        [
            "Category",
            "Creator OS; Music Marketplace; Live Discovery Network; Pro-Networx Creative Network",
        ],
        [
            "Positioning",
            "Always-on democratic radio, community voting, analytics, track sales, discovery placements, Pro-Networx mentorship — one platform.",
        ],
        ["Core Brand Line", "Your Network. Your Sound."],
        [
            "Product Taglines (shipped)",
            "The Butterfly Effect · By Artists, For Artists · Where the People have the Voice, and the Artist has the Power",
        ],
    ]
    t = Table(arch, colWidths=[1.6 * inch, 4.9 * inch])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0E9AA7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.1 * inch))
    story.append(p("<b>Three metaphor systems (shipped):</b>", body))
    story.append(
        p(
            "1. <b>The Butterfly Effect</b> — Ripples, The Wake<br/>"
            "2. <b>Metamorphosis</b> — Gems, Diamonds, Catalysts<br/>"
            "3. <b>Mining the Frequency</b> — Prospectors, The Refinery, The Yield",
            body,
        )
    )

    # 2. Mission (condensed)
    story.append(p("2. Core Identity &amp; The Mission", h1))
    story.append(
        p(
            "<b>The Promise:</b> NETWORX gives independent creators infrastructure to be heard, paid, "
            "and organized without surrendering ownership — live discovery, audience feedback, track sales, "
            "The Wake analytics, discovery placements, and Pro-Networx networking.",
            body,
        )
    )
    story.append(
        p(
            "<b>The Void:</b> Without NETWORX, creators fragment across disconnected tools. "
            "NETWORX is the central command center.",
            body,
        )
    )

    # 3. Audience
    story.append(p("3. The Audience", h1))
    story.append(
        p(
            "<b>Primary:</b> Independent audio creators ($5K–$50K annual music-related earnings). "
            "Ambitious. Undermanaged. Monetizable.",
            body,
        )
    )
    story.append(
        p(
            "<b>Secondary (shipped):</b> Prospectors (listeners) and Catalysts (service providers via Pro-Networx).",
            body,
        )
    )

    # 4. Positioning
    story.append(p("4. Market Positioning", h1))
    story.append(
        p(
            "<b>Enemy:</b> Fragmentation tax across single-feature tools.<br/>"
            "<b>Lie exposed:</b> Algorithmic reach alone equals a sustainable career.<br/>"
            "<b>Frame:</b> What Shopify did for merchants, NETWORX is building for independent audio creators.",
            body,
        )
    )

    # 5. Voice
    story.append(PageBreak())
    story.append(p("5. Voice, Tone &amp; Messaging", h1))
    story.append(
        p(
            "Sophisticated, direct, empowering — artist as CEO. No begging, no corny hype.<br/>"
            "<b>Blacklisted:</b> Buy Airtime, Cheap Promotion, Get Famous Fast, Exposure Only, Sign a Deal.<br/>"
            "<b>Use:</b> Ripples, The Wake, The Refinery, The Yield, Trial by Fire, Discovery Placements, Pro-Networx.",
            body,
        )
    )
    story.append(p("<b>Push examples (shipped events):</b>", h2))
    for line in [
        "Your track is up next. Tap in.",
        "Your track is live on NETWORX Radio.",
        "A listener bought your song.",
        "[Artist] just went live. Join the room.",
        "The Refinery needs your vote. Earn Yield.",
    ]:
        story.append(p(f"• {line}", body))

    # 7. Visual Identity
    story.append(p("7. Visual Identity (Dimension Cyber — shipped tokens)", h1))
    palette = [
        ["Token", "Hex", "Use"],
        ["Void Black", "#050505", "Base background (dark)"],
        ["Surface Glass", "#0A0A0C", "Glass panels / cards"],
        ["Neon Cyan", "#00F0FF", "Primary accent (dark)"],
        ["Signal Pink", "#FF007F", "Live / secondary accent"],
        ["Pulse Yellow", "#F4D03F", "Temperature / highlights"],
        ["Studio Teal", "#0E7490", "Primary accent (light)"],
        ["Studio Rose", "#BE185D", "Secondary accent (light)"],
        ["Frost Canvas", "#E8EDF4", "Base background (light)"],
    ]
    pt = Table(palette, colWidths=[1.5 * inch, 1.0 * inch, 3.0 * inch])
    pt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00F0FF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#050505")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    story.append(pt)
    story.append(
        p(
            "<b>Note:</b> Prior draft used Royal Amethyst #6A0DAD as primary — <b>not used</b> in production UI. "
            "Core shadcn tokens in globals.css still use Butterfly Electric #00F5FF; dimension surfaces prefer #00F0FF. "
            "Typography: Unbounded (display), Inter (UI), JetBrains Mono (labels), Space Grotesk (headings), Lora (campaign).",
            small,
        )
    )

    # 9. Product Pillars status
    story.append(PageBreak())
    story.append(p("9. Product Pillars — Implementation Status (June 2026)", h1))
    pillars = [
        ["Pillar", "Status", "Notes"],
        ["Live Discovery", "✅ Shipped", "Radio, fire/pass, temperature, Ripples, Trial by Fire, chat, livestreams"],
        ["Direct Monetization", "✅ Shipped", "Preview→purchase, $1.99 placements, credits, Stripe/Play Billing"],
        ["Creator Intelligence", "✅ Shipped", "The Wake, ROI, heatmap, live platform stats"],
        ["Prospector Rewards", "✅ Shipped", "The Refinery + The Yield"],
        ["Pro-Networx Network", "✅ Shipped", "Profiles, feed, services, directory, messaging (subscription)"],
        ["Fan Ownership", "🟡 Partial", "Profiles, follows, library; no full storefront CRM yet"],
        ["Infrastructure", "🟡 Partial", "Dashboard, admin, payments; Stripe Connect payouts on roadmap"],
    ]
    pil = Table(pillars, colWidths=[1.35 * inch, 0.85 * inch, 3.3 * inch])
    pil.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0E9AA7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    story.append(pil)

    # 10. Build status
    story.append(p("10. Build Status — Beyond Original 30-Day MVP", h1))
    story.append(
        p(
            "The original compass targeted a storefront-first MVP in 30 days. "
            "<b>What shipped</b> is a broader radio + community + Pro-Networx platform (web + Flutter mobile).",
            body,
        )
    )
    shipped = [
        "Democratic always-on radio with synchronized playback",
        "Fire/pass voting, temperature, Ripples, competition leaderboards",
        "The Wake analytics, The Refinery, The Yield",
        "Discovery placements ($1.99 / ~1,000 exposures)",
        "Direct-to-fan preview + purchase + library",
        "Pro-Networx profiles, feed, services, directory, messaging",
        "Artist livestreaming + live chat",
        "Push notifications (FCM), Google/Apple/email auth (no Spotify OAuth)",
        "Light + dark theme, networxradio.com + pro-networx.com",
    ]
    for item in shipped:
        story.append(p(f"✅ {item}", body))

    story.append(Spacer(1, 0.08 * inch))
    story.append(p("<b>Original MVP gaps still open:</b>", h2))
    story.append(p("❌ Standalone creator storefront + fan email CRM (as originally specified)", body))
    story.append(p("🟡 Full Stripe Connect automatic artist payouts", body))

    story.append(p("<b>Recommended next 30-day focus:</b>", h2))
    for item in [
        "Fan CRM + email capture on artist storefront",
        "Stripe Connect artist payouts (production)",
        "Play Store + App Store launch polish",
        "Pro-Networx subscription Play Billing parity",
        "Founding 100 cohort tooling",
    ]:
        story.append(p(f"• {item}", body))

    # 11. Roadmap deferrals
    story.append(PageBreak())
    story.append(p("11. Still on Roadmap (not required for current release)", h1))
    defer = [
        "Spotify for Artists OAuth",
        "YouTube Analytics integration",
        "Automated DSP royalty aggregation",
        "Shopify / Mailchimp integrations",
        "AI recommendations",
        "Sync licensing marketplace",
        "Live Events ticketed showcases",
    ]
    for item in defer:
        story.append(p(f"• {item}", body))

    story.append(Spacer(1, 0.1 * inch))
    story.append(
        p(
            "<b>Previously deferred — now shipped:</b> Flutter native mobile app, FCM push notifications, "
            "Pro-Networx module, Refinery, Yield, livestreams, light mode.",
            body,
        )
    )

    # 12. Copy
    story.append(p("12. Product Copy (live)", h1))
    story.append(p("<b>Homepage (networxradio.com):</b>", h2))
    story.append(
        p(
            "Join the movement and build your network.<br/>"
            "Build your audience, team, and career in one platform.<br/>"
            "CTAs: Get Started Free · Explore ProNetworx",
            body,
        )
    )
    story.append(p("<b>Player:</b> Fire / Pass · Song temperature · Send a Ripple", body))
    story.append(
        p(
            "<b>Pro-Networx paywall:</b> Subscribe for DMs + contact info ($4.99 intro → $9.99/mo).",
            body,
        )
    )

    # 15. Doctrine
    story.append(p("15. Final Brand Doctrine", h1))
    story.append(
        p(
            "NETWORX is not here to make creators louder. It is here to make them stronger.<br/><br/>"
            "NETWORX creates the culture. NETWORX runs the backend. The creator keeps the power.",
            body,
        )
    )
    story.append(Spacer(1, 0.2 * inch))
    story.append(
        p(
            "Source of truth (markdown): docs/networx-brand-identity-build-compass.md<br/>"
            "Terminology: docs/branding-terminology.md · Features: docs/features-summary.md",
            small,
        )
    )

    doc.build(story)


if __name__ == "__main__":
    for target in (DEFAULT_OUT, DOWNLOADS_OUT):
        build_pdf(target)
        print(f"Wrote {target}")
