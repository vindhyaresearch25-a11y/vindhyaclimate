// ============================================================
// VINDHYA Climate Intelligence - Authentication System
// Role-based login: Admin | Farmer | Corporate
// ============================================================
(function() {
  var AUTH = {
    currentUser: null,
    sessionKey: 'vindhya_auth',
    users: [
      { id: 'admin1', username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator', email: 'admin@vindhya.org' },
      { id: 'farmer1', username: 'farmer', password: 'farmer123', role: 'farmer', name: 'Ram Singh', email: 'ram@farmer.org', village: 'Kanadia', district: 'indore' },
      { id: 'farmer2', username: 'kisan', password: 'kisan123', role: 'farmer', name: 'Shyam Verma', email: 'shyam@farmer.org', village: 'Rau', district: 'indore' },
      { id: 'corp1', username: 'corporate', password: 'corp123', role: 'corporate', name: 'Corporate User', email: 'corp@company.com' }
    ]
  };

  var rolePermissions = {
    admin: {
      canAccess: function(page) { return true; },
      label: 'Administrator',
      color: '#e74c3c',
      panels: ['dashboard','climate','ndvi','rain','soil','heatwaves','precip','drought','ground','crop','advisory','pmfby','forest','bio','ai','village','panch','sat','cadastral','api','admin','users','settings','logs']
    },
    farmer: {
      canAccess: function(page) {
        var allowed = ['dashboard','climate','ndvi','rain','soil','crop','advisory','forest','village','cadastral'];
        return allowed.indexOf(page) >= 0;
      },
      label: 'Farmer',
      color: '#27ae60',
      panels: ['dashboard','climate','ndvi','rain','soil','crop','advisory','forest','village','cadastral']
    },
    corporate: {
      canAccess: function(page) {
        var allowed = ['dashboard','climate','ndvi','rain','soil','heatwaves','drought','precip','ai','api'];
        return allowed.indexOf(page) >= 0;
      },
      label: 'Corporate Analyst',
      color: '#2980b9',
      panels: ['dashboard','climate','ndvi','rain','soil','heatwaves','drought','precip','ai','api']
    }
  };

  function loadSession() {
    try {
      var s = localStorage.getItem(AUTH.sessionKey);
      if (s) AUTH.currentUser = JSON.parse(s);
    } catch(e) {}
  }

  function saveSession() {
    try {
      if (AUTH.currentUser) localStorage.setItem(AUTH.sessionKey, JSON.stringify(AUTH.currentUser));
      else localStorage.removeItem(AUTH.sessionKey);
    } catch(e) {}
  }

  function findUser(username, password) {
    return AUTH.users.filter(function(u) { return u.username === username && u.password === password; })[0] || null;
  }

  function login(username, password) {
    var user = findUser(username, password);
    if (!user) return { ok: false, msg: 'Invalid username or password' };
    AUTH.currentUser = { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email, village: user.village, district: user.district };
    saveSession();
    applyAuthUI();
    closeLoginModal();
    return { ok: true, msg: 'Login successful' };
  }

  function logout() {
    AUTH.currentUser = null;
    saveSession();
    applyAuthUI();
    var msg = document.getElementById('authStatusMsg');
    if (msg) msg.innerHTML = '<span style="color:var(--green)">Logged out successfully</span>';
  }

  function isLoggedIn() { return AUTH.currentUser !== null; }

  function getUser() { return AUTH.currentUser; }

  function getRole() { return AUTH.currentUser ? AUTH.currentUser.role : null; }

  function canAccess(page) {
    if (!AUTH.currentUser) return false;
    var role = rolePermissions[AUTH.currentUser.role];
    return role ? role.canAccess(page) : false;
  }

  function getRoleInfo() {
    if (!AUTH.currentUser) return null;
    return rolePermissions[AUTH.currentUser.role] || null;
  }

  function openLoginModal() {
    var m = document.getElementById('loginModal');
    if (m) { m.style.display = 'flex'; return; }
    // Create login modal
    m = document.createElement('div');
    m.id = 'loginModal';
    m.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;align-items:center;justify-content:center;';
    m.onclick = function(e) { if (e.target === m) closeLoginModal(); };
    m.innerHTML = '<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:2rem;width:380px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">' +
        '<h2 style="margin:0;font-size:1.2rem;color:var(--text);font-weight:700;">Login</h2>' +
        '<button onclick="closeLoginModal()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;">&times;</button>' +
      '</div>' +
      '<div id="authStatusMsg" style="font-size:0.8rem;margin-bottom:0.8rem;min-height:1.2rem;"></div>' +
      '<label style="font-size:0.75rem;color:var(--text-dim);font-weight:600;display:block;margin-bottom:0.3rem;">Username</label>' +
      '<input id="loginUser" type="text" style="width:100%;padding:0.6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text);font-size:0.85rem;margin-bottom:0.8rem;font-family:inherit;box-sizing:border-box;">' +
      '<label style="font-size:0.75rem;color:var(--text-dim);font-weight:600;display:block;margin-bottom:0.3rem;">Password</label>' +
      '<input id="loginPass" type="password" style="width:100%;padding:0.6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text);font-size:0.85rem;margin-bottom:1.2rem;font-family:inherit;box-sizing:border-box;">' +
      '<button onclick="doLogin()" style="width:100%;padding:0.7rem;background:linear-gradient(135deg,var(--cyan),var(--teal));border:none;border-radius:6px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Sign In</button>' +
      '<div style="margin-top:1rem;font-size:0.7rem;color:var(--text-dim);text-align:center;">Demo: admin/admin123 &bull; farmer/farmer123 &bull; corporate/corp123</div>' +
    '</div>';
    document.body.appendChild(m);
    setTimeout(function() { var inp = document.getElementById('loginUser'); if (inp) inp.focus(); }, 100);
  }

  function closeLoginModal() {
    var m = document.getElementById('loginModal');
    if (m) { m.style.display = 'none'; m.remove(); }
  }

  function doLogin() { var u = document.getElementById('loginUser'); var p = document.getElementById('loginPass'); if (u && p) login(u.value, p.value); else login('',''); }
  function doLogout() { logout(); }
  function openLoginModalGlobal() { openLoginModal(); }

  function applyAuthUI() {
    // Update topbar login button
    var btn = document.getElementById('authBtn');
    if (!btn) {
      var tb = document.getElementById('topbar');
      if (tb) {
        btn = document.createElement('div');
        btn.id = 'authBtn';
        btn.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0 0.8rem;cursor:pointer;font-size:0.75rem;font-weight:600;color:var(--text);border-left:1px solid var(--border);flex-shrink:0;';
        btn.onclick = function() { if (isLoggedIn()) { toggleUserMenu(); } else { openLoginModal(); } };
        tb.appendChild(btn);
      }
    }
    if (!btn) return;
    if (AUTH.currentUser) {
      var ri = getRoleInfo();
      btn.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + (ri ? ri.color : 'var(--green)') + ';display:inline-block;"></span>' +
        '<span>' + AUTH.currentUser.name.split(' ')[0] + '</span>' +
        '<span style="font-size:0.6rem;color:var(--text-dim);font-weight:400;">' + (ri ? ri.label : '') + '</span>';
    } else {
      btn.innerHTML = '<i class="fa fa-lock" style="font-size:0.7rem;"></i><span>Login</span>';
    }
    // Apply sidebar visibility
    applyNavRestrictions();
  }

  function applyNavRestrictions() {
    document.querySelectorAll('.nav-item').forEach(function(item) {
      var section = item.getAttribute('onclick');
      if (!section) return;
      var m = section.match(/'([^']+)'/);
      if (!m) return;
      var page = m[1];
      if (!AUTH.currentUser) { item.style.display = 'none'; return; }
      var ri = rolePermissions[AUTH.currentUser.role];
      if (ri && ri.panels.indexOf(page) >= 0) { item.style.display = ''; } else { item.style.display = 'none'; }
    });
    // Show/hide admin panes
    document.querySelectorAll('.admin-only').forEach(function(el) {
      el.style.display = (AUTH.currentUser && AUTH.currentUser.role === 'admin') ? '' : 'none';
    });
  }

  function toggleUserMenu() {
    var existing = document.getElementById('userMenu');
    if (existing) { existing.remove(); return; }
    var m = document.createElement('div');
    m.id = 'userMenu';
    m.style.cssText = 'position:fixed;top:48px;right:0.5rem;z-index:9998;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0;min-width:180px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';
    var ri = getRoleInfo();
    m.innerHTML = '<div style="padding:0.5rem 1rem;font-size:0.75rem;color:var(--text-dim);border-bottom:1px solid var(--border);">' +
      '<div style="font-weight:700;color:var(--text);">' + (AUTH.currentUser ? AUTH.currentUser.name : '') + '</div>' +
      '<div style="color:' + (ri ? ri.color : 'var(--cyan)') + ';">' + (ri ? ri.label : '') + '</div>' +
      '</div>' +
      '<div class="admin-only" onclick="switchRole(\'admin\')" style="padding:0.5rem 1rem;font-size:0.8rem;cursor:pointer;color:var(--text);display:' + (AUTH.currentUser && AUTH.currentUser.role === 'admin' ? '' : 'none') + ';">Switch to Admin Panel</div>' +
      '<div onclick="doLogout();document.getElementById(\'userMenu\').remove();" style="padding:0.5rem 1rem;font-size:0.8rem;cursor:pointer;color:var(--red);">Sign Out</div>';
    m.onmouseleave = function() { setTimeout(function() { var mu = document.getElementById('userMenu'); if (mu) mu.remove(); }, 500); };
    document.body.appendChild(m);
  }

  function switchRole(role) {
    if (AUTH.currentUser && AUTH.currentUser.role === 'admin') {
      AUTH.currentUser.role = role;
      saveSession();
      applyAuthUI();
      var mu = document.getElementById('userMenu');
      if (mu) mu.remove();
    }
  }

  // Expose globals
  window.isLoggedIn = isLoggedIn;
  window.getUser = getUser;
  window.getRole = getRole;
  window.canAccess = canAccess;
  window.getRoleInfo = getRoleInfo;
  window.openLoginModal = openLoginModalGlobal;
  window.closeLoginModal = closeLoginModal;
  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.toggleUserMenu = toggleUserMenu;
  window.switchRole = switchRole;
  window.applyNavRestrictions = applyNavRestrictions;

  // Init
  loadSession();
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(applyAuthUI, 100);
  });
  // Also run after scripts load
  if (document.readyState === 'complete') setTimeout(applyAuthUI, 200);
  else document.addEventListener('readystatechange', function() { if (document.readyState === 'complete') setTimeout(applyAuthUI, 200); });
})();
