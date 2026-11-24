const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const navButtons = $$("[data-view]");
const views = $$("[data-view-panel]");
const messagesEl = $("#messages");
const input = $("#chatInput");
const form = $("#chatForm");
const authModal = $("#authModal");
const authForm = $("#authForm");
const api = { firebaseReady: false, auth: null, user: null, conversationId: null, messages: [], conversations: [], mode: "signin", tool: null, voiceMode: false };
let firebaseAuthSdk;
let toastTimer;

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove("visible"), 3400);
}

function setView(name) {
  const selected = views.find((view) => view.dataset.viewPanel === name) || $("#homeView");
  views.forEach((view) => view.classList.toggle("active", view === selected));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === selected.dataset.viewPanel));
  $("#crumbTitle").textContent = selected.dataset.viewPanel;
  $("#sidebar").classList.remove("open");
  if (name === "History") loadHistory();
}

function openAuth(mode = "signin") {
  api.mode = mode;
  $("#authTitle").textContent = mode === "signup" ? "Let’s get started." : "Welcome back.";
  $("#authSubtitle").textContent = mode === "signup"
    ? "Create an account to keep your conversations private and in sync."
    : "Sign in to keep your conversations private and in sync.";
  $("#nameField").hidden = mode !== "signup";
  $("#authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("#authSubmit").innerHTML = `${mode === "signup" ? "Create account" : "Sign in"} <span>→</span>`;
  $("#authSwitch").textContent = mode === "signup" ? "Already have an account? Sign in" : "Create an account";
  $("#resetPassword").hidden = mode === "signup";
  $("#authError").textContent = "";
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => $("#authEmail").focus(), 100);
}

function closeAuth() {
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden", "true");
}

function currentToken() {
  if (!api.user) throw new Error("Please sign in to use your private AI chat.");
  return api.user.getIdToken();
}

async function request(path, options = {}) {
  const token = await currentToken();
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "That request didn’t go through. Please try again.");
  return result;
}

function updateProfileUI(user) {
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";
  const initials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "JA";
  $("#profileName").textContent = displayName;
  $("#profileEmail").textContent = user?.email || "Sign in to sync your chats";
  $("#avatarInitials").textContent = initials;
  $("#settingsName").textContent = displayName;
  $("#settingsEmail").textContent = user?.email || "Not signed in";
  $("#settingsAvatar").textContent = initials;
  $("#signInButton").innerHTML = user ? "Sign out <span>↗</span>" : "Sign in <span>↗</span>";
  $("#accountAction").textContent = user ? "Sign out" : "Sign in";
  $("#deleteAccountData").disabled = !user;
}

function addMessage(role, text, { actions = true } = {}) {
  $("#welcomeMessage")?.remove();
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.innerHTML = role === "user" ? "<span>YOU</span>" : "<span>✦</span> JOSEANGELITON AI";
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = text;
  message.append(label, body);
  if (role === "assistant" && actions) {
    const toolbar = document.createElement("div");
    toolbar.className = "message-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard.");
      } catch {
        toast("Clipboard access isn’t available in this browser.");
      }
    });
    const speak = document.createElement("button");
    speak.type = "button";
    speak.textContent = "Read aloud";
    speak.addEventListener("click", () => {
      if (!("speechSynthesis" in window)) return toast("Text-to-speech isn’t supported by this browser.");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    });
    const regenerate = document.createElement("button");
    regenerate.type = "button";
    regenerate.textContent = "Regenerate";
    regenerate.addEventListener("click", regenerateReply);
    toolbar.append(copy, speak, regenerate);
    message.append(toolbar);
  }
  messagesEl.append(message);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return message;
}

function showWelcome() {
  messagesEl.innerHTML = `<div class="welcome-message" id="welcomeMessage"><span class="welcome-star">✳</span><h2>Hey there. What are we<br />making happen today?</h2><p>Ask me anything — or pick a little nudge to get started.</p><div class="suggestion-row"><button data-prompt="Explain a topic I find confusing in simple terms.">Explain something</button><button data-prompt="Help me brainstorm a few creative ideas.">Brainstorm ideas</button><button data-prompt="Help me make a simple plan for today.">Plan my day</button></div></div>`;
}

