const statusOptions = ["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"];
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
};
let authMode = "signup";
let activePanel = "overview";
let sidebarOpen = false;
let hrFilters = {
  jobId: "all",
  status: "all",
  query: "",
};

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
  dashboardLoading: document.querySelector("#dashboard-loading"),
  hrDashboard: document.querySelector("#hr-dashboard"),
  applicantDashboard: document.querySelector("#applicant-dashboard"),
  logoutButton: document.querySelector("#logout-button"),
  openSidebar: document.querySelector("#open-sidebar"),
  closeSidebar: document.querySelector("#close-sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  jobForm: document.querySelector("#job-form"),
  jobMessage: document.querySelector("#job-message"),
  hrJobsList: document.querySelector("#hr-jobs-list"),
  hrApplicationsList: document.querySelector("#hr-applications-list"),
  hrPipelineBoard: document.querySelector("#hr-pipeline-board"),
  hrOverviewPipeline: document.querySelector("#hr-overview-pipeline"),
  hrOverviewRecent: document.querySelector("#hr-overview-recent"),
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

  const [jobsResult, applicationsResult] = await Promise.all([
    db.from("jobs").select("*").order("created_at", { ascending: false }),
    applicationQuery,
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (applicationsResult.error) throw applicationsResult.error;

  state.jobs = jobsResult.data || [];
  state.applications = applicationsResult.data || [];
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
  const hashPanel = window.location.hash.match(/^#app\/(.+)$/)?.[1];
  const allowed = state.profile.role === "hr" ? ["overview", "jobs", "applications"] : ["profile", "jobs", "my-applications"];
  activePanel = allowed.includes(hashPanel) ? hashPanel : allowed[0];
}

function renderApp() {
  const profile = state.profile;
  if (!profile) return;

  const allowedPanels = profile.role === "hr" ? ["overview", "jobs", "applications"] : ["profile", "jobs", "my-applications"];
  if (!allowedPanels.includes(activePanel)) activePanel = allowedPanels[0];

  elements.userInitials.forEach((item) => {
    item.textContent = getInitials(profile.full_name || "User");
  });
  elements.userName.textContent = profile.full_name || "User";
  elements.userRole.textContent = profile.role === "hr" ? "HR Manager" : "Applicant";

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

function renderNavigation(role) {
  const items =
    role === "hr"
      ? [
          ["overview", "Overview"],
          ["jobs", "Jobs"],
          ["applications", "Candidates"],
        ]
      : [
          ["profile", "My profile"],
          ["jobs", "Browse jobs"],
          ["my-applications", "My applications"],
        ];

  elements.appNav.innerHTML = items
    .map(
      ([panel, label]) =>
        `<button type="button" class="${activePanel === panel ? "is-active" : ""}" data-panel-target="${panel}">${escapeHtml(label)}</button>`
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
    overview: ["HR workspace", "Recruitment overview", "Monitor vacancies, candidates, interviews, and hiring outcomes."],
    jobs: ["HR workspace", "Job management", "Publish new opportunities and manage active vacancies."],
    applications: ["HR workspace", "Candidate pipeline", "Review applicants and keep every hiring stage up to date."],
  };
  const applicantCopy = {
    profile: ["Applicant portal", "My profile", "Keep your details and CV ready for new opportunities."],
    jobs: ["Applicant portal", "Browse open jobs", "Discover roles that are currently accepting applications."],
    "my-applications": ["Applicant portal", "My applications", "Track your submissions, interviews, and hiring decisions."],
  };

  const copy = (role === "hr" ? hrCopy : applicantCopy)[activePanel];
  elements.dashboardLabel.textContent = copy[0];
  elements.dashboardTitle.textContent = copy[1];
  elements.dashboardDescription.textContent = copy[2];

  const actionMap =
    role === "hr"
      ? {
          overview: ["Post a job", "jobs"],
          jobs: ["Review candidates", "applications"],
          applications: ["Post a job", "jobs"],
        }
      : {
          profile: ["Browse jobs", "jobs"],
          jobs: ["View applications", "my-applications"],
          "my-applications": ["Browse jobs", "jobs"],
        };

  const [label, panel] = actionMap[activePanel] || [];
  elements.topbarPrimaryAction.hidden = !label;
  elements.topbarPrimaryAction.textContent = label || "";
  elements.topbarPrimaryAction.dataset.targetPanel = panel || "";
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
  const interviews = state.applications.filter((application) => application.status === "Interview").length;
  const hired = state.applications.filter((application) => application.status === "Hired").length;

  document.querySelector("#hr-open-jobs").textContent = openJobs;
  document.querySelector("#hr-applications").textContent = state.applications.length;
  document.querySelector("#hr-interviews").textContent = interviews;
  document.querySelector("#hr-hired").textContent = hired;

  renderHrOverview();
  renderHrJobs();
  renderHrApplications();
}

function renderHrOverview() {
  const maxCount = Math.max(...statusOptions.map((status) => state.applications.filter((item) => item.status === status).length), 1);
  elements.hrOverviewPipeline.innerHTML = statusOptions
    .filter((status) => status !== "Rejected")
    .map((status) => {
      const count = state.applications.filter((application) => application.status === status).length;
      const width = Math.max(4, Math.round((count / maxCount) * 100));
      return `<div class="overview-stage"><span>${escapeHtml(status)}</span><strong>${count}</strong><i style="--stage-width:${width}%"></i></div>`;
    })
    .join("");

  const recent = state.applications.slice(0, 4);
  elements.hrOverviewRecent.innerHTML = recent.length
    ? recent
        .map((application) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<button class="mini-record text-button" type="button" data-view-application="${application.id}"><div><strong>${escapeHtml(applicant.full_name)}</strong><small>${escapeHtml(job.title)} · ${formatDate(application.created_at)}</small></div><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></button>`;
        })
        .join("")
    : `<div class="empty-state">New applications will appear here.</div>`;
}

function renderHrJobs() {
  if (!state.jobs.length) {
    elements.hrJobsList.innerHTML = emptyState("No jobs have been posted yet. Use the form above to publish your first vacancy.");
    return;
  }

  elements.hrJobsList.innerHTML = state.jobs.map(renderJobCardForHr).join("");
}

function renderJobCardForHr(job) {
  const applicationCount = state.applications.filter((application) => application.job_id === job.id).length;
  return `
    <article class="record-card">
      <div class="record-card-header">
        <div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.description)}</p></div>
        <span class="badge ${statusClass(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <div class="meta-row">
        <span class="badge neutral">${escapeHtml(job.department)}</span>
        <span class="badge neutral">${escapeHtml(job.location)}</span>
        <span class="badge neutral">${escapeHtml(job.employment_type || "Full-time")}</span>
        <span class="badge neutral">${escapeHtml(job.workplace_type || "On-site")}</span>
        <span class="badge neutral">${Number(job.positions || 1)} position${Number(job.positions || 1) === 1 ? "" : "s"}</span>
        <span class="badge neutral">${applicationCount} application${applicationCount === 1 ? "" : "s"}</span>
      </div>
      <p><strong>Deadline:</strong> ${formatDate(job.deadline)}</p>
      ${job.salary_range ? `<p><strong>Salary:</strong> ${escapeHtml(job.salary_range)}</p>` : ""}
      <p><strong>Requirements:</strong> ${escapeHtml(job.requirements)}</p>
      <div class="card-actions"><button class="btn btn-secondary" type="button" data-toggle-job="${job.id}">${job.status === "Open" ? "Close job" : "Reopen job"}</button></div>
    </article>
  `;
}

function renderHrApplications() {
  renderHrApplicationFilters();

  if (!state.applications.length) {
    elements.hrApplicationsList.innerHTML = emptyState("No applications have been submitted yet.");
    elements.hrPipelineBoard.innerHTML = "";
    return;
  }

  const filteredApplications = getFilteredHrApplications();
  renderHrPipeline(filteredApplications);

  if (!filteredApplications.length) {
    elements.hrApplicationsList.innerHTML = emptyState("No applications match the selected filters.");
    return;
  }

  elements.hrApplicationsList.innerHTML = `
    <table class="application-table">
      <thead><tr><th>Candidate</th><th>Role</th><th>Applied</th><th>Stage</th><th>CV</th><th>Action</th></tr></thead>
      <tbody>${filteredApplications.map(renderHrApplicationRow).join("")}</tbody>
    </table>
  `;
}

function renderHrApplicationFilters() {
  const currentJob = hrFilters.jobId;
  elements.hrFilterJob.innerHTML = [
    `<option value="all">All jobs</option>`,
    ...state.jobs.map((job) => `<option value="${job.id}">${escapeHtml(job.title)}</option>`),
  ].join("");
  elements.hrFilterJob.value = state.jobs.some((job) => job.id === currentJob) ? currentJob : "all";

  elements.hrFilterStatus.innerHTML = [
    `<option value="all">All statuses</option>`,
    ...statusOptions.map((status) => `<option value="${status}">${status}</option>`),
  ].join("");
  elements.hrFilterStatus.value = statusOptions.includes(hrFilters.status) ? hrFilters.status : "all";
  elements.hrFilterSearch.value = hrFilters.query;
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
      application.notes,
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
        .slice(0, 4)
        .map((application) => {
          const { job, applicant } = getApplicationContext(application);
          if (!job || !applicant) return "";
          return `<button class="pipeline-card" type="button" data-view-application="${application.id}"><strong>${escapeHtml(applicant.full_name)}</strong><span>${escapeHtml(job.title)}</span></button>`;
        })
        .join("");

      return `<section class="pipeline-column"><div class="pipeline-column-header"><span class="badge ${statusClass(status)}">${escapeHtml(status)}</span><strong>${statusApplications.length}</strong></div>${cards || `<div class="pipeline-empty">No candidates</div>`}</section>`;
    })
    .join("");
}

function renderHrApplicationRow(application) {
  const { job, applicant } = getApplicationContext(application);
  if (!job || !applicant) return "";
  const hasCv = Boolean(applicant.cv_path || safeUrl(applicant.cv_url));

  return `
    <tr>
      <td><div class="candidate-cell"><span class="avatar">${escapeHtml(getInitials(applicant.full_name))}</span><div><strong>${escapeHtml(applicant.full_name)}</strong><small>${escapeHtml(applicant.location || "Location not added")}</small></div></div></td>
      <td><strong>${escapeHtml(job.title)}</strong><br><small>${escapeHtml(job.department)}</small></td>
      <td>${formatDate(application.created_at)}</td>
      <td><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
      <td>${hasCv ? "Available" : "Not added"}</td>
      <td><button class="btn btn-secondary table-action" type="button" data-view-application="${application.id}">Review</button></td>
    </tr>
  `;
}

function renderApplicationUpdateForm(application) {
  return `
    <form class="form-grid application-update-form" data-application-id="${application.id}" novalidate>
      <label>Status<select name="status">${statusOptions
        .map((status) => `<option value="${status}" ${status === application.status ? "selected" : ""}>${status}</option>`)
        .join("")}</select></label>
      <label>Interview date<input name="interviewDate" type="date" value="${escapeHtml(application.interview_date || "")}" /></label>
      <label class="span-2">Private HR notes<textarea name="notes" rows="4">${escapeHtml(application.notes || "")}</textarea></label>
      <div class="form-actions span-2"><button class="btn btn-primary" type="submit">Save application update</button></div>
    </form>
  `;
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

  elements.applicationDetailTitle.textContent = applicant.full_name;
  elements.applicationDetailBody.innerHTML = `<div class="skeleton-panel" aria-label="Loading candidate details"></div>`;
  elements.applicationDetailDialog.showModal();

  const cvUrl = await getApplicantCvUrl(applicant);
  const portfolioUrl = safeUrl(applicant.cv_url);
  const cvMarkup = cvUrl
    ? `<a class="cv-link" href="${escapeHtml(cvUrl)}" target="_blank" rel="noopener noreferrer">Open uploaded CV ↗</a>`
    : portfolioUrl
      ? `<a class="cv-link" href="${escapeHtml(portfolioUrl)}" target="_blank" rel="noopener noreferrer">Open portfolio ↗</a>`
      : `<p>No CV or portfolio has been added.</p>`;

  elements.applicationDetailBody.innerHTML = `
    <div class="detail-layout">
      <section class="detail-main">
        <div class="detail-summary"><span class="avatar">${escapeHtml(getInitials(applicant.full_name))}</span><div><h3>${escapeHtml(applicant.full_name)}</h3><p>${escapeHtml(applicant.location || "Location not added")} · ${escapeHtml(applicant.phone || "Phone not added")}</p></div><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></div>
        <div class="detail-section"><h4>Applied role</h4><p>${escapeHtml(job.title)} · ${escapeHtml(job.department)} · ${escapeHtml(job.location)}</p></div>
        <div class="detail-section"><h4>Skills</h4><p>${escapeHtml(applicant.skills || "No skills added")}</p></div>
        <div class="detail-section"><h4>Cover letter</h4><p>${escapeHtml(application.cover_letter)}</p></div>
        <div class="detail-section"><h4>CV or portfolio</h4>${cvMarkup}</div>
      </section>
      <aside class="detail-side">
        <dl>
          <div><dt>Current stage</dt><dd>${escapeHtml(application.status)}</dd></div>
          <div><dt>Interview date</dt><dd>${application.interview_date ? formatDate(application.interview_date) : "Not scheduled"}</dd></div>
          <div><dt>Application date</dt><dd>${formatDate(application.created_at)}</dd></div>
          <div><dt>Employment type</dt><dd>${escapeHtml(job.employment_type || "Full-time")}</dd></div>
        </dl>
        <div class="detail-section"><h4>Private HR notes</h4><p>${escapeHtml(application.notes || "No notes yet")}</p></div>
      </aside>
    </div>
    <div class="detail-update">${renderApplicationUpdateForm(application)}</div>
  `;
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
      return `
        <article class="record-card">
          <div class="record-card-header"><div><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.department)} · ${escapeHtml(job.location)}</p></div><span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></div>
          <p><strong>Applied:</strong> ${formatDate(application.created_at)}</p>
          <p><strong>Interview:</strong> ${application.interview_date ? formatDate(application.interview_date) : "Not scheduled"}</p>
          <div class="application-timeline" aria-label="Application progress">${renderTimeline(application.status)}</div>
          <div class="timeline-labels"><span>Applied</span><span>Screening</span><span>Interview</span><span>Offer</span><span>Hired</span></div>
          ${application.notes ? `<p><strong>Update from HR:</strong> ${escapeHtml(application.notes)}</p>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderTimeline(status) {
  const timelineStatuses = ["Applied", "Screening", "Interview", "Offered", "Hired"];
  const currentIndex = timelineStatuses.indexOf(status);
  return timelineStatuses
    .map((item, index) => {
      const className = status === "Rejected" ? (index === 0 ? "complete" : "") : index < currentIndex ? "complete" : index === currentIndex ? "current" : "";
      return `<i class="timeline-step ${className}" title="${escapeHtml(item)}"></i>`;
    })
    .join("");
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
  showToast("Job published", `${job.title} is now open for applications.`);
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
  const status = form.elements.status.value;
  const interviewDate = form.elements.interviewDate.value || null;

  if (status === "Interview" && !interviewDate) {
    showToast("Interview date required", "Choose a date before moving the candidate to Interview.", true);
    return;
  }

  const { error } = await db
    .from("applications")
    .update({
      status,
      interview_date: interviewDate,
      notes: form.elements.notes.value.trim(),
    })
    .eq("id", form.dataset.applicationId);
  if (error) throw error;

  elements.applicationDetailDialog.close();
  showToast("Application updated", `Candidate moved to ${status}.`);
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
  state = { authUser: null, profile: null, profiles: [], jobs: [], applications: [] };
  activePanel = "overview";
  window.history.replaceState(null, "", window.location.pathname);
  showToast("Signed out", "You have securely left the workspace.");
  await routeTo("landing");
});

elements.jobForm.addEventListener("submit", (event) => runWithFormBusy(elements.jobForm, () => handleJobSubmit(event)));
elements.profileForm.addEventListener("submit", (event) => runWithFormBusy(elements.profileForm, () => handleProfileSubmit(event)));
elements.applicationForm.addEventListener("submit", (event) => runWithFormBusy(elements.applicationForm, () => handleApplicationSubmit(event)));
document.querySelector("#close-application-dialog").addEventListener("click", () => elements.applicationDialog.close());
elements.closeApplicationDetailDialog.addEventListener("click", () => elements.applicationDetailDialog.close());
elements.openSidebar.addEventListener("click", openMobileSidebar);
elements.closeSidebar.addEventListener("click", closeMobileSidebar);
elements.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

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
  const panel = elements.topbarPrimaryAction.dataset.targetPanel;
  if (panel) setActivePanel(panel);
});

document.addEventListener("click", async (event) => {
  const navButton = event.target.closest("[data-panel-target]");
  if (navButton) {
    setActivePanel(navButton.dataset.panelTarget);
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
