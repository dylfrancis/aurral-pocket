package expo.modules.tailscale

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class StartOptions : Record {
  @Field val upstream: String = ""
  @Field val hostname: String = "aurral-pocket"
  @Field val controlURL: String? = null
  @Field val authKey: String? = null
  @Field val port: Int = 0
  @Field val verbose: Boolean = false
}

internal const val OFF_STATUS = """{"state":"Off"}"""

internal class GatewayUnavailableException :
  CodedException("Tailscale isn't built into this copy of Aurral Pocket.")

/** GatewayBridge is the gomobile library, or a stub when it wasn't built. */
class TailscaleModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() =
    ModuleDefinition {
      Name("Tailscale")

      Constant("isAvailable") { GatewayBridge.isAvailable }

      Events("onStatus")

      OnCreate {
        GatewayBridge.setStatusListener(context) { status ->
          sendEvent("onStatus", mapOf("status" to status))
        }
      }

      OnDestroy {
        GatewayBridge.clearStatusListener()
      }

      AsyncFunction("start") { options: StartOptions ->
        GatewayBridge.start(context, options)
      }

      AsyncFunction("stop") {
        GatewayBridge.stop()
      }

      AsyncFunction("forget") { controlURL: String? ->
        GatewayBridge.forget(context, controlURL)
      }

      Function("getStatus") {
        GatewayBridge.status()
      }
    }
}
