const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxfo4gmihZl8t3WdJL5zGO0_tHAY4tEU5HOGlhhh3bqScfluGMm-7fhez63Q1YFkfSy/exec";
const API_TOKEN  = ""; // optional (if you add token check in Code.gs)

let employees = [];
let months = [];
let currentMode = "YEAR";     // YEAR or MONTH
let currentMonthKey = "ALL";  // ALL or month sheet name
let currentView = "cards";    // cards / table

const $ = (id) => document.getElementById(id);

function setStatus(msg){ $("status").textContent = msg; }
function safeText(s){ return (s ?? "").toString(); }
function fmt(n){ return Number(n || 0).toLocaleString("en-US"); }

function initials(firstName, lastName){
  const a = (safeText(firstName)[0] || "").toUpperCase();
  const b = (safeText(lastName)[0] || "").toUpperCase();
  return (a + b) || "AA";
}

function apiUrl(params){
  const u = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  if (API_TOKEN) u.searchParams.set("token", API_TOKEN);
  return u.toString();
}

async function apiGet(params){
  const url = apiUrl(params);
  const res = await fetch(url, { cache:"no-store" });
  const data = await res.json().catch(()=>({ ok:false, error:"Invalid JSON" }));
  if(!res.ok || data.ok === false){
    const msg = data && data.error ? data.error : ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

function qs(){
  return {
    q: $("q").value.trim().toLowerCase(),
    gender: $("gender").value,
    sort: $("sort").value,
  };
}

function computeTotals(list){
  const t = { present:0, miss:0, permission:0, mission:0, count:list.length };
  for(const r of list){
    t.present += Number(r.present || 0);
    t.miss += Number(r.miss || 0);
    t.permission += Number(r.permission || 0);
    t.mission += Number(r.mission || 0);
  }
  return t;
}

function currentLabel(){
  if(currentMode === "YEAR") return "Summary (Year)";
  const m = months.find(x => x.key === currentMonthKey);
  return `Month: ${m?.label || currentMonthKey}`;
}

function renderKpis(list){
  const t = computeTotals(list);
  const wrap = $("kpis");
  wrap.innerHTML = "";

  const label = currentLabel();

  const cards = [
    { k:"បុគ្គលិក", v: fmt(t.count), s:"ចំនួន" },
    { k:"Total Scan", v: fmt(t.present), s: label },
    { k:"Total ForgetScan", v: fmt(t.miss), s: label },
    { k:"Total Mission", v: fmt(t.mission), s: label },
  ];

  for(const c of cards){
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s">${c.s}</div>`;
    wrap.appendChild(div);
  }
}

function cardHtml(r){
  return `
    <div class="empCard">
      <div class="empCardTop">
        <div class="avatar">${initials(r.firstName, r.lastName)}</div>
        <div style="min-width:0">
          <div class="empName">${safeText(r.lastName)} ${safeText(r.firstName)}</div>
          <div class="empMeta">${safeText(r.code)} • ${safeText(r.role)} • ${safeText(r.gender)}</div>
        </div>
      </div>

      <div class="empNums">
        <div class="num"><div class="k">Total Scan</div><div class="v">${fmt(r.present)}</div></div>
        <div class="num"><div class="k">ForgetScan</div><div class="v">${fmt(r.miss)}</div></div>
        <div class="num"><div class="k">Permission</div><div class="v">${fmt(r.permission)}</div></div>
        <div class="num"><div class="k">Mission</div><div class="v">${fmt(r.mission)}</div></div>
      </div>

      <div class="empCardActions">
        <div class="tag">${currentLabel()}</div>
        <button class="btn ghost" data-detail="${safeText(r.code)}" type="button">View</button>
      </div>
    </div>
  `;
}

function rowHtml(r){
  return `
    <tr>
      <td><span class="pill">${safeText(r.code)}</span></td>
      <td>${safeText(r.firstName)}</td>
      <td>${safeText(r.lastName)}</td>
      <td class="center">${safeText(r.gender)}</td>
      <td>${safeText(r.role)}</td>
      <td class="right">${fmt(r.present)}</td>
      <td class="right">${fmt(r.miss)}</td>
      <td class="right">${fmt(r.permission)}</td>
      <td class="right">${fmt(r.mission)}</td>
      <td class="center"><button class="btn ghost" data-detail="${safeText(r.code)}" type="button">View</button></td>
    </tr>
  `;
}

function setView(view){
  currentView = view;
  const showCards = view === "cards";
  $("cards").style.display = showCards ? "grid" : "none";
  $("tableWrap").style.display = showCards ? "none" : "block";
  $("btnViewCards").classList.toggle("active", showCards);
  $("btnViewTable").classList.toggle("active", !showCards);
}

function render(list){
  $("cards").innerHTML = list.map(cardHtml).join("");
  $("tbody").innerHTML = list.map(rowHtml).join("");

  renderKpis(list);

  $("panelTitle").textContent = `បុគ្គលិក • ${currentLabel()}`;
  $("hint").textContent = `បង្ហាញ ${list.length} នាក់`;
  $("sourceChip").innerHTML = `<span class="dot"></span>${currentMode === "YEAR" ? "Summary" : "Monthly"}`;
  $("footerNote").textContent = `*Update: ${new Date().toLocaleString()}`;

  // keep view mode
  setView(currentView);
}

function applyFilterSort(){
  const {q, gender, sort} = qs();
  let list = employees.slice();

  if(gender){
    list = list.filter(x => safeText(x.gender).toUpperCase() === gender.toUpperCase());
  }
  if(q){
    list = list.filter(x => {
      const blob = [x.code, x.firstName, x.lastName, x.gender, x.role].map(safeText).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  const byText = (a,b, key) => safeText(a[key]).localeCompare(safeText(b[key]));
  const byNumDesc = (a,b, key) => (Number(b[key]||0) - Number(a[key]||0));

  if(sort === "sheet") list.sort((a,b)=> (Number(a.order||0) - Number(b.order||0)));
  else if(sort === "code") list.sort((a,b)=>byText(a,b,"code"));
  else if(sort === "name") list.sort((a,b)=> (safeText(a.lastName)+safeText(a.firstName)).localeCompare(safeText(b.lastName)+safeText(b.firstName)));
  else if(sort === "present_desc") list.sort((a,b)=>byNumDesc(a,b,"present"));
  else if(sort === "miss_desc") list.sort((a,b)=>byNumDesc(a,b,"miss"));
  else if(sort === "mission_desc") list.sort((a,b)=>byNumDesc(a,b,"mission"));

  render(list);
}

function showModal(id, show){
  const m = $(id);
  m.classList.toggle("show", !!show);
  m.setAttribute("aria-hidden", show ? "false" : "true");
}

function openDetail(code){
  const emp = employees.find(e => safeText(e.code) === safeText(code));
  if(!emp) return;

  $("modalTitle").textContent = `${emp.code} • ${emp.lastName} ${emp.firstName}`;
  $("modalSub").textContent = currentMode === "YEAR"
    ? "Summary total (Year)"
    : `Monthly total: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

  $("d_code").textContent = emp.code;
  $("d_name").textContent = `${emp.lastName} ${emp.firstName}`;
  $("d_gender").textContent = emp.gender;
  $("d_role").textContent = emp.role;

  const mini = $("miniKpis");
  mini.innerHTML = "";
  const cards = [
    {k:"Total Scan", v: fmt(emp.present)},
    {k:"ForgetScan", v: fmt(emp.miss)},
    {k:"Permission", v: fmt(emp.permission)},
    {k:"Mission", v: fmt(emp.mission)},
  ];
  for(const c of cards){
    const d = document.createElement("div");
    d.className = "miniKpi";
    d.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}</div>`;
    mini.appendChild(d);
  }

  showModal("modal", true);
}

/* ---------- Months UI ---------- */

function buildMonthsGrid(){
  const wrap = $("monthsGrid");
  wrap.innerHTML = "";

  // include Summary shortcut
  const allBtn = document.createElement("button");
  allBtn.className = "monthBtn";
  allBtn.type = "button";
  allBtn.textContent = "Summary (Year)";
  allBtn.dataset.month = "ALL";
  wrap.appendChild(allBtn);

  months.forEach(m => {
    const b = document.createElement("button");
    b.className = "monthBtn";
    b.type = "button";
    b.textContent = m.label;
    b.dataset.month = m.key;
    wrap.appendChild(b);
  });
}

function buildMonthSelect(){
  const sel = $("monthSelect");
  if(!sel) return;

  sel.innerHTML = `<option value="ALL">Summary (Year)</option>` +
    months.map(m => `<option value="${m.key}">${m.label}</option>`).join("");

  sel.value = currentMode === "YEAR" ? "ALL" : currentMonthKey;
}

function buildTabsRow(){
  const row = $("tabsRow");
  row.innerHTML = "";

  const mkTab = (key, label, smallText="") => {
    const b = document.createElement("button");
    b.className = "tabBtn";
    b.type = "button";
    b.dataset.month = key;
    b.innerHTML = smallText ? `${label} <small>(${smallText})</small>` : label;
    return b;
  };

  row.appendChild(mkTab("ALL", "Summary", "Year"));
  months.forEach(m => row.appendChild(mkTab(m.key, m.label)));

  syncActiveTabs();
}

function syncActiveTabs(){
  const tabs = document.querySelectorAll(".tabBtn");
  tabs.forEach(t => t.classList.toggle("active", (t.dataset.month === (currentMode==="YEAR" ? "ALL" : currentMonthKey))));
}

/* ---------- Load data ---------- */

async function loadYear(){
  setStatus("Loading Summary...");
  currentMode = "YEAR";
  currentMonthKey = "ALL";

  const data = await apiGet({ action:"employees", month:"ALL" });
  employees = data.employees || [];

  $("sort").value = "sheet";
  if($("monthSelect")) $("monthSelect").value = "ALL";
  syncActiveTabs();

  applyFilterSort();
  setStatus("Ready");
}

async function loadMonth(monthKey){
  setStatus("Loading " + monthKey + "...");
  currentMode = "MONTH";
  currentMonthKey = monthKey;

  const data = await apiGet({ action:"employees", month: monthKey });
  employees = data.employees || [];

  $("sort").value = "sheet";
  if($("monthSelect")) $("monthSelect").value = monthKey;
  syncActiveTabs();

  applyFilterSort();
  setStatus("Ready");
}

async function loadAll(){
  setStatus("Loading...");
  try{
    const meta = await apiGet({ action:"meta" });
    months = meta.months || [];

    buildMonthsGrid();
    buildMonthSelect();
    buildTabsRow();

    await loadYear();
  }catch(err){
    console.error(err);
    setStatus("Error");
    alert("Error: " + err.message + "\n\nពិនិត្យ Apps Script Deploy version + SCRIPT_URL");
  }
}

/* ---------- Events ---------- */

function bindEvents(){
  $("q").addEventListener("input", applyFilterSort);
  $("gender").addEventListener("change", applyFilterSort);
  $("sort").addEventListener("change", applyFilterSort);

  $("btnRefresh").addEventListener("click", loadAll);

  $("btnViewCards").addEventListener("click", ()=>setView("cards"));
  $("btnViewTable").addEventListener("click", ()=>setView("table"));

  // dropdown month
  $("monthSelect").addEventListener("change", async (e)=>{
    const v = e.target.value;
    try{
      if(v === "ALL") await loadYear();
      else await loadMonth(v);
    }catch(err){
      console.error(err);
      setStatus("Error");
      alert("Error loading month: " + v + "\n\n" + (err?.message || err));
    }
  });

  // Modals
  $("btnClose").addEventListener("click", ()=>showModal("modal", false));
  $("backdrop").addEventListener("click", ()=>showModal("modal", false));

  $("btnMonths").addEventListener("click", ()=>showModal("monthsModal", true));
  $("btnMonthsClose").addEventListener("click", ()=>showModal("monthsModal", false));
  $("monthsBackdrop").addEventListener("click", ()=>showModal("monthsModal", false));

  $("btnAccount").addEventListener("click", ()=>showModal("accountModal", true));
  $("btnAccountClose").addEventListener("click", ()=>showModal("accountModal", false));
  $("accountBackdrop").addEventListener("click", ()=>showModal("accountModal", false));

  // Delegation: View + Month buttons (tabs + modal)
  document.addEventListener("click", (e) => {
    const detailBtn = e.target.closest("[data-detail]");
    if(detailBtn) openDetail(detailBtn.dataset.detail);

    const monthBtn = e.target.closest("[data-month]");
    if(monthBtn){
      const mk = monthBtn.dataset.month;

      // close months modal if opened
      showModal("monthsModal", false);

      (mk === "ALL" ? loadYear() : loadMonth(mk)).catch(err=>{
        console.error(err);
        setStatus("Error");
        alert(
          "Error loading month: " + mk +
          "\n\n" + (err?.message || err) +
          "\n\nចំណាំ: Sheet ខែ ត្រូវមាន header ដូច Summary (Employee ID, Total Scan, Total Mission...)"
        );
      });
    }
  });

  // Esc key close
  window.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){
      showModal("modal", false);
      showModal("monthsModal", false);
      showModal("accountModal", false);
    }
  });

  // PWA install prompt
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    $("btnInstall").hidden = false;
  });
  $("btnInstall").addEventListener("click", async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(()=>{});
    deferredPrompt = null;
    $("btnInstall").hidden = true;
  });

  // Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }
}

bindEvents();
setView("cards");
loadAll();
