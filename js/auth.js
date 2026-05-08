// auth.js - Authentication and Session Management

const SUPERADMIN_USERNAME = 'ptlprth29@gmail.com';
const SUPERADMIN_PASSWORD = 'password321422';

async function doLogin() {
  const userIn   = document.getElementById('l-user');
  const passIn   = document.getElementById('l-pass');
  const errorEl  = document.getElementById('login-error');
  const btn      = document.querySelector('#login-card .btn-primary');

  if (!userIn || !passIn) return;
  const username = userIn.value.trim().toLowerCase();
  const password = passIn.value;

  if (!username || !password) {
    if (errorEl) errorEl.textContent = 'Enter username and password';
    return;
  }

  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
    if (errorEl) errorEl.textContent = '';

    const { data: users, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password);

    const user = users && users[0];

    if (error || !user) {
      if (errorEl) errorEl.textContent = '✗ Invalid username or password';
      return;
    }

    const { data: emp, error: ee } = await supabaseClient
      .from('employees')
      .select('*')
      .eq('id', user.employee_id)
      .single();

    if (ee || !emp) {
      if (errorEl) errorEl.textContent = '✗ Employee profile not found';
      return;
    }

    if (!emp.active) {
      if (errorEl) errorEl.textContent = '✗ Account is inactive';
      return;
    }

    const companyId = user.company_id || emp.company_id || null;
    const loader = document.getElementById('fb-loading');
    if (loader) loader.style.display = 'flex';

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

  } catch (err) {
    console.error('Login error:', err);
    if (errorEl) errorEl.textContent = '⚠ Connection error. Try again.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Login →'; }
    const loader = document.getElementById('fb-loading');
    if (loader) loader.style.display = 'none';
  }
}

function doLogout() {
  sessionStorage.removeItem('sup_session');
  const shell = document.getElementById('app-shell');
  if (shell) shell.setAttribute('hidden', '');
  const ls = document.getElementById('login-screen');
  if (ls) ls.style.display = 'flex';
  const u = document.getElementById('l-user');
  const p = document.getElementById('l-pass');
  if (u) u.value = '';
  if (p) p.value = '';
}

async function initAuth() {
  const loader      = document.getElementById('fb-loading');
  const loginScreen = document.getElementById('login-screen');

  const showLogin = () => {
    if (loader) loader.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
  };

  try {
    // 1. Verify DB is reachable
    const { data: compData, error: ce } = await supabaseClient
      .from('companies').select('id').limit(1);
    if (ce) throw new Error('DB unreachable: ' + ce.message);

    // 2. Bootstrap superadmin — always ensure correct credentials
    await supabaseClient.from('employees').upsert([{
      id: 'SU001', name: 'Superadmin', role: 'SU',
      designation: 'Super Administrator',
      avatar: 'SA', active: true, status: 'active'
    }], { onConflict: 'id' });

    await supabaseClient.from('users').delete().eq('employee_id', 'SU001');
    await supabaseClient.from('users').insert([{
      username: SUPERADMIN_USERNAME,
      password: SUPERADMIN_PASSWORD,
      role: 'SU', employee_id: 'SU001'
    }]);

    // 3. First run — create company + admin account
    if (!compData || compData.length === 0) {
      await firstTimeSetup();
    } else {
      // Ensure admin user exists for existing company
      const compId = compData[0].id;
      const { data: adminCheck } = await supabaseClient
        .from('users').select('id').eq('username', 'admin');
      if (!adminCheck || adminCheck.length === 0) {
        await supabaseClient.from('employees').upsert([{
          id: 'ADM001', name: 'Admin', role: 'PM',
          designation: 'Project Manager', department: 'Management',
          avatar: 'AD', active: true, status: 'active', company_id: compId
        }], { onConflict: 'id' });
        await supabaseClient.from('users').insert([{
          username: 'admin', password: 'Admin@123',
          role: 'PM', employee_id: 'ADM001', company_id: compId
        }]);
      }
    }

    // 4. Resume session or show login
    const s = getSession();
    if (s) {
      await loadAllFromSupabase(s.companyId, s.role);
      startSupabaseListeners();
      showApp();
      if (loader) loader.style.display = 'none';
    } else {
      showLogin();
    }

  } catch (err) {
    console.error('initAuth error:', err);
    showLogin();
    const el = document.getElementById('login-error');
    if (el) el.textContent = '⚠ Cannot connect. Check your internet connection.';
  }
}

async function firstTimeSetup() {
  try {
    const { data: comp, error: ce } = await supabaseClient
      .from('companies')
      .insert([{ name: 'Patel Infrastructure Pvt. Ltd.' }])
      .select().single();
    if (ce || !comp) throw new Error('Company creation failed');
    const compId = comp.id;

    await supabaseClient.from('sites')
      .insert([{ name: 'Default Site', company_id: compId }]);

    await supabaseClient.from('employees').upsert([{
      id: 'ADM001', name: 'Admin', role: 'PM',
      designation: 'Project Manager', department: 'Management',
      avatar: 'AD', active: true, status: 'active', company_id: compId
    }], { onConflict: 'id' });

    await supabaseClient.from('users').insert([{
      username: 'admin', password: 'Admin@123',
      role: 'PM', employee_id: 'ADM001', company_id: compId
    }]);

    await supabaseClient.from('meta').upsert(
      [{ key: 'config', seeded: true, company_id: compId }],
      { onConflict: 'key' }
    );
    console.log('First-time setup complete. Login: admin / Admin@123');
  } catch (err) {
    console.error('firstTimeSetup error:', err);
  }
}
