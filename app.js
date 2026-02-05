/* =========================
   Helpers seguros (não quebra)
========================= */
function on(id, event, fn){
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(event, fn);
}
const $ = (id) => document.getElementById(id);

function normalize(s){
  return (s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function round1(n){ return Math.round((n||0)*10)/10; }

function todayKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const da=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, (c)=>(
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]
  ));
}

/* =========================
   Storage
========================= */
const STORAGE_TARGET  = "dailyTargetKcal";
const STORAGE_HISTORY = "mealHistory";
const STORAGE_PROFILE = "userProfileV1";

/* =========================
   Estado + Bases
========================= */
let TACO = [];   // vem do JSON gerado da TACO
let FOODS = [];  // sua lista local foods.json (opcional)

const state = {
  items: [],          // itens do registrar refeição (manual/detectado)
  photoDataUrl: null,
  autoTimer: null
};

/* =========================
   Carregamento de dados
========================= */
async function loadTaco(){
  try{
   const r = await fetch("./taco_min.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    TACO = await r.json();
  }catch(e){
    TACO = [];
  }
}

async function loadFoods(){
  try{
    const r = await fetch("./foods.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    FOODS = await r.json();
  }catch(e){
    FOODS = [];
  }
}

function foodByKey(key){
  return FOODS.find(f => f.key === key);
}

/* =========================
   Busca TACO (para Beliscos)
========================= */
function tacoSearchOne(query){
  const q = normalize(query);
  if (!q || !TACO.length) return null;
  const parts = q.split(" ").filter(Boolean);

  for (const item of TACO){
    const name = normalize(item.label);
    let ok = true;
    for (const p of parts){
      if (!name.includes(p)) { ok=false; break; }
    }
    if (ok) return item;
  }
  return null;
}

function tacoPerGram(item){
  return {
    kcal: (item.kcal_100g||0)/100,
    p: (item.protein_g_100g||0)/100,
    c: (item.carb_g_100g||0)/100,
    g: (item.fat_g_100g||0)/100
  };
}

/* =========================
   Navegação / Sidebar
========================= */
function openSidebar(){
  const sb = $("sidebar");
  const bd = $("backdrop");
  if (!sb || !bd) return;

  if (window.matchMedia("(max-width: 900px)").matches){
    sb.style.display = "block";
    bd.style.display = "block";
    bd.classList.add("isOn");
  }
}

function closeSidebar(){
  const sb = $("sidebar");
  const bd = $("backdrop");
  if (!sb || !bd) return;

  if (window.matchMedia("(max-width: 900px)").matches){
    sb.style.display = "none";
    bd.style.display = "none";
    bd.classList.remove("isOn");
  }
}

function toggleSidebar(){
  const sb = $("sidebar");
  if (!sb) return;
  const isOpen = sb.style.display === "block";
  if (isOpen) closeSidebar();
  else openSidebar();
}

function setActiveScreen(name){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".navItem").forEach(b => b.classList.remove("active"));

  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("active");

  const btn = document.querySelector(`.navItem[data-screen="${name}"]`);
  if (btn) btn.classList.add("active");

  closeSidebar();
}

function setupNav(){
  document.querySelectorAll(".navItem").forEach(btn => {
    btn.addEventListener("click", () => setActiveScreen(btn.dataset.screen));
  });

  on("toggleNav", "click", toggleSidebar);
  on("closeNav", "click", closeSidebar);
  on("backdrop", "click", closeSidebar);

  on("goRegister", "click", () => setActiveScreen("register"));
}

/* =========================
   Meta diária
========================= */
function getDailyTarget(){
  const v = Number(localStorage.getItem(STORAGE_TARGET) || 0);
  return v > 0 ? v : 1800;
}
function setDailyTarget(v){
  localStorage.setItem(STORAGE_TARGET, String(v));
}

/* =========================
   Perfil + sugestão
========================= */
function getProfile(){
  try { return JSON.parse(localStorage.getItem(STORAGE_PROFILE) || "null"); }
  catch { return null; }
}
function setProfile(p){
  localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
}

function activityFactor(code){
  const map = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    athlete: 1.9
  };
  return map[code] || 1.2;
}

