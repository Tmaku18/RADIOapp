'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MarketingHero,
  DimensionSection,
  DimensionCard,
  DimensionCtaPrimary,
  DimensionCtaOutline,
} from '@/components/marketing/MarketingHero';

const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

const inputClass =
  'bg-black/40 border-white/15 text-white placeholder:text-white/40 focus-visible:border-cyan-400/50';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (submitted) {
    return (
      <DimensionSection>
        <DimensionCard className="max-w-2xl mx-auto text-center py-12">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="font-unbounded font-black text-2xl text-white">Message Sent!</h2>
          <p className="mt-2 text-white/60">
            Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
          </p>
          <div className="mt-6">
            <DimensionCtaPrimary href="/">Back to Home</DimensionCtaPrimary>
          </div>
        </DimensionCard>
      </DimensionSection>
    );
  }

  return (
    <div>
      <MarketingHero
        sectionLabel="◤ CONTACT"
        title={
          <>
            Get in <span className="text-glow-cyan text-cyan-300">touch</span>
          </>
        }
        subtitle="Have a question, partnership idea, or support request? We'd love to hear from you."
      />

      <DimensionSection>
        <div className="max-w-2xl mx-auto space-y-6">
          <DimensionCard>
            <h2 className="font-unbounded font-bold text-lg text-white mb-2">
              Looking for ProNetworx?
            </h2>
            <p className="text-white/60 text-sm mb-4">
              Seeking mentors, collaborators, or Catalysts? Explore ProNetworx directly.
            </p>
            <DimensionCtaOutline href="/pro-networx">Open ProNetworx</DimensionCtaOutline>
          </DimensionCard>

          <DimensionCard>
            <h2 className="font-unbounded font-bold text-lg text-white mb-2">
              Need support right now?
            </h2>
            <p className="text-white/60 text-sm mb-4">
              Join our Discord for faster help with account, upload, and billing questions.
            </p>
            <DimensionCtaOutline href={SUPPORT_DISCORD_URL} external>
              Open Support Discord
            </DimensionCtaOutline>
          </DimensionCard>

          <DimensionCard>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/80 font-dim-mono text-xs tracking-wider">
                  NAME
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80 font-dim-mono text-xs tracking-wider">
                  EMAIL
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80 font-dim-mono text-xs tracking-wider">SUBJECT</Label>
                <Select
                  required
                  value={formData.subject || ''}
                  onValueChange={(v) => setFormData((p) => ({ ...p, subject: v }))}
                >
                  <SelectTrigger className={`w-full ${inputClass}`}>
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="support">Technical Support</SelectItem>
                    <SelectItem value="artist">Gem Questions</SelectItem>
                    <SelectItem value="payments">Billing & Payments</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="pronetworx">ProNetworx / Mentorship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-white/80 font-dim-mono text-xs tracking-wider">
                  MESSAGE
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Your message..."
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-cyan-400 text-black font-dim-mono text-xs tracking-[0.2em] uppercase font-bold glow-cyan hover:bg-white transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </DimensionCard>

          <div className="pt-6">
            <h2 className="font-unbounded font-black text-2xl text-white mb-2">
              Leadership &amp; Contact
            </h2>
            <p className="text-white/60 mb-6 text-sm">
              Reach out directly. We typically respond within 24–48 hours.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  name: 'Tanaka Makuvaza',
                  role: 'CEO · Chief Architect · Cofounder',
                  email: 'tmakuvaza1@networxradio.com',
                },
                {
                  name: 'Merquise Jones',
                  role: 'COO · Head of Artist Relations & Talent Discovery',
                  email: 'mjones@networxradio.com',
                },
              ].map((person) => (
                <DimensionCard key={person.email}>
                  <h3 className="font-unbounded font-bold text-lg text-white">{person.name}</h3>
                  <p className="text-sm text-white/50 mt-1">{person.role}</p>
                  <a
                    href={`mailto:${person.email}`}
                    className="mt-3 inline-block text-cyan-300 font-medium hover:text-white text-sm"
                  >
                    {person.email}
                  </a>
                </DimensionCard>
              ))}
            </div>
          </div>
        </div>
      </DimensionSection>
    </div>
  );
}
