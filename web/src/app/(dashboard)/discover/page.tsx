'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoveryApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface DiscoveryProfile {
  id: string;
  userId: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locationRegion: string | null;
  role: 'artist' | 'service_provider';
  serviceTypes: string[];
  createdAt: string;
}

const PAGE_SIZE = 20;
const SERVICE_TYPE_OPTIONS = ['mixing', 'mastering', 'production', 'session', 'collab', 'other'];

export default function DiscoverPage() {
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [serviceType, setServiceType] = useState<string>('all');
  const [role, setRole] = useState<'all' | 'artist' | 'service_provider'>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (append: boolean, currentOffset: number) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await discoveryApi.listPeople({
          search: search.trim() || undefined,
          location: location.trim() || undefined,
          serviceType: serviceType === 'all' ? undefined : serviceType,
          role,
          limit: PAGE_SIZE,
          offset: currentOffset,
        });
        const data = res.data as { items: DiscoveryProfile[]; total: number };
        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setTotal(data.total);
        setHasMore(data.items.length === PAGE_SIZE);
        setOffset(currentOffset + data.items.length);
      } catch (e) {
        console.error('Failed to load discovery:', e);
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, location, serviceType, role],
  );

  useEffect(() => {
    setOffset(0);
    load(false, 0);
  }, [search, location, serviceType, role]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(true, offset);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search name, headline, bio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(false)}
          className="bg-background"
        />
        <Input
          placeholder="Location (region)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(false)}
          className="bg-background"
        />
        <Select value={serviceType} onValueChange={setServiceType}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Service type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SERVICE_TYPE_OPTIONS.map((st) => (
              <SelectItem key={st} value={st}>
                {st}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="artist">Artists</SelectItem>
            <SelectItem value="service_provider">Service providers</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={() => load(false)} variant="secondary" size="sm">
        Apply filters
      </Button>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'person' : 'people'} found
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((profile) => (
              <Card key={profile.userId} className="overflow-hidden">
                <CardContent className="p-4 flex gap-4">
                  <Link href={`/artist/${profile.userId}`} className="shrink-0">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt={profile.displayName ?? 'Avatar'}
                        width={64}
                        height={64}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                        {profile.role === 'artist' ? '🎤' : '🛠️'}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/artist/${profile.userId}`}
                        className="font-medium text-foreground hover:underline truncate"
                      >
                        {profile.displayName || 'Unnamed'}
                      </Link>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {profile.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    {profile.headline && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{profile.headline}</p>
                    )}
                    {profile.locationRegion && (
                      <p className="text-xs text-muted-foreground mt-1">📍 {profile.locationRegion}</p>
                    )}
                    {profile.serviceTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {profile.serviceTypes.slice(0, 3).map((st) => (
                          <Badge key={st} variant="outline" className="text-xs">
                            {st}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/artist/${profile.userId}`}>View profile</Link>
                      </Button>
                      <Button size="sm" asChild>
                        <Link href={`/messages?with=${profile.userId}`}>Message</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {hasMore && items.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No one matches your filters. Try adjusting them.</p>
          )}
        </>
      )}
    </div>
  );
}
