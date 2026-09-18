const NAV=[["home","⌂","Hive"],["scan","⬡","Scan"],["journal","◫","Patterns"],["agent","✦","Agent"],["profile","◉","Profile"]];
const MODES=[["ingredient","Ingredient label"],["product","Product"],["meal","Food / plate"],["menu","Menu"],["cosmetic","Cosmetic"],["fabric","Fabric"],["nature","Plant / nature"],["flareup","Flare-up"],["other","Other"]];
const KEY="honeycombPrototypeV1";
let data=JSON.parse(localStorage.getItem(KEY)||"null")||{
 account:{name:"",email:""},
 profile:{synopsis:"",known:"",suspected:"",avoid:"",tolerated:""},
 records:[],scans:[],reactions:[],
 chat:[{role:"ai",text:"Hi — I’m the Honeycomb prototype agent. I can organize the profile, scans, and reaction history saved in this browser."}]
};
let mode="ingredient";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const split=v=>(v||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
const esc=s=>(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const stamp=()=>new Date().toLocaleString([],{dateStyle:"medium",timeStyle:"short"});
function save(){localStorage.setItem(KEY,JSON.stringify(data));render();}
function nav(){["#desktopNav","#mobileNav"].forEach(sel=>$(sel).innerHTML=NAV.map(([v,i,l])=>`<button class="nav-btn ${v==="home"?"active":""}" data-view="${v}"><span>${i}</span><span>${l}</span></button>`).join(""));$$(".nav-btn").forEach(b=>b.onclick=()=>show(b.dataset.view));}
function show(v){$$(".view").forEach(x=>x.classList.remove("active"));$("#"+v).classList.add("active");$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===v));const t={home:["TODAY","Your Hive"],scan:["HONEYCOMB LIVE","Scan"],journal:["PATTERNS","History"],agent:["AI AGENT","Chat"],profile:["PROFILE","Your Context"],report:["APPOINTMENT","Snapshot"]};$("#eyebrow").textContent=t[v][0];$("#pageTitle").textContent=t[v][1];if(v==="report")report();window.scrollTo({top:0,behavior:"smooth"});}
function modes(){$("#modePills").innerHTML=MODES.map(([v,l])=>`<button class="pill ${v===mode?"active":""}" data-mode="${v}">${l}</button>`).join("");$$(".pill").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;modes();});}
function quick(){$("#quickGrid").innerHTML=[
["ingredient","Ingredient Radar","label / ingredient list"],["meal","Food Radar","plate / meal / menu"],["flareup","Reaction Check","photo + context"],["nature","Nature Radar","plant / tree / flower"]
].map(([m,a,b])=>`<button class="quick" data-mode="${m}"><b>${a}</b><small>${b}</small></button>`).join("");$$(".quick").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;modes();show("scan");});}
function render(){
 $("#avatar").textContent=(data.account.name||"H").charAt(0).toUpperCase();$("#name").value=data.account.name||"";$("#synopsis").value=data.profile.synopsis||"";$("#known").value=data.profile.known||"";$("#suspected").value=data.profile.suspected||"";$("#avoid").value=data.profile.avoid||"";$("#tolerated").value=data.profile.tolerated||"";
 $("#profileMap").innerHTML=[["Known",split(data.profile.known).length],["Suspected",split(data.profile.suspected).length],["Avoid",split(data.profile.avoid).length],["Tolerated",split(data.profile.tolerated).length]].map(x=>`<div class="row"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
 const sh=data.scans.slice().reverse().map(s=>`<div class="entry"><b>${esc(s.label)}</b><div>${esc(s.summary)}</div><small>${esc(s.time)} · ${s.confidence}% evidence</small></div>`).join("");$("#recentScans").innerHTML=sh||"No scans yet.";$("#scanHistory").innerHTML=sh||"No scans yet.";
 $("#reactionHistory").innerHTML=data.reactions.slice().reverse().map(r=>`<div class="entry"><b>Tracking severity ${r.severity}/5</b><div>${esc(r.note)}</div><small>${esc(r.time)}</small></div>`).join("")||"No reactions logged.";
 $("#recordList").innerHTML=data.records.map((r,i)=>`<div class="record"><span>${esc(r.name)} <small>${esc(r.time)}</small></span><button class="link" onclick="removeRecord(${i})">remove</button></div>`).join("")||"<p class='soft'>No record references yet.</p>";
 $("#messages").innerHTML=data.chat.map(m=>`<div class="bubble ${m.role}">${esc(m.text)}</div>`).join("");$("#messages").scrollTop=$("#messages").scrollHeight;
}
window.removeRecord=i=>{data.records.splice(i,1);save();}
function analyze(){
 const text=$("#scanText").value.trim(), hay=text.toLowerCase(), p=data.profile;
 const known=split(p.known).filter(x=>hay.includes(x.toLowerCase()));
 const suspected=split(p.suspected).filter(x=>hay.includes(x.toLowerCase()));
 const avoid=split(p.avoid).filter(x=>hay.includes(x.toLowerCase()));
 const tolerated=split(p.tolerated).filter(x=>hay.includes(x.toLowerCase()));
 let label="Needs review",summary="Honeycomb does not have enough reliable information to verify this exposure.",confidence=24,cls="review";
 if(known.length||avoid.length){label="Potential concern";summary=`Profile match found: ${[...known,...avoid].join(", ")}. This is a profile match, not a diagnosis.`;confidence=Math.min(94,72+(known.length+avoid.length)*5);cls="concern";}
 else if(suspected.length){label="Possible concern";summary=`Suspected-trigger match: ${suspected.join(", ")}. This is a pattern flag, not proof of an allergy.`;confidence=Math.min(78,52+suspected.length*7);cls="review";}
 else if(text&&tolerated.length){label="Previously tolerated match";summary=`Matched your tolerated list: ${tolerated.join(", ")}. Past tolerance does not guarantee future tolerance.`;confidence=Math.min(70,48+tolerated.length*6);cls="clear";}
 else if(text){label="No profile match found";summary="No text match was found in your current profile. This does not mean the item is medically safe.";confidence=43;cls="clear";}
 else{label="Image received — ML router not connected yet";summary="The image UI is working. Train the image-router model in /ml, then connect its prediction here.";confidence=12;cls="review";}
 const cells=Math.max(1,Math.round(confidence/20));$("#resultCard").innerHTML=`<p class="kicker">${esc((MODES.find(x=>x[0]===mode)||["","Scan"])[1].toUpperCase())}</p><h2>${esc(label)}</h2><span class="badge ${cls}">${confidence}% evidence confidence</span><div class="signal">${[0,1,2,3,4].map(i=>`<span class="${i<cells?"on":""}"></span>`).join("")}</div><p>${esc(summary)}</p><small class="soft">Evidence confidence describes support for this explanation, not the probability that you are allergic.</small>`;
 data.scans.push({mode,label,summary,confidence,text:text.slice(0,600),time:stamp()});save();
}
function reply(q){const low=q.toLowerCase(),last=data.scans.at(-1),react=data.reactions.at(-1);if(low.includes("appointment")||low.includes("report"))return"Open Profile → Appointment snapshot. It summarizes your current profile, saved record references, recent scans, and reaction journal.";if(low.includes("last scan"))return last?`Your latest scan was "${last.label}" with ${last.confidence}% evidence confidence. ${last.summary}`:"You do not have a scan yet.";if(low.includes("reaction")||low.includes("flare"))return react?`Your latest reaction entry was tracking severity ${react.severity}/5: ${react.note}`:"You do not have a reaction entry yet.";return"In the full product, I would use selected profile context, prior scans, reaction history, and cited external sources. This prototype keeps the chat local and demonstrates the saved-thread workflow.";}
function send(){const q=$("#chatInput").value.trim();if(!q)return;data.chat.push({role:"user",text:q},{role:"ai",text:reply(q)});$("#chatInput").value="";save();}
function report(){const p=data.profile;$("#reportBody").innerHTML=`<h2>Honeycomb Appointment Snapshot</h2><p class="soft">Generated ${stamp()}. User-organized history; not a diagnosis.</p><table><tr><td>Name</td><td>${esc(data.account.name)||"—"}</td></tr><tr><td>Background synopsis</td><td>${esc(p.synopsis)||"—"}</td></tr><tr><td>Known allergies</td><td>${esc(p.known)||"—"}</td></tr><tr><td>Suspected triggers</td><td>${esc(p.suspected)||"—"}</td></tr><tr><td>Personal avoids</td><td>${esc(p.avoid)||"—"}</td></tr><tr><td>Tolerated</td><td>${esc(p.tolerated)||"—"}</td></tr></table><h3>Record references</h3>${data.records.length?`<ul>${data.records.map(r=>`<li>${esc(r.name)} — ${esc(r.time)}</li>`).join("")}</ul>`:"<p>None.</p>"}<h3>Recent scans</h3>${data.scans.length?`<ul>${data.scans.slice(-15).reverse().map(s=>`<li><b>${esc(s.label)}</b> (${s.confidence}% evidence) — ${esc(s.summary)}</li>`).join("")}</ul>`:"<p>None.</p>"}<h3>Reaction journal</h3>${data.reactions.length?`<ul>${data.reactions.slice(-15).reverse().map(r=>`<li>Severity ${r.severity}/5 — ${esc(r.note)} (${esc(r.time)})</li>`).join("")}</ul>`:"<p>None.</p>"}<h3>Questions to bring to the appointment</h3><p>Which suspected triggers are worth formal evaluation? Are there patterns in the exposure/reaction history that should be investigated? Which avoidance items are medically necessary versus precautionary?</p>`;}
function exportData(){const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="honeycomb-export.json";a.click();URL.revokeObjectURL(a.href);}
nav();modes();quick();render();
if(data.account.name){$("#onboarding").classList.add("hidden");$("#app").classList.remove("hidden");}
$("#startBtn").onclick=()=>{data.account.name=$("#signupName").value.trim()||"Honeycomb User";data.account.email=$("#signupEmail").value.trim();save();$("#onboarding").classList.add("hidden");$("#app").classList.remove("hidden");};
$$("[data-view]").forEach(b=>b.onclick=()=>show(b.dataset.view));$("#avatar").onclick=()=>show("profile");
$("#saveProfile").onclick=()=>{data.account.name=$("#name").value;data.profile={synopsis:$("#synopsis").value,known:$("#known").value,suspected:$("#suspected").value,avoid:$("#avoid").value,tolerated:$("#tolerated").value};save();show("home");};
$("#records").onchange=e=>{[...e.target.files].forEach(f=>data.records.push({name:f.name,time:stamp()}));e.target.value="";save();};
$("#scanFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$("#cameraPreview").style.backgroundImage=`linear-gradient(#0004,#0004),url("${url}")`;$("#cameraPreview").querySelector("b").textContent=f.name;};
$("#analyzeBtn").onclick=analyze;$("#addReaction").onclick=()=>$("#reactionDialog").showModal();$("#saveReaction").onclick=()=>{const n=$("#reactionNote").value.trim();if(!n)return;data.reactions.push({note:n,severity:+$("#severity").value,time:stamp()});$("#reactionNote").value="";save();};
$("#sendBtn").onclick=send;$("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});$("#clearChat").onclick=()=>{data.chat=[];save();};
$("#micBtn").onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Speech-to-text is not supported in this browser.");return;}const r=new SR();r.lang="en-US";r.onresult=e=>$("#chatInput").value=e.results[0][0].transcript;r.start();};
$("#exportBtn").onclick=exportData;$("#eraseBtn").onclick=()=>{if(confirm("Erase all Honeycomb prototype data from this browser?")){localStorage.removeItem(KEY);location.reload();}};
if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
