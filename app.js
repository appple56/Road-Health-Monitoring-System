/* =========================================================
   RHMS — ROAD HEALTH MONITORING SYSTEM
   Frontend v2
   ========================================================= */

/* Put your Supabase project URL + PUBLISHABLE key here. */
const SUPABASE_URL = "https://gphlolodqejrkphspucz.supabase.co";
const SUPABASE_KEY = "sb_publishable_qw-XTj_NaVBZu7Kcd1KTFQ_8K51CgDv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allReports = [];
let map = null;
let markersLayer = null;
let userLatitude = null;
let userLongitude = null;

const pageTitles = {
  dashboard: "Overview", map: "Pothole Map", gallery: "Image Gallery",
  reports: "Road Reports", report: "Report Road Problem",
  pipes: "Pipe Monitoring", visual: "Visual Inspection"
};

const $ = id => document.getElementById(id);


function getImageURL(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleanPath = raw.replace(/^\/+/, "").replace(/^pothole-images\//, "");
  return supabaseClient.storage.from("pothole-images").getPublicUrl(cleanPath).data?.publicUrl || "";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function showToast(message, type="") {
  const t = $("toast");
  t.textContent = message;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = "toast", 3000);
}

function formatDate(value) {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString("en-IN", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

function statusClass(status) {
  return String(status || "").toLowerCase().replaceAll(" ","-");
}

/* ---------------- NAVIGATION ---------------- */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-button").forEach(b => b.classList.remove("active"));

  const page = $(pageId);
  if (page) page.classList.add("active");

  const nav = document.querySelector(`.nav-button[data-page="${pageId}"]`);
  if (nav) nav.classList.add("active");

  $("pageTitle") && ($("pageTitle").textContent = pageTitles[pageId] || "RHMS");
  $("topPageTitle") && ($("topPageTitle").textContent = pageTitles[pageId] || "RHMS");
  $("sidebar")?.classList.remove("open");

  if (pageId === "map") {
    setTimeout(() => {
      initMap();
      if (map) {
        map.invalidateSize(true);
        setTimeout(() => map && map.invalidateSize(true), 250);
      }
      renderMarkers();
    }, 100);
  }
  if (pageId === "gallery") renderGallery();
  if (pageId === "reports") renderReports();
  if (pageId === "pipes") loadPipeStatus();
  if (pageId === "dashboard") {
    renderRecent();
    updateStatistics();
  }
}

document.querySelectorAll(".nav-button").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

document.querySelectorAll("[data-jump]").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.jump));
});

$("menuBtn")?.addEventListener("click", () => $("sidebar")?.classList.toggle("open"));

$("currentDate").textContent = new Date().toLocaleDateString("en-IN", {
  day:"2-digit", month:"short", year:"numeric"
});

/* ---------------- SUPABASE DATA ---------------- */

async function fetchReports() {
  const { data, error } = await supabaseClient
    .from("pothole_reports")
    .select("*")
    .order("reported_at", { ascending:false });

  if (error) {
    console.error("REPORT FETCH ERROR:", error);
    $("dbStatus").textContent = "ERROR";
    $("systemText").textContent = "DATABASE ERROR";
    return [];
  }

  $("dbStatus").textContent = "CONNECTED";
  $("systemText").textContent = "SYSTEM ONLINE";
  $("lastSync").textContent = new Date().toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"});
  return data || [];
}

async function refreshReports() {
  allReports = await fetchReports();
  renderRecent();
  updateStatistics();
  renderReports();
  renderGallery();
  if (map) renderMarkers();
}

async function updateStatistics() {
  const reports = allReports;
  $("totalReports").textContent = reports.length;
  $("pendingReports").textContent = reports.filter(r => String(r.status).toLowerCase() === "pending").length;
  $("verifiedReports").textContent = reports.filter(r => String(r.status).toLowerCase() === "verified").length;

  /* pipe_status may not exist yet; don't break the dashboard if it doesn't. */
  const { data: pipeData, error } = await supabaseClient.from("pipe_status").select("status");
  if (!error && pipeData) {
    $("activeLeaks").textContent = pipeData.filter(x => String(x.status).toUpperCase() === "LEAK").length;
  } else {
    $("activeLeaks").textContent = "—";
  }
}

