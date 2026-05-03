// auth.js - Authentication and Session Management

async function doLogin() {
  const userIn = document.getElementById('l-user');
  const passIn = document.getElementById('l-pass');
  const errorEl = document.getElementById('login-error');
  const btn = document.querySelector('#login-card .btn-primary');

  if (!userIn || !passIn) return;
  const username = userIn.value.trim();
  const password = passIn.value.trim();

  if (!username || !password) {
    if (errorEl) errorEl.textContent = 'Enter username and password';
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Authenticating...'; }
    if (errorEl) errorEl.textContent = '';

    const { data: user, error } = await supabaseClient.from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !user) {
      if (errorEl) errorEl.textContent = 'Invalid username or password';
      return;
    }

    // Fetch employee profile
    const { data: emp, error: ee } = await supabaseClient.from('employees')
      .select('*')
      .eq('id', user.employee_id)
      .single();

    if (ee || !emp) {
      if (errorEl) errorEl.textContent = 'Employee profile not found';
      return;
    }

    // Success! Load all data and start session
    const companyId = user.company_id || emp.company_id;
    await loadAllFromSupabase(companyId, user.role);
    
    const session = {
      employeeId: emp.id,
      role: user.role,
      companyId: companyId,
      loginTime: new Date().toISOString(),
      activeSiteId: null
    };

    sessionStorage.setItem('sup_session', JSON.stringify(session));
    startSupabaseListeners();
    showApp();
    
    if (typeof renderDashboard === 'function') renderDashboard();
    
  } catch (err) {
    console.error('Login error:', err);
    if (errorEl) errorEl.textContent = '⚠ Connection error';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Login →'; }
  }
}

function doLogout() {
  sessionStorage.removeItem('sup_session');
  location.reload();
}

async function initAuth() {
  const s = getSession();
  const loginScreen = document.getElementById('login-screen');
  const loader = document.getElementById('fb-loading');

  if (!s) {
    if (loader) loader.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
    return;
  }

  try {
    // Verify session still valid (re-load data)
    await loadAllFromSupabase(s.companyId, s.role);
    startSupabaseListeners();
    showApp();
    if (loader) loader.style.display = 'none';
  } catch(err) {
    console.error('initAuth error:', err);
    if (loader) loader.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
  }
}
