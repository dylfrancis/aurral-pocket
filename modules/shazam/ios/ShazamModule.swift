import AVFoundation
import ExpoModulesCore
import ShazamKit

public final class ShazamModule: Module {
  private let audioEngine = AVAudioEngine()
  private var session: SHSession?
  private var matchDelegate: MatchDelegate?
  private var isListening = false

  public func definition() -> ModuleDefinition {
    Name("Shazam")

    Events("onMatch", "onNoMatch", "onError")

    AsyncFunction("startListening") { (_: String?, promise: Promise) in
      // The developer token is iOS-irrelevant: catalog access rides the app's
      // ShazamKit entitlement. The argument exists only to share a JS signature
      // with Android, where the token is mandatory.
      self.startListening(promise: promise)
    }

    AsyncFunction("stopListening") {
      self.stopListening()
    }

    OnDestroy {
      self.stopListening()
    }
  }

  private func startListening(promise: Promise) {
    if isListening {
      promise.resolve(nil)
      return
    }

    requestMicrophonePermission { [weak self] granted in
      guard let self else { return }
      guard granted else {
        self.sendEvent(
          "onError",
          ["code": "permission", "message": "Microphone permission denied"]
        )
        promise.reject("permission", "Microphone permission denied")
        return
      }

      do {
        try self.beginSession()
        self.isListening = true
        promise.resolve(nil)
      } catch {
        self.sendEvent(
          "onError",
          ["code": "unavailable", "message": error.localizedDescription]
        )
        promise.reject("unavailable", error.localizedDescription)
      }
    }
  }

  private func beginSession() throws {
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .default)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    let session = SHSession()
    let delegate = MatchDelegate(
      onMatch: { [weak self] match in self?.emitMatch(match) },
      onNoMatch: { [weak self] in self?.sendEvent("onNoMatch") },
      onError: { [weak self] error in
        self?.sendEvent(
          "onError",
          ["code": "error", "message": error?.localizedDescription ?? "Match failed"]
        )
      }
    )
    session.delegate = delegate
    self.session = session
    self.matchDelegate = delegate

    let inputNode = audioEngine.inputNode
    let format = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 2048, format: format) {
      [weak self] buffer, time in
      self?.session?.matchStreamingBuffer(buffer, at: time)
    }

    audioEngine.prepare()
    try audioEngine.start()
  }

  private func stopListening() {
    guard isListening else { return }
    isListening = false
    audioEngine.inputNode.removeTap(onBus: 0)
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    session = nil
    matchDelegate = nil
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
  }

  private func emitMatch(_ match: SHMatch) {
    guard let item = match.mediaItems.first else {
      sendEvent("onNoMatch")
      return
    }
    sendEvent(
      "onMatch",
      [
        "match": [
          "title": item.title ?? "",
          "artist": item.artist as Any,
          "album": NSNull(),
          "artworkUrl": item.artworkURL?.absoluteString as Any,
          "appleMusicUrl": item.appleMusicURL?.absoluteString as Any,
          "isrc": item.isrc as Any,
          "shazamId": item.shazamID as Any,
        ],
      ]
    )
    // A streaming session keeps firing as long as audio flows; one confident
    // match is enough, so tear down immediately.
    stopListening()
  }

  private func requestMicrophonePermission(_ completion: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission { granted in
        DispatchQueue.main.async { completion(granted) }
      }
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        DispatchQueue.main.async { completion(granted) }
      }
    }
  }
}

private final class MatchDelegate: NSObject, SHSessionDelegate {
  private let onMatch: (SHMatch) -> Void
  private let onNoMatch: () -> Void
  private let onError: (Error?) -> Void

  init(
    onMatch: @escaping (SHMatch) -> Void,
    onNoMatch: @escaping () -> Void,
    onError: @escaping (Error?) -> Void
  ) {
    self.onMatch = onMatch
    self.onNoMatch = onNoMatch
    self.onError = onError
  }

  func session(_ session: SHSession, didFind match: SHMatch) {
    DispatchQueue.main.async { self.onMatch(match) }
  }

  func session(
    _ session: SHSession,
    didNotFindMatchFor signature: SHSignature,
    error: Error?
  ) {
    DispatchQueue.main.async {
      if let error {
        self.onError(error)
      } else {
        self.onNoMatch()
      }
    }
  }
}
