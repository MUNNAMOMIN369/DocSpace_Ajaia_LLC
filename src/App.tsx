import { useEffect } from "react";
import { motion } from "framer-motion";
import { AppProvider, useApp } from "./lib/app-context";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Dashboard from "./components/Dashboard";
import EditorView from "./components/EditorView";
import AppErrorBoundary from "./components/AppErrorBoundary";
import Toasts from "./components/Toasts";
import { CreateModal, ShareDialog, UpgradeModal, UploadModal } from "./components/Modals";

function Shell() {
  const { authenticated, activeDocId, closeDoc } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Search documents"]')?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!authenticated) {
    return (
      <>
        <AuthScreen />
        <Toasts />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1">
          {activeDocId ? (
            <motion.div
              key={activeDocId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="h-[calc(100vh-68px)]"
            >
              <AppErrorBoundary key={activeDocId} onReturn={closeDoc}>
                <EditorView docId={activeDocId} />
              </AppErrorBoundary>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <Dashboard />
              <footer className="mx-auto w-full max-w-[1200px] px-4 pb-8 sm:px-6">
                <div className="flex flex-col items-center justify-between gap-2 rounded-2xl border border-border bg-white px-5 py-3.5 text-[12.5px] text-text-muted sm:flex-row">
                  <p><span className="font-bold text-text-primary">DocSpace</span> · Document workspace</p>
                  <p>Service status and legal pages are not configured.</p>
                </div>
              </footer>
            </motion.div>
          )}
        </main>
      </div>

      {/* Global overlays */}
      <CreateModal />
      <UploadModal />
      <ShareDialog />
      <UpgradeModal />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
