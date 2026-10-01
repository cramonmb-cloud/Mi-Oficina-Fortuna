import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneCall, 
  Upload, 
  Plus, 
  FileSpreadsheet, 
  Settings, 
  Search, 
  Calendar, 
  Filter, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  PhoneOff, 
  RotateCcw, 
  Printer, 
  Trash2, 
  ExternalLink, 
  Users, 
  Building2, 
  Clock, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Check, 
  ChevronRight,
  Sparkles,
  FileText,
  SlidersHorizontal,
  RefreshCw,
  X,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

import { 
  CallRecord, 
  CallBatch, 
  CallQuestion, 
  CallStatus, 
  Employee,
  CallCenterPermissions 
} from '../../types';
import { 
  subscribeToCallRecords, 
  saveCallRecord, 
  updateCallRecord, 
  deleteCallRecord, 
  subscribeToCallBatches, 
  saveCallBatch, 
  deleteCallBatch, 
  subscribeToCallQuestions, 
  saveCallQuestionsToCloud, 
  getDefaultCallQuestions,
  subscribeToCallCenterPermissions 
} from '../../services/dbService';
import { exportCallRecordsToExcel } from '../../services/callCenterExcelExport';
import { downloadCallSheetPdf } from '../../services/callSheetPdfGenerator';

import { CallEvaluationModal } from './CallEvaluationModal';
import { ImportWeeklySheetsModal } from './ImportWeeklySheetsModal';
import { ConfigureQuestionsModal } from './ConfigureQuestionsModal';
import { CallCenterPermissionsModal } from './CallCenterPermissionsModal';

interface CallCenterProps {
  currentUser?: Employee | null;
  employees?: Employee[];
  companyName?: string;
  companyLogoUrl?: string;
}

