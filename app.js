
const STATUSES=["Ny","Kontaktad","Möte bokat","Offert","Vunnen","Förlorad"];
const SERVICES=["AI-chatbot","Gmail autosvar","AI-receptionist","Lead-respons & utskick","Outsourcing","Annat"];
const OWNERS=["Simon","Kollega"];
const SOURCES=["Kall-ring","Mejl","LinkedIn","Rekommendation","Inbound","Annat"];
const SUPABASE_URL="https://mrggclyieaskpjrxadbr.supabase.co";
const SUPABASE_KEY="sb_publishable_8e7zKAZ3oJlWZtj9TrYKtQ_uc5SL8vu";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let leads=[], meetings=[], view="pipeline", canWrite=true, started=false;
const fromLead=r=>({id:r.id,company:r.company,contact:r.contact,email:r.email,phone:r.phone,service:r.service,status:r.status,owner:r.owner,source:r.source,value:Number(r.value)||0,commission:Number(r.commission)||0,nextStep:r.next_step,nextDate:r.next_date,notes:r.notes,created:r.created_at});
const toLead=d=>({company:d.company,contact:d.contact,email:d.email,phone:d.phone,service:d.service,status:d.status,owner:d.owner,source:d.source,value:Number(d.value)||0,commission:Number(d.commission)||0,next_step:d.nextStep||null,next_date:d.nextDate||null,notes:d.notes,updated_at:new Date().toISOString()});
const fromMeet=r=>({id:r.id,leadId:r.lead_id,date:r.date,time:r.time,type:r.type,note:r.note,owner:r.owner});
async function chk(p){const {error}=await p; if(error) throw error;}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kr=n=>new Intl.NumberFormat("sv-SE",{maximumFractionDigits:0}).format(n||0)+" kr";
const today=()=>new Date().toISOString().slice(0,10);
const prov=l=>(Number(l.value)||0)*(Number(l.commission)||0)/100;

for(const o of OWNERS) $("#fOwner").insertAdjacentHTML("beforeend",`<option>${o}</option>`);
for(const s of SERVICES) $("#fSvc").insertAdjacentHTML("beforeend",`<option>${s}</option>`);

function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2200)}

function filtered(){
  const q=$("#q").value.trim().toLowerCase(),o=$("#fOwner").value,s=$("#fSvc").value;
  return leads.filter(l=>(!o||l.owner===o)&&(!s||l.service===s)&&(!q||[l.company,l.contact,l.email,l.phone,l.notes].join(" ").toLowerCase().includes(q)));
}

