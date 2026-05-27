package expo.modules.shazam

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import com.shazam.shazamkit.AudioSampleRateInHz
import com.shazam.shazamkit.DeveloperToken
import com.shazam.shazamkit.DeveloperTokenProvider
import com.shazam.shazamkit.MatchResult
import com.shazam.shazamkit.ShazamKit
import com.shazam.shazamkit.ShazamKitResult
import com.shazam.shazamkit.StreamingSession
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class ShazamModule : Module() {
  private var audioRecord: AudioRecord? = null
  private var streamingSession: StreamingSession? = null
  private var recordingJob: Job? = null
  private var resultsJob: Job? = null
  private val scope = CoroutineScope(Dispatchers.IO)

  @Volatile
  private var isListening = false

  override fun definition() = ModuleDefinition {
    Name("Shazam")

    Events("onMatch", "onNoMatch", "onError")

    AsyncFunction("startListening") { developerToken: String? ->
      startListening(developerToken)
    }

    AsyncFunction("stopListening") {
      stopListening()
    }

    OnDestroy {
      stopListening()
      scope.cancel()
    }
  }

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun startListening(developerToken: String?) {
    if (isListening) return

    if (developerToken.isNullOrBlank()) {
      emitError("token", "Missing Shazam developer token")
      return
    }

    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      emitError("permission", "Microphone permission denied")
      return
    }

    val tokenProvider = object : DeveloperTokenProvider {
      override fun provideDeveloperToken() = DeveloperToken(developerToken)
    }

    // createStreamingSession is a suspend function, so build the session inside
    // a coroutine, then wire up recognition + recording.
    scope.launch {
      val catalog = ShazamKit.createShazamCatalog(tokenProvider)
      when (
        val sessionResult = ShazamKit.createStreamingSession(
          catalog,
          AudioSampleRateInHz.SAMPLE_RATE_44100,
          READ_BUFFER_SIZE,
        )
      ) {
        is ShazamKitResult.Success -> {
          streamingSession = sessionResult.data
          isListening = true
          observeResults(sessionResult.data)
          startRecording(sessionResult.data)
        }
        is ShazamKitResult.Failure -> {
          emitError(
            "unavailable",
            sessionResult.reason.message ?: "Could not start ShazamKit",
          )
        }
      }
    }
  }

  private fun observeResults(session: StreamingSession) {
    resultsJob = scope.launch {
      session.recognitionResults().collect { result ->
        when (result) {
          is MatchResult.Match -> {
            val item = result.matchedMediaItems.firstOrNull()
            if (item == null) {
              sendEvent("onNoMatch")
            } else {
              sendEvent(
                "onMatch",
                mapOf(
                  "match" to mapOf(
                    "title" to (item.title ?: ""),
                    "artist" to item.artist,
                    "album" to null,
                    "artworkUrl" to item.artworkURL?.toString(),
                    "appleMusicUrl" to item.appleMusicURL?.toString(),
                    "isrc" to item.isrc,
                    "shazamId" to item.shazamID,
                  ),
                ),
              )
            }
            stopListening()
          }
          is MatchResult.NoMatch -> {
            sendEvent("onNoMatch")
            stopListening()
          }
          is MatchResult.Error -> {
            emitError("error", result.exception.message ?: "Match failed")
            stopListening()
          }
        }
      }
    }
  }

  private fun startRecording(session: StreamingSession) {
    val minBufferSize = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
    )
    val bufferSize = maxOf(minBufferSize, READ_BUFFER_SIZE)

    val recorder = AudioRecord(
      MediaRecorder.AudioSource.UNPROCESSED,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      bufferSize,
    )
    audioRecord = recorder

    recordingJob = scope.launch {
      val buffer = ByteArray(bufferSize)
      recorder.startRecording()
      while (isListening) {
        val read = recorder.read(buffer, 0, buffer.size)
        if (read > 0) {
          session.matchStream(buffer, read, System.currentTimeMillis())
        }
      }
    }
  }

  private fun stopListening() {
    if (!isListening && audioRecord == null) return
    isListening = false

    recordingJob?.cancel()
    recordingJob = null
    resultsJob?.cancel()
    resultsJob = null

    audioRecord?.let { recorder ->
      runCatching {
        if (recorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
          recorder.stop()
        }
        recorder.release()
      }
    }
    audioRecord = null
    streamingSession = null
  }

  private fun emitError(code: String, message: String) {
    sendEvent("onError", mapOf("code" to code, "message" to message))
  }

  companion object {
    private const val SAMPLE_RATE = 44100
    private const val READ_BUFFER_SIZE = 8192
  }
}
