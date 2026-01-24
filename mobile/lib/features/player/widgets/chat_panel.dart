import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/chat_service.dart';
import '../../../core/models/chat_message.dart';

/// Chat panel widget with production-grade UX features:
/// - Connection indicator (green/yellow/gray dot)
/// - Smart scroll (auto-scroll only if at bottom)
/// - "New Messages" badge when scrolled up
/// - Song transition system messages
/// - Character counter (280 max)
/// - Emoji reactions bar
class ChatPanel extends StatefulWidget {
  final String? currentSongId;
  final String? currentSongTitle;
  final bool isExpanded;
  final VoidCallback? onToggleExpand;

  const ChatPanel({
    super.key,
    this.currentSongId,
    this.currentSongTitle,
    this.isExpanded = false,
    this.onToggleExpand,
  });

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();
  bool _isSending = false;
  String? _lastSongTitle;

  // Allowed emojis for reactions
  static const List<String> _allowedEmojis = ['❤️', '🔥', '🎵', '👏', '😍', '🙌', '💯', '✨'];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(ChatPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Handle song transitions
    if (widget.currentSongTitle != null && 
        widget.currentSongTitle != _lastSongTitle &&
        _lastSongTitle != null) {
      final chatService = Provider.of<ChatService>(context, listen: false);
      chatService.onSongChanged(widget.currentSongTitle!);
    }
    _lastSongTitle = widget.currentSongTitle;
  }

