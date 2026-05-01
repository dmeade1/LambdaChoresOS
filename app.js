"use strict";

const STORE_KEY = "houseChoreMvp.state.v1";

const STATUS = {
  assigned: { label: "Assigned", className: "assigned" },
  submitted: { label: "Submitted", className: "submitted" },
  submitted_late: { label: "Late submission", className: "submitted_late" },
  approved: { label: "Approved", className: "approved" },
  rejected: { label: "Rejected", className: "rejected" },
  missed: { label: "Missed", className: "missed" },
  completed_late: { label: "Completed late", className: "completed_late" },
};

const SUPPLY_STATUS = {
  stocked: { label: "Fully stocked", className: "stocked", weight: 0 },
  low: { label: "Running low", className: "low", weight: 2 },
  out: { label: "Out", className: "out", weight: 3 },
  needs_review: { label: "Needs review", className: "needs_review", weight: 1 },
};

const app = document.getElementById("app");
let eventsBound = false;

let state = loadState();
let ui = {
  role: "manager",
  tab: "dashboard",
  activeMemberId: firstMemberId(),
  choreFilter: "current",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  notice: "",
};

setInterval(runAutomationAndRenderIfChanged, 60 * 1000);

applyReminderRules();
applyDueRules();
saveState();
render();

function loadState() {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) {
      return normalizeState(JSON.parse(stored));
    }
  } catch (error) {
    console.warn("Could not load saved MVP state", error);
  }
  return seedState();
}

function normalizeState(input) {
  return {
    members: Array.isArray(input.members) ? input.members : [],
    chores: Array.isArray(input.chores) ? input.chores : [],
    strikes: Array.isArray(input.strikes) ? input.strikes : [],
    fines: Array.isArray(input.fines) ? input.fines : [],
    supplies: Array.isArray(input.supplies) ? input.supplies : [],
    notifications: Array.isArray(input.notifications) ? input.notifications : [],
  };
}

