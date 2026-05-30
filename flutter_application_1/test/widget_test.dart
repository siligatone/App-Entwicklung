import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_application_1/main.dart';

void main() {
  testWidgets('MainApp enthält eine MaterialApp', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MainApp(home: Scaffold(body: Text('Test'))),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });

  testWidgets('MainApp enthält einen Scaffold', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MainApp(home: Scaffold(body: Text('Test'))),
    );

    expect(find.byType(Scaffold), findsOneWidget);
  });

  testWidgets('MainApp zeigt übergebenes Home Widget', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MainApp(home: Scaffold(body: Text('Test Home'))),
    );

    expect(find.text('Test Home'), findsOneWidget);
  });
}
