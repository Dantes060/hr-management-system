const workflowStages = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Interview Scheduled",
  "Interview Completed",
  "Selected",
  "Offer Sent",
  "Offer Accepted",
  "Onboarding",
  "Hired",
];
const terminalStatuses = ["Offer Declined", "Rejected", "Withdrawn"];
const statusOptions = [...workflowStages, ...terminalStatuses];
const interviewStatuses = new Set(["Interview Scheduled", "Interview Completed"]);
const offerStatuses = new Set(["Offer Sent", "Offer Accepted", "Offer Declined"]);
const onboardingChecklistItems = [
  ["documents_received", "Required documents received"],
  ["contract_signed", "Employment contract signed"],
  ["orientation_scheduled", "Orientation scheduled"],
  ["account_setup", "Work account and access prepared"],
];
const allowedStageTransitions = {
  Applied: ["Screening"],
  Screening: ["Shortlisted"],
  Shortlisted: ["Interview Scheduled"],
  "Interview Scheduled": ["Interview Completed"],
  "Interview Completed": ["Selected"],
  Selected: ["Offer Sent"],
  "Offer Sent": [],
  "Offer Accepted": ["Onboarding"],
  Onboarding: ["Hired"],
  Hired: [],
  "Offer Declined": [],
  Rejected: [],
  Withdrawn: [],
};
const acceptedCvTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const maxCvSize = 5 * 1024 * 1024;

const supabaseConfig = window.HIREFLOW_SUPABASE || {};
const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseConfig.url || "");
const supabaseReady = Boolean(
  window.supabase &&
    normalizedSupabaseUrl &&
    supabaseConfig.anonKey &&
    !normalizedSupabaseUrl.includes("YOUR_SUPABASE") &&
    !supabaseConfig.anonKey.includes("YOUR_SUPABASE")
);
const db = supabaseReady ? window.supabase.createClient(normalizedSupabaseUrl, supabaseConfig.anonKey) : null;

let state = {
  authUser: null,
  profile: null,
  profiles: [],
  jobs: [],
  applications: [],
  applicationEvents: [],
  applicationNotes: {},
};
let authMode = "signup";
let activePanel = "overview";
let sidebarOpen = false;
let hrFilters = {
  jobId: "all",
  status: "all",
  query: "",
};
let hrJobFilter = "all";
let hrJobQuery = "";
let candidateView = "table";

const views = {
  landing: document.querySelector("#landing-view"),
  auth: document.querySelector("#auth-view"),
  app: document.querySelector("#app-view"),
};

