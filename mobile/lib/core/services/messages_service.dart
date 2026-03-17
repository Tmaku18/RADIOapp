import '../models/messages_models.dart';
import 'api_service.dart';

class MessagesService {
  final ApiService _api = ApiService();

  Future<List<ConversationSummary>> listConversations() async {
    final res = await _api.get('messages/conversations');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => ConversationSummary.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }

  Future<List<MessageRow>> getThread(
    String otherUserId, {
    int limit = 100,
    String? before,
  }) async {
    final q = <String>[
      'limit=$limit',
      if (before != null) 'before=$before',
    ].join('&');
    final res = await _api.get('messages/conversations/$otherUserId?$q');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => MessageRow.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }

  Future<void> sendMessage(
    String otherUserId,
    String body, {
    String? requestId,
  }) async {
    await _api.post('messages/conversations/$otherUserId', {
      'body': body,
      if (requestId != null) 'requestId': requestId,
    });
  }

  Future<void> markThreadRead(String otherUserId) async {
    await _api.post('messages/conversations/$otherUserId/read', {});
  }

  Future<void> setTyping({
    required String otherUserId,
    required bool isTyping,
  }) async {
    await _api.post('messages/conversations/$otherUserId/typing', {
      'isTyping': isTyping,
    });
  }

  Future<void> addReaction({
    required String messageId,
    required String reaction,
  }) async {
    await _api.post('messages/$messageId/reactions', {
      'reaction': reaction,
    });
  }

  Future<void> removeReaction({
    required String messageId,
    required String reaction,
  }) async {
    await _api.delete(
      'messages/$messageId/reactions/${Uri.encodeComponent(reaction)}',
    );
  }

  Future<Map<String, dynamic>> getMessageUploadUrl({
    required String contentType,
    required String fileName,
  }) async {
    final res = await _api.post('messages/upload-url', {
      'contentType': contentType,
      'fileName': fileName,
    });
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<bool> hasCreatorNetworkAccess() async {
    final res = await _api.get('creator-network/access');
    if (res is Map<String, dynamic>) {
      return (res['hasAccess'] == true);
    }
    return false;
  }
}

