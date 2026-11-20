import ExpoModulesCore
import Intents

public final class SiriModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Siri")

    Events("onRequest")

    OnStartObserving { [weak self] in
      SiriRequests.shared.listen { question in
        self?.sendEvent("onRequest", question)
      }
    }

    OnStopObserving {
      SiriRequests.shared.stopListening()
    }

    Function("answer") { (id: String, answer: [String: Any]) in
      SiriRequests.shared.answer(id, with: answer)
    }

    /// Names Siri can't know from its own catalog, so it hears them right.
    Function("setPlaylistNames") { (names: [String]) in
      INVocabulary.shared().setVocabularyStrings(NSOrderedSet(array: names), of: .mediaPlaylistTitle)
    }

    /// Tells Siri this account has a music library worth sending requests to.
    Function("setLibrarySize") { (songCount: Int) in
      let context = INMediaUserContext()
      context.subscriptionStatus = .unknown
      context.numberOfLibraryItems = songCount
      context.becomeCurrent()
    }

    Function("forgetAccount") {
      INVocabulary.shared().removeAllVocabularyStrings()
      INInteraction.deleteAll(completion: nil)
    }
  }
}
