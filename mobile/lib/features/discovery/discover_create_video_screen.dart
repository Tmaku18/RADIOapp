import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:video_player/video_player.dart';

import '../../core/models/discover_audio_models.dart';
import '../../core/services/api_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'discover_clip_camera_screen.dart';

/// Pick a liked Discover clip, then record a short TikTok-style video while
/// the clip plays. Available to all signed-in roles (including listeners).
class DiscoverCreateVideoScreen extends StatefulWidget {
  const DiscoverCreateVideoScreen({
    super.key,
    this.initialClipUrl,
    this.initialSongTitle,
    this.initialArtistName,
    this.initialSongId,
  });

  final String? initialClipUrl;
  final String? initialSongTitle;
  final String? initialArtistName;
  final String? initialSongId;

  @override
  State<DiscoverCreateVideoScreen> createState() =>
      _DiscoverCreateVideoScreenState();
}

class _DiscoverCreateVideoScreenState extends State<DiscoverCreateVideoScreen> {
  static const int _maxDurationSec = 15;
  static const int _cameraCountdownSec = 5;
  static const int _maxFileSizeBytes = 75 * 1024 * 1024;

  final ApiService _api = ApiService();
  final DiscoverAudioService _discover = DiscoverAudioService();
  final AudioPlayer _clipPlayer = AudioPlayer();
  final _captionCtrl = TextEditingController();
  final _listController = ScrollController();

