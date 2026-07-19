import 'dart:io';
import 'dart:ui';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/models/pro_networx_models.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/services/pro_networx_service.dart';
import '../../core/services/users_service.dart';
import '../../core/theme/networx_extensions.dart';

class ProNetworxMeProfileScreen extends StatefulWidget {
  const ProNetworxMeProfileScreen({super.key});

  @override
  State<ProNetworxMeProfileScreen> createState() =>
      _ProNetworxMeProfileScreenState();
}

class _ProNetworxMeProfileScreenState extends State<ProNetworxMeProfileScreen> {
  final ProNetworxService _service = ProNetworxService();
  final UsersService _usersService = UsersService();
  final ImagePicker _picker = ImagePicker();

  bool _loading = true;
  bool _saving = false;
  bool _uploadingMedia = false;
  String? _error;
  app_user.User? _me;

  bool _availableForWork = true;
  String? _avatarUrl;
  String? _heroImageUrl;
  String? _resumeFilename;
  String? _resumeUrl;

  final TextEditingController _currentTitle = TextEditingController();
  final TextEditingController _headline = TextEditingController();
  final TextEditingController _about = TextEditingController();
  final TextEditingController _skills = TextEditingController();
  final TextEditingController _website = TextEditingController();
  final TextEditingController _instagram = TextEditingController();
  final TextEditingController _twitter = TextEditingController();
  final TextEditingController _youtube = TextEditingController();
  final TextEditingController _tiktok = TextEditingController();
  final TextEditingController _soundcloud = TextEditingController();
  final TextEditingController _spotify = TextEditingController();
  final TextEditingController _appleMusic = TextEditingController();
  final TextEditingController _facebook = TextEditingController();
  final TextEditingController _snapchat = TextEditingController();

