
const KEY = "honeycombV2";
const OLD_KEY = "honeycombPrototypeV1";
const MODES = ["Auto","Label","Food","Product","Cosmetic","Fabric","Plant","Flare-up"];
const BRAIN_API_BASE = String((window.HONEYCOMB_CONFIG && window.HONEYCOMB_CONFIG.apiBase) || "").replace(/\/+$/,"");
const SESSION_KEY = "honeycombSessionId";

const PRODUCT_SOURCES = [
  {name:"Open Food Facts", base:"https://world.openfoodfacts.org"},
  {name:"Open Beauty Facts", base:"https://world.openbeautyfacts.org"},
  {name:"Open Products Facts", base:"https://world.openproductsfacts.org"}
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s="") => String(s).replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const list = (v="") => String(v).split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
const now = () => new Date().toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getSessionId(){
  let id = localStorage.getItem(SESSION_KEY);
  if(!id){
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("hc-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem(SESSION_KEY,id);
  }
  return id;
}

async function sourceToDataUrl(source){
  if(!source) return "";
  if(source.startsWith("data:image/")) return source;
  try{
    const response = await fetch(source);
    const blob = await response.blob();
    return await new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }catch(e){
    return "";
  }
}

async function callBrainScan(photo){
  if(!BRAIN_API_BASE) return null;
  const imageDataUrl = await sourceToDataUrl(photo);
  if(!imageDataUrl) return null;

  const response = await fetch(BRAIN_API_BASE + "/api/analyze-scan",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Honeycomb-Session":getSessionId()
    },
    body:JSON.stringify({
      imageDataUrl,
      mode:activeMode,
      profile:state.profile,
      recentScans:(state.scans || []).slice(-10),
      recentReactions:(state.reactions || []).slice(-10),
      recentChat:(state.chat || []).slice(-12)
    })
  });

  if(!response.ok){
    let message = "Honeycomb Brain could not analyze this scan.";
    try{
      const err = await response.json();
      if(err && err.error) message = err.error;
    }catch(e){}
    throw new Error(message);
  }
  return await response.json();
}

async function callBrainFollowup(question){
  if(!BRAIN_API_BASE || !pendingScan) return null;
  const imageDataUrl = pendingScan.photo ? await sourceToDataUrl(pendingScan.photo) : "";

  const response = await fetch(BRAIN_API_BASE + "/api/chat-scan",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "X-Honeycomb-Session":getSessionId()
    },
    body:JSON.stringify({
      question,
      imageDataUrl,
      mode:pendingScan.mode || activeMode,
      scanContext:{
        productName:pendingScan.productName || "",
        productBrand:pendingScan.productBrand || "",
        ingredients:pendingScan.ingredients || "",
        summary:pendingScan.summary || "",
        conclusion:pendingScan.signal || "",
        uncertainty:pendingScan.uncertainty || "",
        sources:pendingScan.webSources || []
      },
      profile:state.profile,
      recentScans:(state.scans || []).slice(-10),
      recentReactions:(state.reactions || []).slice(-10),
      recentChat:(state.chat || []).slice(-12)
    })
  });

  if(!response.ok){
    let message = "Honey could not answer that follow-up.";
    try{
      const err = await response.json();
      if(err && err.error) message = err.error;
    }catch(e){}
    throw new Error(message);
  }
  return await response.json();
}

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
    try {
      const parsed = JSON.parse(current);
      parsed.scans = parsed.scans || [];
      parsed.reactions = parsed.reactions || [];
      parsed.chat = parsed.chat || [];
      parsed.records = parsed.records || [];
      return parsed;
    } catch(e){}
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
let investigationRun = 0;

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
  renderAll();
}

function saveQuietly(){
  localStorage.setItem(KEY, JSON.stringify(state));
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
  toast.timer = setTimeout(() => el.classList.remove("show"), 1700);
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
    latestPhotoUrl = "";
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
  if(latestPhotoUrl && latestPhotoUrl.startsWith("blob:")) URL.revokeObjectURL(latestPhotoUrl);
  latestPhotoUrl = URL.createObjectURL(file);
  $("#cameraFallback").classList.add("show");
  const photo = $("#cameraFallback .fallback-photo");
  if(photo) photo.style.backgroundImage = 'url("' + latestPhotoUrl + '")';
  $("#camera").style.opacity = "0";
  toast("Photo ready — tap scan");
}

function captureFrame(){
  if(latestPhotoUrl) return latestPhotoUrl;
  const video = $("#camera");
  if(!cameraReady || !video.videoWidth) return "";

  // Keep the whole visible frame so brand names at the edges do not get cropped out.
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));

  const c = document.createElement("canvas");
  c.width = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  c.getContext("2d").drawImage(video, 0, 0, vw, vh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg",0.9);
}

