import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Exposes Apple's on-device model to JavaScript for Brain Dump. The prompt is
/// written in JavaScript (src/lib/onDeviceBrainDump.ts); this module only runs it
/// and returns the model's structured answer as JSON, which JavaScript checks.
public final class OnDeviceAIModule: Module {
    public func definition() -> ModuleDefinition {
        Name("OnDeviceAI")

        /// "available", or why not: "os_too_old", "device_not_eligible",
        /// "apple_intelligence_off", "model_not_ready", "unavailable".
        Function("availability") { () -> String in
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return OnDeviceBrainDumpRunner.availability()
            }
            #endif
            return "os_too_old"
        }

        AsyncFunction("interpretBrainDump") { (instructions: String, prompt: String) async throws -> String in
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *) {
                return try await OnDeviceBrainDumpRunner.interpret(instructions: instructions, prompt: prompt)
            }
            #endif
            throw OnDeviceAIUnavailableException()
        }
    }
}

internal final class OnDeviceAIUnavailableException: Exception {
    override var reason: String { "Apple's on-device model is not available on this iPhone" }
}

internal final class OnDeviceAIFailedException: GenericException<String> {
    override var reason: String { "Apple's on-device model could not read the text: \(param)" }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
enum OnDeviceBrainDumpRunner {
    static func availability() -> String {
        switch SystemLanguageModel.default.availability {
        case .available:
            return "available"
        case .unavailable(.deviceNotEligible):
            return "device_not_eligible"
        case .unavailable(.appleIntelligenceNotEnabled):
            return "apple_intelligence_off"
        case .unavailable(.modelNotReady):
            return "model_not_ready"
        case .unavailable:
            return "unavailable"
        }
    }

    /// One fresh session per brain dump, so nothing from an earlier text leaks into the next.
    static func interpret(instructions: String, prompt: String) async throws -> String {
        guard case .available = SystemLanguageModel.default.availability else {
            throw OnDeviceAIUnavailableException()
        }
        let session = LanguageModelSession(instructions: instructions)
        do {
            let response = try await session.respond(
                to: prompt,
                generating: OnDeviceBrainDump.self,
                options: GenerationOptions(sampling: .greedy)
            )
            return response.rawContent.jsonString
        } catch {
            NSLog("[OnDeviceAI] generation failed: %@", String(describing: error))
            throw OnDeviceAIFailedException(String(describing: error))
        }
    }
}

// The shape the model must fill in. JavaScript turns it into Brain Dump's AI
// contract (supabase/functions/_shared/domain/brainDump/aiResult.ts) and checks it.

@available(iOS 26.0, *)
@Generable
struct OnDeviceBrainDump {
    @Guide(description: "One entry per distinct action the user mentioned, in the order they wrote them")
    var tasks: [OnDeviceTask]
    @Guide(description: "Parts of the text that are not tasks and not details of a task, copied word for word")
    var notTasks: [String]
}

@available(iOS 26.0, *)
@Generable
struct OnDeviceTask {
    @Guide(description: "Short action in the user's own words and language, without dates, times or filler words")
    var title: String
    @Guide(description: "The exact part of the user's text this task came from, copied word for word")
    var sourceSpan: String
    @Guide(description: "Language of this task's words: en, it or tr")
    var language: String
    @Guide(description: "A useful detail the user gave about this task, or nil")
    var notes: String?
    @Guide(description: "When the user said it should happen, or nil if they did not say")
    var when: OnDeviceWhen?
    @Guide(description: "An explicit clock time in 24-hour HH:MM, or nil")
    var dueTime: String?
    var timeOfDay: OnDeviceTimeOfDay?
    @Guide(description: "Realistic minutes the action takes, or nil if you cannot tell")
    var estimatedMinutes: Int?
    var priority: OnDevicePriority?
    var energy: OnDeviceEnergy?
    @Guide(description: "True when the user is non-committal: maybe, if I have time, magari, se riesco")
    var flexible: Bool
    var category: OnDeviceCategory?
    @Guide(description: "0 to 100: how sure you are this is a real task with the right title and date")
    var confidence: Int
}

@available(iOS 26.0, *)
@Generable
struct OnDeviceWhen {
    var kind: OnDeviceWhenKind
    @Guide(description: "on for a set day, by for a deadline, next for 'next Monday', nextWeek for a day of next week")
    var relation: OnDeviceRelation
    @Guide(description: "For relativeDay: 0 today, 1 tomorrow, 2 the day after tomorrow, 7 in a week")
    var offsetDays: Int?
    @Guide(description: "For weekday: 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday, 7 Sunday")
    var weekday: Int?
    @Guide(description: "For monthDay: month number 1 to 12 when named, else nil")
    var month: Int?
    @Guide(description: "For monthDay: day of the month 1 to 31")
    var day: Int?
    @Guide(description: "For absolute: the full date written by the user as YYYY-MM-DD")
    var date: String?
    @Guide(description: "The user's own words for the date, word for word")
    var text: String
}

@available(iOS 26.0, *)
@Generable
enum OnDeviceWhenKind {
    case relativeDay, weekday, weekend, monthDay, monthEnd, absolute, vague
}

@available(iOS 26.0, *)
@Generable
enum OnDeviceRelation {
    case on, by, next, nextWeek
}

@available(iOS 26.0, *)
@Generable
enum OnDeviceTimeOfDay {
    case morning, afternoon, evening
}

@available(iOS 26.0, *)
@Generable
enum OnDevicePriority {
    case low, medium, high
}

@available(iOS 26.0, *)
@Generable
enum OnDeviceEnergy {
    case low, medium, high
}

@available(iOS 26.0, *)
@Generable
enum OnDeviceCategory {
    case work, personal, shopping, home, health
}
#endif
