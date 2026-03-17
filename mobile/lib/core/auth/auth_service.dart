import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/push_notification_service.dart';
import '../models/user.dart' as app_user;

class AuthService extends ChangeNotifier {
  final bool firebaseInitialized;
  FirebaseAuth? _auth;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
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

  Future<app_user.User?> signInWithGoogle() async {
    if (_auth == null || !firebaseInitialized) {
      throw Exception('Firebase is not initialized. Please configure Firebase first.');
    }
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn
          .signIn()
          .timeout(const Duration(seconds: 20));
      if (googleUser == null) return null;

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final userCredential = await _auth!.signInWithCredential(credential);
      if (userCredential.user != null) {
        final token = await userCredential.user!.getIdToken();
        _apiService.setAuthToken(token);
        final firebaseUser = userCredential.user!;

        // Check if user exists in backend, create if not
        try {
          return await _getUserProfile().timeout(const Duration(seconds: 6));
        } on TimeoutException {
          debugPrint('Backend profile lookup timed out after Google sign-in.');
          return _buildFallbackUser(firebaseUser);
        } catch (e) {
          try {
            await _apiService.post('users', {
              'email': firebaseUser.email ?? '',
              'displayName': _deriveDisplayName(
                firebaseUser.displayName,
                firebaseUser.email,
              ),
              'role': 'listener',
            });
            return await _getUserProfile().timeout(const Duration(seconds: 6));
          } on TimeoutException {
            debugPrint('Backend user sync timed out after Google sign-in.');
            return _buildFallbackUser(firebaseUser);
          } catch (e2) {
            // Backend unreachable; still return profile from Firebase so UI can navigate
            debugPrint('Backend user sync failed: $e2');
            return _buildFallbackUser(firebaseUser);
          }
        }
      }
      return null;
    } on TimeoutException {
      throw Exception('Google sign in timed out. Please try again.');
    } catch (e) {
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
          await _getUserProfile();
        } catch (e) {
          await _apiService.post('users', {
            'email': credential.email ?? userCredential.user!.email!,
            'displayName': _deriveDisplayName(
              credential.givenName,
              credential.email ?? userCredential.user!.email,
            ),
            'role': 'listener',
          });
        }

        return await _getUserProfile();
      }
      return null;
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

  String _deriveDisplayName(String? preferred, String? email) {
    final name = preferred?.trim();
    if (name != null && name.isNotEmpty) return name;
    final emailValue = (email ?? '').trim();
    if (emailValue.isEmpty) return 'User';
    final local = emailValue.split('@').first.trim();
    return local.isNotEmpty ? local : emailValue;
  }

  Future<app_user.User?> getUserProfile() async {
    if (_auth == null || _auth!.currentUser == null) return null;
    try {
      final token = await _auth!.currentUser!.getIdToken();
      _apiService.setAuthToken(token);
      return await _getUserProfile();
    } catch (e) {
      debugPrint('Error getting user profile: $e');
      return null;
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
