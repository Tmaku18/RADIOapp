'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

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
    
    // TODO: Implement actual form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setSubmitted(true);
    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Alert className="py-8">
          <div className="text-5xl mb-4">✅</div>
          <AlertTitle className="text-2xl">Message Sent!</AlertTitle>
          <AlertDescription className="mt-2 text-base">
            Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
          </AlertDescription>
          <Button asChild className="mt-6">
            <Link href="/">Back to Home</Link>
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">Contact Us</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Have a question, partnership idea, or support request? We&apos;d love to hear from you.
      </p>

      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Looking for ProNetworx?</h2>
          <p className="text-muted-foreground mb-4">
            If you are seeking mentors, collaborators, or Catalysts (service providers) for your artist journey, you can explore ProNetworx directly.
          </p>
          <Button variant="outline" asChild>
            <Link href="/pro-networx">Open ProNetworx</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-8 border-primary/30">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Need support right now?</h2>
          <p className="text-muted-foreground mb-4">
            Join our Discord support channel for faster help with account, upload, and billing questions.
          </p>
          <Button variant="outline" asChild>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Support Discord
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select
                required
                value={formData.subject || ''}
                onValueChange={(v) => setFormData((p) => ({ ...p, subject: v }))}
              >
                <SelectTrigger className="w-full">
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
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                required
                rows={6}
                value={formData.message}
                onChange={handleChange}
                placeholder="Your message..."
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-foreground mb-6">Leadership & Contact</h2>
        <p className="text-muted-foreground mb-6">Reach out to our team directly. We typically respond within 24–48 hours.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground text-lg">Tanaka Makuvaza</h3>
              <p className="text-sm text-muted-foreground mt-1">
                CEO · Chief Architect · Cofounder · Managing Member
              </p>
              <a
                href="mailto:tmakuvaza1@networxradio.com"
                className="mt-3 inline-block text-primary font-medium hover:underline"
              >
                tmakuvaza1@networxradio.com
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-foreground text-lg">Merquise Jones</h3>
              <p className="text-sm text-muted-foreground mt-1">
                COO · Head of Artist Relations and Talent Discovery · Director of Growth and Community Engagement
              </p>
              <a
                href="mailto:mjones@networxradio.com"
                className="mt-3 inline-block text-primary font-medium hover:underline"
              >
                mjones@networxradio.com
              </a>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
