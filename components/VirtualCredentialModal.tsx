import React, { useEffect, useState } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Building2, 
  CreditCard, 
  ExternalLink,
  QrCode,
  User,
  Eye,
  Activity,
  Clock,
  RotateCw,
  Phone,
  MapPin,
  FileCheck2,
  Shield,
  Calendar
} from 'lucide-react';
import { Employee } from '../types';
import { getEmployeeCredentialCode } from '../services/dbService';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

interface VirtualCredentialModalProps {
  employee: Employee;
  companyName: string;
  companyLogoUrl?: string;
  companyRfc?: string;
  companyAddress?: string;
  companyPhone?: string;
  showCompanyInfo?: boolean;
  onClose: () => void;
}

export const VirtualCredentialModal: React.FC<VirtualCredentialModalProps> = ({
  employee,
  companyName,
  companyLogoUrl,
  companyRfc,
  companyAddress,
  companyPhone,
  showCompanyInfo,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

  // Código numérico de 8 dígitos para la validación pública oficial
  const credentialCode = getEmployeeCredentialCode(employee);

  // Generar link oficial de validación con el folio de 8 dígitos
  const verificationUrl = `${window.location.origin}/?credencial=${credentialCode}`;

  useEffect(() => {
    // Generate high resolution QR code
    QRCode.toDataURL(verificationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("Error generating QR:", err));
  }, [verificationUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*Credencial Digital Oficial*\n` +
      `Colaborador: ${employee.firstName} ${employee.lastName}\n` +
      `Puesto: ${employee.position || 'Colaborador'}\n` +
      `Empresa: ${companyName || 'Mi Oficina'}\n` +
      `Folio: ${credentialCode}\n` +
      `Valida la autenticidad y estatus en tiempo real aquí:\n${verificationUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const cleanName = `${employee.firstName} ${employee.lastName}`.trim().toUpperCase().replace(/[/\\?%*:|"<>]/g, '');
    const fileName = `${cleanName || 'QR_EMPLEADO'}.jpg`;

    const canvas = document.createElement('canvas');
    const size = 1000;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = new Image();
      img.onload = () => {
        // Crisp white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        // Draw QR code centered
        ctx.drawImage(img, 40, 40, size - 80, size - 80);
        
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      img.src = qrDataUrl;
    }
  };

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

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // Standard ID Card size: 54mm x 85.6mm (CR80 vertical)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [54, 85.6]
      });

      // --- FRONT SIDE ---
      // Background & Header Bar
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 54, 85.6, 'F');

      // Top Header Area (Crisp Slate / White Brand Box)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 54, 18, 'F');

      if (companyLogoUrl) {
        try {
          doc.addImage(companyLogoUrl, 'PNG', 4, 3, 20, 12);
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.text((companyName || 'MI OFICINA').toUpperCase(), 26, 8);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(4.5);
          doc.text('CREDENCIAL DE IDENTIFICACIÓN', 26, 12);
        } catch (e) {
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text((companyName || 'MI OFICINA').toUpperCase(), 27, 8, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5);
          doc.text('CREDENCIAL DE IDENTIFICACIÓN', 27, 12, { align: 'center' });
        }
      } else {
        // Company Name in Header
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text((companyName || 'MI OFICINA').toUpperCase(), 27, 8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text('CREDENCIAL DE IDENTIFICACIÓN', 27, 12, { align: 'center' });
      }

      // Photo or Avatar placeholder
      const photoY = 22;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(17, photoY, 20, 20, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(17, photoY, 20, 20, 2, 2, 'D');

      if (employee.photoUrl) {
        try {
          doc.addImage(employee.photoUrl, 'JPEG', 17.5, photoY + 0.5, 19, 19);
        } catch (e) {
          console.warn("Could not embed photo in PDF:", e);
        }
      }

      // Name
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const fullName = `${employee.firstName} ${employee.lastName}`;
      doc.text(fullName.length > 22 ? fullName.substring(0, 22) + '...' : fullName, 27, 46, { align: 'center' });

      // Position
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text((employee.position || 'COLABORADOR').toUpperCase(), 27, 50, { align: 'center' });

      // Plaza
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text(`Plaza: ${employee.plaza || 'Sin Plaza'}`, 27, 53.5, { align: 'center' });

      // Information Table in Badge
      doc.setDrawColor(226, 232, 240);
      doc.line(4, 56, 50, 56);

      doc.setFontSize(4.5);
      doc.setTextColor(100, 116, 139);
      doc.text('CURP:', 5, 60);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(employee.curp || 'NO REGISTRADA', 5, 63);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('INGRESO:', 5, 67);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(employee.hireDate || 'N/R', 5, 70);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('CELULAR:', 5, 74);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(employee.phone || 'N/R', 5, 77);

      // Embedded Mini QR in Front Bottom Right
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 34, 58, 15, 15);
      }

      // Bottom verification line
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 81.6, 54, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4);
      doc.text(`FOLIO: ${credentialCode} | VÁLIDA Y CERTIFICADA`, 27, 84.2, { align: 'center' });

      // Save PDF
      doc.save(`Credencial_${employee.firstName}_${employee.lastName}.pdf`);
    } catch (e) {
      console.error("Error generating PDF credential:", e);
      alert("No se pudo generar el archivo PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatLastView = (isoString?: string) => {
    if (!isoString) return 'Sin consultas registradas aún';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Sin registro';
    }
  };

  const isActive = (employee.status || 'ACTIVO') === 'ACTIVO';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-2xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Credencial Virtual Oficial</h3>
              <p className="text-[11px] text-slate-500">
                {employee.firstName} {employee.lastName} • <span className="font-mono font-semibold text-slate-700">Folio #{credentialCode}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns on Desktop */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[82vh]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: The Realistically-Proportioned Executive ID Card */}
            <div className="lg:col-span-5 flex flex-col items-center">
              
              {/* Flip Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mb-3.5 w-full max-w-[320px]">
                <button
                  type="button"
                  onClick={() => setCardSide('front')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    cardSide === 'front' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Anverso (Frente)
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide('back')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    cardSide === 'back' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" /> Reverso
                </button>
              </div>

              {/* Physical Badge Representation (Exact CR80 Proportions 54mm x 85.6mm) */}
              <div className="w-[300px] sm:w-[310px] h-[490px] bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden flex flex-col relative transition-all select-none shrink-0">
                
                {cardSide === 'front' ? (
                  /* --- ANVERSO (FRENTE) - CR80 PROPORCIONAL --- */
                  <div className="h-full flex flex-col justify-between bg-gradient-to-b from-white via-slate-50/40 to-slate-100/80 relative">
                    
                    {/* Top Header & Slot */}
                    <div className="bg-slate-900 text-white shrink-0">
                      {/* Lanyard Clip Slot */}
                      <div className="pt-2 pb-1.5 flex justify-center items-center">
                        <div className="w-12 h-1.5 bg-slate-700/90 rounded-full border border-slate-600/50" />
                      </div>
                      
                      {/* Header Bar */}
                      <div className="px-3.5 pb-2.5 pt-0.5 flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2 min-w-0">
                          {companyLogoUrl ? (
                            <img 
                              src={companyLogoUrl} 
                              alt="Logo" 
                              className="h-6 max-w-[105px] object-contain shrink-0" 
                            />
                          ) : (
                            <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center font-black text-xs text-white">
                              {companyName ? companyName.charAt(0).toUpperCase() : 'O'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10.5px] font-black uppercase tracking-wider leading-none truncate">
                              {companyName || 'Mi Oficina'}
                            </p>
                            <p className="text-[7px] text-slate-400 uppercase tracking-widest mt-0.5">
                              Credencial Oficial
                            </p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                          isActive 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                          {employee.status || 'ACTIVO'}
                        </span>
                      </div>
                    </div>

                    {/* Middle Section: Photo & Identidad */}
                    <div className="px-4 py-2 flex flex-col items-center text-center">
                      {/* Photo Frame with Realistic Proportions */}
                      <div className="relative mb-2">
                        <div className="w-[100px] h-[120px] rounded-xl bg-slate-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
                          {employee.photoUrl ? (
                            <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                              <User className="w-10 h-10 opacity-40 mb-1" />
                              <span className="text-[8px] font-semibold">Sin Foto</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white p-1 rounded-full shadow-xs border-2 border-white">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      </div>

                      {/* Name */}
                      <h3 className="text-[13.5px] font-black text-slate-900 leading-tight px-1 uppercase tracking-tight max-w-full">
                        {employee.firstName} {employee.lastName}
                      </h3>

                      {/* Position & Plaza Pills */}
                      <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {employee.position || 'Colaborador'}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md">
                          {employee.plaza || 'Sin Plaza'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Section: Compact Side-by-Side Data & Fixed QR */}
                    <div className="mx-3 mb-2 p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2.5">
                      {/* Left: Employee Info Details */}
                      <div className="flex-1 min-w-0 space-y-1 text-[10px]">
                        <div>
                          <span className="text-[7.5px] uppercase font-bold text-slate-400 block tracking-wider leading-none">CURP</span>
                          <span className="font-mono font-bold text-slate-800 text-[9.5px] select-all truncate block mt-0.5">
                            {employee.curp || 'No registrada'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[7.5px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Ingreso</span>
                            <span className="text-slate-700 font-mono text-[9px] block mt-0.5">
                              {employee.hireDate || 'N/R'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[7.5px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Antigüedad</span>
                            <span className="text-slate-700 font-semibold text-[9px] block mt-0.5">
                              {calculateYears(employee.hireDate)}
                            </span>
                          </div>
                        </div>
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[7.5px] uppercase font-bold text-slate-400 tracking-wider">Folio</span>
                          <span className="text-slate-900 font-mono font-black text-[9.5px]">
                            #{credentialCode}
                          </span>
                        </div>
                      </div>

                      {/* Right: Explicitly sized QR Code that never expands beyond box */}
                      {qrDataUrl && (
                        <div className="flex flex-col items-center shrink-0">
                          <div 
                            onClick={handleDownloadQrImage}
                            className="w-[72px] h-[72px] min-w-[72px] min-h-[72px] max-w-[72px] max-h-[72px] bg-white p-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:scale-105 transition-transform overflow-hidden flex items-center justify-center"
                            title="Clic para descargar QR"
                          >
                            <img 
                              src={qrDataUrl} 
                              alt="QR" 
                              className="w-full h-full object-contain block" 
                            />
                          </div>
                          <span className="text-[7px] text-slate-400 font-semibold mt-1 tracking-tight">Escanear QR</span>
                        </div>
                      )}
                    </div>

                    {/* Strip Footer */}
                    <div className="bg-slate-900 py-1 px-3 text-center shrink-0">
                      <p className="text-[7px] font-mono text-slate-300 tracking-widest uppercase font-semibold">
                        VÁLIDA Y CERTIFICADA EN TIEMPO REAL
                      </p>
                    </div>
                  </div>
                ) : (
                  /* --- REVERSO (INFORMACIÓN INSTITUCIONAL & FISCAL) --- */
                  <div className="flex-1 flex flex-col justify-between bg-slate-50 text-[10.5px]">
                    {/* Header */}
                    <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          {companyName || 'Mi Oficina'}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">REVERSO</span>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                      {/* Políticas */}
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                        <p className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wide">
                          Condiciones de Uso
                        </p>
                        <p className="text-[9px] text-slate-600 leading-relaxed">
                          Esta credencial es propiedad de <strong className="text-slate-800">{companyName || 'la empresa'}</strong>. Es personal e intransferible y acredita al portador como colaborador activo. Debe portarse en un lugar visible durante la jornada laboral.
                        </p>
                      </div>

                      {/* Datos Fiscales */}
                      {(companyRfc || companyAddress || companyPhone) ? (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1 text-[9px]">
                          <p className="text-[8.5px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-600" /> Datos Corporativos
                          </p>
                          {companyRfc && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-semibold">RFC:</span>
                              <span className="font-mono font-bold text-slate-800">{companyRfc}</span>
                            </div>
                          )}
                          {companyPhone && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 font-semibold">Teléfono:</span>
                              <span className="font-medium text-slate-800">{companyPhone}</span>
                            </div>
                          )}
                          {companyAddress && (
                            <div className="text-slate-600 border-t border-slate-100 pt-1">
                              <span className="text-slate-400 block font-semibold">Domicilio:</span>
                              <span className="text-slate-700 font-medium line-clamp-2">{companyAddress}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center text-slate-400 text-[9px] italic">
                          Datos de empresa configurables en Ajustes
                        </div>
                      )}

                      {/* Firma Autorizada */}
                      <div className="pt-2 text-center">
                        <div className="w-28 border-b border-slate-300 mx-auto mb-1" />
                        <p className="text-[8.5px] font-bold text-slate-700 uppercase tracking-wider">
                          Firma Autorizada
                        </p>
                        <p className="text-[7.5px] text-slate-400">Recursos Humanos / Dirección</p>
                      </div>
                    </div>

                    {/* Strip Footer */}
                    <div className="bg-slate-900 py-1.5 px-3 text-center shrink-0">
                      <p className="text-[7.5px] font-mono text-slate-300 tracking-wider uppercase">
                        EN CASO DE EXTRAVÍO FAVOR DE REPORTARLO
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Column: Metrics, Link & Actions */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Historial en Vivo */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Consultas en Vivo</span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">Activo</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Último escaneo: <strong className="text-slate-700">{formatLastView(employee.lastCredentialViewAt)}</strong>
                    </p>
                  </div>
                </div>

                <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-right shrink-0 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total</span>
                  <span className="text-sm font-black text-slate-900 font-mono flex items-center justify-end gap-1 mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    {employee.credentialViewsCount || 0} <span className="text-xs font-medium text-slate-500 font-sans">veces</span>
                  </span>
                </div>
              </div>

              {/* Enlace de Validación Pública */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-slate-500" />
                    Enlace de Validación Pública
                  </span>
                  <a 
                    href={verificationUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline text-xs"
                  >
                    Probar enlace <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={verificationUrl} 
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono outline-none select-all shadow-2xs" 
                  />
                  <button 
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
                    title="Copiar enlace"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Acciones Principales */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Acciones y Exportación</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button 
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {isGeneratingPdf ? 'Generando PDF...' : 'Descargar Gafete PDF'}
                  </button>

                  <button 
                    onClick={handleShareWhatsApp}
                    className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    Enviar por WhatsApp
                  </button>

                  <button 
                    onClick={handleDownloadQrImage}
                    className="sm:col-span-2 w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    title="Descargar solo la imagen JPG del código QR"
                  >
                    <QrCode className="w-4 h-4 text-slate-500" />
                    Descargar Solo Código QR (JPG Alta Resolución)
                  </button>
                </div>
              </div>

              {/* Resumen de Certificación */}
              <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/70 flex items-start gap-2.5 text-xs text-indigo-950">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Cualquier persona puede escanear este gafete con la cámara de su celular para comprobar al instante la autenticidad, plaza y vigencia laboral del colaborador en el portal oficial sin necesidad de instalar apps.
                </p>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
