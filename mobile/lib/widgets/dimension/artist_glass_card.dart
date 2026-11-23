import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'glass_card.dart';
import '../../core/theme/dimension_tokens.dart';

/// Artist result card matching the web song glass cards: artwork, rank,
/// name, and listen / like counts.
class ArtistGlassCard extends StatelessWidget {
  const ArtistGlassCard({
    super.key,
    required this.rank,
    required this.name,
    required this.onTap,
    this.subtitle = '',
    this.imageUrl,
    this.listens = 0,
    this.likes = 0,
  });

  final int rank;
  final String name;
  final String subtitle;
  final String? imageUrl;
  final int listens;
  final int likes;
  final VoidCallback onTap;

  static String formatCount(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final art = imageUrl?.trim() ?? '';
    final label = name.trim().isEmpty ? 'Artist' : name.trim();
    final line = subtitle.trim();

    return GlassCard(
      padding: EdgeInsets.zero,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (art.isNotEmpty)
                  CachedNetworkImage(imageUrl: art, fit: BoxFit.cover)
                else
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          DimensionTokens.neonCyan.withValues(alpha: 0.25),
                          DimensionTokens.bgSurface,
                          DimensionTokens.neonPink.withValues(alpha: 0.2),
                        ],
                      ),
                    ),
                    child: Center(
                      child: Text(
                        label[0].toUpperCase(),
                        style: TextStyle(
                          fontSize: 56,
                          fontWeight: FontWeight.w900,
                          color: Colors.white.withValues(alpha: 0.16),
                        ),
                      ),
                    ),
                  ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black54],
                      stops: [0.45, 1],
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Text(
                    '#${rank.toString().padLeft(2, '0')}',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
                if (line.isNotEmpty)
                  Text(
                    line,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 11,
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.headphones,
                      size: 12,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '${formatCount(listens)} listens',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.6),
                          fontSize: 11,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.favorite,
                      size: 12,
                      color: DimensionTokens.neonPink,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      formatCount(likes),
                      style: TextStyle(
                        color: DimensionTokens.neonPink,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
