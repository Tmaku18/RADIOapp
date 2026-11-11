// ignore_for_file: experimental_member_use

import 'package:audio_session/audio_session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/audio/headphone_route.dart';

AudioDevice _device({
  required String name,
  required AudioDeviceType type,
  bool isOutput = true,
}) {
  return AudioDevice(
    id: name,
    name: name,
    isInput: false,
    isOutput: isOutput,
    type: type,
  );
}

void main() {
  test('wired headphones and headsets count', () {
    expect(
      isHeadphoneOutput(
        _device(name: 'Headphones', type: AudioDeviceType.wiredHeadphones),
      ),
      isTrue,
    );
    expect(
      isHeadphoneOutput(
        _device(name: 'Headset', type: AudioDeviceType.wiredHeadset),
      ),
      isTrue,
    );
  });

  test('built-in speaker and earpiece do not count', () {
    expect(
      headphonesConnected([
        _device(name: 'Speaker', type: AudioDeviceType.builtInSpeaker),
        _device(name: 'Earpiece', type: AudioDeviceType.builtInEarpiece),
      ]),
      isFalse,
    );
  });

  test('bluetooth headphones count and bluetooth speakers do not', () {
    expect(
      isHeadphoneOutput(
        _device(name: 'AirPods Pro', type: AudioDeviceType.bluetoothA2dp),
      ),
      isTrue,
    );
    expect(
      isHeadphoneOutput(
        _device(name: 'JBL Flip Speaker', type: AudioDeviceType.bluetoothA2dp),
      ),
      isFalse,
    );
  });
}