function showMessages(messages = []) {
  messagesEl.innerHTML = "";
  if (!messages.length) return showWelcome();
  messages.forEach(({ role, content }) => addMessage(role === "user" ? "user" : "assistant", content, { actions: role !== "user" }));
}

function setBusy(busy) {
  $("#sendButton").disabled = busy;
  input.disabled = busy;
  if (busy) {
    const indicator = document.createElement("article");
    indicator.className = "message assistant";
    indicator.id = "typingIndicator";
    indicator.innerHTML = `<div class="message-label"><span>✦</span> JOSEANGELITON AI</div><div class="message-body typing" aria-label="Thinking"><i></i><i></i><i></i></div>`;
    messagesEl.append(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else $("#typingIndicator")?.remove();
}

async function sendMessage(text, { regenerate = false } = {}) {
  const message = text.trim();
  if (!message || $("#sendButton").disabled) return;
  if (!api.user) {
    openAuth();
    toast("Sign in to start a private, saved conversation.");
    return;
  }
  const previousReply = regenerate && api.messages.at(-1)?.role === "assistant" ? api.messages.at(-1).content : null;
  if (!regenerate) {
    api.messages.push({ role: "user", content: message });
    addMessage("user", message, { actions: false });
  }
  input.value = "";
  input.style.height = "auto";
  setBusy(true);
  try {
    const result = await request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ conversationId: api.conversationId, message, regenerate, tool: api.tool }),
    });
    api.conversationId = result.conversationId;
    api.messages = result.messages;
    $("#typingIndicator")?.remove();
    addMessage("assistant", result.reply);
    if (api.voiceMode && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(result.reply);
      utterance.onend = () => { if (api.voiceMode) startVoiceCapture(); };
      window.speechSynthesis.speak(utterance);
    }
  } catch (error) {
    $("#typingIndicator")?.remove();
    if (!regenerate) {
      api.messages.pop();
      $$(".message.user", messagesEl).at(-1)?.remove();
    } else if (previousReply) {
      addMessage("assistant", previousReply);
    }
    if (!api.messages.length) showWelcome();
    toast(error.message);
  } finally {
    setBusy(false);
    input.focus();
  }
}

function regenerateReply() {
  const lastUser = [...api.messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return toast("There isn’t a message to regenerate yet.");
  const assistantMessage = $$(".message.assistant", messagesEl).at(-1);
  assistantMessage?.remove();
  sendMessage(lastUser.content, { regenerate: true });
}

async function loadHistory() {
  const list = $("#historyList");
  if (!api.user) {
    list.innerHTML = `<div class="empty-state"><strong>Your history starts here.</strong>Sign in to save and revisit your conversations.</div>`;
    return;
  }
  list.innerHTML = `<div class="empty-state">Loading your conversations…</div>`;
  try {
    const result = await request("/api/conversations");
    api.conversations = result.conversations;
    renderHistory();
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><strong>Couldn’t load your history.</strong>${escapeHtml(error.message)}</div>`;
  }
}

function escapeHtml(text) {
  const element = document.createElement("span");
  element.textContent = text;
  return element.innerHTML;
}

function renderHistory() {
  const list = $("#historyList");
  if (!api.conversations.length) {
    list.innerHTML = `<div class="empty-state"><strong>No conversations yet.</strong>Start a chat and your saved conversations will show up here.</div>`;
    return;
  }
  list.replaceChildren(...api.conversations.map((conversation) => {
    const row = document.createElement("div");
    row.className = "history-entry";
    const icon = document.createElement("span");
    icon.className = "assistant-avatar";
    icon.textContent = "✦";
    const open = document.createElement("button");
    open.type = "button";
    const title = document.createElement("strong");
    title.textContent = conversation.title;
    const preview = document.createElement("small");
    preview.textContent = conversation.preview || "Open conversation";
    open.append(title, preview);
    open.addEventListener("click", () => openConversation(conversation.id));
    const date = document.createElement("time");
    date.textContent = conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleDateString() : "";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${conversation.title}`);
    remove.addEventListener("click", () => deleteConversation(conversation.id));
    row.append(icon, open, date, remove);
    return row;
  }));
}

