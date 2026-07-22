import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_router.dart';
import '../../core/models/job_board_models.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/services/api_service.dart';
import '../../core/services/job_board_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../pro_networx/widgets/pro_network_paywall_sheet.dart';

class JobBoardScreen extends StatefulWidget {
  const JobBoardScreen({super.key, this.embedded = false});

  /// When true, render as a Pro-Networx Projects tab body (no nested shell).
  final bool embedded;

  @override
  State<JobBoardScreen> createState() => _JobBoardScreenState();
}

class _JobBoardScreenState extends State<JobBoardScreen> {
  static const serviceTypes = <String>[
    'mixing',
    'mastering',
    'production',
    'session',
    'collab',
    'other'
  ];

  final JobBoardService _service = JobBoardService();
  app_user.User? _me;
  bool _loading = true;

  String _tab = 'browse'; // browse | mine
  String _serviceType = 'all';
  String _status = 'open'; // open | closed | all

  List<ServiceRequestRow> _items = const [];
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final me = await auth.getUserProfile();
    if (!mounted) return;
    setState(() => _me = me);
    await _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final mine = _tab == 'mine';
      final page = await _service.listRequests(
        serviceType: _serviceType == 'all' ? null : _serviceType,
        status: mine ? null : (_status == 'all' ? null : _status),
        mine: mine ? true : null,
        limit: 30,
        offset: 0,
      );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _total = page.total;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canPost {
    final role = _me?.role;
    return role == 'artist' || role == 'admin';
  }

  Future<void> _showCreateDialog() async {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    String selectedType = 'none';

    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        bool submitting = false;
        String? error;
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> submit() async {
              final title = titleController.text.trim();
              if (title.isEmpty) {
                setSheetState(() => error = 'A title is required.');
                return;
              }
              setSheetState(() {
                submitting = true;
                error = null;
              });
              try {
                await _service.createRequest(
                  title: title,
                  description: descController.text,
                  serviceType: selectedType == 'none' ? null : selectedType,
                );
                if (sheetContext.mounted) Navigator.pop(sheetContext, true);
              } catch (_) {
                setSheetState(() {
                  submitting = false;
                  error = 'Could not post your request. Try again.';
                });
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Post a service request',
                    style: DimensionTypography.cardTitle(fontSize: 20),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: titleController,
                    maxLength: 120,
                    decoration: const InputDecoration(
                      labelText: 'Title',
                      hintText: 'e.g. Need a mix engineer for a 3-track EP',
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: selectedType,
                    decoration: const InputDecoration(labelText: 'Service type'),
                    items: [
                      const DropdownMenuItem(
                          value: 'none', child: Text('General')),
                      ...serviceTypes.map(
                        (s) => DropdownMenuItem(value: s, child: Text(s)),
                      ),
                    ],
                    onChanged: (v) =>
                        setSheetState(() => selectedType = v ?? 'none'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Details (optional)',
                      hintText: 'Budget, timeline, references…',
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting ? null : submit,
                      child: Text(submitting ? 'Posting…' : 'Post request'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (created == true && mounted) {
      setState(() => _tab = 'mine');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request posted.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    final listBody = ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          decoration: BoxDecoration(
            gradient: surfaces.signatureGradient,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.25)),
          ),
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.embedded ? 'Projects' : 'Pro-Networx',
                      style: DimensionTypography.cardTitle(fontSize: 18)
                          .copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Exclusive service requests and collaborations for creators.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: Colors.white.withValues(alpha: 0.85)),
                    ),
                  ],
                ),
              ),
              if (!widget.embedded)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: surfaces.roseGold.withValues(alpha: 0.20),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: surfaces.roseGold),
                  ),
                  child: Text(
                    'Verified',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                        ),
                  ),
                )
              else
                IconButton(
                  tooltip: 'Refresh',
                  onPressed: _loading ? null : _load,
                  icon: const Icon(Icons.refresh, color: Colors.white),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'browse', label: Text('Browse')),
            ButtonSegment(value: 'mine', label: Text('Mine')),
          ],
          selected: <String>{_tab},
          onSelectionChanged: (v) {
            setState(() => _tab = v.first);
            _load();
          },
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 8,
          children: [
            DropdownButton<String>(
              value: _serviceType,
              items: [
                const DropdownMenuItem(value: 'all', child: Text('All types')),
                ...serviceTypes.map((s) => DropdownMenuItem(
                      value: s,
                      child: Text(s),
                    )),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _serviceType = v);
                _load();
              },
            ),
            if (_tab == 'browse')
              DropdownButton<String>(
                value: _status,
                items: const [
                  DropdownMenuItem(value: 'open', child: Text('Open')),
                  DropdownMenuItem(value: 'closed', child: Text('Closed')),
                  DropdownMenuItem(value: 'all', child: Text('All')),
                ],
                onChanged: (v) {
                  if (v == null) return;
                  setState(() => _status = v);
                  _load();
                },
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          '$_total request(s) found',
          style: TextStyle(color: surfaces.textMuted),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_items.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text(
                'No requests match your filters.',
                style: TextStyle(color: surfaces.textSecondary),
              ),
            ),
          )
        else
          ..._items.map((req) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                child: ListTile(
                  title: Text(req.title),
                  subtitle: Text(
                    'by ${req.artistDisplayName ?? 'Artist'} · ${req.serviceType ?? 'General'}',
                    style: TextStyle(color: surfaces.textSecondary),
                  ),
                  trailing: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: req.status == 'open'
                          ? scheme.primary.withValues(alpha: 0.14)
                          : surfaces.elevated,
                      border: Border.all(color: surfaces.border),
                    ),
                    child: Text(
                      req.status,
                      style: TextStyle(
                        color: req.status == 'open'
                            ? scheme.primary
                            : surfaces.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  onTap: () {
                    Navigator.push(
                      context,
                      AppRouter.routeToRequestDetail(
                        request: req,
                        myUserId: _me?.id,
                      ),
                    ).then((_) => _load());
                  },
                ),
              ),
            );
          }),
        if (_canPost) const SizedBox(height: 72),
      ],
    );

    final fab = _canPost
        ? FloatingActionButton.extended(
            onPressed: _showCreateDialog,
            icon: const Icon(Icons.add),
            label: const Text('Post a request'),
          )
        : null;

    if (widget.embedded) {
      return Stack(
        children: [
          listBody,
          if (fab != null)
            Positioned(
              right: 16,
              bottom: 16,
              child: fab,
            ),
        ],
      );
    }

    return DimensionScreenShell(
      title: 'Pro-Networx',
      showNeonLine: true,
      floatingActionButton: fab,
      actions: [
        IconButton(
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: listBody,
    );
  }
}

