# Smart Parking Map Booking Demo

This is a Next.js demo that renders exported AutoCAD parking maps as responsive PNG images and adds clickable booking overlays on top. Location, map, slot, and booking data is now backed by PostgreSQL through Prisma.

The five exported PNG maps are stored here:

```text
public/maps/tisha-plaza/
```

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

## Demo Flow

1. Select `Tisha Plaza Parking`.
2. Select any of the five exported maps.
3. Click a colored parking overlay.
4. Enter demo allottee/mobile details.
5. Book or release the slot.

The booking state is saved in PostgreSQL. The current local `.env` contains the Supabase connection string and must not be committed.

## Login

Demo user:

```text
/login -> User
```

Demo admin:

```text
/login -> Admin
password: admin123
```

## Admin Panel

Open:

```text
http://127.0.0.1:3000/admin
```

Admin can:

- Import future exported map files
- Select location and map
- Add parking slots
- Edit slot number, zone, type, status
- Edit overlay coordinates as percentages
- Nudge overlays up/down/left/right
- Delete slots

Changes are saved in PostgreSQL and broadcast through Socket.IO so other open screens refresh.

## Production Direction

For the full application, keep this same idea and expand the database/API layer for:

- Locations
- Maps
- Slot overlay coordinates
- Slot status
- Bookings
- Admin/user records
- Overlay editor updates

## GitHub Notes

Do not push confidential client maps unless the client allows it. This repo only allows the first five exported demo PNG/PDF maps under `public/maps/tisha-plaza/`; other uploaded archives, PNG files, PDF files, and DWG source files stay ignored.