function renderStats(){
  const L=filtered();
  const open=L.filter(l=>!["Vunnen","Förlorad"].includes(l.status));
  const won=L.filter(l=>l.status==="Vunnen"), lost=L.filter(l=>l.status==="Förlorad");
  const upcoming=meetings.filter(m=>m.date>=today()).length;
  const conv=(won.length+lost.length)?Math.round(won.length/(won.length+lost.length)*100):0;
  const items=[
    ["Leads",L.length,`${L.filter(l=>l.status==="Ny").length} nya`],
    ["Öppna affärer",open.length,kr(open.reduce((a,l)=>a+(+l.value||0),0))+" i pipeline"],
    ["Kommande möten",upcoming,`${meetings.length} totalt`],
    ["Vunna",won.length,`${conv}% vinstgrad`],
    ["Intjänad provision",kr(won.reduce((a,l)=>a+prov(l),0)),"på vunna affärer"],
    ["Möjlig provision",kr(open.reduce((a,l)=>a+prov(l),0)),"om öppna vinns"],
  ];
  $("#stats").innerHTML=items.map(([k,v,s])=>`<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join("");
}

function dueHtml(l){
  if(!l.nextDate) return "";
  const late=l.nextDate<today()&&!["Vunnen","Förlorad"].includes(l.status);
  return `<span class="due ${late?"late":""}">${esc(l.nextDate)}${l.nextStep?" · "+esc(l.nextStep):""}</span>`;
}

function emptyState(){
  return `<div class="emptystate"><b>Inga leads än</b>Klicka <strong>+ Ny lead</strong> uppe till höger för att lägga in första kunden. Allt sparas direkt och syns för er båda.</div>`;
}

function renderPipeline(){
  const L=filtered();
  if(!leads.length) return $("#view").innerHTML=emptyState();
  $("#view").innerHTML=`<div class="board-scroll"><div class="board">${STATUSES.map(s=>{
    const c=L.filter(l=>l.status===s);
    return `<div class="col" data-status="${s}"><h3>${s} <span class="sum">${c.length} · ${kr(c.reduce((a,l)=>a+(+l.value||0),0))}</span></h3>
    ${c.map(l=>`<div class="card" tabindex="0" draggable="${canWrite}" data-id="${l.id}">
      <div class="co">${esc(l.company)}</div>
      <div class="meta"><span>${esc(l.contact||"–")}</span><span class="chip">${esc(l.service)}</span></div>
      <div class="meta"><span>${esc(l.owner)}</span>${l.value?`<span>${kr(l.value)}</span>`:""}</div>
      ${dueHtml(l)}</div>`).join("")||`<div class="empty-col">Tomt</div>`}</div>`}).join("")}</div></div>`;
  bindCards();
  document.querySelectorAll(".col").forEach(col=>{
    col.addEventListener("dragover",e=>{e.preventDefault();col.classList.add("drop")});
    col.addEventListener("dragleave",()=>col.classList.remove("drop"));
    col.addEventListener("drop",e=>{e.preventDefault();col.classList.remove("drop");
      const id=e.dataTransfer.getData("text/plain");const l=leads.find(x=>x.id===id);
      if(l&&l.status!==col.dataset.status) saveLead(id,{...l,status:col.dataset.status},`Flyttad till ${col.dataset.status}`);});
  });
}
function bindCards(){
  document.querySelectorAll("[data-id]").forEach(el=>{
    el.addEventListener("click",()=>openLead(el.dataset.id));
    el.addEventListener("keydown",e=>{if(e.key==="Enter")openLead(el.dataset.id)});
    el.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",el.dataset.id));
  });
}

function renderList(){
  const L=filtered().sort((a,b)=>(b.created||"").localeCompare(a.created||""));
  if(!leads.length) return $("#view").innerHTML=emptyState();
  $("#view").innerHTML=`<div class="tbl-scroll"><table><thead><tr><th>Företag</th><th>Kontakt</th><th>Mejl / Tel</th><th>Tjänst</th><th>Status</th><th>Ansvarig</th><th style="text-align:right">Värde</th><th style="text-align:right">Provision</th><th>Nästa steg</th></tr></thead><tbody>
  ${L.map(l=>`<tr data-id="${l.id}" tabindex="0"><td><b>${esc(l.company)}</b></td><td>${esc(l.contact)}</td><td>${esc(l.email)}${l.phone?"<br>"+esc(l.phone):""}</td><td>${esc(l.service)}</td><td><span class="st" data-s="${esc(l.status)}">${esc(l.status)}</span></td><td>${esc(l.owner)}</td><td class="num">${l.value?kr(l.value):"–"}</td><td class="num">${prov(l)?kr(prov(l)):"–"}</td><td>${dueHtml(l)}</td></tr>`).join("")}
  </tbody></table></div>`;
  bindCards();
}

function renderMeetings(){
  const t=today();
  const M=[...meetings].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const up=M.filter(m=>m.date>=t), past=M.filter(m=>m.date<t).reverse();
  const row=(m,p)=>{const l=leads.find(x=>x.id===m.leadId);return `<div class="mrow ${p?"past":""}"><div class="when">${esc(m.date)}<br>${esc(m.time||"")}</div>
    <div class="who"><b>${esc(l?.company||"Okänd lead")}</b><span>${esc(m.type||"")}${m.note?" · "+esc(m.note):""} · ${esc(m.owner||"")}</span></div>
    ${l?`<button class="btn" data-open="${l.id}">Öppna</button>`:""}</div>`};
  $("#view").innerHTML=`<div style="display:grid;gap:12px"><h2>Kommande</h2>${up.length?`<div class="mlist">${up.map(m=>row(m,false)).join("")}</div>`:`<div class="emptystate"><b>Inga bokade möten</b>Öppna en lead och tryck <strong>Boka möte</strong>.</div>`}
  ${past.length?`<h2 style="margin-top:12px">Tidigare</h2><div class="mlist">${past.map(m=>row(m,true)).join("")}</div>`:""}</div>`;
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openLead(b.dataset.open));
}

function render(){
  renderStats();
  ({pipeline:renderPipeline,lista:renderList,moten:renderMeetings})[view]();
}

const opts=(arr,v)=>arr.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("");
function openLead(id){
  const l=id?leads.find(x=>x.id===id):{status:"Ny",service:SERVICES[0],owner:OWNERS[0],source:SOURCES[0],commission:20};
  if(!l) return;
  const lm=id?meetings.filter(m=>m.leadId===id).sort((a,b)=>(b.date).localeCompare(a.date)):[];
  $("#modal").innerHTML=`<h2>${id?esc(l.company):"Ny lead"}</h2>
  <form id="lf" style="display:grid;gap:12px">
    <div class="grid2">
      <label>Företag *<input id="f-company" required value="${esc(l.company)}"></label>
      <label>Kontaktperson<input id="f-contact" value="${esc(l.contact)}"></label>
      <label>Mejl<input id="f-email" type="email" value="${esc(l.email)}"></label>
      <label>Telefon<input id="f-phone" value="${esc(l.phone)}"></label>
      <label>Tjänst<select id="f-service">${opts(SERVICES,l.service)}</select></label>
      <label>Status<select id="f-status">${opts(STATUSES,l.status)}</select></label>
      <label>Ansvarig<select id="f-owner">${opts(OWNERS,l.owner)}</select></label>
      <label>Källa<select id="f-source">${opts(SOURCES,l.source)}</select></label>
      <label>Affärsvärde (kr)<input id="f-value" type="number" min="0" step="100" value="${esc(l.value)}"></label>
      <label>Provision (%)<input id="f-commission" type="number" min="0" max="100" value="${esc(l.commission)}"></label>
      <label>Nästa steg<input id="f-nextStep" placeholder="t.ex. Ring upp" value="${esc(l.nextStep)}"></label>
      <label>Datum nästa steg<input id="f-nextDate" type="date" value="${esc(l.nextDate)}"></label>
    </div>
    <label>Anteckningar<textarea id="f-notes">${esc(l.notes)}</textarea></label>
    <div class="mfoot"><button class="btn primary" type="submit">Spara</button><button class="btn" type="button" id="cancel">Stäng</button>
      <span class="spacer"></span>${id?`<button class="btn danger" type="button" id="del">Ta bort</button>`:""}</div>
  </form>
  ${id?`<div class="sub"><h4>Möten</h4>
    ${lm.map(m=>`<div class="notice">${esc(m.date)} ${esc(m.time||"")} · ${esc(m.type||"")}${m.note?" · "+esc(m.note):""} <button class="btn" style="padding:2px 8px;font-size:12px" data-delm="${m.id}">Ta bort</button></div>`).join("")||`<div class="notice">Inga möten än.</div>`}
    <form id="mf" class="grid2">
      <label>Datum<input id="m-date" type="date" required value="${today()}"></label>
      <label>Tid<input id="m-time" type="time" value="10:00"></label>
      <label>Typ<select id="m-type"><option>Digitalt</option><option>Telefon</option><option>På plats</option></select></label>
      <label>Anteckning<input id="m-note" placeholder="t.ex. Demo av chatbot"></label>
      <div><button class="btn" type="submit">Boka möte</button></div>
    </form></div>`:""}`;
  $("#scrim").hidden=false;
  $("#f-company").focus();
  $("#cancel").onclick=close;
  $("#lf").onsubmit=e=>{e.preventDefault();
    const d={};for(const k of["company","contact","email","phone","service","status","owner","source","value","commission","nextStep","nextDate","notes"]) d[k]=$("#f-"+k).value.trim();
    d.value=Number(d.value)||0;d.commission=Number(d.commission)||0;
    d.created=l.created||new Date().toISOString();d.updated=new Date().toISOString();
    saveLead(id,d,id?"Sparad":"Lead tillagd");close();};
  if(id){
    const del=$("#del");
    del.onclick=()=>{if(del.dataset.sure){removeLead(id);close()}else{del.dataset.sure=1;del.textContent="Säker? Klicka igen"}};
    $("#mf").onsubmit=async e=>{e.preventDefault();
      const m={leadId:id,date:$("#m-date").value,time:$("#m-time").value,type:$("#m-type").value,note:$("#m-note").value.trim(),owner:l.owner};
      try{await chk(sb.from("meetings").insert({lead_id:m.leadId,date:m.date,time:m.time,type:m.type,note:m.note,owner:m.owner}));
        if(["Ny","Kontaktad"].includes(l.status)) await chk(sb.from("leads").update({status:"Möte bokat"}).eq("id",id));
        await loadAll();
        toast("Möte bokat");close();}catch(err){fail(err)}};
    document.querySelectorAll("[data-delm]").forEach(b=>b.onclick=async()=>{try{await chk(sb.from("meetings").delete().eq("id",b.dataset.delm));await loadAll();toast("Möte borttaget");close()}catch(err){fail(err)}});
  }
}
function close(){$("#scrim").hidden=true}
$("#scrim").addEventListener("click",e=>{if(e.target.id==="scrim")close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#scrim").hidden)close()});

function fail(err){
  console.error(err); toast("Kunde inte spara – försök igen");
}
async function saveLead(id,d,msg){
  try{ if(id) await chk(sb.from("leads").update(toLead(d)).eq("id",id)); else await chk(sb.from("leads").insert(toLead(d))); await loadAll(); toast(msg);}catch(err){fail(err)}
}
async function removeLead(id){
  try{await chk(sb.from("leads").delete().eq("id",id)); await loadAll();
    toast("Lead borttagen");}catch(err){fail(err)}
}

$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;view=b.dataset.v;
  document.querySelectorAll("#tabs button").forEach(x=>x.setAttribute("aria-current",x===b));render()});
["#q","#fOwner","#fSvc"].forEach(s=>$(s).addEventListener("input",render));
$("#newLead").onclick=()=>openLead(null);

async function loadAll(){
  const [a,b]=await Promise.all([sb.from("leads").select("*"),sb.from("meetings").select("*")]);
  if(a.error||b.error){$("#sync").textContent="Kunde inte hämta data";return}
  leads=a.data.map(fromLead); meetings=b.data.map(fromMeet); render();
  $("#sync").textContent="Synkad";
}
let reloadT;
function startApp(session){
  $("#login").hidden=true; $("#app").hidden=false;
  $("#who").textContent=session.user.email;
  render(); loadAll();
  if(started) return; started=true;
  sb.channel("crm").on("postgres_changes",{event:"*",schema:"public"},()=>{clearTimeout(reloadT);reloadT=setTimeout(loadAll,300)}).subscribe(st=>{if(st==="SUBSCRIBED")$("#sync").textContent="Synkad live"});
}
function showLogin(){ $("#app").hidden=true; $("#login").hidden=false; }
$("#loginForm").onsubmit=async e=>{e.preventDefault();$("#lerr").textContent="";
  const {data,error}=await sb.auth.signInWithPassword({email:$("#lemail").value.trim(),password:$("#lpass").value});
  if(error) $("#lerr").textContent="Fel mejl eller lösenord."; else startApp(data.session);};
$("#logout").onclick=async()=>{await sb.auth.signOut();showLogin()};
sb.auth.getSession().then(({data})=>data.session?startApp(data.session):showLogin());