  void _onScroll() {
    final chatService = Provider.of<ChatService>(context, listen: false);
    // Consider "at bottom" if within 50 pixels of the end
    final isAtBottom = _scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 50;
    chatService.setIsUserAtBottom(isAtBottom);
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    
    final chatService = Provider.of<ChatService>(context, listen: false);
    final success = await chatService.sendMessage(
      message,
      songId: widget.currentSongId,
    );

    setState(() => _isSending = false);

    if (success) {
      _messageController.clear();
      _focusNode.requestFocus();
      // Auto-scroll after sending
      Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to send message. Please try again.'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  Future<void> _sendEmoji(String emoji) async {
    final chatService = Provider.of<ChatService>(context, listen: false);
    await chatService.sendEmoji(emoji);
  }

  Widget _buildConnectionIndicator(ChatConnectionState state) {
    Color color;
    String tooltip;
    
    switch (state) {
      case ChatConnectionState.connected:
        color = Colors.green;
        tooltip = 'Connected';
        break;
      case ChatConnectionState.connecting:
      case ChatConnectionState.reconnecting:
        color = Colors.amber;
        tooltip = 'Connecting...';
        break;
      case ChatConnectionState.offline:
        color = Colors.grey;
        tooltip = 'Offline';
        break;
    }

    return Tooltip(
      message: tooltip,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: state == ChatConnectionState.connected
              ? [BoxShadow(color: color.withOpacity(0.5), blurRadius: 4)]
              : null,
        ),
      ),
    );
  }

  Widget _buildMessage(ChatMessage message, bool isOwnMessage) {
    if (message.isSystemMessage) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Text(
            message.message,
            style: TextStyle(
              color: Colors.grey.shade500,
              fontSize: 12,
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isOwnMessage 
            ? MainAxisAlignment.end 
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isOwnMessage) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: Colors.deepPurple.shade300,
              backgroundImage: message.avatarUrl != null
                  ? NetworkImage(message.avatarUrl!)
                  : null,
              child: message.avatarUrl == null
                  ? Text(
                      message.displayName.isNotEmpty
                          ? message.displayName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isOwnMessage 
                    ? Colors.deepPurple 
                    : Colors.grey.shade800,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        message.displayName,
                        style: TextStyle(
                          color: isOwnMessage 
                              ? Colors.white70 
                              : Colors.grey.shade400,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _formatTime(message.createdAt),
                        style: TextStyle(
                          color: isOwnMessage 
                              ? Colors.white54 
                              : Colors.grey.shade500,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message.message,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isOwnMessage) const SizedBox(width: 8 + 28), // Avatar space
        ],
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ChatService>(
      builder: (context, chatService, child) {
        if (!widget.isExpanded) {
          // Collapsed view - just show toggle button
          return GestureDetector(
            onTap: widget.onToggleExpand,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade900,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.chat_bubble_outline, 
                    color: Colors.white70, size: 18),
                  const SizedBox(width: 8),
                  const Text(
                    'Live Chat',
                    style: TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(width: 8),
                  _buildConnectionIndicator(chatService.connectionState),
                  if (chatService.unreadCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.deepPurple,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${chatService.unreadCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                  const Spacer(),
                  const Icon(Icons.keyboard_arrow_up, color: Colors.white70),
                ],
              ),
            ),
          );
        }

        // Expanded view - full chat panel
        return Container(
          height: 350,
          decoration: BoxDecoration(
            color: Colors.grey.shade900,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          ),
          child: Column(
            children: [
              // Header
              GestureDetector(
                onTap: widget.onToggleExpand,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Colors.grey.shade800),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble, 
                        color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      const Text(
                        'Live Chat',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildConnectionIndicator(chatService.connectionState),
                      const Spacer(),
                      const Icon(Icons.keyboard_arrow_down, color: Colors.white70),
                    ],
                  ),
                ),
              ),

              // Emoji reaction bar
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: _allowedEmojis.map((emoji) {
                    return GestureDetector(
                      onTap: () => _sendEmoji(emoji),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        child: Text(emoji, style: const TextStyle(fontSize: 20)),
                      ),
                    );
                  }).toList(),
                ),
              ),

              // Messages list
              Expanded(
                child: Stack(
                  children: [
                    chatService.messages.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.chat_bubble_outline,
                                    size: 48, color: Colors.grey.shade700),
                                const SizedBox(height: 12),
                                Text(
                                  'No messages yet',
                                  style: TextStyle(color: Colors.grey.shade500),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Be the first to say something!',
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                            itemCount: chatService.messages.length,
                            itemBuilder: (context, index) {
                              final message = chatService.messages[index];
                              // TODO: Replace with actual user ID check
                              final isOwnMessage = false;
                              return _buildMessage(message, isOwnMessage);
                            },
                          ),

                    // "New Messages" badge
                    if (chatService.unreadCount > 0 && !chatService.isUserAtBottom)
                      Positioned(
                        bottom: 8,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: GestureDetector(
                            onTap: _scrollToBottom,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.deepPurple,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.3),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '${chatService.unreadCount} new message${chatService.unreadCount > 1 ? 's' : ''}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.arrow_downward,
                                      color: Colors.white, size: 14),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              // Chat disabled message
              if (!chatService.chatEnabled)
                Container(
                  padding: const EdgeInsets.all(12),
                  color: Colors.grey.shade800,
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, 
                        color: Colors.grey, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          chatService.disabledReason ?? 'Chat is currently disabled',
                          style: TextStyle(color: Colors.grey.shade400),
                        ),
                      ),
                    ],
                  ),
                ),

              // Input area
              if (chatService.chatEnabled)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(color: Colors.grey.shade800),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          focusNode: _focusNode,
                          maxLength: 280,
                          maxLines: 1,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Type a message...',
                            hintStyle: TextStyle(color: Colors.grey.shade500),
                            filled: true,
                            fillColor: Colors.grey.shade800,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 10),
                            counterText: '',
                          ),
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.deepPurple,
                          shape: BoxShape.circle,
                        ),
                        child: IconButton(
                          onPressed: _isSending ? null : _sendMessage,
                          icon: _isSending
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.send, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),

              // Character counter
              if (chatService.chatEnabled)
                Padding(
                  padding: const EdgeInsets.only(right: 16, bottom: 4),
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: ValueListenableBuilder<TextEditingValue>(
                      valueListenable: _messageController,
                      builder: (context, value, child) {
                        final length = value.text.length;
                        return Text(
                          '$length/280',
                          style: TextStyle(
                            color: length > 260 
                                ? (length > 280 ? Colors.red : Colors.amber)
                                : Colors.grey.shade600,
                            fontSize: 11,
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }
}
