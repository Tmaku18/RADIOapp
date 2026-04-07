import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../../core/auth/auth_service.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Screen for creating a short (max 15 s) synced video clip for the Discover feed.
/// Gated to service_provider and admin roles (Catalyst posting).
class DiscoverCreateVideoScreen extends StatefulWidget {
  const DiscoverCreateVideoScreen({super.key});

  @override
  State<DiscoverCreateVideoScreen> createState() =>
      _DiscoverCreateVideoScreenState();
}

class _DiscoverCreateVideoScreenState extends State<DiscoverCreateVideoScreen> {
  static const int _maxDurationSec = 15;
  static const int _maxFileSizeBytes = 15 * 1024 * 1024;

  final ApiService _api = ApiService();
  final _captionCtrl = TextEditingController();
  File? _videoFile;
  bool _uploading = false;
  String? _error;
  String? _role;
  bool _loadingRole = true;

  @override
  void initState() {
    super.initState();
    _loadRole();
  }

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRole() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final profile = await auth.getUserProfile();
      if (mounted) {
        setState(() {
          _role = profile?.role;
          _loadingRole = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingRole = false);
    }
  }

  bool get _canPost => _role == 'service_provider' || _role == 'admin';

  Future<void> _recordVideo() async {
    final picked = await ImagePicker().pickVideo(
      source: ImageSource.camera,
      maxDuration: const Duration(seconds: _maxDurationSec),
    );
    await _handlePicked(picked);
  }

  Future<void> _pickFromGallery() async {
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
    if (_videoFile == null) {
      setState(() => _error = 'Please record or select a video first');
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

    if (_loadingRole) {
      return Scaffold(
        appBar: AppBar(title: const Text('Create Video')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (!_canPost) {
      return Scaffold(
        appBar: AppBar(title: const Text('Create Video')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.videocam_off, size: 48, color: surfaces.textMuted),
                const SizedBox(height: 12),
                Text(
                  'Only Catalysts and admins can create video posts.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: surfaces.textSecondary),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Create Video')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Record or select a short video (max ${_maxDurationSec}s)',
            style: TextStyle(color: surfaces.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : _recordVideo,
                  icon: const Icon(Icons.videocam),
                  label: const Text('Record'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _uploading ? null : _pickFromGallery,
                  icon: const Icon(Icons.video_library_outlined),
                  label: const Text('Gallery'),
                ),
              ),
            ],
          ),
          if (_videoFile != null) ...[
            const SizedBox(height: 16),
            Container(
              height: 160,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.surfaceContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle_outline, size: 36),
                  const SizedBox(height: 8),
                  Text(
                    _videoFile!.path.split(Platform.pathSeparator).last,
                    style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: _uploading
                        ? null
                        : () => setState(() => _videoFile = null),
                    child: const Text('Remove'),
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
            enabled: !_uploading,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: scheme.error, fontSize: 13),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _uploading ? null : _publish,
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
