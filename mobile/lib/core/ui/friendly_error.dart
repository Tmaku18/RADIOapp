import '../services/api_service.dart';

/// Turn an exception into a short message that is safe to show in a snackbar.
String friendlyError(Object error) {
  if (error is ApiException) {
    final message = error.message.trim();
    if (message.isNotEmpty && !message.startsWith('Exception')) {
      if (error.statusCode >= 500) {
        return 'Something went wrong on our side. Try again in a moment.';
      }
      if (error.statusCode == 401 || error.statusCode == 403) {
        return message.length > 140 ? 'You do not have access to that.' : message;
      }
      return message.length > 180 ? '${message.substring(0, 177)}...' : message;
    }
  }
  final text = error.toString();
  if (text.contains('SocketException') || text.contains('Failed host lookup')) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  if (text.contains('TimeoutException') || text.contains('timed out')) {
    return 'That took too long. Try again.';
  }
  return 'Something went wrong. Try again.';
}
