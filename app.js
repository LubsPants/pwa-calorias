let FOODS = [];
const $ = (id) => document.getElementById(id);

const STORAGE_TARGET = "dailyTargetKcal";
const STORAGE_HISTORY = "mealHistory";

const state = {
  items: [],
  photoDataUrl: null
};

function round1(n){ return Math.round(n*10)/10; }
function todayKey(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

async function loadFoods(){
  FOODS = await (await fetch("./foods.json")).json();
}

function foodByKey(key){ return FOODS.find(f => f.key === key); }

function prettyUnit(u){
  const map = {
    colher_sopa:"colher (sopa)",
    colher_cha:"colher (chá)",
    concha:"concha",
    gramas:"gramas",
    unidade:"unidade",
    tigela:"tigela",
    pote:"pote",
    xicara:"xícara"
  };
  return map[u] || u;
}

/* ---------------- Tabs (Bottom Nav) ---------------- */
function setActiveScreen(name){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("active");
  const btn = document.querySelector(`.navBtn[data-screen="${name}"]`);
  if (btn) btn.classList.add("active");
}

function setupNav(){
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => setActiveScreen(btn.dataset.screen));
  });
  $("goRegister").addEventListener("click", () => setActiveScreen("register"));
}

/* ---------------- Meta diária ---------------- */
function getDailyTarget(){
  const v = Number(localStorage.getItem(STORAGE_TARGET) || 0);
  return v > 0 ? v : 1800; // default amigável
}
function setDailyTarget(v){
  localStorage.setItem(STORAGE_TARGET, String(v));
}

/* ---------------- Itens & cálculo da refeição ---------------- */
function addItem(foodKey, qty, unitOverride=null){
  const food = foodByKey(foodKey) || FOODS[0];
  state.items.push({ foodKey: food.key, qty, unit: unitOverride || food.unit });
  renderItems();
}

function computeMealTotals(items){
  let kcal=0, p=0, c=0, g=0;
  for (const it of items){
    const f = foodByKey(it.foodKey);
    if (!f) continue;
    const factor = Number(it.qty || 0);
    kcal += f.kcal * factor;
    p += f.p * factor;
    c += f.c * factor;
    g += f.g * factor;
  }
  return {kcal, p, c, g};
}

function computeTotalsUI(){
  const t = computeMealTotals(state.items);
  $("totalKcal").textContent = `${Math.round(t.kcal)} kcal`;
  $("totalMacros").textContent = `P ${round1(t.p)}g • C ${round1(t.c)}g • G ${round1(t.g)}g`;
}

function renderItems(){
  const wrap = $("items");
  wrap.innerHTML = "";

  if (state.items.length === 0){
    wrap.innerHTML = `<p class="muted">Nenhum item ainda. Use “Sugerir itens” ou adicione manualmente.</p>`;
    computeTotalsUI();
    return;
  }

  state.items.forEach((it, idx) => {
    const food = foodByKey(it.foodKey);

    const row = document.createElement("div");
    row.className = "itemRow";
    row.innerHTML = `
      <select aria-label="Alimento">
        ${FOODS.map(f => `<option value="${f.key}" ${f.key===it.foodKey?"selected":""}>${f.label}</option>`).join("")}
      </select>
      <input aria-label="Quantidade" type="number" min="0" step="0.5" value="${it.qty}" />
      <select aria-label="Unidade">
        <option value="${food.unit}" selected>${prettyUnit(food.unit)}</option>
      </select>
      <button class="del" title="Remover" type="button">✕</button>
    `;

    const [foodSel, qtyInp, unitSel, delBtn] = row.children;

    foodSel.addEventListener("change", (e) => {
      it.foodKey = e.target.value;
      const nf = foodByKey(it.foodKey);
      it.unit = nf.unit;
      renderItems();
    });

    qtyInp.addEventListener("input", (e) => {
      it.qty = Number(e.target.value || 0);
      computeTotalsUI();
    });

    unitSel.addEventListener("change", () => computeTotalsUI());

    delBtn.addEventListener("click", () => {
      state.items.splice(idx,1);
      renderItems();
    });

    wrap.appendChild(row);
  });

  computeTotalsUI();
}

