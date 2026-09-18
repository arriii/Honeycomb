
const KEY = "honeycombV2";
const OLD_KEY = "honeycombPrototypeV1";
const MODES = ["Auto","Label","Food","Product","Cosmetic","Fabric","Plant","Flare-up"];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s="") => String(s).replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const list = (v="") => String(v).split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
const now = () => new Date().toLocaleString([], {dateStyle:"medium", timeStyle:"short"});

function defaultState(){
  return {
    onboarded:false,
    account:{name:"",email:"",watchFor:[]},
    profile:{synopsis:"",known:"",suspected:"",avoid:"",tolerated:""},
    records:[],
    scans:[],
    reactions:[],
    chat:[{role:"ai",text:"Hi — I’m Honey. I can help organize what Honeycomb remembers, explain scan results, and prepare questions for an appointment.",time:now()}]
  };
}

function migrate(){
  const current = localStorage.getItem(KEY);
  if(current){
    try { return JSON.parse(current); } catch(e){}
  }
  const old = localStorage.getItem(OLD_KEY);
  if(!old) return defaultState();
  try{
    const o = JSON.parse(old);
    const n = defaultState();
    n.onboarded = !!(o.account && o.account.name);
    n.account.name = (o.account && o.account.name) || "";
    n.account.email = (o.account && o.account.email) || "";
    n.profile.synopsis = (o.profile && o.profile.synopsis) || "";
    n.profile.known = (o.profile && o.profile.known) || "";
    n.profile.suspected = (o.profile && o.profile.suspected) || "";
    n.profile.avoid = (o.profile && o.profile.avoid) || "";
    n.profile.tolerated = (o.profile && o.profile.tolerated) || "";
    n.records = o.records || [];
    n.scans = o.scans || [];
    n.reactions = o.reactions || [];
    n.chat = (o.chat && o.chat.length) ? o.chat : n.chat;
    return n;
  }catch(e){ return defaultState(); }
}

let state = migrate();
let selectedWatch = new Set((state.account && state.account.watchFor) || []);
let activeMode = "Auto";
let stream = null;
let cameraReady = false;
let latestPhotoUrl = "";
let pendingScan = null;

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
  renderAll();
}

function showOnboardingStep(id){
  $$(".onboarding-step").forEach(el => el.classList.toggle("active", el.id === id));
}

function initOnboarding(){
  if(state.onboarded){
    $("#onboarding").classList.add("hidden");
    $("#app").classList.remove("hidden");
  }else{
    $("#onboarding").classList.remove("hidden");
    $("#app").classList.add("hidden");
    showOnboardingStep("welcomeStep");
  }
}

function finishOnboarding(){
  state.account.name = ($("#onboardName").value || "").trim() || "Honeycomb User";
  state.account.watchFor = Array.from(selectedWatch);
  state.profile.known = ($("#onboardKnown").value || "").trim();
  state.profile.suspected = ($("#onboardSuspected").value || "").trim();
  state.onboarded = true;
  save();
  $("#onboarding").classList.add("hidden");
  $("#app").classList.remove("hidden");
  showScreen("scanScreen");
  startCamera();
}

function toast(msg){
  const el = $("#cameraToast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1500);
}

async function startCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    $("#cameraFallback").classList.add("show");
    toast("Upload mode available");
    return;
  }
  try{
    if(stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},
      audio:false
    });
    $("#camera").srcObject = stream;
    await $("#camera").play();
    cameraReady = true;
    $("#cameraFallback").classList.remove("show");
    $("#camera").style.opacity = "1";
    toast("Camera ready");
  }catch(e){
    cameraReady = false;
    $("#cameraFallback").classList.add("show");
    toast("Camera permission needed");
  }
}

function showUploaded(file){
  if(!file) return;
  if(latestPhotoUrl) URL.revokeObjectURL(latestPhotoUrl);
  latestPhotoUrl = URL.createObjectURL(file);
  $("#cameraFallback").classList.add("show");
  const photo = $("#cameraFallback .fallback-photo");
  if(photo) photo.style.backgroundImage = 'url("' + latestPhotoUrl + '")';
  $("#camera").style.opacity = "0";
  toast("Photo ready");
}