function seedState() {
  const now = new Date();
  const tonight = setTime(addDays(now, 0), 20, 0);
  const tomorrow = setTime(addDays(now, 1), 18, 0);
  const yesterday = setTime(addDays(now, -1), 21, 0);
  const later = setTime(addDays(now, 3), 12, 0);

  return {
    members: [
      { id: "manager", name: "House Manager", role: "manager" },
      { id: "alex", name: "Alex", role: "member" },
      { id: "jamie", name: "Jamie", role: "member" },
      { id: "taylor", name: "Taylor", role: "member" },
    ],
    chores: [
      {
        id: "chore_kitchen",
        title: "Kitchen reset",
        instructions: "Counters, sink, stove, and floor should be ready for the next day.",
        steps: makeSteps(["Clear dishes", "Wipe counters and stove", "Sweep floor", "Take kitchen trash out"]),
        assignedTo: "alex",
        dueAt: tonight.toISOString(),
        proofRequired: true,
        status: "assigned",
        createdAt: now.toISOString(),
        submissions: [],
        comments: [],
        review: null,
        strikeId: null,
      },
      {
        id: "chore_bathroom",
        title: "Bathroom turnover",
        instructions: "Focus on sink, toilet, mirror, and restocking basics.",
        steps: makeSteps(["Scrub toilet", "Clean sink and mirror", "Empty trash", "Restock toilet paper"]),
        assignedTo: "jamie",
        dueAt: tomorrow.toISOString(),
        proofRequired: true,
        status: "assigned",
        createdAt: now.toISOString(),
        submissions: [],
        comments: [],
        review: null,
        strikeId: null,
      },
      {
        id: "chore_trash",
        title: "Trash and recycling curb pull",
        instructions: "Move bins to the curb and bring overflow bags from the back hallway.",
        steps: makeSteps(["Collect overflow bags", "Move trash bin to curb", "Move recycling bin to curb"]),
        assignedTo: "taylor",
        dueAt: yesterday.toISOString(),
        proofRequired: false,
        status: "assigned",
        createdAt: addDays(now, -3).toISOString(),
        submissions: [],
        comments: [],
        review: null,
        strikeId: null,
      },
      {
        id: "chore_entry",
        title: "Entry and stairs sweep",
        instructions: "Clear visible dirt from the front entry and stairs.",
        steps: makeSteps(["Move shoes to rack", "Sweep entry", "Sweep stairs", "Put broom away"]),
        assignedTo: "alex",
        dueAt: later.toISOString(),
        proofRequired: false,
        status: "assigned",
        createdAt: now.toISOString(),
        submissions: [],
        comments: [],
        review: null,
        strikeId: null,
      },
    ],
    strikes: [],
    fines: [],
    supplies: [
      {
        id: "supply_paper_towels",
        name: "Paper towels",
        category: "Kitchen",
        location: "Pantry shelf",
        status: "low",
        notes: "Buy the larger pack if budget allows.",
        flags: [{ id: "flag_seed_1", memberId: "alex", note: "One roll left", createdAt: addDays(now, -1).toISOString() }],
        restockLog: [],
        createdAt: now.toISOString(),
      },
      {
        id: "supply_soap",
        name: "Hand soap",
        category: "Bathroom",
        location: "2nd floor bathroom",
        status: "stocked",
        notes: "",
        flags: [],
        restockLog: [{ id: "restock_seed_1", date: addDays(now, -5).toISOString(), cost: 8.5, note: "Two refills" }],
        createdAt: now.toISOString(),
      },
      {
        id: "supply_trash_bags",
        name: "Trash bags",
        category: "Cleaning",
        location: "Laundry closet",
        status: "out",
        notes: "Tall kitchen size.",
        flags: [
          { id: "flag_seed_2", memberId: "jamie", note: "Box is empty", createdAt: addDays(now, -2).toISOString() },
          { id: "flag_seed_3", memberId: "taylor", note: "Needed for trash chore", createdAt: addDays(now, -1).toISOString() },
        ],
        restockLog: [],
        createdAt: now.toISOString(),
      },
    ],
    notifications: [],
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function render() {
  applyReminderRules();
  applyDueRules();
  saveState();

  const tabs = tabsForRole();
  if (!tabs.some((tab) => tab.id === ui.tab)) {
    ui.tab = tabs[0].id;
  }

  app.innerHTML = `
    <div class="app">
      ${renderHeader()}
      <main class="shell">
        <nav class="side-nav" aria-label="Main navigation">
          ${tabs.map(renderTabButton).join("")}
        </nav>
        <section class="content">
          ${ui.notice ? `<div class="notice">${escapeHtml(ui.notice)}</div>` : ""}
          ${renderActiveTab()}
        </section>
      </main>
      <div class="footer-note">MVP data is stored in this browser with localStorage.</div>
    </div>
  `;

  bindEvents();
}

function renderHeader() {
  const currentMember = getMember(ui.activeMemberId);
  return `
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">HC</div>
        <div>
          <h1>House Chores</h1>
          <p class="subtle">${escapeHtml(currentWeekLabel())}</p>
        </div>
      </div>
      <div class="role-bar">
        <div class="segmented" aria-label="Role switcher">
          <button type="button" class="${ui.role === "manager" ? "active" : ""}" data-action="set-role" data-role="manager">Manager</button>
          <button type="button" class="${ui.role === "member" ? "active" : ""}" data-action="set-role" data-role="member">Member</button>
        </div>
        ${
          ui.role === "member"
            ? `<select class="member-select" data-action="change-member" aria-label="Active member">
                ${memberOptions(ui.activeMemberId)}
              </select>`
            : ""
        }
      </div>
    </header>
  `;
}

function tabsForRole() {
  if (ui.role === "manager") {
    return [
      { id: "dashboard", label: "Dashboard", count: reviewQueue().length + missedChores().length },
      { id: "chores", label: "Chores", count: state.chores.length },
      { id: "calendar", label: "Calendar", count: calendarChoresForMonth().length },
      { id: "supplies", label: "Supplies", count: prioritySupplies().length },
      { id: "accountability", label: "Accountability", count: state.strikes.length },
    ];
  }
  return [
    { id: "dashboard", label: "My work", count: myOpenChores().length },
    { id: "chores", label: "History", count: myChores().length },
    { id: "calendar", label: "Calendar", count: calendarChoresForMonth().length },
    { id: "supplies", label: "Supplies", count: prioritySupplies().length },
    { id: "accountability", label: "Strikes", count: memberStrikes(ui.activeMemberId).length },
  ];
}

function renderTabButton(tab) {
  return `
    <button type="button" class="tab-button ${ui.tab === tab.id ? "active" : ""}" data-action="set-tab" data-tab="${tab.id}">
      <span>${escapeHtml(tab.label)}</span>
      <span class="count-pill">${tab.count}</span>
    </button>
  `;
}

function renderActiveTab() {
  if (ui.role === "manager") {
    if (ui.tab === "dashboard") return renderManagerDashboard();
    if (ui.tab === "chores") return renderManagerChores();
    if (ui.tab === "calendar") return renderCalendar();
    if (ui.tab === "supplies") return renderSupplies();
    return renderAccountability();
  }

  if (ui.tab === "dashboard") return renderMemberDashboard();
  if (ui.tab === "chores") return renderMemberHistory();
  if (ui.tab === "calendar") return renderCalendar();
  if (ui.tab === "supplies") return renderSupplies();
  return renderMemberAccountability();
}

function renderManagerDashboard() {
  return `
    ${renderStats()}
    <section class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Review queue</h2>
            <p class="subtle">Submitted chores waiting for manager decision.</p>
          </div>
        </div>
        <div class="list">
          ${reviewQueue().length ? reviewQueue().map((chore) => renderChoreCard(chore, { compact: true })).join("") : emptyState("No chores are waiting for review.")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div>
            <h2>Missed and late</h2>
            <p class="subtle">Permanent strike records are created when chores miss the due date.</p>
          </div>
        </div>
        <div class="list">
          ${missedChores().length ? missedChores().slice(0, 5).map((chore) => renderChoreCard(chore, { compact: true })).join("") : emptyState("No missed or late chores.")}
        </div>
      </div>
    </section>
    <section class="grid-2">
      ${renderCreateChorePanel()}
      ${renderNotificationsPanel("manager")}
    </section>
  `;
}

function renderStats() {
  const stats = managerStats();
  return `
    <section class="stat-grid" aria-label="House summary">
      <div class="stat"><span class="subtle">Assigned open</span><strong>${stats.open}</strong><span class="subtle">Not yet submitted</span></div>
      <div class="stat"><span class="subtle">Needs review</span><strong>${stats.review}</strong><span class="subtle">Manager approval</span></div>
      <div class="stat"><span class="subtle">Missed</span><strong>${stats.missed}</strong><span class="subtle">Permanent record</span></div>
      <div class="stat"><span class="subtle">Low supplies</span><strong>${stats.supplies}</strong><span class="subtle">Flagged priority</span></div>
    </section>
  `;
}

function renderManagerChores() {
  const chores = filteredChores();
  return `
    <section class="toolbar">
      <div>
        <h2>Chores</h2>
        <p class="subtle">Manual assignments, due dates, proof rules, comments, and review.</p>
      </div>
      <div class="toolbar-group">
        <select class="inline-input" data-action="change-chore-filter" aria-label="Chore filter">
          <option value="current" ${ui.choreFilter === "current" ? "selected" : ""}>This week</option>
          <option value="open" ${ui.choreFilter === "open" ? "selected" : ""}>Open</option>
          <option value="problem" ${ui.choreFilter === "problem" ? "selected" : ""}>Missed/rejected/late</option>
          <option value="all" ${ui.choreFilter === "all" ? "selected" : ""}>All chores</option>
        </select>
        <button type="button" class="ghost-button" data-action="duplicate-week">Duplicate week</button>
      </div>
    </section>
    <section class="grid-2">
      ${renderCreateChorePanel()}
      <div class="panel">
        <h2>Current rules</h2>
        <div class="compact-list">
          <div class="comment"><strong>Assignments:</strong> manager assigns manually.</div>
          <div class="comment"><strong>Members:</strong> view only, submit proof, and leave comments.</div>
          <div class="comment"><strong>Missed:</strong> unsubmitted or unresolved rejected chores become missed after due date.</div>
          <div class="comment"><strong>Strikes:</strong> permanent and never reset.</div>
          <div class="comment"><strong>Fines:</strong> tracked only, no payment processing.</div>
        </div>
      </div>
    </section>
    <section class="list">
      ${chores.length ? chores.map((chore) => renderChoreCard(chore)).join("") : emptyState("No chores match this filter.")}
    </section>
  `;
}

function renderCalendar() {
  const monthDate = new Date(ui.calendarMonth);
  const monthChores = calendarChoresForMonth();
  const openCount = monthChores.filter((chore) => ["assigned", "rejected", "submitted", "submitted_late"].includes(chore.status)).length;
  const missedCount = monthChores.filter((chore) => ["missed", "completed_late"].includes(chore.status)).length;
  const approvedCount = monthChores.filter((chore) => ["approved", "completed_late"].includes(chore.status)).length;

  return `
    <section class="toolbar">
      <div>
        <h2>Calendar</h2>
        <p class="subtle">${ui.role === "manager" ? "House schedule by due date." : `Assigned schedule for ${escapeHtml(getMember(ui.activeMemberId).name)}.`}</p>
      </div>
      <div class="toolbar-group">
        <button type="button" class="ghost-button" data-action="calendar-prev">Previous</button>
        <button type="button" class="ghost-button" data-action="calendar-today">Today</button>
        <button type="button" class="ghost-button" data-action="calendar-next">Next</button>
      </div>
    </section>
    <section class="stat-grid" aria-label="Calendar summary">
      <div class="stat"><span class="subtle">Month</span><strong class="calendar-month-stat">${escapeHtml(formatMonth(monthDate))}</strong><span class="subtle">Due-date view</span></div>
      <div class="stat"><span class="subtle">Scheduled</span><strong>${monthChores.length}</strong><span class="subtle">Chores this month</span></div>
      <div class="stat"><span class="subtle">Open</span><strong>${openCount}</strong><span class="subtle">Assigned or review</span></div>
      <div class="stat"><span class="subtle">Done / missed</span><strong>${approvedCount}/${missedCount}</strong><span class="subtle">Approved vs missed</span></div>
    </section>
    <section class="calendar-panel">
      <div class="calendar-weekdays">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div>${day}</div>`).join("")}
      </div>
      <div class="calendar-grid">
        ${calendarDays(monthDate).map(renderCalendarDay).join("")}
      </div>
    </section>
    <section class="panel">
      <div>
        <h2>Upcoming in this view</h2>
        <p class="subtle">Next due chores from the selected calendar month.</p>
      </div>
      <div class="list">
        ${monthChores.length ? monthChores.sort(sortByDueAsc).slice(0, 6).map((chore) => renderChoreCard(chore, { compact: true })).join("") : emptyState("No chores scheduled in this month.")}
      </div>
    </section>
  `;
}

function renderCalendarDay(day) {
  const monthDate = new Date(ui.calendarMonth);
  const chores = calendarChoresForDay(day);
  const classNames = [
    "calendar-day",
    day.getMonth() !== monthDate.getMonth() ? "outside-month" : "",
    isSameDay(day, new Date()) ? "today" : "",
    chores.length ? "has-chores" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classNames}">
      <div class="calendar-date">
        <span>${day.getDate()}</span>
        ${chores.length ? `<span class="count-pill">${chores.length}</span>` : ""}
      </div>
      <div class="calendar-events">
        ${
          chores.length
            ? chores.map(renderCalendarEvent).join("")
            : `<span class="calendar-empty">No chores</span>`
        }
      </div>
    </div>
  `;
}

