import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

/// Shared AVAudioSession / Android audio-attribute helpers for WebRTC
/// publish (WHIP) and receive (WHEP) so iOS doesn't silence remote tracks
/// or capture silent mic frames while just_audio owns the session.
class WebRtcAudioSession {
  WebRtcAudioSession._();

  /// Before getUserMedia / WHIP publish.
  ///
  /// Also configures flutter_webrtc's native Apple/Android audio IO so the
  /// capture unit actually records (audio_session alone is not enough — the
  /// WebRTC ADM latches its own category).
  static Future<void> prepareForBroadcast() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.defaultToSpeaker |
                  AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.voiceChat,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (e) {
      debugPrint('WebRtcAudioSession.prepareForBroadcast session: $e');
    }

    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        await Helper.setAppleAudioIOMode(
          AppleAudioIOMode.localOnly,
          preferSpeakerOutput: true,
        );
        await Helper.ensureAudioSession();
      } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        await Helper.setAndroidAudioConfiguration(
          AndroidAudioConfiguration.communication,
        );
      }
    } catch (e) {
      debugPrint('WebRtcAudioSession.prepareForBroadcast webrtc: $e');
    }
  }

  /// Play-and-record without forcing the loudspeaker.
  ///
  /// Used when a DJ monitors the station in headphones while the mic is live.
  /// [defaultToSpeaker] would put that music back into the microphone.
  static Future<void> prepareForHeadphoneBroadcast() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.allowBluetoothA2dp |
                  AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.videoRecording,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.music,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (e) {
      debugPrint('WebRtcAudioSession.prepareForHeadphoneBroadcast session: $e');
    }

    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        await Helper.setAppleAudioConfiguration(
          AppleAudioConfiguration(
            appleAudioCategory: AppleAudioCategory.playAndRecord,
            appleAudioCategoryOptions: {
              AppleAudioCategoryOption.allowBluetooth,
              AppleAudioCategoryOption.allowBluetoothA2DP,
              AppleAudioCategoryOption.mixWithOthers,
            },
            appleAudioMode: AppleAudioMode.videoRecording,
          ),
        );
      } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        await Helper.setAndroidAudioConfiguration(
          AndroidAudioConfiguration(
            manageAudioFocus: true,
            androidAudioMode: AndroidAudioMode.inCommunication,
            androidAudioFocusMode: AndroidAudioFocusMode.gain,
            androidAudioStreamType: AndroidAudioStreamType.voiceCall,
            androidAudioAttributesUsageType:
                AndroidAudioAttributesUsageType.voiceCommunication,
            androidAudioAttributesContentType:
                AndroidAudioAttributesContentType.music,
          ),
        );
      }
    } catch (e) {
      debugPrint('WebRtcAudioSession.prepareForHeadphoneBroadcast webrtc: $e');
    }
  }

  /// Before WHEP receive while radio music is still playing.
  /// Plain music/`playback` sessions silence remote WebRTC audio on iOS.
  static Future<void> prepareForReceive() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.defaultToSpeaker |
                  AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.defaultMode,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.music,
            usage: AndroidAudioUsage.media,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (_) {}

    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        await Helper.setAppleAudioIOMode(
          AppleAudioIOMode.remoteOnly,
          preferSpeakerOutput: true,
        );
        await Helper.ensureAudioSession();
      }
    } catch (_) {}
  }

  /// Back to the standard music session after WebRTC publish/receive.
  static Future<void> restoreMusic() async {
    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
        await Helper.setAppleAudioIOMode(AppleAudioIOMode.none);
      }
    } catch (_) {}
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
      await session.setActive(true);
    } catch (_) {}
  }
}
