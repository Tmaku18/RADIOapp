import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/models/discover_audio_models.dart';
import '../../core/services/api_service.dart';
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
  static const int _cameraCountdownSec = 10;
  static const int _maxFileSizeBytes = 15 * 1024 * 1024;

  final ApiService _api = ApiService();
  final DiscoverAudioService _discover = DiscoverAudioService();
  final AudioPlayer _clipPlayer = AudioPlayer();
  final _captionCtrl = TextEditingController();

  bool _loadingClips = true;
  List<DiscoverAudioLikedItem> _likedClips = const [];
  DiscoverAudioLikedItem? _selected;
  File? _videoFile;
  bool _uploading = false;
  bool _recording = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    unawaited(_clipPlayer.dispose());
    _captionCtrl.dispose();
    super.dispose();
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

  Future<void> _selectClip(DiscoverAudioLikedItem clip) async {
    await _stopClip();
    setState(() {
      _selected = clip;
      _videoFile = null;
      _error = null;
      _captionCtrl.text = _defaultCaption(clip);
    });
  }

  Future<void> _previewClip() async {
    final clip = _selected;
    if (clip == null || clip.clipUrl.isEmpty) return;
    try {
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

  /// In-app camera: countdown on preview, recording + clip audio start at 1.
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
      await _stopClip();
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
      setState(() => _error = 'File too large (max 15 MB)');
      return;
    }
    setState(() {
      _videoFile = file;
      _error = null;
    });
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
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return DimensionScreenShell(
      title: 'Create Video',
      showNeonLine: true,
      body: _loadingClips
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                Text(
                  'Pick a song you’ve liked on Discover, then record a short '
                  'video while the 15-second clip plays.',
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
                            ? DimensionTokens.neonCyan.withValues(alpha: 0.12)
                            : scheme.surface.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(14),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: _uploading || _recording
                              ? null
                              : () => _selectClip(clip),
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
                                        '${clip.clipDurationSeconds.round()}s clip',
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
                if (_selected != null) ...[
                  const SizedBox(height: 8),
                  GlassCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Selected: ${_selected!.title}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Camera opens with a $_cameraCountdownSec-second '
                          'countdown. Recording and clip audio start the '
                          'moment it hits 1 (max $_maxDurationSec s). Keep '
                          'volume up so the music is in your take.',
                          style: TextStyle(
                            color: surfaces.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _uploading || _recording
                              ? null
                              : _previewClip,
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Preview clip'),
                        ),
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: _uploading || _recording
                              ? null
                              : _recordWithClip,
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
                            _recording
                                ? 'Recording…'
                                : 'Record with this clip',
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: DimensionTokens.neonCyan,
                            foregroundColor: Colors.black,
                            minimumSize: const Size.fromHeight(48),
                          ),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _uploading || _recording
                              ? null
                              : _pickFromGallery,
                          icon: const Icon(Icons.video_library_outlined),
                          label: const Text('Use gallery video instead'),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_videoFile != null) ...[
                  const SizedBox(height: 12),
                  GlassCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        const Icon(Icons.check_circle_outline, size: 36),
                        const SizedBox(height: 8),
                        Text(
                          _videoFile!.path.split(Platform.pathSeparator).last,
                          style: TextStyle(
                            color: surfaces.textMuted,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        TextButton(
                          onPressed: _uploading
                              ? null
                              : () => setState(() => _videoFile = null),
                          child: const Text('Remove video'),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
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
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: TextStyle(color: scheme.error, fontSize: 13),
                  ),
                ],
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _uploading || _recording || _videoFile == null
                      ? null
                      : _publish,
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
