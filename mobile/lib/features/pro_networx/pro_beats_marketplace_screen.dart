import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/song_purchase_flow.dart';
import '../../core/services/songs_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Pro-Networx Beat Marketplace — browse, full-preview, and buy beats.
class ProBeatsMarketplaceScreen extends StatefulWidget {
  const ProBeatsMarketplaceScreen({super.key});

  @override
  State<ProBeatsMarketplaceScreen> createState() =>
      _ProBeatsMarketplaceScreenState();
}

class _ProBeatsMarketplaceScreenState extends State<ProBeatsMarketplaceScreen> {
  final SongsService _songs = SongsService();
  final TextEditingController _search = TextEditingController();
  final AudioPlayer _player = AudioPlayerService().player;

  bool _loading = true;
  String? _error;
  List<MarketplaceBeat> _beats = const [];
  String? _playingId;
  bool _isPlaying = false;
  String? _buyingId;
  StreamSubscription<PlayerState>? _playerSub;

  @override
  void initState() {
    super.initState();
    _load();
    _playerSub = _player.playerStateStream.listen((s) {
      if (!mounted) return;
      final tag = _player.sequenceState.currentSource?.tag;
      String? id;
      String? source;
      if (tag is MediaItem) {
        id = tag.id;
        source = tag.extras?['source']?.toString();
      }
      final audible = s.playing && source == 'beat_preview';
      setState(() {
        _playingId = source == 'beat_preview' ? id : null;
        _isPlaying = audible;
      });
    });
  }

  @override
  void dispose() {
    unawaited(_playerSub?.cancel() ?? Future<void>.value());
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _songs.listMarketplaceBeats(
        q: _search.text.trim(),
        limit: 60,
      );
      if (!mounted) return;
      setState(() => _beats = items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _price(int cents) {
    final dollars = cents / 100;
    if (dollars == dollars.roundToDouble()) {
      return '\$${dollars.toStringAsFixed(0)}';
    }
    return '\$${dollars.toStringAsFixed(2)}';
  }

  Future<void> _togglePreview(MarketplaceBeat beat) async {
    final same = _playingId == beat.id;
    final handler = AudioPlayerService.handler;
    if (same) {
      if (_player.playing && !handler.userPaused) {
        await _player.pause();
        if (mounted) setState(() => _isPlaying = false);
      } else {
        await handler.setUserPaused(false);
        await handler.applyOutputVolume();
        await _player.play();
        if (mounted) setState(() => _isPlaying = true);
      }
      return;
    }

    String? url = (beat.previewUrl ?? '').trim();
    if (url.isEmpty) {
      url = await _songs.getStreamUrl(beat.id);
    }
    if (url == null || url.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Full preview unavailable for this beat.')),
      );
      return;
    }

    await _player.setAudioSource(
      AudioSource.uri(
        Uri.parse(url),
        tag: MediaItem(
          id: beat.id,
          title: beat.title,
          artist: beat.artistName,
          artUri: BrandAssets.mediaArtUri(beat.artworkUrl),
          extras: const {'source': 'beat_preview'},
        ),
      ),
    );
    await handler.setUserPaused(false);
    await handler.applyOutputVolume();
    await _player.play();
    if (mounted) {
      setState(() {
        _playingId = beat.id;
        _isPlaying = true;
      });
    }
  }

  Future<void> _buy(MarketplaceBeat beat) async {
    setState(() => _buyingId = beat.id);
    try {
      final outcome = await SongPurchaseFlow.buy(
        songId: beat.id,
        priceCents: beat.priceCents,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(outcome.message)));
      if (outcome.unlocked) await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Purchase failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _buyingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Text(
            '◤ BEAT MARKETPLACE',
            style: DimensionTypography.monoCaps(
              color: DimensionTokens.neonYellow,
              fontSize: 10,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Text(
            'Browse beats for sale',
            style: DimensionTypography.pageTitle(fontSize: 24),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            'Play the full beat before you buy. Songs stay sample-only — '
            'beats let you hear everything.',
            style: DimensionTypography.body(),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          GlassCard(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      labelText: 'Search beats or producers',
                      hintText: 'trap, drill, producer name…',
                      isDense: true,
                    ),
                    onSubmitted: (_) => _load(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  tooltip: 'Search',
                  onPressed: _load,
                  icon: const Icon(Icons.search),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          DimensionCtaButton(
            label: 'Upload a beat for sale',
            onPressed: () => Navigator.pushNamed(
              context,
              AppRoutes.upload,
              arguments: {'productKind': 'beat'},
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            GlassCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(_error!, style: DimensionTypography.body()),
                  const SizedBox(height: 12),
                  DimensionCtaButton(
                    label: 'Retry',
                    variant: DimensionCtaVariant.secondary,
                    onPressed: _load,
                  ),
                ],
              ),
            )
          else if (_beats.isEmpty)
            GlassCard(
              padding: const EdgeInsets.all(28),
              child: Column(
                children: [
                  Text(
                    'No beats listed yet',
                    style: DimensionTypography.cardTitle(fontSize: 18),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Be the first producer to upload a beat for sale.',
                    style: DimensionTypography.body(),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            )
          else
            ..._beats.map((beat) {
              final playing = _playingId == beat.id && _isPlaying;
              final busy = _buyingId == beat.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: GlassCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: SizedBox(
                              width: 72,
                              height: 72,
                              child: (beat.artworkUrl ?? '').isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: beat.artworkUrl!,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) =>
                                          _artFallback(),
                                    )
                                  : _artFallback(),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: DimensionTokens.neonYellow
                                        .withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(
                                      color: DimensionTokens.neonYellow
                                          .withValues(alpha: 0.45),
                                    ),
                                  ),
                                  child: Text(
                                    'BEAT FOR SALE · FULL PREVIEW',
                                    style: DimensionTypography.monoCaps(
                                      color: DimensionTokens.neonYellow,
                                      fontSize: 9,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  beat.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: DimensionTypography.cardTitle(
                                    fontSize: 16,
                                  ),
                                ),
                                TextButton(
                                  onPressed: beat.artistId.isEmpty
                                      ? null
                                      : () => AppRoutes.openArtistProfile(
                                            context,
                                            artistId: beat.artistId,
                                          ),
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: Size.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  child: Text(
                                    beat.artistName,
                                    style: DimensionTypography.body(
                                      color: DimensionTokens.cyan300,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                                Text(
                                  '${_price(beat.priceCents)}'
                                  '${beat.durationSeconds != null ? ' · ${beat.durationSeconds}s' : ''}'
                                  ' · ${beat.listenCount} listens',
                                  style: DimensionTypography.bodyMuted(
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          DimensionCtaButton(
                            label: playing ? 'Pause full beat' : 'Play full beat',
                            variant: DimensionCtaVariant.secondary,
                            onPressed: () => _togglePreview(beat),
                          ),
                          DimensionCtaButton(
                            label: busy ? '…' : 'Buy ${_price(beat.priceCents)}',
                            onPressed: busy ? null : () => _buy(beat),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _artFallback() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            DimensionTokens.neonYellow.withValues(alpha: 0.25),
            DimensionTokens.cyan300.withValues(alpha: 0.2),
          ],
        ),
      ),
      child: Icon(Icons.graphic_eq, color: DimensionTokens.neonYellow),
    );
  }
}
