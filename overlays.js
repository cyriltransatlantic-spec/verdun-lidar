// Historical overlays shown in the Layers panel.
//
// Three kinds are supported:
//   type 'wmts'  : an IGN Géoplateforme layer (see https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetCapabilities)
//   type 'xyz'   : any {z}/{x}/{y} tile set, for example a WWI trench map you georeferenced in QGIS
//                  and exported with "Generate XYZ tiles" into the maps/ folder
//   type 'image' : a single georeferenced image, placed between its south west and north east corners
//
// Tile overlays ('wmts' and 'xyz') can also be downloaded for offline use.

// The Verdun battlefield area covered by the app: [[south, west], [north, east]].
// Overlays with `clip: AREA` only load tiles inside it.
const AREA = [[49.14, 5.30], [49.28, 5.52]];
const WW1 = 'WWI military maps';

// IGN's WWI maps of Verdun (the layers used by the macarte.ign.fr map "Tranchée de fort Douaumont").
// Listed from the broadest to the most detailed; later ones draw on top.
// `extent` is the sheet's own coverage as published by IGN; the layer is clipped to
// the part of it that falls inside AREA.
function ww1(id, name, layer, tms, maxNativeZoom, extent) {
  const clip = [
    [Math.max(extent[0][0], AREA[0][0]), Math.max(extent[0][1], AREA[0][1])],
    [Math.min(extent[1][0], AREA[1][0]), Math.min(extent[1][1], AREA[1][1])],
  ];
  return { id, name, group: WW1, type: 'wmts', layer, tms, format: 'image/png', minNativeZoom: 6, maxNativeZoom, opacity: 0.65, clip, kb: 170 };
}

window.HISTORIC_OVERLAYS = [
  ww1('front1914', 'Front line, 15 November 1914 (1:600,000)', 'GEOGRAPHICALGRIDSYSTEMS.1914_11_15_ARRAS_VERDUN_BELFORT_fronts_600K', 'PM_6_10', 10, [[47.3396, 0.87353], [51.2857, 8.88521]]),
  ww1('offensives', 'Offensives, February 1916 to August 1917 (1:50,000)', 'GEOGRAPHICALGRIDSYSTEMS.VERDUN_ENVIRONS_NORD_fronts_offensves_50K', 'PM_6_14', 14, [[49.0887, 4.99018], [49.4144, 5.65437]]),
  ww1('fronts50k', 'French fronts, 21 to 26 February 1916 (1:50,000)', 'GEOGRAPHICALGRIDSYSTEMS.VERDUN_ENVIRONS_fronts_50K_21-26fevr1916', 'PM_6_14', 14, [[49.0849, 4.98696], [49.3719, 5.64305]]),
  ww1('fronts20k', 'French fronts, 21 to 26 February 1916 (1:20,000)', 'GEOGRAPHICALGRIDSYSTEMS.EDUGEO.VERDUN_NORD_fronts_francais_20K', 'PM_6_16', 16, [[49.168, 5.29434], [49.3036, 5.58034]]),
  ww1('defences20k', 'Defensive works, 21 February 1916 (1:20,000)', 'GEOGRAPHICALGRIDSYSTEMS.EDUGEO.VERDUN_NORD_organisations_defensives_20K', 'PM_6_16', 16, [[49.1609, 5.28694], [49.3069, 5.58493]]),
  ww1('meuse1916', 'Defences on the Meuse, April 1916 (1:20,000)', 'GEOGRAPHICALGRIDSYSTEMS.EDUGEO.Positions_20K_avr1916', 'PM_6_16', 16, [[49.1307, 5.11659], [49.2732, 5.58059]]),
  ww1('douaumont1916', 'Douaumont and surroundings, April 1916', 'GEOGRAPHICALGRIDSYSTEMS.EDUGEO.Douaumont1916', 'PM_6_17', 17, [[49.1519, 5.38761], [49.2326, 5.49243]]),
  ww1('fortdouaumont', 'Fort Douaumont trenches, 18 May 1916 (1:5,000)', 'GEOGRAPHICALGRIDSYSTEMS.DOUAUMONT_FORT_positions_5K_18mai1916', 'PM_6_17', 17, [[49.2064, 5.42696], [49.2229, 5.45493]]),

  {
    id: 'photo1950',
    group: 'Other',
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
    group: 'Other',
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
