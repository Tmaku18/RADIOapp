# Android SDK Setup Guide

## The Problem
Flutter can't find your Android SDK, which is required to build Android apps.

## Solution Options

### Option 1: Install Android Studio (Recommended - Easiest)

1. **Download Android Studio:**
   - Go to https://developer.android.com/studio
   - Download Android Studio for Windows
   - Run the installer

2. **During Installation:**
   - Make sure "Android SDK" is checked
   - Note the SDK location (usually `C:\Users\YourName\AppData\Local\Android\Sdk`)

3. **After Installation:**
   - Open Android Studio
   - Go through the setup wizard
   - It will download the Android SDK automatically

4. **Configure Flutter:**
   ```bash
   flutter config --android-sdk "C:\Users\tmaku\AppData\Local\Android\Sdk"
   ```
   (Replace with your actual SDK path)

5. **Verify:**
   ```bash
   flutter doctor -v
   ```
   Should show Android toolchain as ✓

### Option 2: Install Android SDK Command Line Tools (Without Android Studio)

1. **Download SDK Command Line Tools:**
   - Go to https://developer.android.com/studio#command-tools
   - Download "Command line tools only" for Windows

2. **Extract and Set Up:**
   ```powershell
   # Create SDK directory
   New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\Android\Sdk"
   
   # Extract command line tools to: C:\Users\tmaku\AppData\Local\Android\Sdk\cmdline-tools
   ```

3. **Install SDK Components:**
   ```powershell
   cd "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
   .\sdkmanager.bat "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```

4. **Set Environment Variables:**
   ```powershell
   # Set ANDROID_HOME
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
   
   # Add to PATH
   $path = [System.Environment]::GetEnvironmentVariable("Path", "User")
   [System.Environment]::SetEnvironmentVariable("Path", "$path;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\tools", "User")
   ```

5. **Configure Flutter:**
   ```bash
   flutter config --android-sdk "$env:LOCALAPPDATA\Android\Sdk"
   ```

### Option 3: Quick Fix - Set SDK Path Manually

If you already have Android SDK installed somewhere:

1. **Find your Android SDK:**
   - Common locations:
     - `C:\Users\tmaku\AppData\Local\Android\Sdk`
     - `C:\Android\Sdk`
     - `C:\Program Files\Android\Android Studio\sdk`

2. **Set the path:**
   ```bash
   flutter config --android-sdk "C:\path\to\your\android\sdk"
   ```

3. **Or create/update `mobile/android/local.properties`:**
   ```
   sdk.dir=C:\\Users\\tmaku\\AppData\\Local\\Android\\Sdk
   ```

## Verify Setup

After setting up:

```bash
flutter doctor -v
```

You should see:
```
[√] Android toolchain - develop for Android devices
    • Android SDK at C:\Users\tmaku\AppData\Local\Android\Sdk
    • Platform android-34, build-tools 34.0.0
    • Java binary at: ...
    • Java version: ...
```

## Build the App Bundle

Once Android SDK is configured:

```bash
cd mobile
flutter build appbundle
```

## Troubleshooting

### "SDK location not found"
- Make sure the path in `local.properties` uses double backslashes: `C:\\Users\\...`
- Or use forward slashes: `C:/Users/...`

### "License not accepted"
```bash
flutter doctor --android-licenses
```
Accept all licenses when prompted.

### "Command line tools not found"
- Make sure you've installed the SDK platform tools
- Check that `platform-tools` directory exists in your SDK folder

## Quick Commands

```bash
# Check Flutter setup
flutter doctor -v

# Configure Android SDK path
flutter config --android-sdk "C:\Users\tmaku\AppData\Local\Android\Sdk"

# Accept Android licenses
flutter doctor --android-licenses

# Build app bundle
cd mobile
flutter build appbundle
```
