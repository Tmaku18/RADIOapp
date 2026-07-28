import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../../core/brand/brand_assets.dart';
import '../../../core/services/audio_player_service.dart';

/// Audio feed post: cover art (the poster's picture, or the Networx Radio logo
/// when they posted audio alone) with tap-to-play transport controls.
///
/// Live radio is muted while this plays so two sources never overlap.
class FeedPostAudio extends StatefulWidget {
  const FeedPostAudio({
    super.key,
    required this.audioUrl,
    required this.coverUrl,
  });

  final String audioUrl;
  final String coverUrl;

  @override
  State<FeedPostAudio> createState() => _FeedPostAudioState();
}

class _FeedPostAudioState extends State<FeedPostAudio> {
  AudioPlayer? _player;
  StreamSubscription<PlayerState>? _stateSub;
  StreamSubscription<Duration>? _positionSub;
  bool _loading = false;
  bool _playing = false;
  bool _failed = false;
  bool _didSoftPauseRadio = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void dispose() {
    _stateSub?.cancel();
    _positionSub?.cancel();
    _player?.dispose();
    unawaited(_softResumeRadioIfNeeded());
    super.dispose();
  }

  Future<void> _softPauseRadio() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
        _didSoftPauseRadio = true;
      }
    } catch (_) {}
  }

  Future<void> _softResumeRadioIfNeeded() async {
    if (!_didSoftPauseRadio) return;
    _didSoftPauseRadio = false;
    try {
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  Future<AudioPlayer?> _ensurePlayer() async {
    final existing = _player;
    if (existing != null) return existing;
    setState(() {
      _loading = true;
      _failed = false;
    });
    final player = AudioPlayer();
    try {
      final duration = await player.setUrl(widget.audioUrl);
      _player = player;
      _duration = duration ?? Duration.zero;
      _stateSub = player.playerStateStream.listen((state) {
        if (!mounted) return;
        final finished = state.processingState == ProcessingState.completed;
        if (finished) {
          unawaited(player.pause());
          unawaited(player.seek(Duration.zero));
          unawaited(_softResumeRadioIfNeeded());
        }
        setState(() => _playing = state.playing && !finished);
      });
      _positionSub = player.positionStream.listen((pos) {
        if (mounted) setState(() => _position = pos);
      });
      return player;
    } catch (_) {
      await player.dispose();
      if (mounted) setState(() => _failed = true);
      return null;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle() async {
    final player = await _ensurePlayer();
    if (player == null) return;
    if (player.playing) {
      await player.pause();
      await _softResumeRadioIfNeeded();
    } else {
      await _softPauseRadio();
      unawaited(player.play());
    }
  }

  static String _formatTime(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final total = _duration.inMilliseconds;
    final progress = total > 0
        ? (_position.inMilliseconds / total).clamp(0.0, 1.0)
        : 0.0;

    return Stack(
      fit: StackFit.expand,
      children: [
        CachedNetworkImage(
          imageUrl: widget.coverUrl,
          fit: BoxFit.cover,
          placeholder: (_, _) => Container(color: cs.surfaceContainerHighest),
          errorWidget: (_, _, _) => Container(
            color: cs.surfaceContainerHighest,
            padding: const EdgeInsets.all(32),
            child: Image.asset(BrandAssets.logoCyanAsset, fit: BoxFit.contain),
          ),
        ),
        // Scrim keeps the transport readable over bright artwork.
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black87],
              stops: [0.45, 1],
            ),
          ),
        ),
        Center(
          child: Material(
            color: Colors.black54,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: _loading ? null : _toggle,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _loading
                    ? const SizedBox(
                        height: 32,
                        width: 32,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(
                        _failed
                            ? Icons.error_outline
                            : _playing
                                ? Icons.pause
                                : Icons.play_arrow,
                        size: 32,
                        color: Colors.white,
                      ),
              ),
            ),
          ),
        ),
        Positioned(
          left: 12,
          right: 12,
          bottom: 12,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              LinearProgressIndicator(
                value: progress,
                minHeight: 3,
                backgroundColor: Colors.white24,
                valueColor: AlwaysStoppedAnimation<Color>(cs.primary),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.music_note, size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(
                    _failed
                        ? 'Audio unavailable'
                        : '${_formatTime(_position)} / ${_formatTime(_duration)}',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
