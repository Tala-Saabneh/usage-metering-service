const $ = (id) => document.getElementById(id);

let apiKey = "";
let account = null;
let plans = { account: [], user: [] };
let users = [];

const currentMonth = () => new Date().toISOString().slice(0, 7);

function setMessage(id, message, type = "") {
  const element = $(id);
  element.textContent = message;
  element.className = `message ${type}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (apiKey) headers["x-api-key"] = apiKey;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function fillPlanSelect(selectId, planList, placeholder) {
  const select = $(selectId);
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;

  for (const plan of planList) {
    const option = document.createElement("option");
    option.value = plan.id;
    option.textContent =
      `${plan.name} — ${Number(plan.monthly_allowance).toLocaleString()} units/month; ` +
      `${Number(plan.max_units_per_request).toLocaleString()} per request`;
    select.appendChild(option);
  }
}

async function loadPlans(type, publicOnly = false) {
  const suffix = publicOnly ? "&predefinedOnly=true" : "";
  const data = await api(`/api/plans?planType=${type}${suffix}`);
  plans[type] = data.plans || [];
  fillPlanSelect(
    type === "account" ? "account-plan" : "user-plan",
    plans[type],
    `Choose ${type} plan`
  );
}

function renderAccount() {
  $("account-details").classList.remove("hidden");
  $("account-details").innerHTML = `
    <strong>Connected account:</strong> ${escapeHtml(account?.name || "Account loaded")}<br>
    <span class="muted">Account ID: ${escapeHtml(account?.id || "Loaded using API key")}</span><br>
    <span class="muted">API key is held in this page's memory and is not saved in browser storage.</span>
  `;
}

async function connectWithKey(key) {
  if (!key.trim()) throw new Error("Enter an account API key first.");

  apiKey = key.trim();
  try {
    await loadPlans("account");
    await loadPlans("user");
    const data = await api(`/api/usage/summary?month=${currentMonth()}`);
    account = {
      id: data.account.id,
      name: data.account.name
    };
    renderAccount();
    $("api-key").value = key;
    setMessage("account-message", "Account connected successfully.", "success");
    await refreshUsersFromKnownList();
    await refreshReport();
    await refreshHistory();
  } catch (error) {
    apiKey = "";
    account = null;
    throw error;
  }
}

async function refreshUsersFromKnownList() {
  const select = $("usage-user");
  select.innerHTML = '<option value="">Choose a user</option>';

  for (const user of users) {
    const option = document.createElement("option");
    option.value = user.externalUserId;
    option.textContent = user.externalUserId;
    select.appendChild(option);
  }
  renderUsers();
}

function renderUsers() {
  const container = $("users-list");
  if (!users.length) {
    container.innerHTML = '<p class="muted">No users added in this session yet.</p>';
    return;
  }

  container.innerHTML = users.map((user) => `
    <div class="user-row">
      <strong>${escapeHtml(user.externalUserId)}</strong>
      <span>${escapeHtml(user.planName || "Assigned plan")}</span>
    </div>
  `).join("");
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

$("request-id").value = createRequestId();

async function refreshReport() {
  if (!apiKey) return;

  const summary = await api(`/api/usage/summary?month=${currentMonth()}`);
  const accountData = summary.account;

  const cards = [{
    title: `Account · ${accountData.name}`,
    plan: accountData.plan,
    allowance: accountData.monthlyAllowance,
    consumed: accountData.consumedUnits,
    remaining: accountData.remainingUnits
  }];

  for (const user of users) {
    try {
      const data = await api(
        `/api/usage/summary?month=${currentMonth()}&externalUserId=${encodeURIComponent(user.externalUserId)}`
      );
      if (data.user) {
        cards.push({
          title: `User · ${data.user.externalUserId}`,
          plan: data.user.plan,
          allowance: data.user.monthlyAllowance,
          consumed: data.user.consumedUnits,
          remaining: data.user.remainingUnits
        });
      }
    } catch {
      // Keep the rest of the report visible if one user cannot be loaded.
    }
  }

  $("report").innerHTML = cards.map((item) => {
    const allowance = Number(item.allowance);
    const consumed = Number(item.consumed);
    const percent = allowance > 0
      ? Math.min(100, Math.round(consumed / allowance * 100))
      : 0;

    return `
      <article class="report-card">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="muted small">Plan: ${escapeHtml(item.plan)}</div>
        <div class="metric"><span>Monthly allowance</span><strong>${allowance.toLocaleString()}</strong></div>
        <div class="metric"><span>Consumed</span><strong>${consumed.toLocaleString()}</strong></div>
        <div class="metric"><span>Remaining</span><strong>${Number(item.remaining).toLocaleString()}</strong></div>
        <div class="progress"><span style="width:${percent}%"></span></div>
        <p class="muted small">${percent}% used</p>
      </article>
    `;
  }).join("");
}

async function refreshHistory() {
  if (!apiKey) return;

  const data = await api(`/api/usage/history?month=${currentMonth()}&limit=100`);
  const body = $("history-body");

  if (!data.history?.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No requests recorded this month.</td></tr>';
    return;
  }

  body.innerHTML = data.history.map((item) => `
    <tr>
      <td>${escapeHtml(item.requestId)}</td>
      <td>${escapeHtml(item.externalUserId)}</td>
      <td>${Number(item.units).toLocaleString()}</td>
      <td class="${item.status === "accepted" ? "status-accepted" : "status-rejected"}">${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.rejectionReason || "—")}</td>
    </tr>
  `).join("");
}

$("account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("account-message", "");

  try {
    const name = $("account-name").value.trim();
    const planId = $("account-plan").value;
    if (!planId) throw new Error("Choose an account plan.");

    const response = await api("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name, planId })
    });

    apiKey = response.apiKey;
    account = response.account;
    users = [];
    $("api-key").value = apiKey;
    renderAccount();

    await loadPlans("account");
    await loadPlans("user");
    await refreshUsersFromKnownList();
    await refreshReport();
    await refreshHistory();

    setMessage(
      "account-message",
      "Account created. Copy and securely save the API key; it is only returned at account creation.",
      "success"
    );
  } catch (error) {
    setMessage("account-message", error.message, "error");
  }
});

$("key-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    users = [];
    await connectWithKey($("api-key").value);
  } catch (error) {
    setMessage("account-message", error.message, "error");
  }
});

$("user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("user-message", "");

  try {
    if (!apiKey) throw new Error("Create or load an account first.");

    const externalUserId = $("external-user-id").value.trim();
    const planId = $("user-plan").value;
    if (!planId) throw new Error("Choose a user plan.");

    const result = await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ externalUserId, planId })
    });

    const plan = plans.user.find((item) => item.id === planId);
    users = users.filter((user) => user.externalUserId !== externalUserId);
    users.push({
      externalUserId,
      planName: plan?.name || "User plan"
    });

    await refreshUsersFromKnownList();
    await refreshReport();
    setMessage("user-message", `User ${result.user.external_user_id} created successfully.`, "success");
    $("user-form").reset();
  } catch (error) {
    setMessage("user-message", error.message, "error");
  }
});

$("usage-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const resultBox = $("usage-result");
  resultBox.classList.remove("hidden", "accepted", "rejected");

  try {
    if (!apiKey) throw new Error("Create or load an account first.");

    const externalUserId = $("usage-user").value;
    const requestId = $("request-id").value.trim();
    const units = Number($("units").value);

    if (!externalUserId) throw new Error("Choose a user.");
    if (!requestId) throw new Error("Enter a request ID.");
    if (!Number.isSafeInteger(units) || units <= 0) {
      throw new Error("Units must be a positive whole number.");
    }

    const result = await api("/api/usage", {
      method: "POST",
      body: JSON.stringify({ externalUserId, requestId, units })
    });

    resultBox.classList.add("accepted");
    resultBox.textContent = `Request accepted. HTTP ${result.status}. ${JSON.stringify(result.body || result)}`;
  } catch (error) {
    resultBox.classList.add("rejected");
    resultBox.textContent = `Request failed or was rejected: ${error.message}`;
  }

  try {
    await refreshReport();
    await refreshHistory();
  } catch (error) {
    setMessage("global-message", `Could not refresh reports: ${error.message}`, "error");
  }

  $("request-id").value = createRequestId();
});

$("refresh-report").addEventListener("click", async () => {
  try {
    await refreshReport();
  } catch (error) {
    setMessage("global-message", error.message, "error");
  }
});

$("refresh-history").addEventListener("click", async () => {
  try {
    await refreshHistory();
  } catch (error) {
    setMessage("global-message", error.message, "error");
  }
});

async function initialize() {
  try {
    const response = await fetch("/health");
    if (!response.ok) throw new Error("API or database is unavailable.");
    $("connection").textContent = "Service online";
    $("connection").classList.remove("offline");
  } catch {
    $("connection").textContent = "Service unavailable";
    $("connection").classList.add("offline");
  }

  try {
    await loadPlans("account", true);
  } catch {
    $("account-plan").innerHTML = '<option value="">Plan list unavailable</option>';
    setMessage(
      "account-message",
      "Could not load public plans. The API plans endpoint must expose predefined plans for account creation.",
      "error"
    );
  }
}

initialize();
