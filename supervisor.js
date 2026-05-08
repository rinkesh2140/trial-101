// ══════════════════════════════════════════════════════════
// SUPABASE INIT
// ══════════════════════════════════════════════════════════
const SUPABASE_URL = "https://yzevducedcvxvugozmbu.supabase.co";
const SUPABASE_KEY = "sb_publishable_sFuIGiOOco0RjlCVGG5C6Q_2VDCou5C";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory cache (Supabase data loaded here on startup)
const DB = {
  employees:[], users:[], attendance:[], availability:[],
  tasks:[], notes:[], messages:[], contacts:[], groups:[],
  lmsWorkers:[], lmsAtt:[], pad:{}, punchRequests:[], sites:[], companies:[], announcements:[], employee_sites:[], seeded:false
};

// Low-level Supabase helpers (Async writes)
async function sbUpsert(table, data) {
  const sess = getSession();
  const arr = Array.isArray(data) ? data : [data];
  if (sess && table !== 'companies') {
    arr.forEach(item => {
      if (!item.company_id) item.company_id = sess.companyId;
      if (table !== 'sites' && table !== 'employee_sites' && table !== 'users') {
        if (!item.site_id && sess.activeSiteId && sess.role !== 'SU' && sess.role !== 'PM') {
          item.site_id = sess.activeSiteId;
        }
      }
    });
  }

  const { error } = await supabaseClient.from(table).upsert(arr);
  if (error) {
    console.error('sbUpsert failed:', table, error);
    showToast('Save failed: ' + error.message, 'error');
    throw error;
  }
}

async function sbDel(table, conditions) {
  const { error } = await supabaseClient.from(table).delete().match(conditions);
  if (error) {
    console.error('sbDel failed:', table, error);
    showToast('Delete failed: ' + error.message, 'error');
    throw error;
  }
}

async function loadAllFromSupabase(companyId, role) {
  console.log('Fetching data from Supabase for company:', companyId);
  try {
    const tables = [
      'employees', 'users', 'attendance', 'availability', 'tasks', 'notes',
      'messages', 'contacts', 'groups', 'lms_workers', 'lms_attendance',
      'pad', 'punch_requests', 'sites', 'companies', 'announcements', 'employee_sites'
    ];

    const results = await Promise.all(tables.map(table => {
      let query = supabaseClient.from(table).select('*');
      if (role !== 'SU' && table !== 'companies' && table !== 'employee_sites') {
        query = query.eq('company_id', companyId);
      }
      return query.then(res => {
        console.log(`Fetched table: ${table}`, res.error ? 'ERROR' : 'SUCCESS');
        return res;
      });
    }));

    let metaRes = { data: null, error: null };
    try {
      metaRes = await supabaseClient.from('meta').select('*').eq('key', 'config').single();
    } catch(e) {
      console.log('No meta config found or error fetching it');
    }
    console.log('Fetched meta config', metaRes.error ? 'MISSING' : 'SUCCESS');

    DB.employees     = results[0].data || [];
    DB.users         = results[1].data || [];
    DB.attendance    = results[2].data || [];
    DB.availability  = results[3].data || [];
    DB.tasks         = results[4].data || [];
    DB.notes         = results[5].data || [];
    DB.messages      = results[6].data || [];
    DB.contacts      = results[7].data || [];
    DB.groups        = results[8].data || [];
    DB.lmsWorkers    = results[9].data || [];
    DB.lmsAtt        = results[10].data || [];
    const padDocs    = results[11].data || [];
    DB.punchRequests = results[12].data || [];
    DB.sites         = results[13].data || [];
    DB.companies     = results[14].data || [];
    DB.announcements = results[15].data || [];
    DB.employee_sites= results[16].data || [];

    DB.pad = {};
    padDocs.forEach(item => { if (!DB.pad[item.userId]) DB.pad[item.userId] = []; DB.pad[item.userId].push(item); });
    DB.seeded = metaRes.data ? !!(metaRes.data.seeded) : false;

    console.log('DB Cache initialized. Employee count:', DB.employees.length);
  } catch (err) {
    console.error('Critical failure in loadAllFromSupabase:', err);
  }
}

// Real-time message listener — updates chat live
function startSupabaseListeners() {
  // Real-time: messages
  supabaseClient.channel('messages-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
      if (payload.eventType === 'INSERT') DB.messages.push(payload.new);
      if (payload.eventType === 'UPDATE') { const idx = DB.messages.findIndex(m => m.id === payload.new.id); if (idx > -1) DB.messages[idx] = payload.new; }
      if (payload.eventType === 'DELETE') { DB.messages = DB.messages.filter(m => m.id === payload.old.id); }
      updateMsgBadge();
      try { renderConvList(); } catch(e){}
      try { if (waChatGroup) renderWAGroupThread(); else if (waChatWith) renderWAChatThread(); } catch(e){}
    })
    .subscribe();

  // Real-time: availability
  supabaseClient.channel('avail-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, payload => {
      const updated = payload.new;
      const idx = DB.availability.findIndex(a => a.employeeId === updated.employeeId && a.date === updated.date);
      if (idx > -1) DB.availability[idx] = updated; else DB.availability.push(updated);
      try { const s = document.querySelector('#sec-schedule.active'); if(s) renderSchedule(); } catch(e){}
      try { const s = document.querySelector('#sec-dashboard.active'); if(s) renderDashboard(); } catch(e){}
    })
    .subscribe();

  // Real-time: attendance
  supabaseClient.channel('att-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
      const updated = payload.new;
      const idx = DB.attendance.findIndex(a => a.employeeId === updated.employeeId && a.date === updated.date);
      if (idx > -1) DB.attendance[idx] = updated; else DB.attendance.push(updated);
      try { const s = document.querySelector('#sec-dashboard.active'); if(s) renderDashboard(); } catch(e){}
      try { const s = document.querySelector('#sec-people.active');    if(s) renderPeople();   } catch(e){}
      try { const s = document.querySelector('#sec-schedule.active');  if(s) renderSchedule(); } catch(e){}
    })
    .subscribe();

  // Real-time: tasks
  supabaseClient.channel('tasks-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
      if (payload.eventType === 'DELETE') {
        DB.tasks = DB.tasks.filter(t => t.id !== payload.old.id);
      } else {
        const updated = payload.new;
        const idx = DB.tasks.findIndex(t => t.id === updated.id);
        if (idx > -1) DB.tasks[idx] = updated; else DB.tasks.push(updated);
      }
      try { const s = document.querySelector('#sec-tasks.active'); if(s) renderTasks(); } catch(e){}
      try { const s = document.querySelector('#sec-dashboard.active'); if(s) renderDashboard(); } catch(e){}
    })
    .subscribe();

  // Real-time: groups (chat)
  supabaseClient.channel('groups-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, payload => {
      const updated = payload.new;
      const idx = DB.groups.findIndex(g => g.id === updated.id);
      if (idx > -1) DB.groups[idx] = updated; else DB.groups.push(updated);
      try { renderConvList(); } catch(e){}
    })
    .subscribe();
}

// Alias for legacy calls
const startMessageListener = startSupabaseListeners;



// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════
const ROLES = {
  SU: { label:'Super Admin',         level:0 },
  PM: { label:'Project Manager',     level:1 },
  SM: { label:'Site Manager',        level:2 },
  HR: { label:'HR Manager',          level:3 },
  SE: { label:'Senior Site Engineer',level:4 },
  EN: { label:'Site Engineer',       level:5 },
  SV: { label:'Supervisor/Foreman',  level:6 },
  JE: { label:'Junior Engineer',     level:7 },
  AS: { label:'Asst. Supervisor',    level:8 },
  TK: { label:'Timekeeper',          level:9 }
};

const ALL_ROLES = ['SU','PM','SM','HR','SE','EN','SV','JE','AS','TK'];
const TAB_ACCESS = {
  dashboard: ALL_ROLES,
  work:      ['PM','SM','HR','SE','EN','SV','JE','AS'],
  messages:  ALL_ROLES,
  people:    ALL_ROLES,
  admin:     ['SU','PM','SM','HR'],
  more:      ALL_ROLES,
  // sub-tabs of More (not in nav, accessed via More hub)
  schedule:  ALL_ROLES,
  mypad:     ALL_ROLES,
  reports:   ['PM','SM','HR'],
  profile:   ALL_ROLES
};

const MORE_SUB_TABS = ['schedule','mypad','reports','profile'];
const NAV_TABS      = ['work','people','dashboard','messages','admin','more'];

const TAB_LABELS = {
  dashboard: 'Home', work: 'Work', messages: 'Chat', people: 'Crew', admin: 'Admin', more: 'More',
  schedule: 'Schedule', mypad: 'My Pad', reports: 'Reports', profile: 'Profile'
};
const TAB_ICONS = {
  dashboard: '🏠', work: '✅', messages: '💬', people: '👷', admin: '⚙️', more: '☰',
  schedule: '📅', mypad: '📝', reports: '📊', profile: '👤'
};

// Inline SVG icons for availability status
const AVAIL_SVG = {
  'on-site': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="10" width="18" height="12" rx="1" fill="#27ae60"/>
    <path d="M2 11L12 3L22 11" stroke="#1e8449" stroke-width="2" stroke-linecap="round"/>
    <rect x="9" y="15" width="6" height="7" rx="1" fill="#fff" opacity="0.8"/>
    <rect x="5" y="13" width="3" height="3" rx="0.5" fill="#fff" opacity="0.7"/>
    <rect x="16" y="13" width="3" height="3" rx="0.5" fill="#fff" opacity="0.7"/>
  </svg>`,
  'wfh': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12L12 4L21 12V20C21 20.6 20.6 21 20 21H15V16H9V21H4C3.4 21 3 20.6 3 20V12Z" fill="#2980b9"/>
    <rect x="9" y="16" width="6" height="5" rx="0.5" fill="#fff" opacity="0.85"/>
    <path d="M2 12L12 4L22 12" stroke="#1a5276" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  'leave': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 18 Q8 10 12 14 Q16 18 20 10" stroke="#e74c3c" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <circle cx="12" cy="7" r="3" fill="#e74c3c"/>
    <rect x="2" y="19" width="20" height="2" rx="1" fill="#e74c3c" opacity="0.5"/>
    <line x1="12" y1="10" x2="12" y2="15" stroke="#e74c3c" stroke-width="1.5"/>
    <path d="M9 13 L12 15 L15 13" stroke="#e74c3c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  </svg>`,
  'field': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.7 2 6 4.7 6 8C6 12.5 12 20 12 20C12 20 18 12.5 18 8C18 4.7 15.3 2 12 2Z" fill="#e67e22"/>
    <circle cx="12" cy="8" r="3" fill="#fff"/>
    <circle cx="12" cy="8" r="1.5" fill="#e67e22"/>
  </svg>`,
  'holiday': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="17" rx="2" fill="#95a5a6"/>
    <rect x="3" y="4" width="18" height="5" rx="2" fill="#7f8c8d"/>
    <rect x="7" y="2" width="2" height="4" rx="1" fill="#555"/>
    <rect x="15" y="2" width="2" height="4" rx="1" fill="#555"/>
    <line x1="8" y1="14" x2="16" y2="14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="10" x2="12" y2="18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  'half-day': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4A8 8 0 0 1 12 20V4Z" fill="#7C3AED"/>
    <path d="M12 4A8 8 0 0 0 12 20V4Z" fill="#EDE9FE"/>
    <circle cx="12" cy="12" r="8" stroke="#7C3AED" stroke-width="1.5" fill="none"/>
  </svg>`
};

const AVAIL = {
  'on-site':  { label:'On Site',  shortLabel:'Site',  svg: AVAIL_SVG['on-site'],  cls:'active-onsite',   cell:'cell-onsite',   badge:'badge-onsite',  color:'#16A34A' },
  'wfh':      { label:'WFH',      shortLabel:'WFH',   svg: AVAIL_SVG['wfh'],      cls:'active-wfh',      cell:'cell-wfh',      badge:'badge-wfh',     color:'#2563EB' },
  'leave':    { label:'Leave',    shortLabel:'Leave', svg: AVAIL_SVG['leave'],    cls:'active-leave',    cell:'cell-leave',    badge:'badge-leave',   color:'#DC2626' },
  'field':    { label:'Field',    shortLabel:'Field', svg: AVAIL_SVG['field'],    cls:'active-field',    cell:'cell-field',    badge:'badge-field',   color:'#D97706' },
  'holiday':  { label:'Off',      shortLabel:'Off',   svg: AVAIL_SVG['holiday'],  cls:'active-holiday',  cell:'cell-holiday',  badge:'badge-holiday', color:'#64748B' },
  'half-day': { label:'Half Day', shortLabel:'Half',  svg: AVAIL_SVG['half-day'], cls:'active-halfday',  cell:'cell-halfday',  badge:'badge-halfday', color:'#7C3AED' }
};

// ══════════════════════════════════════════════════════════
// STORAGE — backed by Firestore (in-memory cache for sync reads)
// ══════════════════════════════════════════════════════════
const filterBySite = (list) => {
  const siteId = getActiveSiteId();
  const sess = getSession();
  if (!siteId || (sess && (sess.role === 'SU' || sess.role === 'PM'))) return list;
  return list.filter(item => !item.site_id || item.site_id === siteId);
};

const getEmployees  = () => {
  const siteId = getActiveSiteId();
  const sess = getSession();
  if (!siteId || (sess && (sess.role === 'SU' || sess.role === 'PM'))) return DB.employees;
  const siteEmpIds = (DB.employee_sites||[]).filter(es => es.site_id === siteId).map(es => es.employee_id);
  return DB.employees.filter(e => siteEmpIds.includes(e.id));
};
const getUsers      = () => DB.users;
const getSupAtt     = () => filterBySite(DB.attendance);
const getAvailList  = () => filterBySite(DB.availability);
const getTasks      = () => filterBySite(DB.tasks);
const getNotes      = () => filterBySite(DB.notes);
const getLmsWorkers = () => filterBySite(DB.lmsWorkers);
const getLmsAtt     = () => filterBySite(DB.lmsAtt);
const getMessages   = () => filterBySite(DB.messages);
const getContacts   = () => filterBySite(DB.contacts);
const getGroups        = () => filterBySite(DB.groups);
const getAnnouncements = () => {
  const sess   = getSession();
  const anns   = DB.announcements || [];
  if (!sess) return anns;
  const siteId = getActiveSiteId();
  return anns.filter(a => !a.type || a.type === 'company' || a.site_id === siteId);
};

const saveEmployees  = async d => { DB.employees   = d; await sbUpsert('employees',  d); };
const saveUsers      = async d => { DB.users       = d; await sbUpsert('users',      d); };
const saveSupAtt     = async d => { DB.attendance  = d; await sbUpsert('attendance', d); };
const saveAvailList  = async d => { DB.availability= d; await sbUpsert('availability',d); };
const saveTasks      = async d => { DB.tasks       = d; await sbUpsert('tasks',      d); };
const saveNotes      = async d => { DB.notes       = d; await sbUpsert('notes',      d); };
const saveLmsWorkers = async d => { DB.lmsWorkers  = d; await sbUpsert('lms_workers', d); };
const saveLmsAtt     = async d => { DB.lmsAtt      = d; await sbUpsert('lms_attendance',d); };
const saveMessages   = async d => { DB.messages    = d; await sbUpsert('messages',   d); };
const saveContacts   = async d => { DB.contacts    = d; await sbUpsert('contacts',   d); };
const saveGroups     = async d => { DB.groups      = d; await sbUpsert('groups',     d); };

// ══════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════
function announcementCard(a) {
  const emp     = (DB.employees||[]).find(e => e.id === a.createdBy);
  const byName  = emp ? emp.name.split(' ')[0] : 'Admin';
  const pri     = a.priority || 'normal';
  const priCls  = pri === 'urgent' ? 'ann-urgent' : pri === 'important' ? 'ann-important' : 'ann-normal';
  const priLbl  = pri === 'urgent' ? '🔴 Urgent' : pri === 'important' ? '🟡 Important' : '🔵 Info';
  const scope   = a.type === 'site'
    ? `📍 ${(DB.sites||[]).find(s => s.id === a.site_id)?.name || 'Site'}`
    : '🏢 Company-Wide';
  const ts      = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';
  return `<div class="ann-card ${priCls}">
    <div class="ann-meta">
      <span class="ann-pri-badge">${priLbl}</span>
      <span class="ann-scope">${scope}</span>
      <span class="ann-ts">${ts}</span>
    </div>
    <div class="ann-title">${a.title}</div>
    ${a.body ? `<div class="ann-body">${a.body}</div>` : ''}
    <div class="ann-by">— ${byName}</div>
  </div>`;
}

