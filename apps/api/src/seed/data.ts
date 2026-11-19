// Fixed UUID namespaces are reserved for this synthetic dataset, never production IDs.
export const TABLES = [
  'users',
  'technicians',
  'customers',
  'branches',
  'equipment',
  'customer_contacts',
  'jobs',
  'job_events',
] as const;
export type Table = (typeof TABLES)[number];
export type Row = { id: string } & Record<string, string | boolean | null>;
export type SeedData = Record<Table, Row[]>;
export const COUNTS: Record<Table, number> = {
  users: 15,
  technicians: 10,
  customers: 5,
  branches: 14,
  equipment: 45,
  customer_contacts: 21,
  jobs: 30,
  job_events: 130,
};
export function seedId(table: Table, ordinal: number): string {
  return `c1300000-0000-4000-8000-${String(TABLES.indexOf(table) + 1).padStart(2, '0')}${String(ordinal).padStart(10, '0')}`;
}
export const SEED_IDS = Object.fromEntries(
  TABLES.map((table) => [
    table,
    Array.from({ length: COUNTS[table] }, (_, i) => seedId(table, i + 1)),
  ]),
) as Record<Table, string[]>;
const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const OFFSET = 330 * MINUTE;
export function colomboDay(time: number): Date {
  return new Date(time + OFFSET);
}
function weekday(time: number): number {
  return colomboDay(time).getUTCDay();
}
function historical(anchor: number, days: number, hour: number): number {
  const local = colomboDay(anchor - days * DAY);
  local.setUTCHours(hour, 0, 0, 0);
  if (local.getUTCDay() === 0) local.setUTCDate(local.getUTCDate() - 1);
  return local.getTime() - OFFSET;
}
function advance(time: number, minutes: number): number {
  let next = time + minutes * MINUTE;
  if (weekday(next) === 0) next += DAY;
  return next;
}
function recent(anchor: number): number[] {
  // Prefer business hours; on Sunday the most recent Saturday slots are used.
  const slots = Array.from(
    { length: 1440 },
    (_, i) => Math.floor(anchor / MINUTE) * MINUTE - i * MINUTE,
  ).filter((time) => weekday(time) !== 0 && time > anchor - DAY);
  const business = slots.filter((time) => {
    const hour = colomboDay(time).getUTCHours();
    return hour >= 8 && hour < 18;
  });
  const selected = [
    ...business,
    ...slots.filter((time) => !business.includes(time)),
  ].slice(0, 6);
  // Near Sunday/Monday midnight the valid window can be shorter than a minute.
  // Separate jobs may share a timestamp; histories within a job remain strict.
  const local = colomboDay(anchor);
  local.setUTCHours(0, 0, 0, 0);
  const fallback =
    weekday(anchor) === 0 ? local.getTime() - OFFSET - 1 : anchor;
  while (selected.length < 6) selected.push(fallback);
  return selected;
}

