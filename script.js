/* ===========================
   CONFIG
=========================== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGifoIAxkfZt3cGroIa9u9a1fepzakyQKic5DyPOsRL8-h7u6f85CrkqIMY4m-W-rA/exec"; // e.g. https://script.google.com/macros/s/XXXX/exec
const API_TOKEN  = ""; // optional: must match TOKEN in Code.gs. leave "" if not used

/* ===========================
   State
=========================== */
let employees = [];
let months = [];
let selectedMonth = "";
let deferredInstallPrompt = null;

/* ===========================
   Helpers
=========================== */
const $ = (id) => document.getElementById(id);

function setStatus(msg){ $("status").textContent = msg; }

function fmt(n){
  const x = Number(n || 0);
  return x.toLocaleString("en-US");
}

function safeText(s){
  return (s ?? "").toString();
}

function qs(){
  return {
    q: $("q").value.trim().toLowerCase(),
    month: $("month").value,
    gender: $("gender").value,
    sort: $("sort").value,
  };
}

function apiUrl(params){
  const u = new URL(SCRIPT_URL);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  if (API_TOKEN) u.searchParams.set("token", API_TOKEN);
  return u.toString();
}

/* ===========================
   API Calls
=========================== */
async function fetchMeta(){
  const res = await fetch(apiUrl({ action:"meta" }), { cache:"no-store" });
  if(!res.ok) throw new Error("Meta fetch failed");
  return res.json();
}

async function fetchEmployees(month){
  const res = await fetch(apiUrl({ action:"employees", month }), { cache:"no-store" });
  if(!res.ok) throw new Error("Employees fetch failed");
  return res.json();
}

async function fetchDetail(empId){
  const res = await fetch(apiUrl({ action:"detail", id: empId }), { cache:"no-store" });
  if(!res.ok) throw new Error("Detail fetch failed");
  return res.json();
}

/* ===========================
   Rendering
=========================== */
function buildMonthOptions(){
  const sel = $("month");
  sel.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "សរុបទាំងឆ្នាំ";
  sel.appendChild(optAll);

  months.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.key;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });

  // default
  sel.value = selectedMonth || "ALL";
}

function computeTotals(list){
  const t = { present:0, absent:0, permission:0, late:0, count:list.length };
  for(const r of list){
    t.present += Number(r.present || 0);
    t.absent += Number(r.absent || 0);
    t.permission += Number(r.permission || 0);
    t.late += Number(r.late || 0);
  }
  return t;
}

function renderKpis(list){
  const t = computeTotals(list);
  const wrap = $("kpis");
  wrap.innerHTML = "";

  const cards = [
    { k:"បុគ្គលិក", v: fmt(t.count), s:"ចំនួនក្នុងតារាង" },
    { k:"វត្តមាន", v: fmt(t.present), s:"សរុប" },
    { k:"អវត្តមាន", v: fmt(t.absent), s:"សរុប" },
    { k:"យឺត", v: fmt(t.late), s:"សរុប" },
  ];

  for(const c of cards){
    const div = document.createElement("div");
    div.className = "kpi";
    div.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s">${c.s}</div>`;
    wrap.appendChild(div);
  }
}

function rowHtml(r){
  return `
    <tr>
      <td><span class="pill">${safeText(r.code)}</span></td>
      <td>${safeText(r.lastName)}</td>
      <td>${safeText(r.firstName)}</td>
      <td class="center">${safeText(r.gender)}</td>
      <td>${safeText(r.role)}</td>
      <td class="right">${fmt(r.present)}</td>
      <td class="right">${fmt(r.absent)}</td>
      <td class="right">${fmt(r.permission)}</td>
      <td class="right">${fmt(r.late)}</td>
      <td class="center">
        <button class="btn ghost" data-detail="${safeText(r.code)}">View</button>
      </td>
    </tr>
  `;
}

