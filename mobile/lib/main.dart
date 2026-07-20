import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/env.dart';
import 'core/services/audio_player_service.dart';
import 'core/services/radio_presence_service.dart';
import 'core/services/radio_background_sync_service.dart';
import 'core/auth/auth_service.dart';
import 'core/services/push_notification_service.dart';
import 'core/services/app_update_service.dart';
import 'core/navigation/app_router.dart';
import 'core/navigation/app_routes.dart';
import 'core/theme/networx_theme.dart';
import 'core/theme/theme_controller.dart';
import 'widgets/login_screen.dart';
import 'widgets/home_screen.dart';
import 'widgets/splash_loading_screen.dart';
import 'features/welcome/welcome_landing_screen.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    debugPrint('Warning: Could not load .env file: $e');
  }

  // Theme mode persistence (System/Dark/Light). Default = Dark.
  final themeController = ThemeController();
  await themeController.load();

  // Stands up the audio_service handler (music + DJ voice-over players) and
  // configures the audio session for background playback.
  await AudioPlayerService.ensureInitialized();
  RadioPresenceService.instance.start();
  RadioBackgroundSyncService.instance.start();

  // Initialize Stripe
  final stripePublishableKey = env('STRIPE_PUBLISHABLE_KEY');
  if (stripePublishableKey != null && stripePublishableKey.isNotEmpty) {
    Stripe.publishableKey = stripePublishableKey;
    debugPrint('Stripe initialized successfully');
  } else {
    debugPrint('Warning: STRIPE_PUBLISHABLE_KEY not found in .env');
  }

  // Initialize Firebase with timeout so app doesn't hang on emulator/slow network
  bool firebaseInitialized = false;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    ).timeout(
      const Duration(seconds: 12),
      onTimeout: () {
        debugPrint(
          'Firebase init timed out (e.g. emulator) – showing login anyway',
        );
        throw TimeoutException('Firebase initialization timed out');
      },
    );
    firebaseInitialized = true;
    debugPrint('Firebase initialized successfully');

    try {
      await AuthService.warmUpGoogleSignIn();
      debugPrint('Google Sign-In initialized successfully');
    } catch (e) {
      debugPrint('Google Sign-In init failed (will retry on sign-in): $e');
    }

    // Initialize push notifications after Firebase (lazy permission strategy)
    await PushNotificationService().initialize();
    debugPrint('Push notifications initialized');
  } catch (e) {
    debugPrint('Error initializing Firebase: $e');
    debugPrint('App will continue but authentication features will not work');
  }

  // Initialize Supabase (for Realtime events beyond chat)
  final supabaseUrl = env('SUPABASE_URL');
  final supabaseAnonKey = env('SUPABASE_ANON_KEY');
  if (supabaseUrl != null &&
      supabaseAnonKey != null &&
      supabaseUrl.isNotEmpty &&
      supabaseAnonKey.isNotEmpty) {
    try {
      await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
      debugPrint('Supabase initialized successfully');
    } catch (e) {
      // Already initialized or unavailable in this environment.
      debugPrint('Supabase init skipped: $e');
    }
  } else {
    debugPrint('Warning: SUPABASE_URL / SUPABASE_ANON_KEY missing in .env');
  }

  final navigatorKey = GlobalKey<NavigatorState>();
  runApp(MyApp(
    firebaseInitialized: firebaseInitialized,
    themeController: themeController,
    navigatorKey: navigatorKey,
  ));
}

class MyApp extends StatefulWidget {
  final bool firebaseInitialized;
  final ThemeController themeController;
  final GlobalKey<NavigatorState> navigatorKey;

  const MyApp({
    super.key,
    this.firebaseInitialized = false,
    required this.themeController,
    required this.navigatorKey,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final navContext = widget.navigatorKey.currentContext;
      if (navContext != null) {
        unawaited(AppUpdateService.instance.checkAndPrompt(navContext));
      }

      if (!widget.firebaseInitialized) return;
      PushNotificationService().onNotificationTap = (data) {
        final nav = widget.navigatorKey.currentState;
        if (nav == null) return;
        final type = data['type']?.toString();
        if (type == 'song_played' && data['playId'] != null) {
          nav.pushNamed(
            AppRoutes.analytics,
            arguments: {'playId': data['playId']},
          );
        } else if (type == 'up_next' ||
            type == 'live_now' ||
            type == 'song_up_next' ||
            type == 'song_live_now' ||
            type == 'artist_song_on_radio' ||
            type == 'followed_artist_up_next') {
          nav.pushNamed(AppRoutes.player);
        } else if (type == 'artist_live_now' && data['artistId'] != null) {
          nav.pushNamed(
            AppRoutes.watchLive,
            arguments: data['artistId'].toString(),
          );
        } else if (type == 'song_liked') {
          nav.pushNamed(AppRoutes.notifications);
        } else if (type == 'app_update') {
          unawaited(
            AppUpdateService.openStoreUrl(data['storeUrl']?.toString()),
          );
        }
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthService>(
          create: (_) => AuthService(firebaseInitialized: widget.firebaseInitialized),
        ),
        ChangeNotifierProvider<ThemeController>.value(value: widget.themeController),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, child) {
          // Brand primary will become role-aware once the navigation shell
          // consolidates the user profile. Default to Artist amethyst for now.
          const brand = NetworxBrand.artist;
          return MaterialApp(
            navigatorKey: widget.navigatorKey,
            title: 'NETWORX',
            theme: buildNetworxTheme(brightness: Brightness.light, brand: brand),
            darkTheme:
                buildNetworxTheme(brightness: Brightness.dark, brand: brand),
            themeMode: theme.themeMode,
            initialRoute: AppRoutes.root,
            routes: {
              AppRoutes.root: (context) => const AuthWrapper(),
              AppRoutes.welcome: (context) => const WelcomeLandingScreen(),
              AppRoutes.login: (context) => const LoginScreen(),
              AppRoutes.home: (context) => const HomeScreen(),
            },
            onGenerateRoute: AppRouter.onGenerateRoute,
          );
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
        // Check if Firebase is initialized
        if (!authService.firebaseInitialized) {
          debugPrint('AuthWrapper: Firebase not initialized');
          return const WelcomeLandingScreen();
        }

        return StreamBuilder(
          stream: authService.authStateChanges,
          builder: (context, snapshot) {
            debugPrint(
              'AuthWrapper: connectionState=${snapshot.connectionState}, hasData=${snapshot.hasData}, data=${snapshot.data}',
            );

            // Show branded loading screen while checking auth state
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SplashLoadingScreen();
            }

            // Handle errors
            if (snapshot.hasError) {
              return Scaffold(
                body: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 48,
                        color: Colors.red,
                      ),
                      const SizedBox(height: 16),
                      Text('Error: ${snapshot.error}'),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => Navigator.of(
                          context,
                        ).pushReplacementNamed(AppRoutes.login),
                        child: const Text('Go to Login'),
                      ),
                    ],
                  ),
                ),
              );
            }

            // User is authenticated - show home with navigation
            if (snapshot.hasData && snapshot.data != null) {
              return const HomeScreen();
            }

            // User is not authenticated - show the public landing page first.
            // Sign up / Log in CTAs push the LoginScreen on top.
            return const WelcomeLandingScreen();
          },
        );
      },
    );
  }
}