  List<ProExperienceItem> _experience = [];
  List<ProEducationItem> _education = [];
  List<ProFeaturedItem> _featured = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _currentTitle.dispose();
    _headline.dispose();
    _about.dispose();
    _skills.dispose();
    _website.dispose();
    _instagram.dispose();
    _twitter.dispose();
    _youtube.dispose();
    _tiktok.dispose();
    _soundcloud.dispose();
    _spotify.dispose();
    _appleMusic.dispose();
    _facebook.dispose();
    _snapchat.dispose();
    super.dispose();
  }

  List<String> _parseSkills(String raw) {
    return raw
        .split(RegExp(r'[,\\n]+'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList()
        .take(50)
        .toList();
  }

  void _applyProfile(ProProfile p) {
    _availableForWork = p.availableForWork;
    _avatarUrl = p.avatarUrl ?? _me?.avatarUrl;
    _heroImageUrl = p.heroImageUrl;
    _currentTitle.text = p.currentTitle ?? '';
    _headline.text = p.skillsHeadline ?? '';
    _about.text = p.about ?? '';
    _skills.text = p.skills.map((s) => s.name).join(', ');
    _website.text = p.websiteUrl ?? '';
    _instagram.text = p.instagramUrl ?? '';
    _twitter.text = p.twitterUrl ?? '';
    _youtube.text = p.youtubeUrl ?? '';
    _tiktok.text = p.tiktokUrl ?? '';
    _soundcloud.text = p.soundcloudUrl ?? '';
    _spotify.text = p.spotifyUrl ?? '';
    _appleMusic.text = p.appleMusicUrl ?? '';
    _facebook.text = p.facebookUrl ?? '';
    _snapchat.text = p.snapchatUrl ?? '';
    _experience = p.experience.map((e) => ProExperienceItem.fromJson(e.toJson())).toList();
    _education = p.education.map((e) => ProEducationItem.fromJson(e.toJson())).toList();
    _featured = p.featured.map((e) => ProFeaturedItem.fromJson(e.toJson())).toList();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      if (!mounted) return;
      setState(() => _me = me);
      if (me == null) {
        setState(() => _loading = false);
        return;
      }

      final p = await _service.getMeProfile();
      final resume = await _service.getMyResume();
      if (!mounted) return;
      setState(() {
        _applyProfile(p);
        _resumeUrl = resume.url;
        _resumeFilename = resume.filename;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _trimOrNull(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  Future<void> _save() async {
    if (_saving || _me == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final skills = _parseSkills(_skills.text);
      await _service.updateMeProfile(
        availableForWork: _availableForWork,
        currentTitle: _trimOrNull(_currentTitle),
        skillsHeadline: _trimOrNull(_headline),
        about: _trimOrNull(_about),
        websiteUrl: _trimOrNull(_website),
        instagramUrl: _trimOrNull(_instagram),
        twitterUrl: _trimOrNull(_twitter),
        youtubeUrl: _trimOrNull(_youtube),
        tiktokUrl: _trimOrNull(_tiktok),
        soundcloudUrl: _trimOrNull(_soundcloud),
        spotifyUrl: _trimOrNull(_spotify),
        appleMusicUrl: _trimOrNull(_appleMusic),
        facebookUrl: _trimOrNull(_facebook),
        snapchatUrl: _trimOrNull(_snapchat),
        skillNames: skills,
        experience: _experience.map((e) => e.toJson()).toList(),
        education: _education.map((e) => e.toJson()).toList(),
        featured: _featured.map((e) => e.toJson()).toList(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pro-Networx profile saved.')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAvatar() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null || !mounted) return;
    final auth = Provider.of<AuthService>(context, listen: false);
    setState(() => _uploadingMedia = true);
    try {
      await _usersService.uploadAvatar(File(picked.path));
      final me = await auth.getUserProfile();
      if (!mounted) return;
      setState(() {
        _me = me;
        _avatarUrl = me?.avatarUrl;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Avatar upload failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Future<void> _pickCover() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploadingMedia = true);
    try {
      final url = await _service.uploadCover(File(picked.path));
      if (!mounted) return;
      setState(() => _heroImageUrl = url);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cover upload failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Future<void> _pickResume() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
      withData: false,
    );
    final path = result?.files.single.path;
    if (path == null) return;
    setState(() => _uploadingMedia = true);
    try {
      final uploaded = await _service.uploadResume(File(path));
      if (!mounted) return;
      setState(() {
        _resumeUrl = uploaded.url;
        _resumeFilename = uploaded.filename;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Resume upload failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Future<void> _deleteResume() async {
    setState(() => _uploadingMedia = true);
    try {
      await _service.deleteResume();
      if (!mounted) return;
      setState(() {
        _resumeUrl = null;
        _resumeFilename = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not delete resume: $e')),
      );
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _textField(String label, TextEditingController controller,
      {int maxLines = 1, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label, hintText: hint),
      ),
    );
  }

  Widget _inlineField(String label, String value, ValueChanged<String> onChanged,
      {int maxLines = 1, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextFormField(
        initialValue: value,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label, hintText: hint, isDense: true),
        onChanged: onChanged,
      ),
    );
  }

  Widget _experienceSection() {
    return _listSection(
      title: 'Experience',
      emptyLabel: 'Add experience',
      itemCount: _experience.length,
      onAdd: () => setState(() => _experience.add(ProExperienceItem())),
      onRemove: (i) => setState(() => _experience.removeAt(i)),
      itemBuilder: (i) {
        final item = _experience[i];
        return Column(
          children: [
            _inlineField('Title', item.title, (v) => item.title = v),
            _inlineField('Company', item.company, (v) => item.company = v),
            _inlineField('Location', item.location, (v) => item.location = v),
            _inlineField('Start date', item.startDate, (v) => item.startDate = v, hint: '2020-01'),
            _inlineField('End date', item.endDate, (v) => item.endDate = v, hint: '2024-06'),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Current role'),
              value: item.current,
              onChanged: (v) => setState(() => item.current = v),
            ),
            _inlineField('Description', item.description, (v) => item.description = v, maxLines: 3),
          ],
        );
      },
    );
  }

  Widget _educationSection() {
    return _listSection(
      title: 'Education',
      emptyLabel: 'Add education',
      itemCount: _education.length,
      onAdd: () => setState(() => _education.add(ProEducationItem())),
      onRemove: (i) => setState(() => _education.removeAt(i)),
      itemBuilder: (i) {
        final item = _education[i];
        return Column(
          children: [
            _inlineField('School', item.school, (v) => item.school = v),
            _inlineField('Degree', item.degree, (v) => item.degree = v),
            _inlineField('Field', item.field, (v) => item.field = v),
            _inlineField('Start year', item.startYear, (v) => item.startYear = v),
            _inlineField('End year', item.endYear, (v) => item.endYear = v),
            _inlineField('Description', item.description, (v) => item.description = v, maxLines: 3),
          ],
        );
      },
    );
  }

  Widget _featuredSection() {
    return _listSection(
      title: 'Featured links',
      emptyLabel: 'Add link',
      itemCount: _featured.length,
      onAdd: () => setState(() => _featured.add(ProFeaturedItem())),
      onRemove: (i) => setState(() => _featured.removeAt(i)),
      itemBuilder: (i) {
        final item = _featured[i];
        return Column(
          children: [
            _inlineField('Title', item.title, (v) => item.title = v),
            _inlineField('URL', item.url, (v) => item.url = v),
            _inlineField('Description', item.description, (v) => item.description = v, maxLines: 2),
          ],
        );
      },
    );
  }

  Widget _listSection({
    required String title,
    required String emptyLabel,
    required int itemCount,
    required VoidCallback onAdd,
    required void Function(int index) onRemove,
    required Widget Function(int index) itemBuilder,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle(title),
            if (itemCount == 0)
              Text(emptyLabel, style: Theme.of(context).textTheme.bodySmall),
            for (var i = 0; i < itemCount; i++) ...[
              Row(
                children: [
                  Expanded(
                    child: Text('Entry ${i + 1}',
                        style: Theme.of(context).textTheme.labelLarge),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => onRemove(i),
                  ),
                ],
              ),
              itemBuilder(i),
              if (i < itemCount - 1) const Divider(height: 24),
            ],
            TextButton.icon(onPressed: onAdd, icon: const Icon(Icons.add), label: Text(emptyLabel)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget glass({required Widget child}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: surfaces.glassBlur, sigmaY: surfaces.glassBlur),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(color: Colors.white.withValues(alpha: surfaces.glassBorderOpacity)),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            padding: const EdgeInsets.all(14),
            child: child,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Build your PRO-NETWORX profile'),
        actions: [
          if (_uploadingMedia)
            const Padding(
              padding: EdgeInsets.all(12),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _me == null
              ? Center(
                  child: Text(
                    'Log in to build your Pro-Networx profile.',
                    style: TextStyle(color: surfaces.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _sectionTitle('Media'),
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 32,
                                backgroundImage: _avatarUrl != null ? NetworkImage(_avatarUrl!) : null,
                                child: _avatarUrl == null ? const Icon(Icons.person) : null,
                              ),
                              const SizedBox(width: 12),
                              OutlinedButton.icon(
                                onPressed: _uploadingMedia ? null : _pickAvatar,
                                icon: const Icon(Icons.photo_camera_outlined, size: 18),
                                label: const Text('Photo'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_heroImageUrl != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(_heroImageUrl!, height: 120, width: double.infinity, fit: BoxFit.cover),
                            ),
                          OutlinedButton.icon(
                            onPressed: _uploadingMedia ? null : _pickCover,
                            icon: const Icon(Icons.image_outlined, size: 18),
                            label: Text(_heroImageUrl == null ? 'Add cover image' : 'Change cover'),
                          ),
                          const SizedBox(height: 8),
                          if (_resumeFilename != null)
                            Text('Resume: $_resumeFilename', style: TextStyle(color: surfaces.textSecondary)),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: _uploadingMedia ? null : _pickResume,
                                icon: const Icon(Icons.upload_file, size: 18),
                                label: Text(_resumeUrl == null ? 'Upload resume (PDF)' : 'Replace resume'),
                              ),
                              if (_resumeUrl != null)
                                TextButton(onPressed: _uploadingMedia ? null : _deleteResume, child: const Text('Remove')),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    glass(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Available for work', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text('Show a lime presence dot in the directory.', style: TextStyle(color: surfaces.textSecondary)),
                              ],
                            ),
                          ),
                          Switch(value: _availableForWork, onChanged: (v) => setState(() => _availableForWork = v)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _sectionTitle('Profile'),
                          _textField('Current title', _currentTitle, hint: 'Producer · Mix engineer'),
                          _textField('Skills headline', _headline, hint: 'Mix engineer · Studio sessions'),
                          _textField('About', _about, maxLines: 5, hint: 'Tell collaborators about your work'),
                          _textField('Skills (comma-separated)', _skills, maxLines: 3),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _sectionTitle('Links'),
                          _textField('Website', _website),
                          _textField('Instagram', _instagram),
                          _textField('Twitter / X', _twitter),
                          _textField('YouTube', _youtube),
                          _textField('TikTok', _tiktok),
                          _textField('SoundCloud', _soundcloud),
                          _textField('Spotify', _spotify),
                          _textField('Apple Music', _appleMusic),
                          _textField('Facebook', _facebook),
                          _textField('Snapchat', _snapchat),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _experienceSection(),
                    const SizedBox(height: 12),
                    _educationSection(),
                    const SizedBox(height: 12),
                    _featuredSection(),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: scheme.error)),
                    ],
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: _saving
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.save),
                        label: Text(_saving ? 'Saving…' : 'Save'),
                      ),
                    ),
                  ],
                ),
    );
  }
}
