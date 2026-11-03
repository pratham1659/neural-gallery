import Foundation
import LocalAuthentication

@_cdecl("neural_check_biometrics_available")
public func neural_check_biometrics_available() -> Bool {
    let context = LAContext()
    var error: NSError?
    let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    return canEvaluate
}

@_cdecl("neural_evaluate_touch_id")
public func neural_evaluate_touch_id(promptPtr: UnsafePointer<CChar>?) -> Bool {
    let context = LAContext()
    var reason = "Unlock Neural Gallery Vault"
    if let promptPtr = promptPtr {
        reason = String(cString: promptPtr)
    }

    var success = false
    let semaphore = DispatchSemaphore(value: 0)

    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { ok, _ in
        success = ok
        semaphore.signal()
    }

    // Wait up to 30 seconds for user Touch ID interaction
    let timeout = DispatchTime.now() + 30.0
    _ = semaphore.wait(timeout: timeout)

    return success
}
