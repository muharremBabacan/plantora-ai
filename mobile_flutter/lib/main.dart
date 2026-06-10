import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'providers/garden_provider.dart';
import 'screens/home_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/login_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: 'AIzaSyBFuRFDjBmem9cRKTgkVxm_wI42ckXYsZU',
        appId: '1:681383641025:web:e30a4d53515977f417f940',
        messagingSenderId: '681383641025',
        projectId: 'plantora-ai-002',
        storageBucket: 'plantora-ai-002.firebasestorage.app',
      ),
    );
  } catch (e) {
    print("Firebase initialization error: $e");
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => GardenProvider()),
      ],
      child: const PlantoraApp(),
    ),
  );
}

class PlantoraApp extends StatelessWidget {
  const PlantoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Plantora AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF15803D), // Emerald Green
          brightness: Brightness.dark,
          background: const Color(0xFF0C0F0D), // Soft dark nature bg
          surface: const Color(0xFF141916),
        ),
        textTheme: const TextTheme(
          titleLarge: TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.bold),
          bodyMedium: TextStyle(fontFamily: 'Outfit'),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}

class MainNavigationWrapper extends StatefulWidget {
  const MainNavigationWrapper({super.key});

  @override
  State<MainNavigationWrapper> createState() => _MainNavigationWrapperState();
}

class _MainNavigationWrapperState extends State<MainNavigationWrapper> {
  late PageController _pageController;
  final List<Widget> _screens = [
    const HomeScreen(),
    const ScanScreen(),
    const CalendarScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<GardenProvider>(context);
    final currentIndex = provider.currentTabIndex;

    // Sync PageController page index when provider tab index updates
    if (_pageController.hasClients && _pageController.page?.round() != currentIndex) {
      _pageController.animateToPage(
        currentIndex,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }

    return Scaffold(
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) {
          provider.currentTabIndex = index;
          if (index != 1) {
            provider.activeRescanPlantId = null;
          }
        },
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white10, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          backgroundColor: const Color(0xFF0F1311),
          selectedItemColor: const Color(0xFF22C55E),
          unselectedItemColor: Colors.grey,
          showSelectedLabels: true,
          showUnselectedLabels: true,
          type: BottomNavigationBarType.fixed,
          onTap: (index) {
            provider.currentTabIndex = index;
            if (index != 1) {
              provider.activeRescanPlantId = null;
            }
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Bahçem',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.camera_alt_outlined),
              activeIcon: Icon(Icons.camera_alt),
              label: 'Bitki Tara',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined),
              activeIcon: Icon(Icons.calendar_today),
              label: 'Takvim',
            ),
          ],
        ),
      ),
    );
  }
}
