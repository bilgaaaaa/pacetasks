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

        // Lets JavaScript fall back to its own timer when the app target was built without the handler.
        Function("isAvailable") { () -> Bool in
            Self.handler() != nil
        }

        // Sends one JSON command and resolves with the handler's JSON reply.
        AsyncFunction("send") { (command: String, promise: Promise) in
            guard let handler = Self.handler() else {
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
        // The observer is added and removed on the main thread, where Darwin callbacks arrive, so none can outlive it.
        OnStartObserving("onFocusChange") {
            DispatchQueue.main.async {
                self.stateObserver = FocusStateObserver(name: Self.stateChangedNotification) { [weak self] in
                    self?.sendEvent("onFocusChange", [:])
                }
            }
        }

        OnStopObserving("onFocusChange") {
            DispatchQueue.main.async {
                self.stateObserver = nil
            }
        }
    }

    /// The app target's handler class, or nil when this build lacks it.
    private static func handler() -> NSObject.Type? {
        guard let handler = NSClassFromString(handlerClassName) as? NSObject.Type, handler.responds(to: handlerSelector) else {
            return nil
        }
        return handler
    }
}

/// Observes one Darwin notification and calls the handler on the main queue until deallocated; create and release it on the main thread.
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
            // Delivered on the main thread, where the observer is also released, so the pointer is still valid here.
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
