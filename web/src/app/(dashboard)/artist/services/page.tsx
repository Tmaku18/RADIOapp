'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryApi, serviceProvidersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type DiscoveryProfile = {
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
};

type ProviderProfile = {
  userId: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locationRegion: string | null;
  role: 'service_provider';
  serviceTypes: string[];
  heroImageUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  mentorOptIn?: boolean;
  listings: Array<{
    id: string;
    serviceType: string;
    title: string;
    description: string | null;
    rateCents: number | null;
    rateType: 'hourly' | 'fixed';
    status: 'active' | 'paused';
    createdAt: string;
    updatedAt: string;
  }>;
  portfolio: Array<{
    id: string;
    type: 'image' | 'audio' | 'video';
    fileUrl: string;
    title: string | null;
    description: string | null;
    sortOrder: number;
    createdAt: string;
  }>;
};

const SERVICE_TYPE_OPTIONS = ['mixing', 'mastering', 'production', 'session', 'collab', 'design', 'photo', 'video', 'other'];

function locationScore(candidate: string | null, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const c = (candidate ?? '').trim().toLowerCase();
  if (!c) return 0;
  if (c === q) return 3;
  if (c.startsWith(q)) return 2;
  if (c.includes(q)) return 1;
  return 0;
}

function formatRate(rateCents: number | null, rateType: 'hourly' | 'fixed'): string {
  if (rateCents == null) return 'Contact for pricing';
  const dollars = (rateCents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

export default function ArtistServicesPage() {
  const { profile } = useAuth();
  const isProvider = profile?.role === 'service_provider';

  // Directory state (artists/listeners/admin)
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [serviceType, setServiceType] = useState<string>('all');
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [minRateCents, setMinRateCents] = useState<string>('');
  const [maxRateCents, setMaxRateCents] = useState<string>('');

  // Provider editor state (service_provider)
  const [me, setMe] = useState<ProviderProfile | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [savingMe, setSavingMe] = useState(false);
  const [bio, setBio] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);

  const [listingOpen, setListingOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [listingServiceType, setListingServiceType] = useState('mixing');
  const [listingTitle, setListingTitle] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [listingRateCents, setListingRateCents] = useState<string>('');
  const [listingRateType, setListingRateType] = useState<'hourly' | 'fixed'>('fixed');
  const [listingStatus, setListingStatus] = useState<'active' | 'paused'>('active');
  const [listingSaving, setListingSaving] = useState(false);

  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioType, setPortfolioType] = useState<'image' | 'audio' | 'video'>('image');
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [portfolioSaving, setPortfolioSaving] = useState(false);

  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrlProfile, setPortfolioUrlProfile] = useState('');
  const [mentorOptIn, setMentorOptIn] = useState(false);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const minR = minRateCents.trim() ? parseInt(minRateCents, 10) : undefined;
      const maxR = maxRateCents.trim() ? parseInt(maxRateCents, 10) : undefined;
      const res = await discoveryApi.listPeople({
        role: 'service_provider',
        search: search.trim() || undefined,
        location: location.trim() || undefined,
        serviceType: serviceType === 'all' ? undefined : serviceType,
        limit: 50,
        offset: 0,
        minRateCents: Number.isFinite(minR) ? minR : undefined,
        maxRateCents: Number.isFinite(maxR) ? maxR : undefined,
        lat: nearbyEnabled && userLat != null ? userLat : undefined,
        lng: nearbyEnabled && userLng != null ? userLng : undefined,
        radiusKm: nearbyEnabled && userLat != null && userLng != null ? 100 : undefined,
      });
      const data = res.data as { items: DiscoveryProfile[]; total: number };
      setItems(data.items ?? []);
    } catch (e) {
      console.error('Failed to load providers:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, location, serviceType, nearbyEnabled, userLat, userLng, minRateCents, maxRateCents]);

  const loadMe = useCallback(async () => {
    if (!isProvider) return;
    setLoadingMe(true);
    try {
      const res = await serviceProvidersApi.getMeProfile();
      const data = res.data as ProviderProfile;
      setMe(data);
      setBio(data.bio ?? '');
      setLocationRegion(data.locationRegion ?? '');
      setServiceTypes(data.serviceTypes ?? []);
      setHeroImageUrl(data.heroImageUrl ?? '');
      setInstagramUrl(data.instagramUrl ?? '');
      setLinkedinUrl(data.linkedinUrl ?? '');
      setPortfolioUrlProfile(data.portfolioUrl ?? '');
      setMentorOptIn(data.mentorOptIn ?? false);
    } catch (e) {
      console.error('Failed to load provider profile:', e);
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }, [isProvider]);

  useEffect(() => {
    if (isProvider) loadMe();
    else loadDirectory();
  }, [isProvider, loadMe, loadDirectory]);

  const sortedItems = useMemo(() => {
    if (!location.trim()) return items;
    const q = location.trim();
    return [...items].sort((a, b) => {
      const sa = locationScore(a.locationRegion, q);
      const sb = locationScore(b.locationRegion, q);
      if (sb !== sa) return sb - sa;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, location]);

  const toggleServiceType = (st: string) => {
    setServiceTypes((prev) =>
      prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
    );
  };

  const saveProfile = async () => {
    setSavingMe(true);
    try {
      await serviceProvidersApi.updateMeProfile({
        bio: bio.trim() || undefined,
        locationRegion: locationRegion.trim() || undefined,
        serviceTypes,
        heroImageUrl: heroImageUrl.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        portfolioUrl: portfolioUrlProfile.trim() || undefined,
        mentorOptIn,
      });
      await loadMe();
    } finally {
      setSavingMe(false);
    }
  };

  const openNewListing = () => {
    setEditingListingId(null);
    setListingServiceType('mixing');
    setListingTitle('');
    setListingDescription('');
    setListingRateCents('');
    setListingRateType('fixed');
    setListingStatus('active');
    setListingOpen(true);
  };

  const openEditListing = (l: ProviderProfile['listings'][number]) => {
    setEditingListingId(l.id);
    setListingServiceType(l.serviceType);
    setListingTitle(l.title);
    setListingDescription(l.description ?? '');
    setListingRateCents(l.rateCents != null ? String(l.rateCents) : '');
    setListingRateType(l.rateType);
    setListingStatus(l.status);
    setListingOpen(true);
  };

  const saveListing = async () => {
    if (!listingTitle.trim() || listingSaving) return;
    setListingSaving(true);
    try {
      const rate = listingRateCents.trim() ? Number(listingRateCents.trim()) : null;
      if (editingListingId) {
        await serviceProvidersApi.updateListing(editingListingId, {
          serviceType: listingServiceType,
          title: listingTitle,
          description: listingDescription.trim() || undefined,
          rateCents: Number.isFinite(rate) ? rate : null,
          rateType: listingRateType,
          status: listingStatus,
        });
      } else {
        await serviceProvidersApi.createListing({
          serviceType: listingServiceType,
          title: listingTitle,
          description: listingDescription.trim() || undefined,
          rateCents: rate == null || !Number.isFinite(rate) ? undefined : rate,
          rateType: listingRateType,
          status: listingStatus,
        });
      }
      setListingOpen(false);
      await loadMe();
    } finally {
      setListingSaving(false);
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    await serviceProvidersApi.deleteListing(id);
    await loadMe();
  };

  const savePortfolio = async () => {
    if (portfolioSaving) return;
    setPortfolioSaving(true);
    try {
      let fileUrl = portfolioUrl.trim();
      if (portfolioFile) {
        const up = await serviceProvidersApi.getPortfolioUploadUrl({
          filename: portfolioFile.name,
          contentType: portfolioFile.type,
        });
        const { signedUrl, publicUrl } = up.data;
        await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': portfolioFile.type },
          body: portfolioFile,
        });
        fileUrl = publicUrl;
      }
      if (!fileUrl) return;
      await serviceProvidersApi.addPortfolioItem({
        type: portfolioType,
        fileUrl,
        title: portfolioTitle.trim() || undefined,
        description: portfolioDescription.trim() || undefined,
        sortOrder: 0,
      });
      setPortfolioOpen(false);
      setPortfolioTitle('');
      setPortfolioDescription('');
      setPortfolioUrl('');
      setPortfolioFile(null);
      await loadMe();
    } finally {
      setPortfolioSaving(false);
    }
  };

  const deletePortfolioItem = async (id: string) => {
    if (!confirm('Delete this portfolio item?')) return;
    await serviceProvidersApi.deletePortfolioItem(id);
    await loadMe();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Services</h1>
        <p className="text-muted-foreground mt-1">
          {isProvider
            ? 'Build your Pro Directory profile: portfolio + service menu + your terms.'
            : 'Browse service providers, sort by location, and message pros directly.'}
        </p>
      </div>

      {isProvider ? (
        <Card>
          <CardContent className="pt-6 space-y-6">
            {loadingMe ? (
              <div className="py-10 text-center text-muted-foreground">Loading your provider profile…</div>
            ) : (
              <>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Your provider profile</h2>
                  <p className="text-sm text-muted-foreground">
                    This shows up in the Pro Directory and helps artists decide who to work with.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Location (region)</Label>
                    <Input value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} placeholder="Atlanta, GA" />
                  </div>
                  <div className="space-y-2">
                    <Label>Service types</Label>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_TYPE_OPTIONS.map((st) => {
                        const selected = serviceTypes.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => toggleServiceType(st)}
                            className={`px-3 py-1 rounded-full text-sm border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border hover:bg-muted'}`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you do, who you help, and what your process looks like…" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Hero image URL</Label>
                    <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://… (best work image)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Social & portfolio</Label>
                    <div className="space-y-2">
                      <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="Instagram URL" />
                      <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="LinkedIn URL" />
                      <Input value={portfolioUrlProfile} onChange={(e) => setPortfolioUrlProfile(e.target.value)} placeholder="Portfolio / website URL" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label className="text-base">Mentor status</Label>
                    <p className="text-sm text-muted-foreground">Offer mentorship to up-and-coming talent. Shows a Mentor badge on your profile.</p>
                  </div>
                  <Switch checked={mentorOptIn} onCheckedChange={setMentorOptIn} />
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveProfile} disabled={savingMe}>
                    {savingMe ? 'Saving…' : 'Save profile'}
                  </Button>
                  {profile?.id && (
                    <Button variant="outline" asChild>
                      <Link href={`/artist/${profile.id}`}>View public profile</Link>
                    </Button>
                  )}
                </div>

                <div className="border-t pt-6 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold">Service menu</h3>
                      <p className="text-sm text-muted-foreground">Post your offerings and prices (artists pay you directly on your terms).</p>
                    </div>
                    <Button onClick={openNewListing}>Add listing</Button>
                  </div>

                  {(me?.listings?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No listings yet.</p>
                  ) : (
                    <div className="grid gap-3">
                      {me!.listings.map((l) => (
                        <Card key={l.id}>
                          <CardContent className="pt-5 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{l.title}</p>
                                <Badge variant={l.status === 'active' ? 'default' : 'secondary'} className="capitalize">{l.status}</Badge>
                                <Badge variant="outline">{l.serviceType}</Badge>
                              </div>
                              {l.description && <p className="text-sm text-muted-foreground mt-1">{l.description}</p>}
                              <p className="text-sm mt-2">{formatRate(l.rateCents, l.rateType)}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button variant="outline" size="sm" onClick={() => openEditListing(l)}>Edit</Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteListing(l.id)}>Delete</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-6 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold">Portfolio</h3>
                      <p className="text-sm text-muted-foreground">Upload work samples or link external media.</p>
                    </div>
                    <Button onClick={() => setPortfolioOpen(true)}>Add portfolio item</Button>
                  </div>

                  {(me?.portfolio?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No portfolio items yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {me!.portfolio.map((p) => (
                        <Card key={p.id} className="overflow-hidden">
                          <CardContent className="pt-5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline">{p.type}</Badge>
                              <Button variant="ghost" size="sm" onClick={() => deletePortfolioItem(p.id)}>Remove</Button>
                            </div>
                            {p.type === 'image' && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.fileUrl} alt={p.title ?? 'Portfolio'} className="w-full h-40 object-cover rounded-md border" />
                            )}
                            {p.type === 'video' && (
                              <div className="w-full aspect-video rounded-md overflow-hidden bg-muted">
                                <video src={p.fileUrl} controls className="w-full h-full object-contain" title={p.title ?? 'Video'} />
                              </div>
                            )}
                            {p.type === 'audio' && <audio controls src={p.fileUrl} className="w-full" />}
                            {p.title && <p className="font-medium">{p.title}</p>}
                            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Dialog open={listingOpen} onOpenChange={setListingOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingListingId ? 'Edit listing' : 'Add listing'}</DialogTitle>
                      <DialogDescription>Artists will see this in your service menu.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Service type</Label>
                        <Select value={listingServiceType} onValueChange={setListingServiceType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPE_OPTIONS.map((st) => (
                              <SelectItem key={st} value={st}>{st}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} placeholder="Mixing (2-track)" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={listingDescription} onChange={(e) => setListingDescription(e.target.value)} placeholder="What’s included, turnaround time, revisions…" />
                      </div>
                      <div className="grid gap-3 grid-cols-2">
                        <div className="space-y-2">
                          <Label>Rate (cents)</Label>
                          <Input value={listingRateCents} onChange={(e) => setListingRateCents(e.target.value)} placeholder="e.g. 15000" />
                        </div>
                        <div className="space-y-2">
                          <Label>Rate type</Label>
                          <Select value={listingRateType} onValueChange={(v) => setListingRateType(v as any)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">fixed</SelectItem>
                              <SelectItem value="hourly">hourly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={listingStatus} onValueChange={(v) => setListingStatus(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="paused">paused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setListingOpen(false)}>Cancel</Button>
                      <Button onClick={saveListing} disabled={listingSaving || !listingTitle.trim()}>
                        {listingSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={portfolioOpen} onOpenChange={setPortfolioOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add portfolio item</DialogTitle>
                      <DialogDescription>Upload to Networx or link external media.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={portfolioType} onValueChange={(v) => setPortfolioType(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">image</SelectItem>
                            <SelectItem value="audio">audio</SelectItem>
                            <SelectItem value="video">video</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Upload file (optional)</Label>
                        <Input
                          type="file"
                          onChange={(e) => setPortfolioFile(e.target.files?.[0] ?? null)}
                          accept={portfolioType === 'image' ? 'image/*' : portfolioType === 'video' ? 'video/*' : 'audio/*'}
                        />
                        <p className="text-xs text-muted-foreground">
                          If you upload, we’ll store it in the `portfolio` bucket and use the public URL.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Or paste a link</Label>
                        <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" />
                      </div>

                      <div className="space-y-2">
                        <Label>Title (optional)</Label>
                        <Input value={portfolioTitle} onChange={(e) => setPortfolioTitle(e.target.value)} placeholder="Project name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea value={portfolioDescription} onChange={(e) => setPortfolioDescription(e.target.value)} placeholder="What this sample demonstrates…" />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPortfolioOpen(false)}>Cancel</Button>
                      <Button onClick={savePortfolio} disabled={portfolioSaving || (!portfolioFile && !portfolioUrl.trim())}>
                        {portfolioSaving ? 'Saving…' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Search name, headline, bio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                placeholder="Location (region)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Service type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SERVICE_TYPE_OPTIONS.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="nearby" checked={nearbyEnabled} onCheckedChange={(checked) => {
                  setNearbyEnabled(checked);
                  if (checked && userLat == null && typeof navigator !== 'undefined' && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
                      () => setNearbyEnabled(false),
                    );
                  }
                  if (!checked) { setUserLat(null); setUserLng(null); }
                }} />
                <Label htmlFor="nearby" className="text-sm">Nearby</Label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Price range (cents):</span>
              <Input type="number" placeholder="Min" className="w-24" value={minRateCents} onChange={(e) => setMinRateCents(e.target.value)} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" placeholder="Max" className="w-24" value={maxRateCents} onChange={(e) => setMaxRateCents(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => loadDirectory()} disabled={loading}>Apply filters</Button>
              <Button variant="outline" onClick={() => { setSearch(''); setLocation(''); setServiceType('all'); setMinRateCents(''); setMaxRateCents(''); setNearbyEnabled(false); setUserLat(null); setUserLng(null); }} disabled={loading}>
                Clear
              </Button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Loading providers…</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sortedItems.map((p) => (
                  <Card key={p.userId} className="overflow-hidden">
                    <CardContent className="p-4 flex gap-4">
                      <Link href={`/artist/${p.userId}`} className="shrink-0">
                        {p.avatarUrl ? (
                          <Image src={p.avatarUrl} alt={p.displayName ?? 'Avatar'} width={64} height={64} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">🛠️</div>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/artist/${p.userId}`} className="font-medium text-foreground hover:underline truncate">
                            {p.displayName || 'Unnamed'}
                          </Link>
                          {p.mentorOptIn && (
                            <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium ring-1 ring-primary/40" title="Mentor">
                              Mentor
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">Service provider</Badge>
                        </div>
                        {p.headline && <p className="text-sm text-muted-foreground truncate mt-0.5">{p.headline}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          {p.locationRegion && <p className="text-xs text-muted-foreground">📍 {p.locationRegion}</p>}
                          {p.distanceKm != null && <p className="text-xs text-muted-foreground">{p.distanceKm.toFixed(1)} km away</p>}
                        </div>
                        {p.serviceTypes?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {p.serviceTypes.slice(0, 4).map((st) => (
                              <Badge key={st} variant="outline" className="text-xs">{st}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/artist/${p.userId}`}>View profile</Link>
                          </Button>
                          <Button size="sm" asChild>
                            <Link href={`/messages?with=${p.userId}`}>Message</Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sortedItems.length === 0 && (
                  <div className="sm:col-span-2 py-10 text-center text-muted-foreground">
                    No providers match your filters.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
