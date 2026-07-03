package com.tmaktechnologies.networxradio

import android.Manifest
import android.content.pm.PackageManager
import android.media.audiofx.Visualizer
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.ryanheise.audioservice.AudioServiceFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

/**
 * Hosts a platform channel that taps the app's own audio output with
 * android.media.audiofx.Visualizer so the Flutter frequency visualizers can
 * react to the actual music (web-parity "LIVE FFT"). Requires the RECORD_AUDIO
 * runtime permission (Android requirement for Visualizer even though it only
 * captures this app's output mix, not the microphone).
 */
class MainActivity : AudioServiceFragmentActivity() {
    companion object {
        private const val METHOD_CHANNEL = "networx/visualizer"
        private const val EVENT_CHANNEL = "networx/visualizer/fft"
        private const val PERMISSION_REQUEST_CODE = 7301
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var visualizer: Visualizer? = null
    private var attachedSessionId: Int = -1
    private var eventSink: EventChannel.EventSink? = null
    private var pendingPermissionResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            METHOD_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "hasPermission" -> result.success(hasRecordAudioPermission())
                "requestPermission" -> requestRecordAudioPermission(result)
                "attach" -> {
                    val sessionId = call.argument<Int>("sessionId")
                    if (sessionId == null || sessionId < 0) {
                        result.error("bad_session", "Missing or invalid sessionId", null)
                    } else {
                        result.success(attachVisualizer(sessionId))
                    }
                }
                "detach" -> {
                    releaseVisualizer()
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }

        EventChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            EVENT_CHANNEL,
        ).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                eventSink = events
            }

            override fun onCancel(arguments: Any?) {
                eventSink = null
            }
        })
    }

    private fun hasRecordAudioPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun requestRecordAudioPermission(result: MethodChannel.Result) {
        if (hasRecordAudioPermission()) {
            result.success(true)
            return
        }
        if (pendingPermissionResult != null) {
            // A request is already in flight; report not-granted for this caller.
            result.success(false)
            return
        }
        pendingPermissionResult = result
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.RECORD_AUDIO),
            PERMISSION_REQUEST_CODE,
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val granted =
                grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            pendingPermissionResult?.success(granted)
            pendingPermissionResult = null
        }
    }

    /**
     * Attach (or re-attach) the Visualizer to the given audio session. Returns
     * true when capture started; false when the Visualizer could not be created
     * (missing permission, OEM restrictions, emulator quirks) so Dart can fall
     * back to the simulated animation.
     */
    private fun attachVisualizer(sessionId: Int): Boolean {
        if (!hasRecordAudioPermission()) return false
        if (visualizer != null && attachedSessionId == sessionId) return true
        releaseVisualizer()
        return try {
            val v = Visualizer(sessionId)
            v.enabled = false
            val range = Visualizer.getCaptureSizeRange()
            v.captureSize = 256.coerceIn(range[0], range[1])
            // Capture rate is in milli-Hz; cap requests at the device max (~20 Hz).
            val rate = Visualizer.getMaxCaptureRate().coerceAtMost(30000)
            v.setDataCaptureListener(
                object : Visualizer.OnDataCaptureListener {
                    override fun onWaveFormDataCapture(
                        visualizer: Visualizer?,
                        waveform: ByteArray?,
                        samplingRate: Int,
                    ) {
                        // Unused: FFT only.
                    }

                    override fun onFftDataCapture(
                        visualizer: Visualizer?,
                        fft: ByteArray?,
                        samplingRate: Int,
                    ) {
                        if (fft == null) return
                        val copy = fft.copyOf()
                        mainHandler.post { eventSink?.success(copy) }
                    }
                },
                rate,
                false,
                true,
            )
            v.enabled = true
            visualizer = v
            attachedSessionId = sessionId
            true
        } catch (_: Exception) {
            releaseVisualizer()
            false
        }
    }

    private fun releaseVisualizer() {
        try {
            visualizer?.enabled = false
            visualizer?.release()
        } catch (_: Exception) {
            // Already released or in a bad state; nothing to clean up.
        }
        visualizer = null
        attachedSessionId = -1
    }

    override fun onDestroy() {
        releaseVisualizer()
        super.onDestroy()
    }
}
