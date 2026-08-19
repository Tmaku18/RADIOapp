import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/services/app_tutorial_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_extensions.dart';

enum TutorialNavTarget {
  home,
  radio,
  feed,
  discover,
  voteOrPro,
  upload,
  studio,
  proNetworx,
  proRadio,
  nearby,
  none,
}

class TutorialStep {
  const TutorialStep({
    required this.title,
    required this.body,
    this.nav = TutorialNavTarget.none,
  });

  final String title;
  final String body;
  final TutorialNavTarget nav;
}

/// Role-specific guided tour (overlay tip card + tab/route navigation).
class AppTutorial {
  AppTutorial._();

  static const replayHint =
      'You can replay this anytime in Settings → Help → App tour.';

  static OverlayEntry? _entry;
  static bool get isShowing => _entry != null;

  static List<TutorialStep> stepsForRole(String? role) {
    final creator = AppTutorialService.instance.isCreatorRole(role);
    return creator ? _artistSteps : _listenerSteps;
  }

  static const _listenerSteps = <TutorialStep>[
    TutorialStep(
      title: 'Welcome to Networx',
      body:
          'This is your home. Tap the menu (☰) anytime to open Radio, Feed, '
          'Discover, Vote, Pro-Radio, Pro-Networx, and more.',
      nav: TutorialNavTarget.home,
    ),
    TutorialStep(
      title: 'Radio',
      body:
          'Listen to live stations with everyone else in sync. Switch stations '
          'from Radio and keep the mini player going while you browse.',
      nav: TutorialNavTarget.radio,
    ),
    TutorialStep(
      title: 'Fire vs star',
      body:
          'On the radio bar: 🔥 likes a song (Library → Liked). '
          '⭐ favorites it for play alerts (Library → Favorites). '
          'Only stars trigger on-air / up-next notifications.',
      nav: TutorialNavTarget.radio,
    ),
    TutorialStep(
      title: 'Pro-Radio',
      body:
          'Want on-demand listening? Open Pro-Radio for full tracks, personal '
          'playlists, and your own queue. During beta, Pro-Radio and other '
          'subscriptions are unlocked for free so you can try everything.',
      nav: TutorialNavTarget.proRadio,
    ),
    TutorialStep(
      title: 'Feed',
      body:
          'See posts and short videos from the community. You can create clips '
          'from Discover and share them here.',
      nav: TutorialNavTarget.feed,
    ),
    TutorialStep(
      title: 'Discover',
      body:
          'Swipe short clips. Library holds Favorites, Liked (swipe history), '
          'Disliked, and My Music — no separate Saved tab.',
      nav: TutorialNavTarget.discover,
    ),
    TutorialStep(
      title: 'Vote & Trial by Fire',
      body:
          'Vote helps you climb as a listener. Ready to upload? Use Upload in '
          'the menu — Trial by Fire can upgrade you to artist when you qualify.',
      nav: TutorialNavTarget.voteOrPro,
    ),
    TutorialStep(
      title: 'Nearby Studios',
      body:
          'In Pro-Networx → Studios, open Nearby to browse rooms by list or '
          'map. Tap a banner for hours, rates, and who you can book.',
      nav: TutorialNavTarget.nearby,
    ),
    TutorialStep(
      title: 'Pro-Networx',
      body:
          'Browse creators, services, jobs, and messages. Offering your own '
          'services needs a creator account — upgrade when you’re ready, then '
          'finish your Pro profile. Messaging and Pro features are free during beta.',
      nav: TutorialNavTarget.proNetworx,
    ),
    TutorialStep(
      title: 'Songs vs beats',
      body:
          'Songs are for radio and Discover — you hear a short sample, then can '
          'buy the full track (or stream it with Pro-Radio when the artist opted in). '
          'Beats are instrumentals for sale in Pro-Networx: you can play the whole '
          'beat before you buy.',
      nav: TutorialNavTarget.proNetworx,
    ),
    TutorialStep(
      title: 'You’re set',
      body: 'That’s the tour.\n\n$replayHint',
      nav: TutorialNavTarget.home,
    ),
  ];

