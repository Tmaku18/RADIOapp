# Firebase Private Key Format Guide

## The Problem

The Firebase private key needs to be properly formatted in your `.env` file. The key contains newlines that must be escaped.

## Simplest Option: Use the JSON File

Skip the key formatting entirely by pointing the backend at the service account JSON:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
```

When this is set, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are ignored. Docker Compose uses this option.

## Solution: How to Format FIREBASE_PRIVATE_KEY

### Option 1: Using Escaped Newlines (Recommended)

In your `.env` file, the private key should be on a single line with `\n` to represent newlines, wrapped in double quotes:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<base64 line 1>\n<base64 line 2>\n...\n-----END PRIVATE KEY-----\n"
```

**Important:**
- Wrap it in **double quotes** (`"`) in `.env` files. On Railway or Vercel, paste the value without surrounding quotes
- Use `\n` (backslash + n) for newlines
- Keep it on a single line
- Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers

The backend strips surrounding quotes, converts `\n` to real newlines, and rejects values that are not a PEM `PRIVATE KEY`.

### Option 2: Copy from JSON File

If you have the Firebase service account JSON file:

1. Open the JSON file
2. Find the `"private_key"` field
3. Copy the entire value (including the `\n` characters)
4. Paste it into your `.env` file as:
   ```env
   FIREBASE_PRIVATE_KEY="<paste the entire value here, including the \n characters>"
   ```

Never paste a real key into documentation, issues, or commits.

## Common Mistakes

❌ **Wrong:** Missing quotes in `.env`
```env
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

❌ **Wrong:** Actual newlines in .env file
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEv...
..."
```

❌ **Wrong:** Missing `\n` characters
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----MIIEv..."
```

✅ **Correct:** Single line with `\n` and double quotes
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n...\n-----END PRIVATE KEY-----\n"
```

## Quick Fix Script

On Windows, run `.\extract-firebase-key.ps1` from `backend/`. It reads `config/firebase-service-account.json.json` (gitignored) and prints ready-to-paste `FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, and `FIREBASE_CLIENT_EMAIL` lines.

On macOS / Linux, from the folder holding the JSON:

```bash
node -e 'const k=require("./service-account.json").private_key; console.log(`FIREBASE_PRIVATE_KEY="${k.replace(/\n/g,"\\n")}"`)'
```

Then copy the output to your `.env` file.

## Verification

After updating your `.env` file, test if it works:

```bash
cd backend
npm run start:dev
```

If you see "Application is running on: http://localhost:3000", the key is formatted correctly. Errors such as "FIREBASE_PRIVATE_KEY appears to be invalid" or "Failed to initialize Firebase" point to a formatting problem.
