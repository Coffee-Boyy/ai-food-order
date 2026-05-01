import Foundation

enum PromptBuilder {
    static let instructions = """
        You are a food ordering assistant that predicts what a person is likely to order for \
        delivery based on their past order history. You analyze ordering patterns and return a \
        specific, personalized prediction. Respond only with what the data supports — do not \
        invent restaurants or items not present in the history.
        """

    static func build(from request: PredictorRequest) -> String {
        let s = request.summary
        let slot = "\(s.dayName) \(s.timeLabel)"

        var lines: [String] = []
        lines.append("Predict what this person will order on \(slot).")
        lines.append("")
        lines.append("ORDER HISTORY SUMMARY")
        lines.append("Total orders: \(s.totalOrders), average spend: $\(String(format: "%.2f", s.avgSpend))")
        lines.append("")

        if !s.topRestaurantsBySlot.isEmpty {
            lines.append("Top restaurants for \(slot):")
            for r in s.topRestaurantsBySlot.prefix(5) {
                let items = r.commonItems.prefix(4).joined(separator: ", ")
                lines.append("  • \(r.restaurant) (\(r.count) orders, avg $\(String(format: "%.2f", r.avgSpend)))\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !s.topRestaurantsOverall.isEmpty {
            lines.append("Top restaurants overall:")
            for r in s.topRestaurantsOverall.prefix(5) {
                let items = r.commonItems.prefix(3).joined(separator: ", ")
                lines.append("  • \(r.restaurant) (\(r.count) orders)\(items.isEmpty ? "" : " — often orders: \(items)")")
            }
            lines.append("")
        }

        if !s.recentOrders.isEmpty {
            lines.append("5 most recent orders:")
            for o in s.recentOrders.prefix(5) {
                let items = o.items.prefix(3).joined(separator: ", ")
                lines.append("  • \(o.date): \(o.restaurant)\(items.isEmpty ? "" : " — \(items)")")
            }
        }

        lines.append("")
        lines.append("Return the single most likely restaurant and 2–4 specific items, a confidence score, and a one-sentence explanation.")

        return lines.joined(separator: "\n")
    }
}
