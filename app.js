let FOODS=[];
const $=id=>document.getElementById(id);
const state={items:[],photoDataUrl:null};

async function loadFoods(){
  FOODS=await (await fetch("./foods.json")).json();
}
function foodByKey(k){return FOODS.find(f=>f.key===k);}
function addItem(key=FOODS[0].key,qty=1){
  const f=foodByKey(key);
  state.items.push({foodKey:f.key,qty,unit:f.unit});
  renderItems();
}
function renderItems(){
  const wrap=$("items"); wrap.innerHTML="";
  state.items.forEach((it,idx)=>{
    const row=document.createElement("div");
    row.className="itemRow";
    row.innerHTML=`
      <select>${FOODS.map(f=>`<option value="${f.key}" ${f.key===it.foodKey?"selected":""}>${f.label}</option>`).join("")}</select>
      <input type="number" value="${it.qty}" step="0.5"/>
      <select><option>${it.unit}</option></select>
      <button class="del">✕</button>`;
    const [s,q,_,d]=row.children;
    s.onchange=e=>{it.foodKey=e.target.value; renderItems();};
    q.oninput=e=>{it.qty=Number(e.target.value||0); computeTotals();};
    d.onclick=()=>{state.items.splice(idx,1); renderItems();};
    wrap.appendChild(row);
  });
  computeTotals();
}
function computeTotals(){
  let kcal=0,p=0,c=0,g=0;
  state.items.forEach(it=>{
    const f=foodByKey(it.foodKey);
    kcal+=f.kcal*it.qty;
    p+=f.p*it.qty; c+=f.c*it.qty; g+=f.g*it.qty;
  });
  $("totalKcal").textContent=Math.round(kcal)+" kcal";
  $("totalMacros").textContent=`P ${p.toFixed(1)}g • C ${c.toFixed(1)}g • G ${g.toFixed(1)}g`;
}
function suggestFromText(t){
  t=t.toLowerCase();
  ["arroz","feijao","frango","ovo","banana"].forEach(k=>{
    if(t.includes(k) && !state.items.some(i=>i.foodKey===k)) addItem(k,1);
  });
}
function setupPhoto(){
  const input=$("photo"),preview=$("preview");
  input.onchange=()=>{
    const file=input.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=()=>{state.photoDataUrl=r.result; preview.src=r.result; preview.style.display="block";};
    r.readAsDataURL(file);
  };
  $("clearPhoto").onclick=()=>{preview.style.display="none"; input.value=""; state.photoDataUrl=null;};
}
function saveMeal(){
  const hist=JSON.parse(localStorage.getItem("mealHistory")||"[]");
  hist.unshift({ts:new Date().toISOString(),desc:$("desc").value,items:state.items,photo:state.photoDataUrl});
  localStorage.setItem("mealHistory",JSON.stringify(hist.slice(0,20)));
  renderHistory();
}
function renderHistory(){
  const hist=JSON.parse(localStorage.getItem("mealHistory")||"[]");
  const wrap=$("history"); wrap.innerHTML="";
  hist.forEach(h=>{
    let kcal=0; h.items.forEach(it=>{const f=foodByKey(it.foodKey); kcal+=f.kcal*it.qty;});
    const div=document.createElement("div");
    div.className="histCard";
    div.innerHTML=`<strong>${Math.round(kcal)} kcal</strong><div class="muted">${h.desc}</div>`;
    wrap.appendChild(div);
  });
}
async function init(){
  await loadFoods();
  setupPhoto();
  addItem();
  renderHistory();
  $("suggest").onclick=()=>suggestFromText($("desc").value);
  $("addItem").onclick=()=>addItem();
  $("save").onclick=saveMeal;
  $("reset").onclick=()=>{$("desc").value=""; state.items=[]; addItem();};
}
init();
