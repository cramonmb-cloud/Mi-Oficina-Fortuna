import React, { useEffect, useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Calendar, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  Lock,
  ExternalLink,
  MapPin,
  Phone,
  FileText
} from 'lucide-react';
import { Employee, AppSettings } from '../types';
import { getEmployeeById, getAppSettings, incrementEmployeeCredentialViews } from '../services/dbService';

interface PublicCredentialViewProps {
  employeeId: string;
  onGoToApp?: () => void;
}

export const PublicCredentialView: React.FC<PublicCredentialViewProps> = ({ employeeId, onGoToApp }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedTime, setVerifiedTime] = useState<string>('');
  
  // Guard para evitar que React ejecute el incremento doble en StrictMode o en re-renderizados
  const hasIncrementedRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const emp = await getEmployeeById(employeeId);
        const setts = await getAppSettings();
        
        if (!isMounted) return;

        setEmployee(emp);
        setSettings(setts);
        const now = new Date();
        setVerifiedTime(now.toLocaleString('es-MX', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }));

        // Incrementar contador de consultas públicas / escaneos exactamente UNA vez
        if (emp && emp.id && !hasIncrementedRef.current) {
          const sessionKey = `cred_view_recorded_${emp.id}`;
          const lastRecorded = sessionStorage.getItem(sessionKey);
          const nowMs = Date.now();

          // Evitar doble conteo si ya se registró en los últimos 30 segundos en la misma sesión
          if (!lastRecorded || nowMs - parseInt(lastRecorded, 10) > 30000) {
            hasIncrementedRef.current = true;
            sessionStorage.setItem(sessionKey, String(nowMs));
            incrementEmployeeCredentialViews(emp.id);
          }
        }
      } catch (e) {
        console.error("Error loading public credential:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  const useStateData = () => [null, null];

  const calculateYears = (hireDate?: string) => {
    if (!hireDate) return 'Sin registro';
    try {
      const hire = new Date(hireDate + 'T00:00:00');
      const diff = new Date().getTime() - hire.getTime();
      const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
      if (years < 1) return 'Menos de 1 año';
      return `${years} ${years === 1 ? 'año' : 'años'}`;
    } catch {
      return 'Sin registro';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full text-center space-y-4">
          <Loader2 className="w-10 h-10 text-slate-800 animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Validando Credencial Oficial...</h3>
          <p className="text-xs text-slate-500">Consultando registros oficiales en tiempo real.</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Credencial No Encontrada</h3>
          <p className="text-xs text-slate-500">
            El código escaneado no corresponde a ningún colaborador registrado o el identificador es inválido.
          </p>
          {onGoToApp && (
            <button
              onClick={onGoToApp}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors w-full"
            >
              Ir a la Plataforma
            </button>
          )}
        </div>
      </div>
    );
  }

  const isActive = (employee.status || 'ACTIVO') === 'ACTIVO';
  const companyName = settings?.companyName || 'Mi Oficina';
  const companyLogo = settings?.companyLogoUrl;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 sm:p-6 font-sans">
      
      {/* Top Floating Security Badge */}
      <div className="mb-4 max-w-md w-full flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
          <Lock className="w-3.5 h-3.5 text-slate-800" />
          <span>Verificación Segura SSL</span>
        </div>
        <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
          Válido en Línea
        </span>
      </div>

      {/* Main Validation Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl max-w-md w-full overflow-hidden animate-fade-in">
        
        {/* Certificate Header Banner */}
        <div className="bg-white border-b border-slate-200 p-5 text-center relative">
          <div className="flex flex-col items-center justify-center gap-2 mb-2">
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt={companyName} 
                className="h-24 sm:h-28 max-w-[320px] object-contain drop-shadow-xs" 
              />
            ) : (
              <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-700">
                <Building2 className="w-8 h-8" />
              </div>
            )}
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 mt-1">
              {companyName}
            </h2>
          </div>

          {/* Verification Status Pill */}
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs border bg-slate-50">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isActive ? 'text-emerald-800' : 'text-rose-800'}>
              {isActive ? 'COLABORADOR ACTIVO Y CERTIFICADO' : `ESTADO: ${employee.status || 'INACTIVO'}`}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          
          {/* Employee Avatar & Identity */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-24 h-28 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
              {employee.photoUrl ? (
                <img 
                  src={employee.photoUrl} 
                  alt={`${employee.firstName} ${employee.lastName}`} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                  <User className="w-10 h-10 opacity-40 mb-1" />
                  <span className="text-[9px] font-semibold">Sin Foto</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 rounded-md inline-block mb-1">
                {employee.category}
              </span>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="text-xs font-bold text-slate-700 mt-0.5">
                {employee.position || 'Colaborador Oficial'}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Plaza / Sucursal: <span className="font-semibold text-slate-800">{employee.plaza || 'General'}</span>
              </p>
            </div>
          </div>

          {/* Key Official Data */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Datos Laborales Verificados</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">CURP</span>
                <span className="font-mono font-bold text-slate-800 text-[11px] select-all">
                  {employee.curp || 'NO REGISTRADA'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Contacto</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {employee.phone || 'NO REGISTRADO'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Fecha de Ingreso</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {employee.hireDate || 'NO REGISTRADA'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Antigüedad</span>
                <span className="font-bold text-slate-800 text-[11px]">
                  {calculateYears(employee.hireDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Official Company / Issuer Information (Conditional) */}
          {settings?.showCompanyInfoOnCredential && (settings.companyRfc || settings.companyAddress || settings.companyPhone) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  Datos Oficiales de la Empresa
                </span>
                <span className="text-[9px] font-semibold text-slate-400">Emisor</span>
              </h4>

              <div className="space-y-2 text-xs">
                {settings.companyRfc && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      RFC
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-[11px] select-all">
                      {settings.companyRfc}
                    </span>
                  </div>
                )}

                {settings.companyAddress && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 shrink-0 pt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Domicilio
                    </span>
                    <span className="font-medium text-slate-700 text-right text-[11px] leading-tight">
                      {settings.companyAddress}
                    </span>
                  </div>
                )}

                {settings.companyPhone && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      Teléfono
                    </span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      <a href={`tel:${settings.companyPhone.replace(/\s+/g, '')}`} className="hover:underline text-indigo-600">
                        {settings.companyPhone}
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Audit Info */}
          <div className="text-center pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
              <span>Folio de Validación:</span>
              <span className="font-mono font-bold text-slate-800">{employee.id.toUpperCase()}</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Verificado el {verifiedTime} mediante sistema centralizado.
            </p>
          </div>

        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-center text-xs text-slate-400 font-medium">
          {companyName} &copy; {new Date().getFullYear()}
        </div>

      </div>

    </div>
  );
};
