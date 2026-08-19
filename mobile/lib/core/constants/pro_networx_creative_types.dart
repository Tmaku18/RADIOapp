/// Creative types from Pro-Networx plans/onboarding/docs.
/// [value] is sent as the directory `skill` filter.
class ProNetworxCreativeType {
  const ProNetworxCreativeType({required this.value, required this.label});

  final String value;
  final String label;
}

const kProNetworxCreativeTypes = <ProNetworxCreativeType>[
  ProNetworxCreativeType(value: 'artist', label: 'Artist'),
  ProNetworxCreativeType(value: 'producer', label: 'Producer'),
  ProNetworxCreativeType(value: 'photographer', label: 'Photographer'),
  ProNetworxCreativeType(value: 'videographer', label: 'Videographer'),
  ProNetworxCreativeType(value: 'graphic_designer', label: 'Designer'),
  ProNetworxCreativeType(value: 'illustrator', label: 'Illustrator'),
  ProNetworxCreativeType(value: 'lyricist', label: 'Lyricist'),
  ProNetworxCreativeType(value: 'beat_maker', label: 'Beat maker'),
  ProNetworxCreativeType(value: 'mixing', label: 'Engineer'),
  ProNetworxCreativeType(value: 'studio', label: 'Studio'),
  ProNetworxCreativeType(value: 'stylist', label: 'Stylist'),
  ProNetworxCreativeType(value: 'mentor', label: 'Mentor'),
  ProNetworxCreativeType(value: 'social_media_manager', label: 'Social'),
  ProNetworxCreativeType(value: 'manager', label: 'Manager'),
  ProNetworxCreativeType(value: 'booking', label: 'Booking'),
];
