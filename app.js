// Brewery Map — U.S. & Canada
// Vanilla JS + Leaflet + Papa Parse + MarkerCluster
// Accepts either 15-col schema (…website_url,source,source_state,source_state_code)
// or 14-col schema without `source` (…website_url,source_state,source_state_code)

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

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 12,
    maxClusterRadius: 60,
  }).addTo(map);

  // Data
  let allRows = [];
  let markers = [];
  let currentFiltered = [];

  // Utility: accent-insensitive folding
// Older Chrome/Edge/Safari don't support \p{Diacritic}. Use the combining marks range instead.
  
const fold = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase();


  function buildPopup(d) {
    const addr = [d.address_1, d.city, d.state, d.postal_code]
      .filter(Boolean)
      .join(", ");
    const phone = d.phone ? `<div>📞 ${d.phone}</div>` : "";
    const web = d.website_url
      ? `<div>🔗 <a href="${d.website_url}" target="_blank" rel="noopener">Website</a></div>`
      : "";
    const type = d.brewery_type ? `<div>Type: ${d.brewery_type}</div>` : "";
    return `
      <div class="popup">
        <strong>${d.name || "Brewery"}</strong>
        ${type}
        <div>${addr}</div>
        ${phone}
        ${web}
      </div>
    `;
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
      const m = L.marker([lat, lon], { title: d.name || "" });
      m.bindPopup(buildPopup(d));
      markers.push(m);
    }
    cluster.addLayers(markers);
    countEl.textContent = currentFiltered.length.toLocaleString();
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
  countrySel.addEventListener("change", () => {
    setRegionOptions();
    applyFilters();
  });
  regionSel.addEventListener("change", applyFilters);
  searchBox.addEventListener("input", debounce(applyFilters, 120));
  resetBtn.addEventListener("click", () => {
    typeSel.value = "";
    countrySel.value = "";
    setRegionOptions();
    regionSel.value = "";
    searchBox.value = "";
    applyFilters();
    map.setView([45.3, -93.3], 4);
  });

  // Load CSV (accepts 14 or 15 columns)
  Papa.parse(DATA_URL, {
    header: true,
    download: true,
    skipEmptyLines: true,
    dynamicTyping: { latitude: true, longitude: true },
    complete: (results) => {
      const hasSource = results.meta?.fields?.includes("source");

      allRows = results.data.map((row) => ({
        id: row.id ?? "",
        name: row.name ?? "",
        brewery_type: row.brewery_type ?? "",
        address_1: row.address_1 ?? "",
        city: row.city ?? "",
        state: row.state ?? "",
        postal_code: row.postal_code ?? "",
        country: row.country ?? "",
        latitude: row.latitude,
        longitude: row.longitude,
        phone: row.phone ?? "",
        website_url: row.website_url ?? "",
        // handle both schemas
        source: hasSource ? row.source ?? "" : "",
        source_state: row.source_state ?? "",
        source_state_code: row.source_state_code ?? "",
      }));

      populateFilters();
      applyFilters();
      loadDataVersion(); // show data version badge after map loads
    },
    error: (err) => {
      console.error("CSV load error:", err);
      alert("Failed to load brewery data. Please check the data/na_breweries_combined.csv file.");
      loadDataVersion(); // still try to show version
    },
  });

  // ---- Data version badge (GitHub API) ----
  async function loadDataVersion() {
    if (!versionEl) return;
    try {
      // owner and repo are fixed here. Adjust if you ever fork.
      const api =
        "https://api.github.com/repos/piersondarren/brewmap/commits?path=data/na_breweries_combined.csv&per_page=1";
      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const commit = Array.isArray(data) && data[0] ? data[0] : null;
      if (!commit) throw new Error("No commit found");

      const iso = commit.commit?.committer?.date || commit.commit?.author?.date;
      const sha = commit.sha?.slice(0, 7) || "";
      const htmlUrl = commit.html_url || "https://github.com/piersondarren/brewmap/commits/main/data/na_breweries_combined.csv";

      const dt = new Date(iso);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      const when = `${y}-${m}-${d}`;
      const rel = relativeTimeFromNow(dt);

      versionEl.innerHTML = `Data updated: <a href="${htmlUrl}" target="_blank" rel="noopener">${when}</a> (${rel}) · ${sha}`;
    } catch (e) {
      console.warn("Version fetch failed:", e);
      versionEl.textContent = "Data updated: unknown";
    }
  }

  function relativeTimeFromNow(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    const units = [
      ["year", 365 * 24 * 3600],
      ["month", 30 * 24 * 3600],
      ["day", 24 * 3600],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1],
    ];
    for (const [name, s] of units) {
      const v = Math.floor(secs / s);
      if (v >= 1) return `${v} ${name}${v > 1 ? "s" : ""} ago`;
    }
    return "just now";
  }
})();