function bmrMifflin({sex, weightKg, heightCm, age}){
  const s = (sex === "male") ? 5 : -161;
  return 10*weightKg + 6.25*heightCm - 5*age + s;
}

function goalAdjustmentKcal(goal, horizon){
  const base = {
    weekly:   { lose: -400, maintain: 0, gain: +250 },
    monthly:  { lose: -300, maintain: 0, gain: +200 },
    quarterly:{ lose: -200, maintain: 0, gain: +150 }
  };
  return (base[horizon] && base[horizon][goal]) ?? 0;
}

function suggestTargetFromProfile(p){
  const bmr = bmrMifflin({
    sex: p.sex,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    age: p.age
  });
  const tdee = bmr * activityFactor(p.activity);
  const adj = goalAdjustmentKcal(p.goal, p.horizon);
  const suggested = Math.round(tdee + adj);

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), suggested };
}

function setupProfile(){
  on("pfSave", "click", () => {
    const p = {
      name: $("pfName")?.value?.trim() || "",
      age: Number($("pfAge")?.value || 0),
      sex: $("pfSex")?.value || "female",
      weightKg: Number($("pfWeight")?.value || 0),
      heightCm: Number($("pfHeight")?.value || 0),
      leanKg: Number($("pfLean")?.value || 0),
      bfPct: Number($("pfBf")?.value || 0),
      activity: $("pfActivity")?.value || "sedentary",
      goal: $("pfGoal")?.value || "maintain",
      horizon: $("pfHorizon")?.value || "monthly"
    };

    const box = $("pfSuggestion");
    if (!p.age || !p.weightKg || !p.heightCm){
      if (box){
        box.style.display = "block";
        box.innerHTML = `<strong>Faltou preencher idade, peso e altura.</strong><div class="muted">Sem isso eu não consigo sugerir kcal com segurança.</div>`;
      }
      return;
    }

    setProfile(p);

    const s = suggestTargetFromProfile(p);
    if (box){
      box.style.display = "block";
      box.innerHTML = `
        <div><strong>Sugestão de meta diária:</strong> ${s.suggested} kcal</div>
        <div class="muted">Estimativa: BMR ${s.bmr} • gasto diário (TDEE) ${s.tdee} • ajuste objetivo ${s.suggested - s.tdee} kcal</div>
        <div class="muted">Você pode ajustar a meta em Ajustes quando quiser.</div>
      `;
    }

    setDailyTarget(s.suggested);
    if ($("targetKcal")) $("targetKcal").value = s.suggested;

    renderDashboard();
    setActiveScreen("home");
  });

  // Se já existe perfil, preenche campos
  const p = getProfile();
  if (p){
    if ($("pfName")) $("pfName").value = p.name || "";
    if ($("pfAge")) $("pfAge").value = p.age || "";
    if ($("pfSex")) $("pfSex").value = p.sex || "female";
    if ($("pfWeight")) $("pfWeight").value = p.weightKg || "";
    if ($("pfHeight")) $("pfHeight").value = p.heightCm || "";
    if ($("pfLean")) $("pfLean").value = p.leanKg || "";
    if ($("pfBf")) $("pfBf").value = p.bfPct || "";
    if ($("pfActivity")) $("pfActivity").value = p.activity || "sedentary";
    if ($("pfGoal")) $("pfGoal").value = p.goal || "maintain";
    if ($("pfHorizon")) $("pfHorizon").value = p.horizon || "monthly";
  }
}