function captureFrame(){
  if(latestPhotoUrl) return latestPhotoUrl;
  if(!cameraReady || !$("#camera").videoWidth) return "";
  const c = document.createElement("canvas");
  c.width = $("#camera").videoWidth;
  c.height = $("#camera").videoHeight;
  c.getContext("2d").drawImage($("#camera"),0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",0.86);
}

function makeScanResult(text="", photo=""){
  const p = state.profile;
  const hay = text.toLowerCase();
  const known = list(p.known).filter(x => hay.includes(x.toLowerCase()));
  const suspected = list(p.suspected).filter(x => hay.includes(x.toLowerCase()));
  const avoid = list(p.avoid).filter(x => hay.includes(x.toLowerCase()));
  const tolerated = list(p.tolerated).filter(x => hay.includes(x.toLowerCase()));

  let headline = "Needs a closer look";
  let summary = "Honeycomb does not have enough verified information to call this a conflict or a non-conflict.";
  let signal = "UNCERTAIN";
  let confidence = text ? 42 : 28;
  let connection = "No direct profile match";
  let uncertainty = text ? "Product/source details may be incomplete" : "Image understanding is not connected yet";

  if(known.length || avoid.length){
    const matches = Array.from(new Set(known.concat(avoid)));
    headline = "Conflict found";
    signal = "PROFILE MATCH";
    summary = "Honeycomb found " + matches.join(", ") + " in the text you provided and it overlaps with your known or personal-avoid profile.";
    confidence = Math.min(94, 76 + matches.length * 5);
    connection = matches.join(", ");
    uncertainty = "This confirms a profile match, not the medical cause of a reaction.";
  }else if(suspected.length){
    headline = "Needs a closer look";
    signal = "WATCHING";
    summary = "This includes " + suspected.join(", ") + ", which you currently track as something to investigate.";
    confidence = Math.min(80, 58 + suspected.length * 6);
    connection = suspected.join(", ");
    uncertainty = "A suspected trigger is not a confirmed allergy.";
  }else if(tolerated.length){
    headline = "No identified conflict";
    signal = "PRIOR TOLERANCE";
    summary = "This overlaps with something on your Works for Me list: " + tolerated.join(", ") + ".";
    confidence = Math.min(72, 50 + tolerated.length * 6);
    connection = tolerated.join(", ");
    uncertainty = "Past tolerance does not guarantee future tolerance.";
  }else if(text){
    headline = "No identified conflict";
    signal = "NO MATCH FOUND";
    summary = "Honeycomb did not find a match in your current known, watching, or avoid lists.";
    confidence = 46;
    uncertainty = "No match found does not mean the item is guaranteed safe.";
  }else{
    const demo = {
      "Auto":["Scene captured","Honeycomb would route this image to the best analysis workflow."],
      "Label":["Ingredient label captured","The next ML/OCR step will extract label text and compare it with your Hive."],
      "Food":["Food captured","Food recognition can suggest possibilities, but ingredients still need verification."],
      "Product":["Product captured","Product identity can later connect to ingredient/source research."],
      "Cosmetic":["Cosmetic captured","The next step is product identity plus ingredient/source analysis."],
      "Fabric":["Material captured","A fabric workflow can read labels and compare material information with your history."],
      "Plant":["Nature image captured","Species identification would need verification before exposure guidance."],
      "Flare-up":["Reaction photo captured","Honeycomb should document the image and connect it with recent exposures, not diagnose the skin condition."]
    };
    const pair = demo[activeMode] || demo.Auto;
    summary = pair[1];
    connection = pair[0];
    confidence = activeMode === "Label" ? 36 : 24;
  }

  return {
    id:Date.now(),
    mode:activeMode,
    text:text.slice(0,1200),
    photo:photo && photo.startsWith("data:") ? photo : "",
    headline:headline,
    summary:summary,
    signal:signal,
    confidence:confidence,
    connection:connection,
    uncertainty:uncertainty,
    time:now(),
    saved:false
  };
}

function openResult(result){
  pendingScan = result;
  $("#resultModeLabel").textContent = result.mode.toUpperCase() + " · SCAN RESULT";
  $("#resultHeadline").textContent = result.headline;
  $("#resultSummary").textContent = result.summary;
  $("#resultSignalText").textContent = result.signal;
  $("#resultConfidence").textContent = result.confidence + "%";
  $("#signalFill").style.width = result.confidence + "%";
  $("#whyRecognized").textContent = result.mode === "Auto" ? "Automatic route" : result.mode;
  $("#whyConnection").textContent = result.connection;
  $("#whyUncertainty").textContent = result.uncertainty;

  const rp = $("#resultPhoto");
  if(result.photo){
    rp.style.backgroundImage = 'url("' + result.photo + '")';
    rp.classList.remove("hidden");
  }else{
    rp.classList.add("hidden");
  }

  $("#whyFlaggedPanel").classList.remove("open");
  $("#resultLayer").classList.add("open");
  $("#resultLayer").setAttribute("aria-hidden","false");
}

function closeResult(){
  $("#resultLayer").classList.remove("open");
  $("#resultLayer").setAttribute("aria-hidden","true");
}

function savePendingScan(){
  if(!pendingScan) return;
  if(!pendingScan.saved){
    pendingScan.saved = true;
    state.scans.push(Object.assign({}, pendingScan));
    save();
  }
  toast("Saved to your Hive");
}

function showScreen(id){
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.screen === id));
  if(id === "scanScreen" && !cameraReady && !latestPhotoUrl) startCamera();
  window.scrollTo({top:0,behavior:"smooth"});
}

