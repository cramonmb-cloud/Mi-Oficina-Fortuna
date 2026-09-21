
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Phone, Mail, User, MapPin, Filter, Layers, Pencil, Lock, Search, X, Building, Link as LinkIcon, FileSpreadsheet, UploadCloud, AlertTriangle, Download, CheckCircle, RefreshCcw, Users, Clipboard, LayoutGrid, Table, Cake, Loader2, FileText, Calendar, Umbrella, Coins, Clock, Check, AlertCircle, MessageSquare, CreditCard, QrCode, Upload, Copy, ExternalLink, ShieldCheck, Eye, Activity, Briefcase, Shield, CheckSquare, Square, Sparkles } from 'lucide-react';
import { Employee, PersonnelCategory, Plaza, VacationRequest, EmployeeContract } from '../types';
import { addEmployee, deleteEmployee, updateEmployee, addPlaza, deletePlaza, saveEmployeesBatch, subscribeToVacationRequests, addVacationRequest, updateVacationRequest, deleteVacationRequest, subscribeToEmployeeContracts } from '../services/dbService';

export interface ComplementedField {
  field: keyof Employee | 'guarantorName' | 'guarantorPhone' | 'guarantorAddress';
  label: string;
  oldValue: string;
  newValue: string;
  selected?: boolean;
}

export interface ImportMatchItem {
  existing: Employee;
  parsed: Partial<Employee>;
  matchReason: string;
  fieldsToComplement: ComplementedField[];
  selected: boolean;
}
import { VacationsControl } from './VacationsControl';
import { VacationsBalancesTable } from './VacationsBalancesTable';
import { ContractsControl } from './ContractsControl';
import { VirtualCredentialModal } from './VirtualCredentialModal';
import { calculateCurp, MEXICAN_STATES } from '../services/curpService';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PersonnelProps {
  employees: Employee[];
  plazas: Plaza[];
  isLoading?: boolean;
  currentUser?: Employee | null;
  companyName?: string;
  companyLogoUrl?: string;
  companyRfc?: string;
  companyAddress?: string;
  companyPhone?: string;
  showCompanyInfoOnCredential?: boolean;
}

const CATEGORIES: PersonnelCategory[] = ['Oficina', 'Ejecutivos', 'Supervisoras', 'Promotoras'];

const INITIAL_FORM_STATE = {
  firstName: '', 
  lastName: '', 
  email: '', 
  position: '', 
  plaza: '', 
  phone: '', 
  curp: '',
  photoUrl: '',
  birthDate: '', 
  hireDate: '',
  category: 'Oficina' as PersonnelCategory,
  accessCode: '',
  linkedExecutiveId: '',
  linkedSupervisorId: '',
  supervisionName: '',
  groupName: '',
  status: 'ACTIVO' as 'ACTIVO' | 'INACTIVO' | 'BAJA',
  // Contract & Legal fields
  address: '',
  civilStatus: 'Soltero(a)',
  nationality: 'Mexicana',
  gender: 'masculino',
  salary: '',
  // Aval / Guarantor fields
  guarantorName: '',
  guarantorAddress: '',
  guarantorPhone: ''
};

import { getLocalDateString } from '../lib/dateUtils';

