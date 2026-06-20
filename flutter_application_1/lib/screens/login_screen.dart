import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart' hide Card;
import 'package:shadcn_ui/shadcn_ui.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _isLoginMode = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.primary,
              theme.colorScheme.ring,
            ],
          ),
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ShadCard(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Icon(
                        LucideIcons.clipboardCheck,
                        size: 40,
                        color: theme.colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'StudyTask',
                      style: theme.textTheme.h2,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _isLoginMode
                          ? 'Melde dich an, um deine Gruppe und Aufgaben zu synchronisieren.'
                          : 'Erstelle ein Konto, um loszulegen.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.muted,
                    ),
                    const SizedBox(height: 24),
                    ShadInput(
                      controller: _emailController,
                      placeholder: const Text('E-Mail'),
                      keyboardType: TextInputType.emailAddress,
                      leading: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(LucideIcons.mail, size: 16, color: theme.colorScheme.mutedForeground),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ShadInput(
                      controller: _passwordController,
                      placeholder: const Text('Passwort'),
                      obscureText: true,
                      leading: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(LucideIcons.lock, size: 16, color: theme.colorScheme.mutedForeground),
                      ),
                    ),
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 12),
                      ShadAlert.destructive(
                        icon: Icon(LucideIcons.circleAlert, size: 16),
                        title: const Text('Fehler'),
                        description: Text(_errorMessage!),
                      ),
                    ],
                    const SizedBox(height: 20),
                    ShadButton(
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isLoginMode ? 'Anmelden' : 'Registrieren'),
                    ),
                    const SizedBox(height: 8),
                    ShadButton.ghost(
                      onPressed: _isLoading
                          ? null
                          : () => setState(() => _isLoginMode = !_isLoginMode),
                      child: Text(
                        _isLoginMode
                            ? 'Noch kein Konto? Registrieren'
                            : 'Schon registriert? Anmelden',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (!email.contains('@') || password.length < 6) {
      setState(() => _errorMessage = 'Bitte gültige E-Mail und mindestens 6 Zeichen Passwort eingeben.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final auth = FirebaseAuth.instance;
      if (_isLoginMode) {
        await auth.signInWithEmailAndPassword(email: email, password: password);
      } else {
        await auth.createUserWithEmailAndPassword(email: email, password: password);
      }
    } on FirebaseAuthException catch (e) {
      setState(() => _errorMessage = e.message ?? 'Authentifizierung fehlgeschlagen');
    } catch (_) {
      setState(() => _errorMessage = 'Unerwarteter Fehler beim Login');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
