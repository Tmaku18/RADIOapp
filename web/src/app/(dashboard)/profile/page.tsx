'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, creatorNetworkApi, paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [hasCreatorAccess, setHasCreatorAccess] = useState<boolean | null>(null);
  const [creatorNetworkLoading, setCreatorNetworkLoading] = useState(false);

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
    }
  }, [profile?.displayName, profile?.region, profile?.suggestLocalArtists, profile?.bio, profile?.headline, profile?.locationRegion, isEditing]);

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
      });
      await refreshProfile();
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
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
    setIsEditing(false);
    setError(null);
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

  const handleUpgradeToArtist = async () => {
    setError(null);
    setIsUpgrading(true);

    try {
      await usersApi.upgradeToArtist();
      await refreshProfile();
      setUpgradeSuccess(true);
      // Redirect to artist dashboard after short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade account');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="max-w-2xl">
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
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatarUrl ?? undefined} />
              <AvatarFallback className="text-2xl">👤</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-foreground">{profile?.displayName || 'No name set'}</h3>
              <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
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

            {(profile?.role === 'artist' || profile?.role === 'admin' || profile?.role === 'service_provider') && (
              <div className="space-y-2">
                <Label>Bio</Label>
                {isEditing ? (
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell listeners about yourself..."
                    rows={4}
                    className="resize-y"
                  />
                ) : (
                  <Textarea value={bio || 'Not set'} disabled rows={4} className="resize-none" />
                )}
                <p className="text-xs text-muted-foreground">Shown on your artist or provider profile</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Account Type</Label>
              <Input value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''} disabled />
              {profile?.role === 'listener' && (
                <p className="text-xs text-muted-foreground">Want to share your music? Upgrade to an artist account below.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Member Since</Label>
              <Input value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''} disabled />
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

      {profile?.role === 'listener' && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🎤</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">Become an Artist</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Upgrade your account to share your music with the world. As an artist, you can upload tracks, purchase airtime credits, and get your music on the radio.
                </p>
                {upgradeSuccess ? (
                  <Alert>
                    <AlertDescription>Congratulations! Your account has been upgraded to Artist. Redirecting to dashboard...</AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center gap-4">
                    <Button onClick={handleUpgradeToArtist} disabled={isUpgrading}>
                      {isUpgrading ? 'Upgrading...' : 'Upgrade to Artist'}
                    </Button>
                    <span className="text-sm text-muted-foreground">Free to upgrade</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">✨</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">Creator Network</h3>
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
    </div>
  );
}