const STATUS_CONFIG: Record<CallStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  PENDIENTE: { label: 'Pendiente', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', icon: Clock },
  EXITOSA: { label: 'Exitosa / Aprobada', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', icon: CheckCircle2 },
  CON_OBSERVACIONES: { label: 'Con Observaciones', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', icon: AlertTriangle },
  NO_CONTESTO: { label: 'No Contestó', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300', icon: PhoneOff },
  NUMERO_EQUIVOCADO: { label: 'Núm. Equivocado', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', icon: PhoneOff },
  VOLVER_A_LLAMAR: { label: 'Volver a Llamar', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', icon: RotateCcw }
};

export const CallCenter: React.FC<CallCenterProps> = ({
  currentUser,
  employees = [],
  companyName = 'Mi Oficina',
  companyLogoUrl
}) => {
  // Cloud Data State
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [batches, setBatches] = useState<CallBatch[]>([]);
  const [questions, setQuestions] = useState<CallQuestion[]>(getDefaultCallQuestions());
  const [isLoading, setIsLoading] = useState(true);

  // Permissions & Multi-User State
  const [permissions, setPermissions] = useState<CallCenterPermissions>({ allowedUserIds: [], updatedAt: '', updatedBy: '' });
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [viewScope, setViewScope] = useState<'mis_llamadas' | 'todo_el_equipo'>('mis_llamadas');
  const [selectedAdvisorFilter, setSelectedAdvisorFilter] = useState<string>('TODOS');

  // SuperAdmin (Cristobal 0120) and Global Supervisor Access
  const isSuperAdmin = currentUser?.accessCode === '0120';
  const hasGlobalAccess = isSuperAdmin || Boolean(currentUser?.id && permissions.allowedUserIds?.includes(currentUser.id));

  // Active Sub-tab: 'llamadas' | 'lotes' | 'estadisticas'
  const [activeSubTab, setActiveSubTab] = useState<'llamadas' | 'lotes' | 'estadisticas'>('llamadas');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isQuestionsModalOpen, setIsQuestionsModalOpen] = useState(false);
  const [isNewManualModalOpen, setIsNewManualModalOpen] = useState(false);
  const [selectedRecordForEvaluation, setSelectedRecordForEvaluation] = useState<CallRecord | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [dateFilter, setDateFilter] = useState<string>('TODAS'); // 'TODAS' | 'HOY' | 'ESTA_SEMANA' | 'ESTE_MES' | 'PERSONALIZADA'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [executiveFilter, setExecutiveFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');

  // Manual New Call State
  const [manualClientName, setManualClientName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualNeighborhood, setManualNeighborhood] = useState('');
  const [manualPlaza, setManualPlaza] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualGroupName, setManualGroupName] = useState('');
  const [manualExecutive, setManualExecutive] = useState('');
  const [manualSupervisor, setManualSupervisor] = useState('');
  const [manualLoanDate, setManualLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualLoanAmount, setManualLoanAmount] = useState('');
  const [manualGuarantorName, setManualGuarantorName] = useState('');
  const [manualGuarantorPhone, setManualGuarantorPhone] = useState('');

  // Real-time Firestore Subscriptions
  useEffect(() => {
    setIsLoading(true);

    const unsubRecords = subscribeToCallRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    }, (err) => {
      console.error("Error loading call records:", err);
      setIsLoading(false);
    });

    const unsubBatches = subscribeToCallBatches((data) => {
      setBatches(data);
    }, (err) => console.error("Error loading batches:", err));

    const unsubQuestions = subscribeToCallQuestions((data) => {
      if (data && data.length > 0) setQuestions(data);
    }, (err) => console.error("Error loading questions:", err));

    const unsubPermissions = subscribeToCallCenterPermissions((data) => {
      setPermissions(data);
    }, (err) => console.error("Error loading permissions:", err));

    return () => {
      unsubRecords();
      unsubBatches();
      unsubQuestions();
      unsubPermissions();
    };
  }, []);

  // Authorship verification helpers
  const isMyRecord = (r: CallRecord): boolean => {
    if (!currentUser) return true;
    if (r.userId && r.userId === currentUser.id) return true;
    if (r.userAccessCode && r.userAccessCode === currentUser.accessCode) return true;
    const currentFullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
    if (r.callerName && r.callerName.trim().toLowerCase() === currentFullName) return true;
    // Fallback for previous legacy records before userId was tracked
    if (!r.userId && isSuperAdmin) return true;
    return false;
  };

  const isMyBatch = (b: CallBatch): boolean => {
    if (!currentUser) return true;
    if (b.userId && b.userId === currentUser.id) return true;
    const currentFullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
    if (b.createdByName && b.createdByName.trim().toLowerCase() === currentFullName) return true;
    if (!b.userId && isSuperAdmin) return true;
    return false;
  };

  // Unique Advisors list
  const advisorOptions = useMemo(() => {
    const fromRecords = records.map(r => r.callerName).filter(Boolean) as string[];
    return Array.from(new Set(fromRecords)).sort();
  }, [records]);

  // Scoped records: Respects personal control ("Mis Llamadas") vs Supervisor Global ("Ver Todo el Equipo")
  const scopedRecords = useMemo(() => {
    if (!hasGlobalAccess || viewScope === 'mis_llamadas') {
      return records.filter(isMyRecord);
    }
    if (selectedAdvisorFilter !== 'TODOS') {
      return records.filter(r => (r.callerName || 'Sin Asignar') === selectedAdvisorFilter);
    }
    return records;
  }, [records, hasGlobalAccess, viewScope, selectedAdvisorFilter, currentUser, isSuperAdmin]);

  // Scoped batches: Respects personal control vs Global
  const scopedBatches = useMemo(() => {
    if (!hasGlobalAccess || viewScope === 'mis_llamadas') {
      return batches.filter(isMyBatch);
    }
    if (selectedAdvisorFilter !== 'TODOS') {
      return batches.filter(b => (b.createdByName || 'Sin Asignar') === selectedAdvisorFilter);
    }
    return batches;
  }, [batches, hasGlobalAccess, viewScope, selectedAdvisorFilter, currentUser, isSuperAdmin]);

  // Filtered Records calculation
  const filteredRecords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate week start (Monday)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 for Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const mondayStr = monday.toISOString().split('T')[0];

    const currentYearMonth = today.substring(0, 7);

    return scopedRecords.filter(r => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = r.clientName.toLowerCase().includes(query);
        const matchesPhone = r.phone.includes(query);
        const matchesGroup = (r.groupName || '').toLowerCase().includes(query);
        const matchesExec = (r.executive || '').toLowerCase().includes(query);
        const matchesSup = (r.supervisor || '').toLowerCase().includes(query);
        const matchesCaller = (r.callerName || '').toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesGroup && !matchesExec && !matchesSup && !matchesCaller) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'TODOS' && r.status !== statusFilter) {
        return false;
      }

      // 3. Executive Filter
      if (executiveFilter && r.executive !== executiveFilter) {
        return false;
      }

      // 4. Supervisor Filter
      if (supervisorFilter && r.supervisor !== supervisorFilter) {
        return false;
      }

      // 5. Date Filter (matches either callDate, batchDate, or createdAt)
      const recordDate = r.callDate || r.batchDate || r.createdAt.split('T')[0];
      if (dateFilter === 'HOY') {
        if (recordDate !== today) return false;
      } else if (dateFilter === 'ESTA_SEMANA') {
        if (recordDate < mondayStr || recordDate > today) return false;
      } else if (dateFilter === 'ESTE_MES') {
        if (!recordDate.startsWith(currentYearMonth)) return false;
      } else if (dateFilter === 'PERSONALIZADA') {
        if (customStartDate && recordDate < customStartDate) return false;
        if (customEndDate && recordDate > customEndDate) return false;
      }

      return true;
    });
  }, [
    scopedRecords, 
    searchQuery, 
    statusFilter, 
    dateFilter, 
    customStartDate, 
    customEndDate, 
    executiveFilter, 
    supervisorFilter
  ]);

  // Executive and Supervisor options from employees
  const executiveOptions = useMemo(() => {
    const fromRecords = Array.from(new Set(scopedRecords.map(r => r.executive).filter(Boolean))) as string[];
    const fromEmployees = employees.filter(e => e.category === 'Ejecutivos').map(e => `${e.firstName} ${e.lastName}`.trim());
    return Array.from(new Set([...fromRecords, ...fromEmployees])).sort();
  }, [scopedRecords, employees]);

  const supervisorOptions = useMemo(() => {
    const fromRecords = Array.from(new Set(scopedRecords.map(r => r.supervisor).filter(Boolean))) as string[];
    const fromEmployees = employees.filter(e => e.category === 'Supervisoras').map(e => `${e.firstName} ${e.lastName}`.trim());
    return Array.from(new Set([...fromRecords, ...fromEmployees])).sort();
  }, [scopedRecords, employees]);

  // Overall KPIs calculated from the active scope
  const stats = useMemo(() => {
    const total = scopedRecords.length;
    const completed = scopedRecords.filter(r => r.status !== 'PENDIENTE').length;
    const pending = scopedRecords.filter(r => r.status === 'PENDIENTE').length;
    const exitosas = scopedRecords.filter(r => r.status === 'EXITOSA').length;
    const conObservaciones = scopedRecords.filter(r => r.status === 'CON_OBSERVACIONES').length;
    const noContactados = scopedRecords.filter(r => r.status === 'NO_CONTESTO' || r.status === 'NUMERO_EQUIVOCADO').length;
    
    // Quality Compliance (% of completed calls that are successful)
    const qualityRate = completed > 0 ? Math.round((exitosas / (exitosas + conObservaciones || 1)) * 100) : 0;
    const contactRate = completed > 0 ? Math.round(((completed - noContactados) / completed) * 100) : 0;

    return {
      total,
      completed,
      pending,
      exitosas,
      conObservaciones,
      noContactados,
      qualityRate,
      contactRate
    };
  }, [scopedRecords]);

  // Analytics Chart Data
  const chartsData = useMemo(() => {
    // 1. Quality Compliance per Question
    const answeredCalls = scopedRecords.filter(r => r.status === 'EXITOSA' || r.status === 'CON_OBSERVACIONES');
    
    const conditionsCount = answeredCalls.filter(r => r.answers?.conditionsExplained === 'Sí').length;
    const directMoneyCount = answeredCalls.filter(r => r.answers?.moneyReceivedDirectly === 'Sí').length;
    const paymentDayCount = answeredCalls.filter(r => r.answers?.paymentDayInformed && r.answers.paymentDayInformed !== 'No').length;
    const supervisedCount = answeredCalls.filter(r => r.answers?.wasSupervised === 'Sí').length;

    const complianceByQuestion = [
      { name: 'Condiciones explicadas', si: conditionsCount, total: answeredCalls.length },
      { name: 'Dinero directo', si: directMoneyCount, total: answeredCalls.length },
      { name: 'Día de pago informado', si: paymentDayCount, total: answeredCalls.length },
      { name: 'Supervisión realizada', si: supervisedCount, total: answeredCalls.length },
    ];

    // 2. Status distribution
    const statusDistribution = [
      { name: 'Exitosas', value: stats.exitosas, color: '#10b981' },
      { name: 'Con Obs.', value: stats.conObservaciones, color: '#f59e0b' },
      { name: 'Pendientes', value: stats.pending, color: '#64748b' },
      { name: 'No Contestó', value: stats.noContactados, color: '#0ea5e9' },
    ].filter(i => i.value > 0);

    return {
      complianceByQuestion,
      statusDistribution
    };
  }, [scopedRecords, stats]);

  // Handlers
  const handleOpenEvaluation = (record: CallRecord) => {
    setSelectedRecordForEvaluation(record);
    setIsEvaluationModalOpen(true);
  };

  const handleSaveEvaluation = async (updatedRecord: CallRecord) => {
    await updateCallRecord(updatedRecord.id, updatedRecord);
    setIsEvaluationModalOpen(false);
  };

  const handleDeleteRecord = async (id: string, clientName: string) => {
    if (confirm(`¿Eliminar el registro de llamada de "${clientName}"?`)) {
      await deleteCallRecord(id);
    }
  };

  const handleConfirmImport = async (
    batchData: Omit<CallBatch, 'id'>, 
    recordsToCreate: Omit<CallRecord, 'id'>[]
  ) => {
    await saveCallBatch(batchData, recordsToCreate);
    setIsImportModalOpen(false);
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (confirm('¿Eliminar este lote de Hojas de Semana y sus llamadas asociadas?')) {
      await deleteCallBatch(batchId);
    }
  };

  const handleCreateManualCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientName.trim()) {
      alert('Especifica el nombre del cliente');
      return;
    }

    const now = new Date();
    const newRecord: Omit<CallRecord, 'id'> = {
      clientName: manualClientName.trim(),
      clientAddress: manualAddress.trim(),
      clientNeighborhood: manualNeighborhood.trim(),
      plaza: manualPlaza.trim(),
      phone: manualPhone.trim(),
      groupName: manualGroupName.trim() || 'General',
      executive: manualExecutive.trim(),
      supervisor: manualSupervisor.trim(),
      loanDate: manualLoanDate,
      loanAmount: manualLoanAmount.trim(),
      guarantorName: manualGuarantorName.trim(),
      guarantorPhone: manualGuarantorPhone.trim(),
      batchDate: now.toISOString().split('T')[0],
      status: 'PENDIENTE',
      userId: currentUser?.id || 'admin_master',
      userAccessCode: currentUser?.accessCode || '',
      callerName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Cristobal Moran',
      answers: {
        conditionsExplained: '',
        moneyReceivedDirectly: '',
        confirmedAmount: manualLoanAmount.trim() ? `$${manualLoanAmount.trim()}` : '',
        paymentDayInformed: '',
        wasSupervised: '',
        supervisorName: manualSupervisor.trim(),
        customAnswers: {}
      },
      observations: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const newId = await saveCallRecord(newRecord);
    setIsNewManualModalOpen(false);
    // Reset fields
    setManualClientName('');
    setManualAddress('');
    setManualNeighborhood('');
    setManualPlaza('');
    setManualPhone('');
    setManualGroupName('');
    setManualLoanAmount('');
    setManualGuarantorName('');
    setManualGuarantorPhone('');

    // Open evaluation right away
    handleOpenEvaluation({ id: newId, ...newRecord });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in text-slate-800">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <PhoneCall className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Call Center
          </h1>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Botón exclusivo para Cristóbal (0120): Gestionar quién puede ver todo */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setIsPermissionsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Gestionar qué colaboradores de oficina pueden ver el historial de todo el equipo"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Gestionar Accesos</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Hojas de Semana</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Llamada</span>
          </button>

          <button
            type="button"
            onClick={() => exportCallRecordsToExcel(filteredRecords, questions)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Exportar a Microsoft Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQuestionsModalOpen(true)}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Configurar Preguntas de Calidad"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selector de Historial: "Mis Llamadas" vs "Ver Todo el Equipo" (Solo visible para Cristóbal y supervisores autorizados) */}
      {hasGlobalAccess && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Historial:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setViewScope('mis_llamadas');
                  setSelectedAdvisorFilter('TODOS');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewScope === 'mis_llamadas'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mis Llamadas ({records.filter(isMyRecord).length})
              </button>
              <button
                type="button"
                onClick={() => setViewScope('todo_el_equipo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewScope === 'todo_el_equipo'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ver Todo el Equipo ({records.length})
              </button>
            </div>
          </div>

          {viewScope === 'todo_el_equipo' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-slate-500 font-medium">Asesor:</span>
                <select
                  value={selectedAdvisorFilter}
                  onChange={(e) => setSelectedAdvisorFilter(e.target.value)}
                  className="font-bold text-slate-800 bg-transparent outline-none cursor-pointer text-xs"
                >
                  <option value="TODOS">Todos los asesores ({records.length})</option>
                  {advisorOptions.map(name => {
                    const count = records.filter(r => r.callerName === name).length;
                    return (
                      <option key={name} value={name}>{name} ({count})</option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Clientes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {viewScope === 'mis_llamadas' ? 'Mis Clientes' : 'Total Clientes'}
          </span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {stats.total}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            {viewScope === 'mis_llamadas' ? 'En tu lista' : 'En todo el sistema'}
          </span>
        </div>

        {/* Realizadas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            Realizadas
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            {stats.completed}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% de avance` : '0%'}
          </span>
        </div>

        {/* Pendientes */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
            Pendientes
          </span>
          <p className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
            {stats.pending}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            Por marcar
          </span>
        </div>

        {/* Exitosas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
            {viewScope === 'mis_llamadas' ? 'Tus Aprobadas' : 'Aprobadas'}
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
            {stats.exitosas}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            Sin fallas
          </span>
        </div>

        {/* Sin Contacto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
            No Contactados
          </span>
          <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            {stats.noContactados}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">
            Buzón / Equivocado
          </span>
        </div>

        {/* Calidad Rate */}
        <div className="bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
            Calidad Global
          </span>
          <p className="text-xl sm:text-2xl font-black text-indigo-950 mt-1">
            {stats.qualityRate}%
          </p>
          <span className="text-[10px] text-indigo-700 font-medium">
            Índice de satisfacción
          </span>
        </div>

      </div>

      {/* Sub-tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          type="button"
          onClick={() => setActiveSubTab('llamadas')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${
            activeSubTab === 'llamadas'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Lista de Llamadas ({filteredRecords.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('lotes')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer ${
            activeSubTab === 'lotes'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Lotes de Hojas de Semana ({scopedBatches.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('estadisticas')}
          className={`pb-3 text-xs sm:text-sm font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'estadisticas'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Estadísticas y Calidad
        </button>
      </div>

      {/* TAB 1: LISTA DE LLAMADAS */}
      {activeSubTab === 'llamadas' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por cliente, teléfono, grupo, asesor..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 outline-hidden"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 outline-hidden"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="EXITOSA">Exitosa / Aprobada</option>
                  <option value="CON_OBSERVACIONES">Con Observaciones</option>
                  <option value="NO_CONTESTO">No Contestó</option>
                  <option value="NUMERO_EQUIVOCADO">Número Equivocado</option>
                  <option value="VOLVER_A_LLAMAR">Volver a Llamar</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:border-indigo-500 outline-hidden"
                >
                  <option value="TODAS">Cualquier Fecha</option>
                  <option value="HOY">Hoy</option>
                  <option value="ESTA_SEMANA">Esta Semana</option>
                  <option value="ESTE_MES">Este Mes</option>
                  <option value="PERSONALIZADA">Rango Personalizado</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-center justify-end">
                {(searchQuery || statusFilter !== 'TODOS' || dateFilter !== 'TODAS' || executiveFilter || supervisorFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('TODOS');
                      setDateFilter('TODAS');
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setExecutiveFilter('');
                      setSupervisorFilter('');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* Custom Date Range if active */}
            {dateFilter === 'PERSONALIZADA' && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-600">Desde:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <span className="font-bold text-slate-600">Hasta:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            )}
          </div>

          {/* Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-medium">Cargando registros de llamadas...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No hay llamadas en esta vista
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {records.length === 0 
                    ? 'Comienza importando tus Hojas de Semana en PDF para sortear los primeros clientes.' 
                    : 'Prueba cambiando los filtros de búsqueda.'}
                </p>
                {records.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-500 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Importar Hojas de Semana
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                    <tr>
                      <th className="py-3 px-4">Cliente / Contacto</th>
                      {hasGlobalAccess && viewScope === 'todo_el_equipo' && (
                        <th className="py-3 px-3">Asesor Responsable</th>
                      )}
                      <th className="py-3 px-3">Grupo</th>
                      <th className="py-3 px-3">Ejecutivo / Supervisora</th>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Calidad / Ficha</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map(record => {
                      const cleanDigits = (record.phone || '').replace(/\D/g, '');
                      const statusInfo = STATUS_CONFIG[record.status] || STATUS_CONFIG.PENDIENTE;
                      const StatusIcon = statusInfo.icon;

                      return (
                        <tr 
                          key={record.id} 
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Cliente & Contacto */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-xs">
                              {record.clientName}
                            </div>

                            {/* Dirección y Colonia */}
                            {(record.clientAddress || record.clientNeighborhood) && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                📍 {[record.clientAddress, record.clientNeighborhood].filter(Boolean).join(', ')}
                              </p>
                            )}

                            {/* Teléfono & Acciones Rápidas */}
                            <div className="flex items-center gap-2 mt-0.5">
                              {record.phone ? (
                                <span className="font-mono text-[11px] text-slate-600 font-bold">
                                  {record.phone}
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-600 italic">Sin teléfono</span>
                              )}

                              {cleanDigits && (
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`tel:${cleanDigits}`}
                                    className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Marcar teléfono del cliente"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                  <a
                                    href={`https://wa.me/52${cleanDigits}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                                    title="Enviar WhatsApp al cliente"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Aval info */}
                            {record.guarantorName && (
                              <div className="mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-700">Aval:</span> {record.guarantorName}
                                {record.guarantorPhone && (
                                  <span className="font-mono text-slate-500 ml-1">({record.guarantorPhone})</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Asesor Responsable (visible solo en vista de Todo el Equipo) */}
                          {hasGlobalAccess && viewScope === 'todo_el_equipo' && (
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-black shrink-0">
                                  {(record.callerName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-800 text-xs truncate max-w-[120px]" title={record.callerName}>
                                  {record.callerName || 'Sin asignar'}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Grupo & Plaza */}
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">
                              {record.groupName || 'General'}
                            </span>
                            {record.plaza && (
                              <span className="text-[10px] text-slate-400 block font-medium">
                                Plaza: {record.plaza}
                              </span>
                            )}
                            {record.loanAmount && (
                              <span className="text-[11px] text-indigo-600 font-bold block mt-0.5">
                                ${record.loanAmount}
                              </span>
                            )}
                          </td>

                          {/* Ejecutivo / Supervisora */}
                          <td className="py-3 px-3 text-[11.5px]">
                            <div className="font-medium text-slate-800">
                              {record.executive || <span className="text-slate-400 italic">Sin asesor</span>}
                            </div>
                            <div className="text-slate-400 text-[10.5px]">
                              {record.supervisor ? `Sup: ${record.supervisor}` : ''}
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="py-3 px-3 text-[11px] font-mono text-slate-600">
                            {record.callDate || record.batchDate || record.createdAt.split('T')[0]}
                            {record.callTime && (
                              <span className="text-slate-400 text-[10px] block font-sans">
                                {record.callTime}
                              </span>
                            )}
                          </td>

                          {/* Mini Quality Indicators */}
                          <td className="py-3 px-3">
                            {record.status === 'PENDIENTE' ? (
                              <span className="text-[11px] text-slate-400 italic">Por evaluar</span>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[10.5px]">
                                <span 
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    record.answers?.conditionsExplained === 'Sí' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                  }`}
                                  title="¿Condiciones explicadas?"
                                >
                                  Cond
                                </span>
                                <span 
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    record.answers?.moneyReceivedDirectly === 'Sí' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                  }`}
                                  title="¿Dinero directo?"
                                >
                                  Din
                                </span>
                                <span 
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    record.answers?.wasSupervised === 'Sí' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                  }`}
                                  title="¿Supervisado?"
                                >
                                  Sup
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEvaluation(record)}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                  record.status === 'PENDIENTE'
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                }`}
                              >
                                {record.status === 'PENDIENTE' ? 'Evaluar' : 'Ver Ficha'}
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadCallSheetPdf({ record, companyName, questions })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Descargar Formato en PDF"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(record.id, record.clientName)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: LOTES DE HOJAS DE SEMANA */}
      {activeSubTab === 'lotes' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Importaciones de Hojas de Semana
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada lote contiene los PDFs de los grupos subidos y sus clientes sorteados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Subir Nuevo Lote
            </button>
          </div>

          {scopedBatches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {viewScope === 'todo_el_equipo' ? 'No hay lotes registrados por el equipo' : 'No tienes lotes importados aún'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {viewScope === 'todo_el_equipo'
                  ? 'Ningún usuario del equipo ha importado lotes con los filtros seleccionados.'
                  : 'Sube tus PDFs semanales para que el sistema seleccione automáticamente a los clientes.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scopedBatches.map(batch => {
                const batchRecords = scopedRecords.filter(r => r.batchId === batch.id);
                const completedInBatch = batchRecords.filter(r => r.status !== 'PENDIENTE').length;
                const totalInBatch = batchRecords.length || batch.selectedClientsCount;
                const pct = totalInBatch > 0 ? Math.round((completedInBatch / totalInBatch) * 100) : 0;

                return (
                  <div 
                    key={batch.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          Lote del {batch.date}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {batch.groupsCount} Grupos ({batch.selectedClientsCount} Llamadas)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Eliminar lote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>Progreso de llamadas</span>
                        <span>{completedInBatch} de {totalInBatch} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* PDF Names Pills */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Archivos PDF ({batch.pdfNames?.length || 0}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(batch.pdfNames || []).slice(0, 3).map((pdf, pIdx) => (
                          <span 
                            key={pIdx}
                            className="text-[10.5px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium truncate max-w-[180px]"
                            title={pdf}
                          >
                            {pdf}
                          </span>
                        ))}
                        {(batch.pdfNames || []).length > 3 && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">
                            +{(batch.pdfNames || []).length - 3} más
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Importado por: <strong>{batch.createdByName || 'Usuario'}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setDateFilter('TODAS');
                          setStatusFilter('TODOS');
                          setActiveSubTab('llamadas');
                        }}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Ver clientes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ESTADÍSTICAS Y CALIDAD */}
      {activeSubTab === 'estadisticas' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Chart 1: Quality Compliance by Question */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cumplimiento por Pregunta de Calidad {viewScope === 'todo_el_equipo' ? '(Equipo)' : '(Mis Llamadas)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Porcentaje de clientes que respondieron afirmativamente {viewScope === 'todo_el_equipo' ? 'en todas las llamadas' : 'en tus llamadas'}
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.complianceByQuestion}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="si" name="Respuestas Conformes" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Call Status Distribution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Distribución de Estados de Llamada {viewScope === 'todo_el_equipo' ? '(Equipo)' : '(Mis Llamadas)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resultados del seguimiento telefónico {viewScope === 'todo_el_equipo' ? 'global' : 'individual'}
                </p>
              </div>

              <div className="h-64 flex items-center justify-center">
                {chartsData.statusDistribution.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin datos suficientes para graficar</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartsData.statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {chartsData.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* MODAL 1: Evaluation Modal */}
      <CallEvaluationModal
        isOpen={isEvaluationModalOpen}
        onClose={() => {
          setIsEvaluationModalOpen(false);
          setSelectedRecordForEvaluation(null);
        }}
        record={selectedRecordForEvaluation}
        onSave={handleSaveEvaluation}
        questions={questions}
        employees={employees}
        currentUser={currentUser}
        companyName={companyName}
      />

      {/* MODAL 2: Import Weekly Sheets Modal */}
      <ImportWeeklySheetsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleConfirmImport}
        currentUser={currentUser}
      />

      {/* MODAL 3: Configure Questions Modal */}
      <ConfigureQuestionsModal
        isOpen={isQuestionsModalOpen}
        onClose={() => setIsQuestionsModalOpen(false)}
        questions={questions}
        onSaveQuestions={async (updatedQs) => {
          await saveCallQuestionsToCloud(updatedQs);
          setQuestions(updatedQs);
        }}
      />

      {/* MODAL 4: Manual Call Creation Modal */}
      {isNewManualModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Nueva Ficha de Llamada Manual
              </h3>
              <button 
                onClick={() => setIsNewManualModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCall} className="p-5 space-y-3.5 text-xs text-slate-700">
              <div>
                <label className="font-bold text-slate-800 block mb-1">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  value={manualClientName}
                  onChange={(e) => setManualClientName(e.target.value)}
                  placeholder="Ej: MARÍA LÓPEZ HERNÁNDEZ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Teléfono (10 dígitos)</label>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="3411234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Monto de Crédito</label>
                  <input
                    type="text"
                    value={manualLoanAmount}
                    onChange={(e) => setManualLoanAmount(e.target.value)}
                    placeholder="10,000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Dirección y Colonia del Cliente */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Dirección (Calle y No.)</label>
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Calle 13 de Septiembre 548"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Colonia / Municipio</label>
                  <input
                    type="text"
                    value={manualNeighborhood}
                    onChange={(e) => setManualNeighborhood(e.target.value)}
                    placeholder="Villa de Álvarez"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Grupo</label>
                  <input
                    type="text"
                    value={manualGroupName}
                    onChange={(e) => setManualGroupName(e.target.value)}
                    placeholder="Ej: ANA VALLE"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Plaza</label>
                  <input
                    type="text"
                    value={manualPlaza}
                    onChange={(e) => setManualPlaza(e.target.value)}
                    placeholder="Ej: YULI COLIMA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Ejecutivo / Asesor</label>
                  <input
                    type="text"
                    value={manualExecutive}
                    onChange={(e) => setManualExecutive(e.target.value)}
                    placeholder="Nombre del ejecutivo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Supervisora</label>
                  <input
                    type="text"
                    value={manualSupervisor}
                    onChange={(e) => setManualSupervisor(e.target.value)}
                    placeholder="Nombre supervisora"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Datos del Aval */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="text-[11px] font-bold text-slate-600 block">Datos del Aval:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualGuarantorName}
                    onChange={(e) => setManualGuarantorName(e.target.value)}
                    placeholder="Nombre del Aval"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:border-indigo-500 outline-hidden"
                  />
                  <input
                    type="tel"
                    value={manualGuarantorPhone}
                    onChange={(e) => setManualGuarantorPhone(e.target.value)}
                    placeholder="Teléfono del Aval"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-mono focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Fecha de Préstamo</label>
                <input
                  type="date"
                  value={manualLoanDate}
                  onChange={(e) => setManualLoanDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewManualModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Crear e Iniciar Evaluación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Gestionar Permisos (Exclusivo Cristóbal 0120) */}
      {isSuperAdmin && (
        <CallCenterPermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          currentPermissions={permissions}
          currentUserName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : 'Cristóbal Ramón Morán'}
        />
      )}

    </div>
  );
};
