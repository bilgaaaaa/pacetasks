import SwiftUI

extension AccentChoice {
    /// Light and deep shade of the accent; the amber pair matches the app icon's ring.
    var colors: (light: Color, deep: Color) {
        switch self {
        case .amber: return (Self.rgb(0xFFC857), Self.rgb(0xFF6A3D))
        case .coral: return (Self.rgb(0xFF9A8B), Self.rgb(0xFF4E50))
        case .pink: return (Self.rgb(0xFFA8D5), Self.rgb(0xF0508C))
        case .violet: return (Self.rgb(0xC3B5FF), Self.rgb(0x8A6CFF))
        case .sky: return (Self.rgb(0x9FDBFF), Self.rgb(0x3D8BFF))
        case .mint: return (Self.rgb(0xA6F4D8), Self.rgb(0x2BC48A))
        case .lime: return (Self.rgb(0xE4F77A), Self.rgb(0x9BCB2D))
        case .white: return (Color.white, Self.rgb(0xD8D8E0))
        }
    }

    /// A darker shade of the same hue that stays readable on light backgrounds (contrast 5:1 or more on white),
    /// where the light shade would fade away.
    var ink: Color {
        switch self {
        case .amber: return Self.rgb(0xA34B07)
        case .coral: return Self.rgb(0xB5352A)
        case .pink: return Self.rgb(0xBE185D)
        case .violet: return Self.rgb(0x5B3FD9)
        case .sky: return Self.rgb(0x1565C0)
        case .mint: return Self.rgb(0x04714F)
        case .lime: return Self.rgb(0x45700B)
        case .white: return Self.rgb(0x4A4A55)
        }
    }

    /// Labels such as "MONDAY" and "Today": the light shade on dark glass, the ink shade on light backgrounds.
    func color(in colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? colors.light : ink
    }

    /// The color shown in the accent picker, the same in light and dark mode.
    var swatch: Color { colors.light }

    /// Buttons and the play glyph: filled with the light shades, so `onAccent` ink always reads on them.
    var gradient: LinearGradient {
        LinearGradient(colors: [colors.light, colors.deep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// Marks drawn straight on the background (the focus ring, icons, progress bars): light to deep on dark glass,
    /// deep to ink on light backgrounds, so they never fade into white.
    func markColors(in colorScheme: ColorScheme) -> [Color] {
        colorScheme == .dark ? [colors.light, colors.deep] : [colors.deep, ink]
    }

    /// `markColors` as a diagonal gradient, for icons and bars.
    func markGradient(in colorScheme: ColorScheme) -> LinearGradient {
        LinearGradient(colors: markColors(in: colorScheme), startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// Text and icons drawn on top of the accent gradient; dark ink reads on every light accent.
    var onAccent: Color { DeskfocusTheme.ink }

    private static func rgb(_ hex: UInt32) -> Color {
        Color(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

private struct DeskfocusAccentKey: EnvironmentKey {
    static let defaultValue: AccentChoice = .amber
}

extension EnvironmentValues {
    /// The user's accent, set once at the root of every DeskFocus surface.
    var deskfocusAccent: AccentChoice {
        get { self[DeskfocusAccentKey.self] }
        set { self[DeskfocusAccentKey.self] = newValue }
    }
}
