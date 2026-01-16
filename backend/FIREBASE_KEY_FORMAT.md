# Firebase Private Key Format Guide

## The Problem

The Firebase private key needs to be properly formatted in your `.env` file. The key contains newlines that must be escaped.

## Solution: How to Format FIREBASE_PRIVATE_KEY

### Option 1: Using Escaped Newlines (Recommended)

In your `.env` file, the private key should be on a single line with `\n` to represent newlines, wrapped in double quotes:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7\nTN59QTzJf8c3UMSfMIiVTVLj9HD8noMJa5zri+2MEQxhy+0Z1lRRZ2qfDLfEu4vO\n...rest of key...\n-----END PRIVATE KEY-----\n"
```

**Important:**
- Must be wrapped in **double quotes** (`"`)
- Use `\n` (backslash + n) for newlines
- Keep it on a single line
- Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers

### Option 2: Copy from JSON File

If you have the Firebase service account JSON file:

1. Open the JSON file
2. Find the `"private_key"` field
3. Copy the entire value (including quotes and `\n` characters)
4. Paste it into your `.env` file as:
   ```env
   FIREBASE_PRIVATE_KEY="<paste the entire value here, including the \n characters>"
   ```

### Example from Your JSON File

From `backend/config/firebase-service-account.json.json`, your key should look like:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7\nTN59QTzJf8c3UMSfMIiVTVLj9HD8noMJa5zri+2MEQxhy+0Z1lRRZ2qfDLfEu4vO\nGXvfi193s48NQMFJKURoXdr0k4C7hFXI2s2ookqdHWRikSmSdET0KINv5O77Usrb\nPjQE18P/PljhlMKpHsh3cpjBqnzHH80J72xmi9iOu8GsH1KlJted6nMxq/iOakM9\nG6xoPuup59j9YNeb346LD1uzWkwc88eVGfwzOIZOJ3SylpCjCuJp11Qd+MtObZjr\nTyXGIPQohmpridUdsLD+GIq6HIOb6279gi5cdYJ2SLm8jnrxeUMeJH8AJjSsHg+6\nvs3/SDmhAgMBAAECggEAEZvJr4ZB8f4E5l3HZ62ka7IYFM6/++migqCS02kCeNCK\nX582xxS1ZmAIop2+k9aS3s52PNJm+pMK1tKhzf8eqqshq92F9hrbmL6ttogKPg6M\nwA8K6grNn/HQ5q3iQk8vaQtxmz30bqz9OG0dEIYNxE4gQGsKIdzwmZbLg9g1Vq50\ntYbnq21sxp5wLnphdbxrJG+AO23xp5UO5pBTlAKulcMiGaSfHIKBsm7DTCJ10ErK\ney2bvr7C974OoKsJOn23rzkDrJGn8VsUIKf0SB/LBFh3+t+2/heBeSakXhGflNzw\nVF2bXPTXbCqdCGNJBQhmyWpwS8I3z+As2TZuWwx9XQKBgQDwKhyR2j1quXxMKUzz\n4Saf0LcIAfskLmVaKo6UXDDFeOpAPW/2SLlOZ+qgp8Dh4mdbYAwi7dZ+jD7APoqw\nBAaQNiTJuyqVqnAh8gDkPKLdYhjIKSdW64xaZVGiZ3wfZ+ZeUtKuWeSrP7L19Jdm\nUzjachLwS1pOEM7oaGdcWDH0WwKBgQDhqlmVctj2fusTCCAxNIgvHr8y4UC5EHnT\n6NYpvJSIIxpAR8YDgiGXZiOpxHXdoWr+vGZVDRivrTJfskoP+6HUY3lL5YmSQLUe\nIXS46mAekImz8tegiRh6EhRHlDxH6Ho7G5bzX699gwpd3pY4z/dvfZBTkcjGPoJb\nbu3vumV6swKBgEfp1DQ4TTuv3vBPTaOZP5+LN8NGFJV47xBYveje0hvPYRVrUCNH\nE3XO2ArTMIZy7NAHqpqq7Rdnl0Kpd43NJsn37Hwbd1zpdDo15N5y6bGwtgr5h7YX\nQievPwqKQjiFPA3ybvOWJ0rAAC511v/k25lNny4k4h2OGuasnIaiQhMRAoGAdK8f\nuS30T6iapnGaK7cs/6hXVtiwHcEOLWuEaXpQFwCHj1tNYP0Fn4I5yIuEIoBXkbYa\n97lY3WWh2WeX8iG7sNVqn7rlYpFA1X6ZGxBdeRBlk31qz2B0HpKAl+5nKQtlQHDo\noZkFZdG/J4BzjpbCK4zydrO37AHgZ6S5NS7dUA8CgYBeE7EI7MQryrsAn8GyBIXz\n4XxNdGJb/kUDuooMLBNukaE1GmSpH319nsDtHunUnkVZ7XMLC7Mib2rRExgdVrjm\nRjy69D95U/3aa2HKtaYsyChz73nJkmJ2Yu30mwa9LT2ICJzuRK0D1lhCXEzm5Z3J\nOgEjmMtk+2AdU1/3wY5mBw==\n-----END PRIVATE KEY-----\n"
```

## Common Mistakes

❌ **Wrong:** Missing quotes
```env
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

❌ **Wrong:** Actual newlines in .env file
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7
..."
```

❌ **Wrong:** Missing `\n` characters
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7..."
```

✅ **Correct:** Single line with `\n` and double quotes
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDTtNMeAdqI2dw7\n..."
```

## Quick Fix Script

If you have the JSON file, you can use this PowerShell command to extract the key:

```powershell
$json = Get-Content "backend/config/firebase-service-account.json.json" | ConvertFrom-Json
$key = $json.private_key -replace '"', '\"'
Write-Host "FIREBASE_PRIVATE_KEY=`"$key`""
```

Then copy the output to your `.env` file.

## Verification

After updating your `.env` file, test if it works:

```bash
cd backend
npm run start:dev
```

If you see "Application is running on: http://localhost:3000", the key is formatted correctly!