const elements = {
  bootScreen: document.querySelector("#boot-screen"),
  toastRegion: document.querySelector("#toast-region"),
  authForm: document.querySelector("#auth-form"),
  signupFields: document.querySelector("#signup-fields"),
  authName: document.querySelector("#auth-name"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authMessage: document.querySelector("#auth-message"),
  authTitle: document.querySelector("[data-auth-title]"),
  authCopy: document.querySelector("[data-auth-copy]"),
  authEyebrow: document.querySelector("[data-auth-eyebrow]"),
  authSubmit: document.querySelector("[data-auth-submit]"),
  authSwitch: document.querySelector("[data-auth-switch]"),
  authSwitchCopy: document.querySelector("[data-auth-switch-copy]"),
  userInitials: document.querySelectorAll("[data-user-initials]"),
  userName: document.querySelector("[data-user-name]"),
  userRole: document.querySelector("[data-user-role]"),
  appNav: document.querySelector("#app-nav"),
  dashboardLabel: document.querySelector("[data-dashboard-label]"),
  dashboardTitle: document.querySelector("[data-dashboard-title]"),
  dashboardDescription: document.querySelector("[data-dashboard-description]"),
  topbarPrimaryAction: document.querySelector("#topbar-primary-action"),
  dashboardNotifications: document.querySelector("#dashboard-notifications"),
  notificationCount: document.querySelector("#notification-count"),
  notificationPopover: document.querySelector("#notification-popover"),
  notificationList: document.querySelector("#notification-list"),
  dashboardLoading: document.querySelector("#dashboard-loading"),
  hrDashboard: document.querySelector("#hr-dashboard"),
  applicantDashboard: document.querySelector("#applicant-dashboard"),
  logoutButton: document.querySelector("#logout-button"),
  openSidebar: document.querySelector("#open-sidebar"),
  closeSidebar: document.querySelector("#close-sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  jobDialog: document.querySelector("#job-dialog"),
  closeJobDialog: document.querySelector("#close-job-dialog"),
  cancelJobDialog: document.querySelector("#cancel-job-dialog"),
  jobForm: document.querySelector("#job-form"),
  jobMessage: document.querySelector("#job-message"),
  jobSearch: document.querySelector("#job-search"),
  hrJobsList: document.querySelector("#hr-jobs-list"),
  hrApplicationsList: document.querySelector("#hr-applications-list"),
  hrPipelineBoard: document.querySelector("#hr-pipeline-board"),
  hrOverviewPipeline: document.querySelector("#hr-overview-pipeline"),
  hrOverviewRecent: document.querySelector("#hr-overview-recent"),
  hrUpcomingInterviews: document.querySelector("#hr-upcoming-interviews"),
  hrJobsAttention: document.querySelector("#hr-jobs-attention"),
  hrRecentActivity: document.querySelector("#hr-recent-activity"),
  hrInterviewsList: document.querySelector("#hr-interviews-list"),
  interviewCountScheduled: document.querySelector("#interview-count-scheduled"),
  interviewCountPending: document.querySelector("#interview-count-pending"),
  interviewCountWeek: document.querySelector("#interview-count-week"),
  candidateTableView: document.querySelector("#candidate-table-view"),
  candidatePipelineView: document.querySelector("#candidate-pipeline-view"),
  activeFilterChips: document.querySelector("#active-filter-chips"),
  hrFilterJob: document.querySelector("#hr-filter-job"),
  hrFilterStatus: document.querySelector("#hr-filter-status"),
  hrFilterSearch: document.querySelector("#hr-filter-search"),
  applicantJobsList: document.querySelector("#applicant-jobs-list"),
  myApplicationsList: document.querySelector("#my-applications-list"),
  profileForm: document.querySelector("#profile-form"),
  profileMessage: document.querySelector("#profile-message"),
  profileCvFile: document.querySelector("#profile-cv-file"),
  profileCvCurrent: document.querySelector("#profile-cv-current"),
  profileCompletionValue: document.querySelector("#profile-completion-value"),
  profileCompletionBar: document.querySelector("#profile-completion-bar"),
  applicationDialog: document.querySelector("#application-dialog"),
  applicationForm: document.querySelector("#application-form"),
  applicationTitle: document.querySelector("#application-title"),
  applicationJobId: document.querySelector("#application-job-id"),
  applicationCover: document.querySelector("#application-cover"),
  applicationMessage: document.querySelector("#application-message"),
  applicationDetailDialog: document.querySelector("#application-detail-dialog"),
  applicationDetailTitle: document.querySelector("#application-detail-title"),
  applicationDetailBody: document.querySelector("#application-detail-body"),
  closeApplicationDetailDialog: document.querySelector("#close-application-detail-dialog"),
  offerLetterDialog: document.querySelector("#offer-letter-dialog"),
  offerLetterTitle: document.querySelector("#offer-letter-title"),
  offerLetterBody: document.querySelector("#offer-letter-body"),
  closeOfferLetterDialog: document.querySelector("#close-offer-letter-dialog"),
  printOfferLetter: document.querySelector("#print-offer-letter"),
  doneOfferLetter: document.querySelector("#done-offer-letter"),
};

function normalizeSupabaseUrl(url) {
  return String(url)
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/auth\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function showView(name) {
  Object.values(views).forEach((view) => view?.classList.remove("is-active"));
  views[name]?.classList.add("is-active");
  document.body.dataset.view = name;
  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function showLandingSection(sectionId) {
  showView("landing");
  requestAnimationFrame(() => {
    document.querySelector(`#${CSS.escape(sectionId)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function showAuth(mode) {
  authMode = mode;
  setMessage(elements.authMessage, "");

  const isSignup = mode === "signup";
  elements.signupFields.hidden = !isSignup;
  elements.authName.required = isSignup;
  elements.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
  elements.authTitle.textContent = isSignup ? "Start your applicant profile" : "Welcome back";
  elements.authEyebrow.textContent = isSignup ? "Create applicant account" : "Secure sign in";
  elements.authCopy.textContent = isSignup
    ? "Create your account to browse roles, submit applications, and track each hiring stage."
    : "Applicants and authorized HR managers can sign in with their account credentials.";
  elements.authSubmit.textContent = isSignup ? "Create account" : "Sign in";
  elements.authSwitchCopy.textContent = isSignup ? "Already have an account?" : "Need an applicant account?";
  elements.authSwitch.textContent = isSignup ? "Sign in" : "Create account";
  showView("auth");

  if (!supabaseReady) {
    setMessage(
      elements.authMessage,
      "Supabase is not configured. Add your project URL and anon key in supabase-config.js.",
      true
    );
  }
}

async function routeTo(route) {
  if (route === "landing") {
    showView("landing");
    return;
  }

  if (route === "signup" || route === "signin") {
    showAuth(route);
    return;
  }

  if (route !== "app") return;

  if (!supabaseReady) {
    showAuth("signin");
    return;
  }

  showView("app");
  setDashboardLoading(true);

  try {
    await loadCurrentSession();
    if (!state.authUser || !state.profile) {
      showAuth("signin");
      return;
    }

    setDefaultPanelFromProfile();
    await loadDashboardData();
    renderApp();
  } catch (error) {
    console.error(error);
    showToast("Unable to load workspace", friendlyError(error), true);
  } finally {
    setDashboardLoading(false);
  }
}

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function showToast(title, message = "", isError = false) {
  if (!elements.toastRegion) return;

  const toast = document.createElement("div");
  toast.className = `toast${isError ? " is-error" : ""}`;
  toast.innerHTML = `
    <div class="toast-content"><strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ""}</div>
    <button type="button" aria-label="Dismiss notification">×</button>
  `;

  const removeToast = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    window.setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector("button").addEventListener("click", removeToast);
  elements.toastRegion.appendChild(toast);
  window.setTimeout(removeToast, isError ? 7000 : 4500);
}

function setDashboardLoading(isLoading) {
  if (!elements.dashboardLoading) return;
  elements.dashboardLoading.hidden = !isLoading;
  elements.hrDashboard.hidden = isLoading;
  elements.applicantDashboard.hidden = isLoading;
}

async function runWithFormBusy(form, action) {
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => {
    button.dataset.originalText ||= button.textContent;
    button.textContent = "Working…";
    button.disabled = true;
  });

  try {
    await action();
  } catch (error) {
    console.error(error);
    showToast("Something went wrong", friendlyError(error), true);
  } finally {
    buttons.forEach((button) => {
      button.textContent = button.dataset.originalText;
      button.disabled = false;
    });
  }
}

async function requireSupabase() {
  if (supabaseReady) return true;
  showAuth("signin");
  return false;
}

async function loadCurrentSession() {
  if (!supabaseReady) return;

  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError || !sessionData.session) {
    state.authUser = null;
    state.profile = null;
    return;
  }

  state.authUser = sessionData.session.user;
  await loadProfile();
}

async function loadProfile() {
  if (!state.authUser) return;

  const { data, error } = await db.from("profiles").select("*").eq("id", state.authUser.id).single();
  if (error) {
    console.error(error);
    state.profile = null;
    return;
  }

  state.profile = data;
}

async function ensureApplicantProfile(fullName) {
  const { error } = await db.from("profiles").upsert(
    {
      id: state.authUser.id,
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
  await loadProfile();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!(await requireSupabase())) return;

  setMessage(elements.authMessage, "");
  clearInvalidState(elements.authForm);

  const email = elements.authEmail.value.trim().toLowerCase();
  const password = elements.authPassword.value;

  if (authMode === "signup") {
    const fullName = elements.authName.value.trim();

    if (!fullName || !email || password.length < 8 || !elements.authForm.checkValidity()) {
      markInvalidFields(elements.authForm);
      setMessage(elements.authMessage, "Enter your name, a valid email, and a password of at least 8 characters.", true);
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setMessage(elements.authMessage, error.message, true);
      return;
    }

    if (!data.session) {
      setMessage(elements.authMessage, "Account created. Check your email to confirm it, then sign in.");
      showToast("Account created", "Check your inbox to confirm your email address.");
      elements.authForm.reset();
      return;
    }

    state.authUser = data.user;
    await ensureApplicantProfile(fullName);
    elements.authForm.reset();
    showToast("Welcome to HireFlow", "Your applicant account is ready.");
    await routeTo("app");
    return;
  }

  if (!email || !password || !elements.authForm.checkValidity()) {
    markInvalidFields(elements.authForm);
    setMessage(elements.authMessage, "Enter your email and password.", true);
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage(elements.authMessage, "The email or password is incorrect.", true);
    return;
  }

  state.authUser = data.user;
  elements.authForm.reset();
  await routeTo("app");
}

async function loadDashboardData() {
  const applicationQuery =
    state.profile.role === "hr"
      ? db.from("applications").select("*").order("created_at", { ascending: false })
      : db
          .from("applications")
          .select("*")
          .eq("applicant_id", state.profile.id)
          .order("created_at", { ascending: false });

  const eventQuery = db.from("application_events").select("*").order("created_at", { ascending: false });
  const notesQuery = state.profile.role === "hr"
    ? db.from("application_private_notes").select("*")
    : Promise.resolve({ data: [], error: null });

  const [jobsResult, applicationsResult, eventsResult, notesResult] = await Promise.all([
    db.from("jobs").select("*").order("created_at", { ascending: false }),
    applicationQuery,
    eventQuery,
    notesQuery,
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (applicationsResult.error) throw applicationsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (notesResult.error) throw notesResult.error;

  state.jobs = jobsResult.data || [];
  state.applications = applicationsResult.data || [];
  state.applicationEvents = eventsResult.data || [];
  state.applicationNotes = Object.fromEntries((notesResult.data || []).map((item) => [item.application_id, item.notes || ""]));
  await loadVisibleProfiles();
}

async function loadVisibleProfiles() {
  if (state.profile.role !== "hr" || !state.applications.length) {
    state.profiles = state.profile ? [state.profile] : [];
    return;
  }

  const ids = [...new Set(state.applications.map((application) => application.applicant_id))];
  const { data, error } = await db.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  state.profiles = data || [];
}

function setDefaultPanelFromProfile() {
  if (!state.profile) return;
  let hashPanel = window.location.hash.match(/^#app\/(.+)$/)?.[1];
  if (hashPanel === "applications") hashPanel = "candidates";
  const allowed = state.profile.role === "hr" ? ["overview", "jobs", "candidates", "interviews"] : ["profile", "jobs", "my-applications"];
  activePanel = allowed.includes(hashPanel) ? hashPanel : allowed[0];
}

function renderApp() {
  const profile = state.profile;
  if (!profile) return;

  const allowedPanels = profile.role === "hr" ? ["overview", "jobs", "candidates", "interviews"] : ["profile", "jobs", "my-applications"];
  if (!allowedPanels.includes(activePanel)) activePanel = allowedPanels[0];

  elements.userInitials.forEach((item) => {
    item.textContent = getInitials(profile.full_name || "User");
  });
  elements.userName.textContent = profile.full_name || "User";
  elements.userRole.textContent = profile.role === "hr" ? "HR Manager" : "Applicant";
  elements.dashboardNotifications.hidden = profile.role !== "hr";
  if (profile.role !== "hr") elements.notificationPopover.hidden = true;

  elements.hrDashboard.classList.toggle("is-active", profile.role === "hr");
  elements.applicantDashboard.classList.toggle("is-active", profile.role === "applicant");
  elements.hrDashboard.hidden = profile.role !== "hr";
  elements.applicantDashboard.hidden = profile.role !== "applicant";

  renderNavigation(profile.role);
  updatePanelVisibility(profile.role);
  updateTopbar(profile.role);

  if (profile.role === "hr") {
    renderHrDashboard();
  } else {
    renderApplicantDashboard(profile);
  }
}

function navigationIcon(name) {
  const icons = {
    overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    jobs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/></svg>',
    candidates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    interviews: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="m9 15 2 2 4-4"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    applications: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l3 3v15H4V3h3Z"/><path d="M8 11h8M8 15h8M8 7h4"/></svg>',
  };
  return icons[name] || icons.overview;
}

function renderNavigation(role) {
  if (role === "hr") {
    const workspaceItems = [
      ["overview", "Overview", "overview"],
      ["jobs", "Jobs", "jobs"],
      ["candidates", "Candidates", "candidates"],
      ["interviews", "Interviews", "interviews"],
    ];

    elements.appNav.innerHTML = `
      <span class="app-nav-label">Workspace</span>
      ${workspaceItems
        .map(
          ([panel, label, icon]) =>
            `<button type="button" class="${activePanel === panel ? "is-active" : ""}" data-panel-target="${panel}">${navigationIcon(icon)}<span>${escapeHtml(label)}</span></button>`
        )
        .join("")}
      <span class="app-nav-label app-nav-label-spaced">Organization</span>
      <button type="button" class="nav-disabled" aria-disabled="true" title="Coming in the next phase">${navigationIcon("candidates")}<span>Team</span><small>Soon</small></button>
      <button type="button" class="nav-disabled" aria-disabled="true" title="Coming in the next phase">${navigationIcon("applications")}<span>Settings</span><small>Soon</small></button>
    `;
    return;
  }

  const items = [
    ["profile", "My profile", "profile"],
    ["jobs", "Browse jobs", "jobs"],
    ["my-applications", "My applications", "applications"],
  ];
  elements.appNav.innerHTML = items
    .map(
      ([panel, label, icon]) =>
        `<button type="button" class="${activePanel === panel ? "is-active" : ""}" data-panel-target="${panel}">${navigationIcon(icon)}<span>${escapeHtml(label)}</span></button>`
    )
    .join("");
}

function updatePanelVisibility(role) {
  const activeDashboard = role === "hr" ? elements.hrDashboard : elements.applicantDashboard;
  activeDashboard.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== activePanel;
  });
}

function updateTopbar(role) {
  const hrCopy = {
    overview: ["HR workspace", "Overview", "Monitor vacancies, candidates, interviews, and hiring outcomes."],
    jobs: ["Recruitment", "Jobs", "Manage published roles and create new opportunities."],
    candidates: ["Recruitment", "Candidates", "Review applicants and move hiring decisions forward."],
    interviews: ["Recruitment", "Interviews", "Schedule interviews, record outcomes, and move shortlisted candidates forward."],
  };
  const applicantCopy = {
    profile: ["Applicant portal", "My profile", "Keep your details and CV ready for new opportunities."],
    jobs: ["Applicant portal", "Browse open jobs", "Discover roles that are currently accepting applications."],
    "my-applications": ["Applicant portal", "My applications", "Track screening, interviews, offers, onboarding, and final decisions."],
  };

  const copy = (role === "hr" ? hrCopy : applicantCopy)[activePanel];
  elements.dashboardLabel.textContent = copy[0];
  elements.dashboardTitle.textContent = copy[1];
  elements.dashboardDescription.textContent = copy[2];

  const actionMap =
    role === "hr"
      ? {
          overview: { label: "Create job", action: "open-job-dialog" },
          jobs: { label: "Create job", action: "open-job-dialog" },
          candidates: { label: "View interviews", panel: "interviews" },
          interviews: { label: "Review candidates", panel: "candidates" },
        }
      : {
          profile: { label: "Browse jobs", panel: "jobs" },
          jobs: { label: "View applications", panel: "my-applications" },
          "my-applications": { label: "Browse jobs", panel: "jobs" },
        };

  const config = actionMap[activePanel];
  elements.topbarPrimaryAction.hidden = !config;
  elements.topbarPrimaryAction.textContent = config?.label || "";
  elements.topbarPrimaryAction.dataset.targetPanel = config?.panel || "";
  elements.topbarPrimaryAction.dataset.action = config?.action || "";
}

function setActivePanel(panel, shouldScroll = true) {
  activePanel = panel;
  window.history.replaceState(null, "", `#app/${panel}`);
  renderApp();
  closeMobileSidebar();
  if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHrDashboard() {
  const openJobs = state.jobs.filter((job) => job.status === "Open").length;
  const interviewCandidates = state.applications.filter((application) => interviewStatuses.has(application.status));
  const hired = state.applications.filter((application) => application.status === "Hired").length;
  const closingSoon = state.jobs.filter((job) => job.status === "Open" && daysUntil(job.deadline) >= 0 && daysUntil(job.deadline) <= 7).length;
  const recentApplications = state.applications.filter((application) => isWithinDays(application.created_at, 7)).length;
  const scheduledInterviews = interviewCandidates.filter((application) => application.status === "Interview Scheduled" && application.interview_date).length;

  document.querySelector("#hr-open-jobs").textContent = openJobs;
  document.querySelector("#hr-applications").textContent = state.applications.length;
  document.querySelector("#hr-interviews").textContent = interviewCandidates.length;
  document.querySelector("#hr-hired").textContent = hired;
  document.querySelector("#hr-open-jobs-note").textContent = closingSoon ? `${closingSoon} closing within 7 days` : "Currently accepting applications";
  document.querySelector("#hr-applications-note").textContent = recentApplications ? `${recentApplications} received in the last 7 days` : "Across every vacancy";
  document.querySelector("#hr-interviews-note").textContent = scheduledInterviews ? `${scheduledInterviews} scheduled conversations` : "No interviews scheduled yet";
  document.querySelector("#hr-hired-note").textContent = hired ? "Successful decisions recorded" : "No completed hires yet";

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.querySelector("#hr-greeting").textContent = `${greeting}, ${firstName(state.profile.full_name)}`;
  document.querySelector("#overview-date-day").textContent = new Intl.DateTimeFormat("en", { weekday: "short" }).format(now);
  document.querySelector("#overview-date-full").textContent = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(now);

  renderHrOverview();
  renderHrJobs();
  renderHrApplications();
  renderHrInterviews();
  renderNotifications();
}

function renderHrOverview() {
  const maxCount = Math.max(...statusOptions.map((status) => state.applications.filter((item) => item.status === status).length), 1);
  elements.hrOverviewPipeline.innerHTML = statusOptions
    .map((status) => {
      const count = state.applications.filter((application) => application.status === status).length;
      const width = Math.max(count ? 8 : 2, Math.round((count / maxCount) * 100));
      return `<button class="overview-stage-v2" type="button" data-stage-filter="${escapeHtml(status)}"><span class="stage-label"><i class="stage-dot ${statusClass(status)}"></i>${escapeHtml(status)}</span><strong>${count}</strong><span class="stage-track"><i style="--stage-width:${width}%"></i></span></button>`;
    })
    .join("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = state.applications
    .filter((application) => application.status === "Interview Scheduled" && application.interview_date)
    .map((application) => ({ application, date: new Date(`${application.interview_date}T12:00:00`) }))
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);

  elements.hrUpcomingInterviews.innerHTML = upcoming.length
    ? upcoming
        .map(({ application, date }) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<button class="interview-item" type="button" data-view-application="${application.id}"><span class="interview-date"><strong>${new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date)}</strong><small>${new Intl.DateTimeFormat("en", { month: "short" }).format(date)}</small></span><span class="interview-person"><strong>${escapeHtml(applicant.full_name)}</strong><small>${escapeHtml(job.title)}</small></span><span class="interview-arrow">→</span></button>`;
        })
        .join("")
    : `<div class="compact-empty"><strong>No interviews scheduled</strong><span>Shortlist a candidate, then schedule an interview date and time.</span></div>`;

  const recent = state.applications.slice(0, 5);
  elements.hrOverviewRecent.innerHTML = recent.length
    ? `<table class="overview-table"><thead><tr><th>Candidate</th><th>Role</th><th>Stage</th><th>Applied</th></tr></thead><tbody>${recent
        .map((application) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<tr data-view-application="${application.id}" tabindex="0"><td><div class="candidate-cell"><span class="avatar small">${escapeHtml(getInitials(applicant.full_name))}</span><strong>${escapeHtml(applicant.full_name)}</strong></div></td><td>${escapeHtml(job.title)}</td><td><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td><td>${formatRelativeTime(application.created_at)}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : `<div class="compact-empty"><strong>No candidates yet</strong><span>New applications will appear here.</span></div>`;

  const attention = state.jobs
    .map((job) => ({
      job,
      days: daysUntil(job.deadline),
      applications: state.applications.filter((application) => application.job_id === job.id).length,
    }))
    .filter(({ job, days, applications }) => job.status === "Open" && (days <= 7 || applications === 0))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);

  elements.hrJobsAttention.innerHTML = attention.length
    ? attention
        .map(({ job, days, applications }) => {
          const message = days < 0 ? "Deadline passed" : days === 0 ? "Closes today" : days <= 7 ? `Closes in ${days} day${days === 1 ? "" : "s"}` : "No applications yet";
          return `<button class="attention-item" type="button" data-job-candidates="${job.id}"><span class="attention-marker ${days <= 2 ? "urgent" : ""}"></span><span><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(message)} · ${applications} applicant${applications === 1 ? "" : "s"}</small></span><span>→</span></button>`;
        })
        .join("")
    : `<div class="compact-empty"><strong>Everything looks healthy</strong><span>No open roles need urgent attention.</span></div>`;

  const activity = state.applicationEvents.slice(0, 6);
  elements.hrRecentActivity.innerHTML = activity.length
    ? activity
        .map((event) => {
          const application = state.applications.find((item) => item.id === event.application_id);
          if (!application) return "";
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<button class="activity-item" type="button" data-view-application="${application.id}"><span class="activity-icon">${escapeHtml(getInitials(applicant.full_name))}</span><span><strong>${escapeHtml(applicant.full_name)}</strong> ${escapeHtml(formatApplicationEvent(event))}<small>${formatRelativeTime(event.created_at)}</small></span></button>`;
        })
        .join("")
    : `<div class="compact-empty"><strong>No activity yet</strong><span>Candidate updates will appear here.</span></div>`;
}

function renderHrJobs() {
  const openCount = state.jobs.filter((job) => job.status === "Open").length;
  const closedCount = state.jobs.filter((job) => job.status === "Closed").length;
  document.querySelector("#job-count-all").textContent = state.jobs.length;
  document.querySelector("#job-count-open").textContent = openCount;
  document.querySelector("#job-count-closed").textContent = closedCount;

  document.querySelectorAll("[data-job-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.jobFilter === hrJobFilter);
  });
  if (elements.jobSearch && elements.jobSearch.value !== hrJobQuery) elements.jobSearch.value = hrJobQuery;

  const query = hrJobQuery.trim().toLowerCase();
  const jobs = state.jobs.filter((job) => {
    if (hrJobFilter !== "all" && job.status.toLowerCase() !== hrJobFilter) return false;
    if (!query) return true;
    return [job.title, job.department, job.location, job.employment_type, job.workplace_type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  if (!jobs.length) {
    elements.hrJobsList.innerHTML = emptyState(state.jobs.length ? "No jobs match the selected filters." : "No vacancies have been created. Create your first job to start receiving applications.");
    return;
  }

  elements.hrJobsList.innerHTML = `
    <table class="data-table jobs-table">
      <thead><tr><th>Job</th><th>Status</th><th>Applicants</th><th>Deadline</th><th>Work model</th><th>Actions</th></tr></thead>
      <tbody>${jobs.map(renderJobRowForHr).join("")}</tbody>
    </table>`;
}

function renderJobRowForHr(job) {
  const applicationCount = state.applications.filter((application) => application.job_id === job.id).length;
  const deadlineDays = daysUntil(job.deadline);
  const deadlineNote = deadlineDays < 0 ? "Past deadline" : deadlineDays === 0 ? "Closes today" : `${deadlineDays} day${deadlineDays === 1 ? "" : "s"} left`;
  return `
    <tr>
      <td><div class="job-title-cell"><span class="job-icon">${escapeHtml(getInitials(job.title))}</span><div><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(job.department)} · ${escapeHtml(job.location)}</small></div></div></td>
      <td><span class="badge ${statusClass(job.status)}">${escapeHtml(job.status)}</span></td>
      <td><button class="number-link" type="button" data-job-candidates="${job.id}">${applicationCount}</button></td>
      <td><strong class="table-primary">${formatDate(job.deadline)}</strong><small class="table-secondary ${deadlineDays <= 2 ? "urgent" : ""}">${escapeHtml(deadlineNote)}</small></td>
      <td><strong class="table-primary">${escapeHtml(job.workplace_type || "On-site")}</strong><small class="table-secondary">${escapeHtml(job.employment_type || "Full-time")}</small></td>
      <td><div class="row-actions"><button class="btn btn-secondary table-action" type="button" data-job-candidates="${job.id}">Candidates</button><button class="icon-button row-menu-button" type="button" data-toggle-job="${job.id}" aria-label="${job.status === "Open" ? "Close" : "Reopen"} ${escapeHtml(job.title)}">${job.status === "Open" ? "×" : "↻"}</button></div></td>
    </tr>`;
}

function renderHrApplications() {
  renderHrApplicationFilters();
  renderActiveFilterChips();

  const filteredApplications = getFilteredHrApplications();
  renderHrPipeline(filteredApplications);

  document.querySelectorAll("[data-candidate-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.candidateView === candidateView);
  });
  elements.candidateTableView.hidden = candidateView !== "table";
  elements.candidatePipelineView.hidden = candidateView !== "pipeline";
  elements.candidateTableView.classList.toggle("is-active", candidateView === "table");
  elements.candidatePipelineView.classList.toggle("is-active", candidateView === "pipeline");

  if (!state.applications.length) {
    elements.hrApplicationsList.innerHTML = emptyState("No applications have been submitted yet.");
    return;
  }

  if (!filteredApplications.length) {
    elements.hrApplicationsList.innerHTML = emptyState("No candidates match the selected filters.");
    return;
  }

  elements.hrApplicationsList.innerHTML = `
    <table class="data-table candidate-table">
      <thead><tr><th>Candidate</th><th>Applied role</th><th>Stage</th><th>Applied</th><th>Last activity</th><th>CV</th><th></th></tr></thead>
      <tbody>${filteredApplications.map(renderHrApplicationRow).join("")}</tbody>
    </table>`;
}

function renderHrApplicationFilters() {
  const currentJob = hrFilters.jobId;
  elements.hrFilterJob.innerHTML = [
    `<option value="all">All jobs</option>`,
    ...state.jobs.map((job) => `<option value="${job.id}">${escapeHtml(job.title)}</option>`),
  ].join("");
  elements.hrFilterJob.value = state.jobs.some((job) => job.id === currentJob) ? currentJob : "all";

  elements.hrFilterStatus.innerHTML = [
    `<option value="all">All stages</option>`,
    ...statusOptions.map((status) => `<option value="${status}">${status}</option>`),
  ].join("");
  elements.hrFilterStatus.value = statusOptions.includes(hrFilters.status) ? hrFilters.status : "all";
  elements.hrFilterSearch.value = hrFilters.query;
}

function renderActiveFilterChips() {
  const chips = [];
  if (hrFilters.jobId !== "all") {
    const job = state.jobs.find((item) => item.id === hrFilters.jobId);
    if (job) chips.push(`<button type="button" data-clear-filter="job">${escapeHtml(job.title)} <span>×</span></button>`);
  }
  if (hrFilters.status !== "all") chips.push(`<button type="button" data-clear-filter="status">${escapeHtml(hrFilters.status)} <span>×</span></button>`);
  if (hrFilters.query.trim()) chips.push(`<button type="button" data-clear-filter="query">Search: ${escapeHtml(hrFilters.query.trim())} <span>×</span></button>`);
  elements.activeFilterChips.innerHTML = chips.join("");
  elements.activeFilterChips.hidden = !chips.length;
}

function getFilteredHrApplications() {
  const query = hrFilters.query.trim().toLowerCase();

  return state.applications.filter((application) => {
    const { job, applicant } = getApplicationContext(application);
    if (!job || !applicant) return false;
    if (hrFilters.jobId !== "all" && application.job_id !== hrFilters.jobId) return false;
    if (hrFilters.status !== "all" && application.status !== hrFilters.status) return false;
    if (!query) return true;

    return [
      applicant.full_name,
      applicant.phone,
      applicant.location,
      applicant.skills,
      applicant.cv_url,
      applicant.cv_path,
      job.title,
      job.department,
      application.cover_letter,
      state.applicationNotes[application.id],
      application.applicant_message,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function renderHrPipeline(applications) {
  elements.hrPipelineBoard.innerHTML = statusOptions
    .map((status) => {
      const statusApplications = applications.filter((application) => application.status === status);
      const cards = statusApplications
        .map((application) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<button class="pipeline-card-v2" type="button" data-view-application="${application.id}"><span class="pipeline-card-person"><i class="avatar small">${escapeHtml(getInitials(applicant.full_name))}</i><strong>${escapeHtml(applicant.full_name)}</strong></span><span>${escapeHtml(job.title)}</span><small>${formatRelativeTime(application.created_at)}</small></button>`;
        })
        .join("");

      return `<section class="pipeline-column-v2"><div class="pipeline-column-header-v2"><span><i class="stage-dot ${statusClass(status)}"></i>${escapeHtml(status)}</span><strong>${statusApplications.length}</strong></div>${cards || `<div class="pipeline-empty">No candidates</div>`}</section>`;
    })
    .join("");
}

function renderHrApplicationRow(application) {
  const { job, applicant } = getApplicationContext(application);
  if (!job || !applicant) return "";
  const hasCv = Boolean(applicant.cv_path || safeUrl(applicant.cv_url));

  return `
    <tr>
      <td><div class="candidate-cell"><span class="avatar">${escapeHtml(getInitials(applicant.full_name))}</span><div><strong>${escapeHtml(applicant.full_name)}</strong><small>${escapeHtml(applicant.location || applicant.phone || "Profile incomplete")}</small></div></div></td>
      <td><strong class="table-primary">${escapeHtml(job.title)}</strong><small class="table-secondary">${escapeHtml(job.department)}</small></td>
      <td><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
      <td>${formatDate(application.created_at)}</td>
      <td>${formatRelativeTime(application.updated_at || application.created_at)}</td>
      <td><span class="cv-status ${hasCv ? "available" : ""}">${hasCv ? "Available" : "Not added"}</span></td>
      <td><button class="btn btn-secondary table-action" type="button" data-view-application="${application.id}">Review</button></td>
    </tr>`;
}

function renderHrInterviews() {
  const interviewCandidates = state.applications.filter(
    (application) => interviewStatuses.has(application.status) || application.interview_date
  );
  const scheduled = interviewCandidates.filter(
    (application) => application.status === "Interview Scheduled" && application.interview_date
  );
  const pending = interviewCandidates.filter(
    (application) => application.status === "Interview Scheduled" && !application.interview_date
  );
  const thisWeek = scheduled.filter((application) => {
    const days = daysUntil(application.interview_date);
    return days >= 0 && days <= 7;
  });

  elements.interviewCountScheduled.textContent = scheduled.length;
  elements.interviewCountPending.textContent = pending.length;
  elements.interviewCountWeek.textContent = thisWeek.length;

  const ordered = [...interviewCandidates].sort((a, b) => {
    if (!a.interview_date && !b.interview_date) return new Date(b.created_at) - new Date(a.created_at);
    if (!a.interview_date) return 1;
    if (!b.interview_date) return -1;
    return new Date(`${a.interview_date}T${a.interview_time || "12:00"}`) - new Date(`${b.interview_date}T${b.interview_time || "12:00"}`);
  });

  if (!ordered.length) {
    elements.hrInterviewsList.innerHTML = emptyState("No interviews are scheduled. Shortlist a candidate to begin the interview process.");
    return;
  }

  elements.hrInterviewsList.innerHTML = `
    <table class="data-table interview-table">
      <thead><tr><th>Date & time</th><th>Candidate</th><th>Role</th><th>Stage</th><th>Format</th><th></th></tr></thead>
      <tbody>${ordered
        .map((application) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          const timeLabel = application.interview_time ? formatTime(application.interview_time) : "Time pending";
          return `<tr><td>${application.interview_date ? `<strong class="table-primary">${formatDate(application.interview_date)}</strong><small class="table-secondary">${escapeHtml(timeLabel)}</small>` : `<span class="pending-date">Date pending</span>`}</td><td><div class="candidate-cell"><span class="avatar small">${escapeHtml(getInitials(applicant.full_name))}</span><strong>${escapeHtml(applicant.full_name)}</strong></div></td><td><strong class="table-primary">${escapeHtml(job.title)}</strong><small class="table-secondary">${escapeHtml(job.department)}</small></td><td><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td><td><strong class="table-primary">${escapeHtml(application.interview_type || "Not selected")}</strong><small class="table-secondary">${escapeHtml(application.interview_location || "Location pending")}</small></td><td><button class="btn btn-secondary table-action" type="button" data-view-application="${application.id}">${application.status === "Interview Completed" ? "Review outcome" : application.interview_date ? "View" : "Schedule"}</button></td></tr>`;
        })
        .join("")}</tbody>
    </table>`;
}

function renderNotifications() {
  if (!elements.notificationList) return;
  const notices = [];
  const recent = state.applications.filter((application) => isWithinDays(application.created_at, 2)).slice(0, 3);
  recent.forEach((application) => {
    const { job, applicant } = getApplicationContext(application);
    if (job && applicant) notices.push({ title: "New application", text: `${applicant.full_name} applied for ${job.title}.`, applicationId: application.id });
  });
  state.applications
    .filter((application) => application.status === "Interview Scheduled" && application.interview_date && daysUntil(application.interview_date) >= 0 && daysUntil(application.interview_date) <= 2)
    .slice(0, 2)
    .forEach((application) => {
      const { job, applicant } = getApplicationContext(application);
      if (job && applicant) notices.push({ title: "Interview reminder", text: `${applicant.full_name} · ${formatDate(application.interview_date)}.`, applicationId: application.id });
    });
  state.jobs
    .filter((job) => job.status === "Open" && daysUntil(job.deadline) >= 0 && daysUntil(job.deadline) <= 3)
    .slice(0, 2)
    .forEach((job) => notices.push({ title: "Job closing soon", text: `${job.title} closes ${daysUntil(job.deadline) === 0 ? "today" : `in ${daysUntil(job.deadline)} days`}.`, jobId: job.id }));

  elements.notificationCount.textContent = notices.length;
  elements.notificationCount.hidden = !notices.length;
  elements.notificationList.innerHTML = notices.length
    ? notices
        .map((notice) => `<button type="button" class="notification-item" ${notice.applicationId ? `data-view-application="${notice.applicationId}"` : `data-job-candidates="${notice.jobId}"`}><span class="notification-dot"></span><span><strong>${escapeHtml(notice.title)}</strong><small>${escapeHtml(notice.text)}</small></span></button>`)
        .join("")
    : `<div class="compact-empty"><strong>You are all caught up</strong><span>No urgent recruitment updates.</span></div>`;
}

function renderApplicationUpdateForm(application) {
  const options = getAvailableStageOptions(application.status);
  const checklist = normalizeChecklist(application.onboarding_checklist);
  const privateNote = state.applicationNotes[application.id] || "";
  const defaultOffer = application.offer_letter || buildOfferLetterDraft(application);
  const nextStage = options.find((status) => status !== application.status && status !== "Rejected");

  return `
    <form class="application-update-form workflow-update-form" data-application-id="${application.id}" novalidate>
      <div class="workflow-next-action"><span>Recommended next action</span><strong>${escapeHtml(nextStage ? stageActionLabel(nextStage) : terminalStageMessage(application.status))}</strong></div>
      <div class="form-grid">
        <label>Current stage<select name="status">${options
          .map((status) => `<option value="${status}" ${status === application.status ? "selected" : ""}>${status}</option>`)
          .join("")}</select></label>
        <label>Applicant update <span class="optional">Visible to candidate</span><input name="applicantMessage" type="text" value="${escapeHtml(application.applicant_message || "")}" placeholder="e.g. Your interview has been scheduled." /></label>
      </div>

      <section class="workflow-field-group" data-workflow-fields="interview" hidden>
        <div class="workflow-field-heading"><span>Interview details</span><small>Required before the interview can be scheduled.</small></div>
        <div class="form-grid">
          <label>Interview date<input name="interviewDate" type="date" value="${escapeHtml(application.interview_date || "")}" /></label>
          <label>Interview time<input name="interviewTime" type="time" value="${escapeHtml(application.interview_time || "")}" /></label>
          <label>Interview type<select name="interviewType"><option value="">Select type</option>${["Video interview", "Phone interview", "In-person interview", "Technical assessment", "Panel interview", "Final interview"].map((type) => `<option ${type === application.interview_type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
          <label>Location or meeting link<input name="interviewLocation" type="text" value="${escapeHtml(application.interview_location || "")}" placeholder="Office address or https://..." /></label>
        </div>
      </section>

      <section class="workflow-field-group" data-workflow-fields="offer" hidden>
        <div class="workflow-field-heading"><span>Offer letter</span><small>Stored securely in HireFlow. This does not send an external email.</small></div>
        <div class="form-grid">
          <label>Offer title<input name="offerTitle" type="text" value="${escapeHtml(application.offer_title || "Employment Offer")}" /></label>
          <label>Offered salary<input name="offeredSalary" type="text" value="${escapeHtml(application.offered_salary || "")}" placeholder="e.g. GHS 4,500 per month" /></label>
          <label>Proposed start date<input name="proposedStartDate" type="date" value="${escapeHtml(application.proposed_start_date || "")}" /></label>
          <label class="span-2">Offer letter content<textarea name="offerLetter" rows="12" placeholder="Write the employment offer...">${escapeHtml(defaultOffer)}</textarea></label>
        </div>
      </section>

      <section class="workflow-field-group" data-workflow-fields="onboarding" hidden>
        <div class="workflow-field-heading"><span>Onboarding checklist</span><small>Complete every item before marking the candidate as Hired.</small></div>
        <div class="onboarding-checklist-form">${onboardingChecklistItems
          .map(([key, label]) => `<label class="check-row"><input type="checkbox" name="onboarding_${key}" ${checklist[key] ? "checked" : ""} /><span>${escapeHtml(label)}</span></label>`)
          .join("")}</div>
      </section>

      <section class="workflow-field-group" data-workflow-fields="rejection" hidden>
        <div class="workflow-field-heading"><span>Rejection information</span><small>Give the hiring team a clear reason for the decision.</small></div>
        <label>Rejection reason<textarea name="rejectionReason" rows="3" placeholder="Reason for rejecting this application">${escapeHtml(application.rejection_reason || "")}</textarea></label>
      </section>

      <label class="workflow-private-note">Private HR notes <span class="optional">Never shown to applicants</span><textarea name="notes" rows="4" placeholder="Add internal context for the hiring team">${escapeHtml(privateNote)}</textarea></label>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save workflow update</button></div>
    </form>`;
}

function getApplicationContext(application) {
  return {
    job: state.jobs.find((item) => item.id === application.job_id),
    applicant: state.profiles.find((item) => item.id === application.applicant_id),
  };
}

async function openApplicationDetail(applicationId) {
  const application = state.applications.find((item) => item.id === applicationId);
  if (!application) return;

  const { job, applicant } = getApplicationContext(application);
  if (!job || !applicant) return;

  elements.notificationPopover.hidden = true;
  elements.dashboardNotifications.setAttribute("aria-expanded", "false");
  elements.applicationDetailTitle.textContent = applicant.full_name;
  elements.applicationDetailBody.innerHTML = `<div class="skeleton-panel" aria-label="Loading candidate details"></div>`;
  elements.applicationDetailDialog.showModal();

  const cvUrl = await getApplicantCvUrl(applicant);
  const portfolioUrl = safeUrl(applicant.cv_url);
  const cvMarkup = cvUrl
    ? `<a class="document-card" href="${escapeHtml(cvUrl)}" target="_blank" rel="noopener noreferrer"><span class="document-icon">PDF</span><span><strong>${escapeHtml(getFileNameFromPath(applicant.cv_path))}</strong><small>Private applicant document · Signed link valid for 1 hour</small></span><span>Open ↗</span></a>`
    : portfolioUrl
      ? `<a class="document-card" href="${escapeHtml(portfolioUrl)}" target="_blank" rel="noopener noreferrer"><span class="document-icon link">URL</span><span><strong>Portfolio or LinkedIn</strong><small>${escapeHtml(portfolioUrl)}</small></span><span>Open ↗</span></a>`
      : `<div class="compact-empty candidate-document-empty"><strong>No CV or portfolio added</strong><span>The applicant has not uploaded a document yet.</span></div>`;

  const skills = String(applicant.skills || "")
    .split(/[,\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);

  elements.applicationDetailBody.innerHTML = `
    <section class="candidate-hero-card">
      <div class="candidate-hero-main"><span class="avatar candidate-large-avatar">${escapeHtml(getInitials(applicant.full_name))}</span><div><div class="candidate-name-line"><h3>${escapeHtml(applicant.full_name)}</h3><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></div><p>${escapeHtml(job.title)} · ${escapeHtml(job.department)}</p><div class="candidate-contact-row"><span>${escapeHtml(applicant.location || "Location not added")}</span><span>${escapeHtml(applicant.phone || "Phone not added")}</span><span>Applied ${formatRelativeTime(application.created_at)}</span></div></div></div>
      <button class="btn btn-secondary table-action" type="button" data-detail-tab-jump="workflow">Update workflow</button>
    </section>

    <div class="candidate-detail-tabs" role="tablist" aria-label="Candidate information">
      <button class="is-active" type="button" role="tab" aria-selected="true" data-detail-tab="overview">Overview</button>
      <button type="button" role="tab" aria-selected="false" data-detail-tab="application">Application</button>
      <button type="button" role="tab" aria-selected="false" data-detail-tab="resume">Resume</button>
      <button type="button" role="tab" aria-selected="false" data-detail-tab="workflow">Workflow</button>
      <button type="button" role="tab" aria-selected="false" data-detail-tab="activity">Activity</button>
    </div>

    <div class="candidate-detail-panels">
      <section class="candidate-detail-panel is-active" data-detail-panel="overview">
        <div class="candidate-info-grid">
          <article><span>Current stage</span><strong>${escapeHtml(application.status)}</strong></article>
          <article><span>Application date</span><strong>${formatDate(application.created_at)}</strong></article>
          <article><span>Interview</span><strong>${application.interview_date ? `${formatDate(application.interview_date)}${application.interview_time ? ` · ${formatTime(application.interview_time)}` : ""}` : "Not scheduled"}</strong></article>
          <article><span>Work model</span><strong>${escapeHtml(job.workplace_type || "On-site")}</strong></article>
        </div>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Skills</h4><span>${skills.length} listed</span></div>${skills.length ? `<div class="skill-tags">${skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>` : `<p>No skills have been added to this profile.</p>`}</div>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Role summary</h4></div><p>${escapeHtml(job.description)}</p></div>
      </section>

      <section class="candidate-detail-panel" data-detail-panel="application" hidden>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Cover letter</h4><span>${String(application.cover_letter || "").length} characters</span></div><p class="cover-letter-copy">${escapeHtml(application.cover_letter)}</p></div>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Applied vacancy</h4></div><dl class="candidate-definition-list"><div><dt>Job</dt><dd>${escapeHtml(job.title)}</dd></div><div><dt>Department</dt><dd>${escapeHtml(job.department)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(job.location)}</dd></div><div><dt>Employment</dt><dd>${escapeHtml(job.employment_type || "Full-time")}</dd></div></dl></div>
      </section>

      <section class="candidate-detail-panel" data-detail-panel="resume" hidden>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Applicant documents</h4><span>Private access</span></div>${cvMarkup}</div>
      </section>

      <section class="candidate-detail-panel" data-detail-panel="workflow" hidden>
        ${application.offer_letter ? `<div class="candidate-section offer-summary-inline"><div class="candidate-section-head"><h4>Current offer</h4><button class="text-action" type="button" data-view-offer="${application.id}">View offer letter</button></div><p>${escapeHtml(application.offer_title || "Employment Offer")} · ${escapeHtml(application.offered_salary || "Salary not specified")}</p></div>` : ""}
        <div class="detail-update-inline">${renderApplicationUpdateForm(application)}</div>
      </section>

      <section class="candidate-detail-panel" data-detail-panel="activity" hidden>
        <div class="candidate-section"><div class="candidate-section-head"><h4>Application history</h4><span>${getApplicationEvents(application.id).length} events</span></div>${renderApplicationHistory(application.id)}</div>
      </section>
    </div>`;
  syncWorkflowFormFields(elements.applicationDetailBody.querySelector(".application-update-form"));
}

async function getApplicantCvUrl(applicant) {
  if (!applicant?.cv_path || !db) return "";
  const { data, error } = await db.storage.from("cvs").createSignedUrl(applicant.cv_path, 60 * 60);
  if (error) {
    console.error(error);
    return "";
  }
  return data?.signedUrl || "";
}

function renderApplicantDashboard(profile) {
  document.querySelector("#profile-phone").value = profile.phone || "";
  document.querySelector("#profile-location").value = profile.location || "";
  document.querySelector("#profile-skills").value = profile.skills || "";
  document.querySelector("#profile-cv").value = profile.cv_url || "";
  elements.profileCvCurrent.textContent = profile.cv_path ? `Current file: ${getFileNameFromPath(profile.cv_path)}` : "No CV uploaded";
  renderProfileCompletion(profile);
  renderApplicantJobs(profile);
  renderMyApplications(profile);
}

function renderProfileCompletion(profile) {
  const fields = [profile.full_name, profile.phone, profile.location, profile.skills, profile.cv_path || profile.cv_url];
  const completed = fields.filter((value) => String(value || "").trim()).length;
  const percentage = Math.round((completed / fields.length) * 100);
  elements.profileCompletionValue.textContent = `${percentage}%`;
  elements.profileCompletionBar.style.width = `${percentage}%`;
}

function renderApplicantJobs(profile) {
  const openJobs = state.jobs.filter((job) => job.status === "Open");
  if (!openJobs.length) {
    elements.applicantJobsList.innerHTML = emptyState("There are no open roles at the moment. Check back for new opportunities.");
    return;
  }

  elements.applicantJobsList.innerHTML = openJobs
    .map((job) => {
      const alreadyApplied = state.applications.some(
        (application) => application.job_id === job.id && application.applicant_id === profile.id
      );

      return `
        <article class="record-card">
          <div class="record-card-header"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.description)}</p></div><span class="badge ${statusClass(job.status)}">${escapeHtml(job.status)}</span></div>
          <div class="meta-row">
            <span class="badge neutral">${escapeHtml(job.department)}</span>
            <span class="badge neutral">${escapeHtml(job.location)}</span>
            <span class="badge neutral">${escapeHtml(job.employment_type || "Full-time")}</span>
            <span class="badge neutral">${escapeHtml(job.workplace_type || "On-site")}</span>
          </div>
          <p><strong>Deadline:</strong> ${formatDate(job.deadline)}</p>
          ${job.salary_range ? `<p><strong>Salary:</strong> ${escapeHtml(job.salary_range)}</p>` : ""}
          <p><strong>Requirements:</strong> ${escapeHtml(job.requirements)}</p>
          <div class="card-actions"><button class="btn ${alreadyApplied ? "btn-secondary" : "btn-primary"}" type="button" data-apply-job="${job.id}" ${alreadyApplied ? "disabled" : ""}>${alreadyApplied ? "Application submitted" : "Apply now"}</button></div>
        </article>
      `;
    })
    .join("");
}

function renderMyApplications(profile) {
  const applications = state.applications.filter((application) => application.applicant_id === profile.id);
  if (!applications.length) {
    elements.myApplicationsList.innerHTML = emptyState("You have not submitted an application yet. Browse open jobs to get started.");
    return;
  }

  elements.myApplicationsList.innerHTML = applications
    .map((application) => {
      const job = state.jobs.find((item) => item.id === application.job_id);
      if (!job) return "";
      const checklist = normalizeChecklist(application.onboarding_checklist);
      const completedTasks = Object.values(checklist).filter(Boolean).length;
      const mayWithdraw = !["Offer Sent", "Offer Accepted", "Onboarding", "Hired", "Offer Declined", "Rejected", "Withdrawn"].includes(application.status);
      const interviewMarkup = interviewStatuses.has(application.status) || application.interview_date
        ? `<div class="applicant-workflow-notice"><strong>Interview details</strong><span>${application.interview_date ? formatDate(application.interview_date) : "Date pending"}${application.interview_time ? ` · ${formatTime(application.interview_time)}` : ""}</span><small>${escapeHtml(application.interview_type || "Interview format pending")}${application.interview_location ? ` · ${escapeHtml(application.interview_location)}` : ""}</small></div>`
        : "";
      const offerMarkup = application.offer_letter
        ? `<div class="applicant-workflow-notice offer"><strong>${escapeHtml(application.offer_title || "Employment Offer")}</strong><span>${escapeHtml(application.offered_salary || "Salary stated in letter")}</span><small>Proposed start: ${application.proposed_start_date ? formatDate(application.proposed_start_date) : "To be confirmed"}</small><button class="text-action" type="button" data-view-offer="${application.id}">View offer letter</button>${application.status === "Offer Sent" ? `<div class="offer-response-actions"><button class="btn btn-primary" type="button" data-offer-action="Accepted" data-application-id="${application.id}">Accept offer</button><button class="btn btn-secondary" type="button" data-offer-action="Declined" data-application-id="${application.id}">Decline offer</button></div>` : ""}</div>`
        : "";
      const onboardingMarkup = ["Onboarding", "Hired"].includes(application.status)
        ? `<div class="applicant-onboarding-card"><div><strong>Onboarding progress</strong><span>${completedTasks} of ${onboardingChecklistItems.length} tasks completed</span></div><div class="mini-progress"><i style="width:${Math.round((completedTasks / onboardingChecklistItems.length) * 100)}%"></i></div><ul>${onboardingChecklistItems.map(([key, label]) => `<li class="${checklist[key] ? "is-complete" : ""}"><span>${checklist[key] ? "✓" : "○"}</span>${escapeHtml(label)}</li>`).join("")}</ul></div>`
        : "";

      return `
        <article class="record-card application-workflow-card">
          <div class="record-card-header"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.department)} · ${escapeHtml(job.location)}</p></div><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></div>
          <p><strong>Applied:</strong> ${formatDate(application.created_at)}</p>
          ${application.applicant_message ? `<div class="applicant-message"><strong>Update from HR</strong><p>${escapeHtml(application.applicant_message)}</p></div>` : ""}
          ${renderTimeline(application.status)}
          ${interviewMarkup}
          ${offerMarkup}
          ${onboardingMarkup}
          ${application.status === "Rejected" && application.rejection_reason ? `<div class="applicant-workflow-notice danger"><strong>Application closed</strong><span>${escapeHtml(application.rejection_reason)}</span></div>` : ""}
          ${application.status === "Offer Declined" ? `<div class="applicant-workflow-notice neutral"><strong>Offer declined</strong><span>You declined this employment offer.</span></div>` : ""}
          ${application.status === "Withdrawn" ? `<div class="applicant-workflow-notice neutral"><strong>Application withdrawn</strong><span>This application is no longer active.</span></div>` : ""}
          ${mayWithdraw ? `<div class="card-actions"><button class="text-danger-action" type="button" data-withdraw-application="${application.id}">Withdraw application</button></div>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderTimeline(status) {
  const isTerminal = terminalStatuses.includes(status);
  const currentIndex = workflowStages.indexOf(status);
  const displayStages = workflowStages.map((item, index) => {
    const isComplete = !isTerminal && index < currentIndex;
    const isCurrent = !isTerminal && index === currentIndex;
    return `<li class="${isComplete ? "is-complete" : ""} ${isCurrent ? "is-current" : ""}"><span>${isComplete ? "✓" : index + 1}</span><small>${escapeHtml(item)}</small></li>`;
  }).join("");
  return `<div class="full-workflow-timeline"><ol>${displayStages}</ol>${isTerminal ? `<div class="terminal-status ${statusClass(status)}"><strong>${escapeHtml(status)}</strong><span>The standard recruitment path ended at this stage.</span></div>` : ""}</div>`;
}

async function handleJobSubmit(event) {
  event.preventDefault();
  setMessage(elements.jobMessage, "");
  clearInvalidState(elements.jobForm);

  if (!elements.jobForm.checkValidity()) {
    markInvalidFields(elements.jobForm);
    setMessage(elements.jobMessage, "Complete all required job fields.", true);
    return;
  }

  const deadline = document.querySelector("#job-deadline").value;
  if (new Date(`${deadline}T23:59:59`) < new Date()) {
    setMessage(elements.jobMessage, "Choose a deadline that has not passed.", true);
    return;
  }

  const job = {
    title: document.querySelector("#job-title").value.trim(),
    department: document.querySelector("#job-department").value.trim(),
    location: document.querySelector("#job-location").value.trim(),
    deadline,
    employment_type: document.querySelector("#job-employment-type").value,
    workplace_type: document.querySelector("#job-workplace-type").value,
    positions: Number(document.querySelector("#job-positions").value || 1),
    salary_range: document.querySelector("#job-salary-range").value.trim(),
    description: document.querySelector("#job-description").value.trim(),
    requirements: document.querySelector("#job-requirements").value.trim(),
    status: "Open",
    created_by: state.profile.id,
  };

  const { error } = await db.from("jobs").insert(job);
  if (error) {
    setMessage(elements.jobMessage, error.message, true);
    return;
  }

  elements.jobForm.reset();
  document.querySelector("#job-positions").value = "1";
  setMessage(elements.jobMessage, "Job published successfully.");
  elements.jobDialog.close();
  showToast("Job published", `${job.title} is now open for applications.`);
  activePanel = "jobs";
  window.history.replaceState(null, "", "#app/jobs");
  await loadDashboardData();
  renderApp();
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  setMessage(elements.profileMessage, "");
  clearInvalidState(elements.profileForm);

  const portfolio = document.querySelector("#profile-cv").value.trim();
  if (portfolio && !safeUrl(portfolio)) {
    document.querySelector("#profile-cv").setAttribute("aria-invalid", "true");
    setMessage(elements.profileMessage, "Enter a valid https:// portfolio or LinkedIn link.", true);
    return;
  }

  const file = elements.profileCvFile.files[0];
  let cvPath = state.profile.cv_path || "";

  if (file) {
    const validationError = validateCvFile(file);
    if (validationError) {
      elements.profileCvFile.setAttribute("aria-invalid", "true");
      setMessage(elements.profileMessage, validationError, true);
      return;
    }

    const previousPath = cvPath;
    cvPath = await uploadCv(file);
    if (previousPath && previousPath !== cvPath) {
      await db.storage.from("cvs").remove([previousPath]);
    }
  }

  const updates = {
    phone: document.querySelector("#profile-phone").value.trim(),
    location: document.querySelector("#profile-location").value.trim(),
    skills: document.querySelector("#profile-skills").value.trim(),
    cv_url: portfolio,
    cv_path: cvPath,
  };

  const { error } = await db.from("profiles").update(updates).eq("id", state.profile.id);
  if (error) {
    setMessage(elements.profileMessage, error.message, true);
    return;
  }

  elements.profileCvFile.value = "";
  setMessage(elements.profileMessage, "Profile saved successfully.");
  showToast("Profile updated", "Your applicant information has been saved.");
  await loadProfile();
  await loadDashboardData();
  renderApp();
}

function validateCvFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const acceptedExtension = ["pdf", "doc", "docx"].includes(extension);
  if (!acceptedCvTypes.has(file.type) && !acceptedExtension) return "Upload a PDF, DOC, or DOCX file.";
  if (file.size > maxCvSize) return "The CV file must be 5 MB or smaller.";
  return "";
}

async function uploadCv(file) {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const uniquePart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `${state.profile.id}/${uniquePart}-${cleanName}`;
  const { error } = await db.storage.from("cvs").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

function openApplicationDialog(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;

  elements.applicationJobId.value = jobId;
  elements.applicationTitle.textContent = job.title;
  elements.applicationCover.value = "";
  setMessage(elements.applicationMessage, "");
  elements.applicationDialog.showModal();
  window.setTimeout(() => elements.applicationCover.focus(), 50);
}

async function handleApplicationSubmit(event) {
  event.preventDefault();
  setMessage(elements.applicationMessage, "");

  const jobId = elements.applicationJobId.value;
  const coverLetter = elements.applicationCover.value.trim();

  if (!jobId || coverLetter.length < 80) {
    setMessage(elements.applicationMessage, "Write a cover letter of at least 80 characters.", true);
    return;
  }

  const alreadyApplied = state.applications.some(
    (application) => application.job_id === jobId && application.applicant_id === state.profile.id
  );
  if (alreadyApplied) {
    setMessage(elements.applicationMessage, "You have already applied for this role.", true);
    return;
  }

  const { error } = await db.from("applications").insert({
    job_id: jobId,
    applicant_id: state.profile.id,
    cover_letter: coverLetter,
    status: "Applied",
  });
  if (error) {
    setMessage(elements.applicationMessage, error.message, true);
    return;
  }

  const job = state.jobs.find((item) => item.id === jobId);
  elements.applicationDialog.close();
  showToast("Application submitted", `Your application for ${job?.title || "the role"} was received.`);
  await loadDashboardData();
  renderApp();
}

async function handleApplicationUpdate(event) {
  event.preventDefault();
  const form = event.target;
  const application = state.applications.find((item) => item.id === form.dataset.applicationId);
  if (!application) throw new Error("Application not found.");

  const status = form.elements.status.value;
  const interviewDate = form.elements.interviewDate?.value || null;
  const interviewTime = form.elements.interviewTime?.value || null;
  const interviewType = form.elements.interviewType?.value || "";
  const interviewLocation = form.elements.interviewLocation?.value.trim() || "";
  const offerTitle = form.elements.offerTitle?.value.trim() || "";
  const offeredSalary = form.elements.offeredSalary?.value.trim() || "";
  const proposedStartDate = form.elements.proposedStartDate?.value || null;
  const offerLetter = form.elements.offerLetter?.value.trim() || "";
  const rejectionReason = form.elements.rejectionReason?.value.trim() || "";
  const checklist = Object.fromEntries(
    onboardingChecklistItems.map(([key]) => [key, Boolean(form.elements[`onboarding_${key}`]?.checked)])
  );

  if (!getAvailableStageOptions(application.status).includes(status)) {
    showToast("Invalid workflow step", "Move the candidate through the recommended recruitment stages.", true);
    return;
  }
  if (["Interview Scheduled", "Interview Completed"].includes(status) && (!interviewDate || !interviewTime || !interviewType || !interviewLocation)) {
    showToast("Complete interview details", "Add the date, time, type, and location before saving this stage.", true);
    return;
  }
  if (status === "Offer Sent" && (!offerTitle || !offerLetter || !proposedStartDate)) {
    showToast("Complete the offer", "Add an offer title, proposed start date, and offer letter content.", true);
    return;
  }
  if (status === "Rejected" && !rejectionReason) {
    showToast("Rejection reason required", "Add a clear reason before rejecting the application.", true);
    return;
  }
  if (status === "Hired" && !onboardingChecklistItems.every(([key]) => checklist[key])) {
    showToast("Onboarding is incomplete", "Complete every onboarding checklist item before marking the candidate as Hired.", true);
    return;
  }

  const updatePayload = {
    status,
    interview_date: interviewDate,
    interview_time: interviewTime,
    interview_type: interviewType,
    interview_location: interviewLocation,
    applicant_message: form.elements.applicantMessage.value.trim(),
    offer_title: offerTitle,
    offered_salary: offeredSalary,
    proposed_start_date: proposedStartDate,
    offer_letter: offerLetter,
    rejection_reason: rejectionReason,
    onboarding_checklist: checklist,
  };

  if (status === "Offer Sent" && application.status !== "Offer Sent") updatePayload.offer_sent_at = new Date().toISOString();
  if (status === "Onboarding" && application.status !== "Onboarding") updatePayload.onboarding_started_at = new Date().toISOString();
  if (status === "Hired") updatePayload.onboarding_completed_at = new Date().toISOString();

  const { error } = await db.from("applications").update(updatePayload).eq("id", form.dataset.applicationId);
  if (error) throw error;

  const privateNotes = form.elements.notes.value.trim();
  const { error: noteError } = await db.from("application_private_notes").upsert({
    application_id: form.dataset.applicationId,
    notes: privateNotes,
    updated_by: state.profile.id,
  });
  if (noteError) throw noteError;

  elements.applicationDetailDialog.close();
  showToast(workflowToastTitle(status), workflowToastMessage(status));
  await loadDashboardData();
  renderApp();
}

async function handleOfferResponse(applicationId, response) {
  const { error } = await db.rpc("respond_to_offer", {
    p_application_id: applicationId,
    p_response: response,
  });
  if (error) throw error;
  showToast(response === "Accepted" ? "Offer accepted" : "Offer declined", response === "Accepted" ? "HR can now begin your onboarding." : "Your response has been recorded.");
  await loadDashboardData();
  renderApp();
}

async function withdrawApplication(applicationId) {
  const confirmed = window.confirm("Withdraw this application? This action cannot be undone.");
  if (!confirmed) return;
  const { error } = await db.rpc("withdraw_application", { p_application_id: applicationId });
  if (error) throw error;
  showToast("Application withdrawn", "The application is no longer active.");
  await loadDashboardData();
  renderApp();
}

async function toggleJob(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;

  const nextStatus = job.status === "Open" ? "Closed" : "Open";
  const { error } = await db.from("jobs").update({ status: nextStatus }).eq("id", jobId);
  if (error) throw error;

  showToast(`Job ${nextStatus.toLowerCase()}`, `${job.title} is now ${nextStatus.toLowerCase()}.`);
  await loadDashboardData();
  renderApp();
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getInitials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatRelativeTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let duration = seconds;
  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) return formatter.format(Math.round(duration), unit);
    duration /= amount;
  }
  return formatDate(value);
}

function firstName(value) {
  return String(value || "there").trim().split(/\s+/)[0] || "there";
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function isWithinDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const difference = Date.now() - date.getTime();
  return difference >= 0 && difference <= days * 86400000;
}

function getAvailableStageOptions(currentStatus) {
  const options = [currentStatus, ...(allowedStageTransitions[currentStatus] || [])];
  const canReject = !["Offer Sent", "Offer Accepted", "Onboarding", "Hired", "Offer Declined", "Rejected", "Withdrawn"].includes(currentStatus);
  if (canReject) options.push("Rejected");
  return [...new Set(options)];
}

function stageActionLabel(status) {
  const labels = {
    Screening: "Begin application screening",
    Shortlisted: "Shortlist the candidate",
    "Interview Scheduled": "Schedule the interview",
    "Interview Completed": "Record the completed interview",
    Selected: "Select the successful candidate",
    "Offer Sent": "Prepare and send the offer letter",
    Onboarding: "Begin employee onboarding",
    Hired: "Complete onboarding and hire",
  };
  return labels[status] || `Move to ${status}`;
}

function terminalStageMessage(status) {
  const messages = {
    "Offer Sent": "Waiting for the applicant to accept or decline the offer",
    Hired: "Recruitment and onboarding completed",
    "Offer Declined": "The applicant declined the offer",
    Rejected: "The application has been rejected",
    Withdrawn: "The applicant withdrew the application",
  };
  return messages[status] || "No further action required";
}

function workflowToastTitle(status) {
  const titles = {
    Shortlisted: "Candidate shortlisted",
    "Interview Scheduled": "Interview scheduled",
    "Interview Completed": "Interview completed",
    Selected: "Candidate selected",
    "Offer Sent": "Offer letter available",
    Onboarding: "Onboarding started",
    Hired: "Candidate hired",
    Rejected: "Application rejected",
  };
  return titles[status] || "Application updated";
}

function workflowToastMessage(status) {
  const messages = {
    "Offer Sent": "The applicant can now review and respond to the offer in HireFlow.",
    Onboarding: "The onboarding checklist is now active.",
    Hired: "The full recruitment workflow is complete.",
  };
  return messages[status] || `Candidate moved to ${status}.`;
}

function normalizeChecklist(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(onboardingChecklistItems.map(([key]) => [key, Boolean(source[key])]));
}

function buildOfferLetterDraft(application) {
  const { job, applicant } = getApplicationContext(application);
  if (!job || !applicant) return "";
  return `Dear ${applicant.full_name},\n\nWe are pleased to offer you the position of ${job.title} in the ${job.department} department at HireFlow.\n\nYour proposed start date and compensation are stated above. This offer is subject to completion of the required onboarding documents and employment checks.\n\nPlease review this letter and respond through your HireFlow applicant portal.\n\nSincerely,\nHuman Resources\nHireFlow`;
}

function syncWorkflowFormFields(form) {
  if (!form) return;
  const status = form.elements.status.value;
  form.querySelector('[data-workflow-fields="interview"]').hidden = !["Interview Scheduled", "Interview Completed"].includes(status);
  form.querySelector('[data-workflow-fields="offer"]').hidden = !["Offer Sent", "Offer Accepted", "Offer Declined"].includes(status);
  form.querySelector('[data-workflow-fields="onboarding"]').hidden = !["Onboarding", "Hired"].includes(status);
  form.querySelector('[data-workflow-fields="rejection"]').hidden = status !== "Rejected";
  if (status === "Offer Sent" && form.elements.offerLetter && !form.elements.offerLetter.value.trim()) {
    const application = state.applications.find((item) => item.id === form.dataset.applicationId);
    form.elements.offerLetter.value = application ? buildOfferLetterDraft(application) : "";
  }
}

function formatTime(value) {
  if (!value) return "";
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

function getApplicationEvents(applicationId) {
  return state.applicationEvents
    .filter((event) => event.application_id === applicationId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function formatApplicationEvent(event) {
  if (event.event_type === "application_created") return "submitted an application";
  if (event.event_type === "offer_response") return event.to_status === "Offer Accepted" ? "accepted the employment offer" : "declined the employment offer";
  if (event.event_type === "withdrawn") return "withdrew the application";
  if (event.from_status && event.to_status) return `moved from ${event.from_status} to ${event.to_status}`;
  return event.detail || "updated the application";
}

function renderApplicationHistory(applicationId) {
  const events = getApplicationEvents(applicationId);
  if (!events.length) return `<div class="compact-empty"><strong>No history recorded</strong><span>New workflow updates will appear here.</span></div>`;
  return `<ol class="application-history-list">${events.map((event) => `<li><span class="history-marker ${statusClass(event.to_status || "Applied")}"></span><div><strong>${escapeHtml(formatApplicationEvent(event))}</strong><small>${formatDate(event.created_at)} · ${formatRelativeTime(event.created_at)}</small></div></li>`).join("")}</ol>`;
}

function openOfferLetter(applicationId) {
  const application = state.applications.find((item) => item.id === applicationId);
  if (!application?.offer_letter) return;
  const { job, applicant } = getApplicationContext(application);
  if (!job || !applicant) return;
  elements.offerLetterTitle.textContent = application.offer_title || "Employment Offer";
  elements.offerLetterBody.innerHTML = `<article class="offer-letter-document"><div class="offer-letter-brand"><span class="brand-mark">H</span><div><strong>HireFlow</strong><small>Employment offer</small></div></div><div class="offer-letter-meta"><span><strong>Candidate</strong>${escapeHtml(applicant.full_name)}</span><span><strong>Position</strong>${escapeHtml(job.title)}</span><span><strong>Compensation</strong>${escapeHtml(application.offered_salary || "See letter")}</span><span><strong>Proposed start</strong>${application.proposed_start_date ? formatDate(application.proposed_start_date) : "To be confirmed"}</span></div><div class="offer-letter-copy">${escapeHtml(application.offer_letter).replaceAll("\n", "<br>")}</div><div class="offer-letter-status"><strong>Status</strong><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></div></article>`;
  elements.offerLetterDialog.showModal();
}

function statusClass(status) {
  return `status-${String(status).toLowerCase().replaceAll(" ", "-")}`;
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getFileNameFromPath(path) {
  const fileName = String(path).split("/").pop() || "Uploaded CV";
  return fileName.replace(/^[a-f0-9-]{20,}-/i, "");
}

function friendlyError(error) {
  if (!error) return "Please try again.";
  const message = error.message || String(error);
  if (/network|fetch/i.test(message)) return "Check your internet connection and try again.";
  return message;
}

function markInvalidFields(form) {
  [...form.elements].forEach((field) => {
    if (typeof field.checkValidity === "function" && !field.checkValidity()) field.setAttribute("aria-invalid", "true");
  });
}

function clearInvalidState(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute("aria-invalid"));
}

function debounce(callback, delay = 220) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function openMobileSidebar() {
  sidebarOpen = true;
  document.body.classList.add("sidebar-open");
}

function closeMobileSidebar() {
  sidebarOpen = false;
  document.body.classList.remove("sidebar-open");
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  revealItems.forEach((item) => observer.observe(item));
}

function setMinimumJobDeadline() {
  const deadlineInput = document.querySelector("#job-deadline");
  if (!deadlineInput) return;
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  deadlineInput.min = localDate;
}

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => routeTo(button.dataset.route));
});

document.querySelectorAll("[data-section]").forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    document.querySelectorAll("[data-section]").forEach((item) => item.classList.remove("is-active"));
    link.classList.add("is-active");
    await showLandingSection(link.dataset.section);
  });
});

elements.authForm.addEventListener("submit", (event) => runWithFormBusy(elements.authForm, () => handleAuthSubmit(event)));
elements.authSwitch.addEventListener("click", () => showAuth(authMode === "signup" ? "signin" : "signup"));
elements.logoutButton.addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  state = { authUser: null, profile: null, profiles: [], jobs: [], applications: [], applicationEvents: [], applicationNotes: {} };
  activePanel = "overview";
  window.history.replaceState(null, "", window.location.pathname);
  showToast("Signed out", "You have securely left the workspace.");
  await routeTo("landing");
});

elements.jobForm.addEventListener("submit", (event) => runWithFormBusy(elements.jobForm, () => handleJobSubmit(event)));
elements.profileForm.addEventListener("submit", (event) => runWithFormBusy(elements.profileForm, () => handleProfileSubmit(event)));
elements.applicationForm.addEventListener("submit", (event) => runWithFormBusy(elements.applicationForm, () => handleApplicationSubmit(event)));
elements.closeJobDialog.addEventListener("click", () => elements.jobDialog.close());
elements.cancelJobDialog.addEventListener("click", () => elements.jobDialog.close());
document.querySelector("#close-application-dialog").addEventListener("click", () => elements.applicationDialog.close());
elements.closeApplicationDetailDialog.addEventListener("click", () => elements.applicationDetailDialog.close());
elements.closeOfferLetterDialog.addEventListener("click", () => elements.offerLetterDialog.close());
elements.printOfferLetter.addEventListener("click", () => window.print());
elements.doneOfferLetter.addEventListener("click", () => elements.offerLetterDialog.close());
elements.openSidebar.addEventListener("click", openMobileSidebar);
elements.closeSidebar.addEventListener("click", closeMobileSidebar);
elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

elements.dashboardNotifications.addEventListener("click", () => {
  const willOpen = elements.notificationPopover.hidden;
  elements.notificationPopover.hidden = !willOpen;
  elements.dashboardNotifications.setAttribute("aria-expanded", String(willOpen));
});

elements.jobSearch.addEventListener(
  "input",
  debounce(() => {
    hrJobQuery = elements.jobSearch.value;
    renderHrJobs();
  })
);

elements.hrFilterJob.addEventListener("change", () => {
  hrFilters.jobId = elements.hrFilterJob.value;
  renderHrApplications();
});

elements.hrFilterStatus.addEventListener("change", () => {
  hrFilters.status = elements.hrFilterStatus.value;
  renderHrApplications();
});

elements.hrFilterSearch.addEventListener(
  "input",
  debounce(() => {
    hrFilters.query = elements.hrFilterSearch.value;
    renderHrApplications();
  })
);

elements.topbarPrimaryAction.addEventListener("click", () => {
  const action = elements.topbarPrimaryAction.dataset.action;
  if (action === "open-job-dialog") {
    setMessage(elements.jobMessage, "");
    elements.jobDialog.showModal();
    window.setTimeout(() => document.querySelector("#job-title")?.focus(), 50);
    return;
  }
  const panel = elements.topbarPrimaryAction.dataset.targetPanel;
  if (panel) setActivePanel(panel);
});

document.addEventListener("change", (event) => {
  if (event.target.matches('.application-update-form select[name="status"]')) {
    syncWorkflowFormFields(event.target.closest(".application-update-form"));
  }
});

document.addEventListener("click", async (event) => {
  const detailTabButton = event.target.closest("[data-detail-tab], [data-detail-tab-jump]");
  if (detailTabButton) {
    const target = detailTabButton.dataset.detailTab || detailTabButton.dataset.detailTabJump;
    elements.applicationDetailBody.querySelectorAll("[data-detail-tab]").forEach((button) => {
      const isActive = button.dataset.detailTab === target;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    elements.applicationDetailBody.querySelectorAll("[data-detail-panel]").forEach((panel) => {
      const isActive = panel.dataset.detailPanel === target;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
    return;
  }

  if (!event.target.closest("#dashboard-notifications, #notification-popover")) {
    elements.notificationPopover.hidden = true;
    elements.dashboardNotifications.setAttribute("aria-expanded", "false");
  }

  const jobFilterButton = event.target.closest("[data-job-filter]");
  if (jobFilterButton) {
    hrJobFilter = jobFilterButton.dataset.jobFilter;
    renderHrJobs();
    return;
  }

  const candidateViewButton = event.target.closest("[data-candidate-view]");
  if (candidateViewButton) {
    candidateView = candidateViewButton.dataset.candidateView;
    renderHrApplications();
    return;
  }

  const clearFilterButton = event.target.closest("[data-clear-filter]");
  if (clearFilterButton) {
    const filter = clearFilterButton.dataset.clearFilter;
    if (filter === "job") hrFilters.jobId = "all";
    if (filter === "status") hrFilters.status = "all";
    if (filter === "query") hrFilters.query = "";
    renderHrApplications();
    return;
  }

  const stageFilterButton = event.target.closest("[data-stage-filter]");
  if (stageFilterButton) {
    hrFilters.status = stageFilterButton.dataset.stageFilter;
    candidateView = "table";
    setActivePanel("candidates");
    return;
  }

  const jobCandidatesButton = event.target.closest("[data-job-candidates]");
  if (jobCandidatesButton) {
    hrFilters.jobId = jobCandidatesButton.dataset.jobCandidates;
    hrFilters.status = "all";
    candidateView = "table";
    setActivePanel("candidates");
    return;
  }

  const navButton = event.target.closest("[data-panel-target]");
  if (navButton) {
    if (navButton.dataset.stageShortcut) hrFilters.status = navButton.dataset.stageShortcut;
    setActivePanel(navButton.dataset.panelTarget);
    return;
  }

  const offerViewButton = event.target.closest("[data-view-offer]");
  if (offerViewButton) {
    openOfferLetter(offerViewButton.dataset.viewOffer);
    return;
  }

  const offerActionButton = event.target.closest("[data-offer-action]");
  if (offerActionButton) {
    offerActionButton.disabled = true;
    try {
      await handleOfferResponse(offerActionButton.dataset.applicationId, offerActionButton.dataset.offerAction);
    } catch (error) {
      showToast("Unable to record offer response", friendlyError(error), true);
    } finally {
      offerActionButton.disabled = false;
    }
    return;
  }

  const withdrawButton = event.target.closest("[data-withdraw-application]");
  if (withdrawButton) {
    withdrawButton.disabled = true;
    try {
      await withdrawApplication(withdrawButton.dataset.withdrawApplication);
    } catch (error) {
      showToast("Unable to withdraw application", friendlyError(error), true);
    } finally {
      withdrawButton.disabled = false;
    }
    return;
  }

  const applyButton = event.target.closest("[data-apply-job]");
  if (applyButton) {
    openApplicationDialog(applyButton.dataset.applyJob);
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-job]");
  if (toggleButton) {
    toggleButton.disabled = true;
    try {
      await toggleJob(toggleButton.dataset.toggleJob);
    } catch (error) {
      showToast("Unable to update job", friendlyError(error), true);
    } finally {
      toggleButton.disabled = false;
    }
    return;
  }

  const detailButton = event.target.closest("[data-view-application]");
  if (detailButton) await openApplicationDetail(detailButton.dataset.viewApplication);
});
document.addEventListener("submit", (event) => {
  if (event.target.classList.contains("application-update-form")) {
    runWithFormBusy(event.target, () => handleApplicationUpdate(event));
  }
});

document.querySelectorAll("details").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    document.querySelectorAll("details").forEach((otherItem) => {
      if (otherItem !== item) otherItem.removeAttribute("open");
    });
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sidebarOpen) closeMobileSidebar();
});

function setupMarketingLanding() {
  const tourTabs = Array.from(document.querySelectorAll("[data-tour-target]"));
  const tourPanels = Array.from(document.querySelectorAll("[data-tour-panel]"));

  const selectTourPanel = (target) => {
    tourTabs.forEach((tab) => {
      const isActive = tab.dataset.tourTarget === target;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    tourPanels.forEach((panel) => {
      const isActive = panel.dataset.tourPanel === target;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  tourTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTourPanel(tab.dataset.tourTarget));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      const nextIndex = (index + direction + tourTabs.length) % tourTabs.length;
      tourTabs[nextIndex].focus();
      selectTourPanel(tourTabs[nextIndex].dataset.tourTarget);
    });
  });

  document.querySelectorAll(".marketing-mobile-menu [data-route], .marketing-mobile-menu [data-section]").forEach((item) => {
    item.addEventListener("click", () => item.closest("details")?.removeAttribute("open"));
  });
}

setupMarketingLanding();
setupRevealAnimations();
setMinimumJobDeadline();

if (db) {
  db.auth.onAuthStateChange((_event, session) => {
    state.authUser = session?.user || null;
  });
}

(async function init() {
  try {
    await loadCurrentSession();
    if (state.authUser && state.profile) {
      await routeTo("app");
    } else {
      await routeTo("landing");
    }
  } catch (error) {
    console.error(error);
    await routeTo("landing");
    showToast("HireFlow could not initialize", friendlyError(error), true);
  } finally {
    document.body.classList.remove("is-booting");
  }
})();
