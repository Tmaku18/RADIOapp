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
import '../../core/models/pro_networx_models.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/services/api_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/services/users_service.dart';
import '../../core/navigation/home_tab_intent.dart';
import '../../core/utils/image_crop_picker.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/states/app_states.dart';

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
  bool _isUploadingCover = false;
  bool _isUpdatingProfile = false;
  bool _isLoadingFollowStats = false;
  int _followersCount = 0;
  int _followingCount = 0;
  int _friendsCount = 0;
  String? _heroImageUrl;
  final UsersService _usersService = UsersService();
  final ProNetworxService _feedService = ProNetworxService();
  List<ProFeedPost> _myPosts = const [];
  bool _loadingPosts = false;
  bool _formDirty = false;
  bool _syncingForm = false;
  final _nameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _headlineCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _zipCtrl = TextEditingController();
  final _instagramCtrl = TextEditingController();
  final _twitterCtrl = TextEditingController();
  final _tiktokCtrl = TextEditingController();
  final _youtubeCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _soundcloudCtrl = TextEditingController();
  final _spotifyCtrl = TextEditingController();
  final _appleMusicCtrl = TextEditingController();
  final _facebookCtrl = TextEditingController();
  final _snapchatCtrl = TextEditingController();

  bool get _canEditCover => hasArtistCapability(_user?.role);

  List<TextEditingController> get _formControllers => [
        _nameCtrl,
        _usernameCtrl,
        _headlineCtrl,
        _bioCtrl,
        _cityCtrl,
        _zipCtrl,
        _instagramCtrl,
        _twitterCtrl,
        _tiktokCtrl,
        _youtubeCtrl,
        _websiteCtrl,
        _soundcloudCtrl,
        _spotifyCtrl,
        _appleMusicCtrl,
        _facebookCtrl,
        _snapchatCtrl,
      ];

  @override
  void initState() {
    super.initState();
    for (final controller in _formControllers) {
      controller.addListener(_onFormEdited);
    }
  }

  @override
  void dispose() {
    for (final controller in _formControllers) {
      controller.removeListener(_onFormEdited);
      controller.dispose();
    }
    super.dispose();
  }

  void _onFormEdited() {
    if (_syncingForm) return;
    _formDirty = true;
  }

  void _applyProfileToForm(app_user.User? user) {
    if (user == null || _formDirty) return;
    _syncingForm = true;
    _nameCtrl.text = user.displayName ?? '';
    _usernameCtrl.text = user.username ?? '';
    _headlineCtrl.text = user.headline ?? '';
    _bioCtrl.text = user.bio ?? '';
    _cityCtrl.text = user.city ?? '';
    _zipCtrl.text = user.zipCode ?? '';
    _instagramCtrl.text = user.instagramUrl ?? '';
    _twitterCtrl.text = user.twitterUrl ?? '';
    _tiktokCtrl.text = user.tiktokUrl ?? '';
    _youtubeCtrl.text = user.youtubeUrl ?? '';
    _websiteCtrl.text = user.websiteUrl ?? '';
    _soundcloudCtrl.text = user.soundcloudUrl ?? '';
    _spotifyCtrl.text = user.spotifyUrl ?? '';
    _appleMusicCtrl.text = user.appleMusicUrl ?? '';
    _facebookCtrl.text = user.facebookUrl ?? '';
    _snapchatCtrl.text = user.snapchatUrl ?? '';
    _syncingForm = false;
  }

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
    // Prefer /users/me DB uuid — Auth fallback can return Firebase uid, which
    // won't match discover_feed_posts.author_user_id or listUserPosts.
    String? dbUserId = user?.id;
    try {
      final me = await _usersService.getMe();
      final id = me['id']?.toString();
      if (id != null && id.isNotEmpty) dbUserId = id;
    } catch (_) {}
    if (mounted) {
      _applyProfileToForm(user);
      setState(() {
        _user = user;
        _isLoading = false;
      });
    }
    if (dbUserId != null && dbUserId.isNotEmpty) {
      await Future.wait([
        _loadFollowCounts(dbUserId),
        _loadMyPosts(dbUserId),
        if (hasArtistCapability(user?.role)) _loadCover(),
      ]);
    }
  }

  Future<void> _loadCover() async {
    try {
      final pro = await _feedService.getMeProfile();
      if (!mounted) return;
      setState(() => _heroImageUrl = pro.heroImageUrl);
    } catch (_) {
      // Cover is optional; profile still works without it.
    }
  }

  Future<void> _pickAndUploadCover() async {
    if (_isUploadingCover || !_canEditCover) return;
    final file = await ImageCropPicker.pickAndCrop(
      context: context,
      aspectRatio: ImageCropPicker.coverAspect,
      title: 'Crop cover photo',
    );
    if (file == null) return;

    final sizeBytes = await file.length();
    if (sizeBytes > 15 * 1024 * 1024) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cover image must be 15MB or smaller.')),
      );
      return;
    }

    setState(() => _isUploadingCover = true);
    try {
      final url = await _feedService.uploadCover(file);
      if (!mounted) return;
      setState(() => _heroImageUrl = url);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cover photo updated.')),
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException
          ? e.message
          : e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cover upload failed: $message')),
      );
    } finally {
      if (mounted) setState(() => _isUploadingCover = false);
    }
  }

  Future<void> _removeCover() async {
    if (_isUploadingCover || _heroImageUrl == null) return;
    setState(() => _isUploadingCover = true);
    try {
      await _feedService.clearCover();
      if (!mounted) return;
      setState(() => _heroImageUrl = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cover photo removed.')),
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is ApiException
          ? e.message
          : e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to remove cover: $message')),
      );
    } finally {
      if (mounted) setState(() => _isUploadingCover = false);
    }
  }

  Future<void> _loadMyPosts(String userId) async {
    setState(() => _loadingPosts = true);
    try {
      final res = await _feedService.listUserPosts(userId, limit: 24);
      if (!mounted) return;
      setState(() => _myPosts = res.items);
    } catch (_) {
      if (!mounted) return;
      setState(() => _myPosts = const []);
    } finally {
      if (mounted) setState(() => _loadingPosts = false);
    }
  }

  Future<void> _deleteMyPost(ProFeedPost post) async {
    final isVideo = post.mediaType == 'video';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isVideo ? 'Delete video?' : 'Delete post?'),
        content: Text(
          isVideo
              ? 'This removes your video from Discover/Feed for everyone.'
              : 'This removes it from the feed for everyone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _feedService.deleteFeedPost(post.id);
      if (!mounted) return;
      setState(() => _myPosts = _myPosts.where((p) => p.id != post.id).toList());
      SocialFeedRefresh.request();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isVideo ? 'Video deleted' : 'Post deleted')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not delete: $e')),
      );
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

  Future<void> _saveProfile() async {
    final user = _user;
    if (user == null || _isUpdatingProfile) return;
    final trimmedName = _nameCtrl.text.trim();
    if (trimmedName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Display name cannot be empty.')),
      );
      return;
    }
    final trimmedUsername = _usernameCtrl.text.trim().toLowerCase();
    final usernameChanged =
        trimmedUsername != (user.username ?? '').toLowerCase();
    if (usernameChanged &&
        trimmedUsername.isNotEmpty &&
        !RegExp(r'^[a-z0-9_.]{3,30}$').hasMatch(trimmedUsername)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Username must be 3-30 characters: lowercase letters, numbers, underscores, or dots.',
          ),
        ),
      );
      return;
    }
    setState(() => _isUpdatingProfile = true);
    try {
      if (usernameChanged && trimmedUsername.isNotEmpty) {
        final available =
            await _usersService.checkUsernameAvailable(trimmedUsername);
        if (!available) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('That username is already taken.')),
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
        headline: _headlineCtrl.text.trim(),
        bio: _bioCtrl.text.trim(),
        city: _cityCtrl.text.trim(),
        zipCode: _zipCtrl.text.trim(),
        instagramUrl: socialPatch(
          _instagramCtrl.text,
          user.instagramUrl ?? '',
        ),
        twitterUrl: socialPatch(
          _twitterCtrl.text,
          user.twitterUrl ?? '',
        ),
        tiktokUrl: socialPatch(
          _tiktokCtrl.text,
          user.tiktokUrl ?? '',
        ),
        youtubeUrl: socialPatch(
          _youtubeCtrl.text,
          user.youtubeUrl ?? '',
        ),
        websiteUrl: socialPatch(
          _websiteCtrl.text,
          user.websiteUrl ?? '',
        ),
        soundcloudUrl: socialPatch(
          _soundcloudCtrl.text,
          user.soundcloudUrl ?? '',
        ),
        spotifyUrl: socialPatch(
          _spotifyCtrl.text,
          user.spotifyUrl ?? '',
        ),
        appleMusicUrl: socialPatch(
          _appleMusicCtrl.text,
          user.appleMusicUrl ?? '',
        ),
        facebookUrl: socialPatch(
          _facebookCtrl.text,
          user.facebookUrl ?? '',
        ),
        snapchatUrl: socialPatch(
          _snapchatCtrl.text,
          user.snapchatUrl ?? '',
        ),
      );
      _formDirty = false;
      if (!mounted) return;
      await _loadProfile();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated.')),
      );
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update profile: $msg')),
      );
    } finally {
      if (mounted) {
        setState(() => _isUpdatingProfile = false);
      }
    }
  }

  List<Widget> _profileFields() {
    Widget field(
      TextEditingController controller, {
      required String label,
      String? helper,
      String? hint,
      String? prefix,
      TextInputType? keyboardType,
      TextCapitalization capitalization = TextCapitalization.none,
      bool autocorrect = true,
      int minLines = 1,
      int maxLines = 1,
    }) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: controller,
          keyboardType: keyboardType,
          textCapitalization: capitalization,
          autocorrect: autocorrect,
          minLines: minLines,
          maxLines: maxLines,
          decoration: InputDecoration(
            labelText: label,
            helperText: helper,
            hintText: hint,
            prefixText: prefix,
          ),
        ),
      );
    }

    return [
      field(_nameCtrl, label: 'Display name', capitalization: TextCapitalization.words),
      field(
        _usernameCtrl,
        label: 'Username',
        prefix: '@',
        helper: 'Your unique handle, separate from display name.',
        autocorrect: false,
      ),
      field(_headlineCtrl, label: 'Headline', capitalization: TextCapitalization.sentences),
      field(
        _cityCtrl,
        label: 'City',
        helper: 'Used for grouping in Nearby. Map area comes from ZIP.',
        capitalization: TextCapitalization.words,
      ),
      field(
        _zipCtrl,
        label: 'ZIP / postal code',
        helper:
            'Sets your approximate map area. The pin is deliberately shifted — never your exact address.',
        keyboardType: TextInputType.number,
      ),
      field(_bioCtrl, label: 'Bio', minLines: 3, maxLines: 5, capitalization: TextCapitalization.sentences),
      field(_instagramCtrl, label: 'Instagram', hint: 'https://instagram.com/you, @you, or handle', keyboardType: TextInputType.url, autocorrect: false),
      field(_twitterCtrl, label: 'X / Twitter', hint: 'https://twitter.com/you', keyboardType: TextInputType.url, autocorrect: false),
      field(_tiktokCtrl, label: 'TikTok', hint: 'https://www.tiktok.com/@you', keyboardType: TextInputType.url, autocorrect: false),
      field(_youtubeCtrl, label: 'YouTube', hint: 'https://www.youtube.com/@you', keyboardType: TextInputType.url, autocorrect: false),
      field(_soundcloudCtrl, label: 'SoundCloud', hint: 'https://soundcloud.com/you', keyboardType: TextInputType.url, autocorrect: false),
      field(_spotifyCtrl, label: 'Spotify', hint: 'https://open.spotify.com/artist/...', keyboardType: TextInputType.url, autocorrect: false),
      field(_appleMusicCtrl, label: 'Apple Music', hint: 'https://music.apple.com/...', keyboardType: TextInputType.url, autocorrect: false),
      field(_facebookCtrl, label: 'Facebook', hint: 'https://facebook.com/you', keyboardType: TextInputType.url, autocorrect: false),
      field(_snapchatCtrl, label: 'Snapchat', hint: 'https://www.snapchat.com/add/you', keyboardType: TextInputType.url, autocorrect: false),
      field(_websiteCtrl, label: 'Website', hint: 'https://your-site.com', keyboardType: TextInputType.url, autocorrect: false),
      const SizedBox(height: 4),
      FilledButton(
        onPressed: _isUpdatingProfile ? null : _saveProfile,
        child: _isUpdatingProfile
            ? const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Save changes'),
      ),
    ];
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
                                          onTap: () {
                                            final artistId = item.id.trim();
                                            if (artistId.isEmpty) return;
                                            // Close the sheet, then open profile
                                            // on the root stack so back returns
                                            // to Profile (not an empty sheet).
                                            Navigator.of(context).pop();
                                            AppRoutes.openArtistProfile(
                                              this.context,
                                              artistId: artistId,
                                            );
                                          },
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
              ? ErrorState(
                  message: 'We could not load your profile.',
                  onRetry: _loadProfile,
                )
              : RefreshIndicator(
                  onRefresh: _loadProfile,
                  child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_canEditCover) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: AspectRatio(
                          aspectRatio: 16 / 6,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (_heroImageUrl != null &&
                                  _heroImageUrl!.isNotEmpty)
                                CachedNetworkImage(
                                  imageUrl: _heroImageUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (context, url, error) => Container(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest,
                                    alignment: Alignment.center,
                                    child: Icon(
                                      Icons.image_outlined,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                                  ),
                                )
                              else
                                Container(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .surfaceContainerHighest,
                                  alignment: Alignment.center,
                                  child: Text(
                                    'Cover photo',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                  ),
                                ),
                              if (_isUploadingCover)
                                Container(
                                  color: Colors.black38,
                                  alignment: Alignment.center,
                                  child: const SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Center(
                        child: Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _isUploadingCover
                                  ? null
                                  : _pickAndUploadCover,
                              icon: const Icon(Icons.crop_original_outlined),
                              label: Text(
                                _heroImageUrl == null
                                    ? 'Add cover photo'
                                    : 'Change cover',
                              ),
                            ),
                            if (_heroImageUrl != null)
                              TextButton(
                                onPressed:
                                    _isUploadingCover ? null : _removeCover,
                                child: const Text('Remove cover'),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
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
                    const SizedBox(height: 16),
                    ..._profileFields(),
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
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Your posts',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const Spacer(),
                                TextButton(
                                  onPressed: () {
                                    Navigator.of(context).pop();
                                    HomeTabIntent.openFeed();
                                  },
                                  child: const Text('Open Feed'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Videos and photos you share on Feed.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 10),
                            if (_loadingPosts)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 24),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              )
                            else if (_myPosts.isEmpty)
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                child: Text(
                                  'No posts yet. Create a video from Discover or tap Post on Feed.',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              )
                            else
                              GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: _myPosts.length,
                                gridDelegate:
                                    const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  crossAxisSpacing: 4,
                                  mainAxisSpacing: 4,
                                ),
                                itemBuilder: (context, i) {
                                  final post = _myPosts[i];
                                  return Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: post.mediaType == 'video'
                                            ? ColoredBox(
                                                color: Colors.black87,
                                                child: Stack(
                                                  fit: StackFit.expand,
                                                  children: [
                                                    // Videos don't have poster frames in storage;
                                                    // show a play affordance so the grid stays light.
                                                    const Center(
                                                      child: Icon(
                                                        Icons.play_circle_outline,
                                                        color: Colors.white70,
                                                        size: 28,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              )
                                            : CachedNetworkImage(
                                                imageUrl: post.imageUrl,
                                                fit: BoxFit.cover,
                                              ),
                                      ),
                                      Positioned(
                                        right: 4,
                                        top: 4,
                                        child: Material(
                                          color: Colors.black54,
                                          shape: const CircleBorder(),
                                          child: InkWell(
                                            customBorder: const CircleBorder(),
                                            onTap: () => _deleteMyPost(post),
                                            child: const Padding(
                                              padding: EdgeInsets.all(6),
                                              child: Icon(
                                                Icons.delete_outline,
                                                size: 18,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                },
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
                        title: const Text('Placements'),
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
              ),
    );
  }
}
