# Quick Fix: Android SDK Not Found

## The Issue
Flutter can't find Android SDK, so `flutter build appbundle` fails.

## Fastest Solution (5-10 minutes)

### Step 1: Install Android Studio
1. Download: https://developer.android.com/studio
2. Install with default settings
3. Open Android Studio → Setup Wizard will install Android SDK automatically

### Step 2: Find Your SDK Path
After Android Studio setup, the SDK is usually at:
```
C:\Users\tmaku\AppData\Local\Android\Sdk
```

### Step 3: Configure Flutter
```bash
flutter config --android-sdk "C:\Users\tmaku\AppData\Local\Android\Sdk"
```

### Step 4: Accept Licenses
```bash
flutter doctor --android-licenses
```
Type `y` for each license prompt.

### Step 5: Verify
```bash
flutter doctor -v
```
Should show: `[√] Android toolchain - develop for Android devices`

### Step 6: Build
```bash
cd mobile
flutter build appbundle
```

---

## Alternative: Manual SDK Setup (If you don't want Android Studio)

1. **Download Command Line Tools:**
   https://developer.android.com/studio#command-tools

2. **Extract to:** `C:\Users\tmaku\AppData\Local\Android\Sdk`

3. **Install SDK:**
   ```powershell
   cd C:\Users\tmaku\AppData\Local\Android\Sdk\cmdline-tools\latest\bin
   .\sdkmanager.bat "platform-tools" "platforms;android-34" "build-tools;34.0.0"
   ```

4. **Configure Flutter:**
   ```bash
   flutter config --android-sdk "C:\Users\tmaku\AppData\Local\Android\Sdk"
   ```

---

## Quick Check Commands

```bash
# Check if SDK is found
flutter doctor -v

# Set SDK path (if you know where it is)
flutter config --android-sdk "C:\path\to\sdk"

# Accept licenses
flutter doctor --android-licenses

# Try building again
cd mobile
flutter build appbundle
```

---

## If You Already Have Android Studio

Just run:
```bash
flutter config --android-sdk "$env:LOCALAPPDATA\Android\Sdk"
flutter doctor --android-licenses
```

Then try building again!
