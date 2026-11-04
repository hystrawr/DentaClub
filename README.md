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

In `backend/src`, a route file reads the request and sends the response. Simple saving and loading is done right in the route. A feature with rules of its own (patients, appointments, consent, the dental chart, medical history) keeps those rules in `services/`. `lib/` holds general helpers that any feature can use: dates, errors and sign-in.

## Features

### Sign-in and roles
- The app opens on a sign-in page. The API refuses every request without a valid sign-in, so patient data can't be read by going around the page.
- There are two kinds of account:
  - **Admin:** everything, including **Services**, where services and prices are added and edited.
  - **Staff:** the front desk only: **Dashboard**, **Appointments** and **Patients** (with their chart, consent and treatment sheet).
- The server checks the role on every request. A staff account that tries to change services, dentists or chairs gets **403 Forbidden**, even from outside the app.
- The header shows who is signed in and their role.
- A sign-in lasts 12 hours, or until **Sign out** (top right).
- Five wrong passwords in a row pause sign-in for a minute.

### Patient list
- A table of patients with their last visit, next appointment and that appointment's dentist. Sort by last name, first name, last visit or appointment.
- Search by name or phone. A full name works in any order ("Juan Dela Cruz" or "Cruz Juan"): every word must match part of the first, middle or last name, the suffix, or the phone number.
- **Filter:** current or removed patients, with or without an upcoming appointment, and by dentist.
- **New Patient** opens a form in four steps (Patient Information, Dental History, Medical History & Physician, Conditions) with **Back** and **Next**. Only the first step is required. A patient with the same first, middle and last name already on file is caught on that step.
- Under-18 patients are labelled "Minor", and the parent or guardian's details open on their record. A date of birth in the future is refused.
- **Delete** takes a patient off the list but keeps their chart, consents and appointments. It is refused while they still have an upcoming appointment. An admin can bring them back with **Restore patient** from "Removed patients".

### Patient record
- Each patient's record has five tabs: **Patient Information Record**, **Informed Consent**, **Dental Record Chart**, **Treatment Record** and **Appointments**.
- The Patient Information Record follows the clinic's paper form: personal and contact details, dental history, medical history and physician, and a checklist of conditions.
- The medical history covers general health, medication, tobacco and drug use, allergies (local anesthetic, penicillin, sulfa, aspirin, latex), questions for women, and conditions such as high blood pressure, heart disease, diabetes and asthma. A question left unanswered stays blank, so it is never mistaken for "No".
- **Print / Save as PDF** prints the whole record, every tab, not only the open one.

### SVG dental chart
- Interactive tooth chart with permanent, mixed and deciduous views, numbered in FDI or Universal notation.
- Click a tooth to record a finding from the Philippine Dental Association legend (caries, fillings, crowns, missing teeth, and so on) on one or more surfaces. You can also type surface codes such as "MOD".
- A tooth can hold several findings at once, for example caries on one surface and a filling on another.
- What a tooth is limits what can be charted on it:
  - A missing or extracted tooth only takes an implant, a pontic or a removable denture.
  - An implant only takes a jacket crown or an abutment.
  - A pontic or a removable denture takes nothing more.
- A whole-tooth finding laid on top keeps what is underneath on the chart. A crowned implant still shows the implant, and a pontic still shows that the natural tooth is missing. Pontic and abutment show their legend code in the tooth box.
- If saving a finding fails, the form keeps what was entered so it can be tried again.
- The chart keeps a full history, listed under **Chart History**. Findings are never edited or deleted. A mistake is corrected or marked "entered in error" with a reason, and stays visible in the history.
- A date slider shows the chart as it was on any past date.

### Treatment record
- A spreadsheet of the patient's procedures: date, teeth, procedure, doctor, amount charged, amount paid, balance and next appointment. Every cell is editable, and **+ Add row** adds one.
- Enter and the ↑ ↓ keys move between rows, and Tab moves to the next cell. The balance carries down from the row above, so it is worked out, never typed.
- Doctor suggests the clinic's dentists. Procedure suggests services, and picking one fills an empty Amount Charged with its price (see Services and prices).

### Consent form with e-signature
- One consent form for the whole clinic. Its wording is a plain text file, `backend/consent-form.txt`.
- The patient's **Informed Consent** tab shows the form with a signature space underneath. The patient signs on the clinic's tablet or computer and presses **Confirm and save**. **Clear signature** starts the signature over.
- Signing saves a PDF of the form and the signature. **View PDF** opens it from the same tab.
- For a patient under 18, a parent or guardian signs, and their name and relationship are recorded.
- **Sign again** records a new signing. Earlier ones stay under "Previous consents", so nothing signed is ever lost.
- Each signed copy keeps the wording that was signed, even if the form text is edited later.

### Appointments and schedule
- **Dashboard:** today's patients, recent visits, a month calendar, and the chosen day's appointments. **View details** on an appointment opens its status buttons.
- **Status:** open an appointment to move it along: Confirm → Check In → Seat Patient → Mark Complete. Rescheduling, cancelling (with a reason) and marking a no-show are also available.
- **Appointments page:** day, week and month calendar in Philippine time. Overlapping appointments are shown side by side. Filter by dentist and by status. Searching a patient lists their appointments, and picking one jumps the calendar to it.
- **Booking:** choose an appointment type (the length fills in automatically), patient, dentist and (optionally) chair, then pick from the dentist's free times.
- **Lunch break:** 12–1 PM is blocked off for the whole clinic. Free times never include it, and booking or moving an appointment into it is refused with "12–1 PM is the lunch break." Appointments already booked over lunch are left as they are. The hours are set in `LUNCH_START`/`LUNCH_END` in `backend/src/services/scheduling/appointments.ts` and `frontend/src/lib/schedule/lunch.ts`; change both together.
- **Double-booking protection:** an appointment can't be booked, moved or confirmed if the dentist, chair or patient is already taken. The message names the clashing time.
- Each patient has an Appointments tab listing upcoming and past visits.

### Services and prices
- **Services** lists the clinic's services with their length, calendar colour and price. Services are the same list that booking calls appointment types.
- Add or edit a service, and deactivate one you no longer offer. Services are never deleted, because past appointments still point at them.
- A service marked **Block time** can be booked without a patient, to block off the calendar for a meeting. The starter data includes one called "Lunch Break", but the daily 12–1 PM lunch is already blocked without it, so it can be deactivated.
- On a patient's **Treatment Record**, the Procedure cell suggests services. Picking one fills an empty Amount Charged with its price, which can still be changed for a discount.
- The price is copied into the treatment row, so changing a price later never changes what a patient was already charged.

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

### 5. Create the accounts
Accounts are made on the clinic computer with:
```bash
npm run set-password --prefix backend
```
It asks for:
- a **username** (press Enter for `admin`),
- a **role**, `admin` or `staff`,
- a **password** (at least 8 characters), typed twice.

Run it once for the admin, then once for each staff member. Running it again for an existing username changes that account's password or role. Changing a password signs out every device using the old one.

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
npm run lint --prefix frontend      # lint
npm run typecheck --prefix backend  # backend type check
```

## Quick tour
1. **Patients → New Patient**: fill in the steps and press **Create Patient**, then open their record.
2. **Dental Record Chart** tab: click a tooth, pick a finding and surfaces, then press **Chart**.
3. **Informed Consent** tab: read the form, sign in the box and press **Confirm and save**. **View PDF** opens the signed copy.
4. **Appointments → New Appointment**: book a visit, then open it and press **Confirm**.
5. **Dashboard**: see today's appointments and move each patient through the day (Check In → Seat Patient → Mark Complete).
