import Foundation

enum PromptBuilder {
    static let baseInstructions = """
        You are an expert food ordering assistant. Recommend one delivery order from the person's \
        order history. Use only restaurants and items shown in the prompt.
        """

    static let revisionInstructions = """
        You are an expert food ordering assistant. Recommend one new delivery order from the \
        person's order history. Use only restaurants and items shown in the prompt.
        Avoid repeating the prior recommendations listed in the prompt. Prefer a different \
        restaurant when the history supports it; otherwise choose different items from a \
        supported restaurant and lower the confidence score.
        """

    static func instructions(for request: PredictorRequest) -> String {
        if let previous = request.previousRecommendations, !previous.isEmpty {
            return revisionInstructions
        }
        return baseInstructions
    }

    private static func restaurantKey(_ restaurant: String) -> String {
        restaurant.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func candidateRestaurants(
        from restaurants: [RestaurantPattern],
        excluding blockedRestaurants: Set<String>
    ) -> [RestaurantPattern] {
        guard !blockedRestaurants.isEmpty else { return restaurants }

        let filtered = restaurants.filter { !blockedRestaurants.contains(restaurantKey($0.restaurant)) }
        return filtered.isEmpty ? restaurants : filtered
    }

    private static func candidateRecentOrders(
        from orders: [RecentOrder],
        excluding blockedRestaurants: Set<String>
    ) -> [RecentOrder] {
        guard !blockedRestaurants.isEmpty else { return orders }

        let filtered = orders.filter { !blockedRestaurants.contains(restaurantKey($0.restaurant)) }
        return filtered.isEmpty ? orders : filtered
    }

    private static func uniqueRestaurantNames(from previousRecommendations: [PreviousRecommendationContext]) -> [String] {
        var seen = Set<String>()
        var names: [String] = []

        for recommendation in previousRecommendations {
            let key = restaurantKey(recommendation.recommendedRestaurant)
            guard !seen.contains(key) else { continue }

            seen.insert(key)
            names.append(recommendation.recommendedRestaurant)
        }

        return names
    }

    static func build(from request: PredictorRequest) -> String {
        let s = request.summary
        let slot = "\(s.dayName) \(s.timeLabel)"
        let previousRecommendations = request.previousRecommendations ?? []
        let isRevision = !previousRecommendations.isEmpty
        let blockedRestaurants = Set(previousRecommendations.map { restaurantKey($0.recommendedRestaurant) })
        let slotRestaurants = candidateRestaurants(
            from: s.topRestaurantsBySlot,
            excluding: blockedRestaurants
        )
        let overallRestaurants = candidateRestaurants(
            from: s.topRestaurantsOverall,
            excluding: blockedRestaurants
        )
        let recentOrders = candidateRecentOrders(
            from: s.recentOrders,
            excluding: blockedRestaurants
        )

        var lines: [String] = []
        lines.append("Order history summary")
        lines.append("Total orders: \(s.totalOrders), average spend: $\(String(format: "%.2f", s.avgSpend))")
        lines.append("Exact \(slot) orders: \(s.slotOrderCount)")
        if s.usedOverallFallbackForSlot {
            lines.append("Exact day/time data is sparse; the first restaurant list uses all orders as fallback evidence.")
        }
        lines.append("")

        if isRevision {
            let blockedNames = uniqueRestaurantNames(from: previousRecommendations).joined(separator: ", ")
            lines.append("Already recommended for this exact day and time: \(blockedNames)")
            lines.append("Do not choose an already recommended restaurant when a new candidate restaurant is listed below.")
            lines.append("")
        }

        if !slotRestaurants.isEmpty {
            let sectionLabel = s.usedOverallFallbackForSlot
                ? "\(slotRestaurants.count) candidate restaurants from all orders:"
                : "\(slotRestaurants.count) candidate restaurants for \(slot):"
            lines.append(sectionLabel)
            for r in slotRestaurants {
                let items = r.commonItems.prefix(4).joined(separator: ", ")
                lines.append(" * \(r.restaurant) (\(r.count) orders, avg $\(String(format: "%.2f", r.avgSpend)))\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !overallRestaurants.isEmpty {
            lines.append("\(overallRestaurants.count) candidate restaurants for this person:")
            for r in overallRestaurants {
                let items = r.commonItems.joined(separator: ", ")
                lines.append(" * \(r.restaurant) (\(r.count) orders)\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !recentOrders.isEmpty {
            lines.append("\(recentOrders.count) recent candidate orders:")
            for o in recentOrders {
                let items = o.items.joined(separator: ", ")
                lines.append(" * \(o.date): \(o.restaurant)\(items.isEmpty ? "" : " — \(items)")")
            }
        }

        lines.append("")
        lines.append("Task:")
        if isRevision {
            lines.append("1. Choose the strongest new candidate restaurant for \(slot).")
        } else {
            lines.append("1. Choose the strongest candidate restaurant for \(slot).")
        }
        lines.append("2. Choose 2-4 specific items from that restaurant's listed items.")
        lines.append("3. Set confidence from 0.0 to 1.0; lower it when exact day/time data is sparse.")
        lines.append("4. Return one concise sentence explaining the recommendation.")

        return lines.joined(separator: "\n")
    }
}