function applyFilterSort(){
  const {q, month, gender, sort} = qs();

  let list = employees.slice();

  if(gender){
    list = list.filter(x => safeText(x.gender).toUpperCase() === gender.toUpperCase());
  }
  if(q){
    list = list.filter(x => {
      const blob = [
        x.code, x.lastName, x.firstName, x.gender, x.role
      ].map(safeText).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  // sort
  const byText = (a,b, key) => safeText(a[key]).localeCompare(safeText(b[key]));
  const byNumDesc = (a,b, key) => (Number(b[key]||0) - Number(a[key]||0));

  if(sort === "code") list.sort((a,b)=>byText(a,b,"code"));
  else if(sort === "name") list.sort((a,b)=> (safeText(a.lastName)+safeText(a.firstName)).localeCompare(safeText(b.lastName)+safeText(b.firstName)));
  else if(sort === "present_desc") list.sort((a,b)=>byNumDesc(a,b,"present"));
  else if(sort === "absent_desc") list.sort((a,b)=>byNumDesc(a,b,"absent"));
  else if(sort === "late_desc") list.sort((a,b)=>byNumDesc(a,b,"late"));

  // render
  $("tbody").innerHTML = list.map(rowHtml).join("");
  $("hint").textContent = `បង្ហាញ ${list.length} នាក់ • ខែ: ${month === "ALL" ? "សរុបទាំងឆ្នាំ" : (months.find(m=>m.key===month)?.label || month)}`;

  renderKpis(list);
}

async function openDetail(empId){
  setStatus("Loading details...");
  try{
    const data = await fetchDetail(empId);
    // data: { employee, rows:[{monthKey,label,present,absent,permission,late}], totals:{} }
    $("modalTitle").textContent = `${data.employee.code} • ${data.employee.lastName} ${data.employee.firstName}`;
    $("modalSub").textContent = `${safeText(data.employee.role)} • ${safeText(data.employee.gender)}`;

    const mini = $("miniKpis");
    mini.innerHTML = "";
    const t = data.totals || {};
    const cards = [
      {k:"វត្តមាន", v: fmt(t.present)},
      {k:"អវត្តមាន", v: fmt(t.absent)},
      {k:"ច្បាប់", v: fmt(t.permission)},
      {k:"យឺត", v: fmt(t.late)},
    ];
    for(const c of cards){
      const d = document.createElement("div");
      d.className = "miniKpi";
      d.innerHTML = `<div class="k">${c.k}</div><div class="v">${c.v}</div>`;
      mini.appendChild(d);
    }

    $("detailBody").innerHTML = (data.rows || []).map(r => `
      <tr>
        <td>${safeText(r.label)}</td>
        <td class="right">${fmt(r.present)}</td>
        <td class="right">${fmt(r.absent)}</td>
        <td class="right">${fmt(r.permission)}</td>
        <td class="right">${fmt(r.late)}</td>
      </tr>
    `).join("");

    showModal(true);
    setStatus("Ready");
  }catch(err){
    console.error(err);
    setStatus("Failed to load detail");
    alert("បរាជ័យក្នុងការទាញយក Detail។ សូមពិនិត្យ SCRIPT_URL/Token និង Deployment។");
  }
}

function showModal(show){
  const m = $("modal");
  m.classList.toggle("show", !!show);
  m.setAttribute("aria-hidden", show ? "false" : "true");
}

/* ===========================
   Load
=========================== */
async function loadAll(){
  setStatus("Loading...");
  try{
    const meta = await fetchMeta();
    months = meta.months || [];
    selectedMonth = meta.defaultMonthKey || "ALL";

    buildMonthOptions();

    const month = $("month").value;
    const empRes = await fetchEmployees(month);
    employees = empRes.employees || [];

    applyFilterSort();
    setStatus("Ready");
  }catch(err){
    console.error(err);
    setStatus("Error");
    alert("មិនអាចទាញទិន្នន័យបានទេ។ សូមពិនិត្យ Apps Script Web App URL និងការចែកចាយ (Deploy)។");
  }
}

/* ===========================
   Events
=========================== */
function bindEvents(){
  $("q").addEventListener("input", applyFilterSort);
  $("gender").addEventListener("change", applyFilterSort);
  $("sort").addEventListener("change", applyFilterSort);

  $("month").addEventListener("change", async () => {
    setStatus("Loading month...");
    try{
      const month = $("month").value;
      const empRes = await fetchEmployees(month);
      employees = empRes.employees || [];
      applyFilterSort();
      setStatus("Ready");
    }catch(err){
      console.error(err);
      setStatus("Error");
    }
  });

  $("btnRefresh").addEventListener("click", loadAll);

  // table click for details
  $("tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-detail]");
    if(!btn) return;
    openDetail(btn.dataset.detail);
  });

  $("btnClose").addEventListener("click", ()=>showModal(false));
  $("backdrop").addEventListener("click", ()=>showModal(false));
  window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") showModal(false); });

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
loadAll();