import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI } from "@google/genai";
import { WeeklySheetGroup, WeeklySheetExtractedClient } from '../types';
import { getAppSettings } from './dbService';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch (e) {
    console.warn("Could not set PDF worker URL", e);
  }
}

interface TextItemWithCoords {
  str: string;
  x: number;
  y: number;
}

/**
 * Extracts raw text items with coordinates from a PDF file using pdfjs-dist
 */
export const extractPdfItemsWithCoords = async (file: File): Promise<{
  fullText: string;
  pages: TextItemWithCoords[][];
}> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  const pages: TextItemWithCoords[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageItems: TextItemWithCoords[] = textContent.items
      .map((it: any) => ({
        str: (it.str || '').trim(),
        x: it.transform ? it.transform[4] : 0,
        y: it.transform ? it.transform[5] : 0
      }))
      .filter((it: TextItemWithCoords) => it.str.length > 0);

    pages.push(pageItems);

    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += `--- PÁGINA ${pageNum} ---\n` + pageText + '\n';
  }

  return { fullText, pages };
};

/**
 * Converts a File to a base64 string (without data prefix)
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Cleans phone numbers to 10 digits
 */
export const cleanPhoneNumber = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('52')) return digits.substring(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

/**
 * Fallback to generate group name from file name
 */
export const cleanFileNameToGroupName = (fileName: string): string => {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/hoja\s*de\s*semana/gi, '')
    .replace(/semana\s*\d+/gi, '')
    .replace(/[-_]/g, ' ')
    .trim() || 'Grupo';
};

/**
 * AI Parser with Gemini Multimodal: Specifically tuned for Presta "Hoja de Semana" format.
 */
