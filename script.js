/* ===========================
   CONFIG
=========================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGifoIAxkfZt3cGroIa9u9a1fepzakyQKic5DyPOsRL8-h7u6f85CrkqIMY4m-W-rA/exec";
const API_TOKEN  = ""; // optional, must match TOKEN in Code.gs

/* ===========================
   State
=========================== */
let employees = [];
let months = [];          // from meta
let currentMode = "YEAR"; // YEAR or MONTH
let currentMonthKey = "ALL";
let deferredInstallPrompt = null;

/* ===========================
   Helpers
=========================== */
const $ = (id) => document.getElementById(id);
function setStatus(msg){ $("status").textContent = msg; }
function fmt(n){ return Number(n || 0).toLocaleString("en-US"); }
function safeText(s){ return (s ?? "").toString(); }
function initials(lastName, firstName){
  const a = (safeText(lastName)[0] || "").toUpperCase();
  const b = (safeText(firstName)[0] || "").toUpperCase();
  return (a + b) || "AA";
}
function apiUrl(params){
  const u = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  if (API_TOKEN) u.searchParams.set("token", API_TOKEN);
  return u.toString();
}
function qs(){
  return {
    q: $("q").value.trim().toLowerCase(),
    gender: $("gender").value,
    sort: $("sort").value,
  };
}

/* ===========================
   API
=========================== */
async function fetchMeta(){
  const res = await fetch(apiUrl({ action:"meta" }), { cache:"no-store" });
  if(!res.ok) throw new Error("Meta fetch failed");
  return res.json();
}
async function fetchEmployees(mode, monthKey){
  // mode YEAR => month=ALL (Summary totals)
  // mode MONTH => month=November/December...
  const month = (mode === "YEAR") ? "ALL" : (monthKey || "ALL");
  const res = await fetch(apiUrl({ action:"employees", month }), { cache:"no-store" });
  if(!res.ok) throw new Error("Employees fetch failed");
  return res.json();
}

/* ===========================
   Render
=========================== */
function computeTotals(list){
  const t = { present:0, miss:0, permission:0, late:0, count:list.length };
  for(const r of list){
    t.present += Number(r.present || 0);
    t.miss += Number(r.miss || 0);
    t.permission += Number(r.permission || 0);
    t.late += Number(r.late || 0);
  }
  return t;
}

function renderKpis(list){
  const t = computeTotals(list);
  const wrap = $("kpis");
  wrap.innerHTML = "";

  const label = (currentMode === "YEAR") ? "សរុប ១ ឆ្នាំ" : `ខែ ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

  const cards = [
    { k:"បុគ្គលិក", v: fmt(t.count), s:"ចំនួនក្នុងតារាង" },
    { k:"វត្តមាន", v: fmt(t.present), s: label },
    { k:"សម្រាក/អវត្តមាន", v: fmt(t.miss), s: label },
    { k:"យឺត", v: fmt(t.late), s: label },
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
        <div class="avatar">${initials(r.lastName, r.firstName)}</div>
        <div style="min-width:0">
          <div class="empName">${safeText(r.lastName)} ${safeText(r.firstName)}</div>
          <div class="empMeta">${safeText(r.code)} • ${safeText(r.role)} • ${safeText(r.gender)}</div>
        </div>
      </div>

      <div class="empNums">
        <div class="num"><div class="k">វត្តមាន</div><div class="v">${fmt(r.present)}</div></div>
        <div class="num"><div class="k">សម្រាក/អវត្តមាន</div><div class="v">${fmt(r.miss)}</div></div>
        <div class="num"><div class="k">ច្បាប់</div><div class="v">${fmt(r.permission)}</div></div>
        <div class="num"><div class="k">យឺត</div><div class="v">${fmt(r.late)}</div></div>
      </div>

      <div class="empCardActions">
        <div class="tag">${currentMode === "YEAR" ? "Summary (Year)" : `Month: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`}</div>
        <button class="btn ghost" data-detail="${safeText(r.code)}">View</button>
      </div>
    </div>
  `;
}

function renderCards(list){ $("cards").innerHTML = list.map(cardHtml).join(""); }

function rowHtml(r){
  return `
    <tr>
      <td><span class="pill">${safeText(r.code)}</span></td>
      <td>${safeText(r.lastName)}</td>
      <td>${safeText(r.firstName)}</td>
      <td class="center">${safeText(r.gender)}</td>
      <td>${safeText(r.role)}</td>
      <td class="right">${fmt(r.present)}</td>
      <td class="right">${fmt(r.miss)}</td>
      <td class="right">${fmt(r.permission)}</td>
      <td class="right">${fmt(r.late)}</td>
      <td class="center"><button class="btn ghost" data-detail="${safeText(r.code)}">View</button></td>
    </tr>
  `;
}

function setView(view){
  const showCards = view === "cards";
  $("cards").style.display = showCards ? "grid" : "none";
  $("tableWrap").style.display = showCards ? "none" : "block";

  $("btnViewCards").classList.toggle("active", showCards);
  $("btnViewTable").classList.toggle("active", !showCards);
}

