# Enable Windows Developer Mode for Flutter

## The Issue
Flutter needs symlink support to build Android apps, which requires Windows Developer Mode.

## Quick Fix

### Option 1: Enable via Settings UI
1. Press `Win + I` to open Settings
2. Go to **Privacy & Security** → **For developers**
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
   flutter build appbundle
   ```

## Verify Developer Mode is Enabled

Check in Settings → Privacy & Security → For developers:
- ✅ "Developer Mode" should be ON (blue toggle)

## Alternative: Build Without Developer Mode

If you can't enable Developer Mode, you can build with:
```bash
flutter build apk
```
Instead of `appbundle`, though APK is less efficient for distribution.

## Troubleshooting

If Developer Mode won't enable:
- Make sure you're running Windows 10/11 (not Windows Home)
- Restart your computer after enabling
- Check Windows Update is current
