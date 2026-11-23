import AVFoundation
import ExpoModulesCore
import UIKit

public final class AudioOutputModule: Module {
  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AudioOutput")

    // The output changes from AirPlay's own button, laid over the label, so
    // its list opens from where the label sits.
    Constant("picker") { "view" }

    Events("onOutputChange")

    AsyncFunction("getCurrentOutput") { () -> [String: String]? in
      Self.currentOutput()
    }.runOnQueue(.main)

    OnStartObserving("onOutputChange") {
      self.startObservingRoute()
    }

    OnStopObserving("onOutputChange") {
      self.stopObservingRoute()
    }

    OnDestroy {
      self.stopObservingRoute()
    }

    View(AudioOutputPickerView.self) {}
  }

  private func startObservingRoute() {
    guard routeObserver == nil else { return }
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sendEvent("onOutputChange", ["output": Self.currentOutput()])
    }
  }

  private func stopObservingRoute() {
    if let routeObserver {
      NotificationCenter.default.removeObserver(routeObserver)
    }
    routeObserver = nil
  }

  /// Call on the main thread, for UIDevice. Nil while a route has no outputs,
  /// which happens only mid-change.
  private static func currentOutput() -> [String: String]? {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    guard let first = outputs.first else { return nil }
    let kind = kind(of: first.portType)
    var name = kind == "phone" ? UIDevice.current.model : first.portName
    if name.isEmpty {
      name = kind == "car" ? "CarPlay" : UIDevice.current.model
    }
    // AirPlay to several speakers at once.
    if outputs.count > 1 {
      name += " + \(outputs.count - 1)"
    }
    return ["kind": kind, "name": name]
  }

  private static func kind(of port: AVAudioSession.Port) -> String {
    switch port {
    case .builtInSpeaker, .builtInReceiver:
      return "phone"
    case .headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP:
      return "headphones"
    case .airPlay:
      return "remote"
    case .carAudio:
      return "car"
    case .HDMI:
      return "tv"
    default:
      return "speaker"
    }
  }
}