/* ===========================
   Sort/Filter (IMPORTANT)
   - "sheet": keep row order as in Summary (order field from backend)
=========================== */
function applyFilterSort(){
  const {q, gender, sort} = qs();
  let list = employees.slice();

  if(gender){
    list = list.filter(x => safeText(x.gender).toUpperCase() === gender.toUpperCase());
  }
  if(q){
    list = list.filter(x => {
      const blob = [x.code, x.lastName, x.firstName, x.gender, x.role].map(safeText).join(" ").toLowerCase();
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
  else if(sort === "late_desc") list.sort((a,b)=>byNumDesc(a,b,"late"));

  $("tbody").innerHTML = list.map(rowHtml).join("");
  renderCards(list);
  renderKpis(list);

  const label = (currentMode === "YEAR")
    ? "សរុប ១ ឆ្នាំ (Summary)"
    : `ខែ ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

  $("panelTitle").textContent = `បុគ្គលិក • ${label}`;
  $("hint").textContent = `បង្ហាញ ${list.length} នាក់ • តម្រៀប: ${$("sort").selectedOptions[0].textContent}`;

  $("sourceChip").innerHTML = `<span class="dot"></span>${currentMode === "YEAR" ? "Summary Sheet" : "Monthly Sheet"}`;
  $("footerNote").textContent = `*Update: ${new Date().toLocaleString()}`;
}

/* ===========================
   Employee Detail Modal
=========================== */
function showModal(id, show){
  const m = $(id);
  m.classList.toggle("show", !!show);
  m.setAttribute("aria-hidden", show ? "false" : "true");
}

function openDetail(code){
  const emp = employees.find(e => safeText(e.code) === safeText(code));
  if(!emp) return;

  $("modalTitle").textContent = `${emp.code} • ${emp.lastName} ${emp.firstName}`;
  $("modalSub").textContent = (currentMode === "YEAR")
    ? "Summary total (1 year)"
    : `Monthly total: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

  $("d_code").textContent = emp.code;
  $("d_name").textContent = `${emp.lastName} ${emp.firstName}`;
  $("d_gender").textContent = emp.gender;
  $("d_role").textContent = emp.role;

  const mini = $("miniKpis");
  mini.innerHTML = "";
  const cards = [
    {k:"វត្តមាន", v: fmt(emp.present)},
    {k:"សម្រាក/អវត្តមាន", v: fmt(emp.miss)},
    {k:"ច្បាប់", v: fmt(emp.permission)},
    {k:"យឺត", v: fmt(emp.late)},
  ];
  for(const c of cards){
    const d = document.createElement("div");
    d.className = "miniKpi";
    d.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}</div>`;
    mini.appendChild(d);
  }

  showModal("modal", true);
}

/* ===========================
   Months Modal
=========================== */
function buildMonthsGrid(){
  const wrap = $("monthsGrid");
  wrap.innerHTML = "";

  // only months that exist from meta
  months.forEach(m => {
    const b = document.createElement("button");
    b.className = "monthBtn";
    b.type = "button";
    b.textContent = m.label;
    b.dataset.month = m.key;
    wrap.appendChild(b);
  });
}

/* ===========================
   Load
=========================== */
async function loadAll(){
  setStatus("Loading...");
  try{
    const meta = await fetchMeta();
    months = meta.months || [];
    buildMonthsGrid();

    // default: YEAR mode (Summary)
    currentMode = "YEAR";
    currentMonthKey = "ALL";

    const data = await fetchEmployees("YEAR", "ALL");
    employees = data.employees || [];

    // default sort: sheet order
    $("sort").value = "sheet";
    applyFilterSort();

    setStatus("Ready");
  }catch(err){
    console.error(err);
    setStatus("Error");
    alert("មិនអាចទាញទិន្នន័យបានទេ។ សូមពិនិត្យ SCRIPT_URL និង Deployment (Web App)។");
  }
}

async function loadMonth(monthKey){
  setStatus("Loading month...");
  try{
    currentMode = "MONTH";
    currentMonthKey = monthKey;

    const data = await fetchEmployees("MONTH", monthKey);
    employees = data.employees || [];
    // keep sorting = sheet by default (so matches Summary order)
    $("sort").value = "sheet";
    applyFilterSort();
    setStatus("Ready");
  }catch(err){
    console.error(err);
    setStatus("Error");
    alert("មិនអាចទាញទិន្នន័យខែបានទេ។ សូមពិនិត្យថា sheet ខែនោះមាននៅក្នុង Google Sheet។");
  }
}

/* ===========================
   Events
=========================== */
function bindEvents(){
  $("q").addEventListener("input", applyFilterSort);
  $("gender").addEventListener("change", applyFilterSort);
  $("sort").addEventListener("change", applyFilterSort);

  $("btnRefresh").addEventListener("click", loadAll);

  $("btnViewCards").addEventListener("click", ()=>setView("cards"));
  $("btnViewTable").addEventListener("click", ()=>setView("table"));

  // detail modal
  $("btnClose").addEventListener("click", ()=>showModal("modal", false));
  $("backdrop").addEventListener("click", ()=>showModal("modal", false));
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") { showModal("modal", false); showModal("monthsModal", false); showModal("accountModal", false); } });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-detail]");
    if(btn) openDetail(btn.dataset.detail);

    const mbtn = e.target.closest("button.monthBtn");
    if(mbtn){
      const mk = mbtn.dataset.month;
      showModal("monthsModal", false);
      loadMonth(mk);
    }
  });

  // months modal
  $("btnMonths").addEventListener("click", ()=>showModal("monthsModal", true));
  $("btnMonthsClose").addEventListener("click", ()=>showModal("monthsModal", false));
  $("monthsBackdrop").addEventListener("click", ()=>showModal("monthsModal", false));

  // account modal
  $("btnAccount").addEventListener("click", ()=>showModal("accountModal", true));
  $("btnAccountClose").addEventListener("click", ()=>showModal("accountModal", false));
  $("accountBackdrop").addEventListener("click", ()=>showModal("accountModal", false));

  // PWA Install
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $("btnInstall").hidden = false;
  });

  $("btnInstall").addEventListener("click", async () => {
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("btnInstall").hidden = true;
  });
}

/* ===========================
   Service Worker
=========================== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

bindEvents();
setView("cards");
loadAll();
