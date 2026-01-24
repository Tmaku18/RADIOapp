import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../features/player/player_screen.dart';
import '../features/upload/upload_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/credits/credits_screen.dart';
import '../core/auth/auth_service.dart';
import '../core/models/user.dart' as app_user;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  app_user.User? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      final user = await authService.getUserProfile();
      if (mounted) {
        setState(() {
          _user = user;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Determine which navigation items to show based on user role
    final isArtist = _user?.role == 'artist';
    
    // Build navigation items based on role
    final List<BottomNavigationBarItem> navItems = [
      const BottomNavigationBarItem(
        icon: Icon(Icons.radio),
        label: 'Radio',
      ),
    ];
    
    // Artists get Upload and Credits tabs
    if (isArtist) {
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.upload),
        label: 'Upload',
      ));
      navItems.add(const BottomNavigationBarItem(
        icon: Icon(Icons.monetization_on),
        label: 'Credits',
      ));
    }
    
    // Everyone gets Profile tab
    navItems.add(const BottomNavigationBarItem(
      icon: Icon(Icons.person),
      label: 'Profile',
    ));

    // Map indices based on role
    Widget getCurrentScreen() {
      if (isArtist) {
        switch (_currentIndex) {
          case 0:
            return const PlayerScreen();
          case 1:
            return const UploadScreen();
          case 2:
            return const CreditsScreen();
          case 3:
            return const ProfileScreen();
          default:
            return const PlayerScreen();
        }
      } else {
        // Listeners only have Radio and Profile
        switch (_currentIndex) {
          case 0:
            return const PlayerScreen();
          case 1:
            return const ProfileScreen();
          default:
            return const PlayerScreen();
        }
      }
    }

    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Scaffold(
      body: getCurrentScreen(),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        selectedItemColor: Colors.deepPurple,
        unselectedItemColor: Colors.grey,
        items: navItems,
      ),
    );
  }
}
