(function(){
  'use strict';
  var CAD_URL = 'data/cadastral_kundam.geojson';
  var _cadData = null;
  var _khasraMap = {};
  var _loading = false;
  var _cadParcelLayer = null;   // full layer with all parcels
  var _cadOverlayLayer = null;  // roads + water bodies
  var _selParcelLayer = null;   // single selected parcel layer
  var _selectedKhasra = null;

  function loadCadastralLayer(){
    var map = window.leafletMap;
    if (!map) return;
    if (_loading) return;
    if (_cadParcelLayer) {
      removeSelParcel();
      map.addLayer(_cadParcelLayer);
      if (_cadOverlayLayer) map.addLayer(_cadOverlayLayer);
      return;
    }
    _loading = true;
    fetch(CAD_URL).then(function(r){
      if (!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(gj){
      _cadData = gj;
      buildLayer(map);
      populateKhasraSelect();
      _loading = false;
    }).catch(function(e){
      _loading = false;
      console.warn('[cadastral]', e.message);
    });
  }

  function buildLayer(map){
    if (_cadParcelLayer) map.removeLayer(_cadParcelLayer);
    if (_cadOverlayLayer) map.removeLayer(_cadOverlayLayer);
    removeSelParcel();
    _khasraMap = {};
    var parcels = {type:'FeatureCollection', features:[]};
    var overlays = {type:'FeatureCollection', features:[]};
    (_cadData.features || []).forEach(function(f){
      (f.properties&&(f.properties.type==='road'||f.properties.type==='water_body')?overlays:parcels).features.push(f);
    });
    _cadParcelLayer = L.geoJSON(parcels, {
      style: function(feature){
        var luColor = parcelColor((feature.properties||{}).land_use);
        return {color:'#0f281d', weight:1.5, fillColor:luColor, fillOpacity:0.85};
      },
      onEachFeature: function(feature, layer){
        var p = feature.properties || {};
        if (p.khasra) {
          _khasraMap[p.khasra] = feature;
          layer.on('click', function(){ selectKhasra(p.khasra); });
          layer.bindTooltip('<b>'+p.khasra+'</b>', {direction:'top', className:'cad-tooltip'});
        }
      }
    });
    map.addLayer(_cadParcelLayer);
    if (overlays.features.length) {
      _cadOverlayLayer = L.geoJSON(overlays, {
        style: function(feature){
          var p = feature.properties || {};
          if (p.type === 'road') return {color:'#a08060', weight:2.5, opacity:0.7};
          if (p.type === 'water_body') return {color:'#2a8faa', weight:1, fillColor:'#2a8faa', fillOpacity:0.5};
          return {};
        }
      });
      map.addLayer(_cadOverlayLayer);
    }
  }

  function removeSelParcel(){
    if (_selParcelLayer && window.leafletMap) {
      window.leafletMap.removeLayer(_selParcelLayer);
      _selParcelLayer = null;
    }
  }

  function showOnlyParcel(khasra){
    var map = window.leafletMap;
    if (!map || !_khasraMap[khasra]) return;
    // Remove full parcel layer and any previously selected parcel
    if (_cadParcelLayer && map.hasLayer(_cadParcelLayer)) map.removeLayer(_cadParcelLayer);
    removeSelParcel();
    // Build a single-feature layer for the selected parcel
    _selParcelLayer = L.geoJSON({type:'FeatureCollection', features:[_khasraMap[khasra]]}, {
      style: function(){
        return {color:'#f0a878', weight:4, fillColor:'#f0a878', fillOpacity:0.35};
      }
    });
    _selParcelLayer.addTo(map);
    map.flyToBounds(_selParcelLayer.getBounds(), {maxZoom:17, duration:0.8});
  }

  function showAllParcels(){
    var map = window.leafletMap; if (!map) return;
    removeSelParcel();
    _selectedKhasra = null;
    if (_cadParcelLayer && !map.hasLayer(_cadParcelLayer)) map.addLayer(_cadParcelLayer);
  }

  function parcelColor(lu){
    var colors = {
      'Agriculture':'#6fc795','Fallow':'#e6cf6b','Orchard':'#74a9cf',
      'Built-up':'#f0a878','Water Body':'#5cc3cd','Road':'#888888',
      'Forest Scrub':'#4a9e6b','Barren':'#c4b5a0'
    };
    return colors[lu] || '#bdc9e1';
  }

  function populateKhasraSelect(){
    var sel = document.getElementById('cadKhasraSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Khasra --</option>';
    Object.keys(_khasraMap).sort().forEach(function(k){
      var o = document.createElement('option');
      o.value = k; o.textContent = k; sel.appendChild(o);
    });
  }

  function selectKhasra(khasra){
    if (!khasra || !_khasraMap[khasra]) return;
    _selectedKhasra = khasra;
    var feat = _khasraMap[khasra];
    var p = feat.properties;
    document.getElementById('cadKhasraSelect').value = khasra;
    showOnlyParcel(khasra);
    renderAnalytics(computeAnalytics(khasra, p), p);
  }

  function getClimate(districtKey, villageName){
    var dist = window._mpClimateData && window._mpClimateData.districts[districtKey];
    if (!dist) return {};
    var idx = dist.indices || {};
    if (villageName) {
      for (var id in dist.villages) {
        if ((dist.villages[id].name||'').toUpperCase() === villageName.toUpperCase()) {
          if (dist.villages[id].indices) idx = dist.villages[id].indices;
          break;
        }
      }
    }
    return idx;
  }

  function computeAnalytics(khasra, p){
    var dk = document.getElementById('districtSelect').value;
    var vn = document.getElementById('villageSelect').value;
    var c = getClimate(dk, vn);
    var rain = c.annual_rain_mm_mean || 1000;
    var droughtProb = c.drought_probability_pct || 30;
    var heat = c.max_summer_tmax || 38;
    var spi = c.spi_12 || 0;

    var ndvi = Math.min(0.89, Math.max(0.12, spi * 0.1 + 0.45));
    var cropFactor = {Rice:0.05,Wheat:0.03,Mustard:-0.02,Gram:-0.01,Soybean:0.04,Maize:0.03,Cotton:0.02,Groundnut:0.03,Pigeonpea:-0.01,Bajra:-0.03};
    if (p.crop && cropFactor[p.crop]) ndvi += cropFactor[p.crop];
    ndvi = Math.min(0.89, Math.max(0.12, ndvi));

    var healthRaw = (ndvi - 0.15) / 0.7 * 100;
    var healthSoil = p.soil_type && p.soil_type.match(/Black|Alluvial/i) ? 5 : -3;
    var healthIrr = p.irrigation && p.irrigation !== 'Rainfed' ? 8 : 0;
    var cropHealth = Math.round(Math.min(95, Math.max(10, healthRaw + healthSoil + healthIrr)));

    var soilM = rain / 1600 * 55 + ndvi * 35;
    if (p.soil_type && p.soil_type.match(/Black|Clay/i)) soilM += 8;
    if (p.soil_type && p.soil_type.match(/Sandy|Laterite|Red/i)) soilM -= 5;
    if (p.irrigation && p.irrigation !== 'Rainfed') soilM += 10;
    soilM = Math.round(Math.min(100, Math.max(5, soilM)));

    var heatRisk = Math.round(Math.min(100, Math.max(0, (heat - 34) / 12 * 100)));
    var gwStress = Math.round(Math.min(100, Math.max(5, droughtProb * 1.1 + (heat > 39 ? 10 : 0) - (rain > 1200 ? 15 : 0))));
    var recharge = rain > 1200 ? 'Good' : rain > 800 ? 'Moderate' : 'Poor';

    var baseYield = {Rice:3500,Wheat:4200,Mustard:1500,Gram:1200,Soybean:1800,Maize:4500,Cotton:2800,Groundnut:2200,Pigeonpea:1100,Bajra:1600,Pea:1400,Lentil:1000,Sesame:800,KodoMillet:1200,BlackGram:900,Urd:850,Cowpea:600,Ragi:1800,Safflower:1300,Barley:3000,Watermelon:25000,Muskmelon:22000,Cucumber:18000,Pumpkin:20000,SummerMoong:900,Fodder:12000,Vegetables:15000};
    var base = baseYield[p.crop] || 2500;
    var yf = Math.round(base * (ndvi / 0.6) * (cropHealth / 100) * Math.max(0.5, 1 - droughtProb / 150));
    var yieldForecast = yf.toLocaleString() + ' kg/ha';
    var yieldCat = yf > base * 0.85 ? 'Above Normal' : yf > base * 0.6 ? 'Normal' : 'Below Normal';

    var advisory = generateAdvisory(p, ndvi, cropHealth, soilM, droughtProb, heat, gwStress, rain, dk);

    return {
      ndvi: ndvi.toFixed(2), cropHealth: cropHealth,
      soilMoisture: soilM + '%', rainfall: Math.round(rain) + ' mm',
      droughtRisk: Math.round(droughtProb) + '%', heatRisk: heatRisk + '%',
      gwStress: gwStress + '%', gwRecharge: recharge,
      yieldForecast: yieldForecast, yieldCategory: yieldCat,
      advisory: advisory
    };
  }

  function generateAdvisory(p, ndvi, health, soilM, droughtProb, heat, gwStress, rain, dk){
    var lines = [];
    var season = getCurrentSeason();
    if (health >= 70) lines.push('Crop health is good. Continue regular irrigation and nutrient schedule.');
    else if (health >= 45) lines.push('Moderate crop health. Monitor for pests and apply micronutrient foliar spray.');
    else lines.push('Poor crop health. Soil test recommended. Consider bio-fertilizer application.');
    if (soilM < 30) lines.push('Low soil moisture. Immediate irrigation required. Apply mulch to reduce evaporation.');
    else if (soilM < 50) lines.push('Adequate soil moisture. Schedule next irrigation in 3-4 days.');
    else lines.push('Good soil moisture. Drain excess water if waterlogged.');
    if (droughtProb > 50) lines.push('High drought risk. Adopt water conservation measures — farm ponds, drip irrigation.');
    if (heat > 40) lines.push('Extreme heat expected. Provide shade nets, irrigate at dawn/dusk.');
    if (gwStress > 60) lines.push('Groundwater over-exploited. Restrict borewell use, adopt rainwater harvesting.');
    var crop = p.crop || 'crop';
    var soil = p.soil_type || 'soil';
    lines.push('Recommended: Apply balanced NPK as per soil test for ' + crop + ' on ' + soil + '.');
    if (dk) {
      var regMap = {indore:'Malwa',jabalpur:'Narmada Valley',rewa:'Vindhya',sidhi:'Vindhya',bhopal:'Malwa',gwalior:'Bundelkhand',ujjain:'Malwa',sagar:'Bundelkhand'};
      var region = regMap[dk] || 'Madhya Pradesh';
      lines.push('Regional context: ' + region + ' zone — ' + season + ' season advisory active.');
    }
    return lines.join('<br>');
  }

  function getCurrentSeason(){
    var m = new Date().getMonth();
    if (m >= 5 && m <= 9) return 'Kharif';
    if (m >= 10 || m <= 2) return 'Rabi';
    return 'Zayed';
  }

  function renderAnalytics(a, p){
    var set = function(id, v, c){ var e=document.getElementById(id); if(e){e.textContent=v;if(c)e.style.color=c;} };
    var col = function(v, t, g, b){ return v > t ? 'var(--red)' : v > g ? 'var(--orange)' : v > b ? 'var(--yellow)' : 'var(--green)'; };
    set('cad-selected-khasra', _selectedKhasra || '—');
    set('cad-area', (p.area_ha||0).toFixed(2)+' ha');
    set('cad-landuse', p.land_use||'—');
    set('cad-soil', p.soil_type||'—');
    set('cad-crop', p.crop||'—');
    set('cad-irrigation', p.irrigation||'—');
    set('cad-ndvi', a.ndvi, col(parseFloat(a.ndvi), 0.65, 0.5, 0.35));
    set('cad-crop-health', a.cropHealth+'%', col(a.cropHealth, 70, 55, 40));
    set('cad-soil-moisture', a.soilMoisture, col(parseInt(a.soilMoisture), 70, 50, 30));
    set('cad-rainfall', a.rainfall);
    set('cad-heat-risk', a.heatRisk, col(parseInt(a.heatRisk), 60, 40, 20));
    set('cad-drought', a.droughtRisk, col(parseInt(a.droughtRisk), 50, 35, 20));
    set('cad-gw-stress', a.gwStress, col(parseInt(a.gwStress), 65, 45, 30));
    set('cad-gw-recharge', a.gwRecharge, a.gwRecharge==='Good'?'var(--green)':a.gwRecharge==='Moderate'?'var(--yellow)':'var(--red)');
    set('cad-yield', a.yieldForecast);
    set('cad-yield-cat', a.yieldCategory, a.yieldCategory==='Above Normal'?'var(--green)':a.yieldCategory==='Normal'?'var(--yellow)':'var(--red)');
    var advEl = document.getElementById('cad-advisory');
    if (advEl) advEl.innerHTML = a.advisory;
    var dataEl = document.getElementById('cad-overlay-data');
    if (dataEl) dataEl.innerHTML = ''
      + '<b>KHASRA ' + (_selectedKhasra||'') + '</b> &mdash; '
      + (p.land_use||'—') + ' | ' + (p.crop||'—') + ' | ' + (p.soil_type||'—') + ' | '
      + (p.irrigation||'—') + ' | ' + (p.area_ha||0).toFixed(2)+' ha<br>'
      + '<span style="color:var(--text-dim)">Kundam, Kundam Tehsil, Jabalpur District — '
      + 'Boundary auto-detected from cadastral records. Analytics derived from GEE+IMD climate data.</span>';
  }

  function flyToKhasra(){
    var sel = document.getElementById('cadKhasraSelect');
    if (sel && sel.value) selectKhasra(sel.value);
  }

  function toggleCadLayer(){
    var map = window.leafletMap; if (!map) return;
    var hasParcels = _cadParcelLayer && map.hasLayer(_cadParcelLayer);
    var hasSel = _selParcelLayer && map.hasLayer(_selParcelLayer);
    if (hasParcels || hasSel) {
      if (_cadParcelLayer) map.removeLayer(_cadParcelLayer);
      removeSelParcel();
      if (_cadOverlayLayer) map.removeLayer(_cadOverlayLayer);
    } else {
      if (_selectedKhasra) { showOnlyParcel(_selectedKhasra); }
      else if (_cadParcelLayer) map.addLayer(_cadParcelLayer);
      if (_cadOverlayLayer) map.addLayer(_cadOverlayLayer);
    }
  }

  window.loadCadastralLayer = loadCadastralLayer;
  window.selectKhasra = selectKhasra;
  window.onKhasraChange = selectKhasra;
  window.flyToKhasra = flyToKhasra;
  window.toggleCadLayer = toggleCadLayer;
  window.showAllParcels = showAllParcels;

  var origVillageChange = window.onVillageChange;
  if (origVillageChange) {
    var origFn = origVillageChange;
    window.onVillageChange = function(name){
      origFn.call(this, name);
      var dk = document.getElementById('districtSelect').value;
      if (dk === 'jabalpur' && name && name.toUpperCase() === 'KUNDAM') {
        loadCadastralLayer();
      }
    };
  }
})();
