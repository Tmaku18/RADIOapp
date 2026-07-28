import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/navigation/home_tab_intent.dart';
import '../../core/services/api_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Compose screen for sharing an image, short video, or audio track to the
/// Pro-Networx feed. Audio can ride behind a picture, or post on its own with
/// the Networx Radio logo as cover. On success it pops with the created post.
class ProCreatePostScreen extends StatefulWidget {
  const ProCreatePostScreen({super.key});

  @override
  State<ProCreatePostScreen> createState() => _ProCreatePostScreenState();
}

class _ProCreatePostScreenState extends State<ProCreatePostScreen> {
  /// Must match backend `maxFeedVideoDurationSeconds` / web FEED_VIDEO_MAX_SECONDS.
  static const int _maxVideoDurationSec = 300;
  static const int _maxAudioDurationSec = 600;
  static const int _maxFileSizeBytes = 1024 * 1024 * 1024;
  static const int _maxCoverSizeBytes = 15 * 1024 * 1024;
  static const List<String> _audioExtensions = [
    'mp3',
    'm4a',
    'wav',
    'aac',
    'ogg',
    'flac',
  ];

  final ProNetworxService _service = ProNetworxService();
  final TextEditingController _captionCtrl = TextEditingController();
  final ImagePicker _picker = ImagePicker();

  File? _file;
  FeedMediaKind _kind = FeedMediaKind.image;
  File? _cover;
  bool _uploading = false;
  bool _picking = false;
  String? _error;