function renderCalendarEvent(chore) {
  const meta = STATUS[chore.status] || STATUS.assigned;
  const assignee = getMember(chore.assignedTo);
  return `
    <button type="button" class="calendar-event ${meta.className}" data-action="open-calendar-chore" data-id="${chore.id}">
      <span>${escapeHtml(chore.title)}</span>
      <small>${escapeHtml(formatTime(chore.dueAt))}${ui.role === "manager" ? ` · ${escapeHtml(assignee.name)}` : ""}</small>
    </button>
  `;
}

function renderCreateChorePanel() {
  return `
    <div class="panel">
      <div>
        <h2>Create chore</h2>
        <p class="subtle">Every chore is manually assigned by the house manager.</p>
      </div>
      <form class="form-grid" data-form="create-chore">
        <div class="field">
          <label for="title">Chore name</label>
          <input id="title" name="title" required placeholder="Clean kitchen">
        </div>
        <div class="field">
          <label for="assignedTo">Assigned person</label>
          <select id="assignedTo" name="assignedTo" required>${memberOptions()}</select>
        </div>
        <div class="field">
          <label for="dueAt">Due date and time</label>
          <input id="dueAt" name="dueAt" type="datetime-local" required value="${toLocalInputValue(addHours(new Date(), 24))}">
        </div>
        <label class="check-row">
          <input name="proofRequired" type="checkbox">
          Photo proof required
        </label>
        <div class="field full">
          <label for="steps">Step-by-step tasks</label>
          <textarea id="steps" name="steps" required placeholder="One step per line"></textarea>
        </div>
        <div class="field full">
          <label for="instructions">Notes or quality bar</label>
          <textarea id="instructions" name="instructions" placeholder="What should done look like?"></textarea>
        </div>
        <div class="field full">
          <button class="button" type="submit">Create and assign</button>
        </div>
      </form>
    </div>
  `;
}

function renderMemberDashboard() {
  const member = getMember(ui.activeMemberId);
  const notifications = unreadNotifications(ui.activeMemberId);
  return `
    <section class="stat-grid" aria-label="Member summary">
      <div class="stat"><span class="subtle">Open chores</span><strong>${myOpenChores().length}</strong><span class="subtle">${escapeHtml(member.name)}</span></div>
      <div class="stat"><span class="subtle">Submitted</span><strong>${myChores().filter((chore) => chore.status === "submitted" || chore.status === "submitted_late").length}</strong><span class="subtle">Waiting review</span></div>
      <div class="stat"><span class="subtle">Approved</span><strong>${myChores().filter((chore) => chore.status === "approved" || chore.status === "completed_late").length}</strong><span class="subtle">History total</span></div>
      <div class="stat"><span class="subtle">Lifetime strikes</span><strong>${memberStrikes(ui.activeMemberId).length}</strong><span class="subtle">Never reset</span></div>
    </section>
    ${notifications.length ? renderNotificationsPanel(ui.activeMemberId) : ""}
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>My assigned chores</h2>
          <p class="subtle">Only the assigned member can submit completion for these chores.</p>
        </div>
      </div>
      <div class="list">
        ${myOpenChores().length ? myOpenChores().map((chore) => renderChoreCard(chore)).join("") : emptyState("No open chores assigned right now.")}
      </div>
    </section>
  `;
}

function renderMemberHistory() {
  const chores = myChores().sort(sortByDueDesc);
  return `
    <section class="panel">
      <div>
        <h2>Personal chore history</h2>
        <p class="subtle">Approved, missed, late, submitted, and rejected records for ${escapeHtml(getMember(ui.activeMemberId).name)}.</p>
      </div>
      <div class="list">
        ${chores.length ? chores.map((chore) => renderChoreCard(chore, { history: true })).join("") : emptyState("No chore history yet.")}
      </div>
    </section>
  `;
}