  bool _loadingClips = true;
  List<DiscoverAudioLikedItem> _likedClips = const [];
  DiscoverAudioLikedItem? _selected;
  File? _videoFile;
  VideoPlayerController? _previewPlayer;
  bool _uploading = false;
  bool _recording = false;
  String? _error;
  /// True when this screen muted live radio so clip preview/recording is solo.
  bool _didSoftPauseRadio = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    unawaited(_softResumeRadioIfNeeded());
    unawaited(_clipPlayer.dispose());
    unawaited(_previewPlayer?.dispose() ?? Future<void>.value());
    _captionCtrl.dispose();
    _listController.dispose();
    super.dispose();
  }

  /// Mute live radio (keeps sync) while Discover clip audio is in use.
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
      // Leave playAndRecord (camera) before unmuting so gain isn't stuck quiet
      // then suddenly loud when another screen reconfigures the session.
      await AudioPlayerService.restoreMusicSession();
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  Future<void> _bootstrap() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
    } catch (_) {}

    try {
      final items = await _discover.getLikedList(limit: 100, offset: 0);
      if (!mounted) return;
      DiscoverAudioLikedItem? preselected;
      final initialUrl = widget.initialClipUrl?.trim() ?? '';
      if (initialUrl.isNotEmpty) {
        for (final c in items) {
          if (c.clipUrl == initialUrl ||
              (widget.initialSongId != null &&
                  widget.initialSongId!.isNotEmpty &&
                  c.songId == widget.initialSongId)) {
            preselected = c;
            break;
          }
        }
        preselected ??= DiscoverAudioLikedItem(
          songId: widget.initialSongId ?? '',
          artistId: '',
          artistName: widget.initialArtistName ?? '',
          artistDisplayName: widget.initialArtistName,
          artistAvatarUrl: null,
          artistHeadline: null,
          title: widget.initialSongTitle ?? 'Discover clip',
          clipUrl: initialUrl,
          backgroundUrl: null,
          clipDurationSeconds: 15,
          likeCount: 0,
          likedByMe: true,
          likedAt: null,
        );
      }
      setState(() {
        _likedClips = items.where((c) => c.clipUrl.trim().isNotEmpty).toList();
        _selected = preselected;
        _loadingClips = false;
        if (_selected != null) {
          _captionCtrl.text = _defaultCaption(_selected!);
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingClips = false;
        _error = "Couldn't load your liked clips.";
      });
    }
  }

  String _defaultCaption(DiscoverAudioLikedItem clip) {
    final artist = (clip.artistDisplayName ?? clip.artistName).trim();
    if (artist.isEmpty) return clip.title;
    return '${clip.title} - $artist';
  }

  Future<void> _selectClip(
    DiscoverAudioLikedItem clip, {
    bool startRecording = false,
  }) async {
    await _stopClip();
    await _clearRecordedPreview(disposeOnly: true);
    setState(() {
      _selected = clip;
      _videoFile = null;
      _error = null;
      _captionCtrl.text = _defaultCaption(clip);
    });
    if (startRecording) {
      await _recordWithClip();
    }
  }

  Future<void> _previewClip() async {
    final clip = _selected;
    if (clip == null || clip.clipUrl.isEmpty) return;
    try {
      await _softPauseRadio();
      await _clipPlayer.setUrl(clip.clipUrl);
      await _clipPlayer.seek(Duration.zero);
      await _clipPlayer.play();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not play clip: $e');
    }
  }

  Future<void> _stopClip() async {
    try {
      await _clipPlayer.stop();
    } catch (_) {}
  }

  Future<void> _clearRecordedPreview({bool disposeOnly = false}) async {
    final player = _previewPlayer;
    _previewPlayer = null;
    if (player != null) {
      try {
        await player.dispose();
      } catch (_) {}
    }
    if (!disposeOnly && mounted) {
      setState(() => _videoFile = null);
    }
  }

  Future<void> _initVideoPreview(File file) async {
    await _clearRecordedPreview(disposeOnly: true);
    final controller = VideoPlayerController.file(file);
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() => _previewPlayer = controller);
      unawaited(controller.play());
    } catch (e) {
      try {
        await controller.dispose();
      } catch (_) {}
      if (!mounted) return;
      setState(() => _error = 'Could not preview recording: $e');
    }
  }

  /// In-app camera: silent countdown on mirrored selfie preview; recording + clip after.
  Future<void> _recordWithClip() async {
    final clip = _selected;
    if (clip == null || clip.clipUrl.isEmpty) {
      setState(() => _error = 'Pick a liked Discover clip first.');
      return;
    }
    if (_recording || _uploading) return;

    setState(() {
      _recording = true;
      _error = null;
    });

    try {
      await _softPauseRadio();
      await _stopClip();
      await _clearRecordedPreview();
      if (!mounted) return;
      final maxSec = clip.clipDurationSeconds.isFinite &&
              clip.clipDurationSeconds > 0
          ? clip.clipDurationSeconds.clamp(3, _maxDurationSec).round()
          : _maxDurationSec;

      final path = await Navigator.of(context).push<String>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => DiscoverClipCameraScreen(
            clipUrl: clip.clipUrl,
            songTitle: clip.title,
            countdownSeconds: _cameraCountdownSec,
            maxRecordSeconds: maxSec,
          ),
        ),
      );
      if (!mounted) return;
      if (path != null && path.isNotEmpty) {
        await _handlePicked(XFile(path));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Recording failed: $e');
    } finally {
      if (mounted) setState(() => _recording = false);
    }
  }

  Future<void> _pickFromGallery() async {
    if (_selected == null) {
      setState(() => _error = 'Pick a liked Discover clip first.');
      return;
    }
    final picked = await ImagePicker().pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(seconds: _maxDurationSec),
    );
    await _handlePicked(picked);
  }

  Future<void> _handlePicked(XFile? picked) async {
    if (picked == null) return;
    final file = File(picked.path);
    final size = await file.length();
    if (size > _maxFileSizeBytes) {
      setState(() => _error = 'File too large (max 75 MB)');
      return;
    }
    setState(() {
      _videoFile = file;
      _error = null;
    });
    await _initVideoPreview(file);
  }

  Future<void> _deleteRecording() async {
    await _clearRecordedPreview();
    setState(() => _error = null);
  }

  Future<void> _reRecord() async {
    await _clearRecordedPreview();
    await _recordWithClip();
  }

  String _mimeForPath(String path) {
    final ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      case '3gp':
        return 'video/3gpp';
      default:
        return 'video/mp4';
    }
  }

  Future<void> _publish() async {
    if (_selected == null) {
      setState(() => _error = 'Pick a liked Discover clip first.');
      return;
    }
    if (_videoFile == null) {
      setState(() => _error = 'Record a video with the clip first.');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final fields = <String, String>{};
      final caption = _captionCtrl.text.trim();
      if (caption.isNotEmpty) fields['caption'] = caption;

      final mime = _mimeForPath(_videoFile!.path);
      final parts = mime.split('/');
      final multipartFile = await http.MultipartFile.fromPath(
        'file',
        _videoFile!.path,
        contentType: http_parser.MediaType(
          parts.first,
          parts.length > 1 ? parts[1] : 'mp4',
        ),
      );

      await _api.postMultipart('discovery/feed', fields, [multipartFile]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Video posted!')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      final raw = e is ApiException ? e.message : e.toString();
      setState(() {
        _error = raw.contains('413')
            ? 'Upload failed: file too large for the network path. Try a shorter take, or check your connection.'
            : raw.contains('Video length')
                ? raw
                : 'Upload failed: $raw';
      });
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final preview = _previewPlayer;

    return DimensionScreenShell(
      title: 'Create Video',
      showNeonLine: true,
      body: _loadingClips
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    controller: _listController,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    children: [
                      Text(
                        'Tap a liked song to select it. Double-tap to select and '
                        'start recording. Preview your take before publishing.',
                        style: TextStyle(
                          color: surfaces.textSecondary,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'YOUR LIKED CLIPS',
                        style: TextStyle(
                          color: DimensionTokens.neonCyan,
                          fontSize: 10,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (_likedClips.isEmpty)
                        GlassCard(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'No liked Discover songs yet. Swipe right (Like) on '
                            'Discover clips first, then come back to make a video.',
                            style: TextStyle(color: surfaces.textSecondary),
                          ),
                        )
                      else
                        ..._likedClips.map((clip) {
                          final selected = _selected?.songId == clip.songId &&
                              _selected?.clipUrl == clip.clipUrl;
                          final artist =
                              clip.artistDisplayName ?? clip.artistName;
                          final art = clip.backgroundUrl;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Material(
                              color: selected
                                  ? DimensionTokens.neonCyan
                                      .withValues(alpha: 0.12)
                                  : scheme.surface.withValues(alpha: 0.55),
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: _uploading || _recording
                                    ? null
                                    : () => _selectClip(clip),
                                onDoubleTap: _uploading || _recording
                                    ? null
                                    : () => _selectClip(
                                          clip,
                                          startRecording: true,
                                        ),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Row(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(10),
                                        child: (art != null && art.isNotEmpty)
                                            ? Image.network(
                                                art,
                                                width: 52,
                                                height: 52,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, _, _) =>
                                                    _artFallback(),
                                              )
                                            : _artFallback(),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              clip.title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            Text(
                                              artist,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                color: surfaces.textSecondary,
                                                fontSize: 13,
                                              ),
                                            ),
                                            Text(
                                              selected
                                                  ? 'Selected · double-tap to record'
                                                  : '${clip.clipDurationSeconds.round()}s clip · double-tap to record',
                                              style: TextStyle(
                                                color: surfaces.textMuted,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(
                                        selected
                                            ? Icons.check_circle
                                            : Icons.radio_button_unchecked,
                                        color: selected
                                            ? DimensionTokens.neonCyan
                                            : surfaces.textMuted,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      if (_videoFile != null) ...[
                        const SizedBox(height: 12),
                        GlassCard(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text(
                                'Your take',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 10),
                              if (preview != null &&
                                  preview.value.isInitialized)
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: AspectRatio(
                                    aspectRatio: preview.value.aspectRatio == 0
                                        ? 9 / 16
                                        : preview.value.aspectRatio,
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        VideoPlayer(preview),
                                        Positioned(
                                          bottom: 8,
                                          child: IconButton.filled(
                                            style: IconButton.styleFrom(
                                              backgroundColor: Colors.black54,
                                            ),
                                            onPressed: () {
                                              setState(() {
                                                if (preview.value.isPlaying) {
                                                  preview.pause();
                                                } else {
                                                  preview.play();
                                                }
                                              });
                                            },
                                            icon: Icon(
                                              preview.value.isPlaying
                                                  ? Icons.pause
                                                  : Icons.play_arrow,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              else
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 24),
                                  child: Center(
                                    child: CircularProgressIndicator(),
                                  ),
                                ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: _uploading || _recording
                                          ? null
                                          : _deleteRecording,
                                      icon: const Icon(Icons.delete_outline),
                                      label: const Text('Delete'),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: FilledButton.icon(
                                      onPressed: _uploading || _recording
                                          ? null
                                          : _reRecord,
                                      icon: const Icon(Icons.videocam),
                                      label: const Text('Re-record'),
                                      style: FilledButton.styleFrom(
                                        backgroundColor:
                                            DimensionTokens.neonCyan,
                                        foregroundColor: Colors.black,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _captionCtrl,
                          decoration: const InputDecoration(
                            hintText: 'Write a caption (optional)',
                            border: OutlineInputBorder(),
                          ),
                          maxLines: 3,
                          maxLength: 280,
                          enabled: !_uploading && !_recording,
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          style: TextStyle(color: scheme.error, fontSize: 13),
                        ),
                      ],
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
                if (_selected != null) _buildStickyBar(surfaces),
              ],
            ),
    );
  }

  Widget _buildStickyBar(NetworxSurfaces surfaces) {
    final hasVideo = _videoFile != null;
    return Material(
      elevation: 8,
      color: surfaces.elevated.withValues(alpha: 0.98),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Selected: ${_selected!.title}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                hasVideo
                    ? 'Watch your take above, then publish — or delete / re-record.'
                    : '$_cameraCountdownSec-second selfie countdown · max '
                        '$_maxDurationSec s · double-tap a song to jump straight in.',
                style: TextStyle(
                  color: surfaces.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 10),
              if (!hasVideo) ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed:
                            _uploading || _recording ? null : _previewClip,
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('Preview'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        onPressed:
                            _uploading || _recording ? null : _recordWithClip,
                        icon: _recording
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.videocam),
                        label: Text(
                          _recording ? 'Recording…' : 'Record',
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: DimensionTokens.neonCyan,
                          foregroundColor: Colors.black,
                          minimumSize: const Size.fromHeight(44),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                TextButton(
                  onPressed:
                      _uploading || _recording ? null : _pickFromGallery,
                  child: const Text('Use gallery video instead'),
                ),
              ] else
                FilledButton(
                  onPressed: _uploading || _recording ? null : _publish,
                  child: _uploading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Publish'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _artFallback() {
    return Container(
      width: 52,
      height: 52,
      color: DimensionTokens.neonCyan.withValues(alpha: 0.12),
      child: const Icon(Icons.music_note, color: DimensionTokens.neonCyan),
    );
  }
}
