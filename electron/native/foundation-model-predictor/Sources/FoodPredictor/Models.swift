import Foundation
import FoundationModels

// MARK: - Input models (stdin JSON)

struct RestaurantPattern: Codable {
    let restaurant: String
    let count: Int
    let avgSpend: Double
    let commonItems: [String]
}

struct RecentOrder: Codable {
    let restaurant: String
    let items: [String]
    let date: String
    let spend: Double
}

struct OrderSummary: Codable {
    let topRestaurantsBySlot: [RestaurantPattern]
    let topRestaurantsOverall: [RestaurantPattern]
    let recentOrders: [RecentOrder]
    let totalOrders: Int
    let avgSpend: Double
    let dayName: String
    let timeLabel: String
}

struct PredictorRequest: Codable {
    let dayOfWeek: Int
    let timeOfDay: String
    let summary: OrderSummary
}

// MARK: - LLM-guided output

@Generable
struct FoodPrediction {
    @Guide(description: "Name of the restaurant the user is most likely to order from")
    var predictedRestaurant: String

    @Guide(description: "2–4 specific menu items the user is likely to order, based on their history")
    var predictedItems: [String]

    @Guide(
        description: "A confidence score from 0.0 to 1.0 reflecting how strongly the history supports this prediction",
        .range(0.0...1.0)
    )
    var confidenceScore: Double

    @Guide(description: "One sentence explaining why this prediction was chosen, referencing patterns in the data")
    var reasoning: String
}

// MARK: - Output models (stdout JSON)

struct PredictorSuccess: Codable {
    let ok: Bool
    let predictedRestaurant: String
    let predictedItems: [String]
    let confidenceScore: Double
    let reasoning: String
    let source: String
}

struct PredictorError: Codable {
    let ok: Bool
    let error: String
    let message: String
}
