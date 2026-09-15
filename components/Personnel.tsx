
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Phone, Mail, User, MapPin, Filter, Layers, Pencil, Lock, Search, X, Building, Link as LinkIcon, FileSpreadsheet, UploadCloud, AlertTriangle, Download, CheckCircle, RefreshCcw, Users, Clipboard, LayoutGrid, Table, Cake, Loader2, FileText, Calendar, Umbrella, Coins, Clock, Check, AlertCircle, MessageSquare, CreditCard, QrCode, Upload, Copy, ExternalLink, ShieldCheck, Eye, Activity, Briefcase } from 'lucide-react';
import { Employee, PersonnelCategory, Plaza, VacationRequest, EmployeeContract } from '../types';
import { addEmployee, deleteEmployee, updateEmployee, addPlaza, deletePlaza, deleteAllEmployees, saveEmployeesBatch, subscribeToVacationRequests, addVacationRequest, updateVacationRequest, deleteVacationRequest, subscribeToEmployeeContracts } from '../services/dbService';
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
  salary: ''
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
  const [duplicateCount, setDuplicateCount] = useState(0);
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

       parsed.push({
          firstName,
          lastName,
          category: 'Promotoras',
          linkedSupervisorId: importSupervisorId,
          linkedExecutiveId: linkedExecutiveId,
          plaza: plaza,
          birthDate,
          groupName: group,
          email: '', 
          phone: '',
          position: 'Promotora',
          hireDate: getLocalDateString() 
       });
    });

    setImportedData(parsed);
    
    // Check duplicates logic
    const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
    const dups = parsed.filter(e => {
        const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
        return dbNames.has(fullName);
    }).length;

    setDuplicateCount(dups);
    setImportStep('review');
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
        salary: emp.salary !== undefined && emp.salary !== null ? String(emp.salary) : ''
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
        salary: formData.salary || ''
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
  
  const handleDownloadTemplate = () => {
    const headers = [
      ['Nombre', 'Apellido', 'Celular / WhatsApp', 'Puesto', 'Plaza', 'Categoría', 'Teléfono', 'Fecha Nacimiento (YYYY-MM-DD)', 'Fecha Contratación (YYYY-MM-DD)']
    ];
    const exampleData = [
      ['Juan', 'Perez', '5551234567', 'Gerente', 'CDMX', 'Oficina', '5551234567', '1990-05-15', '2023-01-10'],
      ['Maria', 'Lopez', '3339876543', 'Vendedora', 'GDL', 'Promotoras', '3339876543', '1995-10-20', '2023-03-01']
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Empleados");
    XLSX.writeFile(wb, "Plantilla_Importacion_Empleados.xlsx");
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

        // Transform Data
        // Headers are row 0. We assume the order matches the template or we check columns.
        // For simplicity, we assume fixed order: First Name, Last Name, Email, Position, Plaza, Category, Phone, Birth, Hire
        
        const parsedEmployees: Partial<Employee>[] = [];
        
        // Skip header row
        for (let i = 1; i < data.length; i++) {
          const row: any = data[i];
          if (!row[0]) continue; // Skip empty rows

          parsedEmployees.push({
            firstName: row[0]?.toString() || '',
            lastName: row[1]?.toString() || '',
            email: row[2]?.toString().replace(/\D/g, '').slice(0, 10) || '',
            position: row[3]?.toString() || '',
            plaza: row[4]?.toString() || '',
            category: (row[5] as PersonnelCategory) || 'Oficina',
            phone: row[6]?.toString() || '',
            birthDate: row[7]?.toString() || '',
            hireDate: row[8]?.toString() || ''
          });
        }

        // Check for duplicates within the IMPORTED file
        // (Optional: simple check for now)
        
        setImportedData(parsedEmployees);
        
        // Check duplicates against EXISTING DB
        const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
        const dups = parsedEmployees.filter(e => {
            const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
            return dbNames.has(fullName);
        }).length;

        setDuplicateCount(dups);
        setImportStep('review');

      } catch (err) {
        console.error("Error parsing excel", err);
        alert("Error al leer el archivo. Asegúrate de usar la plantilla.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async (mode: 'replace' | 'append') => {
    setImportStep('processing');
    try {
      if (mode === 'replace') {
        // 1. Delete all current data
        await deleteAllEmployees();
        // 2. Add all new data
        await saveEmployeesBatch(importedData as any[]);
      } else {
        // Append mode: Filter duplicates to avoid double entries
        const dbNames = new Set(employees.map(e => `${e.firstName.toLowerCase().trim()} ${e.lastName.toLowerCase().trim()}`));
        
        const uniqueToImport = importedData.filter(e => {
            const fullName = `${(e.firstName || '').toLowerCase().trim()} ${(e.lastName || '').toLowerCase().trim()}`;
            return !dbNames.has(fullName);
        });

        if (uniqueToImport.length > 0) {
            await saveEmployeesBatch(uniqueToImport as any[]);
        }
      }
      
      // Success
      setImportStep('success');
    } catch (e) {
      console.error(e);
      alert("Error durante la importación masiva.");
      setImportStep('review');
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportStep('upload');
    setImportedData([]);
    setDuplicateCount(0);
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
      'Puesto': emp.position || '',
      'Plaza': emp.plaza || '',
      'Ejecutivo': getLinkedName(emp.linkedExecutiveId) || 'N/A',
      'Supervisora': emp.category === 'Promotoras' 
        ? getLinkedName(emp.linkedSupervisorId) || 'N/A' 
        : (emp.category === 'Supervisoras' ? emp.supervisionName || 'N/A' : 'N/A'),
      'Grupo': emp.groupName || 'N/A',
      'Celular / WhatsApp': emp.email || '',
      'Teléfono': emp.phone || '',
      'Fecha Nacimiento': emp.birthDate || '',
      'Fecha Ingreso': emp.hireDate || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    XLSX.writeFile(wb, `Reporte_Personal_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
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
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500 font-semibold tracking-wider">
                      <th className="py-3 px-4">Colaborador</th>
                      <th className="py-3 px-4">Puesto / Categoría</th>
                      <th className="py-3 px-4">Plaza</th>
                      <th className="py-3 px-4">
                        {(activeCategory === 'Promotoras' || activeCategory === 'Supervisoras') ? 'Cumpleaños' : 'Contacto'}
                      </th>
                      <th className="py-3 px-4">Vinculación</th>
                      <th className="py-3 px-4">Fecha Ingreso</th>
                      <th className="py-3 px-4">Fecha Término</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map(employee => (
                      <tr key={employee.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div 
                              onClick={() => setViewingEmployeeDetails(employee)}
                              className="w-7 h-7 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-700 mr-2.5 shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-indigo-500 transition-all"
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
                              {employee.groupName && <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">{employee.groupName}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">{employee.position || 'Sin Cargo'}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded w-fit mt-0.5 ${getCategoryColor(employee.category || 'Oficina')}`}>
                              {employee.category}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-600 flex items-center">
                            <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                            {employee.plaza || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {(activeCategory === 'Promotoras' || activeCategory === 'Supervisoras') ? (
                            <div className="flex items-center text-slate-600 font-mono">
                              <Cake className="w-3 h-3 mr-1.5 text-slate-400" />
                              {employee.birthDate ? (
                                <span>{employee.birthDate.split('-').reverse().join('/')}</span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col text-[11px] text-slate-500 space-y-0.5 font-mono">
                              {employee.email && (
                                <span className="flex items-center text-slate-700 font-medium" title="Celular / WhatsApp">
                                  <MessageSquare className="w-3 h-3 mr-1 text-emerald-600" /> {employee.email}
                                </span>
                              )}
                              {employee.phone && (
                                <span className="flex items-center text-slate-400">
                                  <Phone className="w-3 h-3 mr-1" /> {employee.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px]">
                          <div className="space-y-0.5">
                            {employee.linkedExecutiveId && (
                              <div className="text-slate-700 flex items-center" title="Ejecutivo Vinculado">
                                <LinkIcon className="w-3 h-3 mr-1 text-slate-400" /> {getLinkedName(employee.linkedExecutiveId)}
                              </div>
                            )}
                            {employee.linkedSupervisorId && (
                              <div className="text-slate-700 flex items-center" title="Supervisora Vinculada">
                                <Users className="w-3 h-3 mr-1 text-slate-400" /> {getLinkedName(employee.linkedSupervisorId)}
                              </div>
                            )}
                            {employee.supervisionName && (
                              <div className="text-slate-700 flex items-center" title="Nombre Supervisión">
                                <Users className="w-3 h-3 mr-1 text-slate-400" /> {employee.supervisionName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {employee.hireDate || '-'}
                        </td>
                        <td className="py-3 px-4">
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
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => handleDirectDownloadQr(employee, e)} 
                              className="text-slate-500 hover:text-slate-900 p-1 hover:bg-slate-100 rounded-md transition-colors"
                              title={`Descargar Código QR (${employee.firstName.toUpperCase()} ${employee.lastName.toUpperCase()}.jpg)`}
                            >
                              <QrCode className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <button 
                              onClick={() => setSelectedCredentialEmployee(employee)} 
                              className="text-slate-500 hover:text-slate-900 p-1 hover:bg-slate-100 rounded-md transition-colors"
                              title="Ver Credencial Virtual"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(employee)} 
                              className="text-slate-400 hover:text-slate-900 p-1 hover:bg-slate-100 rounded-md transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDelete(employee.id)} 
                              className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-md transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                 <FileSpreadsheet className="w-6 h-6 mr-2 text-green-600" /> 
                 Importar Personal
              </h3>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importStep === 'upload' && (
              <div className="space-y-6">
                 {/* Mode Switcher */}
                 <div className="flex border-b border-gray-200 mb-4">
                   <button 
                     onClick={() => setImportMode('file')}
                     className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <UploadCloud className="w-4 h-4 inline-block mr-2" /> Subir Archivo
                   </button>
                   <button 
                     onClick={() => setImportMode('paste')}
                     className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === 'paste' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     <Clipboard className="w-4 h-4 inline-block mr-2" /> Pegar Tabla
                   </button>
                 </div>

                 {importMode === 'file' ? (
                   <>
                     <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start">
                        <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                           <p className="font-bold mb-1">Instrucciones:</p>
                           <ul className="list-disc ml-4 space-y-1">
                              <li>Descarga la plantilla para asegurar el formato correcto.</li>
                              <li>Llena los datos sin cambiar el orden de las columnas.</li>
                              <li>Guarda el archivo y súbelo aquí.</li>
                           </ul>
                        </div>
                     </div>

                     <div className="flex justify-center">
                        <button 
                          onClick={handleDownloadTemplate}
                          className="text-green-600 font-semibold flex items-center hover:underline"
                        >
                           <Download className="w-4 h-4 mr-2" /> Descargar Plantilla Excel
                        </button>
                     </div>

                     <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-gray-50 transition-all cursor-pointer relative">
                        <UploadCloud className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-600 font-medium">Click para seleccionar archivo</p>
                        <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .csv</p>
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
                     <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                        <p className="text-sm text-amber-800 font-medium mb-2">
                          1. Selecciona la Supervisora a la que pertenecen:
                        </p>
                        <select 
                          className="w-full border border-amber-200 p-2 rounded bg-white text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
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
                       <p className="text-sm text-gray-700 font-medium mb-2">
                         2. Pega los datos (Columnas: Nombre Completo | Fecha Nacimiento | Grupo):
                       </p>
                       <textarea 
                         className="w-full h-48 border border-gray-300 rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                         placeholder={`Ejemplo:\nYESENIA ALCALA SEGOVIANO\t17/03/1986\tYESY LA CURVA\nESMERALDA GONZALEZ\t09/06/1990\tMERA COFRADIA`}
                         value={pasteContent}
                         onChange={e => setPasteContent(e.target.value)}
                       />
                     </div>

                     <button 
                       onClick={handlePasteAnalysis}
                       disabled={!importSupervisorId || !pasteContent.trim()}
                       className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                       Analizar y Previsualizar
                     </button>
                   </div>
                 )}
              </div>
            )}

            {importStep === 'review' && (
               <div className="space-y-6 animate-fade-in">
                  <div className="text-center">
                     <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                     <h4 className="text-xl font-bold text-gray-800">Archivo Analizado</h4>
                     <p className="text-gray-500 mt-2">
                        Se encontraron <strong className="text-gray-800">{importedData.length}</strong> empleados en el archivo.
                     </p>
                     
                     {duplicateCount > 0 && (
                        <div className="mt-4 inline-flex items-center px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
                           <AlertTriangle className="w-4 h-4 mr-2" />
                           {duplicateCount} nombres ya existen en la base de datos.
                        </div>
                     )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                     <h5 className="font-bold text-gray-700 mb-3 text-sm">¿Cómo deseas proceder?</h5>
                     
                     <div className="grid gap-3">
                        <button 
                           onClick={() => processImport('append')}
                           className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group text-left"
                        >
                           <div>
                              <p className="font-bold text-gray-800 group-hover:text-blue-600">Agregar a los existentes</p>
                              <p className="text-xs text-gray-500">
                                 {duplicateCount > 0 
                                   ? `Se omitirán los ${duplicateCount} duplicados y se agregarán los nuevos.` 
                                   : 'Se conservan los empleados actuales y se suman los nuevos.'}
                              </p>
                           </div>
                           <Plus className="w-5 h-5 text-gray-300 group-hover:text-blue-500" />
                        </button>

                        <button 
                           onClick={() => {
                              if(confirm("¡CUIDADO! Esto borrará permanentemente todos los empleados actuales y los reemplazará con los del archivo. ¿Estás seguro?")) {
                                 processImport('replace');
                              }
                           }}
                           className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-red-400 hover:shadow-md transition-all group text-left"
                        >
                           <div>
                              <p className="font-bold text-gray-800 group-hover:text-red-600">Sustituir TODO</p>
                              <p className="text-xs text-gray-500">Borra la base de datos actual y carga solo el archivo.</p>
                           </div>
                           <RefreshCcw className="w-5 h-5 text-gray-300 group-hover:text-red-500" />
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {importStep === 'processing' && (
               <div className="py-12 text-center">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <h4 className="text-lg font-bold text-gray-800">Procesando datos...</h4>
                  <p className="text-sm text-gray-500">Por favor no cierres esta ventana.</p>
               </div>
            )}

            {importStep === 'success' && (
               <div className="py-8 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">¡Importación Exitosa!</h4>
                  <p className="text-gray-500 mb-6">Los datos han sido actualizados correctamente.</p>
                  <button 
                     onClick={closeImportModal}
                     className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                     Entendido
                  </button>
               </div>
            )}

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
