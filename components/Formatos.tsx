import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  FileStack, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  RotateCcw, 
  Printer, 
  Building2, 
  DollarSign, 
  Scale, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Sparkles, 
  MapPin, 
  Phone, 
  FileCheck2, 
  Receipt, 
  FileSignature, 
  Plus, 
  Settings, 
  Trash2, 
  Edit3, 
  Save, 
  Tag, 
  Bold, 
  X, 
  CreditCard, 
  Briefcase, 
  Award, 
  Users,
  History,
  Eye,
  Search,
  ExternalLink,
  RefreshCw,
  UserCheck,
  ChevronDown,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Image as ImageIcon,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Undo,
  Redo,
  RemoveFormatting,
  Type,
  Highlighter,
  Palette,
  Minus,
  Calendar
} from 'lucide-react';
import jsPDF from 'jspdf';
import { Employee, Plaza, DocumentFormatConfig, GeneratedDocumentRecord } from '../types';
import { 
  subscribeToDocumentFormats, 
  saveDocumentFormatsToCloud,
  subscribeToGeneratedDocuments,
  saveGeneratedDocument,
  deleteGeneratedDocument
} from '../services/dbService';

interface FormatosProps {
  companyName: string;
  companyLogoUrl?: string;
  companyRfc?: string;
  companyAddress?: string;
  companyPhone?: string;
  employees?: Employee[];
  plazas?: Plaza[];
  currentUser?: Employee | null;
}

// Convert numbers to Mexican Spanish words format
export function numberToSpanishLetters(amountNum: number | string): string {
  if (amountNum === '' || amountNum === null || amountNum === undefined) return '';

  const cleanStr = String(amountNum).replace(/[^0-9.]/g, '');
  if (!cleanStr) return '';
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return '';

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);
  const centsStr = String(decimalPart).padStart(2, '0') + '/100 M.N.';

  if (integerPart === 0) {
    return `Cero pesos ${centsStr}`;
  }

  const unidades = (n: number): string => {
    switch (n) {
      case 1: return 'un';
      case 2: return 'dos';
      case 3: return 'tres';
      case 4: return 'cuatro';
      case 5: return 'cinco';
      case 6: return 'seis';
      case 7: return 'siete';
      case 8: return 'ocho';
      case 9: return 'nueve';
      default: return '';
    }
  };

  const decenasY = (strSin: string, numUnidades: number): string => {
    if (numUnidades > 0) return `${strSin} y ${unidades(numUnidades)}`;
    return strSin;
  };

  const decenas = (n: number): string => {
    const dec = Math.floor(n / 10);
    const uni = n - (dec * 10);
    switch (dec) {
      case 1:
        switch (uni) {
          case 0: return 'diez';
          case 1: return 'once';
          case 2: return 'doce';
          case 3: return 'trece';
          case 4: return 'catorce';
          case 5: return 'quince';
          default: return `dieci${unidades(uni)}`;
        }
      case 2:
        if (uni === 0) return 'veinte';
        if (uni === 1) return 'veintiún';
        return `veinti${unidades(uni)}`;
      case 3: return decenasY('treinta', uni);
      case 4: return decenasY('cuarenta', uni);
      case 5: return decenasY('cincuenta', uni);
      case 6: return decenasY('sesenta', uni);
      case 7: return decenasY('setenta', uni);
      case 8: return decenasY('ochenta', uni);
      case 9: return decenasY('noventa', uni);
      case 0: return unidades(uni);
      default: return '';
    }
  };

  const centenas = (n: number): string => {
    const cen = Math.floor(n / 100);
    const dec = n - (cen * 100);
    switch (cen) {
      case 1:
        if (dec > 0) return `ciento ${decenas(dec)}`;
        return 'cien';
      case 2: return `doscientos ${decenas(dec)}`.trim();
      case 3: return `trescientos ${decenas(dec)}`.trim();
      case 4: return `cuatrocientos ${decenas(dec)}`.trim();
      case 5: return `quinientos ${decenas(dec)}`.trim();
      case 6: return `seiscientos ${decenas(dec)}`.trim();
      case 7: return `setecientos ${decenas(dec)}`.trim();
      case 8: return `ochocientos ${decenas(dec)}`.trim();
      case 9: return `novecientos ${decenas(dec)}`.trim();
      default: return decenas(dec);
    }
  };

  const seccion = (n: number, divisor: number, singular: string, plural: string): string => {
    const cientos = Math.floor(n / divisor);
    if (cientos > 0) {
      if (cientos > 1) {
        return `${centenas(cientos)} ${plural}`;
      }
      return `${singular}`;
    }
    return '';
  };

  const miles = (n: number): string => {
    const divisor = 1000;
    const cientos = Math.floor(n / divisor);
    const resto = n - (cientos * divisor);
    const strMiles = seccion(n, divisor, 'mil', 'mil');
    const strCentenas = centenas(resto);
    if (strMiles === '') return strCentenas;
    return `${strMiles} ${strCentenas}`.trim();
  };

  const millones = (n: number): string => {
    const divisor = 1000000;
    const cientos = Math.floor(n / divisor);
    const resto = n - (cientos * divisor);
    const strMillones = seccion(n, divisor, 'un millón', 'millones');
    const strMiles = miles(resto);
    if (strMillones === '') return strMiles;
    return `${strMillones} ${strMiles}`.trim();
  };

  const resultWords = millones(integerPart).replace(/\s+/g, ' ').trim();
  const capitalLetter = resultWords.charAt(0).toUpperCase() + resultWords.slice(1);
  const currencyWord = integerPart === 1 ? 'peso' : (integerPart >= 1000000 && integerPart % 1000000 === 0 ? 'de pesos' : 'pesos');

  return `${capitalLetter} ${currencyWord} ${centsStr}`;
}

// Map string icon names to Lucide icons
export const ICON_MAP: Record<string, React.ElementType> = {
  Receipt,
  Scale,
  AlertTriangle,
  ShieldAlert,
  FileCheck2,
  FileSignature,
  FileText,
  CreditCard,
  Briefcase,
  Award,
  Users
};

// Machotes base predeterminados oficiales con tags
export const DEFAULT_DOCUMENT_FORMATS: DocumentFormatConfig[] = [
  {
    id: 'finiquito',
    title: 'Finiquito Laboral',
    shortDesc: 'Liquidación y renuncia formal con desglose de percepciones, deducciones y liberación legal.',
    category: 'Laboral',
    iconName: 'Receipt',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    template: `RECIBO DE FINIQUITO LABORAL Y LIBERACIÓN DE RESPONSABILIDAD

EMPRESA: [EMPRESA]
RFC: [RFC_EMPRESA] | [DOMICILIO_EMPRESA] | Tel: [TELEFONO_EMPRESA]

FECHA DE EMISIÓN: [FECHA_ACTUAL]
COLABORADOR: [NOMBRE_PERSONA]
CURP: [CURP]
PUESTO: [PUESTO]
FECHA DE INGRESO: [FECHA_INGRESO]
FECHA DE BAJA: [FECHA_BAJA]
MOTIVO: Renuncia voluntaria de mutuo acuerdo

DESGLOSE DE CONCEPTOS:
- Sueldo pendiente (5 días): $[SUELDO_PENDIENTE]
- Vacaciones proporcionales: $850.00
- Prima vacacional (25%): $212.50
- Aguinaldo proporcional: $1,450.00
- Deducciones / Descuentos: -$0.00
------------------------------------------------------------
TOTAL NETO RECIBIDO: $4,262.50 M.N. (CUATRO MIL DOSCIENTOS SESENTA Y DOS PESOS 50/100 M.N.)

El suscrito hace constar que recibe a su entera satisfacción la cantidad señalada en el presente finiquito, cubriéndose la totalidad de percepciones y prestaciones laborales a las que tuvo derecho conforme a la Ley Federal del Trabajo. Por lo anterior, otorga a [EMPRESA] el más amplio finiquito que en derecho proceda, manifestando no reservarse acción ni derecho alguno de índole laboral, civil o penal.

FIRMA DE CONFORMIDAD:

[FIRMA_CLIENTE]`,
    isCustom: false
  },
  {
    id: 'convenio_pago',
    title: 'Convenio de Pago / Reestructuración',
    shortDesc: 'Reconocimiento formal de adeudo y calendario de pagos en parcialidades acordadas.',
    category: 'Cobranza',
    iconName: 'Scale',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    template: `CONVENIO DE RECONOCIMIENTO DE ADEUDO Y PLAN DE PAGOS

En la ciudad sede de [EMPRESA], con fecha [FECHA_ACTUAL], celebran el presente Convenio de Pago:

ACREDITADO / DEUDOR: [NOMBRE_PERSONA]
CURP: [CURP]
Domicilio: [DOMICILIO_PERSONA] | Tel: [TELEFONO_PERSONA]
AVAL SOLIDARIO: [AVAL_NOMBRE]
CRÉDITO / REFERENCIA: [FOLIO_CREDITO]

DECLARACIONES Y CLÁUSULAS:
1. El ACREDITADO reconoce deber y estar obligado a pagar a favor de [EMPRESA] la cantidad total de $15,000.00 M.N.
2. Ambas partes convienen en liquidar el adeudo mediante la cantidad negociada de $12,000.00 M.N. (DOCE MIL PESOS 00/100 M.N.), dividida en 4 parcialidades de carácter SEMANAL de $3,000.00 M.N. cada una.
3. El primer pago se efectuará el día [FECHA_ACTUAL].
4. CONDICIÓN: En caso de incurrir en mora de dos parcialidades consecutivas, se reactivará el cobro total del saldo insoluto.

FIRMAN DE PLENA CONFORMIDAD:

[FIRMAS_TABLA]`,
    isCustom: false
  },
  {
    id: 'requerimiento_pago',
    title: 'Requerimiento Formal de Pago',
    shortDesc: 'Notificación administrativa de cobro con fecha límite y datos bancarios de depósito.',
    category: 'Cobranza',
    iconName: 'AlertTriangle',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    template: `REQUERIMIENTO FORMAL DE PAGO Y REGULARIZACIÓN DE CRÉDITO

DE: [EMPRESA]
RFC: [RFC_EMPRESA] | [DOMICILIO_EMPRESA] | Tel: [TELEFONO_EMPRESA]

PARA: [NOMBRE_PERSONA]
DOMICILIO: [DOMICILIO_PERSONA]
CRÉDITO REFERENCIA: [FOLIO_CREDITO]
FECHA LÍMITE DE PAGO: [FECHA_ACTUAL]

Por medio de la presente, se le requiere formalmente el pago inmediato del adeudo vencido derivado del crédito de referencia, desglosado de la siguiente manera:

- Saldo vencido exigible: $4,500.00
- Gastos e intereses moratorios: $450.00
------------------------------------------------------------
TOTAL A REGULARIZAR: $4,950.00 M.N. (CUATRO MIL NOVECIENTOS CINCUENTA PESOS 00/100 M.N.)

DATOS PARA DEPÓSITO / TRANSFERENCIA:
Banco: BBVA México
Cuenta: 0123 4567 8901
CLABE Interbancaria: 012180001234567890
Concepto / Referencia: [FOLIO_CREDITO]

Le exhortamos a efectuar su pago a más tardar en la fecha estipulada para evitar recargos adicionales e inicio de acciones legales.

ATENTAMENTE,
DEPARTAMENTO DE COBRANZA Y CARTERA
[EMPRESA]`,
    isCustom: false
  },
  {
    id: 'notificacion_extrajudicial',
    title: 'Notificación Extrajudicial',
    shortDesc: 'Citatorio y aviso legal perentorio previo a la presentación de demanda mercantil.',
    category: 'Cobranza',
    iconName: 'ShieldAlert',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    template: `NOTIFICACIÓN EXTRAJUDICIAL PERENTORIA - PREVIA A DEMANDA MERCANTIL

EXPEDIENTE / CRÉDITO: [FOLIO_CREDITO]
DESTINATARIO: [NOMBRE_PERSONA]
DOMICILIO: [DOMICILIO_PERSONA]
MONTO TOTAL ADEUDADO: $22,800.00 M.N. (VEINTIDÓS MIL OCHOCIENTOS PESOS 00/100 M.N.)
DÍAS EN MORA: 45 días

Por medio del presente instrumento se le NOTIFICA formalmente que ante la negativa reiterada de pago y habiendo transcurrido el plazo perentorio, el expediente del crédito citado se encuentra listo para iniciar Juicio Ejecutivo Mercantil con orden de embargo.

CITATORIO OBLIGATORIO:
Se le requiere presentarse de manera improrrogable el día de mañana a las 10:00 AM en nuestras oficinas ubicadas en [DOMICILIO_EMPRESA] o comunicarse de inmediato al teléfono [TELEFONO_EMPRESA] para convenir la liquidación de su adeudo antes de turnar la demanda ante los Juzgados Civiles y Mercantiles competentes.

EVITE EL EMBARGO DE BIENES Y COSTAS JUDICIALES.

ATENTAMENTE,
DIRECCIÓN JURÍDICA Y COBRANZA
[EMPRESA]`,
    isCustom: false
  },
  {
    id: 'carta_no_adeudo',
    title: 'Carta de No Adeudo',
    shortDesc: 'Constancia oficial de finiquito de crédito y liberación total de gravámenes.',
    category: 'Credito',
    iconName: 'FileCheck2',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    template: `CARTA FINIQUITO DE CRÉDITO Y CONSTANCIA DE NO ADEUDO

A QUIEN CORRESPONDA:

Por medio de la presente, [EMPRESA], legalmente constituida, hace constar que el (la) C. [NOMBRE_PERSONA] con CURP [CURP], titular del crédito folio [FOLIO_CREDITO], ha liquidado en su totalidad las obligaciones financieras adquiridas con esta institución.

DETALLES DE LIQUIDACIÓN:
- Monto total cubierto: $18,500.00 M.N. (DIECIOCHO MIL QUINIENTOS PESOS 00/100 M.N.)
- Fecha de liquidación: [FECHA_ACTUAL]
- Saldo insoluto actual: $0.00 M.N. (CERO PESOS 00/100 M.N.)

Por lo anterior, se emite la presente Carta de No Adeudo para los fines legales que al interesado convengan, liberándose cualquier garantía vinculada y declarando cerrado el crédito respectivo.

Se expide la presente a los [FECHA_ACTUAL].

ATENTAMENTE,
[EMPRESA]
RFC: [RFC_EMPRESA] | [DOMICILIO_EMPRESA]`,
    isCustom: false
  },
  {
    id: 'pagare_aval',
    title: 'Pagaré Mercantil con Aval',
    shortDesc: 'Título de crédito con deudor principal y aval solidario legalmente exigible.',
    category: 'Credito',
    iconName: 'FileSignature',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    template: `PAGARÉ MERCANTIL CON AVAL

NÚMERO: 01/01
BUENO POR: $10,000.00 M.N.
LUGAR Y FECHA: [DOMICILIO_EMPRESA], a [FECHA_ACTUAL]
FECHA DE VENCIMIENTO: [FECHA_ACTUAL]

Debo(emos) y pagaré(mos) incondicionalmente por este Pagaré a la orden de [EMPRESA], en su domicilio ubicado en [DOMICILIO_EMPRESA], el día de su vencimiento, la cantidad de:

$10,000.00 M.N. (DIEZ MIL PESOS 00/100 M.N.)

Valor recibido a mi (nuestra) entera satisfacción. Si este pagaré no fuera cubierto puntualmente a su vencimiento, causará intereses moratorios al tipo del 5% mensual a partir de la fecha de mora hasta su total liquidación.

DATOS DEL DEUDOR:
Nombre: [NOMBRE_PERSONA]
CURP: [CURP]
Domicilio: [DOMICILIO_PERSONA]
Teléfono: [TELEFONO_PERSONA]

FIRMA DEL DEUDOR:
_________________________________________

DATOS DEL AVAL:
Nombre: [AVAL_NOMBRE]
Domicilio: Domicilio del aval
Teléfono: Teléfono del aval

FIRMA DEL AVAL:
_________________________________________`,
    isCustom: false
  }
];

