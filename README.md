# Verdun LiDAR

A map app for walking the Verdun battlefield, installed on Android from Chrome:

* Switch between IGN satellite imagery and IGN LiDAR HD relief (bare earth, so craters and trenches show through the forest), or blend the two with the slider.
* Live GPS position with an accuracy circle and a compass heading. The screen stays on while GPS is active.
* Named points: tap **+** and aim the crosshair, long press the map, or use **Mark my position**. Points are listed by distance and direction from you, and export to GPX or GeoJSON (both can also be imported).
* Offline maps: the download button saves tiles for the visible area or the whole battlefield, so the map works with no signal.
* Historical overlays: aerial photos from 1950 to 1965, plus the État major map from 1820 to 1866. You can add your own WWI map (see below).

## Data sources

All tiles come from the IGN Géoplateforme WMTS service (`https://data.geopf.fr/wmts`). It is free, needs no key, and is under Open Licence 2.0.

| Layer | WMTS identifier |
|---|---|
| LiDAR relief | `IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW` (zoom 18 max) |
| Satellite | `ORTHOIMAGERY.ORTHOPHOTOS` |
| IGN map | `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` |
| Photos 1950 to 1965 | `ORTHOIMAGERY.ORTHOPHOTOS.1950-1965` |
| État major | `GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40` |

Note: the data.gouv.fr dataset "Semis de points LiDAR classé, Mont Verdun 2024" covers Mont Verdun near Lyon (CRAIG and Métropole de Lyon), not the Verdun battlefield in the Meuse.

## Run on this PC

```
node serve.js
```

Then open http://localhost:8080.

## Put it on your phone

GPS and offline mode only work over HTTPS, so the folder has to be hosted. Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). Upload the whole folder, open the URL in Chrome on Android, then use **menu > Add to Home screen / Install app**.

## Adding a WWI trench map

1. Find a scan. French army 1:20,000 "plans directeurs" and British trench maps exist for Verdun. McMaster University Library has a large digitised WWI map collection.
2. Georeference it in QGIS (Layer > Georeferencer) using crossroads, forts or village sites you can match on the IGN map.
3. Export it as XYZ tiles (Processing > Generate XYZ tiles (Directory)) into `maps/<name>/`, or keep it as one image and note its corner coordinates.
4. Add an entry in `overlays.js`. There are commented examples for both cases.

## Files

* `index.html`, `style.css`, `app.js`: the app
* `overlays.js`: historical layer list
* `sw.js`: service worker (offline app files and tiles)
* `manifest.webmanifest`, `icons/`: Android install
* `vendor/leaflet/`: Leaflet 1.9.4 map library
* `serve.js`: local test server
