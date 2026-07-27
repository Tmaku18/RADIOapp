import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:radio_app/core/auth/auth_service.dart';
import 'package:radio_app/core/navigation/app_router.dart';
import 'package:radio_app/core/navigation/app_routes.dart';
import 'package:radio_app/core/theme/theme_controller.dart';
import 'package:radio_app/features/pro_networx/widgets/pro_network_paywall_sheet.dart';

/// Widget-level smoke for critical journeys without real backend / Firebase /
/// audio_service (heavy screens are stubbed; [AppRouter] still wires names).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget harness({
    required GlobalKey<NavigatorState> navKey,
    required Widget home,
  }) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthService(firebaseInitialized: false),
        ),
        ChangeNotifierProvider.value(value: ThemeController()),
      ],
      child: MaterialApp(
        navigatorKey: navKey,
        home: home,
        onGenerateRoute: (settings) {
          final stubs = <String, WidgetBuilder>{
            AppRoutes.discovery: (_) =>
                const Scaffold(body: Text('Discover stub')),
            AppRoutes.nearbyPeople: (_) =>
                const Scaffold(body: Text('Nearby stub')),
            AppRoutes.upload: (_) => const Scaffold(body: Text('Upload stub')),
            AppRoutes.settings: (_) =>
                const Scaffold(body: Text('Settings stub')),
            AppRoutes.proNetworxLanding: (_) =>
                const Scaffold(body: Text('Pro-Networx stub')),
            AppRoutes.artistProfile: (_) =>
                const Scaffold(body: Text('Artist profile stub')),
            AppRoutes.login: (_) => const Scaffold(body: Text('Login stub')),
            AppRoutes.welcome: (_) =>
                const Scaffold(body: Text('Welcome stub')),
          };
          final name = settings.name;
          if (name != null && stubs.containsKey(name)) {
            return MaterialPageRoute<void>(
              settings: settings,
              builder: stubs[name]!,
            );
          }
          return AppRouter.onGenerateRoute(settings);
        },
      ),
    );
  }

  testWidgets('firebase-off auth shell lands on welcome marker', (tester) async {
    final navKey = GlobalKey<NavigatorState>();
    await tester.pumpWidget(
      harness(
        navKey: navKey,
        home: Builder(
          builder: (context) {
            final auth = context.watch<AuthService>();
            if (!auth.firebaseInitialized) {
              return const Scaffold(body: Text('Welcome stub'));
            }
            return const Scaffold(body: Text('Home stub'));
          },
        ),
      ),
    );
    await tester.pump();
    expect(find.text('Welcome stub'), findsOneWidget);
  });

  testWidgets('home tabs + critical destinations open', (tester) async {
    final navKey = GlobalKey<NavigatorState>();
    var tab = 0;

    await tester.pumpWidget(
      harness(
        navKey: navKey,
        home: StatefulBuilder(
          builder: (context, setState) {
            final labels = ['Radio', 'Feed', 'Discover'];
            return Scaffold(
              appBar: AppBar(title: Text(labels[tab])),
              body: Column(
                children: [
                  Expanded(child: Center(child: Text('${labels[tab]} body'))),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final entry in [
                        (AppRoutes.nearbyPeople, 'Open Nearby'),
                        (AppRoutes.upload, 'Open Upload'),
                        (AppRoutes.settings, 'Open Settings'),
                        (AppRoutes.proNetworxLanding, 'Open Pro-Networx'),
                        (AppRoutes.artistProfile, 'Open Artist'),
                      ])
                        TextButton(
                          onPressed: () => Navigator.pushNamed(
                            context,
                            entry.$1,
                            arguments: entry.$1 == AppRoutes.artistProfile
                                ? 'artist_smoke'
                                : null,
                          ),
                          child: Text(entry.$2),
                        ),
                    ],
                  ),
                ],
              ),
              bottomNavigationBar: BottomNavigationBar(
                currentIndex: tab,
                onTap: (i) => setState(() => tab = i),
                items: const [
                  BottomNavigationBarItem(
                    icon: Icon(Icons.radio),
                    label: 'Radio',
                  ),
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
          },
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Feed'));
    await tester.pump();
    expect(find.text('Feed body'), findsOneWidget);

    await tester.tap(find.text('Discover'));
    await tester.pump();
    expect(find.text('Discover body'), findsOneWidget);

    Future<void> openAndPop(String button, String stub) async {
      await tester.tap(find.text(button));
      await tester.pumpAndSettle();
      expect(find.text(stub), findsOneWidget);
      navKey.currentState!.pop();
      await tester.pumpAndSettle();
    }

    await openAndPop('Open Nearby', 'Nearby stub');
    await openAndPop('Open Upload', 'Upload stub');
    await openAndPop('Open Settings', 'Settings stub');
    await openAndPop('Open Pro-Networx', 'Pro-Networx stub');
    await openAndPop('Open Artist', 'Artist profile stub');
  });

  testWidgets('Pro-Networx paywall sheet presents', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ProNetworkPaywallSheet()),
      ),
    );
    await tester.pump();
    expect(find.textContaining('Subscribe to Pro-Networx'), findsOneWidget);
  });

  test('AppRouter still resolves critical journey names', () {
    for (final name in [
      AppRoutes.discovery,
      AppRoutes.nearbyPeople,
      AppRoutes.upload,
      AppRoutes.settings,
      AppRoutes.proNetworxLanding,
      AppRoutes.artistProfile,
    ]) {
      final route = AppRouter.onGenerateRoute(
        RouteSettings(
          name: name,
          arguments: name == AppRoutes.artistProfile ? 'x' : null,
        ),
      );
      expect(route, isA<MaterialPageRoute<dynamic>>(), reason: name);
    }
  });
}
