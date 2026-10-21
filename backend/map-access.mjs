const booleanOr=(value,fallback)=>typeof value==='boolean'?value:fallback;

export const mapAccessDefinitions=[
 ['bingRoad','bing-road','Bing Normal'],['bingSatellite','bing-satellite','Bing Satellite'],['bingHybrid','bing-hybrid','Bing Hybrid'],
 ['openStreetMap','osm-road','OpenStreetMap'],['cartoLiberty','carto-liberty','MapTiles Liberty'],['cartoPositron','carto-positron','MapTiles Positron'],['cartoDark','carto-dark','MapTiles Dark'],['openTopoMap','open-topo','OpenTopoMap'],
 ['esriStreet','esri-street','Esri Street'],['esriSatellite','esri-satellite','Esri Satellite'],['mapTilerBasic','maptiler-basic','MapTiler Basic'],['mapTilerStreets','maptiler-streets','MapTiler Streets'],['mapTilerSatellite','maptiler-satellite','MapTiler Satellite'],
 ['mapboxStreets','mapbox-streets','MapBox Normal'],['mapboxSatellite','mapbox-satellite','MapBox Satellite'],['mapboxHybrid','mapbox-hybrid','MapBox Hybrid'],
 ['hereNormal','here-normal','HERE Normal'],['hereSatellite','here-satellite','HERE Satellite'],['hereHybrid','here-hybrid','HERE Hybrid'],
 ['tomtomBasic','tomtom-basic','TomTom Basic'],['tomtomSatellite','tomtom-satellite','TomTom Satellite'],['yandex','yandex-road','Yandex'],
 ['openMapTiles','openmaptiles-osm','OpenMapTiles OSM (self-hosted URL)'],
 ['railElectrification','rail-electrification','OpenRailway Electrification'],['railInfrastructure','rail-infrastructure','OpenRailway Infrastructure'],['railMaxSpeeds','rail-maxspeed','OpenRailway Max Speeds'],['railSignaling','rail-signals','OpenRailway Signaling']
];

const accessDefaults=Object.fromEntries(mapAccessDefinitions.map(([key])=>[key,true]));

export function normalizeMapAccess(value={}){
 const raw=value&&typeof value==='object'?value:{},access={};
 for(const [key] of mapAccessDefinitions)access[key]=booleanOr(raw[key],accessDefaults[key]);
 access.mapillary=booleanOr(raw.mapillary,true);
 if(!mapAccessDefinitions.some(([key])=>access[key]))access.openStreetMap=true;
 return access;
}

const present=value=>Boolean(String(value||'').trim());
const encoded=value=>encodeURIComponent(String(value||'').trim());

