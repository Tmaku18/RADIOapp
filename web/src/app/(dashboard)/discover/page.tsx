'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { discoveryApi, type DiscoverFeedPost, usersApi } from '@/lib/api';
import { DEFAULT_STATION_ID } from '@/data/station-map';
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
import { artistProfilePath } from '@/lib/artist-links';
import { StationNetworkSelector } from '@/components/discovery/StationNetworkSelector';
import { ArtistGlassCard } from '@/components/dimension/ArtistGlassCard';
import { GENRE_OPTIONS } from '@/data/genre-options';
import { getStationAutoplayEnabled, getLastRadioStationId, signalRadioNavIntent } from '@/lib/playback-preferences';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';

const DiscoveryHeatMap = dynamic(
  () =>
    import('@/components/discovery/DiscoveryHeatMap').then(
      (m) => m.DiscoveryHeatMap,
    ),
  { ssr: false },
);

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
  isFollowing?: boolean;
  songCount?: number;
  likeCount?: number;
  playCount?: number;
  listens?: number;
  earsReached?: number;
}

type ArtistSort = 'popularity' | 'songs' | 'recent';

const PAGE_SIZE = 20;
const FEED_PAGE_SIZE = 16;
const FEED_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;
const FEED_VIDEO_MAX_SECONDS = 300;
const FEED_AUDIO_MAX_SECONDS = 600;
const FEED_ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/ogg',
  'audio/flac',
];
const FEED_ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  ...FEED_ALLOWED_AUDIO_MIME_TYPES,
];
const SERVICE_TYPE_OPTIONS = ['mixing', 'mastering', 'production', 'session', 'collab', 'photo', 'video', 'design', 'other'];

async function getMediaDurationSeconds(file: File, kind: 'video' | 'audio'): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const el = document.createElement(kind);
      el.preload = 'metadata';
      el.src = objectUrl;
      el.onloadedmetadata = () => resolve(el.duration);
      el.onerror = () => reject(new Error(`Unable to read ${kind} metadata.`));
    });
    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function validateFeedUploadFile(file: File): Promise<string | null> {
  const isAudio = FEED_ALLOWED_AUDIO_MIME_TYPES.includes(file.type);
  if (!isAudio && !FEED_ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return 'Unsupported file type. Allowed: JPG, PNG, WEBP, MP4, WEBM, MOV, MP3, WAV, M4A, AAC, OGG, FLAC.';
  }
  if (file.size > FEED_UPLOAD_MAX_BYTES) {
    return 'File size exceeds 1GB.';
  }
  if (isAudio || file.type.startsWith('video/')) {
    const kind = isAudio ? 'audio' : 'video';
    const maxSeconds = isAudio ? FEED_AUDIO_MAX_SECONDS : FEED_VIDEO_MAX_SECONDS;
    try {
      const durationSeconds = await getMediaDurationSeconds(file, kind);
      if (!Number.isFinite(durationSeconds) || durationSeconds > maxSeconds) {
        return `${isAudio ? 'Audio' : 'Video'} length must be ${maxSeconds / 60} minutes or less.`;
      }
    } catch {
      return `Unable to read ${kind} duration. Please upload a file up to ${maxSeconds / 60} minutes.`;
    }
  }
  return null;
}

