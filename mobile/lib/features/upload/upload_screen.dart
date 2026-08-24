import 'dart:io';
import 'package:audio_metadata_reader/audio_metadata_reader.dart';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';

import '../../core/constants/song_price_tiers.dart';
import '../../core/data/station_towers.dart';
import '../../core/services/albums_service.dart';
import '../../core/services/api_service.dart' show ApiException, ApiService;
import '../../core/legal/full_song_radio_opt_in.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/clip_window_sheet.dart';
import '../../widgets/station_assignment_field.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _artistNameController = TextEditingController();
  final _cityController = TextEditingController();
  final _lyricsController = TextEditingController();
  /// Constrained to [kSongPriceTiersCents] so every price maps to a store SKU.
  int _priceCents = kDefaultSongPriceCents;
  final ApiService _apiService = ApiService();
  final AlbumsService _albumsService = AlbumsService();
  List<ArtistAlbum> _albums = const [];
  String? _albumId;
  File? _audioFile;
  File? _artworkFile;
  File? _discoverBackgroundFile;
  bool _isUploading = false;
  double _progress = 0;
  String? _error;
  bool _readyForRotation = false;
  int? _durationSeconds;
  bool _isExplicit = true;
  bool _optInFullSongRadio = false;
  bool _optInDjLivestreams = false;
  bool _optInDjArchivedMixes = false;
  /// `song` (radio + 30s sample) or `beat` (marketplace, full listen-before-buy).
  String _productKind = 'song';
  bool _forSale = true;
  bool _beatArgsApplied = false;
  String? _originState;
  final Set<String> _stationIds = {};

  bool get _isBeat => _productKind == 'beat';

  // Discover clip (5–15s) — required.
  double? _discoverClipStart = 0;
  double? _discoverClipEnd = 15;
  // Sample / preview clip (5–30s) — required (web parity).
  double? _sampleStart = 0;
  double? _sampleEnd = 30;

  static const int _kDiscoverClipMin = 5;
  static const int _kDiscoverClipMax = 15;
  static const int _kSampleMin = 5;
  static const int _kSampleMax = 30;
  static const int _kMaxAudioBytes = 100 * 1024 * 1024;
  static const int _kMaxImageBytes = 15 * 1024 * 1024;

  @override
  void initState() {
    super.initState();
    _loadAlbums();
  }

  Future<void> _loadAlbums() async {
    try {
      final albums = await _albumsService.listMine();
      if (!mounted) return;
      setState(() => _albums = albums);
    } catch (_) {
      // Non-fatal: upload still works as a single.
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_beatArgsApplied) return;
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map && args['productKind']?.toString() == 'beat') {
      _beatArgsApplied = true;
      _productKind = 'beat';
      _forSale = true;
      _priceCents = kDefaultBeatPriceCents;
      _stationIds
        ..clear()
        ..add('us-beats');
      _optInFullSongRadio = false;
    }
  }

  Future<void> _pickAudioFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'],
    );

    if (result != null && result.files.single.path != null) {
      final picked = File(result.files.single.path!);
      final size = await picked.length();
      if (size > _kMaxAudioBytes) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Audio must be 100MB or smaller.')),
        );
        return;
      }
      setState(() {
        _audioFile = picked;
        _error = null;
        _readyForRotation = false;
        _sampleStart = 0;
        _sampleEnd = 30;
        _discoverClipStart = 0;
        _discoverClipEnd = 15;
      });

      // Best-effort: pre-fill title / artist / artwork from embedded tags.
      _applyAudioMetadata(picked);

      // Best-effort duration extraction.
      final p = AudioPlayer();
      try {
        await p.setFilePath(_audioFile!.path);
        final d = p.duration;
        if (!mounted) return;
        final secs = d?.inSeconds;
        setState(() {
          _durationSeconds = secs;
          if (secs != null && secs > 0) {
            _sampleEnd = secs < _kSampleMax ? secs.toDouble() : _kSampleMax.toDouble();
            _discoverClipEnd =
                secs < _kDiscoverClipMax ? secs.toDouble() : _kDiscoverClipMax.toDouble();
          }
        });
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
      final file = File(pickedFile.path);
      if (await file.length() > _kMaxImageBytes) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Artwork must be 15MB or smaller.')),
        );
        return;
      }
      setState(() {
        _artworkFile = file;
        _error = null;
        _readyForRotation = false;
      });
    }
  }

  Future<void> _pickDiscoverBackground() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile == null) return;
    final file = File(pickedFile.path);
    if (await file.length() > _kMaxImageBytes) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Discover background must be 15MB or smaller.'),
        ),
      );
      return;
    }
    setState(() {
      _discoverBackgroundFile = file;
      _error = null;
    });
  }

  Future<void> _openSampleClipWindow() async {
    if (_audioFile == null) return;
    final double start = _sampleStart ?? 0;
    final double end = (_sampleEnd != null && _sampleEnd! > start)
        ? _sampleEnd!
        : start + _kSampleMax;
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
        heading: 'Set preview sample',
        saveLabel: 'Use this sample',
        savedMessage: 'Sample window set',
        minLength: _kSampleMin,
        maxLength: _kSampleMax,
        initialStart: start,
        initialEnd: end,
        onSave: (s, e) async {
          if (!mounted) return;
          setState(() {
            _sampleStart = s;
            _sampleEnd = e;
          });
        },
      ),
    );
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
    if (_cityController.text.trim().isEmpty ||
        (_originState == null || _originState!.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('City and state are required.')),
      );
      return;
    }
    if (_stationIds.isEmpty) {
      if (_isBeat) {
        _stationIds.add('us-beats');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Select at least one station / category.'),
          ),
        );
        return;
      }
    }
    if (!_isBeat) {
      final sampleValid = _sampleStart != null &&
          _sampleEnd != null &&
          _sampleEnd! > _sampleStart! &&
          (_sampleEnd! - _sampleStart!) >= _kSampleMin &&
          (_sampleEnd! - _sampleStart!) <= _kSampleMax;
      if (!sampleValid) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Set a sample preview window (5–30s) before uploading.'),
          ),
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
      setState(() => _progress = 0.72);

      String? discoverBackgroundPath;
      if (_discoverBackgroundFile != null) {
        discoverBackgroundPath = await _uploadToSignedUrl(
          file: _discoverBackgroundFile!,
          bucket: 'artwork',
          isAudio: false,
        );
      }
      setState(() => _progress = 0.88);

      final stations = _stationIds.toList();
      // Hit Nest/Railway directly — Vercel’s /api/songs proxy can time out or
      // strip useful 400 bodies while the server creates the song record.
      final priceCents = _priceCents;
      await _apiService.post(
        'songs',
        {
          'title': _titleController.text.trim(),
          'artistName': _artistNameController.text.trim(),
          'artistOriginCity': _cityController.text.trim(),
          'artistOriginState': _originState,
          'stationId': stations.first,
          'stationIds': stations,
          'audioPath': audioPath,
          if (artworkPath != null) 'artworkPath': artworkPath,
          if (!_isBeat && discoverBackgroundPath != null)
            'discoverBackgroundPath': discoverBackgroundPath,
          if (_durationSeconds != null) 'durationSeconds': _durationSeconds,
          'isExplicit': _isExplicit,
          'productKind': _productKind,
          'forSale': _forSale,
          'priceCents': priceCents,
          if (!_isBeat) ...{
            'sampleStartSeconds': _sampleStart,
            'sampleEndSeconds': _sampleEnd,
            'discoverClipStartSeconds': _discoverClipStart,
            'discoverClipEndSeconds': _discoverClipEnd,
          },
          if (!_isBeat && _lyricsController.text.trim().isNotEmpty)
            'lyricsPlainText': _lyricsController.text.trim(),
          'optInFullSongRadio': _isBeat ? false : _optInFullSongRadio,
          'optInDjLivestreams': _isBeat ? false : _optInDjLivestreams,
          'optInDjArchivedMixes': _isBeat ? false : _optInDjArchivedMixes,
          if (!_isBeat) 'albumId': ?_albumId,
        },
        preferDirectBackend: true,
        timeout: const Duration(seconds: 90),
      );

      if (!mounted) return;
      setState(() {
        _progress = 1.0;
        _readyForRotation = true;
      });
    } catch (e) {
      if (mounted) {
        final message = e is ApiException
            ? (e.message.trim().isNotEmpty
                ? e.message
                : 'Upload failed (${e.statusCode})')
            : e.toString();
        setState(() => _error = message);
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
    _cityController.dispose();
    _lyricsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return DimensionScreenShell(
      title: _isBeat ? 'Upload Beat' : 'Upload Music',
      showNeonLine: true,
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
                    _isBeat ? 'Upload Beat for Sale' : 'Upload Song',
                    style: DimensionTypography.cardTitle(fontSize: 20),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _isBeat
                        ? 'List a full beat buyers can preview completely before purchasing'
                        : 'Submit your track for review and radio rotation',
                    style: TextStyle(color: surfaces.textSecondary),
                  ),
                  const SizedBox(height: 14),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'song', label: Text('Song'), icon: Icon(Icons.music_note)),
                      ButtonSegment(value: 'beat', label: Text('Beat'), icon: Icon(Icons.graphic_eq)),
                    ],
                    selected: {_productKind},
                    onSelectionChanged: _isUploading
                        ? null
                        : (v) {
                            setState(() {
                              _productKind = v.first;
                              if (_isBeat) {
                                _stationIds
                                  ..clear()
                                  ..add('us-beats');
                                _optInFullSongRadio = false;
                                _forSale = true;
                                _priceCents = kDefaultBeatPriceCents;
                              } else {
                                _priceCents = kDefaultSongPriceCents;
                              }
                            });
                          },
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
                    decoration: InputDecoration(
                      labelText: _isBeat ? 'Beat Title *' : 'Song Title *',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return _isBeat
                            ? 'Please enter a beat title'
                            : 'Please enter a song title';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    key: ValueKey('price-$_productKind-$_priceCents'),
                    initialValue: _priceCents,
                    decoration: InputDecoration(
                      labelText: 'Sale price (USD) *',
                      helperText: _isBeat
                          ? 'Buyers can listen to the full beat before checkout'
                          : 'Buyers hear your 30s sample before buying the full track',
                    ),
                    items: [
                      for (final cents in kSongPriceTiersCents)
                        DropdownMenuItem(
                          value: cents,
                          child: Text(formatSongPrice(cents)),
                        ),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _priceCents = value);
                    },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('List for sale'),
                    subtitle: Text(
                      _isBeat
                          ? 'Shown in Beat Marketplace and on your profile'
                          : 'Shown on your profile so fans can buy the full song',
                    ),
                    value: _forSale,
                    onChanged: _isUploading
                        ? null
                        : (v) => setState(() => _forSale = v),
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
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _cityController,
                    decoration: const InputDecoration(
                      labelText: 'City *',
                      hintText: 'Where are you based?',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'City is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _originState,
                    decoration: const InputDecoration(labelText: 'State *'),
                    items: kUsStateCodes
                        .map(
                          (s) => DropdownMenuItem(value: s, child: Text(s)),
                        )
                        .toList(),
                    onChanged: _isUploading
                        ? null
                        : (v) => setState(() => _originState = v),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'State is required' : null,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Stations / Genres *',
                    style: TextStyle(
                      color: surfaces.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  StationAssignmentField(
                    value: _stationIds.toList(),
                    enabled: !_isUploading,
                    onChanged: (next) => setState(() {
                      _stationIds
                        ..clear()
                        ..addAll(next);
                    }),
                  ),
                  if (!_isBeat) ...[
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String?>(
                      initialValue: _albumId,
                      decoration: const InputDecoration(
                        labelText: 'Album (optional)',
                        helperText:
                            'Create albums on your artist page, then assign here.',
                      ),
                      items: [
                        const DropdownMenuItem<String?>(
                          value: null,
                          child: Text('Single (no album)'),
                        ),
                        ..._albums.map(
                          (a) => DropdownMenuItem<String?>(
                            value: a.id,
                            child: Text(a.title),
                          ),
                        ),
                      ],
                      onChanged: _isUploading
                          ? null
                          : (v) => setState(() => _albumId = v),
                    ),
                  ],
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _isUploading ? null : _pickAudioFile,
                    icon: const Icon(Icons.audio_file),
                    label: Text(_audioFile == null
                        ? 'Select audio * (max 100MB)'
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
                  if (_isBeat) ...[
                    const SizedBox(height: 14),
                    GlassCard(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        'Buyers can play this entire beat before purchasing. '
                        'Listed in Pro-Networx → Beats and on your artist profile '
                        'as BEAT FOR SALE (not a 30s song sample).',
                        style: TextStyle(
                          color: surfaces.textSecondary,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                  if (!_isBeat) ...[
                  const SizedBox(height: 14),
                  Text(
                    'Sample preview (required)',
                    style: TextStyle(
                      color: surfaces.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Listener-facing preview clip (5–30s) used when someone '
                    'taps play on your song card.',
                    style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  if (_audioFile == null)
                    Text(
                      'Select an audio file first to set the sample window.',
                      style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                    )
                  else
                    OutlinedButton.icon(
                      onPressed: _isUploading ? null : _openSampleClipWindow,
                      icon: const Icon(Icons.hearing_outlined),
                      label: Text(
                        _sampleStart != null && _sampleEnd != null
                            ? 'Sample: ${clipFmtTime(_sampleStart!)} – '
                                '${clipFmtTime(_sampleEnd!)} '
                                '(${clipFmtLen(_sampleEnd! - _sampleStart!)})'
                            : 'Set sample window',
                      ),
                    ),
                  const SizedBox(height: 14),
                  Text(
                    'Discover clip (required)',
                    style: TextStyle(
                      color: surfaces.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'A short looping clip (5–15s) shown in the Discover feed.',
                    style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  if (_audioFile == null)
                    Text(
                      'Select an audio file first to set the Discover window.',
                      style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                    )
                  else
                    OutlinedButton.icon(
                      onPressed: _isUploading ? null : _openDiscoverClipWindow,
                      icon: const Icon(Icons.swipe_outlined),
                      label: Text(
                        _discoverClipStart != null && _discoverClipEnd != null
                            ? 'Discover: ${clipFmtTime(_discoverClipStart!)} – '
                                '${clipFmtTime(_discoverClipEnd!)} '
                                '(${clipFmtLen(_discoverClipEnd! - _discoverClipStart!)})'
                            : 'Set Discover clip window',
                      ),
                    ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _isUploading ? null : _pickDiscoverBackground,
                    icon: const Icon(Icons.wallpaper_outlined),
                    label: Text(
                      _discoverBackgroundFile == null
                          ? 'Discover background image (optional)'
                          : _discoverBackgroundFile!.path.split('/').last,
                    ),
                  ),
                  if (_discoverBackgroundFile != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(
                          _discoverBackgroundFile!,
                          height: 120,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Mark as explicit'),
                    subtitle: Text(
                      _isBeat
                          ? 'Beats are marked explicit by default. Turn off if this beat has no explicit content.'
                          : 'Songs are explicit by default. Turn off only if this track has no explicit language/content.',
                    ),
                    value: _isExplicit,
                    onChanged: _isUploading
                        ? null
                        : (value) => setState(() => _isExplicit = value),
                  ),
                  if (!_isBeat) ...[
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
                    'Required. Covers live radio, Pro-Radio on-demand streaming, and DJ livestreams.',
                    style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _optInFullSongRadio,
                    onChanged: _isUploading
                        ? null
                        : (value) {
                            final accepted = value ?? false;
                            setState(() {
                              _optInFullSongRadio = accepted;
                              // All-rights acceptance includes DJ livestreams.
                              if (accepted) _optInDjLivestreams = true;
                            });
                          },
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
                  ],
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
                              (!_isBeat && !_optInFullSongRadio)
                          ? null
                          : _uploadSong,
                      child: Text(
                        _isBeat ? 'List Beat for Sale' : 'Submit for Rotation',
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
