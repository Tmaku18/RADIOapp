import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import 'pro_portfolio_screen.dart';

class ProMyServicesScreen extends StatefulWidget {
  const ProMyServicesScreen({super.key});

  @override
  State<ProMyServicesScreen> createState() => _ProMyServicesScreenState();
}

class _ProMyServicesScreenState extends State<ProMyServicesScreen> {
  final ProNetworxService _service = ProNetworxService();
  bool _loading = true;
  List<ProServiceListing> _items = const [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final list = await _service.listMyServices();
      if (!mounted) return;
      setState(() => _items = list);
    } catch (_) {
      // ignore
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openEditor({ProServiceListing? listing}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _ServiceEditorScreen(listing: listing),
      ),
    );
    if (saved == true) _refresh();
  }

  Future<void> _delete(ProServiceListing listing) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete listing?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _service.deleteService(listing.id);
      _refresh();
    } catch (_) {
      // ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My services'),
        actions: [
          IconButton(
            icon: const Icon(Icons.collections_outlined),
            tooltip: 'Portfolio',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => const ProPortfolioScreen(),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New listing',
            onPressed: () => _openEditor(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text("You haven't listed any services yet."),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: () => _openEditor(),
                          child: const Text('Create listing'),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final l = _items[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      child: ListTile(
                        title: Text(l.title),
                        subtitle: Text(
                          l.priceCents == null
                              ? l.serviceType.replaceAll('_', ' ')
                              : '${l.serviceType.replaceAll('_', ' ')} · \$${(l.priceCents! / 100).toStringAsFixed(2)}${l.rateType == 'hourly' ? '/hr' : ''}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: l.isPublished
                                    ? Colors.green.withValues(alpha: 0.15)
                                    : Colors.grey.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                l.isPublished ? 'Published' : 'Hidden',
                                style: const TextStyle(fontSize: 11),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.edit),
                              onPressed: () => _openEditor(listing: l),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _delete(l),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}

class _ServiceEditorScreen extends StatefulWidget {
  const _ServiceEditorScreen({this.listing});
  final ProServiceListing? listing;

  @override
  State<_ServiceEditorScreen> createState() => _ServiceEditorScreenState();
}

class _ServiceEditorScreenState extends State<_ServiceEditorScreen> {
  final ProNetworxService _service = ProNetworxService();
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _priceDollars = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _link = TextEditingController();
  String _serviceType = 'graphic_design';
  String _rateType = 'fixed';
  bool _isPublished = true;
  bool _saving = false;
  String? _error;

  static const _serviceTypes = [
    'graphic_design',
    'photography',
    'videography',
    'illustration',
    'lyricist',
    'beat_maker',
    'mix_master',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    final l = widget.listing;
    if (l != null) {
      _title.text = l.title;
      _description.text = l.description ?? '';
      _priceDollars.text = l.priceCents != null
          ? (l.priceCents! / 100).toStringAsFixed(2)
          : '';
      _email.text = l.contact?.email ?? '';
      _phone.text = l.contact?.phone ?? '';
      _link.text = l.contact?.link ?? '';
      _serviceType = l.serviceType;
      _rateType = l.rateType;
      _isPublished = l.isPublished;
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _priceDollars.dispose();
    _email.dispose();
    _phone.dispose();
    _link.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      int? priceCents;
      final priceText = _priceDollars.text.trim();
      if (priceText.isNotEmpty) {
        final dollars = double.tryParse(priceText);
        if (dollars == null || dollars < 0) {
          throw Exception('Enter a valid price.');
        }
        priceCents = (dollars * 100).round();
      }
      if (widget.listing == null) {
        await _service.createService(
          serviceType: _serviceType,
          title: _title.text.trim(),
          description: _description.text.trim().isEmpty
              ? null
              : _description.text.trim(),
          priceCents: priceCents,
          rateType: _rateType,
          contactEmail: _email.text.trim().isEmpty ? null : _email.text.trim(),
          contactPhone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          contactLink: _link.text.trim().isEmpty ? null : _link.text.trim(),
          isPublished: _isPublished,
        );
      } else {
        await _service.updateService(
          widget.listing!.id,
          serviceType: _serviceType,
          title: _title.text.trim(),
          description: _description.text.trim(),
          priceCents: priceCents,
          rateType: _rateType,
          contactEmail: _email.text.trim(),
          contactPhone: _phone.text.trim(),
          contactLink: _link.text.trim(),
          isPublished: _isPublished,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.listing == null ? 'New listing' : 'Edit listing'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<String>(
              initialValue: _serviceType,
              decoration: const InputDecoration(labelText: 'Service type'),
              items: _serviceTypes
                  .map(
                    (t) => DropdownMenuItem(
                      value: t,
                      child: Text(t.replaceAll('_', ' ')),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _serviceType = v ?? 'other'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Title'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Title required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 4,
              decoration:
                  const InputDecoration(labelText: 'Description (optional)'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _priceDollars,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Price (USD)',
                      hintText: '49.99',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _rateType,
                    decoration: const InputDecoration(labelText: 'Rate type'),
                    items: const [
                      DropdownMenuItem(value: 'fixed', child: Text('Fixed')),
                      DropdownMenuItem(value: 'hourly', child: Text('Hourly')),
                    ],
                    onChanged: (v) =>
                        setState(() => _rateType = v ?? 'fixed'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Contact email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Contact phone'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _link,
              decoration: const InputDecoration(
                  labelText: 'Booking / portfolio link'),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              value: _isPublished,
              title: const Text('Published'),
              subtitle: const Text('Visible in marketplace'),
              onChanged: (v) => setState(() => _isPublished = v),
            ),
            const SizedBox(height: 12),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                'Contact info is hidden from non-subscribers. Subscribers can email, call, or open your booking link directly.',
                style: TextStyle(fontSize: 12),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