/* =========================
   Foto opcional (pode esconder)
========================= */
async function compressImage(file, maxW=1280, quality=0.75){
  const dataUrl = await new Promise((res) => {
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.readAsDataURL(file);
  });

  const img=new Image();
  img.src=dataUrl;
  await new Promise((res)=>img.onload=res);

  const scale=Math.min(1, maxW/img.width);
  const w=Math.round(img.width*scale);
  const h=Math.round(img.height*scale);

  const canvas=document.createElement("canvas");
  canvas.width=w; canvas.height=h;
  canvas.getContext("2d").drawImage(img,0,0,w,h);

  return canvas.toDataURL("image/jpeg", quality);
}

function setupPhotoToggle(){
  on("togglePhoto", "click", () => {
    const wrap = $("photoWrap");
    const btn = $("togglePhoto");
    if (!wrap || !btn) return;

    const open = wrap.style.display === "block";
    wrap.style.display = open ? "none" : "block";
    btn.textContent = open ? "Adicionar foto (opcional)" : "Esconder foto";
  });
}

function setupPhoto(){
  setupPhotoToggle();

  const input = $("photo");
  const preview = $("preview");
  if (!input || !preview) return;

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    state.photoDataUrl = await compressImage(file, 1280, 0.75);
    preview.src = state.photoDataUrl;
    preview.style.display="block";

    scheduleAutoCalc();
  });

  on("clearPhoto", "click", () => {
    state.photoDataUrl=null;
    preview.src="";
    preview.style.display="none";
    input.value="";
  });
}

/* =========================
   Itens do Registrar (descrição -> perguntar gramas)
   (aqui usa sua lista FOODS/keywords, não a TACO)
========================= */
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

const DEFAULT_GRAMS = {
  arroz: 100,
  arroz_integral: 100,
  feijao: 100,
  feijao_preto: 100,
  frango: 120,
  carne_bovina: 120,
  peixe: 140,
  ovo: 50,
  salada: 150,
  batata_frita: 100,
  azeite: 5,
  pao_frances: 50,
  tapioca: 80,
  banana: 118,
  maca: 182,
  iogurte: 170,
  cafe_sem_acucar: 50,
  acucar: 4,
  chocolate: 20
};

function detectKeysFromText(text){
  const t=(text||"").toLowerCase();
  const found=[];
  for (const k of KEYWORDS){
    if (k.hits.some(h=>t.includes(h))) found.push(k.key);
  }
  return [...new Set(found)];
}

function promptGramsFor(key){
  const f = foodByKey(key);
  const def = DEFAULT_GRAMS[key] || 100;

  const v = prompt(`Quantos gramas de "${f?.label || key}"?`, String(def));
  if (v === null) return null;

  const n = Number(String(v).replace(",", "."));
  if (!isFinite(n) || n < 0) return null;

  return n;
}

function addItem(foodKey, grams){
  state.items.push({ foodKey, grams: Number(grams || 0) });
  renderItems();
}

function computeMealTotals(items){
  let kcal=0, p=0, c=0, g=0;

  for (const it of items){
    const f = foodByKey(it.foodKey);
    if (!f) continue;

    // Aqui assume que FOODS tem kcal/p/c/g por "gramas" OU por unidade.
    // Se sua FOODS já está por grama, ótimo.
    const grams = Number(it.grams || 0);

    if (f.unit === "gramas"){
      kcal += (Number(f.kcal)||0) * grams;
      p    += (Number(f.p)||0)   * grams;
      c    += (Number(f.c)||0)   * grams;
      g    += (Number(f.g)||0)   * grams;
    } else {
      // fallback simples: se não for por gramas, não calcula bem.
      // Você pode melhorar depois com equivalências.
      kcal += 0;
    }
  }

  return {kcal, p, c, g};
}

function renderTotalsUI(){
  const t = computeMealTotals(state.items);
  if ($("totalKcal")) $("totalKcal").textContent = `${Math.round(t.kcal)} kcal`;
  if ($("totalMacros")) $("totalMacros").textContent = `P ${round1(t.p)}g • C ${round1(t.c)}g • G ${round1(t.g)}g`;
}

