# NXC Management Portal

The home base for NUST Excursion Club attendance, recruitment, and roster
and access management, backed entirely by a Google Sheet. There is no
separate database, the sheet is the database. The app reads from it on
every page load and writes straight back to it, so editing a cell
directly in Sheets and using the app are the same source of truth. That
is deliberate: the app never gains any capability the sheet does not have
too, so it can never lock you out of your own data. Sheets is always
there as the safety net underneath it.

Stack: Next.js 14 (App Router) on Vercel, Google Sheets API, no external
database, no charting, PDF, or QR libraries, see section 7 for why.

## 1. How it fits together

Login tab decides who can sign in, their role (admin, manager, or member,
see section 9), and portfolio. Manageable in the app at Roster then
Logins (admin only), or by hand.

Roster tab is your member list. Manageable in the app at Roster (manager
or admin), or by hand, or through bulk CSV import, see section 5.

Attendance tab holds one row per person per meeting date. Managers and
admins mark it manually, with a one click mark everyone Present, Absent,
or Leave shortcut. Members mark only themselves, by scanning a meeting's
QR check in code, see section 5.

Applicants tab is your recruitment pipeline. Any column beyond the core
ones (interview questions, skill ratings, whatever) shows up
automatically on the applicant page, no code changes needed to add a
question. Managers and admins can view every portfolio at once, or one at
a time.

Reviews tab holds one row per review. An applicant can have several.

Status History tab is an audit trail of who moved an applicant from one
status to another, and when. See section 2 to add it.

The app never caches sheet data for more than 15 seconds, and any write
invalidates that cache immediately, so multiple people can use it (or
edit the sheet directly) without anything going stale for more than a
moment.

## 2. Set up the Google side

1. Go to Google Cloud Console, create a project or reuse one.
2. APIs and Services, then Library, then enable the Google Sheets API.
3. APIs and Services, then Credentials, then Create Credentials, then
   Service account. Give it any name, no roles needed.
4. Open the service account, then Keys, then Add Key, then Create new
   key, then JSON. This downloads a JSON file, keep it private, never
   commit it.
5. From that JSON file you need two values: client_email becomes
   GOOGLE_SERVICE_ACCOUNT_EMAIL, and private_key becomes
   GOOGLE_PRIVATE_KEY.

### Create the sheet

Create a fresh Google Sheet (do not reuse a publicly shared one, see the
security notes at the bottom) with these tabs and exact header rows.

Roster tab headers: Wing, Portfolio, Designation, Full Name, Gender,
Contact No., Email Address, CMS ID, Batch, Department, Residential
Status, Hostel.

You can add and edit rows here from the app (Roster page, manager or
admin) instead of by hand, the sheet stays exactly as readable and
editable as before either way. Portfolio names are matched case
insensitively everywhere in the app (see section 7), so Logistics and
logistics are always treated as the same portfolio even if they end up
spelled differently somewhere in the sheet.

Login tab headers: Username, Password, Full Name, CMS ID, Portfolio,
Role.

Password holds a bcrypt hash, never plain text. If you add a login from
the Roster then Logins page, the app hashes it for you automatically. If
you are adding the very first login by hand, before anyone can sign in to
use that page, generate a hash with the script in section 3 below. Role
is one of admin, manager, or member, see section 9 for exactly what each
can do.

Attendance tab, the app manages this one, just create the header row:
Date, Portfolio, CMS ID, Full Name, Designation, Status, Marked By,
Timestamp.