function renderRecent() {
  const box = $("recentReports");
  const recent = allReports.slice(0,5);
  if (!recent.length) {
    box.innerHTML = `<div class="empty-state">No field reports yet.</div>`;
    return;
  }
  box.innerHTML = recent.map(r => `
    <div class="recent-item">
      ${r.image_url ? `<img class="thumb" src="${escapeHTML(r.image_url)}" onerror="this.style.display='none'">` : `<div class="thumb"></div>`}
      <div><strong>${escapeHTML(r.problem_type || "Road report")}</strong><small>${escapeHTML(r.description || "No description")} · ${formatDate(r.reported_at)}</small></div>
      <span class="recent-status">${escapeHTML(r.status || "Pending")}</span>
    </div>`).join("");
}

function renderReports() {
  const box = $("reportsList");
  if (!allReports.length) {
    box.innerHTML = `<div class="empty-state">No reports have been submitted yet.</div>`;
    return;
  }
  box.innerHTML = allReports.map(r => `
    <div class="report-row">
      <div class="report-main">
        ${r.image_url ? `<img class="report-image" src="${escapeHTML(r.image_url)}" alt="Road report" onerror="this.style.opacity=.25">` : `<div class="report-image"></div>`}
        <div><div class="report-id">REPORT #${escapeHTML(r.id)}</div><div class="report-title">${escapeHTML(r.description || r.problem_type || "Road report")}</div></div>
      </div>
      <div class="report-type">${escapeHTML(r.problem_type || "—")}</div>
      <div><span class="status-pill ${statusClass(r.status)}">${escapeHTML(r.status || "Pending")}</span></div>
      <div class="report-time">${formatDate(r.reported_at)}</div>
    </div>`).join("");
}

/* ---------------- GALLERY ---------------- */

function renderGallery() {
  const box = $("galleryGrid");
  if (!box) return;
  const search = ($("gallerySearch")?.value || "").toLowerCase().trim();
  const filter = $("galleryFilter")?.value || "all";
  const reports = allReports.filter(r => {
    const matchesSearch = !search || String(r.problem_type || "").toLowerCase().includes(search) || String(r.description || "").toLowerCase().includes(search);
    const matchesFilter = filter === "all" || String(r.status || "").toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });
  const withImages = reports.map(r => ({...r, displayImageURL:getImageURL(r.image_url)})).filter(r => r.displayImageURL);
  if (!withImages.length) { box.innerHTML = `<div class="empty-state gallery-empty"><strong>No images found</strong><span>Upload a road report with an image to see it here.</span></div>`; return; }
  box.innerHTML = withImages.map((r,i) => {
    const url=escapeHTML(r.displayImageURL);
    return `<article class="gallery-card" style="animation-delay:${Math.min(i*45,600)}ms"><div class="gallery-image-wrap"><img class="gallery-image" src="${url}" alt="${escapeHTML(r.problem_type || "Road report")}" loading="lazy" decoding="async" onerror="galleryImageFailed(this)"><div class="gallery-image-loading"><span></span>LOADING</div><div class="gallery-image-error">IMAGE UNAVAILABLE</div><div class="gallery-overlay"><span class="gallery-view-label">VIEW IMAGE</span><button class="gallery-open" data-image="${url}" data-caption="${escapeHTML(r.problem_type || "Road report")}">OPEN ↗</button></div><span class="gallery-index">#${String(i+1).padStart(2,"0")}</span></div><div class="gallery-body"><div class="gallery-heading"><h3>${escapeHTML(r.problem_type || "Road report")}</h3><span class="gallery-dot"></span></div><p>${escapeHTML(r.description || "No description provided.")}</p><div class="gallery-meta"><span class="status-pill ${statusClass(r.status)}">${escapeHTML(r.status || "Pending")}</span><small>${formatDate(r.reported_at)}</small></div></div></article>`;
  }).join("");
  box.querySelectorAll(".gallery-image").forEach(img => img.addEventListener("load", () => { img.classList.add("loaded"); img.parentElement.classList.add("image-ready"); }, {once:true}));
  box.querySelectorAll(".gallery-open").forEach(btn => btn.addEventListener("click", () => openLightbox(btn.dataset.image, btn.dataset.caption)));
}
function galleryImageFailed(img) { img.classList.add("broken"); img.parentElement.classList.add("image-error"); }


$("gallerySearch").addEventListener("input", renderGallery);
$("galleryFilter").addEventListener("change", renderGallery);
$("refreshGallery").addEventListener("click", async () => {
  showToast("Refreshing gallery…");
  await refreshReports();
  showToast("Gallery updated", "success");
});

