import { describe, expect, it } from 'vitest';
import { colomboDay, COUNTS, generateSeed, SEED_IDS, TABLES } from './data.ts';

const anchor = new Date('2026-11-20T10:00:00Z');
const data = generateSeed(anchor);
describe('synthetic seed fixtures', () => {
  it('is deterministic for an explicit clock, with stable globally unique UUIDs and counts', () => {
    expect(generateSeed(anchor)).toEqual(data);
    const all = TABLES.flatMap((table) => {
      expect(data[table]).toHaveLength(COUNTS[table]);
      expect(data[table].map((row) => row.id).sort()).toEqual(
        [...SEED_IDS[table]].sort(),
      );
      return data[table].map((row) => row.id);
    });
    expect(new Set(all).size).toBe(all.length);
    expect(
      TABLES.flatMap((table) =>
        generateSeed(new Date('2026-12-12'))[table].map((row) => row.id),
      ).sort(),
    ).toEqual([...all].sort());
  });
  it('uses reserved email domains, fake phones and the approved staff mix', () => {
    for (const user of data.users)
      expect(user.email).toMatch(/^[^@]+@chillops\.test$/);
    for (const contact of data.customer_contacts)
      expect(contact.address).toMatch(/^[^@]+@[^@]+\.example$/);
    expect(
      data.technicians.filter((row) => row.level === 'senior'),
    ).toHaveLength(4);
    expect(
      data.technicians.filter((row) => row.level === 'junior'),
    ).toHaveLength(6);
    for (const tech of data.technicians) {
      expect(tech.phone).toMatch(/^\+94 00 0000 \d{4}$/);
      expect(data.users.find((user) => user.id === tech.user_id)?.role).toBe(
        'technician',
      );
    }
    expect(data.users.filter((row) => row.role === 'ops')).toHaveLength(2);
    for (const role of ['finance', 'storekeeper', 'director'])
      expect(data.users.filter((row) => row.role === role)).toHaveLength(1);
  });
  it('keeps ownership consistent and shared contact ambiguity within one customer', () => {
    for (const job of data.jobs) {
      expect(
        data.branches.find((b) => b.id === job.branch_id)?.customer_id,
      ).toBe(job.customer_id);
      expect(
        data.equipment.find((e) => e.id === job.equipment_id)?.branch_id,
      ).toBe(job.branch_id);
    }
    for (const contact of data.customer_contacts.filter((c) => c.branch_id))
      expect(
        data.branches.find((b) => b.id === contact.branch_id)?.customer_id,
      ).toBe(contact.customer_id);
    const shared = data.customer_contacts.filter(
      (c) => c.address === 'shared.desk@frostfern.example',
    );
    expect(shared).toHaveLength(2);
    expect(shared[0]?.customer_id).toBe(shared[1]?.customer_id);
    expect(shared[0]?.branch_id).not.toBe(shared[1]?.branch_id);
    for (const customer of data.customers)
      expect(
        data.customer_contacts.some(
          (c) => c.customer_id === customer.id && c.branch_id === null,
        ),
      ).toBe(true);
    for (const branch of data.branches)
      expect(
        data.customer_contacts.some((c) => c.branch_id === branch.id),
      ).toBe(true);
  });
  it('has the named current-status, repeat-fault and breakdown scenarios', () => {
    const completed = data.jobs.filter((j) => j.current_status === 'completed');
    expect(completed).toHaveLength(20);
    expect(completed.filter((j) => j.job_type === 'breakdown')).toHaveLength(
      12,
    );
    expect(
      completed.filter((j) => j.job_type === 'planned_service'),
    ).toHaveLength(8);
    expect(
      data.jobs.filter((j) => j.current_status === 'pending'),
    ).toHaveLength(4);
    const fresh = data.jobs.filter((j) => j.current_status === 'unassigned');
    expect(fresh).toHaveLength(6);
    expect(fresh.filter((j) => j.priority === 'critical')).toHaveLength(2);
    const repeats = data.jobs.filter((j) =>
      String(j.description).startsWith('Repeat freezer'),
    );
    expect(repeats).toHaveLength(3);
    expect(new Set(repeats.map((j) => j.equipment_id)).size).toBe(1);
    expect(
      Date.parse(String(repeats[2]?.reported_at)) -
        Date.parse(String(repeats[0]?.reported_at)),
    ).toBeLessThan(42 * 86400000);
    expect(
      data.jobs.filter(
        (j) =>
          j.customer_id === SEED_IDS.customers[0] && j.job_type === 'breakdown',
      ),
    ).toHaveLength(12);
    expect(data.jobs.map((j) => j.reported_at)).toEqual(
      data.jobs.map((j) => j.reported_at).sort(),
    );
    expect(data.jobs.every((j) => !('job_number' in j))).toBe(true);
  });
  it('has complete, strictly ordered histories with appropriate actors and locations', () => {
    const allowed = [
      'unassigned:assigned',
      'assigned:in_transit',
      'in_transit:on_site',
      'on_site:completed',
      'on_site:pending',
      'pending:assigned',
    ];
    for (const job of data.jobs) {
      const history = data.job_events.filter((e) => e.job_id === job.id);
      expect(history[0]?.from_status).toBeNull();
      expect(history[0]?.to_status).toBe('unassigned');
      expect(history.at(-1)?.to_status).toBe(job.current_status);
      expect(history[0]?.actor_id).toBe(job.created_by);
      expect(job.created_by === null).toBe(job.source === 'email');
      if (job.source === 'manual')
        expect(data.users.find((u) => u.id === job.created_by)?.role).toBe(
          'ops',
        );
      history.forEach((event, i) => {
        const time = Date.parse(String(event.occurred_at));
        expect(time).toBeLessThanOrEqual(anchor.getTime());
        if (i) {
          expect(time).toBeGreaterThan(
            Date.parse(String(history[i - 1]?.occurred_at)),
          );
          expect(event.from_status).toBe(history[i - 1]?.to_status);
          expect(allowed).toContain(`${event.from_status}:${event.to_status}`);
          expect(data.users.find((u) => u.id === event.actor_id)?.role).toBe(
            event.to_status === 'assigned' ? 'ops' : 'technician',
          );
        }
        if (event.to_status === 'pending') expect(event.reason).toBeTruthy();
        if (event.to_status === 'on_site' || event.to_status === 'in_transit') {
          const branch = data.branches.find((b) => b.id === job.branch_id)!;
          expect(
            Math.abs(Number(event.latitude) - Number(branch.latitude)),
          ).toBeLessThan(0.005);
          expect(
            Math.abs(Number(event.longitude) - Number(branch.longitude)),
          ).toBeLessThan(0.005);
        }
      });
    }
    expect(data.jobs.some((j) => j.source === 'email')).toBe(true);
    expect(data.jobs.some((j) => j.source === 'manual')).toBe(true);
  });
  it('keeps coordinates in the requested box', () => {
    for (const point of [...data.branches, ...data.job_events].filter(
      (p) => p.latitude !== null,
    )) {
      expect(Number(point.latitude)).toBeGreaterThanOrEqual(6.8);
      expect(Number(point.latitude)).toBeLessThanOrEqual(7.25);
      expect(Number(point.longitude)).toBeGreaterThanOrEqual(79.8);
      expect(Number(point.longitude)).toBeLessThanOrEqual(80.05);
    }
  });
  it('varies positive visit duration by priority', () => {
    const durations: Record<string, number[]> = {};
    for (const job of data.jobs.filter(
      (j) => j.current_status !== 'unassigned',
    )) {
      const events = data.job_events.filter((e) => e.job_id === job.id);
      const duration =
        (Date.parse(String(events[4]?.occurred_at)) -
          Date.parse(String(events[3]?.occurred_at))) /
        60000;
      (durations[String(job.priority)] ??= []).push(duration);
    }
    for (const [priority, base] of [
      ['routine', 45],
      ['urgent', 70],
      ['critical', 100],
    ] as const) {
      const values = durations[priority]!;
      expect(new Set(values).size).toBeGreaterThan(1);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(base);
        expect(value).toBeLessThan(base + 16);
      }
    }
  });
  it('handles every weekday and midnight boundary without Sunday or future timestamps', () => {
    for (let day = 16; day <= 23; day++)
      for (const hour of [
        '00:00:00.000',
        '00:00:00.001',
        '09:30:00.000',
        '23:59:59.999',
      ]) {
        const clock = new Date(`2026-11-${day}T${hour}+05:30`);
        const fixture = generateSeed(clock);
        for (const job of fixture.jobs) {
          const time = Date.parse(String(job.reported_at));
          expect(colomboDay(time).getUTCDay()).not.toBe(0);
          expect(time).toBeLessThanOrEqual(clock.getTime());
          if (job.current_status === 'unassigned')
            expect(time).toBeGreaterThanOrEqual(clock.getTime() - 86400000);
          else expect(time).toBeGreaterThan(clock.getTime() - 60 * 86400000);
        }
        for (const event of fixture.job_events)
          expect(
            colomboDay(Date.parse(String(event.occurred_at))).getUTCDay(),
          ).not.toBe(0);
      }
    expect(
      data.jobs.filter((j) => {
        const hour = colomboDay(
          Date.parse(String(j.reported_at)),
        ).getUTCHours();
        return hour >= 8 && hour < 18;
      }).length,
    ).toBeGreaterThan(24);
  });
});
