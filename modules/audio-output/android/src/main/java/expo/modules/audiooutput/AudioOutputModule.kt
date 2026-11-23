package expo.modules.audiooutput

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.mediarouter.app.SystemOutputSwitcherDialogController
import androidx.mediarouter.media.MediaControlIntent
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import androidx.mediarouter.media.MediaRouter.RouteInfo
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** MediaRouter answers on the main thread only, so every call goes there. */
class AudioOutputModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val selector by lazy {
    MediaRouteSelector.Builder()
      .addControlCategory(MediaControlIntent.CATEGORY_LIVE_AUDIO)
      .build()
  }

  /** The router the callback was added to, which is the one to remove it from. */
  private var observedRouter: MediaRouter? = null

  /** Every route's updates arrive, not just the selected one's, so repeats are dropped. */
  private var lastSent: Map<String, String>? = null

  private val routeCallback =
    object : MediaRouter.Callback() {
      override fun onRouteSelected(router: MediaRouter, route: RouteInfo, reason: Int) = emit(router)

      override fun onRouteUnselected(router: MediaRouter, route: RouteInfo, reason: Int) = emit(router)

      // A route keeps its id while its name changes, as the default route
      // does when headphones plug in.
      override fun onRouteChanged(router: MediaRouter, route: RouteInfo) = emit(router)
    }

  override fun definition() =
    ModuleDefinition {
      Name("AudioOutput")

      // The system's output switcher arrived in Android 11. Before it, the
      // output is only shown.
      Constant("picker") {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) "switcher" else "none"
      }

      Events("onOutputChange")

      AsyncFunction("getCurrentOutput") {
        describe(context, MediaRouter.getInstance(context).selectedRoute)
      }.runOnQueue(Queues.MAIN)

      AsyncFunction("showOutputPicker") {
        SystemOutputSwitcherDialogController.showDialog(appContext.currentActivity ?: context)
      }.runOnQueue(Queues.MAIN)

      OnStartObserving("onOutputChange") {
        mainHandler.post { startObserving() }
      }

      OnStopObserving("onOutputChange") {
        mainHandler.post { stopObserving() }
      }

      // The router outlives this module, as on a reload.
      OnDestroy {
        mainHandler.post { stopObserving() }
      }
    }

  private fun startObserving() {
    if (observedRouter != null) return
    val reactContext = appContext.reactContext ?: return
    lastSent = null
    observedRouter =
      MediaRouter.getInstance(reactContext).also {
        // Listening only: no discovery is requested, so nothing scans.
        it.addCallback(selector, routeCallback, MediaRouter.CALLBACK_FLAG_UNFILTERED_EVENTS)
      }
  }

  private fun stopObserving() {
    observedRouter?.removeCallback(routeCallback)
    observedRouter = null
  }

  private fun emit(router: MediaRouter) {
    val reactContext = appContext.reactContext ?: return
    val output = describe(reactContext, router.selectedRoute)
    if (output == lastSent) return
    lastSent = output
    sendEvent("onOutputChange", mapOf("output" to output))
  }

  /** A route's device type, where it has one, says more than "Bluetooth" does. */
  private fun describe(
    context: Context,
    route: RouteInfo,
  ): Map<String, String> {
    val kind = if (route.isDeviceSpeaker) "phone" else kindOf(route.deviceType) ?: fallbackKind(route)
    val name = if (kind == "phone") deviceName(context) else route.name
    return mapOf("kind" to kind, "name" to name)
  }

  /** The default route that isn't the speaker is wired headphones or a dock. */
  private fun fallbackKind(route: RouteInfo): String =
    when {
      route.isBluetooth || route.isDefault -> "headphones"
      route.isSystemRoute -> "speaker"
      else -> "remote"
    }

  private fun kindOf(deviceType: Int): String? =
    when (deviceType) {
      RouteInfo.DEVICE_TYPE_BUILTIN_SPEAKER -> "phone"
      RouteInfo.DEVICE_TYPE_WIRED_HEADSET,
      RouteInfo.DEVICE_TYPE_WIRED_HEADPHONES,
      RouteInfo.DEVICE_TYPE_USB_HEADSET,
      RouteInfo.DEVICE_TYPE_BLUETOOTH_A2DP,
      RouteInfo.DEVICE_TYPE_BLE_HEADSET,
      RouteInfo.DEVICE_TYPE_HEARING_AID,
      -> "headphones"
      RouteInfo.DEVICE_TYPE_TV,
      RouteInfo.DEVICE_TYPE_HDMI,
      RouteInfo.DEVICE_TYPE_HDMI_ARC,
      RouteInfo.DEVICE_TYPE_HDMI_EARC,
      -> "tv"
      RouteInfo.DEVICE_TYPE_CAR -> "car"
      RouteInfo.DEVICE_TYPE_SPEAKER,
      RouteInfo.DEVICE_TYPE_REMOTE_SPEAKER,
      RouteInfo.DEVICE_TYPE_AUDIO_VIDEO_RECEIVER,
      RouteInfo.DEVICE_TYPE_GROUP,
      RouteInfo.DEVICE_TYPE_DOCK,
      RouteInfo.DEVICE_TYPE_USB_DEVICE,
      RouteInfo.DEVICE_TYPE_USB_ACCESSORY,
      -> "speaker"
      else -> null
    }

  /** As the output switcher names it. */
  private fun deviceName(context: Context): String =
    if (context.resources.configuration.smallestScreenWidthDp >= 600) "This tablet" else "This phone"
}
