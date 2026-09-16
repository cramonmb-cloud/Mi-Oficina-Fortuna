
export type PersonnelCategory = 'Oficina' | 'Ejecutivos' | 'Supervisoras' | 'Promotoras';

export interface Plaza {
  id: string;
  name: string;
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  plaza: string; // Renamed from department
  category: PersonnelCategory;
  birthDate: string; // ISO string YYYY-MM-DD
  hireDate: string;
  phone: string;
  avatarUrl?: string;
  photoUrl?: string; // Fotografía oficial del empleado (Base64 o URL)
  curp?: string; // Clave Única de Registro de Población
  accessCode?: string; // Código de 4 dígitos
  isOfficeUser?: boolean; // True if logged in as an office
  officeId?: string; // Associated office ID
  
  // Hierarchy Fields
  linkedExecutiveId?: string; // Para Supervisoras y Promotoras (ID del Ejecutivo)
  linkedSupervisorId?: string; // Para Promotoras (ID de la Supervisora)
  supervisionName?: string; // Para Supervisoras (Nombre de la Supervisión)
  groupName?: string; // Para Promotoras (Nombre del Grupo)
  status?: 'ACTIVO' | 'INACTIVO' | 'BAJA';
  vacationDaysEarnedAdjustment?: number | null;
  vacationDaysUsedAdjustment?: number | null;
  credentialCode?: string; // Folio / Código numérico de 8 dígitos para validación pública
  credentialViewsCount?: number; // Contador de consultas / escaneos QR
  lastCredentialViewAt?: string; // Fecha y hora ISO de la última consulta

  // Legal & Contract Fields
  address?: string; // Domicilio particular completo (Calle, No., Colonia, CP, Municipio, Estado)
  civilStatus?: string; // Estado Civil (Soltero(a), Casado(a), etc.)
  nationality?: string; // Nacionalidad (Mexicana, etc.)
  gender?: string; // Sexo / Género (masculino / femenino)
  salary?: number | string; // Salario pactado semanal o mensual
  contractStartDate?: string; // Fecha inicio de contrato actual YYYY-MM-DD
  contractEndDate?: string; // Fecha de término / vencimiento del contrato YYYY-MM-DD
  lastContractId?: string; // ID del último contrato en historial
  lastContractGeneratedAt?: string; // ISO timestamp de cuando se generó el contrato más reciente
}

export interface EmployeeContract {
  id: string;
  employeeId: string;
  employeeName: string;
  contractTypeId?: string;
  contractTypeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationMonths: number;
  position: string;
  salaryNum?: string;
  salaryLetter?: string;
  generatedAt: string; // ISO
  generatedBy?: string;
  pdfBase64?: string; // Data URL or base64 PDF
  fileName?: string;
  notes?: string;
}

export interface ContractStandardVariables {
  nombresComercialesPatron: string;
  nombreRepresentanteLegal: string;
  domicilioCompletoPatron: string;
  jurisdiccionMunicipioEstado: string;
  horarioEntrada: string;
  horarioSalida: string;
  horaInicioComida: string;
  horaFinComida: string;
  salarioNumero: string;
  salarioLetra: string;
  nacionalidadDefault: string;
  estadoCivilDefault: string;
  contractLogoUrl?: string;
}

export interface ContractTypeConfig {
  id: string;
  name: string;
  targetCategory?: PersonnelCategory;
  targetCategories: PersonnelCategory[];
  description: string;
  defaultPosition: string;
  template: string;
  standardVars: ContractStandardVariables;
  createdAt?: string;
}

export interface DocumentFormatConfig {
  id: string;
  title: string;
  shortDesc: string;
  category: 'Laboral' | 'Cobranza' | 'Credito' | 'Administrativo' | 'General' | string;
  iconName?: string;
  badgeColor?: string;
  template: string;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeneratedDocumentRecord {
  id: string;
  formatId: string;
  formatTitle: string;
  employeeId?: string;
  employeeName: string;
  content: string;
  generatedAt: string;
  generatedBy?: string;
}



export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  approvedBy?: string;
  ticketImage?: string; // Base64 string of the receipt/ticket
  officeId?: string; // Associated office in Multi Oficina mode
}

export enum TaskStatus {
  TODO = 'Por Hacer',
  IN_PROGRESS = 'En Progreso',
  DONE = 'Completado'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string; // Employee ID or Name
  dueDate: string;
  status: TaskStatus;
  priority: 'Baja' | 'Media' | 'Alta';
  attachmentUrl?: string; // Archivo adjunto al crear la tarea
  deliveryUrl?: string;   // Archivo de entrega al finalizar la tarea
  deliveredAt?: string;   // Fecha de entrega
}

export interface AiInsight {
  type: 'expense' | 'productivity' | 'general';
  message: string;
  timestamp: number;
}

export interface AppSettings {
  companyName: string;
  companyLogoUrl?: string; // Logotipo oficial de la empresa
  companyRfc?: string; // RFC oficial de la empresa / financiera
  companyAddress?: string; // Domicilio oficial de la empresa
  companyPhone?: string; // Teléfono de contacto oficial
  showCompanyInfoOnCredential?: boolean; // Habilitar RFC, domicilio y teléfono en credencial virtual y QR
  mascotaName: string;
  mascotaUrl: string;
  googleApiKey?: string;
  imgbbApiKey?: string;
  appVersion?: string;
  appStatusColor?: string;
  mobileNavSections?: string[];
  birthdayPrompt?: string;
  birthdayVideoPrompt?: string;
  birthdayWhatsAppTemplate?: string;
  imprentaUrl?: string;
  multiOfficeEnabled?: boolean;
}

export interface Office {
  id: string;
  name: string;
  code: string; // Used to authenticate/login to view/register this office's expenses
  responsibleEmployeeId?: string; // ID of associated responsible employee
  responsibleEmployeeName?: string; // Name of associated responsible employee
  createdAt: string;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string; // Base64 or URL
  prompt: string;
  createdAt: string; // ISO String
}

export interface Fallo {
  id: string;
  imageUrl: string;
  description: string;
  promotoraId?: string; // ID of the linked Promotora
  promotoraName?: string; // Name for easier display
  groupName?: string; // Group name (auto-filled from Promotora or manual)
  date: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plates: string;
  serialNumber?: string;
  insurancePolicy?: string;
  insuranceExpiry?: string;
  currentEmployeeId?: string; // ID of Executive or Supervisor currently assigned
  status: 'Activo' | 'En Taller' | 'Inactivo';
  createdAt: string;
}

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  employeeId: string;
  employeeName: string;
  assignedAt: string;
  returnedAt?: string;
  notes?: string;
}

export interface VehicleEvent {
  id: string;
  vehicleId: string;
  type: 'Refrendo' | 'Servicio' | 'Seguro' | 'Reparación' | 'Otro';
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  status: 'Pagado' | 'Pendiente' | 'N/A';
  createdAt: string;
}

export interface VacationRequest {
  id: string;
  folio?: number;
  employeeId: string;
  employeeName: string;
  employeeCategory: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  type: 'disponibles' | 'descuento'; // 'disponibles' (días disponibles) o 'descuento' (descuento de nómina)
  status: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  createdAt: string;
  notes?: string;
  registeredBy?: string;
}

