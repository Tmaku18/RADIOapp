import 'package:flutter/material.dart';

import '../../core/services/refinery_service.dart';
import '../../core/services/refinery_submission_flow.dart';

/// Collect optional custom questions, then submit to The Refinery
/// (free add, store IAP, or web Stripe depending on platform / beta).
Future<bool> showRefinerySubmitSheet(
  BuildContext context, {
  required String songId,
  required String songTitle,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _RefinerySubmitSheet(
      songId: songId,
      songTitle: songTitle,
    ),
  );
  return result == true;
}

class _RefinerySubmitSheet extends StatefulWidget {
  const _RefinerySubmitSheet({
    required this.songId,
    required this.songTitle,
  });

  final String songId;
  final String songTitle;

  @override
  State<_RefinerySubmitSheet> createState() => _RefinerySubmitSheetState();
}

class _RefinerySubmitSheetState extends State<_RefinerySubmitSheet> {
  final RefineryService _refinery = RefineryService();
  final List<TextEditingController> _questionControllers = [
    TextEditingController(),
  ];
  bool _loading = true;
  bool _busy = false;
  bool _submissionFree = false;
  int _priceCents = 499;
  int _originalCents = 999;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPricing();
  }

  @override
  void dispose() {
    for (final c in _questionControllers) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadPricing() async {
    try {
      final pricing = await _refinery.getSubmissionPricing();
      if (!mounted) return;
      setState(() {
        _submissionFree = pricing.submissionFree;
        _priceCents = pricing.priceCents;
        _originalCents = pricing.originalPriceCents;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  List<String> get _trimmedQuestions => _questionControllers
      .map((c) => c.text.trim())
      .where((q) => q.isNotEmpty)
      .take(RefineryProgram.maxCustomQuestions)
      .toList();

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final enrolled = await RefinerySubmissionFlow.submit(
        songId: widget.songId,
        customQuestions: _trimmedQuestions,
        submissionFree: _submissionFree,
      );
      if (!mounted) return;
      if (enrolled) {
        Navigator.of(context).pop(true);
        return;
      }
      Navigator.of(context).pop(false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Complete Refinery checkout in the browser. '
            'Your song unlocks once payment finishes.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  String get _priceLabel {
    if (_submissionFree) return 'Free during beta';
    final price = (_priceCents / 100).toStringAsFixed(2);
    final original = (_originalCents / 100).toStringAsFixed(2);
    return '\$$price (was \$$original)';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.science_outlined, color: cs.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Submit to The Refinery',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _busy
                      ? null
                      : () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            Text(
              '"${widget.songTitle}" gets in-depth reviews from Prospectors.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: LinearProgressIndicator(),
              )
            else
              Text(
                _priceLabel,
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
            const SizedBox(height: 12),
            Text(
              'Optional custom questions (up to ${RefineryProgram.maxCustomQuestions})',
              style: theme.textTheme.labelLarge,
            ),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _questionControllers.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  return Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _questionControllers[i],
                          enabled: !_busy,
                          decoration: InputDecoration(
                            hintText: 'Question ${i + 1}',
                            border: const OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                      ),
                      if (_questionControllers.length > 1)
                        IconButton(
                          onPressed: _busy
                              ? null
                              : () {
                                  setState(() {
                                    _questionControllers.removeAt(i).dispose();
                                  });
                                },
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                    ],
                  );
                },
              ),
            ),
            if (_questionControllers.length <
                RefineryProgram.maxCustomQuestions)
              TextButton.icon(
                onPressed: _busy
                    ? null
                    : () {
                        setState(() {
                          _questionControllers.add(TextEditingController());
                        });
                      },
                icon: const Icon(Icons.add),
                label: const Text('Add question'),
              ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: cs.error)),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: (_busy || _loading) ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _submissionFree
                            ? 'Add to Refinery'
                            : 'Pay & submit',
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