  static const _artistSteps = <TutorialStep>[
    TutorialStep(
      title: 'Welcome, creator',
      body:
          'Home is your dashboard. Open the menu (☰) for Upload, My Songs, '
          'Pro-Radio, Pro-Networx, Analytics, and more.',
      nav: TutorialNavTarget.home,
    ),
    TutorialStep(
      title: 'Radio',
      body:
          'Listen to live stations. When your tracks are in rotation, fans who '
          'starred them can get play alerts.',
      nav: TutorialNavTarget.radio,
    ),
    TutorialStep(
      title: 'Fire vs star',
      body:
          '🔥 = likes (Liked). ⭐ = Favorites + radio alerts. Use the star so '
          'listeners get notified when a track is about to play.',
      nav: TutorialNavTarget.radio,
    ),
    TutorialStep(
      title: 'Pro-Radio',
      body:
          'Listeners use Pro-Radio for on-demand play of songs you’ve opted in. '
          'During beta it’s free for everyone — opt your tracks into Pro-Radio '
          'on upload or song settings when you’re ready.',
      nav: TutorialNavTarget.proRadio,
    ),
    TutorialStep(
      title: 'Feed',
      body:
          'Post photos and short videos. You can delete your own posts from '
          'Feed or Profile → Your posts.',
      nav: TutorialNavTarget.feed,
    ),
    TutorialStep(
      title: 'Discover',
      body:
          'Swipe clips and check Library for Favorites and Liked. Short Discover '
          'clips from your uploads show up here after review.',
      nav: TutorialNavTarget.discover,
    ),
    TutorialStep(
      title: 'Songs vs beats',
      body:
          'On Upload, pick Song or Beat. Songs go toward radio and Discover — '
          'listeners get a short sample, then can buy the full track or stream '
          'with Pro-Radio if you opt in. Beats are instrumentals for the Beat '
          'Marketplace: buyers hear the whole beat before checkout.',
      nav: TutorialNavTarget.upload,
    ),
    TutorialStep(
      title: 'Upload a song',
      body:
          'For a Song: add your audio, title, city & state, pick stations, and '
          'accept the full-song radio opt-in. Add your ZIP in Profile for '
          'Nearby — map areas stay approximate, never a street address.',
      nav: TutorialNavTarget.upload,
    ),
    TutorialStep(
      title: 'Sample clip (required)',
      body:
          'For songs, tap “Set preview sample” and choose a 5–30 second window. '
          'That’s what listeners hear as a preview before buying or streaming full. '
          'Beats skip this — buyers already get a full listen.',
      nav: TutorialNavTarget.upload,
    ),
    TutorialStep(
      title: 'Discover clip (required)',
      body:
          'For songs, tap “Set Discover clip” and choose a 5–15 second window for '
          'the Discover swipe deck. Both clips are required before you can submit '
          'a song.',
      nav: TutorialNavTarget.upload,
    ),
    TutorialStep(
      title: 'Submit & My Songs',
      body:
          'Submit songs for review and rotation, or list beats for sale. Find '
          'uploads under My Songs → Tracks. Liked and Favorites are for songs '
          'you fire / star.',
      nav: TutorialNavTarget.studio,
    ),
    TutorialStep(
      title: 'Nearby Studios',
      body:
          'In Pro-Networx → Studios → Nearby, browse rooms by list or map. '
          'Open a studio for hours, pricing, and bookable producers.',
      nav: TutorialNavTarget.nearby,
    ),
    TutorialStep(
      title: 'Pro-Networx setup',
      body:
          'Open Pro-Networx and finish your profile — headline, skills, and '
          'availability — so you show in Explore and can offer services. '
          'Pro features are free during beta.',
      nav: TutorialNavTarget.proNetworx,
    ),
    TutorialStep(
      title: 'You’re set',
      body: 'That’s the creator tour.\n\n$replayHint',
      nav: TutorialNavTarget.home,
    ),
  ];

  /// Present the tour as a top overlay so tab/route changes stay visible underneath.
  static Future<void> show(
    BuildContext context, {
    required String? role,
    required void Function(int index) selectTab,
    required Future<void> Function(String route, [Object? arguments]) openRoute,
    Future<void> Function()? popToHome,
    int? proNetworxTabIndex,
    int? voteTabIndex,
    VoidCallback? onFinished,
  }) async {
    if (!context.mounted || isShowing) return;
    final steps = stepsForRole(role);
    if (steps.isEmpty) return;

    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    final completer = Completer<void>();

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => _TutorialOverlay(
        steps: steps,
        selectTab: selectTab,
        openRoute: openRoute,
        popToHome: popToHome,
        proNetworxTabIndex: proNetworxTabIndex,
        voteTabIndex: voteTabIndex,
        onClose: () {
          entry.remove();
          _entry = null;
          onFinished?.call();
          if (!completer.isCompleted) completer.complete();
        },
      ),
    );
    _entry = entry;
    overlay.insert(entry);
    return completer.future;
  }
}

