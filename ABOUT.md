# About the Data Pipeline

This map uses a combined CSV export maintained by Darren Pierson.

High-level pipeline summary:
- United States brewery records from OpenBreweryDB.
- Canadian brewery locations aggregated from OSM sources.
- Enrichment steps added to normalize state/province names, deduplicate entities, and fill missing fields where possible.
- Final output merged into `data/na_breweries_combined.csv` for the map.

This repository intentionally scopes to **United States and Canada** only.
