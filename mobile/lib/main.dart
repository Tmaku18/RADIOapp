import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'core/auth/auth_service.dart';
import 'features/player/player_screen.dart';
import 'features/upload/upload_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/payment/payment_screen.dart';
import 'widgets/login_screen.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    debugPrint('Warning: Could not load .env file: $e');
  }
  
  // Initialize Firebase - this will use default config from google-services.json
  // If the file is missing or invalid, we'll handle it gracefully
  bool firebaseInitialized = false;
  try {
    final options = DefaultFirebaseOptions.currentPlatform;
    
    if (options != null) {
      // Use explicit options if available
      await Firebase.initializeApp(options: options);
      firebaseInitialized = true;
      debugPrint('Firebase initialized successfully with explicit options');
    } else {
      // Try default initialization (uses google-services.json automatically)
      await Firebase.initializeApp();
      firebaseInitialized = true;
      debugPrint('Firebase initialized with default config from google-services.json');
    }
  } catch (e) {
    debugPrint('Error initializing Firebase: $e');
    debugPrint('App will continue but authentication features will not work');
    debugPrint('Please set up Firebase configuration (see mobile/FIREBASE_SETUP.md)');
    // Continue anyway - the app can still run, just without Firebase features
  }
  
  runApp(MyApp(firebaseInitialized: firebaseInitialized));
}

class MyApp extends StatelessWidget {
  final bool firebaseInitialized;
  
  const MyApp({super.key, this.firebaseInitialized = false});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthService(firebaseInitialized: firebaseInitialized),
      child: MaterialApp(
        title: 'Radio App',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          useMaterial3: true,
        ),
        initialRoute: '/',
        routes: {
          '/': (context) => const AuthWrapper(),
          '/login': (context) => const LoginScreen(),
          '/player': (context) => const PlayerScreen(),
          '/upload': (context) => const UploadScreen(),
          '/profile': (context) => const ProfileScreen(),
          '/payment': (context) => const PaymentScreen(),
        },
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthService>(
      builder: (context, authService, child) {
        return StreamBuilder(
          stream: authService.authStateChanges,
          builder: (context, snapshot) {
        // Show loading indicator while checking auth state
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        // Handle errors
        if (snapshot.hasError) {
          return Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Error: ${snapshot.error}'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => Navigator.of(context).pushReplacementNamed('/login'),
                    child: const Text('Go to Login'),
                  ),
                ],
              ),
            ),
          );
        }

        // User is authenticated - show player
        if (snapshot.hasData && snapshot.data != null) {
          return const PlayerScreen();
        }

        // User is not authenticated - show login
        return const LoginScreen();
          },
        );
      },
    );
  }
}