function setInvestigationStep(id, title, detail="", status="active"){
  const wrap = $("#investigationSteps");
  let row = wrap.querySelector('[data-step="' + id + '"]');
  if(!row){
    row = document.createElement("div");
    row.className = "investigation-step";
    row.dataset.step = id;
    row.innerHTML = '<div class="step-dot">•</div><div><strong></strong><small></small></div>';
    wrap.appendChild(row);
  }
  row.classList.remove("active","done","failed");
  row.classList.add(status);
  row.querySelector("strong").textContent = title;
  row.querySelector("small").textContent = detail;
  row.querySelector(".step-dot").textContent = status === "done" ? "✓" : status === "failed" ? "–" : "•";
}

function beginInvestigation(photo){
  pendingScan = null;
  $("#resultLayer").classList.add("open");
  $("#resultLayer").setAttribute("aria-hidden","false");
  $(".result-sheet").classList.add("busy");
  $("#investigationPanel").classList.remove("hidden");
  $("#resultContent").classList.add("hidden");
  $("#investigationSteps").innerHTML = "";
  $("#investigationTitle").textContent = "Looking at your scan…";
  $("#investigationHint").textContent = "Honeycomb is checking the image, public product databases, and what this browser remembers.";
  $("#resultModeLabel").textContent = activeMode.toUpperCase() + " · INVESTIGATING";
  setInvestigationStep("capture","Image captured","Starting analysis…","done");

  const rp = $("#resultPhoto");
  if(photo){
    rp.style.backgroundImage = 'url("' + photo + '")';
    rp.classList.remove("hidden");
  }else{
    rp.classList.add("hidden");
  }
}

function closeResult(){
  investigationRun += 1;
  $("#resultLayer").classList.remove("open");
  $("#resultLayer").setAttribute("aria-hidden","true");
  $(".result-sheet").classList.remove("busy");
}

async function fetchJson(url, timeoutMs=7000){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try{
    const response = await fetch(url, {signal:controller.signal, headers:{"Accept":"application/json"}});
    if(!response.ok) return null;
    return await response.json();
  }catch(e){
    return null;
  }finally{
    clearTimeout(timer);
  }
}

async function imageSourceToBitmap(source){
  if(!source || !window.createImageBitmap) return null;
  try{
    const response = await fetch(source);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  }catch(e){
    return null;
  }
}

async function detectBarcode(source){
  if(!source || !("BarcodeDetector" in window)) return "";
  try{
    const formats = await BarcodeDetector.getSupportedFormats();
    const preferred = ["ean_13","ean_8","upc_a","upc_e","code_128","qr_code"].filter(x => formats.includes(x));
    const detector = preferred.length ? new BarcodeDetector({formats:preferred}) : new BarcodeDetector();
    const bitmap = await imageSourceToBitmap(source);
    if(!bitmap) return "";
    const found = await detector.detect(bitmap);
    if(bitmap.close) bitmap.close();
    return found && found[0] ? String(found[0].rawValue || "").trim() : "";
  }catch(e){
    return "";
  }
}

function normalizeProduct(product, source, code=""){
  if(!product) return null;
  const productName = product.product_name || product.product_name_en || product.generic_name || "";
  const brands = product.brands || "";
  const ingredients = product.ingredients_text || product.ingredients_text_en || "";
  const barcode = String(product.code || code || "");
  if(!productName && !brands && !barcode) return null;
  return {
    code:barcode,
    name:productName || (brands ? brands + " product" : "Product " + barcode),
    brands:brands,
    ingredients:ingredients,
    image:product.image_front_url || product.image_url || "",
    sourceName:source.name,
    sourceBase:source.base,
    sourceUrl:barcode ? source.base + "/product/" + encodeURIComponent(barcode) : source.base
  };
}

async function lookupByBarcode(code){
  if(!code) return null;
  const fields = "code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,image_front_url,image_url";
  for(const source of PRODUCT_SOURCES){
    const url = source.base + "/api/v2/product/" + encodeURIComponent(code) + ".json?fields=" + fields;
    const data = await fetchJson(url);
    if(data && data.status === 1 && data.product){
      return normalizeProduct(data.product, source, code);
    }
  }
  return null;
}

const SEARCH_STOPWORDS = new Set([
  "the","and","for","with","from","this","that","your","you","new","net","wt","oz","fl","ml","made","use","directions",
  "warning","ingredients","ingredient","active","inactive","keep","out","reach","children","tube","paste","product",
  "fresh","label","scan","front","back"
]);

