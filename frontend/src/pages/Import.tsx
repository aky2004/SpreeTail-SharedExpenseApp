import MainLayout from '../components/layout/MainLayout';

export default function Import() {
  return (
    <MainLayout>
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">CSV Importer</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Phase 5 — CSV parser and anomaly reviewer will be implemented here.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
