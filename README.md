# DentaClub

A web app for running a small dental clinic. Front-desk staff use it to keep patient records, chart teeth, collect signed consent forms and manage the day's appointments.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, lucide-react icons |
| Signatures | react-signature-canvas |
| Backend | Node.js, Express 5, TypeScript, zod (request validation) |
| Database | PostgreSQL with Prisma ORM 7 |
| Documents | pdfmake (generates the signed consent PDFs) |
| Testing | Vitest |

```
dentaclub/
├── frontend/   Next.js app (port 3000)
└── backend/    Express REST API + Prisma schema (port 4000)
```

## Features

### Sign-in
- The app opens on a sign-in page, with one account: `admin`. The API refuses every request without a valid sign-in, so patient data can't be read by going around the page.
- A sign-in lasts 12 hours, or until **Sign out** (bottom of the sidebar).
- Five wrong passwords in a row pause sign-in for a minute.

### Alphabetical patient directory
- Patients grouped A–Z by last name, with a letter bar that jumps to each section. Letters with no patients are greyed out.
- Accented surnames (e.g. "Ñañez") are filed under their base letter.
- Filter by name or phone, plus a search box in the header that suggests matches as you type and supports keyboard navigation.
- Add and edit patients. Under-18 patients are labelled "Minor".

### Patient overview and medical history
- Contact details, birthday, sex, civil status, occupation and who referred the patient.
- The medical history from the clinic's paper dental record: general health, past conditions (rheumatic fever, heart condition, diabetes and so on), allergies, medication, physician care, previous extraction, and questions for women.
- Each question is Yes, No or "Not recorded", so a skipped question is never mistaken for "No". Answers worth the dentist's attention are highlighted.

### SVG dental chart
- Interactive tooth chart using FDI numbering, with permanent, mixed and deciduous views.
- Click a tooth to record a finding from the Philippine Dental Association legend (caries, fillings, crowns, missing teeth, and so on) on one or more surfaces. You can also type surface codes such as "MOD".
- A tooth can hold several findings at once, for example caries on one surface and a filling on another.
- The chart keeps a full history. Findings are never edited or deleted. A mistake is marked "entered in error" with a reason, and stays visible in the history.
- View the chart as it was on any past date.

### Consent form with e-signature
- One consent form for the whole clinic. Its wording is a plain text file, `backend/consent-form.txt`.
- The patient's **Consent** tab shows the form with a signature space underneath. The patient signs on the clinic's tablet or computer and presses **Confirm and save**.
- Signing saves a PDF of the form and the signature, which opens from the same tab.
- For a patient under 18, a parent or guardian signs, and their name and relationship are recorded.
- **Sign again** records a new signing. Earlier ones stay under "Previous consents", so nothing signed is ever lost.
- Each signed copy keeps the wording that was signed, even if the form text is edited later.

### Appointment queue and schedule
- **Queue:** today's patients in one column per chair, with counts for still to come, waiting room, in the chair and done. Tap a patient to move them along: Confirm → Check In → Seat → Complete. Cancelling (with a reason) and marking a no-show are also available. The board refreshes every 30 seconds.
- **Schedule:** week and day calendar in Philippine time. Drag on the calendar to start a booking. Overlapping appointments are shown side by side.
- **Booking:** choose an appointment type (the length fills in automatically), patient, dentist and chair, then pick from the dentist's free times.
- **Double-booking protection:** an appointment can't be confirmed if the dentist or chair is already taken. The message names the clashing time.
- Each patient has an Appointments tab listing upcoming and past visits.

## Setup

### Requirements
- Node.js 20 or newer
- PostgreSQL 14 or newer, running locally or in the cloud
- A database tool such as DBeaver or pgAdmin (optional, for viewing data)

### 1. Install dependencies
From the project folder:
```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Create the database
Create an empty PostgreSQL database, for example `dentaclub`, using DBeaver, pgAdmin or `createdb dentaclub`.

### 3. Configure the backend
Create `backend/.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/dentaclub"

# Signs the sign-in cookie. Generate your own (see below) and keep it secret.
APP_KEY="base64:REPLACE_ME"

# The frontend's address, so the browser is allowed to call the API
FRONTEND_URL="http://localhost:3000"
```
Generate an `APP_KEY` with:
```bash
node -e "console.log('base64:' + require('crypto').randomBytes(32).toString('base64'))"
```
If your password contains special characters (`@ # / :`), URL-encode them in `DATABASE_URL`.

### 4. Create the tables and starter data
```bash
cd backend
npx prisma migrate deploy   # creates the tables
npx prisma generate         # generates the database client
npm run db:seed             # appointment types, a clinic, 2 chairs, 2 dentists
cd ..
```

### 5. Set the admin password
The app opens on a sign-in page. There is one account, `admin`. Set its password (at least 8 characters) with:
```bash
npm run set-password --prefix backend
```
Run the same command again to change it. Changing it signs out every device.

### 6. Write your consent form
Open `backend/consent-form.txt` and replace the starter text with your clinic's consent wording. Leave a blank line between paragraphs, and start a line with `# ` to make it a heading. Until the starter text is replaced, the Consent tab shows a warning.

### 7. (Optional) Point the frontend at a different API
The frontend calls `http://localhost:4000` by default. To change it, create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

## Running

Start the frontend and backend together from the project folder:
```bash
npm run dev
```
- App: http://localhost:3000
- API: http://localhost:4000 (health check: http://localhost:4000/api/health)

Stop both with `Ctrl + C`.

To run one part on its own:
```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

### Tests and checks
```bash
npm test --prefix frontend          # unit tests
npm run typecheck --prefix backend  # backend type check
```

## Quick tour
1. **Patients → New Patient** to add someone, then open their profile.
2. **Chart** tab: click a tooth, pick a finding and surfaces, then press **Chart**.
3. **Consent** tab: read the form, sign in the box and press **Confirm and save**. **View PDF** opens the signed copy.
4. **Schedule → New Appointment**: book a visit, then open it and press **Confirm**.
5. **Queue**: book an appointment for today and move the patient through the day.
