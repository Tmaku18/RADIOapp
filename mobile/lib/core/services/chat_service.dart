import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../env.dart';
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
  ChatService();

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
  String _radioId = 'global';
  /// Latest emoji burst for UI floaters: `{ "❤️": 3, "🔥": 1 }`.
  Map<String, int> _lastEmojiBurst = const {};
  int _emojiBurstSeq = 0;

  // Getters
  ChatConnectionState get connectionState => _connectionState;
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  bool get chatEnabled => _chatEnabled;
  String? get disabledReason => _disabledReason;
  int get unreadCount => _unreadCount;
  bool get isUserAtBottom => _isUserAtBottom;

  String get radioId => _radioId;
  Map<String, int> get lastEmojiBurst => _lastEmojiBurst;
  int get emojiBurstSeq => _emojiBurstSeq;

  /// Initialize the chat service and register lifecycle observer
  Future<void> initialize({String radioId = 'global'}) async {
    _radioId = (radioId.trim().isEmpty ? 'global' : radioId.trim());
    if (_initialized) return;
    
    // Initialize Supabase client
    final supabaseUrl = env('SUPABASE_URL');
    final supabaseKey = env('SUPABASE_ANON_KEY');
    
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
      final response = await _apiService.get(
        'chat/history?limit=50&radioId=${Uri.encodeComponent(_radioId)}',
      );
      
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

    _channel = _supabase!.channel('radio-chat:$_radioId');
    
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
          debugPrint('ChatService: Connected to radio-chat:$_radioId channel');
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

  /// Supabase Flutter wraps broadcast bodies as `{ type, event, payload: {...} }`.
  /// Web already reads `payload.payload`; mobile must do the same.
  Map<String, dynamic> _unwrapBroadcast(Map<String, dynamic> envelope) {
    final inner = envelope['payload'];
    if (inner is Map) {
      return Map<String, dynamic>.from(inner);
    }
    return envelope;
  }

  /// Handle new message from realtime broadcast
  void _handleNewMessage(Map<String, dynamic> payload) {
    try {
      final message = ChatMessage.fromJson(_unwrapBroadcast(payload));
      if (message.id.isEmpty) return;
      final messageRadioId = (message.radioId ?? 'global').trim();
      if (messageRadioId != _radioId) return;

      // Avoid duplicates (including optimistic local inserts)
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
    final data = _unwrapBroadcast(payload);
    final deletedRadioId = (data['radioId'] ?? data['radio_id'])?.toString().trim();
    if (deletedRadioId != null &&
        deletedRadioId.isNotEmpty &&
        deletedRadioId != _radioId) {
      return;
    }
    final messageId =
        (data['messageId'] ?? data['message_id'] ?? data['id'])?.toString();
    if (messageId != null && messageId.isNotEmpty) {
      _messages.removeWhere((m) => m.id == messageId);
      notifyListeners();
    }
  }

  /// Handle emoji burst from realtime broadcast
  void _handleEmojiBurst(Map<String, dynamic> payload) {
    final data = _unwrapBroadcast(payload);
    debugPrint('ChatService: Emoji burst received - $data');
    final raw = data['emojis'];
    if (raw is! Map) return;
    final parsed = <String, int>{};
    raw.forEach((key, value) {
      final count = value is int
          ? value
          : int.tryParse(value?.toString() ?? '') ?? 0;
      if (count > 0 && key != null) {
        parsed[key.toString()] = count;
      }
    });
    if (parsed.isEmpty) return;
    _lastEmojiBurst = parsed;
    _emojiBurstSeq++;
    notifyListeners();
  }

  /// Local optimistic burst so the sender sees feedback immediately.
  void emitLocalEmojiBurst(String emoji, {int count = 1}) {
    if (emoji.isEmpty || count < 1) return;
    _lastEmojiBurst = {emoji: count};
    _emojiBurstSeq++;
    notifyListeners();
  }

  /// Send a chat message. Optimistically inserts so the sender sees it
  /// immediately even if Realtime echo is delayed or fails.
  Future<bool> sendMessage(
    String message, {
    String? songId,
    String? senderUserId,
    String? senderDisplayName,
    String? senderAvatarUrl,
  }) async {
    if (!_chatEnabled || message.trim().isEmpty) return false;

    final text = message.trim();
    try {
      final response = await _apiService.post('chat/send', {
        'message': text,
        if (songId != null) 'songId': songId,
        'radioId': _radioId,
      });
      final id = response is Map ? response['id']?.toString() : null;
      if (id != null && id.isNotEmpty && !_messages.any((m) => m.id == id)) {
        final name = (senderDisplayName ?? 'You').trim();
        _messages.add(
          ChatMessage(
            id: id,
            userId: (senderUserId ?? '').trim(),
            songId: songId,
            radioId: _radioId,
            displayName: name.isEmpty ? 'You' : name,
            avatarUrl: senderAvatarUrl,
            message: text,
            createdAt: DateTime.now(),
          ),
        );
        if (_messages.length > 100) {
          _messages.removeAt(0);
        }
        notifyListeners();
      }
      return true;
    } catch (e) {
      debugPrint('ChatService: Failed to send message - $e');
      return false;
    }
  }

  /// Send an emoji reaction
  Future<bool> sendEmoji(String emoji) async {
    try {
      // Immediate floater so taps feel responsive even before the 2s aggregate.
      emitLocalEmojiBurst(emoji);
      final res = await _apiService.post('chat/emoji', {
        'emoji': emoji,
        'radioId': _radioId,
      });
      if (res is Map && res['success'] == false) {
        debugPrint('ChatService: Emoji rejected by server');
        return false;
      }
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

  /// Switch chat to a different radio channel and rehydrate.
  Future<void> setRadioId(String radioId) async {
    final normalized = radioId.trim().isEmpty ? 'global' : radioId.trim();
    if (normalized == _radioId) return;
    _radioId = normalized;
    if (_initialized) {
      await _rehydrateAndSubscribe();
    }
  }

  /// Cleanup when service is disposed
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _unsubscribe();
    super.dispose();
  }
}