async function openConversation(id) {
  try {
    const result = await request(`/api/conversations/${encodeURIComponent(id)}`);
    api.conversationId = result.conversation.id;
    api.messages = result.conversation.messages;
    api.tool = result.conversation.tool;
    showMessages(api.messages);
    setView("Chat");
  } catch (error) {
    toast(error.message);
  }
}

async function deleteConversation(id) {
  try {
    await request(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
    api.conversations = api.conversations.filter((conversation) => conversation.id !== id);
    renderHistory();
    if (api.conversationId === id) newChat();
    toast("Conversation deleted.");
  } catch (error) {
    toast(error.message);
  }
}

function newChat() {
  api.conversationId = null;
  api.messages = [];
  api.tool = null;
  input.dataset.tool = "";
  input.placeholder = "Message JOSEANGELITON AI...";
  input.value = "";
  input.style.height = "auto";
  showWelcome();
  setView("Chat");
  input.focus();
}

async function configureFirebase() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("App configuration isn’t available yet.");
    const { firebase } = await response.json();
    if (!firebase || !firebase.apiKey || !firebase.projectId || !firebase.authDomain) throw new Error("Firebase isn’t configured.");
    const [firebaseAppSdk, authSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
    ]);
    firebaseAuthSdk = authSdk;
    const app = firebaseAppSdk.initializeApp(firebase);
    api.auth = firebaseAuthSdk.getAuth(app);
    api.firebaseReady = true;
    firebaseAuthSdk.onAuthStateChanged(api.auth, (user) => {
      api.user = user;
      updateProfileUI(user);
      if (!user) {
        api.conversationId = null;
        api.messages = [];
        api.conversations = [];
        showMessages([]);
      }
      if ($("#historyView").classList.contains("active")) loadHistory();
    });
  } catch (error) {
    updateProfileUI(null);
    console.error("Firebase initialization failed:", error.message);
    $("#authSubtitle").textContent = error.message === "Firebase isn’t configured."
      ? "Add Firebase configuration on the server to enable secure accounts."
      : "Couldn’t load account services. Check the server and Firebase setup, then try again.";
  }
}

navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$$("[data-tool]").forEach((button) => button.addEventListener("click", () => {
  const tool = button.dataset.tool;
  newChat();
  toast(`You’re in ${tool}. What would you like help with?`);
  api.tool = tool;
  input.dataset.tool = tool;
  input.placeholder = `Ask JOSEANGELITON ${tool}...`;
}));
$$("[data-start-chat]").forEach((button) => button.addEventListener("click", newChat));
$$("[data-prompt]").forEach((button) => button.addEventListener("click", () => {
  input.value = button.dataset.prompt;
  input.focus();
}));
$("#newChat").addEventListener("click", newChat);
$("#clearChat").addEventListener("click", newChat);
$("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#signInButton").addEventListener("click", async () => {
  if (api.user) await signOutUser();
  else openAuth();
});
$("#profileButton").addEventListener("click", () => api.user ? setView("Profile") : openAuth());
$("#accountAction").addEventListener("click", async () => {
  if (api.user) await signOutUser();
  else openAuth();
});
async function signOutUser() {
  try {
    await firebaseAuthSdk.signOut(api.auth);
  } catch {
    toast("We couldn’t sign you out. Please try again.");
  }
}
$("#closeAuth").addEventListener("click", closeAuth);
authModal.addEventListener("click", (event) => { if (event.target === authModal) closeAuth(); });
$("#authSwitch").addEventListener("click", () => openAuth(api.mode === "signup" ? "signin" : "signup"));
$("#resetPassword").addEventListener("click", async () => {
  const email = $("#authEmail").value.trim();
  if (!email) return ($("#authError").textContent = "Enter your email address first.");
  try {
    await firebaseAuthSdk.sendPasswordResetEmail(api.auth, email);
    $("#authError").textContent = "";
    toast("If an account exists for that email, a reset link is on its way.");
  } catch (error) {
    $("#authError").textContent = friendlyAuthError(error);
  }
});