  bool get _isAudio => _kind == FeedMediaKind.audio;

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    if (_picking) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2048,
      );
      await _setPicked(picked, kind: FeedMediaKind.image);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not pick that image: $e');
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  /// Cover art shown behind an audio post. Keeps the audio file selected.
  Future<void> _pickCover() async {
    if (_picking) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 2048,
      );
      if (picked == null) return;
      final file = File(picked.path);
      if (await file.length() > _maxCoverSizeBytes) {
        if (mounted) setState(() => _error = 'Cover image is too large.');
        return;
      }
      if (mounted) setState(() => _cover = file);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not pick that image: $e');
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _pickAudio() async {
    if (_picking) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: _audioExtensions,
      );
      final path = result?.files.single.path;
      if (path == null) return;
      await _setPicked(XFile(path), kind: FeedMediaKind.audio);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not pick that audio: $e');
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _pickVideo(ImageSource source) async {
    if (_picking) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final picked = await _picker.pickVideo(
        source: source,
        // Only cap live recording. Passing maxDuration for a library pick makes
        // iOS force a trim/export that can fail before returning a file.
        maxDuration: source == ImageSource.camera
            ? const Duration(seconds: _maxVideoDurationSec)
            : null,
      );
      await _setPicked(picked, kind: FeedMediaKind.video);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not pick that video: $e');
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  /// Reads container duration. Works for audio too — `video_player` reports
  /// duration for audio-only tracks even though there are no frames to show.
  Future<Duration?> _readMediaDuration(File file) async {
    final controller = VideoPlayerController.file(file);
    try {
      await controller.initialize().timeout(const Duration(seconds: 10));
      final duration = controller.value.duration;
      return duration > Duration.zero ? duration : null;
    } catch (_) {
      // Unreadable metadata must not block the pick — the API validates too.
      return null;
    } finally {
      await controller.dispose();
    }
  }

  Future<void> _setPicked(XFile? picked, {required FeedMediaKind kind}) async {
    if (picked == null) return;
    final file = File(picked.path);
    final size = await file.length();
    if (size > _maxFileSizeBytes) {
      final mb = (size / (1024 * 1024)).toStringAsFixed(0);
      if (mounted) {
        setState(() => _error = 'File too large ($mb MB). Max is 1 GB.');
      }
      return;
    }
    if (kind != FeedMediaKind.image) {
      // Gallery picks ignore image_picker maxDuration on iOS — enforce here.
      final maxSeconds = kind == FeedMediaKind.audio
          ? _maxAudioDurationSec
          : _maxVideoDurationSec;
      final duration = await _readMediaDuration(file);
      if (duration != null &&
          duration.inMilliseconds > (maxSeconds + 1) * 1000) {
        final mins = (duration.inSeconds / 60).toStringAsFixed(1);
        final capMins = maxSeconds ~/ 60;
        if (mounted) {
          setState(() => _error =
              '${kind == FeedMediaKind.audio ? 'Audio' : 'Video'} is $mins minutes. '
              'Max length is $capMins minutes.');
        }
        return;
      }
    }
    if (!mounted) return;
    setState(() {
      _file = file;
      _kind = kind;
      if (kind != FeedMediaKind.audio) _cover = null;
      _error = null;
    });
  }

  void _showPickSheet() {
    if (_uploading || _picking) return;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take photo'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose photo'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined),
              title: const Text('Record video'),
              onTap: () {
                Navigator.pop(ctx);
                _pickVideo(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.video_library_outlined),
              title: const Text('Choose video'),
              onTap: () {
                Navigator.pop(ctx);
                _pickVideo(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.library_music_outlined),
              title: const Text('Choose audio'),
              subtitle: const Text('Add a picture after, or post audio alone'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAudio();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _publish() async {
    final file = _file;
    if (file == null) {
      setState(() => _error = 'Choose a photo, video, or audio track first.');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final caption = _captionCtrl.text.trim();
      final post = await _service.createFeedPost(
        file,
        caption: caption.isEmpty ? null : caption,
        kind: _kind,
        cover: _isAudio ? _cover : null,
      );
      if (!mounted) return;
      SocialFeedRefresh.request();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Posted to Feed')),
      );
      Navigator.pop(context, post);
    } catch (e) {
      if (!mounted) return;
      final raw = e is ApiException ? e.message : e.toString();
      setState(() {
        if (raw.contains('Video length') ||
            raw.contains('Audio length') ||
            raw.contains('Unsupported file') ||
            raw.contains('Unsupported cover') ||
            raw.contains('File size') ||
            raw.contains('No file')) {
          _error = raw;
        } else if (raw.contains('413')) {
          _error =
              'Upload failed: file too large for the network path. Try a shorter take.';
        } else {
          _error = 'Could not publish your post. Please try again.';
        }
      });
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  /// Audio posts preview as their cover art — the picture the user attached, or
  /// the Networx Radio logo that the API will fall back to.
  Widget _buildAudioPreview(File file, NetworxSurfaces surfaces) {
    final cover = _cover;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (cover != null)
          Image.file(cover, fit: BoxFit.cover)
        else
          Padding(
            padding: const EdgeInsets.all(24),
            child: Image.asset(BrandAssets.logoCyanAsset, fit: BoxFit.contain),
          ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            color: Colors.black54,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.music_note, size: 18, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    file.path.split(Platform.pathSeparator).last,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final file = _file;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New post'),
        actions: [
          TextButton(
            onPressed: _uploading || _picking || file == null ? null : _publish,
            child: _uploading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Post'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Share a photo, a video (max 5 min), or an audio track (max 10 min) '
            'with the people who follow you.',
            style: TextStyle(color: surfaces.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _showPickSheet,
            child: Container(
              height: 220,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: surfaces.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: _picking
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(
                          height: 28,
                          width: 28,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Preparing media…',
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                      ],
                    )
                  : file == null
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_a_photo_outlined,
                            size: 40, color: surfaces.textMuted),
                        const SizedBox(height: 8),
                        Text(
                          'Tap to add a photo, video, or audio',
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                      ],
                    )
                  : _isAudio
                      ? _buildAudioPreview(file, surfaces)
                      : _kind == FeedMediaKind.video
                          ? Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.movie_outlined, size: 40),
                                const SizedBox(height: 8),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16),
                                  child: Text(
                                    file.path
                                        .split(Platform.pathSeparator)
                                        .last,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        color: surfaces.textMuted,
                                        fontSize: 12),
                                  ),
                                ),
                              ],
                            )
                          : Image.file(file,
                              fit: BoxFit.cover, width: double.infinity),
            ),
          ),
          if (file != null)
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (_isAudio)
                  TextButton.icon(
                    onPressed: _uploading || _picking ? null : _pickCover,
                    icon: const Icon(Icons.image_outlined, size: 18),
                    label: Text(_cover == null ? 'Add picture' : 'Change picture'),
                  ),
                if (_isAudio && _cover != null)
                  TextButton.icon(
                    onPressed: _uploading || _picking
                        ? null
                        : () => setState(() => _cover = null),
                    icon: const Icon(Icons.close, size: 18),
                    label: const Text('Remove'),
                  ),
                TextButton.icon(
                  onPressed: _uploading || _picking ? null : _showPickSheet,
                  icon: const Icon(Icons.swap_horiz, size: 18),
                  label: const Text('Change'),
                ),
              ],
            ),
          const SizedBox(height: 8),
          TextField(
            controller: _captionCtrl,
            decoration: const InputDecoration(
              hintText: 'Write a caption (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
            maxLength: 280,
            enabled: !_uploading,
          ),
          if (_error != null) ...[
            const SizedBox(height: 4),
            Text(
              _error!,
              style: TextStyle(color: scheme.error, fontSize: 13),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _uploading || _picking || file == null ? null : _publish,
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
}