function renderChoreCard(chore, options = {}) {
  const meta = STATUS[chore.status] || STATUS.assigned;
  const assignee = getMember(chore.assignedTo);
  const latest = latestSubmission(chore);
  const canReview = ui.role === "manager" && (chore.status === "submitted" || chore.status === "submitted_late");
  const canSubmit = ui.role === "member" && chore.assignedTo === ui.activeMemberId && canMemberSubmit(chore);
  const cardClass = `chore-card status-${meta.className}`;

  return `
    <article class="${cardClass}">
      <div class="card-head">
        <div>
          <h3>${escapeHtml(chore.title)}</h3>
          <p class="subtle">Assigned to ${escapeHtml(assignee.name)} · ${escapeHtml(weekLabel(chore.dueAt))}</p>
        </div>
        <span class="badge ${meta.className}">${escapeHtml(meta.label)}</span>
      </div>
      <dl class="meta-grid">
        <div><dt>Due</dt><dd>${escapeHtml(formatDateTime(chore.dueAt))}</dd></div>
        <div><dt>Proof</dt><dd>${chore.proofRequired ? "Required" : "Optional"}</dd></div>
        <div><dt>Submitted</dt><dd>${latest ? escapeHtml(formatDateTime(latest.submittedAt)) : "None"}</dd></div>
        <div><dt>Strike</dt><dd>${chore.strikeId ? "Recorded" : "None"}</dd></div>
      </dl>
      ${chore.instructions ? `<p>${escapeHtml(chore.instructions)}</p>` : ""}
      <ol class="steps">${chore.steps.map((step) => `<li>${escapeHtml(step.text)}</li>`).join("")}</ol>
      ${latest ? renderSubmission(chore, latest) : ""}
      ${chore.review ? renderReview(chore.review) : ""}
      ${canReview ? renderReviewControls(chore) : ""}
      ${canSubmit && !options.compact && !options.history ? renderSubmissionForm(chore) : ""}
      ${!options.compact ? renderComments(chore) : ""}
      ${ui.role === "manager" && !options.compact ? renderEditChoreForm(chore) : ""}
      ${
        ui.role === "manager" && !options.compact
          ? `<div class="button-row">
              <button type="button" class="ghost-button" data-action="send-reminder" data-id="${chore.id}">Send reminder</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderEditChoreForm(chore) {
  return `
    <details class="edit-block">
      <summary>Edit chore details</summary>
      <form class="form-grid" data-form="edit-chore" data-id="${chore.id}">
        <div class="field">
          <label for="edit_title_${chore.id}">Chore name</label>
          <input id="edit_title_${chore.id}" name="title" required value="${escapeAttribute(chore.title)}">
        </div>
        <div class="field">
          <label for="edit_assigned_${chore.id}">Assigned person</label>
          <select id="edit_assigned_${chore.id}" name="assignedTo" required>${memberOptions(chore.assignedTo)}</select>
        </div>
        <div class="field">
          <label for="edit_due_${chore.id}">Due date and time</label>
          <input id="edit_due_${chore.id}" name="dueAt" type="datetime-local" required value="${toLocalInputValue(new Date(chore.dueAt))}">
        </div>
        <label class="check-row">
          <input name="proofRequired" type="checkbox" ${chore.proofRequired ? "checked" : ""}>
          Photo proof required
        </label>
        <div class="field full">
          <label for="edit_steps_${chore.id}">Step-by-step tasks</label>
          <textarea id="edit_steps_${chore.id}" name="steps" required>${escapeHtml(chore.steps.map((step) => step.text).join("\n"))}</textarea>
        </div>
        <div class="field full">
          <label for="edit_instructions_${chore.id}">Notes or quality bar</label>
          <textarea id="edit_instructions_${chore.id}" name="instructions">${escapeHtml(chore.instructions || "")}</textarea>
        </div>
        <div class="field full">
          <button class="button" type="submit">Save changes</button>
        </div>
      </form>
    </details>
  `;
}

function renderSubmission(chore, submission) {
  const checkedCount = submission.stepChecks.filter((step) => step.done).length;
  const total = submission.stepChecks.length;
  return `
    <div class="submission">
      ${
        submission.photoData
          ? `<img class="proof-thumb" src="${submission.photoData}" alt="Photo proof for ${escapeAttribute(chore.title)}">`
          : `<div class="proof-thumb"></div>`
      }
      <div>
        <p><strong>${submission.late ? "Late proof submitted" : "Proof submitted"}</strong></p>
        <p class="subtle">${checkedCount}/${total} steps checked · ${escapeHtml(formatDateTime(submission.submittedAt))}</p>
        ${submission.notes ? `<p>${escapeHtml(submission.notes)}</p>` : ""}
      </div>
    </div>
  `;
}

function renderReview(review) {
  return `
    <div class="comment">
      <strong>Manager ${review.decision}</strong>
      <p class="subtle">${escapeHtml(formatDateTime(review.reviewedAt))}</p>
      ${review.note ? `<p>${escapeHtml(review.note)}</p>` : ""}
    </div>
  `;
}

function renderReviewControls(chore) {
  return `
    <form class="inline-form" data-form="review-chore" data-id="${chore.id}">
      <textarea name="reviewNote" placeholder="Review note"></textarea>
      <div class="button-row">
        <button class="success-button" type="submit" name="decision" value="approved">Approve</button>
        <button class="danger-button" type="submit" name="decision" value="rejected">Reject</button>
      </div>
    </form>
  `;
}

function renderSubmissionForm(chore) {
  return `
    <form class="inline-form" data-form="submit-chore" data-id="${chore.id}">
      <div class="section-label">Step completion</div>
      <div class="step-checks">
        ${chore.steps
          .map(
            (step) => `
              <label class="check-row">
                <input type="checkbox" name="step_${step.id}" checked>
                ${escapeHtml(step.text)}
              </label>
            `
          )
          .join("")}
      </div>
      <div class="field">
        <label for="photo_${chore.id}">Photo proof${chore.proofRequired ? "" : " optional"}</label>
        <input id="photo_${chore.id}" name="photo" type="file" accept="image/*">
      </div>
      <div class="field">
        <label for="notes_${chore.id}">Notes</label>
        <textarea id="notes_${chore.id}" name="notes" placeholder="Anything the manager should know?"></textarea>
      </div>
      <button class="button" type="submit">${chore.status === "missed" ? "Submit late proof" : "Submit completion"}</button>
    </form>
  `;
}

function renderComments(chore) {
  return `
    <div class="comment-list">
      ${chore.comments.length ? chore.comments.map(renderComment).join("") : ""}
      <form class="inline-form" data-form="comment" data-id="${chore.id}">
        <input class="inline-input" name="comment" required maxlength="240" placeholder="Leave a comment">
        <button class="ghost-button" type="submit">Add comment</button>
      </form>
    </div>
  `;
}

function renderComment(comment) {
  return `
    <div class="comment">
      <strong>${escapeHtml(comment.authorName)}</strong>
      <span class="subtle"> · ${escapeHtml(formatDateTime(comment.createdAt))}</span>
      <p>${escapeHtml(comment.body)}</p>
    </div>
  `;
}

function renderSupplies() {
  const supplies = [...state.supplies].sort(sortSupplies);
  return `
    <section class="toolbar">
      <div>
        <h2>House supplies</h2>
        <p class="subtle">Members flag low items; managers update stock and restock history.</p>
      </div>
    </section>
    <section class="grid-2">
      ${ui.role === "manager" ? renderAddSupplyPanel() : renderSuggestSupplyPanel()}
      ${renderSupplySummary()}
    </section>
    <section class="grid-3">
      ${supplies.map(renderSupplyCard).join("")}
    </section>
  `;
}

function renderAddSupplyPanel() {
  return `
    <div class="panel">
      <h2>Add supply item</h2>
      <form class="form-grid" data-form="add-supply">
        <div class="field">
          <label for="supplyName">Item</label>
          <input id="supplyName" name="name" required placeholder="Dish soap">
        </div>
        <div class="field">
          <label for="supplyCategory">Category</label>
          <input id="supplyCategory" name="category" required placeholder="Kitchen">
        </div>
        <div class="field">
          <label for="supplyLocation">Location</label>
          <input id="supplyLocation" name="location" placeholder="Pantry">
        </div>
        <div class="field">
          <label for="supplyStatus">Status</label>
          <select id="supplyStatus" name="status">
            ${supplyStatusOptions("stocked")}
          </select>
        </div>
        <div class="field full">
          <label for="supplyNotes">Notes</label>
          <textarea id="supplyNotes" name="notes" placeholder="Preferred size, brand, or context"></textarea>
        </div>
        <div class="field full">
          <button class="button" type="submit">Add supply</button>
        </div>
      </form>
    </div>
  `;
}

function renderSuggestSupplyPanel() {
  return `
    <div class="panel">
      <h2>Suggest supply need</h2>
      <form class="form-grid" data-form="suggest-supply">
        <div class="field">
          <label for="suggestName">Item</label>
          <input id="suggestName" name="name" required placeholder="2nd floor soap">
        </div>
        <div class="field">
          <label for="suggestCategory">Category</label>
          <input id="suggestCategory" name="category" required placeholder="Bathroom">
        </div>
        <div class="field full">
          <label for="suggestNote">Note</label>
          <textarea id="suggestNote" name="note" required placeholder="Where is it needed?"></textarea>
        </div>
        <div class="field full">
          <button class="button" type="submit">Send suggestion</button>
        </div>
      </form>
    </div>
  `;
}

function renderSupplySummary() {
  const priority = prioritySupplies();
  const restockSpend = state.supplies
    .flatMap((item) => item.restockLog)
    .reduce((sum, log) => sum + Number(log.cost || 0), 0);

  return `
    <div class="panel">
      <h2>Supply summary</h2>
      <div class="compact-list">
        <div class="comment"><strong>${priority.length}</strong> low, out, or review item${priority.length === 1 ? "" : "s"}</div>
        <div class="comment"><strong>$${restockSpend.toFixed(2)}</strong> tracked restock spend</div>
        <div class="comment"><strong>${state.supplies.reduce((sum, item) => sum + item.flags.length, 0)}</strong> member flag${state.supplies.reduce((sum, item) => sum + item.flags.length, 0) === 1 ? "" : "s"}</div>
      </div>
    </div>
  `;
}

function renderSupplyCard(item) {
  const meta = SUPPLY_STATUS[item.status] || SUPPLY_STATUS.needs_review;
  const priority = meta.weight + item.flags.length >= 3;
  return `
    <article class="supply-card">
      <div class="supply-top">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="subtle">${escapeHtml(item.category)}${item.location ? ` · ${escapeHtml(item.location)}` : ""}</p>
        </div>
        <span class="badge ${meta.className}">${escapeHtml(meta.label)}</span>
      </div>
      ${priority ? `<span class="priority">Priority</span>` : ""}
      ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
      <div class="compact-list">
        ${item.flags.length ? item.flags.slice(-3).reverse().map(renderSupplyFlag).join("") : `<p class="subtle">No active flags.</p>`}
      </div>
      ${
        ui.role === "manager"
          ? renderManagerSupplyControls(item)
          : renderMemberSupplyControls(item)
      }
    </article>
  `;
}

function renderSupplyFlag(flag) {
  const member = getMember(flag.memberId);
  return `
    <div class="comment">
      <strong>${escapeHtml(member.name)}</strong>
      <span class="subtle"> · ${escapeHtml(formatDateTime(flag.createdAt))}</span>
      ${flag.note ? `<p>${escapeHtml(flag.note)}</p>` : ""}
    </div>
  `;
}

function renderManagerSupplyControls(item) {
  return `
    <form class="inline-form" data-form="restock-supply" data-id="${item.id}">
      <div class="button-row">
        <button type="button" class="ghost-button" data-action="set-supply-status" data-id="${item.id}" data-status="stocked">Stocked</button>
        <button type="button" class="ghost-button" data-action="set-supply-status" data-id="${item.id}" data-status="low">Low</button>
        <button type="button" class="ghost-button" data-action="set-supply-status" data-id="${item.id}" data-status="out">Out</button>
      </div>
      <div class="grid-2">
        <input class="inline-input" name="cost" type="number" min="0" step="0.01" placeholder="Restock cost">
        <input class="inline-input" name="note" placeholder="Restock note">
      </div>
      <button class="success-button" type="submit">Mark restocked</button>
    </form>
  `;
}

function renderMemberSupplyControls(item) {
  return `
    <form class="inline-form" data-form="flag-supply" data-id="${item.id}">
      <select class="inline-input" name="status">
        ${supplyStatusOptions(item.status, ["low", "out", "needs_review"])}
      </select>
      <input class="inline-input" name="note" placeholder="Location note or product need">
      <button class="ghost-button" type="submit">Flag supply</button>
    </form>
  `;
}

function renderAccountability() {
  return `
    <section class="grid-2">
      <div class="panel">
        <div>
          <h2>Member performance</h2>
          <p class="subtle">Misses, late completions, strikes, and tracked fines.</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Assigned</th>
                <th>Approved</th>
                <th>Missed</th>
                <th>Late</th>
                <th>Strikes</th>
                <th>Open fines</th>
              </tr>
            </thead>
            <tbody>
              ${houseMembers().map(renderMemberRow).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ${renderFinePanel()}
    </section>
    <section class="panel">
      <h2>Strike and fine log</h2>
      <div class="list">
        ${renderStrikeFineLog()}
      </div>
    </section>
  `;
}

function renderMemberRow(member) {
  const chores = state.chores.filter((chore) => chore.assignedTo === member.id);
  const strikes = memberStrikes(member.id);
  const openFines = state.fines.filter((fine) => fine.memberId === member.id && fine.status === "unresolved");
  const openFineTotal = openFines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0);

  return `
    <tr>
      <td>${escapeHtml(member.name)}</td>
      <td>${chores.length}</td>
      <td>${chores.filter((chore) => chore.status === "approved" || chore.status === "completed_late").length}</td>
      <td>${chores.filter((chore) => chore.status === "missed" || chore.status === "completed_late" || chore.status === "submitted_late").length}</td>
      <td>${chores.filter((chore) => chore.status === "completed_late" || chore.status === "submitted_late").length}</td>
      <td>${strikes.length}${strikes.length >= 3 ? " / 3+" : ""}</td>
      <td>$${openFineTotal.toFixed(2)}</td>
    </tr>
  `;
}

