'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserProfile {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    avatar_url: string | null;
    created_at: string;
  };
  songs: Array<{
    id: string;
    title: string;
    artist_name: string;
    status: string;
    play_count: number;
    like_count: number;
    artwork_url: string | null;
    created_at: string;
  }>;
  totalLikes: number;
  totalPlays: number;
}

export default function AdminUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await adminApi.getUserProfile(userId);
        setProfile(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'approved') return 'default';
    if (status === 'rejected') return 'destructive';
    return 'secondary';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Back
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const { user, songs, totalLikes, totalPlays } = profile;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">← Back to Users</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url ?? undefined} alt={user.display_name || user.email} />
              <AvatarFallback className="text-lg">
                {(user.display_name || user.email)[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {user.display_name || 'No name'}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize">
                  {user.role}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {(user.role === 'artist' || songs.length > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Songs</p>
              <p className="text-2xl font-semibold text-foreground">{songs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Likes</p>
              <p className="text-2xl font-semibold text-foreground">{totalLikes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Discoveries</p>
              <p className="text-2xl font-semibold text-foreground">{totalPlays}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {songs.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Songs</h2>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Discoveries</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.id}>
                    <TableCell>
                      <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                        {song.artwork_url ? (
                          <img
                            src={song.artwork_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                            —
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/songs?search=${encodeURIComponent(song.title)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {song.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(song.status)} className="capitalize">
                        {song.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{song.play_count ?? 0}</TableCell>
                    <TableCell className="text-right">{song.like_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(song.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {songs.length === 0 && user.role === 'artist' && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No songs uploaded yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