function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-email": "That email address doesn’t look right.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "There’s already an account with this email.",
    "auth/weak-password": "Choose a password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network issue. Check your connection and try again.",
  };
  return messages[error.code] || "We couldn’t complete that. Please try again.";
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!api.firebaseReady) {
    $("#authError").textContent = "Firebase isn’t configured yet. See the setup instructions in README.";
    return;
  }
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const submit = $("#authSubmit");
  submit.disabled = true;
  $("#authError").textContent = "";
  try {
    if (api.mode === "signup") {
      const credential = await firebaseAuthSdk.createUserWithEmailAndPassword(api.auth, email, password);
      const name = $("#authName").value.trim();
      if (name) await firebaseAuthSdk.updateProfile(credential.user, { displayName: name });
      api.user = credential.user;
      updateProfileUI(credential.user);
    } else {
      const credential = await firebaseAuthSdk.signInWithEmailAndPassword(api.auth, email, password);
      api.user = credential.user;
      updateProfileUI(credential.user);
    }
    closeAuth();
    toast(api.mode === "signup" ? "Account created. Welcome aboard!" : "You’re signed in. Your buddy’s ready.");
  } catch (error) {
    $("#authError").textContent = friendlyAuthError(error);
  } finally {
    submit.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(input.value);
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
});
document.addEventListener("click", (event) => {
  const prompt = event.target.closest("[data-prompt]");
  if (prompt && prompt.closest(".messages")) {
    input.value = prompt.dataset.prompt;
    input.focus();
  }
  if (window.innerWidth <= 820 && $("#sidebar").classList.contains("open") && !event.target.closest("#sidebar") && !event.target.closest("#menuButton")) {
    $("#sidebar").classList.remove("open");
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    newChat();
  }
  if (event.key === "Escape") {
    closeAuth();
    $("#sidebar").classList.remove("open");
  }
});

function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem("joseangeliton-theme", document.body.classList.contains("light-theme") ? "light" : "dark");
}
$("#themeButton").addEventListener("click", toggleTheme);
$("#profileTheme").addEventListener("click", toggleTheme);
if (localStorage.getItem("joseangeliton-theme") === "light") document.body.classList.add("light-theme");
$("#planInfo").addEventListener("click", () => toast("Subscriptions and payment processing aren’t enabled yet."));
$("#deleteAccountData").addEventListener("click", async () => {
  if (!api.user) return openAuth();
  if (!window.confirm("Delete all your saved conversations? This cannot be undone.")) return;
  try {
    const result = await request("/api/conversations", { method: "DELETE" });
    api.conversations = [];
    if (api.conversationId) newChat();
    toast(`${result.deleted} conversation${result.deleted === 1 ? "" : "s"} deleted.`);
  } catch (error) {
    toast(error.message);
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function startVoiceCapture() {
  if (!SpeechRecognition) return toast("Voice input isn’t supported in this browser. You can still type a message.");
  const recognition = new SpeechRecognition();
  api.recognition = recognition;
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  const button = $("#voiceButton");
  recognition.onstart = () => button.classList.add("listening");
  recognition.onerror = (event) => toast(event.error === "not-allowed" ? "Allow microphone access in your browser to use voice input." : "Voice input stopped. Please try again.");
  recognition.onresult = (event) => {
    input.value = `${input.value}${input.value ? " " : ""}${event.results[0][0].transcript}`;
    input.dispatchEvent(new Event("input"));
    input.focus();
    if (api.voiceMode) form.requestSubmit();
  };
  recognition.onend = () => button.classList.remove("listening");
  try { recognition.start(); } catch { toast("Voice input is already listening."); }
}
$("#voiceButton").addEventListener("click", startVoiceCapture);
$("#voiceModeButton").addEventListener("click", (event) => {
  if (!SpeechRecognition || !("speechSynthesis" in window)) {
    toast("Voice conversation isn’t supported in this browser.");
    return;
  }
  api.voiceMode = !api.voiceMode;
  event.currentTarget.classList.toggle("active", api.voiceMode);
  event.currentTarget.setAttribute("aria-pressed", String(api.voiceMode));
  if (api.voiceMode) startVoiceCapture();
  else {
    api.recognition?.stop();
    window.speechSynthesis.cancel();
  }
});

showWelcome();
updateProfileUI(null);
configureFirebase();
