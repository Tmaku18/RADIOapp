import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/api_service.dart';
import '../../core/theme/networx_extensions.dart';
import 'package:just_audio/just_audio.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _artistNameController = TextEditingController();
  final ApiService _apiService = ApiService();
  File? _audioFile;
  File? _artworkFile;
  bool _isUploading = false;
  double _progress = 0;
  String? _error;
  bool _readyForRotation = false;
  int? _durationSeconds;

  Future<void> _pickAudioFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'],
    );

    if (result != null && result.files.single.path != null) {
      setState(() {
        _audioFile = File(result.files.single.path!);
        _error = null;
        _readyForRotation = false;
      });

      // Best-effort duration extraction.
      final p = AudioPlayer();
      try {
        await p.setFilePath(_audioFile!.path);
        final d = p.duration;
        if (!mounted) return;
        setState(() => _durationSeconds = d?.inSeconds);
      } catch (_) {
        // ignore
      } finally {
        await p.dispose();
      }
    }
  }

  Future<void> _pickArtworkFile() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _artworkFile = File(pickedFile.path);
        _error = null;
        _readyForRotation = false;
      });
    }
  }

  String _contentTypeFor(String path, {required bool isAudio}) {
    final ext = path.toLowerCase().split('.').last;
    if (isAudio) {
      switch (ext) {
        case 'mp3':
          return 'audio/mpeg';
        case 'wav':
          return 'audio/wav';
        case 'm4a':
          return 'audio/mp4';
        case 'aac':
          return 'audio/aac';
        case 'ogg':
          return 'audio/ogg';
        case 'flac':
          return 'audio/flac';
        case 'webm':
          return 'audio/webm';
        default:
          return 'application/octet-stream';
      }
    }
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  Future<Map<String, dynamic>> _getUploadUrl({
    required String filename,
    required String contentType,
    required String bucket,
  }) async {
    final res = await _apiService.post('songs/upload-url', {
      'filename': filename,
      'contentType': contentType,
      'bucket': bucket,
    });
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to get signed upload URL');
  }

  Future<String> _uploadToSignedUrl({
    required File file,
    required String bucket, // 'songs' | 'artwork'
    required bool isAudio,
  }) async {
    final filename = file.path.split('/').last;
    final contentType = _contentTypeFor(file.path, isAudio: isAudio);
    final data = await _getUploadUrl(
      filename: filename,
      contentType: contentType,
      bucket: bucket,
    );
    final signedUrl = (data['signedUrl'] ?? data['signed_url']).toString();
    final path = (data['path'] ?? '').toString();
    if (signedUrl.isEmpty || path.isEmpty) {
      throw Exception('Signed URL response missing fields');
    }

    final bytes = await file.readAsBytes();
    final resp = await http.put(
      Uri.parse(signedUrl),
      headers: {'Content-Type': contentType},
      body: bytes,
    );
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw Exception('Upload failed (${resp.statusCode})');
    }
    return path;
  }

  Future<void> _uploadSong() async {
    if (!_formKey.currentState!.validate()) return;
    if (_audioFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select an audio file')),
      );
      return;
    }

    setState(() {
      _isUploading = true;
      _progress = 0.05;
      _error = null;
    });

    try {
      final audioPath = await _uploadToSignedUrl(
        file: _audioFile!,
        bucket: 'songs',
        isAudio: true,
      );
      setState(() => _progress = 0.55);

      String? artworkPath;
      if (_artworkFile != null) {
        artworkPath = await _uploadToSignedUrl(
          file: _artworkFile!,
          bucket: 'artwork',
          isAudio: false,
        );
      }
      setState(() => _progress = 0.8);

      await _apiService.post('songs', {
        'title': _titleController.text.trim(),
        'artistName': _artistNameController.text.trim(),
        'audioPath': audioPath,
        if (artworkPath != null) 'artworkPath': artworkPath,
        if (_durationSeconds != null) 'durationSeconds': _durationSeconds,
      });

      if (!mounted) return;
      setState(() {
        _progress = 1.0;
        _readyForRotation = true;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _artistNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upload'),
      ),
      body: _readyForRotation
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .colorScheme
                              .primary
                              .withValues(alpha: 0.14),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.check, size: 34),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Ready for Rotation',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontFamily: 'Lora'),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Your track is in the queue. We’ll review it and add it to the rotation soon.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: surfaces.textSecondary),
                      ),
                      const SizedBox(height: 16),
                      if (_artworkFile != null)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(
                            _artworkFile!,
                            width: 140,
                            height: 140,
                            fit: BoxFit.cover,
                          ),
                        ),
                      const SizedBox(height: 12),
                      Text(_titleController.text.trim(),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(_artistNameController.text.trim(),
                          style: TextStyle(color: surfaces.textMuted)),
                      const Spacer(),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Back to Studio'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Add to the Rotation',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontFamily: 'Lora'),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Calm, minimal steps. High-quality preview. No drama.',
                    style: TextStyle(color: surfaces.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Text(
                        _error!,
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      ),
                    ),
                  TextFormField(
                    controller: _titleController,
                    decoration: const InputDecoration(labelText: 'Song Title *'),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter a song title';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _artistNameController,
                    decoration:
                        const InputDecoration(labelText: 'Artist Name *'),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter an artist name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _isUploading ? null : _pickAudioFile,
                    icon: const Icon(Icons.audio_file),
                    label: Text(_audioFile == null
                        ? 'Select audio'
                        : _audioFile!.path.split('/').last),
                  ),
                  if (_durationSeconds != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        'Duration: ${_durationSeconds}s',
                        style: TextStyle(color: surfaces.textMuted),
                      ),
                    ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: _isUploading ? null : _pickArtworkFile,
                    icon: const Icon(Icons.image_outlined),
                    label: Text(_artworkFile == null
                        ? 'Add artwork (optional)'
                        : _artworkFile!.path.split('/').last),
                  ),
                  if (_artworkFile != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(
                          _artworkFile!,
                          height: 180,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  if (_isUploading)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        LinearProgressIndicator(value: _progress),
                        const SizedBox(height: 8),
                        Text(
                          'Uploading… ${(100 * _progress).round()}%',
                          style: TextStyle(color: surfaces.textMuted),
                        ),
                        const SizedBox(height: 10),
                      ],
                    ),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed:
                          _isUploading || _audioFile == null ? null : _uploadSong,
                      child: const Text('Submit for Rotation'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
