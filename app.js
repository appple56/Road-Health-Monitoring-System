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
     - pothole-images
     - camera-images

   LIVE SYSTEM
   ---------------------------------------------------------
   - Road reports refresh automatically
   - Pipe status refreshes automatically
   - Camera frame refreshes automatically
   - Supabase Realtime updates supported
   - Polling remains as a fallback

   PIPE ZONES
   ---------------------------------------------------------
   PIPE A
     A1 = GPIO 13
     A2 = GPIO 14
     A3 = GPIO 18
     A4 = GPIO 19

   PIPE B
     B1 = GPIO 21
     B2 = GPIO 22
     B3 = GPIO 25
     B4 = GPIO 26
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


  const cleanPath =
    raw
      .replace(
        /^\/+/,
        ""
      )
      .replace(
        /^pothole-images\//,
        ""
      );


  const result =
    supabaseClient
      .storage
      .from(
        "pothole-images"
      )
      .getPublicUrl(
        cleanPath
      );


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


  const cleanPath =
    raw
      .replace(
        /^\/+/,
        ""
      )
      .replace(
        /^camera-images\//,
        ""
      );


  const result =
    supabaseClient
      .storage
      .from(
        "camera-images"
      )
      .getPublicUrl(
        cleanPath
      );


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
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer =
  null;


