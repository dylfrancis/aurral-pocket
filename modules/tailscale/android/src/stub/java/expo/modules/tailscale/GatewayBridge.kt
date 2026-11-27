package expo.modules.tailscale

import android.content.Context

/** Stands in for the gomobile library when libs/gateway.aar wasn't built. */
internal object GatewayBridge {
  val isAvailable = false

  fun setStatusListener(context: Context, send: (String) -> Unit) {}

  fun clearStatusListener() {}

  fun start(context: Context, options: StartOptions): Int = throw GatewayUnavailableException()

  fun stop() {}

  fun forget(context: Context, controlURL: String?) {}

  fun status(): String = OFF_STATUS
}
