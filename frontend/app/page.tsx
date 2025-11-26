import { Tabs } from "./components/Tabs";
import UploadTab from "./components/UploadTab";
import ProductsTab from "./components/ProductsTab";
import EnvBadge from "./components/EnvBadge";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">Acme Console</h1>
          </div>
          <EnvBadge />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs
          tabs={[
            { id: "upload", title: "Upload CSV", content: <UploadTab /> },
            { id: "products", title: "Products", content: <ProductsTab /> },
          ]}
        />
      </main>
    </div>
  );
}
