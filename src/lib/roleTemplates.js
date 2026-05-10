// Standard Construction Site Role Templates
// Company admins can load these as a starting point and customize

export const ROLE_TEMPLATES = [
  {
    name: 'Project Manager',
    level: 1,
    color: '#7C3AED',
    description: 'Overall project responsibility, client & contractor coordination',
    permissions: {
      attendance:    { view: true,  edit: true  },
      tasks:         { view: true,  create: true,  assign: true  },
      reports:       { view: true                                  },
      announcements: { view: true,  create: true                  },
      employees:     { view: true,  edit: true                    },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: true                    },
    }
  },
  {
    name: 'Construction Manager',
    level: 2,
    color: '#1D4ED8',
    description: 'Full site execution, civil/MEP/finishing coordination',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: true,  assign: true  },
      reports:       { view: true                                  },
      announcements: { view: true,  create: true                  },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Site Engineer',
    level: 3,
    color: '#0891B2',
    description: 'Daily site execution, drawings, quality, progress updates',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: true,  assign: true  },
      reports:       { view: true                                  },
      announcements: { view: true,  create: true                  },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Site Manager',
    level: 2,
    color: '#0E7490',
    description: 'Manages overall site operations, team leadership',
    permissions: {
      attendance:    { view: true,  edit: true  },
      tasks:         { view: true,  create: true,  assign: true  },
      reports:       { view: true                                  },
      announcements: { view: true,  create: true                  },
      employees:     { view: true,  edit: true                    },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Planning Engineer',
    level: 3,
    color: '#059669',
    description: 'Project schedule, planned vs actual, progress reports',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Billing / QS Engineer',
    level: 4,
    color: '#B45309',
    description: 'BOQ, quantity calculation, contractor billing, RA bills',
    permissions: {
      attendance:    { view: false, edit: false },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'QA/QC Engineer',
    level: 4,
    color: '#DC2626',
    description: 'Quality checks, NCR, inspections, work approval',
    permissions: {
      attendance:    { view: false, edit: false },
      tasks:         { view: true,  create: true,  assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Safety Officer',
    level: 4,
    color: '#EA580C',
    description: 'Site safety, PPE compliance, toolbox talks, incidents',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: true,  assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: true                  },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Store / Material Incharge',
    level: 5,
    color: '#7C3AED',
    description: 'Material inward/outward, stock register, material requests',
    permissions: {
      attendance:    { view: false, edit: false },
      tasks:         { view: true,  create: true,  assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: true,  edit: false                   },
    }
  },
  {
    name: 'Supervisor',
    level: 5,
    color: '#2563EB',
    description: 'Controls daily site work for assigned area/trade',
    permissions: {
      attendance:    { view: true,  edit: true  },
      tasks:         { view: true,  create: true,  assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: false, edit: false                   },
    }
  },
  {
    name: 'Foreman',
    level: 6,
    color: '#0369A1',
    description: 'Leads labour gang for one trade, reports to supervisor',
    permissions: {
      attendance:    { view: true,  edit: true  },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: false                                 },
      announcements: { view: true,  create: false                 },
      employees:     { view: false, edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: false, edit: false                   },
    }
  },
  {
    name: 'Chargehand / Gang Leader',
    level: 7,
    color: '#047857',
    description: 'Small team leader, 5–15 workers, reports to foreman',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: false                                 },
      announcements: { view: true,  create: false                 },
      employees:     { view: false, edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: false, edit: false                   },
    }
  },
  {
    name: 'Worker / Labour',
    level: 8,
    color: '#64748B',
    description: 'Performs actual site work — mason, carpenter, electrician, etc.',
    permissions: {
      attendance:    { view: true,  edit: false },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: false                                 },
      announcements: { view: true,  create: false                 },
      employees:     { view: false, edit: false                   },
      notebook:      { view: false, create: false                 },
      sites:         { view: false, edit: false                   },
    }
  },
  {
    name: 'Security Guard',
    level: 7,
    color: '#92400E',
    description: 'Gate entry, visitor/vehicle/material records, worker entry',
    permissions: {
      attendance:    { view: true,  edit: true  },
      tasks:         { view: false, create: false, assign: false },
      reports:       { view: false                                 },
      announcements: { view: true,  create: false                 },
      employees:     { view: true,  edit: false                   },
      notebook:      { view: true,  create: true                  },
      sites:         { view: false, edit: false                   },
    }
  },
  {
    name: 'Client / Consultant Viewer',
    level: 9,
    color: '#475569',
    description: 'Read-only access — view progress, photos, and reports',
    permissions: {
      attendance:    { view: false, edit: false },
      tasks:         { view: true,  create: false, assign: false },
      reports:       { view: true                                  },
      announcements: { view: true,  create: false                 },
      employees:     { view: false, edit: false                   },
      notebook:      { view: false, create: false                 },
      sites:         { view: true,  edit: false                   },
    }
  },
]

export const ROLE_LEVEL_LABEL = {
  1: 'Executive',
  2: 'Senior Management',
  3: 'Management',
  4: 'Engineering',
  5: 'Operations',
  6: 'Field Lead',
  7: 'Field',
  8: 'Labour',
  9: 'External',
}