// Helper chip tokens grouped by purpose
const AVAILABLE_TAG_GROUPS = [
  {
    group: 'Empresa',
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    tags: [
      { token: '[EMPRESA]', label: 'Empresa' },
      { token: '[RFC_EMPRESA]', label: 'RFC' },
      { token: '[DOMICILIO_EMPRESA]', label: 'Domicilio' },
      { token: '[TELEFONO_EMPRESA]', label: 'Teléfono' }
    ]
  },
  {
    group: 'Colaborador / Destinatario',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    tags: [
      { token: '[NOMBRE_PERSONA]', label: 'Nombre' },
      { token: '[CURP]', label: 'CURP' },
      { token: '[PUESTO]', label: 'Puesto' },
      { token: '[DOMICILIO_PERSONA]', label: 'Domicilio' },
      { token: '[TELEFONO_PERSONA]', label: 'Teléfono' },
      { token: '[SUELDO_DIARIO]', label: 'Sueldo Diario' },
      { token: '[FECHA_INGRESO]', label: 'Fecha Ingreso' },
      { token: '[FECHA_BAJA]', label: 'Fecha Baja' }
    ]
  },
  {
    group: 'Aval Solidario',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    tags: [
      { token: '[AVAL_NOMBRE]', label: 'Nombre Aval' },
      { token: '[AVAL_DOMICILIO]', label: 'Domicilio Aval' },
      { token: '[AVAL_TELEFONO]', label: 'Tel Aval' }
    ]
  },
  {
    group: 'Fechas y Folios',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    tags: [
      { token: '[FECHA_ACTUAL]', label: 'Fecha Hoy' },
      { token: '[FOLIO_CREDITO]', label: 'Folio Crédito' },
      { token: '[MONTO]', label: 'Monto ($)' },
      { token: '[MONTO_LETRA]', label: 'Monto en Letras' }
    ]
  },
  {
    group: 'Firmas Oficiales',
    color: 'text-slate-700 bg-slate-100 border-slate-300',
    tags: [
      { token: '[FIRMA_CLIENTE]', label: 'Bloque Firma Titular' },
      { token: '[FIRMA_EMPRESA]', label: 'Bloque Firma Empresa' },
      { token: '[FIRMAS_TABLA]', label: 'Tabla de Firmas' }
    ]
  }
];

// Formateador de fecha extendida en español (ej: "Viernes 18 de Junio del 2026")
export const formatLongDateSpanish = (dateInput?: string | Date): string => {
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const monthName = months[d.getMonth()];
  const year = d.getFullYear();

  return `${dayName} ${dayNum} de ${monthName} del ${year}`;
};

