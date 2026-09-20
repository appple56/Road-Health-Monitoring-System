const SUPABASE_URL = "https://gphlolodqejrkphspucz.supabase.co";
const SUPABASE_KEY = "sb_publishable_qw-XTj_NaVBZu7Kcd1KTFQ_8K51CgDv";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

const $ = id =>
  document.getElementById(id);

let allReports = [];
let map = null;
let markersLayer = null;

let selectedFile = null;

let userLatitude = null;
let userLongitude = null;

let margDrishtiEvents = [];
let margChannel = null;

let reportChannel = null;
let pipeChannel = null;
let cameraChannel = null;

const pageTitles = {
  dashboard:"Overview",
  visual:"Visual Inspection",
  report:"Report Road Problem",
  map:"Pothole Map",
  gallery:"Image Gallery",
  reports:"Road Reports",
  pipes:"Pipe Monitoring",
  "marg-drishti":"Marg Drishti"
};


/* =========================================================
   HELPERS
========================================================= */

const escapeHTML = value =>
  String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");


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


function formatDate(value){

  if(!value){
    return "—";
  }

  const date =
    new Date(value);

  if(
    Number.isNaN(
      date.getTime()
    )
  ){

    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day:"2-digit",
      month:"short",
      year:"numeric",
      hour:"2-digit",
      minute:"2-digit"
    }
  );

}


function formatTime(){

  return new Date()
    .toLocaleTimeString(
      "en-IN",
      {
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit"
      }
    );

}


function showToast(
  message,
  type = ""
){

  const toast =
    $("toast");

  if(!toast){
    return;
  }

  toast.textContent =
    message;

  toast.className =
    `toast show ${type}`;

  clearTimeout(
    window.__toast
  );

  window.__toast =
    setTimeout(
      () => {
        toast.className =
          "toast";
      },
      2800
    );

}


