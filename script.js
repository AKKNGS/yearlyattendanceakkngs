const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqN499pvOFxhVlFg6tqbrAkr8_YRp8wzxJb6126mLQhYSH_vHRi6dmOEusmMsa508x/exec";
const API_TOKEN  = ""; // optional

let employees = [];
let months = [];
let currentMode = "YEAR";
let currentMonthKey = "ALL";

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

function renderKpis(list){
  const t = computeTotals(list);
  const wrap = $("kpis");
  wrap.innerHTML = "";

  const label = (currentMode === "YEAR")
    ? "Summary (Year)"
    : `Month: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

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
        <div class="tag">${currentMode === "YEAR" ? "Summary (Year)" : `Month: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`}</div>
        <button class="btn ghost" data-detail="${safeText(r.code)}">View</button>
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

function render(list){
  $("cards").innerHTML = list.map(cardHtml).join("");
  $("tbody").innerHTML = list.map(rowHtml).join("");

  renderKpis(list);

  const label = (currentMode === "YEAR")
    ? "Summary (Year)"
    : `Month: ${months.find(m=>m.key===currentMonthKey)?.label || currentMonthKey}`;

  $("panelTitle").textContent = `បុគ្គលិក • ${label}`;
  $("hint").textContent = `បង្ហាញ ${list.length} នាក់`;
  $("sourceChip").innerHTML = `<span class="dot"></span>${currentMode === "YEAR" ? "Summary" : "Monthly"}`;
  $("footerNote").textContent = `*Update: ${new Date().toLocaleString()}`;
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
  $("modalSub").textContent = (currentMode === "YEAR")
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

function buildMonthsGrid(){
  const wrap = $("monthsGrid");
  wrap.innerHTML = "";
  months.forEach(m => {
    const b = document.createElement("button");
    b.className = "monthBtn";
    b.type = "button";
    b.textContent = m.label;
    b.dataset.month = m.key;
    wrap.appendChild(b);
  });
}

async function loadYear(){
  setStatus("Loading Summary...");
  currentMode = "YEAR";
  currentMonthKey = "ALL";
  const data = await apiGet({ action:"employees", month:"ALL" });
  employees = data.employees || [];
  $("sort").value = "sheet";
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
  applyFilterSort();
  setStatus("Ready");
}

async function loadAll(){
  setStatus("Loading...");
  try{
    const meta = await apiGet({ action:"meta" });
    months = meta.months || [];
    buildMonthsGrid();
    await loadYear();
  }catch(err){
    console.error(err);
    setStatus("Error");
    alert("Error: " + err.message + "\n\nពិនិត្យ Apps Script Deploy version + SCRIPT_URL");
  }
}

function bindEvents(){
  $("q").addEventListener("input", applyFilterSort);
  $("gender").addEventListener("change", applyFilterSort);
  $("sort").addEventListener("change", applyFilterSort);

  $("btnRefresh").addEventListener("click", loadAll);

  $("btnViewCards").addEventListener("click", ()=>setView("cards"));
  $("btnViewTable").addEventListener("click", ()=>setView("table"));

  // Modals
  $("btnClose").addEventListener("click", ()=>showModal("modal", false));
  $("backdrop").addEventListener("click", ()=>showModal("modal", false));

  $("btnMonths").addEventListener("click", ()=>showModal("monthsModal", true));
  $("btnMonthsClose").addEventListener("click", ()=>showModal("monthsModal", false));
  $("monthsBackdrop").addEventListener("click", ()=>showModal("monthsModal", false));

  $("btnAccount").addEventListener("click", ()=>showModal("accountModal", true));
  $("btnAccountClose").addEventListener("click", ()=>showModal("accountModal", false));
  $("accountBackdrop").addEventListener("click", ()=>showModal("accountModal", false));

  // IMPORTANT: delegation (works even if button has inner elements)
  document.addEventListener("click", (e) => {
    const detailBtn = e.target.closest("[data-detail]");
    if(detailBtn) openDetail(detailBtn.dataset.detail);

    const monthBtn = e.target.closest(".monthBtn");
    if(monthBtn){
      const mk = monthBtn.dataset.month;
      showModal("monthsModal", false);
      loadMonth(mk);
    }
  });

  window.addEventListener("keydown", (e)=>{
    if(e.key === "Escape"){
      showModal("modal", false);
      showModal("monthsModal", false);
      showModal("accountModal", false);
    }
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


