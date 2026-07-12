const statusOptions = ["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"];

const supabaseConfig = window.HIREFLOW_SUPABASE || {};
const normalizedSupabaseUrl = normalizeSupabaseUrl(supabaseConfig.url || "");
const supabaseReady =
  window.supabase &&
  normalizedSupabaseUrl &&
  supabaseConfig.anonKey &&
  !normalizedSupabaseUrl.includes("YOUR_SUPABASE") &&
  !supabaseConfig.anonKey.includes("YOUR_SUPABASE");

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

function normalizeSupabaseUrl(url) {
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/auth\/v1\/?$/i, "").replace(/\/+$/, "");
}

const views = {
  landing: document.querySelector("#landing-view"),
  auth: document.querySelector("#auth-view"),
  app: document.querySelector("#app-view"),
};

const elements = {
  authForm: document.querySelector("#auth-form"),
  signupFields: document.querySelector("#signup-fields"),
  authName: document.querySelector("#auth-name"),
  authRole: document.querySelector("#auth-role"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authMessage: document.querySelector("#auth-message"),
  authTitle: document.querySelector("[data-auth-title]"),
  authCopy: document.querySelector("[data-auth-copy]"),
  authEyebrow: document.querySelector("[data-auth-eyebrow]"),
  authSubmit: document.querySelector("[data-auth-submit]"),
  authSwitch: document.querySelector("[data-auth-switch]"),
  authSwitchCopy: document.querySelector("[data-auth-switch-copy]"),
  userInitials: document.querySelector("[data-user-initials]"),
  userName: document.querySelector("[data-user-name]"),
  userRole: document.querySelector("[data-user-role]"),
  appNav: document.querySelector("#app-nav"),
  dashboardLabel: document.querySelector("[data-dashboard-label]"),
  dashboardTitle: document.querySelector("[data-dashboard-title]"),
  hrDashboard: document.querySelector("#hr-dashboard"),
  applicantDashboard: document.querySelector("#applicant-dashboard"),
  logoutButton: document.querySelector("#logout-button"),
  jobForm: document.querySelector("#job-form"),
  jobMessage: document.querySelector("#job-message"),
  hrJobsList: document.querySelector("#hr-jobs-list"),
  hrApplicationsList: document.querySelector("#hr-applications-list"),
  applicantJobsList: document.querySelector("#applicant-jobs-list"),
  myApplicationsList: document.querySelector("#my-applications-list"),
  profileForm: document.querySelector("#profile-form"),
  profileMessage: document.querySelector("#profile-message"),
  applicationDialog: document.querySelector("#application-dialog"),
  applicationForm: document.querySelector("#application-form"),
  applicationTitle: document.querySelector("#application-title"),
  applicationJobId: document.querySelector("#application-job-id"),
  applicationCover: document.querySelector("#application-cover"),
  applicationMessage: document.querySelector("#application-message"),
};

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove("is-active"));
  views[name].classList.add("is-active");
  document.body.dataset.view = name;
  document.body.scrollIntoView({ block: "start" });
}

