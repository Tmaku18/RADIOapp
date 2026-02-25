import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getIdToken } from './firebase-client';

// API calls use same-origin /api; Next.js rewrites proxy to backend.
// Set BACKEND_URL or NEXT_PUBLIC_API_URL to match your backend (e.g. http://localhost:3005).
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Always send fresh ID token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip token for public endpoints (exact matches only)
    const publicEndpoints = ['/radio/current', '/venue-ads/current'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url === endpoint && config.method?.toLowerCase() === 'get'
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

    // FormData must use multipart/form-data with boundary; do not send application/json
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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

export const prospectorApi = {
  getYield: () => api.get('/prospector/yield'),
  checkIn: (data?: { sessionId?: string | null }) => api.post('/prospector/check-in', data ?? {}),
  submitRefinement: (data: { songId: string; playId?: string | null; score: number }) =>
    api.post('/prospector/refinement', data),
  submitSurvey: (data: { songId: string; playId?: string | null; responses: Record<string, unknown> }) =>
    api.post('/prospector/survey', data),
  redeem: (data: { amountCents: number; type: 'virtual_visa' | 'merch' | 'boost_credits'; requestId?: string | null }) =>
    api.post('/yield/redeem', data),
};

export const refineryApi = {
  listSongs: (params?: { limit?: number; offset?: number }) =>
    api.get<{ songs: Array<{ id: string; title: string; artist_name: string; artwork_url: string | null; audio_url: string; duration_seconds: number | null; created_at: string }>; limit: number; offset: number }>('/refinery/songs', { params: params ?? {} }),
  addSong: (songId: string) => api.post(`/refinery/songs/${songId}/add`),
  removeSong: (songId: string) => api.post(`/refinery/songs/${songId}/remove`),
  getComments: (songId: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ comments: Array<{ id: string; body: string; created_at: string; users?: { display_name: string | null } }> }>(`/refinery/songs/${songId}/comments`, { params: params ?? {} }),
  addComment: (songId: string, body: string) => api.post(`/refinery/songs/${songId}/comments`, { body }),
};

export const venueAdsApi = {
  getCurrent: (stationId?: string) => api.get<{ id: string; imageUrl: string; linkUrl: string | null; stationId: string } | null>('/venue-ads/current', { params: stationId ? { stationId } : {} }),
};

export const songsApi = {
  getAll: (params?: { artistId?: string; status?: string; limit?: number; offset?: number }) => 
    api.get('/songs', { params }),
  getById: (id: string) => api.get(`/songs/${id}`),
  getMine: () => api.get('/songs/mine'),
  getUploadUrl: (data: { filename: string; contentType: string; bucket: 'songs' | 'artwork' }) => 
    api.post('/songs/upload-url', data),
  create: (data: { title: string; artistName: string; audioPath: string; artworkPath?: string; durationSeconds?: number }) => 
    api.post('/songs', data),
  like: (id: string) => api.post(`/songs/${id}/like`),
  unlike: (id: string) => api.delete(`/songs/${id}/like`),
  getLikeStatus: (id: string) => api.get(`/songs/${id}/like`),
  recordProfileListen: (id: string, data?: { startedAt?: string; secondsListened?: number }) =>
    api.post(`/songs/${id}/profile-listen`, data ?? {}),
  updateOptIn: (id: string, optInFreePlay: boolean) => 
    api.patch(`/songs/${id}`, { optInFreePlay }),
};

export const usersApi = {
  getMe: () => api.get('/users/me'),
  checkAdmin: () => api.get<{ isAdmin: boolean }>('/users/me/check-admin'),
  updateMe: (data: { displayName?: string; avatarUrl?: string; region?: string; suggestLocalArtists?: boolean; bio?: string; headline?: string; locationRegion?: string }) => 
    api.put('/users/me', data),
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/me/avatar', formData);
  },
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: { email: string; displayName?: string; role?: 'listener' | 'artist' | 'service_provider' }) => 
    api.post('/users', data),
  upgradeToArtist: () => api.post('/users/upgrade-to-artist'),
};

export const suggestionsApi = {
  getLocalArtists: (limit?: number) => api.get('/suggestions/local-artists', { params: { limit } }),
};

