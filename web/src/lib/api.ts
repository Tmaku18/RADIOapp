import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getIdToken } from './firebase-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Always send fresh ID token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip token for public endpoints
    const publicEndpoints = ['/radio/current', '/songs'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url?.startsWith(endpoint) && config.method?.toLowerCase() === 'get'
    );
    
    if (!isPublicEndpoint) {
      try {
        // forceRefresh ensures token is valid even if cached one expired
        const token = await getIdToken(true);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get ID token:', error);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 gracefully
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token truly invalid - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login?session_expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// API methods for different endpoints
export const radioApi = {
  getCurrentTrack: () => api.get('/radio/current'),
  getNextTrack: () => api.get('/radio/next'),
  getStream: () => api.get('/radio/stream'),
  sendHeartbeat: (data: { streamToken: string; songId: string; timestamp: string }) => 
    api.post('/radio/heartbeat', data),
  reportPlay: (data: { songId: string; skipped?: boolean }) => 
    api.post('/radio/play', data),
};

export const songsApi = {
  getAll: (params?: { artistId?: string; status?: string; limit?: number; offset?: number }) => 
    api.get('/songs', { params }),
  getById: (id: string) => api.get(`/songs/${id}`),
  getMine: () => api.get('/songs/mine'),
  getUploadUrl: (data: { filename: string; contentType: string; bucket: 'songs' | 'artwork' }) => 
    api.post('/songs/upload-url', data),
  create: (data: { title: string; artistName: string; audioPath: string; artworkPath?: string }) => 
    api.post('/songs', data),
  like: (id: string) => api.post(`/songs/${id}/like`),
  unlike: (id: string) => api.delete(`/songs/${id}/like`),
  getLikeStatus: (id: string) => api.get(`/songs/${id}/like`),
  updateOptIn: (id: string, optInFreePlay: boolean) => 
    api.patch(`/songs/${id}`, { optInFreePlay }),
};

export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data: { displayName?: string; avatarUrl?: string }) => 
    api.put('/users/me', data),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: { email: string; displayName?: string; role: 'listener' | 'artist' }) => 
    api.post('/users', data),
};

export const creditsApi = {
  getBalance: () => api.get('/credits/balance'),
  getTransactions: (params?: { limit?: number; offset?: number }) => 
    api.get('/credits/transactions', { params }),
  getAllocations: (params?: { limit?: number }) => 
    api.get('/credits/allocations', { params }),
  allocateToSong: (songId: string, amount: number) => 
    api.post(`/credits/songs/${songId}/allocate`, { amount }),
  withdrawFromSong: (songId: string, amount: number) => 
    api.post(`/credits/songs/${songId}/withdraw`, { amount }),
};

export const paymentsApi = {
  createCheckoutSession: (data: { amount: number; credits: number }) => 
    api.post('/payments/create-checkout-session', data),
  getTransactions: () => api.get('/payments/transactions'),
};

export const adminApi = {
  getAnalytics: () => api.get('/admin/analytics'),
  getSongs: (params?: { status?: string; limit?: number; offset?: number }) => 
    api.get('/admin/songs', { params }),
  updateSongStatus: (id: string, status: 'approved' | 'rejected', reason?: string) => 
    api.patch(`/admin/songs/${id}`, { status, reason }),
  getUsers: (params?: { role?: string; limit?: number; offset?: number }) => 
    api.get('/admin/users', { params }),
  updateUserRole: (id: string, role: 'listener' | 'artist' | 'admin') => 
    api.patch(`/admin/users/${id}/role`, { role }),
  // Fallback playlist management
  getFallbackSongs: () => api.get('/admin/fallback-songs'),
  addFallbackSong: (data: { title: string; artistName: string; audioUrl: string; artworkUrl?: string; durationSeconds?: number }) =>
    api.post('/admin/fallback-songs', data),
  updateFallbackSong: (id: string, data: { isActive?: boolean }) =>
    api.patch(`/admin/fallback-songs/${id}`, data),
  deleteFallbackSong: (id: string) => api.delete(`/admin/fallback-songs/${id}`),
};

export const notificationsApi = {
  getAll: (params?: { limit?: number }) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/mark-all-read'),
};

export const chatApi = {
  sendMessage: (message: string, songId?: string) => 
    api.post('/chat/send', { message, songId }),
  getHistory: (params?: { limit?: number }) => 
    api.get('/chat/history', { params }),
  getStatus: () => api.get('/chat/status'),
};

export const pushNotificationsApi = {
  registerDevice: (fcmToken: string, deviceType: 'ios' | 'android' | 'web') =>
    api.post('/push-notifications/register-device', { fcmToken, deviceType }),
  unregisterDevice: (fcmToken: string) =>
    api.post('/push-notifications/unregister-device', { fcmToken }),
  getDevices: () => api.get('/push-notifications/devices'),
};

export default api;
