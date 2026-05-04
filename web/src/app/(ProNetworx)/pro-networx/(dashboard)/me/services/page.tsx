'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

const SERVICE_TYPES = [
  'graphic_design',
  'photography',
  'videography',
  'illustration',
  'lyricist',
  'beat_maker',
  'mix_master',
  'other',
] as const;

type FormState = {
  serviceType: string;
  title: string;
  description: string;
  priceDollars: string;
  rateType: 'hourly' | 'fixed';
  contactEmail: string;
  contactPhone: string;
  contactLink: string;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  serviceType: 'graphic_design',
  title: '',
  description: '',
  priceDollars: '',
  rateType: 'fixed',
  contactEmail: '',
  contactPhone: '',
  contactLink: '',
  isPublished: true,
};

function listingToForm(l: ProServiceListing): FormState {
  return {
    serviceType: l.serviceType,
    title: l.title,
    description: l.description ?? '',
    priceDollars: l.priceCents != null ? (l.priceCents / 100).toFixed(2) : '',
    rateType: l.rateType,
    contactEmail: l.contact?.email ?? '',
    contactPhone: l.contact?.phone ?? '',
    contactLink: l.contact?.link ?? '',
    isPublished: l.isPublished,
  };
}

export default function MyServicesPage() {
  const { profile, loading: authLoading } = useAuth();
  const allowed =
    !!profile &&
    (profile.role === 'artist' ||
      profile.role === 'service_provider' ||
      profile.role === 'admin');

  const [items, setItems] = useState<ProServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await proNetworxApi.listMyServices();
      setItems(res.data.items);
    } catch (e) {
      console.error('Failed to load my services:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
  }, [allowed, refresh]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setCreating(true);
    setError(null);
  };

  const openEdit = (listing: ProServiceListing) => {
    setForm(listingToForm(listing));
    setEditingId(listing.id);
    setCreating(false);
    setError(null);
  };

  const closeDialog = () => {
    setEditingId(null);
    setCreating(false);
    setError(null);
  };

  const isOpen = creating || editingId != null;

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const cents = form.priceDollars.trim()
        ? Math.round(Number(form.priceDollars) * 100)
        : undefined;
      if (cents !== undefined && (!Number.isFinite(cents) || cents < 0)) {
        throw new Error('Enter a valid price.');
      }
      if (!form.title.trim()) throw new Error('Title is required.');
      const payload = {
        serviceType: form.serviceType,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priceCents: cents,
        rateType: form.rateType,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactLink: form.contactLink.trim() || undefined,
        isPublished: form.isPublished,
      };
      if (editingId) {
        await proNetworxApi.updateService(editingId, payload);
      } else {
        await proNetworxApi.createService(payload);
      }
      await refresh();
      closeDialog();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this service listing?')) return;
    try {
      await proNetworxApi.deleteService(id);
      setItems((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/pro-networx/services" className="inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Services
          </Link>
        </Button>
        <Card className="p-6 space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Listing services</h1>
          <p className="text-sm text-muted-foreground">
            Listing services on Pro-Networx is for creators. Switch to an artist
            account to start listing.
          </p>
          <Button asChild>
            <Link href="/pro-networx/me">Go to my profile</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/pro-networx/services" className="inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Browse marketplace
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground mt-1">My services</h1>
          <p className="text-sm text-muted-foreground">
            Set prices and contact info. Contact info is hidden from non-subscribers.
          </p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> New listing
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          You haven&apos;t listed any services yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((listing) => (
            <Card key={listing.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {listing.serviceType.replace(/_/g, ' ')}
                  </p>
                  <h3 className="font-semibold text-foreground truncate">{listing.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(listing)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(listing.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {listing.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                  {listing.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">
                  {listing.priceCents
                    ? `$${(listing.priceCents / 100).toFixed(2)}${listing.rateType === 'hourly' ? '/hr' : ''}`
                    : 'No price'}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    listing.isPublished
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {listing.isPublished ? 'Published' : 'Hidden'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(o) => (!o ? closeDialog() : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit listing' : 'New listing'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Service type</Label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Logo & brand identity"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What's included, turnaround, deliverables…"
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (USD)</Label>
                <Input
                  inputMode="decimal"
                  value={form.priceDollars}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priceDollars: e.target.value }))
                  }
                  placeholder="49.99"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Rate type</Label>
                <select
                  value={form.rateType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      rateType: e.target.value as 'hourly' | 'fixed',
                    }))
                  }
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="fixed">Fixed</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="you@studio.com"
              />
              <Label>Contact phone</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                placeholder="+1 555 555 5555"
              />
              <Label>Booking / portfolio link</Label>
              <Input
                value={form.contactLink}
                onChange={(e) => setForm((f) => ({ ...f, contactLink: e.target.value }))}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">
                Contact info is hidden from non-subscribers. Subscribers can email,
                call, or open your booking link directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="published"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isPublished: e.target.checked }))
                }
              />
              <Label htmlFor="published" className="cursor-pointer">
                Published (visible in marketplace)
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
