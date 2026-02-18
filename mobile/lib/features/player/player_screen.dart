import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/track.dart';
import '../../core/models/track_fetch_result.dart';
import '../../core/services/api_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/chat_service.dart';
import '../../core/services/venue_ads_service.dart';
import '../../core/services/station_events_service.dart';
import '../../core/models/venue_ad.dart';
import '../../core/theme/networx_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import 'widgets/chat_panel.dart';

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  final RadioService _radioService = RadioService();
  final VenueAdsService _venueAds = VenueAdsService();
  final ApiService _api = ApiService();
  Track? _currentTrack;
  bool _isPlaying = false;
  bool _isLoading = true;
  bool _isLiked = false;
  bool _isLikeLoading = false;
  bool _noContent = false;
  String? _noContentMessage;
  VenueAd? _ad;
  app_user.User? _me;
  bool _quickBuying = false;
  String? _risingStarText;
  StreamSubscription? _risingStarSub;

  @override
  void initState() {
    super.initState();
    _loadMe();
    _loadInitialTrack();
    _loadVenueAd();
    StationEventsService().start();
    _risingStarSub = StationEventsService().risingStarStream.listen((event) {
      if (!mounted) return;
      final percent = event.conversion != null ? (event.conversion! * 100).toStringAsFixed(1) : '5';
      setState(() {
        _risingStarText = '${event.artistName} just hit $percent% conversion on “${event.songTitle}”.';
      });
      Future.delayed(const Duration(seconds: 8), () {
        if (!mounted) return;
        setState(() => _risingStarText = null);
      });
    });
    _audioPlayer.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        _loadNextTrack();
      }
    });
  }

  Future<void> _loadMe() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      if (!mounted) return;
      setState(() => _me = me);
    } catch (_) {
      // ignore
    }
  }

  Future<void> _loadVenueAd() async {
    try {
      final ad = await _venueAds.getCurrent();
      if (!mounted) return;
      setState(() => _ad = ad);
    } catch (_) {
      // ignore
    }
  }

  Future<void> _loadInitialTrack() async {
    setState(() {
      _isLoading = true;
      _noContent = false;
      _noContentMessage = null;
    });

    final res = await _radioService.getCurrentTrack();
    if (!mounted) return;
    if (res.noContent) {
      setState(() {
        _isLoading = false;
        _noContent = true;
        _noContentMessage = res.message;
      });
      return;
    }

    final track = res.track;
    if (track == null || track.audioUrl.trim().isEmpty) {
      setState(() => _isLoading = false);
      return;
    }

    await _loadAndPlay(track, res);
  }

  Future<void> _loadNextTrack() async {
    setState(() {
      _isLoading = true;
      _isLiked = false;
      _noContent = false;
      _noContentMessage = null;
    });

    try {
      final result = await _radioService.getNextTrack();
      if (!mounted) return;
      if (result.noContent) {
        setState(() {
          _isLoading = false;
          _noContent = true;
          _noContentMessage = result.message;
        });
        return;
      }

      final track = result.track;
      if (track == null || track.audioUrl.trim().isEmpty) {
        setState(() => _isLoading = false);
        return;
      }

      await _loadAndPlay(track, result);
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading track: $e')),
        );
      }
    }
  }

  Future<void> _loadAndPlay(Track track, TrackFetchResult result) async {
    await _audioPlayer.setUrl(track.audioUrl);
    // Best-effort sync to server position if available.
    if (track.positionSeconds > 0) {
      await _audioPlayer.seek(Duration(seconds: track.positionSeconds));
    }
    await _audioPlayer.play();
    await _radioService.reportPlay(track.id);

    final liked = await _radioService.isLiked(track.id);
    if (!mounted) return;

    setState(() {
      _currentTrack = track;
      _isPlaying = true;
      _isLoading = false;
      _isLiked = liked;
    });
  }

  Future<void> _toggleLike() async {
    if (_currentTrack == null || _isLikeLoading) return;

    setState(() {
      _isLikeLoading = true;
    });

    try {
      final liked = await _radioService.toggleLike(_currentTrack!.id);
      setState(() {
        _isLiked = liked;
        _isLikeLoading = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(liked ? 'Saved to your rotation.' : 'Removed from your rotation.'),
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLikeLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  bool get _canQuickBuy {
    final me = _me;
    final track = _currentTrack;
    if (me == null || track == null) return false;
    if (me.role != 'artist') return false;
    if (track.artistId == null || track.artistId!.isEmpty) return false;
    return me.id == track.artistId;
  }

  Future<void> _quickBuyFivePlays() async {
    final track = _currentTrack;
    if (track == null || _quickBuying) return;
    setState(() => _quickBuying = true);
    try {
      final response = await _api.post('payments/create-intent-song-plays', {
        'songId': track.id,
        'plays': 5,
      });
      final clientSecret = response['clientSecret'] as String?;
      if (clientSecret == null || clientSecret.isEmpty) {
        throw Exception('No payment client secret');
      }

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Radio App',
          style: ThemeMode.system,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: NetworxTokens.butterflyElectric,
            ),
          ),
        ),
      );
      await Stripe.instance.presentPaymentSheet();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Added 5 minutes.'),
          duration: Duration(seconds: 2),
        ),
      );
    } on StripeException catch (e) {
      if (!mounted) return;
      final msg = e.error.localizedMessage ?? 'Payment was cancelled';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.orange),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Quick-buy failed: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _quickBuying = false);
    }
  }

  Future<void> _togglePlayPause() async {
    if (_isPlaying) {
      await _audioPlayer.pause();
    } else {
      await _audioPlayer.play();
    }
    setState(() {
      _isPlaying = !_isPlaying;
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _risingStarSub?.cancel();
    StationEventsService().stop();
    super.dispose();
  }

  void _openRoom() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.78,
            child: const ChatPanel(
              isExpanded: true,
              fillHeightWhenExpanded: true,
              expandedHeight: 9999,
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Radio'),
          actions: [
            IconButton(
              onPressed: _openRoom,
              tooltip: 'Enter the Room',
              icon: const Icon(Icons.forum_outlined),
            ),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _noContent
                ? _NoContent(
                    message: _noContentMessage,
                    onRetry: _loadInitialTrack,
                  )
                : _currentTrack == null
                    ? const Center(child: Text('No track playing'))
                    : _PlayerBody(
                        track: _currentTrack!,
                        risingStarText: _risingStarText,
                        ad: _ad,
                        canQuickBuy: _canQuickBuy,
                        quickBuying: _quickBuying,
                        onQuickBuy: _quickBuyFivePlays,
                        isPlaying: _isPlaying,
                        isLiked: _isLiked,
                        isLikeLoading: _isLikeLoading,
                        onLike: _toggleLike,
                        onPlayPause: _togglePlayPause,
                        onEnterRoom: _openRoom,
                        audioPlayer: _audioPlayer,
                      ),
      ),
    );
  }
}

