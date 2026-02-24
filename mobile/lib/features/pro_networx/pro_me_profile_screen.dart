import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';

class ProNetworxMeProfileScreen extends StatefulWidget {
  const ProNetworxMeProfileScreen({super.key});

  @override
  State<ProNetworxMeProfileScreen> createState() => _ProNetworxMeProfileScreenState();
}

class _ProNetworxMeProfileScreenState extends State<ProNetworxMeProfileScreen> {
  final ProNetworxService _service = ProNetworxService();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  app_user.User? _me;

  bool _availableForWork = true;
  final TextEditingController _headline = TextEditingController();
  final TextEditingController _skills = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _headline.dispose();
    _skills.dispose();
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
      if (!mounted) return;
      setState(() {
        _availableForWork = p.availableForWork;
        _headline.text = p.skillsHeadline ?? '';
        _skills.text = p.skills.map((s) => s.name).join(', ');
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    if (_me == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final skills = _parseSkills(_skills.text);
      await _service.updateMeProfile(
        availableForWork: _availableForWork,
        skillsHeadline: _headline.text.trim().isEmpty ? null : _headline.text.trim(),
        skillNames: skills.isEmpty ? <String>[] : skills,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PRO‑NETWORX profile saved.')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
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
        title: const Text('Build my PRO‑NETWORX profile'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _me == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Log in to build your PRO‑NETWORX profile.',
                      style: TextStyle(color: surfaces.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    glass(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Available for work',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Show a lime presence dot in the directory.',
                                  style: TextStyle(color: surfaces.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Switch(
                            value: _availableForWork,
                            onChanged: (v) => setState(() => _availableForWork = v),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    glass(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Skills headline',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _headline,
                            decoration: const InputDecoration(
                              labelText: 'Headline',
                              hintText: 'Mix engineer · Studio sessions · Cover art',
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Skills',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _skills,
                            minLines: 2,
                            maxLines: 5,
                            decoration: const InputDecoration(
                              labelText: 'Comma-separated',
                              hintText: 'mixing, mastering, producer, studio, photography',
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Tip: keep skills short; the directory uses them for filtering.',
                            style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
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

