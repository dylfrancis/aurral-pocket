import Foundation
import Intents

/// Answers "Siri, play … in Aurral" inside the app: an Intents extension
/// couldn't read its saved music or session. JS matches and plays; this turns
/// Siri's request into a question for JS, and the answer into what Siri says.
@objc public final class PlayMediaIntentHandler: NSObject, INPlayMediaIntentHandling {
  /// Covers a cold start: JS has to load the bundle and read the session
  /// before it can search.
  private static let answerTimeout: TimeInterval = 10

  /// Every identifier JS hands out starts with this, so a request Siri sends
  /// back with one of ours needs no second search.
  private static let ownIdentifierPrefix = "aurral:"

  /// The app delegate's `application(_:handlerFor:)`. `startReactNative` runs
  /// when a question finds no JS listening.
  @objc public static func handler(
    for intent: INIntent,
    startReactNative: @escaping () -> Void
  ) -> Any? {
    guard intent is INPlayMediaIntent else { return nil }
    SiriRequests.shared.setStartReactNative(startReactNative)
    return PlayMediaIntentHandler()
  }

  public func resolveMediaItems(
    for intent: INPlayMediaIntent,
    with completion: @escaping ([INPlayMediaMediaItemResolutionResult]) -> Void
  ) {
    if let items = intent.mediaItems, !items.isEmpty,
       items.allSatisfy({ $0.identifier?.hasPrefix(Self.ownIdentifierPrefix) == true }) {
      completion(items.map { INPlayMediaMediaItemResolutionResult(mediaItemResolutionResult: .success(with: $0)) })
      return
    }

    SiriRequests.shared.ask(Self.findQuestion(for: intent), timeout: Self.answerTimeout) { answer in
      // Never a disambiguation: Siri sends the listener's pick back as a new
      // request, which asks again, and never plays.
      completion([Self.resolution(from: answer)])
    }
  }

  public func handle(
    intent: INPlayMediaIntent,
    completion: @escaping (INPlayMediaIntentResponse) -> Void
  ) {
    guard let item = intent.mediaItems?.first, let id = item.identifier else {
      completion(INPlayMediaIntentResponse(code: .failure, userActivity: nil))
      return
    }

    // The title too: Siri also plays items it kept from an earlier run, whose
    // ids that run's JS no longer holds.
    var question: [String: Any] = [
      "type": "play",
      "itemId": id,
      "itemType": Self.typeName(item.type),
    ]
    if let title = item.title { question["title"] = title }
    if let artist = item.artist { question["artist"] = artist }
    if let shuffled = intent.playShuffled { question["shuffle"] = shuffled }

    SiriRequests.shared.ask(question, timeout: Self.answerTimeout) { answer in
      guard (answer?["status"] as? String) == "playing" else {
        completion(INPlayMediaIntentResponse(code: .failure, userActivity: nil))
        return
      }
      Self.donate(item)
      completion(INPlayMediaIntentResponse(code: .success, userActivity: nil))
    }
  }

  private static func findQuestion(for intent: INPlayMediaIntent) -> [String: Any] {
    let search = intent.mediaSearch
    var question: [String: Any] = [
      "type": "find",
      "mediaType": typeName(search?.mediaType ?? .unknown),
      "genres": search?.genreNames ?? [],
      "mine": search?.reference == .my,
      // Siri's own catalog guesses. Their identifiers mean nothing here, but
      // their titles are worth searching for when Siri sent no name.
      "suggested": (intent.mediaItems ?? []).map { item -> [String: Any] in
        var suggestion: [String: Any] = ["type": typeName(item.type)]
        if let title = item.title { suggestion["title"] = title }
        if let artist = item.artist { suggestion["artist"] = artist }
        return suggestion
      },
    ]
    if let name = search?.mediaName { question["name"] = name }
    if let artist = search?.artistName { question["artist"] = artist }
    if let album = search?.albumName { question["album"] = album }
    if let shuffled = intent.playShuffled { question["shuffle"] = shuffled }
    return question
  }

  private static func resolution(from answer: [String: Any]?) -> INPlayMediaMediaItemResolutionResult {
    switch answer?["status"] as? String {
    case "found":
      guard let item = (answer?["item"] as? [String: Any]).flatMap(mediaItem) else {
        return INPlayMediaMediaItemResolutionResult(mediaItemResolutionResult: .unsupported())
      }
      return INPlayMediaMediaItemResolutionResult(mediaItemResolutionResult: .success(with: item))
    case "notFound":
      return INPlayMediaMediaItemResolutionResult(mediaItemResolutionResult: .unsupported())
    case "signedOut":
      return .unsupported(forReason: .loginRequired)
    case "unsupportedType":
      return .unsupported(forReason: .unsupportedMediaType)
    default:
      // "unavailable", or no answer in time.
      return .unsupported(forReason: .serviceUnavailable)
    }
  }

  private static func mediaItem(from answer: [String: Any]) -> INMediaItem? {
    guard let id = answer["id"] as? String else { return nil }
    return INMediaItem(
      identifier: id,
      title: answer["title"] as? String,
      type: itemType(answer["type"] as? String),
      artwork: nil,
      artist: answer["artist"] as? String
    )
  }

  /// Tells Siri that Aurral plays this, so it can offer Aurral for requests
  /// that don't name an app.
  private static func donate(_ item: INMediaItem) {
    let intent = INPlayMediaIntent(
      mediaItems: [item],
      mediaContainer: nil,
      playShuffled: nil,
      playbackRepeatMode: .unknown,
      resumePlayback: nil,
      playbackQueueLocation: .unknown,
      playbackSpeed: nil,
      mediaSearch: nil
    )
    let interaction = INInteraction(
      intent: intent,
      response: INPlayMediaIntentResponse(code: .success, userActivity: nil)
    )
    if let id = item.identifier { interaction.identifier = id }
    interaction.donate(completion: nil)
  }

  private static func typeName(_ type: INMediaItemType) -> String {
    switch type {
    case .song: return "song"
    case .album: return "album"
    case .artist: return "artist"
    case .genre: return "genre"
    case .playlist: return "playlist"
    case .music: return "music"
    case .musicStation, .station, .radioStation, .algorithmicRadioStation: return "station"
    case .unknown: return "unknown"
    default: return "other"
    }
  }

  private static func itemType(_ name: String?) -> INMediaItemType {
    switch name {
    case "song": return .song
    case "album": return .album
    case "artist": return .artist
    case "genre": return .genre
    case "playlist": return .playlist
    case "station": return .musicStation
    default: return .music
    }
  }
}
