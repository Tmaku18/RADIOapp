package com.tmaktechnologies.networxradio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Bakes a slice of the on-air song into a photo or video.
 *
 * Instagram, Snapchat, and TikTok only play audio that is inside the file.
 * The mic is not part of this mix.
 */
@OptIn(UnstableApi::class)
object ClipMuxer {
    private val main = Handler(Looper.getMainLooper())
    private var active: Transformer? = null
    private var heldOverlay: Bitmap? = null

    fun export(
        context: Context,
        videoPath: String?,
        imagePath: String?,
        audioPath: String,
        startMs: Int,
        durationMs: Int,
        onDone: (path: String?, error: String?) -> Unit,
    ) {
        if (active != null) {
            onDone(null, "A clip is already being prepared")
            return
        }
        val audioFile = File(audioPath)
        if (!audioFile.exists()) {
            onDone(null, "The song file is missing")
            return
        }
        val visualFile = when {
            !videoPath.isNullOrBlank() -> File(videoPath)
            !imagePath.isNullOrBlank() -> File(imagePath)
            else -> null
        }
        if (visualFile == null || !visualFile.exists()) {
            onDone(null, "The photo or video is missing")
            return
        }

        val once = AtomicBoolean(false)
        val out = File(context.cacheDir, "networx-clip-${System.currentTimeMillis()}.mp4")
        fun finish(path: String?, error: String?) {
            if (!once.compareAndSet(false, true)) return
            active = null
            heldOverlay = null
            if (path == null && out.exists()) out.delete()
            main.post { onDone(path, error) }
        }

        try {
            val audioDur = mediaDurationMs(audioFile)
            val start = startMs.coerceAtLeast(0).toLong()
            if (audioDur in 1..start) {
                finish(null, "The song ended before the clip")
                return
            }
            val audioRemain = if (audioDur > 0) audioDur - start else durationMs.toLong()
            var clip = durationMs.coerceAtLeast(500).toLong().coerceAtMost(audioRemain)
            if (videoPath != null) {
                val videoDur = mediaDurationMs(visualFile)
                if (videoDur > 0) clip = clip.coerceAtMost(videoDur)
            }
            if (clip < 400) {
                finish(null, "The song ended before the clip")
                return
            }

            val visual = if (videoPath != null) {
                EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(visualFile)))
                    .setRemoveAudio(true)
                    .build()
            } else {
                EditedMediaItem.Builder(
                    MediaItem.Builder()
                        .setUri(Uri.fromFile(visualFile))
                        .setMimeType(imageMime(visualFile.name))
                        .setImageDurationMs(clip)
                        .build(),
                ).setFrameRate(30).build()
            }
            val audio = EditedMediaItem.Builder(
                MediaItem.Builder()
                    .setUri(Uri.fromFile(audioFile))
                    .setClippingConfiguration(
                        MediaItem.ClippingConfiguration.Builder()
                            .setStartPositionMs(start)
                            .setEndPositionMs(start + clip)
                            .build(),
                    )
                    .build(),
            ).build()
            val composition = Composition.Builder(
                EditedMediaItemSequence.withVideoFrom(listOf(visual)),
                EditedMediaItemSequence.withAudioFrom(listOf(audio)),
            ).build()

            val transformer = Transformer.Builder(context.applicationContext)
                .addListener(object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        finish(out.absolutePath, null)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException,
                    ) {
                        finish(null, exportException.message ?: "Could not add the song")
                    }
                })
                .build()
            active = transformer
            transformer.start(composition, out.absolutePath)
        } catch (error: Exception) {
            finish(null, error.message ?: "Could not add the song")
        }
    }

    fun burnOverlay(
        context: Context,
        videoPath: String,
        overlayPath: String,
        onDone: (path: String?, error: String?) -> Unit,
    ) {
        if (active != null) {
            onDone(null, "A clip is already being prepared")
            return
        }
        val videoFile = File(videoPath)
        val overlayFile = File(overlayPath)
        if (!videoFile.exists() || !overlayFile.exists()) {
            onDone(null, "Could not add the artist credit")
            return
        }
        val once = AtomicBoolean(false)
        val out = File(context.cacheDir, "networx-credit-${System.currentTimeMillis()}.mp4")
        fun finish(path: String?, error: String?) {
            if (!once.compareAndSet(false, true)) return
            active = null
            heldOverlay = null
            if (path == null && out.exists()) out.delete()
            main.post { onDone(path, error) }
        }
        try {
            val overlay = creditBitmap(overlayFile, videoFile)
            if (overlay == null) {
                finish(null, "Could not add the artist credit")
                return
            }
            heldOverlay = overlay
            val item = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(videoFile)))
                .setEffects(
                    Effects(
                        emptyList(),
                        listOf(
                            OverlayEffect(
                                listOf(BitmapOverlay.createStaticBitmapOverlay(overlay)),
                            ),
                        ),
                    ),
                )
                .build()
            val composition = Composition.Builder(
                EditedMediaItemSequence.withAudioAndVideoFrom(listOf(item)),
            ).build()
            val transformer = Transformer.Builder(context.applicationContext)
                .addListener(object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        finish(out.absolutePath, null)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException,
                    ) {
                        finish(null, exportException.message ?: "Could not add the artist credit")
                    }
                })
                .build()
            active = transformer
            transformer.start(composition, out.absolutePath)
        } catch (error: Exception) {
            finish(null, error.message ?: "Could not add the artist credit")
        }
    }

    private fun creditBitmap(overlay: File, video: File): Bitmap? {
        val decoded = BitmapFactory.decodeFile(overlay.absolutePath) ?: return null
        val source = if (decoded.config == Bitmap.Config.ARGB_8888) {
            decoded
        } else {
            decoded.copy(Bitmap.Config.ARGB_8888, false)
        }
        val (rawW, rawH) = displaySize(video)
        if (rawW < 2 || rawH < 2) return source
        val width = rawW - rawW % 2
        val height = rawH - rawH % 2
        if (width == source.width && height == source.height) return source
        return Bitmap.createScaledBitmap(source, width, height, true)
    }

    private fun displaySize(file: File): Pair<Int, Int> {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            var width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                ?.toIntOrNull() ?: 0
            var height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                ?.toIntOrNull() ?: 0
            val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
                ?.toIntOrNull() ?: 0
            if (rotation == 90 || rotation == 270) {
                val swap = width
                width = height
                height = swap
            }
            width to height
        } catch (_: Exception) {
            0 to 0
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun mediaDurationMs(file: File): Long {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
        } catch (_: Exception) {
            0L
        } finally {
            try {
                retriever.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun imageMime(name: String): String {
        val lower = name.lowercase()
        return when {
            lower.endsWith(".png") -> MimeTypes.IMAGE_PNG
            lower.endsWith(".webp") -> MimeTypes.IMAGE_WEBP
            else -> MimeTypes.IMAGE_JPEG
        }
    }
}
