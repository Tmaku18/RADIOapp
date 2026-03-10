'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

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
  mentorOptIn?: boolean;
  distanceKm?: number;
}

const PAGE_SIZE = 20;
const FEED_PAGE_SIZE = 16;
const SERVICE_TYPE_OPTIONS = ['mixing', 'mastering', 'production', 'session', 'collab', 'photo', 'video', 'design', 'other'];

export default function DiscoverPage() {
  const { profile } = useAuth();
  const isCatalyst = profile?.role === 'service_provider' || profile?.role === 'admin';

  // People tab state
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [serviceType, setServiceType] = useState<string>('all');
  const [role, setRole] = useState<'artist' | 'service_provider'>('artist');
  const [activeTab, setActiveTab] = useState<'feed' | 'artist' | 'service_provider'>('feed');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [minRateCents, setMinRateCents] = useState<string>('');
  const [maxRateCents, setMaxRateCents] = useState<string>('');

  // Feed tab state
  const [feedPosts, setFeedPosts] = useState<DiscoverFeedPost[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadFeed = useCallback(async (append: boolean, cursor?: string | null) => {
    if (append) setFeedLoadingMore(true);
    else setFeedLoading(true);
    try {
      const res = await discoveryApi.listFeed({
        limit: FEED_PAGE_SIZE,
        cursor: cursor || undefined,
      });
      const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
      if (append) {
        setFeedPosts((prev) => [...prev, ...data.items]);
      } else {
        setFeedPosts(data.items);
      }
      setFeedNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load feed:', e);
      if (!append) setFeedPosts([]);
    } finally {
      setFeedLoading(false);
      setFeedLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'feed') loadFeed(false);
  }, [activeTab, loadFeed]);

  useEffect(() => {
    if (activeTab !== 'feed' || !feedNextCursor || feedLoadingMore) return;
    const el = feedSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadFeed(true, feedNextCursor);
      },
      { rootMargin: '200px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeTab, feedNextCursor, feedLoadingMore, loadFeed]);

  const handleCreatePost = async () => {
    if (!uploadFile) {
      setUploadError('Choose an image.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await discoveryApi.createFeedPost(uploadFile, uploadCaption || undefined);
      const created = res.data as DiscoverFeedPost;
      setFeedPosts((prev) => [created, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCaption('');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const load = useCallback(
    async (append: boolean, currentOffset: number) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const minR = minRateCents.trim() ? parseInt(minRateCents, 10) : undefined;
        const maxR = maxRateCents.trim() ? parseInt(maxRateCents, 10) : undefined;
        const res = await discoveryApi.listPeople({
          search: search.trim() || undefined,
          location: location.trim() || undefined,
          serviceType: serviceType === 'all' ? undefined : serviceType,
          role,
          limit: PAGE_SIZE,
          offset: currentOffset,
          minRateCents: Number.isFinite(minR) ? minR : undefined,
          maxRateCents: Number.isFinite(maxR) ? maxR : undefined,
          lat: nearbyEnabled && role === 'service_provider' && userLat != null ? userLat : undefined,
          lng: nearbyEnabled && role === 'service_provider' && userLng != null ? userLng : undefined,
          radiusKm: nearbyEnabled && role === 'service_provider' && userLat != null && userLng != null ? 100 : undefined,
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
    [search, location, serviceType, role, nearbyEnabled, userLat, userLng, minRateCents, maxRateCents],
  );

  useEffect(() => {
    if (activeTab === 'artist' || activeTab === 'service_provider') setRole(activeTab);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'feed') return;
    setOffset(0);
    load(false, 0);
  }, [activeTab, search, location, serviceType, role]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(true, offset);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground">Find artists and Catalysts (service providers). Search and filter below.</p>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <TabsList variant="line" className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="feed" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              Feed
            </TabsTrigger>
            <TabsTrigger value="artist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              Artists
            </TabsTrigger>
            <TabsTrigger value="service_provider" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              Catalysts
            </TabsTrigger>
          </TabsList>

          {/* Feed tab: endless scroll of catalyst posts */}
          <TabsContent value="feed" className="mt-0 pt-6">
            <div className="flex flex-col gap-4">
              {isCatalyst && (
                <div className="flex justify-end">
                  <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) setUploadError(null); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-primary text-primary-foreground">Add post</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>New post</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-2">
                        <div>
                          <Label>Image</Label>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            className="mt-1"
                            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                          />
                        </div>
                        <div>
                          <Label>Caption (optional)</Label>
                          <Textarea
                            placeholder="Say something..."
                            value={uploadCaption}
                            onChange={(e) => setUploadCaption(e.target.value)}
                            rows={3}
                            className="mt-1 resize-none"
                          />
                        </div>
                        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                        <Button onClick={handleCreatePost} disabled={uploading}>
                          {uploading ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              {feedLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                </div>
              ) : feedPosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  No posts yet. Catalysts can share photos here—check back soon.
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {feedPosts.map((post) => (
                    <Card key={post.id} className="overflow-hidden border-border/80">
                      <CardContent className="p-0">
                        <Link href={`/artist/${post.authorUserId}`} className="flex items-center gap-3 p-3 border-b border-border/60">
                          {post.authorAvatarUrl ? (
                            <Image
                              src={post.authorAvatarUrl}
                              alt={post.authorDisplayName ?? 'Avatar'}
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">🛠️</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{post.authorDisplayName || 'Catalyst'}</p>
                            {post.authorHeadline && (
                              <p className="text-xs text-muted-foreground truncate">{post.authorHeadline}</p>
                            )}
                          </div>
                        </Link>
                        <div className="relative aspect-square w-full bg-muted">
                          <Image
                            src={post.imageUrl}
                            alt={post.caption || 'Post'}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 50vw"
                            unoptimized={post.imageUrl.includes('supabase')}
                          />
                        </div>
                        {post.caption && (
                          <p className="p-3 text-sm text-foreground/90 whitespace-pre-wrap">{post.caption}</p>
                        )}
                        <p className="px-3 pb-2 text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <div ref={feedSentinelRef} className="h-4" />
              {feedLoadingMore && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}
            </div>
          </TabsContent>

          {/* People tabs: same filters + grid for Artists and Catalysts */}
          <TabsContent value="artist" className="mt-0 pt-6">
            <PeopleTabContent
              search={search}
              setSearch={setSearch}
              location={location}
              setLocation={setLocation}
              serviceType={serviceType}
              setServiceType={setServiceType}
              load={load}
              role="artist"
              nearbyEnabled={nearbyEnabled}
              setNearbyEnabled={setNearbyEnabled}
              userLat={userLat}
              userLng={userLng}
              setUserLat={setUserLat}
              setUserLng={setUserLng}
              minRateCents={minRateCents}
              setMinRateCents={setMinRateCents}
              maxRateCents={maxRateCents}
              setMaxRateCents={setMaxRateCents}
              items={items}
              total={total}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMore={loadMore}
            />
          </TabsContent>
          <TabsContent value="service_provider" className="mt-0 pt-6">
            <PeopleTabContent
              search={search}
              setSearch={setSearch}
              location={location}
              setLocation={setLocation}
              serviceType={serviceType}
              setServiceType={setServiceType}
              load={load}
              role="service_provider"
              nearbyEnabled={nearbyEnabled}
              setNearbyEnabled={setNearbyEnabled}
              userLat={userLat}
              userLng={userLng}
              setUserLat={setUserLat}
              setUserLng={setUserLng}
              minRateCents={minRateCents}
              setMinRateCents={setMinRateCents}
              maxRateCents={maxRateCents}
              setMaxRateCents={setMaxRateCents}
              items={items}
              total={total}
              loading={loading}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMore={loadMore}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PeopleTabContent({
  search,
  setSearch,
  location,
  setLocation,
  serviceType,
  setServiceType,
  load,
  role,
  nearbyEnabled,
  setNearbyEnabled,
  userLat,
  userLng,
  setUserLat,
  setUserLng,
  minRateCents,
  setMinRateCents,
  maxRateCents,
  setMaxRateCents,
  items,
  total,
  loading,
  hasMore,
  loadingMore,
  loadMore,
}: {
  search: string;
  setSearch: (s: string) => void;
  location: string;
  setLocation: (s: string) => void;
  serviceType: string;
  setServiceType: (s: string) => void;
  load: (append: boolean, offset: number) => void;
  role: 'artist' | 'service_provider';
  nearbyEnabled: boolean;
  setNearbyEnabled: (v: boolean) => void;
  userLat: number | null;
  userLng: number | null;
  setUserLat: (v: number | null) => void;
  setUserLng: (v: number | null) => void;
  minRateCents: string;
  setMinRateCents: (s: string) => void;
  maxRateCents: string;
  setMaxRateCents: (s: string) => void;
  items: DiscoveryProfile[];
  total: number;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Search name, headline, bio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load(false, 0)}
                className="bg-background border-border focus-visible:ring-primary"
              />
              <Input
                placeholder="Location (region)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load(false, 0)}
                className="bg-background border-border"
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
              <Button onClick={() => load(false, 0)} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                Apply filters
              </Button>
            </div>
      {role === 'service_provider' && (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    id="discover-nearby"
                    checked={nearbyEnabled}
                    onCheckedChange={(checked) => {
                      setNearbyEnabled(checked);
                      if (checked && userLat == null && typeof navigator !== 'undefined' && navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
                          () => setNearbyEnabled(false),
                        );
                      }
                      if (!checked) { setUserLat(null); setUserLng(null); }
                    }}
                  />
                  <Label htmlFor="discover-nearby" className="text-sm">Nearby</Label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Price (cents):</span>
                  <Input type="number" placeholder="Min" className="w-24 bg-background" value={minRateCents} onChange={(e) => setMinRateCents(e.target.value)} />
                  <span className="text-muted-foreground">–</span>
                  <Input type="number" placeholder="Max" className="w-24 bg-background" value={maxRateCents} onChange={(e) => setMaxRateCents(e.target.value)} />
                </div>
              </>
            )}

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
                    <Card key={profile.userId} className="overflow-hidden border-border/80 transition-colors hover:border-primary/30 hover:bg-elevated/50">
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
                      {profile.mentorOptIn && (
                        <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium ring-1 ring-primary/40" title="Mentor">
                          Mentor
                        </span>
                      )}
                      <Badge variant="secondary" className="capitalize text-xs">
                        {profile.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    {profile.headline && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{profile.headline}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {profile.locationRegion && (
                        <p className="text-xs text-muted-foreground">📍 {profile.locationRegion}</p>
                      )}
                      {profile.distanceKm != null && (
                        <p className="text-xs text-muted-foreground">{profile.distanceKm.toFixed(1)} km away</p>
                      )}
                    </div>
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
                    <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="border-primary/40 text-primary hover:bg-primary/10">
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </Button>
                  </div>
                )}
                {!loading && items.length === 0 && (
                  <p className="text-center text-muted-foreground py-12">No one matches your filters. Try adjusting them.</p>
                )}
              </>
            )}
    </>
  );
}