/* ---------------- Sugestão por texto + porções rápidas ---------------- */
const KEYWORDS = [
  { key:"arroz", hits:["arroz"] },
  { key:"arroz_integral", hits:["arroz integral"] },
  { key:"feijao", hits:["feijão","feijao"] },
  { key:"feijao_preto", hits:["feijão preto","feijao preto"] },
  { key:"frango", hits:["frango","peito de frango"] },
  { key:"carne_bovina", hits:["carne","bife"] },
  { key:"peixe", hits:["peixe","tilápia","tilapia"] },
  { key:"ovo", hits:["ovo"] },
  { key:"salada", hits:["salada","alface","tomate","legumes"] },
  { key:"batata_frita", hits:["batata frita","fritas"] },
  { key:"azeite", hits:["azeite","óleo","oleo"] },
  { key:"pao_frances", hits:["pão","pao","pão francês","pao frances"] },
  { key:"tapioca", hits:["tapioca"] },
  { key:"banana", hits:["banana"] },
  { key:"maca", hits:["maçã","maca"] },
  { key:"iogurte", hits:["iogurte"] },
  { key:"cafe_sem_acucar", hits:["café","cafe"] },
  { key:"acucar", hits:["açúcar","acucar"] },
  { key:"chocolate", hits:["chocolate"] }
];

const DEFAULTS = {
  arroz:{qty:4}, arroz_integral:{qty:4},
  feijao:{qty:1}, feijao_preto:{qty:1},
  frango:{qty:120}, carne_bovina:{qty:120}, peixe:{qty:140},
  ovo:{qty:1}, salada:{qty:1},
  batata_frita:{qty:100}, azeite:{qty:1},
  pao_frances:{qty:1}, tapioca:{qty:80},
  banana:{qty:1}, maca:{qty:1},
  iogurte:{qty:1}, cafe_sem_acucar:{qty:1}, acucar:{qty:1},
  chocolate:{qty:20}
};

function quickOptionsFor(foodKey){
  const f = foodByKey(foodKey);
  if (!f) return [];
  if (f.unit === "colher_sopa") return [2,4,6,8];
  if (f.unit === "concha") return [0.5,1,1.5,2];
  if (f.unit === "gramas") return [80,120,160,200];
  if (f.unit === "unidade") return [1,2,3];
  if (f.unit === "colher_cha") return [0.5,1,2];
  return [1,2];
}

function renderQuickPortions(keysAdded){
  const box = $("portionBox");
  if (!box) return;

  if (!keysAdded || keysAdded.length===0){
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <h2>Ajuste rápido de porções</h2>
    <div class="portionGrid"></div>
    <p class="muted">Clique para ajustar. Você também pode editar manualmente nos itens.</p>
  `;

  const grid = box.querySelector(".portionGrid");

  keysAdded.forEach((key) => {
    const it = state.items.find(x => x.foodKey === key);
    if (!it) return;
    const f = foodByKey(key);
    const opts = quickOptionsFor(key);

    const card = document.createElement("div");
    card.className = "portionCard";
    card.innerHTML = `
      <div class="portionTitle">${f.label}</div>
      <div class="portionBtns">
        ${opts.map(v => `<button type="button" class="chip" data-key="${key}" data-v="${v}">${v} ${prettyUnit(f.unit)}</button>`).join("")}
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("button.chip").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = e.target.getAttribute("data-key");
      const v = Number(e.target.getAttribute("data-v"));
      const it = state.items.find(x => x.foodKey === key);
      if (!it) return;
      it.qty = v;
      renderItems();
    });
  });
}

function suggestFromText(text){
  const t = (text || "").toLowerCase();
  const found = [];

  for (const k of KEYWORDS){
    if (k.hits.some(h => t.includes(h))) found.push(k.key);
  }

  const added = [];
  for (const key of found){
    if (!state.items.some(it => it.foodKey === key)){
      const def = DEFAULTS[key] || {qty:1};
      addItem(key, def.qty);
      added.push(key);
    }
  }

  if (state.items.length === 0 && FOODS.length) addItem(FOODS[0].key, 1);
  renderQuickPortions(added);
}

/* ---------------- Foto opcional com compressão ---------------- */
async function compressImage(file, maxW=1280, quality=0.75){
  const dataUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise((res) => (img.onload = res));

  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

function setupPhoto(){
  const input = $("photo");
  const preview = $("preview");

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file, 1280, 0.75);
    state.photoDataUrl = compressed;

    preview.src = state.photoDataUrl;
    preview.style.display = "block";
  });

  $("clearPhoto").addEventListener("click", () => {
    state.photoDataUrl = null;
    preview.src = "";
    preview.style.display = "none";
    input.value = "";
  });
}

