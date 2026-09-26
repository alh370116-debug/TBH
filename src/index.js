```javascript
const COOKIE_NAME = "tbh_admin";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---------- PUBLIC ----------
    if (request.method === "GET" && path === "/") {
      return html(publicPage());
    }

    if (request.method === "POST" && path === "/api/message") {
      return sendMessage(request, env);
    }

    // ---------- ADMIN ----------
    if (request.method === "GET" && path === "/admin") {
      return html(adminPage());
    }

    if (request.method === "POST" && path === "/api/admin/login") {
      return adminLogin(request, env);
    }

    if (request.method === "POST" && path === "/api/admin/logout") {
      return new Response("OK", {
        headers: {
          "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
        }
      });
    }

    if (path.startsWith("/api/admin/")) {
      if (!isLoggedIn(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (request.method === "GET" && path === "/api/admin/messages") {
        return getMessages(env);
      }

      if (request.method === "POST" && path === "/api/admin/toggle") {
        return toggleTBH(env);
      }

      if (request.method === "POST" && path === "/api/admin/reset") {
        return resetMessages(env);
      }

      if (request.method === "GET" && path === "/api/admin/status") {
        return getStatus(env);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};


// ==============================
// PUBLIC MESSAGE
// ==============================

async function sendMessage(request, env) {
  try {
    const body = await request.json();

    const instagram = String(body.instagram || "").trim();
    const message = String(body.message || "").trim();

    if (!instagram || !message) {
      return json({ error: "Please fill in both fields." }, 400);
    }

    if (instagram.length > 50) {
      return json({ error: "Instagram username is too long." }, 400);
    }

    if (message.length > 1000) {
      return json({ error: "Message is too long." }, 400);
    }

    const setting = await env.DB
      .prepare("SELECT value FROM settings WHERE key = 'tbh_enabled'")
      .first();

    if (!setting || setting.value !== "1") {
      return json({ error: "TBH is currently unavailable." }, 403);
    }

    await env.DB
      .prepare(
        "INSERT INTO messages (instagram_username, message) VALUES (?, ?)"
      )
      .bind(instagram, message)
      .run();

    return json({
      success: true,
      message: "Your anonymous message was sent."
    });

  } catch (error) {
    return json({ error: "Something went wrong." }, 500);
  }
}


// ==============================
// ADMIN LOGIN
// ==============================

async function adminLogin(request, env) {
  try {
    const body = await request.json();

    const username = String(body.username || "");
    const password = String(body.password || "");

    if (
      username !== env.ADMIN_USERNAME ||
      password !== env.ADMIN_PASSWORD
    ) {
      return json({ error: "Invalid username or password." }, 401);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie":
          `${COOKIE_NAME}=authenticated; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
      }
    });

  } catch {
    return json({ error: "Login failed." }, 400);
  }
}


// ==============================
// ADMIN MESSAGES
// ==============================

async function getMessages(env) {
  const result = await env.DB
    .prepare(`
      SELECT id, instagram_username, message, created_at
      FROM messages
      ORDER BY id DESC
    `)
    .all();

  return json({
    messages: result.results || []
  });
}


// ==============================
// TBH ON / OFF
// ==============================

async function toggleTBH(env) {
  const current = await env.DB
    .prepare("SELECT value FROM settings WHERE key = 'tbh_enabled'")
    .first();

  const next = current && current.value === "1" ? "0" : "1";

  await env.DB
    .prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('tbh_enabled', ?)"
    )
    .bind(next)
    .run();

  return json({
    enabled: next === "1"
  });
}


// ==============================
// STATUS
// ==============================

async function getStatus(env) {
  const setting = await env.DB
    .prepare("SELECT value FROM settings WHERE key = 'tbh_enabled'")
    .first();

  return json({
    enabled: !!setting && setting.value === "1"
  });
}


// ==============================
// RESET
// ==============================

async function resetMessages(env) {
  await env.DB.prepare("DELETE FROM messages").run();

  return json({
    success: true
  });
}


// ==============================
// AUTH
// ==============================

function isLoggedIn(request, env) {
  const cookie = request.headers.get("Cookie") || "";

  return cookie.includes(`${COOKIE_NAME}=authenticated`);
}


// ==============================
// HELPERS
// ==============================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function html(content) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8"
    }
  });
}


// ==============================
// PUBLIC PAGE
// ==============================

function publicPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>TBH — Send me an anonymous message</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, Arial, sans-serif;
  background:
    radial-gradient(circle at 20% 20%, #38206b 0%, transparent 35%),
    radial-gradient(circle at 80% 80%, #0d5363 0%, transparent 35%),
    #05050b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  width: 100%;
  max-width: 460px;
  padding: 34px;
  border-radius: 28px;
  background: rgba(255,255,255,.075);
  border: 1px solid rgba(255,255,255,.12);
  backdrop-filter: blur(24px);
  box-shadow: 0 25px 80px rgba(0,0,0,.45);
}

.logo {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: -3px;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #b9b9c7;
  margin: 8px 0 30px;
}

label {
  display: block;
  margin: 18px 0 8px;
  font-size: 13px;
  color: #c9c9d5;
}

textarea,
input {
  width: 100%;
  border: 1px solid rgba(255,255,255,.12);
  outline: none;
  border-radius: 16px;
  background: rgba(0,0,0,.28);
  color: white;
  padding: 15px;
  font-size: 15px;
}

textarea {
  min-height: 150px;
  resize: vertical;
}

textarea:focus,
input:focus {
  border-color: #8b5cf6;
}

.note {
  font-size: 12px;
  line-height: 1.5;
  color: #9292a2;
  margin-top: 9px;
}

button {
  width: 100%;
  margin-top: 22px;
  padding: 15px;
  border: 0;
  border-radius: 16px;
  background: linear-gradient(135deg,#8b5cf6,#06b6d4);
  color: white;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  opacity: .5;
}

#status {
  text-align: center;
  margin-top: 15px;
  font-size: 13px;
}
</style>
</head>

<body>

<div class="card">

  <div class="logo">TBH</div>

  <div class="subtitle">
    Send me an anonymous message
  </div>

  <label>Anonymous message</label>

  <textarea
    id="message"
    maxlength="1000"
    placeholder="Write something anonymously..."
  ></textarea>

  <label>Instagram username</label>

  <input
    id="instagram"
    maxlength="50"
    placeholder="@yourusername"
  >

  <div class="note">
    We will show this name to the user if he or she buys Premium.
  </div>

  <button id="send" onclick="sendMessage()">
    SEND ANONYMOUS MESSAGE
  </button>

  <div id="status"></div>

</div>

<script>
async function sendMessage() {

  const message = document.getElementById("message").value.trim();
  const instagram = document.getElementById("instagram").value.trim();
  const status = document.getElementById("status");
  const button = document.getElementById("send");

  if (!message || !instagram) {
    status.textContent = "Please complete both fields.";
    return;
  }

  button.disabled = true;
  status.textContent = "Sending...";

  try {

    const response = await fetch("/api/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        instagram
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed");
    }

    document.getElementById("message").value = "";
    document.getElementById("instagram").value = "";

    status.textContent = "✓ Anonymous message sent.";

  } catch (error) {

    status.textContent = error.message;

  } finally {

    button.disabled = false;

  }
}
</script>

</body>
</html>`;
}


// ==============================
// ADMIN PAGE
// ==============================

function adminPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">

<title>TBH Admin</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, Arial, sans-serif;
  background:
    radial-gradient(circle at 20% 10%, #24134c 0%, transparent 35%),
    #05050a;
  color: white;
  padding: 20px;
}

.container {
  max-width: 850px;
  margin: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 25px;
}

.logo {
  font-size: 38px;
  font-weight: 900;
}

.panel {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 18px;
}

input {
  width: 100%;
  padding: 14px;
  margin-top: 10px;
  border-radius: 13px;
  border: 1px solid #333;
  background: #111;
  color: white;
}

button {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
  margin-top: 12px;
  cursor: pointer;
  font-weight: 700;
  background: linear-gradient(135deg,#8b5cf6,#06b6d4);
  color: white;
}

.danger {
  background: #8b1e35;
}

.message {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 18px;
  padding: 18px;
  margin-top: 14px;
  cursor: pointer;
}

.username {
  color: #8bdcff;
  font-weight: 800;
}

.msg {
  margin-top: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.date {
  margin-top: 10px;
  font-size: 11px;
  color: #777;
}

.hidden {
  display: none;
}

#login {
  max-width: 420px;
  margin: 80px auto;
}
</style>
</head>

<body>

<div id="login" class="panel">

  <div class="logo">TBH</div>
  <p>Admin Control Panel</p>

  <input id="username" placeholder="Username">
  <input id="password" type="password" placeholder="Password">

  <button onclick="login()">LOGIN</button>

  <div id="loginStatus"></div>

</div>


<div id="app" class="container hidden">

  <div class="header">

    <div class="logo">TBH</div>

    <button onclick="logout()">Logout</button>

  </div>

  <div class="panel">

    <h3>TBH Control</h3>

    <p id="status">Loading...</p>

    <button onclick="toggleTBH()">
      Toggle TBH
    </button>

    <button class="danger" onclick="resetMessages()">
      RESET ALL MESSAGES
    </button>

  </div>

  <div class="panel">

    <h3>Anonymous Messages</h3>

    <div id="messages">
      Loading...
    </div>

  </div>

</div>


<script>

async function login() {

  const username =
    document.getElementById("username").value;

  const password =
    document.getElementById("password").value;

  const result = await fetch("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  const data = await result.json();

  if (!result.ok) {
    document.getElementById("loginStatus").textContent =
      data.error || "Login failed";
    return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  loadMessages();
  loadStatus();
}


async function loadMessages() {

  const response =
    await fetch("/api/admin/messages");

  if (response.status === 401) {
    location.reload();
    return;
  }

  const data = await response.json();

  const container =
    document.getElementById("messages");

  if (!data.messages.length) {

    container.innerHTML =
      "<p>No messages yet.</p>";

    return;
  }

  container.innerHTML =
    data.messages.map(m => \`
      <div class="message">

        <div class="username">
          @\${escapeHTML(m.instagram_username)}
        </div>

        <div class="msg">
          \${escapeHTML(m.message)}
        </div>

        <div class="date">
          \${escapeHTML(m.created_at)}
        </div>

      </div>
    \`).join("");
}


async function loadStatus() {

  const response =
    await fetch("/api/admin/status");

  const data = await response.json();

  document.getElementById("status").textContent =
    data.enabled
      ? "🟢 TBH is ACTIVE"
      : "🔴 TBH is OFF";
}


async function toggleTBH() {

  await fetch("/api/admin/toggle", {
    method: "POST"
  });

  loadStatus();
}


async function resetMessages() {

  if (!confirm(
    "Delete ALL anonymous messages permanently?"
  )) return;

  await fetch("/api/admin/reset", {
    method: "POST"
  });

  loadMessages();
}


async function logout() {

  await fetch("/api/admin/logout", {
    method: "POST"
  });

  location.reload();
}


function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

</script>

</body>
</html>`;
}
```
