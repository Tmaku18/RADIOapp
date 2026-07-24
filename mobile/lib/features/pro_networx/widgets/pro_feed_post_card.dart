import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/auth/role_helpers.dart';
import '../../../core/models/pro_networx_models.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/pro_networx_service.dart';
import '../../../core/services/users_service.dart';
import 'feed_post_video.dart';
import 'pro_network_paywall_sheet.dart';
import 'share_post_sheet.dart';

class ProFeedPostCard extends StatefulWidget {
  const ProFeedPostCard({
    super.key,
    required this.post,
    required this.onChange,
    this.onDeleted,
    this.expandedComments = false,
  });

  final ProFeedPost post;
  final ValueChanged<ProFeedPost> onChange;
  final VoidCallback? onDeleted;
  final bool expandedComments;

  @override
  State<ProFeedPostCard> createState() => _ProFeedPostCardState();
}

class _ProFeedPostCardState extends State<ProFeedPostCard> {
  final ProNetworxService _service = ProNetworxService();
  late bool _showComments = widget.expandedComments;
  List<ProFeedComment>? _comments;
  bool _loadingComments = false;
  final TextEditingController _commentController = TextEditingController();
  bool _busy = false;
  String? _myUserId;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _loadMe();
  }

  Future<void> _loadMe() async {
    try {
      // Prefer /users/me so we get the DB uuid (not a Firebase-uid fallback),
      // which must match post.authorUserId for delete to appear.
      final me = await UsersService().getMe();
      if (!mounted) return;
      setState(() {
        _myUserId = me['id']?.toString();
        _isAdmin = isAdminRole(me['role']?.toString());
      });
    } catch (_) {
      try {
        final me = await Provider.of<AuthService>(context, listen: false)
            .getUserProfile();
        if (!mounted || me == null) return;
        setState(() {
          _myUserId = me.id;
          _isAdmin = isAdminRole(me.role);
        });
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _confirmDelete() async {
    final isVideo = widget.post.mediaType == 'video';
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
    try {
      await _service.deleteFeedPost(widget.post.id);
      if (!mounted) return;
      widget.onDeleted?.call();
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

  Future<void> _toggleLike() async {
    if (_busy) return;
    final post = widget.post;
    final wasLiked = post.likedByMe;
    setState(() {
      _busy = true;
      post.likedByMe = !wasLiked;
      post.likeCount =
          (post.likeCount + (post.likedByMe ? 1 : -1)).clamp(0, 1 << 31);
    });
    widget.onChange(post);
    try {
      if (post.likedByMe) {
        await _service.likePost(post.id);
      } else {
        await _service.unlikePost(post.id);
      }
    } catch (_) {
      setState(() {
        post.likedByMe = wasLiked;
        post.likeCount =
            (post.likeCount + (post.likedByMe ? 1 : -1)).clamp(0, 1 << 31);
      });
      widget.onChange(post);
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

  void _openShare() {
    SharePostSheet.show(context, widget.post);
  }

  Future<void> _ensureComments() async {
    if (_comments != null) return;
    setState(() => _loadingComments = true);
    try {
      final list = await _service.listComments(widget.post.id);
      if (!mounted) return;
      setState(() => _comments = list);
    } catch (_) {
      if (!mounted) return;
      setState(() => _comments = const []);
    } finally {
      if (mounted) setState(() => _loadingComments = false);
    }
  }

  Future<void> _toggleComments() async {
    setState(() => _showComments = !_showComments);
    if (_showComments) await _ensureComments();
  }

  Future<void> _postComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;
    try {
      final created = await _service.createComment(widget.post.id, text);
      if (!mounted) return;
      setState(() {
        _comments = [...?_comments, created];
        widget.post.commentCount += 1;
        _commentController.clear();
      });
      widget.onChange(widget.post);
    } on ApiException catch (e) {
      // Commenting is a paid Pro-Networx feature; reading stays free.
      final requiresSub = e.statusCode == 403 &&
          (e.responseBody?.contains('PRO_NETWORK_SUBSCRIPTION_REQUIRED') ??
              false);
      if (requiresSub && mounted) {
        final subscribed = await ProNetworkPaywallSheet.show(
          context,
          title: 'Subscribe to comment',
          description: 'Reading comments is free. Commenting unlocks with a '
              'Pro-Networx subscription. Cancel anytime.',
        );
        if (subscribed == true && mounted) {
          await _postComment();
        }
      }
    } catch (_) {
      // ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final post = widget.post;
    final canDelete =
        _myUserId != null &&
        (_myUserId == post.authorUserId || _isAdmin);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? cs.surface.withValues(alpha: 0.62) : cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => Navigator.of(context).pushNamed(
                      AppRoutes.proProfile,
                      arguments: post.authorUserId,
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: cs.surfaceContainerHighest,
                          backgroundImage:
                              post.authorAvatarUrl != null &&
                                  post.authorAvatarUrl!.isNotEmpty
                              ? CachedNetworkImageProvider(post.authorAvatarUrl!)
                              : null,
                          child: (post.authorAvatarUrl == null ||
                                  post.authorAvatarUrl!.isEmpty)
                              ? const Icon(Icons.brush, size: 18)
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                post.authorDisplayName ?? 'Creator',
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if ((post.authorUsername ?? '').isNotEmpty)
                                Text(
                                  '@${post.authorUsername}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: cs.onSurfaceVariant,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              if ((post.authorHeadline ?? '').isNotEmpty)
                                Text(
                                  post.authorHeadline!,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: cs.onSurfaceVariant,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (canDelete)
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    tooltip: post.mediaType == 'video'
                        ? 'Delete video'
                        : 'Delete post',
                    color: cs.error,
                    onPressed: _confirmDelete,
                  ),
              ],
            ),
          ),
          AspectRatio(
            aspectRatio: 1,
            child: Stack(
              fit: StackFit.expand,
              children: [
                post.mediaType == 'video'
                    ? FeedPostVideo(url: post.imageUrl)
                    : CachedNetworkImage(
                        imageUrl: post.imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, _) =>
                            Container(color: cs.surfaceContainerHighest),
                        errorWidget: (_, _, _) => Container(
                          color: cs.surfaceContainerHighest,
                          alignment: Alignment.center,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
                if (canDelete)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Material(
                      color: Colors.black54,
                      shape: const CircleBorder(),
                      child: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        color: Colors.white,
                        tooltip: post.mediaType == 'video'
                            ? 'Delete video'
                            : 'Delete post',
                        onPressed: _confirmDelete,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconButton(
                      icon: Icon(
                        post.likedByMe ? Icons.favorite : Icons.favorite_border,
                        color: post.likedByMe ? Colors.redAccent : null,
                      ),
                      onPressed: _busy ? null : _toggleLike,
                    ),
                    Text('${post.likeCount}'),
                    const SizedBox(width: 12),
                    IconButton(
                      icon: const Icon(Icons.mode_comment_outlined),
                      onPressed: _toggleComments,
                    ),
                    Text('${post.commentCount}'),
                    const SizedBox(width: 12),
                    IconButton(
                      icon: const Icon(Icons.send_outlined),
                      tooltip: 'Share with friends',
                      onPressed: _openShare,
                    ),
                    const Spacer(),
                    IconButton(
                      icon: Icon(
                        post.bookmarkedByMe
                            ? Icons.bookmark
                            : Icons.bookmark_border,
                      ),
                      tooltip: post.bookmarkedByMe ? 'Saved' : 'Save',
                      onPressed: _toggleBookmark,
                    ),
                  ],
                ),
                if ((post.caption ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(post.caption!, style: theme.textTheme.bodyMedium),
                ],
                const SizedBox(height: 4),
                if (_showComments) ...[
                  const Divider(),
                  if (_loadingComments)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('Loading…'),
                    )
                  else if ((_comments ?? []).isEmpty)
                    Text(
                      'Be the first to comment.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                    )
                  else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: _comments!
                          .map(
                            (c) => Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: RichText(
                                text: TextSpan(
                                  style: theme.textTheme.bodySmall,
                                  children: [
                                    TextSpan(
                                      text: '${c.authorDisplayName ?? 'Creator'} ',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    TextSpan(text: c.body),
                                  ],
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _commentController,
                          decoration: const InputDecoration(
                            hintText: 'Add a comment…',
                            isDense: true,
                          ),
                          onSubmitted: (_) => _postComment(),
                        ),
                      ),
                      TextButton(
                        onPressed: _postComment,
                        child: const Text('Post'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
