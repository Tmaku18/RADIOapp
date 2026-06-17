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

let loginRedirectInProgress = false;
// Keep sessions stable: avoid automatic sign-out redirects on transient auth/API issues.
// Users can still navigate to /login manually when needed.
const ENABLE_AUTO_LOGIN_REDIRECT = false;

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getClientBackendApiBases(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_API_URL,
    // Production fallback: Railway backend public domain.
    // Keeps direct media uploads working even if NEXT_PUBLIC_API_URL is unset.
    'https://networxradio.com',
  ].filter(
    (value): value is string => !!value && value.trim().length > 0,
  );

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (
      host.endsWith('pro-networx.com') ||
      host.endsWith('networxradio.com')
    ) {
      candidates.push('https://networxradio.com');
    }
  }

  const unique: string[] = [];
  for (const candidate of candidates) {
    const base = normalizeBaseUrl(candidate);
    const apiBase = base.endsWith('/api') ? base : `${base}/api`;
    if (!unique.includes(apiBase)) unique.push(apiBase);
  }
  return unique;
}

/**
 * Upload a multipart form directly to the backend, bypassing the same-origin
 * `/api` proxy. The web host's proxy enforces a small request-body limit that
 * can reject larger files (e.g. phone photos) with a 413 before any backend
 * code runs, so file uploads must talk to the backend host directly. Falls
 * back to the proxied axios path if every direct host fails to respond.
 */
async function directBackendUpload<T>(
  path: string,
  form: FormData,
): Promise<{ data: T }> {
  const token = await getIdToken(false);
  const authHeader: HeadersInit | undefined =
    token && token.trim().length > 0
      ? { Authorization: `Bearer ${token}` }
      : undefined;

  const postTo = async (url: string): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeader,
      body: form,
    });
    const text = await response.text();
    const parsed = text.trim()
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return { message: text };
          }
        })()
      : {};
    if (response.ok) {
      return { data: parsed as T };
    }
    throw { response: { status: response.status, data: parsed } };
  };

  // Prefer the same-origin proxy first: it needs no CORS preflight and works on
  // every first-party domain. Only the proxy's body-size limit (413) requires
  // talking to the backend host directly, so we reserve the cross-origin direct
  // hosts for that fallback.
  try {
    return await postTo(`/api${path}`);
  } catch (err) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    // 413 = payload too large for the proxy. Anything else that came back from
    // the backend is a deliberate rejection we should surface as-is.
    if (status !== undefined && status !== 413) {
      throw err;
    }
  }

  for (const apiBase of getClientBackendApiBases()) {
    try {
      return await postTo(`${apiBase}${path}`);
    } catch (err) {
      // Re-throw deliberate backend rejections; only fall through on
      // network/transport errors so another host can be tried.
      if (err && typeof err === 'object' && 'response' in err) {
        throw err;
      }
    }
  }

  // Last resort: go through the same-origin proxy via axios.
  return api.post<T>(path, form) as Promise<{ data: T }>;
}

