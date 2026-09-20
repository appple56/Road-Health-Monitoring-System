/* =========================================================
   RHMS — ROAD HEALTH MONITORING SYSTEM
   FINAL FRONTEND JAVASCRIPT
   =========================================================

   DATA SOURCES
   ---------------------------------------------------------
   Supabase:
     - pothole_reports
     - pipe_status
     - camera_frames
     - marg_drishti_events
     - pothole-images
     - camera-images

   LIVE SYSTEM
   ---------------------------------------------------------
   - Road reports refresh automatically
   - Pipe status refreshes automatically
   - Camera frame refreshes automatically
   - Marg Drishti refreshes automatically
   - Supabase Realtime updates supported
   - Polling remains as a fallback
*/


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
  "https://gphlolodqejrkphspucz.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_qw-XTj_NaVBZu7Kcd1KTFQ_8K51CgDv";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let allReports = [];
let map = null;
let markersLayer = null;

let userLatitude = null;
let userLongitude = null;

let selectedFile = null;

let pipeZonesBuilt = false;

let latestCameraTimer = null;
let pipePollingTimer = null;
let reportPollingTimer = null;

let realtimeChannel = null;

let previousLeakZones = new Set();

let margDrishtiEvents = [];
let margDrishtiPollingTimer = null;
let margDrishtiRealtimeChannel = null;


/* =========================================================
   PAGE TITLES
   ========================================================= */

const pageTitles = {

  dashboard:
    "Overview",

  map:
    "Pothole Map",

  gallery:
    "Image Gallery",

  reports:
    "Road Reports",

  report:
    "Report Road Problem",

  pipes:
    "Pipe Monitoring",

  visual:
    "Visual Inspection",

  "marg-drishti":
    "Marg Drishti"

};


/* =========================================================
   SHORTCUT
   ========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   SAFE ELEMENT TEXT
   ========================================================= */

function setText(
  id,
  value
){

  const element =
    $(id);

  if(element){

    element.textContent =
      value;

  }

}


/* =========================================================
   IMAGE URL HELPER
   ========================================================= */

