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
  Clock
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
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Credencial Virtual Oficial</h3>
              <p className="text-[11px] text-slate-500">Identificación corporativa y validación QR</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Métricas de Consulta / Escaneos QR */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Historial de Consultas</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">En Vivo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Último escaneo: <strong className="text-slate-700">{formatLastView(employee.lastCredentialViewAt)}</strong>
                </p>
              </div>
            </div>

            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-center sm:text-right w-full sm:w-auto shrink-0 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total de Consultas</span>
              <span className="text-base font-black text-slate-900 font-mono flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                {employee.credentialViewsCount || 0} <span className="text-xs font-bold text-slate-500 font-sans">veces</span>
              </span>
            </div>
          </div>

          {/* Card Representation */}
          <div className="relative mx-auto max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden text-slate-900">
            
            {/* Top Brand Header Bar */}
            <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {companyLogoUrl ? (
                  <img 
                    src={companyLogoUrl} 
                    alt="Logo Empresa" 
                    className="h-18 sm:h-22 max-w-[240px] object-contain shrink-0" 
                  />
                ) : (
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 shrink-0">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 leading-tight truncate">
                    {companyName || 'Mi Oficina'}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Credencial de Identificación</p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-2xs border ${
                isActive 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`} />
                {employee.status || 'ACTIVO'}
              </span>
            </div>

            {/* Credential Content */}
            <div className="p-5">
              <div className="flex items-start gap-4">
                
                {/* Employee Photo */}
                <div className="w-20 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                  {employee.photoUrl ? (
                    <img 
                      src={employee.photoUrl} 
                      alt={`${employee.firstName}`} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <User className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[8px] font-semibold">Sin Foto</span>
                    </div>
                  )}
                </div>

                {/* Main Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate leading-snug">
                    {employee.firstName} {employee.lastName}
                  </h3>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {employee.position || 'Colaborador'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Plaza: <span className="font-semibold text-slate-700">{employee.plaza || 'Sin Plaza'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                    Cat: {employee.category}
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">CURP</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11px] select-all">
                    {employee.curp || 'No registrada'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Celular</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11px]">
                    {employee.phone || 'No registrado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Fecha Ingreso</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11px]">
                    {employee.hireDate || 'No registrada'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Antigüedad</span>
                  <span className="font-semibold text-slate-800 text-[11px]">
                    {calculateYears(employee.hireDate)}
                  </span>
                </div>
              </div>

              {/* QR Verification Bar */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">Certificación Oficial</p>
                    <p className="text-[9px] text-slate-600 font-mono font-bold">FOLIO: {credentialCode}</p>
                  </div>
                </div>

                {qrDataUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadQrImage}
                      className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors text-[10px] flex items-center gap-1 font-semibold"
                      title="Descargar imagen del QR"
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden sm:inline">Descargar QR</span>
                    </button>
                    <img 
                      src={qrDataUrl} 
                      alt="QR Validación" 
                      onClick={handleDownloadQrImage}
                      className="w-12 h-12 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:scale-105 transition-transform" 
                      title="Haz clic para descargar este código QR"
                    />
                  </div>
                )}
              </div>

              {/* Información Corporativa de la Empresa (si está habilitada y capturada) */}
              {showCompanyInfo && (companyRfc || companyAddress || companyPhone) && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 text-[10px] space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200/60 pb-1">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span>INFORMACIÓN FISCAL - {companyName || 'EMPRESA'}</span>
                  </div>
                  {companyRfc && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 uppercase font-semibold">RFC:</span>
                      <span className="font-mono font-bold text-slate-800 select-all">{companyRfc}</span>
                    </div>
                  )}
                  {companyAddress && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400 uppercase font-semibold shrink-0">Domicilio:</span>
                      <span className="font-medium text-slate-700 text-right">{companyAddress}</span>
                    </div>
                  )}
                  {companyPhone && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 uppercase font-semibold">Teléfono:</span>
                      <span className="font-medium text-slate-700 select-all">{companyPhone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Strip */}
            <div className="bg-slate-100 px-4 py-2 border-t border-slate-200 text-center">
              <p className="text-[9px] font-semibold text-slate-500">
                Escanear código QR para validar la vigencia y certificación oficial
              </p>
            </div>
          </div>

          {/* Validation Link Box */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                Enlace de Validación Pública
              </span>
              <a 
                href={verificationUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 hover:underline"
              >
                Abrir enlace <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={verificationUrl} 
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 font-mono outline-none select-all" 
              />
              <button 
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                title="Copiar enlace"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleDownloadQrImage}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Descargar solo el archivo JPG del código QR"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-700" />
              Descargar Solo QR (JPG)
            </button>
            <button 
              onClick={handleShareWhatsApp}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-600" />
              Compartir WhatsApp
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isGeneratingPdf ? 'Generando PDF...' : 'Descargar Gafete PDF'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
