import { useState } from 'react';
import type { StaffMe, StaffRole } from '../../../shared/types.ts';
import { api, ApiError } from '../lib/api.ts';
import { fmtDate } from '../i18n/index.ts';
import { Button, Field, Notice, Sheet, Skeleton, useLoad, useToast } from '../ui/kit.tsx';
import { Plus, Store } from '../ui/icons.tsx';
import { LoadError, PageHead } from './AdminApp.tsx';

type Member = { id: string; fullName: string; username: string; role: StaffRole; isActive: boolean; outlet: { id: string; name: string } | null; lastLoginAt: string | null };
type Outlet = { id: string; name: string; code: string; isActive: boolean };

const ROLE_LABEL: Record<StaffRole, string> = { super_admin: 'Super admin', admin: 'Administrator', staff: 'Counter staff' };
const ROLE_HELP: Record<StaffRole, string> = {
  staff: 'Scan cards, confirm visits, redeem rewards, register guests.',
  admin: 'Everything staff can do, plus guests, corrections, cards, reports and counter staff.',
  super_admin: 'Everything, including adding administrators.',
};

export function Team({ me }: { me: StaffMe }) {
  const staff = useLoad<Member[]>(() => api.get('/api/admin/staff'));
  const outlets = useLoad<Outlet[]>(() => api.get('/api/admin/outlets'));
  const [edit, setEdit] = useState<Member | 'new' | null>(null);
  const [editOutlet, setEditOutlet] = useState<Outlet | 'new' | null>(null);
  const toast = useToast();
  const isSuper = me.permissions.includes('staff.manage_admins');

  return (
    <div className="a-page">
      <PageHead title="Team & outlets" sub="Each person signs in with their own account, so every visit and reward shows who handled it."
        actions={<Button onClick={() => setEdit('new')}><Plus />Add team member</Button>} />
      {staff.error ? <LoadError error={staff.error} retry={staff.reload} /> : null}
      <section className="panel">
        {!staff.data ? <div className="panel__body"><Skeleton h={48} /></div> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th>Outlet</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {staff.data.map((m) => (
                  <tr key={m.id} style={!m.isActive ? { opacity: .55 } : undefined}>
                    <td><strong>{m.fullName}</strong><div className="list-row__sub">{m.username}{!m.isActive ? ' · switched off' : ''}</div></td>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td>{m.outlet?.name ?? <span className="muted">Any</span>}</td>
                    <td className="muted">{m.lastLoginAt ? fmtDate(m.lastLoginAt) : 'Never'}</td>
                    <td style={{ textAlign: 'end' }}>
                      {m.role === 'staff' || isSuper ? <Button size="sm" variant="ghost" onClick={() => setEdit(m)}>Edit</Button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__body spread">
          <div><h2 className="section-title">Outlets</h2><p className="section-sub">Visits and redemptions record which outlet handled them. Guests use one card everywhere.</p></div>
          <Button size="sm" variant="secondary" onClick={() => setEditOutlet('new')}><Store />Add outlet</Button>
        </div>
        {outlets.data?.map((o) => (
          <div key={o.id} className="list-row">
            <div><div className="list-row__title">{o.name}</div><div className="list-row__sub">{o.code}{!o.isActive ? ' · closed' : ''}</div></div>
            <Button size="sm" variant="ghost" onClick={() => setEditOutlet(o)}>Edit</Button>
          </div>
        ))}
      </section>

      {edit ? <MemberEditor member={edit === 'new' ? null : edit} outlets={outlets.data ?? []} isSuper={isSuper} selfId={me.id}
        onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); toast(m); staff.reload(); }} /> : null}
      {editOutlet ? <OutletEditor outlet={editOutlet === 'new' ? null : editOutlet} onClose={() => setEditOutlet(null)} onDone={(m) => { setEditOutlet(null); toast(m); outlets.reload(); }} /> : null}
    </div>
  );
}

function MemberEditor({ member, outlets, isSuper, selfId, onClose, onDone }: { member: Member | null; outlets: Outlet[]; isSuper: boolean; selfId: string; onClose: () => void; onDone: (m: string) => void }) {
  const [fullName, setName] = useState(member?.fullName ?? '');
  const [username, setUsername] = useState(member?.username ?? '');
  const [role, setRole] = useState<StaffRole>(member?.role ?? 'staff');
  const [outletId, setOutlet] = useState<string>(member?.outlet?.id ?? outlets[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(member?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const roles: StaffRole[] = isSuper ? ['staff', 'admin', 'super_admin'] : ['staff'];
  const self = member?.id === selfId;
  async function save() {
    setBusy(true); setError(null);
    const body: any = { fullName, role, outletId: outletId || null, isActive: active };
    if (password) body.password = password;
    try {
      if (member) await api.patch(`/api/admin/staff/${member.id}`, body);
      else await api.post('/api/admin/staff', { ...body, username, password });
      onDone(member ? 'Team member saved' : `${fullName} added. Share the temporary password privately; they choose their own at first sign-in.`);
    } catch (e: any) { setError(e); setBusy(false); }
  }
  const f = error?.fields ?? {};
  return (
    <Sheet title={member ? `Edit ${member.fullName}` : 'Add a team member'} onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} onClick={save}>{member ? 'Save' : 'Add member'}</Button>
    </>}>
      <div className="stack">
        {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Full name" value={fullName} onChange={setName} error={f.fullName} />
        {!member ? <Field label="Username" hint="Lowercase letters, numbers, dots or dashes." value={username} onChange={(v) => setUsername(v.toLowerCase())} autoComplete="off" error={f.username} /> : null}
        <div className="field">
          <label className="field__label" htmlFor="m-role">Role</label>
          <select id="m-role" className="select" value={role} disabled={self} onChange={(e: any) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <span className="field__hint">{ROLE_HELP[role]}</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="m-outlet">Outlet</label>
          <select id="m-outlet" className="select" value={outletId} onChange={(e: any) => setOutlet(e.target.value)}>
            {role !== 'staff' ? <option value="">Any outlet (chooses at sign-in)</option> : null}
            {outlets.filter((o) => o.isActive).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {f.outletId ? <span className="field__error">{f.outletId}</span> : null}
        </div>
        <Field label={member ? 'Reset password (optional)' : 'Temporary password'} type="password" value={password} onChange={setPassword}
          hint="At least 10 characters. They’ll be asked to change it." autoComplete="new-password" error={f.password} />
        {member && !self ? (
          <label className="check">
            <input type="checkbox" checked={!active} onChange={(e: any) => setActive(!e.target.checked)} />
            <span><strong>Switch off this account</strong><br /><span className="muted">Signs them out everywhere. Their past activity stays in the log.</span></span>
          </label>
        ) : null}
      </div>
    </Sheet>
  );
}

function OutletEditor({ outlet, onClose, onDone }: { outlet: Outlet | null; onClose: () => void; onDone: (m: string) => void }) {
  const [name, setName] = useState(outlet?.name ?? '');
  const [code, setCode] = useState(outlet?.code ?? '');
  const [active, setActive] = useState(outlet?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try {
      if (outlet) await api.patch(`/api/admin/outlets/${outlet.id}`, { name, code, isActive: active });
      else await api.post('/api/admin/outlets', { name, code });
      onDone('Outlet saved');
    } catch (e: any) { setError(e); setBusy(false); }
  }
  const f = error?.fields ?? {};
  return (
    <Sheet title={outlet ? `Edit ${outlet.name}` : 'Add an outlet'} onClose={onClose} actions={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button loading={busy} onClick={save}>Save outlet</Button>
    </>}>
      <div className="stack">
        {error && !Object.keys(f).length ? <Notice kind="error">{error.message}</Notice> : null}
        <Field label="Outlet name" value={name} onChange={setName} error={f.name} placeholder="Bay Leaf — Marina" />
        <Field label="Short code" hint="Used in reports, e.g. MARINA." value={code} onChange={(v) => setCode(v.toUpperCase())} error={f.code} />
        {outlet ? (
          <label className="check">
            <input type="checkbox" checked={!active} onChange={(e: any) => setActive(!e.target.checked)} />
            <span><strong>Mark as closed</strong><br /><span className="muted">Hidden from the counter. History is kept.</span></span>
          </label>
        ) : null}
      </div>
    </Sheet>
  );
}
