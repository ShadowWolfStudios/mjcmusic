const apiBase = "/api";
const adminLoginForm = document.getElementById("admin-login-form");
const loginMessage = document.getElementById("admin-login-message");
const loginCard = document.getElementById("login-card");
const dashboardCard = document.getElementById("dashboard-card");
const logoutButton = document.getElementById("logout-button");
const invoiceForm = document.getElementById("invoice-form");
const invoiceResultCard = document.getElementById("invoice-result-card");
const generatedLinkInput = document.getElementById("generated-link");
const copyLinkButton = document.getElementById("copy-link-button");
const sendEmailButton = document.getElementById("send-email-button");
const invoiceSendMessage = document.getElementById("invoice-send-message");
const invoiceList = document.getElementById("invoice-list");

const TOKEN_KEY = "mjcmusic-admin-token";

const getToken = () => sessionStorage.getItem(TOKEN_KEY) || "";
const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiFetch = async (path, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...options.headers,
  };
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Server error");
  }
  return response.json();
};

const renderInvoices = (invoices) => {
  invoiceList.innerHTML = "";

  if (!invoices || invoices.length === 0) {
    invoiceList.innerHTML = "<p>No invoices created yet.</p>";
    return;
  }

  invoices.forEach((invoice) => {
    const item = document.createElement("div");
    item.className = "invoice-item";
    item.innerHTML = `
      <div class="invoice-row">
        <div>
          <strong>${invoice.recipient}</strong>
          <p>${invoice.description} • ${invoice.amount}</p>
        </div>
        <div>
          <p>${invoice.status}</p>
        </div>
      </div>
      <div class="invoice-row">
        <p>${invoice.link || `${window.location.origin}/invoice-view.html?token=${encodeURIComponent(invoice.token)}`}</p>
        <div>
          <button class="btn btn-secondary btn-small" data-action="copy" data-token="${invoice.token}">Copy</button>
          <button class="btn btn-secondary btn-small" data-action="mark-paid" data-id="${invoice.id}">Mark paid</button>
        </div>
      </div>
    `;
    invoiceList.appendChild(item);
  });
};

const showDashboard = () => {
  loginCard.classList.add("hidden");
  dashboardCard.classList.remove("hidden");
  invoiceResultCard.classList.add("hidden");
  invoiceSendMessage.textContent = "";
  loadInvoices();
};

const logout = () => {
  clearToken();
  loginCard.classList.remove("hidden");
  dashboardCard.classList.add("hidden");
};

const loadInvoices = async () => {
  try {
    const data = await apiFetch("/admin/invoices", { method: "GET" });
    renderInvoices(data.invoices || []);
  } catch (error) {
    invoiceList.innerHTML = `<p>${error.message}</p>`;
  }
};

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const emailInput = document.getElementById("admin-email");
  const passwordInput = document.getElementById("admin-password");
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    loginMessage.textContent = "Enter your admin email and password.";
    return;
  }

  try {
    const data = await apiFetch("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    showDashboard();
    loginMessage.textContent = "";
    passwordInput.value = "";
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

logoutButton.addEventListener("click", () => {
  logout();
});

invoiceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("client-email").value.trim();
  const description = document.getElementById("invoice-description").value.trim();
  const amount = document.getElementById("invoice-amount").value.trim();
  const dueDate = document.getElementById("invoice-due-date").value;
  const providerUrl = document.getElementById("payment-provider-url").value.trim();

  if (!email || !description || !amount) {
    invoiceSendMessage.textContent = "Please fill in the client email, description, and amount.";
    return;
  }

  try {
    const data = await apiFetch("/admin/invoices", {
      method: "POST",
      body: JSON.stringify({ email, description, amount, dueDate, providerUrl }),
    });

    generatedLinkInput.value = data.link;
    invoiceResultCard.classList.remove("hidden");
    invoiceSendMessage.textContent = "Invoice link created.";
    loadInvoices();
  } catch (error) {
    invoiceSendMessage.textContent = error.message;
  }
});

copyLinkButton.addEventListener("click", () => {
  generatedLinkInput.select();
  document.execCommand("copy");
  invoiceSendMessage.textContent = "Link copied to clipboard.";
});

sendEmailButton.addEventListener("click", () => {
  const link = generatedLinkInput.value;
  const email = document.getElementById("client-email").value.trim();
  const description = document.getElementById("invoice-description").value.trim();
  const amount = document.getElementById("invoice-amount").value.trim();

  if (!link || !email) {
    invoiceSendMessage.textContent = "Create a link first, then click Send email.";
    return;
  }

  const subject = `Invoice from MJCMusic: ${description}`;
  const body = `Hi,%0D%0A%0D%0AYou can pay your invoice here:%0D%0A${link}%0D%0A%0D%0AAmount: ${amount}%0D%0ADescription: ${description}%0D%0A%0D%0AThank you!`;
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

invoiceList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const invoiceId = button.dataset.id;
  const invoiceToken = button.dataset.token;

  if (!action) return;

  if (action === "copy" && invoiceToken) {
    const tempInput = document.createElement("input");
    const link = `${window.location.origin}/invoice-view.html?token=${encodeURIComponent(invoiceToken)}`;
    tempInput.value = link;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    invoiceSendMessage.textContent = "Invoice link copied.";
  }

  if (action === "mark-paid" && invoiceId) {
    try {
      await apiFetch("/admin/invoices/mark-paid", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      });
      invoiceSendMessage.textContent = "Invoice marked as paid.";
      loadInvoices();
    } catch (error) {
      invoiceSendMessage.textContent = error.message;
    }
  }
});

(async () => {
  if (getToken()) {
    try {
      showDashboard();
    } catch {
      logout();
    }
  }
})();
