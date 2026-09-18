const camera = document.getElementById("camera");
const fallback = document.getElementById("photoFallback");
const fallbackUpload = document.getElementById("fallbackUpload");
const photoUpload = document.getElementById("photoUpload");
const captureButton = document.getElementById("captureButton");
const flashButton = document.getElementById("flashButton");
const resultSheet = document.getElementById("resultSheet");
const closeSheet = document.getElementById("closeSheet");
const sheetScrim = document.getElementById("sheetScrim");
const whyButton = document.getElementById("whyButton");
const whyPanel = document.getElementById("whyPanel");
const recognizedText = document.getElementById("recognizedText");
const resultSubject = document.getElementById("resultSubject");
const resultReason = document.getElementById("resultReason");
const evidencePercent = document.getElementById("evidencePercent");
const evidenceFill = document.getElementById("evidenceFill");
const statusToast = document.getElementById("statusToast");
const snapshotCanvas = document.getElementById("snapshotCanvas");
const scanView = document.getElementById("scanView");
const placeholderView = document.getElementById("placeholderView");
const placeholderTitle = document.getElementById("placeholderTitle");
const placeholderText = document.getElementById("placeholderText");
const backToScan = document.getElementById("backToScan");

let activeMode = "Auto";
let stream = null;
let cameraStarted = false;

function toast(message) {
  statusToast.textContent = message;
  statusToast.classList.add("show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => statusToast.classList.remove("show"), 1600);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    fallback.classList.add("show");
    toast("Camera API unavailable — upload works");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    camera.srcObject = stream;
    await camera.play();
    cameraStarted = true;
    fallback.classList.remove("show");
    toast("Camera ready");
  } catch (err) {
    fallback.classList.add("show");
    toast("Camera permission needed");
  }
}

function showUploadedPhoto(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  fallback.style.backgroundImage = `linear-gradient(rgba(10,7,4,.12),rgba(10,7,4,.18)),url("${url}")`;
  fallback.classList.add("show");
  camera.style.opacity = "0";
  toast("Photo ready");
}

function captureFrame() {
  if (!cameraStarted || !camera.videoWidth) return null;
  snapshotCanvas.width = camera.videoWidth;
  snapshotCanvas.height = camera.videoHeight;
  const ctx = snapshotCanvas.getContext("2d");
  ctx.drawImage(camera, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  return snapshotCanvas.toDataURL("image/jpeg", .9);
}

function openDemoResult() {
  const demoByMode = {
    "Auto": ["Scene recognized", "Honeycomb is deciding which analysis path fits this scan.", 64],
    "Label": ["Ingredient label recognized", "The next version will extract ingredient text and compare it with your Hive.", 76],
    "Food": ["Food scan recognized", "Food recognition can suggest possibilities, but ingredients still need verification.", 48],
    "Product": ["Product scan recognized", "The next version can connect product identity, ingredient data, and your Hive.", 68],
    "Plant": ["Nature scan recognized", "Species identification would need a verified source before exposure guidance.", 44],
    "Fabric": ["Material scan recognized", "A fabric-label workflow could extract material names and compare them with your history.", 60],
    "Flare-up": ["Reaction photo captured", "Honeycomb should document what you see and connect it with recent exposures — not diagnose the skin condition.", 52]
  };

  const [subject, reason, confidence] = demoByMode[activeMode] || demoByMode.Auto;

  resultSubject.textContent = subject;
  resultReason.textContent = reason;
  recognizedText.textContent = activeMode;
  evidencePercent.textContent = `${confidence}%`;
  evidenceFill.style.width = `${confidence}%`;

  resultSheet.classList.add("open");
  resultSheet.setAttribute("aria-hidden", "false");
}

function closeResult() {
  resultSheet.classList.remove("open");
  resultSheet.setAttribute("aria-hidden", "true");
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    activeMode = button.dataset.mode;
    toast(`${activeMode} mode`);
  });
});

[fallbackUpload, photoUpload].forEach(input => {
  input.addEventListener("change", event => {
    const file = event.target.files?.[0];
    showUploadedPhoto(file);
  });
});

captureButton.addEventListener("click", () => {
  captureFrame();
  toast("Scanning…");
  window.setTimeout(openDemoResult, 520);
});

flashButton.addEventListener("click", () => {
  toast(cameraStarted ? "Live camera active" : "Upload mode active");
});

closeSheet.addEventListener("click", closeResult);
sheetScrim.addEventListener("click", closeResult);

whyButton.addEventListener("click", () => {
  whyPanel.classList.toggle("open");
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const screen = button.dataset.screen;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b === button));

    if (screen === "scan") {
      placeholderView.classList.remove("show");
      scanView.style.display = "block";
      return;
    }

    const copy = {
      hive: ["Hive comes next.", "Known allergies, Watching, Works for Me, Reactions, and Patterns will live here."],
      honey: ["Meet Honey ✨", "The contextual AI assistant will support text, voice, and camera questions."],
      you: ["You, without the clutter.", "Profile, records, privacy, settings, export, and the Appointment Snapshot will live here."]
    };

    placeholderTitle.textContent = copy[screen][0];
    placeholderText.textContent = copy[screen][1];
    scanView.style.display = "none";
    placeholderView.classList.add("show");
  });
});

backToScan.addEventListener("click", () => {
  placeholderView.classList.remove("show");
  scanView.style.display = "block";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.screen === "scan"));
});

document.getElementById("profileButton").addEventListener("click", () => {
  placeholderTitle.textContent = "You, without the clutter.";
  placeholderText.textContent = "Profile, records, privacy, settings, export, and the Appointment Snapshot will live here.";
  scanView.style.display = "none";
  placeholderView.classList.add("show");
});

startCamera();