function renderItems(){
  const wrap=$("items");
  if (!wrap) return;

  wrap.innerHTML="";

  if (!state.items.length){
    wrap.innerHTML = `<p class="muted">Digite a descrição e eu vou montar os itens. Você também pode adicionar manualmente.</p>`;
    renderTotalsUI();
    return;
  }

  state.items.forEach((it, idx) => {
    const row=document.createElement("div");
    row.className="itemRow";
    row.innerHTML=`
      <select aria-label="Alimento">
        ${FOODS.map(x=>`<option value="${x.key}" ${x.key===it.foodKey?"selected":""}>${x.label}</option>`).join("")}
      </select>
      <input aria-label="Gramas" type="number" min="0" step="1" value="${it.grams}" />
      <select aria-label="Unidade"><option selected>g</option></select>
      <button class="del" type="button" title="Remover">✕</button>
    `;

    const [foodSel, gramsInp, unitSel, delBtn] = row.children;

    foodSel.addEventListener("change", (e)=>{
      it.foodKey = e.target.value;
      renderItems();
    });

    gramsInp.addEventListener("input",(e)=>{
      it.grams = Number(e.target.value || 0);
      renderTotalsUI();
    });

    unitSel.addEventListener("change", ()=>renderTotalsUI());

    delBtn.addEventListener("click",()=>{
      state.items.splice(idx,1);
      renderItems();
    });

    wrap.appendChild(row);
  });

  renderTotalsUI();
}

function recalcMealFromDescription(){
  const desc = $("desc")?.value?.trim() || "";
  if (!desc) return;

  const keys = detectKeysFromText(desc).filter(k => foodByKey(k));

  const existingMap = new Map(state.items.map(it => [it.foodKey, it.grams]));
  const next = [];

  for (const key of keys){
    const grams = existingMap.get(key);
    next.push({ foodKey: key, grams: grams ?? 0 });
  }

  state.items = next;
  renderItems();

  for (const it of state.items){
    if (!it.grams || it.grams === 0){
      const grams = promptGramsFor(it.foodKey);
      if (grams !== null) it.grams = grams;
    }
  }

  renderItems();
}

function scheduleAutoCalc(){
  clearTimeout(state.autoTimer);
  state.autoTimer = setTimeout(() => recalcMealFromDescription(), 450);
}

/* =========================
   Histórico + Dashboard
========================= */
function getHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY) || "[]"); }
  catch { return []; }
}
function setHistory(arr){
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr));
}

function saveMealToHistory({desc, photo, items, kcalOverride=null}){
  const totals = (kcalOverride !== null)
    ? {kcal: kcalOverride, p:0,c:0,g:0}
    : computeMealTotals(items);

  const entry = {
    ts: new Date().toISOString(),
    day: todayKey(),
    desc,
    photo,
    items,
    kcal: totals.kcal
  };

  const history = getHistory();
  history.unshift(entry);
  setHistory(history.slice(0, 80));
}

function sumConsumedForDay(dayStr){
  const history=getHistory();
  let total=0;
  for (const h of history){
    const d = h.day || (h.ts ? todayKey(new Date(h.ts)) : "");
    if (d === dayStr) total += Number(h.kcal || 0);
  }
  return total;
}

function renderDashboard(){
  if (!$("dashConsumed")) return;

  const target = getDailyTarget();
  const day = todayKey();
  const consumed = sumConsumedForDay(day);

  const remainingRaw = target - consumed;
  const pct = target>0 ? Math.min(100, Math.round((consumed/target)*100)) : 0;

  $("dashConsumed").textContent = Math.round(consumed);
  if ($("dashTarget")) $("dashTarget").textContent = Math.round(target);
  if ($("dashFill")) $("dashFill").style.width = `${pct}%`;
  if ($("dashPct")) $("dashPct").textContent = pct;

  const remainingEl = $("dashRemaining");
  if (remainingEl){
    remainingEl.textContent = (remainingRaw >= 0)
      ? Math.round(remainingRaw)
      : `${Math.abs(Math.round(remainingRaw))} acima`;
  }

  if ($("todayLabel")){
    const d=new Date();
    const label=d.toLocaleDateString("pt-BR",{weekday:"long", day:"2-digit", month:"short"});
    $("todayLabel").textContent = label.charAt(0).toUpperCase()+label.slice(1);
  }
}

