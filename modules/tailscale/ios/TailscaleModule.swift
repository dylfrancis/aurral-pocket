import ExpoModulesCore
import UIKit
#if canImport(Gateway)
import Gateway
#endif

struct StartOptions: Record {
  @Field var upstream: String = ""
  @Field var hostname: String = "aurral-pocket"
  @Field var controlURL: String?
  @Field var authKey: String?
  @Field var port: Int = 0
  @Field var verbose: Bool = false
}

#if canImport(Gateway)
/// Go calls this from its own threads.
private final class StatusRelay: NSObject, GatewayStatusListenerProtocol {
  private let send: (String) -> Void

  init(send: @escaping (String) -> Void) {
    self.send = send
  }

  func onStatus(_ statusJSON: String?) {
    send(statusJSON ?? #"{"state":"Off"}"#)
  }
}
#endif

/// Built without Gateway.xcframework (scripts/build-tailscale-gateway.sh), it
/// reports Tailscale unavailable instead of failing to compile.
public final class TailscaleModule: Module {
  #if canImport(Gateway)
  private var relay: StatusRelay?
  #endif
  private var foregroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("Tailscale")

    Constant("isAvailable") { Self.isAvailable }

    Events("onStatus")

    OnCreate {
      self.startRelaying()
    }

    OnDestroy {
      if let foregroundObserver = self.foregroundObserver {
        NotificationCenter.default.removeObserver(foregroundObserver)
      }
      #if canImport(Gateway)
      GatewaySetStatusListener(nil)
      #endif
    }

    AsyncFunction("start") { (options: StartOptions) -> Int in
      try Self.start(options)
    }

    AsyncFunction("stop") {
      try Self.stop()
    }

    AsyncFunction("forget") { (controlURL: String?) in
      try Self.forget(controlURL: controlURL)
    }

    Function("getStatus") { () -> String in
      Self.status()
    }
  }

  private func startRelaying() {
    #if canImport(Gateway)
    let relay = StatusRelay { [weak self] status in
      self?.sendEvent("onStatus", ["status": status])
    }
    self.relay = relay
    GatewaySetStatusListener(relay)
    // iOS can take the loopback port while the app is suspended.
    foregroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willEnterForegroundNotification,
      object: nil,
      queue: nil
    ) { _ in
      GatewayCheckListener()
    }
    #endif
  }

  /// The node's keys. Out of backups, so a restore onto another phone doesn't
  /// bring this phone's node with it.
  private static func stateDirectory() throws -> URL {
    var directory = try FileManager.default
      .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("Tailscale", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return directory
  }

  #if canImport(Gateway)
  private static let isAvailable = true

  private static func start(_ options: StartOptions) throws -> Int {
    let config = GatewayConfig()
    config.stateDir = try stateDirectory().path
    config.hostname = options.hostname
    config.controlURL = options.controlURL ?? ""
    config.authKey = options.authKey ?? ""
    config.upstream = options.upstream
    config.port = options.port
    config.verbose = options.verbose
    var port = 0
    var error: NSError?
    guard GatewayStart(config, &port, &error) else {
      throw gatewayException(error)
    }
    return port
  }

  private static func stop() throws {
    var error: NSError?
    guard GatewayStop(&error) else { throw gatewayException(error) }
  }

  private static func forget(controlURL: String?) throws {
    var error: NSError?
    guard GatewayForget(try stateDirectory().path, controlURL ?? "", &error) else {
      throw gatewayException(error)
    }
  }

  private static func status() -> String {
    GatewayStatus()
  }
  #else
  private static let isAvailable = false

  private static func start(_ options: StartOptions) throws -> Int {
    throw gatewayException(nil)
  }

  private static func stop() throws {}

  private static func forget(controlURL: String?) throws {}

  private static func status() -> String {
    #"{"state":"Off"}"#
  }
  #endif
}

private func gatewayException(_ error: NSError?) -> Exception {
  Exception(
    name: "GatewayException",
    description: error?.localizedDescription ?? "Tailscale isn't built into this copy of Aurral Pocket."
  )
}
