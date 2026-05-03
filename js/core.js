// core.js - Shared configuration, constants and Supabase client
const SUPABASE_URL = "https://yzevducedcvxvugozmbu.supabase.co";
const SUPABASE_KEY = "sb_publishable_sFuIGiOOco0RjlCVGG5C6Q_2VDCou5C";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory cache (Supabase data loaded here on startup)
const DB = {
  employees:[], users:[], attendance:[], availability:[],
  tasks:[], notes:[], messages:[], contacts:[], groups:[],
  lmsWorkers:[], lmsAtt:[], pad:{}, punchRequests:[], sites:[], companies:[], announcements:[], employee_sites:[], seeded:false
};

// ══════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════
const ROLES = {
  SU: { label:'Super Admin',         level:0, color: '#ff4d4d' },
  PM: { label:'Project Manager',     level:1, color: '#007bff' },
  SM: { label:'Site Manager',        level:2, color: '#0F766E' },
  HR: { label:'HR Manager',          level:3, color: '#28a745' },
  SE: { label:'Senior Site Engineer',level:4, color: '#6366f1' },
  EN: { label:'Site Engineer',       level:5, color: '#8b5cf6' },
  SV: { label:'Supervisor/Foreman',  level:6, color: '#fd7e14' },
  JE: { label:'Junior Engineer',     level:7, color: '#ec4899' },
  AS: { label:'Asst. Supervisor',    level:8, color: '#f59e0b' },
  TK: { label:'Timekeeper',          level:9, color: '#6c757d' }
};

const ALL_ROLES = ['SU','PM','SM','HR','SE','EN','SV','JE','AS','TK'];
const TAB_ACCESS = {
  dashboard: ALL_ROLES,
  work:      ['PM','SM','HR','SE','EN','SV','JE','AS'],
  messages:  ALL_ROLES,
  people:    ALL_ROLES,
  admin:     ['SU'],
  more:      ALL_ROLES,
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

const CAT_LABELS = { emergency:'Emergency', agency:'Agency', vendor:'Vendor', client:'Client', office:'Office', other:'Other' };
const CAT_ICONS  = { emergency:'🚨', agency:'🏢', vendor:'🛒', client:'🤝', office:'🏬', other:'📋' };
const CAT_COLORS = { emergency:'#DC2626', agency:'#2563EB', vendor:'#16A34A', client:'#D97706', office:'#7C3AED', other:'#64748B' };

// ══════════════════════════════════════════════════════════
// SESSION & STORAGE HELPERS
// ══════════════════════════════════════════════════════════
function getSession() {
  const s = sessionStorage.getItem('sup_session');
  return s ? JSON.parse(s) : null;
}

function getActiveSiteId() {
  return getSession()?.activeSiteId || null;
}

function getCurrentEmp() {
  const s = getSession();
  if (!s || !s.employeeId) return null;
  return DB.employees.find(e => e.id === s.employeeId);
}

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
const getGroups     = () => filterBySite(DB.groups);

// Low-level Supabase helpers
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
    if (typeof showToast === 'function') showToast('Save failed: ' + error.message, 'error');
    throw error;
  }
}

async function sbDel(table, conditions) {
  const { error } = await supabaseClient.from(table).delete().match(conditions);
  if (error) {
    console.error('sbDel failed:', table, error);
    if (typeof showToast === 'function') showToast('Delete failed: ' + error.message, 'error');
    throw error;
  }
}