function extractSearchTerms(text){
  const words = String(text || "")
    .replace(/[^a-zA-Z0-9\s-]/g," ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !SEARCH_STOPWORDS.has(w.toLowerCase()));
  const unique = [];
  const seen = new Set();
  for(const w of words){
    const low = w.toLowerCase();
    if(!seen.has(low)){
      seen.add(low);
      unique.push(w);
    }
    if(unique.length >= 7) break;
  }
  return unique;
}

function scoreProduct(product, terms){
  const hay = ((product.product_name || "") + " " + (product.brands || "")).toLowerCase();
  let score = 0;
  terms.forEach((t,i) => {
    if(hay.includes(t.toLowerCase())) score += Math.max(1, 7 - i);
  });
  return score;
}

async function legacyTextSearch(source, terms){
  if(!terms.length) return null;
  const query = terms.join(" ");
  const url = source.base + "/cgi/search.pl?search_terms=" + encodeURIComponent(query) +
    "&search_simple=1&action=process&json=1&page_size=8";
  const data = await fetchJson(url, 9000);
  if(!data || !Array.isArray(data.products) || !data.products.length) return null;
  const ranked = data.products
    .map(p => ({product:p, score:scoreProduct(p, terms)}))
    .sort((a,b) => b.score - a.score);
  if(!ranked[0] || ranked[0].score < 2) return null;
  return normalizeProduct(ranked[0].product, source);
}

async function brandFallbackSearch(source, terms){
  if(!terms.length) return null;
  const fields = "code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,image_front_url,image_url";
  for(const term of terms.slice(0,3)){
    const tag = term.toLowerCase().replace(/[^a-z0-9-]/g,"");
    if(!tag) continue;
    const url = source.base + "/api/v2/search?brands_tags=" + encodeURIComponent(tag) +
      "&page=1&page_size=6&fields=" + fields;
    const data = await fetchJson(url, 7000);
    if(data && Array.isArray(data.products) && data.products.length){
      const ranked = data.products
        .map(p => ({product:p, score:scoreProduct(p, terms)}))
        .sort((a,b) => b.score - a.score);
      if(ranked[0] && ranked[0].score >= 2) return normalizeProduct(ranked[0].product, source);
    }
  }
  return null;
}

async function searchProductByText(text){
  // IMPORTANT: do not guess an exact product from fuzzy OCR text.
  // This caused unrelated products to be returned from public databases.
  // Exact barcode lookup is allowed locally. Open-ended product identification
  // belongs to Honeycomb Brain (vision + web research).
  return null;
}

async function runOCR(photo, runId){
  if(!photo || !window.Tesseract || typeof window.Tesseract.recognize !== "function") return {text:"",confidence:0};
  try{
    const result = await window.Tesseract.recognize(photo, "eng", {
      logger:(m) => {
        if(runId !== investigationRun) return;
        if(m.status === "recognizing text" && typeof m.progress === "number"){
          $("#investigationHint").textContent = "Reading visible packaging text… " + Math.round(m.progress * 100) + "%";
        }
      }
    });
    return {
      text:(result && result.data && result.data.text ? result.data.text : "").trim(),
      confidence:Number(result && result.data && result.data.confidence || 0)
    };
  }catch(e){
    return {text:"",confidence:0};
  }
}

function compareProfile(text){
  const p = state.profile;
  const hay = String(text || "").toLowerCase();
  const known = list(p.known).filter(x => hay.includes(x.toLowerCase()));
  const suspected = list(p.suspected).filter(x => hay.includes(x.toLowerCase()));
  const avoid = list(p.avoid).filter(x => hay.includes(x.toLowerCase()));
  const tolerated = list(p.tolerated).filter(x => hay.includes(x.toLowerCase()));
  return {known,suspected,avoid,tolerated};
}

function findMemoryMatches(product, text){
  const name = product && product.name ? product.name.toLowerCase() : "";
  const code = product && product.code ? String(product.code) : "";
  const terms = extractSearchTerms((product ? (product.name + " " + product.brands) : "") || text).slice(0,4).map(x => x.toLowerCase());

  const previousScans = (state.scans || []).filter(s => {
    if(code && s.productCode && String(s.productCode) === code) return true;
    const hay = ((s.productName || "") + " " + (s.text || "")).toLowerCase();
    if(name && s.productName && s.productName.toLowerCase() === name) return true;
    return terms.length >= 2 && terms.filter(t => hay.includes(t)).length >= 2;
  });

  const chatHits = (state.chat || []).filter(m => {
    const hay = String(m.text || "").toLowerCase();
    return terms.length >= 2 && terms.filter(t => hay.includes(t)).length >= 2;
  });

  if(previousScans.length || chatHits.length){
    const bits = [];
    if(previousScans.length) bits.push("You have scanned something matching this " + previousScans.length + " time" + (previousScans.length === 1 ? "" : "s") + " before.");
    if(chatHits.length) bits.push("It also appears in " + chatHits.length + " saved Honey conversation" + (chatHits.length === 1 ? "" : "s") + ".");
    return {hasMatch:true,title:"Honeycomb remembers this.",text:bits.join(" "),scanCount:previousScans.length,chatCount:chatHits.length};
  }
  return {hasMatch:false,title:"",text:"",scanCount:0,chatCount:0};
}

function resultFromBrain(payload, photo){
  const a = payload && payload.analysis ? payload.analysis : {};
  const id = a.identification || {};
  const research = a.research || {};
  const profile = a.profile_analysis || {};
  const memoryAnalysis = a.memory_analysis || {};
  const conversation = a.conversation || {};
  const visible = a.visible_person_context || {};
  const quality = a.image_quality || {};

  const conclusion = profile.conclusion || "insufficient";
  const headlineMap = {
    conflict:"Conflict found",
    closer_look:"Needs a closer look",
    no_identified_conflict:"No identified conflict",
    insufficient:"Needs a closer look"
  };
  const signalMap = {
    conflict:"PROFILE MATCH",
    closer_look:"NEEDS REVIEW",
    no_identified_conflict:"NO PROFILE MATCH",
    insufficient:"INSUFFICIENT"
  };

  const matchGroups = []
    .concat(profile.known_matches || [])
    .concat(profile.watching_matches || [])
    .concat(profile.avoid_matches || [])
    .concat(profile.tolerated_matches || []);

  const memoryBits = []
    .concat(memoryAnalysis.previous_scan_matches || [])
    .concat(memoryAnalysis.chat_matches || [])
    .concat(memoryAnalysis.reaction_matches || []);

  const visibleNotes = visible.person_visible && Array.isArray(visible.non_diagnostic_observations)
    ? visible.non_diagnostic_observations.filter(Boolean)
    : [];

  let opening = String(conversation.opening_message || "").trim();
  if(visibleNotes.length){
    opening += (opening ? " " : "") + "Visible context: " + visibleNotes.join(" ");
  }
  if(conversation.follow_up_question){
    opening += (opening ? " " : "") + conversation.follow_up_question;
  }

  const ingredients = String(research.ingredient_text || "").trim() ||
    ((research.ingredients || []).join(", "));

  return {
    id:Date.now(),
    mode:activeMode,
    text:(a.visible_text || []).join("\n").slice(0,2500),
    ocrText:(a.visible_text || []).join("\n").slice(0,2000),
    photo:photo && photo.startsWith("data:") ? photo : "",
    headline:headlineMap[conclusion] || "Needs a closer look",
    summary:String(profile.explanation || research.research_summary || conversation.opening_message || "Honeycomb completed an AI-assisted review."),
    signal:signalMap[conclusion] || "INSUFFICIENT",
    confidence:Math.max(0,Math.min(100,Number(id.confidence || 0))),
    connection:matchGroups.length ? matchGroups.join(", ") : "No direct saved-profile match",
    uncertainty:(a.limitations || []).join(" ") || quality.notes || "Product and health information may still be incomplete.",
    time:now(),
    saved:false,
    productName:String(id.product_name || ""),
    productBrand:String(id.brand || ""),
    productCode:String(id.barcode || ""),
    ingredients,
    productImage:"",
    sourceName:(payload.sources && payload.sources[0] && payload.sources[0].title) || "Web research",
    sourceUrl:(payload.sources && payload.sources[0] && payload.sources[0].url) || "",
    webSources:Array.isArray(payload.sources) ? payload.sources : [],
    memory:memoryBits.length ? {
      hasMatch:true,
      title:"Honeycomb remembers related context.",
      text:String(memoryAnalysis.summary || memoryBits.join(" ")),
      scanCount:(memoryAnalysis.previous_scan_matches || []).length,
      chatCount:(memoryAnalysis.chat_matches || []).length
    } : {hasMatch:false,title:"",text:"",scanCount:0,chatCount:0},
    aiOpeningMessage:opening,
    scanConversation:[],
    brainPowered:true
  };
}

function renderSources(result){
  const box = $("#webSources");
  const sources = Array.isArray(result.webSources) ? result.webSources.filter(s => s && s.url) : [];
  if(!sources.length){
    box.classList.add("hidden");
    $("#sourceList").innerHTML = "";
    $("#sourceCount").textContent = "";
    return;
  }
  box.classList.remove("hidden");
  $("#sourceCount").textContent = sources.length + " source" + (sources.length === 1 ? "" : "s");
  $("#sourceList").innerHTML = sources.slice(0,8).map((source,i)=>{
    let host = "";
    try{ host = new URL(source.url).hostname.replace(/^www\./,""); }catch(e){}
    return '<a class="source-item" href="' + esc(source.url) + '" target="_blank" rel="noopener">' +
      '<span class="source-num">' + (i+1) + '</span><span><strong>' + esc(source.title || host || "Source") +
      '</strong><small>' + esc(host || source.url) + '</small></span></a>';
  }).join("");
}

function makeScanResult(text="", photo="", meta={}){
  const matches = compareProfile(text);

  let headline = "Needs a closer look";
  let summary = "Honeycomb does not have enough verified information to call this a conflict or a non-conflict.";
  let signal = "UNCERTAIN";
  let confidence = text ? 42 : 26;
  let connection = "No direct profile match";
  let uncertainty = text ? "Product/source details may be incomplete" : "Not enough verified product information";

  if(matches.known.length || matches.avoid.length){
    const direct = Array.from(new Set(matches.known.concat(matches.avoid)));
    headline = "Conflict found";
    signal = "PROFILE MATCH";
    summary = "Honeycomb found " + direct.join(", ") + " in the information it could read or verify, and that overlaps with your known or personal-avoid profile.";
    confidence = Math.min(94, 78 + direct.length * 5);
    connection = direct.join(", ");
    uncertainty = "This confirms a saved-profile match, not the medical cause of any symptom.";
  }else if(matches.suspected.length){
    headline = "Needs a closer look";
    signal = "WATCHING";
    summary = "This includes " + matches.suspected.join(", ") + ", which you currently track as something to investigate.";
    confidence = Math.min(84, 62 + matches.suspected.length * 6);
    connection = matches.suspected.join(", ");
    uncertainty = "A suspected trigger is not a confirmed allergy.";
  }else if(matches.tolerated.length){
    headline = "No identified conflict";
    signal = "PRIOR TOLERANCE";
    summary = "This overlaps with something on your Works for Me list: " + matches.tolerated.join(", ") + ".";
    confidence = Math.min(76, 54 + matches.tolerated.length * 6);
    connection = matches.tolerated.join(", ");
    uncertainty = "Past tolerance does not guarantee future tolerance.";
  }else if(text){
    // Text alone is not enough to clear a product. Keep the result cautious until
    // Honeycomb verifies an exact product and, ideally, an ingredient list.
    headline = "Needs a closer look";
    signal = "UNVERIFIED";
    summary = "Honeycomb did not find a direct match in your saved profile, but the exact product or ingredient list is not fully verified yet.";
    confidence = 40;
    uncertainty = "Readable text without an exact product match is not enough to conclude there is no conflict.";
  }

  if(meta.product){
    const p = meta.product;
    if(!matches.known.length && !matches.avoid.length && !matches.suspected.length && !matches.tolerated.length){
      if(p.ingredients){
        headline = "No identified conflict";
        signal = "NO PROFILE MATCH";
        summary = "I identified " + p.name + (p.brands ? " by " + p.brands : "") + " and compared the listed ingredients with your current Hive. I did not find a saved-profile conflict.";
        uncertainty = "No saved-profile match does not guarantee that the product will be safe for you.";
      }else{
        headline = "Needs a closer look";
        signal = "PRODUCT FOUND";
        summary = "I found a probable match for " + p.name + ", but the public record did not include enough ingredient information to complete the comparison.";
        uncertainty = "The product identity is stronger than the ingredient evidence.";
      }
    }else{
      summary = "For " + p.name + ": " + summary;
    }
    confidence = Math.max(confidence, p.ingredients ? 74 : 62);
  }else if(meta.ocrText){
    summary = "I could read some packaging text, but I could not verify the exact product. I am not going to guess. Try the barcode or back label, or connect Honeycomb Brain for vision + web research.";
    confidence = Math.max(confidence, Math.min(58, 30 + Math.round((meta.ocrConfidence || 0) / 5)));
    uncertainty = "The text came from OCR and the exact product was not independently verified.";
    connection = "No verified profile connection";
  }else if(!text){
    summary = activeMode === "Flare-up"
      ? "I captured the image for your history, but this prototype cannot diagnose a skin condition from a photo."
      : "I could not identify this reliably from the current image. Try showing the barcode or ingredient panel, or use the text button.";
    confidence = 18;
    uncertainty = activeMode === "Flare-up"
      ? "Image-based diagnosis is intentionally not provided."
      : "No barcode, readable text, or verified product match was available.";
  }

  return {
    id:Date.now(),
    mode:activeMode,
    text:String(text || "").slice(0,2500),
    ocrText:String(meta.ocrText || "").slice(0,2000),
    photo:photo && photo.startsWith("data:") ? photo : "",
    headline,
    summary,
    signal,
    confidence,
    connection,
    uncertainty,
    time:now(),
    saved:false,
    productName:meta.product ? meta.product.name : "",
    productBrand:meta.product ? meta.product.brands : "",
    productCode:meta.product ? meta.product.code : "",
    ingredients:meta.product ? meta.product.ingredients : "",
    productImage:meta.product ? meta.product.image : "",
    sourceName:meta.product ? meta.product.sourceName : "",
    sourceUrl:meta.product ? meta.product.sourceUrl : "",
    memory:meta.memory || null,
    scanConversation:[]
  };
}

function renderProductCard(result){
  const card = $("#productCard");
  if(!result.productName){
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  $("#productName").textContent = result.productName;
  $("#productBrand").textContent = result.productBrand || result.sourceName || "";
  $("#productIngredients").textContent = result.ingredients
    ? "Ingredients: " + result.ingredients
    : "Ingredient list was not available from the matched public product record.";
  const img = $("#productImage");
  img.style.backgroundImage = result.productImage ? 'url("' + result.productImage + '")' : "none";
  const link = $("#productSourceLink");
  link.textContent = result.sourceName ? "View " + result.sourceName + " source ↗" : "View product source ↗";
  link.href = result.sourceUrl || "#";
  link.classList.toggle("hidden", !result.sourceUrl);
}

function renderMemory(result){
  const box = $("#memoryNotice");
  if(result.memory && result.memory.hasMatch){
    box.classList.remove("hidden");
    $("#memoryTitle").textContent = result.memory.title;
    $("#memoryText").textContent = result.memory.text;
  }else{
    box.classList.add("hidden");
  }
}

function scanIntroMessage(result){
  if(result.aiOpeningMessage) return result.aiOpeningMessage;
  const parts = [];
  if(result.productName){
    parts.push("I found a probable match for " + result.productName + (result.productBrand ? " by " + result.productBrand : "") + ".");
    if(result.ingredients) parts.push("I pulled a listed ingredient record and compared it with your Hive.");
    else parts.push("The product record did not include a complete ingredient list, so I’m keeping the result cautious.");
  }else if(result.ocrText){
    parts.push("I could read some text, but I could not verify the exact product, so I am not going to guess.");
  }else{
    parts.push("I could not reliably identify the product from this image yet.");
  }
  if(result.memory && result.memory.hasMatch) parts.push(result.memory.text);
  if(activeMode === "Flare-up"){
    parts.push("I can help document what you’re noticing and compare it with recent exposures, but I can’t diagnose the skin condition from the photo.");
  }else{
    parts.push("Have you already used this, or are you checking before use?");
  }
  return parts.join(" ");
}

function renderScanConversation(){
  const wrap = $("#scanConversationMessages");
  const msgs = pendingScan && pendingScan.scanConversation ? pendingScan.scanConversation : [];
  wrap.innerHTML = msgs.map(m => '<div class="scan-msg ' + (m.role === "user" ? "user" : "honey") + (m.thinking ? " thinking" : "") + '">' + esc(m.text) + '</div>').join("");
  wrap.scrollTop = wrap.scrollHeight;
}

function rememberScan(result){
  if(!result || result.saved) return;
  const stored = Object.assign({}, result, {photo:"", scanConversation:result.scanConversation || [], saved:true});
  result.saved = true;
  state.scans.push(stored);
  if(state.scans.length > 80) state.scans = state.scans.slice(-80);
  saveQuietly();
  renderHive();
  $("#saveScanBtn").textContent = "Saved";
}

function openResult(result){
  pendingScan = result;
  $(".result-sheet").classList.remove("busy");
  $("#investigationPanel").classList.add("hidden");
  $("#resultContent").classList.remove("hidden");
  $("#resultModeLabel").textContent = result.mode.toUpperCase() + " · SCAN RESULT";
  $("#resultHeadline").textContent = result.headline;
  $("#resultSummary").textContent = result.summary;
  $("#resultSignalText").textContent = result.signal;
  $("#resultConfidence").textContent = result.confidence + "%";
  $("#signalFill").style.width = result.confidence + "%";
  $("#whyRecognized").textContent = result.productName || (result.ocrText ? "Packaging text" : (result.mode === "Auto" ? "Automatic scan" : result.mode));
  $("#whyConnection").textContent = result.connection;
  $("#whyUncertainty").textContent = result.uncertainty;

  const rp = $("#resultPhoto");
  if(result.photo){
    rp.style.backgroundImage = 'url("' + result.photo + '")';
    rp.classList.remove("hidden");
  }else{
    rp.classList.add("hidden");
  }

  renderProductCard(result);
  renderSources(result);
  renderMemory(result);
  $("#whyFlaggedPanel").classList.remove("open");
  $("#saveScanBtn").textContent = result.saved ? "Saved" : "Save";

  result.scanConversation = result.scanConversation || [];
  if(!result.scanConversation.length){
    result.scanConversation.push({role:"ai",text:scanIntroMessage(result)});
  }
  renderScanConversation();

  $("#resultLayer").classList.add("open");
  $("#resultLayer").setAttribute("aria-hidden","false");
  rememberScan(result);
}

async function investigateScan(photo, manualText=""){
  const myRun = ++investigationRun;
  beginInvestigation(photo);

  if(BRAIN_API_BASE && photo && !manualText){
    setInvestigationStep("brain","Honey Vision + web research","Identifying the item, searching the web, checking sources, and comparing your Hive…","active");
    try{
      const brainPayload = await callBrainScan(photo);
      if(myRun !== investigationRun) return;
      if(brainPayload && brainPayload.analysis){
        setInvestigationStep("brain","Honeycomb Brain finished","Vision, web research, Hive, and memory analysis complete.","done");
        await sleep(180);
        if(myRun !== investigationRun) return;
        openResult(resultFromBrain(brainPayload,photo));
        return;
      }
      setInvestigationStep("brain","AI analysis unavailable","Falling back to on-device barcode/OCR tools.","failed");
    }catch(error){
      if(myRun !== investigationRun) return;
      setInvestigationStep("brain","AI analysis unavailable",String(error.message || "Using browser fallback."),"failed");
      await sleep(160);
    }
  }

  if(!BRAIN_API_BASE){
    setInvestigationStep("brain","Honeycomb Brain is not connected yet","This preview can use barcode + OCR only. Vision + real web research turns on after the secure backend is deployed.","failed");
  }

  const productCapable = ["Auto","Label","Food","Product","Cosmetic"].includes(activeMode);
  let barcode = "";
  let product = null;
  let ocrText = String(manualText || "").trim();
  let ocrConfidence = manualText ? 100 : 0;

  if(productCapable && photo && !manualText){
    setInvestigationStep("barcode","Looking for a barcode","Fastest route to an exact product record…","active");
    barcode = await detectBarcode(photo);
    if(myRun !== investigationRun) return;
    if(barcode){
      setInvestigationStep("barcode","Barcode found",barcode,"done");
      setInvestigationStep("database","Checking public product databases","Looking for an exact barcode match…","active");
      product = await lookupByBarcode(barcode);
      if(myRun !== investigationRun) return;
      setInvestigationStep("database",
        product ? "Product record found" : "No barcode record found",
        product ? (product.name + " · " + product.sourceName) : "Trying visible packaging text next.",
        product ? "done" : "failed"
      );
    }else{
      setInvestigationStep("barcode","No barcode detected","Trying text on the package instead.","failed");
    }
  }

  if(!ocrText && photo && (!product || !product.ingredients)){
    setInvestigationStep("ocr","Reading visible packaging text","OCR can take several seconds on the first scan…","active");
    const ocr = await runOCR(photo, myRun);
    if(myRun !== investigationRun) return;
    ocrText = ocr.text;
    ocrConfidence = ocr.confidence;
    if(ocrText){
      const preview = ocrText.replace(/\s+/g," ").slice(0,110);
      setInvestigationStep("ocr","Packaging text read",preview + (ocrText.length > 110 ? "…" : ""),"done");
    }else{
      setInvestigationStep("ocr","Text was too blurry to read","A closer photo of the front, back, or barcode may work better.","failed");
    }
  }else if(manualText){
    setInvestigationStep("ocr","Using the text you provided",manualText.slice(0,120),"done");
  }

  if(productCapable && !product && ocrText){
    setInvestigationStep("web","Searching product sources","Checking food, beauty, and general product databases…","active");
    product = await searchProductByText(ocrText);
    if(myRun !== investigationRun) return;
    setInvestigationStep("web",
      product ? "Exact product record found" : "No exact product match",
      product ? (product.name + " · " + product.sourceName) : "I will not guess from fuzzy OCR. Vision + web research requires Honeycomb Brain.",
      product ? "done" : "failed"
    );
  }

  const analysisText = [
    manualText,
    ocrText,
    product ? product.name : "",
    product ? product.brands : "",
    product ? product.ingredients : ""
  ].filter(Boolean).join("\n");

  setInvestigationStep("hive","Checking your Hive","Known allergies, Watching, personal avoids, and tolerated history…","active");
  await sleep(260);
  if(myRun !== investigationRun) return;

  const memory = findMemoryMatches(product, analysisText);
  setInvestigationStep("hive","Hive comparison complete",
    memory.hasMatch ? memory.text : "No earlier matching scan or Honey conversation was found.",
    "done"
  );

  await sleep(180);
  if(myRun !== investigationRun) return;

  const result = makeScanResult(analysisText, photo, {product,ocrText,ocrConfidence,memory});
  openResult(result);
}

function savePendingScan(){
  if(!pendingScan) return;
  if(!pendingScan.saved) rememberScan(pendingScan);
  $("#saveScanBtn").textContent = "Saved";
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
      const title = s.productName || s.headline || "Saved scan";
      return '<article class="history-card"><div class="history-icon">' + icon + '</div><div><h4>' + esc(title) + '</h4><p>' + esc(s.summary || "") + '</p></div><time>' + esc(s.time || "") + '</time></article>';
    }).join("");
  }else{
    $("#recentScans").innerHTML = '<div class="empty-state">Your scans will build your exposure history here automatically on this device.</div>';
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

  const scanList = scans.length ? '<ul>' + scans.map(s => '<li><b>' + esc(s.productName || s.headline) + '</b> — ' + esc(s.summary) + ' <small>(' + s.confidence + '% evidence, ' + esc(s.time) + ')</small></li>').join("") + '</ul>' : '<p>No saved scans.</p>';
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
    return last ? "Your latest scan was “" + (last.productName || last.headline) + "” with " + last.confidence + "% evidence confidence. " + last.summary + " The main uncertainty was: " + last.uncertainty : "You do not have a saved scan yet.";
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
  return "I can use your Honeycomb profile, scan history, and reaction journal to organize context. A production version would add a secure vision/search backend for broader web research and cited health information.";
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

function scanFollowupReply(q){
  const low = q.toLowerCase();
  const r = pendingScan;
  if(!r) return "I lost the scan context. Try scanning the item again.";

  if(/\b(yes|used|already|this morning|today|yesterday|tried)\b/.test(low)){
    return "Got it. I’ll keep that usage connected to this scan. If you noticed irritation or another reaction, tell me what happened and I can help you log the timing and exposure. I can’t determine the medical cause from the photo alone.";
  }
  if(low.includes("rash") || low.includes("irritat") || low.includes("burn") || low.includes("itch")){
    return "I can document what you’re noticing and compare it with recent exposures and this product. I can’t diagnose a rash or say this product caused it from the image alone. If you want, use “Log reaction” and include when it started and what you noticed.";
  }
  if(low.includes("ingredient")){
    return r.ingredients
      ? "The public product record lists: " + r.ingredients.slice(0,850) + (r.ingredients.length > 850 ? "…" : "")
      : "The matched record did not include a complete ingredient list. A clear photo of the ingredient panel may give Honeycomb more to compare.";
  }
  if(low.includes("before") || low.includes("scan") || low.includes("remember")){
    return r.memory && r.memory.hasMatch ? r.memory.text : "I did not find a matching earlier scan or Honey conversation on this browser.";
  }
  if(low.includes("safe") || low.includes("can i use") || low.includes("okay to use")){
    if(r.signal === "PROFILE MATCH"){
      return "Your saved profile has a direct match with information from this product, so Honeycomb is treating it as a conflict. Verify the label/source and follow the allergy or avoidance plan you use with your clinician. I would not treat this result as a medical diagnosis.";
    }
    return "I did not identify a saved-profile conflict, but that is not the same as proving the product is safe for you. Ingredient records can be incomplete and reactions can have causes outside your current Hive.";
  }
  return "I’m keeping this product, its source, your Hive comparison, and this conversation together. You can ask me about the ingredient list, whether you’ve scanned it before, or tell me what happened after you used it.";
}

async function sendScanFollowup(){
  const input = $("#scanFollowupInput");
  const q = String(input.value || "").trim();
  if(!q || !pendingScan) return;

  pendingScan.scanConversation = pendingScan.scanConversation || [];
  pendingScan.scanConversation.push({role:"user",text:q});
  input.value = "";

  if(BRAIN_API_BASE){
    const thinking = {role:"ai",text:"Honey is checking the scan context and sources…",thinking:true};
    pendingScan.scanConversation.push(thinking);
    renderScanConversation();

    try{
      const payload = await callBrainFollowup(q);
      const idx = pendingScan.scanConversation.indexOf(thinking);
      if(idx >= 0) pendingScan.scanConversation.splice(idx,1);
      const reply = payload && payload.reply ? payload.reply : scanFollowupReply(q);
      pendingScan.scanConversation.push({role:"ai",text:reply});

      if(payload && Array.isArray(payload.sources) && payload.sources.length){
        const existing = pendingScan.webSources || [];
        const seen = new Set(existing.map(s => s.url));
        payload.sources.forEach(s => { if(s && s.url && !seen.has(s.url)){ existing.push(s); seen.add(s.url); } });
        pendingScan.webSources = existing.slice(0,12);
        renderSources(pendingScan);
      }

      state.chat.push({role:"user",text:"Scan follow-up about " + (pendingScan.productName || pendingScan.mode) + ": " + q,time:now()});
      state.chat.push({role:"ai",text:reply,time:now()});
    }catch(error){
      const idx = pendingScan.scanConversation.indexOf(thinking);
      if(idx >= 0) pendingScan.scanConversation.splice(idx,1);
      const reply = scanFollowupReply(q);
      pendingScan.scanConversation.push({role:"ai",text:reply});
      pendingScan.scanConversation.push({role:"ai",text:"The live Honeycomb Brain connection was unavailable, so I answered using the local scan context."});
      state.chat.push({role:"user",text:"Scan follow-up about " + (pendingScan.productName || pendingScan.mode) + ": " + q,time:now()});
      state.chat.push({role:"ai",text:reply,time:now()});
    }
  }else{
    const reply = scanFollowupReply(q);
    pendingScan.scanConversation.push({role:"ai",text:reply});
    state.chat.push({role:"user",text:"Scan follow-up about " + (pendingScan.productName || pendingScan.mode) + ": " + q,time:now()});
    state.chat.push({role:"ai",text:reply,time:now()});
  }

  renderScanConversation();
  const stored = state.scans.find(s => s.id === pendingScan.id);
  if(stored){
    stored.scanConversation = pendingScan.scanConversation.slice();
    stored.webSources = (pendingScan.webSources || []).slice();
  }
  saveQuietly();
  renderChat();
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
$("#captureBtn").onclick = () => investigateScan(captureFrame());
$("#textScanBtn").onclick = () => $("#textScanDialog").showModal();
$("#analyzeTextBtn").onclick = () => {
  const text = ($("#scanTextInput").value || "").trim();
  if(!text) return;
  $("#scanTextInput").value = "";
  investigateScan(captureFrame(), text);
};

// Result sheet + inline Honey
$("#closeResultBtn").onclick = closeResult;
$("#resultScrim").onclick = closeResult;
$("#whyFlaggedBtn").onclick = () => $("#whyFlaggedPanel").classList.toggle("open");
$("#saveScanBtn").onclick = savePendingScan;
$("#askHoneyBtn").onclick = () => {
  $("#scanFollowupInput").focus();
  $("#scanFollowupInput").scrollIntoView({behavior:"smooth",block:"center"});
};
$("#scanFollowupSend").onclick = sendScanFollowup;
$("#scanFollowupInput").addEventListener("keydown", e => {
  if(e.key === "Enter"){
    e.preventDefault();
    sendScanFollowup();
  }
});
$("#logReactionFromScanBtn").onclick = () => {
  const exposure = pendingScan ? (pendingScan.productName || pendingScan.text.slice(0,80) || pendingScan.mode) : "";
  openReaction(exposure);
};

// Reactions
$("#hiveAddReaction").onclick = () => openReaction();
$("#addReactionBtn").onclick = () => openReaction();
$("#severityInput").oninput = e => $("#severityValue").textContent = e.target.value;
$("#saveReactionBtn").onclick = saveReaction;

// Main Honey chat
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
    // The /v2/ preview should always show the newest build while we iterate.
    if(location.pathname.includes("/v2/")){
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }else{
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }
}
boot();