function chips(value){
  const items = list(value);
  if(!items.length) return '<span class="chip empty">Nothing added yet</span>';
  return items.map(x => '<span class="chip">' + esc(x) + '</span>').join("");
}

function renderPattern(){
  const card = $("#patternCard");
  if(state.reactions.length < 2){
    card.innerHTML = '<span class="eyebrow">NOT ENOUGH HISTORY YET</span><h3>Patterns need time.</h3><p>After you log multiple reactions and scans, Honeycomb can surface repeated exposures worth discussing — without claiming they caused the reaction.</p>';
    return;
  }
  const words = {};
  state.reactions.forEach(r => {
    String(r.exposure || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).forEach(w => words[w] = (words[w] || 0) + 1);
  });
  const top = Object.entries(words).sort((a,b) => b[1]-a[1])[0];
  if(top && top[1] > 1){
    card.innerHTML = '<span class="eyebrow">PATTERN WORTH INVESTIGATING</span><h3>' + esc(top[0]) + ' appears in ' + top[1] + ' reaction entries.</h3><p>This does not establish an allergy or cause. It may be useful context to bring to a clinician.</p>';
  }else{
    card.innerHTML = '<span class="eyebrow">PATTERN CHECK</span><h3>No repeated exposure stands out yet.</h3><p>Keep logging enough context around reactions so Honeycomb can compare them responsibly.</p>';
  }
}

function renderHive(){
  const p = state.profile;
  $("#knownCount").textContent = list(p.known).length;
  $("#watchingCount").textContent = list(p.suspected).length;
  $("#worksCount").textContent = list(p.tolerated).length;
  $("#knownChips").innerHTML = chips(p.known);
  $("#suspectedChips").innerHTML = chips(p.suspected);
  $("#avoidChips").innerHTML = chips(p.avoid);
  $("#toleratedChips").innerHTML = chips(p.tolerated);
  $("#hiveGreeting").textContent = state.account.name ? state.account.name + "'s personal exposure map." : "The things you know, watch, tolerate, and react to.";

  if(state.scans.length){
    $("#recentScans").innerHTML = state.scans.slice(-6).reverse().map(s => {
      let icon = "⌁";
      if(s.mode === "Food") icon = "🍽";
      if(s.mode === "Plant") icon = "🌿";
      if(s.mode === "Flare-up") icon = "✦";
      return '<article class="history-card"><div class="history-icon">' + icon + '</div><div><h4>' + esc(s.headline) + '</h4><p>' + esc(s.summary) + '</p></div><time>' + esc(s.time) + '</time></article>';
    }).join("");
  }else{
    $("#recentScans").innerHTML = '<div class="empty-state">Your saved scans will build your exposure history here.</div>';
  }

  if(state.reactions.length){
    $("#reactionTimeline").innerHTML = state.reactions.slice(-6).reverse().map(r => {
      const exposure = r.exposure ? " · Exposure: " + esc(r.exposure) : "";
      return '<article class="history-card"><div class="history-icon">✦</div><div><h4>Reaction · ' + r.severity + '/5</h4><p>' + esc(r.note) + exposure + '</p></div><time>' + esc(r.time) + '</time></article>';
    }).join("");
  }else{
    $("#reactionTimeline").innerHTML = '<div class="empty-state">Log reactions or flare-ups to build a timeline for yourself and your appointments.</div>';
  }

  renderPattern();
}

