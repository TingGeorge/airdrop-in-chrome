// AirDropHost: a Chrome native messaging host that shares a URL via AirDrop.
//
// Chrome starts this executable for each message, writes one length-prefixed JSON
// message to stdin and expects one length-prefixed JSON reply on stdout.
// See https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
//
// Requests:
//   {"action": "ping"}                              -> {"ok": true, "version": "..."}
//   {"action": "share", "url": "...", "title": ""}  -> {"ok": true}
//                                                     | {"ok": false, "cancelled": true}
//                                                     | {"ok": false, "error": "..."}

import AppKit
import Foundation

let hostVersion = "1.0.0"

// The AirDrop window stays open until the user acts. Give up eventually so a
// forgotten window doesn't leave this process running forever.
let shareTimeout: TimeInterval = 10 * 60

// Requests are tiny; refuse anything absurd instead of trying to allocate it.
let maxMessageLength = 1024 * 1024

// MARK: - Native messaging I/O

func readMessage() -> [String: Any]? {
    let stdin = FileHandle.standardInput
    let header = [UInt8](stdin.readData(ofLength: 4))
    guard header.count == 4 else { return nil }
    // Chrome uses native byte order; every Mac (Intel and Apple silicon) is little-endian.
    let length = Int(UInt32(header[0]) | UInt32(header[1]) << 8 | UInt32(header[2]) << 16 | UInt32(header[3]) << 24)
    guard length <= maxMessageLength else { return nil }
    let body = stdin.readData(ofLength: length)
    guard body.count == length else { return nil }
    return (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
}

func writeMessage(_ message: [String: Any]) {
    guard let body = try? JSONSerialization.data(withJSONObject: message) else { return }
    let length = UInt32(body.count)
    var data = Data([
        UInt8(length & 0xFF),
        UInt8((length >> 8) & 0xFF),
        UInt8((length >> 16) & 0xFF),
        UInt8((length >> 24) & 0xFF),
    ])
    data.append(body)
    // write(contentsOf:) throws instead of raising an uncatchable exception if Chrome
    // has already closed the pipe.
    try? FileHandle.standardOutput.write(contentsOf: data)
}

func reply(_ message: [String: Any], exitCode: Int32 = 0) -> Never {
    writeMessage(message)
    exit(exitCode)
}

func fail(_ error: String) -> Never {
    reply(["ok": false, "error": error])
}

// MARK: - AirDrop

final class AirDropController: NSObject, NSApplicationDelegate, NSSharingServiceDelegate {
    private let items: [Any]
    // perform(withItems:) is asynchronous and the delegate is weak, so keep the
    // service alive until it reports back.
    private var service: NSSharingService?

    init(items: [Any]) {
        self.items = items
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let service = NSSharingService(named: .sendViaAirDrop) else {
            fail("AirDrop isn't available on this Mac.")
        }
        guard service.canPerform(withItems: items) else {
            fail("AirDrop can't share this right now. Make sure Wi-Fi and Bluetooth are on and AirDrop is enabled in Control Center.")
        }
        service.delegate = self
        self.service = service

        // We were launched in the background by Chrome. Come to the front so the
        // AirDrop window appears above the browser.
        // NSApplication.activate() needs the macOS 14 SDK (Swift 5.9 / Xcode 15).
        #if compiler(>=5.9)
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        #else
        NSApp.activate(ignoringOtherApps: true)
        #endif
        service.perform(withItems: items)

        Timer.scheduledTimer(withTimeInterval: shareTimeout, repeats: false) { _ in
            reply(["ok": false, "cancelled": true, "error": "Timed out waiting for AirDrop."])
        }
    }

    func sharingService(_ sharingService: NSSharingService, didShareItems items: [Any]) {
        reply(["ok": true])
    }

    func sharingService(_ sharingService: NSSharingService, didFailToShareItems items: [Any], error: Error) {
        let nsError = error as NSError
        if nsError.domain == NSCocoaErrorDomain && nsError.code == NSUserCancelledError {
            reply(["ok": false, "cancelled": true])
        }
        fail(nsError.localizedDescription)
    }
}

// MARK: - Main

// If Chrome goes away first, a write to the closed pipe shouldn't crash us.
signal(SIGPIPE, SIG_IGN)

guard let request = readMessage() else {
    fail("Couldn't read a message from Chrome.")
}

switch request["action"] as? String {
case "ping":
    reply(["ok": true, "version": hostVersion])

case "share":
    guard let string = request["url"] as? String,
          let url = URL(string: string),
          let scheme = url.scheme?.lowercased(),
          ["http", "https", "file"].contains(scheme) else {
        fail("Only http, https and file URLs can be shared.")
    }
    if url.isFileURL && !FileManager.default.fileExists(atPath: url.path) {
        fail("The file \(url.path) doesn't exist.")
    }

    let app = NSApplication.shared
    // No Dock icon or menu bar; we only exist to show the AirDrop window.
    app.setActivationPolicy(.accessory)
    let controller = AirDropController(items: [url])
    // NSApplication.delegate is weak; keep the controller alive while the app runs.
    withExtendedLifetime(controller) {
        app.delegate = controller
        app.run()
    }

default:
    fail("Unknown action.")
}
