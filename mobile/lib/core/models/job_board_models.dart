class ServiceRequestRow {
  final String id;
  final String artistId;
  final String title;
  final String? description;
  final String? serviceType;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? artistDisplayName;

  ServiceRequestRow({
    required this.id,
    required this.artistId,
    required this.title,
    required this.description,
    required this.serviceType,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.artistDisplayName,
  });

  factory ServiceRequestRow.fromJson(Map<String, dynamic> json) {
    return ServiceRequestRow(
      id: (json['id'] ?? '').toString(),
      artistId: (json['artistId'] ?? json['artist_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: json['description']?.toString(),
      serviceType: (json['serviceType'] ?? json['service_type'])?.toString(),
      status: (json['status'] ?? 'open').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      updatedAt: DateTime.tryParse((json['updatedAt'] ?? json['updated_at'] ?? '').toString()) ??
          DateTime.now(),
      artistDisplayName: (json['artistDisplayName'] ?? json['artist_display_name'])?.toString(),
    );
  }
}

class ServiceRequestApplicationRow {
  final String id;
  final String requestId;
  final String applicantId;
  final String? message;
  final String status;
  final DateTime createdAt;
  final String? applicantDisplayName;

  ServiceRequestApplicationRow({
    required this.id,
    required this.requestId,
    required this.applicantId,
    required this.message,
    required this.status,
    required this.createdAt,
    required this.applicantDisplayName,
  });

  factory ServiceRequestApplicationRow.fromJson(Map<String, dynamic> json) {
    return ServiceRequestApplicationRow(
      id: (json['id'] ?? '').toString(),
      requestId: (json['requestId'] ?? json['request_id'] ?? '').toString(),
      applicantId: (json['applicantId'] ?? json['applicant_id'] ?? '').toString(),
      message: json['message']?.toString(),
      status: (json['status'] ?? 'pending').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      applicantDisplayName: (json['applicantDisplayName'] ?? json['applicant_display_name'])?.toString(),
    );
  }
}

class RequestsPage {
  final List<ServiceRequestRow> items;
  final int total;
  const RequestsPage({required this.items, required this.total});

  factory RequestsPage.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] as List?) ?? const [];
    return RequestsPage(
      items: raw
          .whereType<Map>()
          .map((e) => ServiceRequestRow.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList(),
      total: (json['total'] ?? 0) is int
          ? (json['total'] ?? 0) as int
          : int.tryParse((json['total'] ?? '0').toString()) ?? 0,
    );
  }
}

