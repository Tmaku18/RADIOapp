import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/models/pro_networx_models.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/services/pro_networx_service.dart';

class ProFeedPostCard extends StatefulWidget {
  const ProFeedPostCard({
    super.key,
    required this.post,
    required this.onChange,
    this.expandedComments = false,
  });

  final ProFeedPost post;
  final ValueChanged<ProFeedPost> onChange;
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

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
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
    } catch (_) {
      // ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final post = widget.post;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => Navigator.of(context).pushNamed(
              AppRoutes.proProfile,
              arguments: post.authorUserId,
            ),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: cs.surfaceContainerHighest,
                    backgroundImage:
                        post.authorAvatarUrl != null && post.authorAvatarUrl!.isNotEmpty
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
          AspectRatio(
            aspectRatio: 1,
            child: post.mediaType == 'video'
                ? Container(
                    color: Colors.black,
                    alignment: Alignment.center,
                    child: const Icon(Icons.play_circle_outline,
                        size: 64, color: Colors.white70),
                  )
                : CachedNetworkImage(
                    imageUrl: post.imageUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, _) => Container(color: cs.surfaceContainerHighest),
                    errorWidget: (_, _, _) => Container(
                      color: cs.surfaceContainerHighest,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
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
