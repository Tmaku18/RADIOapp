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

  String get _embedUrl {
    final origin = (env('API_BASE_URL') ?? 'https://www.networxradio.com')
        .replaceAll(RegExp(r'/+$'), '');
    return '$origin/embed/butterfly';
  }

  void _ready(String status) {
    widget.onStatus?.call(status);
    if (_notified) return;
    _notified = true;
    widget.onReady?.call();
  }

  void _fail(String status) {
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
        // The hero is decorative; never surface external navigation here.
        useShouldOverrideUrlLoading: false,
      ),
      onLoadStop: (controller, url) {
        widget.onStatus?.call('building');
        // Give the WebGL canvas a moment to paint its first frame before we
        // fade the 2D fallback out, so there's no visible blank flash.
        Timer(const Duration(milliseconds: 450), () {
          if (mounted) _ready('frames-ok');
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
    );
  }
}
