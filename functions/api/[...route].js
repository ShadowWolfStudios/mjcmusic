const jsonHeaders = { "Content-Type": "application/json" };

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  value = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = value.length % 4;
  if (pad === 2) value += "==";
  if (pad === 3) value += "=";
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(digest);
}

async function hmacSha256(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(sig);
}

async function createJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = await hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  if (signature !== expectedSignature) return null;

  const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
  try {
    return JSON.parse(payloadJson);
  } catch (error) {
    return null;
  }
}

async function ensureTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      due_date TEXT,
      provider_url TEXT,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();
}

async function getAdminByEmail(env, email) {
  const result = await env.DB.prepare(`SELECT * FROM admins WHERE email = ?`).bind(email).all();
  return result.results?.[0] || null;
}

async function createAdmin(env, email, password) {
  const passwordHash = await sha256(`${env.PASSWORD_SALT || ""}|${password}`);
  const createdAt = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)`)
    .bind(email, passwordHash, createdAt)
    .run();
}

async function authenticateAdmin(env, email, password) {
  const admin = await getAdminByEmail(env, email);
  if (!admin) return null;
  const passwordHash = await sha256(`${env.PASSWORD_SALT || ""}|${password}`);
  if (passwordHash !== admin.password_hash) return null;
  return admin;
}

async function requireAdmin(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  if (!env.JWT_SECRET) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload?.sub) return null;
  return payload;
}

async function createInvoiceRecord(env, data) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64UrlEncode(tokenBytes);
  const createdAt = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO invoices (recipient, description, amount, due_date, provider_url, token, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(data.email, data.description, data.amount, data.dueDate || null, data.providerUrl || null, token, "Pending", createdAt).run();

  return {
    recipient: data.email,
    description: data.description,
    amount: data.amount,
    dueDate: data.dueDate || null,
    providerUrl: data.providerUrl || null,
    token,
    status: "Pending",
    createdAt,
  };
}

async function getInvoices(env) {
  const result = await env.DB.prepare(`SELECT id, recipient, description, amount, due_date AS dueDate, provider_url AS providerUrl, token, status, created_at AS createdAt FROM invoices ORDER BY id DESC`).all();
  return result.results || [];
}

async function markInvoicePaid(env, invoiceId) {
  await env.DB.prepare(`UPDATE invoices SET status = 'Paid' WHERE id = ?`).bind(invoiceId).run();
}

async function getInvoiceByToken(env, token) {
  const result = await env.DB.prepare(`SELECT recipient, description, amount, due_date AS dueDate, provider_url AS providerUrl, token, status, created_at AS createdAt FROM invoices WHERE token = ?`).bind(token).all();
  return result.results?.[0] || null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const routeSegments = params.route || [];
  const path = Array.isArray(routeSegments) ? routeSegments.join("/") : routeSegments;

  await ensureTables(env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (path === "admin/login" && request.method === "POST") {
    const body = await request.json();
    const email = body.email?.toLowerCase();
    const password = body.password;
    if (!email || !password) {
      return response(400, { error: "email and password are required" });
    }

    const admin = await authenticateAdmin(env, email, password);
    if (!admin) {
      return response(401, { error: "Invalid email or password" });
    }

    if (!env.JWT_SECRET) {
      return response(500, { error: "JWT_SECRET is not configured" });
    }

    const token = await createJwt({ sub: admin.id, email: admin.email, role: "admin", iat: Date.now() }, env.JWT_SECRET);
    return response(200, { token });
  }

  if (path === "admin/seed" && request.method === "POST") {
    const initSecret = request.headers.get("X-Init-Secret");
    if (!env.INIT_SECRET || initSecret !== env.INIT_SECRET) {
      return response(403, { error: "Invalid init secret" });
    }

    const body = await request.json();
    const email = body.email?.toLowerCase();
    const password = body.password;
    if (!email || !password) {
      return response(400, { error: "email and password are required" });
    }

    const existing = await getAdminByEmail(env, email);
    if (existing) {
      return response(409, { error: "Admin user already exists" });
    }

    await createAdmin(env, email, password);
    return response(201, { success: true });
  }

  if (path === "admin/users" && request.method === "POST") {
    const auth = await requireAdmin(request, env);
    if (!auth) {
      return response(401, { error: "Unauthorized" });
    }

    const body = await request.json();
    const email = body.email?.toLowerCase();
    const password = body.password;
    if (!email || !password) {
      return response(400, { error: "email and password are required" });
    }

    const existing = await getAdminByEmail(env, email);
    if (existing) {
      return response(409, { error: "Admin user already exists" });
    }

    await createAdmin(env, email, password);
    return response(201, { success: true });
  }

  if (path === "admin/invoices" && request.method === "GET") {
    const auth = await requireAdmin(request, env);
    if (!auth) {
      return response(401, { error: "Unauthorized" });
    }
    const invoices = await getInvoices(env);
    return response(200, { invoices });
  }

  if (path === "admin/invoices" && request.method === "POST") {
    const auth = await requireAdmin(request, env);
    if (!auth) {
      return response(401, { error: "Unauthorized" });
    }
    const body = await request.json();
    const invoice = await createInvoiceRecord(env, body);
    return response(201, { invoice, link: `${new URL(request.url).origin}/invoice-view.html?token=${encodeURIComponent(invoice.token)}` });
  }

  if (path === "admin/invoices/mark-paid" && request.method === "POST") {
    const auth = await requireAdmin(request, env);
    if (!auth) {
      return response(401, { error: "Unauthorized" });
    }
    const body = await request.json();
    const invoiceId = body.invoiceId;
    if (!invoiceId) {
      return response(400, { error: "invoiceId is required" });
    }
    await markInvoicePaid(env, invoiceId);
    return response(200, { success: true });
  }

  if (path === "invoice" && request.method === "GET") {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return response(400, { error: "token is required" });
    }
    const invoice = await getInvoiceByToken(env, token);
    if (!invoice) {
      return response(404, { error: "Invoice not found" });
    }
    return response(200, { invoice });
  }

  return response(404, { error: "Not found" });
}