function renderProfile(){
  const p = state.profile;
  const n = state.account.name || "Honeycomb User";
  $("#profileName").value = n;
  $("#profileSynopsis").value = p.synopsis || "";
  $("#knownInput").value = p.known || "";
  $("#suspectedInput").value = p.suspected || "";
  $("#avoidInput").value = p.avoid || "";
  $("#toleratedInput").value = p.tolerated || "";
  $("#profileDisplayName").textContent = n;
  $("#profileAvatar").textContent = n.charAt(0).toUpperCase();
  $("#scanProfileBtn").textContent = n.charAt(0).toUpperCase();
  $("#profileWatchSummary").textContent = state.account.watchFor && state.account.watchFor.length ? state.account.watchFor.join(" · ") : "Your Hive is ready to personalize.";

  if(state.records.length){
    $("#recordList").innerHTML = state.records.map((r,i) => '<div class="record-item"><span>' + esc(r.name) + ' · ' + esc(r.time || r.added || "") + '</span><button data-remove-record="' + i + '">remove</button></div>').join("");
  }else{
    $("#recordList").innerHTML = '<div class="empty-state">No record references added yet.</div>';
  }

  $$("[data-remove-record]").forEach(b => b.onclick = () => {
    state.records.splice(Number(b.dataset.removeRecord),1);
    save();
  });
}

function renderChat(){
  $("#chatMessages").innerHTML = state.chat.map(m => '<div class="bubble ' + m.role + '">' + esc(m.text) + '<small>' + esc(m.time || "") + '</small></div>').join("");
  $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
}

function renderAll(){
  renderHive();
  renderProfile();
  renderChat();
}

function openReport(){
  const p = state.profile;
  const scans = state.scans.slice(-15).reverse();
  const reactions = state.reactions.slice(-15).reverse();

  const scanList = scans.length ? '<ul>' + scans.map(s => '<li><b>' + esc(s.headline) + '</b> — ' + esc(s.summary) + ' <small>(' + s.confidence + '% evidence, ' + esc(s.time) + ')</small></li>').join("") + '</ul>' : '<p>No saved scans.</p>';
  const reactionList = reactions.length ? '<ul>' + reactions.map(r => '<li><b>' + r.severity + '/5</b> — ' + esc(r.note) + (r.exposure ? ' · ' + esc(r.exposure) : '') + ' <small>(' + esc(r.time) + ')</small></li>').join("") + '</ul>' : '<p>No reaction entries.</p>';
  const recordList = state.records.length ? '<ul>' + state.records.map(r => '<li>' + esc(r.name) + ' — ' + esc(r.time || r.added || "") + '</li>').join("") + '</ul>' : '<p>None recorded.</p>';

  $("#reportBody").innerHTML =
    '<span class="eyebrow">HONEYCOMB APPOINTMENT SNAPSHOT</span>' +
    '<h1>' + esc(state.account.name || "Honeycomb User") + '</h1>' +
    '<p class="muted">Generated ' + esc(now()) + '. This is a user-organized history, not a diagnosis.</p>' +
    '<section class="report-section"><h3>Profile</h3><table class="report-table">' +
    '<tr><td>Background synopsis</td><td>' + (esc(p.synopsis) || "—") + '</td></tr>' +
    '<tr><td>Known allergies</td><td>' + (esc(p.known) || "—") + '</td></tr>' +
    '<tr><td>Watching / suspected</td><td>' + (esc(p.suspected) || "—") + '</td></tr>' +
    '<tr><td>Personal avoids</td><td>' + (esc(p.avoid) || "—") + '</td></tr>' +
    '<tr><td>Works for me / tolerated</td><td>' + (esc(p.tolerated) || "—") + '</td></tr>' +
    '</table></section>' +
    '<section class="report-section"><h3>Record references</h3>' + recordList + '</section>' +
    '<section class="report-section"><h3>Recent scans</h3>' + scanList + '</section>' +
    '<section class="report-section"><h3>Reaction timeline</h3>' + reactionList + '</section>' +
    '<section class="report-section"><h3>Questions to discuss</h3><ul><li>Which suspected triggers are worth formal evaluation?</li><li>Do any repeated exposure patterns in this history deserve testing or follow-up?</li><li>Which avoidance items are medically necessary versus precautionary?</li></ul></section>';

  $("#reportDialog").showModal();
}