function openCreateAnnouncement() {
  const sess = getSession();
  if (!['PM','SM','HR','SU'].includes(sess?.role)) return;
  document.getElementById('ann-title-inp').value   = '';
  document.getElementById('ann-body-inp').value    = '';
  document.getElementById('ann-priority-sel').value= 'normal';
  document.getElementById('ann-type-sel').value    = 'company';
  const siteRow = document.getElementById('ann-site-row');
  if (siteRow) siteRow.style.display = 'none';
  // Populate site selector
  const sel = document.getElementById('ann-site-sel');
  if (sel) {
    const sites = DB.sites || [];
    sel.innerHTML = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  openModal('modal-announcement');
}

function annTypeChange(val) {
  const row = document.getElementById('ann-site-row');
  if (row) row.style.display = val === 'site' ? 'block' : 'none';
}

async function createAnnouncement() {
  const sess     = getSession();
  const title    = document.getElementById('ann-title-inp').value.trim();
  const body     = document.getElementById('ann-body-inp').value.trim();
  const priority = document.getElementById('ann-priority-sel').value;
  const type     = document.getElementById('ann-type-sel').value;
  const siteId   = type === 'site' ? document.getElementById('ann-site-sel')?.value || null : null;
  if (!title) { showToast('Title is required', 'error'); return; }
  const ann = {
    id:        'ANN' + Date.now(),
    title, body, priority,
    type:      type || 'company',
    site_id:   siteId,
    createdBy: getCurrentEmp()?.id || null,
    createdAt: new Date().toISOString(),
    company_id: sess.companyId
  };
  DB.announcements.push(ann);
  await sbUpsert('announcements', [ann]);
  closeModal('modal-announcement');
  showToast('Announcement posted ✓', 'success');
  renderDashboard();
  updateNotificationBadge();
}
// ══════════════════════════════════════════════════════════
// NOTIFICATION BELL
// ══════════════════════════════════════════════════════════
function computeNotifications() {
  const emp  = getCurrentEmp();
  const sess = getSession();
  if (!emp || !sess) return [];
  const notifs   = [];
  const todayStr = today();

  // Overdue tasks assigned to me
  getTasks()
    .filter(t => t.assignedTo === emp.id && t.status !== 'completed' && t.dueDate && t.dueDate < todayStr)
    .forEach(t => notifs.push({ id:'OD'+t.id, icon:'🔴', title:'Overdue Task', body:t.title, action:'work' }));

  // Due today
  getTasks()
    .filter(t => t.assignedTo === emp.id && t.status !== 'completed' && t.dueDate === todayStr)
    .forEach(t => notifs.push({ id:'DT'+t.id, icon:'🟡', title:'Due Today', body:t.title, action:'work' }));

  // Unread announcements
  const readKey  = 'readAnns_' + emp.id;
  const readAnns = JSON.parse(localStorage.getItem(readKey) || '[]');
  getAnnouncements().forEach(a => {
    if (!readAnns.includes(a.id)) {
      notifs.push({ id:'AN'+a.id, annId:a.id, icon:'📢', title:a.title, body:a.body || '', action:'ann', empId:emp.id });
    }
  });

  // Pending punch requests (managers only)
  if (['PM','SM','HR','SU'].includes(sess.role)) {
    const pending = (DB.punchRequests||[]).filter(r => r.status === 'pending');
    if (pending.length > 0) {
      notifs.push({ id:'PR', icon:'⏰', title:`${pending.length} Punch Request${pending.length>1?'s':''}`, body:'Corrections awaiting your review', action:'requests' });
    }
  }

  return notifs;
}

function updateNotificationBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = computeNotifications().length;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function markAnnRead(annId, empId) {
  const key      = 'readAnns_' + empId;
  const readAnns = JSON.parse(localStorage.getItem(key) || '[]');
  if (!readAnns.includes(annId)) { readAnns.push(annId); localStorage.setItem(key, JSON.stringify(readAnns)); }
  updateNotificationBadge();
}

let _notifOpen = false;
function toggleNotifPanel() {
  _notifOpen = !_notifOpen;
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  if (!_notifOpen) { panel.style.display = 'none'; return; }

  const notifs = computeNotifications();
  const emp    = getCurrentEmp();
  if (notifs.length === 0) {
    panel.innerHTML = `<div class="notif-empty">🎉 All caught up!</div>`;
  } else {
    panel.innerHTML = notifs.map(n => `
      <div class="notif-item notif-${n.action}" onclick="handleNotifTap('${n.id}','${n.action}','${n.annId||''}','${n.empId||''}')">
        <div class="notif-icon">${n.icon}</div>
        <div class="notif-text">
          <div class="notif-title">${n.title}</div>
          ${n.body ? `<div class="notif-body">${n.body.slice(0,60)}${n.body.length>60?'…':''}</div>` : ''}
        </div>
      </div>`).join('');
  }
  panel.style.display = 'block';
}

function handleNotifTap(id, action, annId, empId) {
  closeNotifPanel();
  if (action === 'work')     showTab('work');
  if (action === 'requests') { showTab('schedule'); setTimeout(() => switchSchedTab('requests'), 50); }
  if (action === 'ann' && annId && empId) markAnnRead(annId, empId);
}

function closeNotifPanel() {
  _notifOpen = false;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.style.display = 'none';
}

const getPunchRequests  = () => filterBySite(DB.punchRequests);
const savePunchRequests = async d => { DB.punchRequests = d; await sbUpsert('punch_requests', d); };

// ══════════════════════════════════════════════════════════
// DATE HELPERS
// ══════════════════════════════════════════════════════════
const today    = () => new Date().toISOString().split('T')[0];
const nowTime  = () => new Date().toTimeString().slice(0,5);
const nowISO   = () => new Date().toISOString();

function dateOffset(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function dateFuture(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function formatDate(d) {
  return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function formatDT(iso) {
  return new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function dayName(d) {
  return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'});
}
function isFuture(d) { return d > today(); }
function minsFromTimes(a,b) {
  if (!a) return 0;
  const [ah,am] = a.split(':').map(Number);
  if (!b) { const n=new Date(); return Math.max(0,(n.getHours()-ah)*60+(n.getMinutes()-am)); }
  const [bh,bm] = b.split(':').map(Number);
  return Math.max(0,(bh-ah)*60+(bm-am));
}
function fmtMins(m) { if(!m) return '—'; return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m'; }

// ── Multi-punch helpers ──
function totalMinsForRec(rec) {
  if (!rec) return 0;
  const ps = rec.punches || (rec.inTime ? [{inTime:rec.inTime, outTime:rec.outTime}] : []);
  return ps.reduce((s,p) => s + minsFromTimes(p.inTime, p.outTime), 0);
}
function isCurrentlyIN(rec) {
  if (!rec) return false;
  const ps = rec.punches || (rec.inTime ? [{inTime:rec.inTime, outTime:rec.outTime}] : []);
  return ps.length > 0 && !ps[ps.length-1].outTime;
}
function lastPunch(rec) {
  if (!rec) return null;
  const ps = rec.punches || (rec.inTime ? [{inTime:rec.inTime, outTime:rec.outTime}] : []);
  return ps.length > 0 ? ps[ps.length-1] : null;
}
function migrateAttendance() {
  const att = getSupAtt();
  let changed = false;
  att.forEach(rec => {
    if (!rec.punches) {
      rec.punches = rec.inTime ? [{inTime:rec.inTime, outTime:rec.outTime||null}] : [];
      delete rec.inTime; delete rec.outTime;
      changed = true;
    }
  });
  if (changed) saveSupAtt(att);
}

// ── Seniority ──
function computeSeniority(joinDate) {
  if (!joinDate) return '—';
  const start = new Date(joinDate + 'T00:00:00');
  const now   = new Date();
  let months  = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const mo    = months % 12;
  if (years === 0) return mo + ' mo';
  return years + ' yr' + (mo ? ' ' + mo + ' mo' : '');
}

function fmtExpYears(years) {
  if (!years || parseFloat(years) <= 0) return '—';
  const totalMonths = Math.round(parseFloat(years) * 12);
  const y = Math.floor(totalMonths / 12);
  const mo = totalMonths % 12;
  return (y > 0 ? y + ' yr' : '') + (mo > 0 ? (y > 0 ? ' ' : '') + mo + ' mo' : '');
}

function computeTotalExp(joinDate, priorExpYears) {
  let companyMonths = 0;
  if (joinDate) {
    const start = new Date(joinDate + 'T00:00:00');
    const now   = new Date();
    companyMonths = Math.max(0, (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth()));
  }
  const priorMonths = Math.round((parseFloat(priorExpYears)||0) * 12);
  const total = companyMonths + priorMonths;
  if (total === 0) return '—';
  const y = Math.floor(total / 12), mo = total % 12;
  return (y > 0 ? y + ' yr' : '') + (mo > 0 ? (y > 0 ? ' ' : '') + mo + ' mo' : '');
}

// ── Permission checks ──
// Returns list of roles that sessionRole can change TO for target employee
function allowedRoleTargets(sessionRole, targetCurrentRole) {
  // SU can change ANYONE to ANY ROLE except SU
  if (sessionRole === 'SU') {
    return Object.keys(ROLES).filter(r => r !== 'SU');
  }
  // PM can change anyone except themselves (PM->PM meaningless)
  if (sessionRole === 'PM') {
    return Object.keys(ROLES).filter(r => !['PM','SU'].includes(r));
  }
  // SM can change SE/EN/SV/JE/AS/TK (not PM/SM/HR)
  if (sessionRole === 'SM') {
    if (['PM','SM','HR'].includes(targetCurrentRole)) return [];
    return ['SE','EN','SV','JE','AS','TK'];
  }
  // HR with approval: can change EN/SV/JE/AS/TK only
  if (sessionRole === 'HR') {
    const hrEmp = getCurrentEmp();
    if (!hrEmp || !hrEmp.hrRoleEditApproved) return [];
    if (['PM','SM','HR','SE'].includes(targetCurrentRole)) return [];
    return ['EN','SV','JE','AS','TK'];
  }
  return [];
}

function canResignEmp(sessionRole, targetCurrentRole) {
  if (sessionRole === 'SU') return true;
  if (sessionRole === 'PM') return !['PM','SU'].includes(targetCurrentRole);
  if (sessionRole === 'SM') return !['PM','SM','HR'].includes(targetCurrentRole);
  if (sessionRole === 'HR') {
    const hrEmp = getCurrentEmp();
    return !!(hrEmp?.hrRoleEditApproved) && !['PM','SM','HR','SE'].includes(targetCurrentRole);
  }
  return false;
}

// ── Role change ──
async function changeEmpRole(empId) {
  const selEl = document.getElementById('role-change-sel-' + empId);
  if (!selEl) return;
  const newRole = selEl.value;
  const sess = getSession();
  const emps = getEmployees();
  const emp  = emps.find(e => e.id === empId);
  if (!emp) return;
  if (allowedRoleTargets(sess.role, emp.role).length === 0) { showToast('Not authorised','error'); return; }
  emp.role        = newRole;
  emp.designation = ROLES[newRole]?.label || newRole;
  await saveEmployees(emps);
  const users = getUsers();
  const u = users.find(x => x.employeeId === empId);
  if (u) { u.role = newRole; await saveUsers(users); }
  showToast('Role changed to ' + (ROLES[newRole]?.label || newRole), 'success');
  openEmpProfile(empId);
}

// ── Resign / Reactivate ──
function resignEmployee(empId) {
  if (!confirm('Mark this employee as Resigned? All data is preserved.')) return;
  const emps = getEmployees();
  const emp  = emps.find(e => e.id === empId);
  if (!emp) return;
  emp.active       = false;
  emp.status       = 'resigned';
  emp.resignedDate = today();
  saveEmployees(emps);
  showToast(emp.name + ' marked as Resigned', 'info');
  closeModal('modal-emp-profile');
  renderPeople();
}

function reactivateEmployee(empId) {
  if (!confirm('Reactivate this employee?')) return;
  const emps = getEmployees();
  const emp  = emps.find(e => e.id === empId);
  if (!emp) return;
  emp.active       = true;
  emp.status       = 'active';
  emp.resignedDate = null;
  saveEmployees(emps);
  showToast(emp.name + ' reactivated', 'success');
  closeModal('modal-emp-profile');
  renderPeople();
}

function deleteEmployee(empId) {
  const emp = getEmployees().find(e => e.id === empId);
  if (!emp) return;
  if (!confirm(`Permanently remove ${emp.name}'s profile? This cannot be undone.`)) return;
  saveEmployees(getEmployees().filter(e => e.id !== empId));
  // Remove linked user account
  saveUsers(getUsers().filter(u => u.employeeId !== empId));
  showToast(emp.name + ' profile removed', 'info');
  closeModal('modal-emp-profile');
  renderPeople();
}

// ── HR Permission (PM only) ──
function toggleHRPermission(empId) {
  const sess = getSession();
  if (sess.role !== 'PM') { showToast('Only PM can grant/revoke this permission','error'); return; }
  const emps = getEmployees();
  const emp  = emps.find(e => e.id === empId);
  if (!emp || emp.role !== 'HR') return;
  emp.hrRoleEditApproved = !emp.hrRoleEditApproved;
  saveEmployees(emps);
  showToast(emp.hrRoleEditApproved ? 'HR role-edit permission GRANTED' : 'HR permission REVOKED',
            emp.hrRoleEditApproved ? 'success' : 'info');
  openEmpProfile(empId);
}

function getMonthDates(ym) {
  const [y,m] = ym.split('-').map(Number);
  const days = new Date(y,m,0).getDate();
  return Array.from({length:days},(_,i)=>`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
}

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
let _tt;
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = type; // success | error | warning | info
  t.style.display = 'block';
  clearTimeout(_tt);
  _tt = setTimeout(() => { t.style.display = 'none'; t.className = ''; }, 3200);
}

// ══════════════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function overlayClose(e, id) { if(e.target===document.getElementById(id)) closeModal(id); }

// ══════════════════════════════════════════════════════════
// AUTH & SESSION
// ══════════════════════════════════════════════════════════
function toggleAuth(showReg) {
  document.getElementById('login-card').style.display     = showReg ? 'none'  : 'block';
  document.getElementById('register-card').style.display  = showReg ? 'block' : 'none';
  document.getElementById('login-error').textContent      = '';
  document.getElementById('register-error').textContent   = '';
}

function togglePassVis(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.style.opacity = show ? '1' : '0.4';
}

async function doRegister() {
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim().toLowerCase();
  const pass  = document.getElementById('r-pass').value;
  const err   = document.getElementById('register-error');

  if (!name || !email || !pass) { err.textContent = '✗ All fields required'; return; }
  err.textContent = 'Registering...';

  // Get default company
  const { data: comps } = await supabaseClient.from('companies').select('id').limit(1);
  const companyId = comps?.[0]?.id;
  if (!companyId) { err.textContent = '✗ App not configured — contact admin'; return; }

  // Check email uniqueness in DB
  const { data: existEmail } = await supabaseClient.from('employees').select('id').eq('email', email).limit(1);
  if (existEmail?.length > 0) { err.textContent = '✗ Email already registered'; return; }

  // Generate unique EMP ID from DB
  const { data: lastEmps } = await supabaseClient.from('employees')
    .select('id').eq('company_id', companyId).order('id', { ascending: false }).limit(1);
  const nextNum = parseInt(lastEmps?.[0]?.id?.replace('EMP','') || '0') + 1;
  const empId   = 'EMP' + String(nextNum).padStart(3, '0');

  const newEmp = {
    id: empId, name, email, role: 'TK', designation: 'Timekeeper',
    avatar: name.charAt(0).toUpperCase(), active: true,
    joinDate: today(), status: 'active', company_id: companyId
  };
  const newUser = {
    employee_id: empId, username: email, password: pass, role: 'TK', email, company_id: companyId
  };

  try {
    await supabaseClient.from('employees').insert([newEmp]);
    await supabaseClient.from('users').insert([newUser]);
    DB.employees.push(newEmp);
    DB.users.push(newUser);
    err.textContent = '';
    showToast('Registered! Login with your email.', 'success');
    toggleAuth(false);
  } catch (e) {
    err.textContent = '✗ Registration failed. Try again.';
  }
}

async function doLogin() {
  const username = document.getElementById('l-user').value.trim().toLowerCase();
  const password = document.getElementById('l-pass').value;
  const err      = document.getElementById('login-error');

  err.textContent = 'Logging in...';

  const { data: user, error } = await supabaseClient.from('users')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();

  if (error || !user) { err.textContent = '✗ Invalid username or password'; return; }

  const { data: emp, error: empErr } = await supabaseClient.from('employees')
    .select('*')
    .eq('id', user.employee_id || user.employeeId)
    .single();

  if (empErr || !emp || !emp.active) { err.textContent = '✗ Account inactive'; return; }

  sessionStorage.setItem('sup_session', JSON.stringify({
    employeeId: emp.id, role: emp.role, username: user.username, companyId: emp.company_id, loginTime: nowISO()
  }));
  err.textContent = '';
  
  const loader = document.getElementById('fb-loading');
  if (loader) loader.style.display = 'flex';
  await loadAllFromSupabase(emp.company_id, emp.role);
  if (loader) loader.style.display = 'none';
  
  showApp();
}

function doLogout() {
  sessionStorage.removeItem('sup_session');
  const shell = document.getElementById('app-shell');
  if (shell) shell.setAttribute('hidden', '');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-pass').value = '';
  document.getElementById('l-user').value = '';
}

function getSession() {
  const s = sessionStorage.getItem('sup_session');
  return s ? JSON.parse(s) : null;
}

function getActiveSiteId() {
  const sess = getSession();
  return sess ? sess.activeSiteId : null;
}

function getCurrentEmp() {
  const s = getSession();
  if (!s) return null;
  return getEmployees().find(e => e.id===s.employeeId) || null;
}

function hasAccess(tab) {
  const s = getSession();
  if (!s) return false;
  return (TAB_ACCESS[tab]||[]).includes(s.role);
}

async function initAuth() {
  const hideLoader = () => { const l = document.getElementById('fb-loading'); if (l) l.style.display = 'none'; };
  const showLogin  = () => { hideLoader(); const ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'flex'; };

  try {
    // 1. Verify DB connection
    const { data: compData, error: ce } = await supabaseClient.from('companies').select('id').limit(1);
    if (ce) throw new Error('Cannot reach database: ' + ce.message);

    // 2. Ensure SU superadmin account always exists (idempotent)
    const { data: suCheck } = await supabaseClient.from('users').select('id').eq('username','superadmin').limit(1);
    if (!suCheck || suCheck.length === 0) {
      await supabaseClient.from('employees').upsert([{
        id:'SU001', name:'Superadmin', role:'SU',
        designation:'Super Administrator',
        active:true, status:'active', avatar:'SU', joinDate:today()
      }]);
      await supabaseClient.from('users').upsert([{
        username:'superadmin', password:'su@admin123',
        role:'SU', employee_id:'SU001'
      }]);
    }

    // 3. First-time setup if no companies
    if (!compData || compData.length === 0) await firstTimeSetup();

    // 4. Resume existing session or show login
    const s = getSession();
    if (s) {
      await loadAllFromSupabase(s.companyId, s.role);
      showApp();
    } else {
      showLogin();
    }
  } catch(err) {
    console.error('initAuth error:', err);
    showLogin();
    const el = document.getElementById('login-error');
    if (el) el.textContent = '⚠ Cannot connect to server. Check your internet connection.';
  }
}

async function firstTimeSetup() {
  const loaderSub = document.querySelector('#fb-loading div:nth-child(3)');
  if (loaderSub) loaderSub.textContent = 'First-time setup…';
  try {
    const { data: comp, error: ce } = await supabaseClient.from('companies')
      .insert([{ name: 'Patel Infrastructure Pvt. Ltd.' }]).select().single();
    if (ce || !comp) throw new Error('Company creation failed: ' + (ce?.message || ''));
    const compId = comp.id;

    await supabaseClient.from('sites')
      .insert([{ name: 'Surat Smart City Road Project', company_id: compId }]);

    // Temp session so sbUpsert injects company_id into all seed records
    sessionStorage.setItem('sup_session', JSON.stringify({ companyId: compId, role: 'PM', employeeId: 'EMP001' }));
    await seedData();
    sessionStorage.removeItem('sup_session');
    if (loaderSub) loaderSub.textContent = 'Setup complete — please login';
    console.log('✓ First-time setup done. Login: rajesh.patel / admin123');
  } catch(err) {
    console.error('firstTimeSetup error:', err);
    sessionStorage.removeItem('sup_session');
  }
}

// ══════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').removeAttribute('hidden');
  let emp = getCurrentEmp();
  // If employee record not found but session is valid (e.g. SU with no company),
  // use a minimal fallback rather than blocking the app entirely
  if (!emp) {
    const sess = getSession();
    if (!sess) { doLogout(); return; }
    emp = { id: sess.employeeId || 'SU001', name: 'Superadmin', role: sess.role || 'SU', avatar: 'SU', active: true };
    DB.employees.push(emp);
  }
  document.getElementById('hdr-avatar').textContent = emp.avatar;
  document.getElementById('hdr-name').textContent   = emp.name.split(' ')[0];
  document.getElementById('hdr-role').textContent   = ROLES[emp.role]?.label || emp.role;
  const slimAv = document.getElementById('slim-avatar');
  if (slimAv) { slimAv.textContent = emp.avatar; slimAv.style.background = avatarColor(emp.role); }

  const hdrSelect = document.getElementById('header-site-select');
  const slimSelect = document.getElementById('slim-site-select');
  if (hdrSelect && slimSelect) {
    if (emp.role === 'SU' || emp.role === 'PM') {
      hdrSelect.style.display = 'none';
      slimSelect.style.display = 'none';
    } else {
      const mySiteIds = (DB.employee_sites || []).filter(es => es.employee_id === emp.id).map(es => es.site_id);
      const mySites = (DB.sites || []).filter(s => mySiteIds.includes(s.id));
      if (mySites.length > 0) {
        hdrSelect.style.display = 'inline-block';
        slimSelect.style.display = 'inline-block';
        const optionsHTML = mySites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        hdrSelect.innerHTML = optionsHTML;
        slimSelect.innerHTML = optionsHTML;
        
        const sess = getSession();
        if (!sess.activeSiteId || !mySiteIds.includes(sess.activeSiteId)) {
          sess.activeSiteId = mySites[0].id;
          sessionStorage.setItem('sup_session', JSON.stringify(sess));
        }
        hdrSelect.value = sess.activeSiteId;
        slimSelect.value = sess.activeSiteId;
      } else {
        hdrSelect.style.display = 'none';
        slimSelect.style.display = 'none';
      }
    }
  }

  buildNav();
  updateMsgBadge();
  updateNotificationBadge();
  showTab('dashboard');
  // Run seed migrations in background after login
  setTimeout(() => seedData().catch(console.error), 1800);
}

function changeActiveSite(siteId) {
  const sess = getSession();
  if (sess) {
    sess.activeSiteId = siteId;
    sessionStorage.setItem('sup_session', JSON.stringify(sess));
    const hdrSelect = document.getElementById('header-site-select');
    const slimSelect = document.getElementById('slim-site-select');
    if (hdrSelect) hdrSelect.value = siteId;
    if (slimSelect) slimSelect.value = siteId;
    
    const activeTabBtn = document.querySelector('#main-nav button.active');
    if (activeTabBtn) showTab(activeTabBtn.dataset.tab, activeTabBtn);
    else showTab('dashboard');
  }
}

function buildNav() {
  const role = getSession()?.role || '';
  const nav  = document.getElementById('main-nav');
  nav.innerHTML = '';
  NAV_TABS.forEach(tab => {
    if (!TAB_ACCESS[tab].includes(role)) return;
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="tab-icon">${TAB_ICONS[tab]||'•'}</span><span class="tab-label">${TAB_LABELS[tab]||tab}</span>`;
    btn.dataset.tab = tab;
    btn.onclick     = () => showTab(tab, btn);
    nav.appendChild(btn);
  });
}

function showTab(name, btn) {
  document.querySelectorAll('#app-shell section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#main-nav button').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('sec-'+name);
  if (sec) sec.classList.add('active');
  if (name === 'admin') renderAdminDashboard();
  // Sub-tabs of More keep the More button highlighted
  const navTabName = MORE_SUB_TABS.includes(name) ? 'more' : name;
  if (btn && !MORE_SUB_TABS.includes(name)) btn.classList.add('active');
  const navBtn = document.querySelector(`#main-nav button[data-tab="${navTabName}"]`);
  if (navBtn) navBtn.classList.add('active');
  // Header state: full on dashboard, slim on others, none on messages
  const fullHdr = document.getElementById('app-header');
  const slimHdr = document.getElementById('slim-header');
  const slimTitle = document.getElementById('slim-header-title');
  const slimAvatar = document.getElementById('slim-avatar');
  const hdrAvatar  = document.getElementById('hdr-avatar');
  if (name === 'dashboard') {
    if (fullHdr) fullHdr.style.display = 'flex';
    if (slimHdr) slimHdr.style.display = 'none';
  } else {
    if (fullHdr) fullHdr.style.display = 'none';
    if (slimHdr) slimHdr.style.display = 'flex';
    const SLIM_TITLES = { messages: 'Patel Infrastructure', more: 'Patel Infrastructure' };
    if (slimTitle) slimTitle.textContent = SLIM_TITLES[name] || TAB_LABELS[name] || name;
    // Sync avatar
    const av = hdrAvatar?.textContent || '—';
    if (slimAvatar) slimAvatar.textContent = av;
    // Extra action button: compose ✏ for messages tab
    const extraBtn = document.getElementById('slim-extra-btn');
    if (extraBtn) {
      if (name === 'messages') {
        extraBtn.textContent = '✏'; extraBtn.style.display = '';
        extraBtn.onclick = openNewChat;
      } else {
        extraBtn.style.display = 'none';
      }
    }
  }

  const renders = {
    dashboard: renderDashboard,
    work:      renderWork,
    messages:  renderMessages,
    people:    renderPeople,
    more:      renderMore,
    schedule:  renderSchedule,
    mypad:     renderMyPad,
    reports:   renderSupReports,
    profile:   renderProfile
  };
  if (renders[name]) renders[name]();
}

function renderMore() {
  const role = getSession()?.role || '';
  const canReports = ['PM','SM','HR'].includes(role);
  const emp  = getCurrentEmp();

  const navItems = [
    { tab:'schedule', icon:'📅', label:'Schedule',   sub:'Attendance & Availability', bg:'#EEF4FD', color:'var(--brand)' },
    { tab:'mypad',    icon:'📝', label:'My Pad',      sub:'Notes, To-Dos & Calls',    bg:'#FFF4EE', color:'var(--accent)' },
    { tab:'profile',  icon:'👤', label:'My Profile',  sub:'Account & personal info',  bg:'#F0FDF4', color:'var(--success)' },
    ...(canReports ? [{ tab:'reports', icon:'📊', label:'Reports', sub:'Attendance, Availability & Labour', bg:'#FDF4FF', color:'#86198F' }] : [])
  ];

  const infoCards = [
    {
      id:'more-about', icon:'🏗️', title:'About Patel Infrastructure',
      body:`<p style="margin-bottom:8px">Patel Infrastructure Pvt. Ltd. is a leading civil construction company headquartered in Surat, Gujarat.</p>
            <p style="margin-bottom:8px">We specialise in road construction, urban infrastructure, smart city projects, and large-scale civil works across Gujarat and Western India.</p>
            <p><b>Incorporated:</b> 2008 &nbsp;·&nbsp; <b>HQ:</b> Surat, Gujarat<br><b>Strength:</b> 200+ employees &nbsp;·&nbsp; <b>Projects:</b> 50+ completed</p>`
    },
    {
      id:'more-site', icon:'📍', title:'Site Details & Goals',
      body:`<p style="margin-bottom:8px"><b>Project:</b> Surat Smart City Road Project</p>
            <p style="margin-bottom:8px"><b>Location:</b> Surat Municipal Corporation limits, Gujarat</p>
            <p style="margin-bottom:8px"><b>Scope:</b> Road widening, drainage, footpath, street lighting & smart infrastructure along designated SMC corridors.</p>
            <b>Key Goals:</b>
            <ul style="margin:6px 0 0 16px;font-size:13px;line-height:1.8">
              <li>Complete all corridors within project timeline</li>
              <li>Zero safety incidents on site</li>
              <li>100% quality compliance with SMC standards</li>
              <li>Timely labour attendance & material tracking</li>
            </ul>`
    },
    {
      id:'more-hr', icon:'📋', title:'HR Policy Highlights',
      body:`<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
              <div class="hr-policy-item" style="border-left-color:var(--brand)"><b>Working Hours:</b> 9:00 AM – 6:00 PM (Mon–Sat). Site ops may vary.</div>
              <div class="hr-policy-item" style="border-left-color:var(--success)"><b>Leave:</b> 12 paid leaves/year. Apply at least 2 days in advance via Schedule tab.</div>
              <div class="hr-policy-item" style="border-left-color:var(--warning)"><b>Attendance:</b> Punch IN/OUT daily. Mispunch corrections via Schedule → Punch Request.</div>
              <div class="hr-policy-item" style="border-left-color:var(--accent)"><b>Overtime:</b> Pre-approved by PM/SM. Submit Extra Hours request after completion.</div>
              <div class="hr-policy-item" style="border-left-color:var(--danger)"><b>Code of Conduct:</b> Maintain professionalism on site. Safety gear mandatory at all times.</div>
              <div class="hr-policy-item" style="border-left-color:#a855f7"><b>Grievances:</b> Raise concerns directly with HR or PM in person or via Chat.</div>
            </div>`
    }
  ];

  document.getElementById('sec-more').innerHTML = `
    <!-- Company header -->
    <div style="text-align:center;padding:20px 0 18px">
      <div style="font-size:48px;margin-bottom:8px">🏗️</div>
      <div style="font-size:18px;font-weight:800;color:var(--text);letter-spacing:-0.3px">Patel Infrastructure</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:3px">Pvt. Ltd. — Surat Smart City Road Project</div>
    </div>

    <!-- Nav links -->
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
      ${navItems.map(it=>`
        <div class="crew-card" style="cursor:pointer;padding:14px 16px;gap:14px" onclick="showTab('${it.tab}')">
          <div style="width:44px;height:44px;border-radius:var(--radius-md);background:${it.bg};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${it.icon}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--text)">${it.label}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${it.sub}</div>
          </div>
          <div style="color:var(--text-3);font-size:18px">›</div>
        </div>`).join('')}
    </div>

    <!-- Info accordion -->
    <div style="font-size:11px;font-weight:800;color:var(--text-3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;padding-left:4px">Information</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${infoCards.map(c=>`
        <div class="card" style="padding:0;overflow:hidden">
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer" onclick="toggleMoreCard('${c.id}')">
            <span style="font-size:20px">${c.icon}</span>
            <span style="font-size:14px;font-weight:600;color:var(--text);flex:1">${c.title}</span>
            <span id="${c.id}-arrow" style="color:var(--text-3);font-size:16px;transition:transform 0.2s">▼</span>
          </div>
          <div id="${c.id}-body" style="display:none;padding:0 16px 16px;font-size:13px;color:var(--text-2);line-height:1.7">
            ${c.body}
          </div>
        </div>`).join('')}
    </div>`;
}

function toggleMoreCard(id) {
  const body  = document.getElementById(id+'-body');
  const arrow = document.getElementById(id+'-arrow');
  const open  = body.style.display !== 'none';
  body.style.display  = open ? 'none' : '';
  arrow.style.transform = open ? '' : 'rotate(180deg)';
}

// ══════════════════════════════════════════════════════════
// ROLE BADGE
// ══════════════════════════════════════════════════════════
function roleBadge(role) {
  const cls = { PM:'badge-pm',SM:'badge-sm',HR:'badge-hr',SE:'badge-se',EN:'badge-en',SV:'badge-sv',JE:'badge-je',AS:'badge-as',TK:'badge-tk' };
  return `<span class="badge ${cls[role]||''}">${ROLES[role]?.label||role}</span>`;
}

// ══════════════════════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════════════════════
function renderProfile() {
  const el = document.getElementById('profile-content');
  if (!el) return;
  try {
    const emp = getCurrentEmp();
    if (!emp) {
      if (DB.employees.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text-2)">
          <div style="font-size:28px;margin-bottom:10px">⏳</div>
          <div style="font-size:14px;font-weight:600">Loading profile…</div>
        </div>`;
        setTimeout(renderProfile, 1500);
        return;
      }
      el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--text-2)">
        <div style="font-size:32px;margin-bottom:12px">👤</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:8px">Profile not loaded</div>
        <div style="font-size:13px;margin-bottom:20px">Tap retry or log out and log in again</div>
        <button class="btn btn-primary" style="width:auto;padding:10px 28px;margin-bottom:10px" onclick="renderProfile()">↺ Retry</button><br>
        <button class="btn" style="background:var(--danger);color:#fff;width:auto;padding:10px 28px;margin-top:8px" onclick="doLogout()">🚪 Logout</button>
      </div>`;
      return;
    }
    const fmtD = d => {
      if (!d) return '—';
      try { return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
      catch(e) { return d; }
    };
    const row = (label, val) => `<div class="profile-row"><span class="profile-row-label">${label}</span><span class="profile-row-val">${val||'—'}</span></div>`;
    const sec = (title, rows) => `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:800;color:var(--text-3);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-left:2px">${title}</div>
        <div style="background:var(--card);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-card)">${rows}</div>
      </div>`;

    const compExp  = computeSeniority(emp.joinDate);
    const totalExp = computeTotalExp(emp.joinDate, emp.priorExpYears);
    const prior    = parseFloat(emp.priorExpYears) || 0;

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:24px 0 20px">
        <div style="width:80px;height:80px;border-radius:50%;background:${avatarColor(emp.role)};color:#fff;font-size:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-bottom:12px">${emp.avatar||'?'}</div>
        <div style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">${emp.name||''}</div>
        <div style="margin-bottom:4px">${roleBadge(emp.role)}</div>
        <div style="font-size:13px;color:var(--text-2)">${emp.department||''}</div>
      </div>

      ${sec('Personal',
        row('Employee ID', emp.id) +
        row('Date of Birth', fmtD(emp.birthDate)) +
        row('Blood Group', emp.bloodGroup ? `<span style="font-weight:700;color:var(--danger)">${emp.bloodGroup}</span>` : '—') +
        row('Mobile', emp.mobile||'—')
      )}

      ${sec('Work',
        row('Date of Joining', fmtD(emp.joinDate)) +
        row('Company Experience', compExp) +
        row('Prior Experience', prior > 0 ? fmtExpYears(prior) : '—') +
        row('Total Experience', `<b>${totalExp||compExp}</b>`) +
        row('Department', emp.department||'—')
      )}

      ${sec('Contact & Vehicle',
        row('Address', emp.address ? `<span style="font-size:12px;white-space:normal;text-align:right;line-height:1.5">${escHtml(emp.address)}</span>` : '—') +
        row('Pincode', emp.pincode||'—') +
        row('Vehicle No.', emp.vehicle ? `<span style="font-family:monospace;font-weight:600">${emp.vehicle}</span>` : '—')
      )}

      <div style="margin-top:8px;display:flex;flex-direction:column;gap:10px;padding-bottom:8px">
        <button class="btn btn-accent" style="width:100%;font-size:15px" onclick="openEditProfile()">✏️ Edit My Info</button>
        <button class="btn" style="background:var(--danger);color:#fff;width:100%;font-size:16px" onclick="doLogout()">🚪 Logout</button>
      </div>`;
  } catch(err) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger)">
      <div style="font-size:13px;margin-bottom:16px">Error loading profile: ${err.message}</div>
      <button class="btn btn-primary" onclick="renderProfile()">↺ Retry</button>
    </div>`;
  }
}

function openEditProfile() {
  const emp = getCurrentEmp();
  if (!emp) return;
  document.getElementById('ep-blood').value     = emp.bloodGroup || '';
  document.getElementById('ep-dob').value       = emp.birthDate || '';
  document.getElementById('ep-address').value   = emp.address || '';
  document.getElementById('ep-pincode').value   = emp.pincode || '';
  document.getElementById('ep-vehicle').value   = emp.vehicle || '';
  document.getElementById('ep-prior-exp').value = emp.priorExpYears || '';
  openModal('modal-edit-profile');
}

function saveProfileEdit() {
  const emp = getCurrentEmp();
  if (!emp) return;
  const pincode = document.getElementById('ep-pincode').value.trim();
  if (pincode && !/^\d{6}$/.test(pincode)) { showToast('Pincode must be 6 digits', 'error'); return; }
  const emps = getEmployees();
  const idx  = emps.findIndex(e => e.id === emp.id);
  if (idx === -1) return;
  emps[idx].bloodGroup    = document.getElementById('ep-blood').value || '';
  emps[idx].birthDate     = document.getElementById('ep-dob').value || '';
  emps[idx].address       = document.getElementById('ep-address').value.trim();
  emps[idx].pincode       = pincode;
  emps[idx].vehicle       = document.getElementById('ep-vehicle').value.trim().toUpperCase();
  emps[idx].priorExpYears = parseFloat(document.getElementById('ep-prior-exp').value) || 0;
  saveEmployees(emps);
  closeModal('modal-edit-profile');
  renderProfile();
  showToast('Profile updated', 'success');
}

function priorityBadge(p) {
  const m = {high:'badge-high',medium:'badge-medium',low:'badge-low'};
  return `<span class="badge ${m[p]||''}">${p?.toUpperCase()||''}</span>`;
}

function statusBadge(s) {
  const m = {open:'badge-open','in-progress':'badge-inprogress',completed:'badge-completed','on-hold':'badge-onhold'};
  const l = {open:'Open','in-progress':'In Progress',completed:'Completed','on-hold':'On Hold'};
  return `<span class="badge ${m[s]||''}">${l[s]||s}</span>`;
}

function availBadge(s) {
  if (!s || !AVAIL[s]) return '<span style="color:#bbb;font-size:11px">—</span>';
  return `<span class="badge ${AVAIL[s].badge}" style="display:inline-flex;align-items:center;gap:4px">${AVAIL[s].svg} ${AVAIL[s].label}</span>`;
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const role = getSession()?.role || '';
  if (role === 'SU')                        renderSUDashboard();
  else if (['PM','SM','HR'].includes(role)) renderMgrDashboard();
  else                                      renderEmpDashboard();
  updateNotificationBadge();
}

// ── Superadmin Dashboard ──────────────────────────────────
function renderSUDashboard() {
  const companies = DB.companies || [];
  const allEmps   = DB.employees || [];
  const todayStr  = today();
  const att       = DB.attendance || [];
  const checkedIn = new Set(att.filter(a => a.date === todayStr).map(a => a.employeeId)).size;

  let html = `
    <div class="dash-hero" style="background:linear-gradient(135deg,#1e293b,#334155)">
      <div class="hero-greet">Superadmin Panel 🌐</div>
      <div class="hero-sub">${formatDate(todayStr)}</div>
    </div>
    <div class="stat-grid cols3">
      <div class="stat-box"><div class="sv sv-blue">${companies.length}</div><div class="sl">Companies</div></div>
      <div class="stat-box"><div class="sv sv-green">${allEmps.length}</div><div class="sl">Total Staff</div></div>
      <div class="stat-box"><div class="sv sv-orange">${checkedIn}</div><div class="sl">Checked In</div></div>
    </div>
    <div class="dash-section-hdr">
      <span>Companies</span>
      <button class="btn-sm btn-primary" onclick="showTab('admin')">Manage →</button>
    </div>`;

  companies.forEach(c => {
    const cEmps  = allEmps.filter(e => e.company_id === c.id);
    const cIn    = new Set(att.filter(a => a.date === todayStr && cEmps.find(e => e.id === a.employeeId)).map(a => a.employeeId)).size;
    const sites  = (DB.sites||[]).filter(s => s.company_id === c.id);
    html += `<div class="ann-card ann-normal" style="cursor:pointer" onclick="showTab('admin')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-weight:700;font-size:15px">🏢 ${c.name}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:3px">${sites.length} site${sites.length!==1?'s':''} · ${cEmps.length} employee${cEmps.length!==1?'s':''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:18px;font-weight:800;color:var(--success)">${cIn}</div>
          <div style="font-size:10px;color:var(--text-3)">in today</div>
        </div>
      </div>
    </div>`;
  });

  document.getElementById('dash-content').innerHTML = html;
}

// ── Manager Dashboard (PM / SM / HR) ─────────────────────
function renderMgrDashboard() {
  const emp      = getCurrentEmp();
  const role     = getSession()?.role || '';
  const todayStr = today();
  const att      = getSupAtt();
  const todayRec = att.find(a => a.employeeId === emp.id && a.date === todayStr);
  const lmsAtt   = getLmsAtt().filter(a => a.date === todayStr);
  const allTasks = getTasks();
  const openTasks    = allTasks.filter(t => t.status !== 'completed');
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < todayStr);
  const empPresent   = new Set(att.filter(a => a.date === todayStr).map(a => a.employeeId)).size;
  const pendingReqs  = (DB.punchRequests||[]).filter(r => r.status === 'pending');
  const labourIn     = lmsAtt.filter(a => !a.outTime).length;

  // Hero attendance button
  const curIN  = isCurrentlyIN(todayRec);
  const lp     = lastPunch(todayRec);
  let attBtn   = '', heroStatus = '';
  if (!todayRec || !todayRec.punches?.length) {
    attBtn = `<button class="hero-att-btn in" onclick="markSelfIN()">▲ Mark Attendance IN</button>`;
    heroStatus = `<div class="hero-status">You haven't marked IN today</div>`;
  } else if (curIN) {
    attBtn = `<button class="hero-att-btn out" onclick="markSelfOUT()">▼ Mark OUT</button>`;
    heroStatus = `<div class="hero-status">✓ Checked in at ${lp.inTime}</div>`;
  } else {
    attBtn = `<button class="hero-att-btn in" onclick="markSelfIN()">▲ Mark IN Again</button>`;
    heroStatus = `<div class="hero-status">Total today: ${fmtMins(totalMinsForRec(todayRec))}</div>`;
  }

  let html = `
    <div class="dash-hero">
      <div class="hero-greet">Good ${greet()}, ${emp.name.split(' ')[0]}! 👋</div>
      <div class="hero-sub">${ROLES[role]?.label} &nbsp;·&nbsp; ${formatDate(todayStr)}</div>
      ${heroStatus}${attBtn}
    </div>
    <div class="stat-grid cols2">
      <div class="stat-box"><div class="sv sv-green">${empPresent}</div><div class="sl">Staff In</div></div>
      <div class="stat-box"><div class="sv sv-orange">${openTasks.length}</div><div class="sl">Open Tasks</div></div>
    </div>
    <div class="stat-grid cols3">
      <div class="stat-box" style="cursor:pointer" onclick="showTab('work')">
        <div class="sv sv-red">${overdueTasks.length}</div><div class="sl">Overdue</div>
      </div>
      <div class="stat-box"><div class="sv sv-blue">${labourIn}</div><div class="sl">Labour In</div></div>
      <div class="stat-box" style="cursor:pointer" onclick="showTab('schedule');switchSchedTab('requests')">
        <div class="sv sv-orange">${pendingReqs.length}</div><div class="sl">Requests</div>
      </div>
    </div>`;

  // Announcements section
  const anns = getAnnouncements().slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,3);
  html += `<div class="dash-section-hdr">
    <span>📢 Announcements</span>
    <button class="btn-sm btn-primary" onclick="openCreateAnnouncement()">+ Post</button>
  </div>`;
  if (anns.length === 0) {
    html += `<div class="empty-state-sm">No announcements yet. Post one to keep the team informed.</div>`;
  } else {
    html += anns.map(a => announcementCard(a)).join('');
  }

  // Overdue tasks
  if (overdueTasks.length > 0) {
    html += `<div class="dash-section-hdr" style="margin-top:6px"><span>⚠️ Overdue Tasks</span><button class="btn-sm" onclick="showTab('work')">See All</button></div>`;
    html += overdueTasks.slice(0,3).map(t => {
      const assignee = getEmployees().find(e => e.id === t.assignedTo);
      return `<div class="task-card high" style="cursor:pointer" onclick="openTaskDetail('${t.id}')">
        <div class="task-title">${t.title}</div>
        <div class="task-footer">
          ${priorityBadge(t.priority)} ${statusBadge(t.status)}
          <span style="font-size:11px;color:var(--danger)">Due: ${t.dueDate}</span>
          ${assignee ? `<span style="font-size:11px;color:var(--text-3)">→ ${assignee.name.split(' ')[0]}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('dash-content').innerHTML = html;
}

// ── Employee Dashboard ────────────────────────────────────
function renderEmpDashboard() {
  const emp      = getCurrentEmp();
  const role     = getSession()?.role || '';
  const todayStr = today();
  const att      = getSupAtt();
  const todayRec = att.find(a => a.employeeId === emp.id && a.date === todayStr);
  const myTasks  = getTasks().filter(t => t.assignedTo === emp.id && t.status !== 'completed');
  const overdue  = myTasks.filter(t => t.dueDate && t.dueDate < todayStr);
  const dueToday = myTasks.filter(t => t.dueDate === todayStr);
  const unread   = getMessages().filter(m => m.to === emp.id && !m.read).length;

  // Month attendance %
  const monthStart = todayStr.slice(0,7) + '-01';
  const daysElapsed = parseInt(todayStr.slice(8)) || 1;
  const monthDays   = att.filter(a => a.employeeId === emp.id && a.date >= monthStart && a.date <= todayStr);
  const attPct      = Math.round((monthDays.length / daysElapsed) * 100);

  // Hero attendance
  const curIN  = isCurrentlyIN(todayRec);
  const lp     = lastPunch(todayRec);
  let attBtn   = '', heroStatus = '';
  if (!todayRec || !todayRec.punches?.length) {
    attBtn = `<button class="hero-att-btn in" onclick="markSelfIN()">▲ Mark Attendance IN</button>`;
    heroStatus = `<div class="hero-status">You haven't marked IN today</div>`;
  } else if (curIN) {
    attBtn = `<button class="hero-att-btn out" onclick="markSelfOUT()">▼ Mark OUT</button>`;
    heroStatus = `<div class="hero-status">✓ Checked in at ${lp.inTime}</div>`;
  } else {
    attBtn = `<button class="hero-att-btn in" onclick="markSelfIN()">▲ Mark IN Again</button>`;
    heroStatus = `<div class="hero-status">Total today: ${fmtMins(totalMinsForRec(todayRec))}</div>`;
  }

  let html = `
    <div class="dash-hero">
      <div class="hero-greet">Good ${greet()}, ${emp.name.split(' ')[0]}! 👋</div>
      <div class="hero-sub">${ROLES[role]?.label} &nbsp;·&nbsp; ${formatDate(todayStr)}</div>
      ${heroStatus}${attBtn}
    </div>
    <div class="stat-grid cols3">
      <div class="stat-box" style="cursor:pointer" onclick="showTab('work')">
        <div class="sv sv-blue">${myTasks.length}</div><div class="sl">My Tasks</div>
      </div>
      <div class="stat-box" style="cursor:pointer" onclick="showTab('messages')">
        <div class="sv sv-orange">${unread}</div><div class="sl">Unread</div>
      </div>
      <div class="stat-box"><div class="sv sv-green">${attPct}%</div><div class="sl">Month Att.</div></div>
    </div>`;

  // Task reminders (overdue + due today)
  if (overdue.length > 0) {
    html += `<div class="task-reminder overdue-banner" onclick="showTab('work')">
      <span>🔴 ${overdue.length} overdue task${overdue.length>1?'s':''}: ${overdue.map(t=>t.title).slice(0,2).join(', ')}${overdue.length>2?'…':''}</span>
      <span class="reminder-arrow">›</span>
    </div>`;
  }
  if (dueToday.length > 0) {
    html += `<div class="task-reminder duetoday-banner" onclick="showTab('work')">
      <span>🟡 Due today: ${dueToday.map(t=>t.title).slice(0,2).join(', ')}${dueToday.length>2?'…':''}</span>
      <span class="reminder-arrow">›</span>
    </div>`;
  }

  // Announcements
  const anns = getAnnouncements().slice().sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,2);
  if (anns.length > 0) {
    html += `<div class="dash-section-hdr"><span>📢 Announcements</span></div>`;
    html += anns.map(a => announcementCard(a)).join('');
  }

  // Quick nav
  const padCount   = getPadItems().length;
  const canReports = hasAccess('reports');
  html += `<div class="dash-quick-grid">
    <div class="dash-quick-btn" onclick="showTab('schedule')"><span>📅</span><span>Schedule</span></div>
    <div class="dash-quick-btn" onclick="showTab('mypad')"><span>📝</span><span>My Pad${padCount?' ('+padCount+')':''}</span></div>
    <div class="dash-quick-btn" onclick="showTab('people')"><span>👷</span><span>Crew</span></div>
    <div class="dash-quick-btn" onclick="showTab('messages')"><span>💬</span><span>Messages</span></div>
  </div>`;

  // Pending tasks
  if (myTasks.length > 0) {
    html += `<div class="dash-section-hdr"><span>📋 My Tasks</span><button class="btn-sm" onclick="showTab('work')">All</button></div>`;
    html += myTasks.slice(0,4).map(t => `
      <div class="task-card ${t.priority}" style="cursor:pointer" onclick="openTaskDetail('${t.id}')">
        <div class="task-title">${t.title}</div>
        <div class="task-footer">
          ${priorityBadge(t.priority)} ${statusBadge(t.status)}
          <span style="font-size:11px;color:var(--text-3)">Due: ${t.dueDate||'—'}</span>
        </div>
      </div>`).join('');
  }

  document.getElementById('dash-content').innerHTML = html;
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

// ══════════════════════════════════════════════════════════
// SELF ATTENDANCE
// ══════════════════════════════════════════════════════════
function renderSelfAttend() {
  const emp = getCurrentEmp();
  const att = getSupAtt();
  const rec = att.find(a => a.employeeId===emp.id && a.date===today());
  const punches = rec?.punches || [];

  let statusHtml = '';
  if (!rec || punches.length === 0) {
    statusHtml = `<div style="color:#e74c3c;font-weight:bold">⚪ Not marked IN today</div>`;
  } else {
    const punchLines = punches.map((p,i) => {
      if (!p.outTime) {
        const el = minsFromTimes(p.inTime, null);
        return `<div style="color:#f39c12;font-size:13px">Punch ${i+1}: IN ${p.inTime} &nbsp;·&nbsp; ⏱ ${fmtMins(el)} elapsed</div>`;
      }
      return `<div style="font-size:13px;color:#555">Punch ${i+1}: IN ${p.inTime} → OUT ${p.outTime} &nbsp;(${fmtMins(minsFromTimes(p.inTime,p.outTime))})</div>`;
    }).join('');
    const total = totalMinsForRec(rec);
    statusHtml = `
      <div style="font-weight:bold;color:${isCurrentlyIN(rec)?'#f39c12':'#27ae60'};margin-bottom:6px">
        ${isCurrentlyIN(rec) ? '🟡 Currently IN' : '✅ Day\'s punches complete'}
      </div>
      ${punchLines}
      <div style="font-size:13px;font-weight:bold;margin-top:6px">Total: ${fmtMins(total)}</div>`;
  }
  document.getElementById('attend-today').innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px">Today — ${formatDate(today())}</div>
    ${statusHtml}`;

  const last14 = Array.from({length:14},(_,i) => dateOffset(i)).reverse();
  const rows   = last14.map(d => {
    const r  = att.find(a => a.employeeId===emp.id && a.date===d);
    const fu = isFuture(d);
    if (!r || !r.punches || r.punches.length === 0)
      return `<tr><td>${d.slice(5)}</td><td>${dayName(d)}</td><td style="color:#bbb;font-size:12px">—</td><td class="${fu?'':'td-a'}">${fu?'—':'Absent'}</td></tr>`;
    const punchLog = r.punches.map((p,i) => {
      const dur = minsFromTimes(p.inTime, p.outTime);
      const durStr = p.outTime ? ` <span style="color:var(--text-3);font-size:10px">(${fmtMins(dur)})</span>` : ' <span style="color:var(--warning);font-size:10px">still IN</span>';
      return `<span style="white-space:nowrap">${p.inTime}→${p.outTime||'—'}${durStr}</span>`;
    }).join('<br>');
    return `<tr>
      <td>${d.slice(5)}</td><td>${dayName(d)}</td>
      <td style="font-size:12px;line-height:1.8">${punchLog}</td>
      <td class="td-p" style="white-space:nowrap">${fmtMins(totalMinsForRec(r))}</td>
    </tr>`;
  }).join('');

  document.getElementById('attend-history').innerHTML = `
    <div class="rpt-scroll">
      <table class="rpt-table">
        <thead><tr><th>Date</th><th>Day</th><th>Punch Log</th><th>Total Hrs</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function markSelfIN() {
  const emp = getCurrentEmp();
  const att = getSupAtt();
  const idx = att.findIndex(a=>a.employeeId===emp.id && a.date===today());
  if (idx !== -1 && isCurrentlyIN(att[idx])) {
    showToast('Already IN — mark OUT first','error'); return;
  }
  if (idx === -1) {
    att.push({ id:emp.id+'_'+today(), employeeId:emp.id, date:today(), punches:[{inTime:nowTime(),outTime:null}] });
  } else {
    att[idx].punches.push({inTime:nowTime(), outTime:null});
  }
  await saveSupAtt(att);
  showToast('IN marked at '+nowTime(),'success');
  renderDashboard();
  if (document.getElementById('attend-today')) renderSelfAttend();
}

async function markSelfOUT() {
  const emp = getCurrentEmp();
  const att = getSupAtt();
  const idx = att.findIndex(a=>a.employeeId===emp.id && a.date===today());
  if (idx === -1 || !isCurrentlyIN(att[idx])) {
    showToast('Not currently IN','error'); return;
  }
  const punches = att[idx].punches;
  punches[punches.length-1].outTime = nowTime();
  await saveSupAtt(att);
  showToast('OUT marked at '+nowTime(),'success');
  renderDashboard();
  if (document.getElementById('attend-today')) renderSelfAttend();
}

function toggleAttHistory() {
  const wrap  = document.getElementById('attend-history-wrap');
  const arrow = document.getElementById('att-hist-arrow');
  if (!wrap) return;
  const open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
  if (!open) renderSelfAttend();
}

// ══════════════════════════════════════════════════════════
// SCHEDULE TAB (Attendance History + Planner)
// ══════════════════════════════════════════════════════════
let _schedTab = 'plan';

function renderSchedule() {
  switchSchedTab(_schedTab, true);
}

function switchSchedTab(tab, force) {
  if (_schedTab === tab && !force) return;
  _schedTab = tab;
  ['plan','team','history','requests'].forEach(t => {
    const pane = document.getElementById('sched-'+t+'-pane');
    const btn  = document.getElementById('sched-tab-'+t);
    if (pane) pane.style.display = t === tab ? '' : 'none';
    if (btn)  btn.classList.toggle('active', t === tab);
  });
  if (tab === 'plan')     renderPersonalPlanner();
  if (tab === 'team')     renderTeamPlanner();
  if (tab === 'history')  renderSelfAttend();
  if (tab === 'requests') renderPunchRequests();
}

// ══════════════════════════════════════════════════════════
// PUNCH REQUEST SYSTEM
// ══════════════════════════════════════════════════════════
let _reviewingReqId = null;

function openPunchRequest() {
  document.getElementById('pr-date').value   = today();
  document.getElementById('pr-intime').value  = '';
  document.getElementById('pr-outtime').value = '';
  document.getElementById('pr-reason').value  = '';
  document.getElementById('pr-type').value    = 'mispunch';
  openModal('modal-punch-req');
}

async function submitPunchRequest() {
  const emp    = getCurrentEmp();
  const type   = document.getElementById('pr-type').value;
  const date   = document.getElementById('pr-date').value;
  const inTime = document.getElementById('pr-intime').value;
  const outTime= document.getElementById('pr-outtime').value;
  const reason = document.getElementById('pr-reason').value.trim();
  if (!date || !inTime || !reason) { showToast('Fill date, IN time and reason','error'); return; }
  const reqs = getPunchRequests();
  reqs.push({
    id: 'REQ'+Date.now(),
    employeeId: emp.id,
    type, date, inTime, outTime: outTime||null,
    reason, status: 'pending',
    decidedBy: null, decisionNote: '',
    submittedAt: nowISO(), decidedAt: null
  });
  await savePunchRequests(reqs);
  closeModal('modal-punch-req');
  showToast('Request submitted','success');
  renderPunchRequests();
}

function renderPunchRequests() {
  const el = document.getElementById('punch-req-list');
  if (!el) return;
  const emp   = getCurrentEmp();
  const role  = getSession()?.role || '';
  const isManager = ['PM','SM','HR'].includes(role);
  const reqs  = getPunchRequests();
  const emps  = getEmployees();

  // Managers see all pending + recent 7 days; others see own requests
  let visible = isManager
    ? reqs.filter(r => r.status==='pending' || new Date(r.submittedAt) > new Date(Date.now()-7*86400000))
    : reqs.filter(r => r.employeeId===emp.id);

  visible = visible.slice().sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));

  const typeLabel = { 'mispunch':'Mispunch', 'extra-hours':'Extra Hours' };

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">🕐 Punch Requests</h3>
      <button class="btn-sm btn-accent" onclick="openPunchRequest()">+ Submit Request</button>
    </div>`;

  if (!visible.length) {
    html += `<div class="empty-state" style="padding:20px">No requests found.</div>`;
  } else {
    html += visible.map(r => {
      const submitter = emps.find(e=>e.id===r.employeeId);
      const decider   = r.decidedBy ? emps.find(e=>e.id===r.decidedBy) : null;
      return `<div class="req-card ${r.status}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <span style="font-weight:700;font-size:14px">${typeLabel[r.type]||r.type}</span>
            ${isManager ? `<span style="font-size:12px;color:var(--text-2);margin-left:6px">· ${submitter?.name||'—'}</span>` : ''}
          </div>
          <span class="badge badge-${r.status}">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>
        </div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:4px">
          📅 ${r.date} &nbsp;·&nbsp; IN: ${r.inTime} ${r.outTime?'→ OUT: '+r.outTime:''}
        </div>
        <div style="font-size:13px;color:var(--text);margin-bottom:6px">${r.reason}</div>
        ${r.decisionNote ? `<div style="font-size:12px;color:var(--text-2);font-style:italic">Note: ${r.decisionNote}${decider?' · '+decider.name.split(' ')[0]:''}</div>` : ''}
        ${isManager && r.status==='pending' ? `
          <button class="btn-sm btn-accent" style="margin-top:8px" onclick="openReviewRequest('${r.id}')">Review →</button>` : ''}
      </div>`;
    }).join('');
  }
  el.innerHTML = html;
}

function openReviewRequest(reqId) {
  const req  = getPunchRequests().find(r=>r.id===reqId);
  if (!req) return;
  _reviewingReqId = reqId;
  const emp  = getEmployees().find(e=>e.id===req.employeeId);
  const typeLabel = { 'mispunch':'Mispunch Correction', 'extra-hours':'Extra Hours' };
  document.getElementById('rr-content').innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px">
      <div style="font-weight:700;margin-bottom:6px">${typeLabel[req.type]||req.type}</div>
      <div style="font-size:13px;line-height:1.8">
        <b>Employee:</b> ${emp?.name||'—'} (${emp?.role||''})<br>
        <b>Date:</b> ${req.date}<br>
        <b>IN Time:</b> ${req.inTime} &nbsp; <b>OUT Time:</b> ${req.outTime||'—'}<br>
        <b>Reason:</b> ${req.reason}<br>
        <b>Submitted:</b> ${formatDT(req.submittedAt)}
      </div>
    </div>`;
  document.getElementById('rr-note').value = '';
  openModal('modal-review-req');
}

async function decideRequest(decision) {
  const req = getPunchRequests().find(r=>r.id===_reviewingReqId);
  if (!req) return;
  const note = document.getElementById('rr-note').value.trim();
  req.status      = decision;
  req.decidedBy   = getCurrentEmp().id;
  req.decisionNote= note;
  req.decidedAt   = nowISO();
  if (decision === 'approved') await applyApprovedRequest(req);
  await savePunchRequests(getPunchRequests());
  closeModal('modal-review-req');
  _reviewingReqId = null;
  showToast('Request '+decision,'success');
  renderPunchRequests();
}

async function applyApprovedRequest(req) {
  const att = getSupAtt();
  const idx = att.findIndex(a=>a.employeeId===req.employeeId && a.date===req.date);
  const punch = { inTime: req.inTime, outTime: req.outTime||null };
  if (idx > -1) {
    if (!att[idx].punches) att[idx].punches = [];
    att[idx].punches.push(punch);
  } else {
    att.push({ employeeId: req.employeeId, date: req.date, punches: [punch] });
  }
  await saveSupAtt(att);
}

function renderPersonalPlanner() {
  pendingAvailChanges = {};
  const emp   = getCurrentEmp();
  const avail = getAvailList();
  const allDays = Array.from({length:14}, (_,i) => dateFuture(i+1));
  const weeks   = [ allDays.slice(0,7), allDays.slice(7,14) ];

  function buildDayRow(d) {
    const rec = avail.find(a=>a.employeeId===emp.id && a.date===d);
    const cur = rec?.status || null;
    const color = cur ? AVAIL[cur].color : '#CBD5E1';
    const statusText = cur ? AVAIL[cur].label : 'Tap to set';
    const optBtns = Object.keys(AVAIL).map(s => `
      <button class="avail-btn ${cur===s ? AVAIL[s].cls : ''}"
              onclick="selectMyAvail('${d}','${s}',this);closeDayPicker('${d}')"
              title="${AVAIL[s].label}">
        ${AVAIL[s].svg}
        <span style="font-size:10px;display:block;margin-top:2px">${AVAIL[s].shortLabel}</span>
      </button>`).join('');
    return `
      <div class="card" style="padding:0;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:12px;padding:13px 14px;cursor:pointer" onclick="toggleDayPicker('${d}')">
          <div style="min-width:44px;text-align:center;background:var(--bg);border-radius:var(--radius-sm);padding:6px 4px">
            <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase">${dayName(d).slice(0,3)}</div>
            <div style="font-size:17px;font-weight:800;color:var(--text);line-height:1.1">${d.slice(8)}</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:7px">
              <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              <span style="font-size:14px;font-weight:${cur?'600':'400'};color:${cur?'var(--text)':'var(--text-3)'}">${statusText}</span>
            </div>
          </div>
          <span id="dpicker-arrow-${d}" style="color:var(--text-3);font-size:16px;transition:transform 0.2s">▼</span>
        </div>
        <div id="dpicker-${d}" style="display:none;padding:10px 14px 14px;border-top:1px solid var(--border)">
          <div class="avail-btns" style="gap:6px">${optBtns}</div>
        </div>
      </div>`;
  }

  const weekSections = weeks.map((days, wi) => {
    const label = wi===0 ? 'This Week' : 'Next Week';
    const range = `${days[0].slice(5).replace('-','/')} – ${days[6].slice(5).replace('-','/')}`;
    return `
      <div style="margin-bottom:4px">
        <div onclick="toggleWeek(${wi})" style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;cursor:pointer;user-select:none;margin-bottom:8px">
          <span style="font-size:13px;font-weight:800;color:var(--brand);letter-spacing:0.2px">${label}</span>
          <span style="font-size:12px;color:var(--text-3)">${range} <span id="week-arrow-${wi}" style="display:inline-block;transition:transform 0.2s">${wi===0?'▲':'▼'}</span></span>
        </div>
        <div id="week-body-${wi}" style="display:${wi===0?'block':'none'}">${days.map(buildDayRow).join('')}</div>
      </div>`;
  }).join('');

  document.getElementById('planner-personal').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--text)">My Availability</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">Tap a day to set your status</div>
      </div>
      <button id="avail-apply-btn" onclick="applyAvailChanges()" style="display:none;background:var(--brand);color:#fff;border:none;border-radius:var(--radius-sm);padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;min-height:38px;box-shadow:0 3px 10px rgba(29,95,168,0.3)">Apply</button>
    </div>
    ${weekSections}`;
}

function toggleDayPicker(date) {
  const picker = document.getElementById('dpicker-'+date);
  const arrow  = document.getElementById('dpicker-arrow-'+date);
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  // Close all open pickers first
  document.querySelectorAll('[id^="dpicker-"]').forEach(el => {
    if (!el.id.includes('-arrow')) el.style.display = 'none';
  });
  document.querySelectorAll('[id^="dpicker-arrow-"]').forEach(el => el.style.transform = '');
  if (!isOpen) {
    picker.style.display = '';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  }
}

function closeDayPicker(date) {
  const picker = document.getElementById('dpicker-'+date);
  const arrow  = document.getElementById('dpicker-arrow-'+date);
  if (picker) picker.style.display = 'none';
  if (arrow)  arrow.style.transform = '';
}

function toggleWeek(wi) {
  const body  = document.getElementById('week-body-'+wi);
  const arrow = document.getElementById('week-arrow-'+wi);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display  = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
}

function selectMyAvail(date, status, clickedBtn) {
  const row     = clickedBtn.closest('[id^="dpicker-"]');
  const allBtns = row ? row.querySelectorAll('.avail-btn') : [];
  // Toggle off if same status already saved and no pending change
  const emp   = getCurrentEmp();
  const avail = getAvailList();
  const saved = avail.find(a=>a.employeeId===emp.id && a.date===date);
  const alreadyPending = pendingAvailChanges[date] === status;
  const alreadySaved   = saved?.status === status && !(date in pendingAvailChanges);

  if (alreadyPending || alreadySaved) {
    // Deselect
    delete pendingAvailChanges[date];
    allBtns.forEach(b => b.className = 'avail-btn');
    // Re-apply saved state if any
    if (saved && !alreadyPending) clickedBtn.classList.add(AVAIL[saved.status]?.cls||'');
  } else {
    pendingAvailChanges[date] = status;
    allBtns.forEach(b => b.className = 'avail-btn');
    clickedBtn.classList.add(AVAIL[status].cls);
  }

  // Show/hide Apply button based on pending count
  const applyBtn = document.getElementById('avail-apply-btn');
  const count = Object.keys(pendingAvailChanges).length;
  if (applyBtn) {
    applyBtn.style.display = count > 0 ? 'inline-block' : 'none';
    applyBtn.textContent = count > 0 ? `Apply (${count})` : 'Apply';
  }
}

async function applyAvailChanges() {
  const emp   = getCurrentEmp();
  const avail = getAvailList();
  Object.entries(pendingAvailChanges).forEach(([date, status]) => {
    const idx = avail.findIndex(a=>a.employeeId===emp.id && a.date===date);
    if (idx > -1) avail[idx].status = status;
    else avail.push({ id:emp.id+'_'+date, employeeId:emp.id, date, status });
  });
  await saveAvailList(avail);
  const count = Object.keys(pendingAvailChanges).length;
  pendingAvailChanges = {};
  showToast(count + ' availability change'+(count>1?'s':'')+' saved','success');
  renderPersonalPlanner();
}

let teamPlannerDays = 3; // default: next 3 days
let teamPlannerRole = '';  // '' = all roles

function renderTeamPlanner() {
  let emps = getEmployees().filter(e=>e.active);
  if (teamPlannerRole) emps = emps.filter(e=>e.role===teamPlannerRole);
  const avail = getAvailList();
  const next  = Array.from({length:teamPlannerDays},(_,i)=>dateFuture(i+1));

  const header = `<tr><th>Employee</th>${next.map(d=>`<th>${dayName(d)}<br><span style="font-weight:400">${d.slice(5)}</span></th>`).join('')}</tr>`;
  const rows   = emps.map(e => {
    const cells = next.map(d => {
      const rec = avail.find(a=>a.employeeId===e.id && a.date===d);
      if (!rec) return '<td></td>';
      const s = rec.status;
      return `<td><div class="${AVAIL[s]?.cell||''}" style="display:flex;flex-direction:column;align-items:center;padding:2px 3px">${AVAIL[s]?.svg||''}<span style="font-size:9px;margin-top:1px">${AVAIL[s]?.shortLabel||s}</span></div></td>`;
    }).join('');
    return `<tr><td><b>${e.name.split(' ')[0]}</b><br><span style="font-size:10px;color:#888">${ROLES[e.role]?.label||e.role}</span></td>${cells}</tr>`;
  }).join('');

  const roleOptions = [['','All Roles'],...Object.entries(ROLES).map(([k,v])=>[k,v.label])]
    .map(([k,l])=>`<option value="${k}" ${teamPlannerRole===k?'selected':''}>${l}</option>`).join('');

  document.getElementById('planner-team').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <h3 style="margin:0;flex:1">Team Availability</h3>
      <select onchange="teamPlannerRole=this.value;renderTeamPlanner()" style="padding:6px 10px;font-size:13px;border-radius:var(--radius-sm);border:1.5px solid var(--border)">
        ${roleOptions}
      </select>
      <select onchange="teamPlannerDays=+this.value;renderTeamPlanner()" style="padding:6px 10px;font-size:13px;border-radius:var(--radius-sm);border:1.5px solid var(--border)">
        <option value="3" ${teamPlannerDays===3?'selected':''}>Next 3 days</option>
        <option value="7" ${teamPlannerDays===7?'selected':''}>Next 7 days</option>
        <option value="14" ${teamPlannerDays===14?'selected':''}>Next 14 days</option>
      </select>
    </div>
    ${rows ? `<div class="rpt-scroll"><table class="rpt-table">${header}<tbody>${rows}</tbody></table></div>`
            : `<div class="empty-state" style="padding:32px">No employees found for selected role.</div>`}`;
}


function avatarColor(role) {
  const c = {PM:'#8e44ad',SM:'#1D5FA8',HR:'#86198F',SE:'#2980b9',EN:'#0369A1',SV:'#e67e22',JE:'#7f8c8d',AS:'#95a5a6',TK:'#bdc3c7'};
  return c[role]||'#1D5FA8';
}

function openEmpProfile(empId) {
  const e      = getEmployees().find(x=>x.id===empId);
  if (!e) return;
  const sess   = getSession();
  const att    = getSupAtt().filter(a=>a.employeeId===empId);
  const ym     = today().slice(0,7);
  const mDates = getMonthDates(ym).filter(d=>!isFuture(d));
  const present= mDates.filter(d=>att.find(a=>a.date===d)).length;
  const myTasks= getTasks().filter(t=>t.assignedTo===empId);
  const myNotes= getNotes().filter(n=>n.aboutEmployeeId===empId);
  const seniority = computeSeniority(e.joinDate);

  // Management controls
  const allowedTargets = allowedRoleTargets(sess.role, e.role);
  const canResign      = canResignEmp(sess.role, e.role);
  const isPM           = sess.role === 'PM';
  const isResigned     = e.status === 'resigned';

  let mgmtHtml = '';
  // Role change (only if viewing someone else and you have authority)
  if (e.id !== sess.employeeId && allowedTargets.length > 0) {
    const opts = allowedTargets.map(r => `<option value="${r}" ${r===e.role?'selected':''}>${ROLES[r]?.label||r}</option>`).join('');
    mgmtHtml += `
      <div style="margin-top:14px;padding-top:14px;border-top:2px solid #eee">
        <h3 style="margin-bottom:10px">⚙️ Role Management</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="role-change-sel-${e.id}" style="flex:1;margin:0;padding:10px;font-size:15px">
            ${opts}
          </select>
          <button class="btn-sm btn-accent" onclick="changeEmpRole('${e.id}')">Change Role</button>
        </div>
        <div style="font-size:11px;color:#888;margin-top:6px">Current: ${ROLES[e.role]?.label||e.role}</div>
      </div>`;
  }

  // HR permission toggle (PM only, viewing an HR employee)
  if (isPM && e.role === 'HR') {
    const approved = e.hrRoleEditApproved;
    mgmtHtml += `
      <div style="margin-top:12px;padding:12px;background:${approved?'#e8f5e9':'#fff3e0'};border-radius:8px;border:1px solid ${approved?'#a5d6a7':'#ffe082'}">
        <div style="font-weight:bold;font-size:13px;margin-bottom:6px">🔐 HR Role-Edit Permission</div>
        <div style="font-size:12px;color:#555;margin-bottom:10px">${approved ? '✅ HR can change roles of EN/SV/JE/AS/TK employees.' : '⛔ HR cannot change employee roles — not yet approved.'}</div>
        <button class="btn-sm ${approved?'btn-red':'btn-green'}" onclick="toggleHRPermission('${e.id}')">
          ${approved ? 'Revoke Permission' : 'Grant Permission'}
        </button>
      </div>`;
  }

  // Edit employee info (SU/PM/SM/HR only, not self)
  if (e.id !== sess.employeeId && ['SU','PM','SM','HR'].includes(sess.role)) {
    mgmtHtml += `
      <div style="margin-top:14px;padding-top:14px;border-top:2px solid #eee">
        <h3 style="margin-bottom:10px">✏️ Edit Employee Info</h3>
        <label style="font-size:12px;color:#888;font-weight:600">Full Name</label>
        <input type="text" id="ei-name-${e.id}" value="${escHtml(e.name)}" style="margin-bottom:8px">
        <label style="font-size:12px;color:#888;font-weight:600">Department</label>
        <input type="text" id="ei-dept-${e.id}" value="${escHtml(e.department||'')}" style="margin-bottom:8px">
        <label style="font-size:12px;color:#888;font-weight:600">Mobile</label>
        <input type="tel" id="ei-mobile-${e.id}" value="${e.mobile||''}" style="margin-bottom:8px">
        ${['SU','PM'].includes(sess.role) ? `<label style="font-size:12px;color:#888;font-weight:600">Date of Joining</label>
        <input type="date" id="ei-joindate-${e.id}" value="${e.joinDate||''}" style="margin-bottom:8px">` : ''}
        <button class="btn btn-primary" style="margin:0;font-size:14px" onclick="saveEmpInfoEdit('${e.id}')">Save Changes</button>
      </div>`;
  }

  // Resign / Reactivate
  if (e.id !== sess.employeeId && (canResign || (isPM && !isResigned))) {
    if (!isResigned) {
      mgmtHtml += `
        <div style="margin-top:10px">
          <button class="btn btn-red" style="margin:0;font-size:14px" onclick="resignEmployee('${e.id}')">
            Mark as Resigned
          </button>
        </div>`;
    } else if (isPM || sess.role === 'SM') {
      mgmtHtml += `
        <div style="margin-top:10px">
          <button class="btn btn-green" style="margin:0;font-size:14px" onclick="reactivateEmployee('${e.id}')">
            Reactivate Employee
          </button>
        </div>`;
    }
  }

  // HR can permanently delete resigned employee after 30 days
  if (sess.role === 'HR' && isResigned && e.id !== sess.employeeId && e.resignedDate) {
    const daysSince = Math.floor((new Date(today()) - new Date(e.resignedDate)) / 86400000);
    if (daysSince >= 30) {
      mgmtHtml += `
        <div style="margin-top:14px;padding:12px 14px;background:#FEF2F2;border-radius:var(--radius-sm);border:1px solid #FECACA">
          <div style="font-size:12px;color:var(--danger);font-weight:700;margin-bottom:8px">⚠️ Permanent Removal</div>
          <div style="font-size:12px;color:#666;margin-bottom:10px">Resigned ${daysSince} days ago. Profile can be permanently removed.</div>
          <button class="btn btn-red" style="margin:0;font-size:14px" onclick="deleteEmployee('${e.id}')">
            🗑 Remove Profile Permanently
          </button>
        </div>`;
    } else {
      const daysLeft = 30 - daysSince;
      mgmtHtml += `
        <div style="margin-top:14px;padding:10px 14px;background:#F8FAFC;border-radius:var(--radius-sm);border:1px solid var(--border)">
          <div style="font-size:12px;color:var(--text-2)">🗑 Profile removal available in <b>${daysLeft} day${daysLeft===1?'':'s'}</b></div>
        </div>`;
    }
  }

  document.getElementById('mp-title').textContent = e.name;
  document.getElementById('mp-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <div style="width:56px;height:56px;border-radius:50%;background:${avatarColor(e.role)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold">${e.avatar}</div>
      <div>
        <div style="font-size:18px;font-weight:bold">${e.name} ${isResigned ? '<span class="badge badge-resigned">Resigned</span>' : ''}</div>
        <div style="margin-top:4px">${roleBadge(e.role)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px">${e.department||''} &nbsp;·&nbsp; Joined: ${e.joinDate||'—'}</div>
        <div style="font-size:13px;color:#555;margin-top:2px">🏅 Experience: <b>${seniority}</b>${isResigned && e.resignedDate ? ' &nbsp;·&nbsp; Resigned: '+e.resignedDate : ''}</div>
      </div>
    </div>
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-box"><div class="sv sv-blue">${present}</div><div class="sl">Present (this month)</div></div>
      <div class="stat-box"><div class="sv sv-orange">${mDates.length-present}</div><div class="sl">Absent</div></div>
      <div class="stat-box"><div class="sv sv-blue">${myTasks.filter(t=>t.status!=='completed').length}</div><div class="sl">Open Tasks</div></div>
    </div>
    ${e.id !== sess.employeeId ? `
    <div class="btn-row" style="margin-bottom:14px">
      <button class="btn btn-primary" style="margin:0;flex:1" onclick="closeModal('modal-emp-profile');openWAChat('${e.id}')">💬 Message</button>
      ${e.mobile ? `<button class="btn btn-green" style="margin:0;flex:1" onclick="window.location.href='tel:${e.mobile}'">📞 Call</button>` : ''}
    </div>` : ''}
    <div style="font-size:13px;margin-bottom:6px"><b>📱 Mobile:</b> ${e.mobile||'—'}</div>
    <div style="font-size:13px;margin-bottom:6px"><b>🔑 Login:</b> ${e.username}</div>
    ${e.birthDate ? `<div style="font-size:13px;margin-bottom:4px"><b>🎂 DOB:</b> ${new Date(e.birthDate+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}
    ${e.bloodGroup ? `<div style="font-size:13px;margin-bottom:4px"><b>🩸 Blood:</b> <span style="font-weight:700;color:var(--danger)">${e.bloodGroup}</span></div>` : ''}
    ${e.address ? `<div style="font-size:13px;margin-bottom:4px"><b>🏠 Address:</b> ${escHtml(e.address)}${e.pincode?' — '+e.pincode:''}</div>` : ''}
    ${e.vehicle ? `<div style="font-size:13px;margin-bottom:14px"><b>🚗 Vehicle:</b> <span style="font-family:monospace;font-weight:600">${e.vehicle}</span></div>` : '<div style="margin-bottom:14px"></div>'}
    <h3 style="margin-bottom:8px">Tasks</h3>
    ${myTasks.length ? myTasks.map(t=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee">
        <span style="font-size:13px">${t.title}</span>
        ${statusBadge(t.status)}
      </div>`).join('') : '<div class="empty-state" style="padding:12px">No tasks</div>'}
    <h3 style="margin:14px 0 8px">Notes</h3>
    ${myNotes.length ? myNotes.map(n=>`
      <div class="note-card" style="margin-bottom:8px">
        <div class="note-meta">${formatDT(n.createdAt)} &nbsp;·&nbsp; ${n.category}
          ${getEmployees().find(x=>x.id===n.byEmployeeId)?.name ? ' &nbsp;·&nbsp; By: '+getEmployees().find(x=>x.id===n.byEmployeeId).name.split(' ')[0] : ''}
        </div>
        <div class="note-text">${escHtml(n.text)}</div>
      </div>`).join('') : '<div style="color:#aaa;font-size:13px;padding:8px 0">No notes yet.</div>'}
    ${['PM','SM','HR','SE','EN'].includes(sess.role) && e.id !== sess.employeeId ? `
      <div style="margin-top:10px">
        <select id="pnote-cat-${e.id}" style="margin-bottom:8px;padding:8px;font-size:14px">
          <option value="general">General</option>
          <option value="performance">Performance</option>
          <option value="incident">Incident</option>
          <option value="leave">Leave Related</option>
        </select>
        <textarea id="pnote-text-${e.id}" placeholder="Add a note about ${e.name.split(' ')[0]}…" style="min-height:64px;font-size:14px"></textarea>
        <button class="btn btn-accent" style="margin:0;font-size:14px" onclick="addNoteFromProfile('${e.id}')">+ Save Note</button>
      </div>` : ''}
    ${mgmtHtml ? `
    <div style="margin-top:16px">
      <button class="btn" id="mgmt-toggle-btn"
        style="width:100%;background:#f1f5f9;color:var(--text);font-weight:700;font-size:14px"
        onclick="const p=this.nextElementSibling;const open=p.style.display!=='none';p.style.display=open?'none':'block';this.textContent=open?'⚙️ Manage Employee':'✕ Close Management'">
        ⚙️ Manage Employee
      </button>
      <div style="display:none">${mgmtHtml}</div>
    </div>` : ''}
  `;
  openModal('modal-emp-profile');
}

async function addEmployee() {
  const name   = document.getElementById('ae-name').value.trim();
  const role   = document.getElementById('ae-role').value;
  const dept   = document.getElementById('ae-dept').value.trim();
  const mobile = document.getElementById('ae-mobile').value.trim();
  const user   = document.getElementById('ae-user').value.trim().toLowerCase();
  const pass   = document.getElementById('ae-pass').value;

  if (!name||!role||!user||!pass) { showToast('Fill all required fields','error'); return; }

  const emps  = getEmployees();
  const users = getUsers();
  if (users.find(u=>u.username===user)) { showToast('Username already exists','error'); return; }

  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const newEmp = {
    id: 'EMP'+String(emps.length+1).padStart(3,'0'),
    name, role, designation: ROLES[role]?.label||role,
    department: dept||'General', mobile, username: user,
    avatar: initials,
    joinDate: document.getElementById('ae-joindate').value || today(),
    active: true, status: 'active'
  };
  emps.push(newEmp);
  await saveEmployees(emps);
  users.push({ username:user, password:pass, employeeId:newEmp.id, role });
  await saveUsers(users);

  closeModal('modal-add-emp');
  showToast(name+' added successfully','success');
  renderTeam();
  ['ae-name','ae-dept','ae-mobile','ae-joindate','ae-user','ae-pass'].forEach(id=>document.getElementById(id).value='');
}

async function saveEmpInfoEdit(empId) {
  const sess = getSession();
  if (!['PM','SM','HR'].includes(sess.role)) return;
  const emps = getEmployees();
  const idx  = emps.findIndex(e => e.id === empId);
  if (idx === -1) return;
  const name = document.getElementById('ei-name-'+empId)?.value.trim();
  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  const dept   = document.getElementById('ei-dept-'+empId)?.value.trim();
  const mobile = document.getElementById('ei-mobile-'+empId)?.value.trim();
  emps[idx].name       = name;
  emps[idx].avatar     = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  emps[idx].department = dept || emps[idx].department;
  emps[idx].mobile     = mobile || '';
  if (sess.role === 'PM') {
    const joinDate = document.getElementById('ei-joindate-'+empId)?.value;
    if (joinDate) emps[idx].joinDate = joinDate;
  }
  await saveEmployees(emps);
  showToast('Employee info updated', 'success');
  openEmpProfile(empId);
}

// ══════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════
let taskFilter = 'all';

function renderTasks() {
  const role   = getSession()?.role||'';
  const empId  = getCurrentEmp()?.id;
  const canCreate = ['SU','PM','SM','SE'].includes(role);
  const allTasks = getTasks();
  const cnt = {
    all: allTasks.length,
    open: allTasks.filter(t=>t.status==='open').length,
    'in-progress': allTasks.filter(t=>t.status==='in-progress').length,
    completed: allTasks.filter(t=>t.status==='completed').length,
    'on-hold': allTasks.filter(t=>t.status==='on-hold').length,
  };

  document.getElementById('task-controls').innerHTML = `
    <div style="position:sticky;top:44px;z-index:10;background:var(--bg);padding:6px 16px 4px;margin:0 -16px">
      <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;scrollbar-width:none">
        ${['all','open','in-progress','completed','on-hold'].map(s=>`
          <button class="btn-sm" style="background:${taskFilter===s?'#1a3c5e':'#eee'};color:${taskFilter===s?'#fff':'#555'};flex-shrink:0"
            onclick="taskFilter='${s}';renderTasks()">${s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)} (${cnt[s]})</button>
        `).join('')}
      </div>
    </div>
    ${canCreate ? `<button class="btn btn-accent" style="margin-top:10px" onclick="openCreateTask()">+ Create Task</button>` : ''}
  `;

  let tasks = getTasks();
  if (taskFilter !== 'all') tasks = tasks.filter(t=>t.status===taskFilter);

  // Non-SU/PM/SM only see their own tasks
  if (!['SU','PM','SM'].includes(role)) tasks = tasks.filter(t=>t.assignedTo===empId);

  const emps = getEmployees();
  const list = document.getElementById('task-list');
  if (!tasks.length) { list.innerHTML='<div class="empty-state">No tasks found.</div>'; return; }

  list.innerHTML = tasks.map(t => {
    const assignee = emps.find(e=>e.id===t.assignedTo);
    const creator  = emps.find(e=>e.id===t.createdBy);
    return `<div class="task-card ${t.priority}" onclick="openTaskDetail('${t.id}')" style="cursor:pointer">
      <div class="task-title">${t.title}</div>
      <div class="task-meta">
        👤 ${assignee?.name||'—'} &nbsp;·&nbsp; By: ${creator?.name?.split(' ')[0]||'—'}
        &nbsp;·&nbsp; Due: ${t.dueDate||'—'}
      </div>
      <div class="task-footer">
        ${priorityBadge(t.priority)} ${statusBadge(t.status)}
      </div>
    </div>`;
  }).join('');
}

function openCreateTask() {
  const emps = getEmployees().filter(e=>e.active);
  document.getElementById('ct-assign').innerHTML = emps.map(e=>`<option value="${e.id}">${e.name} (${ROLES[e.role]?.label||e.role})</option>`).join('');
  document.getElementById('ct-due').value = dateFuture(3);
  openModal('modal-create-task');
}

async function createTask() {
  const title  = document.getElementById('ct-title').value.trim();
  const desc   = document.getElementById('ct-desc').value.trim();
  const assign = document.getElementById('ct-assign').value;
  const prio   = document.getElementById('ct-priority').value;
  const due    = document.getElementById('ct-due').value;
  if (!title) { showToast('Enter task title','error'); return; }

  const tasks  = getTasks();
  const newId  = 'TASK'+String(tasks.length+1).padStart(3,'0');
  tasks.push({
    id:newId, title, description:desc, priority:prio, status:'open',
    assignedTo:assign, createdBy:getCurrentEmp().id,
    createdAt:nowISO(), dueDate:due, completedAt:null
  });
  await saveTasks(tasks);
  closeModal('modal-create-task');
  showToast('Task created','success');
  renderTasks();
  ['ct-title','ct-desc'].forEach(id=>document.getElementById(id).value='');
}

function openTaskDetail(taskId) {
  const t    = getTasks().find(x=>x.id===taskId);
  if (!t) return;
  const emps = getEmployees();
  const a    = emps.find(e=>e.id===t.assignedTo);
  const c    = emps.find(e=>e.id===t.createdBy);
  const role = getSession()?.role||'';
  const empId= getCurrentEmp()?.id;
  const canEdit = ['SU','PM','SM','SE'].includes(role) || t.assignedTo===empId;

  const statusOpts = ['open','in-progress','completed','on-hold'].map(s=>
    `<button class="btn-sm" style="background:${t.status===s?'#1a3c5e':'#eee'};color:${t.status===s?'#fff':'#555'};margin:3px"
      onclick="updateTaskStatus('${t.id}','${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
  ).join('');

  document.getElementById('td-content').innerHTML = `
    <div class="task-card ${t.priority}" style="cursor:default;margin-bottom:14px">
      <div class="task-title">${t.title}</div>
      ${t.description ? `<div style="font-size:13px;color:#555;margin:6px 0">${t.description}</div>` : ''}
      <div class="task-footer" style="margin-top:8px">
        ${priorityBadge(t.priority)} ${statusBadge(t.status)}
      </div>
    </div>
    <div style="font-size:13px;line-height:2">
      <b>Assigned To:</b> ${a?.name||'—'}<br>
      <b>Created By:</b> ${c?.name||'—'}<br>
      <b>Created:</b> ${formatDT(t.createdAt)}<br>
      <b>Due Date:</b> ${t.dueDate||'—'}<br>
      ${t.completedAt ? `<b>Completed:</b> ${formatDT(t.completedAt)}<br>` : ''}
    </div>
    ${canEdit ? `<div style="margin-top:14px"><b style="font-size:13px">Update Status:</b><br><div style="margin-top:6px">${statusOpts}</div></div>` : ''}
  `;
  openModal('modal-task-detail');
}

async function updateTaskStatus(taskId, status) {
  const tasks = getTasks();
  const idx   = tasks.findIndex(t=>t.id===taskId);
  if (idx===-1) return;
  tasks[idx].status = status;
  if (status==='completed') tasks[idx].completedAt = nowISO();
  await saveTasks(tasks);
  closeModal('modal-task-detail');
  showToast('Status updated','success');
  renderTasks();
}

// Notes are now added/viewed from employee profile modal (addNoteFromProfile)

function addNote() {
  // Legacy stub — notes now added from employee profile
}

async function addNoteFromProfile(empId) {
  const catEl  = document.getElementById('pnote-cat-'+empId);
  const textEl = document.getElementById('pnote-text-'+empId);
  if (!textEl) return;
  const text = textEl.value.trim();
  if (!text) { showToast('Write a note first','error'); return; }
  const notes = getNotes();
  notes.push({
    id: 'NOTE'+String(notes.length+1).padStart(3,'0'),
    aboutEmployeeId: empId, byEmployeeId: getCurrentEmp().id,
    text, category: catEl?.value||'general', createdAt: nowISO()
  });
  await saveNotes(notes);
  showToast('Note saved','success');
  openEmpProfile(empId); // refresh profile with new note
}

// ══════════════════════════════════════════════════════════
// LABOUR
// ══════════════════════════════════════════════════════════
function renderLabour() {
  const workers = getLmsWorkers();
  const att     = getLmsAtt().filter(a=>a.date===today());
  const out      = document.getElementById('labour-stats');

  if (!workers.length) {
    out.innerHTML = '<div class="empty-state">No labour data found.<br>Open Labour System first.</div>';
    return;
  }

  const stillIn  = att.filter(a=>!a.outTime).length;
  const left     = att.filter(a=>a.outTime).length;
  const absent   = workers.length - att.length;

  const skills = {};
  workers.forEach(w => { skills[w.skill] = (skills[w.skill]||0)+1; });

  out.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="sv sv-blue">${workers.length}</div><div class="sl">Enrolled</div></div>
      <div class="stat-box"><div class="sv sv-green">${att.length}</div><div class="sl">Present</div></div>
      <div class="stat-box"><div class="sv sv-red">${absent}</div><div class="sl">Absent</div></div>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="sv sv-orange">${stillIn}</div><div class="sl">Still Inside</div></div>
      <div class="stat-box"><div class="sv sv-purple">${left}</div><div class="sl">Left Site</div></div>
      <div class="stat-box"><div class="sv sv-blue">${Object.keys(skills).length}</div><div class="sl">Skills</div></div>
    </div>
    <h3 style="margin-bottom:10px">Skill Breakdown</h3>
    ${Object.entries(skills).map(([s,c])=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#fff;border-radius:6px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
        <span style="font-weight:bold">${s}</span>
        <span class="badge badge-sm" style="background:#d6eaf8;color:#1a5276">${c} workers</span>
      </div>`).join('')}
    <h3 style="margin:14px 0 10px">Today's Attendance</h3>
    ${att.length===0
      ? '<div class="empty-state">No attendance marked today.</div>'
      : att.map(a=>{
          const w = workers.find(x=>x.id===a.workerId)||{name:'Unknown',skill:'—'};
          const done = !!a.outTime;
          return `<div class="att-card ${done?'':'active-in'}">
            <div style="display:flex;justify-content:space-between">
              <div>
                <div style="font-weight:bold">${w.name}</div>
                <div style="font-size:12px;color:#888">${w.skill} · ID: ${a.workerId}</div>
              </div>
              ${done?'<span class="badge badge-onsite">Left</span>':'<span class="badge badge-field">Inside</span>'}
            </div>
            <div class="att-times">
              <div class="att-time-block"><label>IN</label><span>${a.inTime||'—'}</span></div>
              <div class="att-time-block"><label>OUT</label><span>${a.outTime||'—'}</span></div>
              <div class="att-time-block"><label>HRS</label><span style="color:${done?'#27ae60':'#f39c12'}">${fmtMins(minsFromTimes(a.inTime,a.outTime))}</span></div>
            </div>
          </div>`;
        }).join('')}
    <button class="btn btn-gray" style="margin-top:8px" onclick="renderLabour()">↻ Refresh</button>`;
}

// ══════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════
let supReportType = 'emp-attend';

function setSupReportType(type, btn) {
  supReportType = type;
  document.querySelectorAll('.rtype-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSupReportOutput();
}

let roleReportPeriod = 'monthly'; // 'daily' | 'weekly' | 'monthly'
let lastReportData = [];

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function exportCurrentReport() {
  if (!lastReportData || !lastReportData.length) { showToast('No data to export','warning'); return; }
  const ym = document.getElementById('sup-r-month')?.value || today().slice(0,7);
  
  let csv = '';
  const headers = Object.keys(lastReportData[0]).filter(k => k !== 'e' && k !== 'w');
  csv += headers.join(',') + '\n';
  
  lastReportData.forEach(row => {
    csv += headers.map(h => {
      let val = row[h];
      if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
      return val;
    }).join(',') + '\n';
  });

  downloadCSV(csv, `Report_${supReportType}_${ym}.csv`);
}

function renderSupReports() {
  const role = getSession()?.role || '';
  const isAuthority = ['PM','SM','HR'].includes(role);
  const types = [
    { key:'emp-attend',   label:'👤 Attendance' },
    { key:'role-attend',  label:'🏷 Role-wise' },
    { key:'payroll',      label:'💰 Payroll' },
    { key:'avail',        label:'📅 Availability' },
    { key:'seniority',    label:'🏅 Experience' },
    ...(!['HR'].includes(role) ? [{ key:'labour',  label:'👷 Labour' }]  : []),
    ...(!['HR'].includes(role) ? [{ key:'scanner', label:'🔍 Scanner' }] : []),
  ];
  if (!types.find(t => t.key === supReportType)) supReportType = 'emp-attend';

  document.getElementById('rtype-row-dynamic').innerHTML = types.map(t =>
    `<button class="rtype-btn ${t.key===supReportType?'active':''}" onclick="setSupReportType('${t.key}',this)">${t.label}</button>`
  ).join('');

  // Controls row — period selector only for role-attend
  const periodRow = supReportType === 'role-attend' ? `
    <div style="display:flex;gap:6px;margin-top:8px">
      ${['daily','weekly','monthly'].map(p=>`<button class="cat-btn ${roleReportPeriod===p?'active':''}" onclick="roleReportPeriod='${p}';renderSupReportOutput()">${p.charAt(0).toUpperCase()+p.slice(1)}</button>`).join('')}
    </div>` : '';

  document.getElementById('sup-report-controls').innerHTML = `
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px">
          <strong>Month:</strong>
          <input type="month" id="sup-r-month" value="${today().slice(0,7)}"
                 onchange="renderSupReportOutput()"
                 style="width:auto;margin:0;padding:10px 12px;font-size:15px">
        </div>
        <button class="btn btn-sm btn-primary" onclick="exportCurrentReport()" style="margin:0;border-radius:var(--radius-sm)">📥 Export CSV</button>
      </div>
      ${periodRow}
    </div>`;
  renderSupReportOutput();
}

function renderSupReportOutput() {
  const ym    = document.getElementById('sup-r-month')?.value || today().slice(0,7);
  const out   = document.getElementById('sup-report-output');
  const emps  = getEmployees().filter(e=>e.active);
  const dates = getMonthDates(ym).filter(d=>!isFuture(d));
  const att   = getSupAtt();
  const avail = getAvailList();
  const [y,m] = ym.split('-');
  const mLabel= new Date(+y,+m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  if (supReportType==='emp-attend') {
    const attMap = new Map();
    att.forEach(a => {
      const key = `${a.employeeId}_${a.date}`;
      attMap.set(key, a);
    });

    const rows = emps.map(e => {
      let present=0, totalMins=0;
      dates.forEach(d => {
        const r = attMap.get(`${e.id}_${d}`);
        if (r) { present++; totalMins += totalMinsForRec(r); }
      });
      return {e, present, absent:dates.length-present, totalMins};
    });
    lastReportData = rows.map(r => ({ Name: r.e.name, Role: r.e.role, Present: r.present, Absent: r.absent, TotalHrs: (r.totalMins/60).toFixed(2) }));
    // Insights block for PM/SM/HR only
    const isAuthority = ['PM','SM','HR'].includes(getSession()?.role||'');
    let insightsHtml = '';
    if (isAuthority && rows.length && dates.length) {
      const sorted = [...rows].filter(r=>r.present>0).sort((a,b)=>b.present-a.present||b.totalMins-a.totalMins);
      const topAtt  = sorted[0];
      const topHrs  = [...rows].filter(r=>r.totalMins>0).sort((a,b)=>b.totalMins-a.totalMins)[0];
      const perfect = rows.filter(r=>r.present===dates.length);
      // Trend data (last 3 months)
      const last3 = [];
      for(let i=2; i>=0; i--) {
        const d = new Date(+y, (+m-1)-i, 1);
        const ym_i = d.toISOString().slice(0,7);
        const att_i = att.filter(a => a.date.startsWith(ym_i));
        const totalPossible = emps.length * getMonthDates(ym_i).filter(x=>!isFuture(x)).length;
        const pct = totalPossible ? Math.round((att_i.length / totalPossible) * 100) : 0;
        last3.push({ label: d.toLocaleDateString('en-IN',{month:'short'}), pct });
      }

      insightsHtml = `
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:11px;font-weight:800;color:var(--text-3);letter-spacing:1px;text-transform:uppercase">📈 Monthly Trend</div>
          <div style="background:var(--card);border-radius:var(--radius-md);padding:14px;border:1px solid var(--glass-border);display:flex;align-items:flex-end;gap:20px;height:100px;justify-content:center">
            ${last3.map(t => `
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
                <div style="font-size:10px;color:var(--text-3);font-weight:700">${t.pct}%</div>
                <div style="width:100%;max-width:30px;height:${t.pct}px;background:var(--brand);border-radius:4px;opacity:${t.label===last3[2].label?1:0.4}"></div>
                <div style="font-size:10px;color:var(--text-2);font-weight:600">${t.label}</div>
              </div>
            `).join('')}
          </div>
          <div style="font-size:11px;font-weight:800;color:var(--text-3);letter-spacing:1px;text-transform:uppercase;margin-top:6px">✨ Insights — ${mLabel}</div>
          ${perfect.length ? `<div style="background:#F0FDF4;border-radius:var(--radius-md);padding:12px 14px;border-left:4px solid var(--success)">
            <div style="font-size:12px;font-weight:700;color:var(--success);margin-bottom:4px">🏆 100% Attendance</div>
            <div style="font-size:13px;color:var(--text)">${perfect.map(r=>`<b>${r.e.name}</b> <span style="font-size:11px;color:var(--text-3)">(${ROLES[r.e.role]?.label||r.e.role})</span>`).join(' · ')}</div>
          </div>` : ''}
          ${topAtt ? `<div style="background:#EEF4FD;border-radius:var(--radius-md);padding:12px 14px;border-left:4px solid var(--brand)">
            <div style="font-size:12px;font-weight:700;color:var(--brand);margin-bottom:4px">⭐ Most Disciplined</div>
            <div style="font-size:13px;color:var(--text)"><b>${topAtt.e.name}</b> — ${topAtt.present}/${dates.length} days present <span style="font-size:11px;color:var(--text-3)">(${Math.round(topAtt.present/dates.length*100)}%)</span></div>
          </div>` : ''}
          ${topHrs ? `<div style="background:#FFF4EE;border-radius:var(--radius-md);padding:12px 14px;border-left:4px solid var(--accent)">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:4px">⏱ Longest Staying</div>
            <div style="font-size:13px;color:var(--text)"><b>${topHrs.e.name}</b> — ${fmtMins(topHrs.totalMins)} total this month</div>
          </div>` : ''}
        </div>`;
    }

    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">👤 Employee Attendance — ${mLabel}</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>Name</th><th>Role</th><th>Present</th><th>Absent</th><th>Total Hrs</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td><b>${r.e.name}</b></td>
          <td>${ROLES[r.e.role]?.label||r.e.role}</td>
          <td class="td-p"><b>${r.present}</b></td>
          <td class="td-a">${r.absent}</td>
          <td class="td-hr">${fmtMins(r.totalMins)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="tfoot-row">
          <td colspan="2"><b>TOTAL</b></td>
          <td class="td-p"><b>${rows.reduce((s,r)=>s+r.present,0)}</b></td>
          <td></td>
          <td class="td-hr"><b>${fmtMins(rows.reduce((s,r)=>s+r.totalMins,0))}</b></td>
        </tr></tfoot>
      </table></div>${insightsHtml}`;

  } else if (supReportType==='role-attend') {
    // Role-wise attendance: group employees by role, show stats per period
    const roleOrder = ['PM','SM','HR','SE','EN','SV','JE','AS','TK'];
    const roleOrder = ['PM','SM','HR','SE','EN','SV','JE','AS','TK'];
    let periodDates = dates; // default monthly
    let periodLabel = mLabel;

    if (roleReportPeriod === 'daily') {
      periodDates = [today()].filter(d=>!isFuture(d));
      periodLabel = `Today — ${formatDate(today())}`;
    } else if (roleReportPeriod === 'weekly') {
      const t = new Date(); const dow = t.getDay()||7;
      const mon = new Date(t); mon.setDate(t.getDate()-dow+1);
      periodDates = Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d.toISOString().slice(0,10); }).filter(d=>!isFuture(d));
      periodLabel = `Week — ${periodDates[0]?.slice(5)} to ${periodDates[periodDates.length-1]?.slice(5)}`;
    }

    const attMap = new Map();
    att.forEach(a => { attMap.set(`${a.employeeId}_${a.date}`, a); });

    const roleStats = roleOrder.map(role => {
      const group = emps.filter(e=>e.role===role);
      if (!group.length) return null;
      let totalPresent=0, totalAbsent=0, totalMins=0;
      group.forEach(e => {
        periodDates.forEach(d => {
          const r = attMap.get(`${e.id}_${d}`);
          if (r) { totalPresent++; totalMins += totalMinsForRec(r); }
          else     totalAbsent++;
        });
      });
      const totalSlots = group.length * (periodDates.length||1);
      const pct = totalSlots ? Math.round(totalPresent/totalSlots*100) : 0;
      return { role, label:ROLES[role]?.label||role, count:group.length, totalPresent, totalAbsent, totalMins, pct };
    }).filter(Boolean);

    lastReportData = roleStats.map(r => ({ Role: r.label, Headcount: r.count, Present: r.totalPresent, Absent: r.totalAbsent, Percentage: r.pct + '%', TotalHrs: (r.totalMins/60).toFixed(2) }));

    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">🏷 Role-wise Attendance — ${periodLabel}</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>Role</th><th>Headcount</th><th>Present</th><th>Absent</th><th>Attendance %</th><th>Total Hrs</th></tr></thead>
        <tbody>${roleStats.map(r=>`<tr>
          <td><b>${r.label}</b></td>
          <td style="text-align:center">${r.count}</td>
          <td class="td-p">${r.totalPresent}</td>
          <td class="td-a">${r.totalAbsent}</td>
          <td style="text-align:center">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;height:6px;background:var(--border);border-radius:3px"><div style="width:${r.pct}%;height:100%;background:var(--success);border-radius:3px"></div></div>
              <span style="font-size:11px;font-weight:700;color:var(--text-2);min-width:32px">${r.pct}%</span>
            </div>
          </td>
          <td class="td-hr">${fmtMins(r.totalMins)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;

  } else if (supReportType==='avail') {
    const futureDates = Array.from({length:14},(_,i)=>dateFuture(i+1));
    const header = `<tr><th>Employee</th>${futureDates.map(d=>`<th>${dayName(d)}<br>${d.slice(8)}</th>`).join('')}</tr>`;
    const rows   = emps.map(e => {
      const cells = futureDates.map(d => {
        const r = avail.find(a=>a.employeeId===e.id && a.date===d);
        if (!r) return '<td></td>';
        return `<td><div class="${AVAIL[r.status]?.cell||''}">${AVAIL[r.status]?.label.split(' ')[0]||r.status}</div></td>`;
      }).join('');
      return `<tr><td><b>${e.name.split(' ')[0]}</b></td>${cells}</tr>`;
    });
    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">📅 Team Availability — Next 14 Days</div>
      <div class="rpt-scroll"><table class="rpt-table">${header}<tbody>${rows.join('')}</tbody></table></div>`;
    lastReportData = emps.map(e => {
       const row = { Name: e.name };
       futureDates.forEach(d => {
         const r = avail.find(a=>a.employeeId===e.id && a.date===d);
         row[d] = r ? r.status : '';
       });
       return row;
    });

  } else if (supReportType==='labour') {
    const workers  = getLmsWorkers();
    const lmsAll   = getLmsAtt();
    const rows     = workers.map(w => {
      let present=0, totalMins=0;
      dates.forEach(d => {
        const r = lmsAll.find(a=>a.workerId===w.id && a.date===d);
        if (r) { present++; totalMins += minsFromTimes(r.inTime,r.outTime); }
      });
      return {w, present, absent:dates.length-present, totalMins};
    });
    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">👷 Labour Summary — ${mLabel}</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>Worker</th><th>Skill</th><th>Present</th><th>Absent</th><th>Total Hrs</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td><b>${r.w.name}</b></td><td>${r.w.skill}</td>
          <td class="td-p">${r.present}</td>
          <td class="td-a">${r.absent}</td>
          <td class="td-hr">${fmtMins(r.totalMins)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div style="font-size:12px;color:#888;margin-top:8px">Labour data read from Labour Management System.</div>`;
    lastReportData = rows.map(r => ({ Worker: r.w.name, Skill: r.w.skill, Present: r.present, Absent: r.absent, TotalHrs: (r.totalMins/60).toFixed(2) }));

  } else if (supReportType==='payroll') {
    // Basic Payroll: calculation of days and estimated pay
    const rows = emps.map(e => {
      let present=0, totalMins=0;
      dates.forEach(d => {
        const r = att.find(a=>a.employeeId===e.id && a.date===d);
        if (r) { present++; totalMins += totalMinsForRec(r); }
      });
      // Mock daily rate if not present
      const rate = e.salary || 0; 
      const amount = (present * rate);
      return { e, present, totalMins, amount };
    });

    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">💰 Payroll Summary — ${mLabel}</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>Name</th><th>Role</th><th>Days</th><th>Total Hrs</th><th>Est. Pay</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td><b>${r.e.name}</b></td>
          <td>${ROLES[r.e.role]?.label||r.e.role}</td>
          <td style="text-align:center">${r.present}</td>
          <td class="td-hr">${fmtMins(r.totalMins)}</td>
          <td style="text-align:right;font-weight:700;color:var(--brand)">₹${r.amount.toLocaleString('en-IN')}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="tfoot-row">
          <td colspan="4"><b>TOTAL PAYABLE</b></td>
          <td style="text-align:right;font-weight:800;color:var(--brand);font-size:15px">₹${rows.reduce((s,r)=>s+r.amount,0).toLocaleString('en-IN')}</td>
        </tr></tfoot>
      </table></div>`;
    lastReportData = rows.map(r => ({ Name: r.e.name, Role: r.e.role, Days: r.present, TotalHrs: (r.totalMins/60).toFixed(2), Amount: r.amount }));

  } else if (supReportType==='scanner') {
    const workers  = getLmsWorkers();
    const lmsAll   = getLmsAtt();
    // Only records that have scannedInBy or scannedOutBy
    const scanned  = lmsAll.filter(a =>
      a.date >= ym+'-01' && a.date <= ym+'-31' &&
      (a.scannedInBy || a.scannedOutBy)
    ).sort((a,b)=>a.date.localeCompare(b.date)||a.inTime.localeCompare(b.inTime));

    if (!scanned.length) {
      out.innerHTML = `<div class="empty-state" style="padding:32px">No scanner log entries for ${mLabel}.<br><span style="font-size:12px">Records appear here only when a logged-in staff member marks labour attendance.</span></div>`;
      return;
    }

    const rows = scanned.map(a => {
      const w  = workers.find(x=>x.id===a.workerId)||{name:'Unknown',skill:'—'};
      const si = a.scannedInBy;
      const so = a.scannedOutBy;
      return `<tr>
        <td>${a.date}</td>
        <td><b>${w.name}</b><br><span style="font-size:10px;color:#888">${w.skill} · ${a.workerId}</span></td>
        <td>${a.inTime||'—'}</td>
        <td>${a.outTime||'—'}</td>
        <td style="font-size:11px">${si ? si.name+'<br><span style="color:#888">'+si.username+'</span>' : '—'}</td>
        <td style="font-size:11px">${so ? so.name+'<br><span style="color:#888">'+so.username+'</span>' : '—'}</td>
      </tr>`;
    }).join('');

    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">🔍 Scanner Log — ${mLabel} (${scanned.length} entries)</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>Date</th><th>Worker</th><th>IN</th><th>OUT</th><th>Scanned IN By</th><th>Scanned OUT By</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div style="font-size:12px;color:#888;margin-top:8px">Only entries where staff was logged in during scan are shown.</div>`;

  } else if (supReportType === 'seniority') {
    const allEmps = getEmployees().sort((a,b) => (a.joinDate||'').localeCompare(b.joinDate||''));
    out.innerHTML = `
      <div style="font-size:13px;color:#555;margin-bottom:10px">🏅 Employee Experience — as of ${formatDate(today())}</div>
      <div class="rpt-scroll"><table class="rpt-table">
        <thead><tr><th>#</th><th>Name</th><th>Role</th><th>Department</th><th>Joined</th><th>Service</th><th>Status</th></tr></thead>
        <tbody>${allEmps.map((e,i) => {
          const isResigned = e.status==='resigned'||e.active===false;
          return `<tr style="${isResigned?'opacity:0.6':''}">
            <td>${i+1}</td>
            <td><b>${e.name}</b></td>
            <td>${ROLES[e.role]?.label||e.role}</td>
            <td>${e.department||'—'}</td>
            <td>${e.joinDate||'—'}</td>
            <td><b>${computeSeniority(e.joinDate)}</b></td>
            <td>${isResigned ? '<span class="badge badge-resigned">Resigned'+(e.resignedDate?' '+e.resignedDate:'')+'</span>' : '<span class="badge badge-onsite">Active</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="font-size:12px;color:#888;margin-top:8px">Sorted by joining date (oldest first). Includes former employees.</div>`;
  }
}

function printSupReport() {
  const content = document.getElementById('sup-report-output').innerHTML;
  if (!content.trim()) { showToast('No report to print', 'info'); return; }
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div class="no-print" style="position:fixed;top:0;left:0;right:0;display:flex;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #ddd;z-index:100000;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
      <button onclick="triggerPrint()"
        style="flex:1;background:#1a3c5e;color:#fff;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:700;cursor:pointer">
        🖨️ Print / Save PDF
      </button>
      <button onclick="closePrintOverlay()"
        style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer">
        ✕
      </button>
    </div>
    <div style="padding:64px 16px 16px;font-family:Arial,sans-serif;font-size:12px;color:#000">
      <div style="font-size:18px;font-weight:bold;margin-bottom:4px">Patel Infrastructure Pvt. Ltd.</div>
      <div style="font-size:12px;color:#555;padding-bottom:10px;margin-bottom:16px;border-bottom:2px solid #1a3c5e">
        Surat Smart City Road Project &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}
      </div>
      ${content}
    </div>`;
  area.style.cssText = 'display:block;position:fixed;inset:0;z-index:99999;overflow-y:auto;background:#fff';
}
function triggerPrint() {
  const area = document.getElementById('print-area');
  if (!area) return;
  // Remove inline fixed positioning so @media print renders correctly
  const saved = area.style.cssText;
  area.style.cssText = 'display:block';
  window.addEventListener('afterprint', () => { area.style.cssText = saved; }, { once: true });
  window.print();
}
function closePrintOverlay() {
  const area = document.getElementById('print-area');
  if (area) { area.style.cssText = ''; area.innerHTML = ''; }
}

// ══════════════════════════════════════════════════════════
// PEOPLE TAB — Unified Directory + Contacts
// ══════════════════════════════════════════════════════════
let crewTab = 'internal';

function switchCrewTab(tab) {
  crewTab = tab;
  contactSearch = '';
  const searchEl = document.getElementById('people-search');
  if (searchEl) searchEl.value = '';
  document.getElementById('crew-internal-pane').style.display = tab === 'internal' ? '' : 'none';
  document.getElementById('crew-external-pane').style.display = tab === 'external' ? '' : 'none';
  document.getElementById('crew-tab-internal').classList.toggle('active', tab === 'internal');
  document.getElementById('crew-tab-external').classList.toggle('active', tab === 'external');
  if (tab === 'external') renderContacts();
  else renderHierarchy();
}

function renderCrewAddBtn() {
  const role   = getSession()?.role || '';
  const canAddEmp  = ['PM','SM','HR'].includes(role);
  const canAddCont = ['PM','SM','SE','EN'].includes(role);
  const btn = document.getElementById('crew-add-btn');
  if (!btn) return;
  if (crewTab === 'internal' && canAddEmp)
    btn.innerHTML = `<button class="crew-add-circle" onclick="openModal('modal-add-emp')" title="Add Employee">＋</button>`;
  else if (crewTab === 'external' && canAddCont)
    btn.innerHTML = `<button class="crew-add-circle" onclick="openAddContact()" title="Add Contact">＋</button>`;
  else
    btn.innerHTML = '';
}

function renderPeople() {
  if (crewTab === 'internal') renderHierarchy();
  else renderContacts();
}

// renderTeam now refreshes the People tab hierarchy
function renderTeam() { renderHierarchy(); }

// ══════════════════════════════════════════════════════════
// WORK TAB — Tasks + Notes with sub-tabs
// ══════════════════════════════════════════════════════════
// switchWorkTab removed — Work tab is tasks-only now

function renderWork() {
  renderTasks();
}

// ══════════════════════════════════════════════════════════
// DIRECTORY (kept for openComposeTo usage)
// ══════════════════════════════════════════════════════════
function renderDirectory() {
  renderHierarchy();
}

function renderHierarchy() {
  const me   = getCurrentEmp();
  const role = getSession()?.role||'';
  const q    = (document.getElementById('people-search')?.value||'').toLowerCase();
  const canManage = ['SU','PM','SM','HR'].includes(role);

  renderCrewAddBtn();

  const allEmps = getEmployees().filter(e => e.role !== 'SU');
  const matches = e => !q || e.name.toLowerCase().includes(q) || (ROLES[e.role]?.label||'').toLowerCase().includes(q) || (e.department||'').toLowerCase().includes(q);
  const activeEmps   = allEmps.filter(e => e.status !== 'resigned' && e.active !== false && matches(e));
  const resignedEmps = allEmps.filter(e => (e.status === 'resigned' || e.active === false) && matches(e));
  const att  = getSupAtt();

  const levels = [
    { label:'Management',       roles:['PM','SM'] },
    { label:'HR',               roles:['HR'] },
    { label:'Engineers',        roles:['SE','EN'] },
    { label:'Site Operations',  roles:['SV','JE'] },
    { label:'Support',          roles:['AS','TK'] }
  ];

  function empCard(e, isResigned) {
    const isMe = e.id === me.id;
    const rec  = att.find(a=>a.employeeId===e.id && a.date===today());
    let statusDot = '';
    if (!isResigned) {
      if (!rec || !rec.punches || rec.punches.length === 0)
        statusDot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#CBD5E1;margin-right:5px;vertical-align:middle"></span><span style="font-size:11px;color:var(--text-3)">Not in today</span>`;
      else if (isCurrentlyIN(rec))
        statusDot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--success);margin-right:5px;vertical-align:middle"></span><span style="font-size:11px;color:var(--success);font-weight:600">In since ${lastPunch(rec).inTime}</span>`;
      else
        statusDot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#94A3B8;margin-right:5px;vertical-align:middle"></span><span style="font-size:11px;color:var(--text-3)">Left at ${lastPunch(rec).outTime}</span>`;
    }
    return `<div class="crew-card${isMe?' crew-card-me':''}${isResigned?' crew-card-resigned':''}" onclick="${canManage||isMe?`openEmpProfile('${e.id}')`:''}" style="${canManage||isMe?'cursor:pointer':''}">
      <div class="crew-avatar" style="background:${avatarColor(e.role)}">${e.avatar}</div>
      <div class="crew-info">
        <div class="crew-name">${e.name}${isMe?' <span class="crew-you">(You)</span>':''}</div>
        <div class="crew-meta">${isResigned?'<span class="badge badge-resigned">Resigned</span>':roleBadge(e.role)} <span style="color:var(--border)">·</span> ${e.department||'—'}</div>
        <div class="crew-status">${!isResigned ? statusDot : `<span style="font-size:11px;color:#aaa">Resigned ${e.resignedDate||''}</span>`}</div>
      </div>
      <div style="flex-shrink:0;color:var(--text-3);font-size:18px">${canManage||isMe?'›':''}</div>
    </div>`;
  }

  let html = '';
  levels.forEach(lv => {
    const group = activeEmps.filter(e => lv.roles.includes(e.role));
    if (!group.length) return;
    html += `<div class="hier-level"><div class="hier-level-label">${lv.label}</div>`;
    group.forEach(e => { html += empCard(e, false); });
    html += `</div>`;
  });

  if (resignedEmps.length && canManage) {
    html += `<div style="margin-top:16px;font-size:11px;font-weight:bold;color:#999;letter-spacing:1px;text-transform:uppercase;padding:10px 0 8px;border-top:1px solid #eee">Former Employees (${resignedEmps.length})</div>`;
    resignedEmps.forEach(e => { html += empCard(e, true); });
  }

  const hierEl = document.getElementById('people-hier') || document.getElementById('dir-hier-pane');
  if (hierEl) hierEl.innerHTML = html || '<div class="empty-state">No employees found.</div>';
}

function openComposeTo(empId) {
  showTab('messages');
  openWAChat(empId);
}

function updateMsgBadge() {
  const me = getCurrentEmp();
  if (!me) return;
  const dmUnread = getMessages().filter(m=>m.to===me.id && !m.read).length;
  const navBtn = document.querySelector('#main-nav button[data-tab="messages"]');
  if (navBtn) navBtn.innerHTML = '<span class="tab-icon">'+TAB_ICONS['messages']+'</span><span class="tab-label">'+TAB_LABELS['messages']+'</span>'+(dmUnread>0?'<span class="msg-badge">'+dmUnread+'</span>':'');
}

// ══════════════════════════════════════════════════════════
// MESSAGES — WhatsApp UI
// ══════════════════════════════════════════════════════════
let waChatWith  = null;
let waChatGroup = null; // currently open group id
let pendingAvailChanges = {}; // date → status, cleared on Apply

function renderMessages() {
  showWAView('list');
  renderConvList();
  updateMsgBadge();
  setTimeout(() => { try { renderConvList(); } catch(e){} }, 800);
}

function showWAView(view) {
  ['list','chat','new'].forEach(v => {
    const el = document.getElementById('wa-'+v+'-view');
    if (el) el.style.display = v===view ? 'flex' : 'none';
  });
  // Slim-header shows on list view; chat/new views use their own white sub-header
  const slimHdr = document.getElementById('slim-header');
  const wrap    = document.getElementById('wa-wrap');
  const extraBtn = document.getElementById('slim-extra-btn');
  if (view === 'list') {
    if (slimHdr) slimHdr.style.display = 'flex';
    if (wrap) wrap.style.height = 'calc(100dvh - 44px - var(--nav-h))';
    if (extraBtn) { extraBtn.textContent = '✏'; extraBtn.style.display = ''; extraBtn.onclick = openNewChat; }
  } else {
    if (slimHdr) slimHdr.style.display = 'none';
    if (wrap) wrap.style.height = 'calc(100dvh - var(--nav-h))';
    if (extraBtn) extraBtn.style.display = 'none';
  }
}

function renderConvList() {
  const me    = getCurrentEmp();
  const q     = (document.getElementById('wa-search-inp')?.value||'').toLowerCase();
  const allMsgs = getMessages();
  const emps  = getEmployees();
  const groups= getGroups();

  // DM conversations
  const dmMsgs = allMsgs.filter(m=>(m.from===me.id||m.to===me.id)&&!m.groupId);
  const dmMap  = {};
  dmMsgs.forEach(m => {
    const otherId = m.from===me.id ? m.to : m.from;
    if (!dmMap[otherId] || m.timestamp > dmMap[otherId].lastTs) {
      dmMap[otherId] = { type:'dm', otherId, lastText:m.text, lastTs:m.timestamp, iSent:m.from===me.id };
    }
    if (m.to===me.id && !m.read) dmMap[otherId].unread = (dmMap[otherId].unread||0)+1;
  });

  // Group conversations
  const myGroups = groups.filter(g => g.members.includes(me.id));
  const grpItems = myGroups.map(g => {
    const gMsgs = allMsgs.filter(m => m.groupId === g.id).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
    const last  = gMsgs[gMsgs.length-1];
    return {
      type:'group', groupId:g.id, name:g.name, members:g.members,
      lastText: last ? last.text : 'No messages yet',
      lastTs:   last ? last.timestamp : g.createdAt,
      iSent:    last ? last.from===me.id : false
    };
  });

  let items = [...Object.values(dmMap), ...grpItems]
    .sort((a,b) => b.lastTs.localeCompare(a.lastTs));

  if (q) items = items.filter(c => {
    if (c.type==='group') return c.name.toLowerCase().includes(q);
    const emp = emps.find(e=>e.id===c.otherId);
    return emp?.name.toLowerCase().includes(q);
  });

  const div = document.getElementById('wa-conv-list');
  if (!items.length) {
    div.innerHTML = `<div class="empty-state" style="padding:40px 20px">No conversations yet.<br>Tap ✏ to start a chat.</div>`;
    return;
  }

  div.innerHTML = items.map(c => {
    if (c.type === 'group') {
      const memberNames = c.members.slice(0,3).map(id=>emps.find(e=>e.id===id)?.name.split(' ')[0]||'?').join(', ');
      return `<div class="wa-conv-item" onclick="openWAGroupChat('${c.groupId}')">
        <div class="wa-conv-avatar" style="background:#8e44ad;font-size:18px">👥</div>
        <div class="wa-conv-info">
          <div class="wa-conv-name">${escHtml(c.name)} <span style="font-size:10px;color:#888">(Group)</span></div>
          <div class="wa-conv-last">${c.iSent?'You: ':''}${escHtml(c.lastText.length>40?c.lastText.slice(0,40)+'…':c.lastText)}</div>
        </div>
        <div class="wa-conv-right"><div class="wa-conv-time">${waTimeStr(c.lastTs)}</div></div>
      </div>`;
    }
    const emp = emps.find(e=>e.id===c.otherId);
    if (!emp) return '';
    const unread = c.unread||0;
    return `<div class="wa-conv-item" onclick="openWAChat('${c.otherId}')">
      <div class="wa-conv-avatar" style="background:${avatarColor(emp.role)}">${emp.avatar}</div>
      <div class="wa-conv-info">
        <div class="wa-conv-name">${emp.name}</div>
        <div class="wa-conv-last">${c.iSent?'You: ':''}${escHtml(c.lastText.length>45?c.lastText.slice(0,45)+'…':c.lastText)}</div>
      </div>
      <div class="wa-conv-right">
        <div class="wa-conv-time ${unread?'unread-time':''}">${waTimeStr(c.lastTs)}</div>
        ${unread?`<div class="wa-unread-dot">${unread}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

async function openWAChat(empId) {
  const me  = getCurrentEmp();
  const emp = getEmployees().find(e=>e.id===empId);
  if (!emp) return;
  showTab('messages');
  waChatWith = empId;

  // Mark received msgs from this person as read
  const msgs = getMessages();
  const toUpdate = [];
  msgs.forEach(m => {
    if (m.from === empId && m.to === me.id && !m.read) {
      m.read = true;
      toUpdate.push(m);
    }
  });

  if (toUpdate.length > 0) {
    await sbUpsert('messages', toUpdate);
    updateMsgBadge();
  }

  document.getElementById('wa-chat-hdr').innerHTML = `
    <button class="wa-back-btn" onclick="closeWAChat()">‹</button>
    <div class="wa-chat-avatar" style="background:${avatarColor(emp.role)};cursor:pointer" onclick="openEmpProfile('${emp.id}')">${emp.avatar}</div>
    <div class="wa-chat-hdr-info" style="cursor:pointer" onclick="openEmpProfile('${emp.id}')">
      <div class="wa-chat-hdr-name">${emp.name}</div>
      <div class="wa-chat-hdr-sub">${ROLES[emp.role]?.label||emp.role} · ${emp.department||''}</div>
    </div>
    ${emp.mobile?`<a href="tel:${emp.mobile}"><button class="wa-chat-call-btn">📞</button></a>`:''}`;

  renderWAChatThread();
  showWAView('chat');
  setTimeout(()=>{ const a=document.getElementById('wa-chat-msgs'); if(a) a.scrollTop=a.scrollHeight; },50);
  document.getElementById('wa-input')?.focus();
}

function renderWAChatThread() {
  const me   = getCurrentEmp();
  const msgs = getMessages()
    .filter(m=>(m.from===me.id&&m.to===waChatWith)||(m.from===waChatWith&&m.to===me.id))
    .sort((a,b)=>a.timestamp.localeCompare(b.timestamp));

  const area = document.getElementById('wa-chat-msgs');
  if (!msgs.length) {
    area.innerHTML='<div style="text-align:center;color:#aaa;padding:40px 0;font-size:13px">No messages yet</div>';
    return;
  }

  let lastDate='', html='';
  msgs.forEach(m => {
    const sent = m.from===me.id;
    const d    = m.timestamp.slice(0,10);
    if (d!==lastDate) {
      lastDate=d;
      html+=`<div class="wa-date-sep"><span>${formatDate(d)}</span></div>`;
    }
    const ts = new Date(m.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
    html+=`<div class="wa-bubble-wrap ${sent?'sent':'recv'}">
      <div class="wa-bubble ${sent?'sent':'recv'}">
        ${escHtml(m.text)}
        <span class="wa-ts">${ts}${sent?' ✓✓':''}</span>
      </div>
    </div>`;
  });
  area.innerHTML = html;
}

function closeWAChat() {
  waChatWith  = null;
  waChatGroup = null;
  renderConvList();
  showWAView('list');
}

// ── Group chat ──
function openWAGroupChat(groupId) {
  const me    = getCurrentEmp();
  const group = getGroups().find(g => g.id === groupId);
  if (!group) return;
  waChatWith  = null;
  waChatGroup = groupId;
  const emps  = getEmployees();
  const memberNames = group.members.map(id => emps.find(e=>e.id===id)?.name.split(' ')[0]||'?').join(', ');
  document.getElementById('wa-chat-hdr').innerHTML = `
    <button class="wa-back-btn" onclick="closeWAChat()">‹</button>
    <div class="wa-chat-avatar" style="background:#8e44ad;font-size:16px">👥</div>
    <div class="wa-chat-hdr-info">
      <div class="wa-chat-hdr-name">${escHtml(group.name)}</div>
      <div class="wa-chat-hdr-sub">${group.members.length} members · ${memberNames}</div>
    </div>`;
  renderWAGroupThread();
  showWAView('chat');
  setTimeout(()=>{ const a=document.getElementById('wa-chat-msgs'); if(a) a.scrollTop=a.scrollHeight; },50);
  document.getElementById('wa-input')?.focus();
}

function renderWAGroupThread() {
  const me   = getCurrentEmp();
  const emps = getEmployees();
  const msgs = getMessages()
    .filter(m => m.groupId === waChatGroup)
    .sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  const area = document.getElementById('wa-chat-msgs');
  if (!msgs.length) {
    area.innerHTML = '<div style="text-align:center;color:#aaa;padding:40px 0;font-size:13px">No messages yet</div>';
    return;
  }
  let lastDate='', html='';
  msgs.forEach(m => {
    const sent = m.from === me.id;
    const d    = m.timestamp.slice(0,10);
    if (d !== lastDate) { lastDate=d; html+=`<div class="wa-date-sep"><span>${formatDate(d)}</span></div>`; }
    const sender = emps.find(e=>e.id===m.from);
    const ts = new Date(m.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
    html += `<div class="wa-bubble-wrap ${sent?'sent':'recv'}">
      <div class="wa-bubble ${sent?'sent':'recv'}">
        ${!sent ? `<div style="font-size:10px;font-weight:bold;color:#075e54;margin-bottom:3px">${escHtml(sender?.name.split(' ')[0]||'?')}</div>` : ''}
        ${escHtml(m.text)}
        <span class="wa-ts">${ts}${sent?' ✓':''}</span>
      </div>
    </div>`;
  });
  area.innerHTML = html;
}

function openCreateGroup() {
  const me   = getCurrentEmp();
  const emps = getEmployees().filter(e => e.active !== false && e.status !== 'resigned' && e.id !== me.id);
  document.getElementById('grp-name').value = '';
  document.getElementById('grp-member-list').innerHTML = emps.map(e => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer">
      <input type="checkbox" value="${e.id}" style="width:18px;height:18px;flex-shrink:0">
      <div class="wa-conv-avatar" style="background:${avatarColor(e.role)};width:32px;height:32px;font-size:11px">${e.avatar}</div>
      <div>
        <div style="font-weight:bold;font-size:14px">${e.name}</div>
        <div style="font-size:11px;color:#888">${ROLES[e.role]?.label||e.role}</div>
      </div>
    </label>`).join('');
  closeModal('modal-create-group'); // ensure fresh
  openModal('modal-create-group');
}

function createGroup() {
  const name = document.getElementById('grp-name').value.trim();
  if (!name) { showToast('Enter group name','error'); return; }
  const checked = [...document.querySelectorAll('#grp-member-list input:checked')].map(cb=>cb.value);
  if (checked.length < 1) { showToast('Select at least 1 member','error'); return; }
  const me     = getCurrentEmp();
  const groups = getGroups();
  const newGrp = {
    id: 'GRP'+String(groups.length+1).padStart(3,'0'),
    name, members: [me.id, ...checked], createdBy: me.id, createdAt: nowISO()
  };
  groups.push(newGrp);
  saveGroups(groups);
  closeModal('modal-create-group');
  showToast('Group "'+name+'" created','success');
  showTab('messages');
  openWAGroupChat(newGrp.id);
}

async function waSend() {
  const input = document.getElementById('wa-input');
  const text  = input?.value.trim();
  if (!text) return;
  const me = getCurrentEmp();
  // Unique ID: timestamp + random suffix — avoids collisions between concurrent users
  const id = 'MSG' + Date.now() + Math.random().toString(36).slice(2,6).toUpperCase();
  if (waChatGroup) {
    const msg = { id, from:me.id, groupId:waChatGroup, text, timestamp:nowISO() };
    DB.messages.push(msg);
    await sbUpsert('messages', [msg]); // Write only this single message
    input.value = '';
    renderWAGroupThread();
    setTimeout(()=>{ const a=document.getElementById('wa-chat-msgs'); if(a) a.scrollTop=a.scrollHeight; },30);
  } else if (waChatWith) {
    const msg = { id, from:me.id, to:waChatWith, text, timestamp:nowISO(), read:false };
    DB.messages.push(msg);
    await sbUpsert('messages', [msg]); // Write only this single message
    input.value = '';
    renderWAChatThread();
    updateMsgBadge();
    setTimeout(()=>{ const a=document.getElementById('wa-chat-msgs'); if(a) a.scrollTop=a.scrollHeight; },30);
  }
}

function openNewChat() {
  const me   = getCurrentEmp();
  const emps = getEmployees().filter(e=>e.active&&e.id!==me.id);
  document.getElementById('wa-new-list').innerHTML = emps.map(e=>`
    <div class="wa-new-item" onclick="openWAChat('${e.id}')">
      <div class="wa-conv-avatar" style="background:${avatarColor(e.role)}">${e.avatar}</div>
      <div class="wa-new-item-info">
        <div class="wa-new-name">${e.name}</div>
        <div class="wa-new-sub">${ROLES[e.role]?.label||e.role} · ${e.department||''}</div>
      </div>
    </div>`).join('');
  showWAView('new');
}

function filterNewList(q) {
  document.querySelectorAll('#wa-new-list .wa-new-item').forEach(el => {
    el.style.display = el.innerText.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function waTimeStr(iso) {
  const d=new Date(iso), t=today(), day=iso.slice(0,10);
  if (day===t) return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
  if (day===dateOffset(1)) return 'Yesterday';
  return day.slice(5).replace('-','/');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ══════════════════════════════════════════════════════════
// MY PAD — Private, stored per-user in Firestore
// ══════════════════════════════════════════════════════════
let padFilter = 'all';

function padUserId() { return getCurrentEmp()?.id||'guest'; }
function getPadItems() { return DB.pad[padUserId()] || []; }
async function savePadItems(d) {
  const uid = padUserId();
  DB.pad[uid] = d;
  await sbUpsert('pad', d.map(item => ({ ...item, userId: uid })));
}

const PAD_ICONS  = { task:'✅', note:'📝', call:'📞', voice:'🎙' };
const PAD_TITLES = { task:'To-Do', note:'Note', call:'Call Reminder', voice:'Voice Note' };

function renderMyPad() {
  setPadFilter(padFilter, null, true);
}

function setPadFilter(type, btn, silent) {
  padFilter = type;
  if (!silent) {
    document.querySelectorAll('#pad-filter-row .cat-btn').forEach(b=>b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  let items = getPadItems();
  if (type!=='all') items = items.filter(i=>i.type===type);
  items = items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  const div = document.getElementById('pad-list');
  if (!items.length) { div.innerHTML='<div class="empty-state">Nothing here yet. Tap a button above to add.</div>'; return; }

  div.innerHTML = items.map(item => {
    const doneStyle = item.done ? 'opacity:0.55;text-decoration:line-through;' : '';
    let extra = '';
    if (item.type==='call')  extra = `<div style="font-size:12px;color:#e67e22;margin-top:5px">📞 ${item.phone||'—'}${item.remindAt?' · Remind: '+item.remindAt:''}</div>`;
    if (item.type==='task')  extra = item.dueDate?`<div style="font-size:12px;color:#888;margin-top:5px">Due: ${item.dueDate}</div>`:'';
    if (item.type==='voice') extra = item.audioB64
      ? `<audio controls style="width:100%;margin-top:8px"><source src="${item.audioB64}" type="audio/webm"></audio>`
      : `<div style="font-size:12px;color:#aaa;margin-top:4px">No audio recorded</div>`;

    return `<div class="card" style="border-left:4px solid ${padColor(item.type)};margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;${doneStyle}">
          <div style="font-size:13px;color:#888;margin-bottom:4px">${PAD_ICONS[item.type]} ${PAD_TITLES[item.type]} · ${formatDT(item.createdAt)}</div>
          <div style="font-size:15px;font-weight:bold;color:#111">${escHtml(item.title)}</div>
          ${item.body?`<div style="font-size:13px;color:#555;margin-top:4px">${escHtml(item.body)}</div>`:''}
          ${extra}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-left:10px;flex-shrink:0">
          ${item.type==='task'?`<button class="btn-sm" style="background:${item.done?'#95a5a6':'#27ae60'};color:#fff" onclick="togglePadDone('${item.id}')">${item.done?'↩':'✓'}</button>`:''}
          <button class="btn-sm" style="background:#e74c3c;color:#fff" onclick="deletePadItem('${item.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function padColor(t) {
  return {task:'#27ae60',note:'#2980b9',call:'#e67e22',voice:'#8e44ad'}[t]||'#ccc';
}

let _mediaRec = null, _audioChunks = [];

function openPadItem(type) {
  document.getElementById('pad-modal-title').textContent = PAD_ICONS[type]+' '+PAD_TITLES[type];
  const due = dateFuture(1);

  let body = `<input type="text" id="pi-title" placeholder="${type==='call'?'Person name':'Title / Task'}" style="margin-bottom:10px">`;
  if (type==='note')  body += `<textarea id="pi-body" placeholder="Write your note…" style="min-height:80px"></textarea>`;
  if (type==='task')  body += `<input type="text" id="pi-body" placeholder="Details (optional)"><label style="margin-top:4px">Due Date</label><input type="date" id="pi-due" value="${due}">`;
  if (type==='call')  body += `<input type="tel" id="pi-phone" placeholder="Phone number"><label style="margin-top:4px">Remind At (optional)</label><input type="datetime-local" id="pi-remind">`;
  if (type==='voice') body += `
    <div id="voice-rec-ui" style="text-align:center;padding:10px">
      <button class="btn btn-primary" id="rec-btn" onclick="toggleRecord()" style="margin-bottom:8px">🎙 Start Recording</button>
      <div id="rec-status" style="font-size:13px;color:#888">Press to record your voice note</div>
      <audio id="rec-preview" controls style="width:100%;margin-top:10px;display:none"></audio>
    </div>`;

  body += `<button class="btn btn-primary" style="margin-top:4px" onclick="savePadItem('${type}')">Save</button>`;
  document.getElementById('pad-modal-body').innerHTML = body;
  openModal('modal-pad-item');
}

function toggleRecord() {
  if (_mediaRec && _mediaRec.state==='recording') {
    _mediaRec.stop();
    document.getElementById('rec-btn').textContent = '🎙 Start Recording';
    document.getElementById('rec-status').textContent = 'Recording stopped';
    return;
  }
  _audioChunks = [];
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
    _mediaRec = new MediaRecorder(stream);
    _mediaRec.ondataavailable = e => _audioChunks.push(e.data);
    _mediaRec.onstop = () => {
      const blob = new Blob(_audioChunks, {type:'audio/webm'});
      const url  = URL.createObjectURL(blob);
      const prev = document.getElementById('rec-preview');
      prev.src   = url; prev.style.display='block';
      // Store as base64 on save
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => { window._voiceB64 = reader.result; };
      stream.getTracks().forEach(t=>t.stop());
    };
    _mediaRec.start();
    document.getElementById('rec-btn').textContent = '⏹ Stop Recording';
    document.getElementById('rec-status').textContent = '🔴 Recording…';
  }).catch(()=>{ showToast('Microphone access denied','error'); });
}

function savePadItem(type) {
  const title = document.getElementById('pi-title')?.value.trim();
  if (!title && type!=='voice') { showToast('Enter a title','error'); return; }
  const items = getPadItems();
  const item  = {
    id: 'PAD'+Date.now(), type, title:title||'Voice Note',
    body: document.getElementById('pi-body')?.value.trim()||'',
    createdAt: nowISO(), done: false
  };
  if (type==='task')  item.dueDate   = document.getElementById('pi-due')?.value||'';
  if (type==='call')  { item.phone = document.getElementById('pi-phone')?.value||''; item.remindAt = document.getElementById('pi-remind')?.value||''; }
  if (type==='voice') item.audioB64  = window._voiceB64||null;
  window._voiceB64 = null;
  items.push(item);
  savePadItems(items);
  closeModal('modal-pad-item');
  showToast('Saved','success');
  renderMyPad();
}

function togglePadDone(id) {
  const items = getPadItems();
  const idx   = items.findIndex(i=>i.id===id);
  if (idx>-1) { items[idx].done = !items[idx].done; savePadItems(items); renderMyPad(); }
}

async function deletePadItem(id) {
  if (!confirm('Delete this item?')) return;
  const items = getPadItems().filter(i => i.id !== id);
  await savePadItems(items);
  await sbDel('pad', { userId: padUserId(), id: id });
  renderMyPad();
}

// ══════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════
let contactCatFilter = 'all';

const CAT_ICONS = { emergency:'🚨', agency:'🏢', vendor:'🛒', client:'🤝', office:'🏬', other:'📋' };
const CAT_LABELS= { emergency:'Emergency', agency:'Agency', vendor:'Vendor', client:'Client', office:'Office', other:'Other' };

function filterContacts(cat, btn) {
  contactCatFilter = cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderContactsList();
}

function renderContacts() {
  renderCrewAddBtn();
  renderContactsList();
}

let contactSearch = '';

function renderContactsList() {
  const role   = getSession()?.role||'';
  const canEdit= ['SU','PM','SM','SE','EN'].includes(role);
  const canDel = ['SU','PM','SM'].includes(role);
  let contacts = getContacts();
  if (contactCatFilter !== 'all') contacts = contacts.filter(c=>c.category===contactCatFilter);
  if (contactSearch) {
    const q = contactSearch.toLowerCase();
    contacts = contacts.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.phone||'').includes(q));
  }

  const div = document.getElementById('contacts-list');
  if (!contacts.length) { div.innerHTML='<div class="empty-state">No contacts found.</div>'; return; }

  let html = ``;

  // Emergency first
  const emergency = contacts.filter(c=>c.category==='emergency');
  const rest      = contacts.filter(c=>c.category!=='emergency');

  const CAT_COLORS = { emergency:'#DC2626', agency:'#2563EB', vendor:'#16A34A', client:'#D97706', office:'#7C3AED', other:'#64748B' };
  function contactRow(c) {
    const bg = CAT_COLORS[c.category] || '#64748B';
    const icon = CAT_ICONS[c.category] || '📋';
    return `<div class="crew-card" onclick="openContactDetail('${c.id}')" style="cursor:pointer">
      <div class="crew-avatar" style="background:${bg};font-size:20px">${icon}</div>
      <div class="crew-info">
        <div class="crew-name">${c.name}</div>
        <div class="crew-meta"><span class="badge badge-${c.category}">${CAT_LABELS[c.category]||c.category}</span>${c.description?` <span style="color:var(--border)">·</span> <span>${c.description}</span>`:''}</div>
        ${c.phone ? `<div class="crew-status"><span style="font-size:12px;font-weight:600;color:var(--text-2)">${c.phone}</span></div>` : ''}
      </div>
      <div style="flex-shrink:0;color:var(--text-3);font-size:18px">›</div>
    </div>`;
  }

  if (emergency.length) {
    html += `<div style="font-size:11px;font-weight:800;color:var(--danger);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-left:4px">🚨 Emergency</div>`;
    html += emergency.map(contactRow).join('');
  }

  // A-Z groups for the rest
  if (rest.length) {
    const sorted = rest.slice().sort((a,b)=>a.name.localeCompare(b.name));
    let lastLetter = '';
    sorted.forEach(c => {
      const letter = c.name[0].toUpperCase();
      if (letter !== lastLetter) {
        html += `<div style="font-size:11px;font-weight:800;color:var(--brand);letter-spacing:1px;text-transform:uppercase;margin:10px 0 6px;padding-left:4px;border-left:3px solid var(--brand);padding-left:8px">${letter}</div>`;
        lastLetter = letter;
      }
      html += contactRow(c);
    });
  }

  div.innerHTML = html;
}

function openAddContact() {
  document.getElementById('ac-modal-title').textContent = 'Add Contact';
  document.getElementById('ac-edit-id').value = '';
  ['ac-name','ac-phone','ac-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ac-cat').value = 'emergency';
  ['ac-name','ac-cat','ac-phone','ac-desc'].forEach(id => {
    const el = document.getElementById(id);
    el.disabled = false; el.style.opacity = '';
  });
  document.getElementById('ac-save-btn').style.display     = '';
  document.getElementById('ac-options-btn').style.display   = 'none';
  document.getElementById('ac-options-panel').style.display = 'none';
  _setContactModalCallBtn(null);
  openModal('modal-add-contact');
}

function toggleContactOptions() {
  const panel = document.getElementById('ac-options-panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function _setContactModalCallBtn(phone) {
  const btn = document.getElementById('ac-call-btn');
  if (!btn) return;
  if (phone) {
    btn.style.display = '';
    btn.onclick = () => { window.location.href = 'tel:' + phone; };
  } else {
    btn.style.display = 'none';
  }
}

function openContactDetail(id) {
  const role    = getSession()?.role||'';
  const canEdit = ['SU','PM','SM','SE','EN'].includes(role);
  const canDel  = ['SU','PM','SM'].includes(role);
  const c = getContacts().find(x=>x.id===id);
  if (!c) return;
  // Always open as read-only view
  document.getElementById('ac-modal-title').textContent = c.name;
  document.getElementById('ac-edit-id').value = '';
  document.getElementById('ac-name').value    = c.name;
  document.getElementById('ac-cat').value     = c.category;
  document.getElementById('ac-phone').value   = c.phone||'';
  document.getElementById('ac-desc').value    = c.description||'';
  ['ac-name','ac-cat','ac-phone','ac-desc'].forEach(fid => {
    const el = document.getElementById(fid);
    el.disabled = true; el.style.opacity = '1';
  });
  document.getElementById('ac-save-btn').style.display      = 'none';
  document.getElementById('ac-options-btn').style.display    = 'none';
  document.getElementById('ac-options-panel').style.display  = 'none';
  // Edit / Delete buttons at bottom
  const editBtn = document.getElementById('ac-edit-mode-btn');
  const delBtn2 = document.getElementById('ac-del-view-btn');
  if (editBtn) { editBtn.style.display = canEdit ? '' : 'none'; editBtn.onclick = () => openEditContact(id); }
  if (delBtn2) { delBtn2.style.display = canDel  ? '' : 'none'; delBtn2.onclick = () => { closeModal('modal-add-contact'); deleteContact(id); }; }
  _setContactModalCallBtn(c.phone);
  openModal('modal-add-contact');
}

function openEditContact(id) {
  const c = getContacts().find(x=>x.id===id);
  if (!c) return;
  const role   = getSession()?.role||'';
  const canDel = ['SU','PM','SM'].includes(role);
  document.getElementById('ac-modal-title').textContent = 'Edit Contact';
  document.getElementById('ac-edit-id').value  = c.id;
  document.getElementById('ac-name').value     = c.name;
  document.getElementById('ac-cat').value      = c.category;
  document.getElementById('ac-phone').value    = c.phone||'';
  document.getElementById('ac-desc').value     = c.description||'';
  ['ac-name','ac-cat','ac-phone','ac-desc'].forEach(fid => {
    const el = document.getElementById(fid);
    el.disabled = false; el.style.opacity = '';
  });
  document.getElementById('ac-save-btn').style.display      = '';
  document.getElementById('ac-options-btn').style.display    = 'none';
  document.getElementById('ac-options-panel').style.display  = 'none';
  const editBtn = document.getElementById('ac-edit-mode-btn');
  const delBtn2 = document.getElementById('ac-del-view-btn');
  if (editBtn) editBtn.style.display = 'none';
  if (delBtn2) delBtn2.style.display = 'none';
  const delBtn = document.getElementById('ac-del-btn');
  delBtn.onclick = () => { closeModal('modal-add-contact'); deleteContact(c.id); };
  _setContactModalCallBtn(c.phone);
  openModal('modal-add-contact');
}

function saveContact() {
  const editId = document.getElementById('ac-edit-id').value;
  const name   = document.getElementById('ac-name').value.trim();
  const cat    = document.getElementById('ac-cat').value;
  const phone  = document.getElementById('ac-phone').value.trim();
  const desc   = document.getElementById('ac-desc').value.trim();
  if (!name || !phone) { showToast('Name and phone required','error'); return; }

  const contacts = getContacts();
  if (editId) {
    const idx = contacts.findIndex(c=>c.id===editId);
    if (idx>-1) { contacts[idx] = {...contacts[idx], name, category:cat, phone, description:desc}; }
  } else {
    contacts.push({
      id: 'CON'+String(contacts.length+1).padStart(3,'0'),
      name, category:cat, phone, description:desc,
      addedBy: getCurrentEmp().id, addedAt: nowISO()
    });
  }
  saveContacts(contacts);
  closeModal('modal-add-contact');
  showToast(editId?'Contact updated':'Contact added','success');
  renderContactsList();
}

async function deleteContact(id) {
  if (!confirm('Delete this contact?')) return;
  const contacts = getContacts().filter(c => c.id !== id);
  await saveContacts(contacts);
  await sbDel('contacts', { id: id });
  showToast('Contact deleted', 'info');
  renderContactsList();
}

// ══════════════════════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════════════════════
async function seedData() {
  // Quick exit if fully seeded
  const _allEmps = getEmployees();
  if (_allEmps.length >= 19 && _allEmps.find(e => e.bloodGroup)) return;

  // v4: add extended profile fields (blood group, birthdate, address, vehicle) to all employees
  const existingEmps4 = getEmployees();
  if (existingEmps4.length > 0 && !existingEmps4.find(e => e.bloodGroup)) {
    const profilePatch = {
      EMP001: { bloodGroup:'B+',  birthDate:'1980-07-15', address:'Block A, Hari Om Society, Varachha Road, Surat', pincode:'395006', vehicle:'GJ05AK7892', priorExpYears:8 },
      EMP002: { bloodGroup:'O+',  birthDate:'1983-03-22', address:'14, Nilam Park, Katargam, Surat',               pincode:'395004', vehicle:'GJ05BK2341', priorExpYears:5 },
      EMP003: { bloodGroup:'A+',  birthDate:'1985-11-08', address:'22, Shreeji Nagar, Adajan, Surat',              pincode:'395009', vehicle:'GJ05CL9102', priorExpYears:4 },
      EMP004: { bloodGroup:'B+',  birthDate:'1990-05-30', address:'5, Shyam Villa, Piplod, Surat',                 pincode:'395007', vehicle:'GJ05DN4517', priorExpYears:2 },
      EMP005: { bloodGroup:'O+',  birthDate:'1988-09-14', address:'Plot 7, Ramnagar Society, Udhna, Surat',        pincode:'394210', vehicle:'GJ05EP8823', priorExpYears:3 },
      EMP006: { bloodGroup:'A+',  birthDate:'1993-02-19', address:'3, Shivam Flats, Pal, Surat',                   pincode:'395009', vehicle:'GJ05FR1245', priorExpYears:1 },
      EMP007: { bloodGroup:'B-',  birthDate:'1992-06-25', address:'Flat 12, Laxmi Residency, Limbayat, Surat',    pincode:'395006', vehicle:'GJ05GS3370', priorExpYears:2 },
      EMP008: { bloodGroup:'O+',  birthDate:'1995-12-03', address:'9, Anand Society, Althan, Surat',               pincode:'395017', vehicle:'',           priorExpYears:0 },
      EMP009: { bloodGroup:'AB+', birthDate:'1987-04-10', address:'18, Shakti Nagar, Amroli, Surat',               pincode:'394107', vehicle:'GJ05HS5581', priorExpYears:4 },
      EMP010: { bloodGroup:'A+',  birthDate:'1991-08-22', address:'27, Rajhans Residency, Bhestan, Surat',         pincode:'395023', vehicle:'GJ05JT6694', priorExpYears:3 },
      EMP011: { bloodGroup:'B+',  birthDate:'1994-01-17', address:'6, Sai Krupa Society, Vesu, Surat',             pincode:'395007', vehicle:'',           priorExpYears:0 },
      EMP012: { bloodGroup:'O-',  birthDate:'1989-10-05', address:'Plot 3, Shreenath Park, Sarthana, Surat',       pincode:'395006', vehicle:'GJ05KV7715', priorExpYears:4 },
      EMP013: { bloodGroup:'A+',  birthDate:'1993-07-29', address:'11, Ganesh Nagar, Kosad, Surat',                pincode:'394107', vehicle:'GJ05LW8826', priorExpYears:2 },
      EMP014: { bloodGroup:'A-',  birthDate:'1996-03-11', address:'Flat 4, Shivam Residency, Citylight, Surat',   pincode:'395007', vehicle:'',           priorExpYears:0 },
      EMP015: { bloodGroup:'B+',  birthDate:'1990-11-27', address:'32, Shubh Laxmi Society, Ring Road, Surat',    pincode:'395002', vehicle:'GJ05MX9931', priorExpYears:3 },
      EMP016: { bloodGroup:'O+',  birthDate:'1986-06-18', address:'8, Nav Durga Society, Pandesara, Surat',        pincode:'394221', vehicle:'GJ05NY1042', priorExpYears:6 },
      EMP017: { bloodGroup:'AB+', birthDate:'1996-09-04', address:'21, Swaminarayan Park, Dumas Road, Surat',      pincode:'395007', vehicle:'',           priorExpYears:0 },
      EMP018: { bloodGroup:'B-',  birthDate:'1988-02-14', address:'5, Vijay Nagar, Udhna, Surat',                  pincode:'394210', vehicle:'GJ05PZ2153', priorExpYears:3 },
      EMP019: { bloodGroup:'A+',  birthDate:'1984-12-20', address:'17, Param Society, Jahangirpura, Surat',        pincode:'395005', vehicle:'GJ05QA3264', priorExpYears:6 }
    };
    const patched = existingEmps4.map(e => profilePatch[e.id] ? { ...e, ...profilePatch[e.id] } : e);
    saveEmployees(patched);
    return;
  }

  // v3: add 10 more employees, extended attendance, 50 labours, messages, groups
  const existingEmps3 = getEmployees();
  if (existingEmps3.length > 0 && !existingEmps3.find(e => e.id === 'EMP010')) {
    const newEmps = [
      { id:'EMP010', name:'Suresh Yadav',     role:'EN', designation:'Site Engineer',        department:'Civil',    mobile:'9876501010', username:'suresh.yadav',     avatar:'SY', joinDate:'2024-02-10', active:true, status:'active' },
      { id:'EMP011', name:'Priya Nair',       role:'JE', designation:'Junior Engineer',      department:'Civil',    mobile:'9876501011', username:'priya.nair',       avatar:'PN', joinDate:'2024-03-01', active:true, status:'active' },
      { id:'EMP012', name:'Amit Verma',       role:'SV', designation:'Supervisor / Foreman', department:'Site Ops', mobile:'9876501012', username:'amit.verma',       avatar:'AV', joinDate:'2023-11-15', active:true, status:'active' },
      { id:'EMP013', name:'Rakesh Gupta',     role:'AS', designation:'Asst. Supervisor',     department:'Site Ops', mobile:'9876501013', username:'rakesh.gupta',     avatar:'RG', joinDate:'2024-01-20', active:true, status:'active' },
      { id:'EMP014', name:'Sneha Patil',      role:'TK', designation:'Timekeeper',           department:'Admin',    mobile:'9876501014', username:'sneha.patil',      avatar:'SP', joinDate:'2024-04-05', active:true, status:'active' },
      { id:'EMP015', name:'Vivek Kumar',      role:'EN', designation:'Site Engineer',        department:'Electrical',mobile:'9876501015',username:'vivek.kumar',      avatar:'VK', joinDate:'2023-12-01', active:true, status:'active' },
      { id:'EMP016', name:'Dinesh Bhai',      role:'SV', designation:'Supervisor / Foreman', department:'Site Ops', mobile:'9876501016', username:'dinesh.bhai',      avatar:'DB', joinDate:'2024-05-10', active:true, status:'active' },
      { id:'EMP017', name:'Kavita Sharma',    role:'JE', designation:'Junior Engineer',      department:'Civil',    mobile:'9876501017', username:'kavita.sharma',    avatar:'KS2',joinDate:'2025-01-15', active:true, status:'active' },
      { id:'EMP018', name:'Mohan Lal',        role:'AS', designation:'Asst. Supervisor',     department:'Site Ops', mobile:'9876501018', username:'mohan.lal',        avatar:'ML', joinDate:'2025-02-01', active:false,status:'resigned', resignedDate:'2026-01-30' },
      { id:'EMP019', name:'Tarun Mishra',     role:'SE', designation:'Senior Site Engineer', department:'Civil',    mobile:'9876501019', username:'tarun.mishra',     avatar:'TM', joinDate:'2023-07-01', active:true, status:'active' }
    ];
    const newUsers = [
      { username:'suresh.yadav',   password:'pass123', employee_id:'EMP010', role:'EN' },
      { username:'priya.nair',     password:'pass123', employee_id:'EMP011', role:'JE' },
      { username:'amit.verma',     password:'pass123', employee_id:'EMP012', role:'SV' },
      { username:'rakesh.gupta',   password:'pass123', employee_id:'EMP013', role:'AS' },
      { username:'sneha.patil',    password:'pass123', employee_id:'EMP014', role:'TK' },
      { username:'vivek.kumar',    password:'pass123', employee_id:'EMP015', role:'EN' },
      { username:'dinesh.bhai',    password:'pass123', employee_id:'EMP016', role:'SV' },
      { username:'kavita.sharma',  password:'pass123', employee_id:'EMP017', role:'JE' },
      { username:'mohan.lal',      password:'pass123', employee_id:'EMP018', role:'AS' },
      { username:'tarun.mishra',   password:'pass123', employee_id:'EMP019', role:'SE' }
    ];
    const allEmps = [...existingEmps3, ...newEmps];
    const allUsers = getUsers();
    newUsers.forEach(u => { if (!allUsers.find(x => x.username === u.username)) allUsers.push(u); });
    saveEmployees(allEmps);
    saveUsers(allUsers);

    // Extended attendance: 30 days for all employees
    const attSched30 = {
      EMP001:{ times:['08:00','18:30'], absent:[3,9,15,22,27] },
      EMP002:{ times:['08:15','18:00'], absent:[4,10,16,23] },
      EMP003:{ times:['08:30','17:30'], absent:[2,7,14,21,28] },
      EMP004:{ times:['08:30','17:30'], absent:[1,8,12,19,25] },
      EMP005:{ times:['08:00','17:00'], absent:[5,11,17,24] },
      EMP006:{ times:['08:30','17:00'], absent:[3,9,13,20,26] },
      EMP007:{ times:['09:00','17:00'], absent:[0,6,12,18,27] },
      EMP008:{ times:['09:00','16:30'], absent:[2,8,15,22] },
      EMP009:{ times:['09:30','17:00'], absent:[1,6,11,18,25] },
      EMP010:{ times:['08:30','17:30'], absent:[3,10,17,24] },
      EMP011:{ times:['09:00','17:30'], absent:[2,9,16,23] },
      EMP012:{ times:['08:00','17:00'], absent:[4,11,18,25] },
      EMP013:{ times:['08:30','17:00'], absent:[0,7,14,21,28] },
      EMP014:{ times:['09:00','16:30'], absent:[5,12,19,26] },
      EMP015:{ times:['08:30','18:00'], absent:[1,8,15,22,29] },
      EMP016:{ times:['07:45','17:00'], absent:[3,10,17,24] },
      EMP017:{ times:['09:00','17:30'], absent:[2,9,16] },
      EMP019:{ times:['08:00','18:00'], absent:[4,11,18,25] }
    };
    const existingAtt = getSupAtt();
    const newAttIds = new Set(existingAtt.map(a => a.employeeId+'_'+a.date));
    const newAtt = [];
    Object.entries(attSched30).forEach(([empId, sched]) => {
      for (let i=29; i>=0; i--) {
        if (sched.absent.includes(29-i)) continue;
        const d = dateOffset(i);
        if (isFuture(d)) continue;
        if (newAttIds.has(empId+'_'+d)) continue;
        const [inH, outH] = sched.times;
        const inMin  = Math.floor(Math.random()*10);
        const outMin = Math.floor(Math.random()*10);
        const inT  = inH.split(':')[0]+':'+String(+inH.split(':')[1]+inMin).padStart(2,'0');
        const outT = outH.split(':')[0]+':'+String(+outH.split(':')[1]+outMin).padStart(2,'0');
        newAtt.push({ id:empId+'_'+d, employeeId:empId, date:d, punches:[{inTime:inT,outTime:outT}] });
      }
    });
    saveSupAtt([...existingAtt, ...newAtt]);

    // 50 labour workers
    const skills = ['Mason','Helper','Bar Bender','Carpenter','Plumber','Electrician','Painter','Welder','Excavator Op','Crane Op'];
    const labourNames = [
      'Ramesh Kumar','Santosh Bind','Mukesh Yadav','Ganesh Patel','Ashok Singh','Bhola Prasad','Rajkumar Das','Sunil Mahato',
      'Dinesh Nishad','Raju Bind','Pappu Kumar','Bablu Paswan','Sonu Verma','Monu Shah','Chotu Sah','Lallan Patel',
      'Umesh Yadav','Naresh Singh','Deepak Kumar','Arun Mishra','Vijay Bind','Pramod Nishad','Dilip Chauhan','Kamal Patel',
      'Hemant Yadav','Vinod Kumar','Ajay Prasad','Sanjay Das','Manoj Singh','Ravi Sah','Shyam Patel','Kishan Bind',
      'Netram Yadav','Laxman Kumar','Jitendra Singh','Prakash Nishad','Mahesh Sah','Gopal Das','Biswanath Yadav','Hare Ram Bind',
      'Surendra Patel','Nirmal Kumar','Pawan Singh','Devendra Yadav','Santosh Chauhan','Babulal Mishra','Ramkumar Das','Govind Prasad',
      'Shankar Bind','Mohan Nishad'
    ];
    const labourMobiles = Array.from({length:50}, (_,i) => '98765'+(20001+i));
    const existingLabour = getLmsWorkers();
    if (existingLabour.length < 10) {
      const labours = labourNames.map((name, i) => ({
        id: String(2000001 + i),
        name,
        skill: skills[i % skills.length],
        mobile: labourMobiles[i],
        isCompanion: i > 0 && i % 8 === 0
      }));
      saveLmsWorkers(labours);

      // Labour attendance: last 20 days, ~40 workers per day
      const lmsAtt = [];
      const laborShifts = ['07:00','07:30','07:15','07:45','08:00'];
      const laborOuts   = ['17:00','17:30','18:00','16:30','17:15'];
      for (let d=19; d>=0; d--) {
        const date = dateOffset(d);
        const present = labours.filter((_,i) => (i + d) % 5 !== 0); // ~40/day
        present.forEach((lab, idx) => {
          const si = idx % laborShifts.length;
          const inMin  = Math.floor(Math.random()*15);
          const outMin = Math.floor(Math.random()*15);
          const [ih, im] = laborShifts[si].split(':').map(Number);
          const [oh, om] = laborOuts[si].split(':').map(Number);
          const inT  = String(ih).padStart(2,'0')+':'+String(im+inMin).padStart(2,'0');
          const outT = d === 0 ? null : String(oh).padStart(2,'0')+':'+String(om+outMin).padStart(2,'0');
          lmsAtt.push({ workerId:lab.id, date, inTime:inT, outTime:outT });
        });
      }
      saveLmsAtt(lmsAtt);
    }

    // Messages between employees (DMs)
    const convos = [
      { from:'EMP001', to:'EMP002', msgs:['Bhavesh, how is the progress on Zone 3?','Zone 3 formwork is 70% done. Should complete by tomorrow evening.','Great. Make sure the concrete pour is planned for day after.','Yes sir, I have already coordinated with Raghav Concrete.'] },
      { from:'EMP002', to:'EMP003', msgs:['Chirag, any update on the foundation survey?','Sir, survey is done for Block A. Starting Block B tomorrow.','Good. Share the report with Shah & Associates today.','Will send by 5 PM sir.'] },
      { from:'EMP003', to:'EMP004', msgs:['Dhaval, cube samples ready?','Yes, collected this morning. Will submit to lab by noon.','Good. Keep the receipt for records.','Done, receipt attached in site folder.'] },
      { from:'EMP001', to:'EMP009', msgs:['Meena, please update the joining date for Tarun Mishra.','Sure sir, I will update it today.','Also confirm Kavita Sharma new employee registration is done.','Both done sir. EMP017 and EMP019 are registered.'] },
      { from:'EMP005', to:'EMP007', msgs:['Nilesh, who is handling night shift tomorrow?','I will take first half, Rakesh will cover second.','Ok. Make sure gate log is maintained properly.','Yes sir, will ensure.'] },
      { from:'EMP006', to:'EMP019', msgs:['Tarun bhai, can you review the RCC drawings for Phase 2?','Yes I will look at them by today evening.','Thank you, there are some doubts on the beam layout.','Come to my cabin at 4 PM, we will go through together.'] },
      { from:'EMP008', to:'EMP014', msgs:['Sneha, timesheet for last week is still pending from your side.','Sorry, will submit in 30 minutes.','Please do it on priority, client audit is this Friday.','Done, submitted just now.'] },
      { from:'EMP010', to:'EMP012', msgs:['Amit, can you spare 2 workers for trench digging in Zone 1?','Yes, send them by 9 AM tomorrow.','Ok, I will send Ramesh and Santosh.','Fine, they can report to me directly.'] }
    ];
    const existingMsgs = getMessages();
    const msgsToAdd = [];
    convos.forEach(({from, to, msgs}) => {
      msgs.forEach((text, i) => {
        const sender = i % 2 === 0 ? from : to;
        const receiver = i % 2 === 0 ? to : from;
        const hoursAgo = (convos.length * msgs.length) - (msgsToAdd.length + i);
        const ts = new Date(Date.now() - hoursAgo * 3600000 - Math.random()*1800000).toISOString();
        msgsToAdd.push({ id:'MSG'+String(Date.now()+msgsToAdd.length+i).slice(-8), from:sender, to:receiver, text, timestamp:ts, read:true });
      });
    });
    saveMessages([...existingMsgs, ...msgsToAdd]);

    // Groups with messages
    const existingGroups = getGroups();
    if (!existingGroups.find(g => g.name === 'Site Management')) {
      const groups = [
        { id:'GRP001', name:'Site Management', members:['EMP001','EMP002','EMP003','EMP019','EMP009'], createdBy:'EMP001', createdAt:dateOffset(25)+'T09:00:00' },
        { id:'GRP002', name:'Civil Team',       members:['EMP003','EMP004','EMP006','EMP010','EMP011','EMP017','EMP019'], createdBy:'EMP003', createdAt:dateOffset(20)+'T10:00:00' },
        { id:'GRP003', name:'Site Ops',          members:['EMP005','EMP007','EMP012','EMP013','EMP016'], createdBy:'EMP005', createdAt:dateOffset(15)+'T08:00:00' },
        { id:'GRP004', name:'Admin & HR',        members:['EMP001','EMP008','EMP009','EMP014'], createdBy:'EMP009', createdAt:dateOffset(10)+'T09:30:00' }
      ];
      const groupMsgs = [
        { gid:'GRP001', from:'EMP001', text:'Good morning team. Weekly review is scheduled for Saturday 10 AM.' },
        { gid:'GRP001', from:'EMP002', text:'Noted sir. I will prepare the zone-wise progress update.' },
        { gid:'GRP001', from:'EMP003', text:'Block A survey report will be ready by Friday.' },
        { gid:'GRP001', from:'EMP019', text:'I will bring the Phase 2 drawing comments as well.' },
        { gid:'GRP001', from:'EMP009', text:'Attendance and HR documents will be ready sir.' },
        { gid:'GRP002', from:'EMP003', text:'Team, cube testing results are in. Mix design approved by lab.' },
        { gid:'GRP002', from:'EMP004', text:'Great news! So we can proceed with pour in Zone 3?' },
        { gid:'GRP002', from:'EMP019', text:'Yes, beam layout is also confirmed. Let us plan for Thursday.' },
        { gid:'GRP002', from:'EMP006', text:'I will coordinate with the RMC supplier for Thursday delivery.' },
        { gid:'GRP002', from:'EMP010', text:'I will ensure shuttering is done by Wednesday evening.' },
        { gid:'GRP002', from:'EMP011', text:'Bar bending for Zone 3 beams is 80% complete.' },
        { gid:'GRP003', from:'EMP005', text:'All supervisors please ensure labour attendance is marked by 8:15 AM sharp.' },
        { gid:'GRP003', from:'EMP012', text:'Understood. Will follow up with my team.' },
        { gid:'GRP003', from:'EMP007', text:'Night shift handover went smooth last night. All clear.' },
        { gid:'GRP003', from:'EMP013', text:'Zone 1 trench digging is on schedule.' },
        { gid:'GRP003', from:'EMP016', text:'Scaffolding on Block B is complete. Ready for next stage.' },
        { gid:'GRP004', from:'EMP009', text:'Reminder: All salary documents to be submitted by 25th.' },
        { gid:'GRP004', from:'EMP008', text:'Timesheets for the month are compiled. Will share by EOD.' },
        { gid:'GRP004', from:'EMP014', text:'New joinee documents for EMP017 are ready for HR records.' },
        { gid:'GRP004', from:'EMP001', text:'Good work team. Keep the documentation up to date.' }
      ];
      saveGroups([...existingGroups, ...groups]);
      const allMsgs = getMessages();
      groupMsgs.forEach((m, i) => {
        const hoursAgo = groupMsgs.length - i;
        const ts = new Date(Date.now() - hoursAgo * 3600000 - Math.random()*900000).toISOString();
        allMsgs.push({ id:'GMSG'+String(Date.now()+i).slice(-8), from:m.from, groupId:m.gid, text:m.text, timestamp:ts });
      });
      saveMessages(allMsgs);
    }
    return;
  }

  // v2: re-seed if HR employee (EMP009) doesn't exist yet
  const existingEmps = getEmployees();
  if (existingEmps.length > 0 && !existingEmps.find(e => e.id === 'EMP009')) {
    // Migration: add HR employee + user to existing data
    const emps  = existingEmps;
    const users = getUsers();
    emps.push({ id:'EMP009', name:'Meena Joshi', role:'HR', designation:'HR Manager', department:'Admin', mobile:'9876501009', username:'meena.joshi', avatar:'MJ', joinDate:'2023-09-01', active:true, status:'active', hrRoleEditApproved:false });
    saveEmployees(emps);
    if (!users.find(u => u.username === 'meena.joshi')) {
      users.push({ username:'meena.joshi', password:'pass123', employee_id:'EMP009', role:'HR' });
      saveUsers(users);
    }
    // Also ensure existing employees have status field
    emps.forEach(e => { if (!e.status) e.status = e.active ? 'active' : 'resigned'; });
    saveEmployees(emps);
    return;
  }
  if (DB.seeded) return;

  const employees = [
    { id:'EMP001', name:'Rajesh Patel',    role:'PM', designation:'Project Manager',      department:'Management', mobile:'9876501001', username:'rajesh.patel',    avatar:'RP', joinDate:'2022-04-01', active:true, status:'active' },
    { id:'EMP002', name:'Bhavesh Desai',   role:'SM', designation:'Site Manager',          department:'Management', mobile:'9876501002', username:'bhavesh.desai',   avatar:'BD', joinDate:'2022-06-15', active:true, status:'active' },
    { id:'EMP003', name:'Chirag Mehta',    role:'SE', designation:'Senior Site Engineer',  department:'Civil',      mobile:'9876501003', username:'chirag.mehta',    avatar:'CM', joinDate:'2023-01-10', active:true, status:'active' },
    { id:'EMP004', name:'Dhaval Shah',     role:'EN', designation:'Site Engineer',         department:'Civil',      mobile:'9876501004', username:'dhaval.shah',     avatar:'DS', joinDate:'2023-03-20', active:true, status:'active' },
    { id:'EMP005', name:'Hitesh Chauhan',  role:'SV', designation:'Supervisor / Foreman',  department:'Site Ops',   mobile:'9876501005', username:'hitesh.chauhan',  avatar:'HC', joinDate:'2023-05-01', active:true, status:'active' },
    { id:'EMP006', name:'Kalpesh Solanki', role:'JE', designation:'Junior Engineer',       department:'Civil',      mobile:'9876501006', username:'kalpesh.solanki', avatar:'KS', joinDate:'2023-08-15', active:true, status:'active' },
    { id:'EMP007', name:'Nilesh Rathod',   role:'AS', designation:'Asst. Supervisor',      department:'Site Ops',   mobile:'9876501007', username:'nilesh.rathod',   avatar:'NR', joinDate:'2023-10-01', active:true, status:'active' },
    { id:'EMP008', name:'Paresh Trivedi',  role:'TK', designation:'Timekeeper',            department:'Admin',      mobile:'9876501008', username:'paresh.trivedi',  avatar:'PT', joinDate:'2024-01-05', active:true, status:'active' },
    { id:'EMP009', name:'Meena Joshi',     role:'HR', designation:'HR Manager',             department:'Admin',      mobile:'9876501009', username:'meena.joshi',     avatar:'MJ', joinDate:'2023-09-01', active:true, status:'active', hrRoleEditApproved:false }
  ];

  const users = [
    { username:'rajesh.patel',    password:'admin123', employee_id:'EMP001', role:'PM' },
    { username:'bhavesh.desai',   password:'pass123',  employee_id:'EMP002', role:'SM' },
    { username:'chirag.mehta',    password:'pass123',  employee_id:'EMP003', role:'SE' },
    { username:'dhaval.shah',     password:'pass123',  employee_id:'EMP004', role:'EN' },
    { username:'hitesh.chauhan',  password:'pass123',  employee_id:'EMP005', role:'SV' },
    { username:'kalpesh.solanki', password:'pass123',  employee_id:'EMP006', role:'JE' },
    { username:'nilesh.rathod',   password:'pass123',  employee_id:'EMP007', role:'AS' },
    { username:'paresh.trivedi',  password:'pass123',  employee_id:'EMP008', role:'TK' },
    { username:'meena.joshi',     password:'pass123',  employee_id:'EMP009', role:'HR' }
  ];

  // Self-attendance: 14 days, each emp has 2-3 absences
  const attSched = {
    EMP001: { times:['08:00','18:30'], absent:[3,9] },
    EMP002: { times:['08:15','18:00'], absent:[4,10] },
    EMP003: { times:['08:30','17:30'], absent:[2,7] },
    EMP004: { times:['08:30','17:30'], absent:[1,8,12] },
    EMP005: { times:['08:00','17:00'], absent:[5,11] },
    EMP006: { times:['08:30','17:00'], absent:[3,9,13] },
    EMP007: { times:['09:00','17:00'], absent:[0,6] },
    EMP008: { times:['09:00','16:30'], absent:[2,8] },
    EMP009: { times:['09:30','17:00'], absent:[1,6,11] }
  };

  const attendance = [];
  Object.entries(attSched).forEach(([empId, sched]) => {
    for (let i=13; i>=0; i--) {
      if (sched.absent.includes(13-i)) continue;
      const d = dateOffset(i);
      if (isFuture(d)) continue;
      const [inH, outH] = sched.times;
      const inMin  = Math.floor(Math.random()*10);
      const outMin = Math.floor(Math.random()*10);
      const inT    = inH.split(':')[0]+':'+String(+inH.split(':')[1]+inMin).padStart(2,'0');
      const outT   = i===0 && empId==='EMP003' ? null : outH.split(':')[0]+':'+String(+outH.split(':')[1]+outMin).padStart(2,'0');
      attendance.push({ id:empId+'_'+d, employeeId:empId, date:d, punches:[{inTime:inT,outTime:outT}] });
    }
  });

  // Future availability: next 14 days
  const availSeed = [
    { empId:'EMP001', plans:{ 1:'on-site',2:'on-site',7:'leave',8:'leave',14:'field' }},
    { empId:'EMP002', plans:{ 1:'on-site',3:'field',6:'wfh',10:'on-site' }},
    { empId:'EMP003', plans:{ 1:'on-site',2:'on-site',4:'on-site',9:'leave' }},
    { empId:'EMP004', plans:{ 1:'on-site',5:'wfh',11:'leave' }},
    { empId:'EMP005', plans:{ 1:'on-site',3:'on-site',6:'leave',12:'on-site' }},
    { empId:'EMP006', plans:{ 2:'on-site',5:'on-site',8:'leave' }},
    { empId:'EMP007', plans:{ 1:'on-site',4:'field',9:'on-site' }},
    { empId:'EMP008', plans:{ 2:'on-site',6:'holiday',13:'on-site' }}
  ];

  const availability = [];
  availSeed.forEach(({empId, plans}) => {
    Object.entries(plans).forEach(([offset, status]) => {
      const d = dateFuture(+offset);
      availability.push({ id:empId+'_'+d, employeeId:empId, date:d, status });
    });
  });

  const tasks = [
    { id:'TASK001', title:'Complete foundation survey — Block A',      description:'Detailed topographic and soil survey for Block A foundation work.', priority:'high',   status:'in-progress', assignedTo:'EMP003', createdBy:'EMP001', createdAt:dateOffset(5)+'T09:00:00', dueDate:dateFuture(3),  completedAt:null },
    { id:'TASK002', title:'Submit weekly labour report to client',     description:'Weekly progress report including labour count and progress.',         priority:'medium', status:'open',        assignedTo:'EMP002', createdBy:'EMP001', createdAt:dateOffset(3)+'T10:00:00', dueDate:dateFuture(2),  completedAt:null },
    { id:'TASK003', title:'Inspection of formwork — Zone 3',           description:'Check formwork alignment before concrete pour.',                     priority:'high',   status:'completed',   assignedTo:'EMP004', createdBy:'EMP003', createdAt:dateOffset(8)+'T08:30:00', dueDate:dateOffset(2),  completedAt:dateOffset(2)+'T16:00:00' },
    { id:'TASK004', title:'Coordinate water tanker schedule',          description:'Ensure water availability for curing of Zone 2 slabs.',              priority:'low',    status:'open',        assignedTo:'EMP005', createdBy:'EMP002', createdAt:dateOffset(4)+'T11:00:00', dueDate:dateFuture(5),  completedAt:null },
    { id:'TASK005', title:'Review RCC drawings — Phase 2',             description:'Review and approve structural drawings from consultant.',             priority:'medium', status:'in-progress', assignedTo:'EMP003', createdBy:'EMP001', createdAt:dateOffset(6)+'T09:00:00', dueDate:dateFuture(4),  completedAt:null },
    { id:'TASK006', title:'Update timesheet entries for this month',   description:'Ensure all daily timesheets are updated and submitted.',              priority:'medium', status:'open',        assignedTo:'EMP008', createdBy:'EMP002', createdAt:dateOffset(2)+'T14:00:00', dueDate:dateFuture(1),  completedAt:null },
    { id:'TASK007', title:'Safety briefing for new labourers',         description:'Conduct mandatory safety induction for 5 new workers.',              priority:'high',   status:'open',        assignedTo:'EMP005', createdBy:'EMP002', createdAt:dateOffset(1)+'T08:00:00', dueDate:today(),         completedAt:null },
    { id:'TASK008', title:'Concrete cube testing — lab submission',    description:'Collect and submit concrete cube samples to testing lab.',            priority:'medium', status:'on-hold',     assignedTo:'EMP004', createdBy:'EMP003', createdAt:dateOffset(7)+'T10:00:00', dueDate:dateFuture(2),  completedAt:null },
    { id:'TASK009', title:'Prepare site progress report — March',      description:'Monthly progress report with photos and quantity details.',          priority:'high',   status:'in-progress', assignedTo:'EMP006', createdBy:'EMP003', createdAt:dateOffset(3)+'T09:00:00', dueDate:dateFuture(6),  completedAt:null },
    { id:'TASK010', title:'Equipment maintenance check — concrete mixer',description:'Monthly PM check on all concrete mixers and vibrators.',           priority:'low',    status:'completed',   assignedTo:'EMP007', createdBy:'EMP005', createdAt:dateOffset(9)+'T08:00:00', dueDate:dateOffset(3),  completedAt:dateOffset(3)+'T15:30:00' }
  ];

  const notes = [
    { id:'NOTE001', aboutEmployeeId:'EMP003', byEmployeeId:'EMP001', text:'Foundation survey completed ahead of schedule. Excellent coordination with the consultant team.', category:'performance', createdAt:dateOffset(5)+'T17:00:00' },
    { id:'NOTE002', aboutEmployeeId:'EMP004', byEmployeeId:'EMP003', text:'Concrete cube submission missed once this month. Reminded and corrected. Should be monitored.', category:'incident',    createdAt:dateOffset(3)+'T16:30:00' },
    { id:'NOTE003', aboutEmployeeId:'EMP005', byEmployeeId:'EMP002', text:'Reliable supervisor. Labour management is strong. Workers respect him on site.', category:'performance', createdAt:dateOffset(7)+'T18:00:00' },
    { id:'NOTE004', aboutEmployeeId:'EMP006', byEmployeeId:'EMP003', text:'Good learning attitude. Needs to build confidence in client-facing communication.', category:'general',     createdAt:dateOffset(4)+'T17:30:00' },
    { id:'NOTE005', aboutEmployeeId:'EMP008', byEmployeeId:'EMP002', text:'Timesheets submitted late twice this month. Verbal reminder given on 2nd instance.', category:'incident',    createdAt:dateOffset(2)+'T10:00:00' },
    { id:'NOTE006', aboutEmployeeId:'EMP007', byEmployeeId:'EMP005', text:'Assisted well during overtime shift for formwork. Positive attitude.',                 category:'general',     createdAt:dateOffset(6)+'T19:00:00' }
  ];

  const contacts = [
    { id:'CON001', name:'Fire Station — Surat South',       category:'emergency', phone:'02612413000', description:'Nearest fire station to project site',            addedBy:'EMP001', addedAt:dateOffset(30)+'T10:00:00' },
    { id:'CON002', name:'Ambulance / SMIMER Hospital',       category:'emergency', phone:'108',         description:'Emergency ambulance & nearest govt hospital',     addedBy:'EMP001', addedAt:dateOffset(30)+'T10:00:00' },
    { id:'CON003', name:'Police Control Room',               category:'emergency', phone:'100',         description:'Surat city police control',                       addedBy:'EMP001', addedAt:dateOffset(30)+'T10:00:00' },
    { id:'CON004', name:'Raghav Concrete & Aggregates',      category:'vendor',    phone:'9824501234', description:'RMC supplier — ready-mix concrete deliveries',     addedBy:'EMP002', addedAt:dateOffset(20)+'T09:00:00' },
    { id:'CON005', name:'Mehta Steel Traders',               category:'vendor',    phone:'9824509876', description:'TMT bars and structural steel supplier',           addedBy:'EMP002', addedAt:dateOffset(20)+'T09:00:00' },
    { id:'CON006', name:'Surat Municipal Corporation (SMC)', category:'client',    phone:'02612420501', description:'Client PMC contact — road project nodal officer', addedBy:'EMP001', addedAt:dateOffset(25)+'T11:00:00' },
    { id:'CON007', name:'Shah & Associates (Consultant)',    category:'client',    phone:'9898201234', description:'Structural consultant — drawing approvals',        addedBy:'EMP001', addedAt:dateOffset(25)+'T11:00:00' },
    { id:'CON008', name:'Jay Electricals (Subcontractor)',   category:'agency',    phone:'9726501111', description:'Electrical & street lighting subcontractor',       addedBy:'EMP003', addedAt:dateOffset(15)+'T10:00:00' },
    { id:'CON009', name:'Patel Infrastructure Head Office',  category:'office',    phone:'02612500100', description:'Ahmedabad HO — HR and accounts contact',          addedBy:'EMP001', addedAt:dateOffset(30)+'T10:00:00' },
    { id:'CON010', name:'Site Security Guard (Night)',       category:'other',     phone:'9099801234', description:'Night shift security — call for site access after hours', addedBy:'EMP002', addedAt:dateOffset(10)+'T08:00:00' }
  ];

  await saveEmployees(employees);
  await saveUsers(users);
  await saveSupAtt(attendance);
  await saveAvailList(availability);
  await saveTasks(tasks);
  await saveNotes(notes);
  await saveContacts(contacts);
  DB.seeded = true;
  await supabaseClient.from('meta').upsert([{ key: 'config', seeded: true }], { onConflict: 'key' });
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════
function renderAdminDashboard() {
  const sess = getSession();
  if (sess && sess.role === 'SU') {
    renderSuperadminDashboard();
  } else {
    renderCompanyAdminDashboard();
  }
}

function renderSuperadminDashboard() {
  const companies = DB.companies || [];
  
  document.getElementById('admin-stat-users').textContent = companies.length;
  document.getElementById('admin-stat-users').nextElementSibling.textContent = 'Total Companies';
  
  document.getElementById('admin-stat-att').parentElement.style.display = 'none';
  document.getElementById('admin-stat-tasks').parentElement.style.display = 'none';
  
  document.getElementById('admin-pulse').textContent = 'Superadmin Control Center';

  const list = document.getElementById('admin-user-list');
  list.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px 0">
      <h2 style="margin:0">Companies</h2>
      <button class="btn-sm btn-primary" onclick="openCreateCompany()">+ New Company</button>
    </div>
  `;

  companies.forEach(c => {
    const div = document.createElement('div');
    div.className = 'emp-card';
    div.innerHTML = `
      <div class="emp-avatar" style="background:#1D5FA8">🏢</div>
      <div class="dir-info" style="flex:1">
        <div class="emp-name">${c.name}</div>
        <div class="emp-detail">ID: ${c.id}</div>
      </div>
      <div class="emp-actions">
        <button class="btn-sm btn-accent" onclick="manageCompany('${c.id}')">Manage Admins</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function renderCompanyAdminDashboard() {
  const users = getUsers();
  const emps  = getEmployees();
  const att   = getSupAtt().filter(a => a.date === today());
  const tasks = getTasks().filter(t => t.status !== 'completed');

  document.getElementById('admin-stat-users').textContent = users.length;
  document.getElementById('admin-stat-users').nextElementSibling.textContent = 'Total Users';
  document.getElementById('admin-stat-att').parentElement.style.display = 'flex';
  document.getElementById('admin-stat-att').textContent   = att.length;
  document.getElementById('admin-stat-tasks').parentElement.style.display = 'flex';
  document.getElementById('admin-stat-tasks').textContent = tasks.length;
  document.getElementById('admin-pulse').textContent     = 'Company Admin Control';

  const list = document.getElementById('admin-user-list');
  list.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px 0">
      <h2 style="margin:0">User Management</h2>
      <button class="btn-sm btn-primary" onclick="openCreateUser()">+ New User</button>
    </div>
    <div id="company-user-list"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 14px 0">
      <h2 style="margin:0">Site Management</h2>
      <button class="btn-sm btn-primary" onclick="openCreateSite()">+ New Site</button>
    </div>
    <div id="company-site-list"></div>
  `;
  
  const clist = document.getElementById('company-user-list');

  users.sort((a,b) => a.username.localeCompare(b.username)).forEach(u => {
    const emp = emps.find(e => e.id === u.employee_id || e.id === u.employeeId);
    if (!emp) return;

    const div = document.createElement('div');
    div.className = 'emp-card';
    div.innerHTML = `
      <div class="emp-avatar" style="background:${avatarColor(u.role)}">${emp.avatar}</div>
      <div class="dir-info" style="flex:1">
        <div class="emp-name">${emp.name} <span style="font-size:11px;color:#94A3B8;font-weight:normal">(@${u.username})</span></div>
        <div class="emp-detail">${ROLES[u.role]?.label || u.role} • ${emp.id}</div>
      </div>
      <div class="emp-actions">
        <select class="btn-sm" style="width:auto;padding:2px 8px;margin:0" onchange="adminChangeRole('${emp.id}', this.value)">
          ${Object.keys(ROLES).map(r => `<option value="${r}" ${r===u.role?'selected':''}>${r}</option>`).join('')}
        </select>
        <button class="icon-btn ib-view" onclick="openEmpProfile('${emp.id}')" title="View Profile">👤</button>
      </div>
    `;
    clist.appendChild(div);
  });

  const slist = document.getElementById('company-site-list');
  const sites = DB.sites || [];
  if (sites.length === 0) {
    slist.innerHTML = '<div style="color:#64748b">No sites created yet.</div>';
  } else {
    sites.forEach(s => {
      const div = document.createElement('div');
      div.className = 'emp-card';
      div.innerHTML = `
        <div class="emp-avatar" style="background:#0F766E">🏗️</div>
        <div class="dir-info" style="flex:1">
          <div class="emp-name">${s.name}</div>
          <div class="emp-detail">ID: ${s.id}</div>
        </div>
        <div class="emp-actions">
          <button class="btn-sm btn-accent" onclick="manageSite('${s.id}')">Manage Workers</button>
        </div>
      `;
      slist.appendChild(div);
    });
  }
}

function openCreateCompany() {
  document.getElementById('cc-name').value = '';
  openModal('modal-create-company');
}

async function doCreateCompany() {
  const name = document.getElementById('cc-name').value.trim();
  if (!name) return;
  const newComp = { name };
  const { data, error } = await supabaseClient.from('companies').insert([newComp]).select().single();
  if (!error && data) {
    DB.companies.push(data);
    closeModal('modal-create-company');
    renderSuperadminDashboard();
    showToast('Company created successfully', 'success');
  } else {
    showToast('Error creating company', 'error');
  }
}

async function manageCompany(compId) {
  const comp = DB.companies.find(c => c.id === compId);
  if (!comp) return;
  document.getElementById('mc-company-id').value = compId;
  document.getElementById('mc-admin-name').value = '';
  document.getElementById('mc-admin-user').value = '';
  document.getElementById('mc-admin-pass').value = '';

  const { data: users, error } = await supabaseClient.from('users').select('*').eq('role', 'PM');
  const { data: emps } = await supabaseClient.from('employees').select('*').eq('company_id', compId).eq('role', 'PM');
  
  const content = document.getElementById('mc-content');
  if (emps && emps.length > 0) {
    content.innerHTML = emps.map(e => {
      const u = (users || []).find(usr => usr.employee_id === e.id);
      return `<div style="padding:8px;background:#f8fafc;margin-bottom:4px;border-radius:4px;">
        <strong>${e.name}</strong> <span style="color:#64748b">(@${u ? u.username : 'N/A'})</span>
      </div>`;
    }).join('');
  } else {
    content.innerHTML = '<div style="color:#64748b">No admins found for this company.</div>';
  }

  openModal('modal-manage-company');
}

async function doAddCompanyAdmin() {
  const compId = document.getElementById('mc-company-id').value;
  const name = document.getElementById('mc-admin-name').value.trim();
  const username = document.getElementById('mc-admin-user').value.trim().toLowerCase();
  const password = document.getElementById('mc-admin-pass').value;

  if (!name || !username || !password) return;

  const empId = 'EMP' + Date.now().toString().slice(-6);

  const newEmp = { id: empId, name, role: 'PM', designation: 'Company Admin', active: true, company_id: compId };
  const newUser = { employee_id: empId, username, password, role: 'PM', company_id: compId };

  await supabaseClient.from('employees').insert([newEmp]);
  await supabaseClient.from('users').insert([newUser]);
  
  closeModal('modal-manage-company');
  showToast('Admin added successfully', 'success');
}

function openCreateSite() {
  document.getElementById('cs-name').value = '';
  openModal('modal-create-site');
}

async function doCreateSite() {
  const name = document.getElementById('cs-name').value.trim();
  if (!name) return;
  const sess = getSession();
  const newSite = { name, company_id: sess.companyId };
  const { data, error } = await supabaseClient.from('sites').insert([newSite]).select().single();
  if (!error && data) {
    DB.sites.push(data);
    closeModal('modal-create-site');
    renderCompanyAdminDashboard();
    showToast('Site created successfully', 'success');
  } else {
    showToast('Error creating site', 'error');
  }
}

let currentManageSiteId = null;

function manageSite(siteId) {
  currentManageSiteId = siteId;
  const site = DB.sites.find(s => s.id === siteId);
  if (!site) return;
  
  document.getElementById('manage-site-title').textContent = `Manage: ${site.name}`;
  
  const siteEmpIds = (DB.employee_sites || []).filter(es => es.site_id === siteId).map(es => es.employee_id);
  const listEl = document.getElementById('site-employee-list');
  
  // Show all employees in the company
  const allEmps = DB.employees || [];
  if (allEmps.length === 0) {
    listEl.innerHTML = '<div style="color:#aaa;">No employees found in company.</div>';
  } else {
    listEl.innerHTML = allEmps.map(e => `
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer;">
        <input type="checkbox" class="site-emp-cb" value="${e.id}" ${siteEmpIds.includes(e.id) ? 'checked' : ''}>
        <span>${e.name} (${e.role})</span>
      </label>
    `).join('');
  }
  
  openModal('modal-manage-site');
}

async function saveSiteEmployees() {
  if (!currentManageSiteId) return;
  const cbs = document.querySelectorAll('.site-emp-cb');
  const selectedIds = Array.from(cbs).filter(cb => cb.checked).map(cb => cb.value);
  
  try {
    // Delete existing links for this site
    await sbDel('employee_sites', { site_id: currentManageSiteId });
    DB.employee_sites = DB.employee_sites.filter(es => es.site_id !== currentManageSiteId);
    
    // Insert new links
    if (selectedIds.length > 0) {
      const newLinks = selectedIds.map(empId => ({
        site_id: currentManageSiteId,
        employee_id: empId
      }));
      await sbUpsert('employee_sites', newLinks);
      DB.employee_sites.push(...newLinks);
    }
    showToast('Site assignments saved', 'success');
    closeModal('modal-manage-site');
  } catch(err) {
    showToast('Failed to save assignments', 'error');
  }
}

// ══════════════════════════════════════════════════════════
// CREATE USER (Admin / Superadmin)
// ══════════════════════════════════════════════════════════
function openCreateUser() {
  const sess = getSession();
  document.getElementById('cu-name').value     = '';
  document.getElementById('cu-username').value = '';
  document.getElementById('cu-pass').value     = '';
  document.getElementById('cu-dept').value     = '';
  document.getElementById('cu-mobile').value   = '';
  document.getElementById('cu-role').value     = 'EN';
  document.getElementById('cu-error').textContent = '';

  const compRow = document.getElementById('cu-company-row');
  const compSel = document.getElementById('cu-company-sel');
  if (compRow && compSel) {
    if (sess?.role === 'SU') {
      compRow.style.display = 'block';
      compSel.innerHTML = (DB.companies || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
      compRow.style.display = 'none';
    }
  }
  openModal('modal-create-user');
}

async function doCreateUser() {
  const sess     = getSession();
  const name     = document.getElementById('cu-name').value.trim();
  const username = document.getElementById('cu-username').value.trim().toLowerCase();
  const pass     = document.getElementById('cu-pass').value;
  const role     = document.getElementById('cu-role').value;
  const dept     = document.getElementById('cu-dept').value.trim();
  const mobile   = document.getElementById('cu-mobile').value.trim();
  const errEl    = document.getElementById('cu-error');

  if (!name || !username || !pass) { errEl.textContent = 'Name, username and password are required'; return; }
  errEl.textContent = 'Creating…';

  // Check username uniqueness
  const { data: existU } = await supabaseClient.from('users').select('id').eq('username', username).limit(1);
  if (existU?.length > 0) { errEl.textContent = 'Username already taken — choose another'; return; }

  // Determine company
  let companyId = sess?.companyId || null;
  if (sess?.role === 'SU') {
    companyId = document.getElementById('cu-company-sel')?.value || null;
  }

  // Generate next employee ID for this company
  const { data: existing } = await supabaseClient.from('employees').select('id').eq('company_id', companyId);
  const nums  = (existing || []).map(e => parseInt((e.id || '').replace(/\D/g, ''))).filter(n => !isNaN(n) && n > 0);
  const next  = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const empId = 'EMP' + String(next).padStart(3, '0');

  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';

  const newEmp = {
    id: empId, name, role,
    designation: ROLES[role]?.label || role,
    department:  dept || 'General',
    mobile:      mobile || '',
    username,
    avatar:      initials,
    joinDate:    today(),
    active:      true,
    status:      'active',
    company_id:  companyId
  };
  const newUser = { username, password: pass, role, employee_id: empId, company_id: companyId };

  const { error: e1 } = await supabaseClient.from('employees').insert([newEmp]);
  if (e1) { errEl.textContent = 'Error: ' + e1.message; return; }
  const { error: e2 } = await supabaseClient.from('users').insert([newUser]);
  if (e2) { errEl.textContent = 'Error: ' + e2.message; return; }

  DB.employees.push(newEmp);
  DB.users.push(newUser);

  closeModal('modal-create-user');
  showToast(`✓ ${name} created — login: ${username} / ${pass}`, 'success');
  renderAdminDashboard();
}

async function adminChangeRole(empId, newRole) {
  const users = getUsers();
  const u = users.find(x => x.employeeId === empId || x.employee_id === empId);
  if (!u) return;

  const emps = getEmployees();
  const emp = emps.find(e => e.id === empId);

  u.role = newRole;
  if (emp) {
    emp.role = newRole;
    emp.designation = ROLES[newRole]?.label || newRole;
  }

  await sbUpsert('users', [u]);
  if (emp) await sbUpsert('employees', [emp]);

  showToast('Role updated to ' + newRole, 'success');
  renderAdminDashboard();
}

(async () => {
  console.log('App initialization starting...');
  setTimeout(() => {
    const loader = document.getElementById('fb-loading');
    if (loader && loader.style.display !== 'none') {
      console.warn('Initialization taking too long, forcing UI display...');
      loader.style.display = 'none';
      if (!getSession()) document.getElementById('login-screen').style.display = 'flex';
    }
  }, 10000);

  console.log('Initializing Auth...');
  await initAuth();

  const loader = document.getElementById('fb-loading');
  if (loader) loader.style.display = 'none';

  console.log('Starting Listeners...');
  startSupabaseListeners();
  console.log('App Ready.');
})();

