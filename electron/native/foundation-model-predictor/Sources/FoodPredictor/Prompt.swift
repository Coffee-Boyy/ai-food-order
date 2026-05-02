import Foundation

enum PromptBuilder {
    static let instructions = """
        You are a food ordering assistant that recommends what a person might enjoy ordering for \
        delivery based on their past order history. You analyze ordering patterns and return a \
        specific, personalized recommendation. Respond only with what the data supports — do not \
        invent restaurants or items not present in the history.

        When the prompt lists prior recommendations for the same day and time, produce a new \
        recommendation revision that does not duplicate those suggestions. Prefer a different \
        restaurant when the history supports it; if you keep the same restaurant, the items must \
        be clearly different and still grounded in that restaurant’s order history. If no strong \
        distinct option exists, choose the best alternative that is still meaningfully different \
        and reflect uncertainty in the confidence score and explain your decision in the reasoning. \
        Explain the thought process behind your recommendation revision in the reasoning.
        """

    static func build(from request: PredictorRequest) -> String {
        let s = request.summary
        let slot = "\(s.dayName) \(s.timeLabel)"

        var lines: [String] = []
        lines.append(instructions)
        lines.append("")
        lines.append("## Order history summary")
        lines.append("Total orders: \(s.totalOrders), average spend: $\(String(format: "%.2f", s.avgSpend))")
        lines.append("")

        if !s.topRestaurantsBySlot.isEmpty {
            lines.append("\(s.topRestaurantsBySlot.count) top restaurants for \(slot):")
            for r in s.topRestaurantsBySlot {
                let items = r.commonItems.prefix(4).joined(separator: ", ")
                lines.append(" * \(r.restaurant) (\(r.count) orders, avg $\(String(format: "%.2f", r.avgSpend)))\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !s.topRestaurantsOverall.isEmpty {
            lines.append("\(s.topRestaurantsOverall.count) top restaurants for this person:")
            for r in s.topRestaurantsOverall {
                let items = r.commonItems.joined(separator: ", ")
                lines.append(" * \(r.restaurant) (\(r.count) orders)\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !s.recentOrders.isEmpty {
            lines.append("\(s.recentOrders.count) most recent orders:")
            for o in s.recentOrders {
                let items = o.items.joined(separator: ", ")
                lines.append(" * \(o.date): \(o.restaurant)\(items.isEmpty ? "" : " — \(items)")")
            }
        }

        if let prevs = request.previousRecommendations, !prevs.isEmpty {
            lines.append("")
            lines.append(
                "Prior recommendations for this exact day and time:"
            )
            for (i, prev) in prevs.enumerated() {
                lines.append(" * \(i + 1). \(prev.recommendedRestaurant): \(prev.recommendedItems.joined(separator: ", "))")
            }
        } else {
            lines.append("")
            lines.append("Return one recommended restaurant and 2–4 specific items, a confidence score, and a one-sentence explanation.")
        }

        return lines.joined(separator: "\n")
    }
}
