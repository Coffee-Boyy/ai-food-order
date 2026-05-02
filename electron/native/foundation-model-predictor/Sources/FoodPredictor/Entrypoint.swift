import Foundation
import FoundationModels

// MARK: - JSON I/O helpers

private let encoder: JSONEncoder = {
    let e = JSONEncoder()
    e.outputFormatting = [.sortedKeys]
    return e
}()

private func writeOutput<T: Encodable>(_ value: T) {
    guard let data = try? encoder.encode(value),
          let json = String(data: data, encoding: .utf8) else {
        let fallback = #"{"ok":false,"error":"encodingFailed","message":"Failed to encode output"}"#
        print(fallback)
        return
    }
    print(json)
}

private func exitWithError(_ code: String, _ message: String) -> Never {
    writeOutput(PredictorError(ok: false, error: code, message: message))
    exit(1)
}

// MARK: - Availability check

private func checkAvailability() {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        return
    case .unavailable(.deviceNotEligible):
        exitWithError("deviceNotEligible",
            "This device does not support Apple Intelligence. An Apple Silicon Mac with macOS 26+ is required.")
    case .unavailable(.appleIntelligenceNotEnabled):
        exitWithError("appleIntelligenceNotEnabled",
            "Apple Intelligence is not enabled. Go to System Settings → Apple Intelligence & Siri to turn it on.")
    case .unavailable(.modelNotReady):
        exitWithError("modelNotReady",
            "The on-device model is not ready yet. It may still be downloading — please try again in a few minutes.")
    case .unavailable(let reason):
        exitWithError("modelUnavailable",
            "The on-device model is unavailable: \(reason).")
    }
}

// MARK: - Entry point

@main
struct FoodPredictor {
    static func main() async {
        checkAvailability()

        // Read request JSON from stdin
        var stdinData = Data()
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while true {
            let n = read(STDIN_FILENO, &buffer, bufferSize)
            if n <= 0 { break }
            stdinData.append(contentsOf: buffer[..<n])
        }

        guard !stdinData.isEmpty else {
            exitWithError("noInput", "No input received on stdin.")
        }

        let request: PredictorRequest
        do {
            request = try JSONDecoder().decode(PredictorRequest.self, from: stdinData)
        } catch {
            exitWithError("invalidInput", "Could not parse request JSON: \(error.localizedDescription)")
        }

        let prompt = PromptBuilder.build(from: request)
        fputs("[FoodPredictor] instructions:\n\(PromptBuilder.instructions)\n\n[FoodPredictor] prompt:\n\(prompt)\n", stderr)

        let session = LanguageModelSession(instructions: PromptBuilder.instructions)

        let recommendation: FoodRecommendation
        do {
            let response = try await session.respond(to: prompt, generating: FoodRecommendation.self)
            fputs("[FoodPredictor] raw response: restaurant=\(response.content.recommendedRestaurant) items=\(response.content.recommendedItems) confidence=\(response.content.confidenceScore)\n", stderr)
            recommendation = response.content
        } catch let genError as LanguageModelSession.GenerationError {
            switch genError {
            case .exceededContextWindowSize:
                exitWithError("contextWindowExceeded",
                    "The order history summary was too large for the model context window.")
            default:
                exitWithError("generationFailed",
                    "The model failed to generate a recommendation: \(genError.localizedDescription)")
            }
        } catch {
            exitWithError("generationFailed",
                "Unexpected error during generation: \(error.localizedDescription)")
        }

        writeOutput(PredictorSuccess(
            ok: true,
            recommendedRestaurant: recommendation.recommendedRestaurant,
            recommendedItems: recommendation.recommendedItems,
            confidenceScore: recommendation.confidenceScore,
            reasoning: recommendation.reasoning,
            source: "apple-foundation-models"
        ))
    }
}
