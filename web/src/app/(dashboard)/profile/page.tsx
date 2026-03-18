'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, creatorNetworkApi, paymentsApi } from '@/lib/api';
import { hasArtistCapability } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type FollowListItem = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [region, setRegion] = useState(profile?.region ?? '');
  const [suggestLocalArtists, setSuggestLocalArtists] = useState(profile?.suggestLocalArtists !== false);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [headline, setHeadline] = useState(profile?.headline ?? '');
  const [locationRegion, setLocationRegion] = useState(profile?.locationRegion ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagramUrl ?? '');
  const [twitterUrl, setTwitterUrl] = useState(profile?.twitterUrl ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(profile?.youtubeUrl ?? '');
  const [tiktokUrl, setTiktokUrl] = useState(profile?.tiktokUrl ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl ?? '');
  const [selectedRole, setSelectedRole] = useState<
    'listener' | 'artist' | 'service_provider'
  >((profile?.role as 'listener' | 'artist' | 'service_provider') || 'listener');
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasCreatorAccess, setHasCreatorAccess] = useState<boolean | null>(null);
  const [creatorNetworkLoading, setCreatorNetworkLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number }>({
    followers: 0,
    following: 0,
  });
  const [followers, setFollowers] = useState<FollowListItem[]>([]);
  const [following, setFollowing] = useState<FollowListItem[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followMutatingId, setFollowMutatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  useEffect(() => {
    const cn = searchParams.get('creator_network');
    if (cn === 'success') setSuccess(true);
    if (cn === 'canceled') setError('Creator Network checkout was canceled.');
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await creatorNetworkApi.getAccess();
        setHasCreatorAccess((res.data as { hasAccess: boolean }).hasAccess);
      } catch {
        setHasCreatorAccess(false);
      }
    };
    if (profile) load();
  }, [profile]);

  // Sync local state when profile changes (e.g., after refreshProfile)
  useEffect(() => {
    if (!isEditing) {
      if (profile?.displayName !== undefined) setDisplayName(profile.displayName || '');
      if (profile?.region !== undefined) setRegion(profile.region ?? '');
      if (profile?.suggestLocalArtists !== undefined) setSuggestLocalArtists(profile.suggestLocalArtists !== false);
      if (profile?.bio !== undefined) setBio(profile.bio ?? '');
      if (profile?.headline !== undefined) setHeadline(profile.headline ?? '');
      if (profile?.locationRegion !== undefined) setLocationRegion(profile.locationRegion ?? '');
      if (profile?.instagramUrl !== undefined) setInstagramUrl(profile.instagramUrl ?? '');
      if (profile?.twitterUrl !== undefined) setTwitterUrl(profile.twitterUrl ?? '');
      if (profile?.youtubeUrl !== undefined) setYoutubeUrl(profile.youtubeUrl ?? '');
      if (profile?.tiktokUrl !== undefined) setTiktokUrl(profile.tiktokUrl ?? '');
      if (profile?.websiteUrl !== undefined) setWebsiteUrl(profile.websiteUrl ?? '');
      if (profile?.role && profile.role !== 'admin') {
        setSelectedRole(profile.role as 'listener' | 'artist' | 'service_provider');
      }
    }
  }, [profile?.displayName, profile?.region, profile?.suggestLocalArtists, profile?.bio, profile?.headline, profile?.locationRegion, profile?.instagramUrl, profile?.twitterUrl, profile?.youtubeUrl, profile?.tiktokUrl, profile?.websiteUrl, profile?.role, isEditing]);

  useEffect(() => {
    const userId = profile?.id;
    if (!userId) return;
    let mounted = true;
    const loadFollowData = async () => {
      setFollowLoading(true);
      try {
        const [countsRes, followersRes, followingRes] = await Promise.all([
          usersApi.getFollowCounts(userId),
          usersApi.getFollowers(userId, { limit: 24, offset: 0 }),
          usersApi.getFollowing(userId, { limit: 24, offset: 0 }),
        ]);
        if (!mounted) return;
        setFollowCounts({
          followers: countsRes.data?.followers ?? 0,
          following: countsRes.data?.following ?? 0,
        });
        setFollowers((followersRes.data?.items ?? []) as FollowListItem[]);
        setFollowing((followingRes.data?.items ?? []) as FollowListItem[]);
      } catch (err) {
        console.error('Failed to load follow lists', err);
      } finally {
        if (mounted) setFollowLoading(false);
      }
    };
    void loadFollowData();
    return () => {
      mounted = false;
    };
  }, [profile?.id]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      await usersApi.updateMe({
        displayName,
        region: region.trim() || undefined,
        suggestLocalArtists,
        bio: bio.trim() || undefined,
        headline: headline.trim() || undefined,
        locationRegion: locationRegion.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        twitterUrl: twitterUrl.trim() || undefined,
        youtubeUrl: youtubeUrl.trim() || undefined,
        tiktokUrl: tiktokUrl.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        role: !isAdmin ? selectedRole : undefined,
      });
      await refreshProfile();
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Failed to update profile');
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile?.displayName || '');
    setRegion(profile?.region ?? '');
    setSuggestLocalArtists(profile?.suggestLocalArtists !== false);
    setBio(profile?.bio ?? '');
    setHeadline(profile?.headline ?? '');
    setLocationRegion(profile?.locationRegion ?? '');
    setInstagramUrl(profile?.instagramUrl ?? '');
    setTwitterUrl(profile?.twitterUrl ?? '');
    setYoutubeUrl(profile?.youtubeUrl ?? '');
    setTiktokUrl(profile?.tiktokUrl ?? '');
    setWebsiteUrl(profile?.websiteUrl ?? '');
    if (profile?.role && profile.role !== 'admin') {
      setSelectedRole(profile.role as 'listener' | 'artist' | 'service_provider');
    }
    setIsEditing(false);
    setError(null);
  };

  const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_AVATAR_SIZE = 15 * 1024 * 1024; // 15MB

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Image must be 15MB or smaller.');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      await usersApi.uploadProfilePhoto(file);
      await refreshProfile();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      await usersApi.updateMe({ avatarUrl: '' });
      await refreshProfile();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  const isCatalyst = profile?.role === 'service_provider';
  const isAdmin = profile?.role === 'admin';
  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin'
      : profile?.role === 'service_provider'
        ? 'Catalyst'
        : profile?.role === 'artist'
          ? 'Artist'
          : 'Listener';
  const getPublicProfileHref = (userId: string, role: FollowListItem['role']) =>
    role === 'service_provider' ? `/pro-networx/u/${userId}` : `/artist/${userId}`;

  const handleUnfollow = async (targetUserId: string) => {
    setFollowMutatingId(targetUserId);
    try {
      await usersApi.unfollow(targetUserId);
      setFollowing((prev) => prev.filter((u) => u.id !== targetUserId));
      setFollowCounts((prev) => ({
        ...prev,
        following: Math.max(0, (prev.following || 0) - 1),
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to unfollow user',
      );
    } finally {
      setFollowMutatingId(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {hasArtistCapability(profile?.role) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🔴</div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground mb-1">Go Live</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Streaming requires admin approval. Request access, then manage your stream (title, category, start/stop) in Stream settings.
                </p>
                <Button size="lg" className="rounded-full bg-primary text-primary-foreground hover:opacity-90" asChild>
                  <a href="/stream-settings">Stream settings</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-1">Profile Settings</h2>
          <p className="text-muted-foreground mb-6">Manage your account information</p>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6">
              <AlertDescription>Profile updated successfully!</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xl">👤</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload profile picture"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{profile?.displayName || 'No name set'}</h3>
              <p className="text-sm text-muted-foreground">{roleLabel}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingAvatar ? 'Uploading...' : 'Change profile picture'}
                </Button>
                {profile?.avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUploadingAvatar}
                    onClick={handleRemovePhoto}
                    className="text-muted-foreground"
                  >
                    Remove photo
                  </Button>
                )}
              </div>
              {avatarError && (
                <p className="text-sm text-destructive mt-1">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={user?.email || ''} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label>Display Name</Label>
              {isEditing ? (
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your display name" />
              ) : (
                <Input value={profile?.displayName || 'Not set'} disabled />
              )}
            </div>

            <div className="space-y-2">
              <Label>Headline</Label>
              {isEditing ? (
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Short tagline (e.g. Producer, Photographer)" />
              ) : (
                <Input value={headline || 'Not set'} disabled />
              )}
              <p className="text-xs text-muted-foreground">Shown on your profile and in discovery</p>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              {isEditing ? (
                <Input value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} placeholder="e.g. Atlanta, GA or London, UK" />
              ) : (
                <Input value={locationRegion || 'Not set'} disabled />
              )}
              <p className="text-xs text-muted-foreground">Used for discovery and &quot;Artists in your area&quot;</p>
            </div>

            <div className="space-y-2">
              <Label>Region</Label>
              {isEditing ? (
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. US, US-Georgia, UK-London"
                />
              ) : (
                <Input value={region || 'Not set'} disabled />
              )}
              <p className="text-xs text-muted-foreground">Used for &quot;Artists in your area&quot; on the Competition page</p>
            </div>

            <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Suggest artists in my area</Label>
                <p className="text-sm text-muted-foreground">Show local artist suggestions on the Competition page</p>
              </div>
              {isEditing ? (
                <Switch checked={suggestLocalArtists} onCheckedChange={setSuggestLocalArtists} />
              ) : (
                <Switch checked={suggestLocalArtists} disabled />
              )}
            </div>

            {hasArtistCapability(profile?.role) && (
              <div className="space-y-2">
                <Label>Bio</Label>
                {isEditing ? (
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell prospectors about yourself..."
                    rows={4}
                    className="resize-y"
                  />
                ) : (
                  <Textarea value={bio || 'Not set'} disabled rows={4} className="resize-none" />
                )}
                <p className="text-xs text-muted-foreground">Shown on your artist or provider profile</p>
              </div>
            )}

            {hasArtistCapability(profile?.role) && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <Label>Social links</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="Instagram URL" disabled={!isEditing} />
                  <Input value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} placeholder="X / Twitter URL" disabled={!isEditing} />
                  <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="YouTube URL" disabled={!isEditing} />
                  <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="TikTok URL" disabled={!isEditing} />
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="Website URL" disabled={!isEditing} className="md:col-span-2" />
                </div>
                <p className="text-xs text-muted-foreground">These links appear on your Spotify-style artist page.</p>
              </div>
            )}

            <div className="space-y-3">
              <Label>Account</Label>
              {isEditing && !isAdmin ? (
                <select
                  value={selectedRole}
                  onChange={(e) =>
                    setSelectedRole(
                      e.target.value as 'listener' | 'artist' | 'service_provider',
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="listener">Listener</option>
                  <option value="artist">Artist</option>
                  <option value="service_provider">Catalyst</option>
                </select>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-foreground font-medium">
                  {roleLabel}
                </div>
              )}
              {!isAdmin && (
                <p className="text-sm text-muted-foreground">
                  You can switch between Listener, Artist, and Catalyst here.
                </p>
              )}
              {isCatalyst && (
                <p className="text-xs text-muted-foreground">You offer services on ProNetworx. Profile is managed there.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <Input
                value={
                  profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'
                }
                disabled
              />
              <p className="text-xs text-muted-foreground">Account creation date</p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-border">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Social</h3>
              <p className="text-sm text-muted-foreground">
                Your public follow graph (Instagram-style).
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>
                <span className="font-semibold text-foreground">{followCounts.followers}</span>{' '}
                <span className="text-muted-foreground">Followers</span>
              </span>
              <span>
                <span className="font-semibold text-foreground">{followCounts.following}</span>{' '}
                <span className="text-muted-foreground">Following</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-3">
              <h4 className="text-sm font-medium mb-3">Followers</h4>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {followLoading && followers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : followers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No followers yet.</p>
                ) : (
                  followers.map((u) => (
                    <Link
                      key={`follower-${u.id}`}
                      href={getPublicProfileHref(u.id, u.role)}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.avatarUrl ?? undefined} />
                        <AvatarFallback>👤</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.headline || '—'}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <h4 className="text-sm font-medium mb-3">Following</h4>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {followLoading && following.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : following.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You are not following anyone yet.</p>
                ) : (
                  following.map((u) => (
                    <div
                      key={`following-${u.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Link
                        href={getPublicProfileHref(u.id, u.role)}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatarUrl ?? undefined} />
                          <AvatarFallback>👤</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.displayName || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.headline || '—'}</p>
                        </div>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={followMutatingId === u.id}
                        onClick={() => void handleUnfollow(u.id)}
                        className="shrink-0"
                      >
                        {followMutatingId === u.id ? '...' : 'Unfollow'}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">✨</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-foreground">Creator Network</h3>
                {hasCreatorAccess ? (
                  <Badge className="bg-[var(--brand-pro)] text-black border border-black/10">PRO</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Unlock direct messages with other artists and providers. Subscribe to send and receive DMs.
              </p>
              {hasCreatorAccess === null ? (
                <span className="text-sm text-muted-foreground">Checking...</span>
              ) : hasCreatorAccess ? (
                <p className="text-sm text-green-600 font-medium">You have Creator Network access. You can send messages from Discover or Messages.</p>
              ) : (
                <Button
                  onClick={async () => {
                    setCreatorNetworkLoading(true);
                    try {
                      const res = await paymentsApi.createCreatorNetworkCheckoutSession();
                      const url = (res.data as { url?: string })?.url;
                      if (url) window.location.href = url;
                      else setError('Checkout is not configured. Contact support.');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to start checkout');
                    } finally {
                      setCreatorNetworkLoading(false);
                    }
                  }}
                  disabled={creatorNetworkLoading}
                >
                  {creatorNetworkLoading ? 'Redirecting...' : 'Subscribe to Creator Network'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="text-lg font-medium text-foreground mb-2">Sign Out</h3>
          <p className="text-muted-foreground text-sm mb-4">Sign out of your account on this device.</p>
          <Button variant="destructive" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <a href="/settings" className="underline hover:text-foreground">Settings and activity</a> — Account, notifications, security, and more.
      </p>
    </div>
  );
}
