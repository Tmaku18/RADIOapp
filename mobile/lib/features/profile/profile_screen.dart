import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/auth/role_helpers.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/follow_models.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/services/api_service.dart';
import '../../core/services/users_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  app_user.User? _user;
  bool _isLoading = true;
  bool _isSigningOut = false;
  bool _isUploadingAvatar = false;
  bool _isUpdatingProfile = false;
  bool _isLoadingFollowStats = false;
  int _followersCount = 0;
  int _followingCount = 0;
  int _friendsCount = 0;
  final UsersService _usersService = UsersService();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Load profile only once when dependencies are ready
    if (_isLoading && _user == null) {
      _loadProfile();
    }
  }

  Future<void> _loadProfile() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final user = await authService.getUserProfile();
    if (mounted) {
      setState(() {
        _user = user;
        _isLoading = false;
      });
    }
    if (user != null) {
      await _loadFollowCounts(user.id);
    }
  }

  Future<void> _loadFollowCounts(String userId) async {
    setState(() => _isLoadingFollowStats = true);
    try {
      final counts = await _usersService.getFollowCounts(userId);
      final friends = await _usersService.getFriends(userId);
      if (!mounted) return;
      setState(() {
        _followersCount = counts['followers'] ?? 0;
        _followingCount = counts['following'] ?? 0;
        _friendsCount = friends.length;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _followersCount = 0;
        _followingCount = 0;
        _friendsCount = 0;
      });
    } finally {
      if (mounted) setState(() => _isLoadingFollowStats = false);
    }
  }

  Future<void> _signOut() async {
    setState(() => _isSigningOut = true);
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      await authService.signOut();
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.root,
        (_) => false,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sign out failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSigningOut = false);
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    if (_isUploadingAvatar) return;
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    final file = File(picked.path);
    final sizeBytes = await file.length();
    if (sizeBytes > 15 * 1024 * 1024) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Image must be 15MB or smaller.')),
      );
      return;
    }

    setState(() => _isUploadingAvatar = true);
    try {
      await _usersService.uploadAvatar(file);
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile photo updated.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to upload photo: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploadingAvatar = false);
      }
    }
  }

  Future<void> _removeAvatar() async {
    if (_isUploadingAvatar) return;
    setState(() => _isUploadingAvatar = true);
    try {
      await _usersService.updateMe(avatarUrl: '');
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile photo removed.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to remove photo: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploadingAvatar = false);
      }
    }
  }

  Future<void> _upgradeRole({required bool toArtist}) async {
    final label = toArtist ? 'Artist' : 'Producer';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(toArtist ? 'Join Trial by Fire?' : 'Become a Producer?'),
        content: Text(
          toArtist
              ? 'Join Trial by Fire and become an Artist so you can upload music, compete on the leaderboard, and grow on Networx.'
              : 'Upgrade to Producer to offer services on Pro-Networx. You can still upload music as a Producer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(toArtist ? 'Join Trial by Fire' : 'Become Producer'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();
      if (toArtist) {
        await auth.requestArtistUpgrade();
      } else {
        await auth.requestProducerUpgrade();
      }
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('You are now a $label.')),
      );
      if (toArtist) {
        Navigator.pushNamed(context, AppRoutes.upload);
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not upgrade: $msg')),
      );
    }
  }

  Future<void> _openEditProfileSheet() async {
    final user = _user;
    if (user == null) return;
    final nameCtrl = TextEditingController(text: user.displayName ?? '');
    final usernameCtrl = TextEditingController(text: user.username ?? '');
    final headlineCtrl = TextEditingController(text: user.headline ?? '');
    final bioCtrl = TextEditingController(text: user.bio ?? '');
    final cityCtrl = TextEditingController(text: user.city ?? '');
    final zipCtrl = TextEditingController(text: user.zipCode ?? '');
    final instagramCtrl = TextEditingController(text: user.instagramUrl ?? '');
    final twitterCtrl = TextEditingController(text: user.twitterUrl ?? '');
    final tiktokCtrl = TextEditingController(text: user.tiktokUrl ?? '');
    final youtubeCtrl = TextEditingController(text: user.youtubeUrl ?? '');
    final websiteCtrl = TextEditingController(text: user.websiteUrl ?? '');
    final soundcloudCtrl = TextEditingController(text: user.soundcloudUrl ?? '');
    final spotifyCtrl = TextEditingController(text: user.spotifyUrl ?? '');
    final appleMusicCtrl = TextEditingController(text: user.appleMusicUrl ?? '');
    final facebookCtrl = TextEditingController(text: user.facebookUrl ?? '');
    final snapchatCtrl = TextEditingController(text: user.snapchatUrl ?? '');
    bool saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> submit() async {
              if (saving) return;
              final trimmedName = nameCtrl.text.trim();
              if (trimmedName.isEmpty) {
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(
                    content: Text('Display name cannot be empty.'),
                  ),
                );
                return;
              }
              final trimmedUsername =
                  usernameCtrl.text.trim().toLowerCase();
              final usernameChanged =
                  trimmedUsername != (user.username ?? '').toLowerCase();
              if (usernameChanged &&
                  trimmedUsername.isNotEmpty &&
                  !RegExp(r'^[a-z0-9_.]{3,30}$').hasMatch(trimmedUsername)) {
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Username must be 3-30 characters: lowercase letters, numbers, underscores, or dots.',
                    ),
                  ),
                );
                return;
              }
              setModalState(() => saving = true);
              setState(() => _isUpdatingProfile = true);
              try {
                if (usernameChanged && trimmedUsername.isNotEmpty) {
                  final available = await _usersService
                      .checkUsernameAvailable(trimmedUsername);
                  if (!available) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(this.context).showSnackBar(
                      const SnackBar(
                        content: Text('That username is already taken.'),
                      ),
                    );
                    return;
                  }
                }
                // Only patch social fields that changed so a bad unused
                // field cannot block username / bio saves.
                String? socialPatch(String current, String original) {
                  final next = current.trim();
                  final prev = original.trim();
                  if (next == prev) return null;
                  return next;
                }

                await _usersService.updateMe(
                  displayName: trimmedName,
                  username: usernameChanged && trimmedUsername.isNotEmpty
                      ? trimmedUsername
                      : null,
                  headline: headlineCtrl.text.trim(),
                  bio: bioCtrl.text.trim(),
                  city: cityCtrl.text.trim(),
                  zipCode: zipCtrl.text.trim(),
                  instagramUrl: socialPatch(
                    instagramCtrl.text,
                    user.instagramUrl ?? '',
                  ),
                  twitterUrl: socialPatch(
                    twitterCtrl.text,
                    user.twitterUrl ?? '',
                  ),
                  tiktokUrl: socialPatch(
                    tiktokCtrl.text,
                    user.tiktokUrl ?? '',
                  ),
                  youtubeUrl: socialPatch(
                    youtubeCtrl.text,
                    user.youtubeUrl ?? '',
                  ),
                  websiteUrl: socialPatch(
                    websiteCtrl.text,
                    user.websiteUrl ?? '',
                  ),
                  soundcloudUrl: socialPatch(
                    soundcloudCtrl.text,
                    user.soundcloudUrl ?? '',
                  ),
                  spotifyUrl: socialPatch(
                    spotifyCtrl.text,
                    user.spotifyUrl ?? '',
                  ),
                  appleMusicUrl: socialPatch(
                    appleMusicCtrl.text,
                    user.appleMusicUrl ?? '',
                  ),
                  facebookUrl: socialPatch(
                    facebookCtrl.text,
                    user.facebookUrl ?? '',
                  ),
                  snapchatUrl: socialPatch(
                    snapchatCtrl.text,
                    user.snapchatUrl ?? '',
                  ),
                );
                if (!mounted || !context.mounted) return;
                Navigator.pop(context);
                await _loadProfile();
                if (!mounted) return;
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Profile updated.')),
                );
              } catch (e) {
                if (!mounted) return;
                final msg = e is ApiException
                    ? e.message
                    : e.toString();
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(content: Text('Failed to update profile: $msg')),
                );
              } finally {
                if (mounted) {
                  setState(() => _isUpdatingProfile = false);
                }
                setModalState(() => saving = false);
              }
            }

            return SafeArea(
              child: Padding(
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
                      Text('Edit profile',
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      TextField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Display name',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: usernameCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Username',
                          prefixText: '@',
                          helperText:
                              'Your unique handle, separate from display name.',
                        ),
                        autocorrect: false,
                        textCapitalization: TextCapitalization.none,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: headlineCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Headline',
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: cityCtrl,
                        decoration: const InputDecoration(
                          labelText: 'City',
                          helperText:
                              'Shown on Nearby People map once saved.',
                        ),
                        textCapitalization: TextCapitalization.words,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: zipCtrl,
                        decoration: const InputDecoration(
                          labelText: 'ZIP / postal code',
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: bioCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Bio',
                        ),
                        minLines: 3,
                        maxLines: 5,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: instagramCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Instagram',
                          hintText: 'https://instagram.com/you, @you, or handle',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: twitterCtrl,
                        decoration: const InputDecoration(
                          labelText: 'X / Twitter',
                          hintText: 'https://twitter.com/you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: tiktokCtrl,
                        decoration: const InputDecoration(
                          labelText: 'TikTok',
                          hintText: 'https://www.tiktok.com/@you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: youtubeCtrl,
                        decoration: const InputDecoration(
                          labelText: 'YouTube',
                          hintText: 'https://www.youtube.com/@you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: soundcloudCtrl,
                        decoration: const InputDecoration(
                          labelText: 'SoundCloud',
                          hintText: 'https://soundcloud.com/you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: spotifyCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Spotify',
                          hintText: 'https://open.spotify.com/artist/...',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: appleMusicCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Apple Music',
                          hintText: 'https://music.apple.com/...',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: facebookCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Facebook',
                          hintText: 'https://facebook.com/you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: snapchatCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Snapchat',
                          hintText: 'https://www.snapchat.com/add/you',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: websiteCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Website',
                          hintText: 'https://your-site.com',
                        ),
                        keyboardType: TextInputType.url,
                        autocorrect: false,
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed:
                                  saving ? null : () => Navigator.pop(context),
                              child: const Text('Cancel'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton(
                              onPressed: saving ? null : submit,
                              child: saving
                                  ? const SizedBox(
                                      height: 16,
                                      width: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Save'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    // Clean up controllers after the bottom sheet closes.
    nameCtrl.dispose();
    usernameCtrl.dispose();
    headlineCtrl.dispose();
    bioCtrl.dispose();
    cityCtrl.dispose();
    zipCtrl.dispose();
    instagramCtrl.dispose();
    twitterCtrl.dispose();
    tiktokCtrl.dispose();
    youtubeCtrl.dispose();
    websiteCtrl.dispose();
    soundcloudCtrl.dispose();
    spotifyCtrl.dispose();
    appleMusicCtrl.dispose();
    facebookCtrl.dispose();
    snapchatCtrl.dispose();
  }

  Uri? _normalizeSocialUri({
    required String label,
    required String value,
  }) {
    final raw = value.trim();
    if (raw.isEmpty) return null;
    final hasScheme =
        raw.startsWith('http://') || raw.startsWith('https://');

    if (label.toLowerCase() == 'instagram') {
      if (hasScheme) return Uri.tryParse(raw);
      if (raw.toLowerCase().startsWith('instagram.com') ||
          raw.toLowerCase().startsWith('www.instagram.com')) {
        return Uri.tryParse('https://$raw');
      }
      var handle = raw;
      if (handle.startsWith('@')) {
        handle = handle.substring(1);
      }
      handle = handle.trim();
      if (handle.isEmpty || handle.contains(' ')) return null;
      return Uri.tryParse('https://www.instagram.com/$handle/');
    }

    return Uri.tryParse(hasScheme ? raw : 'https://$raw');
  }

  Future<void> _openExternalUrl({
    required String label,
    required String rawUrl,
  }) async {
    final uri = _normalizeSocialUri(label: label, value: rawUrl);
    if (uri == null || !await canLaunchUrl(uri)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open $label link.')),
      );
      return;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  List<Widget> _buildSocialLinkButtons(app_user.User user) {
    final links = <({String label, IconData icon, String? value})>[
      (label: 'Instagram', icon: Icons.camera_alt_outlined, value: user.instagramUrl),
      (label: 'X', icon: Icons.alternate_email_outlined, value: user.twitterUrl),
      (label: 'TikTok', icon: Icons.music_video_outlined, value: user.tiktokUrl),
      (label: 'YouTube', icon: Icons.ondemand_video_outlined, value: user.youtubeUrl),
      (label: 'SoundCloud', icon: Icons.graphic_eq_outlined, value: user.soundcloudUrl),
      (label: 'Spotify', icon: Icons.album_outlined, value: user.spotifyUrl),
      (label: 'Apple Music', icon: Icons.library_music_outlined, value: user.appleMusicUrl),
      (label: 'Facebook', icon: Icons.groups_outlined, value: user.facebookUrl),
      (label: 'Snapchat', icon: Icons.chat_bubble_outline, value: user.snapchatUrl),
      (label: 'Website', icon: Icons.language_outlined, value: user.websiteUrl),
    ];

    return links
        .where((s) => (s.value ?? '').trim().isNotEmpty)
        .map(
          (social) => TextButton.icon(
            onPressed: () =>
                _openExternalUrl(label: social.label, rawUrl: social.value!),
            icon: social.label == 'Instagram'
                ? _instagramGlyph(context)
                : Icon(social.icon, size: 18),
            label: Text(social.label),
          ),
        )
        .toList();
  }

  /// Official IG glyph: white on dark backgrounds, black on light ones.
  Widget _instagramGlyph(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      BrandAssets.instagramGlyphWhiteAsset,
      width: 18,
      height: 18,
      color: dark ? Colors.white : Colors.black,
    );
  }

  Future<void> _openFollowList({required String mode}) async {
    final user = _user;
    if (user == null) return;
    // mode: 'friends' | 'fans' | 'following'
    final title = mode == 'friends'
        ? 'Friends'
        : mode == 'fans'
            ? 'Fans'
            : 'Following';
    final canUnfollow = mode == 'following' || mode == 'friends';
    List<FollowListItem> items = const [];
    bool loading = true;
    String? error;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> load() async {
              setModalState(() {
                loading = true;
                error = null;
              });
              try {
                List<FollowListItem> next;
                if (mode == 'friends') {
                  next = await _usersService.getFriends(user.id);
                } else if (mode == 'fans') {
                  final followers = await _usersService.getFollowers(user.id);
                  next = followers
                      .where((e) => e.relationship != 'friend')
                      .toList();
                } else {
                  next = await _usersService.getFollowing(user.id);
                }
                setModalState(() => items = next);
              } catch (e) {
                setModalState(() => error = e.toString());
              } finally {
                setModalState(() => loading = false);
              }
            }

            if (loading && items.isEmpty && error == null) {
              // Trigger initial load once after build.
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (loading) {
                  load();
                }
              });
            }

            return SafeArea(
              child: SizedBox(
                height: MediaQuery.of(context).size.height * 0.72,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Text(title,
                              style: Theme.of(context).textTheme.titleLarge),
                          const Spacer(),
                          IconButton(
                            onPressed: load,
                            icon: const Icon(Icons.refresh),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: loading && items.isEmpty
                          ? const Center(child: CircularProgressIndicator())
                          : error != null
                              ? Center(child: Text(error!))
                              : items.isEmpty
                                  ? const Center(
                                      child: Text('No users yet.'),
                                    )
                                  : ListView.separated(
                                      itemCount: items.length,
                                      separatorBuilder: (context, index) =>
                                          const Divider(height: 1),
                                      itemBuilder: (context, index) {
                                        final item = items[index];
                                        return ListTile(
                                          leading: CircleAvatar(
                                            backgroundImage:
                                                item.avatarUrl != null
                                                    ? CachedNetworkImageProvider(
                                                        item.avatarUrl!,
                                                      )
                                                    : null,
                                            child: item.avatarUrl == null
                                                ? Text(
                                                    (item.displayName ?? '?')
                                                        .characters
                                                        .first
                                                        .toUpperCase(),
                                                  )
                                                : null,
                                          ),
                                          title:
                                              Text(item.displayName ?? 'User'),
                                          subtitle: Text(
                                            (item.username ?? '').isNotEmpty
                                                ? '@${item.username}'
                                                : item.headline ??
                                                    (item.role ?? '')
                                                        .toUpperCase(),
                                          ),
                                          trailing: !canUnfollow
                                              ? null
                                              : IconButton(
                                                  onPressed: () async {
                                                    try {
                                                      await _usersService
                                                          .unfollow(item.id);
                                                      setModalState(() {
                                                        items = items
                                                            .where((e) =>
                                                                e.id != item.id)
                                                            .toList();
                                                      });
                                                      await _loadFollowCounts(
                                                          user.id);
                                                    } catch (e) {
                                                      if (!mounted) return;
                                                      ScaffoldMessenger.of(
                                                              this.context)
                                                          .showSnackBar(
                                                        SnackBar(
                                                            content: Text(
                                                                'Failed to unfollow: $e')),
                                                      );
                                                    }
                                                  },
                                                  icon: const Icon(
                                                      Icons.person_remove_outlined),
                                                ),
                                        );
                                      },
                                    ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'Profile',
      showNeonLine: true,
      loading: _isLoading,
      body: _user == null
              ? const Center(child: Text('Failed to load profile'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Center(
                      child: CircleAvatar(
                        radius: 60,
                        backgroundImage: _user!.avatarUrl != null
                            ? CachedNetworkImageProvider(_user!.avatarUrl!)
                            : null,
                        child: _user!.avatarUrl == null
                            ? const Icon(Icons.person, size: 60)
                            : null,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Center(
                      child: Wrap(
                        spacing: 12,
                        children: [
                          OutlinedButton.icon(
                            onPressed: _isUploadingAvatar ? null : _pickAndUploadAvatar,
                            icon: _isUploadingAvatar
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Icon(Icons.camera_alt_outlined),
                            label: const Text('Change photo'),
                          ),
                          if (_user!.avatarUrl != null)
                            TextButton(
                              onPressed: _isUploadingAvatar ? null : _removeAvatar,
                              child: const Text('Remove photo'),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: Text(
                        _user!.displayName ?? _user!.email,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    if ((_user!.username ?? '').isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Center(
                        child: Text(
                          '@${_user!.username}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color:
                                    Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Center(
                      child: FilledButton.tonalIcon(
                        onPressed: _isUpdatingProfile ? null : _openEditProfileSheet,
                        icon: _isUpdatingProfile
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.edit_outlined),
                        label: const Text('Edit profile'),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Center(
                      child: TextButton(
                        onPressed: () {
                          Navigator.pushNamed(
                            context,
                            AppRoutes.artistProfile,
                            arguments: _user!.id,
                          );
                        },
                        child: const Text('View my public profile'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        _user!.email,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    if ((_user!.headline ?? '').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          _user!.headline!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                    if ((_user!.bio ?? '').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        _user!.bio!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    ...(() {
                      final socialButtons = _buildSocialLinkButtons(_user!);
                      if (socialButtons.isEmpty) return <Widget>[];
                      return <Widget>[
                        const SizedBox(height: 8),
                        Center(
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 2,
                            alignment: WrapAlignment.center,
                            children: socialButtons,
                          ),
                        ),
                      ];
                    })(),
                    const SizedBox(height: 10),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: _isLoadingFollowStats
                                    ? null
                                    : () => _openFollowList(mode: 'friends'),
                                child: Column(
                                  children: [
                                    Text(
                                      _isLoadingFollowStats
                                          ? '...'
                                          : '$_friendsCount',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text('Friends'),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(
                              height: 34,
                              child: VerticalDivider(width: 1),
                            ),
                            Expanded(
                              child: InkWell(
                                onTap: _isLoadingFollowStats
                                    ? null
                                    : () => _openFollowList(mode: 'fans'),
                                child: Column(
                                  children: [
                                    Text(
                                      _isLoadingFollowStats
                                          ? '...'
                                          : '${(_followersCount - _friendsCount).clamp(0, _followersCount)}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text('Fans'),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(
                              height: 34,
                              child: VerticalDivider(width: 1),
                            ),
                            Expanded(
                              child: InkWell(
                                onTap: _isLoadingFollowStats
                                    ? null
                                    : () => _openFollowList(mode: 'following'),
                                child: Column(
                                  children: [
                                    Text(
                                      _isLoadingFollowStats
                                          ? '...'
                                          : '$_followingCount',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text('Following'),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.bookmark_border),
                            title: const Text('Saved posts'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.pushNamed(
                              context,
                              AppRoutes.savedPosts,
                            ),
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.favorite_border),
                            title: const Text('Liked posts'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.pushNamed(
                              context,
                              AppRoutes.likedPosts,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Chip(
                        label: Text(_user!.role.toUpperCase()),
                        backgroundColor: Theme.of(context)
                            .colorScheme
                            .primary
                            .withValues(alpha: 0.12),
                      ),
                    ),
                    const SizedBox(height: 32),
                    ListTile(
                      leading: const Icon(Icons.upload_outlined),
                      title: const Text('Upload'),
                      subtitle: Text(
                        _user!.role == 'listener'
                            ? 'Join Trial by Fire to become an Artist and upload'
                            : 'Add a track to the rotation',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.pushNamed(context, AppRoutes.upload);
                      },
                    ),
                    if (_user!.role == 'listener') ...[
                      ListTile(
                        leading: const Icon(Icons.local_fire_department_outlined),
                        title: const Text('Join Trial by Fire'),
                        subtitle: const Text('Become an Artist and upload music'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _upgradeRole(toArtist: true),
                      ),
                      ListTile(
                        leading: const Icon(Icons.work_outline),
                        title: const Text('Become a Producer'),
                        subtitle: const Text('Offer services on Pro-Networx'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _upgradeRole(toArtist: false),
                      ),
                    ],
                    if (_user!.role == 'artist') ...[
                      ListTile(
                        leading: const Icon(Icons.work_outline),
                        title: const Text('Become a Producer'),
                        subtitle: const Text('Offer services on Pro-Networx'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _upgradeRole(toArtist: false),
                      ),
                      Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.3),
                        child: InkWell(
                          onTap: () {
                            Navigator.pushNamed(context, AppRoutes.streamSettings);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                const Icon(Icons.live_tv, size: 40, color: Colors.red),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Go Live',
                                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Streaming requires admin approval. Request access, then manage your stream (title, category, start/stop) in Stream settings.',
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right),
                              ],
                            ),
                          ),
                        ),
                      ),
                      ListTile(
                        leading: const Icon(Icons.mic_none),
                        title: const Text('My Songs'),
                        subtitle: const Text('Manage your songs'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.pushNamed(context, AppRoutes.studio);
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.library_music_outlined),
                        title: const Text('Credits'),
                        subtitle: const Text('Balance and history'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.pushNamed(context, AppRoutes.credits);
                        },
                      ),
                    ],
                    if (hasArtistCapability(_user!.role) &&
                        _user!.role != 'artist') ...[
                      ListTile(
                        leading: const Icon(Icons.mic_none),
                        title: const Text('My Songs'),
                        subtitle: const Text('Manage your songs'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.pushNamed(context, AppRoutes.studio);
                        },
                      ),
                    ],
                    const Divider(),
                    ListTile(
                      leading: const Icon(Icons.workspace_premium),
                      title: const Text('Creator Network'),
                      subtitle: const Text('Unlock direct messages — subscribe to send and receive DMs'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.pushNamed(context, AppRoutes.settings);
                      },
                    ),
                    const Divider(),
                    ListTile(
                      leading: const Icon(Icons.tune),
                      title: const Text('Settings and activity'),
                      subtitle: const Text('Account, notifications, security, and more'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.pushNamed(context, AppRoutes.settings);
                      },
                    ),
                    const Divider(),
                    ListTile(
                      leading: _isSigningOut 
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.logout, color: Colors.red),
                      title: Text(
                        _isSigningOut ? 'Signing out...' : 'Sign Out',
                        style: TextStyle(color: _isSigningOut ? Colors.grey : Colors.red),
                      ),
                      onTap: _isSigningOut ? null : _signOut,
                    ),
                  ],
                ),
    );
  }
}
