const $ = (id) => document.getElementById(id);
const storyInput = $("story"), result = $("result"), resultCard = $("resultCard"), animeInput = $("anime"), fanficNameInput = $("fanficName"), notesInput = $("notes");
const storiesDiv = $("stories"), saveStatus = $("saveStatus"), toast = $("toast"), generateBtn = $("generateBtn"), generateImageBtn = $("generateImageBtn"), imageCard = $("imageCard");

let currentStoryId = null, chapters = [{ title: "Capítulo 1", content: "" }], ci = 0;
let generatedText = "", lastSel = null, saveTimer = null, toastTimer = null, activeRequests = 0, history = [];

const writingTasks = {
  continue: "Continue a história a partir do ponto em que parou. Respeite os fatos, o tom, os personagens e a continuidade já estabelecidos.",
  scene: "Escreva uma cena completa que se encaixe na fanfic, com ambientação, ações e progressão emocional. Preserve a continuidade e evite resolver conflitos importantes depressa demais.",
  dialogue: "Escreva um diálogo natural entre personagens da fanfic, diferenciando a voz de cada um e incluindo ações ou subtexto quando ajudarem a cena.",
  character: "Crie um personagem original que combine com esta fanfic. Inclua nome, aparência, personalidade, objetivo, conflito interno, habilidade e relação com o elenco existente.",
  idea: "Sugira três caminhos diferentes para o enredo continuar. Para cada opção, descreva o conflito, uma reviravolta possível e como ela pode afetar os personagens.",
  outline: "Crie um plano de capítulos (de 8 a 12), com título e 2 a 3 linhas por capítulo: conflito, avanço da trama e gancho final.",
  synopsis: "Escreva uma sinopse envolvente em 2 a 3 parágrafos, sem entregar o final.",
  title: "Sugira 10 títulos criativos para esta fanfic, cada um com uma linha explicando a ideia.",
  world: "Descreva a ambientação e o mundo da história: lugares importantes, regras do universo, facções, clima e detalhes que enriqueçam as cenas.",
  twist: "Proponha cinco reviravoltas surpreendentes, mas coerentes com o que já foi estabelecido, e explique o efeito de cada uma.",
  revise: "Revise o texto fornecido para melhorar clareza, ritmo, gramática e fluidez sem mudar os acontecimentos, a intenção ou a voz da história. Retorne apenas a versão revisada.",
  expand: "Expanda o texto fornecido com mais detalhes sensoriais, emoções e ação, mantendo os fatos e a voz. Retorne apenas a versão expandida.",
  shorten: "Resuma o texto fornecido em uma versão mais curta e fluida, mantendo os pontos-chave. Retorne apenas a versão resumida.",
  tone: "Reescreva o texto fornecido no tom indicado na direção criativa, sem mudar os acontecimentos. Retorne apenas a nova versão.",
  mangascript: "Escreva um roteiro de mangá para a cena: divida em 6 a 8 quadros numerados, com enquadramento, descrição visual, falas curtas em balões e efeitos sonoros."
};
const EDIT_TOOLS = ["revise", "expand", "shorten", "tone"];
const CHIPS = ["Mistério", "Romance", "Ação", "Comédia", "Drama", "Terror", "Slice of life", "Rivalidade", "Amizade", "Reviravolta", "Final emocionante", "Tom sombrio", "Tom leve"];
const ART = {
  anime: "anime moderno de estúdio, linhas limpas, olhos expressivos",
  classic: "anime clássico dos anos 90, aparência de cel animation, paleta vibrante",
  shonen: "mangá shounen dinâmico, traços fortes, ação intensa e linhas de velocidade",
  shoujo: "mangá shoujo delicado, brilhos, flores e olhos grandes",
  watercolor: "aquarela suave com contornos de tinta e textura de papel",
  chibi: "estilo chibi fofo com proporções super deformed",
  cinematic: "anime cinematográfico, iluminação dramática, profundidade de campo",
  cyber: "anime cyberpunk, neon, cidade futurista",
  dark: "anime sombrio e atmosférico, contraste alto"
};
const MODE_HINT = {
  illustration: "Uma ilustração única de um momento marcante da história.",
  cover: "Capa vertical da fanfic, sem texto, pronta para ser usada como imagem de abertura.",
  manga: "Uma página vertical com 4 a 6 quadros em sequência, contando uma cena.",
  strip: "Uma tira horizontal com 3 a 4 quadros, boa para uma piada ou um momento curto."
};