function honeyReply(q){
  const low = q.toLowerCase();
  const last = state.scans[state.scans.length-1];
  const reaction = state.reactions[state.reactions.length-1];

  if(low.includes("last scan") || low.includes("flag")){
    return last ? "Your latest saved scan was “" + last.headline + "” with " + last.confidence + "% evidence confidence. " + last.summary + " The main uncertainty was: " + last.uncertainty : "You do not have a saved scan yet. Open Scan and save one, then I can reference it here.";
  }
  if(low.includes("react") || low.includes("flare")){
    return reaction ? "Your latest reaction entry was " + reaction.severity + "/5: " + reaction.note + (reaction.exposure ? " You associated it with " + reaction.exposure + "." : "") + " I can organize the history, but I cannot determine the medical cause from this alone." : "You have not logged a reaction yet.";
  }
  if(low.includes("appointment") || low.includes("report") || low.includes("snapshot")){
    openReport();
    return "I opened your Appointment Snapshot. It separates known items from suspected ones and includes your recent scan and reaction history.";
  }
  if(low.includes("known") || low.includes("allerg")){
    const k = list(state.profile.known);
    return k.length ? "Your Known Allergies section currently has " + k.length + " item" + (k.length === 1 ? "" : "s") + ". I keep those separate from Watching so a suspicion does not silently become a confirmed allergy." : "Your Known Allergies section is empty right now.";
  }
  return "I can use your Honeycomb profile, saved scans, and reaction journal to organize context. In a production version, I would also retrieve trusted, current sources and show citations and uncertainty.";
}

function sendChat(prefill){
  const input = $("#chatInput");
  const q = String(prefill || input.value || "").trim();
  if(!q) return;
  state.chat.push({role:"user",text:q,time:now()});
  state.chat.push({role:"ai",text:honeyReply(q),time:now()});
  input.value = "";
  save();
}

function openReaction(exposure=""){
  $("#reactionExposure").value = exposure;
  $("#reactionDialog").showModal();
}

function saveReaction(){
  const note = ($("#reactionNote").value || "").trim();
  if(!note) return;
  state.reactions.push({
    note:note,
    severity:Number($("#severityInput").value),
    exposure:($("#reactionExposure").value || "").trim(),
    time:now()
  });
  $("#reactionNote").value = "";
  $("#reactionExposure").value = "";
  $("#severityInput").value = "2";
  $("#severityValue").textContent = "2";
  save();
}

function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "honeycomb-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// Onboarding
$("#getStartedBtn").onclick = () => showOnboardingStep("nameStep");
$("#signinBtn").onclick = () => showOnboardingStep("nameStep");
$$("[data-back]").forEach(b => b.onclick = () => showOnboardingStep(b.dataset.back));
$("#nameNextBtn").onclick = () => {
  if(!$("#onboardName").value.trim()) $("#onboardName").value = "Honeycomb User";
  showOnboardingStep("watchStep");
};
$$(".watch-card").forEach(b => b.onclick = () => {
  const v = b.dataset.watch;
  if(selectedWatch.has(v)) selectedWatch.delete(v); else selectedWatch.add(v);
  b.classList.toggle("selected", selectedWatch.has(v));
});
$("#watchNextBtn").onclick = () => showOnboardingStep("contextStep");
$("#skipContextBtn").onclick = () => {
  $("#onboardKnown").value = "";
  $("#onboardSuspected").value = "";
  finishOnboarding();
};
$("#finishOnboardBtn").onclick = finishOnboarding;