export const Personnel: React.FC<PersonnelProps> = ({ 
  employees, 
  plazas, 
  isLoading, 
  currentUser, 
  companyName, 
  companyLogoUrl,
  companyRfc,
  companyAddress,
  companyPhone,
  showCompanyInfoOnCredential
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlazaModalOpen, setIsPlazaModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PersonnelCategory | 'Todos'>('Todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedCredentialEmployee, setSelectedCredentialEmployee] = useState<Employee | null>(null);
  const [viewingEmployeeDetails, setViewingEmployeeDetails] = useState<Employee | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Filters State
  const [selectedPlazaFilter, setSelectedPlazaFilter] = useState('');
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  
  const [newPlazaName, setNewPlazaName] = useState('');
  
  const [formData, setFormData] = useState<Partial<Employee>>(INITIAL_FORM_STATE);
  const [curpGender, setCurpGender] = useState<'H' | 'M'>('H');
  const [curpStateCode, setCurpStateCode] = useState<string>('JC');
  const [loading, setLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'general' | 'contract'>('general');

  // Vacations & Contracts Section State
  const [activeSubSection, setActiveSubSection] = useState<'directory' | 'vacations' | 'balances' | 'contracts'>('directory');
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToVacationRequests(
      (data) => setVacationRequests(data),
      (err) => console.error("Error subscribing to vacation requests:", err)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToEmployeeContracts(
      (data) => setContracts(data),
      (err) => console.error("Error subscribing to contracts:", err)
    );
    return () => unsubscribe();
  }, []);

  // Import State
  const [importStep, setImportStep] = useState<'upload' | 'review' | 'processing' | 'success'>('upload');
  const [importedData, setImportedData] = useState<Partial<Employee>[]>([]);
  const [importMatches, setImportMatches] = useState<ImportMatchItem[]>([]);
  const [importNewEmployees, setImportNewEmployees] = useState<Partial<Employee>[]>([]);
  const [reviewTab, setReviewTab] = useState<'matches' | 'new'>('matches');
  const [includeNewEmployees, setIncludeNewEmployees] = useState(true);
  const [importStats, setImportStats] = useState({ updated: 0, added: 0 });
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [importSupervisorId, setImportSupervisorId] = useState('');

  // Derived Lists for Hierarchy
  const availableExecutives = useMemo(() => {
    return employees
      .filter(e => e.category === 'Ejecutivos')
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  const availableSupervisors = useMemo(() => {
    return employees
      .filter(e => e.category === 'Supervisoras')
      .sort((a, b) => {
        const nameA = (a.supervisionName || `${a.firstName} ${a.lastName}`).toLowerCase();
        const nameB = (b.supervisionName || `${b.firstName} ${b.lastName}`).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [employees]);

  const FIELD_LABELS: Record<string, string> = {
    guarantorName: 'Nombre del Aval',
    guarantorPhone: 'Teléfono del Aval',
    guarantorAddress: 'Domicilio del Aval',
    curp: 'CURP',
    phone: 'Teléfono',
    email: 'WhatsApp / Contacto',
    accessCode: 'PIN de Acceso',
    address: 'Domicilio Particular',
    birthDate: 'Fecha de Nacimiento',
    gender: 'Género',
    civilStatus: 'Estado Civil',
    nationality: 'Nacionalidad',
    salary: 'Salario',
    plaza: 'Plaza',
    position: 'Puesto',
    hireDate: 'Fecha de Ingreso',
    groupName: 'Grupo',
    supervisionName: 'Supervisión'
  };

  const normalizeCleanStr = (str?: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const normalizeCleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
  };

  const isPhoneLike = (val?: string): boolean => {
    if (!val) return false;
    const clean = val.trim();
    const digits = clean.replace(/\D/g, '');
    const letters = clean.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
    return digits.length >= 7 && digits.length <= 13 && letters.length <= 2;
  };

  const isPlazaLike = (val?: string): boolean => {
    if (!val) return false;
    const clean = val.trim().toUpperCase();
    if (/^RUTA\s*\d+/i.test(clean)) return true;
    if (plazas.some(p => p.name.toUpperCase() === clean)) return true;
    const letters = clean.replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
    const digits = clean.replace(/\D/g, '');
    return letters.length >= 3 && digits.length < 5;
  };

  const isCurpLike = (val?: string): boolean => {
    if (!val) return false;
    const clean = val.trim().toUpperCase();
    return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(clean) || (clean.length >= 16 && /^[A-Z]{4}\d{6}/.test(clean));
  };

  const findMatchingEmployee = (parsed: Partial<Employee>, existingEmployees: Employee[]): { match: Employee | null; reason: string } => {
    // 1. CURP Match (at least 10 chars)
    const parsedCurp = normalizeCleanStr(parsed.curp);
    if (parsedCurp.length >= 10) {
      const byCurp = existingEmployees.find(e => {
        const eCurp = normalizeCleanStr(e.curp);
        return eCurp.length >= 10 && eCurp === parsedCurp;
      });
      if (byCurp) return { match: byCurp, reason: `CURP coincidente (${byCurp.curp})` };
    }

    // 2. Phone Match (10 digits) - Ignore dummy/placeholder phones like 0000000000
    const parsedPhone = normalizeCleanPhone(parsed.email || parsed.phone);
    if (parsedPhone.length === 10 && !/^(0{10}|1{10}|1234567890)$/.test(parsedPhone)) {
      const byPhone = existingEmployees.find(e => {
        const ePhone = normalizeCleanPhone(e.phone || e.email);
        return ePhone.length === 10 && ePhone === parsedPhone;
      });
      if (byPhone) return { match: byPhone, reason: `Teléfono coincidente (${parsedPhone})` };
    }

    // 3. Name Match (Accent and case-insensitive, token permutation friendly)
    const parsedFirst = normalizeCleanStr(parsed.firstName);
    const parsedLast = normalizeCleanStr(parsed.lastName);
    const parsedFull = `${parsedFirst}${parsedLast}`.trim();

    if (parsedFull.length >= 4) {
      // 3a. Exact combined match
      const exact = existingEmployees.find(e => {
        const eFull = `${normalizeCleanStr(e.firstName)}${normalizeCleanStr(e.lastName)}`.trim();
        const eReverse = `${normalizeCleanStr(e.lastName)}${normalizeCleanStr(e.firstName)}`.trim();
        return eFull === parsedFull || eReverse === parsedFull;
      });
      if (exact) {
        return { match: exact, reason: `Nombre coincidente (${exact.firstName} ${exact.lastName})` };
      }

      // 3b. Token-based word match (handles "ALCALA SEGOVIANO YESENIA" vs "YESENIA ALCALA SEGOVIANO")
      const parsedTokens = `${parsed.firstName || ''} ${parsed.lastName || ''}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 2);

      if (parsedTokens.length >= 2) {
        const tokenMatch = existingEmployees.find(e => {
          const eTokens = `${e.firstName || ''} ${e.lastName || ''}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(t => t.length > 2);

          if (eTokens.length < 2) return false;
          return parsedTokens.every(t => eTokens.includes(t)) || eTokens.every(t => parsedTokens.includes(t));
        });

        if (tokenMatch) {
          return { match: tokenMatch, reason: `Nombre similar (${tokenMatch.firstName} ${tokenMatch.lastName})` };
        }
      }
    }

    return { match: null, reason: '' };
  };

  const computeFieldComplements = (existing: Employee, parsed: Partial<Employee>): ComplementedField[] => {
    const complements: ComplementedField[] = [];

    Object.entries(FIELD_LABELS).forEach(([key, label]) => {
      const newVal = String((parsed as any)[key] || '').trim();
      const oldVal = String((existing as any)[key] || '').trim();

      // If the imported record has data for this field
      if (newVal) {
        // --- STRICT SANITY & TYPE SAFETY GUARDS ---
        // 1. Plaza: NEVER allow a phone number or pure numeric code to replace or populate plaza!
        if (key === 'plaza') {
          if (isPhoneLike(newVal) || newVal.replace(/\D/g, '').length >= 7) return;
          if (newVal.length < 2) return;
        }

        // 2. Phone / Email / Contact: Must have at least 7 digits, cannot be text like "RUTA 1"
        if (key === 'phone' || key === 'email' || key === 'guarantorPhone') {
          const cleanDigits = newVal.replace(/\D/g, '');
          if (cleanDigits.length < 7) return;
          const cleanOld = oldVal.replace(/\D/g, '').slice(-10);
          const cleanNew = cleanDigits.slice(-10);
          if (cleanOld && cleanOld === cleanNew) return;
        }

        // 3. CURP: Never downgrade a valid 18-char CURP with an invalid fragment or number
        if (key === 'curp') {
          if (!isCurpLike(newVal) && newVal.length < 15) return;
          if (existing.curp && isCurpLike(existing.curp) && !isCurpLike(newVal)) return;
        }

        // 4. Dates: Must be valid date strings
        if (key === 'birthDate' || key === 'hireDate') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(newVal) && isNaN(Date.parse(newVal))) return;
        }

        // 5. Position: Cannot be phone numbers or pure numbers
        if (key === 'position') {
          if (isPhoneLike(newVal) || newVal.replace(/\D/g, '').length >= 7) return;
        }

        // If existing is missing or different
        if (!oldVal || oldVal.toLowerCase() !== newVal.toLowerCase()) {
          complements.push({
            field: key as any,
            label,
            oldValue: oldVal || '(Vacío)',
            newValue: newVal,
            selected: true
          });
        }
      }
    });

    return complements;
  };

  const analyzeParsedData = (parsedList: Partial<Employee>[]) => {
    const matches: ImportMatchItem[] = [];
    const newEmps: Partial<Employee>[] = [];

    parsedList.forEach(parsed => {
      const { match, reason } = findMatchingEmployee(parsed, employees);
      if (match) {
        const complements = computeFieldComplements(match, parsed);
        matches.push({
          existing: match,
          parsed,
          matchReason: reason,
          fieldsToComplement: complements,
          selected: true
        });
      } else {
        newEmps.push(parsed);
      }
    });

    setImportedData(parsedList);
    setImportMatches(matches);
    setImportNewEmployees(newEmps);
    setReviewTab(matches.length > 0 ? 'matches' : 'new');
    setImportStep('review');
  };

  const handlePasteAnalysis = () => {
    if (!importSupervisorId) {
      alert("Por favor selecciona una supervisora primero.");
      return;
    }
    if (!pasteContent.trim()) {
      alert("Por favor pega el contenido de la tabla.");
      return;
    }

    const rows = pasteContent.trim().split('\n');
    const parsed: Partial<Employee>[] = [];
    
    const supervisor = availableSupervisors.find(s => s.id === importSupervisorId);
    const linkedExecutiveId = supervisor?.linkedExecutiveId;
    const executive = availableExecutives.find(e => e.id === linkedExecutiveId);
    const plaza = executive?.plaza || '';

    rows.forEach(row => {
       // Split by tab first (Excel copy usually is tab)
       let cols = row.split('\t');
       if (cols.length < 2) cols = row.split(','); // Fallback
       
       // Remove empty cols and trim
       cols = cols.map(c => c.trim());
       
       if (cols.length === 0 || !cols[0]) return;

       // Skip header if detected
       if (cols[0].toUpperCase().includes('PROMOTORA') || cols[0].toUpperCase().includes('NOMBRE')) return;

       const fullName = cols[0];
       const dateStr = cols[1]; // 17/03/1986
       const group = cols[2] || '';

       // Name Parsing: Assume last 2 words are surnames if > 2 words, else split half
       const nameParts = fullName.split(' ').filter(n => n);
       let firstName = '';
       let lastName = '';
       
       if (nameParts.length > 2) {
          lastName = nameParts.slice(-2).join(' ');
          firstName = nameParts.slice(0, -2).join(' ');
       } else if (nameParts.length === 2) {
          firstName = nameParts[0];
          lastName = nameParts[1];
       } else {
          firstName = nameParts[0] || '';
       }

       // Date Parsing (DD/MM/YYYY -> YYYY-MM-DD)
       let birthDate = '';
       if (dateStr) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
             const day = parts[0].padStart(2, '0');
             const month = parts[1].padStart(2, '0');
             const year = parts[2];
             birthDate = `${year}-${month}-${day}`;
          } else {
             birthDate = dateStr; 
          }
       }

       const autoCurp = (firstName && birthDate) ? calculateCurp({
          firstName,
          lastName,
          birthDate,
          gender: 'M',
          stateCode: 'JC'
       }) : '';

       parsed.push({
          firstName,
          lastName,
          category: 'Promotoras',
          linkedSupervisorId: importSupervisorId,
          linkedExecutiveId: linkedExecutiveId,
          plaza: plaza,
          birthDate,
          gender: 'femenino',
          curp: autoCurp || '',
          groupName: group,
          email: '', 
          phone: '',
          position: 'Promotora',
          status: 'ACTIVO',
          civilStatus: 'Soltero(a)',
          nationality: 'Mexicana',
          hireDate: getLocalDateString() 
       });
    });

    if (parsed.length === 0) {
      alert("No se pudieron detectar registros válidos en el texto pegado.");
      return;
    }

    analyzeParsedData(parsed);
  };

  const filteredEmployees = useMemo(() => {
    const list = employees.filter(e => {
      // 1. Filter by Category
      const matchesCategory = activeCategory === 'Todos' || e.category === activeCategory;
      
      // 2. Filter by Search Term
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === '' || 
        (e.firstName || '').toLowerCase().includes(searchLower) ||
        (e.lastName || '').toLowerCase().includes(searchLower) ||
        (e.position || '').toLowerCase().includes(searchLower) ||
        (e.groupName || '').toLowerCase().includes(searchLower) ||
        (e.plaza && e.plaza.toLowerCase().includes(searchLower));

      // 3. Filter by Plaza Dropdown
      const matchesPlaza = selectedPlazaFilter ? e.plaza === selectedPlazaFilter : true;

      // 4. Filter by Supervisor Dropdown
      const matchesSupervisor = selectedSupervisorFilter ? e.linkedSupervisorId === selectedSupervisorFilter : true;

      // 5. Filter by Status Dropdown
      const matchesStatus = selectedStatusFilter ? (e.status || 'ACTIVO') === selectedStatusFilter : true;

      return matchesCategory && matchesSearch && matchesPlaza && matchesSupervisor && matchesStatus;
    });

    // Sort alphabetically by first name and last name
    return list.sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase().trim();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase().trim();
      return nameA.localeCompare(nameB);
    });
  }, [employees, activeCategory, searchTerm, selectedPlazaFilter, selectedSupervisorFilter, selectedStatusFilter]);

  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      // Edit Mode
      setEditingId(emp.id);
      setFormData({
        ...emp,
        accessCode: emp.accessCode || '',
        category: emp.category || 'Promotoras',
        status: emp.status || 'ACTIVO',
        curp: emp.curp || '',
        address: emp.address || '',
        civilStatus: emp.civilStatus || 'Soltero(a)',
        nationality: emp.nationality || 'Mexicana',
        gender: emp.gender || (emp.curp && emp.curp[10] === 'M' ? 'femenino' : 'masculino'),
        salary: emp.salary !== undefined && emp.salary !== null ? String(emp.salary) : '',
        guarantorName: emp.guarantorName || '',
        guarantorAddress: emp.guarantorAddress || '',
        guarantorPhone: emp.guarantorPhone || ''
      });

      // Try extracting gender and state from existing CURP
      if (emp.curp && emp.curp.length >= 13) {
        const gen = emp.curp[10];
        if (gen === 'H' || gen === 'M') setCurpGender(gen as 'H' | 'M');
        const st = emp.curp.substring(11, 13);
        if (MEXICAN_STATES.some(s => s.code === st)) setCurpStateCode(st);
      }
    } else {
      // Create Mode
      setEditingId(null);
      setFormData(INITIAL_FORM_STATE);
      setCurpGender('H');
      setCurpStateCode('JC');
    }
    setModalTab('general');
    setIsModalOpen(true);
  };

  // Descarga directa de solo el código QR en JPG con el nombre del colaborador
  const handleDirectDownloadQr = async (employee: Employee, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const verificationUrl = `${window.location.origin}/?credencial=${employee.id}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 1000,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });

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
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
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
    } catch (err) {
      console.error("Error generating QR for download:", err);
      alert("Error al generar el código QR.");
    }
  };

  // Helpers para cálculo de edad y tiempo de servicio
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 'No registrada';
    try {
      const birth = new Date(birthDate + 'T00:00:00');
      if (isNaN(birth.getTime())) return 'Fecha inválida';
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return `${age} años`;
    } catch {
      return 'No registrada';
    }
  };

  const calculateServiceTimeDetailed = (hireDate?: string) => {
    if (!hireDate) return 'Sin fecha de ingreso';
    try {
      const hire = new Date(hireDate + 'T00:00:00');
      if (isNaN(hire.getTime())) return 'Fecha inválida';
      const today = new Date();
      const totalMonths = (today.getFullYear() - hire.getFullYear()) * 12 + (today.getMonth() - hire.getMonth()) + (today.getDate() >= hire.getDate() ? 0 : -1);
      if (totalMonths < 0) return 'Sin registro';
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
      const semesters = Math.floor(totalMonths / 6);
      
      let parts: string[] = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
      if (parts.length === 0) parts.push('Menos de 1 mes');
      
      return `${parts.join(' y ')} (${semesters} ${semesters === 1 ? 'periodo de 6m cumplido' : 'periodos de 6m cumplidos'})`;
    } catch {
      return 'Sin registro';
    }
  };

  const handleCopyValue = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Helper para generar email automático
  const generateAutoEmail = (first: string, last: string) => {
    const clean = (str: string) => str
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9\s]/g, "") 
      .split(/\s+/)[0]; 

    const cleanFirst = clean(first);
    const cleanLast = clean(last);

    if (cleanFirst && cleanLast) {
      return `${cleanFirst}.${cleanLast}@everestfinanciera.com`;
    }
    return '';
  };

  // Handle Supervisor Selection Change for Promoters
  const handleSupervisorChange = (supervisorId: string) => {
    const supervisor = availableSupervisors.find(s => s.id === supervisorId);
    const autoExecutiveId = supervisor?.linkedExecutiveId || '';
    
    // Auto-set plaza from the linked executive if available
    const executive = availableExecutives.find(e => e.id === autoExecutiveId);
    const autoPlaza = executive?.plaza || '';

    setFormData(prev => ({
      ...prev,
      linkedSupervisorId: supervisorId,
      linkedExecutiveId: autoExecutiveId,
      plaza: autoPlaza || prev.plaza // Set plaza automatically
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.firstName || !formData.firstName.trim()) {
          alert("El nombre es obligatorio.");
          setLoading(false);
          return;
      }

      if (formData.accessCode && (!/^\d{4}$/.test(formData.accessCode))) {
          alert("El código de acceso debe ser de 4 dígitos numéricos.");
          setLoading(false);
          return;
      }

      if (formData.email && !/^\d{1,10}$/.test(formData.email)) {
          alert("El Celular / WhatsApp debe ser numérico de máximo 10 dígitos.");
          setLoading(false);
          return;
      }

      const employeeData = {
        ...formData,
        category: formData.category || 'Oficina',
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        email: formData.email || '',
        position: formData.position || '',
        plaza: formData.plaza || '',
        phone: formData.phone || formData.email || '',
        curp: formData.curp ? formData.curp.trim().toUpperCase() : '',
        photoUrl: formData.photoUrl || '',
        birthDate: formData.birthDate || '',
        hireDate: formData.hireDate || '',
        groupName: formData.groupName || '',
        status: formData.status || 'ACTIVO',
        address: formData.address || '',
        civilStatus: formData.civilStatus || 'Soltero(a)',
        nationality: formData.nationality || 'Mexicana',
        gender: formData.gender || (curpGender === 'M' ? 'femenino' : 'masculino'),
        salary: formData.salary || '',
        guarantorName: formData.guarantorName ? formData.guarantorName.trim() : '',
        guarantorAddress: formData.guarantorAddress ? formData.guarantorAddress.trim() : '',
        guarantorPhone: formData.guarantorPhone ? formData.guarantorPhone.trim() : ''
      };

      if (editingId) {
        await updateEmployee(editingId, employeeData);
      } else {
        await addEmployee(employeeData as Omit<Employee, 'id'>);
      }

      setIsModalOpen(false);
      setFormData(INITIAL_FORM_STATE);
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert('Error al guardar empleado');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este empleado?')) {
      await deleteEmployee(id);
    }
  };

  // --- IMPORT EXCEL LOGIC ---

  const formatExcelDate = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel serial date number
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const [d, m, y] = str.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return str;
  };

  const normalizeCategory = (val: any): PersonnelCategory => {
    const s = String(val || '').trim().toLowerCase();
    if (s.includes('ejecutiv')) return 'Ejecutivos';
    if (s.includes('supervis')) return 'Supervisoras';
    if (s.includes('promot')) return 'Promotoras';
    return 'Oficina';
  };

  const normalizeStatus = (val: any): 'ACTIVO' | 'INACTIVO' | 'BAJA' => {
    const s = String(val || '').trim().toUpperCase();
    if (s.includes('INACT')) return 'INACTIVO';
    if (s.includes('BAJA')) return 'BAJA';
    return 'ACTIVO';
  };

  const normalizeGender = (val: any, curpVal?: string): string => {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'H' || s.startsWith('MASC') || s.startsWith('HOMB')) return 'masculino';
    if (s === 'M' || s.startsWith('FEM') || s.startsWith('MUJ')) return 'femenino';
    if (curpVal && curpVal.length >= 11) {
      return curpVal[10] === 'M' ? 'femenino' : 'masculino';
    }
    return 'masculino';
  };
  
  const handleDownloadTemplate = () => {
    const headers = [
      [
        'Nombre',
        'Apellido',
        'Celular / WhatsApp',
        'PIN Acceso (4 dígitos)',
        'Puesto',
        'Plaza',
        'Categoría (Oficina, Ejecutivos, Supervisoras, Promotoras)',
        'Estado Laboral (ACTIVO, INACTIVO, BAJA)',
        'Fecha Ingreso (YYYY-MM-DD)',
        'Fecha Nacimiento (YYYY-MM-DD)',
        'Sexo (H/M)',
        'CURP (18 dígitos)',
        'Supervisión / Grupo',
        'Domicilio Particular',
        'Estado Civil',
        'Nacionalidad',
        'Salario Acordado ($)',
        'Nombre del Aval',
        'Teléfono del Aval',
        'Domicilio del Aval'
      ]
    ];
    const exampleData = [
      [
        'Juan Carlos',
        'Perez Gomez',
        '3411234567',
        '1234',
        'Gerente Administrativo',
        'Ciudad Guzman',
        'Oficina',
        'ACTIVO',
        '2023-01-15',
        '1990-05-20',
        'H',
        'PEGJ900520HJCXXXX01',
        '',
        'Av. Hidalgo 123, Col. Centro, CP 49000, Zapotlán el Grande, Jal.',
        'Casado(a)',
        'Mexicana',
        '4500.00',
        'Roberto Perez Mendoza',
        '3419876543',
        'Calle Reforma 45, Col. Centro, CP 49000'
      ],
      [
        'Maria Elena',
        'Lopez Ramirez',
        '3419876543',
        '4321',
        'Promotora',
        'Autlan',
        'Promotoras',
        'ACTIVO',
        '2023-03-01',
        '1995-10-12',
        'M',
        'LORM951012MJCXXXX02',
        'Grupo Las Rosas',
        'Calle Morelos 456, Col. Ejidal, Autlán de Navarro, Jal.',
        'Soltero(a)',
        'Mexicana',
        '3000.00',
        'Rosa Maria Ramirez',
        '3415551234',
        'Calle Zaragoza 78, Autlán de Navarro, Jal.'
      ],
      [
        'Patricia',
        'Hernandez Alvarez',
        '3418889900',
        '5678',
        'Supervisora',
        'Sayula',
        'Supervisoras',
        'ACTIVO',
        '2022-08-10',
        '1988-02-14',
        'M',
        'HEAP880214MJCXXXX03',
        'Supervisión Sur',
        'Av. Vallarta 789, Sayula, Jal.',
        'Soltero(a)',
        'Mexicana',
        '5500.00',
        'Carlos Hernandez',
        '3417776655',
        'Av. Vallarta 790, Sayula, Jal.'
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 22 },
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 35 }, { wch: 15 },
      { wch: 14 }, { wch: 16 }, { wch: 25 }, { wch: 18 }, { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Empleados");
    XLSX.writeFile(wb, "Plantilla_Importacion_Personal_Completa.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length < 2) {
          alert("El archivo no contiene filas con datos para importar.");
          return;
        }

        // Flexible header mapping detection
        const normalizeCol = (str: string) => 
          str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        // 1. Detect true header row (scan first 6 rows for maximum recognized columns)
        let headerRowIndex = 0;
        let maxMatches = 0;
        for (let r = 0; r < Math.min(data.length, 6); r++) {
          const rowArr = ((data[r] as any[]) || []).map(c => String(c || '').trim());
          let count = 0;
          rowArr.forEach(cell => {
            const n = normalizeCol(cell);
            if (!n) return;
            if (
              n.includes('nombre') || n.includes('colaborador') || n.includes('empleado') ||
              n.includes('apellido') || n.includes('celular') || n.includes('telefono') ||
              n.includes('puesto') || n.includes('plaza') || n.includes('curp') ||
              n.includes('ingreso') || n.includes('nacimiento') || n.includes('aval') ||
              n.includes('sucursal') || n.includes('ruta')
            ) {
              count++;
            }
          });
          if (count > maxMatches) {
            maxMatches = count;
            headerRowIndex = r;
          }
        }

        const headerRow: string[] = ((data[headerRowIndex] as any[]) || []).map(c => String(c || '').trim());
        const colMap: Record<string, number> = {};

        headerRow.forEach((colName, idx) => {
          const norm = normalizeCol(colName);
          if (!norm) return;

          if (norm.includes('aval') || norm.includes('garante') || norm.includes('referencia')) {
            if (norm.includes('telefono') || norm.includes('celular') || norm.includes('whatsapp') || norm.includes('tel') || norm.includes('movil') || norm.includes('contacto')) {
              if (colMap['guarantorPhone'] === undefined) colMap['guarantorPhone'] = idx;
            } else if (norm.includes('domicilio') || norm.includes('direccion') || norm.includes('calle') || norm.includes('ubicacion')) {
              if (colMap['guarantorAddress'] === undefined) colMap['guarantorAddress'] = idx;
            } else {
              if (colMap['guarantorName'] === undefined) colMap['guarantorName'] = idx;
            }
          } else if (norm.includes('apellido') || norm.includes('lastname') || norm.includes('paterno') || norm.includes('materno')) {
            if (colMap['lastName'] === undefined) colMap['lastName'] = idx;
          } else if (norm.includes('nombrecompleto') || norm.includes('colaborador') || norm.includes('empleado') || norm.includes('personal') || norm.includes('trabajador')) {
            if (colMap['fullName'] === undefined) colMap['fullName'] = idx;
          } else if (norm.includes('nombre') || norm.includes('firstname')) {
            if (colMap['firstName'] === undefined) colMap['firstName'] = idx;
          } else if (norm.includes('celular') || norm.includes('whatsapp') || norm.includes('telefono') || norm.includes('movil') || norm.includes('contacto') || norm.includes('phone') || norm === 'tel') {
            if (colMap['email'] === undefined) colMap['email'] = idx;
          } else if (norm.includes('pin') || norm.includes('acceso') || norm.includes('clave') || norm.includes('pass') || norm.includes('codigo')) {
            if (colMap['accessCode'] === undefined) colMap['accessCode'] = idx;
          } else if (norm.includes('puesto') || norm.includes('cargo') || norm.includes('position') || norm.includes('rol') || norm.includes('funcion') || norm.includes('ocupacion')) {
            if (colMap['position'] === undefined) colMap['position'] = idx;
          } else if ((norm.includes('plaza') || norm.includes('sucursal') || norm.includes('sede') || norm.includes('ciudad') || norm.includes('zona') || norm.includes('ruta') || norm.includes('oficina') || norm.includes('adscripcion')) && !norm.includes('telefono') && !norm.includes('celular') && !norm.includes('tel') && !norm.includes('aval')) {
            if (colMap['plaza'] === undefined) colMap['plaza'] = idx;
          } else if (norm.includes('categoria') || norm.includes('departamento') || norm.includes('depto') || norm.includes('area')) {
            if (colMap['category'] === undefined) colMap['category'] = idx;
          } else if ((norm.includes('estado') || norm.includes('estatus') || norm.includes('status') || norm.includes('activo')) && !norm.includes('civil')) {
            if (colMap['status'] === undefined) colMap['status'] = idx;
          } else if (norm.includes('ingreso') || norm.includes('contratacion') || norm.includes('alta') || norm.includes('fechainicio') || norm.includes('fechaingreso') || norm.includes('antiguedad')) {
            if (colMap['hireDate'] === undefined) colMap['hireDate'] = idx;
          } else if (norm.includes('nacimiento') || norm.includes('cumple') || norm.includes('fechanac')) {
            if (colMap['birthDate'] === undefined) colMap['birthDate'] = idx;
          } else if (norm.includes('sexo') || norm.includes('genero') || norm.includes('gender') || norm.includes('sex')) {
            if (colMap['gender'] === undefined) colMap['gender'] = idx;
          } else if (norm.includes('curp')) {
            if (colMap['curp'] === undefined) colMap['curp'] = idx;
          } else if (norm.includes('supervision') || norm.includes('grupo') || norm.includes('equipo') || norm.includes('coordinador')) {
            if (colMap['supervisionOrGroup'] === undefined) colMap['supervisionOrGroup'] = idx;
          } else if (norm.includes('domicilio') || norm.includes('direccion') || norm.includes('calle') || norm.includes('vivienda')) {
            if (colMap['address'] === undefined) colMap['address'] = idx;
          } else if (norm.includes('civil')) {
            if (colMap['civilStatus'] === undefined) colMap['civilStatus'] = idx;
          } else if (norm.includes('nacionalidad') || norm.includes('pais')) {
            if (colMap['nationality'] === undefined) colMap['nationality'] = idx;
          } else if (norm.includes('salario') || norm.includes('sueldo') || norm.includes('pago') || norm.includes('percepcion') || norm.includes('honorario')) {
            if (colMap['salary'] === undefined) colMap['salary'] = idx;
          }
        });

        const hasHeaderMapping = maxMatches >= 2 || colMap['firstName'] !== undefined || colMap['fullName'] !== undefined || colMap['email'] !== undefined;

        const getCol = (row: any[], field: string, fallbackIdx: number) => {
          if (hasHeaderMapping) {
            // When headers exist, NEVER fall back to unrelated column indices!
            return colMap[field] !== undefined ? row[colMap[field]] : undefined;
          }
          // Only if no headers were detected at all, use standard fallback positional index
          return row[fallbackIdx];
        };

        const parsedEmployees: Partial<Employee>[] = [];

        // Process rows (skip detected header row)
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row: any = data[i];
          if (!row || (!row[0] && !row[1] && !row[2])) continue;

          let rawFirstName = String(getCol(row, 'firstName', 0) || '').trim();
          let rawLastName = String(getCol(row, 'lastName', 1) || '').trim();

          // Handle single full name column if separate last name is absent
          if ((!rawLastName || colMap['fullName'] !== undefined) && (colMap['fullName'] !== undefined || (colMap['firstName'] !== undefined && colMap['lastName'] === undefined))) {
            const fullNameCandidate = String(colMap['fullName'] !== undefined ? row[colMap['fullName']] : rawFirstName || '').trim();
            if (fullNameCandidate) {
              const nameParts = fullNameCandidate.split(/\s+/).filter(Boolean);
              if (nameParts.length > 2) {
                rawLastName = nameParts.slice(-2).join(' ');
                rawFirstName = nameParts.slice(0, -2).join(' ');
              } else if (nameParts.length === 2) {
                rawFirstName = nameParts[0];
                rawLastName = nameParts[1];
              } else {
                rawFirstName = fullNameCandidate;
                rawLastName = '';
              }
            }
          }

          if (!rawFirstName && !rawLastName) continue;

          let rawPhoneOrEmail = String(getCol(row, 'email', 2) || '').trim();
          const rawPin = String(getCol(row, 'accessCode', 3) || '').replace(/\D/g, '').slice(0, 4);
          let rawPosition = String(getCol(row, 'position', 4) || '').trim();
          let rawPlaza = String(getCol(row, 'plaza', 5) || '').trim();
          const category = normalizeCategory(getCol(row, 'category', 6));
          const status = normalizeStatus(getCol(row, 'status', 7));
          const hireDate = formatExcelDate(getCol(row, 'hireDate', 8)) || getLocalDateString();
          const birthDate = formatExcelDate(getCol(row, 'birthDate', 9));
          const rawGender = getCol(row, 'gender', 10);
          let rawCurp = String(getCol(row, 'curp', 11) || '').trim().toUpperCase().slice(0, 18);

          // --- SMART DATA DISAMBIGUATION (Never allow phone numbers in Plaza or viceversa) ---
          // 1. If Plaza contains a phone number (e.g. "3171219219" or "+52 312 111 2233")
          if (isPhoneLike(rawPlaza)) {
            if (!rawPhoneOrEmail || !isPhoneLike(rawPhoneOrEmail)) {
              rawPhoneOrEmail = rawPlaza;
            }
            rawPlaza = ''; // CLEAR PLAZA to prevent phone number corruption!
          } else if (isCurpLike(rawPlaza)) {
            if (!rawCurp) rawCurp = rawPlaza;
            rawPlaza = '';
          }

          // 2. If Phone contains a Plaza name (e.g. "RUTA 1" or "MANZANILLO")
          if (isPlazaLike(rawPhoneOrEmail) && !rawPlaza) {
            rawPlaza = rawPhoneOrEmail;
            rawPhoneOrEmail = '';
          } else if (isCurpLike(rawPhoneOrEmail) && !rawCurp) {
            rawCurp = rawPhoneOrEmail;
            rawPhoneOrEmail = '';
          }

          // 3. If Position is a phone number
          if (isPhoneLike(rawPosition)) {
            if (!rawPhoneOrEmail) rawPhoneOrEmail = rawPosition;
            rawPosition = '';
          } else if (isPlazaLike(rawPosition) && !rawPlaza) {
            rawPlaza = rawPosition;
            rawPosition = '';
          }

          // 4. If CURP is a phone number
          if (isPhoneLike(rawCurp)) {
            if (!rawPhoneOrEmail) rawPhoneOrEmail = rawCurp;
            rawCurp = '';
          }

          // Format clean 10-digit phone
          const cleanPhone = rawPhoneOrEmail.replace(/\D/g, '').slice(-10);

          const gender = normalizeGender(rawGender, rawCurp);

          // Auto-calculate CURP if omitted but birthDate and names present
          if (!rawCurp && rawFirstName && birthDate) {
            const auto = calculateCurp({
              firstName: rawFirstName,
              lastName: rawLastName,
              birthDate,
              gender: gender === 'femenino' ? 'M' : 'H',
              stateCode: 'JC'
            });
            if (auto) rawCurp = auto;
          }

          const supOrGroup = String(getCol(row, 'supervisionOrGroup', 12) || '').trim();
          const address = String(getCol(row, 'address', 13) || '').trim();
          const civilStatus = String(getCol(row, 'civilStatus', 14) || 'Soltero(a)').trim();
          const nationality = String(getCol(row, 'nationality', 15) || 'Mexicana').trim();
          const salary = String(getCol(row, 'salary', 16) || '').trim();

          const guarantorName = String(getCol(row, 'guarantorName', 17) || '').trim();
          const guarantorPhone = String(getCol(row, 'guarantorPhone', 18) || '').replace(/\D/g, '').slice(0, 10);
          const guarantorAddress = String(getCol(row, 'guarantorAddress', 19) || '').trim();

          let supervisionName = '';
          let groupName = '';
          if (category === 'Supervisoras') {
            supervisionName = supOrGroup;
          } else if (category === 'Promotoras') {
            groupName = supOrGroup;
          }

          parsedEmployees.push({
            firstName: rawFirstName,
            lastName: rawLastName,
            email: cleanPhone,
            phone: cleanPhone,
            accessCode: rawPin,
            position: rawPosition || (category === 'Promotoras' ? 'Promotora' : category === 'Supervisoras' ? 'Supervisora' : 'Colaborador'),
            plaza: rawPlaza,
            category,
            status,
            hireDate,
            birthDate,
            gender,
            curp: rawCurp,
            supervisionName,
            groupName,
            address,
            civilStatus,
            nationality: nationality || 'Mexicana',
            salary,
            guarantorName,
            guarantorPhone,
            guarantorAddress
          });
        }

        if (parsedEmployees.length === 0) {
          alert("No se encontraron filas con datos de colaboradores para importar.");
          return;
        }

        analyzeParsedData(parsedEmployees);

      } catch (err) {
        console.error("Error parsing excel", err);
        alert("Error al leer el archivo. Por favor verifica que sea un archivo Excel válido (.xlsx, .xls, .csv).");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    setImportStep('processing');
    try {
      let updatedCount = 0;
      let addedCount = 0;

      // 1. Process selected matches safely: updateDoc preserves Firestore document ID and all related Fallos!
      const selectedMatches = importMatches.filter(m => m.selected && m.fieldsToComplement.length > 0);
      for (const match of selectedMatches) {
        const updates: Partial<Employee> = {};
        match.fieldsToComplement.forEach(f => {
          if (f.selected !== false) {
            (updates as any)[f.field] = f.newValue;
          }
        });
        if (Object.keys(updates).length > 0) {
          await updateEmployee(match.existing.id, updates);
          updatedCount++;
        }
      }

      // 2. Process new employees if included
      if (includeNewEmployees && importNewEmployees.length > 0) {
        await saveEmployeesBatch(importNewEmployees as any[]);
        addedCount = importNewEmployees.length;
      }

      setImportStats({ updated: updatedCount, added: addedCount });
      setImportStep('success');
    } catch (e) {
      console.error("Error al procesar la importación:", e);
      alert("Ocurrió un error al aplicar los cambios. Revisa la consola.");
      setImportStep('review');
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('upload');
    setImportedData([]);
    setImportMatches([]);
    setImportNewEmployees([]);
    setReviewTab('matches');
    setIncludeNewEmployees(true);
    setImportStats({ updated: 0, added: 0 });
    setImportMode('file');
    setPasteContent('');
    setImportSupervisorId('');
  };


  // --- Plaza Management ---
  const handleAddPlaza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlazaName.trim()) return;
    try {
      await addPlaza(newPlazaName.trim());
      setNewPlazaName('');
    } catch (e) {
      alert("Error al agregar plaza");
    }
  };

  const handleDeletePlaza = async (id: string) => {
    if (confirm("¿Borrar esta plaza? Los empleados asignados mantendrán el nombre de la plaza pero ya no estará en la lista.")) {
      try {
        await deletePlaza(id);
      } catch (e) {
        alert("Error al borrar plaza");
      }
    }
  };

  // --- Export Logic ---
  const handleExportExcel = () => {
    const dataToExport = filteredEmployees.map(emp => ({
      'Categoría': emp.category,
      'Nombre': emp.firstName || '',
      'Apellido': emp.lastName || '',
      'Celular / WhatsApp': emp.email || '',
      'PIN Acceso (4 dígitos)': emp.accessCode || '',
      'Puesto': emp.position || '',
      'Plaza': emp.plaza || '',
      'Estado Laboral': emp.status || 'ACTIVO',
      'Fecha Ingreso (YYYY-MM-DD)': emp.hireDate || '',
      'Fecha Nacimiento (YYYY-MM-DD)': emp.birthDate || '',
      'Sexo (H/M)': emp.gender === 'femenino' ? 'M' : 'H',
      'CURP (18 dígitos)': emp.curp || '',
      'Ejecutivo': getLinkedName(emp.linkedExecutiveId) || 'N/A',
      'Supervisora': emp.category === 'Promotoras' 
        ? getLinkedName(emp.linkedSupervisorId) || 'N/A' 
        : (emp.category === 'Supervisoras' ? emp.supervisionName || 'N/A' : 'N/A'),
      'Supervisión / Grupo': emp.supervisionName || emp.groupName || '',
      'Domicilio Particular': emp.address || '',
      'Estado Civil': emp.civilStatus || 'Soltero(a)',
      'Nacionalidad': emp.nationality || 'Mexicana',
      'Salario Acordado ($)': emp.salary || '',
      'Nombre del Aval': emp.guarantorName || '',
      'Teléfono del Aval': emp.guarantorPhone || '',
      'Domicilio del Aval': emp.guarantorAddress || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Reporte_Personal_Completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Header Banner
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 297, 30, 'F'); 

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text('Directorio de Personal - Reporte', 14, 20);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 14, 40);
    doc.text(`Categoría filtrada: ${activeCategory}`, 14, 46);
    doc.text(`Resultados encontrados: ${filteredEmployees.length}`, 14, 52);
    
    const tableColumn = ["Nombre / Apellido", "Categoría / Puesto", "Plaza", "Vinculación / Grupo", "Ingreso"];
    const tableRows = filteredEmployees.map(emp => [
      `${emp.firstName} ${emp.lastName}`,
      `${emp.category}${emp.position ? ' - ' + emp.position : ''}`,
      emp.plaza || '-',
      `${emp.category === 'Promotoras' 
        ? 'Sup: ' + (getLinkedName(emp.linkedSupervisorId) || 'N/A') + (emp.groupName ? ' | G: ' + emp.groupName : '')
        : (emp.category === 'Supervisoras' ? 'Ejecutivo: ' + (getLinkedName(emp.linkedExecutiveId) || 'N/A') : '-')}`,
      emp.hireDate || '-'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 58,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [243, 244, 246] }
    });

    doc.save(`Reporte_Personal_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'Oficina': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Ejecutivos': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Supervisoras': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Promotoras': return 'bg-cyan-100 text-cyan-700 border-cyan-200'; 
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLinkedName = (id?: string) => {
    if (!id) return null;
    const emp = employees.find(e => e.id === id);
    if (!emp) return 'Desconocido';
    if (emp.category === 'Supervisoras' && emp.supervisionName) {
      return emp.supervisionName;
    }
    return `${emp.firstName} ${emp.lastName}`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] w-full mx-auto">
      
      {/* Executive Sub-section Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveSubSection('directory')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'directory'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Directorio de Personal
        </button>
        <button
          onClick={() => setActiveSubSection('vacations')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'vacations'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Umbrella className="w-4 h-4" />
          Control de Vacaciones y Permisos
        </button>
        <button
          onClick={() => setActiveSubSection('balances')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'balances'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Coins className="w-4 h-4" />
          Saldos y Antigüedad
        </button>
        <button
          onClick={() => setActiveSubSection('contracts')}
          className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubSection === 'contracts'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          Contratos
        </button>
      </div>

      {activeSubSection === 'contracts' ? (
        <ContractsControl 
          employees={employees} 
          plazas={plazas} 
          companyName={companyName} 
          companyLogoUrl={companyLogoUrl} 
          currentUser={currentUser} 
        />
      ) : activeSubSection === 'vacations' ? (
        <VacationsControl employees={employees} vacationRequests={vacationRequests} currentUser={currentUser} />
      ) : activeSubSection === 'balances' ? (
        <VacationsBalancesTable employees={employees} vacationRequests={vacationRequests} />
      ) : (
        <>
          {/* Header & Primary Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Directorio de Personal</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeCategory === 'Todos' ? 'Todos los colaboradores registrados' : `Categoría: ${activeCategory}`} ({filteredEmployees.length} activos)
              </p>
            </div>
            
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-xs">
                <button 
                  onClick={handleExportExcel}
                  className="text-emerald-700 hover:bg-slate-50 p-2 rounded-l-md flex items-center transition-colors border-r border-slate-100"
                  title="Exportar a Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="text-rose-600 hover:bg-slate-50 p-2 rounded-r-md flex items-center transition-colors"
                  title="Exportar a PDF"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-xs"
                title="Importar desde Excel"
              >
                <UploadCloud className="w-4 h-4 mr-2 text-slate-500" /> Importar
              </button>

              <button 
                onClick={() => setIsPlazaModalOpen(true)}
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-xs"
              >
                <Building className="w-4 h-4 mr-2 text-slate-500" /> Plazas
              </button>

              <button 
                onClick={() => handleOpenModal()}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Agregar Empleado
              </button>
            </div>
          </div>

          {/* Search & Filters Container */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, puesto, plaza o grupo..." 
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters Container */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Plaza Filter */}
              <select 
                className="flex-1 md:w-44 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none cursor-pointer"
                value={selectedPlazaFilter}
                onChange={(e) => setSelectedPlazaFilter(e.target.value)}
              >
                <option value="">Todas las Plazas</option>
                {plazas.map(plaza => (
                  <option key={plaza.id} value={plaza.name}>{plaza.name}</option>
                ))}
              </select>

              {/* Supervisor Filter */}
              <select 
                className="flex-1 md:w-44 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none cursor-pointer"
                value={selectedSupervisorFilter}
                onChange={(e) => setSelectedSupervisorFilter(e.target.value)}
              >
                <option value="">Todas las Supervisoras</option>
                {availableSupervisors.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.supervisionName || `${sup.firstName} ${sup.lastName}`}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select 
                className="flex-1 md:w-36 px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:ring-2 focus:ring-slate-900 outline-none cursor-pointer font-medium"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
              >
                <option value="">Todos los Estados</option>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
                <option value="BAJA">BAJA</option>
              </select>
              
              {/* Clear Filters Button */}
              {(selectedPlazaFilter || selectedSupervisorFilter || selectedStatusFilter) && (
                 <button 
                   onClick={() => { setSelectedPlazaFilter(''); setSelectedSupervisorFilter(''); setSelectedStatusFilter(''); }}
                   className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-all text-xs flex items-center gap-1 font-medium"
                   title="Limpiar filtros"
                 >
                   <X className="w-3.5 h-3.5" />
                 </button>
              )}
            </div>
          </div>

          {/* Category Tabs & View Mode Toggle */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar w-full md:w-auto">
              <button
                onClick={() => setActiveCategory('Todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategory === 'Todos' 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Todos ({employees.length})
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center ${
                    activeCategory === cat 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat} 
                  <span className={`ml-1.5 text-[10px] font-mono py-0.2 px-1 rounded ${activeCategory === cat ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {employees.filter(e => e.category === cat).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-end md:self-auto">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                title="Vista de Tabla"
              >
                <Table className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                title="Vista de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

      {isLoading ? (
        <div className="py-20 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando personal...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
          <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No se encontraron resultados{(searchTerm || selectedPlazaFilter || selectedSupervisorFilter) ? ' con los filtros actuales' : ''}.</p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map(employee => (
                <div key={employee.id} className="bg-white rounded-xl border border-slate-200/80 p-5 flex flex-col hover:border-slate-300 hover:shadow-xs transition-all relative overflow-hidden">
                  {/* Category Badge */}
                  <div className={`absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border-b border-l rounded-bl-lg ${getCategoryColor(employee.category || 'Oficina')}`}>
                    {employee.category || 'Oficina'}
                  </div>

                  <div className="flex items-start justify-between mb-3 mt-1">
                    <div className="flex items-center">
                      <div 
                        onClick={() => setViewingEmployeeDetails(employee)}
                        className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all"
                        title="Ver perfil completo"
                      >
                        {employee.photoUrl ? (
                          <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          `${(employee.firstName || '?').charAt(0)}${(employee.lastName || '?').charAt(0)}`
                        )}
                      </div>
                      <div className="ml-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setViewingEmployeeDetails(employee)}
                          className="text-left font-bold text-slate-900 text-sm leading-tight hover:text-indigo-600 hover:underline cursor-pointer flex items-center flex-wrap gap-1.5 truncate group"
                          title="Clic para ver información completa"
                        >
                          <span className="group-hover:text-indigo-600 transition-colors">
                            {employee.firstName || employee.lastName ? `${employee.firstName} ${employee.lastName}` : <span className="text-slate-400 italic">Sin Nombre</span>}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                            (employee.status || 'ACTIVO') === 'ACTIVO' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : (employee.status || 'ACTIVO') === 'INACTIVO'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            {employee.status || 'ACTIVO'}
                          </span>
                        </button>
                        <span className="text-xs text-slate-500 font-medium truncate block mt-0.5">{employee.position || 'Sin Cargo'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-slate-600 flex-1 mt-1">
                    <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" /> 
                      <span className="font-medium text-slate-700 truncate">{employee.plaza || 'Sin Plaza Asignada'}</span>
                    </div>
                    
                    {/* Linked Info */}
                    {(employee.category === 'Supervisoras' || employee.category === 'Promotoras') && employee.linkedExecutiveId && (
                       <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                        <LinkIcon className="w-3 h-3 mr-1.5 text-slate-500" />
                        <span className="text-[11px] truncate">Ejecutivo: <strong className="text-slate-900">{getLinkedName(employee.linkedExecutiveId)}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Supervisoras' && employee.supervisionName && (
                       <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                        <Users className="w-3 h-3 mr-1.5 text-slate-500" />
                        <span className="text-[11px] truncate">Supervisión: <strong className="text-slate-900">{employee.supervisionName}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Promotoras' && employee.linkedSupervisorId && (
                       <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                        <LinkIcon className="w-3 h-3 mr-1.5 text-slate-500" />
                        <span className="text-[11px] truncate">Sup: <strong className="text-slate-900">{getLinkedName(employee.linkedSupervisorId)}</strong></span>
                      </div>
                    )}
                    {employee.category === 'Promotoras' && employee.groupName && (
                       <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                        <Users className="w-3 h-3 mr-1.5 text-slate-500" />
                        <span className="text-[11px] truncate">Grupo: <strong className="text-slate-900">{employee.groupName}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      <MessageSquare className="w-3.5 h-3.5 mr-2 text-emerald-600 shrink-0" /> 
                      <span className="truncate text-slate-700 font-mono text-[11px]">{employee.email ? `WA: ${employee.email}` : 'Sin WA'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">Ingreso: {employee.hireDate || '--/--/----'}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => handleDirectDownloadQr(employee, e)} 
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                        title={`Descargar Código QR (${employee.firstName.toUpperCase()} ${employee.lastName.toUpperCase()}.jpg)`}
                      >
                        <QrCode className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button 
                        onClick={() => setSelectedCredentialEmployee(employee)} 
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors flex items-center gap-1"
                        title="Ver Credencial Virtual"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(employee)} 
                        className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(employee.id)} 
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-semibold tracking-wider sticky top-0 z-20">
                      <th className="py-2.5 px-3 whitespace-nowrap min-w-[220px]">Colaborador</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-40">Puesto / Categoría</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-28">Plaza</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-40">Contacto / Cumpleaños</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-44">Vinculación</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-28">Fecha Ingreso</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap w-36">Fecha Término</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap w-32 sticky right-0 bg-slate-50 z-30 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] border-l border-slate-200/60">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map(employee => (
                      <tr key={employee.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center">
                            <div 
                              onClick={() => setViewingEmployeeDetails(employee)}
                              className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-700 mr-2.5 shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all shadow-2xs"
                              title="Ver perfil completo"
                            >
                              {employee.photoUrl ? (
                                <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                `${(employee.firstName || '?').charAt(0)}${(employee.lastName || '?').charAt(0)}`
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setViewingEmployeeDetails(employee)}
                                  className="text-left font-semibold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer truncate transition-colors"
                                  title="Clic para ver información completa"
                                >
                                  {employee.firstName} {employee.lastName}
                                </button>
                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                  (employee.status || 'ACTIVO') === 'ACTIVO' 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : (employee.status || 'ACTIVO') === 'INACTIVO'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                  {employee.status || 'ACTIVO'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {employee.curp ? (
                                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[145px]" title={`CURP: ${employee.curp}`}>
                                    {employee.curp}
                                  </span>
                                ) : null}
                                {employee.groupName && (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">
                                    {employee.groupName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">{employee.position || 'Sin Cargo'}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded w-fit mt-0.5 ${getCategoryColor(employee.category || 'Oficina')}`}>
                              {employee.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span className="text-slate-600 flex items-center">
                            <MapPin className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                            {employee.plaza || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <div className="flex flex-col text-[11px] space-y-0.5 font-mono">
                            {employee.email ? (
                              <span className="flex items-center text-slate-700 font-medium" title="Celular / WhatsApp">
                                <MessageSquare className="w-3 h-3 mr-1 text-emerald-600 shrink-0" /> {employee.email}
                              </span>
                            ) : employee.phone ? (
                              <span className="flex items-center text-slate-500" title="Teléfono">
                                <Phone className="w-3 h-3 mr-1 text-slate-400 shrink-0" /> {employee.phone}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Sin contacto</span>
                            )}
                            {employee.birthDate ? (
                              <span className="flex items-center text-slate-500 text-[10px]" title="Cumpleaños">
                                <Cake className="w-3 h-3 mr-1 text-rose-400 shrink-0" /> {employee.birthDate.split('-').reverse().join('/')}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-[11px] whitespace-nowrap">
                          <div className="space-y-0.5">
                            {employee.linkedExecutiveId && (
                              <div className="text-slate-700 flex items-center" title="Ejecutivo Vinculado">
                                <LinkIcon className="w-3 h-3 mr-1 text-slate-400 shrink-0" /> {getLinkedName(employee.linkedExecutiveId)}
                              </div>
                            )}
                            {employee.linkedSupervisorId && (
                              <div className="text-slate-700 flex items-center" title="Supervisora Vinculada">
                                <Users className="w-3 h-3 mr-1 text-slate-400 shrink-0" /> {getLinkedName(employee.linkedSupervisorId)}
                              </div>
                            )}
                            {employee.supervisionName && (
                              <div className="text-slate-700 flex items-center" title="Nombre Supervisión">
                                <Users className="w-3 h-3 mr-1 text-slate-400 shrink-0" /> {employee.supervisionName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-600 font-mono whitespace-nowrap">
                          {employee.hireDate || '-'}
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          {employee.contractEndDate ? (
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {employee.contractEndDate}
                              </span>
                              {(() => {
                                try {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const end = new Date(employee.contractEndDate + 'T00:00:00');
                                  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                  if (diffDays < 0) {
                                    return (
                                      <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded w-fit mt-0.5">
                                        🔴 Vencido ({Math.abs(diffDays)}d)
                                      </span>
                                    );
                                  } else if (diffDays <= 30) {
                                    return (
                                      <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded w-fit mt-0.5">
                                        ⚠️ Vence en {diffDays}d
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded w-fit mt-0.5">
                                        🟢 Vigente ({Math.round(diffDays / 30)}m)
                                      </span>
                                    );
                                  }
                                } catch {
                                  return null;
                                }
                              })()}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Sin Contrato</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-slate-50/95 transition-colors z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] border-l border-slate-100">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button 
                              onClick={(e) => handleDirectDownloadQr(employee, e)} 
                              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                              title={`Descargar Código QR (${employee.firstName.toUpperCase()} ${employee.lastName.toUpperCase()}.jpg)`}
                            >
                              <QrCode className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <button 
                              onClick={() => setSelectedCredentialEmployee(employee)} 
                              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                              title="Ver Credencial Virtual"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(employee)} 
                              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(employee.id)} 
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors shadow-2xs cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}

      {/* PLAZAS MANAGEMENT MODAL */}
      {isPlazaModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Gestionar Plazas</h3>
              <button onClick={() => setIsPlazaModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add Plaza Form */}
            <form onSubmit={handleAddPlaza} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="Nombre de nueva plaza..." 
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                value={newPlazaName}
                onChange={(e) => setNewPlazaName(e.target.value)}
                autoFocus
              />
              <button 
                type="submit" 
                disabled={!newPlazaName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </form>

            {/* List Plazas */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {plazas.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No hay plazas registradas.</p>
              ) : (
                plazas.map(plaza => (
                  <div key={plaza.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                    <span className="font-medium text-gray-700">{plaza.name}</span>
                    <button 
                      onClick={() => handleDeletePlaza(plaza.id)}
                      className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar plaza"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className={`bg-white rounded-2xl w-full ${importStep === 'review' ? 'max-w-4xl' : 'max-w-lg'} p-6 shadow-2xl transition-all max-h-[92vh] flex flex-col overflow-hidden`}>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                 <FileSpreadsheet className="w-5 h-5 mr-2 text-emerald-600" /> 
                 Importar y Complementar Personal
              </h3>
              <button onClick={closeImportModal} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar pr-1">
            {importStep === 'upload' && (
              <div className="space-y-5">
                 {/* Mode Switcher */}
                 <div className="flex border-b border-gray-200 mb-2">
                   <button 
                     onClick={() => setImportMode('file')}
                     className={`flex-1 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${importMode === 'file' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <UploadCloud className="w-4 h-4 inline-block mr-1.5" /> Subir Archivo Excel
                   </button>
                   <button 
                     onClick={() => setImportMode('paste')}
                     className={`flex-1 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${importMode === 'paste' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <Clipboard className="w-4 h-4 inline-block mr-1.5" /> Pegar Tabla
                   </button>
                 </div>

                 {importMode === 'file' ? (
                   <>
                     <div className="flex justify-center">
                        <button 
                          onClick={handleDownloadTemplate}
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer shadow-2xs"
                        >
                           <Download className="w-4 h-4" /> Descargar Plantilla Excel de Referencia (.xlsx)
                        </button>
                     </div>

                     <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer relative">
                        <UploadCloud className="w-10 h-10 text-slate-400 mb-2" />
                        <p className="text-slate-700 font-bold text-sm">Clic para seleccionar archivo Excel</p>
                        <p className="text-xs text-slate-400 mt-0.5">Formatos: .xlsx, .xls, .csv</p>
                        <p className="text-[11px] text-indigo-600 font-medium mt-2 bg-indigo-50 px-3 py-1 rounded-full">
                          💡 El sistema analizará y buscará coincidencias con el personal actual para complementar su información automáticamente.
                        </p>
                        <input 
                           type="file" 
                           accept=".xlsx, .xls, .csv" 
                           className="absolute inset-0 opacity-0 cursor-pointer"
                           onChange={handleFileUpload}
                        />
                     </div>
                   </>
                 ) : (
                   <div className="space-y-4">
                     <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl">
                        <p className="text-xs text-amber-900 font-bold mb-1.5">
                          1. Selecciona la Supervisora a la que pertenecen:
                        </p>
                        <select 
                          className="w-full border border-amber-200 p-2 rounded-lg bg-white text-slate-900 focus:ring-1 focus:ring-amber-500 outline-none text-xs font-medium cursor-pointer"
                          value={importSupervisorId}
                          onChange={e => setImportSupervisorId(e.target.value)}
                        >
                          <option value="">-- Seleccionar Supervisora --</option>
                          {availableSupervisors.map(sv => (
                            <option key={sv.id} value={sv.id}>{sv.supervisionName || `${sv.firstName} ${sv.lastName}`}</option>
                          ))}
                        </select>
                     </div>

                     <div>
                       <p className="text-xs text-slate-700 font-medium mb-1.5">
                         2. Pega los datos (Columnas: Nombre Completo | Fecha Nacimiento | Grupo):
                       </p>
                       <textarea 
                         className="w-full h-40 border border-slate-200 rounded-lg p-2.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                         placeholder={`Ejemplo:\nYESENIA ALCALA SEGOVIANO\t17/03/1986\tYESY LA CURVA\nESMERALDA GONZALEZ\t09/06/1990\tMERA COFRADIA`}
                         value={pasteContent}
                         onChange={e => setPasteContent(e.target.value)}
                       />
                     </div>

                     <button 
                       onClick={handlePasteAnalysis}
                       disabled={!importSupervisorId || !pasteContent.trim()}
                       className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold text-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                     >
                       Analizar Coincidencias y Previsualizar
                     </button>
                   </div>
                 )}
              </div>
            )}

            {importStep === 'review' && (
               <div className="space-y-4 animate-fade-in">
                  {/* Encabezado y banner de seguridad */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-xl p-3.5 space-y-2">
                     <div className="flex items-start gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                           <h4 className="text-sm font-bold text-emerald-950">
                             Análisis de Coincidencias Completado
                           </h4>
                           <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                             Se leyeron <strong className="font-bold text-emerald-950">{importedData.length} registros</strong> en el archivo. 
                             <strong className="font-semibold text-emerald-900"> Protección de Fallos activa:</strong> El personal existente mantendrá sus identificadores intactos. Sus fallos registrados e historial no se tocarán ni desvincularán; solo se complementarán los campos vacíos o actualizados encontrados.
                           </p>
                        </div>
                     </div>
                  </div>

                  {/* Resumen de conteos rápidos */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setReviewTab('matches')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        reviewTab === 'matches'
                          ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-400'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-indigo-600" />
                          Coincidencias con Personal
                        </span>
                        <span className="bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full text-[11px]">
                          {importMatches.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {importMatches.filter(m => m.fieldsToComplement.length > 0).length} con campos a complementar
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewTab('new')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        reviewTab === 'new'
                          ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-emerald-600" />
                          Nuevos Colaboradores
                        </span>
                        <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[11px]">
                          {importNewEmployees.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Sin coincidencia en la base de datos
                      </p>
                    </button>
                  </div>

                  {/* TAB 1: COINCIDENCIAS A COMPLEMENTAR */}
                  {reviewTab === 'matches' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="font-semibold text-slate-700">
                          Revisa la información que se complementará en cada colaborador:
                        </span>
                        {importMatches.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setImportMatches(prev => prev.map(m => ({ ...m, selected: true })))}
                              className="text-[11px] text-indigo-600 hover:underline font-medium cursor-pointer"
                            >
                              Seleccionar todos
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setImportMatches(prev => prev.map(m => ({ ...m, selected: false })))}
                              className="text-[11px] text-slate-500 hover:underline font-medium cursor-pointer"
                            >
                              Deseleccionar todos
                            </button>
                          </div>
                        )}
                      </div>

                      {importMatches.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                          No se encontraron coincidencias con personal existente. Todos los colaboradores del archivo se registrarán como nuevos.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                          {importMatches.map((item, idx) => (
                            <div 
                              key={item.existing.id || idx}
                              className={`p-3 rounded-xl border transition-all ${
                                item.selected
                                  ? 'bg-white border-slate-300 shadow-2xs'
                                  : 'bg-slate-50/60 border-slate-200 opacity-60'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={() => {
                                    setImportMatches(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
                                  }}
                                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                                      {item.existing.firstName} {item.existing.lastName}
                                    </h5>
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getCategoryColor(item.existing.category || 'Oficina')}`}>
                                      {item.existing.category}
                                    </span>
                                    {item.existing.plaza && (
                                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                                        📍 {item.existing.plaza}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.2 rounded-full font-medium ml-auto">
                                      🎯 {item.matchReason}
                                    </span>
                                  </div>

                                  {/* Campos a complementar */}
                                  <div className="mt-2">
                                    {item.fieldsToComplement.length > 0 ? (
                                      <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/70 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                            Campos a complementar ({item.fieldsToComplement.filter(f => f.selected !== false).length}/{item.fieldsToComplement.length}):
                                          </p>
                                          <span className="text-[10px] text-slate-400">Marca o desmarca campos individuales</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {item.fieldsToComplement.map((field, fIdx) => {
                                            const isFieldSelected = field.selected !== false;
                                            return (
                                              <label 
                                                key={fIdx} 
                                                className={`text-[11px] p-2 rounded-lg border flex items-start gap-2 cursor-pointer transition-all ${
                                                  isFieldSelected
                                                    ? 'bg-white border-emerald-300 shadow-2xs'
                                                    : 'bg-slate-100/70 border-slate-200 opacity-60'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isFieldSelected}
                                                  disabled={!item.selected}
                                                  onChange={() => {
                                                    setImportMatches(prev => prev.map((m, mIdx) => {
                                                      if (mIdx !== idx) return m;
                                                      return {
                                                        ...m,
                                                        fieldsToComplement: m.fieldsToComplement.map((f, fieldIdx) => {
                                                          if (fieldIdx !== fIdx) return f;
                                                          return { ...f, selected: !isFieldSelected };
                                                        })
                                                      };
                                                    }));
                                                  }}
                                                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">{field.label}</span>
                                                    {isFieldSelected ? (
                                                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                                                        Actualizar
                                                      </span>
                                                    ) : (
                                                      <span className="text-[9px] text-slate-400 font-medium bg-slate-200/60 px-1.5 py-0.2 rounded">
                                                        Omitir
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                                                    <span className="text-slate-400 truncate max-w-[85px]" title={field.oldValue || '(Vacío)'}>
                                                      {field.oldValue || '(Vacío)'}
                                                    </span>
                                                    <span className="text-slate-400">➔</span>
                                                    <span className="font-bold text-emerald-800 truncate" title={field.newValue}>
                                                      {field.newValue}
                                                    </span>
                                                  </div>
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-200/50">
                                        ✅ Información completa en el sistema. No se encontraron datos nuevos por complementar.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: NUEVOS COLABORADORES */}
                  {reviewTab === 'new' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs px-1">
                        <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeNewEmployees}
                            onChange={e => setIncludeNewEmployees(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Registrar estos {importNewEmployees.length} colaboradores como nuevo personal</span>
                        </label>
                      </div>

                      {importNewEmployees.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                          No hay nuevos colaboradores en este archivo. Todos coincidieron con personal ya registrado.
                        </div>
                      ) : (
                        <div className="max-h-[380px] overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl bg-white">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-100/80 sticky top-0 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-2.5">Colaborador</th>
                                <th className="py-2 px-2.5">Puesto / Plaza</th>
                                <th className="py-2 px-2.5">Categoría</th>
                                <th className="py-2 px-2.5">Contacto</th>
                                <th className="py-2 px-2.5">CURP</th>
                                <th className="py-2 px-2.5">Datos del Aval</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {importNewEmployees.map((emp, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-2.5 font-semibold text-slate-900 truncate max-w-[140px]">
                                    {emp.firstName} {emp.lastName}
                                  </td>
                                  <td className="py-2 px-2.5 text-slate-600 truncate max-w-[120px]">
                                    <span>{emp.position || '-'}</span>
                                    <span className="block text-[10px] text-slate-400">{emp.plaza || 'Sin plaza'}</span>
                                  </td>
                                  <td className="py-2 px-2.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getCategoryColor(emp.category || 'Oficina')}`}>
                                      {emp.category}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2.5 font-mono text-slate-700">
                                    {emp.email ? `${emp.email}` : '-'}
                                    {emp.accessCode && <span className="block text-[9px] text-slate-400 font-mono">PIN: {emp.accessCode}</span>}
                                  </td>
                                  <td className="py-2 px-2.5 font-mono text-slate-600 text-[10px] truncate max-w-[130px]">
                                    {emp.curp || <span className="text-slate-300 italic">No asignado</span>}
                                  </td>
                                  <td className="py-2 px-2.5 text-slate-600 text-[10px]">
                                    {emp.guarantorName ? (
                                      <div>
                                        <span className="font-semibold text-slate-800 block truncate max-w-[120px]">{emp.guarantorName}</span>
                                        {emp.guarantorPhone && <span className="font-mono text-emerald-600">{emp.guarantorPhone}</span>}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">Sin aval</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                     <div className="text-xs text-slate-600">
                       <p className="font-bold text-slate-900">
                         {importMatches.filter(m => m.selected && m.fieldsToComplement.length > 0).length} colaboradores a complementar
                         {includeNewEmployees && importNewEmployees.length > 0 ? ` + ${importNewEmployees.length} nuevos a registrar` : ''}
                       </p>
                       <p className="text-[11px] text-slate-500">
                         Los registros de fallos vinculados permanecen 100% seguros y protegidos.
                       </p>
                     </div>

                     <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setImportStep('upload');
                            setImportedData([]);
                            setImportMatches([]);
                            setImportNewEmployees([]);
                          }}
                          className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer underline"
                        >
                          ← Cargar otro archivo
                        </button>
                        <button
                          type="button"
                          onClick={closeImportModal}
                          className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={processImport}
                          disabled={importMatches.filter(m => m.selected && m.fieldsToComplement.length > 0).length === 0 && (!includeNewEmployees || importNewEmployees.length === 0)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Confirmar y Aplicar Cambios
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {importStep === 'processing' && (
               <div className="py-12 text-center">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <h4 className="text-lg font-bold text-gray-800">Complementando información de personal...</h4>
                  <p className="text-sm text-gray-500 mt-1">Preservando identificadores y fallos vinculados.</p>
               </div>
            )}

            {importStep === 'success' && (
               <div className="py-8 text-center animate-fade-in space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                     <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900">¡Información Complementada con Éxito!</h4>
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <p>
                        <strong className="text-slate-900 font-bold">{importStats.updated}</strong> colaboradores existentes fueron complementados/actualizados.
                      </p>
                      {importStats.added > 0 && (
                        <p>
                          <strong className="text-slate-900 font-bold">{importStats.added}</strong> nuevos colaboradores fueron registrados en el sistema.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 max-w-md mx-auto text-xs text-emerald-800">
                    <p className="font-semibold">🛡️ Protección de Fallos confirmada</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Los identificadores de las promotoras se mantuvieron intactos. Ningún fallo fue borrado o desvinculado.
                    </p>
                  </div>

                  <button 
                     onClick={closeImportModal}
                     className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg transition-colors font-bold text-xs cursor-pointer shadow-sm"
                  >
                     Aceptar y Continuar
                  </button>
               </div>
             )}
            </div>

          </div>
        </div>
      )}

      {/* EMPLOYEE MODAL (COMPACTO, PROFESIONAL, VISTA UNIFICADA) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* Header */}
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(formData.firstName?.charAt(0) || 'C')}{(formData.lastName?.charAt(0) || '')}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      {editingId ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Editar Colaborador' : 'Registrar Nuevo Colaborador'}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      {formData.category || 'Oficina'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {editingId ? 'Actualización de expediente y datos de acceso' : 'Captura de datos generales, acceso y contrato laboral'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700 outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer hidden sm:block"
                  value={formData.status || 'ACTIVO'}
                  onChange={e => setFormData(prev => ({...prev, status: e.target.value as any}))}
                >
                  <option value="ACTIVO">🟢 ACTIVO</option>
                  <option value="INACTIVO">🟡 INACTIVO</option>
                  <option value="BAJA">🔴 BAJA</option>
                </select>

                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-colors text-xs w-7 h-7 flex items-center justify-center font-bold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-slate-50/50">
              
              {/* Category Segmented Selector */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                  Categoría de Personal
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {CATEGORIES.map(cat => {
                    const isSelected = formData.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({...formData, category: cat})}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-900 text-white shadow-2xs' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Hierarchy Fields (Only for Supervisoras / Promotoras) */}
              {formData.category === 'Supervisoras' && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">
                      Ejecutivo Vinculado
                    </label>
                    <select 
                      className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs cursor-pointer"
                      value={formData.linkedExecutiveId || ''}
                      onChange={e => {
                        const execId = e.target.value;
                        const executive = availableExecutives.find(ex => ex.id === execId);
                        setFormData({
                          ...formData, 
                          linkedExecutiveId: execId,
                          plaza: executive?.plaza || formData.plaza
                        });
                      }}
                    >
                      <option value="">-- Seleccionar Ejecutivo --</option>
                      {availableExecutives.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.firstName} {ex.lastName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">
                      Nombre de Supervisión
                    </label>
                    <input 
                      type="text"
                      placeholder="Ej. Supervisión Norte"
                      className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs"
                      value={formData.supervisionName || ''}
                      onChange={e => setFormData({...formData, supervisionName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {formData.category === 'Promotoras' && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">
                      Supervisora Vinculada
                    </label>
                    <select 
                      className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs cursor-pointer"
                      value={formData.linkedSupervisorId || ''}
                      onChange={e => handleSupervisorChange(e.target.value)}
                    >
                      <option value="">-- Seleccionar Supervisora --</option>
                      {availableSupervisors.map(sv => (
                        <option key={sv.id} value={sv.id}>{sv.supervisionName || `${sv.firstName} ${sv.lastName}`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                      Ejecutivo (Auto)
                    </label>
                    <input 
                      type="text"
                      disabled
                      value={availableExecutives.find(ex => ex.id === formData.linkedExecutiveId)?.firstName ? `${availableExecutives.find(ex => ex.id === formData.linkedExecutiveId)?.firstName} ${availableExecutives.find(ex => ex.id === formData.linkedExecutiveId)?.lastName}` : 'Automático por Supervisora'}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium outline-none cursor-not-allowed truncate"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">
                      Nombre del Grupo
                    </label>
                    <input 
                      type="text"
                      placeholder="Ej. Rosy Colima"
                      className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 shadow-2xs"
                      value={formData.groupName || ''}
                      onChange={e => setFormData({...formData, groupName: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* SECCIÓN 1: DATOS GENERALES Y ACCESO */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">1. Datos Generales y Acceso</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {/* Nombre(s) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre(s) <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="Nombre(s)" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.firstName || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const autoCurp = calculateCurp({
                          firstName: val,
                          lastName: formData.lastName || '',
                          birthDate: formData.birthDate || '',
                          gender: curpGender,
                          stateCode: curpStateCode
                        });
                        setFormData(prev => ({
                          ...prev, 
                          firstName: val,
                          ...(autoCurp ? { curp: autoCurp } : {})
                        }));
                      }} 
                      required
                    />
                  </div>

                  {/* Apellido(s) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Apellido(s)
                    </label>
                    <input 
                      type="text"
                      placeholder="Apellidos completos" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.lastName || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const autoCurp = calculateCurp({
                          firstName: formData.firstName || '',
                          lastName: val,
                          birthDate: formData.birthDate || '',
                          gender: curpGender,
                          stateCode: curpStateCode
                        });
                        setFormData(prev => ({
                          ...prev, 
                          lastName: val,
                          ...(autoCurp ? { curp: autoCurp } : {})
                        }));
                      }} 
                    />
                  </div>

                  {/* Celular / WhatsApp */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Celular / WhatsApp
                    </label>
                    <input 
                      type="text" 
                      maxLength={10}
                      placeholder="10 dígitos" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.email || ''} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({...prev, email: val, phone: val}));
                      }} 
                    />
                  </div>

                  {/* PIN de Acceso */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      PIN Acceso (4 d)
                    </label>
                    <input 
                      type="text" 
                      maxLength={4} 
                      placeholder="1234" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-mono font-bold text-center tracking-widest focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.accessCode || ''} 
                      onChange={e => setFormData(prev => ({...prev, accessCode: e.target.value.replace(/\D/g,'')}))} 
                    />
                  </div>

                  {/* Plaza */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Plaza
                    </label>
                    <select 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs cursor-pointer"
                      value={formData.plaza || ''} 
                      onChange={e => setFormData(prev => ({...prev, plaza: e.target.value}))}
                    >
                      <option value="">-- Plaza --</option>
                      {plazas.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Puesto / Cargo */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Puesto / Cargo
                    </label>
                    <input 
                      type="text"
                      placeholder={formData.category === 'Promotoras' ? 'Promotora' : formData.category === 'Supervisoras' ? 'Supervisora' : 'Auxiliar Administrativo'} 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.position || ''} 
                      onChange={e => setFormData(prev => ({...prev, position: e.target.value}))} 
                    />
                  </div>

                  {/* Fecha Contratación */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Fecha de Ingreso / Contratación
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.hireDate || ''} 
                      onChange={e => setFormData(prev => ({...prev, hireDate: e.target.value}))} 
                    />
                  </div>

                  {/* Estado Laboral */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Estado Laboral
                    </label>
                    <select 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs cursor-pointer"
                      value={formData.status || 'ACTIVO'}
                      onChange={e => setFormData(prev => ({...prev, status: e.target.value as any}))}
                    >
                      <option value="ACTIVO">🟢 ACTIVO</option>
                      <option value="INACTIVO">🟡 INACTIVO</option>
                      <option value="BAJA">🔴 BAJA</option>
                    </select>
                  </div>
                </div>

                {/* Compact Photo Upload Box */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                      {formData.photoUrl ? (
                        <img src={formData.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 opacity-40" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-tight">Foto para Credencial</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {formData.photoUrl ? 'Foto cargada' : 'JPG o PNG para gafete virtual'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formData.photoUrl ? 'Cambiar Foto' : 'Subir Foto'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (readerEvt) => {
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const maxDim = 400;
                                if (width > maxDim || height > maxDim) {
                                  if (width > height) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                  } else {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                  }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0, width, height);
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                setFormData(prev => ({...prev, photoUrl: compressedDataUrl}));
                              };
                              img.src = readerEvt.target?.result as string;
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {formData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({...prev, photoUrl: ''}))}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: CURP Y DATOS DE NACIMIENTO */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">2. CURP y Datos de Nacimiento</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const auto = calculateCurp({
                        firstName: formData.firstName || '',
                        lastName: formData.lastName || '',
                        birthDate: formData.birthDate || '',
                        gender: curpGender,
                        stateCode: curpStateCode
                      });
                      if (auto) {
                        setFormData(prev => ({ ...prev, curp: auto }));
                      } else {
                        alert("Ingresa Nombre y Fecha de Nacimiento para calcular la CURP.");
                      }
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
                    title="Recalcular CURP"
                  >
                    <RefreshCcw className="w-3 h-3 text-slate-600" />
                    Calcular CURP
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Fecha de Nacimiento */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Fecha Nacimiento
                    </label>
                    <input 
                      type="date" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.birthDate || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const autoCurp = calculateCurp({
                          firstName: formData.firstName || '',
                          lastName: formData.lastName || '',
                          birthDate: val,
                          gender: curpGender,
                          stateCode: curpStateCode
                        });
                        setFormData(prev => ({
                          ...prev, 
                          birthDate: val,
                          ...(autoCurp ? { curp: autoCurp } : {})
                        }));
                      }} 
                    />
                  </div>

                  {/* Sexo Oficial para CURP */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sexo (CURP)
                    </label>
                    <select
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs cursor-pointer"
                      value={curpGender}
                      onChange={(e) => {
                        const newGen = e.target.value as 'H' | 'M';
                        setCurpGender(newGen);
                        const auto = calculateCurp({
                          firstName: formData.firstName || '',
                          lastName: formData.lastName || '',
                          birthDate: formData.birthDate || '',
                          gender: newGen,
                          stateCode: curpStateCode
                        });
                        setFormData(prev => ({
                          ...prev,
                          gender: newGen === 'M' ? 'femenino' : 'masculino',
                          ...(auto ? { curp: auto } : {})
                        }));
                      }}
                    >
                      <option value="H">Hombre (H)</option>
                      <option value="M">Mujer (M)</option>
                    </select>
                  </div>

                  {/* Entidad de Nacimiento */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Estado de Nacimiento
                    </label>
                    <select
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs cursor-pointer truncate"
                      value={curpStateCode}
                      onChange={(e) => {
                        const newSt = e.target.value;
                        setCurpStateCode(newSt);
                        const auto = calculateCurp({
                          firstName: formData.firstName || '',
                          lastName: formData.lastName || '',
                          birthDate: formData.birthDate || '',
                          gender: curpGender,
                          stateCode: newSt
                        });
                        if (auto) setFormData(prev => ({ ...prev, curp: auto }));
                      }}
                    >
                      {MEXICAN_STATES.map(s => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* CURP Output */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      CURP (18 Dígitos)
                    </label>
                    <input 
                      type="text"
                      maxLength={18}
                      placeholder="AAAA000000XXXXXX00" 
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/80 focus:bg-white text-slate-900 text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs" 
                      value={formData.curp || ''} 
                      onChange={e => setFormData(prev => ({...prev, curp: e.target.value.toUpperCase()}))} 
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 3: EXPEDIENTE Y CONTRATO LABORAL */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">3. Expediente y Datos para Contrato</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Domicilio Particular Completo */}
                  <div className="sm:col-span-12">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Domicilio Particular Completo
                    </label>
                    <input
                      type="text"
                      placeholder="Calle, Número, Colonia, C.P., Municipio, Estado."
                      value={formData.address || ''}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>

                  {/* Estado Civil */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={formData.civilStatus || 'Soltero(a)'}
                      onChange={e => setFormData(prev => ({ ...prev, civilStatus: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs cursor-pointer"
                    >
                      <option value="Soltero(a)">Soltero(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Unión Libre">Unión Libre</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viudo(a)">Viudo(a)</option>
                    </select>
                  </div>

                  {/* Nacionalidad */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nacionalidad
                    </label>
                    <input
                      type="text"
                      placeholder="Mexicana"
                      value={formData.nationality || 'Mexicana'}
                      onChange={e => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>

                  {/* Género para contrato */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Género Contrato
                    </label>
                    <select
                      value={formData.gender || (curpGender === 'M' ? 'femenino' : 'masculino')}
                      onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs cursor-pointer"
                    >
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                    </select>
                  </div>

                  {/* Salario Acordado ($) */}
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Salario Acordado ($)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 3,000.00"
                      value={formData.salary || ''}
                      onChange={e => setFormData(prev => ({ ...prev, salary: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: DATOS DEL AVAL DEL PERSONAL */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100 text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">4. Datos del Aval del Personal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  {/* Nombre del Aval */}
                  <div className="sm:col-span-8">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nombre del Aval
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre completo del aval"
                      value={formData.guarantorName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, guarantorName: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>

                  {/* Teléfono del Aval */}
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Teléfono del Aval
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10 dígitos (Celular / WhatsApp)"
                      value={formData.guarantorPhone || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({ ...prev, guarantorPhone: val }));
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>

                  {/* Domicilio del Aval */}
                  <div className="sm:col-span-12">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Domicilio del Aval
                    </label>
                    <input
                      type="text"
                      placeholder="Calle, Número, Colonia, C.P., Municipio, Estado"
                      value={formData.guarantorAddress || ''}
                      onChange={e => setFormData(prev => ({ ...prev, guarantorAddress: e.target.value }))}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 shrink-0">
                <div className="text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-600">* Campos mínimos</span>: Nombre(s) y Plaza.
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> {editingId ? 'Guardar Cambios' : 'Registrar Colaborador'}
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VIRTUAL CREDENTIAL MODAL */}
      {selectedCredentialEmployee && (
        <VirtualCredentialModal 
          employee={selectedCredentialEmployee}
          companyName={companyName || 'Mi Oficina'}
          companyLogoUrl={companyLogoUrl}
          companyRfc={companyRfc}
          companyAddress={companyAddress}
          companyPhone={companyPhone}
          showCompanyInfo={showCompanyInfoOnCredential}
          onClose={() => setSelectedCredentialEmployee(null)}
        />
      )}

      {/* DETAILED EMPLOYEE PROFILE / CONSULTATION MODAL */}
      {viewingEmployeeDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 text-white rounded-lg">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Expediente del Colaborador</h3>
                  <p className="text-[11px] text-slate-500">Consulta integral de información y estatus</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingEmployeeDetails(null)}
                className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="w-20 h-24 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                  {viewingEmployeeDetails.photoUrl ? (
                    <img 
                      src={viewingEmployeeDetails.photoUrl} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[8px] font-semibold">Sin Foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${getCategoryColor(viewingEmployeeDetails.category || 'Oficina')}`}>
                      {viewingEmployeeDetails.category || 'Oficina'}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md border ${
                      (viewingEmployeeDetails.status || 'ACTIVO') === 'ACTIVO'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : (viewingEmployeeDetails.status || 'ACTIVO') === 'INACTIVO'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}>
                      ● {viewingEmployeeDetails.status || 'ACTIVO'}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                    {viewingEmployeeDetails.firstName} {viewingEmployeeDetails.lastName}
                  </h2>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    {viewingEmployeeDetails.position || 'Colaborador Oficial'}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Plaza: <span className="font-semibold text-slate-800">{viewingEmployeeDetails.plaza || 'Sin Plaza Asignada'}</span>
                  </p>
                </div>
              </div>

              {/* Data Blocks Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                
                {/* CURP Card */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" /> CURP
                    </span>
                    {viewingEmployeeDetails.curp && (
                      <button 
                        onClick={() => handleCopyValue(viewingEmployeeDetails.curp || '', 'curp')}
                        className="text-[10px] text-slate-500 hover:text-slate-900 flex items-center gap-1"
                        title="Copiar CURP"
                      >
                        {copiedText === 'curp' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedText === 'curp' ? 'Copiado' : 'Copiar'}
                      </button>
                    )}
                  </div>
                  <p className="font-mono font-bold text-slate-900 text-sm select-all">
                    {viewingEmployeeDetails.curp || 'No registrada'}
                  </p>
                </div>

                {/* Contacto / WhatsApp */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Celular / WhatsApp
                    </span>
                    {viewingEmployeeDetails.email && (
                      <a
                        href={`https://wa.me/52${viewingEmployeeDetails.email.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        Enviar WA <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="font-mono font-bold text-slate-900 text-sm">
                    {viewingEmployeeDetails.email ? `+52 ${viewingEmployeeDetails.email}` : 'No registrado'}
                  </p>
                </div>

                {/* Fecha Nacimiento y Edad */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Cake className="w-3.5 h-3.5 text-slate-500" /> Nacimiento y Edad
                  </span>
                  <p className="font-bold text-slate-900">
                    {viewingEmployeeDetails.birthDate || 'No registrada'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Edad: <strong className="text-slate-800">{calculateAge(viewingEmployeeDetails.birthDate)}</strong>
                  </p>
                </div>

                {/* Fecha Ingreso y Antigüedad */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Ingreso y Antigüedad
                  </span>
                  <p className="font-bold text-slate-900 font-mono">
                    {viewingEmployeeDetails.hireDate || 'No registrada'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">
                    {calculateServiceTimeDetailed(viewingEmployeeDetails.hireDate)}
                  </p>
                </div>

                {/* Estructura / Vinculación si aplica */}
                {(viewingEmployeeDetails.linkedExecutiveId || viewingEmployeeDetails.linkedSupervisorId || viewingEmployeeDetails.groupName || viewingEmployeeDetails.supervisionName) && (
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 sm:col-span-2 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-600" /> Jerarquía y Vinculación
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {viewingEmployeeDetails.linkedExecutiveId && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Ejecutivo Asignado</span>
                          <span className="font-semibold text-slate-900">{getLinkedName(viewingEmployeeDetails.linkedExecutiveId)}</span>
                        </div>
                      )}
                      {viewingEmployeeDetails.linkedSupervisorId && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Supervisora Asignada</span>
                          <span className="font-semibold text-slate-900">{getLinkedName(viewingEmployeeDetails.linkedSupervisorId)}</span>
                        </div>
                      )}
                      {viewingEmployeeDetails.groupName && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Nombre del Grupo</span>
                          <span className="font-semibold text-slate-900">{viewingEmployeeDetails.groupName}</span>
                        </div>
                      )}
                      {viewingEmployeeDetails.supervisionName && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Supervisión</span>
                          <span className="font-semibold text-slate-900">{viewingEmployeeDetails.supervisionName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PIN de Acceso y Métricas de Escaneo */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">PIN de Acceso</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{viewingEmployeeDetails.accessCode || 'Sin PIN'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {viewingEmployeeDetails.id.substring(0, 8)}...</span>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Consultas Credencial</span>
                      <span className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        {viewingEmployeeDetails.credentialViewsCount || 0} <span className="text-[11px] font-semibold text-slate-500 font-sans">veces</span>
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {viewingEmployeeDetails.lastCredentialViewAt 
                      ? new Date(viewingEmployeeDetails.lastCredentialViewAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                      : 'Sin escaneos'}
                  </span>
                </div>

                {/* Domicilio y Datos de Contratación */}
                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 sm:col-span-2 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Domicilio y Datos para Contrato Laboral
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block font-semibold">Domicilio Particular</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {viewingEmployeeDetails.address || 'No registrado (usará predeterminado de plaza)'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">Estado Civil / Nacionalidad</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {viewingEmployeeDetails.civilStatus || 'Soltero(a)'} • {viewingEmployeeDetails.nationality || 'Mexicana'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">Salario Registrado ($)</span>
                      <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                        {viewingEmployeeDetails.salary ? `$${viewingEmployeeDetails.salary}` : 'Estándar del sistema'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Vigencia del Contrato Actual</span>
                        {(() => {
                          const empContracts = contracts
                            .filter(c => c.employeeId === viewingEmployeeDetails.id || (c.employeeName && viewingEmployeeDetails.firstName && viewingEmployeeDetails.lastName && c.employeeName.toLowerCase().includes(viewingEmployeeDetails.firstName.toLowerCase()) && c.employeeName.toLowerCase().includes(viewingEmployeeDetails.lastName.toLowerCase())))
                            .sort((a, b) => {
                              const timeB = new Date(b.generatedAt || b.startDate + 'T00:00:00').getTime();
                              const timeA = new Date(a.generatedAt || a.startDate + 'T00:00:00').getTime();
                              return timeB - timeA;
                            });
                          const latest = empContracts[0];

                          if (!latest) return null;

                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (latest.pdfBase64) {
                                  const link = document.createElement('a');
                                  link.href = latest.pdfBase64;
                                  link.download = latest.fileName || `Contrato_${latest.employeeName.replace(/\s+/g, '_')}_${latest.startDate}.pdf`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                } else {
                                  alert("El documento PDF no está almacenado directamente en este registro histórico. Puedes generarlo desde el módulo de Contratos Laborales.");
                                }
                              }}
                              title="Descargar último contrato laboral generado en PDF"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[10px] font-bold transition-all shadow-2xs cursor-pointer group"
                            >
                              <Download className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                              <span>Descargar Contrato PDF</span>
                            </button>
                          );
                        })()}
                      </div>

                      {viewingEmployeeDetails.contractEndDate ? (
                        <div className="flex items-center justify-between gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {viewingEmployeeDetails.contractStartDate || 'Inicio N/A'} ➔ {viewingEmployeeDetails.contractEndDate}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const empContracts = contracts
                                .filter(c => c.employeeId === viewingEmployeeDetails.id || (c.employeeName && viewingEmployeeDetails.firstName && viewingEmployeeDetails.lastName && c.employeeName.toLowerCase().includes(viewingEmployeeDetails.firstName.toLowerCase()) && c.employeeName.toLowerCase().includes(viewingEmployeeDetails.lastName.toLowerCase())))
                                .sort((a, b) => {
                                  const timeB = new Date(b.generatedAt || b.startDate + 'T00:00:00').getTime();
                                  const timeA = new Date(a.generatedAt || a.startDate + 'T00:00:00').getTime();
                                  return timeB - timeA;
                                });
                              const latest = empContracts[0];
                              if (latest?.contractTypeName) {
                                return (
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                    {latest.contractTypeName}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              try {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const end = new Date(viewingEmployeeDetails.contractEndDate + 'T00:00:00');
                                const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) {
                                  return <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">🔴 Vencido ({Math.abs(diffDays)}d)</span>;
                                } else if (diffDays <= 30) {
                                  return <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠️ Vence en {diffDays}d</span>;
                                } else {
                                  return <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">🟢 Vigente ({Math.round(diffDays / 30)}m)</span>;
                                }
                              } catch {
                                return null;
                              }
                            })()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic mt-0.5 block">Sin contrato generado aún</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Datos del Aval */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Datos del Aval
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-8">
                      <span className="text-[10px] text-slate-400 block font-semibold">Nombre del Aval</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {viewingEmployeeDetails.guarantorName || <span className="text-slate-400 italic">No registrado</span>}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-4">
                      <span className="text-[10px] text-slate-400 block font-semibold">Teléfono del Aval</span>
                      {viewingEmployeeDetails.guarantorPhone ? (
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="font-mono font-bold text-slate-900">
                            {viewingEmployeeDetails.guarantorPhone}
                          </span>
                          <a 
                            href={`https://wa.me/52${viewingEmployeeDetails.guarantorPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded transition-colors"
                            title="Enviar WhatsApp al aval"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic mt-0.5 block">No registrado</span>
                      )}
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-12">
                      <span className="text-[10px] text-slate-400 block font-semibold">Domicilio del Aval</span>
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {viewingEmployeeDetails.guarantorAddress || <span className="text-slate-400 italic">No registrado</span>}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployeeDetails;
                    setViewingEmployeeDetails(null);
                    setSelectedCredentialEmployee(emp);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Ver Credencial Virtual y Gafete"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-700" />
                  Credencial Virtual
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDirectDownloadQr(viewingEmployeeDetails, e)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Descargar solo código QR"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-700" />
                  Descargar QR
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployeeDetails;
                    setViewingEmployeeDetails(null);
                    handleOpenModal(emp);
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar Datos
                </button>
                <button
                  type="button"
                  onClick={() => setViewingEmployeeDetails(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
