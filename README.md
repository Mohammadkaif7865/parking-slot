# Smart Parking Map Booking

Next.js parking booking demo with PostgreSQL, uploaded map rendering, admin slot overlays, Socket.IO updates, level-wise parking maps, and OTP-based user login.

## Run

```powershell
npm.cmd install
npm.cmd run db:push
npm.cmd run db:seed
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Current Flow

1. User logs in at `/login` with mobile OTP.
2. In demo mode, OTP is shown on the UI.
3. User selects parking level, then sees only that level's map and slots.
4. User selects a slot, enters name, and books with the logged-in mobile number.
5. One mobile number can have only one active booking.

## Admin

Admin login is separate:

```text
/admin/login
```

Default local password is `admin123`. On Render, set:

```text
ADMIN_PASSWORD=your-secure-password
```

Admin can upload maps by parking level, add/edit slots, use level-based slot numbering like `L1P001`, and view booking name, phone, and timestamp.

## WhatsApp OTP Config

Demo mode:

```text
WHATSAPP_OTP_MODE=demo
```

Live mode:

```text
WHATSAPP_OTP_MODE=live
CHATBOX_PHONE_NUMBER_ID=your-phone-number-id
CHATBOX_WABA_API_KEY=your-waba-api-key
```

Production can also use these fallback env names if the provider dashboard labels are different: `WHATSAPP_PHONE_NUMBER_ID`, `PHONE_NUMBER_ID`, `CHATBOX_API_KEY`, `WHATSAPP_API_KEY`, and `WABA_API_KEY`.

Live mode sends OTP using the Chatbox API endpoint from the supplied docs.

## Notes

The local `.env` contains database credentials and must not be committed. Uploaded image maps are stored in PostgreSQL as data URLs for this demo so they survive Render redeploys.
