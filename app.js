// Brewery Map - U.S. and Canada
// Vanilla JS + Leaflet + Papa Parse + MarkerCluster
// Works with 14 or 15 column schema (source optional)

(function () {
  const DATA_URL = "./data/na_breweries_combined.csv";

  // DOM
  const typeSel = document.getElementById("filter-type");
  const countrySel = document.getElementById("filter-country");
  const regionSel = document.getElementById("filter-region");
  const searchBox = document.getElementById("search-box");
  const resetBtn = document.getElementById("reset-btn");
  const countEl = document.getElementById("result-count");
  const versionEl = document.getElementById("data-version");

  // Map
  const map = L.map("map", { zoomControl: true }).setView([45.3, -93.3], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
  }).addTo(map);

  // utils
  const fold = (s) =>
    (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function normalizeUrl(u) {
    if (!u) return "";
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s.replace(/^\/+/, "");
  }

  function formatTel(p) {
    if (!p) return "";
    const digits = String(p).replace(/\D/g, "");
    const disp =
      digits.length === 11 && digits.startsWith("1")
        ? `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
        : digits.length === 10
        ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
        : p;
    const tel =
      digits.startsWith("1") && digits.length === 11 ? `+${digits}` :
      digits.length === 10 ? `+1${digits}` : digits;
    return `<a href="tel:${tel}">${disp}</a>`;
  }

  // Brewery type order and color flow
  const TYPE_ORDER = [
    "brewpub", "taproom", "micro", "nano", "meadery", "cidery",
    "location", "bar", "proprietor", "regional", "contract",
    "large", "planning", "closed", "unknown"
  ];

  const TYPE_COLORS = {
    brewpub: "#ff4d4d",
    taproom: "#ff7043",
    micro: "#ffa726",
    nano: "#ffcc80",
    meadery: "#ffd54f",
    cidery: "#ffeb3b",
    location: "#cddc39",
    bar: "#66bb6a",
    proprietor: "#26a69a",
    regional: "#29b6f6",
    contract: "#1e88e5",
    large: "#1976d2",
    planning: "#546e7a",
    closed: "#455a64",
    unknown: "#000000"
  };

  // helper for color lookup
  function getColorForType(type) {
    const key = (type || "unknown").toLowerCase();
    return TYPE_COLORS[key] || TYPE_COLORS.unknown;
  }

  // Build the legend once
  function buildLegend(map) {
    const legend = L.control({ position: "right" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "legend legend--types");
      div.innerHTML = `<div class="legend-title">Types</div>`;
      const list = document.createElement("ul");
      list.className = "legend-list";

      TYPE_ORDER.forEach(t => {
        const color = getColorForType(t);
        const item = document.createElement("li");
        item.className = "legend-item";
        item.innerHTML = `
          <span class="legend-swatch" style="background:${color}"></span>
          <span class="legend-label">${t}</span>
        `;
        list.appendChild(item);
      });

      div.appendChild(list);
      return div;
    };
    legend.addTo(map);
  }

  buildLegend(map);

  // Cluster with colored bubbles by majority type
  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 12,
    maxClusterRadius: 60,
    iconCreateFunction: (cl) => {
      const counts = {};
      cl.getAllChildMarkers().forEach((m) => {
        const t = (m.options.ftype || "unknown").toLowerCase();
        counts[t] = (counts[t] || 0) + 1;
      });
      let top = "unknown", max = 0;
      for (const [t, n] of Object.entries(counts)) if (n > max) { max = n; top = t; }
      const color = getColorForType(top);
      const size = 38;
      return L.divIcon({
        html: `<div class="cluster-bubble" style="--c:${color}; width:${size}px; height:${size}px;"><span>${cl.getChildCount()}</span></div>`,
        className: "cluster-icon",
        iconSize: [size, size],
      });
    }
  }).addTo(map);

  // data and state
  let allRows = [];
  let markers = [];
  let currentFiltered = [];

  function buildPopup(d) {
    const addr = [d.address_1, d.city, d.state, d.postal_code].filter(Boolean).join(", ");
    const phone = d.phone ? `<div>📞 ${formatTel(d.phone)}</div>` : "";
    const web = d.website_url ? `<div>🔗 <a href="${normalizeUrl(d.website_url)}" target="_blank" rel="noopener">Website</a></div>` : "";
    const type = d.brewery_type ? `<div>Type: ${d.brewery_type}</div>` : "";
    return `<div class="popup"><strong>${d.name || "Brewery"}</strong>${type}<div>${addr}</div>${phone}${web}</div>`;
  }

  function clearMarkers() {
    cluster.clearLayers();
    markers = [];
  }

  function applyFilters() {
    const t = typeSel.value;
    const c = countrySel.value;
    const r = regionSel.value;
    const q = fold(searchBox.value);

    currentFiltered = allRows.filter((d) => {
      if (t && d.brewery_type !== t) return false;
      if (c && d.country !== c) return false;
      if (r && d.state !== r) return false;
      if (q) {
        const hay = [d.name, d.city, d.postal_code].map(fold).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    clearMarkers();

    for (const d of currentFiltered) {
      const lat = parseFloat(d.latitude);
      const lon = parseFloat(d.longitude);
      if (!isFinite(lat) || !isFinite(lon)) continue;

      const color = getColorForType(d.brewery_type || "unknown");

      const icon = L.divIcon({
        html: `<span class="marker-dot" style="--dot:${color}"></span>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -9],
      });

      const m = L.marker([lat, lon], {
        title: d.name || "",
        icon,
        ftype: d.brewery_type || "unknown"
      });
      m.bindPopup(buildPopup(d));
      markers.push(m);
    }

    cluster.addLayers(markers);
    countEl.textContent = currentFiltered.length.toLocaleString();
    // removed renderLegend call, legend is static and ordered by TYPE_ORDER
  }

  function setRegionOptions() {
    const c = countrySel.value;
    const regions = new Set();
    for (const d of allRows) {
      if (c && d.country !== c) continue;
      if (d.state) regions.add(d.state);
    }
    const sorted = [...regions].sort((a, b) => a.localeCompare(b));
    regionSel.innerHTML = "<option value=''>All</option>";
    sorted.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      regionSel.appendChild(opt);
    });
  }

  function populateFilters() {
    const typeSet = new Set();
    for (const d of allRows) {
      if (d.brewery_type) typeSet.add(d.brewery_type);
    }
    [...typeSet].sort((a, b) => a.localeCompare(b)).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      typeSel.appendChild(opt);
    });
    setRegionOptions();
  }

  // Debounce helper
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  // Events
  typeSel.addEventListener("change", applyFilters);
  countrySel.addEventListener("change", () => { setRegionOptions(); applyFilters(); });
  regionSel.addEventListener("change", applyFilters);
  searchBox.addEventListener("input", debounce(applyFilters, 120));
  resetBtn.addEventListener("click", () => {
    typeSel.value = ""; countrySel.value = ""; setRegionOptions(); regionSel.value = ""; searchBox.value = "";
    applyFilters(); map.setView([45.3, -93.3], 4);
  });

  // Load CSV
  Papa.parse(DATA_URL, {
    header: true,
    download: true,
    skipEmptyLines: true,
    dynamicTyping: { latitude: true, longitude: true },
    complete: (results) => {
      const hasSource = results.meta?.fields?.includes("source");
      allRows = results.data.map((row) => ({
        id: row.id ?? "", name: row.name ?? "", brewery_type: row.brewery_type ?? "",
        address_1: row.address_1 ?? "", city: row.city ?? "", state: row.state ?? "",
        postal_code: row.postal_code ?? "", country: row.country ?? "",
        latitude: row.latitude, longitude: row.longitude,
        phone: row.phone ?? "", website_url: row.website_url ?? "",
        source: hasSource ? row.source ?? "" : "",
        source_state: row.source_state ?? "", source_state_code: row.source_state_code ?? "",
      }));
      populateFilters();
      applyFilters();
      loadDataVersion();
    },
    error: (err) => {
      console.error("CSV load error:", err);
      alert("Failed to load brewery data. Please check the data/na_breweries_combined.csv file.");
      loadDataVersion();
    },
  });

  // Data version badge
  async function loadDataVersion() {
    if (!versionEl) return;
    try {
      const api = "https://api.github.com/repos/piersondarren/brewmap/commits?path=data/na_breweries_combined.csv&per_page=1";
      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const commit = Array.isArray(data) && data[0] ? data[0] : null;
      if (!commit) throw new Error("No commit found");
      const iso = commit.commit?.committer?.date || commit.commit?.author?.date;
      const sha = commit.sha?.slice(0, 7) || "";
      const htmlUrl = commit.html_url || "https://github.com/piersondarren/brewmap/commits/main/data/na_breweries_combined.csv";
      const dt = new Date(iso);
      const when = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
      const rel = relativeTimeFromNow(dt);
      versionEl.innerHTML = `Data updated: <a href="${htmlUrl}" target="_blank" rel="noopener">${when}</a> (${rel}) · ${sha}`;
    } catch {
      versionEl.textContent = "Data updated: unknown";
    }
  }

  function relativeTimeFromNow(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    const units = [["year",31536000],["month",2592000],["day",86400],["hour",3600],["minute",60],["second",1]];
    for (const [name, s] of units) { const v = Math.floor(secs / s); if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`; }
    return "just now";
  }
})();
