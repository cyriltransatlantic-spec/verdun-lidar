// Historical overlays shown in the Layers panel.
//
// Three kinds are supported:
//   type 'wmts'  : an IGN Géoplateforme layer (see https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetCapabilities)
//   type 'xyz'   : any {z}/{x}/{y} tile set, for example a WWI trench map you georeferenced in QGIS
//                  and exported with "Generate XYZ tiles" into the maps/ folder
//   type 'image' : a single georeferenced image, placed between its south west and north east corners
//
// Tile overlays ('wmts' and 'xyz') can also be downloaded for offline use.

window.HISTORIC_OVERLAYS = [
  {
    id: 'photo1950',
    name: 'Aerial photos 1950 to 1965',
    type: 'wmts',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS.1950-1965',
    tms: 'PM_0_18',
    format: 'image/png',
    maxNativeZoom: 18,
    opacity: 1,
    kb: 25,
  },
  {
    id: 'etatmajor',
    name: 'État major map 1820 to 1866',
    type: 'wmts',
    layer: 'GEOGRAPHICALGRIDSYSTEMS.ETATMAJOR40',
    tms: 'PM_6_15',
    format: 'image/jpeg',
    minNativeZoom: 6,
    maxNativeZoom: 15,
    opacity: 0.7,
    kb: 30,
  },

  // Example: a WWI "plan directeur" exported as XYZ tiles from QGIS into maps/plan1916/
  // {
  //   id: 'plan1916',
  //   name: 'Plan directeur 1916',
  //   type: 'xyz',
  //   url: 'maps/plan1916/{z}/{x}/{y}.png',
  //   maxNativeZoom: 17,
  //   opacity: 0.7,
  //   kb: 20,
  // },

  // Example: a single scanned map image with known corners
  // {
  //   id: 'trenches',
  //   name: 'Trench map (image)',
  //   type: 'image',
  //   url: 'maps/trenches.jpg',
  //   bounds: [[49.19, 5.40], [49.23, 5.45]], // [[south, west], [north, east]]
  //   opacity: 0.6,
  // },
];