function renderHistory(){
  const wrap=$("history");
  if (!wrap) return;

  const history=getHistory();
  wrap.innerHTML="";

  if (!history.length){
    wrap.innerHTML = `<p class="muted">Nada salvo ainda.</p>`;
    return;
  }

  for (const h of history){
    const dt=new Date(h.ts);
    const kcal = Math.round(Number(h.kcal || 0));

    const div=document.createElement("div");
    div.className="histCard";
    div.innerHTML = `
      <div><strong>${kcal} kcal</strong> <span class="muted">(${dt.toLocaleString()})</span></div>
      <div class="muted">${escapeHtml(h.desc || "")}</div>
      ${h.photo ? `<img alt="foto" src="${h.photo}" class="histImg">` : ""}
    `;
    wrap.appendChild(div);
  }
}

/* =========================
   Settings (meta diária)
========================= */
function setupSettings(){
  const input = $("targetKcal");
  if (input) input.value = getDailyTarget();

  on("saveTarget", "click", () => {
    const v = Number(input?.value || 0);
    if (v > 0) setDailyTarget(v);
    renderDashboard();
    setActiveScreen("home");
  });
}

/* =========================
   Salvar refeição
========================= */
function saveMeal(){
  const desc = $("desc")?.value?.trim() || "Refeição";
  saveMealToHistory({
    desc,
    photo: state.photoDataUrl,
    items: state.items
  });

  if ($("desc")) $("desc").value="";
  state.items=[];
  renderItems();

  renderHistory();
  renderDashboard();
  setActiveScreen("home");
}

/* =========================
   Botões / Eventos
========================= */
function setupButtons(){
  on("save", "click", saveMeal);

  on("reset", "click", () => {
    if ($("desc")) $("desc").value="";
    state.items=[];
    renderItems();
  });

  on("suggest", "click", () => {
    recalcMealFromDescription();
  });

  on("addItem", "click", () => {
    const key = FOODS[0]?.key;
    if (!key) return;
    const grams = promptGramsFor(key);
    if (grams === null) return;
    addItem(key, grams);
  });

  on("desc", "input", () => {
    scheduleAutoCalc();
  });

  // Beliscos usando TACO
  on("snackAdd", "click", () => {
    const text = $("snackDesc")?.value?.trim() || "";
    if (!text) return;

    const item = tacoSearchOne(text);
    if (!item){
      alert("Não encontrei na TACO. Tente algo mais simples (ex.: 'biscoito', 'chocolate', 'pão').");
      return;
    }

    const gramsStr = prompt(`Quantos gramas de "${item.label}"?`, "30");
    if (gramsStr === null) return;

    const grams = Number(String(gramsStr).replace(",", "."));
    if (!isFinite(grams) || grams < 0) return;

    const perG = tacoPerGram(item);
    const kcal = perG.kcal * grams;

    saveMealToHistory({
      desc: `Belisco: ${text} (${grams}g)`,
      kcalOverride: kcal,
      photo: null,
      items: []
    });

    if ($("snackDesc")) $("snackDesc").value = "";
    renderHistory();
    renderDashboard();
  });

  on("clearHistory", "click", () => {
    setHistory([]);
    renderHistory();
    renderDashboard();
  });
}

/* =========================
   Init
========================= */
async function init(){
  await loadTaco();
  await loadFoods();

  setupNav();
  setupProfile();
  setupPhoto();
  setupSettings();
  setupButtons();

  renderItems();
  renderHistory();
  renderDashboard();

  const p = getProfile();
  if (!p){
    setActiveScreen("profile");
  } else {
    setActiveScreen("home");
  }
}

init();