class _NoContent extends StatelessWidget {
  final String? message;
  final VoidCallback onRetry;
  const _NoContent({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('📻', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              Text(
                'Station Offline',
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontFamily: 'Lora'),
              ),
              const SizedBox(height: 8),
              Text(
                message ?? 'No songs are currently available.',
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: surfaces.textSecondary),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _roleLabel(String role) {
  switch (role) {
    case 'cover_art':
      return 'Cover art';
    case 'video':
      return 'Video';
    case 'production':
      return 'Production';
    case 'photo':
      return 'Photo';
    default:
      return 'Credits';
  }
}

class _VenueAdCard extends StatelessWidget {
  final VenueAd ad;
  const _VenueAdCard({required this.ad});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Card(
      child: InkWell(
        onTap: ad.linkUrl == null || ad.linkUrl!.isEmpty
            ? null
            : () async {
                final uri = Uri.tryParse(ad.linkUrl!);
                if (uri != null) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
        borderRadius: BorderRadius.circular(16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 5,
                child: CachedNetworkImage(
                  imageUrl: ad.imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (context, url, error) => Container(
                    color: surfaces.elevated,
                    alignment: Alignment.center,
                    child: Text('Venue partner', style: TextStyle(color: surfaces.textSecondary)),
                  ),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                  ),
                  child: Text(
                    'Venue Partner',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlayerBody extends StatelessWidget {
  final Track track;
  final String? risingStarText;
  final VenueAd? ad;
  final bool canQuickBuy;
  final bool quickBuying;
  final VoidCallback onQuickBuy;
  final bool isPlaying;
  final bool isLiked;
  final bool isLikeLoading;
  final VoidCallback onLike;
  final VoidCallback onPlayPause;
  final VoidCallback onEnterRoom;
  final AudioPlayer audioPlayer;

  const _PlayerBody({
    required this.track,
    required this.risingStarText,
    required this.ad,
    required this.canQuickBuy,
    required this.quickBuying,
    required this.onQuickBuy,
    required this.isPlaying,
    required this.isLiked,
    required this.isLikeLoading,
    required this.onLike,
    required this.onPlayPause,
    required this.onEnterRoom,
    required this.audioPlayer,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget albumArt() {
      return AspectRatio(
        aspectRatio: 1,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(gradient: surfaces.signatureGradient),
              ),
              if (track.artworkUrl != null && track.artworkUrl!.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: track.artworkUrl!,
                  fit: BoxFit.cover,
                  placeholder: (context, url) =>
                      const Center(child: CircularProgressIndicator()),
                  errorWidget: (context, url, error) =>
                      const Icon(Icons.music_note, size: 64),
                )
              else
                const Center(child: Icon(Icons.music_note, size: 72)),
              if (track.isLiveBroadcast)
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [surfaces.roseGold, scheme.primary],
                      ),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [
                        BoxShadow(
                          color: surfaces.roseGold.withValues(alpha: 0.35),
                          blurRadius: 18,
                        ),
                      ],
                    ),
                    child: const Text(
                      'NOW LIVE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    Widget glassPanel({required Widget child}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: surfaces.glassBlur,
            sigmaY: surfaces.glassBlur,
          ),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(
                color:
                    Colors.white.withValues(alpha: surfaces.glassBorderOpacity),
              ),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            child: child,
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 720;
        final art = SizedBox(
          width: isWide ? 320 : double.infinity,
          child: albumArt(),
        );
        final details = glassPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (risingStarText != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: scheme.primary.withValues(alpha: 0.22)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Butterfly Ripple',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: scheme.primary,
                              letterSpacing: 0.8,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        risingStarText!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: surfaces.textSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                track.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontFamily: 'Lora'),
              ),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: () {
                  ApiService().post('analytics/profile-click', {'songId': track.id});
                },
                child: Text(
                  track.artistName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(color: surfaces.textSecondary),
                ),
              ),
              if (track.pinnedCatalysts.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...track.pinnedCatalysts.take(2).map((c) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Text(
                          '${_roleLabel(c.role)} by ',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: surfaces.textMuted,
                                letterSpacing: 0.3,
                              ),
                        ),
                        Expanded(
                          child: Text(
                            c.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              const SizedBox(height: 14),
              StreamBuilder<Duration>(
                stream: audioPlayer.positionStream,
                builder: (context, snap) {
                  final pos = snap.data ?? Duration.zero;
                  final dur = audioPlayer.duration ?? Duration.zero;
                  final value = (dur.inMilliseconds <= 0)
                      ? 0.0
                      : (pos.inMilliseconds / dur.inMilliseconds)
                          .clamp(0.0, 1.0);
                  return Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 4,
                          value: value,
                          backgroundColor:
                              scheme.onSurface.withValues(alpha: 0.12),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatMmSs(pos),
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                          Text(
                            _formatMmSs(dur),
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 10),
              if (canQuickBuy) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: quickBuying ? null : onQuickBuy,
                    child: Text(quickBuying ? 'Opening…' : 'Add 5 Minutes'),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  IconButton(
                    onPressed: onPlayPause,
                    iconSize: 52,
                    icon: Icon(
                      isPlaying ? Icons.pause_circle : Icons.play_circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Spacer(),
                  IconButton(
                    onPressed: onEnterRoom,
                    tooltip: 'Enter the Room',
                    icon: const Icon(Icons.forum_outlined),
                  ),
                  IconButton(
                    onPressed: isLikeLoading ? null : onLike,
                    tooltip: isLiked ? 'Remove' : 'Save',
                    icon: isLikeLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            isLiked ? Icons.favorite : Icons.favorite_border,
                            color: isLiked
                                ? scheme.primary
                                : surfaces.textSecondary,
                          ),
                  ),
                ],
              ),
            ],
          ),
        );

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: isWide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    art,
                    const SizedBox(width: 16),
                    Expanded(child: details),
                  ],
                )
              : Column(
                  children: [
                    if (ad != null) ...[
                      _VenueAdCard(ad: ad!),
                      const SizedBox(height: 12),
                    ],
                    art,
                    const SizedBox(height: 16),
                    details,
                  ],
                ),
        );
      },
    );
  }
}

String _formatMmSs(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$m:$s';
}
