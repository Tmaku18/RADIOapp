import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Compose screen for sharing an image or short video to the Pro-Networx feed.
/// Mirrors the web `pro-networx/home` "New post" dialog (image or short video +
/// optional caption). On success it pops with the created [ProFeedPost].
class ProCreatePostScreen extends StatefulWidget {
  const ProCreatePostScreen({super.key});

  @override
  State<ProCreatePostScreen> createState() => _ProCreatePostScreenState();
}

class _ProCreatePostScreenState extends State<ProCreatePostScreen> {
  static const int _maxVideoDurationSec = 60;
  static const int _maxFileSizeBytes = 25 * 1024 * 1024;

  final ProNetworxService _service = ProNetworxService();
  final TextEditingController _captionCtrl = TextEditingController();
  final ImagePicker _picker = ImagePicker();

  File? _file;
  bool _isVideo = false;
  bool _uploading = false;
  String? _error;

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2048,
      );
      await _setPicked(picked, isVideo: false);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not pick that image.');
    }
  }

  Future<void> _pickVideo(ImageSource source) async {
    try {
      final picked = await _picker.pickVideo(
        source: source,
        maxDuration: const Duration(seconds: _maxVideoDurationSec),
      );
      await _setPicked(picked, isVideo: true);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not pick that video.');
    }
  }

  Future<void> _setPicked(XFile? picked, {required bool isVideo}) async {
    if (picked == null) return;
    final file = File(picked.path);
    final size = await file.length();
    if (size > _maxFileSizeBytes) {
      if (mounted) setState(() => _error = 'File too large (max 25 MB).');
      return;
    }
    if (!mounted) return;
    setState(() {
      _file = file;
      _isVideo = isVideo;
      _error = null;
    });
  }

  void _showPickSheet() {
    if (_uploading) return;
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
          ],
        ),
      ),
    );
  }

  Future<void> _publish() async {
    final file = _file;
    if (file == null) {
      setState(() => _error = 'Choose an image or short video first.');
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
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Posted to your network')),
      );
      Navigator.pop(context, post);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not publish your post. Please try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
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
            onPressed: _uploading || file == null ? null : _publish,
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
            'Share an image or a short video (max ${_maxVideoDurationSec}s) with the people who follow you.',
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
              child: file == null
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_a_photo_outlined,
                            size: 40, color: surfaces.textMuted),
                        const SizedBox(height: 8),
                        Text(
                          'Tap to add a photo or video',
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                      ],
                    )
                  : _isVideo
                      ? Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.movie_outlined, size: 40),
                            const SizedBox(height: 8),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                file.path.split(Platform.pathSeparator).last,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: surfaces.textMuted, fontSize: 12),
                              ),
                            ),
                          ],
                        )
                      : Image.file(file, fit: BoxFit.cover, width: double.infinity),
            ),
          ),
          if (file != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _uploading ? null : _showPickSheet,
                icon: const Icon(Icons.swap_horiz, size: 18),
                label: const Text('Change'),
              ),
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
            onPressed: _uploading || file == null ? null : _publish,
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
