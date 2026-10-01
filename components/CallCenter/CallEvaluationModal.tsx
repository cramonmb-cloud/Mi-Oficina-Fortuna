import React, { useState, useEffect } from 'react';
import { 
  X, 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  PhoneOff, 
  RotateCcw, 
  Save, 
  Printer, 
  Calendar, 
  User, 
  Building2, 
  DollarSign, 
  Clock, 
  ShieldCheck,
  FileText
} from 'lucide-react';
import { CallRecord, CallQuestion, CallStatus, Employee } from '../../types';
import { downloadCallSheetPdf } from '../../services/callSheetPdfGenerator';

interface CallEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CallRecord | null;
  onSave: (record: CallRecord) => Promise<void>;
  questions: CallQuestion[];
  employees?: Employee[];
  currentUser?: Employee | null;
  companyName?: string;
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const CallEvaluationModal: React.FC<CallEvaluationModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  questions,
  employees = [],
  currentUser,
  companyName = 'Mi Oficina'
}) => {
  if (!isOpen || !record) return null;

  // Local form state
  const [callerName, setCallerName] = useState(
    record.callerName || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : '')
  );
  const [executive, setExecutive] = useState(record.executive || '');
  const [supervisor, setSupervisor] = useState(record.supervisor || '');
  const [groupName, setGroupName] = useState(record.groupName || '');
  const [clientName, setClientName] = useState(record.clientName || '');
  const [loanDate, setLoanDate] = useState(
    record.loanDate || new Date().toISOString().split('T')[0]
  );
  const [phone, setPhone] = useState(record.phone || '');
  const [loanAmount, setLoanAmount] = useState(record.loanAmount || '');
  const [clientAddress, setClientAddress] = useState(record.clientAddress || '');
  const [clientNeighborhood, setClientNeighborhood] = useState(record.clientNeighborhood || '');
  const [plaza, setPlaza] = useState(record.plaza || '');
  const [weeklyPayment, setWeeklyPayment] = useState(record.weeklyPayment || '');
  const [dueDate, setDueDate] = useState(record.dueDate || '');
  const [guarantorName, setGuarantorName] = useState(record.guarantorName || '');
  const [guarantorAddress, setGuarantorAddress] = useState(record.guarantorAddress || '');
  const [guarantorNeighborhood, setGuarantorNeighborhood] = useState(record.guarantorNeighborhood || '');
  const [guarantorPhone, setGuarantorPhone] = useState(record.guarantorPhone || '');

  // Answers State
  const [conditionsExplained, setConditionsExplained] = useState(
    record.answers?.conditionsExplained || ''
  );
  const [moneyReceivedDirectly, setMoneyReceivedDirectly] = useState(
    record.answers?.moneyReceivedDirectly || ''
  );
  const [confirmedAmount, setConfirmedAmount] = useState(
    record.answers?.confirmedAmount || (record.loanAmount ? `$${record.loanAmount}` : '')
  );
  const [paymentDayInformed, setPaymentDayInformed] = useState(
    record.answers?.paymentDayInformed || ''
  );
  const [wasSupervised, setWasSupervised] = useState(
    record.answers?.wasSupervised || ''
  );
  const [supervisorName, setSupervisorName] = useState(
    record.answers?.supervisorName || record.supervisor || ''
  );
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
    record.answers?.customAnswers || {}
  );

  const [observations, setObservations] = useState(record.observations || '');
  const [status, setStatus] = useState<CallStatus>(
    record.status === 'PENDIENTE' ? 'EXITOSA' : record.status
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if record changes
  useEffect(() => {
    if (record) {
      setCallerName(record.callerName || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : ''));
      setExecutive(record.executive || '');
      setSupervisor(record.supervisor || '');
      setGroupName(record.groupName || '');
      setClientName(record.clientName || '');
      setLoanDate(record.loanDate || new Date().toISOString().split('T')[0]);
      setPhone(record.phone || '');
      setLoanAmount(record.loanAmount || '');
      setClientAddress(record.clientAddress || '');
      setClientNeighborhood(record.clientNeighborhood || '');
      setPlaza(record.plaza || '');
      setWeeklyPayment(record.weeklyPayment || '');
      setDueDate(record.dueDate || '');
      setGuarantorName(record.guarantorName || '');
      setGuarantorAddress(record.guarantorAddress || '');
      setGuarantorNeighborhood(record.guarantorNeighborhood || '');
      setGuarantorPhone(record.guarantorPhone || '');
      setConditionsExplained(record.answers?.conditionsExplained || '');
      setMoneyReceivedDirectly(record.answers?.moneyReceivedDirectly || '');
      setConfirmedAmount(record.answers?.confirmedAmount || (record.loanAmount ? `$${record.loanAmount}` : ''));
      setPaymentDayInformed(record.answers?.paymentDayInformed || '');
      setWasSupervised(record.answers?.wasSupervised || '');
      setSupervisorName(record.answers?.supervisorName || record.supervisor || '');
      setCustomAnswers(record.answers?.customAnswers || {});
      setObservations(record.observations || '');
      setStatus(record.status === 'PENDIENTE' ? 'EXITOSA' : record.status);
    }
  }, [record, currentUser]);

  const handleCustomAnswerChange = (qId: string, val: string) => {
    setCustomAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSave = async () => {
    if (!clientName.trim()) {
      alert('Por favor especifica el nombre del cliente');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const updatedRecord: CallRecord = {
        ...record,
        callerName: callerName.trim(),
        executive: executive.trim(),
        supervisor: supervisor.trim(),
        groupName: groupName.trim(),
        plaza: plaza.trim(),
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim(),
        clientNeighborhood: clientNeighborhood.trim(),
        loanDate,
        dueDate,
        phone: phone.trim(),
        loanAmount,
        weeklyPayment,
        guarantorName: guarantorName.trim(),
        guarantorAddress: guarantorAddress.trim(),
        guarantorNeighborhood: guarantorNeighborhood.trim(),
        guarantorPhone: guarantorPhone.trim(),
        callDate: record.callDate || now.toISOString().split('T')[0],
        callTime: record.callTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status,
        answers: {
          conditionsExplained,
          moneyReceivedDirectly,
          confirmedAmount,
          paymentDayInformed,
          wasSupervised,
          supervisorName,
          customAnswers
        },
        observations: observations.trim(),
        updatedAt: now.toISOString()
      };

      await onSave(updatedRecord);
      onClose();
    } catch (err) {
      console.error('Error saving call:', err);
      alert('Hubo un error al guardar la evaluación de la llamada.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    const previewRecord: CallRecord = {
      ...record,
      callerName: callerName.trim(),
      executive: executive.trim(),
      supervisor: supervisor.trim(),
      groupName: groupName.trim(),
      plaza: plaza.trim(),
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      clientNeighborhood: clientNeighborhood.trim(),
      loanDate,
      dueDate,
      phone: phone.trim(),
      loanAmount,
      weeklyPayment,
      guarantorName: guarantorName.trim(),
      guarantorAddress: guarantorAddress.trim(),
      guarantorNeighborhood: guarantorNeighborhood.trim(),
      guarantorPhone: guarantorPhone.trim(),
      status,
      answers: {
        conditionsExplained,
        moneyReceivedDirectly,
        confirmedAmount,
        paymentDayInformed,
        wasSupervised,
        supervisorName,
        customAnswers
      },
      observations: observations.trim()
    };

    downloadCallSheetPdf({
      record: previewRecord,
      companyName,
      questions
    });
  };

  const cleanDigits = (phone || '').replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-end shrink-0 bg-white">
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          
          {/* Quick Call / WhatsApp Bar */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Contacto con el Cliente:</p>
                <p className="text-sm font-black text-slate-900 font-mono tracking-wider">
                  {phone || 'Sin número registrado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cleanDigits ? (
                <>
                  <a
                    href={`tel:${cleanDigits}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" /> Llamar
                  </a>
                  <a
                    href={`https://wa.me/52${cleanDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-md font-medium">
                  Agrega un teléfono para llamar con un clic
                </span>
              )}
            </div>
          </div>

          {/* Form Header Table (Exact Representation of the Paper Document) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
            <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
              <span className="text-xs font-black tracking-wider uppercase text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" /> Datos Generales de la Ficha
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {record.sourcePdfName ? `Lote: ${record.sourcePdfName}` : 'Registro'}
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              
              {/* QUIEN LLAMÓ */}
              <div className="grid grid-cols-1 sm:grid-cols-4">
                <div className="bg-slate-50 px-3.5 py-2.5 sm:border-r border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center">
                  QUIEN LLAMÓ:
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    placeholder="Nombre de quien realizó la llamada"
                    className="w-full px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* EJECUTIVO */}
              <div className="grid grid-cols-1 sm:grid-cols-4">
                <div className="bg-slate-50 px-3.5 py-2.5 sm:border-r border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center">
                  EJECUTIVO:
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={executive}
                    onChange={(e) => setExecutive(e.target.value)}
                    placeholder="Nombre del ejecutivo / asesor"
                    className="w-full px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* SUPERVISORA */}
              <div className="grid grid-cols-1 sm:grid-cols-4">
                <div className="bg-slate-50 px-3.5 py-2.5 sm:border-r border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center">
                  SUPERVISORA:
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={supervisor}
                    onChange={(e) => {
                      setSupervisor(e.target.value);
                      if (!supervisorName) setSupervisorName(e.target.value);
                    }}
                    placeholder="Nombre de la supervisora"
                    className="w-full px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* GRUPO & PLAZA */}
              <div className="grid grid-cols-1 sm:grid-cols-4">
                <div className="bg-slate-50 px-3.5 py-2.5 sm:border-r border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center">
                  GRUPO:
                </div>
                <div className="sm:col-span-3 p-1.5 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nombre o número de grupo"
                    className="flex-1 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden transition-all"
                  />
                  {plaza && (
                    <div className="flex items-center gap-1.5 px-2 bg-slate-100 rounded-md shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">PLAZA:</span>
                      <input
                        type="text"
                        value={plaza}
                        onChange={(e) => setPlaza(e.target.value)}
                        placeholder="Plaza"
                        className="w-28 text-xs font-semibold text-slate-800 bg-transparent outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* CLIENTE */}
              <div className="grid grid-cols-1 sm:grid-cols-4">
                <div className="bg-slate-50 px-3.5 py-2.5 sm:border-r border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center">
                  CLIENTE:
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nombre completo del cliente"
                    className="w-full px-3 py-1.5 text-sm font-black text-slate-900 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* DIRECCIÓN Y COLONIA CLIENTE */}
              <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="sm:col-span-3 bg-slate-50 px-3.5 py-2.5 font-bold text-xs text-slate-700 uppercase flex items-center">
                  DIRECCIÓN:
                </div>
                <div className="sm:col-span-5 p-1.5">
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Calle y número del cliente"
                    className="w-full px-2.5 py-1 text-xs text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden"
                  />
                </div>
                <div className="sm:col-span-1 bg-slate-100 px-2 py-2.5 font-bold text-[11px] text-slate-700 uppercase flex items-center justify-center">
                  COL:
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={clientNeighborhood}
                    onChange={(e) => setClientNeighborhood(e.target.value)}
                    placeholder="Colonia / Municipio"
                    className="w-full px-2.5 py-1 text-xs text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden"
                  />
                </div>
              </div>

              {/* FECHA DE PRESTAMO & TEL */}
              <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="sm:col-span-3 bg-slate-50 px-3.5 py-2.5 font-bold text-xs text-slate-700 uppercase flex items-center">
                  FECHA DE PRESTAMO
                </div>
                <div className="sm:col-span-3 p-1.5">
                  <input
                    type="text"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-2.5 py-1 text-xs font-medium text-slate-800 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden"
                  />
                </div>
                <div className="sm:col-span-2 bg-slate-100 px-3 py-2.5 font-black text-xs text-slate-800 uppercase flex items-center justify-center">
                  TEL:
                </div>
                <div className="sm:col-span-4 p-1.5">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10 dígitos"
                    className="w-full px-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-md outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* DATOS DEL AVAL (Extracted from Sheet) */}
              {(guarantorName || guarantorPhone || guarantorAddress) && (
                <div className="bg-slate-50/80 p-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" /> Datos del Aval:
                    </span>
                    {guarantorPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${guarantorPhone.replace(/\D/g, '')}`}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-bold rounded flex items-center gap-1"
                          title="Llamar al Aval"
                        >
                          <Phone className="w-3 h-3" /> Llamar Aval
                        </a>
                        <a
                          href={`https://wa.me/52${guarantorPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white text-[10.5px] font-bold rounded flex items-center gap-1"
                          title="WhatsApp al Aval"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp Aval
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">NOMBRE DEL AVAL:</span>
                      <input
                        type="text"
                        value={guarantorName}
                        onChange={(e) => setGuarantorName(e.target.value)}
                        placeholder="Nombre completo del aval"
                        className="w-full font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">DIRECCIÓN & COLONIA AVAL:</span>
                      <input
                        type="text"
                        value={[guarantorAddress, guarantorNeighborhood].filter(Boolean).join(', ')}
                        onChange={(e) => setGuarantorAddress(e.target.value)}
                        placeholder="Dirección del aval"
                        className="w-full text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block">TELÉFONO AVAL:</span>
                      <input
                        type="tel"
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                        placeholder="Teléfono del aval"
                        className="w-full font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Quality Questions Section (From image) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
            <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
              <span className="text-xs font-black tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Cuestionario de Calidad y Verificación
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Respuestas del Cliente</span>
            </div>

            <div className="divide-y divide-slate-200">
              
              {/* Question 1: ¿Le explicaron las condiciones de su crédito? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-xs text-slate-800 flex-1">
                  ¿Le explicaron las condiciones de su crédito?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {['Sí', 'No', 'Parcialmente'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setConditionsExplained(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        conditionsExplained === opt
                          ? opt === 'Sí' ? 'bg-emerald-600 text-white shadow-xs' : opt === 'No' ? 'bg-rose-600 text-white shadow-xs' : 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2: ¿Usted recibió directamente el dinero? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-xs text-slate-800 flex-1">
                  ¿Usted recibió directamente el dinero?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {['Sí', 'No'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setMoneyReceivedDirectly(opt)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        moneyReceivedDirectly === opt
                          ? opt === 'Sí' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 3: ¿De cuánto fue su crédito? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1">
                  <span className="font-bold text-xs text-slate-800 block">
                    ¿De cuánto fue su crédito?
                  </span>
                  {loanAmount && (
                    <span className="text-[11px] text-slate-500">
                      Monto según hoja semanal: <strong className="text-indigo-600">${loanAmount}</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value)}
                    placeholder="Monto confirmado por el cliente"
                    className="w-48 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white outline-hidden"
                  />
                  {loanAmount && (
                    <button
                      type="button"
                      onClick={() => setConfirmedAmount(`$${loanAmount} (Coincide)`)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                      title="Copiar monto de la hoja"
                    >
                      Coincide
                    </button>
                  )}
                </div>
              </div>

              {/* Question 4: ¿Le comentaron qué día debe realizar su pago? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-xs text-slate-800 flex-1">
                  ¿Le comentaron qué día debe realizar su pago?
                </span>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaymentDayInformed(paymentDayInformed === 'No' ? '' : 'No')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentDayInformed === 'No' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    No
                  </button>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setPaymentDayInformed(paymentDayInformed === day ? '' : day)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paymentDayInformed === day
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 5: ¿Le supervisaron? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-xs text-slate-800 flex-1">
                  ¿Le supervisaron?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {['Sí', 'No'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWasSupervised(opt)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        wasSupervised === opt
                          ? opt === 'Sí' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 6: ¿Quién lo supervisó? */}
              <div className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="font-bold text-xs text-slate-800 flex-1">
                  ¿Quién lo supervisó?
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="Nombre de quien supervisó"
                    className="w-56 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white outline-hidden"
                  />
                  {supervisor && (
                    <button
                      type="button"
                      onClick={() => setSupervisorName(supervisor)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                      title="Usar supervisora asignada"
                    >
                      Misma supervisora
                    </button>
                  )}
                </div>
              </div>

              {/* Additional Custom Questions if configured */}
              {questions.filter(q => !q.isDefault && q.isActive).map(q => (
                <div key={q.id} className="p-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4 hover:bg-slate-50/50 transition-colors">
                  <span className="font-bold text-xs text-slate-800 flex-1">
                    {q.question}
                  </span>
                  <div className="shrink-0">
                    {q.type === 'boolean' ? (
                      <div className="flex items-center gap-1.5">
                        {['Sí', 'No'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleCustomAnswerChange(q.id, opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              customAnswers[q.id] === opt
                                ? opt === 'Sí' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => handleCustomAnswerChange(q.id, e.target.value)}
                        placeholder="Respuesta del cliente"
                        className="w-56 px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white outline-hidden"
                      />
                    )}
                  </div>
                </div>
              ))}

            </div>
          </div>

          {/* OBSERVACIONES (Textarea from image) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
            <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-300 font-bold text-xs uppercase tracking-wider text-slate-700">
              OBSERVACIONES:
            </div>
            <div className="p-2">
              <textarea
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Anota aquí cualquier hallazgo, comentario del cliente o detalle relevante de la llamada..."
                className="w-full p-2.5 text-xs font-medium text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:bg-white outline-hidden resize-y"
              />
            </div>
          </div>

          {/* Call Outcome Status Selector */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Resultado Final de la Llamada:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'EXITOSA', label: 'Exitosa / Aprobada', icon: CheckCircle2, color: 'emerald' },
                { id: 'CON_OBSERVACIONES', label: 'Con Observaciones', icon: AlertTriangle, color: 'amber' },
                { id: 'NO_CONTESTO', label: 'No Contestó', icon: PhoneOff, color: 'slate' },
                { id: 'NUMERO_EQUIVOCADO', label: 'Núm. Equivocado', icon: X, color: 'rose' },
                { id: 'VOLVER_A_LLAMAR', label: 'Volver a Llamar', icon: RotateCcw, color: 'indigo' },
              ].map(item => {
                const Icon = item.icon;
                const isSel = status === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatus(item.id as CallStatus)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSel 
                        ? item.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : item.color === 'amber' ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                        : item.color === 'rose' ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                        : item.color === 'indigo' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-700/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[11px] text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Descargar Hoja PDF
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar Evaluación'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
