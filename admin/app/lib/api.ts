// API client for admin dashboard

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Admin API functions
export const adminApi = {
  // Songs
  async getSongs(token: string, filters?: { status?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());
    
    const queryString = params.toString();
    const endpoint = `admin/songs${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<{ songs: Song[]; total: number }>(endpoint, { token });
  },

  async updateSongStatus(token: string, songId: string, status: 'approved' | 'rejected') {
    return apiRequest<{ song: Song }>(`admin/songs/${songId}`, {
      method: 'PATCH',
      body: { status },
      token,
    });
  },

  // Analytics
  async getAnalytics(token: string) {
    return apiRequest<Analytics>('admin/analytics', { token });
  },

  // Users
  async getUsers(token: string, filters?: { role?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());
    
    const queryString = params.toString();
    const endpoint = `admin/users${queryString ? `?${queryString}` : ''}`;
    
    return apiRequest<{ users: User[]; total: number }>(endpoint, { token });
  },

  async updateUserRole(token: string, userId: string, role: 'listener' | 'artist' | 'admin') {
    return apiRequest<{ user: User }>(`admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
      token,
    });
  },
};

// Types
export interface Song {
  id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  audio_url: string;
  artwork_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  credits_remaining: number;
  play_count: number;
  like_count: number;
  skip_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  role: 'listener' | 'artist' | 'admin';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalListeners: number;
  totalSongs: number;
  pendingSongs: number;
  approvedSongs: number;
  totalPlays: number;
  totalLikes: number;
}
