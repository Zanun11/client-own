import { getRoot } from "./persistence.js";
import { store } from "./store.js";

const fabEl = document.getElementById("chatFabBtn");
const panelEl = document.getElementById("chatPanelEl");
const msgsEl = document.getElementById("chatMsgsEl");
const formEl = document.getElementById("chatFormEl");
const inputEl = document.getElementById("chatInputEl");
const sendBtn = document.getElementById("chatSendBtn");
const closeBtn = document.getElementById("chatCloseBtn");
const humanBtn = document.getElementById("chatHumanBtn");
const chipsEl = document.getElementById("chatChipsEl");

const SHOP_PHONE = "(CLIENT OWN)";
const SHOP_EMAIL = "(CLIENT OWN)";

const messages = [];
let greeted = false;
let busy = false;

function bubble(who, html) {
  const div = document.createElement("div");
  div.className = `chat-msg chat-${who}`;
  div.innerHTML = html;
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return div;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function forwardCard() {
  return `<div class="chat-forward">I have passed this to our team — a representative will pick it up.<br>`
    + `<span class="muted small">Call us: (CLIENT OWN) · Email: (CLIENT OWN)</span></div>`;
}

function greet() {
  if (greeted) return;
  greeted = true;
  bubble("ada", `Hello, welcome to <b>(CLIENT OWN) Paints</b>. I am <b>Ada</b>, your paint assistant. Ask me about paints, colours, prices or delivery — anything I cannot handle, I will forward straight to our representative.`);
}

function setChatOpen(open) {
  panelEl.hidden = !open;
  fabEl.classList.toggle("open", open);
  fabEl.setAttribute("aria-expanded", String(open));
  fabEl.setAttribute("aria-label", open ? "Close chat" : "Chat with us");
  if (open) {
    greet();
    setTimeout(() => inputEl.focus(), 50);
  }
}

fabEl.addEventListener("click", () => {
  setChatOpen(panelEl.hidden);
});
closeBtn.addEventListener("click", () => {
  setChatOpen(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panelEl.hidden) setChatOpen(false);
});
humanBtn.addEventListener("click", () => {
  greet();
  const lastQ = [...messages].reverse().find((m) => m.startsWith("Customer:"));
  bubble("ada", forwardCard(lastQ ? lastQ.slice(10) : "Hello, I need help with paint."));
});
chipsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-chat-q]");
  if (!btn || busy) return;
  inputEl.value = btn.dataset.chatQ;
  formEl.requestSubmit();
});

function catalogueBlock() {
  try {
    const products = store.products || [];
    if (!products.length) return "Catalogue: loading.";
    const lines = products.map((p) => `- ${p.title} (${p.paint_type}, sizes ${p.size_options.join("/")}) from ${store.money(p.base_price)}`);
    const colours = (store.colors || []).map((c) => c.name).join(", ");
    return `Catalogue (live prices):\n${lines.join("\n")}\nColours: ${colours}.`;
  } catch {
    return "Catalogue: 10 paint systems across Interior, Exterior and Masonry; 18 colours; tins 1L/2.5L/5L/10L.";
  }
}

function buildPrompt(task) {
  return `You are Ada, a friendly customer-service assistant working at (CLIENT OWN) Paints, a paint shop in (CLIENT OWN). You speak like experienced paint-shop staff: warm, practical, you ask about room size and surface before recommending, and you quote from the catalogue below. Keep replies short (under 90 words) and plain text, no markdown.
Shop facts: (CLIENT OWN). Open Mon-Sat 8am-5pm. Phone ${SHOP_PHONE}. Email ${SHOP_EMAIL}. Free nationwide delivery over $75 (2-3 working days); flat $6.95 below that. Water-based low-VOC paints, mixed to order. Sample pots posted same day. Colour matching from a photo, chip or cushion. Trade pricing from 10 litres.
${catalogueBlock()}
If the customer asks something you cannot answer (complaints, bulk/trade quotes, order problems, anything outside paint advice), do NOT guess: apologise briefly and end your reply with the exact token [[HUMAN]] so the question is forwarded to a company representative.
<MESSAGES>
${messages.join("\n\n")}
</MESSAGES>
TASK: ${task}`;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = inputEl.value.trim();
  if (!question || busy) return;
  greet();
  busy = true;
  sendBtn.disabled = true;
  inputEl.value = "";
  bubble("user", esc(question));
  messages.push(`Customer: ${question}`);
  const typing = bubble("ada", `<span class="chat-typing"><span></span><span></span><span></span></span>`);
  const root = getRoot();
  try {
    if (!root || !root.generateText) throw new Error("AI unavailable — talk to us directly below.");
    const result = await root.generateText({
      instruction: buildPrompt("Write the next response as 'Ada'."),
      startWith: "Ada:",
      stopSequences: ["\nCustomer:"],
      onChunk: (d) => {
        typing.textContent = d.fullTextSoFar.replace(/^Ada:\s*/, "");
        msgsEl.scrollTop = msgsEl.scrollHeight;
      },
    });
    let text = String(result.generatedText ?? result.text ?? "").replace(/^Ada:\s*/, "").trim();
    const needsHuman = text.includes("[[HUMAN]]");
    text = text.replace("[[HUMAN]]", "").trim();
    typing.innerHTML = esc(text) || "…";
    messages.push(`Ada: ${text}`);
    if (needsHuman) {
      bubble("ada", forwardCard(question));
      messages.push("Ada: [forwarded to representative]");
    }
  } catch (err) {
    typing.innerHTML = `${esc(err?.message || "Something went wrong.")}<br>${forwardCard(question)}`;
  } finally {
    busy = false;
    sendBtn.disabled = false;
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
});