export function generateSeed(anchor = new Date()): SeedData {
  const now = anchor.getTime();
  if (!Number.isFinite(now)) throw new Error('Invalid seed date.');
  const data = Object.fromEntries(
    TABLES.map((table) => [table, []]),
  ) as unknown as SeedData;
  const created = new Date(now - 70 * DAY).toISOString();
  const add = (table: Table, fields: Omit<Row, 'id'>): Row => {
    const row: Row = {
      id: seedId(table, data[table].length + 1),
      created_at: created,
      ...fields,
    };
    data[table].push(row);
    return row;
  };
  const staff = [
    'Sora Elm',
    'Kiri Ash',
    'Aven Lake',
    'Runi Fern',
    'Dara Pine',
    'Mira Vale',
    'Oren Finch',
    'Tavi Reed',
    'Nela Moss',
    'Lio Wren',
    'Ena Birch',
    'Ivo Brook',
    'Zeli Lark',
    'Roa Glen',
    'Veni Alder',
  ];
  staff.forEach((name, i) => {
    const user = add('users', {
      full_name: name,
      email: `${name.toLowerCase().replace(' ', '.')}@chillops.test`,
      role:
        ['ops', 'ops', 'finance', 'storekeeper', 'director'][i] ?? 'technician',
      active: true,
    });
    if (i >= 5)
      add('technicians', {
        user_id: user.id,
        level: i < 9 ? 'senior' : 'junior',
        phone: `+94 00 0000 ${String(101 + i - 5).padStart(4, '0')}`,
        active: true,
      });
  });
  const names = [
    'Frostfern Markets',
    'Cloudberry Grocers',
    'Moonwell Picturehouse',
    'Driftwillow Hotels',
    'Silvermoss Pharmacies',
  ];
  const domains = [
    'frostfern.example',
    'cloudberry.example',
    'moonwell.example',
    'driftwillow.example',
    'silvermoss.example',
  ];
  const branchNames = [
    'Lantern Quay',
    'Willow Arcade',
    'Amber Walk',
    'Reed Court',
    'Pebble Junction',
    'Moss Terrace',
    'Wren Circle',
    'Copper Square',
    'Fern Crossing',
    'Birch Landing',
    'Lark Grove',
    'Pine Haven',
    'Elm Reach',
    'Alder Corner',
  ];
  const areas = [
    'Colombo',
    'Dehiwala',
    'Moratuwa',
    'Panadura',
    'Nugegoda',
    'Maharagama',
    'Kottawa',
    'Kelaniya',
    'Wattala',
    'Negombo',
    'Ja-Ela',
    'Ragama',
    'Kadawatha',
    'Malabe',
  ];
  const points = [
    [6.93, 79.85],
    [6.85, 79.87],
    [6.81, 79.89],
    [6.805, 79.91],
    [6.87, 79.9],
    [6.85, 79.93],
    [6.84, 79.97],
    [6.96, 79.92],
    [6.99, 79.89],
    [7.2, 79.87],
    [7.08, 79.9],
    [7.03, 79.93],
    [7.0, 79.96],
    [6.91, 79.96],
  ];
  const counts = [4, 3, 2, 3, 2];
  names.forEach((name, c) => {
    const customer = add('customers', { name });
    add('customer_contacts', {
      customer_id: customer.id,
      branch_id: null,
      kind: 'email',
      address: `service@${domains[c]}`,
    });
    for (let b = 0; b < (counts[c] ?? 0); b++) {
      const index = data.branches.length;
      const point = points[index]!;
      const branch = add('branches', {
        customer_id: customer.id,
        name: branchNames[index]!,
        address: areas[index]!,
        latitude: String(point[0]),
        longitude: String(point[1]),
      });
      add('customer_contacts', {
        customer_id: customer.id,
        branch_id: branch.id,
        kind: 'email',
        address: `${branchNames[index]!.toLowerCase().replaceAll(' ', '.')}@${domains[c]}`,
      });
      const equipmentCount =
        c === 0
          ? b < 3
            ? 4
            : 3
          : c === 1
            ? b === 0
              ? 4
              : 3
            : c === 3
              ? b < 2
                ? 3
                : 2
              : 3;
      for (let e = 0; e < equipmentCount; e++) {
        const kind =
          c === 2 ? (e === 0 ? 4 : e === 1 ? 3 : 0) : (index + e) % 5;
        add('equipment', {
          branch_id: branch.id,
          type: kind < 3 ? 'refrigeration' : 'air_conditioning',
          label: `${['Display chiller', 'Freezer', 'Cold room', 'Split AC', 'Auditorium AC'][kind]} ${e + 1}`,
          model: `Demo ${kind + 1}`,
          serial_number: `SYNTH-${index + 1}-${e + 1}`,
        });
      }
    }
  });
  for (const branch of data.branches.slice(0, 2))
    add('customer_contacts', {
      customer_id: branch.customer_id!,
      branch_id: branch.id,
      kind: 'email',
      address: 'shared.desk@frostfern.example',
    });
  const customerOrder = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 0, 0, 1, 3, 0,
    0, 0, 0, 2, 4,
  ];
  const planned = new Set([6, 7, 10, 11, 14, 16, 17, 19]);
  const recentTimes = recent(now);
  const reasons = [
    'Compressor part not in stock',
    'Branch closed, access unavailable',
    'Replacement controller awaiting delivery',
    'Customer approval for repair pending',
  ];
  let random = 130;
  const jitter = () => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return random % 16;
  };
  for (let j = 0; j < 30; j++) {
    const customer = data.customers[customerOrder[j]!]!;
    const owned = data.branches.filter((b) => b.customer_id === customer.id);
    const branch = owned[j < 3 ? 0 : j % owned.length]!;
    const equipment = data.equipment.filter((e) => e.branch_id === branch.id);
    const item =
      j < 3
        ? equipment.find((e) => String(e.label).startsWith('Freezer'))!
        : equipment[j % equipment.length]!;
    const state = j < 20 ? 'completed' : j < 24 ? 'pending' : 'unassigned';
    const priority =
      j >= 24
        ? j < 26
          ? 'critical'
          : j < 28
            ? 'urgent'
            : 'routine'
        : ['routine', 'urgent', 'critical'][j % 3]!;
    const days = j < 3 ? [40, 23, 7][j]! : j < 20 ? 3 + j * 2 : 2 + (j % 4);
    const reported =
      j >= 24
        ? recentTimes[j - 24]!
        : historical(now, days, j === 4 || j === 15 ? 19 : 8 + (j % 3));
    const source = j % 2 === 0 ? 'email' : 'manual';
    const creator = source === 'manual' ? data.users[j % 2]!.id : null;
    const job = add('jobs', {
      customer_id: customer.id,
      branch_id: branch.id,
      equipment_id: item.id,
      job_type: planned.has(j) ? 'planned_service' : 'breakdown',
      priority,
      current_status: state,
      description:
        j < 3
          ? `Repeat freezer fault ${j + 1}: temperature rising after defrost`
          : planned.has(j)
            ? 'Scheduled coil cleaning and temperature checks'
            : `${item.label}: ${['Temperature above set point', 'Intermittent cooling loss', 'Unusual compressor noise'][j % 3]}`,
      source,
      reported_at: new Date(reported).toISOString(),
      created_at: new Date(reported).toISOString(),
      created_by: creator,
    });
    const chain =
      state === 'unassigned'
        ? ['unassigned']
        : j === 5
          ? [
              'unassigned',
              'assigned',
              'in_transit',
              'on_site',
              'pending',
              'assigned',
              'in_transit',
              'on_site',
              'completed',
            ]
          : ['unassigned', 'assigned', 'in_transit', 'on_site', state];
    let time = reported;
    chain.forEach((status, step) => {
      if (step > 0)
        time = advance(
          time,
          (status === 'completed' || status === 'pending'
            ? ({ critical: 100, urgent: 70, routine: 45 }[priority] ?? 45)
            : ({ critical: 12, urgent: 25, routine: 45 }[priority] ?? 45)) +
            jitter(),
        );
      const location = status === 'in_transit' || status === 'on_site';
      add('job_events', {
        job_id: job.id,
        from_status: chain[step - 1] ?? null,
        to_status: status,
        actor_id:
          step === 0
            ? creator
            : status === 'assigned'
              ? data.users[j % 2]!.id
              : data.users[5 + (j % 10)]!.id,
        occurred_at: new Date(time).toISOString(),
        created_at: new Date(time).toISOString(),
        latitude: location
          ? (Number(branch.latitude) + 0.001).toFixed(6)
          : null,
        longitude: location
          ? (Number(branch.longitude) + 0.001).toFixed(6)
          : null,
        reason: status === 'pending' ? reasons[j % 4]! : null,
        note:
          j === 5 && step === 5
            ? 'Synthetic revisit after replacement part arrived'
            : null,
      });
    });
  }
  data.jobs.sort((a, b) =>
    String(a.reported_at).localeCompare(String(b.reported_at)),
  );
  return data;
}