class _TutorialOverlay extends StatefulWidget {
  const _TutorialOverlay({
    required this.steps,
    required this.selectTab,
    required this.openRoute,
    required this.onClose,
    this.popToHome,
    this.proNetworxTabIndex,
    this.voteTabIndex,
  });

  final List<TutorialStep> steps;
  final void Function(int index) selectTab;
  final Future<void> Function(String route, [Object? arguments]) openRoute;
  final Future<void> Function()? popToHome;
  final int? proNetworxTabIndex;
  final int? voteTabIndex;
  final VoidCallback onClose;

  @override
  State<_TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<_TutorialOverlay> {
  int _index = 0;
  bool _busy = false;
  bool _openedUpload = false;
  bool _openedProRadio = false;
  bool _openedNearby = false;

  TutorialStep get _step => widget.steps[_index];
  bool get _isLast => _index >= widget.steps.length - 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_applyNav(_step.nav));
    });
  }

  Future<void> _popExtraRoutes() async {
    if (widget.popToHome != null) {
      await widget.popToHome!();
    }
    _openedUpload = false;
    _openedProRadio = false;
    _openedNearby = false;
  }

  Future<void> _applyNav(TutorialNavTarget nav) async {
    switch (nav) {
      case TutorialNavTarget.home:
        await _popExtraRoutes();
        widget.selectTab(0);
      case TutorialNavTarget.radio:
        await _popExtraRoutes();
        widget.selectTab(1);
      case TutorialNavTarget.feed:
        await _popExtraRoutes();
        widget.selectTab(2);
      case TutorialNavTarget.discover:
        await _popExtraRoutes();
        widget.selectTab(3);
      case TutorialNavTarget.voteOrPro:
        await _popExtraRoutes();
        final vote = widget.voteTabIndex;
        if (vote != null) {
          widget.selectTab(vote);
        } else {
          await widget.openRoute(AppRoutes.competition);
        }
      case TutorialNavTarget.upload:
        if (!_openedUpload) {
          await _popExtraRoutes();
          _openedUpload = true;
          await widget.openRoute(AppRoutes.upload);
        }
      case TutorialNavTarget.studio:
        await _popExtraRoutes();
        await widget.openRoute(AppRoutes.studio);
      case TutorialNavTarget.proNetworx:
        await _popExtraRoutes();
        final proTab = widget.proNetworxTabIndex;
        if (proTab != null) {
          widget.selectTab(proTab);
        } else {
          await widget.openRoute(AppRoutes.proNetworxLanding);
        }
      case TutorialNavTarget.proRadio:
        if (!_openedProRadio) {
          await _popExtraRoutes();
          _openedProRadio = true;
          await widget.openRoute(AppRoutes.proRadio);
        }
      case TutorialNavTarget.nearby:
        if (!_openedNearby) {
          await _popExtraRoutes();
          _openedNearby = true;
          await widget.openRoute(AppRoutes.nearbyPeople);
        }
      case TutorialNavTarget.none:
        break;
    }
  }

  Future<void> _finish({required bool skipped}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (skipped && mounted) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Tour saved for later'),
            content: const Text(AppTutorial.replayHint),
            actions: [
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Got it'),
              ),
            ],
          ),
        );
      }
      await AppTutorialService.instance.markCompleted();
      await _popExtraRoutes();
      widget.selectTab(0);
      widget.onClose();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _next() async {
    if (_busy) return;
    if (_isLast) {
      await _finish(skipped: false);
      return;
    }
    setState(() => _index += 1);
    await _applyNav(_step.nav);
  }

  Future<void> _back() async {
    if (_busy || _index == 0) return;
    setState(() => _index -= 1);
    await _applyNav(_step.nav);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final surfaces = context.networxSurfaces;
    final step = _step;
    final progress = (_index + 1) / widget.steps.length;

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Material(
              elevation: 12,
              color: surfaces.elevated,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Text(
                          'App tour',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: DimensionTokens.neonCyan,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${_index + 1} / ${widget.steps.length}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: surfaces.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor:
                            surfaces.border.withValues(alpha: 0.4),
                        color: DimensionTokens.neonCyan,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      step.title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: SingleChildScrollView(
                        child: Text(
                          step.body,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: surfaces.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        TextButton(
                          onPressed:
                              _busy ? null : () => _finish(skipped: true),
                          child: const Text('Skip'),
                        ),
                        const Spacer(),
                        if (_index > 0)
                          TextButton(
                            onPressed: _busy ? null : _back,
                            child: const Text('Back'),
                          ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: _busy ? null : _next,
                          child: Text(_isLast ? 'Finish' : 'Next'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
