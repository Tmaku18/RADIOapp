import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';
import '../core/navigation/app_routes.dart';
import '../core/theme/networx_tokens.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _displayNameController = TextEditingController();
  bool _isSignUp = false;
  bool _isSubmitting = false;
  String _selectedRole = 'listener';

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _displayNameController.dispose();
    super.dispose();
  }

  Future<void> _handleEmailSignIn() async {
    if (_isSubmitting) return;
    if (!_formKey.currentState!.validate()) return;

    final authService = Provider.of<AuthService>(context, listen: false);
    setState(() => _isSubmitting = true);

    try {
      final user = _isSignUp
          ? await authService.signUpWithEmailAndPassword(
              _emailController.text.trim(),
              _passwordController.text,
              _displayNameController.text.trim(),
              _selectedRole,
            )
          : await authService.signInWithEmailAndPassword(
              _emailController.text.trim(),
              _passwordController.text,
            );

      if (!mounted) return;
      if (user != null || authService.currentUser != null) {
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoutes.home,
          (route) => false,
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in did not complete. Please try again.')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _handleGoogleSignIn() async {
    if (_isSubmitting) return;
    final authService = Provider.of<AuthService>(context, listen: false);
    setState(() => _isSubmitting = true);
    try {
      final user = await authService.signInWithGoogle();
      if (mounted && (user != null || authService.currentUser != null)) {
        Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Google sign-in was canceled or did not complete.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        // Firebase may still have signed in (e.g. backend /users/me failed)
        if (authService.currentUser != null) {
          Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Google sign in failed: $e')),
          );
        }
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final borderColor = NetworxTokens.cloudDancer.withValues(alpha: 0.12);

    InputDecoration themedDecoration({
      required String label,
      String? hint,
    }) {
      return InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: const TextStyle(color: NetworxTokens.cloudDancer),
        hintStyle: TextStyle(
          color: NetworxTokens.cloudDancer.withValues(alpha: 0.62),
        ),
        filled: true,
        fillColor: NetworxTokens.charcoalMatte.withValues(alpha: 0.86),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: NetworxTokens.electricCyan, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: NetworxTokens.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: NetworxTokens.error, width: 1.4),
        ),
      );
    }

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              NetworxTokens.deepMidnight,
              NetworxTokens.charcoalMatte,
              NetworxTokens.deepCobalt,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Form(
                  key: _formKey,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: NetworxTokens.deepMidnight.withValues(alpha: 0.76),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: NetworxTokens.cloudDancer.withValues(alpha: 0.14),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: NetworxTokens.deepMidnight.withValues(alpha: 0.55),
                          blurRadius: 28,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: Image.asset(
                            'assets/images/branding/logo_0.png',
                            width: 78,
                            height: 78,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Networx',
                          style: textTheme.headlineSmall?.copyWith(
                            color: NetworxTokens.cloudDancer,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _isSignUp
                              ? 'Create your account to join the network'
                              : 'Welcome back. Sign in to continue.',
                          textAlign: TextAlign.center,
                          style: textTheme.bodyMedium?.copyWith(
                            color: NetworxTokens.cloudDancer.withValues(alpha: 0.74),
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (_isSignUp) ...[
                          TextFormField(
                            controller: _displayNameController,
                            style: const TextStyle(color: NetworxTokens.cloudDancer),
                            decoration: themedDecoration(
                              label: 'Display name',
                              hint: 'Your public name',
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your name';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<String>(
                            initialValue: _selectedRole,
                            decoration: themedDecoration(label: 'Role'),
                            dropdownColor: NetworxTokens.charcoalMatte,
                            style: const TextStyle(color: NetworxTokens.cloudDancer),
                            items: const [
                              DropdownMenuItem(value: 'listener', child: Text('Listener')),
                              DropdownMenuItem(value: 'artist', child: Text('Artist')),
                            ],
                            onChanged: (value) {
                              setState(() {
                                _selectedRole = value!;
                              });
                            },
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextFormField(
                          controller: _emailController,
                          style: const TextStyle(color: NetworxTokens.cloudDancer),
                          decoration: themedDecoration(
                            label: 'Email',
                            hint: 'you@example.com',
                          ),
                          keyboardType: TextInputType.emailAddress,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Please enter your email';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _passwordController,
                          style: const TextStyle(color: NetworxTokens.cloudDancer),
                          decoration: themedDecoration(
                            label: 'Password',
                            hint: 'Enter your password',
                          ),
                          obscureText: true,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Please enter your password';
                            }
                            if (_isSignUp && value.length < 6) {
                              return 'Password must be at least 6 characters';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _isSubmitting ? null : _handleEmailSignIn,
                            style: FilledButton.styleFrom(
                              backgroundColor: NetworxTokens.electricCyan,
                              foregroundColor: NetworxTokens.deepMidnight,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: _isSubmitting
                                ? SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: scheme.onPrimary,
                                    ),
                                  )
                                : Text(_isSignUp ? 'Create account' : 'Sign in'),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: Divider(
                                color: NetworxTokens.cloudDancer.withValues(alpha: 0.22),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'OR',
                                style: textTheme.labelSmall?.copyWith(
                                  color: NetworxTokens.cloudDancer.withValues(alpha: 0.72),
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Divider(
                                color: NetworxTokens.cloudDancer.withValues(alpha: 0.22),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _isSubmitting ? null : _handleGoogleSignIn,
                            icon: const Icon(Icons.g_mobiledata, size: 28),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: NetworxTokens.cloudDancer,
                              side: BorderSide(color: borderColor),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            label: const Text('Continue with Google'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _isSubmitting
                              ? null
                              : () {
                                  setState(() {
                                    _isSignUp = !_isSignUp;
                                  });
                                },
                          child: Text(
                            _isSignUp
                                ? 'Already have an account? Sign in'
                                : 'Don\'t have an account? Sign up',
                            style: const TextStyle(color: NetworxTokens.electricCyan),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
