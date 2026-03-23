# WhatsApp Live Location Report Submission - Testing Guide

## Quick Start

### Prerequisites
- ✅ Backend running on `http://localhost:5000`
- ✅ PostgreSQL database connected
- ✅ Cloudflare tunnel running (for public webhook)
- ✅ Citizen account created in the system with WhatsApp number linked

### Step 1: Register Your WhatsApp Number

Before testing via WhatsApp, you need to link your WhatsApp phone number to your citizen account in the app:

```
1. Open Nazar AI App (frontend)
2. Go to Settings
3. Find "WhatsApp Settings" or "Phone Number"
4. Enter your WhatsApp phone number (with country code, e.g., +91 XXXXX XXXXX)
5. Save
```

### Step 2: Send a WhatsApp Message to Twilio Sandbox

Using Twilio WhatsApp sandbox:
```
1. Go to: https://www.twilio.com/console/sms/whatsapp/sandbox
2. Accept the sandbox terms (if first time)
3. Click "Request Join" or follow the sandbox number
4. Send a message to the sandbox number
   Example: "Hi"
5. You'll get a confirmation
```

### Step 3: Now Send Your First Report

Send a message to the Twilio sandbox WhatsApp number:
```
"Hi, I found a pothole on my street"
```

**Expected Response:**
```
📸 Welcome to Nazar AI!

Please send us:
1. A photo of the issue
2. A brief description (optional)

Example: Send a photo of a pothole, or flooded street.
```

### Step 4: Send a Photo

```
1. Click attachment (+) in WhatsApp
2. Select "Photos"
3. Take a photo or choose from gallery (of any issue - traffic, trash, pothole, etc.)
4. You can add text like: "Broken street"
5. Send to the bot
```

**Expected Response:**
```
✅ Got your photo and description!

📍 Now please share your current location:
1. Click the attachment button (+) in WhatsApp
2. Select "Location"
3. Share your live location or current location

This helps us pinpoint the exact issue location.
```

### Step 5: Share Your Live Location

**IMPORTANT:** Use WhatsApp's native location feature, not manual coordinates:

```
1. In WhatsApp, click the attachment button (+)
2. Select "Location"
3. Choose:
   - "Current Location" (recommended) - sends your GPS location
   - Or "Live location" for continuous update
4. Allow location access if prompted
5. Send to the bot
```

**What happens next:**
- System receives your GPS coordinates
- Reverse-geocodes to full address (e.g., "Connaught Place, New Delhi")
- Analyzes photo to detect issue type
- Creates report with all details

**Expected Final Response:**
```
✅ Thanks! Your report has been registered.

Complaint ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Issue type: Pothole
Assigned department: Public Works Department

You can track progress in the Nazar AI app.
```

## Testing Without WhatsApp

### Using curl/Postman to Simulate

#### Test 1: First Message (Text Only)
```bash
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=Pothole%20on%20my%20street" \
  -d "NumMedia=0"
```

**Expected Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>📸 Welcome to Nazar AI!

Please send us:
1. A photo of the issue
2. A brief description (optional)

Example: Send a photo of a pothole, or flooded street.</Message>
</Response>
```

#### Test 2: With Image (Cannot easily mock without real Twilio)

To properly test image handling:
- You need actual Twilio webhook with real image
- Or mock the `fetchTwilioMediaAsDataUrl` function in tests

#### Test 3: With Location Coordinates (GPS)
```bash
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=" \
  -d "Latitude=28.6315" \
  -d "Longitude=77.2167"
```

**Expected Response:**
- Should geocode coordinates to address
- Should create report in database
- Should send confirmation with report ID

## Checking Your Report

### In the Dashboard

1. Log in to Nazar AI frontend
2. Go to "Citizen Dashboard"
3. You should see your report with:
   - Status: "Reported"
   - Issue Type: (auto-detected by AI)
   - Location: (from reverse geocoding)
   - Photo: (the image you sent)
   - Time: When you submitted

### In the Database

```sql
-- Check your reports
SELECT id, type, severity, location, status, reported_at 
FROM reports 
WHERE citizen_id = '<your-citizen-id>' 
ORDER BY reported_at DESC 
LIMIT 5;

-- Check sessions (should be empty after report creation)
SELECT * FROM whatsapp_sessions 
WHERE citizen_id = '<your-citizen-id>';
```

## Troubleshooting

### "Your number is not linked to a citizen account"

**Solution:**
1. Make sure your WhatsApp number is registered in the app
2. Check that the number format matches (with country code)
3. In database: `SELECT phone FROM users WHERE role='citizen' AND first_name='Your Name';`

### No response from bot

**Check:**
1. Backend is running: `curl http://localhost:5000/api/health`
2. Tunnel is active: `cloudflared tunnel run <tunnel-name>`
3. Twilio webhook URL is correctly set in sandbox
4. Check backend logs: `npm run dev` output

### "Could not download image"

**Causes:**
- Twilio auth failed (check credentials in .env)
- Image URL is invalid
- Network timeout

**Solution:**
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in .env
- Try sending image again

### Location not reverse-geocoded

**Causes:**
- OpenStreetMap Nominatim API is slow/down
- Coordinates are in ocean/invalid area
- Network timeout (5 seconds)

**Fallback:**
- Report still created with lat/lng
- Address shows as coordinates
- Later can add alternative geocoding service

### Report created but wrong issue type

**Solution:**
- AI Detection is probabilistic
- You can edit the issue type in department dashboard
- Send clearer photos for better detection

## Advanced Testing

### Load Testing

Send multiple reports to test:
```bash
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/whatsapp/webhook \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "From=whatsapp:%2B9162899370$i" \
    -d "Body=Test%20report%20$i" \
    -d "NumMedia=0"
  sleep 1
done
```

### Session Persistence

Send image, wait without location, then follow up:
```bash
# First: Send image (session created with waiting_for_location)
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=Check%20this%20pothole" \
  -d "NumMedia=1" \
  -d "MediaUrl0=https://example.com/image.jpg"

# Wait 5 minutes

# Second: Send location (should use stored image)
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=" \
  -d "Latitude=28.6315" \
  -d "Longitude=77.2167"
```

## Flow Validation Checklist

- [ ] Backend is running on port 5000
- [ ] Database is connected
- [ ] Cloudflare tunnel is active
- [ ] WhatsApp number is registered in citizen account
- [ ] First message sends welcome prompt
- [ ] Second message (with image) asks for location
- [ ] Third message (with location) creates report
- [ ] Report appears in dashboard
- [ ] Report has correct location (reverse-geocoded)
- [ ] Report has correct issue type (from AI)
- [ ] Citizen receives confirmation with complaint ID

## Success Indicators

✅ You're ready when:
- Fresh WhatsApp message → Bot asks for photo
- Photo sent → Bot asks for location
- Location sent → Report created with ID
- No manual address entry needed
- Address is auto-detected from GPS
- Issue type is auto-detected from photo
- Department is auto-assigned
- Citizen gets complaint tracking ID immediately

## Next Steps

After first report works:
1. **Department Testing**: Have municipal staff log in to resolve the report
2. **Resolution Flow**: Test proof image + notes + rating feedback
3. **24-hour Reminder**: Wait or simulate time to test reminder scheduler
4. **Reopen Flow**: Test unsatisfied feedback and report reopening

Enjoy! 🎉
