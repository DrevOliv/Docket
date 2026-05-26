import { Link, Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Dashboard from "@/pages/Dashboard";
import StackDetail from "@/pages/StackDetail";

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<PageMotion><Dashboard /></PageMotion>} />
            <Route path="/stacks/:name" element={<PageMotion><StackDetail /></PageMotion>} />
          </Routes>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-line/60 bg-ink/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="/docklet-icon.png"
            alt="Docklet"
            className="w-9 h-9 rounded-lg border border-line/60 bg-white object-cover group-hover:shadow-glow transition-shadow"
          />
          <span className="font-semibold tracking-tight">Docklet</span>
        </Link>
        <span className="text-dim text-xs">— compose stacks at a glance</span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="text-center text-xs text-dim py-6">
      Docklet · local docker manager
    </footer>
  );
}

function PageMotion({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