function getImageURL(
  value
){

  if(!value)
    return "";

  const raw =
    String(value).trim();

  if(
    /^https?:\/\//i.test(raw)
  ){

    return raw;

  }

  const cleanPath =
    raw
      .replace(/^\/+/, "")
      .replace(/^pothole-images\//, "");

  const result =
    supabaseClient
      .storage
      .from("pothole-images")
      .getPublicUrl(cleanPath);

  return (
    result &&
    result.data &&
    result.data.publicUrl
  ) || "";

}


/* =========================================================
   CAMERA IMAGE URL
   ========================================================= */

function getCameraImageURL(
  value
){

  if(!value)
    return "";

  const raw =
    String(value).trim();

  if(
    /^https?:\/\//i.test(raw)
  ){

    return raw;

  }

  const cleanPath =
    raw
      .replace(/^\/+/, "")
      .replace(/^camera-images\//, "");

  const result =
    supabaseClient
      .storage
      .from("camera-images")
      .getPublicUrl(cleanPath);

  return (
    result &&
    result.data &&
    result.data.publicUrl
  ) || "";

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
  value
){

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(
  message,
  type = ""
){

  const toast =
    $("toast");

  if(!toast){

    console.log(message);
    return;

  }

  toast.textContent =
    message;

  toast.className =
    `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(
      () => {

        toast.className =
          "toast";

      },
      3000
    );

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
  value
){

  if(!value)
    return "Unknown date";

  const date =
    new Date(value);

  if(
    Number.isNaN(date.getTime())
  ){

    return "Unknown date";

  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


/* =========================================================
   TIME FORMAT
   ========================================================= */

function formatTime(){

  return new Date()
    .toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }
    );

}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function statusClass(
  status
){

  return String(
    status || ""
  )
    .toLowerCase()
    .replaceAll(" ", "-");

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(
  pageId
){

  document
    .querySelectorAll(".page")
    .forEach(
      page =>
        page.classList.remove("active")
    );

  document
    .querySelectorAll(".nav-button")
    .forEach(
      button =>
        button.classList.remove("active")
    );

  const page =
    $(pageId);

  if(page){

    page.classList.add("active");

  }

  const nav =
    document.querySelector(
      `.nav-button[data-page="${pageId}"]`
    );

  if(nav){

    nav.classList.add("active");

  }

  setText(
    "pageTitle",
    pageTitles[pageId] || "RHMS"
  );

  setText(
    "topPageTitle",
    pageTitles[pageId] || "RHMS"
  );

  $("sidebar")
    ?.classList.remove("open");


  if(
    pageId === "map"
  ){

    setTimeout(
      () => {

        initMap();

        if(map){

          map.invalidateSize(true);

          setTimeout(
            () => {

              if(map){

                map.invalidateSize(true);

              }

            },
            250
          );

        }

        renderMarkers();

      },
      100
    );

  }


  if(
    pageId === "gallery"
  ){

    renderGallery();

  }


  if(
    pageId === "reports"
  ){

    renderReports();

  }


  if(
    pageId === "pipes"
  ){

    loadPipeStatus();

  }


  if(
    pageId === "visual"
  ){

    loadLatestCamera();

  }


  if(
    pageId === "marg-drishti"
  ){

    loadMargDrishti();

  }


  if(
    pageId === "dashboard"
  ){

    renderRecent();

    updateStatistics();

  }

}


/* =========================================================
   NAV LISTENERS
   ========================================================= */

document
  .querySelectorAll(".nav-button")
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    }
  );


/* =========================================================
   DATA JUMP BUTTONS
   ========================================================= */

document
  .querySelectorAll("[data-jump]")
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.jump
          );

        }
      );

    }
  );


/* =========================================================
   MOBILE MENU
   ========================================================= */

$("menuBtn")
  ?.addEventListener(
    "click",
    () => {

      $("sidebar")
        ?.classList.toggle("open");

    }
  );


/* =========================================================
   CURRENT DATE
   ========================================================= */

setText(
  "currentDate",
  new Date().toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  )
);


/* =========================================================
   SUPABASE REPORT DATA
   ========================================================= */

async function fetchReports(){

  const {
    data,
    error
  } =
    await supabaseClient
      .from("pothole_reports")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if(error){

    console.error(
      "REPORT FETCH ERROR:",
      error
    );

    throw error;

  }

  return data || [];

}


/* =========================================================
   REFRESH REPORTS
   ========================================================= */

async function refreshReports(){

  try{

    allReports =
      await fetchReports();

    renderReports();
    renderRecent();
    renderGallery();
    updateStatistics();
    renderMarkers();

    setText(
      "dbStatus",
      "CONNECTED"
    );

  }
  catch(error){

    console.error(
      error
    );

    setText(
      "dbStatus",
      "ERROR"
    );

  }

}


/* =========================================================
   SEVERITY HELPERS
   ========================================================= */

function getDepthScore(
  depth
){

  const value =
    String(
      depth || ""
    ).toLowerCase();

  if(
    value.includes("less")
  ){

    return 1;

  }

  if(
    value.includes("2–5") ||
    value.includes("2-5")
  ){

    return 2;

  }

  if(
    value.includes("5–10") ||
    value.includes("5-10")
  ){

    return 3;

  }

  if(
    value.includes("10–20") ||
    value.includes("10-20")
  ){

    return 4;

  }

  if(
    value.includes("more")
  ){

    return 5;

  }

  return 0;

}


function getSizeScore(
  size
){

  const value =
    String(
      size || ""
    ).toLowerCase();

  if(
    value.includes("small")
  ){

    return 1;

  }

  if(
    value.includes("medium")
  ){

    return 2;

  }

  if(
    value.includes("large") &&
    !value.includes("very")
  ){

    return 3;

  }

  if(
    value.includes("very large")
  ){

    return 4;

  }

  return 0;

}


function calculateSeverity(
  depth,
  size
){

  const depthScore =
    getDepthScore(depth);

  const sizeScore =
    getSizeScore(size);

  if(
    !depthScore ||
    !sizeScore
  ){

    return "";

  }

  const total =
    depthScore +
    sizeScore;

  if(total <= 2){

    return "LOW";

  }

  if(total <= 4){

    return "MODERATE";

  }

  if(total <= 6){

    return "HIGH";

  }

  return "CRITICAL";

}


/* =========================================================
   SEVERITY UI
   ========================================================= */

function updatePotholeSeverity(){

  const depth =
    $("potholeDepth")?.value || "";

  const size =
    $("potholeSize")?.value || "";

  const severity =
    calculateSeverity(
      depth,
      size
    );

  const badge =
    $("severityBadge");

  const explanation =
    $("severityExplanation");

  if(!badge)
    return;

  badge.className =
    "severity-badge";

  if(!severity){

    badge.textContent =
      "SELECT DEPTH + SIZE";

    if(explanation){

      explanation.textContent =
        "Select the pothole depth and size to calculate the RHMS severity.";

    }

    return;

  }

  badge.textContent =
    severity;

  badge.classList.add(
    severity.toLowerCase()
  );

  if(explanation){

    explanation.textContent =
      `RHMS severity is ${severity}. Depth and affected area are combined for this project grading system.`;

  }

}


/* =========================================================
   POTHOLE ASSESSMENT LISTENERS
   ========================================================= */

$("potholeDepth")
  ?.addEventListener(
    "change",
    updatePotholeSeverity
  );

$("potholeSize")
  ?.addEventListener(
    "change",
    updatePotholeSeverity
  );


/* =========================================================
   REPORT FORM
   ========================================================= */

const reportForm =
  $("reportForm");

reportForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const formData =
        new FormData(
          reportForm
        );

      const category =
        formData.get("category") ||
        formData.get("issueType") ||
        "";

      const description =
        formData.get("description") ||
        "";

      const latitude =
        userLatitude;

      const longitude =
        userLongitude;

      const depth =
        $("potholeDepth")?.value || "";

      const size =
        $("potholeSize")?.value || "";

      let severity =
        "N/A";


      if(
        String(category)
          .toLowerCase()
          .includes("pothole")
      ){

        if(
          !depth ||
          !size
        ){

          showToast(
            "Select pothole depth and size.",
            "error"
          );

          return;

        }

        severity =
          calculateSeverity(
            depth,
            size
          );

      }


      let imagePath =
        "";


      try{

        if(selectedFile){

          const extension =
            selectedFile.name
              .split(".")
              .pop();

          const fileName =
            `report-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}.${extension}`;

          const upload =
            await supabaseClient
              .storage
              .from("pothole-images")
              .upload(
                fileName,
                selectedFile,
                {
                  upsert: false
                }
              );

          if(upload.error){

            console.error(
              upload.error
            );

            showToast(
              "Image upload failed.",
              "error"
            );

            return;

          }

          imagePath =
            fileName;

        }


        const payload = {

          category:
            category,

          description:
            description,

          latitude:
            latitude,

          longitude:
            longitude,

          image_url:
            imagePath,

          pothole_depth:
            String(category)
              .toLowerCase()
              .includes("pothole")
              ? depth
              : null,

          pothole_size:
            String(category)
              .toLowerCase()
              .includes("pothole")
              ? size
              : null,

          severity:
            severity

        };


        const {
          error
        } =
          await supabaseClient
            .from("pothole_reports")
            .insert(payload);


        if(error){

          console.error(
            "REPORT INSERT ERROR:",
            error
          );

          showToast(
            "Could not submit report.",
            "error"
          );

          return;

        }


        showToast(
          "Road report submitted successfully.",
          "success"
        );


        reportForm.reset();

        selectedFile =
          null;

        updatePotholeSeverity();

        await refreshReports();

        showPage(
          "reports"
        );

      }
      catch(error){

        console.error(
          error
        );

        showToast(
          "Something went wrong while submitting the report.",
          "error"
        );

      }

    }
  );


/* =========================================================
   IMAGE INPUT
   ========================================================= */

$("imageInput")
  ?.addEventListener(
    "change",
    event => {

      selectedFile =
        event.target.files?.[0] ||
        null;

      const fileName =
        selectedFile
          ? selectedFile.name
          : "No image selected";

      setText(
        "imageName",
        fileName
      );

    }
  );


/* =========================================================
   USER LOCATION
   ========================================================= */

function getUserLocation(){

  if(
    !navigator.geolocation
  ){

    showToast(
      "Geolocation is not supported.",
      "error"
    );

    return;

  }

  navigator.geolocation.getCurrentPosition(
    position => {

      userLatitude =
        position.coords.latitude;

      userLongitude =
        position.coords.longitude;

      setText(
        "locationStatus",
        `${userLatitude.toFixed(6)}, ${userLongitude.toFixed(6)}`
      );

    },
    error => {

      console.error(
        "LOCATION ERROR:",
        error
      );

      setText(
        "locationStatus",
        "Location unavailable"
      );

    },
    {
      enableHighAccuracy:
        true,

      timeout:
        10000,

      maximumAge:
        0

    }
  );

}


/* =========================================================
   LOCATION BUTTON
   ========================================================= */

$("getLocationBtn")
  ?.addEventListener(
    "click",
    getUserLocation
  );


/* =========================================================
   REPORT PREVIEW
   ========================================================= */

function updateReportPreview(){

  const category =
    $("reportCategory")?.value ||
    $("category")?.value ||
    "";

  const description =
    $("description")?.value ||
    "";

  const depth =
    $("potholeDepth")?.value ||
    "";

  const size =
    $("potholeSize")?.value ||
    "";

  const severity =
    calculateSeverity(
      depth,
      size
    );


  setText(
    "previewCategory",
    category || "—"
  );

  setText(
    "previewDescription",
    description || "—"
  );

  setText(
    "previewDepth",
    depth || "—"
  );

  setText(
    "previewSize",
    size || "—"
  );

  setText(
    "previewSeverity",
    severity || "—"
  );

}


/* =========================================================
   PREVIEW LISTENERS
   ========================================================= */

[
  "reportCategory",
  "category",
  "description",
  "potholeDepth",
  "potholeSize"
]
.forEach(
  id => {

    $(id)?.addEventListener(
      "input",
      updateReportPreview
    );

    $(id)?.addEventListener(
      "change",
      updateReportPreview
    );

  }
);


/* =========================================================
   REPORT RENDERING
   ========================================================= */

function renderReports(){

  const container =
    $("reportsList");

  if(!container)
    return;

  if(!allReports.length){

    container.innerHTML =
      `<div class="empty-state">No road reports found.</div>`;

    return;

  }


  container.innerHTML =
    allReports
      .map(
        report => {

          const category =
            report.category ||
            "ROAD ISSUE";

          const image =
            getImageURL(
              report.image_url
            );

          const severity =
            report.severity ||
            "N/A";

          return `
            <article class="report-card">

              ${
                image
                  ? `
                    <img
                      class="report-image"
                      src="${escapeHTML(image)}"
                      alt="Road report image"
                    >
                  `
                  : ""
              }

              <div class="report-card-body">

                <div class="report-card-top">

                  <span class="report-category">
                    ${escapeHTML(category)}
                  </span>

                  <span class="severity-badge ${statusClass(severity)}">
                    ${escapeHTML(severity)}
                  </span>

                </div>

                <h3>
                  ${escapeHTML(
                    report.title ||
                    category
                  )}
                </h3>

                <p>
                  ${escapeHTML(
                    report.description ||
                    "No description provided."
                  )}
                </p>

                ${
                  report.pothole_depth ||
                  report.pothole_size
                    ? `
                      <div class="report-meta">

                        <span>
                          Depth:
                          ${escapeHTML(
                            report.pothole_depth ||
                            "—"
                          )}
                        </span>

                        <span>
                          Size:
                          ${escapeHTML(
                            report.pothole_size ||
                            "—"
                          )}
                        </span>

                      </div>
                    `
                    : ""
                }

                <div class="report-meta">

                  <span>
                    ${escapeHTML(
                      formatDate(
                        report.created_at
                      )
                    )}
                  </span>

                  ${
                    report.latitude !== null &&
                    report.latitude !== undefined
                      ? `
                        <span>
                          ${Number(report.latitude).toFixed(5)},
                          ${Number(report.longitude).toFixed(5)}
                        </span>
                      `
                      : ""
                  }

                </div>

              </div>

            </article>
          `;

        }
      )
      .join("");

}


/* =========================================================
   RECENT REPORTS
   ========================================================= */

function renderRecent(){

  const container =
    $("recentReports");

  if(!container)
    return;

  const recent =
    allReports.slice(
      0,
      5
    );

  if(!recent.length){

    container.innerHTML =
      `<div class="empty-state">No recent reports.</div>`;

    return;

  }

  container.innerHTML =
    recent
      .map(
        report => {

          return `
            <div class="recent-item">

              <div>

                <strong>
                  ${escapeHTML(
                    report.category ||
                    "Road Issue"
                  )}
                </strong>

                <small>
                  ${escapeHTML(
                    formatDate(
                      report.created_at
                    )
                  )}
                </small>

              </div>

              <span class="status-pill">
                ${escapeHTML(
                  report.severity ||
                  "N/A"
                )}
              </span>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(){

  const potholes =
    allReports.filter(
      report =>
        String(
          report.category || ""
        )
        .toLowerCase()
        .includes("pothole")
    ).length;


  const total =
    allReports.length;


  setText(
    "totalReports",
    total
  );

  setText(
    "totalPotholes",
    potholes
  );

  setText(
    "totalPotholeCount",
    potholes
  );


  const critical =
    allReports.filter(
      report =>
        String(
          report.severity || ""
        ).toUpperCase() ===
        "CRITICAL"
    ).length;


  setText(
    "criticalReports",
    critical
  );

}


/* =========================================================
   GALLERY
   ========================================================= */

function renderGallery(){

  const container =
    $("galleryGrid");

  if(!container)
    return;


  const reportsWithImages =
    allReports.filter(
      report =>
        report.image_url
    );


  if(!reportsWithImages.length){

    container.innerHTML =
      `<div class="empty-state">No road images available.</div>`;

    return;

  }


  container.innerHTML =
    reportsWithImages
      .map(
        report => {

          const image =
            getImageURL(
              report.image_url
            );

          return `
            <div class="gallery-item">

              <img
                src="${escapeHTML(image)}"
                alt="Road condition"
                loading="lazy"
              >

              <div class="gallery-caption">

                <strong>
                  ${escapeHTML(
                    report.category ||
                    "Road Issue"
                  )}
                </strong>

                <small>
                  ${escapeHTML(
                    formatDate(
                      report.created_at
                    )
                  )}
                </small>

              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   MAP
   ========================================================= */

function initMap(){

  if(map)
    return;

  const mapElement =
    $("map");

  if(!mapElement)
    return;

  map =
    L.map(
      mapElement
    ).setView(
      [20.5937, 78.9629],
      5
    );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom:
        19,

      attribution:
        "&copy; OpenStreetMap contributors"

    }
  )
  .addTo(map);


  markersLayer =
    L.layerGroup()
      .addTo(map);

}


/* =========================================================
   MAP MARKERS
   ========================================================= */

function renderMarkers(){

  if(!map)
    return;

  if(!markersLayer){

    markersLayer =
      L.layerGroup()
        .addTo(map);

  }


  markersLayer.clearLayers();


  const validReports =
    allReports.filter(
      report =>
        report.latitude !== null &&
        report.longitude !== null &&
        !Number.isNaN(
          Number(report.latitude)
        ) &&
        !Number.isNaN(
          Number(report.longitude)
        )
    );


  validReports.forEach(
    report => {

      const severity =
        String(
          report.severity ||
          ""
        ).toLowerCase();


      const marker =
        L.marker(
          [
            Number(report.latitude),
            Number(report.longitude)
          ]
        );


      marker.bindPopup(
        `
          <div class="map-popup">

            <strong>
              ${escapeHTML(
                report.category ||
                "Road Issue"
              )}
            </strong>

            <br>

            Severity:
            ${escapeHTML(
              report.severity ||
              "N/A"
            )}

            <br>

            Depth:
            ${escapeHTML(
              report.pothole_depth ||
              "—"
            )}

            <br>

            Size:
            ${escapeHTML(
              report.pothole_size ||
              "—"
            )}

            <br><br>

            ${escapeHTML(
              report.description ||
              "No description."
            )}

          </div>
        `
      );


      marker.addTo(
        markersLayer
      );

    }
  );


  if(validReports.length){

    const bounds =
      L.latLngBounds(
        validReports.map(
          report => [
            Number(report.latitude),
            Number(report.longitude)
          ]
        )
      );

    map.fitBounds(
      bounds,
      {
        padding:
          [30, 30]
      }
    );

  }

}


/* =========================================================
   PIPE ZONES
   ========================================================= */

function buildZones(){

  const container =
    $("pipeZones");

  if(!container)
    return;

  if(pipeZonesBuilt)
    return;

  pipeZonesBuilt =
    true;

  const zones = [

    {
      id: "A1",
      gpio: 13
    },

    {
      id: "A2",
      gpio: 14
    },

    {
      id: "A3",
      gpio: 18
    },

    {
      id: "A4",
      gpio: 19
    },

    {
      id: "B1",
      gpio: 21
    },

    {
      id: "B2",
      gpio: 22
    },

    {
      id: "B3",
      gpio: 25
    },

    {
      id: "B4",
      gpio: 26
    }

  ];


  container.innerHTML =
    zones
      .map(
        zone => {

          return `
            <div
              class="pipe-zone"
              id="pipe-${zone.id}"
            >

              <div class="pipe-zone-head">

                <strong>
                  ${zone.id}
                </strong>

                <span>
                  GPIO ${zone.gpio}
                </span>

              </div>

              <div class="pipe-zone-status">
                WAITING
              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   PIPE STATUS
   ========================================================= */

async function loadPipeStatus(){

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("pipe_status")
        .select("*")
        .order(
          "zone",
          {
            ascending:
              true
          }
        );


    if(error)
      throw error;


    const rows =
      data || [];


    rows.forEach(
      row => {

        const zone =
          row.zone ||
          row.zone_id;

        if(!zone)
          return;


        const element =
          $(`pipe-${zone}`);

        if(!element)
          return;


        const rawStatus =
          row.status ||
          row.state ||
          "NORMAL";


        const status =
          String(
            rawStatus
          )
          .toUpperCase();


        const statusElement =
          element.querySelector(
            ".pipe-zone-status"
          );


        if(statusElement){

          statusElement.textContent =
            status;

        }


        element.dataset.status =
          statusClass(
            status
          );

      }
    );


    setText(
      "pipeConnection",
      "CONNECTED"
    );


  }
  catch(error){

    console.error(
      "PIPE STATUS ERROR:",
      error
    );

    setText(
      "pipeConnection",
      "ERROR"
    );

  }

}


/* =========================================================
   CAMERA
   ========================================================= */

async function loadLatestCamera(){

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("camera_frames")
        .select("*")
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )
        .limit(1);


    if(error)
      throw error;


    const latest =
      data?.[0];


    if(!latest){

      setText(
        "cameraStatus",
        "NO FRAME"
      );

      return;

    }


    const image =
      getCameraImageURL(
        latest.image_url ||
        latest.path ||
        latest.file_path
      );


    const imageElement =
      $("latestCameraImage");


    if(
      imageElement &&
      image
    ){

      imageElement.src =
        image;

    }


    setText(
      "cameraStatus",
      "LIVE"
    );


    setText(
      "cameraTime",
      formatDate(
        latest.created_at
      )
    );

  }
  catch(error){

    console.error(
      "CAMERA ERROR:",
      error
    );

    setText(
      "cameraStatus",
      "ERROR"
    );

  }

}


/* =========================================================
   MARG DRISHTI
   ========================================================= */

function margConditionClass(
  condition
){

  const value =
    String(
      condition ||
      ""
    )
      .toUpperCase()
      .replaceAll(
        "_",
        " "
      );


  if(
    value.includes("NORMAL")
  ){

    return "normal";

  }

  if(
    value.includes("SPEED")
  ){

    return "breaker";

  }

  if(
    value.includes("POTHOLE")
  ){

    return "pothole";

  }

  if(
    value.includes("ROUGH")
  ){

    return "rough";

  }

  if(
    value.includes("STATIONARY")
  ){

    return "stationary";

  }

  return "unknown";

}


function margConditionIcon(
  condition
){

  const cls =
    margConditionClass(
      condition
    );


  const icons = {

    normal:
      "✓",

    breaker:
      "↕",

    pothole:
      "⚠",

    rough:
      "≋",

    stationary:
      "■",

    unknown:
      "?"

  };


  return (
    icons[cls] ||
    "?"
  );

}


/* =========================================================
   MARG GPS LOCATION
   ========================================================= */

function formatMargGpsLocation(
  event
){

  if(
    event?.gps_valid === false
  ){

    return "NO GPS FIX";

  }


  const lat =
    Number(
      event?.latitude
    );

  const lon =
    Number(
      event?.longitude
    );


  if(
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ){

    return "NO GPS FIX";

  }


  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

}


/* =========================================================
   MARG GPS SPEED
   ========================================================= */

function formatMargGpsSpeed(
  event
){

  const speed =
    Number(
      event?.gps_speed_kmph
    );


  if(
    !Number.isFinite(speed)
  ){

    return "—";

  }


  return `${speed.toFixed(1)} km/h`;

}


/* =========================================================
   MARG GPS STATUS
   ========================================================= */

function formatMargGpsStatus(
  event
){

  if(
    event?.gps_valid === true
  ){

    const satellites =
      Number(
        event?.gps_satellites
      );


    if(
      Number.isFinite(satellites) &&
      satellites > 0
    ){

      return `GPS FIX · ${satellites} SATELLITES`;

    }


    return "GPS FIX";

  }


  return "NO GPS FIX";

}


/* =========================================================
   MARG DEVICE STATE
   ========================================================= */

function getMargDeviceState(
  event
){

  if(!event){

    return {
      state:
        "offline",

      message:
        "No event received"
    };

  }


  const created =
    new Date(
      event.created_at
    )
    .getTime();


  if(
    !Number.isFinite(created)
  ){

    return {
      state:
        "offline",

      message:
        "Invalid timestamp"
    };

  }


  const age =
    Date.now() -
    created;


  if(
    age <= 15000
  ){

    return {
      state:
        "online",

      message:
        "Device updated recently"
    };

  }


  if(
    age <= 30000
  ){

    return {
      state:
        "stale",

      message:
        "No update in the last 15–30 seconds"
    };

  }


  return {
    state:
      "offline",

    message:
      "No recent device update"
  };

}


/* =========================================================
   MARG CONNECTION STATE
   ========================================================= */

function margConnectionState(
  state,
  message
){

  const element =
    $("mdDeviceLinkState");


  if(!element)
    return;


  element.dataset.state =
    state;


  element.title =
    message || "";

}


/* =========================================================
   LOAD MARG DRISHTI
   ========================================================= */

async function loadMargDrishti(){

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("marg_drishti_events")
        .select(
          "id,device_id,condition,vehicle_status,confidence,latitude,longitude,gps_speed_kmph,gps_valid,gps_satellites,created_at"
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )
        .limit(50);


    if(error)
      throw error;


    margDrishtiEvents =
      data || [];


    renderMargDrishti();


    setText(
      "mdRealtimeState",
      margDrishtiRealtimeChannel
        ? "LIVE"
        : "POLLING"
    );


  }
  catch(error){

    console.error(
      "MARG DRISHTI ERROR:",
      error
    );

    renderMargDrishtiEmpty(
      error
    );

  }

}


/* =========================================================
   MARG EMPTY STATE
   ========================================================= */

function renderMargDrishtiEmpty(
  error
){

  const panel =
    $("mdStatusPanel");

  if(panel){

    panel.dataset.condition =
      "unknown";

  }


  setText(
    "mdHistoryCount",
    "0 EVENTS"
  );

  setText(
    "mdCurrentCondition",
    "WAITING FOR DATA"
  );

  setText(
    "mdConditionTag",
    "NO EVENT"
  );

  setText(
    "mdVehicleStatus",
    "—"
  );

  setText(
    "mdConfidence",
    "—"
  );

  setText(
    "mdGpsLocation",
    "NO FIX"
  );

  setText(
    "mdGpsSpeed",
    "—"
  );

  setText(
    "mdGpsConnectionState",
    "NO FIX"
  );

  setText(
    "mdDeviceLinkState",
    "WAITING"
  );

  setText(
    "mdDeviceId",
    "—"
  );

  setText(
    "mdLastUpdate",
    "—"
  );

  setText(
    "mdLiveMessage",
    error
      ? "Database connection error. Check the Supabase table and read policy."
      : "Waiting for the first Marg Drishti event…"
  );

}


/* =========================================================
   RENDER MARG DRISHTI
   ========================================================= */

function renderMargDrishti(){

  const latest =
    margDrishtiEvents[0];

  const panel =
    $("mdStatusPanel");


  if(!latest){

    renderMargDrishtiEmpty(
      null
    );

    updateMargDrishtiCounters();

    return;

  }


  const condition =
    String(
      latest.condition ||
      "UNKNOWN"
    )
    .toUpperCase();


  const cls =
    margConditionClass(
      condition
    );


  if(panel){

    panel.dataset.condition =
      cls;

  }


  setText(
    "mdCurrentCondition",
    condition
  );


  setText(
    "mdConditionTag",
    latest.vehicle_status ===
      "VEHICLE STATIONARY"
      ? "STATIONARY"
      : "LIVE AI"
  );


  setText(
    "mdVehicleStatus",
    latest.vehicle_status ||
      "—"
  );


  setText(
    "mdGpsLocation",
    formatMargGpsLocation(
      latest
    )
  );


  setText(
    "mdGpsSpeed",
    formatMargGpsSpeed(
      latest
    )
  );


  setText(
    "mdGpsConnectionState",
    formatMargGpsStatus(
      latest
    )
  );


  setText(
    "mdDeviceId",
    latest.device_id ||
      "—"
  );


  setText(
    "mdLastUpdate",
    formatDate(
      latest.created_at
    )
  );


  setText(
    "mdConditionIcon",
    margConditionIcon(
      condition
    )
  );


  if(
    latest.confidence === null ||
    latest.confidence === undefined
  ){

    setText(
      "mdConfidence",
      "—"
    );

  }
  else{

    setText(
      "mdConfidence",
      `${Number(
        latest.confidence
      ).toFixed(1)}%`
    );

  }


  const deviceState =
    getMargDeviceState(
      latest
    );


  setText(
    "mdDeviceLinkState",
    deviceState.state === "online"
      ? "ONLINE"
      : deviceState.state === "stale"
        ? "STALE"
        : "OFFLINE"
  );


  margConnectionState(
    deviceState.state,
    deviceState.message
  );


  const liveMessage =
    latest.vehicle_status ===
      "VEHICLE STATIONARY"

      ? (
          latest.gps_valid === true
            ? "Vehicle is stationary based on the 5-second acceleration window. GPS fix is available."
            : "Vehicle is stationary based on the 5-second acceleration window. GPS has no current fix."
        )

      : (
          latest.gps_valid === true
            ? `Latest AI result received from ${latest.device_id || "Marg Drishti"} with live GPS.`
            : `Latest AI result received from ${latest.device_id || "Marg Drishti"} — GPS has no current fix.`
        );


  setText(
    "mdLiveMessage",
    liveMessage
  );


  renderMargDrishtiHistory();

  updateMargDrishtiCounters();

}


/* =========================================================
   MARG HISTORY
   ========================================================= */

function renderMargDrishtiHistory(){

  const box =
    $("mdHistory");


  if(!box)
    return;


  if(
    !margDrishtiEvents.length
  ){

    box.innerHTML =
      `<div class="md-empty">No detections have been received yet.</div>`;

    return;

  }


  box.innerHTML = `

    <div class="md-history-head">

      <span>
        CONDITION
      </span>

      <span>
        TIME
      </span>

      <span>
        DEVICE / GPS
      </span>

      <span>
        CONFIDENCE
      </span>

    </div>

    ${margDrishtiEvents
      .slice(0, 50)
      .map(
        event => {

          const condition =
            String(
              event.condition ||
              "UNKNOWN"
            ).toUpperCase();


          const cls =
            margConditionClass(
              condition
            );


          const confidence =
            event.confidence === null ||
            event.confidence === undefined

              ? "—"

              : `${Number(
                  event.confidence
                ).toFixed(1)}%`;


          return `

            <div class="md-event">

              <div class="md-event-condition">

                <span
                  class="md-event-dot ${cls}"
                ></span>

                <div>

                  <strong>
                    ${escapeHTML(
                      condition
                    )}
                  </strong>

                  <small>
                    ${escapeHTML(
                      event.vehicle_status ||
                      "—"
                    )}
                  </small>

                </div>

              </div>


              <div class="md-event-time">

                ${escapeHTML(
                  formatDate(
                    event.created_at
                  )
                )}

              </div>


              <div class="md-event-device">

                <span>
                  ${escapeHTML(
                    event.device_id ||
                    "—"
                  )}
                </span>

                <small>
                  ${escapeHTML(
                    formatMargGpsLocation(
                      event
                    )
                  )}
                </small>

              </div>


              <div class="md-event-confidence">

                ${escapeHTML(
                  confidence
                )}

              </div>

            </div>

          `;

        }
      )
      .join("")}

  `;


  setText(
    "mdHistoryCount",
    `${margDrishtiEvents.length} EVENTS`
  );

}


/* =========================================================
   MARG COUNTERS
   ========================================================= */

function updateMargDrishtiCounters(){

  const counts = {

    normal:
      0,

    breaker:
      0,

    pothole:
      0,

    rough:
      0,

    stationary:
      0

  };


  margDrishtiEvents.forEach(
    event => {

      const cls =
        margConditionClass(
          event.condition
        );


      if(
        Object.prototype.hasOwnProperty.call(
          counts,
          cls
        )
      ){

        counts[cls]++;

      }

    }
  );


  setText(
    "mdNormalCount",
    counts.normal
  );

  setText(
    "mdBreakerCount",
    counts.breaker
  );

  setText(
    "mdPotholeCount",
    counts.pothole
  );

  setText(
    "mdRoughCount",
    counts.rough
  );

  setText(
    "mdStationaryCount",
    counts.stationary
  );

}


/* =========================================================
   MARG REALTIME
   ========================================================= */

function setupMargDrishtiRealtime(){

  if(
    margDrishtiRealtimeChannel
  ){

    return;

  }


  margDrishtiRealtimeChannel =
    supabaseClient
      .channel(
        "marg-drishti-live"
      )
      .on(
        "postgres_changes",
        {
          event:
            "*",

          schema:
            "public",

          table:
            "marg_drishti_events"

        },
        payload => {

          console.log(
            "MARG DRISHTI REALTIME UPDATE:",
            payload
          );


          setText(
            "mdRealtimeState",
            "LIVE"
          );


          loadMargDrishti();

        }
      )
      .subscribe(
        status => {

          console.log(
            "MARG DRISHTI REALTIME STATUS:",
            status
          );


          setText(
            "mdRealtimeState",
            status ===
              "SUBSCRIBED"
              ? "CONNECTED"
              : status
          );


          if(
            status ===
            "SUBSCRIBED"
          ){

            margConnectionState(
              "online",
              "Realtime channel connected"
            );

          }

        }
      );

}


$("refreshMargDrishti")
  ?.addEventListener(
    "click",
    loadMargDrishti
  );


/* =========================================================
   SUPABASE REALTIME
   ========================================================= */

function setupRealtime(){

  if(
    realtimeChannel
  ){

    return realtimeChannel;

  }


  realtimeChannel =
    supabaseClient
      .channel(
        "rhms-live-updates"
      );


  /* -------------------------------------------------------
     PIPE REALTIME
  ------------------------------------------------------- */

  realtimeChannel.on(
    "postgres_changes",
    {
      event:
        "*",

      schema:
        "public",

      table:
        "pipe_status"

    },
    payload => {

      console.log(
        "PIPE REALTIME UPDATE:",
        payload
      );


      loadPipeStatus();

      updateStatistics();

    }
  );


  /* -------------------------------------------------------
     ROAD REPORT REALTIME
  ------------------------------------------------------- */

  realtimeChannel.on(
    "postgres_changes",
    {
      event:
        "*",

      schema:
        "public",

      table:
        "pothole_reports"

    },
    payload => {

      console.log(
        "REPORT REALTIME UPDATE:",
        payload
      );


      refreshReports();

    }
  );


  /* -------------------------------------------------------
     CAMERA REALTIME
  ------------------------------------------------------- */

  realtimeChannel.on(
    "postgres_changes",
    {
      event:
        "INSERT",

      schema:
        "public",

      table:
        "camera_frames"

    },
    payload => {

      console.log(
        "CAMERA REALTIME UPDATE:",
        payload
      );


      loadLatestCamera();

    }
  );


  /* -------------------------------------------------------
     SUBSCRIBE
  ------------------------------------------------------- */

  realtimeChannel.subscribe(
    status => {

      console.log(
        "RHMS REALTIME STATUS:",
        status
      );


      if(
        status ===
        "SUBSCRIBED"
      ){

        showToast(
          "Live updates connected",
          "success"
        );

      }

    }
  );


  return realtimeChannel;

}


/* =========================================================
   CINEMATIC BACKGROUND
   ========================================================= */

function setupCinematicBackground(){

  const canvas =
    $("backgroundCanvas");

  if(!canvas)
    return;

  const ctx =
    canvas.getContext("2d");

  if(!ctx)
    return;


  let width =
    canvas.width =
      window.innerWidth;

  let height =
    canvas.height =
      window.innerHeight;


  const particles =
    [];


  const particleCount =
    Math.min(
      90,
      Math.floor(
        width / 15
      )
    );


  for(
    let i = 0;
    i < particleCount;
    i++
  ){

    particles.push({

      x:
        Math.random() * width,

      y:
        Math.random() * height,

      r:
        Math.random() * 1.8 + 0.4,

      vx:
        (Math.random() - 0.5) * 0.25,

      vy:
        (Math.random() - 0.5) * 0.25

    });

  }


  function resize(){

    width =
      canvas.width =
        window.innerWidth;

    height =
      canvas.height =
        window.innerHeight;

  }


  window.addEventListener(
    "resize",
    resize
  );


  function animate(){

    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    particles.forEach(
      particle => {

        particle.x +=
          particle.vx;

        particle.y +=
          particle.vy;


        if(
          particle.x < 0 ||
          particle.x > width
        ){

          particle.vx *=
            -1;

        }


        if(
          particle.y < 0 ||
          particle.y > height
        ){

          particle.vy *=
            -1;

        }


        ctx.beginPath();

        ctx.arc(
          particle.x,
          particle.y,
          particle.r,
          0,
          Math.PI * 2
        );

        ctx.fill();

      }
    );


    requestAnimationFrame(
      animate
    );

  }


  animate();

}


/* =========================================================
   STARTUP
   ========================================================= */

async function init(){

  buildZones();


  /* -------------------------------------------------------
     SUPABASE KEY CHECK
  ------------------------------------------------------- */

  if(
    !SUPABASE_KEY ||
    SUPABASE_KEY.includes(
      "PASTE_YOUR"
    )
  ){

    setText(
      "systemText",
      "ADD SUPABASE KEY"
    );


    setText(
      "dbStatus",
      "NOT CONFIGURED"
    );


    setText(
      "storageStatus",
      "NOT CONFIGURED"
    );


    showToast(
      "Add your Supabase publishable key in app.js",
      "error"
    );


    return;

  }


  setText(
    "storageStatus",
    "READY"
  );


  /* -------------------------------------------------------
     INITIAL DATA LOAD
  ------------------------------------------------------- */

  await refreshReports();

  await loadPipeStatus();

  await loadLatestCamera();

  await loadMargDrishti();


  /* -------------------------------------------------------
     REALTIME
  ------------------------------------------------------- */

  setupRealtime();

  setupMargDrishtiRealtime();


  /* -------------------------------------------------------
     FALLBACK POLLING
  ------------------------------------------------------- */

  pipePollingTimer =
    setInterval(
      loadPipeStatus,
      5000
    );


  reportPollingTimer =
    setInterval(
      refreshReports,
      15000
    );


  latestCameraTimer =
    setInterval(
      loadLatestCamera,
      10000
    );


  margDrishtiPollingTimer =
    setInterval(
      loadMargDrishti,
      5000
    );

}


/* =========================================================
   START RHMS
   ========================================================= */

setupCinematicBackground();

init();