export const parsePdfWithGemini = async (file: File): Promise<{
  groupName: string;
  executive?: string;
  supervisor?: string;
  plaza?: string;
  loanDate?: string;
  dueDate?: string;
  amount?: string | number;
  clients: WeeklySheetExtractedClient[];
} | null> => {
  try {
    const settings = await getAppSettings();
    const apiKey = settings.googleApiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_GEMINI_KEY') {
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToBase64(file);

    const prompt = `Analiza esta Hoja de Semana de créditos (formato Presta).
En la parte superior encontrarás:
- Fecha (Fecha del préstamo, ej. 19/09/2026)
- Vence (Fecha de vencimiento, ej. 26/12/2026)
- Ejecutivo (Nombre del ejecutivo / asesor)
- Plaza (Nombre de la plaza, ej. YULI COLIMA)
- Supervisor (si existe)
- Cantidad (Monto total o del crédito, ej. $3,000.00)
- Grupo (Nombre del grupo, ej. ANA VALLE)

En la tabla inferior, para cada cliente, encontrarás:
- Columna CLIENTE con 4 líneas en este orden estricto de arriba a abajo:
  1. NOMBRE COMPLETO DEL CLIENTE
  2. DIRECCIÓN (Calle y número)
  3. COLONIA (o Municipio)
  4. TELÉFONO (10 dígitos)
- Columna Abona: monto del abono semanal (ej. 345.00)
- Columna AVAL con 4 líneas en este orden estricto de arriba a abajo:
  1. NOMBRE COMPLETO DEL AVAL
  2. DIRECCIÓN DEL AVAL (Calle y número)
  3. COLONIA DEL AVAL (o Municipio)
  4. TELÉFONO DEL AVAL (10 dígitos)

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. NO incluyas filas de totales o resúmenes como "TOT. CLIENTES 1" o "TOTALES".
2. NO tomes valores numéricos aislados (ej. "1", "2") como si fueran nombres de clientes.
3. CONDICIÓN MÍNIMA: Un cliente DEBE tener por lo menos DOS (2) datos válidos para ser considerado (por ejemplo: Nombre + Teléfono, o Nombre + Dirección). Si un cliente solo tiene nombre sin dirección ni teléfono, o no tiene nombre real, IGNÓRALO Y NO LO AGREGUES.

Devuelve ÚNICAMENTE un objeto JSON estrictamente válido, sin markdown ni explicaciones envolventes:
{
  "fecha": "Fecha del préstamo (ej. 19/09/2026)",
  "vence": "Fecha de vencimiento (ej. 26/12/2026)",
  "ejecutivo": "Nombre del ejecutivo",
  "plaza": "Nombre de la plaza",
  "supervisor": "Nombre de la supervisora",
  "cantidad": "Monto o cantidad",
  "grupo": "Nombre del grupo",
  "clients": [
    {
      "nombre": "Nombre completo del cliente",
      "direccion": "Dirección del cliente",
      "colonia": "Colonia del cliente",
      "telefono": "Teléfono a 10 dígitos del cliente",
      "abona": "Monto de abono semanal",
      "aval_nombre": "Nombre completo del aval",
      "aval_direccion": "Dirección del aval",
      "aval_colonia": "Colonia del aval",
      "aval_telefono": "Teléfono a 10 dígitos del aval"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64Data } },
          { text: prompt }
        ]
      }
    });

    const responseText = response.text || '';
    const cleanedJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanedJson);
    return {
      groupName: parsed.grupo || parsed.groupName || cleanFileNameToGroupName(file.name),
      executive: parsed.ejecutivo || parsed.executive || '',
      supervisor: parsed.supervisor || '',
      plaza: parsed.plaza || '',
      loanDate: parsed.fecha || parsed.loanDate || '',
      dueDate: parsed.vence || parsed.dueDate || '',
      amount: parsed.cantidad || parsed.amount || '',
      clients: (parsed.clients || []).map((c: any, idx: number) => ({
        id: `c_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        name: (c.nombre || c.name || '').trim(),
        address: (c.direccion || c.address || '').trim(),
        neighborhood: (c.colonia || c.neighborhood || '').trim(),
        phone: cleanPhoneNumber(c.telefono || c.phone || ''),
        guarantorName: (c.aval_nombre || c.guarantorName || '').trim(),
        guarantorAddress: (c.aval_direccion || c.guarantorAddress || '').trim(),
        guarantorNeighborhood: (c.aval_colonia || c.guarantorNeighborhood || '').trim(),
        guarantorPhone: cleanPhoneNumber(c.aval_telefono || c.guarantorPhone || ''),
        amount: parsed.cantidad || '',
        weeklyPayment: c.abona || c.weeklyPayment || '',
        loanDate: parsed.fecha || '',
        dueDate: parsed.vence || '',
        isSelected: false
      })).filter((c: any) => isValidClientCandidate(c))
    };
  } catch (err) {
    console.warn("Gemini PDF parsing fallback to regex/local parser:", err);
    return null;
  }
};

/**
 * Checks if a string has actual alphabetic text (not just numbers or symbols)
 */
const hasAlphabeticChars = (str: string): boolean => {
  return /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(str);
};

/**
 * Filter out column headers and total noise from table rows
 */
export const isTableNoise = (str: string): boolean => {
  const trimmed = str.trim();
  if (!trimmed) return true;
  return /^(CLIENTE|AVAL|Abona|Ext|TOTALES|TOT\.\s*CLIENTES|TOTAL|Presta|©|PAGINA|PÁGINA|SUBTOTAL)$/i.test(trimmed) ||
    /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/.test(trimmed) || // date columns
    /^0\.00$/.test(trimmed) ||
    /^[0-9]{1,3}$/.test(trimmed); // Single numbers like 1, 2, 14, or table counts
};

/**
 * Evaluates whether an extracted client has enough valid information to be taken into account.
 * User requirement:
 * "si el cliente no tiene por lo menos dos datos minimo entonces no se toma en cuenta,
 * por ejemplo si tiene nombre y telefono, si aplica,
 * si tiene nombre, domicilio y telefono si aplica,
 * si solo tiene nombre, sin domicilio y sin telefono, no aplica."
 */
