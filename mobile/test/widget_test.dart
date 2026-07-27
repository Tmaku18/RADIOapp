import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:radio_app/core/auth/auth_service.dart';
import 'package:radio_app/core/navigation/app_router.dart';
import 'package:radio_app/core/theme/theme_controller.dart';

void main() {
  testWidgets('App shell builds (smoke test)', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(
            create: (_) => AuthService(firebaseInitialized: false),
          ),
          ChangeNotifierProvider.value(value: ThemeController()),
        ],
        child: MaterialApp(
          title: 'NETWORX',
          home: const Scaffold(body: Text('NETWORX test shell')),
          onGenerateRoute: AppRouter.onGenerateRoute,
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.text('NETWORX test shell'), findsOneWidget);
  });
}
