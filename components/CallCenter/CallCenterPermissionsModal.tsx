import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Search, 
  Check, 
  Loader2, 
  Building2, 
  UserCheck, 
  AlertCircle,
  Save
} from 'lucide-react';
import { Employee, CallCenterPermissions } from '../../types';
import { getEmployees, saveCallCenterPermissions } from '../../services/dbService';

interface CallCenterPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPermissions: CallCenterPermissions;
  currentUserName?: string;
}

export const CallCenterPermissionsModal: React.FC<CallCenterPermissionsModalProps> = ({
  isOpen,
  onClose,
  currentPermissions,
  currentUserName = 'Cristobal Moran'
}) => {
  if (!isOpen) return null;

  const [officeEmployees, setOfficeEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentPermissions.allowedUserIds || []));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadOfficeStaff = async () => {
      setIsLoading(true);
      try {
        const allEmployees = await getEmployees();
        // Filter only employees with category 'Oficina' and active status, excluding Cristobal
        const officeOnly = allEmployees.filter(emp => {
          const isOffice = emp.category === 'Oficina';
          const isNotCristobal = emp.accessCode !== '0120' && emp.id !== 'admin_master';
          const isActive = emp.status !== 'BAJA';
          return isOffice && isNotCristobal && isActive;
        });
        setOfficeEmployees(officeOnly);
      } catch (err) {
        console.error('Error loading office employees:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadOfficeStaff();
  }, [isOpen]);

  useEffect(() => {
    setSelectedIds(new Set(currentPermissions.allowedUserIds || []));
  }, [currentPermissions]);

  const handleToggleUser = (empId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFiltered = filteredEmployees.map(e => e.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      allFiltered.forEach(id => next.add(id));
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveCallCenterPermissions(Array.from(selectedIds), currentUserName);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error saving call center permissions:', err);
      alert('Error al guardar los permisos de Call Center.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEmployees = officeEmployees.filter(emp => {
    const full = `${emp.firstName} ${emp.lastName} ${emp.position} ${emp.plaza}`.toLowerCase();
    return full.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Gestión de Accesos a Call Center
              </h2>
              <p className="text-xs text-slate-300">
                Selecciona a qué usuarios de oficina permites ver el historial global de todo el equipo
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar colaborador de oficina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              Marcar todos
            </button>
            <span className="text-slate-300">|</span>
            <button 
              type="button"
              onClick={handleDeselectAll}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Cargando personal de oficina...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se encontraron usuarios de Oficina con el término de búsqueda.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map(emp => {
                const isSelected = selectedIds.has(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleUser(emp.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/60 border-indigo-300 shadow-xs ring-1 ring-indigo-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {emp.photoUrl || emp.avatarUrl ? (
                        <img 
                          src={emp.photoUrl || emp.avatarUrl} 
                          alt={emp.firstName} 
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
                          {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {emp.firstName} {emp.lastName}
                          </p>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              Historial Global
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          <span>{emp.position || 'Oficina'}</span>
                          {emp.plaza && (
                            <>
                              <span>•</span>
                              <span>{emp.plaza}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Checkbox status indicator */}
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'border border-slate-300 bg-white hover:border-slate-400'
                    }`}>
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            <strong>{selectedIds.size}</strong> usuario(s) de oficina autorizados
          </div>

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
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Guardado!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Permisos
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
