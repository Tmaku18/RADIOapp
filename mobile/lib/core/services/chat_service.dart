import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/chat_message.dart';
import 'api_service.dart';

/// Connection states for the chat service
enum ChatConnectionState {
  connecting,
  connected,
  reconnecting,
  offline,
}

/// Chat service with production-grade features:
/// - Hydration: Fetch history on load
/// - Connection states: Track realtime connection status
/// - Lifecycle management: Pause/resume subscriptions with app state
/// - Smart scroll: Track if user is at bottom for auto-scroll decisions
class ChatService extends ChangeNotifier with WidgetsBindingObserver {
  static final ChatService _instance = ChatService._internal();
  factory ChatService() => _instance;
  ChatService._internal();

  final ApiService _apiService = ApiService();
  
  // Supabase client for realtime
  SupabaseClient? _supabase;
  RealtimeChannel? _channel;
  
  // State
  ChatConnectionState _connectionState = ChatConnectionState.offline;
  List<ChatMessage> _messages = [];
  bool _chatEnabled = true;
  String? _disabledReason;
  int _unreadCount = 0;
  bool _isUserAtBottom = true;
  bool _initialized = false;

  // Getters
  ChatConnectionState get connectionState => _connectionState;
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  bool get chatEnabled => _chatEnabled;
  String? get disabledReason => _disabledReason;
  int get unreadCount => _unreadCount;
  bool get isUserAtBottom => _isUserAtBottom;

  /// Initialize the chat service and register lifecycle observer
  Future<void> initialize() async {
    if (_initialized) return;
    
    // Initialize Supabase client
    final supabaseUrl = dotenv.env['SUPABASE_URL'];
    final supabaseKey = dotenv.env['SUPABASE_ANON_KEY'];
    
    if (supabaseUrl == null || supabaseKey == null) {
      debugPrint('ChatService: Supabase credentials not found in .env');
      _connectionState = ChatConnectionState.offline;
      notifyListeners();
      return;
    }

    try {
      await Supabase.initialize(
        url: supabaseUrl,
        anonKey: supabaseKey,
      );
      _supabase = Supabase.instance.client;
    } catch (e) {
      // Supabase might already be initialized
      _supabase = Supabase.instance.client;
    }
    
    // Register lifecycle observer
    WidgetsBinding.instance.addObserver(this);
    
    _initialized = true;
    
    // Initial hydration and subscription
    await _rehydrateAndSubscribe();
  }

