# Brewery Map on GitHub Pages

Fast, single page map of breweries, brepubs, taprooms and the like across the United States and Canada.

Live URL pattern: `https://piersondarren.github.io/brewmap/`

## Tech stack
- [Leaflet](https://leafletjs.com/) for the map UI
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) for performance
- [Papa Parse](https://www.papaparse.com/) for client side CSV loading
- Vanilla JavaScript, no build step
- GitHub Pages for free hosting

## Repository layout
```
brewmap/
  index.html
  app.js
  styles.css
  README.md
  data/
    na_breweries_combined.csv  # replace with your latest full export
```
A tiny 5 row sample data file is included so the page loads before you add your full dataset.

## CSV schema
Header row, exactly this order if possible:

```
id,name,brewery_type,address_1,city,state,postal_code,country,latitude,longitude,phone,website_url,source,source_state,source_state_code
```

- `country` must be `United States` or `Canada`
- `state` is the full name for U.S. states and Canadian provinces, for example `Florida`, `Ontario`, `Quebec`
- `latitude` and `longitude` must be numeric
- `phone` and `website_url` may be blank
- the three `source*` fields are optional and hidden in the popup

## Features (v1)
- Full screen Leaflet map with clustered markers
- Popup shows name, type, address, phone, website
- Top bar filters: Brewery type, Country, State/Province (populated dynamically)
- Text search across name, city, postal code, accent insensitive
- Reset filters button
- Minimal dark theme
- Simple footer with your name and link to the repo
- Optional analytics hook commented in `index.html` (Google Analytics or Plausible)

## Publish on GitHub Pages
1. Create a **public** repo named `brewmap` at `github.com/piersondarren/brewmap`
2. Upload the five items in this package:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `README.md`
   - `data/na_breweries_combined.csv`
3. In the repo, go to **Settings › Pages**
4. Source: **Deploy from branch**
5. Branch: `main`, Folder: `/root`, then **Save**
6. Open the site URL GitHub shows, or go to `https://piersondarren.github.io/brewmap/`

## Update process
When you have a fresh export:
1. Replace `data/na_breweries_combined.csv` with your latest file, keeping the **same filename and headers**
2. Commit via the web UI
3. Pages redeploys automatically, usually within a minute

If you change headers, update `app.js` mapping where noted.

## Optional next improvements
- Download filtered results as CSV
- Filter by postal prefix or by radius around a point
- Color markers by brewery type
- Split data to a separate branch or Git LFS if `data/na_breweries_combined.csv` becomes very large

## About
Built by **Darren Pierson**. Repo: `https://github.com/piersondarren/brewmap`.
