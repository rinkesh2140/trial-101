# Project: Patel Infrastructure — Site Management Suite

## Overview
Two apps hosted on Firebase Hosting at `https://trial-101-d39b1.web.app`

| File | App | Backend |
|---|---|---|
| `index.html` | Labour Management System | localStorage only |
| `supervisor.html` + `supervisor.css` + `supervisor.js` | Employee / Supervisor Portal | Firebase Firestore |

Landing page: `open-app.html` → launcher with links to live and local versions.
Deploy script: `deploy.bat` → copies all files to `deploy/` folder then runs `firebase deploy --only hosting`.

---

## App 1: Labour Management System (`index.html`)

### Goal
Simple labour attendance and worker management system for construction site.

### Features
- Worker enrollment with unique mobile logic
- Companion worker support (multiple workers on same mobile)
- Unique 7-digit Worker ID generation
- Attendance system (IN / OUT)
- Report generation

### Current Stage
Raw / early stage — basic features working. Growing toward a fully operable, production-ready app.

### Planned (upcoming)
- Profile section for the employee operating the app (the person scanning/managing labours)

### Rules
- No frameworks (only HTML, CSS, JS)
- Store data in localStorage
- Large buttons for site usability
- Single file output

### Attendance Logic
- No double IN
- No OUT without IN
- Track IN/OUT time

---

## App 2: Employee / Supervisor Portal (`supervisor.html` + `supervisor.css` + `supervisor.js`)

### Goal
Full site management portal for Patel Infrastructure staff. APK-packaged via WebView.

### Architecture
- Split into 3 files: `supervisor.html` (structure), `supervisor.css` (styles), `supervisor.js` (logic)
- Firebase Firestore as backend (in-memory `DB` cache for sync reads)
- `loadAllFromFirestore()` on startup, `fbBatchSet()` for batch writes, `fbSet()` for single doc writes
- Real-time sync via `onSnapshot` listeners for: messages, availability, attendance
- 60-second auto-refresh interval for non-real-time data (tasks, etc.)

### Design System
- CSS tokens in `:root` — brand blue `#1D5FA8`, accent orange `#F97316`
- Mobile-first, APK-optimized (no desktop sidebar, touch optimizations)
- Bottom tab nav (60px fixed)
- Max content width: 560px

### Tab Order — 5-tab nav (left → right)
`Work | Crew | Home (center) | Messages | More`

- `NAV_TABS = ['work','people','dashboard','messages','more']`
- `MORE_SUB_TABS = ['schedule','mypad','reports','profile']` — highlight More button when active

### Header States (3 states)
- **Dashboard**: Full blue gradient `#app-header` visible, `#slim-header` hidden
- **Messages**: Both headers hidden (WhatsApp-style own header with 🏗️ logo)
- **All other tabs**: `#app-header` hidden, `#slim-header` (44px white sticky bar with 🏗️ + page title + avatar) visible

### Features Implemented
- **Dashboard** — company header (no "Dashboard" title), attendance hero button, stats, pending tasks
- **Work** — task management with priorities
- **Messages** — WhatsApp-style DMs and group chat (Firestore onSnapshot), WA header has 🏗️ Patel Infrastructure logo
- **Crew** — Internal | External subtabs
  - Internal: employee directory (A-Z, search, role filter), tap card → full profile with Message + Call buttons
  - External: phonebook (Emergency pinned, A-Z groups, search), tap card → read-only detail view, Edit/Delete at bottom of modal (PM/SM edit, PM/SM delete only)
- **Schedule** (via More) — 4 subtabs: Plan | Team | History | Requests
  - Plan: expandable day cards with 6-status picker (auto-close on select)
  - Team: 3/7/14-day team availability grid
  - History: personal attendance history
  - Requests: Mispunch / Extra Hours request system
- **My Pad** (via More) — personal notes
- **Reports** (via More) — attendance report, availability report, labour summary (PM/SM/HR only)
- **More hub** — company logo header, nav cards (Schedule, My Pad, My Profile, Reports), accordion info (About Us, Site Details, HR Policy)
- **Profile** (via More hub → My Profile or slim header avatar)

### Mispunch / Extra Hours Request System
- Firestore collection: `punch_requests`
- Schema: `{ id, employeeId, type:'mispunch'|'extra-hours', date, inTime, outTime, reason, status:'pending'|'approved'|'rejected', decidedBy, decisionNote, submittedAt, decidedAt }`
- Submit: all employees
- Review/decide: PM, SM, HR only
- Approved requests auto-apply to attendance records via `applyApprovedRequest()`

### HR Delete Employee
- HR can permanently delete resigned employee profiles
- Only allowed if: current user role = HR, employee status = resigned, resignedDate ≥ 30 days ago
- Deletes from both `employees` and `users` collections

### Messaging Fix (important)
- Use `fbSet('messages', id, msg)` for single new message (NOT `saveMessages()` batch write)
- Message IDs: `'MSG' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase()`
- Mark-as-read also uses individual `fbSet` per message

### Attendance Logic (Multi-punch)
- Schema: `{ employeeId, date, punches: [{inTime, outTime}, ...] }`
- Multiple IN/OUT pairs per day allowed
- `migrateAttendance()` runs on startup to convert old flat records
- `totalMinsForRec(rec)` — sums all punch pairs for total hours
- `isCurrentlyIN(rec)` — checks if last punch has no outTime

### Availability Statuses
On Site, WFH, Leave, Field, Off, **Half Day** (purple)

### Employee Roles
PM > SM > HR > SE > EN > SV > JE > AS > TK

### Role Badge Colors
- HR badge: fuchsia (`#FDF4FF / #86198F`)
- EN badge: sky blue (`#E0F2FE / #0369A1`)
- Avatar colors: PM `#8e44ad`, SM `#1D5FA8`, HR `#86198F`, SE `#2980b9`, EN `#0369A1`, SV `#e67e22`, JE `#7f8c8d`, AS `#95a5a6`, TK `#bdc3c7`

### Firestore Collections
`employees`, `users`, `attendance`, `availability`, `tasks`, `notes`, `messages`, `contacts`, `groups`, `lms_workers`, `lms_attendance`, `pad`, `meta`, `punch_requests`

### Deployment
- User runs `deploy.bat` manually — do NOT run firebase commands via Claude terminal
- `deploy.bat` copies `supervisor.html` + `supervisor.css` + `supervisor.js` + `index.html` to `deploy/` folder then runs firebase deploy
- Firestore security rules set to `allow read, write: if true` for development

---

## Development Stage
The core feature set is now largely complete. The project can now evolve with:
- **Frameworks**: React, Vue, or other frontend frameworks are now acceptable
- **Build tools**: Vite, Webpack, npm-based tooling can be introduced
- **Design quality**: Polish, animations, transitions — design is now a priority alongside speed
- **Refactoring**: Moving from single large files to component-based architecture is welcome

## Design Priorities
- APK/mobile first — no desktop layout needed
- Large touch targets (min 48px height)
- Polish and visual consistency across all sections
- Smooth transitions and micro-interactions encouraged