/* ---------------- MAP ---------------- */

function initMap() {
  if (map) return;

  map = L.map("potholeMap", { zoomControl:true }).setView([28.6692,77.4538], 11);

  /* OpenStreetMap standard tiles — no CARTO API key required. */
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function makeMarkerIcon(status) {
  const color = String(status).toLowerCase() === "verified" ? "#42e8a1" :
                String(status).toLowerCase() === "resolved" ? "#31e7ff" : "#ff9f43";
  return L.divIcon({
    className:"",
    html:`<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #071018;box-shadow:0 0 0 5px ${color}33,0 0 22px ${color}99;"></div>`,
    iconSize:[18,18], iconAnchor:[9,9], popupAnchor:[0,-8]
  });
}

function renderMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  let count = 0;
  const bounds = [];

  allReports.forEach(r => {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    count++;
    bounds.push([lat,lng]);

    const image = r.image_url
      ? `<img class="popup-img" src="${escapeHTML(r.image_url)}" alt="Report image" onerror="this.style.display='none'">`
      : "";

    const popup = `
      ${image}
      <div class="popup-title">${escapeHTML(r.problem_type || "Road report")}</div>
      <div class="popup-row">Status: <b>${escapeHTML(r.status || "Pending")}</b></div>
      <div class="popup-row">Severity: <b>${escapeHTML(r.severity || "Unknown")}</b></div>
      <div class="popup-row">${escapeHTML(r.description || "No description")}</div>
      <div class="popup-row">GPS: <b>${lat.toFixed(6)}, ${lng.toFixed(6)}</b></div>`;

    L.marker([lat,lng], {icon:makeMarkerIcon(r.status)})
      .bindPopup(popup)
      .addTo(markersLayer);
  });

  $("mapCount").textContent = count;

  if (bounds.length && $("map").classList.contains("active")) {
    map.fitBounds(bounds, {padding:[35,35], maxZoom:16});
  }
}

$("fitMarkersBtn").addEventListener("click", () => {
  if (!map) return;
  const pts = allReports
    .map(r => [Number(r.latitude),Number(r.longitude)])
    .filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]));
  if (pts.length) map.fitBounds(pts,{padding:[35,35],maxZoom:16});
  else showToast("No mapped reports yet");
});

$("locateMapBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast("Geolocation is not supported", "error");
  navigator.geolocation.getCurrentPosition(pos => {
    if (!map) return;
    map.setView([pos.coords.latitude,pos.coords.longitude],16);
    L.circleMarker([pos.coords.latitude,pos.coords.longitude],{
      radius:7,color:"#31e7ff",fillColor:"#31e7ff",fillOpacity:.8
    }).addTo(map).bindPopup("Your current location").openPopup();
  }, () => showToast("Location permission denied", "error"));
});

/* ---------------- REPORT UPLOAD ---------------- */

let selectedFile = null;

$("potholeImage").addEventListener("change", e => handleSelectedFile(e.target.files[0]));

function handleSelectedFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showFormStatus("Please choose an image file.", true);
  if (file.size > 10 * 1024 * 1024) return showFormStatus("Image is larger than 10 MB.", true);

  selectedFile = file;
  $("uploadZone").classList.add("has-preview");
  $("uploadTitle").textContent = file.name;

  const reader = new FileReader();
  reader.onload = e => {
    $("imagePreview").src = e.target.result;
    $("previewImageBox").innerHTML = `<img src="${e.target.result}" alt="Preview">`;
  };
  reader.readAsDataURL(file);
}

$("uploadZone").addEventListener("dragover", e => { e.preventDefault(); $("uploadZone").classList.add("dragover"); });
$("uploadZone").addEventListener("dragleave", () => $("uploadZone").classList.remove("dragover"));
$("uploadZone").addEventListener("drop", e => {
  e.preventDefault();
  $("uploadZone").classList.remove("dragover");
  handleSelectedFile(e.dataTransfer.files[0]);
});

$("problemType").addEventListener("change", () => $("previewType").textContent = $("problemType").value);
$("description").addEventListener("input", () => $("previewDescription").textContent = $("description").value || "No description yet");

function showFormStatus(message, error=false) {
  $("reportStatus").textContent = message;
  $("reportStatus").className = `form-status ${error ? "error" : "success"}`;
}

