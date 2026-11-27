package expo.modules.tailscale

import android.content.Context
import com.aurral.gateway.Config
import com.aurral.gateway.Gateway
import com.aurral.gateway.StatusListener
import java.io.File

internal object GatewayBridge {
  /** False when the Go library has no build for this device's ABI. */
  val isAvailable: Boolean by lazy {
    try {
      Gateway.status()
      true
    } catch (error: LinkageError) {
      false
    }
  }

  fun setStatusListener(context: Context, send: (String) -> Unit) {
    if (!isAvailable) return
    go.Seq.setContext(context)
    // Go calls this from its own threads.
    Gateway.setStatusListener(StatusListener { status -> send(status ?: OFF_STATUS) })
  }

  fun clearStatusListener() {
    if (isAvailable) Gateway.setStatusListener(null)
  }

  fun start(context: Context, options: StartOptions): Int {
    if (!isAvailable) throw GatewayUnavailableException()
    go.Seq.setContext(context)
    val config =
      Config().apply {
        stateDir = stateDirectory(context).path
        hostname = options.hostname
        controlURL = options.controlURL ?: ""
        authKey = options.authKey ?: ""
        upstream = options.upstream
        port = options.port.toLong()
        verbose = options.verbose
      }
    return Gateway.start(config).toInt()
  }

  fun stop() {
    if (isAvailable) Gateway.stop()
  }

  fun forget(context: Context, controlURL: String?) {
    if (isAvailable) Gateway.forget(stateDirectory(context).path, controlURL ?: "")
  }

  fun status(): String = if (isAvailable) Gateway.status() else OFF_STATUS

  /**
   * The node's keys, in the folder Android never backs up, so a restore onto
   * another phone doesn't bring this phone's node with it.
   */
  private fun stateDirectory(context: Context): File =
    File(context.noBackupFilesDir, "tailscale").apply { mkdirs() }
}
