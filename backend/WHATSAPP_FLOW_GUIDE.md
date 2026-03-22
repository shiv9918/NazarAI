/**
 * WhatsApp Report Submission Flow - Step-by-Step Guide
 * ====================================================
 *
 * This guide explains how citizens can report issues via WhatsApp
 * with photo and live location capture.
 *
 * FLOW OVERVIEW:
 * ============
 *
 * Step 1: Citizen sends initial message (text or with photo)
 * ┌─────────────────────────────────────────────────────────┐
 * │ If NO image:                                             │
 * │ System responds: "📸 Welcome to Nazar AI!               │
 * │                 Please send us:                          │
 * │                 1. A photo of the issue                 │
 * │                 2. A brief description (optional)        │
 * │                                                           │
 * │                 Example: Send a photo of a pothole..."   │
 * │                                                           │
 * │ If YES image + optional text:                            │
 * │ System responds: "✅ Got your photo!                    │
 * │                 📍 Now please share your current        │
 * │                    location..."                          │
 * └─────────────────────────────────────────────────────────┘
 *
 * Step 2: Citizen sends PHOTO + optional DESCRIPTION
 * ┌─────────────────────────────────────────────────────────┐
 * │ Citizen:                                                 │
 * │ - Clicks camera/attachment (📎) in WhatsApp            │
 * │ - Selects "Photo" or takes a photo                      │
 * │ - Optionally adds text description                      │
 * │ - Sends to Nazar AI bot                                 │
 * │                                                           │
 * │ System processes:                                        │
 * │ - Image analysis (issue type detection using Gemini)    │
 * │ - Extracts text description if provided                 │
 * │ - Stores image + description temporarily               │
 * │ - Stores session state: "waiting_for_location"          │
 * │                                                           │
 * │ System responds:                                         │
 * │ "✅ Got your photo and description!                    │
 * │                                                           │
 * │ 📍 Now please share your current location:              │
 * │ 1. Click the attachment button (+) in WhatsApp          │
 * │ 2. Select \"Location\"                                   │
 * │ 3. Share your live location or current location         │
 * │                                                           │
 * │ This helps us pinpoint the exact issue location."        │
 * └─────────────────────────────────────────────────────────┘
 *
 * Step 3: Citizen sends LIVE LOCATION
 * ┌─────────────────────────────────────────────────────────┐
 * │ Citizen:                                                 │
 * │ - Clicks attachment (+) in WhatsApp                    │
 * │ - Selects "Location"                                    │
 * │ - Chooses "Current Location" or shares live location    │
 * │ - Sends to Nazar AI bot                                 │
 * │                                                           │
 * │ Twilio sends to backend:                                │
 * │ - Latitude parameter (e.g., 28.6315)                   │
 * │ - Longitude parameter (e.g., 77.2167)                  │
 * │                                                           │
 * │ Backend processes:                                       │
 * │ 1. Receives location coordinates                         │
 * │ 2. Reverse-geocodes (lat/lng → human-readable address)  │
 * │ 3. Uses OpenStreetMap Nominatim API (free service)      │
 * │ 4. Gets full address: "Connaught Place, New Delhi,      │
 * │    Delhi, India"                                         │
 * │ 5. Creates report with:                                 │
 * │    - Image (base64 encoded)                             │
 * │    - Description                                        │
 * │    - Address (from reverse geocoding)                   │
 * │    - Latitude/Longitude (exact coordinates)             │
 * │    - Issue type (auto-detected by Gemini vision)        │
 * │    - Severity score (1-10)                              │
 * │    - Auto-assigned department                           │
 * │                                                           │
 * │ Database stores:                                        │
 * │ - report.image_url (base64 data URL)                   │
 * │ - report.lat, report.lng (coordinates)                  │
 * │ - report.location (human-readable address)              │
 * │ - report.type (issue type)                              │
 * │ - report.description (citizen's text + AI analysis)     │
 * │                                                           │
 * │ System responds:                                         │
 * │ "✅ Processing your report. You will receive a           │
 * │    confirmation with your complaint ID shortly."         │
 * │                                                           │
 * │ Citizen receives:                                       │
 * │ "Thanks! Your report has been registered.               │
 * │  Complaint ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890     │
 * │  Issue type: Pothole                                     │
 * │  Assigned department: Public Works Department           │
 * │  You can track progress in the Nazar AI app."            │
 * └─────────────────────────────────────────────────────────┘
 *
 * IMPORTANT NOTES:
 * ===============
 *
 * 1. LIVE LOCATION SHARING:
 *    - Must use WhatsApp's native location feature
 *    - Click attachment (+) → Select "Location"
 *    - Choose "Current Location" (one-time share)
 *    - System captures exact GPS coordinates
 *    - Automatically reverse-geocoded to full address
 *
 * 2. ACCURACY:
 *    - Live location captures GPS data when available
 *    - Works best with GPS enabled on phone
 *    - Falls back to WiFi/cell tower location if GPS unavailable
 *    - Accuracy typically 5-30 meters in urban areas
 *
 * 3. PRIVACY:
 *    - Location is not stored as raw GPS continuously
 *    - Only current location snapshot is sent
 *    - Converted to address and stored in database
 *    - No tracking or continuous location monitoring
 *
 * 4. SESSION MANAGEMENT:
 *    - Each citizen has one active session per phone number
 *    - Session stores: pending image, pending description, flow state
 *    - Session automatically clears after report creation
 *    - If interrupted, restart from Step 1
 *
 * 5. IMAGE REQUIREMENTS:
 *    - JPEG or PNG format
 *    - Compressed to 1600px max dimension
 *    - 75% JPEG quality (for fast transfer)
 *    - Max ~500KB per image (typical)
 *    - Stored as base64 data URL in database
 *
 * 6. ISSUE TYPE DETECTION:
 *    - Uses Google Gemini Vision AI
 *    - Analyzes image to detect issue type (pothole, flooding, etc.)
 *    - Calculates severity score (1-10)
 *    - Citizen's text description is included
 *    - AI description combines both image + text analysis
 *
 * 7. DEPARTMENT ASSIGNMENT:
 *    - Automatically assigns to relevant department
 *    - Based on issue type detected
 *    - Examples:
 *      - Pothole → Public Works
 *      - Flooding → Water Management
 *      - Trash → Sanitation
 *      - Street Light → Electricity
 *
 * 8. FOLLOW-UP COMMUNICATION:
 *    - Department will receive the report in dashboard
 *    - When resolved with proof photos + notes
 *    - Citizen receives satisfaction rating prompt
 *    - 24-hour reminder if no response
 *    - Report can be reopened if unsatisfied
 *
 * EXAMPLE CITIZEN INTERACTION:
 * ============================
 *
 * Citizen:        "Help! There's a huge pothole near my home"
 * System:         "📸 Welcome to Nazar AI! Please send a photo..."
 * Citizen:        [Sends photo of pothole]
 * System:         "✅ Got your photo! Now please share location..."
 * Citizen:        [Shares live location via WhatsApp]
 * System:         "✅ Processing your report..."
 * System:         "Thanks! Your report registered. ID: abc-123-def
 *                  Type: Pothole, Department: Public Works
 *                  Track in Nazar AI app"
 * 
 * [Later when resolved...]
 * System:         "Great news! Your pothole has been fixed!
 *                  Are you satisfied? Reply: HAAN/NAHI"
 * Citizen:        "HAAN"
 * System:         "Thanks for your feedback! ⭐"
 *
 * TECHNICAL FLOW:
 * ===============
 *
 * Backend Process:
 * ┌─────────────────────────────────────────────────────────┐
 * │ 1. Twilio Webhook Received                              │
 * │    - From: whatsapp:+919628993700                      │
 * │    - Body: "Check this pothole"                         │
 * │    - MediaUrl0: https://media.twilio.com/.../image.jpg │
 * │    - Latitude: 28.6315 (if location shared)             │
 * │    - Longitude: 77.2167 (if location shared)            │
 * │                                                           │
 * │ 2. Citizen Lookup                                        │
 * │    - Normalize phone: 919628993700                      │
 * │    - Query: SELECT * FROM users WHERE phone LIKE ... │
 * │    - Return: citizen record or "not found" message      │
 * │                                                           │
 * │ 3. Flow State Management                                │
 * │    - Query: SELECT flow_state FROM whatsapp_sessions    │
 * │    - If null: First message (ask for image)             │
 * │    - If 'waiting_for_location': Got image (ask location) │
 * │    - If has location: Process report                    │
 * │                                                           │
 * │ 4. Image Download (if provided)                         │
 * │    - Fetch: GET MediaUrl with Twilio auth              │
 * │    - Convert: ArrayBuffer → Base64                      │
 * │    - Store: DATA URL in session (pending_media_url)     │
 * │                                                           │
 * │ 5. Issue Detection (Gemini Vision)                      │
 * │    - Input: Base64 image + citizen description          │
 * │    - Output: Issue type, Severity (1-10), AI description │
 * │    - Error handling: Generic fallback if API fails      │
 * │                                                           │
 * │ 6. Reverse Geocoding                                    │
 * │    - Input: Latitude, Longitude                         │
 * │    - API: OpenStreetMap Nominatim (free, no key needed) │
 * │    - Output: Full address, city, district, state        │
 * │    - Timeout: 5 seconds                                 │
 * │    - Error handling: Fallback to coordinates only       │
 * │                                                           │
 * │ 7. Department Assignment                                │
 * │    - Function: assignDepartment(issueType, ward)        │
 * │    - Input: Issue type from Gemini                      │
 * │    - Output: Department name (Public Works, etc.)       │
 * │                                                           │
 * │ 8. Database Insert                                       │
 * │    - Table: reports                                     │
 * │    - Fields: type, severity, lat, lng, location,        │
 * │             description, image_url, department, etc.    │
 * │    - Return: Generated report ID                        │
 * │                                                           │
 * │ 9. Confirmation Message                                 │
 * │    - Send: "Thanks! Report registered. ID: xxx"         │
 * │    - Via: Twilio WhatsApp API                           │
 * │                                                           │
 * │ 10. Session Cleanup                                     │
 * │     - Clear: whatsapp_sessions entry                    │
 * │     - Ready: For next report from citizen               │
 * └─────────────────────────────────────────────────────────┘
 *
 * DATABASE SCHEMA:
 * ================
 *
 * Table: whatsapp_sessions
 * ┌──────────────────┬──────────────────┬─────────────────┐
 * │ Column           │ Type             │ Purpose         │
 * ├──────────────────┼──────────────────┼─────────────────┤
 * │ citizen_id       │ UUID (PK)        │ Session owner   │
 * │ from_phone       │ TEXT (PK)        │ Unique identity │
 * │ pending_body     │ TEXT             │ Description     │
 * │ pending_address  │ TEXT             │ Address text    │
 * │ pending_lat      │ DOUBLE           │ Latitude        │
 * │ pending_lng      │ DOUBLE           │ Longitude       │
 * │ pending_media_url│ TEXT             │ Image data URL  │
 * │ flow_state       │ TEXT             │ 'waiting_*'     │
 * │ created_at       │ TIMESTAMPTZ      │ Session start   │
 * │ updated_at       │ TIMESTAMPTZ      │ Last activity   │
 * └──────────────────┴──────────────────┴─────────────────┘
 *
 * Table: reports
 * ┌──────────────────┬──────────────────┬─────────────────┐
 * │ id               │ UUID (PK)        │ Complaint ID    │
 * │ type             │ TEXT             │ Issue category  │
 * │ severity         │ INT (1-10)       │ Severity score  │
 * │ lat              │ DOUBLE           │ Latitude        │
 * │ lng              │ DOUBLE           │ Longitude       │
 * │ location         │ TEXT             │ Full address    │
 * │ description      │ TEXT             │ Citizen text    │
 * │ image_url        │ TEXT (BASE64)    │ Issue photo     │
 * │ department       │ TEXT             │ Assigned dept   │
 * │ citizen_id       │ UUID (FK)        │ Report creator  │
 * │ status           │ ENUM             │ 'reported'/'...'│
 * │ reported_at      │ TIMESTAMPTZ      │ Creation time   │
 * └──────────────────┴──────────────────┴─────────────────┘
 *
 * SUPPORTED COMMANDS (Future):
 * ============================
 *
 * Citizens can optionally send:
 * - "track 123abc" → Get report status
 * - "cancel" → Start over
 * - "help" → Show options
 *
 * LIMITATIONS & CONSIDERATIONS:
 * =============================
 *
 * 1. Twilio Sandbox Limitations:
 *    - Only pre-approved numbers can send messages
 *    - In production, need verified business account
 *    - Location sharing might vary by phone/WhatsApp version
 *
 * 2. OpenStreetMap Nominatim:
 *    - Rate limit: 1 request/second per IP
 *    - May not have latest addresses in rural areas
 *    - Falls back gracefully if geocoding fails
 *
 * 3. Image Handling:
 *    - Base64 encoding increases size ~33%
 *    - For storage optimization, use cloud storage later
 *    - Database can store up to ~10MB text field
 *
 * 4. Network Considerations:
 *    - Initial message exchange: ~500ms-2s
 *    - Image download/processing: ~3-5s
 *    - Reverse geocoding: ~2-3s (with timeout)
 *    - Total time: ~5-10 seconds per report
 */

// Example: How to test this via curl/postman
/*
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=Pothole%20near%20my%20home" \
  -d "NumMedia=0"

# Response: Ask for photo

---

# After citizen sends image (simulated):
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=" \
  -d "NumMedia=1" \
  -d "MediaUrl0=https://example.com/image.jpg"

# Response: Ask for location

---

# After citizen sends location:
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:%2B919628993700" \
  -d "Body=" \
  -d "Latitude=28.6315" \
  -d "Longitude=77.2167"

# Response: Report created confirmation with ID
*/
