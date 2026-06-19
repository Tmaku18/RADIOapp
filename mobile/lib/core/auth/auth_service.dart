import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/push_notification_service.dart';
import '../models/user.dart' as app_user;

/// Thrown when a freshly authenticated OAuth user (Google/Apple) has no backend
/// profile yet. A display name is mandatory at sign-up, so the UI must collect
/// one and call [AuthService.completeOAuthProfile] before the account is
/// created. We never derive the name from the email prefix.
class ProfileSetupRequiredException implements Exception {
  ProfileSetupRequiredException({required this.suggestedName, required this.email});

  final String suggestedName;
  final String email;

  @override
  String toString() => 'ProfileSetupRequiredException';
}

class AuthService extends ChangeNotifier {
  final bool firebaseInitialized;
  FirebaseAuth? _auth;
  // google_sign_in v7 is a singleton and must be initialized once before use.
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  Future<void>? _googleInit;
  // OAuth web/server client ID for this Firebase project (client_type 3 in
  // google-services.json). Used so the returned idToken is minted for the
  // Firebase project and accepted by signInWithCredential.
  static const String googleServerClientId =
      '479427085382-d7jan4js66f2h60nr4e41c672gb7tf5s.apps.googleusercontent.com';
  final ApiService _apiService = ApiService();

  AuthService({this.firebaseInitialized = true}) {
    // Only initialize FirebaseAuth if Firebase is initialized
    if (firebaseInitialized) {
      try {
        _auth = FirebaseAuth.instance;
        _apiService.setAuthTokenProvider(() async {
          final user = _auth?.currentUser;
          if (user == null) return null;
          return user.getIdToken();
        });
        _apiService.setUnauthorizedHandler(() async {
          if (_auth?.currentUser != null) {
            await signOut();
          }
        });
      } catch (e) {
        debugPrint('Warning: Could not access FirebaseAuth: $e');
        _auth = null;
      }
    }
  }

  Stream<User?> get authStateChanges {
    if (!firebaseInitialized || _auth == null) {
      // Return a stream that immediately emits null if Firebase isn't initialized
      return Stream.value(null);
    }
    try {
      return _auth!.idTokenChanges();
    } catch (e) {
      debugPrint('Error getting auth state changes: $e');
      return Stream.value(null);
    }
  }

  User? get currentUser {
    if (_auth == null) return null;
    try {
      return _auth!.currentUser;
    } catch (e) {
      return null;
    }
  }

