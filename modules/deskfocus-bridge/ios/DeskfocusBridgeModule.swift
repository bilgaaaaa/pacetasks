import ExpoModulesCore
import Foundation

/// Lets PaceTasks' JavaScript start and follow the focus session the Deskfocus widget also drives.
/// The work happens in DeskfocusBridgeHandler (targets/deskfocus/_shared), found by name because this pod
/// cannot see the app target's Swift types.
public final class DeskfocusBridgeModule: Module {
    /// Must match DeskfocusConstants.stateChangedNotification in targets/deskfocus/_shared/DeskfocusConstants.swift.
    private static let stateChangedNotification = "com.pacetasks.app.deskfocus.stateChanged"
    private static let handlerClassName = "DeskfocusBridgeHandler"
    private static let handlerSelector = NSSelectorFromString("handle:completion:")

    private var stateObserver: FocusStateObserver?

    public func definition() -> ModuleDefinition {
        Name("DeskfocusBridge")

        Events("onFocusChange")

        // Sends one JSON command and resolves with the handler's JSON reply.
        AsyncFunction("send") { (command: String, promise: Promise) in
            guard let handler = NSClassFromString(Self.handlerClassName) as? NSObject.Type,
                  handler.responds(to: Self.handlerSelector) else {
                NSLog("[DeskfocusBridge] handler missing from this build")
                promise.reject("ERR_DESKFOCUS_HANDLER", "The Deskfocus focus handler is not part of this build")
                return
            }
            let completion: @convention(block) @Sendable (NSString) -> Void = { reply in
                promise.resolve(reply as String)
            }
            _ = (handler as AnyObject).perform(Self.handlerSelector, with: command as NSString, with: completion as AnyObject)
        }

        // The widget, the Live Activity and the app itself all post this signal after changing the session.
        OnStartObserving("onFocusChange") {
            self.stateObserver = FocusStateObserver(name: Self.stateChangedNotification) { [weak self] in
                self?.sendEvent("onFocusChange", [:])
            }
        }

        OnStopObserving("onFocusChange") {
            self.stateObserver = nil
        }
    }
}

/// Observes one Darwin notification and calls the handler on the main queue until deallocated.
private final class FocusStateObserver {
    private let name: String
    private let handler: () -> Void

    init(name: String, handler: @escaping () -> Void) {
        self.name = name
        self.handler = handler

        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterAddObserver(center, observer, { _, observer, _, _, _ in
            guard let observer else { return }
            let instance = Unmanaged<FocusStateObserver>.fromOpaque(observer).takeUnretainedValue()
            DispatchQueue.main.async { [weak instance] in instance?.handler() }
        }, name as CFString, nil, .deliverImmediately)
    }

    deinit {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveObserver(center, observer, CFNotificationName(name as CFString), nil)
    }
}
