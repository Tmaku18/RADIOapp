import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/services/livestream_service.dart';
import '../../core/services/whip_broadcaster.dart';
import 'widgets/live_chat_panel.dart';

class GoLiveScreen extends StatefulWidget {
  /// Optional host intent ('dj' or 'musician') so the session surfaces on the
  /// matching Live tab regardless of the broadcaster's account role. Null for a
  /// regular artist stream.
  final String? hostType;

  const GoLiveScreen({super.key, this.hostType});

  @override
  State<GoLiveScreen> createState() => _GoLiveScreenState();
}

class _GoLiveScreenState extends State<GoLiveScreen> {
  final LivestreamService _live = LivestreamService();
  final WhipBroadcaster _broadcaster = WhipBroadcaster();
  final RTCVideoRenderer _renderer = RTCVideoRenderer();
  final TextEditingController _title =
      TextEditingController(text: 'Live from NETWORX');
  final TextEditingController _description = TextEditingController();
  final TextEditingController _category = TextEditingController();

  bool _rendererReady = false;
  bool _loading = false;
  bool _live2 = false;
  bool _micOn = true;
  bool _camOn = true;
  bool _mirror = true;
  String? _statusText;
  Map<String, dynamic>? _ingest;
  String? _sessionId;

  @override
  void initState() {
    super.initState();
    _renderer.initialize().then((_) {
      if (mounted) setState(() => _rendererReady = true);
    });
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _broadcaster.dispose();
    _renderer.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _loading = true;
      _statusText = 'Starting session…';
    });
    try {
      final data = await _live.start(
        title: _title.text.trim().isEmpty ? null : _title.text.trim(),
        description:
            _description.text.trim().isEmpty ? null : _description.text.trim(),
        category: _category.text.trim().isEmpty ? null : _category.text.trim(),
        hostType: widget.hostType,
      );
      _ingest = data?['ingest'] is Map<String, dynamic>
          ? data!['ingest'] as Map<String, dynamic>
          : null;
      final session = data?['session'] is Map<String, dynamic>
          ? data!['session'] as Map<String, dynamic>
          : null;
      _sessionId = session?['id']?.toString();
      final whipUrl = _ingest?['webRtcUrl'] as String?;

      if (whipUrl == null || whipUrl.isEmpty) {
        // Backend didn't return a WebRTC publish URL — fall back to showing
        // the RTMP details so the user can broadcast with an encoder.
        setState(() {
          _live2 = true;
          _statusText = 'Live session created. Use the RTMP details below.';
        });
        return;
      }

      setState(() => _statusText = 'Requesting camera & mic…');
      final stream = await _broadcaster.start(whipUrl);
      _renderer.srcObject = stream;
      if (!mounted) return;
      setState(() {
        _live2 = true;
        _micOn = true;
        _camOn = true;
        _statusText = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Start failed: $e')));
      setState(() => _statusText = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _stop() async {
    setState(() => _loading = true);
    try {
      await _broadcaster.dispose();
      _renderer.srcObject = null;
      await _live.stop();
      if (!mounted) return;
      setState(() {
        _live2 = false;
        _ingest = null;
        _statusText = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Stop failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.hostType == 'dj'
              ? 'Go Live as DJ'
              : widget.hostType == 'musician'
                  ? 'Go Live as Musician'
                  : 'Go Live',
        ),
      ),
      body: _live2 ? _buildLiveView() : _buildSetupView(),
    );
  }

  Widget _buildSetupView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Stream info',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
              ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _title,
          decoration: const InputDecoration(
            labelText: 'Title',
            hintText: 'e.g. Studio session',
            border: OutlineInputBorder(),
          ),
          maxLength: 140,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _description,
          decoration: const InputDecoration(
            labelText: 'Description',
            hintText: "What's this stream about?",
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
          maxLength: 1000,
          maxLines: 3,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _category,
          decoration: const InputDecoration(
            labelText: 'Category',
            hintText: 'e.g. Music, Talk',
            border: OutlineInputBorder(),
          ),
          maxLength: 64,
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _loading ? null : _start,
          icon: const Icon(Icons.videocam),
          label: Text(_loading ? (_statusText ?? 'Starting…') : 'Start live'),
        ),
        const SizedBox(height: 12),
        const Text(
          'Broadcasts straight from your phone camera and mic. You can switch '
          'cameras and mute once you go live.',
        ),
      ],
    );
  }

  Widget _buildLiveView() {
    final hasVideo = _renderer.srcObject != null;
    return Column(
      children: [
        Expanded(
          child: Container(
            color: Colors.black,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (_rendererReady && hasVideo && _camOn)
                  RTCVideoView(
                    _renderer,
                    objectFit:
                        RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    mirror: _mirror,
                  )
                else
                  Center(
                    child: Text(
                      hasVideo ? 'Camera off' : (_statusText ?? 'Connecting…'),
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'LIVE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              if (_ingest?['webRtcUrl'] == null) ...[
                Text('RTMP URL: ${_ingest?['rtmpUrl'] ?? ''}'),
                Text('Stream key: ${_ingest?['streamKey'] ?? ''}'),
                const SizedBox(height: 12),
              ],
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _controlButton(
                    icon: _micOn ? Icons.mic : Icons.mic_off,
                    label: _micOn ? 'Mic on' : 'Mic off',
                    active: _micOn,
                    onTap: () => setState(() => _micOn = _broadcaster.toggleMic()),
                  ),
                  _controlButton(
                    icon: _camOn ? Icons.videocam : Icons.videocam_off,
                    label: _camOn ? 'Camera' : 'Cam off',
                    active: _camOn,
                    onTap: () =>
                        setState(() => _camOn = _broadcaster.toggleCamera()),
                  ),
                  _controlButton(
                    icon: Icons.cameraswitch,
                    label: 'Flip',
                    active: true,
                    onTap: () async {
                      await _broadcaster.switchCamera();
                      if (mounted) {
                        setState(() => _mirror = _broadcaster.isFrontCamera);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red,
                  ),
                  onPressed: _loading ? null : _stop,
                  icon: const Icon(Icons.stop),
                  label: Text(_loading ? 'Ending…' : 'End live'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton.filledTonal(
          onPressed: onTap,
          icon: Icon(icon),
          color: active ? null : Colors.red,
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