/* ---------- utilidades ---------- */
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `fanfic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3600);
}
function beginRequest() { activeRequests += 1; document.body.classList.add("ai-busy"); }
function endRequest() { activeRequests = Math.max(0, activeRequests - 1); if (!activeRequests) document.body.classList.remove("ai-busy"); }
function createLoadingIndicator(message) {
  const indicator = document.createElement("span");
  indicator.className = "loading-indicator";
  indicator.setAttribute("role", "status");
  const spinner = document.createElement("span");
  spinner.className = "loading-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = message;
  indicator.append(spinner, text);
  return indicator;
}
function setButtonBusy(button, message) {
  button.dataset.label = button.innerHTML;
  button.disabled = true;
  button.replaceChildren(createLoadingIndicator(message));
}
function restoreButton(button) { button.disabled = false; button.innerHTML = button.dataset.label || button.innerHTML; }
function saveBlob(name, data, type) {
  const url = URL.createObjectURL(new Blob(data, { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function getSafeFileName() {
  return (fanficNameInput.value.trim() || "minha-fanfic").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "minha-fanfic";
}
const titleOf = () => fanficNameInput.value.trim() || "Fanfic sem título";
const animeOf = () => animeInput.value.trim() || "Universo original";

/* ---------- imagens (IndexedDB) ---------- */
const IDB = {
  db: null,
  open() {
    return this.db || (this.db = new Promise((ok, no) => {
      const r = indexedDB.open("fanfic-studio", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("imgs", { keyPath: "id" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    }));
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((ok, no) => {
      const t = db.transaction("imgs", mode), req = fn(t.objectStore("imgs"));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => no(t.error);
    });
  },
  put(o) { return this.run("readwrite", (s) => s.put(o)); },
  del(id) { return this.run("readwrite", (s) => s.delete(id)); },
  all() { return this.run("readonly", (s) => s.getAll()).then((x) => x || []); }
};
function compress(url, max = 1400) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.86));
    };
    im.onerror = () => ok(url);
    im.src = url;
  });
}
async function storyImages() {
  if (!currentStoryId) return [];
  try { return (await IDB.all()).filter((i) => i.storyId === currentStoryId).sort((a, b) => b.createdAt - a.createdAt); }
  catch (error) { console.error("Galeria indisponível:", error); return []; }
}

/* ---------- texto da fanfic ---------- */
function syncChapter() { chapters[ci].content = storyInput.value; }
function fullText() {
  syncChapter();
  return chapters.map((c) => (chapters.length > 1 ? `${c.title}\n\n` : "") + c.content.trim()).join("\n\n\n").trim();
}
function getFanficText() { return `${titleOf()}\nAnime/Universo: ${animeOf()}\n\n${fullText() || "(Fanfic sem texto.)"}\n`; }
function downloadFanficText() {
  if (!fullText()) return notify("Escreva ou gere um trecho antes de baixar a fanfic.");
  saveBlob(`${getSafeFileName()}.txt`, ["\ufeff", getFanficText()], "text/plain;charset=utf-8");
  notify("Arquivo .txt baixado.");
}
async function copyFanficText() {
  if (!fullText()) return notify("Escreva ou gere um trecho antes de copiar a fanfic.");
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("A cópia não está disponível neste navegador ou origem.");
    await navigator.clipboard.writeText(getFanficText());
    notify("Fanfic copiada para a área de transferência.");
  } catch (error) { notify(error.message || "Não foi possível copiar."); }
}
function docBody(images) {
  let html = chapters.map((c) => `${chapters.length > 1 ? `<h2>${esc(c.title)}</h2>` : ""}${c.content.split(/\n+/).filter((p) => p.trim()).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("");
  images.forEach((i) => { html += `<div class="print-img"><img src="${i.url}" alt=""></div>`; });
  return html;
}
async function downloadHtml() {
  syncChapter();
  if (!fullText()) return notify("Escreva ou gere um trecho antes de baixar.");
  const imgs = await storyImages();
  const css = "body{max-width:760px;margin:30px auto;padding:0 18px;font:17px/1.75 Georgia,serif;color:#222}h1{margin-bottom:4px}.meta{color:#666;margin-bottom:24px}p{text-indent:1.2em;margin:0 0 8px}.print-img{margin:28px 0;text-align:center}.print-img img{max-width:100%}";
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titleOf())}</title><style>${css}</style></head><body><h1>${esc(titleOf())}</h1><div class="meta">${esc(animeOf())}</div>${docBody(imgs)}</body></html>`;
  saveBlob(`${getSafeFileName()}.html`, [html], "text/html;charset=utf-8");
  notify("Arquivo .html baixado, com as imagens.");
}
async function printDoc(images, withText = true) {
  syncChapter();
  if (withText && !fullText() && !images.length) return notify("Não há nada para imprimir ainda.");
  const area = $("printArea");
  area.innerHTML = (withText ? `<h1>${esc(titleOf())}</h1><div class="meta">${esc(animeOf())}</div>${docBody([])}` : "") + images.map((i) => `<div class="print-img"><img src="${i.url}" alt=""></div>`).join("");
  await Promise.all([...area.querySelectorAll("img")].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  window.print();
}
window.addEventListener("afterprint", () => { $("printArea").replaceChildren(); });

/* ---------- biblioteca ---------- */
function getStories() {
  try {
    const stored = JSON.parse(localStorage.getItem("stories") || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((e) => e && typeof e === "object").map((e) => {
      const entry = { ...e, id: e.id || createId() };
      if (!Array.isArray(entry.chapters) || !entry.chapters.length) entry.chapters = [{ title: "Capítulo 1", content: String(entry.content || "") }];
      return entry;
    });
  } catch (error) {
    console.error("Não foi possível ler as fanfics salvas:", error);
    notify("Não foi possível acessar as fanfics salvas neste navegador.");
    return [];
  }
}
function persistStories(stories) {
  try { localStorage.setItem("stories", JSON.stringify(stories)); return true; }
  catch (error) { console.error(error); notify("Não foi possível salvar. Verifique o espaço disponível no navegador."); return false; }
}
function setUnsaved() { saveStatus.textContent = "Alterações não salvas"; saveStatus.classList.remove("saved"); }
function saveCurrentStory(showMessage = true) {
  window.clearTimeout(saveTimer);
  syncChapter();
  const stories = getStories();
  const idx = stories.findIndex((s) => s.id === currentStoryId);
  const data = {
    id: currentStoryId || createId(), title: titleOf(), anime: animeOf(), notes: notesInput.value,
    chapters: chapters.map((c) => ({ ...c })), content: fullText(), updatedAt: new Date().toISOString()
  };
  if (idx >= 0) stories[idx] = data; else stories.unshift(data);
  if (!persistStories(stories)) return false;
  currentStoryId = data.id;
  fanficNameInput.value = data.title;
  saveStatus.textContent = "Salvo neste dispositivo";
  saveStatus.classList.add("saved");
  try { localStorage.removeItem("fanfic-draft"); } catch (e) { /* ignorar */ }
  renderStories();
  if (showMessage) notify("Fanfic salva com sucesso.");
  return true;
}
function renderStories() {
  const q = $("search").value.trim().toLowerCase();
  const all = getStories().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const stories = q ? all.filter((s) => `${s.title} ${s.anime} ${s.content}`.toLowerCase().includes(q)) : all;
  storiesDiv.replaceChildren();
  $("storyCount").textContent = String(all.length);
  if (!stories.length) {
    const empty = document.createElement("p");
    empty.className = "empty-library";
    empty.textContent = all.length ? "Nenhuma fanfic encontrada." : "Sua biblioteca está vazia. Crie uma fanfic e salve para encontrá-la aqui.";
    storiesDiv.appendChild(empty);
    return;
  }
  stories.forEach((s) => {
    const row = document.createElement("div");
    row.className = "story-row";
    const open = document.createElement("button");
    open.className = "story-item"; open.type = "button";
    open.setAttribute("aria-label", `Abrir ${s.title || "fanfic sem título"}`);
    if (s.id === currentStoryId) open.classList.add("active");
    const icon = document.createElement("span");
    icon.className = "story-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = "✦";
    const copy = document.createElement("span");
    copy.className = "story-copy";
    const t = document.createElement("strong"); t.textContent = s.title || "Fanfic sem título";
    const a = document.createElement("small"); a.textContent = `${s.anime || "Universo original"} · ${s.chapters.length} cap.`;
    copy.append(t, a);
    open.append(icon, copy);
    open.addEventListener("click", () => openStory(s.id));
    const dup = document.createElement("button");
    dup.className = "delete-story"; dup.type = "button"; dup.textContent = "⧉"; dup.title = "Duplicar fanfic";
    dup.setAttribute("aria-label", `Duplicar ${s.title}`);
    dup.addEventListener("click", () => duplicateStory(s.id));
    const del = document.createElement("button");
    del.className = "delete-story"; del.type = "button"; del.textContent = "×"; del.title = "Excluir fanfic";
    del.setAttribute("aria-label", `Excluir ${s.title}`);
    del.addEventListener("click", () => deleteStory(s.id));
    row.append(open, dup, del);
    storiesDiv.appendChild(row);
  });
}
function loadStory(s) {
  currentStoryId = s ? s.id : null;
  chapters = s ? s.chapters.map((c) => ({ ...c })) : [{ title: "Capítulo 1", content: "" }];
  ci = 0;
  fanficNameInput.value = s ? s.title || "" : "";
  animeInput.value = s ? s.anime || "" : "";
  notesInput.value = s ? s.notes || "" : "";
  storyInput.value = chapters[0].content;
  history = [];
  clearAssistantOutput();
  renderChapters(); updateCounts(); renderStories(); loadGallery();
}
function openStory(id) {
  window.clearTimeout(saveTimer);
  if (currentStoryId && !saveStatus.classList.contains("saved")) saveCurrentStory(false);
  const s = getStories().find((x) => x.id === id);
  if (!s) return;
  const hasDraft = fullText() || fanficNameInput.value.trim() || animeInput.value.trim();
  if (!currentStoryId && hasDraft && !confirm("Descartar o rascunho atual e abrir outra fanfic?")) return;
  loadStory(s);
  saveStatus.textContent = "Salvo neste dispositivo";
  saveStatus.classList.add("saved");
}
function duplicateStory(id) {
  const stories = getStories(), s = stories.find((x) => x.id === id);
  if (!s) return;
  const copy = { ...s, id: createId(), title: `${s.title} (cópia)`, updatedAt: new Date().toISOString(), chapters: s.chapters.map((c) => ({ ...c })) };
  if (persistStories([copy, ...stories])) { renderStories(); notify("Fanfic duplicada."); }
}
async function deleteStory(id) {
  const stories = getStories(), s = stories.find((x) => x.id === id);
  if (!s || !confirm(`Excluir “${s.title || "Fanfic sem título"}” e suas imagens? Essa ação não pode ser desfeita.`)) return;
  if (!persistStories(stories.filter((x) => x.id !== id))) return;
  try { for (const i of (await IDB.all()).filter((i) => i.storyId === id)) await IDB.del(i.id); } catch (e) { /* ignorar */ }
  if (currentStoryId === id) resetEditor(false);
  renderStories();
  notify("Fanfic excluída.");
}
function clearAssistantOutput() {
  generatedText = ""; lastSel = null;
  result.textContent = "";
  resultCard.hidden = true;
  imageCard.hidden = true;
  $("imagePreview").replaceChildren();
}
function resetEditor(confirmDiscard = true) {
  window.clearTimeout(saveTimer);
  if (currentStoryId && !saveStatus.classList.contains("saved")) saveCurrentStory(false);
  const hasDraft = fullText() || fanficNameInput.value.trim() || animeInput.value.trim();
  if (confirmDiscard && hasDraft && !currentStoryId && !confirm("Descartar o rascunho atual? Salve antes se quiser mantê-lo.")) return false;
  loadStory(null);
  $("creativeDirection").value = ""; $("imageScene").value = "";
  try { localStorage.removeItem("fanfic-draft"); } catch (e) { /* ignorar */ }
  saveStatus.textContent = "Novo rascunho";
  saveStatus.classList.remove("saved");
  storyInput.focus();
  return true;
}

/* ---------- capítulos, contagem e histórico ---------- */
function renderChapters() {
  const tabs = $("chapterTabs");
  tabs.replaceChildren();
  chapters.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chapter-tab" + (i === ci ? " active" : "");
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(i === ci));
    b.textContent = c.title || `Capítulo ${i + 1}`;
    b.addEventListener("click", () => switchChapter(i));
    tabs.appendChild(b);
  });
  $("deleteChapterBtn").disabled = chapters.length < 2;
}
function switchChapter(i) {
  syncChapter(); ci = i; storyInput.value = chapters[ci].content; history = [];
  renderChapters(); updateCounts(); storyInput.focus();
}
function addChapter() {
  syncChapter();
  chapters.push({ title: `Capítulo ${chapters.length + 1}`, content: "" });
  switchChapter(chapters.length - 1); queueAutosave();
}
function renameChapter() {
  const name = prompt("Nome do capítulo:", chapters[ci].title);
  if (name && name.trim()) { chapters[ci].title = name.trim().slice(0, 60); renderChapters(); queueAutosave(); }
}
function deleteChapter() {
  if (chapters.length < 2 || !confirm(`Excluir “${chapters[ci].title}”? Essa ação não pode ser desfeita.`)) return;
  chapters.splice(ci, 1); ci = Math.min(ci, chapters.length - 1);
  storyInput.value = chapters[ci].content; history = [];
  renderChapters(); updateCounts(); queueAutosave();
}
function updateCounts() {
  const words = storyInput.value.trim().split(/\s+/).filter(Boolean).length;
  $("wordCount").textContent = `${words} ${words === 1 ? "palavra" : "palavras"}`;
  $("readTime").textContent = `Leitura: ${words ? Math.max(1, Math.round(words / 200)) : 0} min`;
}
function pushHistory() { history.push(storyInput.value); if (history.length > 30) history.shift(); }
function undo() {
  if (!history.length) return notify("Nada para desfazer neste capítulo.");
  storyInput.value = history.pop(); updateCounts(); queueAutosave(); notify("Alteração desfeita.");
}
function applyText(value, cursor) {
  pushHistory(); storyInput.value = value;
  if (cursor != null) storyInput.setSelectionRange(cursor, cursor);
  storyInput.focus(); updateCounts(); queueAutosave();
}
function queueAutosave() {
  setUnsaved(); syncChapter();
  window.clearTimeout(saveTimer);
  if (currentStoryId) saveTimer = window.setTimeout(() => saveCurrentStory(false), 900);
  else saveTimer = window.setTimeout(() => {
    try { localStorage.setItem("fanfic-draft", JSON.stringify({ title: fanficNameInput.value, anime: animeInput.value, notes: notesInput.value, chapters, ci })); } catch (e) { /* ignorar */ }
  }, 700);
}

/* ---------- IA: texto ---------- */
function getTextFromResponse(response) {
  const content = response && response.message && response.message.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((p) => p && (p.text || "")).filter(Boolean).join("\n").trim();
  return "";
}
async function ensurePuter() {
  if (window.puter && window.puter.ai && typeof window.puter.ai.chat === "function") return true;
  if (window.location.protocol === "file:") {
    notify("Para usar a IA, abra esta página por um servidor local (http://localhost) ou publique-a em um site.");
    return false;
  }
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Não foi possível carregar a biblioteca Puter."));
      document.head.appendChild(script);
    });
    if (window.puter && window.puter.ai && typeof window.puter.ai.chat === "function") return true;
    throw new Error("A biblioteca Puter foi carregada, mas a API de IA não está disponível.");
  } catch (error) {
    console.error("Falha ao carregar o SDK Puter:", error);
    notify(error.message || "A biblioteca Puter não carregou. Verifique sua conexão e tente novamente.");
    return false;
  }
}
function getSel() {
  const s = storyInput.selectionStart, e = storyInput.selectionEnd;
  return e > s ? { s, e } : null;
}
function buildWritingPrompt() {
  const tool = $("writingTool").value, direction = $("creativeDirection").value.trim(), genre = $("genre").value, len = $("length").value;
  const value = storyInput.value, sel = getSel();
  let focus = value.trim().slice(-12000);
  lastSel = null;
  if (EDIT_TOOLS.includes(tool)) {
    if (sel) { focus = value.slice(sel.s, sel.e); lastSel = { s: sel.s, e: sel.e, t: focus }; }
    else if (value.length && value.length <= 12000) { focus = value; lastSel = { s: 0, e: value.length, t: value }; }
  }
  const prev = ci > 0 ? chapters[ci - 1].content.trim().slice(-2500) : "";
  const label = EDIT_TOOLS.includes(tool) ? "Texto a trabalhar:" : "Contexto da história (use como referência e não repita o texto):";
  return `Você é um assistente de escrita criativa para fanfics. Escreva em português brasileiro, com prosa envolvente e respeitando o material fornecido.\n\nAnime ou universo: ${animeInput.value.trim() || "não informado"}\nTítulo: ${fanficNameInput.value.trim() || "não informado"}\nCapítulo atual: ${chapters[ci].title}\nGênero: ${genre || "livre"}\nTamanho desejado (quando fizer sentido): ${len}\nTarefa: ${writingTasks[tool] || writingTasks.continue}\nDireção criativa: ${direction || "use seu melhor julgamento"}\n${notesInput.value.trim() ? `\nPersonagens, mundo e anotações do autor (mantenha a consistência):\n${notesInput.value.trim().slice(0, 4000)}\n` : ""}${prev ? `\nFinal do capítulo anterior:\n${prev}\n` : ""}\n${label}\n${focus || "Ainda não há texto escrito. Crie uma sugestão inicial que possa ser adaptada."}\n\nNão faça perguntas. Entregue somente o resultado solicitado.`;
}
async function generateWriting() {
  if (!await ensurePuter()) return;
  const prompt = buildWritingPrompt();
  beginRequest();
  setButtonBusy(generateBtn, "Gerando texto…");
  resultCard.hidden = false;
  $("resultTitle").textContent = $("writingTool").selectedOptions[0].textContent;
  result.classList.add("loading");
  result.setAttribute("aria-busy", "true");
  result.replaceChildren(createLoadingIndicator("A IA está escrevendo sua sugestão…"));
  generatedText = "";
  $("replaceResultBtn").hidden = true;
  try {
    const response = await window.puter.ai.chat(prompt);
    generatedText = getTextFromResponse(response);
    result.textContent = generatedText || "A IA não retornou texto. Tente novamente com outra direção criativa.";
    $("replaceResultBtn").hidden = !(generatedText && lastSel);
    if (generatedText) resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    console.error("Falha ao gerar texto com Puter:", error);
    result.textContent = `Não foi possível gerar o texto. ${error && error.message ? error.message : "Confira sua conexão ou o acesso ao Puter e tente novamente."}`;
  } finally {
    result.classList.remove("loading");
    result.setAttribute("aria-busy", "false");
    restoreButton(generateBtn);
    endRequest();
  }
}
function insertResult() {
  if (!generatedText) return;
  const v = storyInput.value, start = storyInput.selectionStart, end = storyInput.selectionEnd;
  const before = v.slice(0, start), after = v.slice(end), sep = before && !before.endsWith("\n") ? "\n\n" : "";
  applyText(`${before}${sep}${generatedText}${after ? "\n\n" : ""}${after}`, before.length + sep.length + generatedText.length);
  notify("Sugestão adicionada ao capítulo.");
}
function replaceResult() {
  if (!generatedText || !lastSel) return;
  const v = storyInput.value;
  if (v.slice(lastSel.s, lastSel.e) !== lastSel.t) return notify("O texto mudou desde a geração. Selecione o trecho de novo e gere outra vez.");
  applyText(v.slice(0, lastSel.s) + generatedText + v.slice(lastSel.e), lastSel.s + generatedText.length);
  lastSel = null; $("replaceResultBtn").hidden = true;
  notify("Trecho substituído. Use Desfazer se quiser voltar.");
}

/* ---------- IA: imagem ---------- */
function buildImagePrompt() {
  const mode = $("imageMode").value, bw = $("colorMode").value === "bw", style = ART[$("artStyle").value];
  const sel = getSel(), scene = $("imageScene").value.trim() || (sel ? storyInput.value.slice(sel.s, sel.e) : "");
  const excerpt = (scene || storyInput.value.trim().slice(-7000)).slice(-7000);
  const direction = $("creativeDirection").value.trim();
  const colorTxt = bw
    ? "Use PRETO E BRANCO no estilo clássico de mangá impresso: tinta nanquim, retículas (screentone), contrastes fortes e nenhuma cor."
    : "Use arte TOTALMENTE COLORIDA, com cores vivas e bem definidas e paleta harmoniosa. Não use preto e branco, escala de cinza, sépia nem aparência monocromática.";
  const formats = {
    illustration: "Crie uma ilustração única, não uma página de quadrinhos, mostrando um momento visualmente marcante da fanfic, com cenário detalhado e iluminação expressiva. Não adicione texto, logotipos ou marcas d'água.",
    cover: "Crie uma capa vertical de fanfic, com os personagens principais em composição de destaque e cenário que represente a história. Sem texto, logotipos ou marcas d'água.",
    manga: "Crie UMA PÁGINA VERTICAL DE MANGÁ, como uma página impressa de quadrinhos. Conte uma pequena sequência com 4 a 6 quadros bem separados, com leitura da direita para a esquerda e de cima para baixo, com começo, desenvolvimento e fechamento visual da cena. Mantenha aparência, roupas e cenário consistentes em todos os quadros. Use enquadramentos variados, contornos de tinta e balões com falas muito curtas em português brasileiro, apenas se forem essenciais. Evite letras decorativas fora dos balões, logotipos e marcas d'água.",
    strip: "Crie UMA TIRA HORIZONTAL DE MANGÁ com 3 a 4 quadros em sequência, com começo, meio e um fecho claro. Mantenha personagens e cenário consistentes. Use balões com falas muito curtas em português brasileiro, apenas se forem essenciais. Sem logotipos ou marcas d'água."
  };
  return `Crie uma imagem original para a fanfic “${titleOf()}”, ambientada em ${animeInput.value.trim() || "um universo de fantasia original"}.\n\nCena ou trecho de referência:\n${excerpt || "Ainda sem trecho escrito; crie uma cena conceitual coerente com o universo informado."}\n\n${notesInput.value.trim() ? `Descrição dos personagens e do mundo (mantenha a aparência):\n${notesInput.value.trim().slice(0, 3000)}\n\n` : ""}Estilo artístico: ${style}${direction ? `; ${direction}` : ""}.\n\n${formats[mode]}\n${colorTxt}\nPreserve os fatos e as descrições presentes no texto. Não reproduza exatamente uma página, composição ou imagem existente.`;
}
function showImage(rec) {
  const preview = $("imagePreview"), image = document.createElement("img");
  image.src = rec.url;
  image.alt = `${rec.label || "Imagem"} gerada para a fanfic ${titleOf()}`;
  preview.replaceChildren(image);
  imageCard.hidden = false;
  $("imageTitle").textContent = rec.label || "Imagem da sua fanfic";
  const link = $("downloadImage");
  link.href = rec.url;
  link.download = `${getSafeFileName()}-${rec.kind || "imagem"}.${rec.url.startsWith("data:image/png") ? "png" : "jpg"}`;
}
async function generateFanficImage() {
  if (!await ensurePuter()) return;
  const mode = $("imageMode").value, bw = $("colorMode").value === "bw", manga = mode === "manga" || mode === "strip";
  const prompt = buildImagePrompt();
  const ratio = mode === "illustration" || mode === "strip" ? "3:2" : "2:3";
  beginRequest();
  setButtonBusy(generateImageBtn, manga ? "Desenhando mangá…" : "Criando imagem…");
  imageCard.hidden = false;
  const preview = $("imagePreview");
  preview.setAttribute("aria-busy", "true");
  preview.replaceChildren(createLoadingIndicator(manga ? "A IA está desenhando os quadros do seu mangá…" : "A IA está criando a ilustração… Isso pode levar alguns instantes."));
  try {
    const response = await window.puter.ai.chat(prompt, { model: "gemini-3.1-flash-image-preview", image_config: { aspect_ratio: ratio, image_size: "1K" } });
    const url = response && response.message && response.message.images && response.message.images[0] && response.message.images[0].image_url && response.message.images[0].image_url.url;
    if (!url) throw new Error("O modelo não retornou uma imagem. Tente novamente ou ajuste a direção criativa.");
    const label = `${{ illustration: "Ilustração", cover: "Capa", manga: "Página de mangá", strip: "Tira de mangá" }[mode]}${bw ? " em preto e branco" : " colorida"}`;
    const rec = { id: createId(), storyId: null, kind: mode, label, url, createdAt: Date.now() };
    showImage(rec);
    if (!currentStoryId) saveCurrentStory(false);
    rec.storyId = currentStoryId;
    rec.url = await compress(url);
    try { await IDB.put(rec); await loadGallery(); } catch (error) { console.error(error); notify("A imagem foi criada, mas não coube na galeria. Baixe-a agora."); }
    imageCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    console.error("Falha ao gerar imagem com Puter:", error);
    preview.textContent = `Não foi possível criar a imagem. ${error && error.message ? error.message : "Confira sua conexão ou o acesso ao Puter e tente novamente."}`;
  } finally {
    preview.setAttribute("aria-busy", "false");
    restoreButton(generateImageBtn);
    endRequest();
  }
}
async function loadGallery() {
  const g = $("gallery"), imgs = await storyImages();
  g.replaceChildren();
  $("galleryWrap").hidden = !imgs.length;
  imgs.forEach((rec) => {
    const fig = document.createElement("figure");
    fig.dataset.id = rec.id;
    const im = document.createElement("img");
    im.src = rec.url; im.alt = rec.label || "Imagem"; im.dataset.a = "view"; im.loading = "lazy";
    const cap = document.createElement("figcaption");
    [["view", "Ampliar"], ["dl", "Baixar"], ["print", "Imprimir"], ["del", "Excluir"]].forEach(([a, t]) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.a = a; b.textContent = t; cap.appendChild(b);
    });
    fig.append(im, cap);
    g.appendChild(fig);
  });
}
$("gallery").addEventListener("click", async (e) => {
  const a = e.target.dataset.a, fig = e.target.closest("figure");
  if (!a || !fig) return;
  const rec = (await storyImages()).find((i) => i.id === fig.dataset.id);
  if (!rec) return;
  if (a === "view") { showImage(rec); imageCard.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  else if (a === "dl") { const link = document.createElement("a"); link.href = rec.url; link.download = `${getSafeFileName()}-${rec.kind}.jpg`; document.body.appendChild(link); link.click(); link.remove(); }
  else if (a === "print") printDoc([rec], false);
  else if (a === "del" && confirm("Excluir esta imagem da galeria?")) { await IDB.del(rec.id); loadGallery(); }
});

/* ---------- backup ---------- */
async function exportBackup() {
  let images = [];
  try { images = await IDB.all(); } catch (e) { /* ignorar */ }
  saveBlob("anime-fanfic-studio-backup.json", [JSON.stringify({ versao: 2, stories: getStories(), images })], "application/json");
  notify("Backup baixado.");
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.stories;
    if (!Array.isArray(incoming)) throw new Error("Arquivo de backup inválido.");
    const stories = getStories(), ids = new Set(stories.map((s) => s.id));
    const merged = [...incoming.filter((s) => s && s.id && !ids.has(s.id)), ...stories];
    if (!persistStories(merged)) return;
    for (const i of data.images || []) { if (i && i.id && i.url) await IDB.put(i); }
    renderStories(); loadGallery();
    notify(`Backup importado: ${merged.length - stories.length} fanfic(s) nova(s).`);
  } catch (error) { notify(error.message || "Não foi possível importar o backup."); }
}

/* ---------- ideias rápidas ---------- */
const RND = {
  heroi: ["uma espadachim que perdeu a memória", "um aprendiz de feiticeiro azarado", "um detetive que enxerga espíritos", "uma piloto de mechas aposentada", "um ninja que odeia lutar", "uma idol com um segredo sombrio"],
  conflito: ["precisa recuperar um artefato antes do eclipse", "é perseguido(a) por um antigo mentor", "descobre que o melhor amigo é o vilão", "fica preso(a) em um torneio mortal", "precisa proteger uma cidade que o(a) rejeita", "tem apenas sete dias para quebrar uma maldição"],
  toque: ["com um rival que vira aliado", "com muito humor e confusões", "num clima de mistério e suspense", "com um romance lento e delicado", "com uma reviravolta no último capítulo", "num mundo onde a magia está sumindo"]
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function randomPremise() {
  const text = `${pick(RND.heroi)} que ${pick(RND.conflito)}, ${pick(RND.toque)}.`;
  $("creativeDirection").value = text;
  notify("Premissa sorteada. Escolha “Gerar com IA” para desenvolvê-la.");
}
function buildChips() {
  const box = $("directionChips");
  CHIPS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip-button"; b.textContent = c;
    b.addEventListener("click", () => {
      const input = $("creativeDirection"), parts = input.value.split(",").map((x) => x.trim()).filter(Boolean), i = parts.indexOf(c);
      if (i >= 0) parts.splice(i, 1); else parts.push(c);
      input.value = parts.join(", ");
      b.classList.toggle("on", i < 0);
    });
    box.appendChild(b);
  });
}

/* ---------- eventos ---------- */
$("saveBtn").addEventListener("click", () => saveCurrentStory());
$("downloadTextBtn").addEventListener("click", downloadFanficText);
$("downloadHtmlBtn").addEventListener("click", downloadHtml);
$("copyTextBtn").addEventListener("click", copyFanficText);
$("printTextBtn").addEventListener("click", () => printDoc([], true));
$("printAllBtn").addEventListener("click", async () => printDoc(await storyImages(), true));
$("generateBtn").addEventListener("click", generateWriting);
$("regenBtn").addEventListener("click", generateWriting);
$("generateImageBtn").addEventListener("click", generateFanficImage);
$("newFanficBtn").addEventListener("click", () => resetEditor());
$("insertResultBtn").addEventListener("click", insertResult);
$("replaceResultBtn").addEventListener("click", replaceResult);
$("copyResultBtn").addEventListener("click", async () => { try { await navigator.clipboard.writeText(generatedText); notify("Sugestão copiada."); } catch (e) { notify("Não foi possível copiar."); } });
$("discardBtn").addEventListener("click", () => { generatedText = ""; lastSel = null; resultCard.hidden = true; });
$("randomBtn").addEventListener("click", randomPremise);
$("undoBtn").addEventListener("click", undo);
$("addChapterBtn").addEventListener("click", addChapter);
$("renameChapterBtn").addEventListener("click", renameChapter);
$("deleteChapterBtn").addEventListener("click", deleteChapter);
$("clearBtn").addEventListener("click", () => {
  if (!storyInput.value.trim() || !confirm("Deseja apagar todo o texto do capítulo atual? (Dá para desfazer logo depois.)")) return;
  applyText("", 0); clearAssistantOutput();
});
$("focusBtn").addEventListener("click", (e) => { const on = document.body.classList.toggle("focus-mode"); e.currentTarget.setAttribute("aria-pressed", String(on)); });
let fontSize = Number(localStorage.getItem("fanfic-font")) || 15;
function setFont(n) { fontSize = Math.min(26, Math.max(12, n)); storyInput.style.setProperty("--story-size", `${fontSize}px`); document.documentElement.style.setProperty("--story-size", `${fontSize}px`); try { localStorage.setItem("fanfic-font", String(fontSize)); } catch (e) { /* ignorar */ } }
$("fontUpBtn").addEventListener("click", () => setFont(fontSize + 1));
$("fontDownBtn").addEventListener("click", () => setFont(fontSize - 1));
$("imageMode").addEventListener("change", () => { $("modeHint").textContent = MODE_HINT[$("imageMode").value]; });
$("search").addEventListener("input", renderStories);
$("exportBackupBtn").addEventListener("click", exportBackup);
$("importBackupInput").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importBackup(f); });
storyInput.addEventListener("input", () => { updateCounts(); queueAutosave(); });
[animeInput, fanficNameInput, notesInput].forEach((el) => el.addEventListener("input", queueAutosave));
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrentStory(); } });

$("tutorialBtn").addEventListener("click", () => $("tutorial").showModal());
$("tutorialClose").addEventListener("click", () => $("tutorial").close());

/* ---------- início ---------- */
setFont(fontSize);
buildChips();
$("modeHint").textContent = MODE_HINT.illustration;
renderStories();
try {
  const draft = JSON.parse(localStorage.getItem("fanfic-draft") || "null");
  if (draft && Array.isArray(draft.chapters) && draft.chapters.some((c) => c.content)) {
    chapters = draft.chapters; ci = Math.min(draft.ci || 0, chapters.length - 1);
    fanficNameInput.value = draft.title || ""; animeInput.value = draft.anime || ""; notesInput.value = draft.notes || "";
    storyInput.value = chapters[ci].content;
    saveStatus.textContent = "Rascunho recuperado";
  }
} catch (e) { /* ignorar */ }
renderChapters();
updateCounts();
