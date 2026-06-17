// ============================================================
// VINDHYA Climate Intelligence - Shapefile Selector
// Cascading State → District → Block → Village with dynamic loading
// ============================================================
(function() {
  var SEL = {
    data: null,
    currentState: 'mp',
    currentDistrict: null,
    currentBlock: null,
    currentVillage: null
  };

  var stateData = {
    mp: { name: 'Madhya Pradesh', lat: 23.5, lng: 78.5 }
  };

  function initShapefileSelector() {
    // Build cascading selector UI below the existing location bar
    var locBar = document.querySelector('.loc-bar-title');
    if (!locBar) { setTimeout(initShapefileSelector, 500); return; }
    var existing = document.getElementById('shapefileSelector');
    if (existing) return;

    var container = document.createElement('div');
    container.id = 'shapefileSelector';
    container.style.cssText = 'display:flex;gap:0.4rem;flex-wrap:wrap;padding:0.4rem 0.6rem;border-top:1px solid var(--border);';

    var fields = [
      { id: 'sfState', label: 'State', width: '90px' },
      { id: 'sfDistrict', label: 'District', width: '110px' },
      { id: 'sfBlock', label: 'Block', width: '110px' },
      { id: 'sfVillage', label: 'Village', width: '120px' }
    ];

    fields.forEach(function(f) {
      var group = document.createElement('div');
      group.style.cssText = 'display:flex;flex-direction:column;gap:0.15rem;';
      var label = document.createElement('label');
      label.textContent = f.label;
      label.style.cssText = 'font-size:0.55rem;font-weight:600;color:var(--text-dim);letter-spacing:0.5px;text-transform:uppercase;';
      var select = document.createElement('select');
      select.id = f.id;
      select.style.cssText = 'width:' + f.width + ';padding:0.25rem 0.4rem;border:1px solid var(--border);border-radius:4px;background:var(--bg-card);color:var(--text);font-size:0.7rem;font-weight:600;';
      group.appendChild(label);
      group.appendChild(select);
      container.appendChild(group);
    });

    // Add loading indicator
    var loadIndicator = document.createElement('div');
    loadIndicator.id = 'sfLoadIndicator';
    loadIndicator.style.cssText = 'display:none;font-size:0.6rem;color:var(--text-dim);padding:0.2rem 0.4rem;';
    loadIndicator.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading...';
    container.appendChild(loadIndicator);

    var parent = locBar.parentElement || locBar.closest('.map-info-bar');
    if (parent) parent.appendChild(container);
    else document.querySelector('.map-info-bar')?.appendChild(container);

    // Populate state
    populateStateSelect();
    // Hook events
    document.getElementById('sfState').onchange = function() { onSFStateChange(this.value); };
    document.getElementById('sfDistrict').onchange = function() { onSFDistrictChange(this.value); };
    document.getElementById('sfBlock').onchange = function() { onSFBlockChange(this.value); };
    document.getElementById('sfVillage').onchange = function() { onSFVillageChange(this.value); };

    // Sync with existing district select if available
    setTimeout(function() {
      var ds = document.getElementById('districtSelect');
      if (ds && ds.value) {
        var sfDist = document.getElementById('sfDistrict');
        if (sfDist && sfDist.querySelector('option[value="' + ds.value + '"]')) {
          sfDist.value = ds.value;
          onSFDistrictChange(ds.value);
        }
      }
    }, 300);
  }

  function populateStateSelect() {
    var sel = document.getElementById('sfState');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- State --</option>';
    Object.keys(stateData).forEach(function(k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = stateData[k].name;
      if (k === 'mp') o.selected = true;
      sel.appendChild(o);
    });
  }

  function onSFStateChange(stateKey) {
    SEL.currentState = stateKey;
    populateDistrictSelect();
    clearSelect('sfBlock');
    clearSelect('sfVillage');
  }

  function populateDistrictSelect() {
    var sel = document.getElementById('sfDistrict');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- District --</option>';
    var keys = typeof MP_DISTRICTS !== 'undefined' ? Object.keys(MP_DISTRICTS).sort(function(a,b) {
      return MP_DISTRICTS[a].name.localeCompare(MP_DISTRICTS[b].name);
    }) : [];
    keys.forEach(function(k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = MP_DISTRICTS[k].name;
      sel.appendChild(o);
    });
    sel.disabled = false;
  }

  function onSFDistrictChange(distKey) {
    SEL.currentDistrict = distKey;
    SEL.currentBlock = null;
    SEL.currentVillage = null;
    clearSelect('sfBlock');
    clearSelect('sfVillage');
    if (!distKey) return;
    // Sync with main district select
    var ds = document.getElementById('districtSelect');
    if (ds && ds.value !== distKey) { ds.value = distKey; if (ds.onchange) ds.onchange(); }
    // Load village boundary and populate blocks
    loadDistrictShapefile(distKey);
    populateBlockSelect(distKey);
    showLoading(false);
  }

  function populateBlockSelect(distKey) {
    var sel = document.getElementById('sfBlock');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Block --</option>';
    if (!distKey || !MP_DISTRICTS[distKey]) { sel.disabled = true; return; }
    var blocks = MP_DISTRICTS[distKey].blocks || {};
    Object.keys(blocks).forEach(function(b) {
      var o = document.createElement('option');
      o.value = b;
      o.textContent = b.replace(/_/g, ' ');
      sel.appendChild(o);
    });
    sel.disabled = false;
  }

  function onSFBlockChange(block) {
    SEL.currentBlock = block;
    SEL.currentVillage = null;
    clearSelect('sfVillage');
    if (!block) return;
    populateVillageSelect(SEL.currentDistrict, block);
    showLoading(false);
  }

  function populateVillageSelect(distKey, block) {
    var sel = document.getElementById('sfVillage');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Village --</option>';
    if (!distKey || !block || !MP_DISTRICTS[distKey]) { sel.disabled = true; return; }
    var blocks = MP_DISTRICTS[distKey].blocks || {};
    var villages = blocks[block] || [];
    villages.forEach(function(v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    sel.disabled = villages.length === 0;
  }

  function onSFVillageChange(village) {
    SEL.currentVillage = village;
    if (!village) return;
    // Sync with main village select
    var vs = document.getElementById('villageSelect');
    if (vs) {
      // Check if village exists in dropdown
      var found = false;
      for (var i = 0; i < vs.options.length; i++) {
        if (vs.options[i].value === village) { vs.value = village; found = true; break; }
      }
      if (found && vs.onchange) vs.onchange();
    }
    showLoading(false);
  }

  function loadDistrictShapefile(distKey) {
    showLoading(true);
    var map = window.leafletMap;
    if (!map) { showLoading(false); return; }
    // Load village boundaries
    var file = 'data/villages_' + distKey + '.geojson';
    fetch(file).then(function(r) {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    }).then(function(geo) {
      if (window._villageLayer && map.hasLayer(window._villageLayer)) map.removeLayer(window._villageLayer);
      window._villageLayer = L.geoJSON(geo, {
        style: { color: '#6fc795', weight: 0.8, fillColor: '#6fc795', fillOpacity: 0.08 },
        onEachFeature: function(f, l) {
          l.bindPopup('<b>' + (f.properties.Villl_name || f.properties.name || 'Village') + '</b>');
        }
      });
      map.addLayer(window._villageLayer);
      showLoading(false);
    }).catch(function() {
      // Fallback: synthetic villages
      if (window.loadVillageBoundaries) window.loadVillageBoundaries(distKey);
      showLoading(false);
    });
  }

  function clearSelect(id) {
    var sel = document.getElementById(id);
    if (sel) { sel.innerHTML = '<option value="">-- Select --</option>'; sel.disabled = true; }
  }

  function showLoading(show) {
    var el = document.getElementById('sfLoadIndicator');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  // Expose
  window.initShapefileSelector = initShapefileSelector;
  window.onSFStateChange = onSFStateChange;
  window.onSFDistrictChange = onSFDistrictChange;
  window.onSFBlockChange = onSFBlockChange;
  window.onSFVillageChange = onSFVillageChange;

  // Init on DOM ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function() { setTimeout(initShapefileSelector, 1500); });
  else setTimeout(initShapefileSelector, 1500);
})();
