import AVKit
import ExpoModulesCore

/// AirPlay's own picker button, drawn clear over the app's label. A real tap
/// opens the list anchored here, with no private calls.
final class AudioOutputPickerView: ExpoView {
  private let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.prioritizesVideoDevices = false
    picker.tintColor = .clear
    picker.activeTintColor = .clear
    picker.frame = bounds
    picker.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(picker)
  }
}