function statusClass(
  status
){

  return String(
    status || ""
  )
    .toLowerCase()
    .replaceAll(
      " ",
      "-"
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(
  pageId
){

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      page =>
        page.classList.remove(
          "active"
        )
    );

  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(
      button =>
        button.classList.remove(
          "active"
        )
    );

  const page =
    $(pageId);

  const nav =
    document.querySelector(
      `.nav-btn[data-page="${pageId}"]`
    );

  if(page){
    page.classList.add(
      "active"
    );
  }

  if(nav){
    nav.classList.add(
      "active"
    );
  }

  setText(
    "pageTitle",
    pageTitles[pageId] ||
    "RHMS"
  );

  if(
    pageId === "map"
  ){

    setTimeout(
      () => {

        initMap();

        if(map){
          map.invalidateSize(
            true
          );
        }

        renderMarkers();

      },
      80
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

}


document
  .querySelectorAll(
    ".nav-btn"
  )
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


document
  .querySelectorAll(
    "[data-jump]"
  )
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


setText(
  "currentDate",
  new Date()
    .toLocaleDateString(
      "en-IN",
      {
        day:"2-digit",
        month:"short",
        year:"numeric"
      }
    )
);


/* =========================================================
   REPORT DATA
========================================================= */

async function fetchReports(){

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "pothole_reports"
      )
      .select(
        "*"
      )
      .order(
        "reported_at",
        {
          ascending:false
        }
      );

  if(error){

    setText(
      "dbStatus",
      "ERROR"
    );

    setText(
      "systemText",
      "DATABASE ERROR"
    );

    console.error(
      error
    );

    return [];

  }

  setText(
    "dbStatus",
    "CONNECTED"
  );

  setText(
    "systemText",
    "SYSTEM ONLINE"
  );

  setText(
    "lastSync",
    formatTime()
  );

  return data || [];

}


async function refreshReports(){

  allReports =
    await fetchReports();

  renderRecent();
  renderReports();
  renderGallery();
  updateStats();

  if(map){
    renderMarkers();
  }

}


async function updateStats(){

  setText(
    "totalReports",
    allReports.length
  );

  setText(
    "pendingReports",
    allReports.filter(
      report =>
        String(
          report.status
        )
          .toLowerCase() ===
        "pending"
    ).length
  );

  setText(
    "verifiedReports",
    allReports.filter(
      report =>
        String(
          report.status
        )
          .toLowerCase() ===
        "verified"
    ).length
  );

  const {
    data
  } =
    await supabaseClient
      .from(
        "pipe_status"
      )
      .select(
        "status"
      );

  setText(
    "activeLeaks",
    data
      ? data.filter(
          row =>
            String(
              row.status
            )
              .toUpperCase() ===
            "LEAK"
        ).length

      : "—"
  );

}


function renderRecent(){

  const box =
    $("recentReports");

  if(!box){
    return;
  }

  if(
    !allReports.length
  ){

    box.innerHTML =
      `
        <div class="empty-state">
          No field reports yet.
        </div>
      `;

    return;

  }

  box.innerHTML =
    allReports
      .slice(
        0,
        5
      )
      .map(
        report => `

          <div class="list-item">

            <img
              class="thumb"
              src="${escapeHTML(
                report.image_url || ""
              )}"
              onerror="
                this.style.visibility='hidden'
              "
            >

            <div>

              <strong>
                ${escapeHTML(
                  report.problem_type ||
                  "Road report"
                )}
              </strong>

              <small>
                ${escapeHTML(
                  report.description ||
                  "No description"
                )}
                ·
                ${formatDate(
                  report.reported_at
                )}
              </small>

            </div>

            <span class="badge">
              ${escapeHTML(
                report.severity ||
                report.status ||
                "Pending"
              )}
            </span>

          </div>

        `
      )
      .join("");

}


function renderReports(){

  const box =
    $("reportsList");

  if(!box){
    return;
  }

  if(
    !allReports.length
  ){

    box.innerHTML =
      `
        <div class="empty-state">
          No reports have been submitted yet.
        </div>
      `;

    return;

  }

  box.innerHTML =
    allReports
      .map(
        report => `

          <div class="report-row">

            <div class="report-main">

              <img
                class="report-image"
                src="${escapeHTML(
                  report.image_url || ""
                )}"
                onerror="
                  this.style.opacity=.2
                "
              >

              <div>

                <div class="report-id">
                  REPORT #
                  ${escapeHTML(
                    report.id
                  )}
                </div>

                <div class="report-title">
                  ${escapeHTML(
                    report.description ||
                    report.problem_type ||
                    "Road report"
                  )}
                </div>

              </div>

            </div>


            <div class="report-type">
              ${escapeHTML(
                report.problem_type ||
                "—"
              )}
            </div>


            <div>

              <span
                class="
                  status-pill
                  ${statusClass(
                    report.status
                  )}
                "
              >
                ${escapeHTML(
                  report.status ||
                  "Pending"
                )}
              </span>

            </div>


            <div class="report-time">

              ${escapeHTML(
                report.severity ||
                "N/A"
              )}

              <br>

              ${escapeHTML(
                formatDate(
                  report.reported_at
                )
              )}

            </div>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   STORAGE / GALLERY
========================================================= */

function getImageURL(
  value,
  bucket = "pothole-images"
){

  if(!value){
    return "";
  }

  const raw =
    String(
      value
    ).trim();

  if(
    /^https?:\/\//i.test(
      raw
    )
  ){

    return raw;

  }

  const clean =
    raw
      .replace(
        /^\/+/,
        ""
      )
      .replace(
        new RegExp(
          `^${bucket}\\/`
        ),
        ""
      );

  return (
    supabaseClient
      .storage
      .from(
        bucket
      )
      .getPublicUrl(
        clean
      )
      ?.data
      ?.publicUrl
  ) || "";

}


function renderGallery(){

  const box =
    $("galleryGrid");

  if(!box){
    return;
  }

  const search =
    (
      $("gallerySearch")
        ?.value ||
      ""
    )
      .toLowerCase()
      .trim();

  const filter =
    $("galleryFilter")
      ?.value ||
    "all";

  const reports =
    allReports
      .filter(
        report => {

          const searchMatch =
            !search ||

            String(
              report.problem_type ||
              ""
            )
              .toLowerCase()
              .includes(
                search
              ) ||

            String(
              report.description ||
              ""
            )
              .toLowerCase()
              .includes(
                search
              );

          const filterMatch =
            filter === "all" ||

            String(
              report.status ||
              ""
            )
              .toLowerCase() ===
            filter.toLowerCase();

          return (
            searchMatch &&
            filterMatch
          );

        }
      )
      .map(
        report => ({
          ...report,

          url:
            getImageURL(
              report.image_url
            )
        })
      )
      .filter(
        report =>
          report.url
      );

  if(
    !reports.length
  ){

    box.innerHTML =
      `
        <div class="panel">
          No images found.
        </div>
      `;

    return;

  }

  box.innerHTML =
    reports
      .map(
        report => `

          <article class="gallery-card">

            <img
              src="${escapeHTML(
                report.url
              )}"
              alt="Road report"
            >

            <div class="gallery-body">

              <h3>
                ${escapeHTML(
                  report.problem_type ||
                  "Road report"
                )}
              </h3>

              <p>
                ${escapeHTML(
                  report.description ||
                  "No description"
                )}
              </p>

              <div class="gallery-meta">

                <span
                  class="
                    status-pill
                    ${statusClass(
                      report.status
                    )}
                  "
                >
                  ${escapeHTML(
                    report.severity ||
                    report.status ||
                    "Pending"
                  )}
                </span>

                <small>
                  ${escapeHTML(
                    formatDate(
                      report.reported_at
                    )
                  )}
                </small>

              </div>

            </div>

          </article>

        `
      )
      .join("");

}


$("gallerySearch")
  ?.addEventListener(
    "input",
    renderGallery
  );


$("galleryFilter")
  ?.addEventListener(
    "change",
    renderGallery
  );


$("refreshGallery")
  ?.addEventListener(
    "click",
    refreshReports
  );


/* =========================================================
   MAP
========================================================= */

function initMap(){

  if(
    map ||
    !window.L ||
    !$("potholeMap")
  ){

    return;

  }

  map =
    L.map(
      "potholeMap"
    )
      .setView(
        [
          28.6139,
          77.2090
        ],
        11
      );

  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom:19,
      attribution:
        "&copy; OpenStreetMap contributors"
    }
  )
    .addTo(
      map
    );

  markersLayer =
    L.layerGroup()
      .addTo(
        map
      );

}


function markerColor(
  status
){

  const value =
    String(
      status || ""
    )
      .toLowerCase();

  return value === "verified"
    ? "#42e8a1"

    : value === "resolved"
      ? "#31e7ff"

      : "#ff9f43";

}


function renderMarkers(){

  if(
    !map ||
    !markersLayer
  ){

    return;

  }

  markersLayer.clearLayers();

  const bounds =
    [];

  let count =
    0;

  allReports.forEach(
    report => {

      const lat =
        Number(
          report.latitude
        );

      const lng =
        Number(
          report.longitude
        );

      if(
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ){

        return;

      }

      count++;

      bounds.push(
        [
          lat,
          lng
        ]
      );

      const color =
        markerColor(
          report.status
        );

      const icon =
        L.divIcon(
          {
            className:"",
            html:
              `
                <div
                  style="
                    width:16px;
                    height:16px;
                    border-radius:50%;
                    background:${color};
                    border:3px solid #071018;
                    box-shadow:
                      0 0 0 5px ${color}33;
                  "
                ></div>
              `,
            iconSize:[
              16,
              16
            ],
            iconAnchor:[
              8,
              8
            ]
          }
        );

      const popup =
        `
          <b>
            ${escapeHTML(
              report.problem_type ||
              "Road report"
            )}
          </b>

          <br>

          Status:
          <b>
            ${escapeHTML(
              report.status ||
              "Pending"
            )}
          </b>

          <br>

          Severity:
          <b>
            ${escapeHTML(
              report.severity ||
              "N/A"
            )}
          </b>

          <br>

          Depth:
          <b>
            ${escapeHTML(
              report.pothole_depth ||
              "—"
            )}
          </b>

          <br>

          Size:
          <b>
            ${escapeHTML(
              report.pothole_size ||
              "—"
            )}
          </b>

          <br>

          ${escapeHTML(
            report.description ||
            ""
          )}

          <br>

          GPS:
          <b>
            ${lat.toFixed(6)},
            ${lng.toFixed(6)}
          </b>
        `;

      L.marker(
        [
          lat,
          lng
        ],
        {
          icon
        }
      )
        .bindPopup(
          popup
        )
        .addTo(
          markersLayer
        );

    }
  );

  setText(
    "mapCount",
    count
  );

  if(
    bounds.length &&
    $("map").classList.contains(
      "active"
    )
  ){

    map.fitBounds(
      bounds,
      {
        padding:[
          30,
          30
        ],
        maxZoom:16
      }
    );

  }

}


$("fitMarkersBtn")
  ?.addEventListener(
    "click",
    () => {

      if(map){
        renderMarkers();
      }

    }
  );


/* =========================================================
   REPORT IMAGE
========================================================= */

function handleSelectedFile(
  file
){

  if(!file){
    return;
  }

  if(
    !file.type.startsWith(
      "image/"
    )
  ){

    showFormStatus(
      "Please choose an image file.",
      true
    );

    return;

  }

  if(
    file.size >
    10 * 1024 * 1024
  ){

    showFormStatus(
      "Image is larger than 10 MB.",
      true
    );

    return;

  }

  selectedFile =
    file;

  $("uploadZone")
    .classList.add(
      "has-image"
    );

  setText(
    "uploadTitle",
    file.name
  );

  const reader =
    new FileReader();

  reader.onload =
    event => {

      $("previewImageBox")
        .innerHTML =
        `
          <img
            src="${event.target.result}"
            alt="Preview"
          >
        `;

    };

  reader.readAsDataURL(
    file
  );

}


$("potholeImage")
  ?.addEventListener(
    "change",
    event =>
      handleSelectedFile(
        event.target.files[0]
      )
  );


$("uploadZone")
  ?.addEventListener(
    "dragover",
    event =>
      event.preventDefault()
  );


$("uploadZone")
  ?.addEventListener(
    "drop",
    event => {

      event.preventDefault();

      handleSelectedFile(
        event.dataTransfer.files[0]
      );

    }
  );


/* =========================================================
   POTHOLE SEVERITY
========================================================= */

function potholeDepthScore(
  value
){

  return {
    "Less than 2 cm":1,
    "2–5 cm":2,
    "5–10 cm":3,
    "10–20 cm":4,
    "More than 20 cm":5
  }[
    value
  ] || 0;

}


function potholeSizeScore(
  value
){

  return {
    "Small (< 0.25 m²)":1,
    "Medium (0.25–1 m²)":2,
    "Large (1–2.5 m²)":3,
    "Very large (> 2.5 m²)":4
  }[
    value
  ] || 0;

}


function calculateSeverity(
  depth,
  size
){

  if(
    !depth ||
    !size
  ){

    return {
      grade:
        "SELECT DATA",

      className:
        "none",

      message:
        "Select both depth and size to calculate severity."
    };

  }

  const score =
    potholeDepthScore(
      depth
    )
    +
    potholeSizeScore(
      size
    );

  if(
    score <= 2
  ){

    return {
      grade:
        "LOW",

      className:
        "low",

      message:
        "Small/shallow pothole. Lower immediate road impact."
    };

  }

  if(
    score <= 4
  ){

    return {
      grade:
        "MODERATE",

      className:
        "moderate",

      message:
        "Moderate defect. Repair should be scheduled."
    };

  }

  if(
    score <= 6
  ){

    return {
      grade:
        "HIGH",

      className:
        "high",

      message:
        "Large/deep defect. Priority repair is recommended for the RHMS workflow."
    };

  }

  return {
    grade:
      "CRITICAL",

    className:
      "critical",

    message:
      "Very large/deep defect. Treat as the highest-priority RHMS field alert."
  };

}


function updatePotholeAssessment(){

  const isPothole =
    $("problemType")?.value ===
    "Pothole";

  const box =
    $("potholeMeasurements");

  const depth =
    $("potholeDepth")?.value ||
    "";

  const size =
    $("potholeSize")?.value ||
    "";

  if(box){

    box.classList.toggle(
      "hidden",
      !isPothole
    );

  }

  if(
    !isPothole
  ){

    $("severityBadge").className =
      "severity none";

    setText(
      "severityBadge",
      "N/A"
    );

    setText(
      "severityExplain",
      "Severity grading is available for pothole reports."
    );

    setText(
      "previewDepth",
      "Depth: —"
    );

    setText(
      "previewSize",
      "Size: —"
    );

    setText(
      "previewSeverity",
      "Severity: N/A"
    );

    return;

  }

  const result =
    calculateSeverity(
      depth,
      size
    );

  $("severityBadge").className =
    `severity ${result.className}`;

  setText(
    "severityBadge",
    result.grade
  );

  setText(
    "severityExplain",
    result.message
  );

  setText(
    "previewDepth",
    `Depth: ${depth || "—"}`
  );

  setText(
    "previewSize",
    `Size: ${size || "—"}`
  );

  setText(
    "previewSeverity",
    `Severity: ${result.grade}`
  );

}


$("problemType")
  ?.addEventListener(
    "change",
    () => {

      setText(
        "previewType",
        $("problemType").value
      );

      updatePotholeAssessment();

    }
  );


$("description")
  ?.addEventListener(
    "input",
    () => {

      setText(
        "previewDescription",
        $("description").value ||
        "No description yet"
      );

    }
  );


$("potholeDepth")
  ?.addEventListener(
    "change",
    updatePotholeAssessment
  );


$("potholeSize")
  ?.addEventListener(
    "change",
    updatePotholeAssessment
  );


function showFormStatus(
  message,
  error = false
){

  const status =
    $("reportStatus");

  if(!status){
    return;
  }

  status.textContent =
    message;

  status.className =
    `form-status ${
      error
        ? "error"
        : "success"
    }`;

}


function getLocation(){

  if(
    !navigator.geolocation
  ){

    showFormStatus(
      "Geolocation is not supported by this browser.",
      true
    );

    return;

  }

  setText(
    "locationText",
    "Detecting location…"
  );

  navigator
    .geolocation
    .getCurrentPosition(

      position => {

        userLatitude =
          position.coords.latitude;

        userLongitude =
          position.coords.longitude;

        $("latitude").value =
          userLatitude;

        $("longitude").value =
          userLongitude;

        const text =
          `
            ${userLatitude.toFixed(6)},
            ${userLongitude.toFixed(6)}
          `.trim();

        setText(
          "locationText",
          text
        );

        setText(
          "previewLocation",
          `GPS ${text}`
        );

        showFormStatus(
          "Location captured."
        );

      },

      () => {

        setText(
          "locationText",
          "Location permission denied"
        );

        showFormStatus(
          "Please allow location access, then try again.",
          true
        );

      },

      {
        enableHighAccuracy:true,
        timeout:12000,
        maximumAge:0
      }

    );

}


$("locationBtn")
  ?.addEventListener(
    "click",
    getLocation
  );


/* =========================================================
   SUBMIT REPORT
========================================================= */

async function submitReport(){

  if(
    !selectedFile
  ){

    showFormStatus(
      "Please select an image.",
      true
    );

    return;

  }

  if(
    userLatitude === null ||
    userLongitude === null
  ){

    showFormStatus(
      "Please detect your location first.",
      true
    );

    return;

  }

  const isPothole =
    $("problemType").value ===
    "Pothole";

  const depth =
    $("potholeDepth").value;

  const size =
    $("potholeSize").value;

  if(
    isPothole &&
    (
      !depth ||
      !size
    )
  ){

    showFormStatus(
      "Please select pothole depth and size before submitting.",
      true
    );

    return;

  }

  const button =
    $("submitReportBtn");

  button.disabled =
    true;

  button.textContent =
    "Uploading…";

  try{

    const extension =
      (
        selectedFile.name
          .split(".")
          .pop() ||
        "jpg"
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        ) ||
      "jpg";

    const randomId =
      window.crypto &&
      window.crypto.randomUUID

        ? window.crypto.randomUUID()

        : Math.random()
            .toString(36)
            .slice(2);

    const fileName =
      `
        report-${Date.now()}-${randomId}.${extension}
      `.replace(
        /\s+/g,
        ""
      );

    const {
      error:
        uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "pothole-images"
        )
        .upload(
          fileName,
          selectedFile,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              selectedFile.type ||
              "image/jpeg"
          }
        );

    if(
      uploadError
    ){

      throw new Error(
        `Storage upload failed: ${uploadError.message}`
      );

    }

    const imageURL =
      supabaseClient
        .storage
        .from(
          "pothole-images"
        )
        .getPublicUrl(
          fileName
        )
        ?.data
        ?.publicUrl;

    if(
      !imageURL
    ){

      throw new Error(
        "Supabase did not return an image URL."
      );

    }

    const severity =
      isPothole

        ? calculateSeverity(
            depth,
            size
          ).grade

        : "N/A";

    const payload = {

      latitude:
        userLatitude,

      longitude:
        userLongitude,

      image_url:
        imageURL,

      problem_type:
        $("problemType").value,

      description:
        $("description").value.trim(),

      pothole_depth:
        isPothole
          ? depth
          : null,

      pothole_size:
        isPothole
          ? size
          : null,

      severity:

        isPothole
          ? severity
          : "N/A",

      status:
        "Pending"

    };

    const {
      error:
        databaseError
    } =
      await supabaseClient
        .from(
          "pothole_reports"
        )
        .insert(
          payload
        );

    if(
      databaseError
    ){

      throw new Error(
        `Database insert failed: ${databaseError.message}`
      );

    }

    showFormStatus(
      "✓ Report submitted successfully."
    );

    showToast(
      "Report uploaded successfully",
      "success"
    );

    resetForm();

    await refreshReports();

    setTimeout(
      () => {
        showPage(
          "reports"
        );
      },
      700
    );

  }
  catch(error){

    console.error(
      error
    );

    showFormStatus(
      error.message ||
      "Upload failed.",
      true
    );

    showToast(
      "Report upload failed",
      "error"
    );

  }
  finally{

    button.disabled =
      false;

    button.textContent =
      "Submit report →";

  }

}


$("submitReportBtn")
  ?.addEventListener(
    "click",
    submitReport
  );


function resetForm(){

  selectedFile =
    null;

  userLatitude =
    null;

  userLongitude =
    null;

  $("potholeImage").value =
    "";

  $("description").value =
    "";

  $("problemType").value =
    "Pothole";

  $("potholeDepth").value =
    "";

  $("potholeSize").value =
    "";

  $("latitude").value =
    "";

  $("longitude").value =
    "";

  $("uploadZone")
    .classList.remove(
      "has-image"
    );

  setText(
    "uploadTitle",
    "Drop image here or click to browse"
  );

  $("previewImageBox")
    .innerHTML =
    "IMAGE PREVIEW";

  setText(
    "locationText",
    "Location not captured"
  );

  setText(
    "previewType",
    "Pothole"
  );

  setText(
    "previewDescription",
    "No description yet"
  );

  setText(
    "previewDepth",
    "Depth: —"
  );

  setText(
    "previewSize",
    "Size: —"
  );

  setText(
    "previewSeverity",
    "Severity: SELECT DATA"
  );

  setText(
    "previewLocation",
    "Location pending"
  );

  updatePotholeAssessment();

}


updatePotholeAssessment();


/* =========================================================
   PIPES
========================================================= */

const zoneMap = {
  A1:13,
  A2:14,
  A3:18,
  A4:19,
  B1:21,
  B2:22,
  B3:25,
  B4:26
};


function zoneHTML(
  zone
){

  return `
    <div
      class="zone"
      id="zone-${zone}"
    >

      <b>
        ${zone}
      </b>

      <span>
        NORMAL
      </span>

      <small>
        GPIO ${zoneMap[zone]}
      </small>

    </div>
  `;

}


function buildZones(){

  if(
    $("zonesA")
  ){

    $("zonesA").innerHTML =
      [
        "A1",
        "A2",
        "A3",
        "A4"
      ]
        .map(
          zone =>
            zoneHTML(
              zone
            )
        )
        .join("");

  }

  if(
    $("zonesB")
  ){

    $("zonesB").innerHTML =
      [
        "B1",
        "B2",
        "B3",
        "B4"
      ]
        .map(
          zone =>
            zoneHTML(
              zone
            )
        )
        .join("");

  }

}


async function loadPipeStatus(){

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "pipe_status"
        )
        .select(
          "zone,status"
        );

    if(
      error
    ){

      throw error;

    }

    const leaks = [];

    (
      data ||
      []
    )
      .forEach(
        row => {

          const raw =
            String(
              row.zone ||
              ""
            )
              .toUpperCase();

          const normalized =
            {
              A:"A1",
              B:"A2",
              C:"A3",
              D:"A4",
              E:"B1",
              F:"B2",
              G:"B3",
              H:"B4"
            }[
              raw
            ] ||
            raw;

          const element =
            $(
              `zone-${normalized}`
            );

          if(!element){
            return;
          }

          const leak =
            String(
              row.status ||
              ""
            )
              .toUpperCase() ===
            "LEAK";

          element.className =
            `zone ${
              leak
                ? "leak"
                : ""
            }`;

          const text =
            element.querySelector(
              "span"
            );

          if(text){
            text.textContent =
              leak
                ? "LEAK"
                : "NORMAL";
          }

          if(leak){
            leaks.push(
              normalized
            );
          }

        }
      );

    setText(
      "pipeConnection",
      "LIVE"
    );

    setText(
      "lastPipePoll",
      formatTime()
    );

    setText(
      "activeLeaks",
      leaks.length
    );

    setText(
      "pipeAState",
      leaks.some(
        zone =>
          zone.startsWith(
            "A"
          )
      )
        ? "ALERT"
        : "STABLE"
    );

    setText(
      "pipeBState",
      leaks.some(
        zone =>
          zone.startsWith(
            "B"
          )
      )
        ? "ALERT"
        : "STABLE"
    );

    $("pipeAlert")
      .classList.toggle(
        "show",
        leaks.length >
        0
      );

    setText(
      "pipeAlertTitle",
      leaks.length
        ? "PIPELINE LEAK DETECTED"
        : "PIPELINE ALERT"
    );

    setText(
      "pipeAlertText",
      leaks.length
        ? `${leaks.join(", ")} reporting active leakage.`
        : "All zones normal."
    );

  }
  catch(error){

    console.error(
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
        .from(
          "camera_frames"
        )
        .select(
          "image_url,captured_at,device_id"
        )
        .order(
          "captured_at",
          {
            ascending:false
          }
        )
        .limit(
          1
        );

    if(
      error
    ){

      throw error;

    }

    if(
      !data ||
      !data.length
    ){

      setText(
        "cameraStatus",
        "WAITING"
      );

      setText(
        "cameraCloudState",
        "WAITING"
      );

      return;

    }

    const row =
      data[0];

    const url =
      getImageURL(
        row.image_url,
        "camera-images"
      );

    const image =
      $("cameraStream");

    if(url){

      image.src =
        url;

      image.style.display =
        "block";

      $("cameraPlaceholder")
        .style.display =
        "none";

      setText(
        "cameraStatus",
        "LIVE"
      );

    }
    else{

      setText(
        "cameraStatus",
        "NO IMAGE"
      );

    }

    setText(
      "cameraCloudState",
      "LATEST FRAME"
    );

    setText(
      "cameraCloudTime",
      formatDate(
        row.captured_at
      )
    );

  }
  catch(error){

    console.error(
      error
    );

    setText(
      "cameraStatus",
      "ERROR"
    );

    setText(
      "cameraCloudState",
      "DATABASE ERROR"
    );

  }

}


$("refreshCameraBtn")
  ?.addEventListener(
    "click",
    loadLatestCamera
  );


/* =========================================================
   MARG DRISHTI
========================================================= */

function margClass(
  condition
){

  const value =
    String(
      condition ||
      ""
    )
      .toUpperCase();

  if(
    value ===
    "NORMAL ROAD"
  ){
    return "normal";
  }

  if(
    value ===
    "SPEED BREAKER"
  ){
    return "breaker";
  }

  if(
    value ===
    "POTHOLE"
  ){
    return "pothole";
  }

  if(
    value ===
    "ROUGH SURFACE"
  ){
    return "rough";
  }

  if(
    value ===
    "VEHICLE STATIONARY"
  ){
    return "stationary";
  }

  return "unknown";

}


function margIcon(
  condition
){

  const value =
    String(
      condition ||
      ""
    )
      .toUpperCase();

  if(
    value ===
    "NORMAL ROAD"
  ){
    return "✓";
  }

  if(
    value ===
    "SPEED BREAKER"
  ){
    return "▲";
  }

  if(
    value ===
    "POTHOLE"
  ){
    return "⚠";
  }

  if(
    value ===
    "ROUGH SURFACE"
  ){
    return "≈";
  }

  if(
    value ===
    "VEHICLE STATIONARY"
  ){
    return "■";
  }

  return "◈";

}


function gpsLocation(
  event
){

  if(
    event?.gps_valid !== true ||
    event.latitude == null ||
    event.longitude == null
  ){

    return "NO FIX";

  }

  return `
    ${Number(
      event.latitude
    ).toFixed(6)},
    ${Number(
      event.longitude
    ).toFixed(6)}
  `
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function gpsSpeed(
  event
){

  if(
    event?.gps_valid !== true ||
    event.gps_speed_kmph == null
  ){

    return "—";

  }

  return `
    ${Number(
      event.gps_speed_kmph
    ).toFixed(1)}
    km/h
  `
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function gpsStatus(
  event
){

  if(
    !event?.gps_valid
  ){

    return "NO FIX";

  }

  const satellites =
    Number(
      event.gps_satellites ||
      0
    );

  return satellites
    ? `FIXED · ${satellites} SAT`
    : "FIXED";

}


function margDeviceState(
  event
){

  if(!event){

    return {
      state:"error",
      text:"Waiting for device data"
    };

  }

  const age =
    Date.now() -
    new Date(
      event.created_at
    )
      .getTime();

  if(
    age <= 15000
  ){

    return {
      state:"online",
      text:"Marg Drishti device online"
    };

  }

  if(
    age <= 30000
  ){

    return {
      state:"stale",
      text:"Device data is delayed"
    };

  }

  return {
    state:"error",
    text:"Marg Drishti device offline"
  };

}


function setMargConnection(
  state,
  text
){

  const chip =
    $("mdConnectionChip");

  const dot =
    $("mdConnectionDot");

  if(chip){

    chip.className =
      `badge ${
        state === "online"
          ? "online"
          : state === "error"
            ? "danger"
            : ""
      }`;

    chip.textContent =
      state === "online"
        ? "LIVE"
        : state.toUpperCase();

  }

  if(dot){

    dot.className =
      state === "online"
        ? "online"
        : state === "error"
          ? "error"
          : "";

  }

  setText(
    "mdConnectionText",
    text
  );

  setText(
    "margDrishtiConnection",
    state === "online"
      ? "LIVE"
      : state.toUpperCase()
  );

}


async function loadMargDrishti(){

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "marg_drishti_events"
        )
        .select(
          `
          id,
          device_id,
          condition,
          vehicle_status,
          confidence,
          latitude,
          longitude,
          gps_speed_kmph,
          gps_valid,
          gps_satellites,
          created_at
          `
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(
          50
        );

    if(
      error
    ){

      throw error;

    }

    margDrishtiEvents =
      data || [];

    setText(
      "mdDatabaseState",
      "CONNECTED"
    );

    renderMargDrishti();

  }
  catch(error){

    console.error(
      error
    );

    setText(
      "mdDatabaseState",
      "ERROR"
    );

    setMargConnection(
      "error",
      "Database connection error"
    );

  }

}


function renderMargDrishti(){

  const latest =
    margDrishtiEvents[0];

  if(!latest){

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
      "mdDeviceId",
      "—"
    );

    setText(
      "mdLastUpdate",
      "—"
    );

    setText(
      "mdHistoryCount",
      "0 EVENTS"
    );

    return;

  }

  const condition =
    String(
      latest.condition ||
      "UNKNOWN"
    )
      .toUpperCase();

  const conditionClass =
    margClass(
      condition
    );

  const panel =
    $("mdStatusPanel");

  if(panel){

    panel.dataset.condition =
      conditionClass;

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
    "mdConditionIcon",
    margIcon(
      condition
    )
  );

  setText(
    "mdVehicleStatus",
    latest.vehicle_status ||
    "—"
  );

  setText(
    "mdConfidence",
    latest.confidence == null

      ? "—"

      : `${Number(
          latest.confidence
        ).toFixed(1)}%`
  );

  setText(
    "mdGpsLocation",
    gpsLocation(
      latest
    )
  );

  setText(
    "mdGpsSpeed",
    gpsSpeed(
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
    "mdGpsConnectionState",
    gpsStatus(
      latest
    )
  );

  const deviceState =
    margDeviceState(
      latest
    );

  setText(
    "mdDeviceLinkState",

    deviceState.state ===
      "online"

      ? "ONLINE"

      : deviceState.state ===
        "stale"

        ? "STALE"

        : "OFFLINE"
  );

  setMargConnection(
    deviceState.state,
    deviceState.text
  );

  setText(
    "mdLiveMessage",

    latest.gps_valid

      ? `Latest AI result received with live GPS from ${
          latest.device_id ||
          "Marg Drishti"
        }.`

      : "Latest AI result received — GPS has no current fix."
  );

  const counts = {
    normal:0,
    breaker:0,
    pothole:0,
    rough:0,
    stationary:0
  };

  margDrishtiEvents.forEach(
    event => {

      const key =
        margClass(
          event.condition
        );

      if(
        counts[key] !==
        undefined
      ){

        counts[key]++;

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

  const history =
    $("mdHistory");

  history.innerHTML =
    `
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
    `

    +

    margDrishtiEvents
      .map(
        event => {

          const condition =
            String(
              event.condition ||
              "UNKNOWN"
            )
              .toUpperCase();

          return `
            <div class="md-event">

              <div class="md-event-condition">

                <i
                  class="
                    md-event-dot
                    ${margClass(
                      condition
                    )}
                  "
                ></i>

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
                    gpsLocation(
                      event
                    )
                  )}
                </small>

              </div>

              <div class="md-event-confidence">

                ${
                  event.confidence == null
                    ? "—"
                    : `${Number(
                        event.confidence
                      ).toFixed(1)}%`
                }

              </div>

            </div>
          `;

        }
      )
      .join("");

  setText(
    "mdHistoryCount",
    `${margDrishtiEvents.length} EVENTS`
  );

}


function setupMargRealtime(){

  if(
    margChannel
  ){

    return;

  }

  margChannel =
    supabaseClient

      .channel(
        "marg-drishti-live"
      )

      .on(
        "postgres_changes",
        {
          event:"INSERT",
          schema:"public",
          table:"marg_drishti_events"
        },
        () => {
          loadMargDrishti();
        }
      )

      .subscribe(
        status => {

          setText(
            "mdRealtimeState",
            status ===
              "SUBSCRIBED"

              ? "CONNECTED"

              : status
          );

        }
      );

}


$("refreshMargDrishti")
  ?.addEventListener(
    "click",
    loadMargDrishti
  );


/* =========================================================
   GLOBAL REALTIME
========================================================= */

async function setupRealtime(){

  if(
    reportChannel
  ){

    return;

  }

  reportChannel =
    supabaseClient

      .channel(
        "rhms-reports"
      )

      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table:"pothole_reports"
        },
        () => {
          refreshReports();
        }
      )

      .subscribe();

  pipeChannel =
    supabaseClient

      .channel(
        "rhms-pipes"
      )

      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table:"pipe_status"
        },
        () => {
          loadPipeStatus();
        }
      )

      .subscribe();

  cameraChannel =
    supabaseClient

      .channel(
        "rhms-camera"
      )

      .on(
        "postgres_changes",
        {
          event:"INSERT",
          schema:"public",
          table:"camera_frames"
        },
        () => {
          loadLatestCamera();
        }
      )

      .subscribe();

  setupMargRealtime();

}


/* =========================================================
   STARTUP
========================================================= */

async function init(){

  buildZones();

  updatePotholeAssessment();

  await refreshReports();

  await loadPipeStatus();

  await loadLatestCamera();

  await loadMargDrishti();

  await setupRealtime();

  setInterval(
    loadPipeStatus,
    5000
  );

  setInterval(
    loadLatestCamera,
    10000
  );

  setInterval(
    refreshReports,
    15000
  );

  setInterval(
    loadMargDrishti,
    5000
  );

}

init();