function renderFinePanel() {
  return `
    <div class="panel">
      <h2>Track fine</h2>
      <form class="form-grid" data-form="add-fine">
        <div class="field">
          <label for="fineMember">Member</label>
          <select id="fineMember" name="memberId" required>${memberOptions()}</select>
        </div>
        <div class="field">
          <label for="fineAmount">Amount</label>
          <input id="fineAmount" name="amount" type="number" min="0" step="0.01" required placeholder="10.00">
        </div>
        <div class="field full">
          <label for="fineChore">Related chore</label>
          <select id="fineChore" name="choreId">
            <option value="">No related chore</option>
            ${state.chores.map((chore) => `<option value="${chore.id}">${escapeHtml(chore.title)} · ${escapeHtml(getMember(chore.assignedTo).name)}</option>`).join("")}
          </select>
        </div>
        <div class="field full">
          <label for="fineReason">Reason</label>
          <textarea id="fineReason" name="reason" required placeholder="Reason this fine is being tracked"></textarea>
        </div>
        <div class="field full">
          <button class="button" type="submit">Record fine</button>
        </div>
      </form>
    </div>
  `;
}

function renderStrikeFineLog() {
  const entries = [
    ...state.strikes.map((strike) => ({ type: "strike", date: strike.createdAt, item: strike })),
    ...state.fines.map((fine) => ({ type: "fine", date: fine.createdAt, item: fine })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!entries.length) {
    return emptyState("No strikes or fines recorded yet.");
  }

  return entries
    .map((entry) => {
      if (entry.type === "strike") {
        const strike = entry.item;
        const chore = getChore(strike.choreId);
        return `
          <div class="history-card">
            <div class="card-head">
              <div>
                <h3>Strike ${strike.countAtIssue} for ${escapeHtml(getMember(strike.memberId).name)}</h3>
                <p class="subtle">${escapeHtml(formatDateTime(strike.createdAt))}${chore ? ` · ${escapeHtml(chore.title)}` : ""}</p>
              </div>
              <span class="badge missed">Strike</span>
            </div>
            <p>${escapeHtml(strike.reason)}</p>
          </div>
        `;
      }

      const fine = entry.item;
      return `
        <div class="history-card">
          <div class="card-head">
            <div>
              <h3>$${Number(fine.amount).toFixed(2)} fine for ${escapeHtml(getMember(fine.memberId).name)}</h3>
              <p class="subtle">${escapeHtml(formatDateTime(fine.createdAt))} · ${escapeHtml(fine.status)}</p>
            </div>
            <span class="badge ${fine.status === "resolved" ? "approved" : "rejected"}">${escapeHtml(fine.status)}</span>
          </div>
          <p>${escapeHtml(fine.reason)}</p>
          ${
            fine.status === "unresolved"
              ? `<button type="button" class="ghost-button" data-action="resolve-fine" data-id="${fine.id}">Mark resolved</button>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

function renderMemberAccountability() {
  const strikes = memberStrikes(ui.activeMemberId);
  const fines = state.fines.filter((fine) => fine.memberId === ui.activeMemberId);
  return `
    <section class="stat-grid">
      <div class="stat"><span class="subtle">Lifetime strikes</span><strong>${strikes.length}</strong><span class="subtle">${strikes.length >= 3 ? "3+ strike threshold reached" : "Permanent total"}</span></div>
      <div class="stat"><span class="subtle">Tracked fines</span><strong>${fines.length}</strong><span class="subtle">No payments in app</span></div>
      <div class="stat"><span class="subtle">Open fine total</span><strong>$${fines.filter((fine) => fine.status === "unresolved").reduce((sum, fine) => sum + Number(fine.amount || 0), 0).toFixed(2)}</strong><span class="subtle">Manager tracked</span></div>
      <div class="stat"><span class="subtle">Missed chores</span><strong>${myChores().filter((chore) => chore.status === "missed" || chore.status === "completed_late" || chore.status === "submitted_late").length}</strong><span class="subtle">History total</span></div>
    </section>
    <section class="panel">
      <h2>My accountability log</h2>
      <div class="list">
        ${renderMemberLog(strikes, fines)}
      </div>
    </section>
  `;
}

function renderMemberLog(strikes, fines) {
  const entries = [
    ...strikes.map((strike) => ({ type: "strike", date: strike.createdAt, item: strike })),
    ...fines.map((fine) => ({ type: "fine", date: fine.createdAt, item: fine })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!entries.length) return emptyState("No strikes or fines for this member.");

  return entries
    .map((entry) => {
      if (entry.type === "strike") {
        const chore = getChore(entry.item.choreId);
        return `
          <div class="history-card">
            <h3>Strike ${entry.item.countAtIssue}</h3>
            <p class="subtle">${escapeHtml(formatDateTime(entry.item.createdAt))}${chore ? ` · ${escapeHtml(chore.title)}` : ""}</p>
            <p>${escapeHtml(entry.item.reason)}</p>
          </div>
        `;
      }
      return `
        <div class="history-card">
          <h3>$${Number(entry.item.amount).toFixed(2)} fine</h3>
          <p class="subtle">${escapeHtml(formatDateTime(entry.item.createdAt))} · ${escapeHtml(entry.item.status)}</p>
          <p>${escapeHtml(entry.item.reason)}</p>
        </div>
      `;
    })
    .join("");
}

function renderNotificationsPanel(userId) {
  const notifications = unreadNotifications(userId);
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Notifications</h2>
          <p class="subtle">In-app reminders and review updates.</p>
        </div>
        ${notifications.length ? `<button type="button" class="link-button" data-action="clear-notifications" data-user="${userId}">Mark read</button>` : ""}
      </div>
      <div class="list">
        ${
          notifications.length
            ? notifications.slice(0, 6).map((notification) => `
                <div class="notification-card">
                  <strong>${escapeHtml(notification.title)}</strong>
                  <p>${escapeHtml(notification.body)}</p>
                  <p class="subtle">${escapeHtml(formatDateTime(notification.createdAt))}</p>
                </div>
              `).join("")
            : emptyState("No unread notifications.")
        }
      </div>
    </div>
  `;
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  app.addEventListener("click", handleClick);
  app.addEventListener("change", handleChange);
  app.addEventListener("submit", handleSubmit);
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "set-role") {
    ui.role = target.dataset.role;
    ui.tab = "dashboard";
    ui.notice = "";
    render();
  }

  if (action === "set-tab") {
    ui.tab = target.dataset.tab;
    ui.notice = "";
    render();
  }

  if (action === "calendar-prev") {
    ui.calendarMonth = addMonths(new Date(ui.calendarMonth), -1).toISOString();
    ui.notice = "";
    render();
  }

  if (action === "calendar-next") {
    ui.calendarMonth = addMonths(new Date(ui.calendarMonth), 1).toISOString();
    ui.notice = "";
    render();
  }

  if (action === "calendar-today") {
    const today = new Date();
    ui.calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    ui.notice = "";
    render();
  }

  if (action === "open-calendar-chore") {
    const chore = getChore(target.dataset.id);
    if (!chore) return;
    ui.tab = "chores";
    ui.choreFilter = "all";
    ui.notice = `${chore.title} is due ${formatDateTime(chore.dueAt)}.`;
    render();
  }

  if (action === "send-reminder") {
    const chore = getChore(target.dataset.id);
    if (!chore) return;
    notify(chore.assignedTo, `Reminder: ${chore.title}`, `Due ${formatDateTime(chore.dueAt)}.`);
    ui.notice = `Reminder sent to ${getMember(chore.assignedTo).name}.`;
    render();
  }

  if (action === "duplicate-week") {
    duplicateCurrentWeek();
    ui.notice = "This week's chores were duplicated for next week with the same manual assignments.";
    render();
  }

  if (action === "set-supply-status") {
    const item = getSupply(target.dataset.id);
    if (!item) return;
    item.status = target.dataset.status;
    if (item.status === "stocked") item.flags = [];
    notify("manager", `${item.name} updated`, `Supply status changed to ${SUPPLY_STATUS[item.status].label}.`);
    ui.notice = `${item.name} marked ${SUPPLY_STATUS[item.status].label}.`;
    render();
  }

  if (action === "resolve-fine") {
    const fine = state.fines.find((entry) => entry.id === target.dataset.id);
    if (!fine) return;
    fine.status = "resolved";
    fine.resolvedAt = new Date().toISOString();
    notify(fine.memberId, "Fine resolved", `$${Number(fine.amount).toFixed(2)} fine marked resolved.`);
    ui.notice = "Fine marked resolved.";
    render();
  }

  if (action === "clear-notifications") {
    const userId = target.dataset.user;
    const now = new Date().toISOString();
    state.notifications.forEach((notification) => {
      if (notification.userId === userId) notification.readAt = now;
    });
    ui.notice = "Notifications marked read.";
    render();
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.dataset.action === "change-member") {
    ui.activeMemberId = target.value;
    ui.notice = "";
    render();
  }

  if (target.dataset.action === "change-chore-filter") {
    ui.choreFilter = target.value;
    ui.notice = "";
    render();
  }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();

  if (form.dataset.form === "create-chore") {
    createChore(form);
  }

  if (form.dataset.form === "edit-chore") {
    editChore(form);
  }

  if (form.dataset.form === "submit-chore") {
    await submitChore(form);
  }

  if (form.dataset.form === "review-chore") {
    reviewChore(form, event.submitter.value);
  }

  if (form.dataset.form === "comment") {
    addComment(form);
  }

  if (form.dataset.form === "add-supply") {
    addSupply(form);
  }

  if (form.dataset.form === "suggest-supply") {
    suggestSupply(form);
  }

  if (form.dataset.form === "flag-supply") {
    flagSupply(form);
  }

  if (form.dataset.form === "restock-supply") {
    restockSupply(form);
  }

  if (form.dataset.form === "add-fine") {
    addFine(form);
  }

  render();
}

function createChore(form) {
  const data = new FormData(form);
  const dueDate = new Date(data.get("dueAt"));
  const steps = String(data.get("steps") || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!steps.length) {
    ui.notice = "Add at least one step.";
    return;
  }

  const chore = {
    id: uid("chore"),
    title: String(data.get("title")).trim(),
    instructions: String(data.get("instructions") || "").trim(),
    steps: makeSteps(steps),
    assignedTo: String(data.get("assignedTo")),
    dueAt: dueDate.toISOString(),
    proofRequired: data.get("proofRequired") === "on",
    status: "assigned",
    createdAt: new Date().toISOString(),
    submissions: [],
    comments: [],
    review: null,
    strikeId: null,
    remindersSent: {},
  };

  state.chores.push(chore);
  notify(chore.assignedTo, "New chore assigned", `${chore.title} is due ${formatDateTime(chore.dueAt)}.`);
  ui.notice = `${chore.title} assigned to ${getMember(chore.assignedTo).name}.`;
}

function editChore(form) {
  const chore = getChore(form.dataset.id);
  if (!chore) return;

  const data = new FormData(form);
  const oldAssignedTo = chore.assignedTo;
  const oldDueAt = chore.dueAt;
  const steps = String(data.get("steps") || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!steps.length) {
    ui.notice = "Add at least one step.";
    return;
  }

  chore.title = String(data.get("title")).trim();
  chore.instructions = String(data.get("instructions") || "").trim();
  chore.steps = makeSteps(steps);
  chore.assignedTo = String(data.get("assignedTo"));
  chore.dueAt = new Date(data.get("dueAt")).toISOString();
  chore.proofRequired = data.get("proofRequired") === "on";

  if (oldDueAt !== chore.dueAt) {
    chore.remindersSent = {};
  }

  if (oldAssignedTo !== chore.assignedTo) {
    notify(chore.assignedTo, "Chore reassigned to you", `${chore.title} is due ${formatDateTime(chore.dueAt)}.`);
    notify(oldAssignedTo, "Chore reassigned", `${chore.title} is no longer assigned to you.`);
  }

  ui.notice = `${chore.title} updated.`;
}

async function submitChore(form) {
  const chore = getChore(form.dataset.id);
  if (!chore || chore.assignedTo !== ui.activeMemberId) return;

  const file = form.elements.photo.files[0];
  if (chore.proofRequired && !file) {
    ui.notice = "Photo proof is required for this chore.";
    return;
  }

  const now = new Date();
  const isLate = now > new Date(chore.dueAt) || chore.status === "missed";
  if (isLate && !chore.strikeId) {
    markChoreMissed(chore, "Submitted after the due date.");
  }

  const submission = {
    id: uid("submission"),
    memberId: ui.activeMemberId,
    submittedAt: now.toISOString(),
    notes: String(new FormData(form).get("notes") || "").trim(),
    photoData: file ? await fileToDataUrl(file) : "",
    late: isLate,
    stepChecks: chore.steps.map((step) => ({
      id: step.id,
      text: step.text,
      done: Boolean(form.elements[`step_${step.id}`] && form.elements[`step_${step.id}`].checked),
    })),
  };

  chore.submissions.unshift(submission);
  chore.status = isLate ? "submitted_late" : "submitted";
  chore.review = null;
  notify("manager", `${chore.title} submitted`, `${getMember(chore.assignedTo).name} submitted${isLate ? " late" : ""} proof.`);
  ui.notice = `${chore.title} submitted for manager review.`;
}

function reviewChore(form, decision) {
  const chore = getChore(form.dataset.id);
  if (!chore) return;

  const note = String(new FormData(form).get("reviewNote") || "").trim();
  const latest = latestSubmission(chore);
  const reviewedAt = new Date().toISOString();

  chore.review = { decision, note, reviewedAt };

  if (decision === "approved") {
    const late = chore.status === "submitted_late" || (latest && latest.late);
    chore.status = late ? "completed_late" : "approved";
    notify(chore.assignedTo, `${chore.title} approved`, note || "Manager approved the chore.");
    ui.notice = `${chore.title} approved.`;
    return;
  }

  if (new Date() > new Date(chore.dueAt)) {
    markChoreMissed(chore, note || "Rejected after the due date.");
  } else {
    chore.status = "rejected";
  }

  notify(chore.assignedTo, `${chore.title} rejected`, note || "Manager rejected the submission.");
  ui.notice = `${chore.title} rejected.`;
}

function addComment(form) {
  const chore = getChore(form.dataset.id);
  if (!chore) return;

  const body = String(new FormData(form).get("comment") || "").trim();
  if (!body) return;

  const userId = ui.role === "manager" ? "manager" : ui.activeMemberId;
  const author = getMember(userId);
  chore.comments.push({
    id: uid("comment"),
    authorId: userId,
    authorName: author.name,
    body,
    createdAt: new Date().toISOString(),
  });

  const targetUser = ui.role === "manager" ? chore.assignedTo : "manager";
  notify(targetUser, `Comment on ${chore.title}`, `${author.name}: ${body}`);
  ui.notice = "Comment added.";
}

function addSupply(form) {
  const data = new FormData(form);
  const item = {
    id: uid("supply"),
    name: String(data.get("name")).trim(),
    category: String(data.get("category")).trim(),
    location: String(data.get("location") || "").trim(),
    status: String(data.get("status")),
    notes: String(data.get("notes") || "").trim(),
    flags: [],
    restockLog: [],
    createdAt: new Date().toISOString(),
  };
  state.supplies.push(item);
  ui.notice = `${item.name} added to supplies.`;
}

function suggestSupply(form) {
  const data = new FormData(form);
  const member = getMember(ui.activeMemberId);
  const item = {
    id: uid("supply"),
    name: String(data.get("name")).trim(),
    category: String(data.get("category")).trim(),
    location: "",
    status: "needs_review",
    notes: "",
    flags: [
      {
        id: uid("flag"),
        memberId: ui.activeMemberId,
        note: String(data.get("note") || "").trim(),
        createdAt: new Date().toISOString(),
      },
    ],
    restockLog: [],
    createdAt: new Date().toISOString(),
  };
  state.supplies.push(item);
  notify("manager", `${member.name} suggested ${item.name}`, item.flags[0].note || "New supply suggestion.");
  ui.notice = "Supply suggestion sent to manager.";
}

function flagSupply(form) {
  const item = getSupply(form.dataset.id);
  if (!item) return;

  const data = new FormData(form);
  const status = String(data.get("status"));
  const note = String(data.get("note") || "").trim();
  item.status = status;
  item.flags.push({
    id: uid("flag"),
    memberId: ui.activeMemberId,
    note,
    createdAt: new Date().toISOString(),
  });

  notify("manager", `${item.name} flagged`, `${getMember(ui.activeMemberId).name} marked it ${SUPPLY_STATUS[status].label}.`);
  ui.notice = `${item.name} flagged.`;
}

function restockSupply(form) {
  const item = getSupply(form.dataset.id);
  if (!item) return;

  const data = new FormData(form);
  item.status = "stocked";
  item.flags = [];
  item.restockLog.push({
    id: uid("restock"),
    date: new Date().toISOString(),
    cost: Number(data.get("cost") || 0),
    note: String(data.get("note") || "").trim(),
  });

  ui.notice = `${item.name} marked restocked.`;
}

function addFine(form) {
  const data = new FormData(form);
  const fine = {
    id: uid("fine"),
    memberId: String(data.get("memberId")),
    amount: Number(data.get("amount") || 0),
    reason: String(data.get("reason") || "").trim(),
    choreId: String(data.get("choreId") || ""),
    status: "unresolved",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  state.fines.push(fine);
  notify(fine.memberId, "Fine recorded", `$${fine.amount.toFixed(2)} fine tracked by manager.`);
  ui.notice = "Fine recorded.";
}

function applyDueRules() {
  const now = new Date();
  state.chores.forEach((chore) => {
    const due = new Date(chore.dueAt);
    if (now <= due) return;

    if (chore.status === "assigned") {
      markChoreMissed(chore, "Due date passed without submission.");
    }

    if (chore.status === "rejected") {
      markChoreMissed(chore, "Rejected chore was not corrected before the due date.");
    }
  });
}

function applyReminderRules() {
  const now = new Date();
  state.chores.forEach((chore) => {
    if (!["assigned", "rejected"].includes(chore.status)) return;

    const msUntilDue = new Date(chore.dueAt) - now;
    if (msUntilDue <= 0) return;

    chore.remindersSent = chore.remindersSent || {};
    if (msUntilDue <= 24 * 60 * 60 * 1000 && !chore.remindersSent.due24) {
      notify(chore.assignedTo, `Due soon: ${chore.title}`, `Due ${formatDateTime(chore.dueAt)}.`);
      chore.remindersSent.due24 = new Date().toISOString();
    }

    if (msUntilDue <= 2 * 60 * 60 * 1000 && !chore.remindersSent.due2) {
      notify(chore.assignedTo, `Due in 2 hours: ${chore.title}`, `Due ${formatDateTime(chore.dueAt)}.`);
      chore.remindersSent.due2 = new Date().toISOString();
    }
  });
}

function runAutomationAndRenderIfChanged() {
  const before = JSON.stringify({
    chores: state.chores.map((chore) => ({
      id: chore.id,
      status: chore.status,
      strikeId: chore.strikeId,
      remindersSent: chore.remindersSent || {},
    })),
    strikes: state.strikes.length,
    notifications: state.notifications.length,
  });

  applyReminderRules();
  applyDueRules();

  const after = JSON.stringify({
    chores: state.chores.map((chore) => ({
      id: chore.id,
      status: chore.status,
      strikeId: chore.strikeId,
      remindersSent: chore.remindersSent || {},
    })),
    strikes: state.strikes.length,
    notifications: state.notifications.length,
  });

  if (before !== after) {
    saveState();
    render();
  }
}

function markChoreMissed(chore, reason) {
  if (!chore.strikeId) {
    const strike = createStrike(chore.assignedTo, chore.id, reason);
    chore.strikeId = strike.id;
  }
  chore.status = "missed";
}

function createStrike(memberId, choreId, reason) {
  const countAtIssue = memberStrikes(memberId).length + 1;
  const strike = {
    id: uid("strike"),
    memberId,
    choreId,
    reason,
    countAtIssue,
    createdAt: new Date().toISOString(),
  };
  state.strikes.push(strike);
  const chore = getChore(choreId);
  notify(memberId, `Strike ${countAtIssue} recorded`, `${chore ? chore.title : "Chore"}: ${reason}`);
  notify("manager", `Strike recorded for ${getMember(memberId).name}`, `${chore ? chore.title : "Chore"}: ${reason}`);
  return strike;
}

function duplicateCurrentWeek() {
  const nextWeekChores = state.chores
    .filter((chore) => isCurrentWeek(chore.dueAt))
    .map((chore) => ({
      ...chore,
      id: uid("chore"),
      dueAt: addDays(new Date(chore.dueAt), 7).toISOString(),
      status: "assigned",
      createdAt: new Date().toISOString(),
      submissions: [],
      comments: [],
      review: null,
      strikeId: null,
      remindersSent: {},
    }));

  nextWeekChores.forEach((chore) => {
    state.chores.push(chore);
    notify(chore.assignedTo, "Next week chore assigned", `${chore.title} is due ${formatDateTime(chore.dueAt)}.`);
  });
}

function managerStats() {
  return {
    open: state.chores.filter((chore) => chore.status === "assigned" || chore.status === "rejected").length,
    review: reviewQueue().length,
    missed: state.chores.filter((chore) => chore.status === "missed" || chore.status === "completed_late" || chore.status === "submitted_late").length,
    supplies: prioritySupplies().length,
  };
}

function reviewQueue() {
  return state.chores.filter((chore) => chore.status === "submitted" || chore.status === "submitted_late").sort(sortByDueAsc);
}

function missedChores() {
  return state.chores
    .filter((chore) => chore.status === "missed" || chore.status === "completed_late" || chore.status === "submitted_late")
    .sort(sortByDueDesc);
}

function filteredChores() {
  let chores = [...state.chores];
  if (ui.choreFilter === "current") chores = chores.filter((chore) => isCurrentWeek(chore.dueAt));
  if (ui.choreFilter === "open") chores = chores.filter((chore) => ["assigned", "rejected", "submitted", "submitted_late"].includes(chore.status));
  if (ui.choreFilter === "problem") chores = chores.filter((chore) => ["missed", "rejected", "submitted_late", "completed_late"].includes(chore.status));
  return chores.sort(sortByDueAsc);
}

function myChores() {
  return state.chores.filter((chore) => chore.assignedTo === ui.activeMemberId).sort(sortByDueAsc);
}

function myOpenChores() {
  return myChores().filter((chore) => ["assigned", "rejected", "missed"].includes(chore.status));
}

function canMemberSubmit(chore) {
  return ["assigned", "rejected", "missed"].includes(chore.status);
}

function prioritySupplies() {
  return state.supplies.filter((item) => item.status !== "stocked" || item.flags.length > 0);
}

function calendarVisibleChores() {
  const chores = ui.role === "manager" ? state.chores : state.chores.filter((chore) => chore.assignedTo === ui.activeMemberId);
  return chores.slice().sort(sortByDueAsc);
}

function calendarChoresForMonth() {
  const monthDate = new Date(ui.calendarMonth);
  return calendarVisibleChores().filter((chore) => {
    const due = new Date(chore.dueAt);
    return due.getFullYear() === monthDate.getFullYear() && due.getMonth() === monthDate.getMonth();
  });
}

function calendarChoresForDay(day) {
  return calendarVisibleChores().filter((chore) => isSameDay(new Date(chore.dueAt), day));
}

function unreadNotifications(userId) {
  return state.notifications
    .filter((notification) => notification.userId === userId && !notification.readAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function notify(userId, title, body) {
  state.notifications.push({
    id: uid("notification"),
    userId,
    title,
    body,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function latestSubmission(chore) {
  return chore.submissions[0] || null;
}

function houseMembers() {
  return state.members.filter((member) => member.role === "member");
}

function firstMemberId() {
  return houseMembers()[0] ? houseMembers()[0].id : "";
}

function memberOptions(selectedId = "") {
  return houseMembers()
    .map((member) => `<option value="${member.id}" ${member.id === selectedId ? "selected" : ""}>${escapeHtml(member.name)}</option>`)
    .join("");
}

function memberStrikes(memberId) {
  return state.strikes.filter((strike) => strike.memberId === memberId);
}

function getMember(id) {
  return state.members.find((member) => member.id === id) || { id, name: "Unknown", role: "member" };
}

function getChore(id) {
  return state.chores.find((chore) => chore.id === id);
}

function getSupply(id) {
  return state.supplies.find((item) => item.id === id);
}

function supplyStatusOptions(selected, allowed = Object.keys(SUPPLY_STATUS)) {
  return allowed
    .map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${escapeHtml(SUPPLY_STATUS[status].label)}</option>`)
    .join("");
}

function makeSteps(lines) {
  return lines.map((text) => ({ id: uid("step"), text }));
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addHours(date, hours) {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

function addMonths(date, months) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function setTime(date, hours, minutes) {
  const copy = new Date(date);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

function weekStart(dateInput) {
  const date = new Date(dateInput);
  const day = date.getDay();
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function isCurrentWeek(dateInput) {
  return weekStart(dateInput).toDateString() === weekStart(new Date()).toDateString();
}

function monthStart(dateInput) {
  const date = new Date(dateInput);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(dateInput) {
  const date = new Date(dateInput);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function calendarDays(dateInput) {
  const start = weekStart(monthStart(dateInput));
  const end = addDays(weekStart(monthEnd(dateInput)), 6);
  const days = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

function isSameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function weekLabel(dateInput) {
  const start = weekStart(dateInput);
  const end = addDays(start, 6);
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function currentWeekLabel() {
  return `Week of ${weekLabel(new Date())}`;
}

function formatDateTime(dateInput) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateInput));
}

function formatMonth(dateInput) {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(dateInput));
}

function formatShortDate(dateInput) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(dateInput));
}

function formatTime(dateInput) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(dateInput));
}

function toLocalInputValue(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

function sortByDueAsc(a, b) {
  return new Date(a.dueAt) - new Date(b.dueAt);
}

function sortByDueDesc(a, b) {
  return new Date(b.dueAt) - new Date(a.dueAt);
}

function sortSupplies(a, b) {
  const aScore = (SUPPLY_STATUS[a.status] || SUPPLY_STATUS.needs_review).weight * 10 + a.flags.length;
  const bScore = (SUPPLY_STATUS[b.status] || SUPPLY_STATUS.needs_review).weight * 10 + b.flags.length;
  return bScore - aScore || a.name.localeCompare(b.name);
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
