import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/api_service.dart';

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

  Future<void> _pickAudioFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav'],
    );

    if (result != null && result.files.single.path != null) {
      setState(() {
        _audioFile = File(result.files.single.path!);
      });
    }
  }

  Future<void> _pickArtworkFile() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _artworkFile = File(pickedFile.path);
      });
    }
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
    });

    try {
      final files = <http.MultipartFile>[];

      // Add audio file
      files.add(
        await http.MultipartFile.fromPath(
          'files',
          _audioFile!.path,
          filename: _audioFile!.path.split('/').last,
        ),
      );

      // Add artwork if selected
      if (_artworkFile != null) {
        files.add(
          await http.MultipartFile.fromPath(
            'files',
            _artworkFile!.path,
            filename: _artworkFile!.path.split('/').last,
          ),
        );
      }

      await _apiService.postMultipart(
        'songs/upload',
        {
          'title': _titleController.text,
          'artistName': _artistNameController.text,
        },
        files,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Song uploaded successfully!')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upload Song'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Song Title',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter a song title';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _artistNameController,
              decoration: const InputDecoration(
                labelText: 'Artist Name',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter an artist name';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _pickAudioFile,
              icon: const Icon(Icons.audio_file),
              label: Text(_audioFile == null
                  ? 'Select Audio File (MP3/WAV)'
                  : _audioFile!.path.split('/').last),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _pickArtworkFile,
              icon: const Icon(Icons.image),
              label: Text(_artworkFile == null
                  ? 'Select Artwork (Optional)'
                  : _artworkFile!.path.split('/').last),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _isUploading ? null : _uploadSong,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepPurple,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.all(16),
              ),
              child: _isUploading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Upload Song', style: TextStyle(fontSize: 18)),
            ),
          ],
        ),
      ),
    );
  }
}
