import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Pencil, 
  Search, 
  Filter, 
  X, 
  Calendar, 
  Upload, 
  FileText, 
  Download, 
  Paperclip,
  Star,
  Sun,
  CalendarDays,
  User,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ListTodo,
  LayoutGrid,
  Send,
  Sparkles,
  ExternalLink,
  MoreVertical,
  Check,
  Tag,
  ArrowRight
} from 'lucide-react';
import { Task, TaskStatus, Employee, TaskStep } from '../types';
import { addTask, updateTaskStatus, deleteTask, updateTask } from '../services/dbService';

interface TasksProps {
  tasks: Task[];
  employees: Employee[];
  isLoading?: boolean;
  currentUser?: Employee;
}

type SmartListType = 'my_day' | 'important' | 'planned' | 'assigned_to_me' | 'all';

export const Tasks: React.FC<TasksProps> = ({ tasks, employees, isLoading, currentUser }) => {
  // Pestaña inteligente activa
  const [activeSmartList, setActiveSmartList] = useState<SmartListType>('my_day');
  
  // Vista: 'todo' (Microsoft To Do) o 'kanban' (Tablero)
  const [viewMode, setViewMode] = useState<'todo' | 'kanban'>('todo');

  // Tarea actualmente seleccionada para el panel lateral de detalles
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Estados de búsqueda y filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  // Estado del acordeón de completadas
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  // =========================================================
  // INPUT RÁPIDO "AGREGAR UNA TAREA" (ESTILO MICROSOFT TO DO)
  // =========================================================
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDueDate, setQuickDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quickAssignedTo, setQuickAssignedTo] = useState<string>('');
  const [quickPriority, setQuickPriority] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [quickIsImportant, setQuickIsImportant] = useState<boolean>(false);
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState<boolean>(false);

  // Subpaso en edición en el panel lateral
  const [newStepTitle, setNewStepTitle] = useState('');

  // Tarea activa seleccionada
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // =========================================================
  // FILTRADO INTELIGENTE DE TAREAS (SMART LISTS)
  // =========================================================
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Filtro por Lista Inteligente
      let matchesSmartList = true;
      const isTaskImportant = task.isImportant === true || task.priority === 'Alta';
      const isTaskInMyDay = task.isMyDay === true || task.dueDate === todayStr;

      if (activeSmartList === 'my_day') {
        matchesSmartList = isTaskInMyDay;
      } else if (activeSmartList === 'important') {
        matchesSmartList = isTaskImportant;
      } else if (activeSmartList === 'planned') {
        matchesSmartList = Boolean(task.dueDate);
      } else if (activeSmartList === 'assigned_to_me') {
        if (currentUser) {
          matchesSmartList = task.assignedTo === currentUser.id || 
                             task.assignedTo === `${currentUser.firstName} ${currentUser.lastName}`.trim();
        } else {
          matchesSmartList = Boolean(task.assignedTo);
        }
      } else if (activeSmartList === 'all') {
        matchesSmartList = true;
      }

      // 2. Filtro de búsqueda
      const matchesSearch = searchTerm.trim() === '' || 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // 3. Filtro por Asignado
      const matchesAssignee = filterAssignee === 'all' || task.assignedTo === filterAssignee;

      // 4. Filtro por Prioridad
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

      return matchesSmartList && matchesSearch && matchesAssignee && matchesPriority;
    });
  }, [tasks, activeSmartList, searchTerm, filterAssignee, filterPriority, todayStr, currentUser]);

  // División entre pendientes y completadas
  const pendingTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status !== TaskStatus.DONE);
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status === TaskStatus.DONE);
  }, [filteredTasks]);

  // Conteo para los badges de las Listas Inteligentes
  const counts = useMemo(() => {
    const myDayCount = tasks.filter(t => t.status !== TaskStatus.DONE && (t.isMyDay || t.dueDate === todayStr)).length;
    const importantCount = tasks.filter(t => t.status !== TaskStatus.DONE && (t.isImportant || t.priority === 'Alta')).length;
    const plannedCount = tasks.filter(t => t.status !== TaskStatus.DONE && Boolean(t.dueDate)).length;
    const assignedCount = currentUser
      ? tasks.filter(t => t.status !== TaskStatus.DONE && (t.assignedTo === currentUser.id || t.assignedTo === `${currentUser.firstName} ${currentUser.lastName}`.trim())).length
      : tasks.filter(t => t.status !== TaskStatus.DONE && Boolean(t.assignedTo)).length;
    const allCount = tasks.filter(t => t.status !== TaskStatus.DONE).length;

    return {
      my_day: myDayCount,
      important: importantCount,
      planned: plannedCount,
      assigned_to_me: assignedCount,
      all: allCount
    };
  }, [tasks, todayStr, currentUser]);

  // =========================================================
  // ACCIONES RÁPIDAS
  // =========================================================
  const handleQuickAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickTitle.trim()) return;

    const newTaskData: Omit<Task, 'id'> = {
      title: quickTitle.trim(),
      description: '',
      status: TaskStatus.TODO,
      priority: activeSmartList === 'important' ? 'Alta' : quickPriority,
      dueDate: activeSmartList === 'my_day' ? todayStr : (quickDueDate || todayStr),
      assignedTo: quickAssignedTo || (activeSmartList === 'assigned_to_me' && currentUser ? currentUser.id : ''),
      isImportant: activeSmartList === 'important' || quickIsImportant,
      isMyDay: activeSmartList === 'my_day' || quickDueDate === todayStr,
      steps: [],
      createdAt: new Date().toISOString()
    };

    try {
      await addTask(newTaskData);
      setQuickTitle('');
      setIsQuickAddExpanded(false);
      setQuickIsImportant(false);
    } catch (error) {
      console.error("Error al crear tarea:", error);
    }
  };

  const handleToggleTaskStatus = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
    try {
      await updateTask(task.id, { 
        status: newStatus,
        deliveredAt: newStatus === TaskStatus.DONE ? new Date().toISOString() : undefined
      });
    } catch (error) {
      console.error("Error al actualizar estado:", error);
    }
  };

  const handleToggleImportant = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyImportant = task.isImportant === true || task.priority === 'Alta';
    const nextImportant = !isCurrentlyImportant;
    try {
      await updateTask(task.id, { 
        isImportant: nextImportant,
        priority: nextImportant ? 'Alta' : (task.priority === 'Alta' ? 'Media' : task.priority)
      });
    } catch (error) {
      console.error("Error al marcar como importante:", error);
    }
  };

  const handleToggleMyDay = async (task: Task) => {
    const isCurrentlyInMyDay = task.isMyDay === true || task.dueDate === todayStr;
    try {
      await updateTask(task.id, {
        isMyDay: !isCurrentlyInMyDay
      });
    } catch (error) {
      console.error("Error al alternar Mi Día:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta tarea?")) {
      try {
        await deleteTask(taskId);
        if (selectedTaskId === taskId) {
          setSelectedTaskId(null);
        }
      } catch (error) {
        console.error("Error al eliminar tarea:", error);
      }
    }
  };

  // Subpasos en el panel lateral
  const handleAddStep = async () => {
    if (!activeTask || !newStepTitle.trim()) return;
    const currentSteps = activeTask.steps || [];
    const newStep: TaskStep = {
      id: `step_${Date.now()}`,
      title: newStepTitle.trim(),
      completed: false
    };
    const updatedSteps = [...currentSteps, newStep];
    try {
      await updateTask(activeTask.id, { steps: updatedSteps });
      setNewStepTitle('');
    } catch (error) {
      console.error("Error al agregar subpaso:", error);
    }
  };

  const handleToggleStep = async (stepId: string) => {
    if (!activeTask || !activeTask.steps) return;
    const updatedSteps = activeTask.steps.map(s => {
      if (s.id === stepId) return { ...s, completed: !s.completed };
      return s;
    });
    try {
      await updateTask(activeTask.id, { steps: updatedSteps });
    } catch (error) {
      console.error("Error al actualizar paso:", error);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!activeTask || !activeTask.steps) return;
    const updatedSteps = activeTask.steps.filter(s => s.id !== stepId);
    try {
      await updateTask(activeTask.id, { steps: updatedSteps });
    } catch (error) {
      console.error("Error al eliminar paso:", error);
    }
  };

  // Archivo adjunto y entrega
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'attachmentUrl' | 'deliveryUrl') => {
    if (!activeTask) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("El archivo excede el tamaño máximo recomendado de 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      const updateData: Partial<Task> = { [field]: dataUrl };
      if (field === 'deliveryUrl') {
        updateData.status = TaskStatus.DONE;
        updateData.deliveredAt = new Date().toISOString();
      }
      try {
        await updateTask(activeTask.id, updateData);
      } catch (err) {
        console.error("Error al subir archivo:", err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper para etiquetas de fecha (Hoy, Mañana, Ayer, etc.)
  const formatDueDateLabel = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    if (dueDateStr === todayStr) {
      return { text: 'Hoy', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    if (dueDateStr === tomorrowStr) {
      return { text: 'Mañana', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (dueDateStr < todayStr) {
      return { text: `Venció ${dueDateStr}`, color: 'text-rose-700 bg-rose-50 border-rose-200 font-bold' };
    }
    return { text: dueDateStr, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  // Helper de título y estilo de la lista actual
  const smartListHeader = useMemo(() => {
    switch (activeSmartList) {
      case 'my_day':
        return {
          title: 'Mi Día',
          icon: Sun,
          subtitle: new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
          accentColor: 'text-amber-500',
          bgAccent: 'from-amber-500/10 via-sky-500/5 to-transparent'
        };
      case 'important':
        return {
          title: 'Importante',
          icon: Star,
          subtitle: 'Tareas destacadas con prioridad alta',
          accentColor: 'text-amber-500',
          bgAccent: 'from-amber-500/10 to-transparent'
        };
      case 'planned':
        return {
          title: 'Planeado',
          icon: CalendarDays,
          subtitle: 'Tareas con fecha límite programada',
          accentColor: 'text-emerald-600',
          bgAccent: 'from-emerald-500/10 to-transparent'
        };
      case 'assigned_to_me':
        return {
          title: 'Asignadas a mí',
          icon: User,
          subtitle: currentUser ? `Responsable: ${currentUser.firstName} ${currentUser.lastName}` : 'Tareas asignadas',
          accentColor: 'text-indigo-600',
          bgAccent: 'from-indigo-500/10 to-transparent'
        };
      case 'all':
      default:
        return {
          title: 'Todas las Tareas',
          icon: CheckSquare,
          subtitle: 'Bandeja completa de actividades de la oficina',
          accentColor: 'text-slate-800',
          bgAccent: 'from-slate-500/10 to-transparent'
        };
    }
  }, [activeSmartList, currentUser]);

  const SmartListHeaderIcon = smartListHeader.icon;

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto pb-12 animate-fade-in relative min-h-[750px]">
      
      {/* ======================================================== */}
      {/* BARRA LATERAL ESTILO MICROSOFT TO DO (LISTAS INTELIGENTES)*/}
      {/* ======================================================== */}
      <div className="w-full lg:w-64 shrink-0 space-y-4">
        
        {/* Encabezado del Módulo */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-xs">
              <ListTodo className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Tareas To Do</h2>
              <p className="text-[10px] text-slate-400">Gestión estilo Microsoft</p>
            </div>
          </div>

          {/* Conmutador Lista / Kanban */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('todo')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'todo' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista Lista To Do"
            >
              <ListTodo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista Tablero Kanban"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Listas Inteligentes de Navegación */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs space-y-1">
          
          {/* Mi Día */}
          <button
            onClick={() => setActiveSmartList('my_day')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSmartList === 'my_day'
                ? 'bg-amber-500/10 text-amber-900 font-black'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className={`w-4 h-4 ${activeSmartList === 'my_day' ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`} />
              <span>Mi Día</span>
            </div>
            {counts.my_day > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {counts.my_day}
              </span>
            )}
          </button>

          {/* Importante */}
          <button
            onClick={() => setActiveSmartList('important')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSmartList === 'important'
                ? 'bg-amber-500/10 text-amber-900 font-black'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className={`w-4 h-4 ${activeSmartList === 'important' ? 'text-amber-500 fill-amber-500' : 'text-amber-400'}`} />
              <span>Importante</span>
            </div>
            {counts.important > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {counts.important}
              </span>
            )}
          </button>

          {/* Planeado */}
          <button
            onClick={() => setActiveSmartList('planned')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSmartList === 'planned'
                ? 'bg-emerald-500/10 text-emerald-950 font-black'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays className={`w-4 h-4 ${activeSmartList === 'planned' ? 'text-emerald-600' : 'text-emerald-500'}`} />
              <span>Planeado</span>
            </div>
            {counts.planned > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {counts.planned}
              </span>
            )}
          </button>

          {/* Asignadas a mí */}
          <button
            onClick={() => setActiveSmartList('assigned_to_me')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSmartList === 'assigned_to_me'
                ? 'bg-indigo-500/10 text-indigo-950 font-black'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <User className={`w-4 h-4 ${activeSmartList === 'assigned_to_me' ? 'text-indigo-600' : 'text-indigo-500'}`} />
              <span>Asignadas a mí</span>
            </div>
            {counts.assigned_to_me > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                {counts.assigned_to_me}
              </span>
            )}
          </button>

          <div className="pt-2 border-t border-slate-100"></div>

          {/* Todas las Tareas */}
          <button
            onClick={() => setActiveSmartList('all')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSmartList === 'all'
                ? 'bg-slate-900 text-white font-black shadow-xs'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckSquare className={`w-4 h-4 ${activeSmartList === 'all' ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Todas las Tareas</span>
            </div>
            {counts.all > 0 && (
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                activeSmartList === 'all' ? 'bg-slate-800 text-emerald-300' : 'bg-slate-100 text-slate-700'
              }`}>
                {counts.all}
              </span>
            )}
          </button>

        </div>

        {/* Filtros Secundarios (Asignado y Prioridad) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs space-y-2.5 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Filtros
          </span>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Colaborador</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="all">Todos los colaboradores</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Prioridad</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="all">Todas las prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* CONTENIDO PRINCIPAL: LISTA DE TAREAS ESTILO TO DO        */}
      {/* ======================================================== */}
      <div className="flex-1 min-w-0 space-y-4">
        
        {/* Cabecera Dinámica de la Lista Inteligente */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl bg-slate-50 border border-slate-100 ${smartListHeader.accentColor} shrink-0`}>
                <SmartListHeaderIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {smartListHeader.title}
                </h1>
                <p className="text-xs text-slate-500 font-medium capitalize">
                  {smartListHeader.subtitle}
                </p>
              </div>
            </div>

            {/* Barra de Búsqueda Integrada */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INPUT RÁPIDO: "+ AGREGAR UNA TAREA" (ICÓNICO MICROSOFT TO DO) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-transparent transition-all">
          <form onSubmit={handleQuickAddTask} className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuickAddTask()}
                className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-slate-500 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Agregar tarea"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <input
                type="text"
                placeholder="Agregar una tarea..."
                value={quickTitle}
                onChange={(e) => {
                  setQuickTitle(e.target.value);
                  if (!isQuickAddExpanded) setIsQuickAddExpanded(true);
                }}
                onFocus={() => setIsQuickAddExpanded(true)}
                className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
              />
              {quickTitle && (
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  Agregar
                </button>
              )}
            </div>

            {/* Opciones Rápidas Expandibles (Fecha, Asignar, Importancia) */}
            {isQuickAddExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  
                  {/* Selector de Vencimiento Rápido */}
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={quickDueDate}
                      onChange={(e) => setQuickDueDate(e.target.value)}
                      className="bg-transparent text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>

                  {/* Selector de Asignado */}
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={quickAssignedTo}
                      onChange={(e) => setQuickAssignedTo(e.target.value)}
                      className="bg-transparent text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="">Sin asignar</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Prioridad */}
                  <select
                    value={quickPriority}
                    onChange={(e) => setQuickPriority(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>

                  {/* Marcar con Estrella */}
                  <button
                    type="button"
                    onClick={() => setQuickIsImportant(p => !p)}
                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                      quickIsImportant 
                        ? 'bg-amber-50 border-amber-300 text-amber-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-500'
                    }`}
                    title="Marcar como importante"
                  >
                    <Star className={`w-3.5 h-3.5 ${quickIsImportant ? 'fill-amber-400' : ''}`} />
                  </button>

                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickAddExpanded(false);
                      setQuickTitle('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Guardar Tarea
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* ======================================================== */}
        {/* MODO VISTA: TO DO LIST (PREDETERMINADO)                    */}
        {/* ======================================================== */}
        {viewMode === 'todo' ? (
          <div className="space-y-4">
            
            {/* Lista de Tareas Pendientes */}
            <div className="space-y-2">
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs font-semibold">Cargando tareas de la oficina...</span>
                </div>
              ) : pendingTasks.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">No hay tareas pendientes</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchTerm 
                      ? 'No hay tareas que coincidan con los filtros de búsqueda.'
                      : '¡Excelente trabajo! Todo está al corriente en esta lista.'}
                  </p>
                </div>
              ) : (
                pendingTasks.map(task => {
                  const isSelected = task.id === selectedTaskId;
                  const isImportant = task.isImportant || task.priority === 'Alta';
                  const dueDateInfo = formatDueDateLabel(task.dueDate);
                  const assignedEmployee = employees.find(e => e.id === task.assignedTo);
                  const stepCount = task.steps?.length || 0;
                  const stepCompletedCount = task.steps?.filter(s => s.completed).length || 0;

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`p-3.5 bg-white rounded-2xl border transition-all flex items-start sm:items-center justify-between gap-3 cursor-pointer group hover:shadow-sm ${
                        isSelected 
                          ? 'border-slate-900 shadow-xs ring-1 ring-slate-900 bg-slate-50/50' 
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        
                        {/* Círculo de completado To Do */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleTaskStatus(task, e)}
                          className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 transition-colors cursor-pointer group/chk"
                          title="Marcar como completada"
                        >
                          <Check className="w-3 h-3 text-transparent group-hover/chk:text-emerald-600 transition-colors" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug truncate">
                            {task.title}
                          </h4>

                          {/* Metadatos (Fecha, Asignado, Pasos, Archivos) */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                            {dueDateInfo && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${dueDateInfo.color}`}>
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{dueDateInfo.text}</span>
                              </span>
                            )}

                            {assignedEmployee && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <User className="w-2.5 h-2.5 text-slate-400" />
                                <span className="truncate max-w-[120px]">{assignedEmployee.firstName} {assignedEmployee.lastName}</span>
                              </span>
                            )}

                            {stepCount > 0 && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <CheckSquare className="w-2.5 h-2.5" />
                                <span>{stepCompletedCount} de {stepCount}</span>
                              </span>
                            )}

                            {task.attachmentUrl && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-0.5" title="Tiene archivo adjunto">
                                <Paperclip className="w-3 h-3" />
                              </span>
                            )}

                            {task.deliveryUrl && (
                              <span className="text-[10px] text-emerald-600 flex items-center gap-0.5" title="Tiene archivo de entrega">
                                <FileText className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Estrella To Do a la derecha */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleImportant(task, e)}
                        className={`p-1.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0 cursor-pointer ${
                          isImportant ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                        }`}
                        title={isImportant ? 'Quitar de importantes' : 'Marcar como importante'}
                      >
                        <Star className={`w-4 h-4 ${isImportant ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* SECCIÓN "COMPLETADAS" (ACORDEÓN ESTILO TO DO) */}
            {completedTasks.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleted(p => !p)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 py-2 px-1 cursor-pointer transition-colors"
                >
                  {showCompleted ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span>Completadas</span>
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full font-bold">
                    {completedTasks.length}
                  </span>
                </button>

                {showCompleted && (
                  <div className="space-y-2 mt-2">
                    {completedTasks.map(task => {
                      const isSelected = task.id === selectedTaskId;
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`p-3.5 bg-slate-50/70 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                            isSelected 
                              ? 'border-slate-900 shadow-xs ring-1 ring-slate-900' 
                              : 'border-slate-200/60 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleTaskStatus(task, e)}
                              className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer"
                              title="Reabrir tarea"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm line-through text-slate-400 font-medium truncate block">
                                {task.title}
                              </span>
                              {task.deliveredAt && (
                                <span className="text-[10px] text-emerald-600 font-medium block">
                                  Entregada el {task.deliveredAt.split('T')[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          /* ======================================================== */
          /* MODO VISTA: TABLERO KANBAN (3 COLUMNAS)                   */
          /* ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { status: TaskStatus.TODO, title: 'Por Hacer', color: 'border-amber-400', badgeColor: 'bg-amber-100 text-amber-800' },
              { status: TaskStatus.IN_PROGRESS, title: 'En Progreso', color: 'border-blue-400', badgeColor: 'bg-blue-100 text-blue-800' },
              { status: TaskStatus.DONE, title: 'Completado', color: 'border-emerald-400', badgeColor: 'bg-emerald-100 text-emerald-800' }
            ].map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.status);
              return (
                <div key={col.status} className="bg-slate-100/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col h-[600px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.badgeColor}`}></span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{col.title}</h3>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-white rounded-full text-slate-700 shadow-2xs">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-white/50">
                        Sin tareas
                      </div>
                    ) : (
                      colTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm cursor-pointer transition-all space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                              {task.title}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleToggleImportant(task, e)}
                              className="text-slate-300 hover:text-amber-500 shrink-0"
                            >
                              <Star className={`w-3.5 h-3.5 ${(task.isImportant || task.priority === 'Alta') ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>{task.dueDate || 'Sin fecha'}</span>
                            <span className="font-bold text-slate-700">
                              {employees.find(e => e.id === task.assignedTo)?.firstName || 'Sin asignar'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* PANEL LATERAL DE DETALLES (DRAWER MICROSOFT TO DO)       */}
      {/* ======================================================== */}
      {activeTask && (
        <div className="w-full lg:w-96 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-xl p-5 sm:p-6 space-y-5 animate-slide-in-right flex flex-col justify-between self-start sticky top-6">
          
          <div className="space-y-4">
            
            {/* Header del Panel */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleTaskStatus(activeTask)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer ${
                    activeTask.status === TaskStatus.DONE
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-300 hover:border-emerald-500'
                  }`}
                  title={activeTask.status === TaskStatus.DONE ? 'Reabrir' : 'Completar'}
                >
                  {activeTask.status === TaskStatus.DONE && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  Detalles de Tarea
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleImportant(activeTask)}
                  className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Importante"
                >
                  <Star className={`w-4 h-4 ${(activeTask.isImportant || activeTask.priority === 'Alta') ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTaskId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Cerrar panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Título Editable In-Situ */}
            <div>
              <input
                type="text"
                value={activeTask.title}
                onChange={(e) => updateTask(activeTask.id, { title: e.target.value })}
                className="w-full text-base font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-900 outline-none pb-1 transition-colors"
                placeholder="Título de la tarea..."
              />
            </div>

            {/* Opción: Agregar a Mi Día */}
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleToggleMyDay(activeTask)}
                className="w-full flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <Sun className={`w-4 h-4 ${(activeTask.isMyDay || activeTask.dueDate === todayStr) ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>
                  {(activeTask.isMyDay || activeTask.dueDate === todayStr) 
                    ? 'Agregada a Mi Día' 
                    : 'Agregar a Mi Día'}
                </span>
              </button>
            </div>

            {/* Sub-Pasos (Checklist estilo To Do) */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Pasos de la Tarea
              </span>

              {activeTask.steps && activeTask.steps.length > 0 && (
                <div className="space-y-1.5">
                  {activeTask.steps.map(step => (
                    <div key={step.id} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-200/60 text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer ${
                            step.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                          }`}
                        >
                          {step.completed && <Check className="w-2.5 h-2.5" />}
                        </button>
                        <span className={`truncate ${step.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {step.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStep(step.id)}
                        className="text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input para agregar siguiente paso */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newStepTitle}
                  onChange={(e) => setNewStepTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStep(); }}}
                  placeholder="+ Siguiente paso..."
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddStep}
                  disabled={!newStepTitle.trim()}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Añadir
                </button>
              </div>
            </div>

            {/* Fecha de Vencimiento */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Fecha de Vencimiento
                </span>
                <input
                  type="date"
                  value={activeTask.dueDate || ''}
                  onChange={(e) => updateTask(activeTask.id, { dueDate: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
              </div>

              {/* Botones de fecha rápida */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => updateTask(activeTask.id, { dueDate: todayStr })}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                    activeTask.dueDate === todayStr ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => updateTask(activeTask.id, { dueDate: tomorrowStr })}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                    activeTask.dueDate === tomorrowStr ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Mañana
                </button>
              </div>
            </div>

            {/* Asignación y Prioridad */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Asignar a</label>
                <select
                  value={activeTask.assignedTo || ''}
                  onChange={(e) => updateTask(activeTask.id, { assignedTo: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">Sin asignar</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Prioridad</label>
                <select
                  value={activeTask.priority || 'Media'}
                  onChange={(e) => updateTask(activeTask.id, { priority: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>

            {/* Archivos (Adjunto de Inicio / Comprobante de Entrega) */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Archivos y Documentos
              </span>

              {/* Adjunto Inicial */}
              <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200/70 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Adjunto Inicial</span>
                </div>
                {activeTask.attachmentUrl ? (
                  <a
                    href={activeTask.attachmentUrl}
                    download={`adjunto-${activeTask.id}`}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Descargar
                  </a>
                ) : (
                  <label className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-200 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'attachmentUrl')}
                    />
                    Subir
                  </label>
                )}
              </div>

              {/* Entrega Final */}
              <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200/70 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Comprobante de Entrega</span>
                </div>
                {activeTask.deliveryUrl ? (
                  <a
                    href={activeTask.deliveryUrl}
                    download={`entrega-${activeTask.id}`}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Ver Entrega
                  </a>
                ) : (
                  <label className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'deliveryUrl')}
                    />
                    Subir Entrega
                  </label>
                )}
              </div>
            </div>

            {/* Notas / Descripción */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Notas
              </label>
              <textarea
                rows={3}
                value={activeTask.description || ''}
                onChange={(e) => updateTask(activeTask.id, { description: e.target.value })}
                placeholder="Agregar una nota o descripción..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-900 transition-all resize-y"
              />
            </div>

          </div>

          {/* Pie del Panel Lateral: Estado de creación y botón Eliminar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[10px]">
              {activeTask.createdAt ? `Creada el ${activeTask.createdAt.split('T')[0]}` : 'Tarea de oficina'}
            </span>

            <button
              type="button"
              onClick={() => handleDeleteTask(activeTask.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Eliminar tarea definitivamente"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};