class RequestDetailScreen extends StatefulWidget {
  final ServiceRequestRow request;
  final String? myUserId;
  const RequestDetailScreen({super.key, required this.request, this.myUserId});

  @override
  State<RequestDetailScreen> createState() => _RequestDetailScreenState();
}

class _RequestDetailScreenState extends State<RequestDetailScreen> {
  final JobBoardService _service = JobBoardService();
  bool _loading = true;
  ServiceRequestRow? _detail;
  List<ServiceRequestApplicationRow> _apps = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final req = await _service.getRequest(widget.request.id);
      if (!mounted) return;
      _detail = req ?? widget.request;
      final isOwner = widget.myUserId != null &&
          _detail != null &&
          _detail!.artistId == widget.myUserId;
      if (isOwner) {
        final apps = await _service.listApplications(widget.request.id);
        if (!mounted) return;
        setState(() => _apps = apps);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _apply() async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Apply'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Message (optional)',
              hintText: 'Tell them how you can help…',
            ),
            maxLines: 4,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
    if (ok != true) return;
    try {
      await _service.apply(widget.request.id,
          message:
              controller.text.trim().isEmpty ? null : controller.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Application sent.')),
      );
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      final requiresSub = e.statusCode == 403 &&
          (e.responseBody?.contains('PRO_NETWORK_SUBSCRIPTION_REQUIRED') ??
              false);
      if (requiresSub) {
        final subscribed = await ProNetworkPaywallSheet.show(
          context,
          title: 'Subscribe to apply',
          description:
              'Browsing requests is free. Applying and messaging creators '
              'unlocks with a Pro-Networx subscription. Cancel anytime.',
        );
        if (subscribed == true && mounted) {
          await _apply();
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not send application.')),
        );
      }
    }
  }

  Future<void> _delete() async {
    final req = _detail ?? widget.request;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete this request?'),
          content: Text(
            '"${req.title}" and any applications it received will be '
            'permanently removed. This can\'t be undone.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );
    if (confirmed != true) return;
    try {
      await _service.deleteRequest(req.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request deleted.')),
      );
      Navigator.pop(context);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not delete the request.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final req = _detail ?? widget.request;
    final isOwner = widget.myUserId != null && req.artistId == widget.myUserId;

    return DimensionScreenShell(
      title: 'Request',
      showNeonLine: true,
      loading: _loading,
      actions: [
        if (isOwner)
          IconButton(
            tooltip: 'Delete request',
            onPressed: _loading ? null : _delete,
            icon: const Icon(Icons.delete_outline),
          ),
        IconButton(
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  req.title,
                  style: DimensionTypography.cardTitle(fontSize: 18),
                ),
                const SizedBox(height: 8),
                Text(
                  'by ${req.artistDisplayName ?? 'Artist'} · ${req.serviceType ?? 'General'}',
                  style: TextStyle(color: surfaces.textSecondary),
                ),
                const SizedBox(height: 12),
                Text(
                  req.description ?? 'No description provided.',
                  style: TextStyle(color: scheme.onSurface),
                ),
                const SizedBox(height: 18),
                if (!isOwner)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _apply,
                      child: const Text('Apply'),
                    ),
                  ),
                if (isOwner) ...[
                  const SizedBox(height: 18),
                  Text(
                    'Applications',
                    style: DimensionTypography.cardTitle(fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  if (_apps.isEmpty)
                    Text('No applications yet.',
                        style: TextStyle(color: surfaces.textSecondary))
                  else
                    ..._apps.map((a) => Card(
                          child: ListTile(
                            title: Text(a.applicantDisplayName ?? 'Applicant'),
                            subtitle: Text(
                              a.message ?? '(no message)',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                            trailing: Text(
                              a.status,
                              style: TextStyle(color: surfaces.textMuted),
                            ),
                          ),
                        )),
                ],
              ],
            ),
    );
  }
}