export function availableMaps(access,settings={}){
 const allowed=normalizeMapAccess(access),bing=present(settings.bingMapsKey),maptiler=present(settings.mapTilerKey),mapbox=present(settings.mapboxToken),here=present(settings.hereMapsKey),tomtom=present(settings.tomtomMapsKey),yandex=present(settings.yandexMapsKey),openMapTiles=present(settings.openMapTilesUrl);
 return [
  allowed.bingRoad&&bing&&{id:'bing-road',label:'Bing Normal',engine:'bing',style:'r',key:String(settings.bingMapsKey)},
  allowed.bingSatellite&&bing&&{id:'bing-satellite',label:'Bing Satellite',engine:'bing',style:'a',key:String(settings.bingMapsKey)},
  allowed.bingHybrid&&bing&&{id:'bing-hybrid',label:'Bing Hybrid',engine:'bing',style:'h',key:String(settings.bingMapsKey)},
  allowed.openStreetMap&&{id:'osm-road',label:'OpenStreetMap',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap contributors',maxZoom:19},
  allowed.cartoLiberty&&{id:'carto-liberty',label:'MapTiles Liberty',url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',attribution:'© OpenStreetMap contributors © CARTO',maxZoom:20},
  allowed.cartoPositron&&{id:'carto-positron',label:'MapTiles Positron',url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',attribution:'© OpenStreetMap contributors © CARTO',maxZoom:20},
  allowed.cartoDark&&{id:'carto-dark',label:'MapTiles Dark',url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',attribution:'© OpenStreetMap contributors © CARTO',maxZoom:20},
  allowed.openTopoMap&&{id:'open-topo',label:'OpenTopoMap',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap',maxZoom:17},
  allowed.esriStreet&&{id:'esri-street',label:'Esri Street',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles © Esri',maxZoom:19},
  allowed.esriSatellite&&{id:'esri-satellite',label:'Esri Satellite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles © Esri',maxZoom:19},
  allowed.mapTilerBasic&&maptiler&&{id:'maptiler-basic',label:'MapTiler Basic',url:`https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=${encoded(settings.mapTilerKey)}`,attribution:'© MapTiler © OpenStreetMap contributors',maxZoom:20},
  allowed.mapTilerStreets&&maptiler&&{id:'maptiler-streets',label:'MapTiler Streets',url:`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encoded(settings.mapTilerKey)}`,attribution:'© MapTiler © OpenStreetMap contributors',maxZoom:20},
  allowed.mapTilerSatellite&&maptiler&&{id:'maptiler-satellite',label:'MapTiler Satellite',url:`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encoded(settings.mapTilerKey)}`,attribution:'© MapTiler',maxZoom:20},
  allowed.mapboxStreets&&mapbox&&{id:'mapbox-streets',label:'Mapbox Streets',url:`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${encoded(settings.mapboxToken)}`,attribution:'© Mapbox © OpenStreetMap contributors',maxZoom:22,tileSize:512,zoomOffset:-1},
  allowed.mapboxSatellite&&mapbox&&{id:'mapbox-satellite',label:'Mapbox Satellite',url:`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${encoded(settings.mapboxToken)}`,attribution:'© Mapbox',maxZoom:22,tileSize:512,zoomOffset:-1},
  allowed.mapboxHybrid&&mapbox&&{id:'mapbox-hybrid',label:'MapBox Hybrid',url:`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${encoded(settings.mapboxToken)}`,attribution:'© Mapbox © OpenStreetMap contributors',maxZoom:22,tileSize:512,zoomOffset:-1},
  allowed.hereNormal&&here&&{id:'here-normal',label:'HERE Normal',url:`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?apiKey=${encoded(settings.hereMapsKey)}&style=explore.day`,attribution:'© HERE',maxZoom:20},
  allowed.hereSatellite&&here&&{id:'here-satellite',label:'HERE Satellite',url:`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?apiKey=${encoded(settings.hereMapsKey)}&style=satellite.day`,attribution:'© HERE',maxZoom:20},
  allowed.hereHybrid&&here&&{id:'here-hybrid',label:'HERE Hybrid',url:`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?apiKey=${encoded(settings.hereMapsKey)}&style=explore.satellite.day`,attribution:'© HERE',maxZoom:20},
  allowed.tomtomBasic&&tomtom&&{id:'tomtom-basic',label:'TomTom Basic',url:`https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${encoded(settings.tomtomMapsKey)}`,attribution:'© TomTom',maxZoom:22},
  allowed.tomtomSatellite&&tomtom&&{id:'tomtom-satellite',label:'TomTom Satellite',url:`https://api.tomtom.com/map/1/tile/sat/main/{z}/{x}/{y}.jpg?key=${encoded(settings.tomtomMapsKey)}`,attribution:'© TomTom',maxZoom:19},
  allowed.yandex&&yandex&&{id:'yandex-road',label:'Yandex',url:`https://tiles.api-maps.yandex.ru/v1/tiles/?apikey=${encoded(settings.yandexMapsKey)}&lang=en_US&l=map&x={x}&y={y}&z={z}&scale=1&projection=web_mercator`,attribution:'© Yandex',maxZoom:21},
  allowed.openMapTiles&&openMapTiles&&{id:'openmaptiles-osm',label:'OpenMapTiles OSM',url:String(settings.openMapTilesUrl).trim(),attribution:String(settings.openMapTilesAttribution||'© OpenMapTiles © OpenStreetMap contributors'),maxZoom:Math.max(2,Math.min(24,Number(settings.openMapTilesMaxZoom)||20))},
  allowed.railElectrification&&{id:'rail-electrification',label:'OpenRailway Electrification',overlay:true,url:'https://{s}.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png',attribution:'© OpenRailwayMap © OpenStreetMap contributors',maxZoom:19},
  allowed.railInfrastructure&&{id:'rail-infrastructure',label:'OpenRailway Infrastructure',overlay:true,url:'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',attribution:'© OpenRailwayMap © OpenStreetMap contributors',maxZoom:19},
  allowed.railMaxSpeeds&&{id:'rail-maxspeed',label:'OpenRailway Max Speeds',overlay:true,url:'https://{s}.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png',attribution:'© OpenRailwayMap © OpenStreetMap contributors',maxZoom:19},
  allowed.railSignaling&&{id:'rail-signals',label:'OpenRailway Signaling',overlay:true,url:'https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png',attribution:'© OpenRailwayMap © OpenStreetMap contributors',maxZoom:19}
 ].filter(Boolean);
}

export function defaultBaseMap(settings={},access={},userPreference=''){
 const maps=availableMaps(access,settings),ids=new Set(maps.map(map=>map.id));
 if(ids.has(userPreference))return userPreference;
 if(ids.has(settings.defaultBaseMap))return settings.defaultBaseMap;
 const preferred=settings.mapStyle==='satellite'?'esri-satellite':'osm-road';
 return ids.has(preferred)?preferred:maps[0]?.id||'osm-road';
}
