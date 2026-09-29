import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, Loader2, Lock, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useCloud } from '../store/CloudProvider';
import { adminListWorkspaces, adminOpenWorkspace, friendlyError, type AdminWorkspace } from '../lib/cloud';
import { fmtDate, fmtRelative } from '../lib/format';
import { Badge, Card, EmptyState, Field, Modal, PageHeader, TableSkeleton } from '../components/ui';

export default function Admin() {
  const cloud = useCloud();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminWorkspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [opening, setOpening] = useState<AdminWorkspace | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setRows(await adminListWorkspaces());
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);
  useEffect(() => {
    if (cloud.isAdmin) refresh();
  }, [cloud.isAdmin, refresh]);

  if (!cloud.enabled || !cloud.isAdmin) return <Navigate to="/app" replace />;

  const shown = (rows ?? []).filter((r) => `${r.business_name} ${r.owner_email}`.toLowerCase().includes(q.toLowerCase()));

  const open = async () => {
    if (!opening) return;
    if (reason.trim().length < 5) return setOpenError('Say briefly why you’re opening this account (at least 5 characters).');
    setBusy(true);
    setOpenError(null);
    try {
      const data = await adminOpenWorkspace(opening.id, reason.trim());
      await cloud.enterSupportView(opening.id, opening.business_name, data);
      setOpening(null);
      navigate('/app');
    } catch (e) {
      setOpenError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin"
        sub="Businesses using Tokuma. You can open a business’s data only if they’ve turned on support access; every view is logged and shown to them."
        actions={
          <button className="btn-secondary" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!rows && !error ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input id="admin-search" className="input pl-9" placeholder="Search business or email" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <span className="muted text-xs">
              {rows?.length ?? 0} businesses · {rows?.filter((r) => r.allow_support).length ?? 0} allow support access
            </span>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title={rows?.length ? 'No matches' : 'No businesses yet'} body={rows?.length ? 'Try a different search.' : 'Businesses appear here once people sign up.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                  <tr>
                    <th className="th">Business</th>
                    <th className="th">Owner</th>
                    <th className="th text-right">Products</th>
                    <th className="th text-right">Transactions</th>
                    <th className="th">Last active</th>
                    <th className="th">Support access</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="tr">
                      <td className="td font-medium">{r.business_name || <span className="muted">Profile not set up</span>}</td>
                      <td className="td text-gray-600 dark:text-gray-300">{r.owner_email}</td>
                      <td className="td text-right tabular-nums">{r.products}</td>
                      <td className="td text-right tabular-nums">{r.transactions}</td>
                      <td className="td text-gray-500" title={fmtDate(r.updated_at.slice(0, 10))}>
                        {fmtRelative(r.updated_at)}
                      </td>
                      <td className="td">{r.allow_support ? <Badge tone="green" dot>Allowed</Badge> : <Badge dot>Not allowed</Badge>}</td>
                      <td className="td text-right">
                        {r.allow_support ? (
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setOpening(r);
                              setReason('');
                              setOpenError(null);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Open
                          </button>
                        ) : (
                          <span className="muted inline-flex items-center gap-1 text-xs" title="Ask them to turn on support access in Settings → Account & privacy">
                            <Lock className="h-3.5 w-3.5" /> Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={!!opening}
        onClose={() => setOpening(null)}
        size="sm"
        title={`Open ${opening?.business_name || 'this business'}`}
        sub="Read-only. The business will see this view and your reason in their access history."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpening(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} onClick={open}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Open support view
            </button>
          </>
        }
      >
        <Field label="Reason" error={openError} hint="e.g. “Investigating import error reported by email on Sep 30”">
          <textarea id="admin-reason" rows={3} className="input resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
