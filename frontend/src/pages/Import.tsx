import React, { useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import api from '../api/client';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Download,
  AlertOctagon,
  Layers,
  Check,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export default function Import() {
  const { currentGroup } = useGroup();

  // Wizard state: 'upload' | 'anomalies' | 'duplicates' | 'confirm' | 'report'
  const [step, setStep] = useState<'upload' | 'anomalies' | 'duplicates' | 'confirm' | 'report'>('upload');
  
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Preview result state
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [processedRows, setProcessedRows] = useState<any[]>([]);
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<string, 'kept_both' | 'deleted_a' | 'deleted_b'>>({});

  // Confirm state
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !file) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/import/group/${currentGroup.id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setPreviewData(res.data);
      setProcessedRows(res.data.processedRows || []);
      
      // Initialize duplicate decisions
      const initialDecisions: Record<string, 'kept_both' | 'deleted_a' | 'deleted_b'> = {};
      res.data.duplicatePairs.forEach((pair: any) => {
        initialDecisions[`${pair.row_a_number}-${pair.row_b_number}`] = 'kept_both';
      });
      setDuplicateDecisions(initialDecisions);

      // Advance wizard
      if (res.data.anomalies.length > 0) {
        setStep('anomalies');
      } else if (res.data.duplicatePairs.length > 0) {
        setStep('duplicates');
      } else {
        setStep('confirm');
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload and parse file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDuplicateDecision = (pairKey: string, decision: 'kept_both' | 'deleted_a' | 'deleted_b') => {
    setDuplicateDecisions({
      ...duplicateDecisions,
      [pairKey]: decision
    });
  };

  // Get final rows to import after duplicate exclusions are applied
  const getFinalRowsToImport = () => {
    if (!previewData) return [];

    // Set of row numbers to exclude
    const excludedRows = new Set<number>();
    
    previewData.duplicatePairs.forEach((pair: any) => {
      const decision = duplicateDecisions[`${pair.row_a_number}-${pair.row_b_number}`];
      if (decision === 'deleted_a') {
        excludedRows.add(pair.row_a_number);
      } else if (decision === 'deleted_b') {
        excludedRows.add(pair.row_b_number);
      }
    });

    return processedRows.filter(row => !excludedRows.has(row.rowNumber));
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setIsConfirming(true);
    setConfirmError(null);

    const finalRows = getFinalRowsToImport();

    try {
      const res = await api.post(`/import/confirm/${previewData.importLogId}`, {
        processedRows: finalRows
      });
      
      // Sync duplicate decisions with database logs
      for (const pair of previewData.duplicatePairs) {
        const decision = duplicateDecisions[`${pair.row_a_number}-${pair.row_b_number}`];
        await api.post(`/import/duplicate/${pair.id}/resolve`, {
          status: decision
        });
      }

      setImportReport({
        importLogId: res.data.importLogId,
        totalRows: previewData.totalRows,
        importedCount: finalRows.length,
        skippedCount: previewData.skippedRows + (processedRows.length - finalRows.length),
        anomalyCount: previewData.anomalyCount,
        anomalies: previewData.anomalies,
        finalRows
      });

      setStep('report');
    } catch (err: any) {
      setConfirmError(err.response?.data?.error || 'Failed to confirm import');
    } finally {
      setIsConfirming(false);
    }
  };

  const downloadReport = () => {
    if (!importReport) return;
    
    // Build human readable report content
    const reportText = `EXPENSIO IMPORT SUMMARY REPORT
=====================================
Import Date: ${new Date().toLocaleString()}
Import Log ID: ${importReport.importLogId}
Total Rows in CSV: ${importReport.totalRows}
Successfully Imported: ${importReport.importedCount} rows
Skipped / Excluded Rows: ${importReport.skippedCount} rows
Anomalies Detected & Resolved: ${importReport.anomalyCount} anomalies

LIST OF DETECTED ANOMALIES & SOLUTIONS APPLIED:
------------------------------------------------
${importReport.anomalies.map((a: any) => 
  `Row ${a.row_number} [Col: ${a.column_name || 'Row'}]: ${a.anomaly_type}
   - Original Value: "${a.original_value || 'None'}"
   - Policy Solution: Resolved to "${a.resolved_value || 'Skipped'}"
   - Action Taken: ${a.action_taken}
`
).join('\n')}

LIST OF TRANSACTIONS IMPORTED:
------------------------------
${importReport.finalRows.map((r: any) => 
  `- ${r.date}: "${r.description}" - Paid by ${r.paid_by_name} for INR ${Number(r.amount).toFixed(2)} [Split: ${r.split_type}] (Splits with: ${r.split_with_names.join(', ')})`
).join('\n')}
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expensio_import_report_${importReport.importLogId}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentGroup) {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-[var(--color-text-muted)]">No active group selected.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0 animate-fade-in font-inter">
        
        {/* Progress Bar Header */}
        <div className="shrink-0 mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">CSV Bill Importer</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Ingest and trace spreadsheet data with automatic anomaly policies.
          </p>

          {/* Stepper HUD */}
          {step !== 'report' && (
            <div className="flex items-center gap-2 mt-6 p-1 bg-zinc-900/40 border border-[var(--color-border-card)]/50 rounded-2xl max-w-lg">
              <div className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl ${step === 'upload' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-zinc-500'}`}>Upload</div>
              <ChevronRight size={14} className="text-zinc-700 shrink-0" />
              <div className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl ${step === 'anomalies' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-zinc-500'}`}>Anomalies</div>
              <ChevronRight size={14} className="text-zinc-700 shrink-0" />
              <div className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl ${step === 'duplicates' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-zinc-500'}`}>Duplicates</div>
              <ChevronRight size={14} className="text-zinc-700 shrink-0" />
              <div className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl ${step === 'confirm' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : 'text-zinc-500'}`}>Confirm</div>
            </div>
          )}
        </div>

        {/* Step 1: Upload Form */}
        {step === 'upload' && (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-8 shadow-xl max-w-xl">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <UploadCloud className="text-[var(--color-accent)]" size={20} />
              <span>Upload expenses_export.csv</span>
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              Drop the Spreetail spreadsheet exports directly. No manual edits are required before uploading.
            </p>

            {uploadError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-xs flex items-center gap-2">
                <AlertOctagon size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-6">
              <label className="border-2 border-dashed border-zinc-800 hover:border-[var(--color-accent)]/40 hover:bg-zinc-800/10 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200">
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <FileSpreadsheet className="text-[var(--color-accent)]/80 mb-3" size={40} />
                <span className="text-sm font-semibold text-white">
                  {file ? file.name : 'Select expenses_export.csv'}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] mt-1.5 font-medium uppercase tracking-wider">
                  {file ? `Size: ${(file.size / 1024).toFixed(1)} KB` : 'Click to browse files'}
                </span>
              </label>

              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(0,180,166,0.15)] cursor-pointer"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Ingest Spreadsheet</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Review Anomalies */}
        {step === 'anomalies' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl mb-6 text-xs flex items-center gap-2 shrink-0">
              <AlertTriangle size={16} />
              <span>We detected <strong>{previewData.anomalyCount} data anomalies</strong> in the CSV file. Review resolved actions below.</span>
            </div>

            {/* Anomaly list */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[var(--color-bg-sidebar)] z-10">
                    <tr className="border-b border-[var(--color-border-card)]">
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pl-6">Row</th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Column</th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Issue Type</th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Original Value</th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Resolution Policy</th>
                      <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pr-6">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-card)]">
                    {previewData.anomalies.map((anomaly: any, i: number) => {
                      const isError = anomaly.requires_review;
                      return (
                        <tr key={i} className="hover:bg-zinc-800/10 text-xs">
                          <td className="p-4 pl-6 font-mono text-[var(--color-text-muted)]">#{anomaly.row_number}</td>
                          <td className="p-4 font-semibold text-white capitalize">{anomaly.column_name || 'Row'}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              isError ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}>
                              {anomaly.anomaly_type}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-zinc-400">{anomaly.original_value || 'Empty'}</td>
                          <td className="p-4 text-white">
                            <strong>{anomaly.action_taken}</strong>
                            {anomaly.resolved_value && <span className="text-zinc-500 block mt-0.5">Resolved: "{anomaly.resolved_value}"</span>}
                          </td>
                          <td className="p-4 pr-6">
                            {isError ? (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">⚠️ Review</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1"><Check size={14} /> Auto-fixed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Nav Footer */}
            <div className="flex justify-between items-center mt-6 shrink-0">
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 py-2.5 px-5 border border-[var(--color-border-card)] hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => {
                  if (previewData.duplicatePairs.length > 0) {
                    setStep('duplicates');
                  } else {
                    setStep('confirm');
                  }
                }}
                className="flex items-center gap-1.5 py-2.5 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.15)]"
              >
                <span>Continue</span> <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resolve Duplicates */}
        {step === 'duplicates' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl mb-6 text-xs flex items-center gap-2 shrink-0">
              <Layers size={16} className="shrink-0" />
              <span>Meera's Duplicate Review Policy: You must approve each duplicate decision manually before saving.</span>
            </div>

            {/* Duplicate list */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {previewData.duplicatePairs.map((pair: any, i: number) => {
                const key = `${pair.row_a_number}-${pair.row_b_number}`;
                const decision = duplicateDecisions[key] || 'kept_both';

                const rowA = processedRows.find(r => r.rowNumber === pair.row_a_number);
                const rowB = processedRows.find(r => r.rowNumber === pair.row_b_number);

                if (!rowA || !rowB) return null;

                return (
                  <div key={i} className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-6 shadow-xl space-y-4">
                    {/* Reason */}
                    <div className="text-xs text-[var(--color-text-muted)] bg-zinc-900/30 p-3 rounded-xl border border-zinc-800/40">
                      <strong>Reason for Match:</strong> {pair.similarity_reason}
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Row A */}
                      <div className={`p-4 border rounded-xl relative ${decision === 'deleted_a' ? 'border-red-500/30 bg-red-500/5 opacity-50' : 'border-zinc-800 bg-zinc-900/10'}`}>
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-800 text-[9px] font-bold font-mono">Row #{pair.row_a_number}</div>
                        <h4 className="text-xs font-bold text-white mb-2 truncate pr-14">{rowA.description}</h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--color-text-muted)] font-mono">
                          <div>Date: <strong className="text-white">{rowA.date}</strong></div>
                          <div>Paid By: <strong className="text-white">{rowA.paid_by_name}</strong></div>
                          <div>Amount: <strong className="text-[var(--color-accent)]">₹{Number(rowA.amount).toFixed(2)}</strong></div>
                          <div>Split: <strong className="text-white capitalize">{rowA.split_type}</strong></div>
                        </div>
                      </div>

                      {/* Row B */}
                      <div className={`p-4 border rounded-xl relative ${decision === 'deleted_b' ? 'border-red-500/30 bg-red-500/5 opacity-50' : 'border-zinc-800 bg-zinc-900/10'}`}>
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-800 text-[9px] font-bold font-mono">Row #{pair.row_b_number}</div>
                        <h4 className="text-xs font-bold text-white mb-2 truncate pr-14">{rowB.description}</h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--color-text-muted)] font-mono">
                          <div>Date: <strong className="text-white">{rowB.date}</strong></div>
                          <div>Paid By: <strong className="text-white">{rowB.paid_by_name}</strong></div>
                          <div>Amount: <strong className="text-[var(--color-accent)]">₹{Number(rowB.amount).toFixed(2)}</strong></div>
                          <div>Split: <strong className="text-white capitalize">{rowB.split_type}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* Decision selector */}
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs font-semibold text-white">Action:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDuplicateDecision(key, 'kept_both')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                            decision === 'kept_both'
                              ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
                              : 'bg-zinc-800/30 border-zinc-700/30 text-[var(--color-text-muted)] hover:text-white'
                          }`}
                        >
                          Keep Both
                        </button>
                        <button
                          onClick={() => handleDuplicateDecision(key, 'deleted_a')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                            decision === 'deleted_a'
                              ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                              : 'bg-zinc-800/30 border-zinc-700/30 text-[var(--color-text-muted)] hover:text-white'
                          }`}
                        >
                          Keep Row #{pair.row_b_number} Only
                        </button>
                        <button
                          onClick={() => handleDuplicateDecision(key, 'deleted_b')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                            decision === 'deleted_b'
                              ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                              : 'bg-zinc-800/30 border-zinc-700/30 text-[var(--color-text-muted)] hover:text-white'
                          }`}
                        >
                          Keep Row #{pair.row_a_number} Only
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Nav Footer */}
            <div className="flex justify-between items-center mt-6 shrink-0">
              <button
                onClick={() => {
                  if (previewData.anomalies.length > 0) {
                    setStep('anomalies');
                  } else {
                    setStep('upload');
                  }
                }}
                className="flex items-center gap-1.5 py-2.5 px-5 border border-[var(--color-border-card)] hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="flex items-center gap-1.5 py-2.5 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.15)]"
              >
                <span>Continue</span> <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm Ingest */}
        {step === 'confirm' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            {confirmError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-xs flex items-center gap-2 shrink-0">
                <AlertOctagon size={16} />
                <span>{confirmError}</span>
              </div>
            )}

            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-6 shadow-xl mb-6 shrink-0 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-[var(--color-accent)]" size={18} />
                <span>Import Summary</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-zinc-900/15 border border-zinc-800/40 rounded-xl">
                  <span className="text-[var(--color-text-muted)] block mb-1">Total CSV Rows</span>
                  <strong className="text-white text-base font-mono">{previewData.totalRows}</strong>
                </div>
                <div className="p-3 bg-zinc-900/15 border border-zinc-800/40 rounded-xl">
                  <span className="text-[var(--color-text-muted)] block mb-1">Skipped Rows</span>
                  <strong className="text-zinc-500 text-base font-mono">{previewData.skippedRows}</strong>
                </div>
                <div className="p-3 bg-zinc-900/15 border border-zinc-800/40 rounded-xl">
                  <span className="text-[var(--color-text-muted)] block mb-1">Excluded Duplicates</span>
                  <strong className="text-rose-400 text-base font-mono">
                    {processedRows.length - getFinalRowsToImport().length}
                  </strong>
                </div>
                <div className="p-3 bg-zinc-900/15 border border-zinc-800/40 rounded-xl">
                  <span className="text-[var(--color-text-muted)] block mb-1">Expenses & Settlements to Import</span>
                  <strong className="text-[var(--color-accent)] text-base font-mono">{getFinalRowsToImport().length}</strong>
                </div>
              </div>
            </div>

            {/* List of items that will be imported */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
              <h4 className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-sidebar)]/50 border-b border-[var(--color-border-card)]">Previewing Ledger Rows</h4>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border-card)] text-[var(--color-text-muted)] bg-zinc-900/10">
                      <th className="p-3 pl-6 font-semibold uppercase tracking-wider">Date</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">Description</th>
                      <th className="p-3 font-semibold uppercase tracking-wider">Paid By</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-right">Amount</th>
                      <th className="p-3 font-semibold uppercase tracking-wider text-center">Split</th>
                      <th className="p-3 font-semibold uppercase tracking-wider pr-6">Target Members</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-card)]">
                    {getFinalRowsToImport().map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-800/10">
                        <td className="p-3 pl-6 font-mono text-[var(--color-text-muted)]">{row.date}</td>
                        <td className="p-3 font-semibold text-white">
                          {row.is_settlement ? (
                            <span className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-bold">Settlement</span>
                              {row.description}
                            </span>
                          ) : (
                            row.description
                          )}
                        </td>
                        <td className="p-3 font-medium text-white">{row.paid_by_name}</td>
                        <td className={`p-3 font-bold font-mono text-right ${row.is_refund ? 'text-rose-400' : 'text-[var(--color-accent)]'}`}>
                          {row.currency !== 'INR' && `${row.currency} ${row.amount} / `}
                          ₹{Number(row.amount * (row.currency !== 'INR' ? 83 : 1)).toFixed(2)}
                        </td>
                        <td className="p-3 text-center capitalize">{row.split_type}</td>
                        <td className="p-3 pr-6 text-[var(--color-text-muted)] truncate max-w-xs">{row.split_with_names.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Nav Footer */}
            <div className="flex justify-between items-center mt-6 shrink-0">
              <button
                onClick={() => {
                  if (previewData.duplicatePairs.length > 0) {
                    setStep('duplicates');
                  } else if (previewData.anomalies.length > 0) {
                    setStep('anomalies');
                  } else {
                    setStep('upload');
                  }
                }}
                className="flex items-center gap-1.5 py-2.5 px-5 border border-[var(--color-border-card)] hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isConfirming}
                className="flex items-center gap-1.5 py-2.5 px-6 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/50 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.15)] animate-pulse-subtle"
              >
                {isConfirming ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Commit Import</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Import Report Summary */}
        {step === 'report' && importReport && (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-8 shadow-xl max-w-2xl text-center space-y-6 animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 size={36} className="animate-bounce-subtle" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Import Completed Successfully!</h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1.5">
                We've processed the CSV and written all expenses and settlements to the database.
              </p>
            </div>

            {/* Counters Grid */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-[var(--color-border-card)]/50 text-xs">
              <div>
                <span className="text-[var(--color-text-muted)] block mb-1">Expenses Logged</span>
                <strong className="text-white text-lg font-mono">{importReport.importedCount}</strong>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] block mb-1">Rows Skipped</span>
                <strong className="text-zinc-500 text-lg font-mono">{importReport.skippedCount}</strong>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)] block mb-1">Anomalies Handled</span>
                <strong className="text-emerald-400 text-lg font-mono">{importReport.anomalyCount}</strong>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={downloadReport}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-[var(--color-border-card)] hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
              >
                <Download size={16} />
                <span>Download Report Log</span>
              </button>
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData(null);
                  setImportReport(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.15)]"
              >
                <span>Import Another CSV</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