export default function DiscoverPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const playback = usePlaybackOptional();
  const playingStationId =
    playback?.state.source === 'radio'
      ? playback.state.track?.radioId?.trim() || null
      : null;
  const isCatalyst = profile?.role === 'service_provider' || profile?.role === 'admin';
  const initialTabParam = searchParams.get('tab');
  const initialStationParam = searchParams.get('station')?.trim() || DEFAULT_STATION_ID;
  const initialSearchParam = searchParams.get('q')?.trim() ?? '';
  const initialTab: 'station' | 'map' | 'feed' | 'artist' | 'service_provider' =
    initialTabParam === 'station' ||
    initialTabParam === 'map' ||
    initialTabParam === 'feed' ||
    initialTabParam === 'artist' ||
    initialTabParam === 'service_provider'
      ? initialTabParam
      : 'station';

  // People tab state
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearchParam);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchParam);
  const [location, setLocation] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [serviceType, setServiceType] = useState<string>('all');
  const [role, setRole] = useState<'artist' | 'service_provider'>('artist');
  const [activeTab, setActiveTab] = useState<
    'station' | 'map' | 'feed' | 'artist' | 'service_provider'
  >(initialTab);
  const [selectedStationId, setSelectedStationId] = useState(initialStationParam);

  // Highlight the station that is actually playing, not a stale URL/default.
  useEffect(() => {
    if (playingStationId) {
      setSelectedStationId(playingStationId);
      return;
    }
    const urlStation = searchParams.get('station')?.trim();
    if (urlStation) return;
    const last = getLastRadioStationId();
    if (last) setSelectedStationId(last);
  }, [playingStationId, searchParams]);

  const activeStationId = playingStationId ?? selectedStationId;
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const [randomSeed, setRandomSeed] = useState(() => String(Date.now()));
  const [artistSort, setArtistSort] = useState<ArtistSort>('popularity');
  const [artistGenre, setArtistGenre] = useState<string>('all');
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});
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
  const [uploadCover, setUploadCover] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleSelectStation = useCallback(
    (stationId: string) => {
      setSelectedStationId(stationId);
      signalRadioNavIntent();
      const autoplay = getStationAutoplayEnabled() ? '&autoplay=1' : '';
      router.push(
        `/listen?station=${encodeURIComponent(stationId)}${autoplay}`,
      );
    },
    [router],
  );

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    );
    params.set('tab', activeTab);
    params.set('station', activeStationId);
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, router, search, activeStationId]);

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
      setUploadError('Choose an image, video, or audio track.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const validationError = await validateFeedUploadFile(uploadFile);
      if (validationError) {
        setUploadError(validationError);
        return;
      }
      const isAudio = FEED_ALLOWED_AUDIO_MIME_TYPES.includes(uploadFile.type);
      const res = await discoveryApi.createFeedPost(
        uploadFile,
        uploadCaption || undefined,
        isAudio ? uploadCover : null,
      );
      const created = res.data as DiscoverFeedPost;
      setFeedPosts((prev) => [created, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCover(null);
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
          search: debouncedSearch.trim() || undefined,
          location: debouncedLocation.trim() || undefined,
          serviceType: serviceType === 'all' ? undefined : serviceType,
          role,
          limit: PAGE_SIZE,
          offset: currentOffset,
          minRateCents: Number.isFinite(minR) ? minR : undefined,
          maxRateCents: Number.isFinite(maxR) ? maxR : undefined,
          lat: nearbyEnabled && role === 'service_provider' && userLat != null ? userLat : undefined,
          lng: nearbyEnabled && role === 'service_provider' && userLng != null ? userLng : undefined,
          radiusKm: nearbyEnabled && role === 'service_provider' && userLat != null && userLng != null ? 100 : undefined,
          mode: randomMode ? 'random' : 'default',
          sort: role === 'artist' && !randomMode ? artistSort : undefined,
          genre:
            role === 'artist' && artistGenre !== 'all' ? artistGenre : undefined,
          seed: randomMode ? randomSeed : undefined,
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
    [debouncedSearch, debouncedLocation, serviceType, role, nearbyEnabled, userLat, userLng, minRateCents, maxRateCents, randomMode, randomSeed, artistSort, artistGenre],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedLocation(location);
    }, 280);
    return () => clearTimeout(timer);
  }, [search, location]);

  useEffect(() => {
    if (activeTab === 'artist' || activeTab === 'service_provider') setRole(activeTab);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'feed') return;
    setOffset(0);
    load(false, 0);
  }, [activeTab, debouncedSearch, debouncedLocation, serviceType, role, randomMode, randomSeed, artistSort, artistGenre]);

  const toggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    setFollowBusy((prev) => ({ ...prev, [targetUserId]: true }));
    const prev = items;
    setItems((current) =>
      current.map((p) =>
        p.userId === targetUserId ? { ...p, isFollowing: !currentlyFollowing } : p,
      ),
    );
    try {
      if (currentlyFollowing) await usersApi.unfollow(targetUserId);
      else await usersApi.follow(targetUserId);
    } catch {
      setItems(prev);
    } finally {
      setFollowBusy((prevState) => ({ ...prevState, [targetUserId]: false }));
    }
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(true, offset);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Discover</h1>
        <p className="text-sm text-muted-foreground">Find artists and Catalysts (service providers). Search and filter below.</p>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="w-full"
          >
          <TabsList variant="line" className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="station" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              Stations
            </TabsTrigger>
            <TabsTrigger value="map" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary">
              Map
            </TabsTrigger>
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

          <TabsContent value="station" className="mt-0 pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Tap a station to start listening right away.
            </p>
            <StationNetworkSelector
              stationId={activeStationId}
              onSelectStation={handleSelectStation}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveTab('map')}>
                Open artist map
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="map" className="mt-0 pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Heatmap shows total likes of artists based in each area.
            </p>
            <DiscoveryHeatMap stationId={selectedStationId} role={role} />
          </TabsContent>

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
                          <Label>Image, video, or audio</Label>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
                            className="mt-1"
                            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                          />
                          <p className="mt-2 text-xs text-muted-foreground">
                            Max size: 1GB. Videos up to 5 minutes, audio up to 10 minutes.
                          </p>
                        </div>
                        {uploadFile && FEED_ALLOWED_AUDIO_MIME_TYPES.includes(uploadFile.type) && (
                          <div>
                            <Label>Cover picture (optional)</Label>
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/jpg"
                              className="mt-1"
                              onChange={(e) => setUploadCover(e.target.files?.[0] ?? null)}
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                              Without a picture your track posts with the Networx Radio logo.
                            </p>
                          </div>
                        )}
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
                        <div className="grid gap-2">
                          <Button onClick={handleCreatePost} disabled={uploading}>
                            {uploading ? 'Posting...' : 'Post'}
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href="/discover/create-video">
                              Record synced Discover video
                            </Link>
                          </Button>
                        </div>
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
                  No posts yet. Share a photo or short video — posts also show on your profile.
                </p>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {feedPosts.map((post) => {
                    const canDelete =
                      profile?.id === post.authorUserId ||
                      profile?.role === 'admin';
                    return (
                    <Card key={post.id} className="overflow-hidden border-border/80">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 p-3 border-b border-border/60">
                          <Link href={artistProfilePath(post.authorUserId)} className="flex min-w-0 flex-1 items-center gap-3">
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
                              <p className="font-medium text-foreground truncate">{post.authorDisplayName || 'Creator'}</p>
                              {post.authorHeadline && (
                                <p className="text-xs text-muted-foreground truncate">{post.authorHeadline}</p>
                              )}
                            </div>
                          </Link>
                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                if (!window.confirm('Delete this post from the feed?')) return;
                                try {
                                  await discoveryApi.deletePost(post.id);
                                  setFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
                                } catch {
                                  // leave card; user can retry
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                        <div className="relative aspect-square w-full bg-muted">
                          {post.mediaType === 'video' ? (
                            <video
                              src={post.imageUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Image
                              src={post.imageUrl}
                              alt={post.caption || 'Post'}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, 50vw"
                              unoptimized={post.imageUrl.includes('supabase')}
                            />
                          )}
                        </div>
                        {post.caption && (
                          <p className="p-3 text-sm text-foreground/90 whitespace-pre-wrap">{post.caption}</p>
                        )}
                        <p className="px-3 pb-2 text-xs text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </p>
                      </CardContent>
                    </Card>
                    );
                  })}
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
              randomMode={randomMode}
              setRandomMode={setRandomMode}
              randomSeed={randomSeed}
              reshuffle={() => setRandomSeed(String(Date.now()))}
              artistSort={artistSort}
              setArtistSort={setArtistSort}
              artistGenre={artistGenre}
              setArtistGenre={setArtistGenre}
              followBusy={followBusy}
              toggleFollow={toggleFollow}
              currentUserId={profile?.id ?? null}
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
              randomMode={randomMode}
              setRandomMode={setRandomMode}
              randomSeed={randomSeed}
              reshuffle={() => setRandomSeed(String(Date.now()))}
              followBusy={followBusy}
              toggleFollow={toggleFollow}
              currentUserId={profile?.id ?? null}
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
  randomMode,
  setRandomMode,
  reshuffle,
  artistSort = 'popularity',
  setArtistSort,
  artistGenre = 'all',
  setArtistGenre,
  followBusy,
  toggleFollow,
  currentUserId,
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
  randomMode: boolean;
  setRandomMode: (v: boolean) => void;
  randomSeed: string;
  reshuffle: () => void;
  artistSort?: ArtistSort;
  setArtistSort?: (v: ArtistSort) => void;
  artistGenre?: string;
  setArtistGenre?: (v: string) => void;
  followBusy: Record<string, boolean>;
  toggleFollow: (targetUserId: string, currentlyFollowing: boolean) => Promise<void>;
  currentUserId: string | null;
}) {
  const getProfileHref = (profile: DiscoveryProfile): string =>
    profile.role === 'service_provider'
      ? `/pro-networx/u/${profile.userId}`
      : artistProfilePath(profile.userId);
  const isArtistTab = role === 'artist';

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Search name, headline, bio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary"
                aria-label="Search name, headline, bio"
              />
              <Input
                placeholder="Location (region)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="bg-background border-border"
                aria-label="Location region"
              />
              {isArtistTab ? (
                <>
                  <Select
                    value={artistSort}
                    onValueChange={(v) => setArtistSort?.(v as ArtistSort)}
                    disabled={randomMode}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popularity">Popularity</SelectItem>
                      <SelectItem value="songs">Most songs</SelectItem>
                      <SelectItem value="recent">Recently uploaded</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={artistGenre}
                    onValueChange={(v) => setArtistGenre?.(v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All genres</SelectItem>
                      {GENRE_OPTIONS.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
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
              )}
              <Button onClick={() => load(false, 0)} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                Apply filters
              </Button>
            </div>
      <div className="flex items-center gap-2">
        <Switch id="discover-random" checked={randomMode} onCheckedChange={setRandomMode} />
        <Label htmlFor="discover-random" className="text-sm">Random profiles</Label>
        {randomMode && (
          <Button type="button" size="sm" variant="outline" onClick={reshuffle}>
            Shuffle
          </Button>
        )}
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
                {isArtistTab ? (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((profile, index) => (
                      <ArtistGlassCard
                        key={profile.userId}
                        index={index}
                        href={getProfileHref(profile)}
                        artist={{
                          id: profile.userId,
                          displayName: profile.displayName || 'Artist',
                          avatarUrl: profile.avatarUrl,
                          headline: profile.headline,
                          songCount: profile.songCount,
                          likeCount: profile.likeCount,
                          listens: profile.listens ?? profile.earsReached,
                          earsReached: profile.earsReached,
                        }}
                        footer={
                          currentUserId !== profile.userId ? (
                            <>
                              <Button
                                size="sm"
                                variant={profile.isFollowing ? 'outline' : 'secondary'}
                                disabled={!!followBusy[profile.userId]}
                                onClick={() =>
                                  void toggleFollow(
                                    profile.userId,
                                    !!profile.isFollowing,
                                  )
                                }
                              >
                                {followBusy[profile.userId]
                                  ? '...'
                                  : profile.isFollowing
                                    ? 'Following'
                                    : 'Follow'}
                              </Button>
                              <Button size="sm" asChild>
                                <Link href={`/messages?with=${profile.userId}`}>
                                  Message
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              You
                            </Button>
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.map((profile) => (
                    <Card key={profile.userId} className="relative gap-0 overflow-hidden border-border/80 p-0 py-0 transition-colors hover:border-primary/30 hover:bg-elevated/50 cursor-pointer">
                      <Link
                        href={getProfileHref(profile)}
                        aria-label={`Open ${profile.displayName || 'profile'}`}
                        className="absolute inset-0 z-[1]"
                      />
                      <CardContent className="relative z-[2] p-4 flex gap-4 pointer-events-none">
                        <div className="shrink-0">
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {profile.displayName || 'Unnamed'}
                      </span>
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
                    <div className="relative z-[3] flex gap-2 mt-3 pointer-events-auto">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={getProfileHref(profile)}>View profile</Link>
                      </Button>
                      {currentUserId !== profile.userId ? (
                        <Button
                          size="sm"
                          variant={profile.isFollowing ? 'outline' : 'secondary'}
                          disabled={!!followBusy[profile.userId]}
                          onClick={() => toggleFollow(profile.userId, !!profile.isFollowing)}
                        >
                          {followBusy[profile.userId]
                            ? '...'
                            : profile.isFollowing
                              ? 'Following'
                              : 'Follow'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          You
                        </Button>
                      )}
                      <Button size="sm" asChild>
                        <Link href={`/messages?with=${profile.userId}`}>Message</Link>
                      </Button>
                    </div>
                    </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                )}
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
