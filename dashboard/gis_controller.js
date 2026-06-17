// ============================================================
// VINDHYA Climate Intelligence - GIS Layer Controller
// Manages all map layers with categorized toggle UI
// ============================================================
(function() {
  var GIS = {
    layers: {},
    active: {},
    uiVisible: true,
    panel: null
  };

  var layerDefs = [
    {
      group: 'Administrative Boundaries',
      icon: 'fa-draw-polygon',
      expanded: true,
      layers: [
        { id: 'bnd_state', label: 'State', icon: 'fa-flag', defaultOn: false, getLayer: function() { return window.MP_BOUNDARY && window.MP_BOUNDARY.layers ? window.MP_BOUNDARY.layers.district : null; }, toggle: function(on) { if (on) mpSetBoundary('district', false); else { var B = window.MP_BOUNDARY; if (B && B.active === 'district') mpSetBoundary('district', false); } } },
        { id: 'bnd_district', label: 'District', icon: 'fa-flag', defaultOn: true, getLayer: function() { return window.MP_BOUNDARY && window.MP_BOUNDARY.layers ? window.MP_BOUNDARY.layers.district : null; }, toggle: function(on) { if (on) mpSetBoundary('district', false); else { var B = window.MP_BOUNDARY; if (B && B.active === 'district') mpSetBoundary('district', false); } } },
        { id: 'bnd_block', label: 'Block', icon: 'fa-flag', defaultOn: false, getLayer: function() { return window.MP_BOUNDARY && window.MP_BOUNDARY.layers ? window.MP_BOUNDARY.layers.block : null; }, toggle: function(on) { if (on) mpSetBoundary('block', false); else { var B = window.MP_BOUNDARY; if (B && B.active === 'block') mpSetBoundary('block', false); } } },
        { id: 'bnd_village', label: 'Village', icon: 'fa-flag', defaultOn: false, getLayer: function() { return window._villageLayer || null; }, toggle: function(on) { if (window.toggleVillageBoundaries) window.toggleVillageBoundaries(); } }
      ]
    },
    {
      group: 'Agricultural Layers',
      icon: 'fa-leaf',
      expanded: false,
      layers: [
        { id: 'ag_ndvi', label: 'NDVI', icon: 'fa-leaf', defaultOn: false, toggle: function(on) { var btn = document.getElementById('ndvi-btn'); if (btn) btn.click(); } },
        { id: 'ag_crop', label: 'Crop Health', icon: 'fa-seedling', defaultOn: false, toggle: function(on) { showCropHealthLayer(on); } },
        { id: 'ag_soil', label: 'Soil Moisture', icon: 'fa-tint', defaultOn: false, toggle: function(on) { showSoilMoistureLayer(on); } },
        { id: 'ag_evi', label: 'EVI', icon: 'fa-chart-line', defaultOn: false, toggle: function(on) { showEVILayer(on); } },
        { id: 'ag_vci', label: 'VCI', icon: 'fa-chart-bar', defaultOn: false, toggle: function(on) { showVCILayer(on); } }
      ]
    },
    {
      group: 'Climate Layers',
      icon: 'fa-cloud-sun',
      expanded: false,
      layers: [
        { id: 'cl_rainfall', label: 'Rainfall', icon: 'fa-cloud-rain', defaultOn: false, toggle: function(on) { var btn = document.getElementById('rain-btn'); if (btn) btn.click(); } },
        { id: 'cl_tmax', label: 'Tmax', icon: 'fa-temperature-high', defaultOn: false, toggle: function(on) { showTmaxLayer(on); } },
        { id: 'cl_tmin', label: 'Tmin', icon: 'fa-temperature-low', defaultOn: false, toggle: function(on) { showTminLayer(on); } },
        { id: 'cl_heatwave', label: 'Heatwave', icon: 'fa-fire', defaultOn: false, toggle: function(on) { showHeatwaveLayer(on); } },
        { id: 'cl_drought', label: 'Drought', icon: 'fa-sun', defaultOn: false, toggle: function(on) { showDroughtLayer(on); } },
        { id: 'cl_flood', label: 'Flood', icon: 'fa-water', defaultOn: false, toggle: function(on) { showFloodLayer(on); } }
      ]
    },
    {
      group: 'Future Climate (CMIP6)',
      icon: 'fa-chart-simple',
      expanded: false,
      layers: [
        { id: 'fc_ssp245', label: 'SSP2-4.5', icon: 'fa-chart-line', defaultOn: false, toggle: function(on) { showFutureLayer('ssp245', on); } },
        { id: 'fc_ssp585', label: 'SSP5-8.5', icon: 'fa-chart-line', defaultOn: false, toggle: function(on) { showFutureLayer('ssp585', on); } },
        { id: 'fc_2030', label: '2030', icon: 'fa-calendar', defaultOn: false, toggle: function(on) { showFutureLayer('2030', on); } },
        { id: 'fc_2050', label: '2050', icon: 'fa-calendar', defaultOn: false, toggle: function(on) { showFutureLayer('2050', on); } },
        { id: 'fc_2080', label: '2080', icon: 'fa-calendar', defaultOn: false, toggle: function(on) { showFutureLayer('2080', on); } }
      ]
    }
  ];

  // Simulated layer functions (placeholder - real data integration TBD)
  var simLayers = {};

  function showCropHealthLayer(on) { toggleSimLayer('crop_health', on, '#6fc795', 'Crop Health'); }
  function showSoilMoistureLayer(on) { toggleSimLayer('soil_moisture', on, '#5cc3cd', 'Soil Moisture'); }
  function showEVILayer(on) { toggleSimLayer('evi', on, '#7fa9e8', 'EVI'); }
  function showVCILayer(on) { toggleSimLayer('vci', on, '#e6cf6b', 'VCI'); }
  function showTmaxLayer(on) { toggleSimLayer('tmax', on, '#ec8b9b', 'Tmax'); }
  function showTminLayer(on) { toggleSimLayer('tmin', on, '#7fa9e8', 'Tmin'); }
  function showHeatwaveLayer(on) { toggleSimLayer('heatwave', on, '#e74c3c', 'Heatwave'); }
  function showDroughtLayer(on) { toggleSimLayer('drought', on, '#f0a878', 'Drought'); }
  function showFloodLayer(on) { toggleSimLayer('flood', on, '#5cc3cd', 'Flood Risk'); }
  function showFutureLayer(scenario, on) { toggleSimLayer('future_'+scenario, on, '#9b59b6', 'Future '+scenario); }

  function toggleSimLayer(id, on, color, label) {
    var map = window.leafletMap;
    if (!map) return;
    if (on) {
      if (simLayers[id]) { map.addLayer(simLayers[id]); return; }
      var center = map.getCenter();
      simLayers[id] = L.circle([center.lat, center.lng], {
        radius: 50000, color: color, fillColor: color, fillOpacity: 0.15, weight: 1, opacity: 0.5
      }).bindPopup('<b>' + label + '</b><br>Simulated layer — real data integration pending');
      map.addLayer(simLayers[id]);
    } else {
      if (simLayers[id]) { map.removeLayer(simLayers[id]); }
    }
  }

  function buildLayerControl() {
    var container = document.createElement('div');
    container.id = 'gisController';
    container.style.cssText = 'position:absolute;top:0.5rem;right:3.5rem;z-index:1000;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;width:220px;max-height:calc(100% - 1rem);overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:none;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;border-bottom:1px solid var(--border);cursor:pointer;';
    header.innerHTML = '<span style="font-size:0.7rem;font-weight:700;color:var(--text);letter-spacing:1px;"><i class="fa fa-layer-group"></i> LAYERS</span>' +
      '<button id="gisCloseBtn" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9rem;padding:0;">&times;</button>';
    header.onclick = function(e) { if (e.target !== header.querySelector('#gisCloseBtn')) toggleGISPanel(); };
    container.appendChild(header);

    layerDefs.forEach(function(group, gi) {
      var groupDiv = document.createElement('div');
      groupDiv.style.cssText = 'border-bottom:1px solid var(--border);';
      var groupHeader = document.createElement('div');
      groupHeader.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;cursor:pointer;font-size:0.65rem;font-weight:600;color:var(--text-dim);letter-spacing:0.5px;background:rgba(255,255,255,0.03);';
      groupHeader.innerHTML = '<i class="fa ' + group.icon + '" style="width:12px;font-size:0.6rem;"></i><span style="flex:1;">' + group.group + '</span><span class="gis-expand-icon">' + (group.expanded ? '−' : '+') + '</span>';
      var layerList = document.createElement('div');
      layerList.style.cssText = 'display:' + (group.expanded ? 'block' : 'none') + ';padding:0.2rem 0;';

      group.layers.forEach(function(layer) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.75rem 0.25rem 1.5rem;cursor:pointer;font-size:0.72rem;color:var(--text);';
        var toggle = document.createElement('span');
        toggle.style.cssText = 'width:14px;height:14px;border-radius:3px;border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-size:0.5rem;flex-shrink:0;background:' + (layer.defaultOn ? 'var(--cyan)' : 'transparent') + ';';
        toggle.innerHTML = layer.defaultOn ? '<i class="fa fa-check" style="color:#fff;"></i>' : '';
        var active = layer.defaultOn;
        row.onclick = function() {
          active = !active;
          toggle.style.background = active ? 'var(--cyan)' : 'transparent';
          toggle.innerHTML = active ? '<i class="fa fa-check" style="color:#fff;"></i>' : '';
          if (layer.toggle) layer.toggle(active);
          if (layer.id === 'bnd_village' && window._villageLayer && window.leafletMap) {
            if (active) window.leafletMap.addLayer(window._villageLayer);
            else window.leafletMap.removeLayer(window._villageLayer);
          }
        };
        row.appendChild(toggle);
        var icon = document.createElement('i');
        icon.className = 'fa ' + layer.icon;
        icon.style.cssText = 'width:12px;font-size:0.6rem;color:var(--text-dim);';
        row.appendChild(icon);
        var label = document.createElement('span');
        label.textContent = layer.label;
        row.appendChild(label);
        layerList.appendChild(row);
        // Store reference for programmatic control
        layer._row = row;
        layer._toggle = toggle;
      });

      groupHeader.onclick = function() {
        var expanded = layerList.style.display !== 'none';
        layerList.style.display = expanded ? 'none' : 'block';
        groupHeader.querySelector('.gis-expand-icon').textContent = expanded ? '+' : '−';
      };
      groupDiv.appendChild(groupHeader);
      groupDiv.appendChild(layerList);
      container.appendChild(groupDiv);
    });

    // GIS toggle button
    var toggleBtn = document.createElement('div');
    toggleBtn.id = 'gisToggleBtn';
    toggleBtn.title = 'GIS Layers';
    toggleBtn.style.cssText = 'position:absolute;top:0.5rem;right:0.5rem;z-index:1000;width:32px;height:32px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--cyan);font-size:0.85rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    toggleBtn.innerHTML = '<i class="fa fa-layer-group"></i>';
    toggleBtn.onclick = function() { toggleGISPanel(); };

    return { container: container, toggleBtn: toggleBtn };
  }

  function toggleGISPanel() {
    var p = document.getElementById('gisController');
    if (p) {
      var vis = p.style.display !== 'none';
      p.style.display = vis ? 'none' : 'block';
      GIS.uiVisible = !vis;
    }
  }

  function initGISController() {
    var mapContainer = document.getElementById('map');
    if (!mapContainer) { setTimeout(initGISController, 500); return; }
    var existing = document.getElementById('gisController');
    if (existing) return;

    var ctrl = buildLayerControl();
    mapContainer.appendChild(ctrl.container);
    mapContainer.appendChild(ctrl.toggleBtn);
    // Close button
    var closeBtn = document.getElementById('gisCloseBtn');
    if (closeBtn) closeBtn.onclick = function() { toggleGISPanel(); };
  }

  // Init on DOM ready or map ready
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initGISController, 1000);
  });
  // Also try after window load
  if (document.readyState === 'complete') setTimeout(initGISController, 500);
  else window.addEventListener('load', function() { setTimeout(initGISController, 500); });

  // Re-init when map is recreated
  var origInitMap = window.initMap;
  if (origInitMap) {
    window.initMap = function() {
      origInitMap();
      setTimeout(initGISController, 500);
    };
  }

  window.initGISController = initGISController;
  window.toggleGISPanel = toggleGISPanel;
})();
