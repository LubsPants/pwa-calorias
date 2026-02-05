let FOODS = [];
const $ = (id) => document.getElementById(id);

const state = {
  items: [],
  photoDataUrl: null
};

function round1(n) { return Math.round(n * 10) / 10; }

async function loadFoods() {
  const res = await fetch("./foods.json");
  FOODS = await res.json();
}

function foodByKey(key) {
  return FOODS.find(f => f.key === key);
}

function prettyUnit(u) {
  const map = {
    "colher_sopa": "colher (sopa)",
    "colher_cha": "colher (chá)",
    "concha": "concha",
    "gramas": "gramas",
    "unidade": "unidade",
    "tigela": "tigela",
    "pote": "pote",
    "xicara": "xícara"
  };
  return map[u] || u;
}

function addItem(foodKey, qty, unitOverride = null) {
  const food = foodByKey(foodKey) || FOODS[0];
  state.items.push({ foodKey: food.key, qty, unit: unitOverride || food.unit });
  renderItems();
}

function computeTotals() {
  let kcal = 0, p = 0, c = 0, g = 0;

  for (const it of state.items) {
    const f = foodByKey(it.foodKey);
    if (!f) continue;

    const factor = Number(it.qty || 0);
    kcal += f.kcal * factor;
    p += f.p * factor;
    c += f.c * factor;
    g += f.g * factor;
  }

  $("totalKcal").textContent = `${Math.round(kcal)} kcal`;
  $("totalMacros").textContent = `P ${round1(p)}g • C ${round1(c)}g • G ${round1(g)}g`;
}

function renderItems() {
  const wrap = $("items");
  wrap.innerHTML = "";

  if (state.items.length === 0) {
    wrap.innerHTML = `<p class="muted">Nenhum item ainda. Use “Sugerir itens” ou adicione manualmente.</p>`;
    computeTotals();
    return;
  }

  state.items.forEach((it, idx) => {
    const food = foodByKey(it.foodKey);

    const row = document.createElement("div");
    row.className = "itemRow";
    row.innerHTML = `
      <select aria-label="Alimento">
        ${FOODS.map(f => `<option value="${f.key}" ${f.key === it.foodKey ? "selected" : ""}>${f.label}</option>`).join("")}
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
      const newFood = foodByKey(it.foodKey);
      it.unit = newFood.unit;
      renderItems();
    });

    qtyInp.addEventListener("input", (e) => {
      it.qty = Number(e.target.value || 0);
      computeTotals();
    });

    unitSel.addEventListener("change", () => computeTotals());

    delBtn.addEventListener("click", () => {
      state.items.splice(idx, 1);
      renderItems();
    });

    wrap.appendChild(row);
  });

  computeTotals();
}

/* ------------- Sugestão por texto (com sinônimos) ------------- */
const KEYWORDS = [
  { key: "arroz", hits: ["arroz"] },
  { key: "arroz_integral", hits: ["arroz integral"] },
  { key: "feijao", hits: ["feijão", "feijao"] },
  { key: "feijao_preto", hits: ["feijão preto", "feijao preto"] },
  { key: "frango", hits: ["frango", "peito de frango"] },
  { key: "carne_bovina", hits: ["carne", "bife"] },
  { key: "peixe", hits: ["peixe", "tilápia", "tilapia"] },
  { key: "ovo", hits: ["ovo"] },
  { key: "salada", hits: ["salada", "alface", "tomate", "legumes"] },
  { key: "batata_frita", hits: ["batata frita", "fritas"] },
  { key: "batata_cozida", hits: ["batata cozida", "batata"] },
  { key: "azeite", hits: ["azeite", "óleo", "oleo"] },
  { key: "pao_frances", hits: ["pão", "pao", "pão francês", "pao frances"] },
  { key: "tapioca", hits: ["tapioca"] },
  { key: "banana", hits: ["banana"] },
  { key: "maca", hits: ["maçã", "maca"] },
  { key: "iogurte", hits: ["iogurte"] },
  { key: "cafe_sem_acucar", hits: ["café", "cafe"] },
  { key: "acucar", hits: ["açúcar", "acucar"] },
  { key: "chocolate", hits: ["chocolate"] }
];

// defaults bons para MVP
const DEFAULTS = {
  arroz: { qty: 4 },
  arroz_integral: { qty: 4 },
  feijao: { qty: 1 },
  feijao_preto: { qty: 1 },
  frango: { qty: 120 },
  carne_bovina: { qty: 120 },
  peixe: { qty: 140 },
  ovo: { qty: 1 },
  salada: { qty: 1 },
  batata_frita: { qty: 100 },
  batata_cozida: { qty: 150 },
  azeite: { qty: 1 },
  pao_frances: { qty: 1 },
  tapioca: { qty: 80 },
  banana: { qty: 1 },
  maca: { qty: 1 },
  iogurte: { qty: 1 },
  cafe_sem_acucar: { qty: 1 },
  acucar: { qty: 1 },
  chocolate: { qty: 20 }
};

// “perguntas” rápidas por tipo/unidade
function quickOptionsFor(foodKey) {
  const f = foodByKey(foodKey);
  if (!f) return [];

  if (f.unit === "colher_sopa") return [2, 4, 6, 8];
  if (f.unit === "concha") return [0.5, 1, 1.5, 2];
  if (f.unit === "gramas") return [80, 120, 160, 200];
  if (f.unit === "unidade") return [1, 2, 3];
  if (f.unit === "colher_cha") return [0.5, 1, 2];
  return [1, 2];
}

function renderQuickPortions(keysAdded) {
  const box = $("portionBox");
  if (!box) return;

  if (!keysAdded || keysAdded.length === 0) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <h3>Ajuste rápido de porções</h3>
    <div class="portionGrid"></div>
    <p class="muted">Clique numa opção para ajustar a quantidade.</p>
  `;

  const grid = box.querySelector(".portionGrid");

  keysAdded.forEach((key) => {
    const idx = state.items.findIndex(it => it.foodKey === key);
    if (idx < 0) return;

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

function suggestFromText(text) {
  const t = (text || "").toLowerCase();
  const found = [];

  for (const k of KEYWORDS) {
    if (k.hits.some(h => t.includes(h))) found.push(k.key);
  }

  const added = [];
  for (const key of found) {
    if (!state.items.some(it => it.foodKey === key)) {
      const def = DEFAULTS[key] || { qty: 1 };
      addItem(key, def.qty);
      added.push(key);
    }
  }

  if (state.items.le
