import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/services/social_share.dart';
import '../../../core/theme/networx_extensions.dart';
import '../../messages/send_clip_sheet.dart';

class SocialTarget {
  const SocialTarget(this.id, this.label, this.hint);
  final String id;
  final String label;
  final String hint;
}

const List<SocialTarget> socialTargets = [
  SocialTarget(
    'instagram_story',
    'Instagram Story',
    'Caption copied. Paste it on your Instagram Story.',
  ),
  SocialTarget(
    'instagram_post',
    'Instagram Post',
    'Caption copied. Paste it on your Instagram post.',
  ),
  SocialTarget(
    'snapchat_story',
    'Snapchat Story',
    'Snapchat is open. Add it to your Story. Caption copied.',
  ),
  SocialTarget(
    'snapchat_chat',
    'Snapchat friends',
    'Snapchat is open. Send it to people. Caption copied.',
  ),
  SocialTarget(
    'tiktok_story',
    'TikTok Story',
    'TikTok is open. Add it to your Story. Caption copied.',
  ),
  SocialTarget(
    'tiktok_post',
    'TikTok Post',
    'TikTok is open. Post it. Caption copied.',
  ),
];

/// Share buttons for a clip that already has the song inside it.
class SocialShareBar extends StatefulWidget {
  const SocialShareBar({
    super.key,
    required this.caption,
    required this.resolveFile,
  });

  final String caption;
  final Future<File> Function() resolveFile;

  @override
  State<SocialShareBar> createState() => _SocialShareBarState();
}

class _SocialShareBarState extends State<SocialShareBar> {
  String? _busy;
  String? _note;

  String _hint(SocialTarget target) {
    final sheet =
        target.id.startsWith('snapchat') || target.id.startsWith('tiktok');
    if (Platform.isIOS && sheet) {
      final app = target.label.split(' ').first;
      return 'Choose $app in the share sheet. Caption copied.';
    }
    return target.hint;
  }

  Future<void> _sendToFriends() async {
    if (_busy != null) return;
    setState(() {
      _busy = 'friends';
      _note = null;
    });
    try {
      final file = await widget.resolveFile();
      if (!mounted) return;
      await SendClipSheet.show(context, file: file, caption: widget.caption);
    } catch (error) {
      if (!mounted) return;
      setState(() => _note = _friendly(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _share(SocialTarget target) async {
    if (_busy != null) return;
    setState(() {
      _busy = target.id;
      _note = null;
    });
    try {
      final file = await widget.resolveFile();
      await Clipboard.setData(ClipboardData(text: widget.caption));
      try {
        await SocialShare.shareFile(path: file.path, target: target.id);
      } on PlatformException catch (error) {
        if (error.code == 'not_installed' || error.code == 'unavailable') {
          await SharePlus.instance.share(
            ShareParams(files: [XFile(file.path)], text: widget.caption),
          );
          if (!mounted) return;
          setState(() {
            _note =
                'That app is not installed, so the share sheet is open. Caption copied.';
          });
          return;
        }
        rethrow;
      }
      if (!mounted) return;
      setState(() => _note = _hint(target));
    } catch (error) {
      if (!mounted) return;
      setState(() => _note = _friendly(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('live stream')) {
      return 'This live stream cannot be saved into a clip.';
    }
    if (text.contains('credit')) return 'Could not add the artist credit.';
    if (text.contains('download')) return 'Could not download this clip.';
    if (text.contains('song')) return 'Could not add the song to this clip.';
    return 'Could not share that clip. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Share the clip',
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'The song is saved in the video. Paste the copied caption in the app.',
          style: TextStyle(color: surfaces.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: _busy == null ? _sendToFriends : null,
          icon: const Icon(Icons.send),
          label: Text(_busy == 'friends' ? 'Preparing…' : 'Send to friends'),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final target in socialTargets) ...[
                OutlinedButton(
                  onPressed: _busy == null ? () => _share(target) : null,
                  child: Text(_busy == target.id ? 'Opening…' : target.label),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        if (_note != null) ...[
          const SizedBox(height: 8),
          Text(
            _note!,
            style: TextStyle(color: surfaces.textSecondary, fontSize: 12),
          ),
        ],
      ],
    );
  }
}
