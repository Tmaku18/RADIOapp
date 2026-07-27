import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:radio_app/core/auth/auth_service.dart';
import 'package:radio_app/core/navigation/app_routes.dart';
import 'package:radio_app/core/theme/theme_controller.dart';
import 'package:radio_app/features/pro_networx/widgets/pro_network_paywall_sheet.dart';

/// Device/emulator smoke for critical journeys (no real backend).
/// Run: `flutter test integration_test/app_smoke_test.dart`
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login shell, tabs, destinations, paywall', (tester) async {
    final navKey = GlobalKey<NavigatorState>();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(
            create: (_) => AuthService(firebaseInitialized: false),
          ),
          ChangeNotifierProvider.value(value: ThemeController()),
        ],
        child: MaterialApp(
          navigatorKey: navKey,
          home: Builder(
            builder: (context) {
              final auth = context.watch<AuthService>();
              if (!auth.firebaseInitialized) {
                return Scaffold(
                  body: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('Welcome'),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pushReplacement(
                              MaterialPageRoute<void>(
                                builder: (_) => _FakeHomeShell(navKey: navKey),
                              ),
                            );
                          },
                          child: const Text('Enter home'),
                        ),
                      ],
                    ),
                  ),
                );
              }
              return const SizedBox.shrink();
            },
          ),
          onGenerateRoute: (settings) {
            final stubs = <String, String>{
              AppRoutes.discovery: 'Discover',
              AppRoutes.nearbyPeople: 'Nearby',
              AppRoutes.upload: 'Upload',
              AppRoutes.settings: 'Settings',
              AppRoutes.proNetworxLanding: 'Pro-Networx',
              AppRoutes.artistProfile: 'Artist profile',
            };
            final label = stubs[settings.name];
            if (label == null) return null;
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => Scaffold(body: Text(label)),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Welcome'), findsOneWidget);

    await tester.tap(find.text('Enter home'));
    await tester.pumpAndSettle();
    expect(find.text('Radio'), findsWidgets);

    await tester.tap(find.text('Discover'));
    await tester.pumpAndSettle();

    Future<void> openAndPop(String button, String label) async {
      await tester.tap(find.text(button));
      await tester.pumpAndSettle();
      expect(find.text(label), findsOneWidget);
      navKey.currentState!.pop();
      await tester.pumpAndSettle();
    }

    await openAndPop('Open Nearby', 'Nearby');
    await openAndPop('Open Upload', 'Upload');
    await openAndPop('Open Settings', 'Settings');
    await openAndPop('Open Artist', 'Artist profile');

    await tester.tap(find.text('Show paywall'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Subscribe to Pro-Networx'), findsOneWidget);
  });
}

class _FakeHomeShell extends StatefulWidget {
  const _FakeHomeShell({required this.navKey});

  final GlobalKey<NavigatorState> navKey;

  @override
  State<_FakeHomeShell> createState() => _FakeHomeShellState();
}

class _FakeHomeShellState extends State<_FakeHomeShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final labels = ['Radio', 'Feed', 'Discover'];
    return Scaffold(
      appBar: AppBar(
        title: Text(labels[_tab]),
        actions: [
          TextButton(
            onPressed: () => ProNetworkPaywallSheet.show(context),
            child: const Text('Show paywall'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: Center(child: Text('${labels[_tab]} body'))),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in [
                (AppRoutes.nearbyPeople, 'Open Nearby'),
                (AppRoutes.upload, 'Open Upload'),
                (AppRoutes.settings, 'Open Settings'),
                (AppRoutes.artistProfile, 'Open Artist'),
              ])
                TextButton(
                  onPressed: () => Navigator.pushNamed(
                    context,
                    entry.$1,
                    arguments: entry.$1 == AppRoutes.artistProfile ? 'a1' : null,
                  ),
                  child: Text(entry.$2),
                ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.radio), label: 'Radio'),
          BottomNavigationBarItem(
            icon: Icon(Icons.dynamic_feed),
            label: 'Feed',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.explore),
            label: 'Discover',
          ),
        ],
      ),
    );
  }
}
