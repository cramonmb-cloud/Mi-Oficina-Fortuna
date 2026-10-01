import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  HelpCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw 
} from 'lucide-react';
import { CallQuestion } from '../../types';
import { getDefaultCallQuestions } from '../../services/dbService';

interface ConfigureQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: CallQuestion[];
  onSaveQuestions: (questions: CallQuestion[]) => Promise<void>;
}

export const ConfigureQuestionsModal: React.FC<ConfigureQuestionsModalProps> = ({
  isOpen,
  onClose,
  questions: initialQuestions,
  onSaveQuestions
}) => {
  if (!isOpen) return null;

  const [questions, setQuestions] = useState<CallQuestion[]>(() => {
    return initialQuestions && initialQuestions.length > 0 
      ? [...initialQuestions] 
      : getDefaultCallQuestions();
  });
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'boolean' | 'text' | 'currency' | 'day'>('boolean');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newQ: CallQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question: newQuestionText.trim(),
      type: newQuestionType,
      order: questions.length + 1,
      isActive: true,
      isDefault: false
    };

    setQuestions([...questions, newQ]);
    setNewQuestionText('');
  };

  const handleToggleActive = (id: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, isActive: !q.isActive } : q
    ));
  };

  const handleDelete = (id: string) => {
    const target = questions.find(q => q.id === id);
    if (target?.isDefault) {
      if (!confirm('Esta es una de las preguntas base del formato oficial. ¿Deseas desactivarla o eliminarla?')) {
        return;
      }
    }
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newArr = [...questions];
    const [moved] = newArr.splice(index, 1);
    newArr.splice(targetIndex, 0, moved);
    // Update order
    newArr.forEach((q, idx) => { q.order = idx + 1; });
    setQuestions(newArr);
  };

  const handleResetDefaults = () => {
    if (confirm('¿Restablecer el cuestionario a las preguntas base oficiales de la hoja?')) {
      setQuestions(getDefaultCallQuestions());
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveQuestions(questions);
      onClose();
    } catch (err) {
      console.error('Error saving questions:', err);
      alert('Error al guardar la configuración de preguntas.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurar Preguntas de Calidad</h2>
              <p className="text-xs text-slate-300">Gestiona las preguntas del formato de llamada</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          
          {/* Add New Question Form */}
          <form onSubmit={handleAddQuestion} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Agregar Nueva Pregunta Personalizada
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="¿Pregunta para el cliente?"
                className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-indigo-500 outline-hidden"
              />
              <select
                value={newQuestionType}
                onChange={(e) => setNewQuestionType(e.target.value as any)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:border-indigo-500 outline-hidden"
              >
                <option value="boolean">Sí / No (Booleano)</option>
                <option value="text">Texto Libre</option>
                <option value="currency">Monto / Cantidad</option>
                <option value="day">Día de la Semana</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newQuestionText.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Agregar al Cuestionario
              </button>
            </div>
          </form>

          {/* Questions List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span>Preguntas activas en el formato ({questions.length}):</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar predeterminadas
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden shadow-xs">
              {questions.map((q, idx) => (
                <div 
                  key={q.id}
                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                    !q.isActive ? 'bg-slate-50/70 opacity-60' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate text-xs">
                        {q.question}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                          {q.type === 'boolean' ? 'Sí/No' : q.type === 'currency' ? 'Monto' : q.type === 'day' ? 'Día' : 'Texto'}
                        </span>
                        {q.isDefault && (
                          <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Oficial de la hoja
                          </span>
                        )}
                        {!q.isActive && (
                          <span className="text-amber-600 font-bold">Inactiva</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Subir orden"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === questions.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Bajar orden"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(q.id)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ml-1 ${
                        q.isActive ? 'text-slate-400 hover:text-slate-700' : 'text-amber-600 hover:text-amber-700'
                      }`}
                      title={q.isActive ? 'Desactivar pregunta' : 'Activar pregunta'}
                    >
                      {q.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>

      </div>
    </div>
  );
};
