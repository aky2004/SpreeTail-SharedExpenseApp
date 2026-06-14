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
    const reportText = `SPREETAIL IMPORT SUMMARY REPORT
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
    link.setAttribute('download', `spreetail_import_report_${importReport.importLogId}.txt`);
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
      <div className="animate-fade-in flex-1 flex flex-col min-h-0 font-inter" style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Progress Bar Header */}
        <div className="shrink-0 mb-8">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="section-label">Import</span>
            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#334155' }} />
            <span className="section-label" style={{ color: '#6366f1' }}>{currentGroup.name}</span>
          </div>
          <h1 className="page-title">CSV Bill Importer</h1>
          <p className="text-[13px] mt-1" style={{ color: '#475569' }}>
            Ingest and trace spreadsheet data with automatic anomaly policies.
          </p>

          {/* Stepper HUD */}
          {step !== 'report' && (
            <div
              className="flex items-center gap-2 mt-6 p-2 rounded-2xl w-full"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className={`flex-1 py-2 text-center text-[12px] font-semibold rounded-xl transition-all ${step === 'upload' ? 'bg-[#6366f1] text-white shadow-lg' : 'text-[#64748b]'}`}>Upload</div>
              <ChevronRight size={14} style={{ color: '#475569' }} className="shrink-0" />
              <div className={`flex-1 py-2 text-center text-[12px] font-semibold rounded-xl transition-all ${step === 'anomalies' ? 'bg-[#6366f1] text-white shadow-lg' : 'text-[#64748b]'}`}>Anomalies</div>
              <ChevronRight size={14} style={{ color: '#475569' }} className="shrink-0" />
              <div className={`flex-1 py-2 text-center text-[12px] font-semibold rounded-xl transition-all ${step === 'duplicates' ? 'bg-[#6366f1] text-white shadow-lg' : 'text-[#64748b]'}`}>Duplicates</div>
              <ChevronRight size={14} style={{ color: '#475569' }} className="shrink-0" />
              <div className={`flex-1 py-2 text-center text-[12px] font-semibold rounded-xl transition-all ${step === 'confirm' ? 'bg-[#6366f1] text-white shadow-lg' : 'text-[#64748b]'}`}>Confirm</div>
            </div>
          )}
        </div>

        {/* Step 1: Upload Form */}
        {step === 'upload' && (
          <div className="animate-fade-in hover-lift flex flex-col items-center justify-center" style={{
            padding: '64px 32px', width: '100%', flex: 1,
            background: 'rgba(13,13,28,0.9)', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset'
          }}>
            <div className="w-full max-w-2xl">
            <h2 className="text-[17px] font-bold text-white mb-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                <UploadCloud size={16} style={{ color: '#818cf8' }} />
              </div>
              <span>Upload expenses_export.csv</span>
            </h2>
            <p className="text-[13px] mb-6 mt-2" style={{ color: '#475569' }}>
              Drop the Spreetail spreadsheet exports directly. No manual edits are required before uploading.
            </p>

            {uploadError && (
              <div
                className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-[12px]"
                style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
              >
                <AlertOctagon size={14} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-6">
              <label
                className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
                style={{
                  borderColor: file ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
                  background: file ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = file ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = file ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)';
                }}
              >
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <FileSpreadsheet style={{ color: '#818cf8', marginBottom: '12px' }} size={36} />
                <span className="text-[14px] font-semibold text-white">
                  {file ? file.name : 'Select expenses_export.csv'}
                </span>
                <span className="text-[11px] mt-1.5 font-medium uppercase tracking-wider" style={{ color: '#475569' }}>
                  {file ? `Size: ${(file.size / 1024).toFixed(1)} KB` : 'Click to browse files'}
                </span>
              </label>

              <button
                type="submit"
                disabled={!file || isUploading}
                className="btn-primary w-full py-3.5"
              >
                {isUploading ? (
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                ) : (
                  <span>Ingest Spreadsheet</span>
                )}
              </button>
            </form>
            </div>
          </div>
        )}

        {/* Step 2: Review Anomalies */}
        {step === 'anomalies' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-[12px] shrink-0"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
            >
              <AlertTriangle size={15} />
              <span>We detected <strong>{previewData.anomalyCount} data anomalies</strong> in the CSV file. Review resolved actions below.</span>
            </div>

            {/* Anomaly list */}
            <div className="animate-fade-in hover-lift" style={{
              background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
              display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #f59e0b 0%, #f59e0b60 40%, transparent 100%)', zIndex: 20 }} />
              <div className="overflow-y-auto flex-1">
                <table className="data-table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="pl-6">Row</th>
                      <th>Column</th>
                      <th>Issue Type</th>
                      <th>Original Value</th>
                      <th>Resolution Policy</th>
                      <th className="pr-6">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.anomalies.map((anomaly: any, i: number) => {
                      const isError = anomaly.requires_review;
                      return (
                        <tr key={i}>
                          <td className="pl-6 mono text-[12px]" style={{ color: '#64748b' }}>#{anomaly.row_number}</td>
                          <td className="font-semibold text-white capitalize">{anomaly.column_name || 'Row'}</td>
                          <td>
                            <span className={`badge ${isError ? 'badge-amber' : 'badge-emerald'}`}>
                              {anomaly.anomaly_type}
                            </span>
                          </td>
                          <td className="mono text-[12px]" style={{ color: '#64748b' }}>{anomaly.original_value || 'Empty'}</td>
                          <td>
                            <strong className="text-[13px] text-white font-medium">{anomaly.action_taken}</strong>
                            {anomaly.resolved_value && <span className="text-[11px] block mt-0.5" style={{ color: '#475569' }}>Resolved: "{anomaly.resolved_value}"</span>}
                          </td>
                          <td className="pr-6">
                            {isError ? (
                              <span className="font-semibold flex items-center gap-1.5" style={{ color: '#f59e0b', fontSize: '12px' }}>
                                <AlertTriangle size={13} /> Review
                              </span>
                            ) : (
                              <span className="font-semibold flex items-center gap-1.5" style={{ color: '#10b981', fontSize: '12px' }}>
                                <Check size={13} /> Auto-fixed
                              </span>
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
              <button onClick={() => setStep('upload')} className="btn-ghost">
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
                className="btn-primary"
              >
                <span>Continue</span> <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resolve Duplicates */}
        {step === 'duplicates' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-[12px] shrink-0"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
            >
              <Layers size={15} className="shrink-0" />
              <span>Review Policy: You must approve each duplicate decision manually before saving.</span>
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
                  <div key={i} className="animate-fade-in hover-lift" style={{
                    padding: '24px', background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
                  }}>
                    {/* Reason */}
                    <div className="text-[12px] p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', color: '#94a3b8' }}>
                      <strong className="text-white font-medium">Reason for Match:</strong> {pair.similarity_reason}
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Row A */}
                      <div
                        className="p-4 rounded-xl relative transition-all"
                        style={{
                          background: decision === 'deleted_a' ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.02)',
                          border: decision === 'deleted_a' ? '1px solid rgba(244,63,94,0.2)' : '1px solid rgba(255,255,255,0.05)',
                          opacity: decision === 'deleted_a' ? 0.6 : 1,
                        }}
                      >
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: 'rgba(255,255,255,0.05)' }}>Row #{pair.row_a_number}</div>
                        <h4 className="text-[13px] font-bold text-white mb-2 truncate pr-14">{rowA.description}</h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono" style={{ color: '#64748b' }}>
                          <div>Date: <strong className="text-white">{rowA.date}</strong></div>
                          <div>Paid By: <strong className="text-white">{rowA.paid_by_name}</strong></div>
                          <div>Amount: <strong style={{ color: '#10b981' }}>₹{Number(rowA.amount).toFixed(2)}</strong></div>
                          <div>Split: <strong className="text-white capitalize">{rowA.split_type}</strong></div>
                        </div>
                      </div>

                      {/* Row B */}
                      <div
                        className="p-4 rounded-xl relative transition-all"
                        style={{
                          background: decision === 'deleted_b' ? 'rgba(244,63,94,0.04)' : 'rgba(255,255,255,0.02)',
                          border: decision === 'deleted_b' ? '1px solid rgba(244,63,94,0.2)' : '1px solid rgba(255,255,255,0.05)',
                          opacity: decision === 'deleted_b' ? 0.6 : 1,
                        }}
                      >
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: 'rgba(255,255,255,0.05)' }}>Row #{pair.row_b_number}</div>
                        <h4 className="text-[13px] font-bold text-white mb-2 truncate pr-14">{rowB.description}</h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono" style={{ color: '#64748b' }}>
                          <div>Date: <strong className="text-white">{rowB.date}</strong></div>
                          <div>Paid By: <strong className="text-white">{rowB.paid_by_name}</strong></div>
                          <div>Amount: <strong style={{ color: '#10b981' }}>₹{Number(rowB.amount).toFixed(2)}</strong></div>
                          <div>Split: <strong className="text-white capitalize">{rowB.split_type}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* Decision selector */}
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-[12px] font-semibold text-white">Action:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDuplicateDecision(key, 'kept_both')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all"
                          style={{
                            background: decision === 'kept_both' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                            borderColor: decision === 'kept_both' ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                            color: decision === 'kept_both' ? '#818cf8' : '#64748b',
                          }}
                        >
                          Keep Both
                        </button>
                        <button
                          onClick={() => handleDuplicateDecision(key, 'deleted_a')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all"
                          style={{
                            background: decision === 'deleted_a' ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.03)',
                            borderColor: decision === 'deleted_a' ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.06)',
                            color: decision === 'deleted_a' ? '#fb7185' : '#64748b',
                          }}
                        >
                          Keep Row #{pair.row_b_number} Only
                        </button>
                        <button
                          onClick={() => handleDuplicateDecision(key, 'deleted_b')}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all"
                          style={{
                            background: decision === 'deleted_b' ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.03)',
                            borderColor: decision === 'deleted_b' ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.06)',
                            color: decision === 'deleted_b' ? '#fb7185' : '#64748b',
                          }}
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
                className="btn-ghost"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setStep('confirm')} className="btn-primary">
                <span>Continue</span> <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm Ingest */}
        {step === 'confirm' && previewData && (
          <div className="flex-1 flex flex-col min-h-0">
            {confirmError && (
              <div
                className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-[12px]"
                style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
              >
                <AlertOctagon size={15} />
                <span>{confirmError}</span>
              </div>
            )}

            <div className="animate-fade-in hover-lift" style={{
              padding: '24px', background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
              marginBottom: '24px', flexShrink: 0
            }}>
              <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                <span>Import Summary</span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="block mb-1" style={{ color: '#64748b' }}>Total CSV Rows</span>
                  <strong className="text-white text-[17px] font-mono">{previewData.totalRows}</strong>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="block mb-1" style={{ color: '#64748b' }}>Skipped Rows</span>
                  <strong className="text-[17px] font-mono" style={{ color: '#475569' }}>{previewData.skippedRows}</strong>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.15)' }}>
                  <span className="block mb-1" style={{ color: '#fb7185' }}>Excluded Duplicates</span>
                  <strong className="text-[17px] font-mono" style={{ color: '#f43f5e' }}>
                    {processedRows.length - getFinalRowsToImport().length}
                  </strong>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <span className="block mb-1" style={{ color: '#818cf8' }}>Expenses to Import</span>
                  <strong className="text-[17px] font-mono" style={{ color: '#6366f1' }}>{getFinalRowsToImport().length}</strong>
                </div>
              </div>
            </div>

            {/* List of items that will be imported */}
            <div className="animate-fade-in hover-lift" style={{
              background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
              display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #6366f1 0%, #6366f160 40%, transparent 100%)', zIndex: 20 }} />
              <h4 className="p-4 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                Previewing Ledger Rows
              </h4>
              <div className="overflow-y-auto flex-1">
                <table className="data-table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="pl-6">Date</th>
                      <th>Description</th>
                      <th>Paid By</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Split</th>
                      <th className="pr-6">Target Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFinalRowsToImport().map((row, i) => (
                      <tr key={i}>
                        <td className="pl-6 mono text-[12px]" style={{ color: '#64748b' }}>{row.date}</td>
                        <td className="font-semibold text-white">
                          {row.is_settlement ? (
                            <span className="flex items-center gap-1.5">
                              <span className="badge badge-emerald">Settlement</span>
                              {row.description}
                            </span>
                          ) : (
                            row.description
                          )}
                        </td>
                        <td className="text-[13px]">{row.paid_by_name}</td>
                        <td className={`font-bold font-mono text-[13px] text-right ${row.is_refund ? 'text-[#f43f5e]' : 'text-[#10b981]'}`}>
                          {row.currency !== 'INR' && `${row.currency} ${row.amount} / `}
                          ₹{Number(row.amount * (row.currency !== 'INR' ? 83 : 1)).toFixed(2)}
                        </td>
                        <td className="text-center capitalize text-[12px]">{row.split_type}</td>
                        <td className="pr-6 text-[12px] truncate max-w-xs" style={{ color: '#64748b' }}>{row.split_with_names.join('; ')}</td>
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
                className="btn-ghost"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isConfirming}
                className="btn-primary"
              >
                {isConfirming ? (
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                ) : (
                  <span>Commit Import</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Import Report Summary */}
        {step === 'report' && importReport && (
          <div className="animate-scale-in hover-lift" style={{
            padding: '40px', maxWidth: '672px', textAlign: 'center', margin: '0 auto',
            background: 'rgba(13,13,28,0.9)', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset'
          }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
            >
              <CheckCircle2 size={32} className="animate-bounce-subtle" />
            </div>

            <div>
              <h2 className="text-[22px] font-bold text-white tracking-tight">Import Completed!</h2>
              <p className="text-[13px] mt-2" style={{ color: '#475569' }}>
                We've processed the CSV and written all expenses and settlements to the database.
              </p>
            </div>

            {/* Counters Grid */}
            <div className="grid grid-cols-3 gap-4 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#64748b' }}>Expenses Logged</span>
                <strong className="text-white text-[24px] font-mono">{importReport.importedCount}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#64748b' }}>Rows Skipped</span>
                <strong className="text-[24px] font-mono" style={{ color: '#475569' }}>{importReport.skippedCount}</strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: '#10b981' }}>Anomalies Handled</span>
                <strong className="text-[24px] font-mono" style={{ color: '#10b981' }}>{importReport.anomalyCount}</strong>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button onClick={downloadReport} className="btn-ghost flex-1 py-3.5">
                <Download size={15} />
                <span>Download Report Log</span>
              </button>
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setPreviewData(null);
                  setImportReport(null);
                }}
                className="btn-primary flex-1 py-3.5"
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
