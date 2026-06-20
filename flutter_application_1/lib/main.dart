import 'package:flutter/material.dart' hide Card;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shadcn_ui/shadcn_ui.dart';
import 'firebase_options.dart';

import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/setup_screen.dart';
import 'state/app_state.dart';
import 'services/firestore_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    final appState = await AppState.load();

    runApp(
      MultiProvider(
        providers: [
          Provider<FirestoreService>(create: (_) => FirestoreService()),
          ChangeNotifierProvider<AppState>.value(value: appState),
        ],
        child: const MainApp(),
      ),
    );
  } catch (error) {
    runApp(SetupErrorApp(error: error));
  }
}

class MainApp extends StatelessWidget {
  const MainApp({super.key, this.home});

  final Widget? home;

  @override
  Widget build(BuildContext context) {
    final resolvedHome = home ?? const AuthGate();

    return ShadApp(
      debugShowCheckedModeBanner: false,
      theme: ShadThemeData(
        brightness: Brightness.light,
        colorScheme: const ShadSlateColorScheme.light(),
        textTheme: ShadTextTheme.fromGoogleFont(GoogleFonts.inter),
      ),
      home: resolvedHome,
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final user = snapshot.data;
        if (user == null) {
          return const LoginScreen();
        }

        if (!appState.isConfigured) {
          return const SetupScreen();
        }

        return const HomeScreen();
      },
    );
  }
}

class SetupErrorApp extends StatelessWidget {
  const SetupErrorApp({super.key, required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        appBar: AppBar(title: const Text('Setup Fehler')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Firebase konnte nicht initialisiert werden:\n\n$error',
          ),
        ),
      ),
    );
  }
}
