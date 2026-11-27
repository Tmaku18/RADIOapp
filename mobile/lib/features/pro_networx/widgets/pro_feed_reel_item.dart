import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/auth/require_account.dart';
import '../../../core/auth/role_helpers.dart';
import '../../../core/models/pro_networx_models.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/pro_networx_service.dart';
import '../../../core/services/users_service.dart';
import '../../../widgets/safety/report_block_sheet.dart';
import 'pro_network_paywall_sheet.dart';
import 'reel_media.dart';
import 'share_post_sheet.dart';

/// Who is signed in, fetched once and shared by every reel on screen.
class _ReelViewer {
  const _ReelViewer(this.userId, this.isAdmin);

  final String? userId;
  final bool isAdmin;
}

Future<_ReelViewer>? _viewerFuture;

Future<_ReelViewer> _loadViewer(BuildContext context) {
  final auth = Provider.of<AuthService>(context, listen: false);
  return _viewerFuture ??= () async {
    try {
      // /users/me returns the database uuid that post.authorUserId uses.
      final me = await UsersService().getMe();
      return _ReelViewer(
        me['id']?.toString(),
        isAdminRole(me['role']?.toString()),
      );
    } catch (_) {
      try {
        final profile = await auth.getUserProfile();
        if (profile != null) {
          return _ReelViewer(profile.id, isAdminRole(profile.role));
        }
      } catch (_) {}
      _viewerFuture = null;
      return const _ReelViewer(null, false);
    }
  }();
}

/// One full-screen post in the vertical reels feed: media edge to edge, the
/// author and caption bottom-left, and like / comment / share / save on the
/// right.
class ProFeedReelItem extends StatefulWidget {
  const ProFeedReelItem({
    super.key,
    required this.post,
    required this.active,
    required this.onChange,
    this.onDeleted,
  });

  final ProFeedPost post;

  /// True only for the reel the viewer is looking at.
  final bool active;
  final ValueChanged<ProFeedPost> onChange;
  final VoidCallback? onDeleted;

  @override
  State<ProFeedReelItem> createState() => _ProFeedReelItemState();
}

class _ProFeedReelItemState extends State<ProFeedReelItem> {
  final ProNetworxService _service = ProNetworxService();
  String? _myUserId;
  bool _isAdmin = false;
  bool _busy = false;
  bool _paused = false;
  bool _heartVisible = false;
  bool _captionExpanded = false;
  Timer? _heartTimer;

  bool get _isVideo => widget.post.mediaType == 'video';
  bool get _isAudio =>
      widget.post.mediaType == 'audio' &&
      (widget.post.audioUrl?.isNotEmpty ?? false);

  @override
  void initState() {
    super.initState();
    unawaited(_loadMe());
  }

  Future<void> _loadMe() async {
    final viewer = await _loadViewer(context);
    if (!mounted) return;
    setState(() {
      _myUserId = viewer.userId;
      _isAdmin = viewer.isAdmin;
    });
  }

  @override
  void didUpdateWidget(covariant ProFeedReelItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Leaving a reel resets any tap-to-pause so it plays again on return.
    if (oldWidget.active && !widget.active) {
      _paused = false;
      _captionExpanded = false;
    }
  }

  @override
  void dispose() {
    _heartTimer?.cancel();
    super.dispose();
  }

  void _onTap() {
    if (_isAudio && ReelSound.muted.value) {
      ReelSound.muted.value = false;
      setState(() => _paused = false);
      return;
    }
    if (_isVideo || _isAudio) setState(() => _paused = !_paused);
  }

