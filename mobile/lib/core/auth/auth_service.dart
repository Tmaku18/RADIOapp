import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
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
      return _auth!.authStateChanges();
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
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
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

        // Check if user exists, create if not
        try {
          await _getUserProfile();
        } catch (e) {
          await _apiService.post('users', {
            'email': userCredential.user!.email!,
            'displayName': userCredential.user!.displayName,
            'role': 'listener',
          });
        }

        return await _getUserProfile();
      }
      return null;
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
            'displayName': credential.givenName,
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
    await _googleSignIn.signOut();
    if (_auth != null) {
      try {
        await _auth!.signOut();
      } catch (e) {
        debugPrint('Error signing out: $e');
      }
    }
    _apiService.setAuthToken(null);
  }

  Future<app_user.User?> _getUserProfile() async {
    final response = await _apiService.get('users/me');
    return app_user.User.fromJson(response);
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
}
