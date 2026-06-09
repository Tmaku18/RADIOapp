'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { proNetworxApi, type ProServiceListing } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function MyServicesPage() {
  const [items, setItems] = useState<ProServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState('other');
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await proNetworxApi.listMyServices();
      setItems(res.data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const priceCents = price.trim() ? Math.round(parseFloat(price) * 100) : undefined;
      await proNetworxApi.createService({
        serviceType,
        title: title.trim(),
        description: description.trim() || undefined,
        priceCents,
        rateType: 'fixed',
        isPublished: true,
      });
      setTitle('');
      setDescription('');
      setPrice('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await proNetworxApi.deleteService(id);
    await load();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-1">
        <Button variant="ghost" asChild><Link href="/services">← Services</Link></Button>
        <h1 className="text-2xl font-semibold">My services</h1>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-medium">New listing</h2>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Service type</Label>
          <Input id="type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="mix_master" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <Button onClick={() => void handleCreate()} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : 'Publish service'}
        </Button>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no service listings yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.serviceType}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => void handleDelete(item.id)}>
                Delete
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