  Future<void> _onDoubleTap() async {
    HapticFeedback.lightImpact();
    _heartTimer?.cancel();
    setState(() => _heartVisible = true);
    _heartTimer = Timer(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _heartVisible = false);
    });
    if (!widget.post.likedByMe) await _toggleLike();
  }

  Future<void> _toggleLike() async {
    if (_busy) return;
    if (!await requireAccount(context)) return;
    final post = widget.post;
    final wasLiked = post.likedByMe;
    setState(() {
      _busy = true;
      post.likedByMe = !wasLiked;
      post.likeCount = (post.likeCount + (post.likedByMe ? 1 : -1)).clamp(
        0,
        1 << 31,
      );
    });
    widget.onChange(post);
    try {
      if (post.likedByMe) {
        await _service.likePost(post.id);
      } else {
        await _service.unlikePost(post.id);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          post.likedByMe = wasLiked;
          post.likeCount = (post.likeCount + (post.likedByMe ? 1 : -1)).clamp(
            0,
            1 << 31,
          );
        });
        widget.onChange(post);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleBookmark() async {
    final post = widget.post;
    final wasBookmarked = post.bookmarkedByMe;
    setState(() => post.bookmarkedByMe = !wasBookmarked);
    widget.onChange(post);
    try {
      if (post.bookmarkedByMe) {
        await _service.bookmarkPost(post.id);
      } else {
        await _service.unbookmarkPost(post.id);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => post.bookmarkedByMe = wasBookmarked);
      widget.onChange(post);
    }
  }

  Future<void> _confirmDelete() async {
    final isVideo = _isVideo;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isVideo ? 'Delete video?' : 'Delete post?'),
        content: Text(
          isVideo
              ? 'This removes your video from Discover/Feed for everyone.'
              : 'This removes the post from the feed for everyone.',
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
    if (ok != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _service.deleteFeedPost(widget.post.id);
      messenger.showSnackBar(
        SnackBar(content: Text(isVideo ? 'Video deleted' : 'Post deleted')),
      );
      widget.onDeleted?.call();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Could not delete: $e')));
    }
  }

  Future<void> _openComments() async {
    // Keep the clip from fighting the keyboard for attention.
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ReelCommentsSheet(
        post: widget.post,
        myUserId: _myUserId,
        service: _service,
        onCountChanged: () {
          if (mounted) setState(() {});
          widget.onChange(widget.post);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final post = widget.post;
    final canDelete =
        _myUserId != null && (_myUserId == post.authorUserId || _isAdmin);
    final caption = (post.caption ?? '').trim();
    final audible = _isVideo || _isAudio;
    final showPlayHint = _paused || (_isAudio && ReelSound.muted.value);

    return Stack(
      fit: StackFit.expand,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _onTap,
          onDoubleTap: _onDoubleTap,
          child: ClipRect(
            child: _isVideo
                ? ReelVideo(
                    url: post.imageUrl,
                    active: widget.active,
                    paused: _paused,
                  )
                : _isAudio
                ? ReelAudio(
                    audioUrl: post.audioUrl!,
                    coverUrl: post.imageUrl,
                    active: widget.active,
                    paused: _paused,
                  )
                : ReelImage(url: post.imageUrl),
          ),
        ),
        // Dark edges keep white text readable over bright media.
        IgnorePointer(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.35),
                  Colors.transparent,
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.75),
                ],
                stops: const [0, 0.18, 0.55, 1],
              ),
            ),
          ),
        ),
        if (showPlayHint)
          IgnorePointer(
            child: Center(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: const BoxDecoration(
                  color: Colors.black45,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  size: 56,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        IgnorePointer(
          child: Center(
            child: AnimatedOpacity(
              opacity: _heartVisible ? 1 : 0,
              duration: const Duration(milliseconds: 160),
              child: AnimatedScale(
                scale: _heartVisible ? 1 : 0.5,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutBack,
                child: const Icon(
                  Icons.favorite,
                  size: 120,
                  color: Colors.redAccent,
                  shadows: [Shadow(blurRadius: 24, color: Colors.black54)],
                ),
              ),
            ),
          ),
        ),
        // Author + caption.
        Positioned(
          left: 14,
          right: 84,
          bottom: 18,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.proProfile, arguments: post.authorUserId),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: Colors.white24,
                      backgroundImage: (post.authorAvatarUrl ?? '').isNotEmpty
                          ? CachedNetworkImageProvider(post.authorAvatarUrl!)
                          : null,
                      child: (post.authorAvatarUrl ?? '').isEmpty
                          ? const Icon(
                              Icons.brush,
                              size: 18,
                              color: Colors.white,
                            )
                          : null,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            post.authorDisplayName ?? 'Creator',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              shadows: const [
                                Shadow(blurRadius: 8, color: Colors.black87),
                              ],
                            ),
                          ),
                          if ((post.authorHeadline ?? '').isNotEmpty)
                            Text(
                              post.authorHeadline!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.white70,
                                shadows: const [
                                  Shadow(blurRadius: 8, color: Colors.black87),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (_isAudio) ...[
                const SizedBox(height: 8),
                const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.music_note, size: 14, color: Colors.white70),
                    SizedBox(width: 4),
                    Text(
                      'Original audio',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ],
              if (caption.isNotEmpty) ...[
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () =>
                      setState(() => _captionExpanded = !_captionExpanded),
                  child: Text(
                    caption,
                    maxLines: _captionExpanded ? 8 : 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white,
                      shadows: const [
                        Shadow(blurRadius: 8, color: Colors.black87),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        // Action rail.
        Positioned(
          right: 8,
          bottom: 14,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _RailButton(
                icon: post.likedByMe ? Icons.favorite : Icons.favorite_border,
                color: post.likedByMe ? Colors.redAccent : Colors.white,
                label: '${post.likeCount}',
                tooltip: post.likedByMe ? 'Unlike' : 'Like',
                onTap: _busy ? null : _toggleLike,
              ),
              _RailButton(
                icon: Icons.mode_comment_outlined,
                label: '${post.commentCount}',
                tooltip: 'Comments',
                onTap: _openComments,
              ),
              _RailButton(
                icon: Icons.send_outlined,
                label: 'Share',
                tooltip: 'Share with friends',
                onTap: () => SharePostSheet.show(context, post),
              ),
              _RailButton(
                icon: post.bookmarkedByMe
                    ? Icons.bookmark
                    : Icons.bookmark_border,
                label: post.bookmarkedByMe ? 'Saved' : 'Save',
                tooltip: post.bookmarkedByMe ? 'Saved' : 'Save',
                onTap: _toggleBookmark,
              ),
              if (audible)
                ValueListenableBuilder<bool>(
                  valueListenable: ReelSound.muted,
                  builder: (_, muted, _) => _RailButton(
                    icon: muted ? Icons.volume_off : Icons.volume_up,
                    tooltip: muted ? 'Turn sound on' : 'Turn sound off',
                    onTap: () {
                      ReelSound.muted.value = !muted;
                      // Turning sound on also resumes a clip paused by a tap.
                      if (muted && _paused) setState(() => _paused = false);
                    },
                  ),
                ),
              if (canDelete)
                _RailButton(
                  icon: Icons.delete_outline,
                  color: Colors.redAccent,
                  tooltip: _isVideo ? 'Delete video' : 'Delete post',
                  onTap: _confirmDelete,
                )
              else if (post.authorUserId.isNotEmpty)
                _RailButton(
                  icon: Icons.more_vert,
                  tooltip: 'Report or block',
                  onTap: () => ReportBlockSheet.show(
                    context,
                    userId: post.authorUserId,
                    displayName: post.authorDisplayName,
                    postId: post.id,
                    contextType: 'post',
                    contextId: post.id,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RailButton extends StatelessWidget {
  const _RailButton({
    required this.icon,
    required this.onTap,
    this.label,
    this.tooltip,
    this.color = Colors.white,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final String? label;
  final String? tooltip;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final button = InkResponse(
      onTap: onTap,
      radius: 28,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 32,
              color: color,
              shadows: const [Shadow(blurRadius: 10, color: Colors.black87)],
            ),
            if (label != null) ...[
              const SizedBox(height: 2),
              Text(
                label!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  shadows: [Shadow(blurRadius: 8, color: Colors.black87)],
                ),
              ),
            ],
          ],
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

/// Comments for a reel, in a bottom sheet so the clip keeps playing behind it.
class _ReelCommentsSheet extends StatefulWidget {
  const _ReelCommentsSheet({
    required this.post,
    required this.myUserId,
    required this.service,
    required this.onCountChanged,
  });

  final ProFeedPost post;
  final String? myUserId;
  final ProNetworxService service;
  final VoidCallback onCountChanged;

  @override
  State<_ReelCommentsSheet> createState() => _ReelCommentsSheetState();
}

class _ReelCommentsSheetState extends State<_ReelCommentsSheet> {
  final TextEditingController _controller = TextEditingController();
  List<ProFeedComment>? _comments;
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await widget.service.listComments(widget.post.id);
      if (!mounted) return;
      setState(() => _comments = list);
    } catch (_) {
      if (!mounted) return;
      setState(() => _comments = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final created = await widget.service.createComment(widget.post.id, text);
      if (!mounted) return;
      setState(() {
        _comments = [...?_comments, created];
        widget.post.commentCount += 1;
        _controller.clear();
      });
      widget.onCountChanged();
    } on ApiException catch (e) {
      // Commenting is a paid Pro-Networx feature; reading stays free.
      final requiresSub =
          e.statusCode == 403 &&
          (e.responseBody?.contains('PRO_NETWORK_SUBSCRIPTION_REQUIRED') ??
              false);
      if (requiresSub && mounted) {
        final subscribed = await ProNetworkPaywallSheet.show(
          context,
          title: 'Subscribe to comment',
          description:
              'Reading comments is free. Commenting unlocks with a '
              'Pro-Networx subscription. Cancel anytime.',
        );
        if (subscribed == true && mounted) {
          if (mounted) setState(() => _sending = false);
          await _send();
          return;
        }
      }
    } catch (_) {
      // The text stays in the field so the viewer can retry.
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _onLongPress(ProFeedComment c) async {
    final mine = widget.myUserId != null && c.authorUserId == widget.myUserId;
    if (mine) {
      final messenger = ScaffoldMessenger.of(context);
      try {
        await widget.service.deleteComment(c.id);
        if (!mounted) return;
        setState(() {
          _comments = _comments?.where((item) => item.id != c.id).toList();
          widget.post.commentCount = (widget.post.commentCount - 1).clamp(
            0,
            1 << 31,
          );
        });
        widget.onCountChanged();
      } catch (_) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Could not delete that comment.')),
        );
      }
      return;
    }
    await ReportBlockSheet.show(
      context,
      userId: c.authorUserId,
      displayName: c.authorDisplayName,
      contextType: 'comment',
      contextId: c.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final media = MediaQuery.of(context);
    final comments = _comments ?? const <ProFeedComment>[];

    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: Container(
        height: media.size.height * 0.65,
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Comments',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : comments.isEmpty
                  ? Center(
                      child: Text(
                        'Be the first to comment.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(14),
                      itemCount: comments.length,
                      itemBuilder: (_, i) {
                        final c = comments[i];
                        return GestureDetector(
                          onLongPress: () => _onLongPress(c),
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CircleAvatar(
                                  radius: 14,
                                  backgroundColor: cs.surfaceContainerHighest,
                                  backgroundImage:
                                      (c.authorAvatarUrl ?? '').isNotEmpty
                                      ? CachedNetworkImageProvider(
                                          c.authorAvatarUrl!,
                                        )
                                      : null,
                                  child: (c.authorAvatarUrl ?? '').isEmpty
                                      ? const Icon(Icons.person, size: 14)
                                      : null,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        c.authorDisplayName ?? 'Creator',
                                        style: theme.textTheme.labelMedium
                                            ?.copyWith(
                                              fontWeight: FontWeight.w700,
                                              color: cs.onSurfaceVariant,
                                            ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        c.body,
                                        style: theme.textTheme.bodyMedium,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const Divider(height: 1),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        textInputAction: TextInputAction.send,
                        decoration: const InputDecoration(
                          hintText: 'Add a comment…',
                          isDense: true,
                          border: InputBorder.none,
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    TextButton(
                      onPressed: _sending ? null : _send,
                      child: const Text('Post'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
