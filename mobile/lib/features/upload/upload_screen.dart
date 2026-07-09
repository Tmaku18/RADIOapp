import 'dart:io';
import 'package:audio_metadata_reader/audio_metadata_reader.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/api_service.dart';
import '../../core/legal/full_song_radio_opt_in.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/clip_window_sheet.dart';
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
  final _lyricsController = TextEditingController();
  final ApiService _apiService = ApiService();
  File? _audioFile;
  File? _artworkFile;
  bool _isUploading = false;
  double _progress = 0;
  String? _error;
  bool _readyForRotation = false;
  int? _durationSeconds;
  bool _isExplicit = true;
  bool _optInFullSongRadio = false;
  bool _optInDjLivestreams = false;
  bool _optInDjArchivedMixes = false;
  // The Discover clip is required for every track. Default to the first 15s so
  // there's always a valid window; the artist can fine-tune it below.
  double? _discoverClipStart = 0;
  double? _discoverClipEnd = 15;

  static const int _kDiscoverClipMin = 5;
  static const int _kDiscoverClipMax = 15;

  Future<void> _pickAudioFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'],
    );

    if (result != null && result.files.single.path != null) {
      final picked = File(result.files.single.path!);
      setState(() {
        _audioFile = picked;
        _error = null;
        _readyForRotation = false;
      });

      // Best-effort: pre-fill title / artist / artwork from embedded tags.
      _applyAudioMetadata(picked);

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

  String _titleFromFilename(String path) {
    var name = path.split(Platform.pathSeparator).last;
    final dot = name.lastIndexOf('.');
    if (dot > 0) name = name.substring(0, dot);
    return name.replaceAll(RegExp(r'[_]+'), ' ').trim();
  }

  /// Reads embedded tags (ID3 / MP4 / FLAC / Vorbis) to pre-fill the title,
  /// artist, and artwork. Only fills fields the user hasn't set; best-effort
  /// and never blocks or errors the upload.
  void _applyAudioMetadata(File file) {
    String? metaTitle;
    String? metaArtist;
    File? coverFile;
    try {
      final meta = readMetadata(file, getImage: _artworkFile == null);
      metaTitle = meta.title?.trim();
      metaArtist = meta.artist?.trim();
      if (_artworkFile == null && meta.pictures.isNotEmpty) {
        final pic = meta.pictures.first;
        if (pic.bytes.isNotEmpty && pic.bytes.length <= 15 * 1024 * 1024) {
          final ext = pic.mimetype.contains('png')
              ? 'png'
              : (pic.mimetype.contains('webp') ? 'webp' : 'jpg');
          final coverPath = '${Directory.systemTemp.path}'
              '${Platform.pathSeparator}'
              'networx_cover_${DateTime.now().millisecondsSinceEpoch}.$ext';
          coverFile = File(coverPath)..writeAsBytesSync(pic.bytes);
        }
      }
    } catch (_) {
      // Metadata is optional; fall back to the filename for the title.
    }

    final resolvedTitle = (metaTitle != null && metaTitle.isNotEmpty)
        ? metaTitle
        : _titleFromFilename(file.path);

    if (_titleController.text.trim().isEmpty && resolvedTitle.isNotEmpty) {
      _titleController.text = resolvedTitle;
    }
    if (_artistNameController.text.trim().isEmpty &&
        metaArtist != null &&
        metaArtist.isNotEmpty) {
      _artistNameController.text = metaArtist;
    }
    if (coverFile != null) {
      setState(() => _artworkFile = coverFile);
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

  Future<void> _openDiscoverClipWindow() async {
    if (_audioFile == null) return;
    final double start = _discoverClipStart ?? 0;
    final double end = (_discoverClipEnd != null && _discoverClipEnd! > start)
        ? _discoverClipEnd!
        : start + _kDiscoverClipMax;
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ClipWindowSheet(
        audioFilePath: _audioFile!.path,
        displayTitle: _titleController.text.trim().isEmpty
            ? 'Your track'
            : _titleController.text.trim(),
        durationSeconds: _durationSeconds,
        heading: 'Set Discover clip',
        saveLabel: 'Use this window',
        savedMessage: 'Discover window set',
        minLength: _kDiscoverClipMin,
        maxLength: _kDiscoverClipMax,
        initialStart: start,
        initialEnd: end,
        onSave: (s, e) async {
          if (!mounted) return;
          setState(() {
            _discoverClipStart = s;
            _discoverClipEnd = e;
          });
        },
      ),
    );
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
    final discoverValid = _discoverClipStart != null &&
        _discoverClipEnd != null &&
        _discoverClipEnd! > _discoverClipStart! &&
        (_discoverClipEnd! - _discoverClipStart!) >= _kDiscoverClipMin &&
        (_discoverClipEnd! - _discoverClipStart!) <= _kDiscoverClipMax;
    if (!discoverValid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Set a Discover clip window (5–15s) before uploading.',
          ),
        ),
      );
      return;
    }
    if (!_optInFullSongRadio) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Accept the NETWORX Full-Song Radio Opt-In Agreement to submit for rotation.',
          ),
        ),
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
        'isExplicit': _isExplicit,
        'discoverClipStartSeconds': _discoverClipStart,
        'discoverClipEndSeconds': _discoverClipEnd,
        if (_lyricsController.text.trim().isNotEmpty)
          'lyricsPlainText': _lyricsController.text.trim(),
        'optInFullSongRadio': _optInFullSongRadio,
        'optInDjLivestreams': _optInDjLivestreams,
        'optInDjArchivedMixes': _optInDjArchivedMixes,
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
    _lyricsController.dispose();
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
                        style: DimensionTypography.cardTitle(fontSize: 18),
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
                          child: const Text('Back to My Songs'),
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
                    'Upload Song',
                    style: DimensionTypography.cardTitle(fontSize: 20),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Submit your track for review and radio rotation',
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
                  const SizedBox(height: 12),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Mark as explicit'),
                    subtitle: const Text(
                      'Songs are explicit by default. Turn off only if this track has no explicit language/content.',
                    ),
                    value: _isExplicit,
                    onChanged: _isUploading
                        ? null
                        : (value) => setState(() => _isExplicit = value),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _lyricsController,
                    enabled: !_isUploading,
                    minLines: 4,
                    maxLines: 10,
                    decoration: const InputDecoration(
                      labelText: 'Lyrics (optional)',
                      alignLabelWithHint: true,
                      hintText: 'Paste your lyrics, one line per lyric line.',
                      helperText:
                          'Lyrics are auto-synced to your track as closed captions — no timestamps needed.',
                      helperMaxLines: 3,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    FullSongRadioOptIn.title,
                    style: TextStyle(
                      color: surfaces.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Required to submit for NETWORX Radio rotation.',
                    style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _optInFullSongRadio,
                    onChanged: _isUploading
                        ? null
                        : (value) =>
                            setState(() => _optInFullSongRadio = value ?? false),
                    title: Text(
                      FullSongRadioOptIn.primaryAuthorization,
                      style: TextStyle(
                        color: surfaces.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _optInDjLivestreams,
                    onChanged: _isUploading
                        ? null
                        : (value) =>
                            setState(() => _optInDjLivestreams = value ?? false),
                    title: Text(
                      FullSongRadioOptIn.djLivestreams,
                      style: TextStyle(
                        color: surfaces.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _optInDjArchivedMixes,
                    onChanged: _isUploading
                        ? null
                        : (value) => setState(
                            () => _optInDjArchivedMixes = value ?? false,
                          ),
                    title: Text(
                      '${FullSongRadioOptIn.djArchivedMixes} (optional)',
                      style: TextStyle(
                        color: surfaces.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Discover clip (required)',
                      style: TextStyle(
                        color: surfaces.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'A short looping clip (5–15s) shown in the Discover feed. '
                      'Defaults to the first 15s of your track — tap to fine-tune '
                      'the most memorable moment.',
                      style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8, bottom: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_audioFile == null)
                          Text(
                            'Select an audio file first to set the Discover window.',
                            style: TextStyle(
                                color: surfaces.textMuted, fontSize: 12),
                          )
                        else ...[
                          OutlinedButton.icon(
                            onPressed:
                                _isUploading ? null : _openDiscoverClipWindow,
                            icon: const Icon(Icons.swipe_outlined),
                            label: Text(
                              _discoverClipStart != null &&
                                      _discoverClipEnd != null
                                  ? 'Discover window: '
                                      '${clipFmtTime(_discoverClipStart!)} – '
                                      '${clipFmtTime(_discoverClipEnd!)}'
                                  : 'Set Discover clip window',
                            ),
                          ),
                          if (_discoverClipStart != null &&
                              _discoverClipEnd != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'Length: ${clipFmtLen(_discoverClipEnd! - _discoverClipStart!)}',
                                style: TextStyle(
                                    color: surfaces.textMuted, fontSize: 12),
                              ),
                            ),
                        ],
                      ],
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
                      onPressed: _isUploading ||
                              _audioFile == null ||
                              !_optInFullSongRadio
                          ? null
                          : _uploadSong,
                      child: const Text('Submit for Rotation'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