export const leaderboardApi = {
  getSongs: (params: { by: 'likes' | 'listens'; limit?: number; offset?: number }) => 
    api.get('/leaderboard/songs', { params }),
  getUpvotesPerMinute: (params?: { windowMinutes?: number; limit?: number; offset?: number }) =>
    api.get('/leaderboard/upvotes-per-minute', { params }),
  addLeaderboardLike: (songId: string, playId?: string) => 
    api.post(`/leaderboard/songs/${songId}/like`, { playId }),
};

export const feedApi = {
  getNewsPromotions: (limit?: number) => api.get('/feed/news-promotions', { params: { limit } }),
};

export const spotlightApi = {
  getToday: () => api.get('/spotlight/today'),
  getWeek: (start?: string) => api.get('/spotlight/week', { params: { start } }),
  canListenUnlimited: (artistId: string, songId: string) => 
    api.get('/spotlight/can-listen-unlimited', { params: { artistId, songId } }),
  recordListen: (data: { songId: string; artistId: string; context: 'featured_replay' | 'artist_of_week' | 'artist_of_month' }) => 
    api.post('/spotlight/listen', data),
};

export const liveServicesApi = {
  listByArtist: (artistId: string) => api.get(`/live-services/artist/${artistId}`),
  listMine: () => api.get('/live-services'),
  upcoming: (limit?: number) => api.get('/live-services/upcoming', { params: { limit } }),
  create: (data: { title: string; description?: string; type?: string; scheduledAt?: string; linkOrPlace?: string }) =>
    api.post('/live-services', data),
  getById: (id: string) => api.get(`/live-services/${id}`),
  update: (id: string, data: { title?: string; description?: string; type?: string; scheduledAt?: string; linkOrPlace?: string }) =>
    api.patch(`/live-services/${id}`, data),
  delete: (id: string) => api.delete(`/live-services/${id}`),
};

export const artistLiveApi = {
  start: (data?: { title?: string; description?: string; category?: string }) =>
    api.post('/artist-live/start', data ?? {}),
  stop: () => api.post('/artist-live/stop'),
  getStatus: (artistId: string) => api.get(`/artist-live/${artistId}/status`),
  getWatch: (artistId: string) => api.get(`/artist-live/${artistId}/watch`),
  join: (sessionId: string, data?: { source?: string }) =>
    api.post(`/artist-live/${sessionId}/join`, data ?? {}),
  createDonationIntent: (sessionId: string, data: { amountCents: number; message?: string }) =>
    api.post(`/artist-live/${sessionId}/donations/intent`, data),
  reportStream: (sessionId: string, reason: string) =>
    api.post(`/artist-live/${sessionId}/report`, { reason }),
};
export const artistFollowsApi = {
  follow: (artistId: string) => api.post(`/artists/${artistId}/follow`),
  unfollow: (artistId: string) => api.delete(`/artists/${artistId}/follow`),
  isFollowing: (artistId: string) => api.get(`/artists/${artistId}/follow`),
};

