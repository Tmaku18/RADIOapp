import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/models/track.dart';
import 'package:radio_app/core/radio/radio_sync.dart';

Track buildTrack({
  required int positionSeconds,
  DateTime? receivedAt,
  int rttMs = 0,
  int durationSeconds = 180,
}) {
  return Track(
    id: 'song-1',
    title: 'Test',
    artistName: 'Artist',
    audioUrl: 'https://example.com/song.mp3',
    durationSeconds: durationSeconds,
    positionSeconds: positionSeconds,
    receivedAt: receivedAt,
    rttMs: rttMs,
  );
}

void main() {
  group('liveTargetSeconds', () {
    test('falls back to the raw position when arrival time is unknown', () {
      final track = buildTrack(positionSeconds: 42);
      expect(liveTargetSeconds(track), 42);
    });

    test('adds half the round trip for the return leg', () {
      final now = DateTime.now();
      // 8s round trip: the reply spent ~4s travelling back to us.
      final track = buildTrack(
        positionSeconds: 30,
        receivedAt: now,
        rttMs: 8000,
      );
      expect(liveTargetSeconds(track, now: now), 34);
    });

    test('keeps advancing while the value sits unused', () {
      final received = DateTime.now();
      final track = buildTrack(positionSeconds: 30, receivedAt: received);
      expect(
        liveTargetSeconds(track, now: received.add(const Duration(seconds: 7))),
        37,
      );
    });

    test('never rewinds if the device clock jumps backwards', () {
      final received = DateTime.now();
      final track = buildTrack(positionSeconds: 30, receivedAt: received);
      expect(
        liveTargetSeconds(
          track,
          now: received.subtract(const Duration(seconds: 5)),
        ),
        30,
      );
    });

    test('caps compensation so a very stale payload cannot overshoot wildly', () {
      final received = DateTime.now();
      final track = buildTrack(positionSeconds: 10, receivedAt: received);
      expect(
        liveTargetSeconds(
          track,
          now: received.add(const Duration(minutes: 5)),
        ),
        10 + 45,
      );
    });
  });

  group('decideRadioSync', () {
    RadioSyncDecision decide({
      required int localSeconds,
      required int targetSeconds,
      int durationSeconds = 180,
      bool isBuffering = false,
      bool connectionDegraded = false,
      double currentSpeed = 1.0,
    }) {
      return decideRadioSync(
        localSeconds: localSeconds,
        targetSeconds: targetSeconds,
        durationSeconds: durationSeconds,
        isBuffering: isBuffering,
        connectionDegraded: connectionDegraded,
        currentSpeed: currentSpeed,
      );
    }

    test('does nothing when already aligned', () {
      final decision = decide(localSeconds: 30, targetSeconds: 31);
      expect(decision.action, RadioSyncAction.none);
    });

    test('nudges up when slightly behind the live point', () {
      final decision = decide(localSeconds: 30, targetSeconds: 36);
      expect(decision.action, RadioSyncAction.nudge);
      expect(decision.speed, kRadioCatchUpSpeed);
    });

    test('seeks only when too far behind to nudge away', () {
      final decision = decide(localSeconds: 10, targetSeconds: 40);
      expect(decision.action, RadioSyncAction.seek);
      expect(decision.targetSeconds, 40);
    });

    test('never seeks backwards when ahead — eases off instead', () {
      final decision = decide(localSeconds: 90, targetSeconds: 40);
      expect(decision.action, RadioSyncAction.nudge);
      expect(decision.speed, kRadioEaseBackSpeed);
    });

    test('holds off entirely while buffering', () {
      // Local position is frozen by the stall, so the gap is measuring the
      // stall rather than real drift. Correcting here restarts buffering.
      final decision = decide(
        localSeconds: 10,
        targetSeconds: 60,
        isBuffering: true,
      );
      expect(decision.action, RadioSyncAction.none);
    });

    test('restores normal speed when buffering starts mid-catch-up', () {
      final decision = decide(
        localSeconds: 10,
        targetSeconds: 60,
        isBuffering: true,
        currentSpeed: kRadioCatchUpSpeed,
      );
      expect(decision.action, RadioSyncAction.nudge);
      expect(decision.speed, 1.0);
    });

    test('holds off on a degraded connection', () {
      final decision = decide(
        localSeconds: 10,
        targetSeconds: 60,
        connectionDegraded: true,
      );
      expect(decision.action, RadioSyncAction.none);
    });

    test('restores normal speed once aligned again', () {
      final decision = decide(
        localSeconds: 30,
        targetSeconds: 31,
        currentSpeed: kRadioCatchUpSpeed,
      );
      expect(decision.action, RadioSyncAction.nudge);
      expect(decision.speed, 1.0);
    });

    test('does not re-issue a nudge that is already applied', () {
      final decision = decide(
        localSeconds: 30,
        targetSeconds: 36,
        currentSpeed: kRadioCatchUpSpeed,
      );
      expect(decision.action, RadioSyncAction.none);
    });

    test('leaves the outro alone — the boundary handler rotates next', () {
      final decision = decide(
        localSeconds: 179,
        targetSeconds: 200,
        durationSeconds: 180,
      );
      expect(decision.action, RadioSyncAction.none);
    });
  });
}
