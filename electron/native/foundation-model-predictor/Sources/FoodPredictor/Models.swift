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
    let slotOrderCount: Int
    let usedOverallFallbackForSlot: Bool
    let totalOrders: Int
    let avgSpend: Double
    let dayName: String
    let timeLabel: String
}

struct PreviousRecommendationContext: Codable {
    let recommendedRestaurant: String
    let recommendedItems: [String]
    let reasoning: String?
}

struct PredictorRequest: Codable {
    let dayOfWeek: Int
    let timeOfDay: String
    let summary: OrderSummary
    /// Prior AI outputs for this day/time slot, oldest first — model must not duplicate them.
    let previousRecommendations: [PreviousRecommendationContext]?
}

// MARK: - LLM-guided output

@Generable
struct FoodRecommendation {
    @Guide(description: "One concise sentence explaining why this recommendation fits the person's order patterns")
    var reasoning: String

    @Guide(description: "Restaurant you recommend for this order, grounded in the user’s history")
    var recommendedRestaurant: String

    @Guide(description: "2–4 specific menu items to recommend from that restaurant, based on their history")
    var recommendedItems: [String]

    @Guide(
        description: "A confidence score from 0.0 to 1.0 reflecting how strongly the history supports this recommendation",
        .range(0.0...1.0)
    )
    var confidenceScore: Double
}

// MARK: - Output models (stdout JSON)

struct PredictorSuccess: Codable {
    let ok: Bool
    let recommendedRestaurant: String
    let recommendedItems: [String]
    let confidenceScore: Double
    let reasoning: String
    let source: String
}

struct PredictorError: Codable {
    let ok: Bool
    let error: String
    let message: String
}
