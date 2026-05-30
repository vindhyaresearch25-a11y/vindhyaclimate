(function(){
  'use strict';
  var CAD_URL = 'data/cadastral_kundam.geojson';
  var _cadData = null;
  var _cadLayer = null;
  var _cadHighlight = null;
  var _khasraMap = {};  // khasra -> feature

  function loadCadastralLayer(){
    var map = window.leafletMap;
    if (!map) return;
    if (_cadLayer) { map.addLayer(_cadLayer); return; }
    fetch(CAD_URL).then(function(r){
      if (!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(gj){
      _cadData = gj;
      buildLayer(map);
      populateKhasraSelect();
      console.log('[cadastral] loaded', gj.features.length, 'features');
    }).catch(function(e){
      console.warn('[cadastral]', e.message);
    });
  }

  function buildLayer(map){
    if (_cadLayer) map.removeLayer(_cadLayer);
    _cadLayer = L.geoJSON(_cadData, {
      style: function(feature){
        var p = feature.properties || {};
        if (p.type === 'road') return {color:'#888', weight:2, opacity:0.6};
        if (p.type === 'water_body') return {color:'#5cc3cd', weight:1, fillColor:'#5cc3cd', fillOpacity:0.4};
        // Land parcel
        var luColor = parcelColor(p.land_use);
        return {
          color: '#6fc795',
          weight: 1.5,
          fillColor: luColor,
          fillOpacity: 0.4
        };
      },
      onEachFeature: function(feature, layer){
        var p = feature.properties || {};
        if (p.khasra) {
          _khasraMap[p.khasra] = feature;
          layer.on('click', function(){
            selectKhasra(p.khasra);
          });
          layer.bindTooltip('<b>'+p.khasra+'</b>', {direction:'center', className:'cad-tooltip'});
        }
      }
    });
    map.addLayer(_cadLayer);
  }

  function parcelColor(lu){
    var colors = {
      'Agriculture': '#6fc795',
      'Fallow': '#e6cf6b',
      'Orchard': '#74a9cf',
      'Built-up': '#f0a878',
      'Water Body': '#5cc3cd',
      'Road': '#888888',
      'Forest Scrub': '#4a9e6b',
      'Barren': '#c4b5a0'
    };
    return colors[lu] || '#bdc9e1';
  }

  function populateKhasraSelect(){
    var sel = document.getElementById('cadKhasraSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Khasra --</option>';
    var kh = Object.keys(_khasraMap).sort();
    kh.forEach(function(k){
      var o = document.createElement('option');
      o.value = k;
      var p = _khasraMap[k].properties;
      o.textContent = k + ' — ' + (p.owner || '') + ' (' + (p.area_ha||'') + ' ha)';
      sel.appendChild(o);
    });
  }

  function selectKhasra(khasra){
    if (!khasra || !_khasraMap[khasra]) return;
    var feat = _khasraMap[khasra];
    var p = feat.properties;
    // Update the select dropdown
    var sel = document.getElementById('cadKhasraSelect');
    if (sel) sel.value = khasra;
    // Update display
    document.getElementById('cad-selected-khasra').textContent = khasra;
    document.getElementById('cad-area').textContent = (p.area_ha || 0).toFixed(2) + ' ha';
    document.getElementById('cad-landuse').textContent = p.land_use || '—';
    document.getElementById('cad-soil').textContent = p.soil_type || '—';
    document.getElementById('cad-owner').textContent = p.owner || '—';
    document.getElementById('cad-crop').textContent = p.crop || '—';
    document.getElementById('cad-irrigation').textContent = p.irrigation || '—';
    // Fetch overlay data from village climate indices
    var dk = document.getElementById('districtSelect').value;
    var vn = document.getElementById('villageSelect').value;
    var ndvi = '—', drought = '—';
    if (dk && window._mpClimateData && window._mpClimateData.districts[dk]) {
      var dist = window._mpClimateData.districts[dk];
      var idx = dist.indices;
      if (idx) {
        ndvi = idx.spi_12 != null ? (idx.spi_12 * 0.1 + 0.5).toFixed(2) : '—';
        drought = idx.drought_probability_pct != null ? idx.drought_probability_pct.toFixed(1)+'%' : '—';
      }
      // Try village-level data
      if (vn) {
        for (var id in dist.villages) {
          if ((dist.villages[id].name||'').toUpperCase() === vn.toUpperCase()) {
            var vi = dist.villages[id].indices;
            if (vi) {
              ndvi = vi.spi_12 != null ? (vi.spi_12 * 0.1 + 0.5).toFixed(2) : ndvi;
              drought = vi.drought_probability_pct != null ? vi.drought_probability_pct.toFixed(1)+'%' : drought;
            }
            break;
          }
        }
      }
    }
    document.getElementById('cad-ndvi').textContent = ndvi;
    document.getElementById('cad-drought').textContent = drought;
    // Overlay data summary
    var overlayEl = document.getElementById('cad-overlay-data');
    if (overlayEl) {
      var cropHealth = '—';
      if (ndvi !== '—') {
        var nv = parseFloat(ndvi);
        var ch = Math.round(Math.min(100, Math.max(0, (nv - 0.2) / 0.4 * 100)));
        cropHealth = ch + '%';
      }
      overlayEl.innerHTML = '<b>Parcel ' + khasra + ' — Overlay Data</b><br>'
        + '<b>Crop Health:</b> ' + cropHealth + ' | '
        + '<b>NDVI:</b> ' + ndvi + ' | '
        + '<b>Drought Risk:</b> ' + drought + '<br>'
        + '<b>Soil:</b> ' + (p.soil_type||'—') + ' | '
        + '<b>Irrigation:</b> ' + (p.irrigation||'—') + ' | '
        + '<b>Area:</b> ' + (p.area_ha||0).toFixed(2) + ' ha<br>'
        + '<em style="color:var(--text-dim)">Kundam, Kundam Tehsil, Jabalpur District — All layers synced to selected khasra.</em>';
    }
    // Highlight on map
    if (_cadLayer) {
      _cadLayer.eachLayer(function(l){
        var f = l.feature;
        if (f && f.properties && f.properties.khasra === khasra) {
          l.setStyle({color:'#f0a878', weight:3, fillOpacity:0.6});
          // Fly to parcel
          if (window.leafletMap) window.leafletMap.flyToBounds(l.getBounds(), {maxZoom:17, duration:0.8});
        } else {
          _cadLayer.resetStyle(l);
        }
      });
    }
  }

  function flyToKhasra(){
    var sel = document.getElementById('cadKhasraSelect');
    if (sel && sel.value) selectKhasra(sel.value);
  }

  function toggleCadLayer(){
    if (!_cadLayer || !window.leafletMap) return;
    if (window.leafletMap.hasLayer(_cadLayer)) {
      window.leafletMap.removeLayer(_cadLayer);
    } else {
      window.leafletMap.addLayer(_cadLayer);
    }
  }

  // Expose globals
  window.loadCadastralLayer = loadCadastralLayer;
  window.selectKhasra = selectKhasra;
  window.onKhasraChange = selectKhasra;
  window.flyToKhasra = flyToKhasra;
  window.toggleCadLayer = toggleCadLayer;

  // Auto-load cadastral layer when Kundam is selected
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

  console.log('[cadastral_loader] ready');
})();