/* ---------------- Histórico + Dashboard ---------------- */
function getHistory(){
  return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]");
}
function setHistory(arr){
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr));
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function saveMeal(){
  const mealTotals = computeMealTotals(state.items);

  const entry = {
    ts: new Date().toISOString(),
    day: todayKey(),
    desc: $("desc").value.trim(),
    photo: state.photoDataUrl,
    items: state.items,
    quickKcal: 0,
    kcal: mealTotals.kcal
  };

  const history = getHistory();
  history.unshift(entry);
  setHistory(history.slice(0, 60));

  // reset “registrar”
  $("desc").value = "";
  state.items = [];
  renderItems();
  renderQuickPortions([]);

  renderHistory();
  renderDashboard();
  setActiveScreen("home");
}

function quickAddKcal(kcal){
  const entry = {
    ts: new Date().toISOString(),
    day: todayKey(),
    desc: "Adição rápida",
    photo: null,
    items: [],
    quickKcal: kcal,
    kcal: kcal
  };
  const history = getHistory();
  history.unshift(entry);
  setHistory(history.slice(0, 60));
  renderHistory();
  renderDashboard();
}

function renderHistory(){
  const history = getHistory();
  const wrap = $("history");
  wrap.innerHTML = "";

  if (!history.length){
    wrap.innerHTML = `<p class="muted">Nada salvo ainda.</p>`;
    return;
  }

  for (const h of history){
    const dt = new Date(h.ts);
    const kcal = Math.round(Number(h.kcal || 0));
    const div = document.createElement("div");
    div.className = "histCard";
    div.innerHTML = `
      <div><strong>${kcal} kcal</strong> <span class="muted">(${dt.toLocaleString()})</span></div>
      <div class="muted">${escapeHtml(h.desc || "")}</div>
      ${h.photo ? `<img alt="foto" src="${h.photo}" class="histImg">` : ""}
    `;
    wrap.appendChild(div);
  }
}

function sumConsumedForDay(dayStr){
  const history = getHistory();
  let total = 0;
  for (const h of history){
    if ((h.day || (h.ts ? todayKey(new Date(h.ts)) : "")) === dayStr){
      total += Number(h.kcal || 0);
    }
  }
  return total;
}

function renderDashboard(){
  const target = getDailyTarget();
  const day = todayKey();
  const consumed = sumConsumedForDay(day);

  const remainingRaw = target - consumed;
  const remaining = Math.max(0, Math.round(remainingRaw));
  const pct = target > 0 ? Math.min(100, Math.round((consumed/target)*100)) : 0;

  $("dashConsumed").textContent = Math.round(consumed);
  $("dashTarget").textContent = Math.round(target);
  $("dashRemaining").textContent = remaining;
  $("dashPct").textContent = pct;
  $("dashFill").style.width = `${pct}%`;

  const d = new Date();
  const label = d.toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"short" });
  $("todayLabel").textContent = label.charAt(0).toUpperCase() + label.slice(1);

  // Se passou da meta, mostre “extra”
  if (remainingRaw < 0){
    $("dashRemaining").textContent = `${Math.abs(Math.round(remainingRaw))} acima`;
  }
}

/* ---------------- Settings UI ---------------- */
function setupSettings(){
  const input = $("targetKcal");
  const btn = $("saveTarget");

  input.value = getDailyTarget();

  btn.addEventListener("click", () => {
    const v = Number(input.value || 0);
    if (v > 0) setDailyTarget(v);
    renderDashboard();
    setActiveScreen("home");
  });
}

/* ---------------- Home quick add ---------------- */
function setupQuickAdd(){
  $("quickAddBtn").addEventListener("click", () => {
    document.getElementById("quickAddKcal").focus();
  });

  $("quickAddSave").addEventListener("click", () => {
    const v = Number($("quickAddKcal").value || 0);
    if (v > 0){
      quickAddKcal(v);
      $("quickAddKcal").value = "";
    }
  });
}

/* ---------------- Misc buttons ---------------- */
function setupButtons(){
  $("suggest").addEventListener("click", () => suggestFromText($("desc").value));
  $("addItem").addEventListener("click", () => addItem(FOODS[0].key, 1));
  $("save").addEventListener("click", saveMeal);

  $("reset").addEventListener("click", () => {
    $("desc").value = "";
    state.items = [];
    renderItems();
    renderQuickPortions([]);
  });

  $("clearHistory").addEventListener("click", () => {
    setHistory([]);
    renderHistory();
    renderDashboard();
  });
}

async function init(){
  await loadFoods();

  setupNav();
  setupPhoto();
  setupSettings();
  setupQuickAdd();
  setupButtons();

  // tela inicial
  setActiveScreen("home");

  // inicia com 1 item na tela registrar
  if (FOODS.length) addItem(FOODS[0].key, 1);

  renderHistory();
  renderDashboard();
}

init();
