import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  Shuffle, 
  Check, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Users, 
  ArrowRight, 
  Building2, 
  Phone,
  DollarSign,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { WeeklySheetGroup, WeeklySheetExtractedClient, CallRecord, CallBatch, Employee } from '../../types';
import { 
  processWeeklySheetPdf, 
  distributeAndSelectClients 
} from '../../services/pdfWeeklySheetService';

interface ImportWeeklySheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (batchData: Omit<CallBatch, 'id'>, records: Omit<CallRecord, 'id'>[]) => Promise<void>;
  currentUser?: Employee | null;
}

export const ImportWeeklySheetsModal: React.FC<ImportWeeklySheetsModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  currentUser
}) => {
  if (!isOpen) return null;

  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Extracted Groups
  const [groups, setGroups] = useState<WeeklySheetGroup[]>([]);
  const [targetCount, setTargetCount] = useState<number>(5);
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const convertPdfDateToIso = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (selected.length === 0) {
        alert('Por favor selecciona archivos en formato PDF.');
        return;
      }
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartExtraction = async () => {
    if (files.length === 0) {
      alert('Agrega al menos una Hoja de Semana en PDF');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPercent(0);

    const extractedGroups: WeeklySheetGroup[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentProcessingFile(file.name);
        setProgressPercent(Math.round(((i) / files.length) * 100));

        // Always parse locally based on Presta table layout (no AI)
        const groupResult = await processWeeklySheetPdf(file, false);
        extractedGroups.push(groupResult);
      }

      setProgressPercent(100);

      // Automatically set the Batch Date from the PDF's Fecha (loanDate)
      const foundLoanDate = extractedGroups.find(g => g.loanDate)?.loanDate;
      if (foundLoanDate) {
        const isoDate = convertPdfDateToIso(foundLoanDate);
        if (isoDate) {
          setBatchDate(isoDate);
        }
      }

      // Perform initial balanced random selection
      const balancedGroups = distributeAndSelectClients(extractedGroups, targetCount);
      setGroups(balancedGroups);
    } catch (err: any) {
      console.error('Error during PDF processing:', err);
      setErrorMsg(err.message || 'Error al procesar los archivos PDF.');
    } finally {
      setIsProcessing(false);
      setCurrentProcessingFile('');
    }
  };

  const handleReroll = () => {
    if (groups.length === 0) return;
    const rebalanced = distributeAndSelectClients(groups, targetCount);
    setGroups(rebalanced);
  };

  const handleToggleClientSelection = (groupId: string, clientId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const updatedClients = g.clients.map(c => 
        c.id === clientId ? { ...c, isSelected: !c.isSelected } : c
      );
      const selCount = updatedClients.filter(c => c.isSelected).length;
      return {
        ...g,
        clients: updatedClients,
        selectedCount: selCount
      };
    }));
  };

  // Total selected across all groups
  const totalSelected = groups.reduce((acc, g) => 
    acc + g.clients.filter(c => c.isSelected).length, 0
  );

  const totalClientsFound = groups.reduce((acc, g) => 
    acc + g.clients.length, 0
  );

  const handleConfirm = async () => {
    if (totalSelected === 0) {
      alert('Debes seleccionar al menos 1 cliente para llamar.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const recordsToCreate: Omit<CallRecord, 'id'>[] = [];

      groups.forEach(g => {
        g.clients.filter(c => c.isSelected).forEach(c => {
          recordsToCreate.push({
            batchDate,
            status: 'PENDIENTE',
            userId: currentUser?.id || 'admin_master',
            userAccessCode: currentUser?.accessCode || '',
            callerName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Cristobal Moran',
            executive: g.executive || '',
            supervisor: g.supervisor || '',
            groupName: g.groupName || 'Grupo',
            plaza: g.plaza || '',
            clientName: c.name,
            clientAddress: c.address || '',
            clientNeighborhood: c.neighborhood || '',
            loanDate: c.loanDate || g.loanDate || batchDate,
            dueDate: c.dueDate || g.dueDate || '',
            phone: c.phone || '',
            loanAmount: c.amount || g.amount || '',
            weeklyPayment: c.weeklyPayment || '',
            guarantorName: c.guarantorName || '',
            guarantorAddress: c.guarantorAddress || '',
            guarantorNeighborhood: c.guarantorNeighborhood || '',
            guarantorPhone: c.guarantorPhone || '',
            sourcePdfName: g.fileName,
            answers: {
              conditionsExplained: '',
              moneyReceivedDirectly: '',
              confirmedAmount: (c.amount || g.amount) ? `$${c.amount || g.amount}` : '',
              paymentDayInformed: c.paymentDay || '',
              wasSupervised: '',
              supervisorName: g.supervisor || '',
              customAnswers: {}
            },
            observations: '',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          });
        });
      });

      const batchData: Omit<CallBatch, 'id'> = {
        date: batchDate,
        pdfNames: files.map(f => f.name),
        groupsCount: groups.length,
        totalClientsFound,
        selectedClientsCount: recordsToCreate.length,
        userId: currentUser?.id || 'admin_master',
        createdByName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Cristobal Moran',
        createdAt: now.toISOString()
      };

      await onConfirmImport(batchData, recordsToCreate);
      onClose();
    } catch (err) {
      console.error('Error saving imported batch:', err);
      alert('Error al guardar el lote de llamadas importadas.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Importar Hojas de Semana (PDF)
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          
          {/* STEP 1: Upload Files Area */}
          {groups.length === 0 ? (
            <div className="space-y-4">
              
              {/* Dropzone Container */}
              <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-6 text-center transition-all">
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  multiple 
                  id="weekly-sheets-input"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label 
                  htmlFor="weekly-sheets-input" 
                  className="cursor-pointer flex flex-col items-center justify-center gap-2.5"
                >
                  <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600 hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                    Seleccionar Archivos PDF
                  </span>
                </label>
              </div>

              {/* Uploaded Files Pill List */}
              {files.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Archivos seleccionados ({files.length}):</span>
                    <button 
                      onClick={() => setFiles([])} 
                      className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold"
                    >
                      Limpiar lista
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-lg text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="font-medium text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection Options */}
              <div className="pt-1">
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Clientes a Seleccionar:</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min={1} 
                        max={30} 
                        value={targetCount} 
                        onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 5))}
                        className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md w-16"
                      />
                      <span className="text-[11px] text-slate-500">
                        {files.length === 5 ? '(1 por cada uno de los 5 grupos)' : `(distribuidos entre los ${files.length || 'N'} PDFs)`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Processing Progress Indicator */}
              {isProcessing && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      Procesando archivo: {currentProcessingFile}...
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  {errorMsg}
                </div>
              )}

              {/* Process Button */}
              <button
                type="button"
                onClick={handleStartExtraction}
                disabled={files.length === 0 || isProcessing}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando PDFs y seleccionando clientes...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Procesar Hojas y Seleccionar {targetCount} Clientes al Azar
                  </>
                )}
              </button>

            </div>
          ) : (
            
            /* STEP 2: Review and Confirm Selection */
            <div className="space-y-4">
              
              {/* Top Banner with Stats & Re-Roll Button */}
              <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    {totalSelected} Clientes Seleccionados para Llamar
                  </h3>

                  {batchDate && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-slate-500 font-medium">Semana:</span>
                      <strong className="text-slate-900">{batchDate}</strong>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReroll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                    title="Vuelve a realizar el sorteo aleatorio"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                    Volver a Sortear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGroups([]);
                      setFiles([]);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-semibold"
                  >
                    Subir otros PDFs
                  </button>
                </div>
              </div>

              {/* Group Cards */}
              <div className="space-y-3">
                {groups.map((group, gIdx) => {
                  const selectedClientsInGroup = group.clients.filter(c => c.isSelected);
                  return (
                    <div 
                      key={group.id} 
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs"
                    >
                      {/* Group Header */}
                      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                            {gIdx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 uppercase tracking-tight">
                              {group.groupName}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-2">
                              ({group.fileName})
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600">
                          {group.plaza && (
                            <span className="text-[11px] font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md">
                              Plaza: {group.plaza}
                            </span>
                          )}
                          {group.executive && (
                            <span className="text-[11px] font-medium hidden sm:inline">
                              Ejecutivo: <strong>{group.executive}</strong>
                            </span>
                          )}
                          {group.amount && (
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                              Monto: {group.amount}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                            {selectedClientsInGroup.length} seleccionado(s) de {group.clients.length}
                          </span>
                        </div>
                      </div>

                      {/* Clients in this Group */}
                      <div className="p-3 divide-y divide-slate-100">
                        {group.clients.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 text-center">
                            No se detectaron clientes legibles en este PDF. Puedes agregarlos manualmente.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {group.clients.map(client => {
                              const isSel = client.isSelected;
                              return (
                                <div
                                  key={client.id}
                                  onClick={() => handleToggleClientSelection(group.id, client.id)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                                    isSel
                                      ? 'bg-emerald-50/90 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                    isSel ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                                  }`}>
                                    {isSel && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-start justify-between gap-1">
                                      <p className={`text-xs leading-tight ${isSel ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                                        {client.name}
                                      </p>
                                      {client.weeklyPayment && (
                                        <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded shrink-0">
                                          Abona: ${client.weeklyPayment}
                                        </span>
                                      )}
                                    </div>

                                    {/* Dirección y Colonia */}
                                    {(client.address || client.neighborhood) && (
                                      <p className="text-[11px] text-slate-500 truncate">
                                        📍 {[client.address, client.neighborhood].filter(Boolean).join(', ')}
                                      </p>
                                    )}

                                    {/* Teléfono Cliente */}
                                    <div className="flex items-center gap-2 text-[11px]">
                                      {client.phone ? (
                                        <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                                          <Phone className="w-3 h-3 text-slate-400" />
                                          {client.phone}
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 italic">Sin teléfono</span>
                                      )}
                                    </div>

                                    {/* Aval */}
                                    {client.guarantorName && (
                                      <div className="pt-1 border-t border-slate-200/60 text-[10.5px] text-slate-500">
                                        <span className="font-semibold text-slate-700">Aval:</span> {client.guarantorName}
                                        {client.guarantorPhone && (
                                          <span className="font-mono text-slate-600 ml-1">({client.guarantorPhone})</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {groups.length > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving || totalSelected === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando Lote...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar e Integrar {totalSelected} Clientes a Llamadas
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