export const Formatos: React.FC<FormatosProps> = ({
  companyName,
  companyLogoUrl,
  companyRfc,
  companyAddress,
  companyPhone,
  employees = [],
  plazas = [],
  currentUser
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Fecha de emisión editable (formato YYYY-MM-DD para el selector de fecha)
  const [emissionDate, setEmissionDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  const formattedEmissionDate = useMemo(() => formatLongDateSpanish(emissionDate), [emissionDate]);
  const [isEmissionDateModalOpen, setIsEmissionDateModalOpen] = useState(false);

  // 1. Estado de Formatos / Catálogo
  const [documentFormats, setDocumentFormats] = useState<DocumentFormatConfig[]>(() => {
    const saved = localStorage.getItem('custom_document_formats_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Error reading saved document formats:', e);
      }
    }
    return DEFAULT_DOCUMENT_FORMATS;
  });

  // Guardar formatos en localStorage
  useEffect(() => {
    localStorage.setItem('custom_document_formats_v1', JSON.stringify(documentFormats));
  }, [documentFormats]);

  // Sincronización de formatos en la nube (Firestore)
  useEffect(() => {
    const unsubscribe = subscribeToDocumentFormats((cloudFormats) => {
      if (cloudFormats && cloudFormats.length > 0) {
        setDocumentFormats(cloudFormats);
        localStorage.setItem('custom_document_formats_v1', JSON.stringify(cloudFormats));
      } else {
        saveDocumentFormatsToCloud(documentFormats).catch(err => {
          console.error("Initial formats cloud sync error:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Historial de Documentos Generados
  const [generatedHistory, setGeneratedHistory] = useState<GeneratedDocumentRecord[]>(() => {
    const saved = localStorage.getItem('generated_documents_history_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error("Error reading saved history:", e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('generated_documents_history_v1', JSON.stringify(generatedHistory));
  }, [generatedHistory]);

  // Sincronizar Historial con Firestore
  useEffect(() => {
    const unsubscribe = subscribeToGeneratedDocuments((cloudDocs) => {
      if (cloudDocs && cloudDocs.length > 0) {
        setGeneratedHistory(cloudDocs as GeneratedDocumentRecord[]);
        localStorage.setItem('generated_documents_history_v1', JSON.stringify(cloudDocs));
      }
    });
    return () => unsubscribe();
  }, []);

  // Formato Seleccionado
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    return documentFormats.length > 0 ? documentFormats[0].id : 'finiquito';
  });

  const activeFormat = useMemo(() => {
    return documentFormats.find(f => f.id === selectedFormatId) || documentFormats[0] || DEFAULT_DOCUMENT_FORMATS[0];
  }, [documentFormats, selectedFormatId]);

  // Sub-tabs principales: 'generator' (Llenar y Generar) | 'editor' (Editar Machote) | 'history' (Historial)
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'editor' | 'history'>('generator');
  const [filterCategory, setFilterCategory] = useState<string>('Todos');

  // Filtro de búsqueda en Historial
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Empleado seleccionado para autollenar datos
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const selectedEmployeeObj = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // TEXTO Y FORMATO EN VIVO DE LA HOJA MEMBRETADA (EDITOR RICO WYSIWYG)
  const [liveDocumentText, setLiveDocumentText] = useState<string>('');
  const [liveDocumentHtml, setLiveDocumentHtml] = useState<string>('');

  // Estados de barra de herramientas de formato
  const [selectedFontSize, setSelectedFontSize] = useState<string>('13px');
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>('sans-serif');
  const [selectedTextColor, setSelectedTextColor] = useState<string>('#0f172a');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>('transparent');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);

  // Estados para guardado persistente del formato y estilos
  const [isSavingFormatTemplate, setIsSavingFormatTemplate] = useState(false);
  const [saveFormatSuccessMsg, setSaveFormatSuccessMsg] = useState<string | null>(null);
  const [hasUnsavedFormatChanges, setHasUnsavedFormatChanges] = useState(false);
  const autoSaveTimeoutRef = useRef<any>(null);

  // Refs para el editor de contenido y la hoja imprimible
  const editorRef = useRef<HTMLDivElement>(null);
  const sheetPrintRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);

  // LOGOTIPO EXCLUSIVO PARA FORMATOS Y DOCUMENTOS
  const [formatLogoUrl, setFormatLogoUrl] = useState<string>(() => {
    return localStorage.getItem('formatos_custom_logo_v1') || '';
  });
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const formatLogoInputRef = useRef<HTMLInputElement>(null);

  const handleSaveFormatLogo = (newLogoUrl: string) => {
    setFormatLogoUrl(newLogoUrl);
    if (newLogoUrl) {
      localStorage.setItem('formatos_custom_logo_v1', newLogoUrl);
    } else {
      localStorage.removeItem('formatos_custom_logo_v1');
    }
  };

  const handleClearFormatLogo = () => {
    if (window.confirm("¿Deseas restablecer el logotipo de formatos al logotipo general de la empresa?")) {
      handleSaveFormatLogo('');
      setIsLogoModalOpen(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      alert("La imagen no debe exceder 2.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        handleSaveFormatLogo(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // JUSTIFICACIÓN DEL TEXTO (ON-SCREEN Y EN PDF)
  const [isTextJustified, setIsTextJustified] = useState<boolean>(() => {
    const saved = localStorage.getItem('formatos_text_justified');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleJustify = () => {
    setIsTextJustified(prev => {
      const next = !prev;
      localStorage.setItem('formatos_text_justified', String(next));
      return next;
    });
  };

  // Logo efectivo a mostrar en membrete y PDF
  const effectiveFormatLogo = formatLogoUrl || companyLogoUrl;

  // Estados UI
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingMachote, setIsSavingMachote] = useState(false);
  const [machoteSuccessMsg, setMachoteSuccessMsg] = useState<string | null>(null);
  const [historySuccessMsg, setHistorySuccessMsg] = useState<string | null>(null);

  // Modal para Crear / Editar Formato
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [formatModalMode, setFormatModalMode] = useState<'create' | 'edit'>('create');
  const [formatModalForm, setFormatModalForm] = useState({
    title: '',
    shortDesc: '',
    category: 'General',
    iconName: 'FileText',
    template: ''
  });

  // Ref para textarea del machote
  const machoteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Cerrar pickers al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target as Node)) {
        setIsHighlightPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Conversor inteligente de texto/machote a HTML enriquecido
  const textToHtml = (text: string): string => {
    if (!text) return '<p><br></p>';
    if (/<(p|div|span|strong|em|u|s|h[1-6]|ul|ol|table|br|hr)[\s>]/.test(text)) {
      return text;
    }

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    const firmaHtml = `
      <div style="margin-top: 35px; margin-bottom: 20px; page-break-inside: avoid;" class="signatures-table-block">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 45%; vertical-align: bottom; padding: 0 15px;">
              <div style="border-top: 1.5px solid #334155; padding-top: 6px; font-weight: bold; font-size: 11px; color: #0f172a;">FIRMA DE CONFORMIDAD</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">EL TRABAJADOR / INTERESADO</div>
            </td>
            <td style="width: 10%;"></td>
            <td style="width: 45%; vertical-align: bottom; padding: 0 15px;">
              <div style="border-top: 1.5px solid #334155; padding-top: 6px; font-weight: bold; font-size: 11px; color: #0f172a;">POR LA EMPRESA</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${(companyName || 'REPRESENTANTE AUTORIZADO').toUpperCase()}</div>
            </td>
          </tr>
        </table>
      </div>
    `;
    html = html.replace(/\[FIRMAS_TABLA\]/g, firmaHtml);

    const paragraphs = html.split(/\n\n+/);
    return paragraphs
      .map(p => `<p style="margin-bottom: 12px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  };

  // Reemplazar valores específicos de un empleado por los tags de plantilla [NOMBRE], [CURP], etc.
  // para que al guardar el formato, éste sea reutilizable para cualquier otro empleado.
  const getTemplateWithPlaceholders = (content: string, emp?: Employee | null): string => {
    let result = content;
    if (!emp) return result;

    const empName = `${emp.firstName} ${emp.lastName}`.trim();
    if (empName && empName.length > 2) {
      result = result.split(empName.toUpperCase()).join('[NOMBRE]');
      result = result.split(empName).join('[NOMBRE]');
    }
    if (emp.curp && emp.curp.length >= 8) {
      result = result.split(emp.curp.toUpperCase()).join('[CURP]');
      result = result.split(emp.curp).join('[CURP]');
    }
    if (emp.position) {
      result = result.split(emp.position).join('[PUESTO]');
    }
    if (emp.guarantorName && emp.guarantorName.length > 2) {
      result = result.split(emp.guarantorName.toUpperCase()).join('[AVAL_NOMBRE]');
      result = result.split(emp.guarantorName).join('[AVAL_NOMBRE]');
    }
    if (emp.guarantorAddress && emp.guarantorAddress.length > 4) {
      result = result.split(emp.guarantorAddress).join('[AVAL_DOMICILIO]');
    }
    if (emp.guarantorPhone && emp.guarantorPhone.length >= 7) {
      result = result.split(emp.guarantorPhone).join('[AVAL_TELEFONO]');
    }
    if (emp.phone && emp.phone.length >= 7) {
      result = result.split(emp.phone).join('[TELEFONO_PERSONA]');
    }
    if (emp.address && emp.address.length > 5) {
      result = result.split(emp.address).join('[DOMICILIO_PERSONA]');
    }
    if (formattedEmissionDate) {
      result = result.split(formattedEmissionDate).join('[FECHA_ACTUAL]');
    }
    if (emissionDate) {
      result = result.split(emissionDate).join('[FECHA_ACTUAL]');
    }
    return result;
  };

  // Actualizar la fecha de emisión y refrescar el documento sin perder estilos
  const handleEmissionDateChange = (newDate: string) => {
    const oldFormatted = formattedEmissionDate;
    setEmissionDate(newDate);
    const newFormatted = formatLongDateSpanish(newDate);

    if (editorRef.current) {
      let currentHtml = editorRef.current.innerHTML;
      if (currentHtml.includes(oldFormatted)) {
        currentHtml = currentHtml.split(oldFormatted).join(newFormatted);
        editorRef.current.innerHTML = currentHtml;
        setLiveDocumentHtml(currentHtml);
        setLiveDocumentText(editorRef.current.innerText || '');
        triggerAutoSaveDebounced();
      } else if (currentHtml.includes(todayStr)) {
        currentHtml = currentHtml.split(todayStr).join(newFormatted);
        editorRef.current.innerHTML = currentHtml;
        setLiveDocumentHtml(currentHtml);
        setLiveDocumentText(editorRef.current.innerText || '');
        triggerAutoSaveDebounced();
      }
    }
  };

  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleEmissionDateChange(`${y}-${m}-${day}`);
  };

  // Guardar el formato y sus estilos (WYSIWYG) de forma permanente en localStorage y Firestore
  const handleSaveFormatTemplate = async (silent = false) => {
    if (!editorRef.current) return;
    setIsSavingFormatTemplate(true);
    try {
      const currentHtml = editorRef.current.innerHTML;
      const currentText = editorRef.current.innerText;
      
      const htmlToSave = getTemplateWithPlaceholders(currentHtml, selectedEmployeeObj);
      const textToSave = getTemplateWithPlaceholders(currentText, selectedEmployeeObj);

      const updated = documentFormats.map(fmt => {
        if (fmt.id === activeFormat.id) {
          return {
            ...fmt,
            template: textToSave,
            htmlTemplate: htmlToSave,
            updatedAt: new Date().toISOString()
          };
        }
        return fmt;
      });

      setDocumentFormats(updated);
      localStorage.setItem('custom_document_formats_v1', JSON.stringify(updated));
      await saveDocumentFormatsToCloud(updated);

      setHasUnsavedFormatChanges(false);
      if (!silent) {
        setSaveFormatSuccessMsg('¡Estilo y formato guardados con éxito!');
        setTimeout(() => setSaveFormatSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error("Error al guardar formato y estilos:", err);
      if (!silent) {
        alert("Hubo un detalle al sincronizar con la nube, pero el formato se guardó localmente.");
      }
    } finally {
      setIsSavingFormatTemplate(false);
    }
  };

  // Temporizador de autoguardado suave
  const triggerAutoSaveDebounced = () => {
    setHasUnsavedFormatChanges(true);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveFormatTemplate(true);
    }, 2500);
  };

  // Ejecutor de comandos para el editor enriquecido
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setLiveDocumentHtml(html);
      setLiveDocumentText(editorRef.current.innerText || '');
      triggerAutoSaveDebounced();
    }
  };

  const executeCmd = (command: string, value: string | undefined = undefined) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const applyFontSize = (sizePx: string) => {
    editorRef.current?.focus();
    setSelectedFontSize(sizePx);
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.style.fontSize = sizePx;
    span.appendChild(range.extractContents());
    range.insertNode(span);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    handleEditorInput();
  };

  const applyFontFamily = (font: string) => {
    editorRef.current?.focus();
    setSelectedFontFamily(font);
    executeCmd('fontName', font);
  };

  const applyTextColor = (color: string) => {
    setSelectedTextColor(color);
    executeCmd('foreColor', color);
    setIsColorPickerOpen(false);
  };

  const applyHighlightColor = (color: string) => {
    setSelectedHighlightColor(color);
    executeCmd('hiliteColor', color);
    setIsHighlightPickerOpen(false);
  };

  const insertHorizontalRule = () => {
    executeCmd('insertHorizontalRule');
  };

  const insertSignaturesBlock = () => {
    editorRef.current?.focus();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'EL TRABAJADOR / INTERESADO';
    const compName = companyName || 'REPRESENTANTE AUTORIZADO';
    
    const firmaHtml = `
      <div style="margin-top: 35px; margin-bottom: 20px; page-break-inside: avoid;" class="signatures-table-block">
        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 45%; vertical-align: bottom; padding: 0 15px;">
              <div style="border-top: 1.5px solid #334155; padding-top: 6px; font-weight: bold; font-size: 11px; color: #0f172a;">FIRMA DE CONFORMIDAD</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${empName.toUpperCase()}</div>
            </td>
            <td style="width: 10%;"></td>
            <td style="width: 45%; vertical-align: bottom; padding: 0 15px;">
              <div style="border-top: 1.5px solid #334155; padding-top: 6px; font-weight: bold; font-size: 11px; color: #0f172a;">POR LA EMPRESA</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${compName.toUpperCase()}</div>
            </td>
          </tr>
        </table>
      </div>
    `;
    document.execCommand('insertHTML', false, firmaHtml);
    handleEditorInput();
  };

  // Filtro y búsqueda para la selección de empleados (Autollenar Compacto)
  const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [employeeCategoryFilter, setEmployeeCategoryFilter] = useState('Todos');
  const employeePopoverRef = useRef<HTMLDivElement>(null);

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeePopoverRef.current && !employeePopoverRef.current.contains(event.target as Node)) {
        setIsEmployeePopoverOpen(false);
      }
    };
    if (isEmployeePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEmployeePopoverOpen]);

  // Pestañas de roles de colaboradores oficiales de la empresa
  const EMPLOYEE_ROLE_TABS = useMemo(() => [
    { id: 'Todos', label: 'Todos', icon: '👥' },
    { id: 'Oficina', label: 'Oficina', icon: '🏢' },
    { id: 'Ejecutivos', label: 'Ejecutivos', icon: '👔' },
    { id: 'Supervisoras', label: 'Supervisoras', icon: '👥' },
    { id: 'Promotoras', label: 'Promotoras', icon: '🤝' },
  ], []);

  // Categorías de empleados disponibles (estándar + adicionales si las hubiera)
  const availableEmployeeCategories = useMemo(() => {
    const standard = ['Todos', 'Oficina', 'Ejecutivos', 'Supervisoras', 'Promotoras'];
    const extra = new Set<string>();
    employees.forEach(e => {
      if (e.category && !standard.includes(e.category)) {
        extra.add(e.category);
      }
    });
    return [...standard, ...Array.from(extra)];
  }, [employees]);

  // Conteo dinámico de empleados por categoría
  const employeeCountsByCategory = useMemo(() => {
    const counts: Record<string, number> = { 
      Todos: employees.length, 
      Oficina: 0, 
      Ejecutivos: 0, 
      Supervisoras: 0, 
      Promotoras: 0 
    };
    employees.forEach(e => {
      const cat = e.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [employees]);

  // Lista de empleados ordenada alfabéticamente (A-Z) y filtrada por rol / búsqueda ampliada (Nombre, Supervisión, Grupo, etc.)
  const sortedAndFilteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        if (employeeCategoryFilter !== 'Todos' && emp.category !== employeeCategoryFilter) {
          return false;
        }
        if (employeeSearchQuery.trim()) {
          const q = employeeSearchQuery.toLowerCase().trim();
          const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
          const curp = (emp.curp || '').toLowerCase();
          const pos = (emp.position || '').toLowerCase();
          const plaza = (emp.plaza || '').toLowerCase();
          const supervision = (emp.supervisionName || '').toLowerCase();
          const group = (emp.groupName || '').toLowerCase();
          const phone = (emp.phone || '').toLowerCase();
          const email = (emp.email || '').toLowerCase();

          // Buscar también por nombre del supervisor o ejecutivo vinculado si aplica
          let linkedSupervisorName = '';
          if (emp.linkedSupervisorId) {
            const sup = employees.find(e => e.id === emp.linkedSupervisorId);
            if (sup) linkedSupervisorName = `${sup.firstName} ${sup.lastName}`.toLowerCase();
          }

          let linkedExecutiveName = '';
          if (emp.linkedExecutiveId) {
            const exec = employees.find(e => e.id === emp.linkedExecutiveId);
            if (exec) linkedExecutiveName = `${exec.firstName} ${exec.lastName}`.toLowerCase();
          }

          return (
            fullName.includes(q) ||
            supervision.includes(q) ||
            group.includes(q) ||
            curp.includes(q) ||
            pos.includes(q) ||
            plaza.includes(q) ||
            phone.includes(q) ||
            email.includes(q) ||
            linkedSupervisorName.includes(q) ||
            linkedExecutiveName.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      });
  }, [employees, employeeCategoryFilter, employeeSearchQuery]);

  // Categorías de formatos disponibles
  const availableCategories = useMemo(() => {
    const cats = new Set<string>(['Todos']);
    documentFormats.forEach(f => {
      if (f.category) cats.add(f.category);
    });
    return Array.from(cats);
  }, [documentFormats]);

  const filteredFormatos = useMemo(() => {
    if (filterCategory === 'Todos') return documentFormats;
    return documentFormats.filter(f => f.category === filterCategory);
  }, [documentFormats, filterCategory]);


  // Función compiladora de tags base para un empleado seleccionado
  const compileTemplateWithEmployee = (templateStr: string, emp?: Employee | null) => {
    let text = templateStr || '';
    const empCompany = (companyName || 'MI OFICINA').toUpperCase();
    const rfcStr = companyRfc || '';
    const domStr = companyAddress || 'Domicilio Oficial de la Empresa';
    const telStr = companyPhone || '';

    const empName = emp ? `${emp.firstName} ${emp.lastName}`.trim().toUpperCase() : 'NOMBRE DEL TRABAJADOR / CLIENTE';
    const empCurp = emp?.curp ? emp.curp.toUpperCase() : 'CURP-NO-REGISTRADO';
    const empPosition = emp?.position || emp?.category || 'Colaborador';
    const empAddress = emp?.address || 'Domicilio registrado';
    const empPhone = emp?.phone || 'Teléfono no registrado';
    const empHireDate = emp?.hireDate || todayStr;
    
    const salaryNum = emp ? (typeof emp.salary === 'number' ? emp.salary : parseFloat(String(emp.salary || '0')) || 0) : 10500;
    const dailySalary = salaryNum > 0 ? (salaryNum / 30).toFixed(2) : '350.00';
    const pendingSalary = (parseFloat(dailySalary) * 5).toFixed(2);

    const firmaClienteBlock = `_________________________________________\n${empName}\nFirma de Conformidad`;
    const firmaEmpresaBlock = `_________________________________________\nPOR ${empCompany}\nRepresentante Autorizado`;
    const firmasTablaBlock = `_____________________________            _____________________________\n${empName}            POR ${empCompany}\nFirma de Conformidad                     Representante Autorizado`;

    const replacements: Record<string, string> = {
      EMPRESA: empCompany,
      RFC_EMPRESA: rfcStr,
      DOMICILIO_EMPRESA: domStr,
      TELEFONO_EMPRESA: telStr,
      FECHA_ACTUAL: formattedEmissionDate,
      FECHA_HOY: formattedEmissionDate,
      FECHA_EMISION: formattedEmissionDate,
      NOMBRE_PERSONA: empName,
      NOMBRE_TRABAJADOR: empName,
      NOMBRE_CLIENTE: empName,
      CURP: empCurp,
      PUESTO: empPosition,
      CARGO: empPosition,
      DOMICILIO_PERSONA: empAddress,
      DOMICILIO_CLIENTE: empAddress,
      TELEFONO_PERSONA: empPhone,
      TELEFONO_CLIENTE: empPhone,
      AVAL_NOMBRE: emp?.guarantorName || 'NOMBRE DEL AVAL',
      AVAL_DOMICILIO: emp?.guarantorAddress || 'Domicilio del aval',
      AVAL_TELEFONO: emp?.guarantorPhone || 'Teléfono del aval',
      FECHA_INICIO: empHireDate,
      FECHA_INGRESO: empHireDate,
      FECHA_FIN: formattedEmissionDate,
      FECHA_BAJA: formattedEmissionDate,
      SUELDO_DIARIO: dailySalary,
      SUELDO_PENDIENTE: pendingSalary,
      FOLIO_CREDITO: `CR-${todayStr.replace(/-/g, '')}-01`,
      FIRMA_CLIENTE: firmaClienteBlock,
      FIRMA_EMPRESA: firmaEmpresaBlock,
      FIRMAS_TABLA: firmasTablaBlock
    };

    Object.keys(replacements).forEach(key => {
      const val = replacements[key];
      const reBracket = new RegExp(`\\[${key}\\]`, 'g');
      const reBrace = new RegExp(`\\{${key}\\}`, 'g');
      text = text.replace(reBracket, val).replace(reBrace, val);
    });

    return text;
  };

  // Inicializar o sincronizar el texto en vivo de la hoja membretada al cambiar de formato o machote
  useEffect(() => {
    const emp = selectedEmployeeObj;
    if (activeFormat.htmlTemplate && activeFormat.htmlTemplate.trim().length > 0) {
      const compiledHtml = compileTemplateWithEmployee(activeFormat.htmlTemplate, emp);
      setLiveDocumentHtml(compiledHtml);
      setLiveDocumentText(activeFormat.template || '');
      if (editorRef.current) {
        editorRef.current.innerHTML = compiledHtml;
      }
    } else {
      const compiled = compileTemplateWithEmployee(activeFormat.template, emp);
      const html = textToHtml(compiled);
      setLiveDocumentText(compiled);
      setLiveDocumentHtml(html);
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
    }
    setHasUnsavedFormatChanges(false);
  }, [activeFormat.id, activeFormat.template, activeFormat.htmlTemplate]);

  // Al seleccionar un empleado del dropdown: inyectar automáticamente en el texto
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find(e => e.id === empId) || null;
    if (activeFormat.htmlTemplate && activeFormat.htmlTemplate.trim().length > 0) {
      const compiledHtml = compileTemplateWithEmployee(activeFormat.htmlTemplate, emp);
      setLiveDocumentHtml(compiledHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = compiledHtml;
      }
    } else {
      const compiled = compileTemplateWithEmployee(activeFormat.template, emp);
      const html = textToHtml(compiled);
      setLiveDocumentText(compiled);
      setLiveDocumentHtml(html);
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
      }
    }
  };

  // Restablecer texto de la hoja membretada al machote original con datos del empleado
  const handleResetLiveText = () => {
    if (!window.confirm(`¿Deseas restablecer el formato y estilos de "${activeFormat.title}" a su plantilla original predeterminada?`)) {
      return;
    }
    const defaultObj = DEFAULT_DOCUMENT_FORMATS.find(d => d.id === activeFormat.id);
    const templateToUse = defaultObj ? defaultObj.template : activeFormat.template;
    const emp = selectedEmployeeObj;
    const compiled = compileTemplateWithEmployee(templateToUse, emp);
    const html = textToHtml(compiled);
    setLiveDocumentText(compiled);
    setLiveDocumentHtml(html);
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    const updated = documentFormats.map(fmt => {
      if (fmt.id === activeFormat.id) {
        const copy = { ...fmt, template: templateToUse };
        delete copy.htmlTemplate;
        return copy;
      }
      return fmt;
    });
    setDocumentFormats(updated);
    localStorage.setItem('custom_document_formats_v1', JSON.stringify(updated));
    saveDocumentFormatsToCloud(updated).catch(console.error);
    setSaveFormatSuccessMsg('Formato restablecido a la plantilla original.');
    setHasUnsavedFormatChanges(false);
    setTimeout(() => setSaveFormatSuccessMsg(null), 3000);
  };

  // Guardar documento generado en el Historial
  const handleSaveToHistory = async (customText?: string) => {
    const textToSave = customText || liveDocumentText;
    const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
    const recipientName = selectedEmp 
      ? `${selectedEmp.firstName} ${selectedEmp.lastName}`.trim() 
      : 'Destinatario General';

    const newRecord: GeneratedDocumentRecord = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      formatId: activeFormat.id,
      formatTitle: activeFormat.title,
      employeeId: selectedEmployeeId || undefined,
      employeeName: recipientName,
      content: textToSave,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined
    };

    const updated = [newRecord, ...generatedHistory];
    setGeneratedHistory(updated);

    try {
      await saveGeneratedDocument(newRecord);
      setHistorySuccessMsg('¡Documento guardado en el Historial con éxito!');
      setTimeout(() => setHistorySuccessMsg(null), 3000);
    } catch (err) {
      console.error("Error saving document to cloud history:", err);
    }
  };

  // FUNCIÓN MAESTRA PARA GENERAR Y DESCARGAR PDF OFICIAL CON DISEÑO PROFESIONAL Y JUSTIFICACIÓN
  const generateOfficialPdf = (
    title: string, 
    rawContent: string, 
    dateString: string, 
    fileNamePrefix: string
  ) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter' // 215.9 x 279.4 mm
    });

    const PAGE_WIDTH = 215.9;
    const PAGE_HEIGHT = 279.4;
    const MARGIN_LEFT = 18;
    const MARGIN_RIGHT = 18;
    const MARGIN_TOP = 16;
    const MARGIN_BOTTOM = 22;
    const PRINT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 179.9 mm

    let curY = MARGIN_TOP;

    // 1. Membrete con Logotipo Exclusivo de Formatos o de Empresa
    let textStartX = MARGIN_LEFT;
    let headerLogoBottomY = MARGIN_TOP;

    if (effectiveFormatLogo) {
      try {
        const props = doc.getImageProperties(effectiveFormatLogo);
        const maxW = 44;
        const maxH = 22;
        let imgW = maxW;
        let imgH = (props.height * maxW) / props.width;
        if (imgH > maxH) {
          imgH = maxH;
          imgW = (props.width * maxH) / props.height;
        }
        doc.addImage(effectiveFormatLogo, 'PNG', MARGIN_LEFT, MARGIN_TOP, imgW, imgH);
        textStartX = MARGIN_LEFT + imgW + 7;
        headerLogoBottomY = MARGIN_TOP + imgH;
      } catch (err) {
        console.warn("No se pudo incrustar el logo en el PDF:", err);
      }
    }

    // Datos Institucionales de la Empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text((companyName || 'MI OFICINA').toUpperCase(), textStartX, MARGIN_TOP + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105); // slate-600
    let subY = MARGIN_TOP + 8.5;
    if (companyRfc) {
      doc.text(`RFC: ${companyRfc.toUpperCase()}`, textStartX, subY);
      subY += 4;
    }
    if (companyAddress) {
      doc.text(companyAddress, textStartX, subY);
      subY += 4;
    }
    if (companyPhone) {
      doc.text(`Tel: ${companyPhone}`, textStartX, subY);
      subY += 4;
    }

    curY = Math.max(headerLogoBottomY + 4, subY + 3);

    // Línea divisoria elegante con acento esmeralda
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.6);
    doc.line(MARGIN_LEFT, curY, PAGE_WIDTH - MARGIN_RIGHT, curY);

    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setLineWidth(1.2);
    doc.line(MARGIN_LEFT, curY, MARGIN_LEFT + 36, curY);
    curY += 7;

    // 2. Título del Formato y Fecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), PAGE_WIDTH / 2, curY, { align: 'center' });
    curY += 7;

    // Helper para verificar salto de página
    const checkPageBreak = (neededHeight: number) => {
      if (curY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        doc.addPage();
        curY = MARGIN_TOP + 4;
        return true;
      }
      return false;
    };

    // 3. Procesar párrafos con Justificación o Alineación Izquierda
    const paragraphs = rawContent.split('\n');

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].trim();
      if (!p) {
        curY += 3.5;
        continue;
      }

      // Detectar bloque o tabla de firmas
      if (p.includes('_____') || p.includes('[FIRMAS_TABLA]') || p.includes('FIRMAN DE CONFORMIDAD') || p.includes('FIRMA DE CONFORMIDAD')) {
        checkPageBreak(38);
        curY += 6;

        const leftColX = MARGIN_LEFT + (PRINT_WIDTH / 4);
        const rightColX = MARGIN_LEFT + (PRINT_WIDTH * 3 / 4);

        if (p.includes('[FIRMAS_TABLA]') || (p.includes('_____') && p.split('_____').length > 2)) {
          // Doble firma (Trabajador y Empresa)
          doc.setDrawColor(100, 116, 139);
          doc.setLineWidth(0.5);
          doc.line(leftColX - 30, curY + 14, leftColX + 30, curY + 14);
          doc.line(rightColX - 30, curY + 14, rightColX + 30, curY + 14);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text("FIRMA DE CONFORMIDAD", leftColX, curY + 18, { align: 'center' });
          doc.text("POR LA EMPRESA", rightColX, curY + 18, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          const empName = selectedEmployeeObj ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName}` : 'EL INTERESADO';
          doc.text(empName.toUpperCase(), leftColX, curY + 22, { align: 'center' });
          doc.text((companyName || 'REPRESENTANTE AUTORIZADO').toUpperCase(), rightColX, curY + 22, { align: 'center' });

          curY += 30;
          continue;
        }
      }

      // Detectar encabezados o etiquetas (ej: "FECHA:", "ASUNTO:", "DESGLOSE:", etc.)
      const isHeaderLine = (p.endsWith(':') && p.length < 80) || 
                           (p.startsWith('**') && p.endsWith('**')) ||
                           p.startsWith('DESGLOSE') || 
                           p.startsWith('DECLARACIONES') || 
                           p.startsWith('CLÁUSULAS') || 
                           p.startsWith('CITATORIO') ||
                           p.startsWith('DATOS ');

      if (isHeaderLine) {
        checkPageBreak(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        const cleanHeader = p.replace(/\*\*/g, '');
        doc.text(cleanHeader, MARGIN_LEFT, curY);
        curY += 5.5;
        continue;
      }

      // Texto de cuerpo normal (procesar negritas y justificación)
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      // Tokenizar partes en negrita (**texto**)
      const parts = p.split(/(\*\*.*?\*\*)/g);
      interface WordToken {
        word: string;
        bold: boolean;
      }
      const words: WordToken[] = [];

      parts.forEach(part => {
        if (!part) return;
        const isBold = part.startsWith('**') && part.endsWith('**');
        const cleanPart = isBold ? part.slice(2, -2) : part;
        const splitWords = cleanPart.split(' ');
        splitWords.forEach(w => {
          if (w.length > 0) {
            words.push({ word: w, bold: isBold });
          }
        });
      });

      if (words.length === 0) continue;

      // Envolver palabras en líneas según PRINT_WIDTH
      const lines: WordToken[][] = [];
      let currentLine: WordToken[] = [];
      let currentLineWidth = 0;
      const baseSpaceWidth = 1.6;

      words.forEach(wt => {
        doc.setFont('helvetica', wt.bold ? 'bold' : 'normal');
        const wWidth = doc.getTextWidth(wt.word);
        const testWidth = currentLineWidth === 0 ? wWidth : currentLineWidth + baseSpaceWidth + wWidth;

        if (testWidth <= PRINT_WIDTH) {
          currentLine.push(wt);
          currentLineWidth = testWidth;
        } else {
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          currentLine = [wt];
          currentLineWidth = wWidth;
        }
      });
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }

      // Renderizar líneas con o sin justificación
      const lineHeight = 4.6;

      lines.forEach((lineWords, lineIdx) => {
        checkPageBreak(lineHeight);
        const isLastLine = lineIdx === lines.length - 1;

        if (!isTextJustified || isLastLine || lineWords.length <= 1) {
          // Alineado a la izquierda
          let cursorX = MARGIN_LEFT;
          lineWords.forEach(wt => {
            doc.setFont('helvetica', wt.bold ? 'bold' : 'normal');
            doc.text(wt.word, cursorX, curY);
            cursorX += doc.getTextWidth(wt.word) + baseSpaceWidth;
          });
        } else {
          // Justificación completa
          let totalWordsWidth = 0;
          lineWords.forEach(wt => {
            doc.setFont('helvetica', wt.bold ? 'bold' : 'normal');
            totalWordsWidth += doc.getTextWidth(wt.word);
          });

          const extraSpace = PRINT_WIDTH - totalWordsWidth;
          const justifiedSpaceWidth = extraSpace / (lineWords.length - 1);

          // Si el espacio necesario es excesivo (ej. pocas palabras largas), usar espaciado base
          const spaceToUse = justifiedSpaceWidth > 6 ? baseSpaceWidth : justifiedSpaceWidth;

          let cursorX = MARGIN_LEFT;
          lineWords.forEach(wt => {
            doc.setFont('helvetica', wt.bold ? 'bold' : 'normal');
            doc.text(wt.word, cursorX, curY);
            cursorX += doc.getTextWidth(wt.word) + spaceToUse;
          });
        }

        curY += lineHeight;
      });

      curY += 1.5; // Espacio entre párrafos
    }

    // 4. Pie de página en todas las hojas
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(MARGIN_LEFT, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 12);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(148, 163, 184);
      doc.text(`Documento oficial expedido por ${companyName || 'Mi Oficina'} • Emisión: ${dateString}`, MARGIN_LEFT, PAGE_HEIGHT - 8);
      doc.text(`Página ${p} de ${pageCount}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 8, { align: 'right' });
    }

    // Guardar archivo PDF
    const cleanPrefix = (fileNamePrefix || 'Documento').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${cleanPrefix}_${todayStr}.pdf`);
  };

  // Descargar PDF con el formato y texto editado directamente de la hoja membretada
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      if (sheetPrintRef.current) {
        // Asegurar que los cambios de formato y estilo queden guardados permanentemente
        handleSaveFormatTemplate(true).catch(console.error);

        const element = sheetPrintRef.current;
        
        // Renderizado de ultra-alta definición (scale: 2) para texto nítido y logotipos impecables
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: element.scrollWidth,
          onclone: (clonedDoc) => {
            const clonedSheet = clonedDoc.getElementById('print-letterhead-sheet');
            if (clonedSheet) {
              clonedSheet.style.border = 'none';
              clonedSheet.style.outline = 'none';
              clonedSheet.style.boxShadow = 'none';
              clonedSheet.style.borderRadius = '0';
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter' // 215.9 x 279.4 mm
        });
        const pdfWidth = pdf.internal.pageSize.getWidth(); // 215.9 mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 279.4 mm

        // Relación de aspecto Carta: 279.4 / 215.9 = 1.2941
        const canvasAspect = canvas.height / canvas.width;
        const letterAspect = pdfHeight / pdfWidth; // ~1.2941

        // LA REGLA PRINCIPAL:
        // Principalmente todos los formatos en su mayoría saldrán en EXACTAMENTE 1 HOJA tamaño carta.
        // Solo si la información es verdaderamente larga (más de 1.45 hojas carta) se divide en múltiples páginas.
        if (canvasAspect <= letterAspect * 1.45) {
          // AJUSTE PERFECTO EN 1 SOLA HOJA TAMAÑO CARTA
          let renderWidth = pdfWidth;
          let renderHeight = (canvas.height * pdfWidth) / canvas.width;

          // Si sobrepasa la altura de la hoja carta, escalamos proporcionalmente para que quepa al 100%
          if (renderHeight > pdfHeight) {
            const scaleFactor = pdfHeight / renderHeight;
            renderHeight = pdfHeight;
            renderWidth = pdfWidth * scaleFactor;
          }

          // Centrado uniforme en la página
          const offsetX = (pdfWidth - renderWidth) / 2;
          const offsetY = (pdfHeight - renderHeight) / 2;

          pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');
        } else {
          // Documento excepcionalmente largo: se distribuye en 2 o más hojas carta manteniendo la calidad
          const imgWidth = pdfWidth;
          const imgHeight = (canvas.height * pdfWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 0;

          // Página 1
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;

          // Páginas siguientes (umbral de 6 mm para evitar páginas huérfanas en blanco)
          while (heightLeft > 6) {
            position -= pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
          }
        }

        const cleanPrefix = (activeFormat.title || 'Documento').replace(/[^a-zA-Z0-9_-]/g, '_');
        pdf.save(`${cleanPrefix}_${emissionDate}.pdf`);

        // Guardar automáticamente en el Historial con el formato enriquecido
        await handleSaveToHistory(editorRef.current?.innerHTML || liveDocumentHtml);
      } else {
        generateOfficialPdf(
          activeFormat.title, 
          editorRef.current?.innerText || liveDocumentText, 
          formattedEmissionDate, 
          activeFormat.title
        );
      }
    } catch (e) {
      console.error("Error generando PDF con motor visual, recurriendo al generador estructurado:", e);
      try {
        generateOfficialPdf(
          activeFormat.title, 
          editorRef.current?.innerText || liveDocumentText, 
          new Date().toLocaleString('es-MX'), 
          activeFormat.title
        );
      } catch (err2) {
        console.error("Error en fallback PDF:", err2);
        alert("Ocurrió un error al generar el documento PDF.");
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Descargar PDF directamente desde un registro del Historial
  const handleDownloadPdfFromHistory = (item: GeneratedDocumentRecord) => {
    try {
      const cleanContent = item.content.replace(/<[^>]*>/g, ' ');
      generateOfficialPdf(
        item.formatTitle,
        cleanContent,
        new Date(item.generatedAt).toLocaleString('es-MX'),
        item.formatTitle
      );
    } catch (e) {
      console.error("Error descargando desde historial:", e);
      alert("Error al exportar documento.");
    }
  };

  // Cargar registro del historial a la hoja membretada para ver/editar
  const handleLoadFromHistory = (item: GeneratedDocumentRecord) => {
    setSelectedFormatId(item.formatId);
    if (item.employeeId) {
      setSelectedEmployeeId(item.employeeId);
    }
    const html = textToHtml(item.content);
    setLiveDocumentHtml(html);
    setLiveDocumentText(item.content);
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
    }
    setActiveSubTab('generator');
  };

  // Eliminar registro del historial
  const handleDeleteHistoryItem = async (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro del historial?')) {
      const updated = generatedHistory.filter(h => h.id !== id);
      setGeneratedHistory(updated);
      try {
        await deleteGeneratedDocument(id);
      } catch (err) {
        console.error("Error eliminando documento del historial:", err);
      }
    }
  };

  // Copiar texto limpio o compilado al portapapeles
  const handleCopyText = (text?: string) => {
    const textToCopy = text || editorRef.current?.innerText || liveDocumentText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Acciones en Machote Editor
  const handleUpdateActiveTemplate = (newTemplate: string) => {
    setDocumentFormats(prev => prev.map(f => {
      if (f.id === activeFormat.id) {
        return { ...f, template: newTemplate, updatedAt: new Date().toISOString() };
      }
      return f;
    }));
  };

  // Insertar Token en el machote en la posición del cursor
  const insertTokenIntoMachote = (token: string) => {
    const textarea = machoteTextareaRef.current;
    const insertion = (token === '[FIRMAS_TABLA]' || token === '[FIRMA_CLIENTE]' || token === '[FIRMA_EMPRESA]')
      ? `\n\n${token}\n\n`
      : ` ${token} `;

    if (!textarea) {
      handleUpdateActiveTemplate((activeFormat.template || '') + insertion);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = activeFormat.template || '';
    const updated = current.substring(0, start) + insertion + current.substring(end);
    handleUpdateActiveTemplate(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  // Negrita en Machote
  const handleApplyBoldToMachote = () => {
    const textarea = machoteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = activeFormat.template || '';

    if (start !== end) {
      const selected = current.substring(start, end);
      let replacement = '';
      if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
        replacement = selected.slice(2, -2);
      } else {
        replacement = `**${selected}**`;
      }
      const updated = current.substring(0, start) + replacement + current.substring(end);
      handleUpdateActiveTemplate(updated);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + replacement.length);
      }, 0);
    } else {
      const placeholder = '**TEXTO_EN_NEGRITA**';
      const updated = current.substring(0, start) + placeholder + current.substring(end);
      handleUpdateActiveTemplate(updated);
    }
  };

  // Guardar Machote en la Nube
  const handleSaveMachoteCloud = async () => {
    setIsSavingMachote(true);
    try {
      await saveDocumentFormatsToCloud(documentFormats);
      setMachoteSuccessMsg('¡Machote guardado y sincronizado con éxito!');
      setTimeout(() => setMachoteSuccessMsg(null), 3000);
    } catch (e) {
      console.error("Error guardando machote en la nube:", e);
      alert("Hubo un error al sincronizar con la nube, pero se guardó en este dispositivo.");
    } finally {
      setIsSavingMachote(false);
    }
  };

  // Restablecer Machote al Predeterminado
  const handleResetMachote = () => {
    const defaultObj = DEFAULT_DOCUMENT_FORMATS.find(d => d.id === activeFormat.id);
    if (!defaultObj) {
      alert("Este formato es personalizado y no tiene un machote oficial previo.");
      return;
    }
    if (window.confirm(`¿Deseas restablecer el machote de "${activeFormat.title}" a su formato oficial predeterminado?`)) {
      handleUpdateActiveTemplate(defaultObj.template);
      setMachoteSuccessMsg('Machote restablecido al formato predeterminado.');
      setTimeout(() => setMachoteSuccessMsg(null), 3000);
    }
  };

  // Modal: Abrir Crear
  const handleOpenCreateFormat = () => {
    setFormatModalMode('create');
    setFormatModalForm({
      title: '',
      shortDesc: '',
      category: 'General',
      iconName: 'FileText',
      template: `TÍTULO DEL DOCUMENTO\n\nEMPRESA: [EMPRESA]\nFECHA: [FECHA_ACTUAL]\n\nPARA: [NOMBRE_PERSONA]\nCURP: [CURP]\nDOMICILIO: [DOMICILIO_PERSONA]\n\nPor medio del presente documento se hace constar que:\n\n[ESCRIBE_AQUÍ_EL_CONTENIDO]\n\nFIRMAN DE CONFORMIDAD:\n\n[FIRMAS_TABLA]`
    });
    setIsFormatModalOpen(true);
  };

  // Modal: Abrir Editar
  const handleOpenEditFormat = () => {
    setFormatModalMode('edit');
    setFormatModalForm({
      title: activeFormat.title,
      shortDesc: activeFormat.shortDesc || '',
      category: activeFormat.category || 'General',
      iconName: activeFormat.iconName || 'FileText',
      template: activeFormat.template || ''
    });
    setIsFormatModalOpen(true);
  };

  // Guardar Cambios del Modal Formato
  const handleSaveFormatModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formatModalForm.title.trim()) {
      alert("Por favor indica un título para el formato.");
      return;
    }

    let updatedList: DocumentFormatConfig[] = [];

    if (formatModalMode === 'create') {
      const newId = `formato_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newFormat: DocumentFormatConfig = {
        id: newId,
        title: formatModalForm.title.trim(),
        shortDesc: formatModalForm.shortDesc.trim() || 'Formato personalizado para la empresa.',
        category: formatModalForm.category.trim() || 'General',
        iconName: formatModalForm.iconName || 'FileText',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
        template: formatModalForm.template.trim() || 'DOCUMENTO\n\n[EMPRESA]\nFECHA: [FECHA_ACTUAL]\n\n[NOMBRE_PERSONA]',
        isCustom: true,
        createdAt: new Date().toISOString()
      };
      updatedList = [...documentFormats, newFormat];
      setDocumentFormats(updatedList);
      setSelectedFormatId(newId);
    } else {
      updatedList = documentFormats.map(f => {
        if (f.id === activeFormat.id) {
          return {
            ...f,
            title: formatModalForm.title.trim(),
            shortDesc: formatModalForm.shortDesc.trim(),
            category: formatModalForm.category.trim(),
            iconName: formatModalForm.iconName,
            template: formatModalForm.template,
            updatedAt: new Date().toISOString()
          };
        }
        return f;
      });
      setDocumentFormats(updatedList);
    }

    setIsFormatModalOpen(false);

    try {
      await saveDocumentFormatsToCloud(updatedList);
    } catch (err) {
      console.error("Error guardando catálogo en la nube:", err);
    }
  };

  // Eliminar Formato
  const handleDeleteActiveFormat = async () => {
    if (documentFormats.length <= 1) {
      alert("No puedes eliminar el único formato disponible.");
      return;
    }

    if (window.confirm(`¿Estás completamente seguro de eliminar el formato "${activeFormat.title}"?`)) {
      const updatedList = documentFormats.filter(f => f.id !== activeFormat.id);
      setDocumentFormats(updatedList);
      setSelectedFormatId(updatedList[0].id);
      setIsFormatModalOpen(false);

      try {
        await saveDocumentFormatsToCloud(updatedList);
      } catch (err) {
        console.error("Error eliminando formato en la nube:", err);
      }
    }
  };

  // Filtrar documentos del historial
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return generatedHistory;
    const q = historySearchQuery.toLowerCase();
    return generatedHistory.filter(h => 
      (h.formatTitle && h.formatTitle.toLowerCase().includes(q)) ||
      (h.employeeName && h.employeeName.toLowerCase().includes(q)) ||
      (h.content && h.content.toLowerCase().includes(q))
    );
  }, [generatedHistory, historySearchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs shrink-0">
            <FileStack className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Formatos y Documentos</h2>
        </div>

        {/* Acciones de Catálogo y Categorías */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => setIsLogoModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all"
            title="Logotipo oficial exclusivo para formatos y documentos"
          >
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <span>Logo Formatos</span>
            {formatLogoUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Logotipo personalizado activo" />
            )}
          </button>

          <button
            onClick={handleOpenCreateFormat}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Formato</span>
          </button>

          <button
            onClick={handleOpenEditFormat}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all"
            title="Ajustar nombre, categoría, icono o eliminar formato"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Gestionar</span>
          </button>
        </div>
      </div>

      {/* Barra Compacta de Selección de Formato y Sub-Pestañas */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:px-4 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        
        {/* Selector Desplegable de Formatos (Ahorro de espacio) */}
        {activeSubTab !== 'history' ? (
          <div className="flex items-center gap-2.5 flex-1 w-full lg:w-auto flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Formato:</span>
            </div>

            <select
              value={selectedFormatId}
              onChange={(e) => setSelectedFormatId(e.target.value)}
              className="flex-1 sm:flex-initial sm:min-w-[320px] bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 transition-all cursor-pointer"
            >
              {filteredFormatos.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.category}) {item.isCustom ? '• Personalizado' : ''}
                </option>
              ))}
            </select>

            {/* Filtro Rápido de Categorías de Formato */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterCategory === cat 
                      ? 'bg-slate-900 text-white shadow-2xs' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat === 'Credito' ? 'Crédito' : cat}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <History className="w-4 h-4 text-amber-500" />
            <span>Consultando Registro Histórico de Documentos</span>
          </div>
        )}

        {/* Pestañas de Navegación: Vista Membretada | Editor de Machote | Historial */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl shrink-0 self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setActiveSubTab('generator')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'generator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Documento Membretado</span>
          </button>

          <button
            onClick={() => setActiveSubTab('editor')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'editor'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Editor de Machote</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Historial</span>
            {generatedHistory.length > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'history' ? 'bg-amber-400 text-slate-950' : 'bg-slate-300 text-slate-800'
              }`}>
                {generatedHistory.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notificación de Éxito en Historial */}
      {historySuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in max-w-5xl mx-auto">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{historySuccessMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 1: DOCUMENTO MEMBRETADO CON EDICIÓN DIRECTA      */}
      {/* ======================================================== */}
      {activeSubTab === 'generator' && (
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* BARRA DE CONTROL EJECUTIVA COMPACTA (AUTOLLENADO + ACCIONES) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 px-3.5 py-2 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 relative z-30">
            
            {/* LADO IZQUIERDO: COMBOBOX DESPLEGABLE DE AUTOLLENADO */}
            <div className="flex items-center gap-2 relative" ref={employeePopoverRef}>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 hidden sm:inline shrink-0">
                Colaborador:
              </span>

              {selectedEmployeeObj ? (
                /* Chip Ejecutivo Compacto de Colaborador Cargado */
                <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl pl-1.5 pr-2 py-1 transition-all">
                  <button
                    type="button"
                    onClick={() => setIsEmployeePopoverOpen(p => !p)}
                    className="flex items-center gap-2 text-left cursor-pointer"
                    title="Clic para cambiar colaborador"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-[10px] shrink-0">
                      {selectedEmployeeObj.firstName.charAt(0)}{selectedEmployeeObj.lastName.charAt(0)}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-slate-900 truncate max-w-[170px] sm:max-w-[220px] inline-block align-middle">
                        {selectedEmployeeObj.firstName} {selectedEmployeeObj.lastName}
                      </span>
                      <span className={`ml-1.5 text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                        selectedEmployeeObj.category === 'Oficina' ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : selectedEmployeeObj.category === 'Ejecutivos' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : selectedEmployeeObj.category === 'Supervisoras' ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {selectedEmployeeObj.category}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeId('');
                      handleResetLiveText();
                    }}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded-md hover:bg-white transition-colors cursor-pointer ml-0.5"
                    title="Limpiar y quitar colaborador"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Botón Disparador del Selector de Colaboradores */
                <button
                  type="button"
                  onClick={() => setIsEmployeePopoverOpen(p => !p)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Autollenar Datos (A-Z)</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isEmployeePopoverOpen ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* POPOVER FLOTANTE: BÚSQUEDA + FILTROS POR ROL + LISTADO A-Z */}
              {isEmployeePopoverOpen && (
                <div className="absolute top-full left-0 mt-2 w-[340px] sm:w-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-scale-in flex flex-col max-h-[390px]">
                  
                  {/* Encabezado del Popover: Buscador Rápido */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={employeeSearchQuery}
                        onChange={e => setEmployeeSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, CURP o puesto..."
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8.5 pr-8 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                      />
                      {employeeSearchQuery && (
                        <button 
                          onClick={() => setEmployeeSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Filtros por Rol / Tipo de Empleado con Conteo */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                      {EMPLOYEE_ROLE_TABS.map(tab => {
                        const count = employeeCountsByCategory[tab.id] ?? 0;
                        const isActive = employeeCategoryFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setEmployeeCategoryFilter(tab.id)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-slate-900 text-white shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cuerpo del Popover: Lista Alfabética A-Z */}
                  <div className="p-2 overflow-y-auto divide-y divide-slate-100 flex-1 scrollbar-thin">
                    {sortedAndFilteredEmployees.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 space-y-1">
                        <Users className="w-6 h-6 mx-auto text-slate-300 opacity-60" />
                        <p className="text-xs font-bold text-slate-600">No se encontraron colaboradores.</p>
                        <p className="text-[10px] text-slate-400">Intenta con otro término de búsqueda.</p>
                      </div>
                    ) : (
                      sortedAndFilteredEmployees.map(emp => {
                        const isSelected = emp.id === selectedEmployeeId;
                        return (
                          <div
                            key={emp.id}
                            onClick={() => {
                              handleSelectEmployee(emp.id);
                              setIsEmployeePopoverOpen(false);
                            }}
                            className={`p-2 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer text-xs ${
                              isSelected
                                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                isSelected 
                                  ? 'bg-emerald-500 text-white font-black' 
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold truncate">
                                    {emp.firstName} {emp.lastName}
                                  </span>
                                  <span className={`text-[9px] font-black uppercase px-1 rounded ${
                                    isSelected 
                                      ? 'bg-white/20 text-white' 
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {emp.category || 'General'}
                                  </span>
                                </div>
                                <p className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                  {emp.position || 'Colaborador'}{emp.curp ? ` • CURP: ${emp.curp}` : ''}
                                  {emp.supervisionName ? ` • Sup: ${emp.supervisionName}` : ''}
                                  {emp.groupName ? ` • Grupo: ${emp.groupName}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isSelected ? (
                                <span className="text-[10px] font-black bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-md">
                                  ✓ Cargado
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5">
                                  Elegir
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Pie del Popover */}
                  <div className="p-2 px-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span>{sortedAndFilteredEmployees.length} colaboradores en orden A-Z</span>
                    <button
                      type="button"
                      onClick={() => setIsEmployeePopoverOpen(false)}
                      className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* LADO DERECHO: ACCIONES CLAVE DEL FORMATO */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap justify-end">
              {/* Botón Justificar */}
              <button
                type="button"
                onClick={handleToggleJustify}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isTextJustified
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                }`}
                title={isTextJustified ? 'Texto Justificado (Clic para alinear a la izquierda)' : 'Texto Alineado a la Izquierda (Clic para justificar)'}
              >
                {isTextJustified ? (
                  <AlignJustify className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlignLeft className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>{isTextJustified ? 'Justificado' : 'Justificar'}</span>
              </button>

              {/* Botón Guardar Formato */}
              <button
                type="button"
                onClick={() => handleSaveFormatTemplate(false)}
                disabled={isSavingFormatTemplate}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  hasUnsavedFormatChanges
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs animate-pulse'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                }`}
                title="Guardar este texto y estilo como la plantilla permanente de este documento"
              >
                {saveFormatSuccessMsg ? (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Save className={`w-4 h-4 shrink-0 ${hasUnsavedFormatChanges ? 'text-white' : 'text-slate-400'}`} />
                )}
                <span>
                  {saveFormatSuccessMsg 
                    ? '¡Guardado!' 
                    : isSavingFormatTemplate 
                    ? 'Guardando...' 
                    : 'Guardar Formato'}
                </span>
              </button>

              {/* Botón Historial */}
              <button
                type="button"
                onClick={() => handleSaveToHistory()}
                className="h-9 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Guardar una copia de este documento en el historial"
              >
                <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Historial</span>
              </button>

              {/* Separador vertical sutil */}
              <div className="h-5 w-px bg-slate-200 hidden sm:block mx-0.5" />

              {/* Botón Descargar PDF (Acción Principal) */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="h-9 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
                title="Descargar documento en PDF tamaño carta"
              >
                <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
              </button>
            </div>

          </div>

          {/* HOJA DIGITAL TAMAÑO CARTA CON EDICIÓN DIRECTA EN VIVO */}
          <div className="bg-white rounded-2xl border border-slate-300/90 shadow-xl overflow-hidden flex flex-col">
            
            {/* BARRA DE HERRAMIENTAS DE EDICIÓN RICA (RICH TEXT TOOLBAR COMPLETA) */}
            <div className="bg-slate-100/95 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-1.5 text-slate-700 select-none">
              
              {/* Deshacer / Rehacer */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('undo')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Deshacer (Ctrl+Z)"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('redo')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Rehacer (Ctrl+Y)"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tipografía */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
                <select
                  value={selectedFontFamily}
                  onChange={e => applyFontFamily(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none font-medium cursor-pointer text-slate-800"
                  title="Familia tipográfica"
                >
                  <option value="sans-serif">Sans-serif (Arial / Inter)</option>
                  <option value="serif">Serif (Times / Georgia)</option>
                  <option value="monospace">Monospace (Courier / Código)</option>
                </select>
              </div>

              {/* Tamaño de Letra */}
              <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
                <Type className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedFontSize}
                  onChange={e => applyFontSize(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none font-medium cursor-pointer text-slate-800"
                  title="Tamaño de letra"
                >
                  <option value="10px">10px - Muy pequeño</option>
                  <option value="11px">11px - Pequeño</option>
                  <option value="12px">12px - Estándar</option>
                  <option value="13px">13px - Normal</option>
                  <option value="15px">15px - Destacado</option>
                  <option value="18px">18px - Subtítulo</option>
                  <option value="22px">22px - Título</option>
                  <option value="26px">26px - Gran Título</option>
                </select>
              </div>

              {/* Formato B / I / U / S */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('bold')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                  title="Negritas (Ctrl+B)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('italic')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg italic text-xs transition-colors cursor-pointer"
                  title="Cursiva (Ctrl+I)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('underline')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg underline text-xs transition-colors cursor-pointer"
                  title="Subrayado (Ctrl+U)"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('strikeThrough')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg line-through text-xs transition-colors cursor-pointer"
                  title="Tachado"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Color de Texto y Resaltador */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-300 relative">
                {/* Color de Texto */}
                <div className="relative" ref={colorPickerRef}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setIsColorPickerOpen(prev => !prev);
                      setIsHighlightPickerOpen(false);
                    }}
                    className="p-1.5 hover:bg-white rounded-lg flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                    title="Color del texto"
                  >
                    <Palette className="w-3.5 h-3.5 text-slate-700" />
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: selectedTextColor }}></span>
                  </button>

                  {isColorPickerOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 flex flex-col gap-2 min-w-[150px] animate-fade-in">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Color del Texto</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { label: 'Negro', color: '#0f172a' },
                          { label: 'Pizarra', color: '#334155' },
                          { label: 'Azul Marino', color: '#1e3a8a' },
                          { label: 'Azul Real', color: '#2563eb' },
                          { label: 'Rojo Vino', color: '#991b1b' },
                          { label: 'Rojo Carmesí', color: '#dc2626' },
                          { label: 'Verde Bosque', color: '#065f46' },
                          { label: 'Verde Esmeralda', color: '#059669' },
                          { label: 'Ámbar Oscuro', color: '#b45309' },
                          { label: 'Púrpura', color: '#6b21a8' }
                        ].map(c => (
                          <button
                            key={c.color}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyTextColor(c.color)}
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                            className="w-5 h-5 rounded-full border border-slate-300 hover:scale-115 transition-transform cursor-pointer"
                          />
                        ))}
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-medium">Personalizado:</span>
                        <input 
                          type="color" 
                          value={selectedTextColor} 
                          onChange={e => applyTextColor(e.target.value)} 
                          className="w-5 h-5 rounded border-0 cursor-pointer p-0 bg-transparent" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Resaltador de Fondo */}
                <div className="relative" ref={highlightPickerRef}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setIsHighlightPickerOpen(prev => !prev);
                      setIsColorPickerOpen(false);
                    }}
                    className="p-1.5 hover:bg-white rounded-lg flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer"
                    title="Color de resaltador de fondo"
                  >
                    <Highlighter className="w-3.5 h-3.5 text-amber-600" />
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: selectedHighlightColor === 'transparent' ? '#ffffff' : selectedHighlightColor }}></span>
                  </button>

                  {isHighlightPickerOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 flex flex-col gap-2 min-w-[140px] animate-fade-in">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Color Resaltador</span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: 'Sin resaltar', color: 'transparent' },
                          { label: 'Amarillo suave', color: '#fef08a' },
                          { label: 'Verde menta', color: '#bbf7d0' },
                          { label: 'Celeste suave', color: '#bae6fd' },
                          { label: 'Rosa suave', color: '#fbcfe8' }
                        ].map(c => (
                          <button
                            key={c.color}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => applyHighlightColor(c.color)}
                            style={{ backgroundColor: c.color === 'transparent' ? '#f8fafc' : c.color }}
                            title={c.label}
                            className="w-6 h-6 rounded-md border border-slate-300 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer text-[10px] font-bold text-slate-600"
                          >
                            {c.color === 'transparent' ? '✕' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alineación */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    executeCmd('justifyLeft');
                    setIsTextJustified(false);
                  }}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Alinear a la izquierda"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    executeCmd('justifyCenter');
                    setIsTextJustified(false);
                  }}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Centrar texto"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    executeCmd('justifyRight');
                    setIsTextJustified(false);
                  }}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Alinear a la derecha"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    executeCmd('justifyFull');
                    setIsTextJustified(true);
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isTextJustified ? 'bg-white text-emerald-600 font-bold shadow-2xs' : 'hover:bg-white hover:text-slate-900'}`}
                  title="Justificar texto completo"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Listas y Sangría */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-slate-300">
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('insertUnorderedList')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Lista con viñetas"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('insertOrderedList')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Lista numerada"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('outdent')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Disminuir sangría"
                >
                  <Outdent className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('indent')}
                  className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                  title="Aumentar sangría"
                >
                  <Indent className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Elementos Especiales */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={insertHorizontalRule}
                  className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 text-slate-700 transition-colors cursor-pointer"
                  title="Insertar línea divisoria horizontal"
                >
                  <Minus className="w-3 h-3" />
                  <span>Línea</span>
                </button>

                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={insertSignaturesBlock}
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 text-indigo-700 transition-colors cursor-pointer"
                  title="Insertar cuadro de firmas oficial"
                >
                  <FileSignature className="w-3 h-3 text-indigo-600" />
                  <span>Firmas</span>
                </button>

                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => executeCmd('removeFormat')}
                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors cursor-pointer"
                  title="Limpiar formato"
                >
                  <RemoveFormatting className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Guardado Persistente de la Plantilla en Barra */}
              <div className="ml-auto flex items-center gap-1.5 pl-2">
                {saveFormatSuccessMsg && (
                  <span className="text-[10px] font-bold text-emerald-600 animate-fade-in flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {saveFormatSuccessMsg}
                  </span>
                )}
                {hasUnsavedFormatChanges && !saveFormatSuccessMsg && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
                    Cambios sin guardar
                  </span>
                )}
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSaveFormatTemplate(false)}
                  disabled={isSavingFormatTemplate}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    hasUnsavedFormatChanges 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs animate-pulse' 
                      : 'bg-slate-900 hover:bg-black text-white'
                  }`}
                  title="Guardar el texto y formato como la plantilla permanente de este documento"
                >
                  <Save className="w-3 h-3 text-emerald-400" />
                  <span>{isSavingFormatTemplate ? 'Guardando...' : 'Guardar'}</span>
                </button>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleResetLiveText}
                  className="h-7 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Restablecer este formato a su plantilla oficial predeterminada"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            {/* Contenedor Exterior de la Hoja Membretada (Imprimible en PDF) */}
            <div className="p-4 sm:p-8 bg-slate-100/60 flex justify-center overflow-x-auto">
              <div className="bg-white shadow-md border border-slate-200/80 rounded-2xl overflow-hidden max-w-[816px] w-full flex justify-center">
                <div 
                  ref={sheetPrintRef}
                  id="print-letterhead-sheet"
                  className="p-6 sm:px-10 sm:py-8 bg-white text-slate-800 space-y-4 select-text w-full max-w-[816px] min-h-[1056px] flex flex-col justify-between border-0 shadow-none rounded-none outline-none"
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', borderRadius: '0' }}
                >
                  <div className="space-y-4">
                    {/* Membrete Oficial Institucional */}
                    <div className="flex items-center justify-between gap-4 border-b-2 border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        {effectiveFormatLogo ? (
                          <img 
                            src={effectiveFormatLogo} 
                            crossOrigin="anonymous"
                            alt="Logo" 
                            className="h-12 max-w-[160px] object-contain shrink-0" 
                          />
                        ) : (
                          <div className="p-2 bg-slate-100 rounded-xl border border-slate-200 text-slate-700">
                            <Building2 className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <h2 className="text-xs sm:text-sm font-black uppercase text-slate-900 tracking-tight">
                            {companyName || 'MI OFICINA'}
                          </h2>
                          {companyRfc && (
                            <p className="text-[9px] font-mono font-bold text-slate-500 uppercase">
                              RFC: {companyRfc}
                            </p>
                          )}
                          {companyAddress && (
                            <p className="text-[9px] text-slate-500 leading-tight">
                              {companyAddress}
                            </p>
                          )}
                          {companyPhone && (
                            <p className="text-[9px] text-slate-500 font-semibold">
                              Tel: {companyPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <button 
                          type="button"
                          onClick={() => setIsEmissionDateModalOpen(true)}
                          className="cursor-pointer text-right group p-0 bg-transparent border-0 outline-none block"
                          title="Hacer clic para modificar la fecha de emisión del documento"
                        >
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">
                            Fecha de Emisión
                          </span>
                          <span className="text-xs font-bold text-slate-800 font-sans group-hover:text-indigo-600 transition-colors">
                            {formattedEmissionDate}
                          </span>
                        </button>
                      </div>
                    </div>

                  {/* Título del Documento */}
                  <div className="text-center pt-2 pb-1">
                    <h1 className="text-sm font-black uppercase tracking-widest text-slate-900 font-sans">
                      {activeFormat.title}
                    </h1>
                  </div>

                  {/* CUERPO DEL DOCUMENTO: EDITOR DE TEXTO ENRIQUECIDO WYSIWYG */}
                  <div className="relative pt-1">
                    <div
                      ref={editorRef}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onInput={handleEditorInput}
                      className="outline-none min-h-[500px] text-slate-800 leading-relaxed font-sans select-text p-2 rounded-xl transition-all focus:bg-slate-50/40 border border-transparent hover:border-slate-200 focus:border-indigo-300 [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2.5 [&_hr]:my-3 [&_hr]:border-slate-300 [&_table]:my-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-1"
                      style={{
                        fontSize: selectedFontSize,
                        fontFamily: selectedFontFamily,
                        lineHeight: '1.65',
                        textAlign: isTextJustified ? 'justify' : 'left'
                      }}
                      data-placeholder="Escribe o formatea el documento aquí..."
                    />
                  </div>
                </div>

                {/* Pie de Página de la Hoja */}
                <div className="pt-4 border-t border-slate-200 text-center font-sans text-[9px] text-slate-400">
                  Documento expedido y certificado para fines legales y administrativos &bull; {companyName || 'Mi Oficina'}
                </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    )}

      {/* ======================================================== */}
      {/* SUB-TAB 2: EDITOR DE MACHOTE (PLANTILLA BASE)            */}
      {/* ======================================================== */}
      {activeSubTab === 'editor' && (
        <div className="space-y-5">
          {/* Header del Editor de Machote */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  Editor de Machote: {activeFormat.title}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeFormat.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Haz clic en cualquier etiqueta para insertarla en la posición del cursor de tu machote. Al seleccionar un empleado, estos tags se reemplazarán automáticamente.
              </p>
            </div>

            {/* Botones de acción del machote */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetMachote}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Restablecer al machote de fábrica predeterminado"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>

              <button
                onClick={handleSaveMachoteCloud}
                disabled={isSavingMachote}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingMachote ? 'Guardando...' : 'Guardar Machote'}</span>
              </button>
            </div>
          </div>

          {machoteSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{machoteSuccessMsg}</span>
            </div>
          )}

          {/* Chips de Tags / Etiquetas disponibles */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Catálogo de Tags para Insertar al Machote
                </h4>
              </div>
              <span className="text-[10px] text-slate-400">Haz clic en una etiqueta para pegarla en la posición del cursor</span>
            </div>

            <div className="space-y-3">
              {AVAILABLE_TAG_GROUPS.map(group => (
                <div key={group.group} className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 w-36 shrink-0">
                    {group.group}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map(item => (
                      <button
                        key={item.token}
                        type="button"
                        onClick={() => insertTokenIntoMachote(item.token)}
                        className={`px-2 py-1 text-[11px] font-mono font-medium rounded-lg border hover:scale-105 active:scale-95 transition-all flex items-center gap-1 ${group.color} cursor-pointer`}
                        title={`Insertar ${item.token}`}
                      >
                        <span className="font-bold opacity-70">+</span>
                        <span>{item.token}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área de Edición del Machote */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Contenido del Machote
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyBoldToMachote}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer"
                  title="Poner en negrita"
                >
                  <Bold className="w-3.5 h-3.5" />
                  <span>Negrita</span>
                </button>
              </div>
            </div>

            <textarea
              ref={machoteTextareaRef}
              value={activeFormat.template}
              onChange={e => handleUpdateActiveTemplate(e.target.value)}
              rows={22}
              className="w-full font-mono text-xs text-slate-800 p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none leading-relaxed transition-all resize-y"
              placeholder="Escribe aquí el machote oficial con etiquetas como [EMPRESA], [NOMBRE_PERSONA], etc..."
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-400">
                {activeFormat.template.length} caracteres &bull; {activeFormat.template.split('\n').length} líneas
              </span>
              <button
                onClick={handleSaveMachoteCloud}
                disabled={isSavingMachote}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSavingMachote ? 'Guardando...' : 'Guardar y Aplicar'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-TAB 3: HISTORIAL DE DOCUMENTOS GENERADOS             */}
      {/* ======================================================== */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          
          {/* Header del Historial con Barra de Búsqueda */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900">
                  Historial de Documentos Generados
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulta, vuelve a descargar en PDF o re-abre cualquier formato generado anteriormente.
              </p>
            </div>

            {/* Búsqueda */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                placeholder="Buscar por colaborador o formato..."
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Tabla o Lista de Documentos del Historial */}
          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <FileStack className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
              <p className="text-xs font-semibold text-slate-600">No hay documentos en el historial todavía.</p>
              <p className="text-[11px] text-slate-400">
                Cada vez que descargues un PDF o presiones "Guardar", se registrará automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHistory.map(record => (
                <div 
                  key={record.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        {record.formatTitle}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md">
                        {record.employeeName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Generado el {new Date(record.generatedAt).toLocaleString('es-MX', { 
                        dateStyle: 'medium', 
                        timeStyle: 'short' 
                      })}
                      {record.generatedBy && ` • Por: ${record.generatedBy}`}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 italic font-serif max-w-xl">
                      "{record.content.substring(0, 120)}..."
                    </p>
                  </div>

                  {/* Acciones para cada registro */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleLoadFromHistory(record)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Ver y editar en la hoja membretada"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver / Editar</span>
                    </button>

                    <button
                      onClick={() => handleDownloadPdfFromHistory(record)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Descargar en PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => handleCopyText(record.content)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                      title="Copiar texto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteHistoryItem(record.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar del historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREAR O EDITAR TIPO DE FORMATO                    */}
      {/* ======================================================== */}
      {isFormatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-lg text-emerald-400">
                  {formatModalMode === 'create' ? <Plus className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {formatModalMode === 'create' ? 'Crear Nuevo Formato' : `Editar Formato: ${activeFormat.title}`}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {formatModalMode === 'create' ? 'Configura un nuevo tipo de documento oficial.' : 'Modifica el nombre, categoría o elimina este formato.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsFormatModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFormatModal} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nombre / Título del Formato *
                </label>
                <input 
                  type="text" 
                  value={formatModalForm.title}
                  onChange={e => setFormatModalForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ej: Carta de Recomendación Laboral"
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={formatModalForm.category}
                    onChange={e => setFormatModalForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="Laboral">Laboral</option>
                    <option value="Cobranza">Cobranza</option>
                    <option value="Credito">Crédito</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Icono Representativo
                  </label>
                  <select
                    value={formatModalForm.iconName}
                    onChange={e => setFormatModalForm(p => ({ ...p, iconName: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="FileText">Documento General</option>
                    <option value="Receipt">Recibo / Finiquito</option>
                    <option value="Scale">Convenio / Jurídico</option>
                    <option value="AlertTriangle">Alerta / Requerimiento</option>
                    <option value="ShieldAlert">Notificación Legal</option>
                    <option value="FileCheck2">Constancia / No Adeudo</option>
                    <option value="FileSignature">Pagaré / Título</option>
                    <option value="CreditCard">Crédito / Pagos</option>
                    <option value="Briefcase">Laboral / Contrato</option>
                    <option value="Award">Certificado / Reconocimiento</option>
                    <option value="Users">Personal / Colaborador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Descripción Corta
                </label>
                <input 
                  type="text" 
                  value={formatModalForm.shortDesc}
                  onChange={e => setFormatModalForm(p => ({ ...p, shortDesc: e.target.value }))}
                  placeholder="Breve descripción del propósito de este documento"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {formatModalMode === 'create' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Machote Inicial (Plantilla)
                  </label>
                  <textarea 
                    value={formatModalForm.template}
                    onChange={e => setFormatModalForm(p => ({ ...p, template: e.target.value }))}
                    rows={6}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="Escribe el machote inicial..."
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Podrás editar el machote con la barra de tags completa una vez creado el formato.
                  </p>
                </div>
              )}

              {/* Botones de acción del modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                {formatModalMode === 'edit' && documentFormats.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleDeleteActiveFormat}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Formato</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormatModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
                  >
                    {formatModalMode === 'create' ? 'Crear Formato' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: FECHA DE EMISIÓN EDITABLE DEL DOCUMENTO           */}
      {/* ======================================================== */}
      {isEmissionDateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            
            {/* Header del Modal */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Fecha de Emisión
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Modifica la fecha oficial del documento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEmissionDateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-5 space-y-4">
              
              {/* Selector de Fecha */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Selecciona la Fecha:
                </label>
                <input
                  type="date"
                  value={emissionDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleEmissionDateChange(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-indigo-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-800 outline-none transition-all cursor-pointer shadow-2xs"
                />
              </div>

              {/* Botones de Acceso Rápido */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Accesos Rápidos:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDate(0)}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer text-center"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(-1)}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer text-center"
                  >
                    Ayer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(1)}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer text-center"
                  >
                    Mañana
                  </button>
                </div>
              </div>

              {/* Vista Previa del Formato Oficial */}
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider block">
                  Formato en el Documento y PDF:
                </span>
                <p className="text-xs font-black text-indigo-950 font-sans leading-tight">
                  {formattedEmissionDate}
                </p>
              </div>

              {/* Botón Aplicar y Cerrar */}
              <button
                type="button"
                onClick={() => setIsEmissionDateModalOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Aplicar al Formato</span>
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LOGOTIPO EXCLUSIVO PARA FORMATOS Y DOCUMENTOS    */}
      {/* ======================================================== */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
            
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Logotipo para Formatos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Uso exclusivo en membretes y PDFs de Formatos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-5">
              
              {/* Vista previa del Logo Actual */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center text-center">
                {effectiveFormatLogo ? (
                  <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200/60 max-w-[260px] flex items-center justify-center">
                    <img 
                      src={effectiveFormatLogo} 
                      alt="Logo de Formatos" 
                      className="max-h-28 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-6 bg-slate-100 rounded-xl border border-dashed border-slate-300 text-slate-400 flex flex-col items-center gap-2">
                    <Building2 className="w-10 h-10" />
                    <span className="text-xs font-semibold">Sin logotipo asignado</span>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input 
                ref={formatLogoInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleLogoFileChange}
              />

              {/* Acciones */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                {formatLogoUrl ? (
                  <button
                    type="button"
                    onClick={handleClearFormatLogo}
                    className="w-full sm:w-auto px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Restablecer a General</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => formatLogoInputRef.current?.click()}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{formatLogoUrl ? 'Cambiar Logotipo' : 'Subir Logotipo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLogoModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Formatos;

