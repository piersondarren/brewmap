// Brewery Map — U.S. & Canada
// Vanilla JS + Leaflet + Papa Parse + MarkerCluster
// Assumptions:
// - CSV headers: id,name,brewery_type,address_1,city,state,postal_code,country,latitude,longitude,phone,website_url,source,source_state,source_state_code
// - data file at ./data/na_breweries_combined.csv
// - lat/lon numeric, phone and website may be blank

(function() {
  const DATA_URL = "./data/na_breweries_combined.csv";

  // DOM
  const typeSel = document.getElementById("filter-type");
  const countrySel = document.getElementById("filter-country");
  const regionSel = document.getElementById("filter-region");
  const searchBox = document.getElementById("search-box");
  const resetBtn = document.getElementById("reset-btn");
  const countEl = document.getElementById("result-count");

  // Map
  const map = L.map("map", { zoomControl: true }).setView([45.3, -93.3], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 12,
    maxClusterRadius: 60
  }).addTo(map);

  // Data
  let allRows = [];
  let markers = [];
  let currentFiltered = [];

  // Utility: accent-insensitive compare
  const fold = (s) => (s || "").toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  function buildPopup(d) {
    const addr = [d.address_1, d.city, d.state, d.postal_code].filter(Boolean).join(", ");
    const phone = d.phone ? `<div>📞 ${d.phone}</div>` : "";
    const web = d.website_url ? `<div>🔗 <a href="${d.website_url}" target="_blank" rel="noopener">Website</a></div>` : "";
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

    currentFiltered = allRows.filter(d => {
      if (t && d.brewery_type !== t) return false;
      if (c && d.country !== c) return false;
      if (r && d.state !== r) return false;

      if (q) {
        const hay = [d.name, d.city, d.postal_code].map(fold).join(" ");
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // update markers
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

    // result count
    countEl.textContent = currentFiltered.length.toLocaleString();
  }

  function populateFilters() {
    // types
    const typeSet = new Set();
    const regionSet = new Set();
    for (const d of allRows) {
      if (d.brewery_type) typeSet.add(d.brewery_type);
      if (d.state) regionSet.add(d.state);
    }
    [...typeSet].sort((a,b) => a.localeCompare(b)).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      typeSel.appendChild(opt);
    });

    // regions depend on country selection when changed, but we seed with all
    setRegionOptions();
  }

  function setRegionOptions() {
    const c = countrySel.value;
    const regions = new Set();
    for (const d of allRows) {
      if (c && d.country !== c) continue;
      if (d.state) regions.add(d.state);
    }
    const sorted = [...regions].sort((a,b) => a.localeCompare(b));
    // reset
    regionSel.innerHTML = "<option value=''>All</option>";
    sorted.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      regionSel.appendChild(opt);
    });
  }

  // Events
  typeSel.addEventListener("change", applyFilters);
  countrySel.addEventListener("change", () => { setRegionOptions(); applyFilters(); });
  regionSel.addEventListener("change", applyFilters);
  searchBox.addEventListener("input", debounce(applyFilters, 120));
  resetBtn.addEventListener("click", () => {
    typeSel.value = "";
    countrySel.value = "";
    setRegionOptions();
    regionSel.value = "";
    searchBox.value = "";
    applyFilters();
    // center back out
    map.setView([45.3, -93.3], 4);
  });

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  // Load CSV
  Papa.parse(DATA_URL, {
    header: true,
    download: true,
    skipEmptyLines: true,
    dynamicTyping: {
      latitude: true,
      longitude: true
    },
    complete: (results) => {
      // sanitize rows to expected schema keys
      allRows = results.data.map(row => ({
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
        source: row.source ?? "",
        source_state: row.source_state ?? "",
        source_state_code: row.source_state_code ?? ""
      }));

      populateFilters();
      applyFilters();
    },
    error: (err) => {
      console.error("CSV load error:", err);
      alert("Failed to load brewery data. Please check the data/na_breweries_combined.csv file.");
    }
  });
})();