  Future<app_user.User?> signInWithEmailAndPassword(
    String email,
    String password,
  ) async {
    if (_auth == null || !firebaseInitialized) {
      throw Exception('Firebase is not initialized. Please configure Firebase first.');
    }
    try {
      final credential = await _auth!.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user != null) {
        final token = await credential.user!.getIdToken();
        _apiService.setAuthToken(token);
        return await _getUserProfile();
      }
      return null;
    } catch (e) {
      throw Exception('Sign in failed: $e');
    }
  }

  Future<app_user.User?> signUpWithEmailAndPassword(
    String email,
    String password,
    String displayName,
    String role,
  ) async {
    if (_auth == null || !firebaseInitialized) {
      throw Exception('Firebase is not initialized. Please configure Firebase first.');
    }
    try {
      final credential = await _auth!.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      if (credential.user != null) {
        await credential.user!.updateDisplayName(displayName);
        final token = await credential.user!.getIdToken();
        _apiService.setAuthToken(token);

        // Create user profile in backend
        await _apiService.post('users', {
          'email': email,
          'displayName': displayName,
          'role': role,
        });

        return await _getUserProfile();
      }
      return null;
    } catch (e) {
      throw Exception('Sign up failed: $e');
    }
  }

  /// Initialize the google_sign_in singleton exactly once (v7 requirement).
  /// Call during app startup so [signInWithGoogle] can invoke [authenticate]
  /// immediately from the button handler (Android Credential Manager requires
  /// minimal async delay between the tap and the auth UI).
  Future<void> ensureGoogleSignInInitialized() {
    return _ensureGoogleSignInInitialized();
  }

  /// Startup helper — safe to call from [main] before [AuthService] exists.
  static Future<void> warmUpGoogleSignIn() async {
    if (Firebase.apps.isEmpty) return;
    final signIn = GoogleSignIn.instance;
    await signIn.initialize(serverClientId: googleServerClientId);
  }

  Future<void> _ensureGoogleSignInInitialized() {
    return _googleInit ??= _googleSignIn
        .initialize(serverClientId: googleServerClientId)
        .catchError((Object e) {
      _googleInit = null;
      throw e;
    });
  }

  Future<app_user.User?> signInWithGoogle() async {
    if (_auth == null || !firebaseInitialized) {
      throw Exception('Firebase is not initialized. Please configure Firebase first.');
    }
    try {
      await _ensureGoogleSignInInitialized();

      // On a real device the user is often already signed into Google — try the
      // low-friction path first, then fall back to the full account picker.
      GoogleSignInAccount? googleUser;
      final lightweight = _googleSignIn.attemptLightweightAuthentication();
      if (lightweight != null) {
        googleUser = await lightweight;
      }
      googleUser ??= await _googleSignIn.authenticate(
        scopeHint: const <String>['email', 'openid'],
      );

      final GoogleSignInAuthentication googleAuth = googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw Exception(
          'Google did not return a sign-in token. Confirm the web OAuth client '
          'and SHA-1 fingerprints are registered in Firebase for '
          'com.tmaktechnologies.networxradio.',
        );
      }

      String? accessToken;
      try {
        final clientAuth = await googleUser.authorizationClient
            .authorizationForScopes(const ['email', 'openid']);
        accessToken = clientAuth?.accessToken;
      } catch (_) {}

      final credential = GoogleAuthProvider.credential(
        idToken: idToken,
        accessToken: accessToken,
      );

      final userCredential = await _auth!.signInWithCredential(credential);
      if (userCredential.user != null) {
        final token = await userCredential.user!.getIdToken();
        _apiService.setAuthToken(token);
        final firebaseUser = userCredential.user!;

        // Check if user exists in backend, create if not.
        // Use a 10s budget per call so a slow Railway cold-start still has a
        // chance to succeed before we fall back to a Firebase-only profile.
        try {
          return await _getUserProfile().timeout(const Duration(seconds: 10));
        } on TimeoutException {
          debugPrint('Backend profile lookup timed out after Google sign-in.');
          return _buildFallbackUser(firebaseUser);
        } catch (e) {
          // No backend profile yet: a display name is mandatory, so hand control
          // back to the UI to collect one. Pre-fill with the Google name when
          // present; never derive from the email prefix.
          throw ProfileSetupRequiredException(
            suggestedName: _providerName(firebaseUser.displayName),
            email: firebaseUser.email ?? '',
          );
        }
      }
      return null;
    } on ProfileSetupRequiredException {
      rethrow;
    } on GoogleSignInException catch (e) {
      debugPrint(
        '[GoogleSignIn] exception: code=${e.code} '
        'description=${e.description} details=${e.details}',
      );
      if (e.code == GoogleSignInExceptionCode.canceled) {
        // Credential Manager often reports OAuth/SHA misconfiguration as
        // "canceled" after account selection — don't blame the user.
        throw Exception(
          'Google sign-in did not complete. On a physical device, common fixes:\n'
          '• Reinstall after code changes: flutter run (USB debug) or a fresh APK\n'
          '• Update Google Play services on the phone\n'
          '• If installed from Play Store, add the Play App Signing SHA-1 in '
          'Firebase (Play Console → App integrity → App signing key)\n'
          '• If OAuth consent is in Testing mode, add your Google account as a '
          'test user in Google Cloud Console',
        );
      }
      throw Exception('Google sign in failed: ${e.description ?? e.code}');
    } on TimeoutException {
      throw Exception('Google sign in timed out. Please try again.');
    } catch (e, st) {
      debugPrint('[GoogleSignIn] failed: type=${e.runtimeType} message=$e');
      debugPrint('[GoogleSignIn] stack: $st');
      throw Exception('Google sign in failed: $e');
    }
  }

  Future<app_user.User?> signInWithApple() async {
    if (_auth == null || !firebaseInitialized) {
      throw Exception('Firebase is not initialized. Please configure Firebase first.');
    }
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final oauthCredential = OAuthProvider("apple.com").credential(
        idToken: credential.identityToken,
        accessToken: credential.authorizationCode,
      );

      final userCredential = await _auth!.signInWithCredential(oauthCredential);
      if (userCredential.user != null) {
        final token = await userCredential.user!.getIdToken();
        _apiService.setAuthToken(token);

        try {
          return await _getUserProfile();
        } catch (e) {
          // No backend profile yet: require a display name before creating the
          // account. Pre-fill with the Apple name when present.
          throw ProfileSetupRequiredException(
            suggestedName: _providerName(credential.givenName),
            email: credential.email ??
                userCredential.user!.email ??
                'private@apple.relay',
          );
        }
      }
      return null;
    } on ProfileSetupRequiredException {
      rethrow;
    } catch (e) {
      throw Exception('Apple sign in failed: $e');
    }
  }

  Future<void> signOut() async {
    // Unregister push notification token before signing out
    try {
      await PushNotificationService().unregisterToken();
    } catch (e) {
      debugPrint('Error unregistering push token: $e');
    }
    
    await _googleSignIn.signOut();
    if (_auth != null) {
      try {
        await _auth!.signOut();
      } catch (e) {
        debugPrint('Error signing out: $e');
      }
    }
    _apiService.setAuthToken(null);
    notifyListeners(); // Notify listeners to trigger UI rebuild (e.g., AuthWrapper)
  }

  Future<app_user.User?> _getUserProfile() async {
    final response = await _apiService.get('users/me');
    return app_user.User.fromJson(response);
  }

  /// Returns the identity provider's real name (trimmed) or an empty string.
  /// We intentionally never fall back to the email prefix so a display name is
  /// always an explicit choice at sign-up.
  String _providerName(String? preferred) {
    return preferred?.trim() ?? '';
  }

  /// Creates the backend profile for a freshly authenticated OAuth user once a
  /// display name has been chosen. Used to satisfy the mandatory-name step
  /// surfaced via [ProfileSetupRequiredException].
  Future<app_user.User?> completeOAuthProfile(
    String displayName, {
    String role = 'listener',
  }) async {
    final name = displayName.trim();
    if (name.isEmpty) {
      throw Exception('Display name is required');
    }
    final user = _auth?.currentUser;
    if (user == null) {
      throw Exception('You must be signed in to finish setting up your account.');
    }
    final token = await user.getIdToken();
    _apiService.setAuthToken(token);
    await _apiService.post('users', {
      'email': user.email ?? '',
      'displayName': name,
      'role': role,
    });
    try {
      await user.updateDisplayName(name);
    } catch (_) {
      // Non-fatal: the backend profile is the source of truth for the name.
    }
    return await _getUserProfile();
  }

  Future<app_user.User?> getUserProfile() async {
    if (_auth == null || _auth!.currentUser == null) return null;
    final firebaseUser = _auth!.currentUser!;
    try {
      final token = await firebaseUser.getIdToken();
      _apiService.setAuthToken(token);
      // Cap the call so the UI never hangs on a slow/cold backend; fall back to
      // a Firebase-only profile if the backend is unreachable in time.
      return await _getUserProfile().timeout(const Duration(seconds: 10));
    } on TimeoutException {
      debugPrint('getUserProfile: backend timed out, using fallback user.');
      return _buildFallbackUser(firebaseUser);
    } catch (e) {
      debugPrint('Error getting user profile: $e');
      return _buildFallbackUser(firebaseUser);
    }
  }

  Future<void> refreshIdToken({bool forceRefresh = true}) async {
    if (_auth == null || _auth!.currentUser == null) return;
    try {
      final token = await _auth!.currentUser!.getIdToken(forceRefresh);
      _apiService.setAuthToken(token);
    } catch (e) {
      debugPrint('Error refreshing ID token: $e');
    }
  }

  /// Request an upgrade to artist status (web parity: POST /users/upgrade-to-artist).
  Future<void> requestArtistUpgrade() async {
    if (_auth == null || _auth!.currentUser == null) {
      throw Exception('Not authenticated');
    }
    final token = await _auth!.currentUser!.getIdToken();
    _apiService.setAuthToken(token);
    await _apiService.post('users/upgrade-to-artist', null);
  }

  app_user.User _buildFallbackUser(User firebaseUser) {
    final now = DateTime.now();
    return app_user.User(
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'User',
      role: 'listener',
      createdAt: now,
      updatedAt: now,
    );
  }
}