function getLocation() {
  if (!navigator.geolocation) return showFormStatus("Geolocation is not supported by this browser.", true);

  $("locationText").textContent = "Detecting location…";
  navigator.geolocation.getCurrentPosition(pos => {
    userLatitude = pos.coords.latitude;
    userLongitude = pos.coords.longitude;
    $("latitude").value = userLatitude;
    $("longitude").value = userLongitude;
    const text = `${userLatitude.toFixed(6)}, ${userLongitude.toFixed(6)}`;
    $("locationText").textContent = text;
    $("previewLocation").textContent = `GPS ${text}`;
    showFormStatus("Location captured.");
  }, err => {
    console.error(err);
    $("locationText").textContent = "Location permission denied";
    showFormStatus("Please allow location access, then try again.", true);
  }, {enableHighAccuracy:true,timeout:12000,maximumAge:0});
}

$("locationBtn").addEventListener("click", getLocation);

async function submitReport() {
  const btn = $("submitReportBtn");

  if (!selectedFile) return showFormStatus("Please select an image.", true);
  if (userLatitude === null || userLongitude === null) return showFormStatus("Please detect your location first.", true);

  btn.disabled = true;
  btn.textContent = "Uploading…";
  showFormStatus("Uploading image to Supabase Storage…");

  try {
    const extension = (selectedFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const safeExt = extension || "jpg";
    const fileName = `report-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}.${safeExt}`;

    /* Upload to the EXISTING bucket. */
    const { error: uploadError } = await supabaseClient.storage
      .from("pothole-images")
      .upload(fileName, selectedFile, {
        cacheControl:"3600",
        upsert:false,
        contentType:selectedFile.type || "image/jpeg"
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    /*
      IMPORTANT:
      This works when pothole-images is a PUBLIC bucket.
      If it is private, see the setup note after the code.
    */
    const { data: publicData } = supabaseClient.storage
      .from("pothole-images")
      .getPublicUrl(fileName);

    const imageURL = publicData?.publicUrl;
    if (!imageURL) throw new Error("Supabase did not return an image URL.");

    showFormStatus("Image uploaded. Saving report…");

    const payload = {
      latitude:userLatitude,
      longitude:userLongitude,
      image_url:imageURL,
      problem_type:$("problemType").value,
      description:$("description").value.trim(),
      severity:"Unknown",
      status:"Pending"
    };

    const { error: databaseError } = await supabaseClient
      .from("pothole_reports")
      .insert(payload);

    if (databaseError) throw new Error(`Database insert failed: ${databaseError.message}`);

    showFormStatus("✓ Report submitted successfully.");
    showToast("Report uploaded successfully", "success");

    resetForm();
    await refreshReports();
    setTimeout(() => showPage("gallery"), 700);

  } catch (error) {
    console.error("REPORT ERROR:", error);
    showFormStatus(error.message || "Upload failed. Check Supabase Storage and table policies.", true);
    showToast("Report upload failed", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Submit report <span>→</span>`;
  }
}

$("submitReportBtn").addEventListener("click", submitReport);

function resetForm() {
  selectedFile = null;
  userLatitude = null;
  userLongitude = null;
  $("potholeImage").value = "";
  $("description").value = "";
  $("problemType").value = "Pothole";
  $("latitude").value = "";
  $("longitude").value = "";
  $("locationText").textContent = "Location not captured";
  $("previewType").textContent = "Pothole";
  $("previewDescription").textContent = "No description yet";
  $("previewLocation").textContent = "Location pending";
  $("imagePreview").src = "";
  $("uploadZone").classList.remove("has-preview");
  $("uploadTitle").textContent = "Drop image here or click to browse";
  $("previewImageBox").innerHTML = "<span>IMAGE PREVIEW</span>";
}

/* ---------------- PIPE MONITORING ---------------- */

const PIPE_ZONES_A = ["A1","A2","A3","A4"];
const PIPE_ZONES_B = ["B1","B2","B3","B4"];
const ALL_PIPE_ZONES = [...PIPE_ZONES_A,...PIPE_ZONES_B];
let pipeZonesBuilt = false;
let lastLeakZones = new Set();

function buildZones(){
  if (pipeZonesBuilt) return;

  $("zonesA").innerHTML = PIPE_ZONES_A.map(zone => zoneHTML(zone)).join("");
  $("zonesB").innerHTML = PIPE_ZONES_B.map(zone => zoneHTML(zone)).join("");

  pipeZonesBuilt = true;
}

function zoneHTML(zone){
  const gpioMap = {
    A1:13, A2:14, A3:18, A4:19,
    B1:21, B2:22, B3:25, B4:26
  };

  return `<div class="zone normal" id="zone-${zone}">
    <div class="zone-head">
      <b>${zone}</b>
      <i class="zone-led"></i>
    </div>
    <span>NORMAL</span>
    <small>GPIO ${gpioMap[zone]} · LIVE</small>
  </div>`;
}

function normalizeZoneName(value){
  const raw = String(value || "").trim().toUpperCase();

  if (ALL_PIPE_ZONES.includes(raw)) return raw;

  const stripped = raw.replace(/^ZONE\s*/i,"").replace(/[^A-Z0-9]/g,"");

  if (ALL_PIPE_ZONES.includes(stripped)) return stripped;

  /* Backward-compatible support for older A–H database rows. */
  const legacy = {
    A:"A1",B:"A2",C:"A3",D:"A4",
    E:"B1",F:"B2",G:"B3",H:"B4"
  };

  return legacy[stripped] || "";
}

function updatePipeGroup(group, leakCount){
  const state = $(`pipe${group}State`);
  const line = $(`pipe${group}`);

  if (!state || !line) return;

  const bad = leakCount > 0;

  state.textContent = bad
    ? `${leakCount} ACTIVE`
    : "STABLE";

  state.classList.toggle("bad", bad);
  line.classList.toggle("bad", bad);

  const card = state.closest(".pipe-card-peak");
  if (card) card.classList.toggle("is-alert", bad);
}

function updatePipeAlert(currentLeaks){
  const alert = $("pipeAlert");
  if (!alert) return;

  if (!currentLeaks.size){
    alert.classList.remove("show");
    lastLeakZones.clear();
    return;
  }

  const zones = [...currentLeaks];

  $("pipeAlertTitle").textContent = "PIPELINE LEAK DETECTED";
  $("pipeAlertText").textContent =
    `${zones.join(", ")} reporting active leakage.`;

  alert.classList.add("show");

  const newlyDetected = zones.filter(
    zone => !lastLeakZones.has(zone)
  );

  if (newlyDetected.length){
    showToast(
      `${newlyDetected.join(", ")} — leakage detected.`,
      "error"
    );
  }

  lastLeakZones = new Set(currentLeaks);
}

function applyPipeData(rows = []){
  buildZones();

  const states = {};

  ALL_PIPE_ZONES.forEach(zone => {
    states[zone] = "NORMAL";
  });

  rows.forEach(item => {
    const zone = normalizeZoneName(item.zone);
    if (!zone) return;

    states[zone] =
      String(item.status || "").toUpperCase() === "LEAK"
        ? "LEAK"
        : "NORMAL";
  });

  let leaks = 0;
  const currentLeaks = new Set();

  ALL_PIPE_ZONES.forEach(zone => {
    const el = $(`zone-${zone}`);
    if (!el) return;

    const leak = states[zone] === "LEAK";

    el.classList.toggle("leak", leak);
    el.classList.toggle("normal", !leak);
    el.querySelector("span").textContent =
      leak ? "LEAK DETECTED" : "NORMAL";
    el.querySelector(".zone-led")?.classList.toggle("leak", leak);

    if (leak){
      leaks++;
      currentLeaks.add(zone);
    }
  });

  $("activeLeaks").textContent = leaks;

  const leaksA = PIPE_ZONES_A.filter(z => states[z] === "LEAK").length;
  const leaksB = PIPE_ZONES_B.filter(z => states[z] === "LEAK").length;

  updatePipeGroup("A", leaksA);
  updatePipeGroup("B", leaksB);
  updatePipeAlert(currentLeaks);

  const overview = $("pipeHealthOverview");
  if (overview){
    overview.textContent =
      leaks ? `${leaks} ALERT${leaks === 1 ? "" : "S"}` : "STABLE";
    overview.style.color =
      leaks ? "var(--red)" : "var(--green)";
  }

  const lastPoll = $("lastPipePoll");
  if (lastPoll) lastPoll.textContent = formatTime();
}

async function loadPipeStatus(){
  buildZones();

  try{
    const { data, error } =
      await supabaseClient
        .from("pipe_status")
        .select("*");

    if (error){
      $("pipeConnection").textContent = "TABLE NOT READY";
      $("pipeConnection").className = "status-badge";
      $("activeLeaks").textContent = "—";

      const lastPoll = $("lastPipePoll");
      if (lastPoll) lastPoll.textContent = "ERROR";

      console.warn("pipe_status unavailable:", error.message);
      return;
    }

    $("pipeConnection").textContent = "LIVE POLL";
    $("pipeConnection").className = "status-badge online";

    applyPipeData(data || []);
  }
  catch(error){
    console.error("PIPE FETCH ERROR:",error);
    $("pipeConnection").textContent = "ERROR";
    $("pipeConnection").className = "status-badge";
  }
}

$("jumpToPipe").addEventListener("click",()=>{
  $("zonesA")?.scrollIntoView({
    behavior:"smooth",
    block:"center"
  });
});

/* ---------------- CAMERA ---------------- */

$("startCameraBtn").addEventListener("click", () => {
  const url = $("cameraUrl").value.trim();
  if (!url) return showToast("Enter your ESP32-CAM stream URL", "error");

  const img = $("cameraStream");
  img.src = url;
  img.style.display = "block";
  $("cameraStatus").textContent = "LIVE";
  $("cameraStatus").className = "status-badge online";
  $("cameraConnection").textContent = "STREAM CONNECTING";
  img.onload = () => $("cameraConnection").textContent = "ESP32-CAM STREAM LIVE";
  img.onerror = () => {
    img.style.display = "none";
    $("cameraStatus").textContent = "ERROR";
    $("cameraStatus").className = "status-badge";
    $("cameraConnection").textContent = "COULD NOT LOAD STREAM";
  };
});

$("stopCameraBtn").addEventListener("click", () => {
  $("cameraStream").src = "";
  $("cameraStream").style.display = "none";
  $("cameraStatus").textContent = "OFFLINE";
  $("cameraStatus").className = "status-badge";
  $("cameraConnection").textContent = "CAMERA FEED READY";
});

/* ---------------- LIGHTBOX ---------------- */

function openLightbox(src, caption) {
  $("lightboxImage").src = src;
  $("lightboxCaption").textContent = caption;
  $("lightbox").classList.add("open");
}
$("closeLightbox").addEventListener("click", () => $("lightbox").classList.remove("open"));
$("lightbox").addEventListener("click", e => { if (e.target === $("lightbox")) $("lightbox").classList.remove("open"); });


/* ---------------- CINEMATIC BACKGROUND ---------------- */
function setupCinematicBackground(){
  const layers = [...document.querySelectorAll(".scene-layer")];
  if (!layers.length) return;

  let active = 0;
  let pausedUntil = 0;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const swapScene = () => {
    if (Date.now() < pausedUntil) return;
    layers[active].classList.remove("active");
    active = (active + 1) % layers.length;
    layers[active].classList.add("active");
  };

  setInterval(swapScene, 9000);

  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  window.addEventListener("mousemove", e => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 10;
    targetY = (e.clientY / window.innerHeight - 0.5) * 7;
    pausedUntil = Date.now() + 250;
  }, {passive:true});

  function animateParallax(){
    currentX += (targetX - currentX) * 0.035;
    currentY += (targetY - currentY) * 0.035;
    layers.forEach((layer, i) => {
      const depth = 1 + i * 0.15;
      layer.style.transform = `scale(${1.03 + i * 0.005}) translate3d(${currentX*depth}px, ${currentY*depth}px, 0)`;
    });
    requestAnimationFrame(animateParallax);
  }
  requestAnimationFrame(animateParallax);

  let lastScroll = 0;
  window.addEventListener("scroll", () => {
    const delta = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    document.documentElement.style.setProperty("--scroll-shift", `${Math.max(-16, Math.min(16, window.scrollY * 0.015 + delta * 0.1))}px`);
  }, {passive:true});
}

/* ---------------- INITIALISE ---------------- */

async function init() {
  buildZones();
  if (SUPABASE_KEY.includes("PASTE_YOUR")) {
    $("systemText").textContent = "ADD SUPABASE KEY";
    $("dbStatus").textContent = "NOT CONFIGURED";
    $("storageStatus").textContent = "NOT CONFIGURED";
    showToast("Add your Supabase publishable key in app.js", "error");
    return;
  }

  $("storageStatus").textContent = "READY";
  await refreshReports();

  /* Pipe polling is isolated so a missing pipe_status table cannot break RHMS. */
  await loadPipeStatus();
  setInterval(loadPipeStatus, 5000);
  setInterval(refreshReports, 15000);
}

setupCinematicBackground();
init();
