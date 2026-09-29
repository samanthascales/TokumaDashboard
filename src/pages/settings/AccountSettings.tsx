import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useCloud } from '../../store/CloudProvider';
import { useStore } from '../../store/AppStore';
import { friendlyError, loadSupportLog, sendPasswordReset, type SupportLogEntry } from '../../lib/cloud';
import { fmtRelative } from '../../lib/format';
import { Card, CardHeader, Toggle } from '../../components/ui';

export function AccountSettings() {
  const cloud = useCloud();
  const { toast } = useStore();
  const navigate = useNavigate();
  const [log, setLog] = useState<SupportLogEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloud.workspaceId) return;
    let alive = true;
    loadSupportLog(cloud.workspaceId)
      .then((l) => alive && setLog(l))
      .catch(() => alive && setLog([]));
    return () => {
      alive = false;
    };
  }, [cloud.workspaceId]);

  const toggle = async (allow: boolean) => {
    setBusy(true);
    try {
      await cloud.setSupportAccess(allow);
      toast({ kind: 'success', title: allow ? 'Support access turned on' : 'Support access turned off' });
    } catch (e) {
      toast({ kind: 'error', title: 'Couldn’t change support access', body: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Account" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-medium">{cloud.user?.email}</p>
            <p className="muted text-xs">Your data is stored in your Tokuma account and syncs across devices.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                if (!cloud.user?.email) return;
                try {
                  await sendPasswordReset(cloud.user.email);
                  toast({ kind: 'success', title: 'Password reset email sent', body: cloud.user.email });
                } catch (e) {
                  toast({ kind: 'error', title: 'Couldn’t send the email', body: friendlyError(e) });
                }
              }}
            >
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                await cloud.signOut();
                navigate('/');
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Support access" sub="Let the Tokuma team open your data (read-only) to help fix a problem." />
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-white/10">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div>
                <p className="text-sm font-medium">Allow Tokuma support to view my data</p>
                <p className="muted mt-0.5 text-xs leading-relaxed">
                  Off by default. When on, the Tokuma team can view your products, suppliers, transactions and profile to help you — they can’t change anything. Every view is recorded below with the reason given. Turn it off any time.
                </p>
              </div>
            </div>
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : <Toggle checked={cloud.allowSupport} onChange={toggle} label="Allow support access" />}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <History className="h-3.5 w-3.5" /> Access history
            </p>
            {log === null ? (
              <p className="muted text-sm">Loading…</p>
            ) : log.length === 0 ? (
              <p className="muted text-sm">No one from Tokuma has viewed your data.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-white/5 dark:border-white/10">
                {log.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                    <span>{l.reason}</span>
                    <span className="muted shrink-0 text-xs" title={new Date(l.accessed_at).toLocaleString()}>
                      {fmtRelative(l.accessed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </>
  );
}
