# Enable Windows Developer Mode for Flutter

## The Issue
Flutter needs symlink support to build apps that use plugins ("Building with plugins requires symlink support"). The NETWORX app uses many plugins, so Windows Developer Mode must be on for any build or `flutter run`.

## Quick Fix

### Option 1: Enable via Settings UI
1. Press `Win + I` to open Settings
2. Go to **System** → **For developers** (Windows 11) or **Update & Security** → **For developers** (Windows 10)
3. Toggle **"Developer Mode"** to **ON**
4. Accept any prompts

### Option 2: Enable via Command (Run as Administrator)
```powershell
# Open PowerShell as Administrator, then run:
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name "AllowDevelopmentWithoutDevLicense" -Value 1
```

### Option 3: Use Settings Shortcut
Run this command to open the settings page directly:
```powershell
start ms-settings:developers
```
Then toggle "Developer Mode" ON.

## After Enabling

1. **Restart your terminal/IDE** (important!)
2. **Try building again:**
   ```bash
   cd mobile
   flutter pub get
   flutter build appbundle --release
   ```

## Verify Developer Mode is Enabled

Check in Settings → For developers (`start ms-settings:developers`):
- ✅ "Developer Mode" should be ON (blue toggle)

## Alternative: Build Without Developer Mode

APK and app bundle builds both need symlinks, so there is no Flutter-side workaround. If you cannot enable Developer Mode (e.g. a locked-down work PC), build on macOS, Linux, or CI (`.github/workflows/test.yml` builds an Android debug APK).

## Troubleshooting

If Developer Mode won't enable:
- Make sure you're running Windows 10 or 11 (any edition, including Home)
- Check whether your organization blocks it through Group Policy
- Restart your computer after enabling
- Check Windows Update is current
