import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as cloud from '../lib/cloud';
import { clearLocalState, readLocalState, useStore } from './AppStore';
import { t } from '../i18n';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface CloudContext {
  /** False in local mode (no database configured) — everything below is inert. */
  enabled: boolean;
  /** The initial session check has finished. */
  authReady: boolean;
  user: cloud.User | null;
  /** The signed-in user's own workspace (not the one open in a support view). */
  workspaceId: string | null;
  /** The signed-in user's data has been loaded into the app. */
  dataReady: boolean;
  loadError: string | null;
  status: SyncStatus;
  saveError: string | null;
  allowSupport: boolean;
  isAdmin: boolean;
  /** The user followed a password-reset link and should choose a new password. */
  recovery: boolean;
  supportView: { workspaceId: string; name: string } | null;
  reload: () => Promise<void>;
  retrySave: () => void;
  setSupportAccess: (allow: boolean) => Promise<void>;
  enterSupportView: (workspaceId: string, name: string, data: Record<string, unknown>) => Promise<void>;
  exitSupportView: () => Promise<void>;
  signOut: () => Promise<void>;
  clearRecovery: () => void;
}

const Ctx = createContext<CloudContext | null>(null);

const SAVE_DELAY = 400;

function hasRecords(d: Record<string, unknown> | null | undefined) {
  if (!d) return false;
  return ['products', 'suppliers', 'transactions', 'customers', 'fundingRequests'].some((k) => Array.isArray(d[k]) && (d[k] as unknown[]).length > 0) || !!(d.profile as { businessName?: string } | undefined)?.businessName;
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { snapshot, replaceAll, toast } = useStore();
  const [authReady, setAuthReady] = useState(!cloud.CLOUD_ENABLED);
  const [user, setUser] = useState<cloud.User | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [allowSupport, setAllowSupport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [supportView, setSupportView] = useState<CloudContext['supportView']>(null);

  const workspaceId = useRef<string | null>(null);
  const [workspaceIdState, setWorkspaceIdState] = useState<string | null>(null);
  const lastSeen = useRef<string | null>(null);
  /** Set right before loading data from the server, so that load isn't saved straight back. */
  const skipNextSave = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const saving = useRef<Promise<void> | null>(null);
  const supportRef = useRef(supportView);
  supportRef.current = supportView;

  /* ---------------- auth ---------------- */
  useEffect(() => {
    const sb = cloud.supabase;
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser((u) => (u?.id === session?.user?.id ? u : (session?.user ?? null)));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---------------- load ---------------- */
  const load = useCallback(
    async (uid: string, allowMigration: boolean) => {
      setStatus('loading');
      setLoadError(null);
      try {
        const row = await cloud.loadWorkspace(uid);
        workspaceId.current = row.id;
        setWorkspaceIdState(row.id);
        lastSeen.current = row.updated_at;
        setAllowSupport(row.allow_support);
        const local = allowMigration ? readLocalState() : null;
        if (!hasRecords(row.data) && local && hasRecords(local as Record<string, unknown>)) {
          // First sign-in on a browser that has data from before accounts: move it into the account.
          replaceAll(local);
          toast({ kind: 'success', title: t('Moved this browser’s data into your account') });
          clearLocalState();
        } else {
          skipNextSave.current = true;
          replaceAll(row.data);
        }
        setDataReady(true);
        setStatus('saved');
        cloud.isAdmin().then(setIsAdmin);
      } catch (e) {
        setLoadError(cloud.friendlyError(e));
        setStatus('error');
      }
    },
    [replaceAll, toast],
  );

  useEffect(() => {
    if (!cloud.CLOUD_ENABLED) return;
    if (user) {
      load(user.id, true);
    } else {
      if (timer.current) clearTimeout(timer.current);
      workspaceId.current = null;
      setWorkspaceIdState(null);
      lastSeen.current = null;
      skipNextSave.current = true;
      replaceAll(null);
      setDataReady(false);
      setIsAdmin(false);
      setSupportView(null);
      setAllowSupport(false);
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ---------------- save ---------------- */
  const saveNow = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const id = workspaceId.current;
    if (!id || !lastSeen.current || supportRef.current) return;
    if (saving.current) await saving.current;
    const data = latest.current;
    setStatus('saving');
    const run = (async () => {
      try {
        const res = await cloud.saveWorkspace(id, data, data.profile.businessName ?? '', lastSeen.current!);
        if (res.ok) {
          lastSeen.current = res.updatedAt;
          setStatus('saved');
          setSaveError(null);
        } else {
          // Someone saved from another tab or device first — show their version.
          lastSeen.current = res.conflict.updated_at;
          setAllowSupport(res.conflict.allow_support);
          skipNextSave.current = true;
          replaceAll(res.conflict.data);
          setStatus('saved');
          toast({ kind: 'info', title: t('Loaded newer changes'), body: t('This account was updated in another tab or device. Your last change there was kept.') });
        }
      } catch (e) {
        setSaveError(cloud.friendlyError(e));
        setStatus('error');
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [replaceAll, toast]);

  useEffect(() => {
    if (!cloud.CLOUD_ENABLED || !dataReady || supportView) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(() => void saveNow(), SAVE_DELAY);
  }, [snapshot, dataReady, supportView, saveNow]);

  // Save right away when the tab is hidden (switching apps, closing, reloading on mobile).
  useEffect(() => {
    const flush = () => {
      if (timer.current) void saveNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [saveNow]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (status !== 'saving' && status !== 'error') return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [status]);

  /* ---------------- actions ---------------- */
  const reload = useCallback(async () => {
    if (user) await load(user.id, false);
  }, [user, load]);

  const setSupportAccess = useCallback(
    async (allow: boolean) => {
      await saveNow();
      if (!workspaceId.current) return;
      const res = await cloud.setSupportAccess(workspaceId.current, allow);
      lastSeen.current = res.updated_at;
      setAllowSupport(res.allow_support);
    },
    [saveNow],
  );

  const enterSupportView = useCallback(
    async (id: string, name: string, data: Record<string, unknown>) => {
      await saveNow();
      setSupportView({ workspaceId: id, name });
      skipNextSave.current = true;
      replaceAll(data);
    },
    [saveNow, replaceAll],
  );

  const exitSupportView = useCallback(async () => {
    setSupportView(null);
    if (user) await load(user.id, false);
  }, [user, load]);

  const signOut = useCallback(async () => {
    if (!supportRef.current) await saveNow();
    await cloud.signOut();
  }, [saveNow]);

  const value: CloudContext = {
    enabled: cloud.CLOUD_ENABLED,
    authReady,
    user,
    workspaceId: workspaceIdState,
    dataReady,
    loadError,
    status,
    saveError,
    allowSupport,
    isAdmin,
    recovery,
    supportView,
    reload,
    retrySave: () => void saveNow(),
    setSupportAccess,
    enterSupportView,
    exitSupportView,
    signOut,
    clearRecovery: () => setRecovery(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud must be used inside CloudProvider');
  return c;
}