// Navigation
$$(".nav-item").forEach(b => b.onclick = () => showScreen(b.dataset.screen));
$$("[data-open-you]").forEach(b => b.onclick = () => showScreen("youScreen"));
$("#scanProfileBtn").onclick = () => showScreen("youScreen");
$("#scanAgainBtn").onclick = () => showScreen("scanScreen");
$("#chatCameraBtn").onclick = () => showScreen("scanScreen");

// Scan controls
$("#scanModes").innerHTML = MODES.map(m => '<button class="scan-mode ' + (m === "Auto" ? "active" : "") + '" data-mode="' + m + '">' + m + '</button>').join("");
$$(".scan-mode").forEach(b => b.onclick = () => {
  $$(".scan-mode").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  activeMode = b.dataset.mode;
  toast(activeMode + " mode");
});
[$("#scanUpload"),$("#fallbackUpload")].forEach(input => input.onchange = e => showUploaded(e.target.files && e.target.files[0]));
$("#captureBtn").onclick = () => {
  const photo = captureFrame();
  toast("Scanning…");
  setTimeout(() => openResult(makeScanResult("", photo)), 450);
};
$("#textScanBtn").onclick = () => $("#textScanDialog").showModal();
$("#analyzeTextBtn").onclick = () => {
  const text = ($("#scanTextInput").value || "").trim();
  if(!text) return;
  $("#scanTextInput").value = "";
  setTimeout(() => openResult(makeScanResult(text, captureFrame())), 120);
};

// Result sheet
$("#closeResultBtn").onclick = closeResult;
$("#resultScrim").onclick = closeResult;
$("#whyFlaggedBtn").onclick = () => $("#whyFlaggedPanel").classList.toggle("open");
$("#saveScanBtn").onclick = savePendingScan;
$("#askHoneyBtn").onclick = () => {
  savePendingScan();
  const msg = "Why did you flag my last scan? It said: " + ((pendingScan && pendingScan.headline) || "Needs review") + ".";
  closeResult();
  showScreen("honeyScreen");
  sendChat(msg);
};
$("#logReactionFromScanBtn").onclick = () => {
  savePendingScan();
  const exposure = (pendingScan && pendingScan.text ? pendingScan.text.slice(0,80) : (pendingScan && pendingScan.mode) || "");
  closeResult();
  openReaction(exposure);
};

// Reactions
$("#hiveAddReaction").onclick = () => openReaction();
$("#addReactionBtn").onclick = () => openReaction();
$("#severityInput").oninput = e => $("#severityValue").textContent = e.target.value;
$("#saveReactionBtn").onclick = saveReaction;

// Chat
$("#sendChatBtn").onclick = () => sendChat();
$("#chatInput").addEventListener("keydown", e => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendChat();
  }
});
$$("#quickPrompts button").forEach(b => b.onclick = () => sendChat(b.textContent));
$("#clearChatBtn").onclick = () => { state.chat = []; save(); };
$("#micBtn").onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert("Speech-to-text is not supported in this browser."); return; }
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.onresult = e => $("#chatInput").value = e.results[0][0].transcript;
  r.start();
};

// Profile / records
$("#saveProfileBtn").onclick = () => {
  state.account.name = ($("#profileName").value || "").trim() || "Honeycomb User";
  state.profile = {
    synopsis:$("#profileSynopsis").value,
    known:$("#knownInput").value,
    suspected:$("#suspectedInput").value,
    avoid:$("#avoidInput").value,
    tolerated:$("#toleratedInput").value
  };
  save();
  showScreen("hiveScreen");
};
$("#recordInput").onchange = e => {
  Array.from(e.target.files || []).forEach(f => state.records.push({name:f.name,time:now()}));
  e.target.value = "";
  save();
};
$("#exportDataBtn").onclick = exportData;
$("#clearDataBtn").onclick = () => {
  if(confirm("Erase all Honeycomb prototype data stored in this browser?")){
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    location.reload();
  }
};

// Report
$("#appointmentBtn").onclick = openReport;
$("#appointmentTopBtn").onclick = openReport;
$("#closeReportBtn").onclick = () => $("#reportDialog").close();
$("#printReportBtn").onclick = () => window.print();

function boot(){
  initOnboarding();
  renderAll();
  if(state.onboarded){
    showScreen("scanScreen");
    startCamera();
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
boot();
