import { useCallback, useEffect, useState } from 'react';
import { useDiscipline } from './hooks/useDiscipline.js';
import { useNow } from './hooks/useNow.js';
import { useOnline } from './hooks/useOnline.js';
import { useServiceWorker } from './hooks/useServiceWorker.js';
import { ActivityStrip } from './components/ActivityStrip.jsx';
import { AppHeader } from './components/AppHeader.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import { HistoryLog } from './components/HistoryLog.jsx';
import { InstallBanner } from './components/InstallBanner.jsx';
import { LockoutScreen } from './components/LockoutScreen.jsx';
import { MetricsGrid } from './components/MetricsGrid.jsx';
import { NavTabs } from './components/NavTabs.jsx';
import { TaskManager } from './components/TaskManager.jsx';
import { TodayChecklist } from './components/TodayChecklist.jsx';
import { Toast } from './components/Toast.jsx';

const TABS = new Set(['today', 'tasks', 'log']);
const initialTab = () => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.has(t) ? t : 'today';
};

export default function App() {
  const store = useDiscipline();
  const online = useOnline();
  const sw = useServiceWorker();
  const now = useNow(1000, store.clockOffset);
  const [tab, setTab] = useState(initialTab);

  const changeTab = useCallback((next) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    url.searchParams.delete('source');
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  }, []);

  const { snapshot } = store;
  useEffect(() => {
    const failed = snapshot?.today.filter((t) => t.status === 'failed').length ?? 0;
    document.title = failed ? `(${failed}✕) DISCIPLEX` : 'DISCIPLEX';
  }, [snapshot]);

  const updateToast = sw.updateAvailable && (
    <Toast
      notice={{ kind: 'info', message: 'A new version is ready.' }}
      onDismiss={() => {}}
      action={<button type="button" onClick={sw.applyUpdate} className="btn-primary px-3 py-1.5">Reload</button>}
    />
  );

  if (!store.token) {
    return (
      <>
        <InstallBanner />
        <AuthScreen onAuthenticate={store.authenticate} online={online} />
        {updateToast}
      </>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-xs uppercase tracking-[0.3em] text-muted">
        {online ? 'Loading…' : 'Offline — no cached data yet'}
      </div>
    );
  }

  const { stats, lock, today, tasks, user } = snapshot;
  const failedToday = today.filter((t) => t.status === 'failed').length;

  return (
    <>
      <InstallBanner />
      <AppHeader
        username={user.username}
        online={online}
        stale={store.stale}
        queuedCount={store.queued.length}
        onRefresh={store.refresh}
        onLogout={store.logout}
      />
      <NavTabs active={tab} onChange={changeTab} badges={{ today: failedToday }} />

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-4">
        {tab === 'today' && (
          <>
            <MetricsGrid stats={stats} lock={lock} />
            <TodayChecklist
              items={today}
              now={now}
              queued={store.queued}
              timeZone={user.timezone}
              onComplete={store.complete}
              onAddTask={() => changeTab('tasks')}
            />
            <ActivityStrip days={stats.last14} />
          </>
        )}
        {tab === 'tasks' && (
          <TaskManager
            tasks={tasks}
            lock={lock}
            online={online}
            onCreate={store.createTask}
            onUpdate={store.updateTask}
            onArchive={store.archiveTask}
            notify={store.notify}
          />
        )}
        {tab === 'log' && <HistoryLog version={snapshot.serverTime} online={online} />}
      </main>

      {lock.accountabilityRequired && (
        <LockoutScreen
          lock={lock}
          stats={stats}
          today={today}
          now={now}
          queued={store.queued}
          timeZone={user.timezone}
          online={online}
          onComplete={store.complete}
          onSubmit={async (log) => {
            await store.submitAccountability(log);
            store.notify('ok', 'Log filed. Access restored. Do better.');
          }}
          onLogout={store.logout}
        />
      )}

      {updateToast || <Toast notice={store.notice} onDismiss={store.dismissNotice} />}
    </>
  );
}