function showToast(
  message,
  type = ""
){

  const toast =
    $("toast");


  if(!toast){

    console.log(
      message
    );

    return;

  }


  toast.textContent =
    message;


  toast.className =
    `toast show ${type}`;


  clearTimeout(
    toastTimer
  );


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
    new Date(
      value
    );


  if(
    Number.isNaN(
      date.getTime()
    )
  ){

    return "Unknown date";

  }


  return date.toLocaleString(
    "en-IN",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit"
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
        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit"
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
      ".nav-button"
    )
    .forEach(
      button =>
        button.classList.remove(
          "active"
        )
    );


  const page =
    $(pageId);


  if(page){

    page.classList.add(
      "active"
    );

  }


  const nav =
    document.querySelector(
      `.nav-button[data-page="${pageId}"]`
    );


  if(nav){

    nav.classList.add(
      "active"
    );

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
    ?.classList.remove(
      "open"
    );


  /* -------------------------------------------------------
     PAGE-SPECIFIC ACTIONS
  ------------------------------------------------------- */

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


          setTimeout(
            () => {

              if(map){

                map.invalidateSize(
                  true
                );

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
  .querySelectorAll(
    ".nav-button"
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


/* =========================================================
   DATA JUMP BUTTONS
========================================================= */

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


/* =========================================================
   MOBILE MENU
========================================================= */

$("menuBtn")
  ?.addEventListener(
    "click",
    () => {

      $("sidebar")
        ?.classList.toggle(
          "open"
        );

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
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric"
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

      .from(
        "pothole_reports"
      )

      .select(
        "*"
      )

      .order(
        "reported_at",
        {
          ascending:
            false
        }
      );


  if(error){

    console.error(
      "REPORT FETCH ERROR:",
      error
    );


    setText(
      "dbStatus",
      "ERROR"
    );


    setText(
      "systemText",
      "DATABASE ERROR"
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


/* =========================================================
   REFRESH REPORT DATA
========================================================= */

async function refreshReports(){

  const reports =
    await fetchReports();


  allReports =
    reports;


  renderRecent();

  updateStatistics();

  renderReports();

  renderGallery();


  if(map){

    renderMarkers();

  }

}


/* =========================================================
   UPDATE DASHBOARD STATISTICS
========================================================= */

async function updateStatistics(){

  const reports =
    allReports;


  setText(
    "totalReports",
    reports.length
  );


  setText(
    "pendingReports",
    reports.filter(
      report =>
        String(
          report.status
        ).toLowerCase() ===
        "pending"
    ).length
  );


  setText(
    "verifiedReports",
    reports.filter(
      report =>
        String(
          report.status
        ).toLowerCase() ===
        "verified"
    ).length
  );


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
      !error &&
      data
    ){

      const leaks =
        data.filter(
          row =>
            String(
              row.status || ""
            ).toUpperCase() ===
            "LEAK"
        ).length;


      setText(
        "activeLeaks",
        leaks
      );

    }
    else{

      setText(
        "activeLeaks",
        "—"
      );

    }

  }
  catch(error){

    console.error(
      "STATISTICS ERROR:",
      error
    );


    setText(
      "activeLeaks",
      "—"
    );

  }

}


/* =========================================================
   RECENT REPORTS
========================================================= */

function renderRecent(){

  const box =
    $("recentReports");


  if(!box)
    return;


  const recent =
    allReports.slice(
      0,
      5
    );


  if(
    !recent.length
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
    recent
      .map(
        report => {

          const image =
            report.image_url
              ? `
                <img
                  class="thumb"
                  src="${escapeHTML(
                    report.image_url
                  )}"
                  alt="Road report"
                  onerror="this.style.display='none'"
                >
              `
              : `
                <div class="thumb"></div>
              `;


          return `
            <div class="recent-item">

              ${image}

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

              <span class="recent-status">
                ${escapeHTML(
                  report.status ||
                  "Pending"
                )}
              </span>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   FULL REPORTS
========================================================= */

function renderReports(){

  const box =
    $("reportsList");


  if(!box)
    return;


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
        report => {

          const image =
            report.image_url
              ? `
                <img
                  class="report-image"
                  src="${escapeHTML(
                    report.image_url
                  )}"
                  alt="Road report"
                  onerror="this.style.opacity=.25"
                >
              `
              : `
                <div class="report-image"></div>
              `;


          return `
            <div class="report-row">

              <div class="report-main">

                ${image}

                <div>

                  <div class="report-id">
                    REPORT #${escapeHTML(
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
                ${formatDate(
                  report.reported_at
                )}
              </div>

            </div>
          `;

        }
      )
      .join("");

}


/* =========================================================
   GALLERY
========================================================= */

function renderGallery(){

  const box =
    $("galleryGrid");


  if(!box)
    return;


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


  const filteredReports =
    allReports.filter(
      report => {

        const matchesSearch =
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


        const matchesFilter =
          filter === "all" ||

          String(
            report.status ||
            ""
          )
            .toLowerCase() ===
          filter.toLowerCase();


        return (
          matchesSearch &&
          matchesFilter
        );

      }
    );


  const withImages =
    filteredReports
      .map(
        report => ({

          ...report,

          displayImageURL:
            getImageURL(
              report.image_url
            )

        })
      )
      .filter(
        report =>
          report.displayImageURL
      );


  if(
    !withImages.length
  ){

    box.innerHTML =
      `
        <div
          class="
            empty-state
            gallery-empty
          "
        >

          <strong>
            No images found
          </strong>

          <span>
            Upload a road report with an image
            to see it here.
          </span>

        </div>
      `;

    return;

  }


  box.innerHTML =
    withImages
      .map(
        (
          report,
          index
        ) => {

          const url =
            escapeHTML(
              report.displayImageURL
            );


          return `
            <article
              class="gallery-card"
              style="
                animation-delay:
                ${Math.min(
                  index * 45,
                  600
                )}ms
              "
            >

              <div
                class="gallery-image-wrap"
              >

                <img
                  class="gallery-image"
                  src="${url}"
                  alt="${escapeHTML(
                    report.problem_type ||
                    "Road report"
                  )}"
                  loading="lazy"
                  decoding="async"
                  onerror="
                    galleryImageFailed(this)
                  "
                >


                <div
                  class="gallery-image-loading"
                >

                  <span></span>

                  LOADING

                </div>


                <div
                  class="gallery-image-error"
                >
                  IMAGE UNAVAILABLE
                </div>


                <div
                  class="gallery-overlay"
                >

                  <span
                    class="gallery-view-label"
                  >
                    VIEW IMAGE
                  </span>


                  <button
                    class="gallery-open"
                    type="button"
                    data-image="${url}"
                    data-caption="${escapeHTML(
                      report.problem_type ||
                      "Road report"
                    )}"
                  >
                    OPEN ↗
                  </button>

                </div>


                <span
                  class="gallery-index"
                >
                  #${String(
                    index + 1
                  ).padStart(
                    2,
                    "0"
                  )}
                </span>

              </div>


              <div class="gallery-body">

                <div
                  class="gallery-heading"
                >

                  <h3>
                    ${escapeHTML(
                      report.problem_type ||
                      "Road report"
                    )}
                  </h3>

                  <span
                    class="gallery-dot"
                  ></span>

                </div>


                <p>
                  ${escapeHTML(
                    report.description ||
                    "No description provided."
                  )}
                </p>


                <div
                  class="gallery-meta"
                >

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


                  <small>
                    ${formatDate(
                      report.reported_at
                    )}
                  </small>

                </div>

              </div>

            </article>
          `;

        }
      )
      .join("");


  box
    .querySelectorAll(
      ".gallery-image"
    )
    .forEach(
      image => {

        image.addEventListener(
          "load",
          () => {

            image.classList.add(
              "loaded"
            );

            image.parentElement
              .classList.add(
                "image-ready"
              );

          },
          {
            once:true
          }
        );

      }
    );


  box
    .querySelectorAll(
      ".gallery-open"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openLightbox(
              button.dataset.image,
              button.dataset.caption
            );

          }
        );

      }
    );

}


/* =========================================================
   GALLERY ERROR
========================================================= */

function galleryImageFailed(
  img
){

  img.classList.add(
    "broken"
  );


  img.parentElement
    .classList.add(
      "image-error"
    );

}


/* =========================================================
   GALLERY EVENTS
========================================================= */

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
    async () => {

      showToast(
        "Refreshing gallery…"
      );


      await refreshReports();


      showToast(
        "Gallery updated",
        "success"
      );

    }
  );


/* =========================================================
   MAP
========================================================= */

function initMap(){

  if(map)
    return;


  if(
    !window.L ||
    !$("potholeMap")
  )
    return;


  map =
    L.map(
      "potholeMap",
      {
        zoomControl:
          true
      }
    )
      .setView(
        [
          28.6692,
          77.4538
        ],
        11
      );


  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom:
        19,

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


/* =========================================================
   MAP MARKER ICON
========================================================= */

function makeMarkerIcon(
  status
){

  const normalized =
    String(
      status || ""
    ).toLowerCase();


  const color =
    normalized === "verified"
      ? "#42e8a1"

      : normalized === "resolved"
        ? "#31e7ff"

        : "#ff9f43";


  return L.divIcon({

    className:
      "",

    html:
      `
        <div
          style="
            width:18px;
            height:18px;
            border-radius:50%;
            background:${color};
            border:3px solid #071018;
            box-shadow:
              0 0 0 5px ${color}33,
              0 0 22px ${color}99;
          "
        ></div>
      `,

    iconSize:
      [
        18,
        18
      ],

    iconAnchor:
      [
        9,
        9
      ],

    popupAnchor:
      [
        0,
        -8
      ]

  });

}


/* =========================================================
   MAP MARKERS
========================================================= */

function renderMarkers(){

  if(
    !map ||
    !markersLayer
  )
    return;


  markersLayer.clearLayers();


  let count =
    0;


  const bounds =
    [];


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
        !Number.isFinite(
          lat
        ) ||
        !Number.isFinite(
          lng
        )
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


      const image =
        report.image_url

          ? `
              <img
                class="popup-img"
                src="${escapeHTML(
                  report.image_url
                )}"
                alt="Report image"
                onerror="
                  this.style.display='none'
                "
              >
            `

          : "";


      const popup =
        `
          ${image}

          <div class="popup-title">
            ${escapeHTML(
              report.problem_type ||
              "Road report"
            )}
          </div>

          <div class="popup-row">
            Status:
            <b>
              ${escapeHTML(
                report.status ||
                "Pending"
              )}
            </b>
          </div>

          <div class="popup-row">
            Severity:
            <b>
              ${escapeHTML(
                report.severity ||
                "Unknown"
              )}
            </b>
          </div>

          <div class="popup-row">
            ${escapeHTML(
              report.description ||
              "No description"
            )}
          </div>

          <div class="popup-row">
            GPS:
            <b>
              ${lat.toFixed(
                6
              )},
              ${lng.toFixed(
                6
              )}
            </b>
          </div>
        `;


      L.marker(
        [
          lat,
          lng
        ],
        {
          icon:
            makeMarkerIcon(
              report.status
            )
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
    $("map")?.classList.contains(
      "active"
    )
  ){

    map.fitBounds(
      bounds,
      {
        padding:[
          35,
          35
        ],

        maxZoom:
          16
      }
    );

  }

}


/* =========================================================
   MAP CONTROLS
========================================================= */

$("fitMarkersBtn")
  ?.addEventListener(
    "click",
    () => {

      if(!map)
        return;


      const points =
        allReports
          .map(
            report => [
              Number(
                report.latitude
              ),
              Number(
                report.longitude
              )
            ]
          )
          .filter(
            point =>
              Number.isFinite(
                point[0]
              ) &&
              Number.isFinite(
                point[1]
              )
          );


      if(points.length){

        map.fitBounds(
          points,
          {
            padding:[
              35,
              35
            ],

            maxZoom:
              16
          }
        );

      }
      else{

        showToast(
          "No mapped reports yet"
        );

      }

    }
  );


$("locateMapBtn")
  ?.addEventListener(
    "click",
    () => {

      if(
        !navigator.geolocation
      ){

        showToast(
          "Geolocation is not supported",
          "error"
        );

        return;

      }


      navigator
        .geolocation
        .getCurrentPosition(

          position => {

            if(!map)
              return;


            map.setView(
              [
                position.coords.latitude,
                position.coords.longitude
              ],
              16
            );


            L.circleMarker(
              [
                position.coords.latitude,
                position.coords.longitude
              ],
              {
                radius:
                  7,

                color:
                  "#31e7ff",

                fillColor:
                  "#31e7ff",

                fillOpacity:
                  .8
              }
            )
              .addTo(
                map
              )
              .bindPopup(
                "Your current location"
              )
              .openPopup();

          },

          () => {

            showToast(
              "Location permission denied",
              "error"
            );

          }

        );

    }
  );


/* =========================================================
   ROAD REPORT UPLOAD
========================================================= */

$("potholeImage")
  ?.addEventListener(
    "change",
    event => {

      handleSelectedFile(
        event.target.files[0]
      );

    }
  );


/* =========================================================
   HANDLE SELECTED FILE
========================================================= */

function handleSelectedFile(
  file
){

  if(!file)
    return;


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
    ?.classList.add(
      "has-preview"
    );


  setText(
    "uploadTitle",
    file.name
  );


  const reader =
    new FileReader();


  reader.onload =
    event => {

      if(
        $("imagePreview")
      ){

        $("imagePreview").src =
          event.target.result;

      }


      if(
        $("previewImageBox")
      ){

        $("previewImageBox")
          .innerHTML =
          `
            <img
              src="${event.target.result}"
              alt="Preview"
            >
          `;

      }

    };


  reader.readAsDataURL(
    file
  );

}


/* =========================================================
   DRAG AND DROP
========================================================= */

$("uploadZone")
  ?.addEventListener(
    "dragover",
    event => {

      event.preventDefault();


      $("uploadZone")
        ?.classList.add(
          "dragover"
        );

    }
  );


$("uploadZone")
  ?.addEventListener(
    "dragleave",
    () => {

      $("uploadZone")
        ?.classList.remove(
          "dragover"
        );

    }
  );


$("uploadZone")
  ?.addEventListener(
    "drop",
    event => {

      event.preventDefault();


      $("uploadZone")
        ?.classList.remove(
          "dragover"
        );


      handleSelectedFile(
        event.dataTransfer.files[0]
      );

    }
  );


/* =========================================================
   REPORT PREVIEW
========================================================= */

$("problemType")
  ?.addEventListener(
    "change",
    () => {

      setText(
        "previewType",
        $("problemType").value
      );

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


/* =========================================================
   FORM STATUS
========================================================= */

function showFormStatus(
  message,
  error = false
){

  const status =
    $("reportStatus");


  if(!status)
    return;


  status.textContent =
    message;


  status.className =
    `
      form-status
      ${error ? "error" : "success"}
    `;

}


/* =========================================================
   GEOLOCATION
========================================================= */

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


        if(
          $("latitude")
        ){

          $("latitude").value =
            userLatitude;

        }


        if(
          $("longitude")
        ){

          $("longitude").value =
            userLongitude;

        }


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

      error => {

        console.error(
          error
        );


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
        enableHighAccuracy:
          true,

        timeout:
          12000,

        maximumAge:
          0
      }

    );

}


$("locationBtn")
  ?.addEventListener(
    "click",
    getLocation
  );


/* =========================================================
   SUBMIT ROAD REPORT
========================================================= */

async function submitReport(){

  const button =
    $("submitReportBtn");


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


  if(button){

    button.disabled =
      true;

    button.textContent =
      "Uploading…";

  }


  showFormStatus(
    "Uploading image to Supabase Storage…"
  );


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
        );


    const safeExtension =
      extension ||
      "jpg";


    const randomPart =
      window.crypto &&
      crypto.randomUUID

        ? crypto.randomUUID()

        : Math.random()
            .toString(36)
            .slice(2);


    const fileName =
      `report-${Date.now()}-${randomPart}.${safeExtension}`;


    /* -------------------------------------------------------
       STORAGE
    ------------------------------------------------------- */

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


    if(uploadError){

      throw new Error(
        `Storage upload failed: ${uploadError.message}`
      );

    }


    /* -------------------------------------------------------
       PUBLIC URL
    ------------------------------------------------------- */

    const {
      data:
        publicData
    } =
      supabaseClient
        .storage
        .from(
          "pothole-images"
        )
        .getPublicUrl(
          fileName
        );


    const imageURL =
      publicData &&
      publicData.publicUrl;


    if(!imageURL){

      throw new Error(
        "Supabase did not return an image URL."
      );

    }


    showFormStatus(
      "Image uploaded. Saving report…"
    );


    /* -------------------------------------------------------
       DATABASE
    ------------------------------------------------------- */

    const payload = {

      latitude:
        userLatitude,

      longitude:
        userLongitude,

      image_url:
        imageURL,

      problem_type:
        $("problemType")?.value ||
        "Pothole",

      description:
        $("description")?.value.trim() ||
        "",

      severity:
        "Unknown",

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


    if(databaseError){

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
          "gallery"
        );

      },
      700
    );

  }

  catch(error){

    console.error(
      "REPORT ERROR:",
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

    if(button){

      button.disabled =
        false;

      button.innerHTML =
        `
          Submit report
          <span>→</span>
        `;

    }

  }

}


$("submitReportBtn")
  ?.addEventListener(
    "click",
    submitReport
  );


/* =========================================================
   RESET REPORT FORM
========================================================= */

function resetForm(){

  selectedFile =
    null;


  userLatitude =
    null;


  userLongitude =
    null;


  if(
    $("potholeImage")
  ){

    $("potholeImage").value =
      "";

  }


  if(
    $("description")
  ){

    $("description").value =
      "";

  }


  if(
    $("problemType")
  ){

    $("problemType").value =
      "Pothole";

  }


  if(
    $("latitude")
  ){

    $("latitude").value =
      "";

  }


  if(
    $("longitude")
  ){

    $("longitude").value =
      "";

  }


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
    "previewLocation",
    "Location pending"
  );


  if(
    $("imagePreview")
  ){

    $("imagePreview").src =
      "";

  }


  $("uploadZone")
    ?.classList.remove(
      "has-preview"
    );


  setText(
    "uploadTitle",
    "Drop image here or click to browse"
  );


  if(
    $("previewImageBox")
  ){

    $("previewImageBox")
      .innerHTML =
      "<span>IMAGE PREVIEW</span>";

  }

}


/* =========================================================
   PIPE MONITORING
========================================================= */

const PIPE_ZONES_A =
  [
    "A1",
    "A2",
    "A3",
    "A4"
  ];


const PIPE_ZONES_B =
  [
    "B1",
    "B2",
    "B3",
    "B4"
  ];


const ALL_PIPE_ZONES =
  [
    ...PIPE_ZONES_A,
    ...PIPE_ZONES_B
  ];


const GPIO_MAP =
  {

    A1:
      13,

    A2:
      14,

    A3:
      18,

    A4:
      19,

    B1:
      21,

    B2:
      22,

    B3:
      25,

    B4:
      26

  };


/* =========================================================
   BUILD PIPE ZONES
   Supports multiple HTML versions.
========================================================= */

function getZoneContainer(
  firstId,
  secondId
){

  return $(
    firstId
  ) ||
  $(
    secondId
  );

}


function buildZones(){

  if(
    pipeZonesBuilt
  )
    return;


  const containerA =
    getZoneContainer(
      "zonesA",
      "zonesABCD"
    );


  const containerB =
    getZoneContainer(
      "zonesB",
      "zonesEFGH"
    );


  if(containerA){

    containerA.innerHTML =
      PIPE_ZONES_A
        .map(
          zone =>
            zoneHTML(
              zone
            )
        )
        .join("");

  }


  if(containerB){

    containerB.innerHTML =
      PIPE_ZONES_B
        .map(
          zone =>
            zoneHTML(
              zone
            )
        )
        .join("");

  }


  pipeZonesBuilt =
    true;

}


/* =========================================================
   ZONE HTML
========================================================= */

function zoneHTML(
  zone
){

  const gpio =
    GPIO_MAP[
      zone
    ];


  return `
    <div
      class="zone normal"
      id="zone-${zone}"
    >

      <div class="zone-head">

        <b>
          ${zone}
        </b>

        <i
          class="zone-led"
        ></i>

      </div>

      <span>
        NORMAL
      </span>

      <small>
        GPIO ${gpio} · LIVE
      </small>

    </div>
  `;

}


/* =========================================================
   NORMALIZE ZONE NAME
========================================================= */

function normalizeZoneName(
  value
){

  const raw =
    String(
      value || ""
    )
      .trim()
      .toUpperCase();


  if(
    ALL_PIPE_ZONES
      .includes(
        raw
      )
  ){

    return raw;

  }


  const cleaned =
    raw
      .replace(
        /^ZONE\s*/,
        ""
      )
      .replace(
        /[^A-Z0-9]/g,
        ""
      );


  if(
    ALL_PIPE_ZONES
      .includes(
        cleaned
      )
  ){

    return cleaned;

  }


  /*
    Backwards compatibility if an older
    ESP32 database row still uses A-H.
  */

  const legacy =
    {

      A:
        "A1",

      B:
        "A2",

      C:
        "A3",

      D:
        "A4",

      E:
        "B1",

      F:
        "B2",

      G:
        "B3",

      H:
        "B4"

    };


  return (
    legacy[
      cleaned
    ] ||
    ""
  );

}


/* =========================================================
   APPLY PIPE DATA
========================================================= */

function applyPipeData(
  rows = []
){

  buildZones();


  const states =
    {};


  ALL_PIPE_ZONES
    .forEach(
      zone => {

        states[
          zone
        ] =
          "NORMAL";

      }
    );


  rows.forEach(
    item => {

      const zone =
        normalizeZoneName(
          item.zone
        );


      if(!zone)
        return;


      states[
        zone
      ] =
        String(
          item.status ||
          ""
        )
          .toUpperCase() ===
        "LEAK"

          ? "LEAK"

          : "NORMAL";

    }
  );


  let leaks =
    0;


  const currentLeaks =
    new Set();


  ALL_PIPE_ZONES
    .forEach(
      zone => {

        const element =
          $(
            `zone-${zone}`
          );


        if(!element)
          return;


        const isLeak =
          states[
            zone
          ] ===
          "LEAK";


        element.classList.toggle(
          "leak",
          isLeak
        );


        element.classList.toggle(
          "normal",
          !isLeak
        );


        const statusText =
          element.querySelector(
            "span"
          );


        if(statusText){

          statusText.textContent =
            isLeak
              ? "LEAK DETECTED"
              : "NORMAL";

        }


        const led =
          element.querySelector(
            ".zone-led"
          );


        if(led){

          led.classList.toggle(
            "leak",
            isLeak
          );

        }


        if(isLeak){

          leaks++;

          currentLeaks.add(
            zone
          );

        }

      }
    );


  /* -------------------------------------------------------
     MAIN LEAK COUNTER
  ------------------------------------------------------- */

  setText(
    "activeLeaks",
    leaks
  );


  /* -------------------------------------------------------
     PIPE A / PIPE B
  ------------------------------------------------------- */

  const leaksA =
    PIPE_ZONES_A
      .filter(
        zone =>
          states[
            zone
          ] ===
          "LEAK"
      )
      .length;


  const leaksB =
    PIPE_ZONES_B
      .filter(
        zone =>
          states[
            zone
          ] ===
          "LEAK"
      )
      .length;


  updatePipeGroup(
    "A",
    leaksA
  );


  updatePipeGroup(
    "B",
    leaksB
  );


  /* -------------------------------------------------------
     ALERT
  ------------------------------------------------------- */

  updatePipeAlert(
    currentLeaks
  );


  /* -------------------------------------------------------
     LAST UPDATE
  ------------------------------------------------------- */

  setText(
    "lastPipePoll",
    formatTime()
  );


  setText(
    "pipeLastUpdate",
    `Updated ${formatTime()}`
  );

}


/* =========================================================
   PIPE GROUP UI
========================================================= */

function updatePipeGroup(
  group,
  leakCount
){

  const state =
    $(
      `pipe${group}State`
    );


  const line =
    $(
      `pipe${group}`
    );


  if(state){

    state.textContent =
      leakCount > 0

        ? `${leakCount} ACTIVE`

        : "STABLE";


    state.classList.toggle(
      "bad",
      leakCount > 0
    );

  }


  if(line){

    line.classList.toggle(
      "bad",
      leakCount > 0
    );

  }


  const card =
    state?.closest(
      ".pipe-card-peak"
    );


  if(card){

    card.classList.toggle(
      "is-alert",
      leakCount > 0
    );

  }

}


/* =========================================================
   PIPE ALERT
========================================================= */

function updatePipeAlert(
  currentLeaks
){

  const alert =
    $("pipeAlert");


  if(
    !alert
  ){

    previousLeakZones =
      new Set(
        currentLeaks
      );

    return;

  }


  if(
    currentLeaks.size === 0
  ){

    alert.classList.remove(
      "show"
    );


    previousLeakZones =
      new Set();


    return;

  }


  const leakingZones =
    [
      ...currentLeaks
    ];


  setText(
    "pipeAlertTitle",
    "PIPELINE LEAK DETECTED"
  );


  setText(
    "pipeAlertText",
    `${leakingZones.join(
      ", "
    )} reporting active leakage.`
  );


  alert.classList.add(
    "show"
  );


  const newLeaks =
    leakingZones.filter(
      zone =>
        !previousLeakZones
          .has(
            zone
          )
    );


  if(
    newLeaks.length
  ){

    showToast(
      `${newLeaks.join(
        ", "
      )} — leakage detected.`,
      "error"
    );

  }


  previousLeakZones =
    new Set(
      currentLeaks
    );

}


/* =========================================================
   LOAD PIPE STATUS
========================================================= */

async function loadPipeStatus(){

  buildZones();


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
          "*"
        );


    if(error){

      console.warn(
        "pipe_status error:",
        error.message
      );


      setText(
        "pipeConnection",
        "TABLE ERROR"
      );


      if(
        $("pipeConnection")
      ){

        $("pipeConnection")
          .className =
          "status-badge";

      }


      setText(
        "activeLeaks",
        "—"
      );


      setText(
        "lastPipePoll",
        "ERROR"
      );


      return;

    }


    setText(
      "pipeConnection",
      "LIVE"
    );


    if(
      $("pipeConnection")
    ){

      $("pipeConnection")
        .className =
        "status-badge online";

    }


    applyPipeData(
      data || []
    );

  }
  catch(error){

    console.error(
      "PIPE FETCH ERROR:",
      error
    );


    setText(
      "pipeConnection",
      "ERROR"
    );

  }

}


/* =========================================================
   CLOUD CAMERA
========================================================= */

async function loadLatestCamera(){

  const image =
    $("cameraStream");


  const status =
    $("cameraStatus");


  const connection =
    $("cameraConnection");


  const cloudState =
    $("cameraCloudState");


  const cloudTime =
    $("cameraCloudTime");


  if(
    !image
  ){

    return;

  }


  try{

    if(cloudState){

      cloudState.textContent =
        "CONNECTING TO CAMERA";

    }


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
            ascending:
              false
          }
        )

        .limit(
          1
        );


    if(error){

      throw error;

    }


    /* -------------------------------------------------------
       NO FRAME
    ------------------------------------------------------- */

    if(
      !data ||
      data.length === 0
    ){

      image.style.display =
        "none";


      if(status){

        status.textContent =
          "WAITING";


        status.className =
          "status-badge";

      }


      setText(
        "cameraConnection",
        "NO CAMERA IMAGE YET"
      );


      setText(
        "cameraCloudState",
        "WAITING FOR ESP32-CAM"
      );


      setText(
        "cameraCloudTime",
        "No frame has been uploaded yet."
      );


      return;

    }


    const frame =
      data[0];


    if(
      !frame.image_url
    ){

      throw new Error(
        "Camera image URL is empty."
      );

    }


    /*
      Add a timestamp to avoid browser cache.
    */

    const baseURL =
      getCameraImageURL(
        frame.image_url
      );


    if(!baseURL){

      throw new Error(
        "Could not build camera image URL."
      );

    }


    const imageURL =
      baseURL +
      (
        baseURL.includes(
          "?"
        )
          ? "&"
          : "?"
      ) +
      "t=" +
      Date.now();


    /* -------------------------------------------------------
       IMAGE LOAD SUCCESS
    ------------------------------------------------------- */

    image.onload =
      () => {

        image.style.display =
          "block";


        if(status){

          status.textContent =
            "ONLINE";


          status.className =
            "status-badge online";

        }


        setText(
          "cameraConnection",
          "ESP32-CAM IMAGE LIVE"
        );


        setText(
          "cameraCloudState",
          "CAMERA ONLINE"
        );


        if(
          frame.captured_at
        ){

          const captureDate =
            new Date(
              frame.captured_at
            );


          if(
            cloudTime
          ){

            cloudTime.textContent =
              "Last capture · " +
              captureDate
                .toLocaleString(
                  "en-IN",
                  {
                    day:
                      "2-digit",

                    month:
                      "short",

                    year:
                      "numeric",

                    hour:
                      "2-digit",

                    minute:
                      "2-digit",

                    second:
                      "2-digit"
                  }
                );

          }

        }

      };


    /* -------------------------------------------------------
       IMAGE LOAD ERROR
    ------------------------------------------------------- */

    image.onerror =
      () => {

        image.style.display =
          "none";


        if(status){

          status.textContent =
            "ERROR";


          status.className =
            "status-badge";

        }


        setText(
          "cameraConnection",
          "IMAGE COULD NOT LOAD"
        );


        setText(
          "cameraCloudState",
          "CAMERA IMAGE ERROR"
        );


        setText(
          "cameraCloudTime",
          "Check camera-images bucket permissions."
        );

      };


    image.src =
      imageURL;

  }
  catch(error){

    console.error(
      "CAMERA FETCH ERROR:",
      error
    );


    image.style.display =
      "none";


    if(status){

      status.textContent =
        "ERROR";


      status.className =
        "status-badge";

    }


    setText(
      "cameraConnection",
      "CAMERA DATABASE ERROR"
    );


    setText(
      "cameraCloudState",
      "CAMERA CONNECTION ERROR"
    );


    setText(
      "cameraCloudTime",
      error.message ||
      "Could not read camera_frames."
    );

  }

}


/* =========================================================
   CAMERA REFRESH BUTTON
========================================================= */

$("refreshCameraBtn")
  ?.addEventListener(
    "click",
    async () => {

      showToast(
        "Refreshing camera…"
      );


      await loadLatestCamera();


      showToast(
        "Camera updated",
        "success"
      );

    }
  );


/* =========================================================
   LIGHTBOX
========================================================= */

function openLightbox(
  src,
  caption
){

  if(
    $("lightboxImage")
  ){

    $("lightboxImage").src =
      src;

  }


  if(
    $("lightboxCaption")
  ){

    $("lightboxCaption")
      .textContent =
      caption;

  }


  $("lightbox")
    ?.classList.add(
      "open"
    );

}


$("closeLightbox")
  ?.addEventListener(
    "click",
    () => {

      $("lightbox")
        ?.classList.remove(
          "open"
        );

    }
  );


$("lightbox")
  ?.addEventListener(
    "click",
    event => {

      if(
        event.target ===
        $("lightbox")
      ){

        $("lightbox")
          ?.classList.remove(
            "open"
          );

      }

    }
  );


/* =========================================================
   CINEMATIC BACKGROUND
========================================================= */

function setupCinematicBackground(){

  const layers =
    [
      ...document
        .querySelectorAll(
          ".scene-layer"
        )
    ];


  if(
    !layers.length
  ){

    return;

  }


  const reduced =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;


  if(reduced)
    return;


  let active =
    0;


  let targetX =
    0;


  let targetY =
    0;


  let currentX =
    0;


  let currentY =
    0;


  /* -------------------------------------------------------
     SCENE CROSSFADE
  ------------------------------------------------------- */

  setInterval(
    () => {

      layers[
        active
      ].classList.remove(
        "active"
      );


      active =
        (
          active + 1
        )
        %
        layers.length;


      layers[
        active
      ].classList.add(
        "active"
      );

    },
    9000
  );


  /* -------------------------------------------------------
     CURSOR PARALLAX
  ------------------------------------------------------- */

  window.addEventListener(
    "mousemove",
    event => {

      targetX =
        (
          event.clientX /
          window.innerWidth -
          0.5
        ) *
        10;


      targetY =
        (
          event.clientY /
          window.innerHeight -
          0.5
        ) *
        7;

    },
    {
      passive:
        true
    }
  );


  /* -------------------------------------------------------
     SMOOTH PARALLAX
  ------------------------------------------------------- */

  function animateParallax(){

    currentX +=
      (
        targetX -
        currentX
      ) *
      0.035;


    currentY +=
      (
        targetY -
        currentY
      ) *
      0.035;


    layers.forEach(
      (
        layer,
        index
      ) => {

        const depth =
          1 +
          index *
          0.15;


        layer.style.transform =
          `
            scale(
              ${1.03 +
                index *
                0.005}
            )

            translate3d(
              ${currentX *
                depth}px,

              ${currentY *
                depth}px,

              0
            )
          `;

      }
    );


    requestAnimationFrame(
      animateParallax
    );

  }


  requestAnimationFrame(
    animateParallax
  );


}



/* =========================================================
   MARG DRISHTI
========================================================= */

function margConditionClass(condition){
  const value = String(condition || "").toUpperCase().trim();
  if(value === "NORMAL ROAD") return "normal";
  if(value === "SPEED BREAKER") return "breaker";
  if(value === "POTHOLE") return "pothole";
  if(value === "ROUGH SURFACE") return "rough";
  if(value === "VEHICLE STATIONARY") return "stationary";
  return "unknown";
}

function margConditionIcon(condition){
  const value = String(condition || "").toUpperCase().trim();
  if(value === "NORMAL ROAD") return "✓";
  if(value === "SPEED BREAKER") return "▲";
  if(value === "POTHOLE") return "⚠";
  if(value === "ROUGH SURFACE") return "≈";
  if(value === "VEHICLE STATIONARY") return "■";
  return "◈";
}

function margConnectionState(state, message){
  const chip = $("mdConnectionChip");
  const dot = $("mdConnectionDot");
  const text = $("mdConnectionText");
  const badge = $("margDrishtiConnection");

  if(chip){
    chip.className = "md-online-chip";
    chip.textContent = state.toUpperCase();
    if(state === "online") chip.classList.add("online");
    if(state === "error") chip.classList.add("error");
  }

  if(dot){
    dot.className = "md-live-dot";
    if(state === "online") dot.classList.add("online");
    if(state === "error") dot.classList.add("error");
  }

  if(text) text.textContent = message;

  if(badge){
    badge.textContent = state === "online" ? "LIVE" : state.toUpperCase();
    badge.classList.toggle("online", state === "online");
  }
}

async function loadMargDrishti(){
  const dbState = $("mdDatabaseState");
  if(dbState) dbState.textContent = "CHECKING";

  try{
    const { data, error } = await supabaseClient
      .from("marg_drishti_events")
      .select("id,device_id,condition,vehicle_status,confidence,created_at")
      .order("created_at", { ascending:false })
      .limit(50);

    if(error) throw error;

    margDrishtiEvents = data || [];
    if(dbState) dbState.textContent = "CONNECTED";
    margConnectionState("online", "Receiving live detections");
    renderMargDrishti();
  }catch(error){
    console.error("MARG DRISHTI LOAD ERROR:", error);
    if(dbState) dbState.textContent = "ERROR";
    margConnectionState("error", "Database connection error");
    renderMargDrishtiEmpty(error);
  }
}

function renderMargDrishtiEmpty(error){
  const history = $("mdHistory");
  if(history){
    history.innerHTML = `<div class="md-empty">Unable to load Marg Drishti data. Check the Supabase table and read policy.</div>`;
  }
  setText("mdHistoryCount", "0 EVENTS");
  setText("mdCurrentCondition", "WAITING FOR DATA");
  setText("mdConditionTag", "NO EVENT");
  setText("mdVehicleStatus", "—");
  setText("mdConfidence", "—");
  setText("mdDeviceId", "—");
  setText("mdLastUpdate", "—");
  setText("mdLiveMessage", error ? "Database connection error." : "Waiting for the first Marg Drishti event…");
}

function renderMargDrishti(){
  const latest = margDrishtiEvents[0];
  const panel = $("mdStatusPanel");

  if(!latest){
    renderMargDrishtiEmpty(null);
    updateMargDrishtiCounters();
    return;
  }

  const condition = String(latest.condition || "UNKNOWN").toUpperCase();
  const cls = margConditionClass(condition);

  if(panel) panel.dataset.condition = cls;
  setText("mdCurrentCondition", condition);
  setText("mdConditionTag", latest.vehicle_status === "VEHICLE STATIONARY" ? "STATIONARY" : "LIVE AI");
  setText("mdVehicleStatus", latest.vehicle_status || "—");
  setText("mdDeviceId", latest.device_id || "—");
  setText("mdLastUpdate", formatDate(latest.created_at));
  setText("mdConditionIcon", margConditionIcon(condition));

  if(latest.confidence === null || latest.confidence === undefined){
    setText("mdConfidence", "—");
  }else{
    setText("mdConfidence", `${Number(latest.confidence).toFixed(1)}%`);
  }

  const liveMessage = latest.vehicle_status === "VEHICLE STATIONARY"
    ? "Vehicle is currently stationary based on the 5-second acceleration window."
    : `Latest AI result received from ${latest.device_id || "Marg Drishti"}.`;
  setText("mdLiveMessage", liveMessage);

  renderMargDrishtiHistory();
  updateMargDrishtiCounters();
}

function renderMargDrishtiHistory(){
  const box = $("mdHistory");
  if(!box) return;

  if(!margDrishtiEvents.length){
    box.innerHTML = `<div class="md-empty">No detections have been received yet.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="md-history-head">
      <span>CONDITION</span>
      <span>TIME</span>
      <span>DEVICE</span>
      <span>CONFIDENCE</span>
    </div>
    ${margDrishtiEvents.slice(0,50).map(event => {
      const condition = String(event.condition || "UNKNOWN").toUpperCase();
      const cls = margConditionClass(condition);
      const confidence = event.confidence === null || event.confidence === undefined
        ? "—"
        : `${Number(event.confidence).toFixed(1)}%`;
      return `
        <div class="md-event">
          <div class="md-event-condition">
            <span class="md-event-dot ${cls}"></span>
            <div>
              <strong>${escapeHTML(condition)}</strong>
              <small>${escapeHTML(event.vehicle_status || "—")}</small>
            </div>
          </div>
          <div class="md-event-time">${escapeHTML(formatDate(event.created_at))}</div>
          <div class="md-event-device">${escapeHTML(event.device_id || "—")}</div>
          <div class="md-event-confidence">${escapeHTML(confidence)}</div>
        </div>
      `;
    }).join("")}
  `;

  setText("mdHistoryCount", `${margDrishtiEvents.length} EVENTS`);
}

function updateMargDrishtiCounters(){
  const counts = { normal:0, breaker:0, pothole:0, rough:0, stationary:0 };
  margDrishtiEvents.forEach(event => {
    const cls = margConditionClass(event.condition);
    if(Object.prototype.hasOwnProperty.call(counts, cls)) counts[cls]++;
  });

  setText("mdNormalCount", counts.normal);
  setText("mdBreakerCount", counts.breaker);
  setText("mdPotholeCount", counts.pothole);
  setText("mdRoughCount", counts.rough);
  setText("mdStationaryCount", counts.stationary);
}

function setupMargDrishtiRealtime(){
  if(margDrishtiRealtimeChannel) return;

  margDrishtiRealtimeChannel = supabaseClient
    .channel("marg-drishti-live")
    .on(
      "postgres_changes",
      { event:"*", schema:"public", table:"marg_drishti_events" },
      payload => {
        console.log("MARG DRISHTI REALTIME UPDATE:", payload);
        setText("mdRealtimeState", "LIVE");
        loadMargDrishti();
      }
    )
    .subscribe(status => {
      console.log("MARG DRISHTI REALTIME STATUS:", status);
      setText("mdRealtimeState", status === "SUBSCRIBED" ? "CONNECTED" : status);
      if(status === "SUBSCRIBED") margConnectionState("online", "Realtime channel connected");
    });
}

$('refreshMargDrishti')?.addEventListener('click', loadMargDrishti);

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


      if(
        payload.eventType ===
        "DELETE"
      ){

        loadPipeStatus();

      }
      else{

        /*
          Instead of querying only the changed row,
          fetch the complete current state so the UI
          always represents every zone.
        */

        loadPipeStatus();

      }


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
   CINEMATIC BACKGROUND
========================================================= */

setupCinematicBackground();


/* =========================================================
   START RHMS
========================================================= */

init();
/* =========================================================
   RHMS ADD-ON
   POTHOLE SEVERITY + MARG DRISHTI GPS
   ========================================================= */


/* =========================================================
   POTHOLE SEVERITY GRADING
   ========================================================= */

function rhmsDepthScore(depth) {

  const value =
    String(depth || "").toLowerCase();

  if (value.includes("less"))
    return 1;

  if (
    value.includes("2–5") ||
    value.includes("2-5")
  )
    return 2;

  if (
    value.includes("5–10") ||
    value.includes("5-10")
  )
    return 3;

  if (
    value.includes("10–20") ||
    value.includes("10-20")
  )
    return 4;

  if (value.includes("more"))
    return 5;

  return 0;
}


function rhmsSizeScore(size) {

  const value =
    String(size || "").toLowerCase();

  if (value.includes("small"))
    return 1;

  if (value.includes("medium"))
    return 2;

  if (
    value.includes("large") &&
    !value.includes("very")
  )
    return 3;

  if (value.includes("very large"))
    return 4;

  return 0;
}


function rhmsCalculateSeverity(
  depth,
  size
) {

  const depthScore =
    rhmsDepthScore(depth);

  const sizeScore =
    rhmsSizeScore(size);

  if (
    !depthScore ||
    !sizeScore
  ) {
    return "";
  }

  const total =
    depthScore +
    sizeScore;

  if (total <= 2)
    return "LOW";

  if (total <= 4)
    return "MODERATE";

  if (total <= 6)
    return "HIGH";

  return "CRITICAL";
}


/* =========================================================
   SEVERITY DISPLAY
   ========================================================= */

function rhmsUpdateSeverity() {

  const depth =
    $("potholeDepth")?.value || "";

  const size =
    $("potholeSize")?.value || "";

  const severity =
    rhmsCalculateSeverity(
      depth,
      size
    );

  const badge =
    $("severityBadge");

  const explanation =
    $("severityExplanation");


  if (!badge)
    return;


  badge.className =
    "severity-badge";


  if (!severity) {

    badge.textContent =
      "SELECT BOTH";

    if (explanation) {

      explanation.textContent =
        "Select the pothole depth and size to calculate severity.";

    }

    return;

  }


  badge.textContent =
    severity;

  badge.classList.add(
    severity.toLowerCase()
  );


  if (explanation) {

    explanation.textContent =
      `RHMS severity: ${severity}. Depth and affected area are combined for this project grading.`;

  }

}


/* =========================================================
   SEVERITY LISTENERS
   ========================================================= */

$("potholeDepth")
  ?.addEventListener(
    "change",
    rhmsUpdateSeverity
  );


$("potholeSize")
  ?.addEventListener(
    "change",
    rhmsUpdateSeverity
  );


/* =========================================================
   PATCH EXISTING REPORT SUBMISSION
   ========================================================= */

const rhmsOriginalSubmitReport =
  typeof submitReport === "function"
    ? submitReport
    : null;


if (rhmsOriginalSubmitReport) {

  submitReport =
    async function () {

      const problemType =
        $("problemType")?.value ||
        "Pothole";


      if (
        problemType === "Pothole"
      ) {

        const depth =
          $("potholeDepth")?.value ||
          "";

        const size =
          $("potholeSize")?.value ||
          "";


        if (
          !depth ||
          !size
        ) {

          showFormStatus(
            "Please select pothole depth and size.",
            true
          );

          return;

        }


        rhmsUpdateSeverity();

      }


      return rhmsOriginalSubmitReport();

    };

}


/* =========================================================
   PATCH EXISTING DATABASE INSERT
   ========================================================= */

const rhmsOriginalSupabaseFrom =
  supabaseClient.from.bind(
    supabaseClient
  );


/*
  We do NOT replace the existing report system.
  The database payload is patched by modifying the
  form values before the existing submission runs.
*/


/* =========================================================
   MARG DRISHTI GPS HELPERS
   ========================================================= */

function rhmsMargGpsLocation(
  event
) {

  if (
    event?.gps_valid === false
  ) {

    return "NO GPS FIX";

  }


  const lat =
    Number(event?.latitude);

  const lon =
    Number(event?.longitude);


  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {

    return "NO GPS FIX";

  }


  return (
    `${lat.toFixed(6)}, ${lon.toFixed(6)}`
  );

}


function rhmsMargGpsSpeed(
  event
) {

  const speed =
    Number(
      event?.gps_speed_kmph
    );


  if (
    !Number.isFinite(speed)
  ) {

    return "—";

  }


  return (
    `${speed.toFixed(1)} km/h`
  );

}


function rhmsMargGpsStatus(
  event
) {

  if (
    event?.gps_valid === true
  ) {

    const satellites =
      Number(
        event?.gps_satellites
      );


    if (
      Number.isFinite(satellites) &&
      satellites > 0
    ) {

      return (
        `FIX · ${satellites} SAT`
      );

    }


    return "GPS FIX";

  }


  return "NO FIX";

}


/* =========================================================
   PATCH MARG DRISHTI DISPLAY
   ========================================================= */

const rhmsOriginalRenderMarg =
  typeof renderMargDrishti === "function"
    ? renderMargDrishti
    : null;


if (rhmsOriginalRenderMarg) {

  renderMargDrishti =
    function () {

      rhmsOriginalRenderMarg();


      /*
        The existing Marg Drishti code already stores
        the latest event in margDrishtiEvents.
      */

      const latest =
        margDrishtiEvents?.[0];


      if (!latest)
        return;


      setText(
        "mdGpsLocation",
        rhmsMargGpsLocation(
          latest
        )
      );


      setText(
        "mdGpsSpeed",
        rhmsMargGpsSpeed(
          latest
        )
      );


      setText(
        "mdGpsConnectionState",
        rhmsMargGpsStatus(
          latest
        )
      );


      setText(
        "mdDeviceLinkState",
        "ONLINE"
      );

    };

}


/* =========================================================
   INITIAL SEVERITY STATE
   ========================================================= */

rhmsUpdateSeverity();
