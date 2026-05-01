# House Chores MVP

A self-contained browser MVP for organizing, assigning, reviewing, and enforcing house chores.

## What is included

- Manual chore creation and assignment by a house manager
- Step-by-step chore instructions
- Due date and time tracking
- Configurable photo proof per chore
- Member completion submission with notes and proof upload
- Manager approval and rejection
- Missed chore detection after due date
- Permanent strike tracking
- Fine tracking without payment processing
- Member comments on chores
- In-app notifications and reminders
- Role-aware calendar view for monthly due dates
- Supply status tracking, member flags, suggestions, and restock logs
- Mobile-friendly layout organized by week, person, and chore

## How to run

Open `index.html` in a browser.

No install step is required. Data is stored in the browser with `localStorage`.

## MVP rule decisions

- Chores are manually assigned by the house manager.
- Members can view assigned chores, submit completion, upload proof, and leave comments.
- Members cannot edit chore details.
- Photo proof is configurable per chore.
- Unsubmitted or unresolved rejected chores become missed after the due date.
- Each missed chore creates one permanent strike.
- Strikes never reset.
- Fines are tracked only. The app does not process payments.
- There is no dispute or appeal flow.

## Demo data

The first load creates sample members, chores, supplies, and one overdue chore so the missed/strike behavior is visible. Use the role switcher in the header to move between manager and member views.

## Next production steps

- Add real authentication and house invites.
- Move local data to a backend database.
- Store proof photos in object storage.
- Add real push notifications.
- Add server-side scheduled jobs for missed chores and reminders.
- Add audit logs for manager actions.
- Add backups and exportable reports.
