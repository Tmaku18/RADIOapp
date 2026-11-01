import 'package:flutter/material.dart';

import '../../core/services/api_service.dart';

class FanListSheet extends StatefulWidget {
  const FanListSheet({super.key});

  @override
  State<FanListSheet> createState() => _FanListSheetState();
}

class _FanListSheetState extends State<FanListSheet> {
  List<Map<String, dynamic>> _fans = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService().get('fans/me');
      final rows = res is Map ? res['fans'] : null;
      if (!mounted) return;
      setState(() {
        _fans = rows is List
            ? rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)).toList()
            : const [];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _fans = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Email list', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_fans.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('No one has joined yet.'),
              )
            else
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _fans.length,
                  itemBuilder: (context, index) {
                    final email = _fans[index]['email']?.toString() ?? '';
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(email),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
