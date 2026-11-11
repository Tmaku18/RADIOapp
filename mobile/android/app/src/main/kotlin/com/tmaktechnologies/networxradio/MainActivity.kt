package com.tmaktechnologies.networxradio

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.media.audiofx.Visualizer
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.ryanheise.audioservice.AudioServiceFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.io.File

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
        private const val INSTAGRAM_CHANNEL = "networx/instagram"
        private const val SOCIAL_CHANNEL = "networx/social"
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

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            INSTAGRAM_CHANNEL,
        ).setMethodCallHandler { call, result ->
            if (call.method != "shareImage") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val path = call.argument<String>("path")
            if (path.isNullOrBlank()) {
                result.error("bad_args", "Expected a PNG path", null)
                return@setMethodCallHandler
            }
            shareImageToInstagram(path, result)
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            SOCIAL_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "attachAudio", "imageWithAudio" -> {
                    val audioPath = call.argument<String>("audioPath")
                    val startMs = call.argument<Int>("startMs") ?: 0
                    val durationMs = call.argument<Int>("durationMs") ?: 15000
                    val videoPath = call.argument<String>("videoPath")
                    val imagePath = call.argument<String>("imagePath")
                    if (audioPath.isNullOrBlank() ||
                        (videoPath.isNullOrBlank() && imagePath.isNullOrBlank())
                    ) {
                        result.error("bad_args", "Expected a photo or video and a song", null)
                    } else {
                        ClipMuxer.export(
                            this,
                            videoPath,
                            imagePath,
                            audioPath,
                            startMs,
                            durationMs,
                        ) { path, error ->
                            if (path != null) result.success(path)
                            else result.error("mux_failed", error ?: "Could not add the song", null)
                        }
                    }
                }
                "burnOverlay" -> {
                    val videoPath = call.argument<String>("videoPath")
                    val overlayPath = call.argument<String>("overlayPath")
                    if (videoPath.isNullOrBlank() || overlayPath.isNullOrBlank()) {
                        result.error("bad_args", "Expected a clip and a credit", null)
                    } else {
                        ClipMuxer.burnOverlay(this, videoPath, overlayPath) { path, error ->
                            if (path != null) result.success(path)
                            else result.error("mux_failed", error ?: "Could not add the artist credit", null)
                        }
                    }
                }
                "share" -> {
                    val path = call.argument<String>("path")
                    val target = call.argument<String>("target")
                    if (path.isNullOrBlank() || target.isNullOrBlank()) {
                        result.error("bad_args", "Expected a file and a destination", null)
                    } else {
                        shareToSocial(path, target, result)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun shareImageToInstagram(path: String, result: MethodChannel.Result) {
        val file = File(path)
        if (!file.exists()) {
            result.error("missing_file", "Share image was not written", null)
            return
        }
        val launch = packageManager.getLaunchIntentForPackage("com.instagram.android")
        if (launch == null) {
            result.error("not_installed", "Instagram is not installed", null)
            return
        }
        try {
            val uri = FileProvider.getUriForFile(
                this,
                "$packageName.instagramshare",
                file,
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = android.content.ClipData.newRawUri("NetworX", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                setPackage("com.instagram.android")
            }
            grantUriPermission("com.instagram.android", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivity(intent)
            result.success(true)
        } catch (error: Exception) {
            result.error("unavailable", error.message, null)
        }
    }

    private fun shareToSocial(path: String, target: String, result: MethodChannel.Result) {
        val file = File(path)
        if (!file.exists()) {
            result.error("missing_file", "The clip was not written", null)
            return
        }
        val packages = when (target) {
            "instagram_story", "instagram_post" -> listOf("com.instagram.android")
            "snapchat_story", "snapchat_chat" -> listOf("com.snapchat.android")
            "tiktok_story", "tiktok_post" -> listOf(
                "com.zhiliaoapp.musically",
                "com.ss.android.ugc.trill",
                "com.ss.android.ugc.aweme",
            )
            else -> emptyList()
        }
        val installed = packages.firstOrNull { pkg ->
            packageManager.getLaunchIntentForPackage(pkg) != null
        }
        if (installed == null) {
            result.error("not_installed", "That app is not installed", null)
            return
        }
        val mime = when {
            path.endsWith(".png", true) -> "image/png"
            path.endsWith(".jpg", true) || path.endsWith(".jpeg", true) -> "image/jpeg"
            path.endsWith(".webp", true) -> "image/webp"
            path.endsWith(".mov", true) -> "video/quicktime"
            path.endsWith(".webm", true) -> "video/webm"
            else -> "video/mp4"
        }
        try {
            val uri = FileProvider.getUriForFile(this, "$packageName.instagramshare", file)
            val story = target == "instagram_story"
            val intent = if (story) {
                Intent("com.instagram.share.ADD_TO_STORY").apply {
                    setDataAndType(uri, mime)
                    setPackage(installed)
                    clipData = ClipData.newRawUri("NetworX", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
            } else {
                Intent(Intent.ACTION_SEND).apply {
                    type = mime
                    putExtra(Intent.EXTRA_STREAM, uri)
                    clipData = ClipData.newRawUri("NetworX", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    setPackage(installed)
                }
            }
            grantUriPermission(installed, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            try {
                startActivity(intent)
            } catch (_: ActivityNotFoundException) {
                if (!story) throw ActivityNotFoundException()
                startActivity(
                    Intent(Intent.ACTION_SEND).apply {
                        type = mime
                        putExtra(Intent.EXTRA_STREAM, uri)
                        clipData = ClipData.newRawUri("NetworX", uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        setPackage(installed)
                    },
                )
            }
            result.success(true)
        } catch (error: Exception) {
            result.error("unavailable", error.message, null)
        }
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