Marked By distinguishes a manual entry (the marker's name) from a QR self
check in (the person's name followed by self, QR), useful for spotting
patterns on the Dashboard's data quality section, since it is a visible
signal rather than a hidden one.

Applicants tab headers: CMS ID, Full Name, Contact No., Email Address,
Portfolio, 1st Preference, 2nd Preference, Batch, Department, Status.

Add as many extra columns as you want after Status, for example why do
you want to join, or Google Sheets proficiency out of ten. They will
appear automatically on each applicant's page.

Reviews tab, the app manages this one, just create the header row: CMS
ID, Reviewer, Recommendation, Review Text, Timestamp.

Status History tab, the app manages this one, just create the header
row: CMS ID, From Status, To Status, Changed By, Timestamp.

This tab is optional in the sense that nothing breaks if you skip it, the
applicant page just shows an empty history and status changes stop being
logged. Add it whenever you want the audit trail, the app picks it up
immediately, no redeploy needed.

Then share the whole sheet with the service account's client_email as
Editor.

Copy the sheet's ID out of its URL, the part between d slash and slash
edit.

## 3. Local setup

Run npm install, then copy .env.example to .env.local.

Fill in .env.local: GOOGLE_SHEET_ID from the URL above,
GOOGLE_SERVICE_ACCOUNT_EMAIL from the JSON key's client_email,
GOOGLE_PRIVATE_KEY from the JSON key's private_key (quotes and all, keep
the literal backslash n sequences as is), and SESSION_SECRET, any long
random string works, for example the output of openssl rand base64 32.
This same secret also signs QR check in codes, see section 5.

Add your very first login by hashing a password (after this one exists,
every login afterward, including future managers and admins, can be
added from Roster then Logins in the app instead). Run npm run
hash-password with your password as the argument. Paste the output into
the Password column of the Login tab, alongside a Username, Full Name,
CMS ID, Portfolio, and Role of admin.

Run npm run dev, then visit localhost port 3000 and sign in.

## 4. Deploy to Vercel

Push this project to a GitHub repo. On vercel.com, Add New, then Project,
then import the repo. In Environment Variables, add the same four
variables from .env.local. For GOOGLE_PRIVATE_KEY, paste it exactly as it
is in the JSON file, Vercel's environment variable UI handles the escaped
newlines correctly, do not manually convert them to real newlines. Then
deploy.

Every teammate just needs the Vercel URL, a username, and a password, no
separate accounts or Google sign in needed on their end.

## 5. Features

Roster page, manager or admin. Add and edit roster members from the app.
CMS ID cannot be edited once a member is added, it is the key that
Attendance, Applicants, and Login rows use to reference that person, so
changing it in place would silently orphan those links. Fix a wrong CMS
ID directly in the sheet. There is no delete button, on purpose, for the
same reason the sheet is the safety net: removing someone is a real,
sometimes hard to undo action. Removing a roster row is still a direct
Sheets edit, the app adds and edits, the sheet stays the place for
anything destructive. Portfolio is a dropdown, not free text, pick an
existing portfolio, or add a new portfolio to type a genuinely new one.
This is the fix for a real bug: before this, Logistics and logistics
typed on different occasions could end up as two different portfolios in
the app's eyes.

Bulk CSV import, on the Roster page, manager or admin. Import many roster
rows at once instead of one at a time. Click Import CSV, pick a file, it
can be one you exported from this same page, or any CSV with matching
column headers. Nothing is written until you review the preview, each row
shows as either valid or the specific reason it is not, before you
confirm. Capped at 500 rows per import.

Logins page, admin only, not manager. Add and edit sign in accounts,
including which of the three roles someone gets, see section 9. Passwords
are bcrypt hashed on the server before they are ever written to the
sheet, the app never stores or displays plain text. New logins can be
linked to an existing roster member, which fills in name, CMS ID, and
portfolio automatically, or created as a standalone account not tied to a
roster row. Editing a login can change its username, role, portfolio, or
reset its password, leave the password field blank to keep the current
one. There is a safety guard: the app refuses to change the last
remaining admin account away from admin, since that would lock every
admin feature out until someone hand edits the sheet.

Bulk create logins, on the Logins page, admin only. For onboarding many
people at once instead of one at a time. Pick a role that applies to
everyone selected (each person still keeps their own portfolio from the
roster), pick a username style (first name dot last name, or CMS ID),
then select roster members from a searchable list, with a shortcut to
select everyone who does not have a login yet. Usernames are checked for
collisions and de duplicated automatically, passwords are randomly
generated, using a character set that avoids letters and numbers that
look alike, so a handwritten or printed copy is never ambiguous. Nothing
is created until you review the preview, exactly what you see there is
what gets written, nothing is silently regenerated between preview and
confirm. After creating, the generated usernames and passwords are shown
once, since only the hash is kept afterward, with an export to CSV button
so you can copy or hand out the list before closing the page. Capped at
200 at a time.

QR meeting check in, the centerpiece of how attendance actually gets
verified, per section 9. On the Attendance page, an admin picks a
portfolio and date and generates a check in QR, good for thirty minutes,
encoding a signed link (the signature reuses SESSION_SECRET, no separate
secret to manage). Anyone signed in scans it and it marks only them, the
request is tied to their own session's CMS ID, there is no way to check
someone else in this way. Members can only check into their own
portfolio's code, managers and admins can check into any portfolio's,
since they legitimately move between them. If someone is not signed in
yet when they scan, they are prompted to sign in first and land right
back on the same check in link afterward. The resulting Attendance row is
tagged self, QR in Marked By, kept visibly distinct from a manual entry.

Recruitment, all portfolios, manager or admin only. Pick all portfolios
in the Recruitment page's dropdown to see every applicant across every
portfolio in one table, with a Portfolio column. Plain members have no
Recruitment access at all, see section 9.

Applicant status history. Every status change is logged (who, from what,
to what, when) and shown on the applicant's page. See section 2 for the
sheet tab this needs.

Attendance bulk marking, manager or admin. Mark everyone Present, Absent,
or Leave buttons above the attendance table set every row at once, you
can still adjust individual people afterward before saving.

Dashboard, admin only. Average attendance percent by portfolio, attendance
trend over time (all portfolios combined, or one at a time), applicant
funnel by status, and applicant counts by portfolio. Data quality
housekeeping checks: duplicate CMS IDs in Roster, Login rows pointing at
a CMS ID no longer on the roster, roster members with no login at all,
and applicants with a missing or unrecognized portfolio. Each links
straight to where you would fix it, and shows a plain no issues found
message when there is nothing to flag. Charts are hand rolled bar charts
rather than a charting library, see section 7.

Exports. CSV: Attendance, Recruitment, Roster, and Dashboard all have an
Export CSV button, pure client side, no server round trip beyond the data
already on the page. PDF: the Dashboard's Export PDF button calls the
browser's native print dialog with the nav bar hidden, choosing save as
PDF as the destination produces the PDF, see section 7 for why this is a
print stylesheet and not a PDF library.

Installable on phones. The portal has a web app manifest and a minimal
service worker, so add to home screen works on mobile browsers and it
opens full screen without browser chrome. The service worker only caches
the static login page shell, every page still needs a live connection to
load real data.

## 6. Customizing

Tab names are configured once in lib/sheets.js, in the TABS object,
rename them there if you are reusing an existing sheet with different tab
names. To add an interview question or a new applicant field, add a
column to the Applicants tab, no code change needed, it shows up
automatically. To add a portfolio, pick add new portfolio on the Roster
page, or add a roster row with that Portfolio value by hand, it appears
in every dropdown on its own.

## 7. Design decisions worth knowing about

No new npm dependencies were added for the dashboard, PDF export, or QR
codes. The dashboard's bar charts are hand rolled with plain divs and
Tailwind instead of a charting library. Export PDF uses the browser's
built in print to PDF instead of a PDF generation library. The QR check
in code is rendered through a public QR image service (api.qrserver.com)
rather than a QR generation npm package. The first two are pure wins,
zero install step, identical behavior everywhere. The QR approach is the
one real tradeoff: it is an external network request from the admin's
browser, not the server, each time a code is generated, encoding only the
short lived check in link itself, nothing sensitive. If you would rather
not depend on that service, swapping the qrImageUrl function in the
Attendance page for a self hosted QR library is a contained, one file
change.

Roster and Login add and edit, never delete, by design, see section 5.
CMS ID is immutable after creation, see section 5.

What QR check in does not solve. It removes the single point of trust a
checklist has, one person's word for who was in the room, and makes
manual overrides visibly distinct from self check ins in the data (see
Marked By in section 2), but it does not stop a determined admin from
manually marking someone who was not there, or someone scanning on a
friend's behalf while holding two phones. What it does do is make this
portfolio's attendance never uses QR a pattern the Dashboard's data
quality section could plausibly be extended to flag. Geolocation gating,
only counting a scan within some radius of the meeting, would close the
checked in from the couch gap further, at the cost of a location
permission prompt, not built here, flagged as a natural next step if you
want it.

## 8. Security notes

This is built for a low stakes internal tool, not for storing sensitive
data at scale. Before you rely on it, make sure the Google Sheet is not
shared as anyone with the link, only the service account and the people
who should be able to open the sheet directly. SESSION_SECRET should be
unique per deployment and never committed, it now also signs QR check in
codes, rotating it invalidates every session and every outstanding QR
code, which is fine since QR codes are only ever valid for thirty
minutes anyway.

Role enforcement: every API route checks the signed in session's role
against what it is trying to do, see section 9 for the full permissions
table. This is enforced server side, not just hidden in the UI, a member
cannot get at Recruitment or another portfolio's Attendance data by
editing the request either.

QR check in tokens are signed and expire after thirty minutes, a
captured or screenshotted code stops working shortly after the meeting it
was generated for. Self check in always marks the scanning session's own
CMS ID, there is no parameter that lets it mark anyone else.

Passwords are never stored or transmitted in plain text beyond the single
request that sets them, hashed server side with bcrypt before reaching
the sheet, whether added through the app or the setup script.

Login rate limiting: lib/rateLimit.js locks an IP and username pair out
for fifteen minutes after five failed attempts. It is in memory, so it is
scoped to a single warm serverless instance, it meaningfully slows down
a naive brute force script but is not a hard guarantee across every
instance Vercel might spin up. For that, add Vercel firewall rate limit
rules or swap in a shared store.

Attendance race condition: saving the same portfolio and date from two
places at nearly the same moment can no longer leave a lasting duplicate
row, upsertAttendance in lib/sheets.js detects and merges duplicates for
the same date and person automatically.

Reads are cached for fifteen seconds per tab, and invalidated immediately
on any write to that tab.

Last admin guard: the Logins page will not let you demote or edit away
the only remaining admin account, see section 5.

Portfolio matching is case insensitive everywhere, this can only make
access checks more permissive for the correct person, a casing mismatch
no longer locks someone out of their own portfolio's data, never less
restrictive for anyone else, since it is still an exact match once both
sides are normalized.

## 9. Roles and permissions

Three tiers, matching NXC's actual structure. Admin is President plus the
HR Directorate. Manager is HR's Executives. Member is everyone else, at
any level, in every other portfolio.

Admin can generate a QR check in code, self check in, manually mark or
bulk mark attendance for any portfolio, view Recruitment for any
portfolio, review an applicant or change their status, view and add and
edit Roster, bulk import CSV, manage Logins, and view the Dashboard and
Data Quality.

Manager can self check in, manually mark or bulk mark attendance for any
portfolio, view Recruitment for any portfolio, review an applicant or
change their status, view and add and edit Roster, and bulk import CSV.
Manager cannot generate a QR check in code, cannot manage Logins, and
cannot view the Dashboard or Data Quality.

Member can only self check in by scanning a QR code, that is their only
way to be marked present. Members have no Recruitment or Roster access at
all, not even scoped to their own portfolio. Their only interaction with
the system is signing in and scanning a QR code to check themselves in at
a meeting. If something about their own record looks wrong, that is a
Manager or Admin fix, not a self service one.

A few things worth being explicit about. QR generation is admin only,
with no manager fallback. If nobody from the HR Directorate is physically
at a meeting, there is currently no way to spin up a check in code that
day, a manager can still mark attendance manually as a fallback, but that
meeting has no QR verification step. Manager and Admin are identical on
data access (Roster, Recruitment, attendance marking), the only things
that separate the two tiers are Logins, Dashboard and Data Quality, and
QR generation.
