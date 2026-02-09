'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { liveServicesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type LiveService = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  scheduledAt?: string | null;
  linkOrPlace?: string | null;
  createdAt: string;
};

export default function ArtistLiveServicesPage() {
  const { profile } = useAuth();
  const [list, setList] = useState<LiveService[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [linkOrPlace, setLinkOrPlace] = useState('');

  useEffect(() => {
    if (profile?.role !== 'artist' && profile?.role !== 'admin') return;
    liveServicesApi.listMine()
      .then((res) => setList(res.data || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [profile?.role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await liveServicesApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: scheduledAt.trim() || undefined,
        linkOrPlace: linkOrPlace.trim() || undefined,
      });
      const res = await liveServicesApi.listMine();
      setList(res.data || []);
      setTitle('');
      setDescription('');
      setScheduledAt('');
      setLinkOrPlace('');
      setFormOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this live service?')) return;
    try {
      await liveServicesApi.delete(id);
      setList((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (profile?.role !== 'artist' && profile?.role !== 'admin') {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Only artists can manage live services.</p>
        <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live services</h1>
          <p className="text-muted-foreground mt-1">Promote performances, sessions, and meetups. Followers see these on your profile.</p>
        </div>
        <Button onClick={() => setFormOpen(!formOpen)}>{formOpen ? 'Cancel' : 'Add live service'}</Button>
      </div>

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New live service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acoustic set at The Venue" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Date & time (optional)</Label>
                <Input id="scheduledAt" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkOrPlace">Link or place (optional)</Label>
                <Input id="linkOrPlace" value={linkOrPlace} onChange={(e) => setLinkOrPlace(e.target.value)} placeholder="URL or venue address" />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your live services</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : list.length === 0 ? (
            <p className="text-muted-foreground">No live services yet. Add one to promote to your followers.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    {s.scheduledAt && <p className="text-sm text-muted-foreground">{new Date(s.scheduledAt).toLocaleString()}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/dashboard"><Button variant="outline">Dashboard</Button></Link>
    </div>
  );
}