// Request interceptor: Always send fresh ID token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip token for public endpoints (exact matches only). Chat reads are
    // public so the panel still loads when the Firebase token is briefly
    // unavailable instead of failing with "Can't reach chat server".
    const publicEndpoints = [
      '/radio/current',
      '/venue-ads/current',
      '/chat/history',
      '/chat/status',
    ];
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url === endpoint && config.method?.toLowerCase() === 'get'
    );
    
    if (!isPublicEndpoint) {
      try {
        // Do not force refresh on every request; queue/admin pages can burst many calls.
        // Firebase SDK auto-refreshes when needed.
        const token = await getIdToken(false);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else if (typeof window !== 'undefined') {
          throw new Error('Authentication required');
        }
      } catch (error) {
        console.error('Failed to get ID token:', error);
        if (
          ENABLE_AUTO_LOGIN_REDIRECT &&
          typeof window !== 'undefined' &&
          !loginRedirectInProgress &&
          !window.location.pathname.startsWith('/login')
        ) {
          loginRedirectInProgress = true;
          const path = window.location.pathname || '/';
          const search = window.location.search || '';
          const redirect = encodeURIComponent(`${path}${search}`);
          window.location.href = `/login?session_expired=true&redirect=${redirect}`;
        }
        throw error;
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
    if (ENABLE_AUTO_LOGIN_REDIRECT && error.response?.status === 401) {
      // Token truly invalid - redirect to login, preserving current path so user returns after re-login
      if (typeof window !== 'undefined') {
        // Avoid redirect loops on the radio player; let the page handle the error.
        if (window.location.pathname.startsWith('/listen')) {
          return Promise.reject(error);
        }
        if (!loginRedirectInProgress && !window.location.pathname.startsWith('/login')) {
          loginRedirectInProgress = true;
          const path = window.location.pathname || '/';
          const search = window.location.search || '';
          const redirect = encodeURIComponent(`${path}${search}`);
          window.location.href = `/login?session_expired=true&redirect=${redirect}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

// API methods for different endpoints
const RADIO_API_TIMEOUT_MS = 35000;

export const radioApi = {
  getCurrentTrack: (radioId?: string) =>
    api.get('/radio/current', {
      params: radioId ? { radio: radioId } : undefined,
      timeout: RADIO_API_TIMEOUT_MS,
    }),
  getNextTrack: (radioIdOrParams?: string | { radio?: string; force?: boolean }) => {
    const params =
      typeof radioIdOrParams === 'string'
        ? { radio: radioIdOrParams }
        : radioIdOrParams;
    return api.get('/radio/next', { params, timeout: RADIO_API_TIMEOUT_MS });
  },
  peekNextTrack: (radioId?: string) =>
    api.get('/radio/peek', {
      params: radioId ? { radio: radioId } : undefined,
      timeout: RADIO_API_TIMEOUT_MS,
    }),
  getStream: (radioId?: string) =>
    api.get('/radio/stream', {
      params: radioId ? { radio: radioId } : undefined,
      timeout: RADIO_API_TIMEOUT_MS,
    }),
  sendHeartbeat: (data: { streamToken: string; songId: string; timestamp: string }, radioId?: string) =>
    api.post('/radio/heartbeat', data, { params: radioId ? { radio: radioId } : undefined }),
  sendPresence: (data: { streamToken: string; songId: string; timestamp: string }, radioId?: string) =>
    api.post('/radio/presence', data, { params: radioId ? { radio: radioId } : undefined }),
  reportPlay: (data: { songId: string; skipped?: boolean }, radioId?: string) =>
    api.post('/radio/play', data, { params: radioId ? { radio: radioId } : undefined }),
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

export type RefineryQueueSong = {
  songId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  audioUrl: string;
  durationSeconds: number | null;
  reviewCount: number;
  likeCount: number;
  hasCustomQuestions: boolean;
  submittedAt: string | null;
};

export type RefineryRatingQuestion = { key: string; question: string };
export type RefinerySurveyQuestion = {
  key: string;
  question: string;
  options: string[];
};
export type RefineryCustomQuestion = {
  id: string;
  questionText: string;
  displayOrder: number;
};

export type RefineryReviewFormPayload = {
  song: {
    id: string;
    title: string;
    artistId: string;
    artistName: string;
    artworkUrl: string | null;
    audioUrl: string;
    durationSeconds: number | null;
    likeCount: number;
  };
  ratingQuestions: RefineryRatingQuestion[];
  surveyQuestions: RefinerySurveyQuestion[];
  customQuestions: RefineryCustomQuestion[];
  reviewRewardCents: number;
};

export type RefinerySubmitReviewPayload = {
  overallRating: number;
  beatRating: number;
  lyricsRating: number;
  chorusRating: number;
  openingEndingRating: number;
  surveyResponses: Record<string, string>;
  customResponses?: Record<string, string>;
  comment?: string;
};

export type RefineryRatingStats = {
  count: number;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  min: number | null;
  max: number | null;
};

export type RefineryAnalyticsPayload = {
  song: {
    id: string;
    title: string;
    artistName: string;
    artworkUrl: string | null;
    inRefinery: boolean;
    reviewCount: number;
    minReviews: number;
    submittedAt: string | null;
  };
  summary: {
    totalReviews: number;
    ratingStats: Record<string, RefineryRatingStats>;
    surveyDistributions: Record<string, Record<string, number>>;
    customQuestions: Array<{
      id: string;
      questionText: string;
      displayOrder: number;
      totalResponses: number;
      recentResponses: string[];
    }>;
    outlierCount: number;
    favoritedCount: number;
  };
  reviews: Array<{
    id: string;
    createdAt: string;
    overallRating: number;
    beatRating: number;
    lyricsRating: number;
    chorusRating: number;
    openingEndingRating: number;
    surveyResponses: Record<string, string>;
    customResponses: Record<string, string>;
    comment: string | null;
    isOutlier: boolean;
    favorited: boolean;
    qualityRating: number | null;
  }>;
  pagination: { limit: number; offset: number; total: number };
};

export const refineryApi = {
  // Standard questions (shown publicly so artists can preview what's asked)
  getStandardQuestions: () =>
    api.get<{
      ratingQuestions: RefineryRatingQuestion[];
      surveyQuestions: RefinerySurveyQuestion[];
      submissionPriceCents: number;
      reviewRewardCents: number;
      defaultMinReviews: number;
      maxCustomQuestions: number;
    }>('/refinery/standard-questions'),

  // Reviewer signup / status
  signUpReviewer: () =>
    api.post<{ isReviewer: boolean; signedUpAt: string; totalReviews: number }>(
      '/refinery/reviewer/signup',
    ),
  getReviewerStatus: () =>
    api.get<{
      isReviewer: boolean;
      signedUpAt: string | null;
      totalReviews: number;
    }>('/refinery/reviewer/status'),

  // Reviewer queue + form
  listSongs: (params?: { limit?: number; offset?: number }) =>
    api.get<{
      songs: RefineryQueueSong[];
      limit: number;
      offset: number;
    }>('/refinery/songs', { params: params ?? {} }),
  getReviewForm: (songId: string) =>
    api.get<RefineryReviewFormPayload>(
      `/refinery/songs/${songId}/review-form`,
    ),
  submitReview: (songId: string, payload: RefinerySubmitReviewPayload) =>
    api.post<{
      reviewId: string;
      createdAt: string;
      rewardCents: number;
    }>(`/refinery/songs/${songId}/review`, payload),

  // Artist submission ($4.99 Stripe Checkout)
  submitToRefinery: (songId: string, customQuestions: string[]) =>
    api.post<{ sessionId: string; url: string; transactionId: string }>(
      `/refinery/songs/${songId}/submit`,
      { customQuestions },
    ),
  /** Legacy: remove a song from the refinery without refund (artist withdraws). */
  removeSong: (songId: string) =>
    api.post(`/refinery/songs/${songId}/remove`),

  // Artist analytics
  getAnalytics: (
    songId: string,
    params?: { limit?: number; offset?: number },
  ) =>
    api.get<RefineryAnalyticsPayload>(
      `/refinery/songs/${songId}/analytics`,
      { params: params ?? {} },
    ),
  /** Artist favorites / unfavorites a review (favorites sort to the top). */
  favoriteReview: (songId: string, reviewId: string, favorited: boolean) =>
    api.post<{ id: string; favorited: boolean }>(
      `/refinery/songs/${songId}/reviews/${reviewId}/favorite`,
      { favorited },
    ),
  /** Artist rates the quality of the feedback (1-5, or null to clear). */
  rateReviewQuality: (
    songId: string,
    reviewId: string,
    rating: number | null,
  ) =>
    api.post<{ id: string; qualityRating: number | null }>(
      `/refinery/songs/${songId}/reviews/${reviewId}/quality`,
      { rating },
    ),

  // Legacy comments (kept for backward compatibility)
  getComments: (songId: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ comments: Array<{ id: string; body: string; created_at: string; users?: { display_name: string | null } }> }>(`/refinery/songs/${songId}/comments`, { params: params ?? {} }),
  addComment: (songId: string, body: string) =>
    api.post(`/refinery/songs/${songId}/comments`, { body }),
};

export const venueAdsApi = {
  getCurrent: (stationId?: string) => api.get<{ id: string; imageUrl: string; linkUrl: string | null; stationId: string } | null>('/venue-ads/current', { params: stationId ? { stationId } : {} }),
};

export const songsApi = {
  getAll: (params?: { artistId?: string; status?: string; limit?: number; offset?: number }) => 
    api.get('/songs', { params }),
  getById: (id: string) => api.get(`/songs/${id}`),
  delete: (id: string) => api.delete(`/songs/${id}`),
  getMine: () => api.get('/songs/mine'),
  getStationCounts: () => api.get<{ counts: Record<string, number> }>('/songs/station-counts'),
  getLyrics: (songId: string) =>
    api.get<{
      plainText: string | null;
      timedLines: Array<{ startMs: number; endMs?: number; text: string }> | null;
      provider?: string | null;
      updatedAt?: string;
    }>(`/songs/${songId}/lyrics`),
  getLibrary: () =>
    api.get<
      Array<{
        id: string;
        title: string;
        artistName: string;
        artistId: string;
        artworkUrl: string | null;
        audioUrl: string | null;
        sampleUrl: string | null;
        durationSeconds: number;
        likeCount: number;
        playCount: number;
        priceCents: number;
        forSale: boolean;
        owned: boolean;
        discoverEnabled: boolean;
        discoverClipUrl: string | null;
        discoverClipStartSeconds: number | null;
        discoverClipEndSeconds: number | null;
        fireVotes: number;
        shitVotes: number;
        temperaturePercent: number;
        likedAt: string;
      }>
    >('/songs/library'),
  getUploadUrl: (data: { filename: string; contentType: string; bucket: 'songs' | 'artwork' }) => 
    api.post('/songs/upload-url', data),
  create: (data: {
    title: string;
    artistName: string;
    artistOriginCity: string;
    artistOriginState: string;
    stationId: string;
    audioPath: string;
    artworkPath?: string;
    durationSeconds?: number;
    discoverClipPath?: string;
    discoverBackgroundPath?: string;
    discoverClipStartSeconds?: number;
    discoverClipEndSeconds?: number;
    sampleStartSeconds?: number;
    sampleEndSeconds?: number;
    isExplicit?: boolean;
  }) => 
    api.post<{ id?: string }>('/songs', data),
  like: (id: string) => api.post(`/songs/${id}/like`),
  unlike: (id: string) => api.delete(`/songs/${id}/like`),
  getLikeStatus: (id: string) => api.get(`/songs/${id}/like`),
  getLikes: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<{
      songId: string;
      totalLikes: number;
      likes: Array<{
        userId: string;
        displayName: string | null;
        avatarUrl: string | null;
        likedAt: string;
      }>;
    }>(`/songs/${id}/likes`, { params: params ?? {} }),
  recordProfileListen: (id: string, data?: { startedAt?: string; secondsListened?: number }) =>
    api.post(`/songs/${id}/profile-listen`, data ?? {}),
  update: (
    id: string,
    data: {
      title?: string;
      artworkUrl?: string;
      stationId?: string;
      optInFreePlay?: boolean;
      discoverEnabled?: boolean;
      discoverClipUrl?: string;
      discoverBackgroundUrl?: string;
      discoverClipStartSeconds?: number;
      discoverClipEndSeconds?: number;
      featuredArtistIds?: string[];
      isExplicit?: boolean;
      isPublic?: boolean;
    },
  ) => api.patch(`/songs/${id}`, data),
  updateVisibility: (id: string, isPublic: boolean) =>
    api.patch(`/songs/${id}`, { isPublic }),
  backfillDuration: (id: string) =>
    api.post<{ durationSeconds: number; backfilled: boolean }>(
      `/songs/${id}/backfill-duration`,
    ),
  publishDiscoverFromLibrary: (
    id: string,
    data: {
      clipStartSeconds: number;
      clipEndSeconds: number;
      discoverBackgroundUrl?: string;
    },
  ) => api.post(`/songs/${id}/discover/publish`, data),
  unpublishDiscoverFromLibrary: (id: string) =>
    api.patch(`/songs/${id}`, {
      discoverEnabled: false,
      discoverClipUrl: '',
      discoverBackgroundUrl: '',
    }),
  updateOptIn: (id: string, optInFreePlay: boolean) => 
    api.patch(`/songs/${id}`, { optInFreePlay }),
  searchArtists: (q: string, limit?: number) =>
    api.get<{
      items: Array<{
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        role: string | null;
      }>;
    }>('/songs/artists/search', {
      params: { q, limit },
    }),
  // ── Song sales: samples, purchases, entitled playback/download ──
  getAccess: (id: string) =>
    api.get<{
      songId: string;
      owned: boolean;
      isOwner: boolean;
      priceCents: number;
      forSale: boolean;
      sampleUrl: string | null;
    }>(`/songs/${id}/access`),
  getStreamUrl: (id: string) =>
    api.get<{ url: string; title: string; artistName: string | null }>(
      `/songs/${id}/stream`,
    ),
  getDownloadUrl: (id: string) =>
    api.get<{ url: string; title: string; artistName: string | null }>(
      `/songs/${id}/download`,
    ),
  setSample: (id: string, startSeconds: number, endSeconds?: number) =>
    api.post<{
      id: string;
      sampleUrl: string | null;
      sampleStartSeconds: number;
      sampleEndSeconds: number;
    }>(`/songs/${id}/sample`, { startSeconds, endSeconds }),
  getPurchases: () =>
    api.get<
      Array<{
        id: string;
        title: string;
        artistName: string;
        artistId: string;
        artworkUrl: string | null;
        durationSeconds: number;
        likeCount: number;
        playCount: number;
        purchasedAt: string;
        amountCents: number;
        currency: string;
        owned: boolean;
      }>
    >('/songs/purchases'),
  /** Admin: render 30s samples for approved songs missing one (background job). */
  backfillSamples: (data?: { limit?: number; concurrency?: number }) =>
    api.post<{ queued: number; alreadyRunning: boolean }>(
      '/songs/admin/backfill-samples',
      data ?? {},
    ),
};

export const songSalesApi = {
  /** Begin Stripe Connect Express onboarding (artist payouts). */
  connectOnboard: (data?: { returnUrl?: string; refreshUrl?: string }) =>
    api.post<{ url: string; accountId: string }>(
      '/payments/connect/onboard',
      data ?? {},
    ),
  connectStatus: () =>
    api.get<{
      accountId: string | null;
      onboarded: boolean;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
    }>('/payments/connect/status'),
  connectLoginLink: () =>
    api.post<{ url: string }>('/payments/connect/login-link', {}),
  /** Create a Checkout Session to buy a song. */
  buySong: (
    songId: string,
    data?: { successUrl?: string; cancelUrl?: string },
  ) =>
    api.post<{ url: string | null; sessionId: string }>(
      `/payments/songs/${songId}/checkout`,
      data ?? {},
    ),
};

export interface DiscoverAudioSongCard {
  songId: string;
  artistId: string;
  artistName: string;
  artistDisplayName: string | null;
  artistAvatarUrl: string | null;
  artistHeadline: string | null;
  title: string;
  clipUrl: string;
  backgroundUrl: string | null;
  clipDurationSeconds: number;
  likeCount: number;
  likedByMe: boolean;
}

export interface DiscoverSwipeAnalytics {
  days: number;
  rightSwipes: number;
  leftSwipes: number;
  totalSwipes: number;
  avgDecisionMs: number | null;
  bySong: Array<{
    songId: string;
    title: string;
    rightSwipes: number;
    leftSwipes: number;
    avgDecisionMs: number | null;
  }>;
}

export interface ArtistLikeNotificationSettings {
  muted: boolean;
  minLikesTrigger: number;
  cooldownMinutes: number;
}

export const discoverAudioApi = {
  getFeed: (params?: { limit?: number; cursor?: string; seed?: string }) =>
    api.get<{ items: DiscoverAudioSongCard[]; nextCursor: string | null }>(
      '/songs/discover/feed',
      { params },
    ),
  swipe: (data: {
    songId: string;
    direction: 'left_skip' | 'right_like';
    decisionMs?: number;
  }) => api.post<{ direction: 'left_skip' | 'right_like'; liked: boolean }>(
    '/songs/discover/swipe',
    data,
  ),
  getLikedList: (params?: { limit?: number; offset?: number }) =>
    api.get<{
      items: Array<DiscoverAudioSongCard & { likedAt: string }>;
      total: number;
    }>('/songs/discover/list', { params }),
  removeLikedSong: (songId: string) =>
    api.delete<{ removed: true }>(`/songs/discover/list/${songId}`),
  clearLikedList: () =>
    api.delete<{ removed: number }>('/songs/discover/list'),
  removeSwipe: (songId: string) =>
    api.delete<{ removed: true }>(`/songs/discover/swipes/${songId}`),
  clearSwipes: () =>
    api.delete<{ removed: number }>('/songs/discover/swipes'),
  getMySwipeAnalytics: (days?: number) =>
    api.get<DiscoverSwipeAnalytics>('/analytics/me/discover-swipes', {
      params: { days },
    }),
};

export interface FollowListItem {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  headline: string | null;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  relationship?: 'friend' | 'fan' | 'following' | 'none';
}

export const usersApi = {
  getMe: () => api.get('/users/me'),
  checkAdmin: () => api.get<{ isAdmin: boolean }>('/users/me/check-admin'),
  updateMe: (data: { displayName?: string; username?: string; avatarUrl?: string; region?: string; suggestLocalArtists?: boolean; notifyFollowedArtistOnRadio?: boolean; discoverable?: boolean; favoriteGenres?: string[]; completeGenreOnboarding?: boolean; bio?: string; headline?: string; locationRegion?: string; instagramUrl?: string; twitterUrl?: string; youtubeUrl?: string; tiktokUrl?: string; websiteUrl?: string; soundcloudUrl?: string; spotifyUrl?: string; appleMusicUrl?: string; facebookUrl?: string; snapchatUrl?: string; role?: 'listener' | 'artist' | 'service_provider' }) => 
    api.put('/users/me', data),
  deleteMyAccount: () => api.delete<{ ok: true }>('/users/me'),
  uploadProfilePhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // Direct-to-backend to avoid the proxy's request-body size limit.
    return directBackendUpload('/users/me/avatar', formData);
  },
  checkUsernameAvailable: (username: string) =>
    api.get<{ available: boolean; username: string }>('/users/username-available', { params: { u: username } }),
  getByUsername: (username: string) => api.get(`/users/by-username/${username}`),
  getById: (id: string) => api.get(`/users/${id}`),
  follow: (id: string) => api.post(`/users/${id}/follow`),
  unfollow: (id: string) => api.delete(`/users/${id}/follow`),
  isFollowing: (id: string) => api.get<{ following: boolean }>(`/users/${id}/follow`),
  getFollowCounts: (id: string) => api.get<{ followers: number; following: number }>(`/users/${id}/follow-counts`),
  getFollowers: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ items: FollowListItem[]; total: number }>(
      `/users/${id}/followers`,
      { params: params ?? {} },
    ),
  getFollowing: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ items: FollowListItem[]; total: number }>(
      `/users/${id}/following`,
      { params: params ?? {} },
    ),
  getFriends: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get<{ items: FollowListItem[]; total: number }>(
      `/users/${id}/friends`,
      { params: params ?? {} },
    ),
  getArtistProfile: (id: string) => api.get(`/users/${id}/artist-profile`),
  create: (data: { email: string; displayName: string; role?: 'listener' | 'artist' | 'service_provider' }) => 
    api.post('/users', data),
  upgradeToArtist: () => api.post('/users/upgrade-to-artist'),
  upgradeToCatalyst: () => api.post('/users/upgrade-to-catalyst'),
  getArtistLikeNotificationSettings: () =>
    api.get<ArtistLikeNotificationSettings>('/users/me/artist-like-notifications'),
  updateArtistLikeNotificationSettings: (
    data: Partial<ArtistLikeNotificationSettings>,
  ) =>
    api.put<ArtistLikeNotificationSettings>(
      '/users/me/artist-like-notifications',
      data,
    ),
};

export const suggestionsApi = {
  getLocalArtists: (limit?: number) => api.get('/suggestions/local-artists', { params: { limit } }),
  getGenreArtists: (params: { genres: string[]; limit?: number; seed?: string }) =>
    api.get<{ artists: Array<{
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
      headline: string | null;
      songCount?: number;
      matchedGenres: string[];
    }> }>('/suggestions/genre-artists', {
      params: {
        genres: params.genres.join(','),
        limit: params.limit,
        seed: params.seed,
      },
    }),
};

type LeaderboardVoteResponse = {
  liked: boolean;
  reaction: 'fire' | 'shit' | null;
  previousReaction: 'fire' | 'shit' | null;
};

export const leaderboardApi = {
  getSongs: (
    params: {
      by: 'likes' | 'listens' | 'positive_votes' | 'ratio' | 'saves';
      limit?: number;
      offset?: number;
    },
  ) => 
    api.get('/leaderboard/songs', { params }),
  getUpvotesPerMinute: (params?: { windowMinutes?: number; limit?: number; offset?: number }) =>
    api.get('/leaderboard/upvotes-per-minute', { params }),
  addLeaderboardLike: (songId: string, playId?: string | null) => 
    api.post<LeaderboardVoteResponse>(`/leaderboard/songs/${songId}/like`, { playId, reaction: 'fire' }),
  addLeaderboardReaction: (
    songId: string,
    reaction: 'fire' | 'shit',
    playId?: string | null,
  ) => api.post<LeaderboardVoteResponse>(`/leaderboard/songs/${songId}/like`, { playId, reaction }),
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
  submitSupport: (data: { message: string; discordLink: string }) =>
    api.post('/live-services/support', data),
  getById: (id: string) => api.get(`/live-services/${id}`),
  update: (id: string, data: { title?: string; description?: string; type?: string; scheduledAt?: string; linkOrPlace?: string }) =>
    api.patch(`/live-services/${id}`, data),
  delete: (id: string) => api.delete(`/live-services/${id}`),
};

export const artistLiveApi = {
  start: (data?: {
    title?: string;
    description?: string;
    category?: string;
    hostType?: 'dj' | 'artist' | 'musician';
  }) => api.post('/artist-live/start', data ?? {}),
  stop: () => api.post('/artist-live/stop'),
  listSessions: () => api.get<{ sessions: Array<{ sessionId: string; artistId: string; displayName: string; avatarUrl: string | null; title: string | null; currentViewers: number; peakViewers: number; startedAt: string; status: string; hostRole?: string }> }>('/artist-live/sessions'),
  getStreamerStatus: () =>
    api.get<{ canStream: boolean; appliedAt: string | null; approvedAt: string | null; rejectedAt: string | null; role: string }>('/artist-live/streamer-status'),
  applyToStream: () => api.post<{ applied: boolean; appliedAt: string; message: string }>('/artist-live/apply'),
  getStatus: (artistId: string) => api.get(`/artist-live/${artistId}/status`),
  getWatch: (artistId: string) => api.get(`/artist-live/${artistId}/watch`),
  join: (sessionId: string, data?: { source?: string; viewerToken?: string }) =>
    api.post<{ joined: boolean; viewerId: string; viewers: { current: number; peak: number } }>(`/artist-live/${sessionId}/join`, data ?? {}),
  heartbeat: (sessionId: string, viewerId: string) =>
    api.post<{ viewers: number }>(`/artist-live/${sessionId}/heartbeat`, { viewerId }),
  leave: (sessionId: string, viewerId: string) =>
    api.post<{ left: boolean; viewers: number }>(`/artist-live/${sessionId}/leave`, { viewerId }),
  createDonationIntent: (sessionId: string, data: { amountCents: number; message?: string }) =>
    api.post(`/artist-live/${sessionId}/donations/intent`, data),
  createDonationCheckout: (sessionId: string, data: { amountCents: number; message?: string }) =>
    api.post<{ donationId: string; url: string | null; amountCents: number; currency: string }>(`/artist-live/${sessionId}/donations/checkout`, data),
  reportStream: (sessionId: string, reason: string) =>
    api.post(`/artist-live/${sessionId}/report`, { reason }),
  listChat: (sessionId: string, params?: { after?: string; limit?: number }) =>
    api.get<{ messages: StreamChatMessage[] }>(
      `/artist-live/${sessionId}/chat`,
      { params },
    ),
  postChat: (sessionId: string, message: string) =>
    api.post<StreamChatMessage>(`/artist-live/${sessionId}/chat`, { message }),
  deleteChat: (sessionId: string, messageId: string) =>
    api.post<{ deleted: boolean }>(
      `/artist-live/${sessionId}/chat/${messageId}/delete`,
    ),
  adminForceStop: (sessionId: string) =>
    api.post<{ stopped: boolean }>(
      `/artist-live/admin/sessions/${sessionId}/force-stop`,
    ),
};

export type StreamChatMessage = {
  id: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  message: string;
  isHost: boolean;
  createdAt: string;
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
    mode?: 'default' | 'random';
    seed?: string;
  }) => api.get('/discovery/people', { params }),
  listFeed: (params?: {
    limit?: number;
    cursor?: string;
    scope?: 'all' | 'following';
  }) =>
    api.get<{ items: DiscoverFeedPost[]; nextCursor: string | null }>(
      '/discovery/feed',
      { params },
    ),
  likePost: (postId: string) =>
    api.post<{ ok: true }>(`/discovery/feed/posts/${postId}/like`),
  unlikePost: (postId: string) =>
    api.delete<{ ok: true }>(`/discovery/feed/posts/${postId}/like`),
  bookmarkPost: (postId: string) =>
    api.post<{ ok: true }>(`/discovery/feed/posts/${postId}/bookmark`),
  unbookmarkPost: (postId: string) =>
    api.delete<{ ok: true }>(`/discovery/feed/posts/${postId}/bookmark`),
  listBookmarks: (params?: { limit?: number; cursor?: string }) =>
    api.get<{ items: DiscoverFeedPost[]; nextCursor: string | null }>(
      '/discovery/feed/bookmarks',
      { params },
    ),
  listLiked: (params?: { limit?: number; cursor?: string }) =>
    api.get<{ items: DiscoverFeedPost[]; nextCursor: string | null }>(
      '/discovery/feed/liked',
      { params },
    ),
  listComments: (postId: string, params?: { limit?: number; before?: string }) =>
    api.get<{ items: DiscoverFeedComment[] }>(
      `/discovery/feed/posts/${postId}/comments`,
      { params },
    ),
  createComment: (postId: string, body: string) =>
    api.post<DiscoverFeedComment>(
      `/discovery/feed/posts/${postId}/comments`,
      { body },
    ),
  deleteComment: (commentId: string) =>
    api.delete<{ ok: true }>(`/discovery/feed/comments/${commentId}`),
  searchFeed: (q: string) =>
    api.get<DiscoverFeedSearchResult>('/discovery/feed/search', {
      params: { q },
    }),
  exploreTiles: (params?: { limit?: number; seed?: string }) =>
    api.get<{ items: DiscoverFeedPost[] }>('/discovery/feed/explore', {
      params,
    }),
  exploreStream: (params?: {
    cursor?: string | null;
    anchorPostId?: string | null;
    limit?: number;
  }) =>
    api.get<{ items: DiscoverFeedPost[]; nextCursor: string | null }>(
      '/discovery/feed/explore-stream',
      { params },
    ),
  listUserPosts: (
    userId: string,
    params?: { limit?: number; cursor?: string },
  ) =>
    api.get<{ items: DiscoverFeedPost[]; nextCursor: string | null }>(
      `/discovery/feed/users/${userId}/posts`,
      { params },
    ),
  createFeedPost: (file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption != null && caption.trim()) form.set('caption', caption.trim());
    // Upload feed media directly to backend when possible.
    // This bypasses web-host request-size limits that can trigger 413 before proxy code runs.
    return (async () => {
      const token = await getIdToken(false);
      const authHeader: HeadersInit | undefined =
        token && token.trim().length > 0
          ? { Authorization: `Bearer ${token}` }
          : undefined;

      for (const apiBase of getClientBackendApiBases()) {
        try {
          const response = await fetch(`${apiBase}/discovery/feed`, {
            method: 'POST',
            headers: authHeader,
            body: form,
          });

          const text = await response.text();
          const parsed = text.trim()
            ? (() => {
                try {
                  return JSON.parse(text);
                } catch {
                  return { message: text };
                }
              })()
            : {};

          if (response.ok) {
            return { data: parsed as DiscoverFeedPost };
          }
        } catch {
          // Try next configured backend URL.
        }
      }

      return api.post<DiscoverFeedPost>('/discovery/feed', form);
    })();
  },
  getMapHeat: (params?: {
    station?: string;
    role?: 'artist' | 'service_provider' | 'all';
    zoom?: number;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }) => api.get<{ buckets: DiscoveryMapHeatBucket[]; maxIntensity: number }>('/discovery/map/heat', { params }),
  getMapClusters: (params?: {
    station?: string;
    role?: 'artist' | 'service_provider' | 'all';
    zoom?: number;
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }) => api.get<{ clusters: DiscoveryMapCluster[] }>('/discovery/map/clusters', { params }),
  getMapArtists: (params?: {
    station?: string;
    role?: 'artist' | 'service_provider' | 'all';
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    clusterLat?: number;
    clusterLng?: number;
    clusterRadiusKm?: number;
    limit?: number;
    offset?: number;
  }) => api.get<{ items: DiscoveryMapArtistMarker[]; total: number }>('/discovery/map/artists', { params }),
};

export interface DiscoverFeedPost {
  id: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorHeadline: string | null;
  imageUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
}

export interface DiscoverFeedComment {
  id: string;
  postId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface DiscoverFeedSearchResult {
  people: Array<{
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    headline: string | null;
    role: string | null;
  }>;
  posts: DiscoverFeedPost[];
}

export interface DiscoveryMapHeatBucket {
  lat: number;
  lng: number;
  intensity: number;
  totalLikes: number;
  artistCount: number;
}

export interface DiscoveryMapCluster {
  id: string;
  lat: number;
  lng: number;
  artistCount: number;
  totalLikes: number;
  radiusKm: number;
}

export interface DiscoveryMapArtistMarker {
  artistId: string;
  displayName: string | null;
  avatarUrl: string | null;
  locationRegion: string | null;
  lat: number;
  lng: number;
  likeCount: number;
}

export const creatorNetworkApi = {
  getAccess: () => api.get<{ hasAccess: boolean }>('/creator-network/access'),
};

export const messagesApi = {
  listConversations: (params?: { search?: string }) =>
    api.get('/messages/conversations', { params: params ?? {} }),
  getThread: (otherUserId: string, params?: { limit?: number; before?: string }) =>
    api.get(`/messages/conversations/${otherUserId}`, { params }),
  sendMessage: (
    otherUserId: string,
    data: {
      body?: string;
      requestId?: string | null;
      messageType?: 'text' | 'image' | 'video' | 'voice' | 'post_share';
      mediaUrl?: string | null;
      mediaMime?: string | null;
      mediaDurationMs?: number | null;
      replyToMessageId?: string | null;
      sharedPostId?: string | null;
    },
  ) => api.post(`/messages/conversations/${otherUserId}`, data),
  editMessage: (messageId: string, body: string) =>
    api.patch(`/messages/messages/${messageId}`, { body }),
  unsendMessage: (messageId: string) =>
    api.post(`/messages/messages/${messageId}/unsend`),
  addReaction: (messageId: string, emoji: string) =>
    api.post(`/messages/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId: string, emoji: string) =>
    api.delete(`/messages/messages/${messageId}/reactions`, { params: { emoji } }),
  markThreadRead: (otherUserId: string, lastReadMessageId?: string | null) =>
    api.post(`/messages/conversations/${otherUserId}/read`, { lastReadMessageId: lastReadMessageId ?? null }),
  getUnreadSummary: () => api.get('/messages/unread-summary'),
  sendTyping: (otherUserId: string) => api.post(`/messages/conversations/${otherUserId}/typing`),
  getUploadUrl: (data: { filename: string; contentType: string }) =>
    api.post<{ signedUrl: string; path: string; expiresIn: number }>('/messages/upload-url', data),
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
  uploadCover: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return directBackendUpload<{ heroImageUrl?: string }>(
      '/service-providers/me/cover',
      formData,
    );
  },
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
  createRequest: (data: { title: string; description?: string | null; serviceType?: string | null }) =>
    api.post('/job-board/requests', data),
  getRequest: (requestId: string) => api.get(`/job-board/requests/${requestId}`),
  deleteRequest: (requestId: string) =>
    api.delete(`/job-board/requests/${requestId}`),
  apply: (requestId: string, message?: string | null) =>
    api.post(`/job-board/requests/${requestId}/applications`, { message }),
  listApplications: (requestId: string) => api.get(`/job-board/requests/${requestId}/applications`),
};

export type ExperienceItem = {
  title: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
};

export type EducationItem = {
  school: string;
  degree?: string;
  field?: string;
  startYear?: string;
  endYear?: string;
  description?: string;
};

export type FeaturedItem = {
  type: 'link' | 'portfolio';
  url?: string;
  title?: string;
  description?: string;
  portfolioItemId?: string;
};

export type ProNetworxMeProfile = {
  userId: string;
  avatarUrl: string | null;
  heroImageUrl: string | null;
  availableForWork: boolean;
  skillsHeadline: string | null;
  currentTitle: string | null;
  about: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  soundcloudUrl: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  facebookUrl: string | null;
  snapchatUrl: string | null;
  experience: ExperienceItem[];
  education: EducationItem[];
  featured: FeaturedItem[];
  skills: Array<{ name: string; category: string }>;
};

export interface ProServiceListing {
  id: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  ownerHeadline: string | null;
  serviceType: string;
  title: string;
  description: string | null;
  priceCents: number | null;
  rateType: 'hourly' | 'fixed';
  currency: string;
  status: 'active' | 'paused';
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  contact: {
    email: string | null;
    phone: string | null;
    link: string | null;
  } | null;
}

export const proNetworxApi = {
  getMeProfile: () => api.get<ProNetworxMeProfile>('/pro-networx/me/profile'),
  updateMeProfile: (data: {
    availableForWork?: boolean;
    skillsHeadline?: string;
    currentTitle?: string;
    about?: string;
    websiteUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
    tiktokUrl?: string;
    soundcloudUrl?: string;
    spotifyUrl?: string;
    appleMusicUrl?: string;
    facebookUrl?: string;
    snapchatUrl?: string;
    experience?: ExperienceItem[];
    education?: EducationItem[];
    featured?: FeaturedItem[];
    skillNames?: string[];
  }) => api.put('/pro-networx/me/profile', data),
  listDirectory: (params?: { skill?: string; availableForWork?: boolean; search?: string; location?: string; sort?: 'asc' | 'desc'; mode?: 'default' | 'random' | 'smart'; seed?: string }) =>
    api.get('/pro-networx/directory', { params: params ?? {} }),
  getProfileByUserId: (userId: string) => api.get(`/pro-networx/profiles/${userId}`),

  // Resume PDF
  getMyResume: () =>
    api.get<{ url: string | null; filename: string | null }>(
      '/pro-networx/me/resume',
    ),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return directBackendUpload<{ url: string; filename: string }>(
      '/pro-networx/me/resume',
      form,
    );
  },
  deleteResume: () =>
    api.delete<{ ok: true }>('/pro-networx/me/resume'),

  // Services marketplace
  listServices: (params?: {
    serviceType?: string;
    search?: string;
    minPriceCents?: number;
    maxPriceCents?: number;
    limit?: number;
    offset?: number;
  }) =>
    api.get<{ items: ProServiceListing[]; total: number }>(
      '/pro-networx/services',
      { params },
    ),
  getService: (id: string) =>
    api.get<ProServiceListing>(`/pro-networx/services/${id}`),
  listServicesForUser: (userId: string) =>
    api.get<{ items: ProServiceListing[] }>(
      `/pro-networx/users/${userId}/services`,
    ),
  listMyServices: () =>
    api.get<{ items: ProServiceListing[] }>('/pro-networx/me/services'),
  createService: (data: {
    serviceType: string;
    title: string;
    description?: string;
    priceCents?: number;
    rateType?: 'hourly' | 'fixed';
    currency?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactLink?: string;
    isPublished?: boolean;
  }) => api.post<ProServiceListing>('/pro-networx/me/services', data),
  updateService: (
    id: string,
    data: Partial<{
      serviceType: string;
      title: string;
      description: string;
      priceCents: number;
      rateType: 'hourly' | 'fixed';
      currency: string;
      contactEmail: string;
      contactPhone: string;
      contactLink: string;
      isPublished: boolean;
    }>,
  ) => api.patch<ProServiceListing>(`/pro-networx/me/services/${id}`, data),
  deleteService: (id: string) =>
    api.delete<{ ok: true }>(`/pro-networx/me/services/${id}`),
};

export interface ProNetworkAccess {
  hasAccess: boolean;
  status:
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'paused'
    | null;
  currentPeriodEnd: string | null;
  pricing: { regularCents: number; introCents: number };
}

export const proNetworkSubscriptionApi = {
  getAccess: () =>
    api.get<ProNetworkAccess>('/pro-network-subscription/access'),
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
  createProNetworxCheckoutSession: (data?: { successUrl?: string; cancelUrl?: string }) =>
    api.post<{ url: string; sessionId: string; introCouponApplied: boolean }>(
      '/payments/create-pro-networx-checkout-session',
      data ?? {},
    ),
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
  getPendingPayouts: () =>
    api.get<{
      totalOwedCents: number;
      totalGrossCents: number;
      artistCount: number;
      purchaseCount: number;
      artists: Array<{
        artistId: string;
        artistName: string;
        artistEmail: string | null;
        currency: string;
        owedCents: number;
        grossCents: number;
        purchaseCount: number;
        purchases: Array<{
          id: string;
          songId: string | null;
          songTitle: string;
          amountCents: number;
          artistAmountCents: number;
          createdAt: string;
        }>;
      }>;
    }>('/admin/payouts/pending'),
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
  updateSongMetadata: (
    id: string,
    data: {
      title?: string;
      stationId?: string;
      stationIds?: string[];
      artworkUrl?: string | null;
      isExplicit?: boolean;
    },
  ) => api.patch(`/admin/songs/${id}/metadata`, data),
  deleteSong: (id: string) => api.delete(`/admin/songs/${id}`),
  trimSong: (id: string, data: { startSeconds: number; endSeconds: number }) =>
    api.post(`/admin/songs/${id}/trim`, data),
  getUserProfile: (id: string) => api.get(`/admin/users/${id}`),
  getUsers: (params?: { 
    role?: string; 
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number; 
    offset?: number;
  }) => api.get('/admin/users', { params }),
  getSwipeCards: (params?: { search?: string; limit?: number; offset?: number }) =>
    api.get<{
      items: Array<{
        songId: string;
        title: string;
        artistId: string;
        artistName: string | null;
        artistDisplayName: string | null;
        status: string | null;
        discoverEnabled: boolean;
        clipUrl: string | null;
        backgroundUrl: string | null;
        clipStartSeconds: number | null;
        clipEndSeconds: number | null;
        clipDurationSeconds: number | null;
        createdAt: string | null;
        updatedAt: string | null;
      }>;
      total: number;
    }>('/admin/swipe', { params }),
  deleteSwipeClip: (songId: string) => api.delete(`/admin/swipe/${songId}/clip`),
  updateUserRole: (
    id: string,
    role:
      | 'listener'
      | 'artist'
      | 'admin'
      | 'service_provider'
      | 'dj'
      | 'musician',
  ) => api.patch(`/admin/users/${id}/role`, { role }),
  lifetimeBanUser: (id: string, reason?: string) =>
    api.post(`/admin/users/${id}/lifetime-ban`, { reason }),
  deleteUserAccount: (id: string) => api.delete(`/admin/users/${id}`),
  // Radios (stations) – state-scoped for fallback multi-select
  getRadios: (state?: string) =>
    api.get<{ radios: Array<{ id: string; state: string; label: string }> }>('/admin/radios', { params: state ? { state } : undefined }),
  getRadioQueueDebug: (radioId: string, limit?: number) =>
    api.get<{
      radioId: string;
      playlistType: 'free_rotation' | 'paid';
      fallbackPosition: number;
      currentSong: { id: string | null; title: string | null; artistName: string | null; source: 'songs' | 'unknown' } | null;
      queueLength: number;
      nextCount: number;
      nextSongs: Array<{ stackId: string; normalizedSongId: string; title: string | null; artistName: string | null; source: 'songs' | null }>;
    }>(`/admin/radios/${radioId}/queue-debug`, { params: limit ? { limit } : undefined }),
  getRadioQueue: (radioId: string, limit?: number) =>
    api.get<{
      radioId: string;
      playlistType: 'free_rotation' | 'paid';
      fallbackPosition: number;
      currentSong: {
        id: string | null;
        title: string | null;
        artistName: string | null;
        source: 'songs' | 'unknown';
      } | null;
      queueLength: number;
      nextCount: number;
      nextSongs: Array<{
        stackId: string;
        normalizedSongId: string;
        title: string | null;
        artistName: string | null;
        source: 'songs' | null;
      }>;
      upcoming: Array<{
        position: number;
        stackId: string;
        normalizedSongId: string;
        source: 'songs' | null;
        title: string | null;
        artistName: string | null;
        artworkUrl: string | null;
        durationSeconds: number;
      }>;
      availableCount: number;
      stale?: boolean;
      stale_cached_at?: string;
    }>(`/admin/radios/${radioId}/queue`, { params: limit ? { limit } : undefined }),
  addRadioQueueEntries: (
    radioId: string,
    data: {
      items: Array<{ stackId?: string; songId?: string; source?: 'songs' }>;
      position?: number;
      allowDuplicates?: boolean;
    },
  ) => api.post(`/admin/radios/${radioId}/queue`, data),
  replaceRadioQueue: (radioId: string, stackIds: string[]) =>
    api.patch(`/admin/radios/${radioId}/queue`, { stackIds }),
  skipRadioQueueTrack: (radioId: string) =>
    api.post(`/admin/radios/${radioId}/queue/skip`),
  removeRadioQueueEntry: (
    radioId: string,
    params: { position?: number; stackId?: string; songId?: string; source?: 'songs' },
  ) => api.delete(`/admin/radios/${radioId}/queue`, { params }),
  // Fallback playlist management
  getFallbackSongs: (radio?: string) =>
    api.get('/admin/fallback-songs', { params: radio ? { radio } : undefined }),
  getFallbackSongsGrouped: () =>
    api.get<{ songs: Array<{ id: string; title: string; artist_name: string; audio_url: string; artwork_url: string | null; duration_seconds: number; is_active: boolean; created_at: string; radio_ids: string[] }> }>('/admin/fallback-songs/grouped'),
  setFallbackSongRadios: (id: string, radioIds: string[]) =>
    api.patch(`/admin/fallback-songs/${id}/radios`, { radioIds }),
  updateFallbackSongGroup: (id: string, data: { isActive?: boolean }) =>
    api.patch(`/admin/fallback-songs/${id}/group`, data),
  deleteFallbackSongGroup: (id: string) =>
    api.delete(`/admin/fallback-songs/${id}/group`),
  addFallbackSong: (data: { title: string; artistName: string; audioUrl: string; artworkUrl?: string; durationSeconds?: number }) =>
    api.post('/admin/fallback-songs', data),
  addFallbackSongFromUpload: (data: { title: string; artistName: string; audioPath: string; artworkPath?: string; durationSeconds?: number }) =>
    api.post('/admin/fallback-songs/from-upload', data),
  addFallbackSongFromSong: (songId: string, radio?: string) =>
    api.post(`/admin/fallback-songs/from-song/${songId}`, {}, { params: radio ? { radio } : undefined }),
  updateFallbackSong: (id: string, data: { isActive?: boolean }, radio?: string) =>
    api.patch(`/admin/fallback-songs/${id}`, data, { params: radio ? { radio } : undefined }),
  deleteFallbackSong: (id: string, radio?: string) =>
    api.delete(`/admin/fallback-songs/${id}`, { params: radio ? { radio } : undefined }),
  // Free rotation management (Item 5)
  searchSongsForFreeRotation: (query: string) => 
    api.get('/admin/free-rotation/search/songs', { params: { q: query } }),
  searchUsersForFreeRotation: (query: string) => 
    api.get('/admin/free-rotation/search/users', { params: { q: query } }),
  getUserSongsForFreeRotation: (userId: string) => 
    api.get(`/admin/free-rotation/users/${userId}/songs`),
  toggleFreeRotation: (songId: string, enabled: boolean) => 
    api.patch(`/admin/free-rotation/songs/${songId}`, { enabled }),
  getSongsInFreeRotation: (radio?: string) =>
    api.get('/admin/free-rotation/songs', { params: radio ? { radio } : undefined }),
  // Live broadcast
  startLive: () => api.post('/admin/live/start'),
  stopLive: () => api.post('/admin/live/stop'),
  getLiveStatus: () => api.get('/admin/live/status'),
  getFeedMedia: (reportedOnly?: boolean) =>
    api.get('/admin/feed-media', { params: reportedOnly ? { reportedOnly: 'true' } : undefined }),
  removeFromFeed: (contentId: string) => api.patch(`/admin/feed-media/${contentId}/remove`),
  deleteFeedMedia: (contentId: string) => api.delete(`/admin/feed-media/${contentId}`),
  getStreamerApplications: () =>
    api.get<{ applications: Array<{ userId: string; displayName: string | null; email: string | null; role: string | null; appliedAt: string }> }>('/admin/streamer-applications'),
  setStreamerApproval: (userId: string, action: 'approve' | 'reject') =>
    api.patch(`/admin/streamer-applications/${userId}`, { action }),
};

export const djBoothApi = {
  getStatus: (stationId: string) => api.get(`/admin/dj-booth/${stationId}`),
  getQueue: (stationId: string, limit = 25) =>
    api.get(`/admin/dj-booth/${stationId}/queue`, { params: { limit } }),
  replaceQueue: (stationId: string, stackIds: string[]) =>
    api.patch(`/admin/dj-booth/${stationId}/queue`, { stackIds }),
  addQueueEntries: (
    stationId: string,
    body: {
      items: Array<{ stackId?: string; songId?: string; source?: 'songs' }>;
      position?: number;
      allowDuplicates?: boolean;
    },
  ) => api.post(`/admin/dj-booth/${stationId}/queue`, body),
  removeQueueEntry: (
    stationId: string,
    params: { position?: number; stackId?: string; songId?: string },
  ) => api.delete(`/admin/dj-booth/${stationId}/queue`, { params }),
  skipForward: (stationId: string) =>
    api.post(`/admin/dj-booth/${stationId}/queue/skip`),
  skipBack: (stationId: string) =>
    api.post(`/admin/dj-booth/${stationId}/transport/back`),
  pauseTransport: (stationId: string) =>
    api.post(`/admin/dj-booth/${stationId}/transport/pause`),
  playTransport: (stationId: string) =>
    api.post(`/admin/dj-booth/${stationId}/transport/play`),
  createMicSession: (stationId: string) =>
    api.post(`/admin/dj-booth/${stationId}/mic/session`),
  deleteMicSession: (stationId: string) =>
    api.delete(`/admin/dj-booth/${stationId}/mic/session`),
  micOn: (stationId: string) => api.post(`/admin/dj-booth/${stationId}/mic/on`),
  micOff: (stationId: string) => api.post(`/admin/dj-booth/${stationId}/mic/off`),
  setDuckVolume: (stationId: string, duckVolume: number) =>
    api.patch(`/admin/dj-booth/${stationId}/mic/duck-volume`, { duckVolume }),
  listSoundboardClips: () => api.get('/admin/dj-booth/soundboard/clips'),
  createSoundboardUploadUrl: (fileName: string, contentType: string) =>
    api.post('/admin/dj-booth/soundboard/upload-url', { fileName, contentType }),
  registerSoundboardClip: (body: {
    name: string;
    storagePath: string;
    durationSeconds?: number;
  }) => api.post('/admin/dj-booth/soundboard/clips', body),
  deleteSoundboardClip: (clipId: string) =>
    api.delete(`/admin/dj-booth/soundboard/clips/${clipId}`),
  playSoundboardClip: (stationId: string, clipId: string) =>
    api.post(`/admin/dj-booth/${stationId}/soundboard/${clipId}/play`),
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
  getPlatformLiveStats: () => api.get('/analytics/platform/live'),
};

export const chatApi = {
  sendMessage: (message: string, songId?: string, radioId?: string) =>
    api.post('/chat/send', { message, songId, radioId }, { timeout: 10000 }),
  getHistory: (params?: { limit?: number; radioId?: string }) =>
    api.get('/chat/history', { params, timeout: 10000 }),
  getStatus: () => api.get('/chat/status', { timeout: 10000 }),
};

export const pushNotificationsApi = {
  registerDevice: (fcmToken: string, deviceType: 'ios' | 'android' | 'web') =>
    api.post('/push-notifications/register-device', { fcmToken, deviceType }),
  unregisterDevice: (fcmToken: string) =>
    api.post('/push-notifications/unregister-device', { fcmToken }),
  getDevices: () => api.get('/push-notifications/devices'),
};

export default api;