export const isValidClientCandidate = (client: {
  name?: string;
  address?: string;
  neighborhood?: string;
  phone?: string;
}): boolean => {
  const rawName = (client.name || '').trim();

  // 1. Must have a valid name (at least 3 characters, contains letters, not noise or pure numbers)
  if (!rawName || rawName.length < 3) return false;
  if (!hasAlphabeticChars(rawName)) return false; // Rejects "1", "2", "123", "---", etc.
  if (/^(tot\.?\s*clientes|totales?|total|clientes?|aval(?:es)?|abona|semana|fecha|vence|ejecutivo|supervisor|plaza|grupo)$/i.test(rawName)) {
    return false;
  }

  // Count valid data points:
  // 1. Name is valid -> 1 data point
  let validDataPoints = 1;

  // 2. Phone: valid 10-digit or at least 7-digit phone number
  const phoneDigits = (client.phone || '').replace(/\D/g, '');
  const hasValidPhone = phoneDigits.length >= 7 && phoneDigits.length <= 13;
  if (hasValidPhone) {
    validDataPoints++;
  }

  // 3. Domicilio (Address / Colonia)
  const rawAddress = (client.address || '').trim();
  const rawNeighborhood = (client.neighborhood || '').trim();

  const isValidAddress = rawAddress.length >= 4 &&
    hasAlphabeticChars(rawAddress) &&
    !/^(tot\.?|0\.00|n\/?a|ningun[oa]|sin\s*direccion|[0-9]+)$/i.test(rawAddress);

  const isValidNeighborhood = rawNeighborhood.length >= 3 &&
    hasAlphabeticChars(rawNeighborhood) &&
    !/^(tot\.?|0\.00|n\/?a|ningun[oa]|sin\s*colonia|[0-9]+)$/i.test(rawNeighborhood);

  const hasDomicilio = isValidAddress || isValidNeighborhood;
  if (hasDomicilio) {
    validDataPoints++;
  }

  // Minimum 2 data points required!
  // E.g.:
  // Name + Phone = 2 -> true (Aplica)
  // Name + Domicilio = 2 -> true (Aplica)
  // Name + Domicilio + Phone = 3 -> true (Aplica)
  // Only Name (no domicilio, no phone) = 1 -> false (No aplica)
  // Pure number like 1 = 0 -> false (No aplica)
  return validDataPoints >= 2;
};

/**
 * Local Deterministic Parser based on Presta layout:
 * - Header extraction: Fecha, Vence, Ejecutivo, Plaza, Supervisor, Cantidad, Grupo
 * - Table extraction:
 *   Left column (CLIENTE): [NOMBRE, DIRECCION, COLONIA, TELEFONO]
 *   Right column (AVAL): [NOMBRE, DIRECCION, COLONIA, TELEFONO]
 */
