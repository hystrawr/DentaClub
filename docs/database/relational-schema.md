# DentaClub: Relational Schema

PostgreSQL database `dentaclub`. The schema is defined in [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) and created by the migrations in [`backend/prisma/migrations/`](../../backend/prisma/migrations/). This document was checked against the live database: 16 tables, plus Prisma's own `_prisma_migrations` bookkeeping table, which is not part of the design.

**Notation**
- <ins>underlined</ins> = primary key
- *italic* = foreign key, with the table it references after →
- `?` after a type = the attribute may be NULL (otherwise NOT NULL)
- Every `id` of type `text` is a generated CUID string. `odontogram_events.id` is an auto-incrementing `bigint`.

## Relations

### Patients and clinical records

**patients**(<ins>id</ins>, first_name, last_name, middle_name, suffix, date_of_birth, sex, civil_status, mobile, home_office_phone, email, address, occupation, religion, nationality, insurance_carrier, insurance_effective, referred_by, chief_complaint, guardian_name, guardian_occupation, guardian_contact, notes, is_active, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| first_name, last_name | text | |
| middle_name | text? | |
| suffix | varchar(10)? | Jr., Sr., II, III, IV |
| date_of_birth | date | |
| sex | Sex | enum: male, female, other |
| civil_status | text? | single, married, widowed, separated (CHECK) |
| mobile | varchar(20)? | |
| home_office_phone | varchar(30)? | |
| email, address, occupation, religion, nationality | text? | |
| insurance_carrier, insurance_effective | text? | |
| referred_by, chief_complaint | text? | |
| guardian_name, guardian_occupation | text? | for minors |
| guardian_contact | varchar(30)? | |
| notes | text? | |
| is_active | boolean | default true; false = removed from the directory (soft delete), restorable by an admin |
| created_at, updated_at | timestamptz | |

Index: (last_name, first_name), for the A–Z patient directory. Patients are never deleted: "Delete" sets `is_active` to false, so their chart, consents and appointments stay on file.

---

**medical_histories**(<ins>id</ins>, *patient_id* → patients, in_good_health, under_physician_care, physician_care_reason, serious_illness, serious_illness_detail, hospitalized, hospitalized_detail, taking_medicine, medication_detail, uses_tobacco, uses_drugs, drugs_detail, has_allergies, allergic_to_local_anesthetic, allergic_to_penicillin, allergic_to_sulfa, allergic_to_aspirin, allergic_to_latex, other_allergies, bleeder, pregnant, nursing, birth_control_pills, on_menstruation, blood_type, bp_systolic, bp_diastolic, other_conditions, previous_dentist, last_dental_visit, dental_anxiety, flossing_frequency, previous_extraction, physician_name, physician_specialty, physician_address, physician_phone, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| patient_id | text | FK → patients.id, **UNIQUE** (one history per patient) |
| the 17 yes/no answers, from in_good_health to on_menstruation in the list above (except has_allergies) | boolean? | NULL = not asked yet, which is different from a recorded "No" |
| has_allergies | boolean? | derived by the API on every save: true when any allergic_to_* is true or other_allergies is filled in |
| physician_care_reason, serious_illness_detail, hospitalized_detail, medication_detail, drugs_detail, other_allergies | text? | detail for a "Yes" answer |
| blood_type | varchar(3)? | A+, A-, B+, B-, AB+, AB-, O+, O- (CHECK) |
| bp_systolic, bp_diastolic | smallint? | mmHg, 40–300 (CHECK) |
| other_conditions | text? | anything not on the Section 13 checklist |
| previous_dentist, flossing_frequency, previous_extraction | text? | dental history |
| last_dental_visit | varchar(7)? | `YYYY-MM` |
| dental_anxiety | varchar(10)? | low, moderate, severe (CHECK) |
| physician_name, physician_specialty, physician_address | text? | |
| physician_phone | varchar(30)? | |
| created_at, updated_at | timestamptz | |

The Section 13 checklist ("Do you have or have you had any of the following?") is not stored here: see the next two relations.

---

**medical_conditions**(<ins>code</ins>, label)

| Attribute | Type | Notes |
|---|---|---|
| code | varchar(30) | PK, e.g. `high_blood_pressure` |
| label | text | as printed on the form, e.g. "High Blood Pressure" |

The 35 conditions of the checklist, filled by migration 18. A lookup table: the app reads it, never writes it.

---

**medical_history_conditions**(<ins>*medical_history_id*</ins> → medical_histories, <ins>*condition_code*</ins> → medical_conditions)

| Attribute | Type | Notes |
|---|---|---|
| medical_history_id | text | PK, FK → medical_histories.id |
| condition_code | varchar(30) | PK, FK → medical_conditions.code |

One row per ticked box. This resolves the many-to-many between histories and conditions. A saved checklist is an answered one, so a condition with no row is a recorded "No".

---

**treatment_records**(<ins>id</ins>, *patient_id* → patients, position, visit_date, teeth, procedure, doctor, amount_charged, amount_paid, next_appointment, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| patient_id | text | FK → patients.id |
| position | smallint | row order on the sheet |
| visit_date, next_appointment | date? | |
| teeth | varchar(50)? | tooth numbers, e.g. "16, 17" |
| procedure, doctor | text? | |
| amount_charged, amount_paid | decimal(10,2)? | pesos, ≥ 0 (CHECK) |
| created_at, updated_at | timestamptz | |

Index: (patient_id, position). The balance is **not stored**: it is the running total of charged minus paid, computed from the rows.

---

**odontogram_events**(<ins>id</ins>, *patient_id* → patients, *replaces_event_id* → odontogram_events, tooth_number, surfaces, event_type, condition_code, notes, supersession_type, supersession_reason, observed_at, created_at)

| Attribute | Type | Notes |
|---|---|---|
| id | bigint | PK, auto-increment |
| patient_id | text | FK → patients.id |
| replaces_event_id | bigint? | FK → odontogram_events.id (self-reference: the older event this one corrects) |
| tooth_number | smallint | FDI tooth number: 11–48 permanent, 51–85 baby teeth (CHECK) |
| surfaces | jsonb? | e.g. `["M","O","D"]`; NULL = whole tooth |
| event_type | text | condition, procedure, treatment (CHECK) |
| condition_code | text? | finding from the dental chart legend |
| notes | text? | |
| supersession_type | varchar(20)? | amendment, correction, entered-in-error |
| supersession_reason | text? | |
| observed_at | timestamptz | when the finding was true |
| created_at | timestamptz | when it was recorded |

Indexes: (patient_id, tooth_number), (patient_id, observed_at). The table is **append-only**: rows are never updated or deleted, and a mistake is corrected by a new row that points at the old one.

---

**documents**(<ins>id</ins>, *patient_id* → patients, type, title, file_data, mime_type, file_name, size_bytes, immutable_flag, created_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| patient_id | text | FK → patients.id |
| type | DocumentType | enum: signed_consent, other |
| title | text | |
| file_data | bytea? | the file itself (e.g. the signed consent PDF) |
| mime_type, file_name | text? | |
| size_bytes | integer? | |
| immutable_flag | boolean | default false; true for signed consents |
| created_at | timestamptz | |

Index: (patient_id). Documents are written once and never edited, so there is no `updated_at`. The trigger `documents_immutable` refuses any UPDATE or DELETE of a row whose `immutable_flag` is true.

---

**consents**(<ins>id</ins>, *patient_id* → patients, *document_id* → documents, form_text, signer_name, signer_relationship, signature_image, signed_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| patient_id | text | FK → patients.id |
| document_id | text | FK → documents.id, **UNIQUE** (each signing has exactly one PDF) |
| form_text | text | the consent wording exactly as signed |
| signer_name | text | the patient, or the guardian of a minor |
| signer_relationship | text? | set when signed on the patient's behalf, e.g. "Mother" |
| signature_image | text | PNG data URL from the signature pad |
| signed_at | timestamptz | |

Index: (patient_id, signed_at). The newest row is the patient's current consent.

### Scheduling

**locations**(<ins>id</ins>, name, address, city, phone, is_active, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| name | text | |
| address, city, phone | text? | |
| is_active | boolean | default true; deactivated, never deleted |
| created_at, updated_at | timestamptz | |

---

**operatories**(<ins>id</ins>, *location_id* → locations, name, color, sort_order, is_active, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| location_id | text | FK → locations.id |
| name | text | e.g. "Chair 1" |
| color | varchar(7)? | hex colour |
| sort_order | smallint | default 0; left-to-right order on the queue board |
| is_active | boolean | default true |
| created_at, updated_at | timestamptz | |

Index: (location_id).

---

**provider_profiles**(<ins>id</ins>, name, prc_number, color_hex, is_active, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| name | text | the dentist's name |
| prc_number | text? | PRC licence number |
| color_hex | varchar(7) | default `#3B82F6` |
| is_active | boolean | default true |
| created_at, updated_at | timestamptz | |

---

**provider_specializations**(<ins>*provider_profile_id*</ins> → provider_profiles, <ins>name</ins>)

| Attribute | Type | Notes |
|---|---|---|
| provider_profile_id | text | PK, FK → provider_profiles.id |
| name | text | PK, e.g. "Orthodontics" |

One row per specialization of a dentist (a multivalued attribute, moved out of `provider_profiles` so every column holds one value). The composite key stops the same specialization being listed twice.

---

**provider_availabilities**(<ins>id</ins>, *provider_profile_id* → provider_profiles, *location_id* → locations, day_of_week, start_time, end_time, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| provider_profile_id | text | FK → provider_profiles.id |
| location_id | text | FK → locations.id |
| day_of_week | smallint | 0 = Sunday … 6 = Saturday |
| start_time, end_time | time | Manila wall-clock time |
| created_at, updated_at | timestamptz | |

Index: (provider_profile_id, day_of_week). One row is one weekly working window.

---

**appointment_types**(<ins>id</ins>, name, duration_minutes, color_hex, is_block_time, price, is_active, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| name | text | e.g. "Extraction". Also the clinic's list of services |
| duration_minutes | smallint | default 30; > 0 (CHECK) |
| color_hex | varchar(7) | default `#6B7280` |
| is_block_time | boolean | default false; true for lunch or meetings (no patient) |
| price | decimal(10,2)? | pesos, ≥ 0 (CHECK); NULL = no set price |
| is_active | boolean | default true |
| created_at, updated_at | timestamptz | |

---

**appointments**(<ins>id</ins>, *patient_id* → patients, *provider_profile_id* → provider_profiles, *appointment_type_id* → appointment_types, *operatory_id* → operatories, status, scheduled_start, scheduled_end, actual_start, actual_end, cancellation_reason, notes, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| patient_id | text? | FK → patients.id; NULL only for block time |
| provider_profile_id | text | FK → provider_profiles.id |
| appointment_type_id | text? | FK → appointment_types.id |
| operatory_id | text? | FK → operatories.id; the clinic location is read through the chair |
| status | AppointmentStatus | enum, default `scheduled` (see below) |
| scheduled_start, scheduled_end | timestamptz | |
| actual_start | timestamptz? | set when the patient is seated |
| actual_end | timestamptz? | set when completed |
| cancellation_reason | text? | |
| notes | text? | |
| created_at, updated_at | timestamptz | |

Indexes: (scheduled_start), (operatory_id, scheduled_start), (provider_profile_id, scheduled_start), (patient_id).

### Sign-in

**users**(<ins>id</ins>, username, role, password_hash, created_at, updated_at)

| Attribute | Type | Notes |
|---|---|---|
| id | text | PK |
| username | text | **UNIQUE** |
| role | UserRole | enum: admin, staff; default `staff` |
| password_hash | text | salted scrypt hash; the password itself is never stored |
| created_at, updated_at | timestamptz | |

`users` has no relationships to the clinical tables. It controls who can sign in and what they may do: admins can change services, dentists and chairs, while staff run the front desk. The API enforces this on every request (`requireAdmin` answers staff with 403 Forbidden).

## Foreign keys and delete rules

| Foreign key | References | On delete | Cardinality |
|---|---|---|---|
| medical_histories.patient_id | patients.id | CASCADE | patient 1 : 0..1 history |
| medical_history_conditions.medical_history_id | medical_histories.id | CASCADE | history 1 : 0..* ticked conditions |
| medical_history_conditions.condition_code | medical_conditions.code | RESTRICT | condition 1 : 0..* ticks |
| provider_specializations.provider_profile_id | provider_profiles.id | CASCADE | dentist 1 : 0..* specializations |
| treatment_records.patient_id | patients.id | CASCADE | patient 1 : 0..* rows |
| odontogram_events.patient_id | patients.id | CASCADE | patient 1 : 0..* events |
| odontogram_events.replaces_event_id | odontogram_events.id | RESTRICT | event 0..1 : 0..* corrections |
| documents.patient_id | patients.id | RESTRICT | patient 1 : 0..* documents |
| consents.patient_id | patients.id | RESTRICT | patient 1 : 0..* consents |
| consents.document_id | documents.id | NO ACTION | document 1 : 0..1 consent |
| appointments.patient_id | patients.id | RESTRICT | patient 0..1 : 0..* appointments |
| appointments.provider_profile_id | provider_profiles.id | RESTRICT | dentist 1 : 0..* appointments |
| appointments.appointment_type_id | appointment_types.id | SET NULL | type 0..1 : 0..* appointments |
| appointments.operatory_id | operatories.id | SET NULL | chair 0..1 : 0..* appointments |
| operatories.location_id | locations.id | CASCADE | location 1 : 0..* chairs |
| provider_availabilities.provider_profile_id | provider_profiles.id | CASCADE | dentist 1 : 0..* windows |
| provider_availabilities.location_id | locations.id | CASCADE | location 1 : 0..* windows |

All foreign keys are `ON UPDATE CASCADE`. Patients are deactivated (`is_active = false`) rather than deleted, and RESTRICT means the database itself refuses to delete a patient who has appointments, consents or documents, or a dentist who has appointments. CASCADE is kept only for rows that belong entirely to their parent: a patient's medical history (and its ticked conditions), treatment sheet and chart; a location's chairs; a dentist's weekly windows and specializations. A condition still ticked on any history cannot be removed from `medical_conditions` (RESTRICT).

## CHECK constraints

| Table | Constraint | Rule |
|---|---|---|
| appointments | appointments_end_after_start | scheduled_end > scheduled_start |
| provider_availabilities | provider_availabilities_end_after_start | end_time > start_time |
| provider_availabilities | provider_availabilities_day_of_week_range | day_of_week BETWEEN 0 AND 6 |
| odontogram_events | odontogram_supersession_paired | replaces_event_id and supersession_type are both NULL or both set |
| odontogram_events | odontogram_supersession_type_known | supersession_type IN ('amendment', 'correction', 'entered-in-error') |
| odontogram_events | odontogram_retraction_asserts_nothing | an entered-in-error event has no condition_code |
| odontogram_events | odontogram_retraction_states_reason | an entered-in-error event has a supersession_reason |
| odontogram_events | odontogram_no_self_supersession | an event cannot replace itself |
| odontogram_events | odontogram_tooth_number_fdi | tooth_number is a valid FDI tooth: 11–18, 21–28, 31–38, 41–48, or 51–55 … 81–85 |
| odontogram_events | odontogram_event_type_known | event_type IN ('condition', 'procedure', 'treatment') |
| patients | patients_civil_status_known | civil_status IN ('single', 'married', 'widowed', 'separated') |
| medical_histories | medical_histories_blood_type_known | blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') |
| medical_histories | medical_histories_dental_anxiety_known | dental_anxiety IN ('low', 'moderate', 'severe') |
| medical_histories | medical_histories_bp_systolic_range | bp_systolic BETWEEN 40 AND 300 |
| medical_histories | medical_histories_bp_diastolic_range | bp_diastolic BETWEEN 40 AND 300 |
| treatment_records | treatment_records_amount_charged_not_negative | amount_charged >= 0 |
| treatment_records | treatment_records_amount_paid_not_negative | amount_paid >= 0 |
| appointment_types | appointment_types_price_not_negative | price >= 0 |
| appointment_types | appointment_types_duration_positive | duration_minutes > 0 |

A NULL passes a CHECK, so every nullable column above can still be left blank ("not answered yet").

## Triggers

| Table | Trigger | Rule |
|---|---|---|
| documents | documents_immutable | BEFORE UPDATE OR DELETE: refuses the change when `immutable_flag` is true, so a signed consent PDF can never be altered or removed |

## Enumerated types

| Type | Values |
|---|---|
| Sex | male, female, other |
| AppointmentStatus | scheduled, confirmed, arrived, in_chair, completed, cancelled, no_show |
| DocumentType | signed_consent, other |
| UserRole | admin, staff |

Allowed status changes, enforced by the API: scheduled → confirmed → arrived → in_chair → completed. `cancelled` and `no_show` are final. Confirming an appointment checks that the dentist and the chair are free at that time.

## Deliberate design choices

- **Copied values (snapshots).** `consents.form_text` stores the consent wording as it was signed, and `treatment_records.amount_charged` stores the price at the time of the visit. Both are copied on purpose: editing the consent form or changing a service price must never change what a patient already signed or was charged.
- **History is kept, not overwritten.** Dental chart findings are append-only (`odontogram_events`), consents gain a new row for each signing, and patients, locations, chairs, dentists and appointment types are deactivated (`is_active`) rather than deleted.
- **One-to-one split.** The medical history is a separate table from `patients` (1 : 0..1, enforced by the UNIQUE `patient_id`), because it is a separate form, filled in and saved separately, and empty for some patients.
- **Derived data is not stored.** A patient's age and the treatment sheet's running balance are computed when read, and an appointment's location is read through its chair (`operatories.location_id`) rather than copied onto the appointment. The one exception is `medical_histories.has_allergies`, kept as a quick flag for the allergy badge; the API recomputes it from the allergy answers on every save and never takes it from the form, so it cannot disagree with them.
- **No multivalued columns.** The Section 13 checklist and a dentist's specializations are lists, so each lives in its own table with one row per item (`medical_history_conditions`, `provider_specializations`) instead of an array or a column per item. Adding a condition to the form is an INSERT into `medical_conditions`, not a schema change.
