// audio_session marks device types experimental, but this is the supported
// way to tell a headset from the phone speaker.
// ignore_for_file: experimental_member_use

import 'package:audio_session/audio_session.dart';

final RegExp _speakerName = RegExp(
  r'speaker|soundbar|homepod|television|\btv\b',
  caseSensitive: false,
);

final RegExp _headphoneName = RegExp(
  r'headphone|headset|airpod|earpod|earbud|buds|hands-?free',
  caseSensitive: false,
);

/// True when [device] is a headphone or headset output, not the loudspeaker.
///
/// Bluetooth and USB devices are treated as headsets unless the name says
/// they are a speaker. The phone earpiece and built-in speaker are rejected
/// because either one leaks into the mic.
bool isHeadphoneOutput(AudioDevice device) {
  if (!device.isOutput) return false;
  switch (device.type) {
    case AudioDeviceType.wiredHeadset:
    case AudioDeviceType.wiredHeadphones:
    case AudioDeviceType.hearingAid:
      return true;
    case AudioDeviceType.bluetoothSco:
    case AudioDeviceType.bluetoothA2dp:
    case AudioDeviceType.bluetoothLe:
    case AudioDeviceType.usbAudio:
      final name = device.name;
      if (_speakerName.hasMatch(name) && !_headphoneName.hasMatch(name)) {
        return false;
      }
      return true;
    default:
      return false;
  }
}

bool headphonesConnected(Iterable<AudioDevice> devices) {
  for (final device in devices) {
    if (isHeadphoneOutput(device)) return true;
  }
  return false;
}