export const parsePrestaWeeklySheetLocally = (
  pages: TextItemWithCoords[][],
  fullText: string,
  fileName: string
): {
  groupName: string;
  executive?: string;
  supervisor?: string;
  plaza?: string;
  loanDate?: string;
  dueDate?: string;
  amount?: string | number;
  clients: WeeklySheetExtractedClient[];
} => {
  // 1. Header parsing via Regex over fullText
  let loanDate = '';
  let dueDate = '';
  let executive = '';
  let plaza = '';
  let supervisor = '';
  let amount = '';
  let groupName = cleanFileNameToGroupName(fileName);

  // Fecha
  const fechaMatch = fullText.match(/Fecha\s*[:\s]?\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i);
  if (fechaMatch) loanDate = fechaMatch[1];

  // Vence
  const venceMatch = fullText.match(/Vence\s*[:\s]?\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i);
  if (venceMatch) dueDate = venceMatch[1];

  // Ejecutivo
  const execMatch = fullText.match(/Ejecutivo\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?=\s*Plaza|\s*Vence|\s*Supervisor|\s*Cantidad|\s*Grupo|\r|\n|$)/i);
  if (execMatch && execMatch[1].trim()) {
    executive = execMatch[1].trim();
  }

  // Plaza
  const plazaMatch = fullText.match(/Plaza\s*([A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s]+?)(?=\s*Supervisor|\s*Cantidad|\s*Grupo|\s*Vence|\r|\n|$)/i);
  if (plazaMatch && plazaMatch[1].trim()) {
    plaza = plazaMatch[1].trim();
  }

  // Supervisor
  const supMatch = fullText.match(/Supervisor\s*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?=\s*Cantidad|\s*Grupo|\r|\n|$)/i);
  if (supMatch && supMatch[1].trim()) {
    supervisor = supMatch[1].trim();
  }

  // Cantidad
  const cantMatch = fullText.match(/Cantidad\s*[:\s]?\s*(\$?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i);
  if (cantMatch) {
    amount = cantMatch[1];
  }

  // Grupo
  const grupoMatch = fullText.match(/Grupo\s*[:\s]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s\-]+?)(?=\s*CLIENTE|\s*Abona|\s*AVAL|\r|\n|$)/i);
  if (grupoMatch && grupoMatch[1].trim()) {
    groupName = grupoMatch[1].trim();
  }

  // 2. Table parsing using item coordinates per page
  const extractedClients: WeeklySheetExtractedClient[] = [];

  for (const pageItems of pages) {
    // Sort items by vertical position top-to-bottom (PDF y is inverted, larger y is higher up)
    // and left-to-right (x ascending)
    const sorted = [...pageItems].sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 3) return yDiff; // Different lines
      return a.x - b.x;
    });

    // Locate CLIENTE and AVAL headers and find table bottom (TOT. CLIENTES / TOTALES)
    let clienteHeaderY = -1;
    let clienteHeaderX = -1;
    let avalHeaderX = -1;
    let tableBottomY = 60;

    for (const it of sorted) {
      if (/^CLIENTE$/i.test(it.str)) {
        clienteHeaderY = it.y;
        clienteHeaderX = it.x;
      }
      if (/^AVAL$/i.test(it.str)) {
        avalHeaderX = it.x;
      }
      // Detect footer/summary row to exclude totals and number counts below it
      if (/^(TOTALES|TOT\.\s*CLIENTES)$/i.test(it.str)) {
        tableBottomY = Math.max(tableBottomY, it.y + 2);
      }
    }

    // Default column boundaries if headers not explicitly located
    const leftColMaxX = avalHeaderX > 0 ? (clienteHeaderX + (avalHeaderX - clienteHeaderX) * 0.42) : 230;
    const rightColMinX = avalHeaderX > 0 ? (avalHeaderX - 30) : 380;
    const tableTopY = clienteHeaderY > 0 ? clienteHeaderY - 5 : 700;

    // Filter items strictly inside the client rows area (between header and totals footer)
    const tableItems = sorted.filter(it => it.y < tableTopY && it.y > tableBottomY);

    // Group items into Left (CLIENTE), Middle (Abona), and Right (AVAL)
    const clientItems = tableItems.filter(it => it.x < leftColMaxX && !isTableNoise(it.str));
    const avalItems = tableItems.filter(it => it.x >= rightColMinX && !isTableNoise(it.str));
    const middleItems = tableItems.filter(it => it.x >= leftColMaxX && it.x < rightColMinX);

    // Try to detect weekly payment (Abona)
    let weeklyPayment = '';
    const abonaCandidate = middleItems.find(it => /^[0-9]{1,4}(?:\.[0-9]{2})?$/.test(it.str) && parseFloat(it.str) > 0);
    if (abonaCandidate) {
      weeklyPayment = abonaCandidate.str;
    }

    // Parse CLIENTE blocks
    // In Presta, each client has 4 lines:
    // Line 1: NOMBRE
    // Line 2: DIRECCION
    // Line 3: COLONIA
    // Line 4: TELEFONO (10 digits)
    const clientBlocks = parseFourLineBlocks(clientItems);
    const avalBlocks = parseFourLineBlocks(avalItems);

    // Combine client blocks with corresponding aval blocks
    const maxEntries = Math.max(clientBlocks.length, avalBlocks.length);
    for (let i = 0; i < maxEntries; i++) {
      const cBlock = clientBlocks[i] || { name: '', address: '', neighborhood: '', phone: '' };
      const aBlock = avalBlocks[i] || { name: '', address: '', neighborhood: '', phone: '' };

      const candidate = {
        name: cBlock.name,
        address: cBlock.address,
        neighborhood: cBlock.neighborhood,
        phone: cleanPhoneNumber(cBlock.phone),
        guarantorName: aBlock.name,
        guarantorAddress: aBlock.address,
        guarantorNeighborhood: aBlock.neighborhood,
        guarantorPhone: cleanPhoneNumber(aBlock.phone),
      };

      // Apply condition: client must have at least 2 valid data points (Name + Phone, Name + Domicilio, etc.)
      if (isValidClientCandidate(candidate)) {
        extractedClients.push({
          id: `c_${Date.now()}_${extractedClients.length}_${Math.random().toString(36).substring(2, 6)}`,
          name: candidate.name,
          address: candidate.address,
          neighborhood: candidate.neighborhood,
          phone: candidate.phone,
          guarantorName: candidate.guarantorName,
          guarantorAddress: candidate.guarantorAddress,
          guarantorNeighborhood: candidate.guarantorNeighborhood,
          guarantorPhone: candidate.guarantorPhone,
          amount,
          weeklyPayment,
          loanDate,
          dueDate,
          isSelected: false
        });
      }
    }
  }

  return {
    groupName,
    executive,
    supervisor,
    plaza,
    loanDate,
    dueDate,
    amount,
    clients: extractedClients
  };
};

