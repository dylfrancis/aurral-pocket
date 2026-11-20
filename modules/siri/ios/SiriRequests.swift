import Foundation

/// Carries Siri's questions to JS and JS's answers back. A question asked
/// before JS listens, as on a cold start, waits here until it does; one past
/// its timeout gets no answer, so Siri hears the app is unavailable.
final class SiriRequests {
  static let shared = SiriRequests()

  typealias Answer = [String: Any]

  private let queue = DispatchQueue(label: "com.aurral.siri.requests")
  private var waiting: [String: (Answer?) -> Void] = [:]
  private var unsent: [Answer] = []
  private var send: ((Answer) -> Void)?
  private var startReactNative: (() -> Void)?

  /// Starts React Native when no window has started it. The intent handler
  /// gets it from the app delegate.
  func setStartReactNative(_ start: @escaping () -> Void) {
    queue.async { self.startReactNative = start }
  }

  /// Ask JS a question. `reply` runs once, on a background queue, with JS's
  /// answer or nil when none came in time.
  func ask(_ question: Answer, timeout: TimeInterval, reply: @escaping (Answer?) -> Void) {
    let id = UUID().uuidString
    var payload = question
    payload["id"] = id

    queue.async {
      self.waiting[id] = reply
      if let send = self.send {
        send(payload)
      } else {
        self.unsent.append(payload)
        let start = self.startReactNative
        DispatchQueue.main.async { start?() }
      }
      self.queue.asyncAfter(deadline: .now() + timeout) {
        self.finish(id, with: nil)
      }
    }
  }

  /// JS's answer to the question with this id. Late answers are dropped.
  func answer(_ id: String, with answer: Answer) {
    queue.async { self.finish(id, with: answer) }
  }

  func listen(_ send: @escaping (Answer) -> Void) {
    queue.async {
      self.send = send
      let pending = self.unsent.filter { question in
        guard let id = question["id"] as? String else { return false }
        return self.waiting[id] != nil
      }
      self.unsent = []
      pending.forEach(send)
    }
  }

  func stopListening() {
    queue.async { self.send = nil }
  }

  /// Runs on `queue`.
  private func finish(_ id: String, with answer: Answer?) {
    guard let reply = waiting.removeValue(forKey: id) else { return }
    reply(answer)
  }
}
