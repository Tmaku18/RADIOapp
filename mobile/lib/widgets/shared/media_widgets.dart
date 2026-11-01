import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Avatar with a letter fallback when there is no photo.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    this.imageUrl,
    this.name,
    this.radius = 20,
  });

  final String? imageUrl;
  final String? name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final initial = (name ?? '').trim().isEmpty
        ? '?'
        : name!.trim().characters.first.toUpperCase();
    final url = (imageUrl ?? '').trim();
    return CircleAvatar(
      radius: radius,
      backgroundImage: url.isEmpty ? null : CachedNetworkImageProvider(url),
      child: url.isEmpty ? Text(initial) : null,
    );
  }
}

/// Cached artwork with a quiet placeholder.
class ArtworkImage extends StatelessWidget {
  const ArtworkImage({
    super.key,
    required this.url,
    this.borderRadius = 8,
  });

  final String? url;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final resolved = (url ?? '').trim();
    final placeholder = ColoredBox(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Icon(Icons.music_note_outlined),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: resolved.isEmpty
          ? placeholder
          : CachedNetworkImage(
              imageUrl: resolved,
              fit: BoxFit.cover,
              placeholder: (_, imageUrl) => placeholder,
              errorWidget: (_, imageUrl, error) => placeholder,
            ),
    );
  }
}

/// One row for a song in a list.
class SongTile extends StatelessWidget {
  const SongTile({
    super.key,
    required this.title,
    required this.artist,
    this.artworkUrl,
    this.onTap,
  });

  final String title;
  final String artist;
  final String? artworkUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: SizedBox(
        width: 48,
        height: 48,
        child: ArtworkImage(url: artworkUrl),
      ),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(artist, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}
