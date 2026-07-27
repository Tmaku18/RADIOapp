import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/features/nearby/nearby_grouping.dart';

void main() {
  group('nearby_grouping', () {
    test('groupNearbyByCity sorts labels and buckets people', () {
      final groups = groupNearbyByCity([
        {'userId': '1', 'city': 'Austin'},
        {'userId': '2', 'city': 'Austin'},
        {'userId': '3', 'location_region': 'Boston'},
        {'userId': '4'},
      ]);

      expect(groups.map((g) => g['label']), ['Austin', 'Boston', 'Unknown city']);
      expect(groups.first['count'], 2);
      expect(personId(groups.first['people'][0] as Map<String, dynamic>), '1');
    });

    test('groupNearbyByZip skips empty zips', () {
      final groups = groupNearbyByZip([
        {'userId': '1', 'zipCode': '78701', 'city': 'Austin'},
        {'userId': '2', 'zip_code': '10001', 'city': 'NYC'},
        {'userId': '3', 'city': 'Nowhere'},
      ]);

      expect(groups.length, 2);
      expect(groups.map((g) => g['zipCode']), ['10001', '78701']);
    });

    test('personId prefers userId', () {
      expect(personId({'userId': 'a', 'id': 'b'}), 'a');
      expect(personId({'id': 'b'}), 'b');
      expect(personId({}), isNull);
    });
  });
}