async function showLandingSection(sectionId) {
  showView("landing");
  await renderPreviewStats();
  requestAnimationFrame(() => {
    document.querySelector(`#${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function showAuth(mode) {
  authMode = mode;
  elements.authMessage.textContent = "";
  elements.authMessage.classList.remove("is-error");

  const isSignup = mode === "signup";
  elements.signupFields.style.display = isSignup ? "grid" : "none";
  elements.authTitle.textContent = isSignup ? "Create your account" : "Sign in to HireFlow";
  elements.authEyebrow.textContent = isSignup ? "Create account" : "Welcome back";
  elements.authCopy.textContent = isSignup
    ? "Choose your role, create your account, and enter the correct dashboard for your workflow."
    : "Use your Supabase Auth email and password for this project.";
  elements.authSubmit.textContent = isSignup ? "Create account" : "Sign in";
  elements.authSwitchCopy.textContent = isSignup ? "Already have an account?" : "Need an account?";
  elements.authSwitch.textContent = isSignup ? "Sign in" : "Create account";
  showView("auth");

  if (!supabaseReady) {
    setMessage(
      elements.authMessage,
      "Supabase is not configured yet. Add your project URL and anon key in supabase-config.js.",
      true
    );
  }
}

async function routeTo(route) {
  if (route === "landing") {
    showView("landing");
    await renderPreviewStats();
    return;
  }

  if (route === "signup" || route === "signin") {
    showAuth(route);
    return;
  }

  if (route === "app") {
    if (!supabaseReady) {
      showAuth("signin");
      return;
    }

    await loadCurrentSession();
    if (!state.authUser || !state.profile) {
      showAuth("signin");
      return;
    }

    await loadDashboardData();
    renderApp();
    showView("app");
  }
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function runWithFormBusy(form, action) {
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  buttons.forEach((button) => {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = "Please wait...";
    button.disabled = true;
  });

  try {
    await action();
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
  const { data, error } = await db.from("profiles").select("*").eq("id", state.authUser.id).single();

  if (error) {
    console.error(error);
    state.profile = null;
    return;
  }

  state.profile = data;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!(await requireSupabase())) return;

  const email = elements.authEmail.value.trim().toLowerCase();
  const password = elements.authPassword.value;

  if (authMode === "signup") {
    const fullName = elements.authName.value.trim();
    const role = elements.authRole.value;

    if (!fullName || !email || !password) {
      setMessage(elements.authMessage, "Please complete all account fields.", true);
      return;
    }

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      setMessage(elements.authMessage, error.message, true);
      return;
    }

    if (!data.session) {
      setMessage(elements.authMessage, "Account created. Check your email to confirm before signing in.");
      elements.authForm.reset();
      return;
    }

    state.authUser = data.user;
    await upsertOwnProfile(fullName, role);
    elements.authForm.reset();
    await routeTo("app");
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage(elements.authMessage, error.message, true);
    return;
  }

  state.authUser = data.user;
  elements.authForm.reset();
  await routeTo("app");
}

async function upsertOwnProfile(fullName, role) {
  const { error } = await db.from("profiles").upsert({
    id: state.authUser.id,
    full_name: fullName,
    role,
  });

  if (error) {
    console.error(error);
  }

  await loadProfile();
}

async function loadDashboardData() {
  const [jobsResult, applicationsResult] = await Promise.all([
    db.from("jobs").select("*").order("created_at", { ascending: false }),
    state.profile.role === "hr"
      ? db.from("applications").select("*").order("created_at", { ascending: false })
      : db.from("applications").select("*").eq("applicant_id", state.profile.id).order("created_at", { ascending: false }),
  ]);

  if (jobsResult.error) {
    console.error(jobsResult.error);
    state.jobs = [];
  } else {
    state.jobs = jobsResult.data || [];
  }

  if (applicationsResult.error) {
    console.error(applicationsResult.error);
    state.applications = [];
  } else {
    state.applications = applicationsResult.data || [];
  }

  await loadVisibleProfiles();
}

async function loadVisibleProfiles() {
  if (state.profile.role !== "hr" || !state.applications.length) {
    state.profiles = state.profile ? [state.profile] : [];
    return;
  }

  const ids = [...new Set(state.applications.map((application) => application.applicant_id))];
  const { data, error } = await db.from("profiles").select("*").in("id", ids);

  if (error) {
    console.error(error);
    state.profiles = [];
    return;
  }

  state.profiles = data || [];
}

function renderApp() {
  const profile = state.profile;
  if (!profile) return;

  if (profile.role === "applicant" && !["profile", "jobs", "my-applications"].includes(activePanel)) {
    activePanel = "profile";
  }

  if (profile.role === "hr" && !["overview", "jobs", "applications"].includes(activePanel)) {
    activePanel = "overview";
  }

  elements.userInitials.textContent = getInitials(profile.full_name);
  elements.userName.textContent = profile.full_name;
  elements.userRole.textContent = profile.role === "hr" ? "HR Manager" : "Applicant";
  elements.dashboardLabel.textContent = profile.role === "hr" ? "HR manager portal" : "Applicant portal";
  elements.dashboardTitle.textContent = profile.role === "hr" ? "Recruitment dashboard" : "Applicant dashboard";

  elements.hrDashboard.classList.toggle("is-active", profile.role === "hr");
  elements.applicantDashboard.classList.toggle("is-active", profile.role === "applicant");

  renderNavigation(profile.role);

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
          ["applications", "Applications"],
        ]
      : [
          ["profile", "Profile"],
          ["jobs", "Jobs"],
          ["my-applications", "My applications"],
        ];

  elements.appNav.innerHTML = items
    .map(
      ([panel, label]) =>
        `<button type="button" class="${activePanel === panel ? "is-active" : ""}" data-panel-target="${panel}">${label}</button>`
    )
    .join("");
}

function renderHrDashboard() {
  document.querySelector("#hr-open-jobs").textContent = state.jobs.filter((job) => job.status === "Open").length;
  document.querySelector("#hr-applications").textContent = state.applications.length;
  document.querySelector("#hr-interviews").textContent = state.applications.filter(
    (application) => application.status === "Interview"
  ).length;
  const hiredMetric = document.querySelector("#hr-hired");
  if (hiredMetric) {
    hiredMetric.textContent = state.applications.filter((application) => application.status === "Hired").length;
  }

  renderHrJobs();
  renderHrApplications();
}

function renderHrJobs() {
  if (!state.jobs.length) {
    elements.hrJobsList.innerHTML = emptyState("No jobs have been posted yet. Use the form above to publish the first role.");
    return;
  }

  elements.hrJobsList.innerHTML = state.jobs.map(renderJobCardForHr).join("");
}

function renderJobCardForHr(job) {
  const applicationCount = state.applications.filter((application) => application.job_id === job.id).length;
  return `
    <article class="record-card">
      <div class="record-card-header">
        <div>
          <h3>${escapeHtml(job.title)}</h3>
          <p>${escapeHtml(job.description)}</p>
        </div>
        <span class="badge ${statusClass(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      <div class="meta-row">
        <span class="badge neutral">${escapeHtml(job.department)}</span>
        <span class="badge neutral">${escapeHtml(job.location)}</span>
        <span class="badge neutral">Deadline: ${escapeHtml(job.deadline)}</span>
        <span class="badge neutral">${applicationCount} applications</span>
      </div>
      <p><strong>Requirements:</strong> ${escapeHtml(job.requirements)}</p>
      <div class="card-actions">
        <button class="btn btn-secondary" type="button" data-toggle-job="${job.id}">
          ${job.status === "Open" ? "Close job" : "Reopen job"}
        </button>
      </div>
    </article>
  `;
}

function renderHrApplications() {
  if (!state.applications.length) {
    elements.hrApplicationsList.innerHTML = emptyState("No applications have been submitted yet.");
    return;
  }

  elements.hrApplicationsList.innerHTML = state.applications
    .map((application) => {
      const job = state.jobs.find((item) => item.id === application.job_id);
      const applicant = state.profiles.find((item) => item.id === application.applicant_id);
      if (!job || !applicant) return "";

      return `
        <article class="record-card">
          <div class="record-card-header">
            <div>
              <h3>${escapeHtml(applicant.full_name)}</h3>
              <p>Applied for ${escapeHtml(job.title)}</p>
            </div>
            <span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span>
          </div>
          <div class="meta-row">
            <span class="badge neutral">${escapeHtml(applicant.phone || "No phone saved")}</span>
            <span class="badge neutral">${escapeHtml(applicant.location || "No location saved")}</span>
            <span class="badge neutral">${escapeHtml(applicant.cv_url || "No CV link saved")}</span>
          </div>
          <p><strong>Skills:</strong> ${escapeHtml(applicant.skills || "No skills saved")}</p>
          <p><strong>Cover letter:</strong> ${escapeHtml(application.cover_letter)}</p>
          <form class="form-grid application-update-form" data-application-id="${application.id}">
            <label>
              Status
              <select name="status">
                ${statusOptions
                  .map((status) => `<option value="${status}" ${status === application.status ? "selected" : ""}>${status}</option>`)
                  .join("")}
              </select>
            </label>
            <label>
              Interview date
              <input name="interviewDate" type="date" value="${escapeHtml(application.interview_date || "")}" />
            </label>
            <label class="span-2">
              HR notes
              <textarea name="notes" rows="3">${escapeHtml(application.notes || "")}</textarea>
            </label>
            <button class="btn btn-primary" type="submit">Update application</button>
          </form>
        </article>
      `;
    })
    .join("");
}

function renderApplicantDashboard(profile) {
  elements.profileForm.querySelector("#profile-phone").value = profile.phone || "";
  elements.profileForm.querySelector("#profile-location").value = profile.location || "";
  elements.profileForm.querySelector("#profile-skills").value = profile.skills || "";
  elements.profileForm.querySelector("#profile-cv").value = profile.cv_url || "";
  renderApplicantJobs(profile);
  renderMyApplications(profile);
}

function renderApplicantJobs(profile) {
  const openJobs = state.jobs.filter((job) => job.status === "Open");
  if (!openJobs.length) {
    elements.applicantJobsList.innerHTML = emptyState("No open jobs are available yet. Ask an HR manager to post a role.");
    return;
  }

  elements.applicantJobsList.innerHTML = openJobs
    .map((job) => {
      const alreadyApplied = state.applications.some(
        (application) => application.job_id === job.id && application.applicant_id === profile.id
      );

      return `
        <article class="record-card">
          <div class="record-card-header">
            <div>
              <h3>${escapeHtml(job.title)}</h3>
              <p>${escapeHtml(job.description)}</p>
            </div>
            <span class="badge ${statusClass(job.status)}">${escapeHtml(job.status)}</span>
          </div>
          <div class="meta-row">
            <span class="badge neutral">${escapeHtml(job.department)}</span>
            <span class="badge neutral">${escapeHtml(job.location)}</span>
            <span class="badge neutral">Deadline: ${escapeHtml(job.deadline)}</span>
          </div>
          <p><strong>Requirements:</strong> ${escapeHtml(job.requirements)}</p>
          <div class="card-actions">
            <button class="btn ${alreadyApplied ? "btn-secondary" : "btn-primary"}" type="button" data-apply-job="${job.id}" ${
              alreadyApplied ? "disabled" : ""
            }>
              ${alreadyApplied ? "Applied" : "Apply now"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMyApplications(profile) {
  const applications = state.applications.filter((application) => application.applicant_id === profile.id);
  if (!applications.length) {
    elements.myApplicationsList.innerHTML = emptyState("You have not submitted any applications yet.");
    return;
  }

  elements.myApplicationsList.innerHTML = applications
    .map((application) => {
      const job = state.jobs.find((item) => item.id === application.job_id);
      if (!job) return "";

      return `
        <article class="record-card">
          <div class="record-card-header">
            <div>
              <h3>${escapeHtml(job.title)}</h3>
              <p>${escapeHtml(job.department)} - ${escapeHtml(job.location)}</p>
            </div>
            <span class="badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span>
          </div>
          <p><strong>Submitted cover letter:</strong> ${escapeHtml(application.cover_letter)}</p>
          <p><strong>Interview date:</strong> ${escapeHtml(application.interview_date || "Not scheduled")}</p>
          <p><strong>HR notes:</strong> ${escapeHtml(application.notes || "No notes yet")}</p>
        </article>
      `;
    })
    .join("");
}

async function handleJobSubmit(event) {
  event.preventDefault();

  const job = {
    title: document.querySelector("#job-title").value.trim(),
    department: document.querySelector("#job-department").value.trim(),
    location: document.querySelector("#job-location").value.trim(),
    deadline: document.querySelector("#job-deadline").value,
    description: document.querySelector("#job-description").value.trim(),
    requirements: document.querySelector("#job-requirements").value.trim(),
    status: "Open",
    created_by: state.profile.id,
  };

  if (Object.values(job).some((value) => value === "")) {
    setMessage(elements.jobMessage, "Please complete every job field.", true);
    return;
  }

  const { error } = await db.from("jobs").insert(job);
  if (error) {
    setMessage(elements.jobMessage, error.message, true);
    return;
  }

  elements.jobForm.reset();
  setMessage(elements.jobMessage, "Job published successfully.");
  await loadDashboardData();
  renderApp();
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const updates = {
    phone: document.querySelector("#profile-phone").value.trim(),
    location: document.querySelector("#profile-location").value.trim(),
    skills: document.querySelector("#profile-skills").value.trim(),
    cv_url: document.querySelector("#profile-cv").value.trim(),
  };

  const { error } = await db.from("profiles").update(updates).eq("id", state.profile.id);
  if (error) {
    setMessage(elements.profileMessage, error.message, true);
    return;
  }

  setMessage(elements.profileMessage, "Profile saved.");
  await loadProfile();
  await loadDashboardData();
  renderApp();
}

function openApplicationDialog(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;

  elements.applicationJobId.value = jobId;
  elements.applicationTitle.textContent = job.title;
  elements.applicationCover.value = "";
  setMessage(elements.applicationMessage, "");
  elements.applicationDialog.showModal();
}

async function handleApplicationSubmit(event) {
  event.preventDefault();

  const jobId = elements.applicationJobId.value;
  const coverLetter = elements.applicationCover.value.trim();

  if (!jobId || !coverLetter) {
    setMessage(elements.applicationMessage, "Please write a cover letter before submitting.", true);
    return;
  }

  const alreadyApplied = state.applications.some(
    (application) => application.job_id === jobId && application.applicant_id === state.profile.id
  );

  if (alreadyApplied) {
    setMessage(elements.applicationMessage, "You have already applied for this job.", true);
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

  elements.applicationDialog.close();
  await loadDashboardData();
  renderApp();
}

async function handleApplicationUpdate(event) {
  event.preventDefault();
  const form = event.target;

  const { error } = await db
    .from("applications")
    .update({
      status: form.elements.status.value,
      interview_date: form.elements.interviewDate.value || null,
      notes: form.elements.notes.value.trim(),
    })
    .eq("id", form.dataset.applicationId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadDashboardData();
  renderApp();
}

async function toggleJob(jobId) {
  const job = state.jobs.find((item) => item.id === jobId);
  if (!job) return;

  const { error } = await db
    .from("jobs")
    .update({ status: job.status === "Open" ? "Closed" : "Open" })
    .eq("id", jobId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadDashboardData();
  renderApp();
}

async function renderPreviewStats() {
  let jobs = [];
  let applications = [];

  if (supabaseReady && state.authUser) {
    const [jobsResult, applicationsResult] = await Promise.all([
      db.from("jobs").select("id,status"),
      db.from("applications").select("status"),
    ]);

    jobs = jobsResult.error ? [] : jobsResult.data || [];
    applications = applicationsResult.error ? [] : applicationsResult.data || [];
  }

  document.querySelector("[data-preview-jobs]").textContent = jobs.filter((job) => job.status === "Open").length;
  document.querySelector("[data-preview-applications]").textContent = applications.length;
  document.querySelector("[data-preview-interviews]").textContent = applications.filter(
    (application) => application.status === "Interview"
  ).length;

  document.querySelectorAll("[data-stage-count]").forEach((stage) => {
    const status = stage.dataset.stageCount;
    stage.textContent = applications.filter((application) => application.status === status).length;
  });
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  return `status-${String(status).toLowerCase().replaceAll(" ", "-")}`;
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
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
  if (db) {
    await db.auth.signOut();
  }

  state = {
    authUser: null,
    profile: null,
    profiles: [],
    jobs: [],
    applications: [],
  };
  activePanel = "overview";
  await routeTo("landing");
});

elements.jobForm.addEventListener("submit", (event) => runWithFormBusy(elements.jobForm, () => handleJobSubmit(event)));
elements.profileForm.addEventListener("submit", (event) => runWithFormBusy(elements.profileForm, () => handleProfileSubmit(event)));
elements.applicationForm.addEventListener("submit", (event) =>
  runWithFormBusy(elements.applicationForm, () => handleApplicationSubmit(event))
);
document.querySelector("#close-application-dialog").addEventListener("click", () => elements.applicationDialog.close());

document.addEventListener("click", async (event) => {
  const navButton = event.target.closest("[data-panel-target]");
  if (navButton) {
    activePanel = navButton.dataset.panelTarget;
    renderApp();
    document.querySelector(`[data-panel="${activePanel}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const applyButton = event.target.closest("[data-apply-job]");
  if (applyButton) {
    openApplicationDialog(applyButton.dataset.applyJob);
  }

  const toggleButton = event.target.closest("[data-toggle-job]");
  if (toggleButton) {
    await toggleJob(toggleButton.dataset.toggleJob);
  }
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
      if (otherItem !== item) {
        otherItem.removeAttribute("open");
      }
    });
  });
});

setupRevealAnimations();

if (db) {
  db.auth.onAuthStateChange(async (_event, session) => {
    state.authUser = session?.user || null;
  });
}

(async function init() {
  await loadCurrentSession();
  if (state.authUser && state.profile) {
    await routeTo("app");
  } else {
    await routeTo("landing");
  }
})();