/**
 * Groups lines into 4-line blocks:
 * 1: NOMBRE
 * 2: DIRECCIÓN
 * 3: COLONIA
 * 4: TELÉFONO (10 dígitos)
 */
const parseFourLineBlocks = (items: TextItemWithCoords[]): Array<{
  name: string;
  address: string;
  neighborhood: string;
  phone: string;
}> => {
  const blocks: Array<{ name: string; address: string; neighborhood: string; phone: string }> = [];

  // Group items by line (similar y coordinate)
  const lines: string[] = [];
  let currentLine = '';
  let lastY = -999;

  for (const it of items) {
    if (lastY === -999 || Math.abs(it.y - lastY) <= 4) {
      currentLine = currentLine ? `${currentLine} ${it.str}` : it.str;
    } else {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = it.str;
    }
    lastY = it.y;
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  // Filter out any summary lines or lone number noise
  const cleanLines = lines.filter(l => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (/^(TOT\.?\s*CLIENTES.*|TOTALES?.*|CLIENTE|AVAL|Abona|0\.00)$/i.test(trimmed)) return false;
    if (/^[0-9]{1,3}$/.test(trimmed)) return false; // single number noise like '1'
    return true;
  });

  // Detect blocks based on phone numbers (10 digits) as delimiters
  let buffer: string[] = [];
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const isPhone = /^[0-9]{10}$/.test(line.replace(/\D/g, ''));

    buffer.push(line);

    if (isPhone || buffer.length >= 4) {
      if (buffer.length === 4) {
        blocks.push({
          name: buffer[0],
          address: buffer[1],
          neighborhood: buffer[2],
          phone: cleanPhoneNumber(buffer[3])
        });
      } else if (buffer.length === 3) {
        // In case address and neighborhood were on the same line or phone was line 3
        if (isPhone) {
          blocks.push({
            name: buffer[0],
            address: buffer[1],
            neighborhood: '',
            phone: cleanPhoneNumber(buffer[2])
          });
        }
      } else if (buffer.length > 4) {
        // More than 4 lines: name is first, phone is last, middle lines form address & neighborhood
        const phone = isPhone ? cleanPhoneNumber(buffer[buffer.length - 1]) : '';
        const name = buffer[0];
        const address = buffer[1];
        const neighborhood = buffer.slice(2, isPhone ? buffer.length - 1 : buffer.length).join(' ');
        blocks.push({ name, address, neighborhood, phone });
      }
      buffer = [];
    }
  }

  // If items remain without phone
  if (buffer.length >= 1) {
    blocks.push({
      name: buffer[0] || '',
      address: buffer[1] || '',
      neighborhood: buffer[2] || '',
      phone: buffer[3] ? cleanPhoneNumber(buffer[3]) : ''
    });
  }

  return blocks;
};

