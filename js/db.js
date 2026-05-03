// db.js - Data fetching and synchronization

async function loadAllFromSupabase(companyId, role) {
  console.log('Fetching data for company:', companyId);
  try {
    const tables = [
      'employees', 'users', 'attendance', 'availability', 'tasks', 'notes',
      'messages', 'contacts', 'groups', 'lms_workers', 'lms_attendance',
      'pad', 'punch_requests', 'sites', 'companies', 'announcements', 'employee_sites'
    ];

    const results = await Promise.all(tables.map(table => {
      let query = supabaseClient.from(table).select('*');
      // SU role sees everything, others filtered by company_id
      if (role !== 'SU' && table !== 'companies' && table !== 'employee_sites') {
        if (companyId) query = query.eq('company_id', companyId);
      }
      return query;
    }));

    DB.employees      = results[0].data || [];
    DB.users          = results[1].data || [];
    DB.attendance     = results[2].data || [];
    DB.availability   = results[3].data || [];
    DB.tasks          = results[4].data || [];
    DB.notes          = results[5].data || [];
    DB.messages       = results[6].data || [];
    DB.contacts       = results[7].data || [];
    DB.groups         = results[8].data || [];
    DB.lmsWorkers     = results[9].data || [];
    DB.lmsAtt         = results[10].data || [];
    const padDocs     = results[11].data || [];
    DB.punchRequests  = results[12].data || [];
    DB.sites          = results[13].data || [];
    DB.companies      = results[14].data || [];
    DB.announcements  = results[15].data || [];
    DB.employee_sites = results[16].data || [];

    DB.pad = {};
    padDocs.forEach(item => { 
      if (!DB.pad[item.userId]) DB.pad[item.userId] = []; 
      DB.pad[item.userId].push(item); 
    });

    console.log('DB Cache initialized.');
  } catch (err) {
    console.error('Critical failure in loadAllFromSupabase:', err);
    throw err;
  }
}

function startSupabaseListeners() {
  // Messages listener
  supabaseClient.channel('messages-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
      if (payload.eventType === 'INSERT') DB.messages.push(payload.new);
      if (payload.eventType === 'UPDATE') { 
        const idx = DB.messages.findIndex(m => m.id === payload.new.id); 
        if (idx > -1) DB.messages[idx] = payload.new; 
      }
      if (payload.eventType === 'DELETE') { 
        DB.messages = DB.messages.filter(m => m.id === payload.old.id); 
      }
      if (typeof updateMsgBadge === 'function') updateMsgBadge();
      if (typeof renderConvList === 'function') renderConvList();
    })
    .subscribe();

  // Tasks listener
  supabaseClient.channel('tasks-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
      if (payload.eventType === 'DELETE') {
        DB.tasks = DB.tasks.filter(t => t.id !== payload.old.id);
      } else {
        const updated = payload.new;
        const idx = DB.tasks.findIndex(t => t.id === updated.id);
        if (idx > -1) DB.tasks[idx] = updated; else DB.tasks.push(updated);
      }
      if (typeof renderTasks === 'function') renderTasks();
    })
    .subscribe();

  // Attendance listener
  supabaseClient.channel('att-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, payload => {
      const updated = payload.new;
      const idx = DB.attendance.findIndex(a => a.id === updated.id);
      if (idx > -1) DB.attendance[idx] = updated; else DB.attendance.push(updated);
      if (typeof renderPlanner === 'function') renderPlanner();
      if (typeof renderAttendanceHistory === 'function') renderAttendanceHistory();
    })
    .subscribe();

  // Notes listener
  supabaseClient.channel('notes-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, payload => {
      const updated = payload.new;
      const idx = DB.notes.findIndex(n => n.id === updated.id);
      if (idx > -1) DB.notes[idx] = updated; else DB.notes.push(updated);
      if (typeof renderEmployeeProfile === 'function' && currentProfileEmpId) renderEmployeeProfile(currentProfileEmpId);
    })
    .subscribe();
    
  // Contacts listener
  supabaseClient.channel('contacts-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, payload => {
      if (payload.eventType === 'DELETE') {
        DB.contacts = DB.contacts.filter(c => c.id !== payload.old.id);
      } else {
        const updated = payload.new;
        const idx = DB.contacts.findIndex(c => c.id === updated.id);
        if (idx > -1) DB.contacts[idx] = updated; else DB.contacts.push(updated);
      }
      if (typeof renderContactsList === 'function') renderContactsList();
    })
    .subscribe();
}
