# Share via AirDrop for Chrome

Safari has a Share button that can AirDrop the current page to your iPhone, iPad or another Mac. Chrome on macOS doesn't. This extension adds it.

- **Toolbar button**: one click shares the current tab.
- **Keyboard shortcut**: <kbd>⌥ Option</kbd> + <kbd>⇧ Shift</kbd> + <kbd>A</kbd>. You can change it at `chrome://extensions/shortcuts`.
- **Right-click menu**: *Share Page via AirDrop*, *Share Link via AirDrop*, and *Share Media Address via AirDrop* for images, video and audio.
- Local files opened in Chrome (`file://`, such as a PDF) are sent as the file itself.
- Works in Google Chrome, Chromium, Brave, Microsoft Edge, Vivaldi and Arc on macOS 11 or later.

## How it works

Browser extensions run in a sandbox and can't call macOS APIs, so AirDrop can't be reached from JavaScript alone. The extension therefore comes with a tiny helper program, `native-host/AirDropHost.swift`, that Chrome launches through [native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging):

```
Chrome extension ──(URL as JSON over stdin)──▶ airdrop-host ──▶ NSSharingService(.sendViaAirDrop)
                ◀──────(result: sent / cancelled / error)──────┘
```

The helper runs only while you are sharing. It has no Dock icon and makes no network connections. It opens the standard macOS AirDrop window and exits when you send or cancel.

## Install

You need macOS and Apple's Command Line Tools. If you don't have them, run `xcode-select --install`.

1. **Get the code**

   ```sh
   git clone https://github.com/TingGeorge/airdrop-in-chrome.git
   cd airdrop-in-chrome
   ```

2. **Build and register the helper**

   ```sh
   ./install.sh
   ```

   This compiles the helper to `~/Library/Application Support/AirDropForChrome/airdrop-host`. It then registers the helper with Chrome and with any other supported browsers you have installed.

3. **Load the extension**
   - Open `chrome://extensions`.
   - Turn on **Developer mode** (top right).
   - Click **Load unpacked** and select the `extension` folder.
   - Pin the extension from the puzzle-piece menu so the button stays in the toolbar.

4. A setup page opens. A green status means the helper is working.

### Extension ID

`manifest.json` contains a public `key`, so the unpacked extension always gets the ID `bknlnfilkdendhgjbkjinfammcfcpgpn`, and `install.sh` allows that ID by default. If you load the extension under a different ID (for example from a store listing), pass that ID to the installer:

```sh
./install.sh --extension-id <your-extension-id>
```

## Uninstall

```sh
./uninstall.sh
```

Then remove the extension from `chrome://extensions`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Setup page says *"native messaging host not found"* | Run `./install.sh`, then **fully quit and restart Chrome** (⌘Q). |
| *"Access to the specified native messaging host is forbidden"* | The extension ID differs from the one the helper allows. Run `./install.sh --extension-id <ID shown on the setup page>`. |
| *"AirDrop can't share this right now"* | Turn on Wi-Fi and Bluetooth, and set AirDrop to *Contacts Only* or *Everyone* in Control Center. |
| The AirDrop window opens behind Chrome | Click the AirDrop window in the Dock or with Mission Control. The helper asks to come to the front, but macOS sometimes refuses. |
| Toolbar badge shows **✕** | The page can't be shared. Only `http`, `https` and `file` URLs can be sent, so pages like `chrome://settings` won't work. |

## Development

```sh
# Build the helper without installing it
xcrun swiftc -O -o build/airdrop-host native-host/AirDropHost.swift

# Protocol smoke test (doesn't open the AirDrop window)
python3 tests/test_host.py build/airdrop-host
```

CI (`.github/workflows/build.yml`) builds a universal (Apple silicon + Intel) helper on macOS. It also runs the protocol smoke test and an install/uninstall check, and syntax-checks the extension.

AirDrop is a trademark of Apple Inc. This project isn't affiliated with Apple or Google.