/**
 * Main parser entrypoint for an individual PDF file
 */
export const processWeeklySheetPdf = async (
  file: File, 
  useAiIfAvailable: boolean = true
): Promise<WeeklySheetGroup> => {
  // 1. Try Gemini AI first if requested
  if (useAiIfAvailable) {
    const aiResult = await parsePdfWithGemini(file);
    if (aiResult && aiResult.clients.length > 0) {
      return {
        id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName: file.name,
        groupName: aiResult.groupName || cleanFileNameToGroupName(file.name),
        executive: aiResult.executive,
        supervisor: aiResult.supervisor,
        plaza: aiResult.plaza,
        loanDate: aiResult.loanDate,
        dueDate: aiResult.dueDate,
        amount: aiResult.amount,
        clients: aiResult.clients,
        selectedCount: 0
      };
    }
  }

  // 2. Extract text and coordinates locally via pdfjs-dist
  const { fullText, pages } = await extractPdfItemsWithCoords(file);
  const localResult = parsePrestaWeeklySheetLocally(pages, fullText, file.name);

  return {
    id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    fileName: file.name,
    groupName: localResult.groupName,
    executive: localResult.executive,
    supervisor: localResult.supervisor,
    plaza: localResult.plaza,
    loanDate: localResult.loanDate,
    dueDate: localResult.dueDate,
    amount: localResult.amount,
    clients: localResult.clients,
    selectedCount: 0
  };
};

/**
 * Balanced selection algorithm across uploaded groups
 */
export const distributeAndSelectClients = (
  groups: WeeklySheetGroup[],
  targetTotal: number = 5
): WeeklySheetGroup[] => {
  if (groups.length === 0) return [];

  // Reset all selections first
  const newGroups = groups.map(g => ({
    ...g,
    clients: g.clients.map(c => ({ ...c, isSelected: false })),
    selectedCount: 0
  }));

  const numGroups = newGroups.length;
  const baseQuota = Math.floor(targetTotal / numGroups);
  let remainder = targetTotal % numGroups;

  const quotas: number[] = new Array(numGroups).fill(baseQuota);
  
  const groupIndices = Array.from({ length: numGroups }, (_, i) => i);
  for (let i = groupIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [groupIndices[i], groupIndices[j]] = [groupIndices[j], groupIndices[i]];
  }
  for (let i = 0; i < remainder; i++) {
    quotas[groupIndices[i]] += 1;
  }

  let unassignedQuota = 0;
  for (let i = 0; i < numGroups; i++) {
    const available = newGroups[i].clients.length;
    if (quotas[i] > available) {
      unassignedQuota += (quotas[i] - available);
      quotas[i] = available;
    }
  }

  if (unassignedQuota > 0) {
    for (let i = 0; i < numGroups && unassignedQuota > 0; i++) {
      const available = newGroups[i].clients.length;
      const canTake = available - quotas[i];
      if (canTake > 0) {
        const take = Math.min(canTake, unassignedQuota);
        quotas[i] += take;
        unassignedQuota -= take;
      }
    }
  }

  for (let gIdx = 0; gIdx < numGroups; gIdx++) {
    const group = newGroups[gIdx];
    const quota = quotas[gIdx];
    if (quota <= 0 || group.clients.length === 0) continue;

    const clientIndices = Array.from({ length: group.clients.length }, (_, i) => i);
    for (let i = clientIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clientIndices[i], clientIndices[j]] = [clientIndices[j], clientIndices[i]];
    }

    const selectedIndices = new Set(clientIndices.slice(0, quota));
    group.clients = group.clients.map((c, idx) => ({
      ...c,
      isSelected: selectedIndices.has(idx)
    }));
    group.selectedCount = quota;
  }

  return newGroups;
};
