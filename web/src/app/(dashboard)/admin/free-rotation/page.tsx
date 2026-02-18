'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Song {
  id: string;
  artist_id?: string;
  title: string;
  status: string;
  duration_seconds: number;
  opt_in_free_play: boolean;
  admin_free_rotation: boolean;
  paid_play_count: number;
  credits_remaining: number;
  play_count: number;
  like_count: number;
  created_at: string;
  last_played_at?: string | null;
  artwork_url?: string | null;
  users?: {
    id: string;
    display_name: string | null;
    email: string;
  };
  isEligibleForFreeRotation?: boolean;
  eligibilityChecks?: {
    hasPaidPlay: boolean;
    artistOptedIn: boolean;
    adminApproved: boolean;
  };
}

interface User {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
  created_at: string;
}

type SearchTab = 'songs' | 'users';

export default function FreeRotationPage() {
  const [searchTab, setSearchTab] = useState<SearchTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [freeRotationSongs, setFreeRotationSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load songs currently in free rotation
  const loadFreeRotationSongs = useCallback(async () => {
    try {
      const response = await adminApi.getSongsInFreeRotation();
      setFreeRotationSongs(response.data.songs || []);
    } catch (err: any) {
      console.error('Failed to load free rotation songs:', err);
    }
  }, []);

  useEffect(() => {
    loadFreeRotationSongs();
  }, [loadFreeRotationSongs]);

  // Search songs
  const searchSongs = async () => {
    if (searchQuery.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.searchSongsForFreeRotation(searchQuery);
      setSongs(response.data.songs || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search songs');
    } finally {
      setLoading(false);
    }
  };

  // Search users
  const searchUsers = async () => {
    if (searchQuery.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.searchUsersForFreeRotation(searchQuery);
      setUsers(response.data.users || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  // Load songs for a specific user
  const loadUserSongs = async (user: User) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const response = await adminApi.getUserSongsForFreeRotation(user.id);
      setUserSongs(response.data.songs || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load user songs');
    } finally {
      setLoading(false);
    }
  };

  // Toggle free rotation for a song
  const toggleFreeRotation = async (song: Song) => {
    try {
      await adminApi.toggleFreeRotation(song.id, !song.admin_free_rotation);
      // Refresh data
      if (selectedUser) {
        await loadUserSongs(selectedUser);
      } else if (searchTab === 'songs' && songs.length > 0) {
        await searchSongs();
      }
      await loadFreeRotationSongs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle free rotation');
    }
  };

  // Handle search
  const handleSearch = () => {
    if (searchTab === 'songs') {
      searchSongs();
    } else {
      searchUsers();
    }
  };

  // Render eligibility badge
  const EligibilityBadge = ({ song }: { song: Song }) => {
    if (song.isEligibleForFreeRotation ?? song.admin_free_rotation) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
          In Free Rotation
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full">
        Not Eligible
      </span>
    );
  };

  // Render eligibility checklist
  const EligibilityChecklist = ({ song }: { song: Song }) => song.eligibilityChecks ? (
    <div className="flex gap-3 text-xs mt-1">
      <span className={song.eligibilityChecks.hasPaidPlay ? 'text-green-600' : 'text-gray-400'}>
        {song.eligibilityChecks.hasPaidPlay ? '✓' : '○'} {song.paid_play_count} paid plays
      </span>
      <span className={song.eligibilityChecks.artistOptedIn ? 'text-green-600' : 'text-gray-400'}>
        {song.eligibilityChecks.artistOptedIn ? '✓' : '○'} Artist opted in
      </span>
      <span className={song.eligibilityChecks.adminApproved ? 'text-green-600' : 'text-gray-400'}>
        {song.eligibilityChecks.adminApproved ? '✓' : '○'} Admin approved
      </span>
    </div>
  ) : null;

  // Render song row
  const SongRow = ({ song, showArtist = false }: { song: Song; showArtist?: boolean }) => (
    <div className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-medium">{song.title}</span>
          <EligibilityBadge song={song} />
        </div>
        {showArtist && song.users && (
          <p className="text-sm text-gray-500">{song.users.display_name || song.users.email}</p>
        )}
        <EligibilityChecklist song={song} />
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm text-gray-500">
          <p>{song.play_count} plays</p>
          <p>{song.like_count} ripples</p>
        </div>
        <button
          onClick={() => toggleFreeRotation(song)}
          disabled={song.eligibilityChecks ? (!song.eligibilityChecks.hasPaidPlay || !song.eligibilityChecks.artistOptedIn) : false}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            song.admin_free_rotation
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : song.eligibilityChecks && song.eligibilityChecks.hasPaidPlay && song.eligibilityChecks.artistOptedIn
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {song.admin_free_rotation ? 'Remove from Rotation' : 'Add to Rotation'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Section - at top */}
      <div className="bg-card border border-border rounded-lg p-4">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-4 border-b">
          <button
            onClick={() => { setSearchTab('songs'); setSelectedUser(null); }}
            className={`pb-2 px-1 font-medium ${
              searchTab === 'songs' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground'
            }`}
          >
            Search Ores
          </button>
          <button
            onClick={() => { setSearchTab('users'); setSelectedUser(null); }}
            className={`pb-2 px-1 font-medium ${
              searchTab === 'users' 
                ? 'text-primary border-b-2 border-primary' 
                : 'text-muted-foreground'
            }`}
          >
            Search Users
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={searchTab === 'songs' ? 'Search by ore title...' : 'Search by name or email...'}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={handleSearch}
            disabled={loading || searchQuery.trim().length < 2}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-destructive text-sm">{error}</p>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Free Rotation Management</h1>
        <p className="text-muted-foreground mt-1">
          Search ores or users to manage the free rotation playlist. 
          Ores require: 1+ paid play, artist opt-in, and admin approval.
        </p>
      </div>

      {/* Free Rotation Queue Table */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold text-foreground">
            Free Rotation Queue ({freeRotationSongs.length} ores)
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ores currently in the free rotation playback queue
          </p>
        </div>
        {freeRotationSongs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No ores in free rotation. Search above to add ores.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ore</TableHead>
                <TableHead>Artist</TableHead>
                <TableHead className="text-right">Plays</TableHead>
                <TableHead className="text-right">Ripples</TableHead>
                <TableHead>Last Played</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {freeRotationSongs.map((song) => (
                <TableRow key={song.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        {song.artwork_url ? (
                          <img src={song.artwork_url} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <span className="text-muted-foreground">🎵</span>
                        )}
                      </div>
                      {(song.artist_id ?? song.users?.id) ? (
                        <Link
                          href={`/admin/users/${song.artist_id ?? song.users!.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {song.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{song.title}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(song.artist_id ?? song.users?.id) ? (
                      <Link
                        href={`/admin/users/${song.artist_id ?? song.users!.id}`}
                        className="text-primary hover:underline"
                      >
                        {song.users?.display_name || song.users?.email || 'Unknown'}
                      </Link>
                    ) : (
                      <span>{song.users?.display_name || song.users?.email || 'Unknown'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{song.play_count ?? 0}</TableCell>
                  <TableCell className="text-right">{song.like_count ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {song.last_played_at
                      ? new Date(song.last_played_at).toLocaleString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFreeRotation(song)}
                      disabled={loading}
                    >
                      Remove from Rotation
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Results */}
      {selectedUser ? (
        /* User's Songs */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Ores by {selectedUser.display_name || selectedUser.email}
              </h2>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-primary hover:text-primary/90"
            >
              Back to search
            </button>
          </div>
          
          {userSongs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No approved ores found for this user.</p>
          ) : (
            <div className="space-y-3">
              {userSongs.map((song) => (
                <SongRow key={song.id} song={song} />
              ))}
            </div>
          )}
        </div>
      ) : searchTab === 'songs' && songs.length > 0 ? (
        /* Song Search Results */
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Search Results ({songs.length})</h2>
          {songs.map((song) => (
            <SongRow key={song.id} song={song} showArtist />
          ))}
        </div>
      ) : searchTab === 'users' && users.length > 0 ? (
        /* User Search Results */
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Search Results ({users.length})</h2>
          {users.map((user) => (
            <div
              key={user.id}
              onClick={() => loadUserSongs(user)}
              className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div>
                <p className="font-medium">{user.display_name || 'No name'}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  user.role === 'artist' ? 'bg-primary/10 text-primary' :
                  user.role === 'admin' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {user.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
