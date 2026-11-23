import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/users_service.dart';

/// Blocks a signed-in session until this sign-in is confirmed by text.
/// Guests never reach this widget.
class PhoneMfaGate extends StatefulWidget {
  final Widget child;

  const PhoneMfaGate({super.key, required this.child});

  @override
  State<PhoneMfaGate> createState() => _PhoneMfaGateState();
}

class _PhoneMfaGateState extends State<PhoneMfaGate> {
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _users = UsersService();

  bool _loading = true;
  bool _needsMfa = false;
  bool _started = false;
  bool _phoneVerified = false;
  bool _sending = false;
  String? _last4;
  String? _sentTo;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final signedIn = context.read<AuthService>().currentUser != null;
    if (!signedIn) {
      _loading = false;
      _needsMfa = false;
      return;
    }
    _load();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final me = await _users.getMe();
      if (!mounted) return;
      final needs = me['mfaSatisfied'] == false;
      final verified = me['phoneVerified'] == true;
      final last4 = me['phoneLast4']?.toString();
      setState(() {
        _needsMfa = needs;
        _phoneVerified = verified;
        _last4 = last4;
        _loading = false;
        _error = null;
      });
      if (needs && verified) {
        await _send();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 404) {
        setState(() {
          _needsMfa = false;
          _loading = false;
        });
        return;
      }
      setState(() {
        _needsMfa = true;
        _loading = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _needsMfa = true;
        _loading = false;
        _error = 'Could not check your account. Try again.';
      });
    }
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{};
      if (!_phoneVerified) {
        final phone = _phoneController.text.trim();
        if (phone.length < 7) {
          setState(() {
            _sending = false;
            _error = 'Enter the mobile number that should own this account.';
          });
          return;
        }
        body['phone'] = phone;
      }
      final res = await ApiService().post('auth/phone/send', body);
      final last4 = res is Map ? res['phoneLast4']?.toString() : null;
      if (!mounted) return;
      setState(() {
        _sentTo = (last4 == null || last4.isEmpty) ? _last4 : last4;
        _sending = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = 'Could not send the text. Try again.';
      });
    }
  }

  Future<void> _verify() async {
    final code = _codeController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the 6-digit code from the text.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ApiService().post('auth/phone/verify', {'code': code});
      if (!mounted) return;
      setState(() {
        _needsMfa = false;
        _sending = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = 'That code did not work. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (!_needsMfa) return widget.child;

    final theme = Theme.of(context);
    final waiting = _sentTo != null;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    "Confirm it's you",
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _phoneVerified
                        ? 'We text a code to the number ending in ${_last4 ?? 'your phone'} every time you sign in.'
                        : 'Add the mobile number for this account. Each number can only be used once, which keeps out duplicate and fake accounts.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  if (_error != null) ...[
                    Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                    const SizedBox(height: 12),
                  ],
                  if (!waiting && !_phoneVerified)
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: const InputDecoration(
                        labelText: 'Mobile number',
                        hintText: '(555) 555-0100',
                      ),
                    ),
                  if (!waiting) ...[
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _sending ? null : _send,
                      child: Text(_sending ? 'Sending text…' : 'Text me a code'),
                    ),
                  ],
                  if (waiting) ...[
                    TextField(
                      controller: _codeController,
                      keyboardType: TextInputType.number,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      decoration: InputDecoration(
                        labelText: 'Code sent to •••$_sentTo',
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _sending ? null : _verify,
                      child: Text(_sending ? 'Checking…' : 'Verify and continue'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _sending ? null : _send,
                      child: const Text('Resend text'),
                    ),
                    if (!_phoneVerified)
                      TextButton(
                        onPressed: _sending
                            ? null
                            : () => setState(() {
                                  _sentTo = null;
                                  _codeController.clear();
                                  _error = null;
                                }),
                        child: const Text('Use a different number'),
                      ),
                  ],
                  TextButton(
                    onPressed: () =>
                        context.read<AuthService>().signOut(),
                    child: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
