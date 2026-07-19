import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../../core/env.dart';

/// Renders the real web Three.js butterfly hero (`/embed/butterfly`) inside a
/// WebView. Android's System WebView has reliable WebGL2 on physical hardware,
/// so this gives true parity with the website — unlike flutter_angle, which
/// times out bringing up a GL context on many real devices.
class ButterflyHeroWebView extends StatefulWidget {
  const ButterflyHeroWebView({
    super.key,
    this.onReady,
    this.onFailed,
    this.onStatus,
  });

  /// Fired once the embed page has loaded and is rendering.
  final VoidCallback? onReady;

  /// Fired when the page cannot load (offline, server error, etc.).
  final VoidCallback? onFailed;

  /// Diagnostic status updates (mirrors the on-screen debug badge).
  final void Function(String status)? onStatus;

  @override
  State<ButterflyHeroWebView> createState() => _ButterflyHeroWebViewState();
}

class _ButterflyHeroWebViewState extends State<ButterflyHeroWebView> {
  bool _notified = false;
  Timer? _loadStopFallback;

  String get _embedUrl {
    final origin = (env('API_BASE_URL') ?? 'https://www.networxradio.com')
        .replaceAll(RegExp(r'/+$'), '');
    return '$origin/embed/butterfly';
  }

  @override
  void dispose() {
    _loadStopFallback?.cancel();
    super.dispose();
  }

  void _ready(String status) {
    _loadStopFallback?.cancel();
    widget.onStatus?.call(status);
    if (_notified) return;
    _notified = true;
    widget.onReady?.call();
  }

  void _fail(String status) {
    _loadStopFallback?.cancel();
    widget.onStatus?.call(status);
    if (_notified) return;
    widget.onFailed?.call();
  }

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialUrlRequest: URLRequest(url: WebUri(_embedUrl)),
      initialSettings: InAppWebViewSettings(
        transparentBackground: true,
        disableContextMenu: true,
        supportZoom: false,
        disableVerticalScroll: true,
        disableHorizontalScroll: true,
        verticalScrollBarEnabled: false,
        horizontalScrollBarEnabled: false,
        mediaPlaybackRequiresUserGesture: true,
        useHybridComposition: true,
        javaScriptEnabled: true,
        // WebGL requires hardware acceleration; make it explicit so a global
        // or manufacturer default can't silently soften it.
        hardwareAcceleration: true,
        // The hero is decorative; never surface external navigation here.
        useShouldOverrideUrlLoading: false,
      ),
      onWebViewCreated: (controller) {
        // The embed page calls this when the Three.js canvas has painted its
        // first frames (or when WebGL context creation fails). This is the
        // authoritative signal — no guessing with timers.
        controller.addJavaScriptHandler(
          handlerName: 'butterflyStatus',
          callback: (args) {
            final event = args.isNotEmpty ? '${args[0]}' : '';
            if (event == 'ready') {
              _ready('frames-ok');
            } else if (event == 'failed') {
              final detail = args.length > 1 ? '${args[1]}' : 'webgl';
              debugPrint('ButterflyHeroWebView embed failure: $detail');
              _fail('err:webgl');
            }
            return null;
          },
        );
      },
      onLoadStop: (controller, url) {
        widget.onStatus?.call('building');
        // Fallback for older deployed embeds that don't emit butterflyStatus:
        // give the JS bundle + WebGL canvas time to paint before revealing.
        _loadStopFallback?.cancel();
        _loadStopFallback = Timer(const Duration(seconds: 4), () {
          if (mounted) _ready('frames-assumed');
        });
      },
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame ?? true) {
          debugPrint('ButterflyHeroWebView load error: ${error.description}');
          _fail('err:${error.type}');
        }
      },
      onReceivedHttpError: (controller, request, response) {
        final status = response.statusCode ?? 0;
        if ((request.isForMainFrame ?? true) && status >= 400) {
          debugPrint('ButterflyHeroWebView http error: $status');
          _fail('err:http$status');
        }
      },
      onRenderProcessGone: (controller, detail) async {
        // System WebView renderer crashed (common under memory pressure on
        // physical devices). Keep the 2D hero rather than a dead view.
        debugPrint('ButterflyHeroWebView renderer gone: ${detail.didCrash}');
        _fail('err:renderer-gone');
      },
    );
  }
}
