import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/auth/role_helpers.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/refinery_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';

class RefineryScreen extends StatefulWidget {
  const RefineryScreen({super.key});

  @override
  State<RefineryScreen> createState() => _RefineryScreenState();
}

class _RefineryScreenState extends State<RefineryScreen> {
  final RefineryService _refinery = RefineryService();

  bool _loading = true;
  bool _signingUp = false;
  bool _showHowItWorks = true;
  bool _isArtist = false;
  String? _error;
  RefineryReviewerStatus? _reviewer;
  List<RefinerySong> _songs = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final profile = await auth.getUserProfile();
      final status = await _refinery.getReviewerStatus();
      List<RefinerySong> songs = const [];
      if (status.isReviewer) {
        songs = await _refinery.listSongs();
      }
      if (!mounted) return;
      setState(() {
        _isArtist = hasArtistCapability(profile?.role);
        _reviewer = status;
        _songs = songs;
        // Keep explanation open until they become a reviewer.
        _showHowItWorks = !status.isReviewer;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _signUpReviewer() async {
    if (_signingUp) return;
    setState(() {
      _signingUp = true;
      _error = null;
    });
    try {
      await _refinery.signUpAsReviewer();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You’re signed up as a Refinery reviewer.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not sign you up. Please try again.');
    } finally {
      if (mounted) setState(() => _signingUp = false);
    }
  }

  Future<void> _openReview(RefinerySong song) async {
    if (song.id.isEmpty) return;
    final done = await Navigator.pushNamed(
      context,
      AppRoutes.refineryReview,
      arguments: song.id,
    );
    if (done == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Review submitted. You earned \$${RefineryProgram.reviewRewardUsd}.',
          ),
        ),
      );
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isReviewer = _reviewer?.isReviewer == true;
    return DimensionScreenShell(
      title: 'The Refinery',
      showNeonLine: true,
      loading: _loading,
      actions: [
        IconButton(
          tooltip: _showHowItWorks ? 'Hide explanation' : 'How it works',
          icon: Icon(_showHowItWorks ? Icons.info : Icons.info_outline),
          onPressed: () => setState(() => _showHowItWorks = !_showHowItWorks),
        ),
        IconButton(
          icon: const Icon(Icons.refresh),
          onPressed: _loading ? null : _load,
        ),
      ],
      body: _error != null && !isReviewer && _songs.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    isReviewer
                        ? 'Listen, answer the survey, and earn \$${RefineryProgram.reviewRewardUsd} per review.'
                        : 'In-depth, paid song reviews. Artists get structured feedback; reviewers earn rewards.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  if (_showHowItWorks) ...[
                    const SizedBox(height: 16),
                    const _RefineryHowItWorksCard(),
                  ],
                  if (!isReviewer) ...[
                    const SizedBox(height: 16),
                    _ReviewerSignupCard(
                      signingUp: _signingUp,
                      onSignup: _signUpReviewer,
                      showArtistHint: _isArtist,
                      onOpenStudio: () =>
                          Navigator.pushNamed(context, AppRoutes.studio),
                    ),
                  ] else ...[
                    const SizedBox(height: 16),
                    if (_isArtist)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              Navigator.pushNamed(context, AppRoutes.studio),
                          icon: const Icon(Icons.library_music_outlined),
                          label: const Text('Submit a song from Studio'),
                        ),
                      ),
                    if (_reviewer != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Reviews you’ve done: ${_reviewer!.totalReviews}  ·  Songs in queue: ${_songs.length}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    if (_songs.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 32),
                        child: Column(
                          children: [
                            Text(
                              'No songs in The Refinery right now.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Check back soon — new tracks enter the queue as artists submit them.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._songs.map(
                        (song) => _RefinerySongCard(
                          song: song,
                          onReview: () => _openReview(song),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _RefineryHowItWorksCard extends StatelessWidget {
  const _RefineryHowItWorksCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How it works', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            Text('For artists', style: theme.textTheme.titleSmall),
            const SizedBox(height: 6),
            _bullet(
              context,
              'Submit any of your songs to The Refinery for '
              '${RefineryProgram.submissionOriginalPriceUsd} '
              '→ \$${RefineryProgram.submissionPriceUsd}.',
              muted,
            ),
            _bullet(
              context,
              'Add up to ${RefineryProgram.maxCustomQuestions} of your own custom questions for reviewers.',
              muted,
            ),
            _bullet(
              context,
              'Get a guaranteed minimum of ${RefineryProgram.minReviews} in-depth reviews from verified reviewers.',
              muted,
            ),
            _bullet(
              context,
              'See analytics: ratings, survey distributions, outliers, and every individual review.',
              muted,
            ),
            _bullet(
              context,
              'Private songs are eligible too — reviewers can hear them even when they’re hidden from radio.',
              muted,
            ),
            const SizedBox(height: 14),
            Text('For reviewers', style: theme.textTheme.titleSmall),
            const SizedBox(height: 6),
            _bullet(
              context,
              'Sign up below — you’re accepted automatically.',
              muted,
            ),
            _bullet(
              context,
              'Listen to songs in the queue and answer rating questions (1–10), survey questions, and the artist’s custom questions.',
              muted,
            ),
            _bullet(
              context,
              'Earn \$${RefineryProgram.reviewRewardUsd} per completed review, redeemable for rewards / gift cards via The Yield.',
              muted,
            ),
            _bullet(
              context,
              'Songs are shuffled fairly — every artist gets reviews over time.',
              muted,
            ),
          ],
        ),
      ),
    );
  }

  Widget _bullet(BuildContext context, String text, Color muted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('•  ', style: TextStyle(color: muted, height: 1.35)),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: muted,
                    height: 1.35,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewerSignupCard extends StatelessWidget {
  const _ReviewerSignupCard({
    required this.signingUp,
    required this.onSignup,
    required this.showArtistHint,
    required this.onOpenStudio,
  });

  final bool signingUp;
  final VoidCallback onSignup;
  final bool showArtistHint;
  final VoidCallback onOpenStudio;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.primary.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text(
              'Become a reviewer',
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Earn rewards while helping artists improve their music.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: signingUp ? null : onSignup,
              child: Text(signingUp ? 'Signing up…' : 'Sign up as a reviewer'),
            ),
            if (showArtistHint) ...[
              const SizedBox(height: 12),
              Text(
                'You’re an artist — submit tracks for review from Studio.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
              ),
              TextButton(
                onPressed: onOpenStudio,
                child: const Text('Open Studio'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RefinerySongCard extends StatelessWidget {
  const _RefinerySongCard({
    required this.song,
    required this.onReview,
  });

  final RefinerySong song;
  final VoidCallback onReview;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            if (song.artworkUrl != null && song.artworkUrl!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  song.artworkUrl!,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                ),
              )
            else
              const SizedBox(
                width: 56,
                height: 56,
                child: Icon(Icons.music_note, size: 32),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(song.title, style: theme.textTheme.titleMedium),
                  Text(
                    song.artistName,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton(
              onPressed: onReview,
              child: const Text('Review'),
            ),
          ],
        ),
      ),
    );
  }
}
