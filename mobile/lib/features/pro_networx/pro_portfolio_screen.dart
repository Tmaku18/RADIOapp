import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/services/pro_networx_service.dart';

const int _kMaxPortfolioBytes = 25 * 1024 * 1024; // 25MB

/// Lets a Catalyst (service provider) manage their "Featured work" portfolio:
/// upload audio, image, or video samples (or link external media), and remove
/// items. Mirrors the web portfolio editor.
class ProPortfolioScreen extends StatefulWidget {
  const ProPortfolioScreen({super.key});

  @override
  State<ProPortfolioScreen> createState() => _ProPortfolioScreenState();
}

class _ProPortfolioScreenState extends State<ProPortfolioScreen> {
  final ProNetworxService _service = ProNetworxService();
  bool _loading = true;
  String? _loadError;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final list = await _service.getMyPortfolio();
      if (!mounted) return;
      setState(() => _items = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError =
          'Portfolio is for Catalyst (service provider) accounts. Switch to a Catalyst account to add work samples.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openAdd() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _AddPortfolioSheet(),
    );
    if (added == true) _refresh();
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final id = (item['id'] ?? '').toString();
    if (id.isEmpty) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete this item?'),
        content: const Text('This removes the sample from your portfolio.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _service.deletePortfolioItem(id);
      _refresh();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not delete the item.')),
      );
    }
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'audio':
        return Icons.music_note;
      case 'video':
        return Icons.movie_outlined;
      default:
        return Icons.image_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Portfolio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Add work sample',
            onPressed: _openAdd,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _loadError!,
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : _items.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'No work samples yet. Add audio, images, or video '
                              'to show clients what you do.',
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: _openAdd,
                              icon: const Icon(Icons.add),
                              label: const Text('Add work sample'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _items.length,
                      itemBuilder: (_, i) {
                        final item = _items[i];
                        final type = (item['type'] ?? 'image').toString();
                        final fileUrl = (item['fileUrl'] ?? '').toString();
                        final title = (item['title'] ?? '').toString();
                        final description =
                            (item['description'] ?? '').toString();
                        return Card(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          child: ListTile(
                            leading: type == 'image' && fileUrl.isNotEmpty
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(6),
                                    child: CachedNetworkImage(
                                      imageUrl: fileUrl,
                                      width: 48,
                                      height: 48,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) =>
                                          const Icon(Icons.broken_image_outlined),
                                    ),
                                  )
                                : CircleAvatar(
                                    child: Icon(_iconForType(type)),
                                  ),
                            title: Text(
                              title.isNotEmpty ? title : type,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(
                              description.isNotEmpty ? description : type,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _delete(item),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}

class _AddPortfolioSheet extends StatefulWidget {
  const _AddPortfolioSheet();

  @override
  State<_AddPortfolioSheet> createState() => _AddPortfolioSheetState();
}

class _AddPortfolioSheetState extends State<_AddPortfolioSheet> {
  final ProNetworxService _service = ProNetworxService();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _link = TextEditingController();
  String _type = 'audio';
  File? _file;
  String? _fileName;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _link.dispose();
    super.dispose();
  }

  List<String> _extensionsForType() {
    switch (_type) {
      case 'audio':
        return ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm'];
      case 'video':
        return ['mp4', 'webm'];
      default:
        return ['jpg', 'jpeg', 'png', 'webp'];
    }
  }

  String _contentTypeFor(String path) {
    final ext = path.split('.').last.toLowerCase();
    if (_type == 'audio') {
      switch (ext) {
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
          return 'audio/mpeg';
      }
    }
    if (_type == 'video') {
      return ext == 'webm' ? 'video/webm' : 'video/mp4';
    }
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: _extensionsForType(),
    );
    final path = result?.files.single.path;
    if (path != null) {
      setState(() {
        _file = File(path);
        _fileName = path.split('/').last;
        _error = null;
      });
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      String fileUrl = _link.text.trim();
      if (_file != null) {
        final size = await _file!.length();
        if (size > _kMaxPortfolioBytes) {
          throw Exception(
              'File is too large. Audio, images, and video must be 25MB or smaller.');
        }
        fileUrl = await _service.uploadPortfolioFile(
          _file!,
          _contentTypeFor(_file!.path),
        );
      }
      if (fileUrl.isEmpty) {
        throw Exception('Choose a file to upload or paste a link.');
      }
      await _service.addPortfolioItem(
        type: _type,
        fileUrl: fileUrl,
        title: _title.text,
        description: _description.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String get _uploadHint {
    switch (_type) {
      case 'audio':
        return 'Upload an audio sample (MP3, WAV, M4A, AAC, OGG, FLAC) — max 25MB.';
      case 'video':
        return 'Upload a video sample (MP4, WebM) — max 25MB.';
      default:
        return 'Upload an image (JPEG, PNG, WebP) — max 25MB.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Add work sample',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: const [
                DropdownMenuItem(value: 'audio', child: Text('Audio')),
                DropdownMenuItem(value: 'image', child: Text('Image')),
                DropdownMenuItem(value: 'video', child: Text('Video')),
              ],
              onChanged: (v) => setState(() {
                _type = v ?? 'audio';
                _file = null;
                _fileName = null;
              }),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickFile,
              icon: const Icon(Icons.upload_file),
              label: Text(_fileName ?? 'Choose file'),
            ),
            const SizedBox(height: 6),
            Text(
              _uploadHint,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _link,
              decoration: const InputDecoration(
                labelText: 'Or paste a link',
                hintText: 'https://…',
              ),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _title,
              maxLength: 120,
              decoration: const InputDecoration(labelText: 'Title (optional)'),
            ),
            TextField(
              controller: _description,
              maxLines: 3,
              decoration:
                  const InputDecoration(labelText: 'Description (optional)'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Adding…' : 'Add to portfolio'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
