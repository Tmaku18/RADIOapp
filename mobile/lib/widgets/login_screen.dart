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
  final _confirmPasswordController = TextEditingController();
  final _displayNameController = TextEditingController();
  bool _isSignUp = false;
  bool _isSubmitting = false;
  String _selectedRole = 'listener';
  bool _appliedRouteArgs = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Allow callers (e.g. the welcome landing "Get Started Free" CTA) to open
    // this screen straight into sign-up mode via route arguments.
    if (!_appliedRouteArgs) {
      _appliedRouteArgs = true;
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map && args['signUp'] == true) {
        _isSignUp = true;
      }
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
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

  Future<void> _handleAppleSignIn() async {
    if (_isSubmitting) return;
    final authService = Provider.of<AuthService>(context, listen: false);
    setState(() => _isSubmitting = true);
    try {
      final user = await authService.signInWithApple();
      if (mounted && (user != null || authService.currentUser != null)) {
        Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Apple sign-in was canceled or did not complete.')),
        );
      }
    } on ProfileSetupRequiredException catch (setup) {
      await _completeOAuthSetup(authService, setup);
    } catch (e) {
      if (mounted) {
        if (authService.currentUser != null) {
          Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Apple sign in failed: $e')),
          );
        }
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
    } on ProfileSetupRequiredException catch (setup) {
      // New OAuth user: a display name is mandatory before the account is
      // created. Collect one (pre-filled with the Google name) and finish.
      await _completeOAuthSetup(authService, setup);
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

  /// Drives the mandatory display-name step for a new Google/Apple user. Keeps
  /// asking until a name is provided (or the user cancels and is signed out).
  Future<void> _completeOAuthSetup(
    AuthService authService,
    ProfileSetupRequiredException setup,
  ) async {
    String suggested = setup.suggestedName;
    while (mounted) {
      final name = await _promptForDisplayName(suggested);
      if (name == null) {
        // User cancelled: sign out so we don't leave a half-created account.
        await authService.signOut();
        return;
      }
      try {
        await authService.completeOAuthProfile(name);
        if (!mounted) return;
        Navigator.of(context)
            .pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
        return;
      } catch (e) {
        suggested = name;
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not save your name: $e')),
          );
        }
      }
    }
  }

  Future<String?> _promptForDisplayName(String suggested) async {
    final controller = TextEditingController(text: suggested);
    final formKey = GlobalKey<FormState>();
    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Choose your display name'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  "This is how you'll appear across Networx. You can change it "
                  'later in settings.',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: controller,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Display name',
                    hintText: 'How you want to be shown',
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Please enter a display name';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(null),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.of(dialogContext).pop(controller.text.trim());
                }
              },
              child: const Text('Continue'),
            ),
          ],
        );
      },
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Theme-aware brand surface so the auth screen matches web in both modes.
    final onCard = isDark ? NetworxTokens.cloudDancer : NetworxTokens.lightTextPrimary;
    final borderColor = onCard.withValues(alpha: 0.12);
    final fieldFill = isDark
        ? NetworxTokens.charcoalMatte.withValues(alpha: 0.86)
        : NetworxTokens.lightElevated;
    final linkColor = isDark ? NetworxTokens.electricCyan : NetworxTokens.deepCobalt;
    final logoAsset = isDark
        ? 'assets/images/branding/networx-logo-cyan.png'
        : 'assets/images/branding/networx-logo-cyan-light.png';
    final wordmarkStops = isDark
        ? const [
            Color(0xFFEAFEFF),
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
          ]
        : const [
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
            NetworxTokens.deepCobalt,
          ];
    final gradientColors = isDark
        ? const [
            NetworxTokens.deepMidnight,
            NetworxTokens.charcoalMatte,
            NetworxTokens.deepCobalt,
          ]
        : const [
            Color(0xFFFAFAFA),
            Color(0xFFFFFFFF),
            Color(0xFFE6FBFF),
          ];

    InputDecoration themedDecoration({
      required String label,
      String? hint,
    }) {
      return InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: TextStyle(color: onCard.withValues(alpha: 0.86)),
        hintStyle: TextStyle(
          color: onCard.withValues(alpha: 0.5),
        ),
        filled: true,
        fillColor: fieldFill,
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
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradientColors,
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
                      color: isDark
                          ? NetworxTokens.deepMidnight.withValues(alpha: 0.76)
                          : NetworxTokens.lightSurface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: onCard.withValues(alpha: isDark ? 0.14 : 0.12),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.55 : 0.12),
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
                            logoAsset,
                            width: 78,
                            height: 78,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ShaderMask(
                          shaderCallback: (bounds) => LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: wordmarkStops,
                          ).createShader(bounds),
                          child: Text(
                            'NETWORX',
                            style: textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 3,
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _isSignUp
                              ? 'Create your account'
                              : 'Welcome back',
                          textAlign: TextAlign.center,
                          style: textTheme.bodyMedium?.copyWith(
                            color: onCard.withValues(alpha: 0.74),
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (_isSignUp) ...[
                          TextFormField(
                            controller: _displayNameController,
                            style: TextStyle(color: onCard),
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
                            dropdownColor: isDark
                                ? NetworxTokens.charcoalMatte
                                : NetworxTokens.lightSurface,
                            style: TextStyle(color: onCard),
                            items: const [
                              DropdownMenuItem(value: 'listener', child: Text('Listener')),
                              DropdownMenuItem(value: 'artist', child: Text('Gem')),
                              DropdownMenuItem(value: 'service_provider', child: Text('Catalyst')),
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
                          style: TextStyle(color: onCard),
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
                          style: TextStyle(color: onCard),
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
                        if (_isSignUp) ...[
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _confirmPasswordController,
                            style: TextStyle(color: onCard),
                            decoration: themedDecoration(
                              label: 'Confirm password',
                              hint: 'Re-enter your password',
                            ),
                            obscureText: true,
                            validator: (value) {
                              if (!_isSignUp) return null;
                              if (value == null || value.isEmpty) {
                                return 'Please confirm your password';
                              }
                              if (value != _passwordController.text) {
                                return 'Passwords do not match';
                              }
                              return null;
                            },
                          ),
                        ],
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
                                color: onCard.withValues(alpha: 0.22),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'OR',
                                style: textTheme.labelSmall?.copyWith(
                                  color: onCard.withValues(alpha: 0.72),
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Divider(
                                color: onCard.withValues(alpha: 0.22),
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
                              foregroundColor: onCard,
                              side: BorderSide(color: borderColor),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            label: const Text('Continue with Google'),
                          ),
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: _isSubmitting ? null : _handleAppleSignIn,
                            icon: const Icon(Icons.apple, size: 22),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: onCard,
                              side: BorderSide(color: borderColor),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            label: const Text('Continue with Apple'),
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
                            style: TextStyle(color: linkColor),
                          ),
                        ),
                        TextButton(
                          onPressed: _isSubmitting
                              ? null
                              : () {
                                  if (Navigator.of(context).canPop()) {
                                    Navigator.of(context).pop();
                                  } else {
                                    Navigator.of(context)
                                        .pushNamed(AppRoutes.welcome);
                                  }
                                },
                          child: Text(
                            'New here? Learn about Networx',
                            style: TextStyle(
                              color: onCard.withValues(alpha: 0.74),
                            ),
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