  /// Handle app lifecycle changes
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Save battery when app is backgrounded
      _unsubscribe();
      _connectionState = ChatConnectionState.offline;
      notifyListeners();
    } else if (state == AppLifecycleState.resumed) {
      // Refresh data when app is foregrounded
      _rehydrateAndSubscribe();
    }
  }

  /// Hydrate chat history and subscribe to realtime updates
  Future<void> _rehydrateAndSubscribe() async {
    if (_supabase == null) return;
    
    _connectionState = ChatConnectionState.connecting;
    notifyListeners();

    try {
      // Step 1: Hydration - Fetch latest history from API
      final response = await _apiService.get('chat/history?limit=50');
      
      if (response != null && response['messages'] != null) {
        final messagesList = response['messages'] as List;
        _messages = messagesList
            .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
            .toList();
      }

      // Step 2: Get chat status
      final statusResponse = await _apiService.get('chat/status');
      if (statusResponse != null) {
        _chatEnabled = statusResponse['enabled'] ?? true;
        _disabledReason = statusResponse['reason'];
      }

      // Step 3: Subscribe to realtime channel
      await _subscribe();

      _connectionState = ChatConnectionState.connected;
      _unreadCount = 0;
      notifyListeners();
    } catch (e) {
      debugPrint('ChatService: Failed to hydrate - $e');
      _connectionState = ChatConnectionState.offline;
      notifyListeners();
    }
  }

  /// Subscribe to the Supabase Realtime channel
  Future<void> _subscribe() async {
    if (_supabase == null) return;
    
    // Unsubscribe from existing channel first
    await _unsubscribe();

    _channel = _supabase!.channel('radio-chat');
    
    _channel!
      .onBroadcast(
        event: 'new_message',
        callback: (payload) {
          _handleNewMessage(payload);
        },
      )
      .onBroadcast(
        event: 'message_deleted',
        callback: (payload) {
          _handleMessageDeleted(payload);
        },
      )
      .onBroadcast(
        event: 'emoji_burst',
        callback: (payload) {
          _handleEmojiBurst(payload);
        },
      )
      .subscribe((status, error) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          _connectionState = ChatConnectionState.connected;
          debugPrint('ChatService: Connected to radio-chat channel');
        } else if (status == RealtimeSubscribeStatus.timedOut) {
          _connectionState = ChatConnectionState.reconnecting;
          debugPrint('ChatService: Connection timed out, reconnecting...');
        } else if (status == RealtimeSubscribeStatus.closed) {
          _connectionState = ChatConnectionState.offline;
          debugPrint('ChatService: Connection closed');
        }
        notifyListeners();
      });
  }

  /// Unsubscribe from the realtime channel
  Future<void> _unsubscribe() async {
    if (_channel != null) {
      await _supabase?.removeChannel(_channel!);
      _channel = null;
    }
  }

  /// Handle new message from realtime broadcast
  void _handleNewMessage(Map<String, dynamic> payload) {
    try {
      final message = ChatMessage.fromJson(payload);
      
      // Avoid duplicates
      if (_messages.any((m) => m.id == message.id)) return;
      
      _messages.add(message);
      
      // Keep last 100 messages
      if (_messages.length > 100) {
        _messages.removeAt(0);
      }
      
      // Update unread count if user is scrolled up
      if (!_isUserAtBottom) {
        _unreadCount++;
      }
      
      notifyListeners();
    } catch (e) {
      debugPrint('ChatService: Error handling new message - $e');
    }
  }

  /// Handle message deletion from realtime broadcast
  void _handleMessageDeleted(Map<String, dynamic> payload) {
    final messageId = payload['messageId'] as String?;
    if (messageId != null) {
      _messages.removeWhere((m) => m.id == messageId);
      notifyListeners();
    }
  }

  /// Handle emoji burst from realtime broadcast
  void _handleEmojiBurst(Map<String, dynamic> payload) {
    // Emoji burst handling - can be used by UI to display floating emojis
    debugPrint('ChatService: Emoji burst received - $payload');
    // This will be handled by a separate callback in the UI
  }

  /// Send a chat message
  Future<bool> sendMessage(String message, {String? songId}) async {
    if (!_chatEnabled || message.trim().isEmpty) return false;
    
    try {
      await _apiService.post('chat/send', {
        'message': message.trim(),
        if (songId != null) 'songId': songId,
      });
      return true;
    } catch (e) {
      debugPrint('ChatService: Failed to send message - $e');
      return false;
    }
  }

  /// Send an emoji reaction
  Future<bool> sendEmoji(String emoji) async {
    try {
      await _apiService.post('chat/emoji', {
        'emoji': emoji,
      });
      return true;
    } catch (e) {
      debugPrint('ChatService: Failed to send emoji - $e');
      return false;
    }
  }

  /// Add a system message (e.g., song transition)
  void addSystemMessage(ChatMessage message) {
    _messages.add(message);
    notifyListeners();
  }

  /// Called when song changes to insert transition message
  void onSongChanged(String songTitle) {
    addSystemMessage(ChatMessage.songTransition(songTitle));
  }

  /// Update whether the user is at the bottom of the chat
  void setIsUserAtBottom(bool value) {
    if (_isUserAtBottom != value) {
      _isUserAtBottom = value;
      if (value) {
        // Clear unread count when user scrolls to bottom
        _unreadCount = 0;
        notifyListeners();
      }
    }
  }

  /// Manual reconnect attempt
  Future<void> reconnect() async {
    if (_connectionState == ChatConnectionState.offline ||
        _connectionState == ChatConnectionState.reconnecting) {
      await _rehydrateAndSubscribe();
    }
  }

  /// Cleanup when service is disposed
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _unsubscribe();
    super.dispose();
  }
}
