import React, { useState, useMemo } from 'react';
import { 
  ListTodo, 
  Plus, 
  Check, 
  Star, 
  Sun, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  Paperclip,
  FileText
} from 'lucide-react';
import { Task, TaskStatus, Employee } from '../types';
import { addTask, updateTask } from '../services/dbService';

interface DashboardTasksWidgetProps {
  tasks: Task[];
  employees: Employee[];
  currentUser?: Employee;
}

type TabType = 'my_day' | 'important' | 'upcoming' | 'all';

export const DashboardTasksWidget: React.FC<DashboardTasksWidgetProps> = ({
  tasks,
  employees,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('my_day');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDueDate, setQuickDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isAdding, setIsAdding] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filtrado de tareas según la pestaña seleccionada
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (activeTab === 'my_day') {
        return task.isMyDay === true || task.dueDate === todayStr;
      }
      if (activeTab === 'important') {
        return task.isImportant === true || task.priority === 'Alta';
      }
      if (activeTab === 'upcoming') {
        return Boolean(task.dueDate) && task.dueDate >= todayStr;
      }
      return true; // 'all'
    });
  }, [tasks, activeTab, todayStr]);

  // Pendientes vs completadas
  const pendingTasks = useMemo(() => {
    return filteredTasks.filter(t => t.status !== TaskStatus.DONE);
  }, [filteredTasks]);

  const completedTodayCount = useMemo(() => {
    return tasks.filter(t => t.status === TaskStatus.DONE && t.deliveredAt?.startsWith(todayStr)).length;
  }, [tasks, todayStr]);

  const totalTodayTasks = useMemo(() => {
    return tasks.filter(t => t.dueDate === todayStr || t.isMyDay).length;
  }, [tasks, todayStr]);

  // Conteos para los badges de las pestañas
  const tabCounts = useMemo(() => {
    return {
      my_day: tasks.filter(t => t.status !== TaskStatus.DONE && (t.isMyDay || t.dueDate === todayStr)).length,
      important: tasks.filter(t => t.status !== TaskStatus.DONE && (t.isImportant || t.priority === 'Alta')).length,
      upcoming: tasks.filter(t => t.status !== TaskStatus.DONE && Boolean(t.dueDate) && t.dueDate >= todayStr).length,
      all: tasks.filter(t => t.status !== TaskStatus.DONE).length
    };
  }, [tasks, todayStr]);

  // Agregar tarea rápida directamente desde el Dashboard
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    setIsAdding(true);
    try {
      await addTask({
        title: quickTitle.trim(),
        description: '',
        status: TaskStatus.TODO,
        priority: activeTab === 'important' ? 'Alta' : 'Media',
        dueDate: activeTab === 'my_day' ? todayStr : (quickDueDate || todayStr),
        assignedTo: currentUser ? currentUser.id : '',
        isImportant: activeTab === 'important',
        isMyDay: activeTab === 'my_day' || quickDueDate === todayStr,
        createdAt: new Date().toISOString()
      });
      setQuickTitle('');
    } catch (err) {
      console.error("Error al agregar tarea desde widget:", err);
    } finally {
      setIsAdding(false);
    }
  };

  // Completar o reactivar tarea con un clic
  const handleToggleStatus = async (task: Task) => {
    const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
    try {
      await updateTask(task.id, {
        status: nextStatus,
        deliveredAt: nextStatus === TaskStatus.DONE ? new Date().toISOString() : undefined
      });
    } catch (err) {
      console.error("Error al cambiar estado de tarea:", err);
    }
  };

  // Alternar importancia (estrella) con un clic
  const handleToggleImportant = async (task: Task) => {
    const isImp = task.isImportant || task.priority === 'Alta';
    try {
      await updateTask(task.id, {
        isImportant: !isImp,
        priority: !isImp ? 'Alta' : (task.priority === 'Alta' ? 'Media' : task.priority)
      });
    } catch (err) {
      console.error("Error al alternar importancia:", err);
    }
  };

  const formatDueBadge = (dueDate?: string) => {
    if (!dueDate) return null;
    if (dueDate === todayStr) {
      return { text: 'Hoy', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    if (dueDate === tomorrowStr) {
      return { text: 'Mañana', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (dueDate < todayStr) {
      return { text: 'Venció', color: 'text-rose-700 bg-rose-50 border-rose-200 font-bold' };
    }
    return { text: dueDate, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
      
      {/* Cabecera del Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shrink-0">
            <ListTodo className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Tareas a la Mano</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {tabCounts.all} activas
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Acceso rápido y seguimiento directo</p>
          </div>
        </div>

        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('my_day')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'my_day' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sun className="w-3 h-3 text-amber-500" />
            <span>Mi Día</span>
            {tabCounts.my_day > 0 && (
              <span className="text-[9px] font-mono px-1 rounded bg-amber-100 text-amber-800">
                {tabCounts.my_day}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('important')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'important' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400" />
            <span>Importante</span>
            {tabCounts.important > 0 && (
              <span className="text-[9px] font-mono px-1 rounded bg-amber-100 text-amber-800">
                {tabCounts.important}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>Próximas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Todas</span>
          </button>
        </div>
      </div>

      {/* Input Rápido: "+ Agregar tarea rápida..." */}
      <form onSubmit={handleQuickAdd} className="bg-slate-50 p-2 sm:p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
        <button
          type="submit"
          disabled={isAdding || !quickTitle.trim()}
          className="w-6 h-6 rounded-full border border-slate-300 hover:border-slate-500 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0 transition-colors disabled:opacity-40 cursor-pointer"
          title="Agregar tarea"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder={`+ Agregar tarea a ${activeTab === 'my_day' ? 'Mi Día' : activeTab === 'important' ? 'Importante' : 'Tareas'}...`}
          className="flex-1 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
        />

        <input
          type="date"
          value={quickDueDate}
          onChange={(e) => setQuickDueDate(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-slate-600 outline-none cursor-pointer"
        />

        <button
          type="submit"
          disabled={isAdding || !quickTitle.trim()}
          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 shrink-0 cursor-pointer"
        >
          {isAdding ? '...' : 'Añadir'}
        </button>
      </form>

      {/* Lista Desplazable de Tareas */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
        {pendingTasks.length === 0 ? (
          <div className="py-10 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Sin tareas pendientes en esta vista</p>
            <p className="text-[10px] text-slate-400">Puedes agregar una tarea directamente en la barra superior</p>
          </div>
        ) : (
          pendingTasks.map(task => {
            const dueInfo = formatDueBadge(task.dueDate);
            const isImp = task.isImportant || task.priority === 'Alta';
            const assignedEmp = employees.find(e => e.id === task.assignedTo);

            return (
              <div
                key={task.id}
                className="p-3 bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Círculo de completado */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(task)}
                    className="w-4 h-4 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer group/chk"
                    title="Completar tarea"
                  >
                    <Check className="w-2.5 h-2.5 text-transparent group-hover/chk:text-emerald-600 transition-colors" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {dueInfo && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${dueInfo.color}`}>
                          {dueInfo.text}
                        </span>
                      )}
                      {assignedEmp && (
                        <span className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                          <User className="w-2.5 h-2.5 text-slate-400" />
                          <span className="truncate max-w-[100px]">{assignedEmp.firstName}</span>
                        </span>
                      )}
                      {task.attachmentUrl && (
                        <Paperclip className="w-2.5 h-2.5 text-slate-400" title="Tiene adjunto" />
                      )}
                      {task.deliveryUrl && (
                        <FileText className="w-2.5 h-2.5 text-emerald-600" title="Tiene entrega" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón de Estrella */}
                <button
                  type="button"
                  onClick={() => handleToggleImportant(task)}
                  className={`p-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${
                    isImp ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                  }`}
                  title={isImp ? 'Quitar de importantes' : 'Marcar importante'}
                >
                  <Star className={`w-3.5 h-3.5 ${isImp ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pie del Widget: Barra de Progreso del Día */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">
            {completedTodayCount} {completedTodayCount === 1 ? 'completada' : 'completadas'} hoy
          </span>
          {totalTodayTasks > 0 && (
            <span className="text-slate-400 text-[10px]">
              de {totalTodayTasks} programadas
            </span>
          )}
        </div>

        <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
          <span>En sincronía con To Do</span>
        </div>
      </div>

    </div>
  );
};
