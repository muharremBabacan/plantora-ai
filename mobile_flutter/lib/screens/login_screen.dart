import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final LocalAuthentication auth = LocalAuthentication();
  bool _canCheckBiometrics = false;
  bool _isAuthenticating = false;
  String _statusMessage = "Biyometrik doğrulama bekleniyor...";

  @override
  void initState() {
    super.initState();
    _checkBiometrics().then((_) {
      if (_canCheckBiometrics) {
        _authenticate();
      }
    });
  }

  Future<void> _checkBiometrics() async {
    bool canCheckBiometrics;
    try {
      canCheckBiometrics = await auth.canCheckBiometrics;
    } on PlatformException catch (e) {
      canCheckBiometrics = false;
      print(e);
    }
    if (!mounted) return;

    setState(() {
      _canCheckBiometrics = canCheckBiometrics;
      if (!canCheckBiometrics) {
        _statusMessage = "Cihazınızda biyometrik doğrulama desteği bulunamadı.";
      }
    });
  }

  Future<void> _authenticate() async {
    bool authenticated = false;
    try {
      setState(() {
        _isAuthenticating = true;
        _statusMessage = "Kimlik doğrulanıyor...";
      });
      authenticated = await auth.authenticate(
        localizedReason: 'Plantora\'ya güvenli giriş yapmak için yüzünüzü veya parmak izinizi doğrulayın.',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
    } on PlatformException catch (e) {
      print(e);
      setState(() {
        _isAuthenticating = false;
        _statusMessage = "Hata: ${e.message}";
      });
      return;
    }
    if (!mounted) return;

    if (authenticated) {
      setState(() {
        _statusMessage = "Giriş yapılıyor...";
      });
      _firebaseSignInAndNavigate();
    } else {
      setState(() {
        _isAuthenticating = false;
        _statusMessage = "Kimlik doğrulama başarısız oldu.";
      });
    }
  }

  Future<void> _firebaseSignInAndNavigate() async {
    try {
      // Sign in anonymously to get a secure UID for database syncing
      final userCredential = await FirebaseAuth.instance.signInAnonymously();
      
      if (!mounted) return;
      if (userCredential.user != null) {
        // Redirect to main navigation
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const MainNavigationWrapper()),
        );
      }
    } catch (e) {
      setState(() {
        _isAuthenticating = false;
        _statusMessage = "Firebase Bağlantı Hatası: $e";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFF0C0F0D),
              Color(0xFF141916),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 48.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(),
              
              // App logo
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.green.withOpacity(0.2), width: 2),
                ),
                child: const Center(
                  child: Text('🌿', style: TextStyle(fontSize: 48)),
                ),
              ),
              const SizedBox(height: 24),
              
              const Text(
                'Plantora AI',
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),
              
              const Text(
                'Akıllı Bitki Teşhisi ve Sağlık Asistanı',
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              
              const Spacer(),
              
              // Status text
              Text(
                _statusMessage,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _statusMessage.startsWith("Hata") ? Colors.red : Colors.grey,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 24),
              
              if (_canCheckBiometrics) ...[
                // Big circular biometric button
                InkWell(
                  onTap: _isAuthenticating ? null : _authenticate,
                  borderRadius: BorderRadius.circular(40),
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.1),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.green, width: 2),
                    ),
                    child: const Icon(
                      Icons.fingerprint,
                      size: 44,
                      color: Colors.green,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Biyometrik Giriş İçin Dokunun',
                  style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ] else ...[
                // Manual skip button if device has no biometrics
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _firebaseSignInAndNavigate,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Misafir Girişi İle Devam Et ➔',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
              
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