export const discoveryApi = {
  listPeople: (params?: {
    serviceType?: string;
    location?: string;
    search?: string;
    role?: 'artist' | 'service_provider' | 'all';
    limit?: number;
    offset?: number;
    minRateCents?: number;
    maxRateCents?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) => api.get('/discovery/people', { params }),
};

export const creatorNetworkApi = {
  getAccess: () => api.get<{ hasAccess: boolean }>('/creator-network/access'),
};

export const messagesApi = {
  listConversations: () => api.get('/messages/conversations'),
  getThread: (otherUserId: string, params?: { limit?: number; before?: string }) =>
    api.get(`/messages/conversations/${otherUserId}`, { params }),
  sendMessage: (otherUserId: string, body: string, requestId?: string | null) =>
    api.post(`/messages/conversations/${otherUserId}`, { body, requestId }),
};

export const serviceProvidersApi = {
  getByUserId: (userId: string) => api.get(`/service-providers/${userId}`),
  getMeProfile: () => api.get('/service-providers/me/profile'),
  updateMeProfile: (data: {
    bio?: string;
    locationRegion?: string;
    lat?: number;
    lng?: number;
    serviceTypes?: string[];
    heroImageUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    mentorOptIn?: boolean;
  }) => api.put('/service-providers/me/profile', data),
  createListing: (data: {
    serviceType: string;
    title: string;
    description?: string;
    rateCents?: number;
    rateType?: 'hourly' | 'fixed';
    status?: 'active' | 'paused';
  }) => api.post('/service-providers/me/listings', data),
  updateListing: (listingId: string, data: {
    serviceType?: string;
    title?: string;
    description?: string;
    rateCents?: number | null;
    rateType?: 'hourly' | 'fixed';
    status?: 'active' | 'paused';
  }) => api.patch(`/service-providers/me/listings/${listingId}`, data),
  deleteListing: (listingId: string) => api.delete(`/service-providers/me/listings/${listingId}`),
  addPortfolioItem: (data: { type: 'image' | 'audio' | 'video'; fileUrl: string; title?: string; description?: string; sortOrder?: number }) =>
    api.post('/service-providers/me/portfolio', data),
  deletePortfolioItem: (portfolioItemId: string) =>
    api.delete(`/service-providers/me/portfolio/${portfolioItemId}`),
  getPortfolioUploadUrl: (data: { filename: string; contentType: string }) =>
    api.post<{ signedUrl: string; path: string; expiresIn: number; publicUrl: string }>(
      '/service-providers/portfolio/upload-url',
      data,
    ),
};

export const jobBoardApi = {
  listRequests: (params?: { serviceType?: string; status?: 'open' | 'closed' | 'all'; mine?: boolean; limit?: number; offset?: number }) =>
    api.get('/job-board/requests', { params }),
  getRequest: (requestId: string) => api.get(`/job-board/requests/${requestId}`),
  apply: (requestId: string, message?: string | null) =>
    api.post(`/job-board/requests/${requestId}/applications`, { message }),
  listApplications: (requestId: string) => api.get(`/job-board/requests/${requestId}/applications`),
};

export const browseApi = {
  getFeed: (params?: { limit?: number; cursor?: string; seed?: string }) =>
    api.get('/browse/feed', { params }),
  toggleLike: (contentId: string) => api.post(`/browse/feed/${contentId}/like`),
  addBookmark: (contentId: string) => api.post(`/browse/feed/${contentId}/bookmark`),
  removeBookmark: (contentId: string) => api.delete(`/browse/feed/${contentId}/bookmark`),
  report: (contentId: string, reason: string) =>
    api.post(`/browse/feed/${contentId}/report`, { reason }),
  getBookmarks: (params?: { limit?: number }) => api.get('/browse/bookmarks', { params }),
  getLeaderboard: (params?: { limitPerCategory?: number }) =>
    api.get('/browse/leaderboard', { params }),
};

export const competitionApi = {
  getCurrentWeek: () => api.get('/competition/current-week'),
  vote: (songIds: string[]) => api.post('/competition/vote', { songIds }),
  getWeeklyResults: (period?: string) => api.get('/competition/weekly-results', { params: { period } }),
  getMonthlyWinners: (year?: number, month?: number) => 
    api.get('/competition/monthly-winners', { params: { year, month } }),
  getYearlyWinners: (year?: number) => api.get('/competition/yearly-winners', { params: { year } }),
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
  createCreatorNetworkCheckoutSession: (data?: { successUrl?: string; cancelUrl?: string }) =>
    api.post<{ url: string; sessionId: string }>('/payments/create-creator-network-checkout-session', data ?? {}),
  getTransactions: () => api.get('/payments/transactions'),
  getSongPlayPrice: (songId: string) =>
    api.get<{
      songId: string;
      title: string;
      durationSeconds: number;
      pricePerPlayCents: number;
      pricePerPlayDollars: string;
      options: { plays: number; totalCents: number; totalDollars: string }[];
    }>('/payments/song-play-price', { params: { songId } }),
  createCheckoutSessionSongPlays: (data: { songId: string; plays: number }) =>
    api.post<{ sessionId: string; url: string; transactionId: string }>('/payments/checkout-session-song-plays', data),
  quickAddMinutes: (data: { songId: string }) =>
    api.post<{ sessionId: string; url: string; transactionId: string }>('/payments/quick-add-minutes', data),
};

export const adminApi = {
  getAnalytics: () => api.get('/admin/analytics'),
  getSongs: (params?: { 
    status?: string; 
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number; 
    offset?: number;
  }) => api.get('/admin/songs', { params }),
  updateSongStatus: (id: string, status: 'approved' | 'rejected' | 'pending', reason?: string) =>
    api.patch(`/admin/songs/${id}`, { status, reason }),
  deleteSong: (id: string) => api.delete(`/admin/songs/${id}`),
  getUserProfile: (id: string) => api.get(`/admin/users/${id}`),
  getUsers: (params?: { 
    role?: string; 
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number; 
    offset?: number;
  }) => api.get('/admin/users', { params }),
  updateUserRole: (id: string, role: 'listener' | 'artist' | 'admin') =>
    api.patch(`/admin/users/${id}/role`, { role }),
  lifetimeBanUser: (id: string, reason?: string) =>
    api.post(`/admin/users/${id}/lifetime-ban`, { reason }),
  deleteUserAccount: (id: string) => api.delete(`/admin/users/${id}`),
  // Fallback playlist management
  getFallbackSongs: () => api.get('/admin/fallback-songs'),
  addFallbackSong: (data: { title: string; artistName: string; audioUrl: string; artworkUrl?: string; durationSeconds?: number }) =>
    api.post('/admin/fallback-songs', data),
  addFallbackSongFromUpload: (data: { title: string; artistName: string; audioPath: string; artworkPath?: string; durationSeconds?: number }) =>
    api.post('/admin/fallback-songs/from-upload', data),
  addFallbackSongFromSong: (songId: string) =>
    api.post(`/admin/fallback-songs/from-song/${songId}`),
  updateFallbackSong: (id: string, data: { isActive?: boolean }) =>
    api.patch(`/admin/fallback-songs/${id}`, data),
  deleteFallbackSong: (id: string) => api.delete(`/admin/fallback-songs/${id}`),
  // Free rotation management (Item 5)
  searchSongsForFreeRotation: (query: string) => 
    api.get('/admin/free-rotation/search/songs', { params: { q: query } }),
  searchUsersForFreeRotation: (query: string) => 
    api.get('/admin/free-rotation/search/users', { params: { q: query } }),
  getUserSongsForFreeRotation: (userId: string) => 
    api.get(`/admin/free-rotation/users/${userId}/songs`),
  toggleFreeRotation: (songId: string, enabled: boolean) => 
    api.patch(`/admin/free-rotation/songs/${songId}`, { enabled }),
  getSongsInFreeRotation: () => api.get('/admin/free-rotation/songs'),
  // Live broadcast
  startLive: () => api.post('/admin/live/start'),
  stopLive: () => api.post('/admin/live/stop'),
  getLiveStatus: () => api.get('/admin/live/status'),
  getFeedMedia: (reportedOnly?: boolean) =>
    api.get('/admin/feed-media', { params: reportedOnly ? { reportedOnly: 'true' } : undefined }),
  removeFromFeed: (contentId: string) => api.patch(`/admin/feed-media/${contentId}/remove`),
};

export const notificationsApi = {
  getAll: (params?: { limit?: number }) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/mark-all-read'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
};

export const analyticsApi = {
  // Artist analytics (authenticated)
  getMyAnalytics: (days?: number) => api.get('/analytics/me', { params: { days } }),
  getMyRoi: (days?: number) => api.get('/analytics/me/roi', { params: { days } }),
  getMyPlaysByRegion: (days?: number) => api.get('/analytics/me/plays-by-region', { params: { days } }),
  getSongAnalytics: (songId: string, days?: number) =>
    api.get(`/analytics/songs/${songId}`, { params: { days } }),
  getPlayById: (playId: string) => api.get(`/analytics/plays/${playId}`),
  recordProfileClick: (songId: string) =>
    api.post('/analytics/profile-click', { songId }),
  // Platform stats (public)
  getPlatformStats: () => api.get('/analytics/platform'),
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
