import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CallRecord, CallQuestion } from '../types';

export interface GenerateCallSheetPdfOptions {
  record: CallRecord;
  companyName?: string;
  companyLogoUrl?: string;
  questions?: CallQuestion[];
}

export const generateCallSheetPdf = (options: GenerateCallSheetPdfOptions): jsPDF => {
  const { record, companyName = 'Mi Oficina', questions = [] } = options;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Title / Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(companyName.toUpperCase(), margin, 16);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('AUDITORÍA Y CONTROL DE CALIDAD - CALL CENTER', margin, 22);

  // Status Badge / Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateFormatted = record.callDate || new Date().toISOString().split('T')[0];
  doc.text(`Fecha de Registro: ${dateFormatted}`, pageWidth - margin, 16, { align: 'right' });
  
  const statusLabel = 
    record.status === 'EXITOSA' ? 'LLAMADA EXITOSA / APROBADA' :
    record.status === 'CON_OBSERVACIONES' ? 'CON OBSERVACIONES' :
    record.status === 'NO_CONTESTO' ? 'NO CONTESTÓ' :
    record.status === 'NUMERO_EQUIVOCADO' ? 'NÚMERO EQUIVOCADO' :
    record.status === 'VOLVER_A_LLAMAR' ? 'VOLVER A LLAMAR' : 'PENDIENTE';
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Estado: ${statusLabel}`, pageWidth - margin, 22, { align: 'right' });

  // Divider Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, 25, pageWidth - margin, 25);

  let currentY = 28;

  // Header Table (Matching the user's paper format exactly!)
  // Row 1: QUIEN LLAMÓ
  // Row 2: EJECUTIVO
  // Row 3: SUPERVISORA
  // Row 4: GRUPO
  // Row 5: CLIENTE
  // Row 6: FECHA DE PRESTAMO | [Fecha] | TEL: | [Tel]
  const clientAddressFull = [record.clientAddress, record.clientNeighborhood].filter(Boolean).join(', ');
  const avalFull = [record.guarantorName, record.guarantorAddress, record.guarantorNeighborhood].filter(Boolean).join(' | ');

  const headerBody = [
    [
      { content: 'QUIEN LLAMÓ:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { content: record.callerName || 'No especificado', colSpan: 3 }
    ],
    [
      { content: 'EJECUTIVO:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { content: record.executive || 'Sin asignar', colSpan: 3 }
    ],
    [
      { content: 'SUPERVISORA:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { content: record.supervisor || 'Sin asignar', colSpan: 3 }
    ],
    [
      { content: 'GRUPO:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { content: `${record.groupName || 'General'}${record.plaza ? `  (PLAZA: ${record.plaza})` : ''}`, colSpan: 3 }
    ],
    [
      { content: 'CLIENTE:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { 
        content: record.clientName + (clientAddressFull ? `\nDir: ${clientAddressFull}` : ''), 
        colSpan: 3, 
        styles: { fontStyle: 'bold' as const, textColor: [15, 23, 42] as [number, number, number] } 
      }
    ],
    [
      { content: 'FECHA DE PRESTAMO', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { content: record.loanDate || 'N/D', styles: { cellWidth: 46 } },
      { content: 'TEL:', styles: { fontStyle: 'bold' as const, fillColor: [226, 232, 240] as [number, number, number], cellWidth: 20 } },
      { content: record.phone || 'Sin número', styles: { fontStyle: 'bold' as const } }
    ]
  ];

  // If Aval exists, add Aval row
  if (record.guarantorName || record.guarantorPhone) {
    headerBody.push([
      { content: 'AVAL Y TELÉFONO:', styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], cellWidth: 46 } },
      { 
        content: `${avalFull || 'Sin datos'}${record.guarantorPhone ? `  (TEL: ${record.guarantorPhone})` : ''}`, 
        colSpan: 3 
      }
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: headerBody as any,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: 2.8,
      lineColor: [100, 116, 139],
      lineWidth: 0.35,
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Questions Table (Exact questions from image)
  const answers = record.answers || {};
  const questionsBody: any[] = [];

  // Standard Question 1
  questionsBody.push([
    { content: '¿Le explicaron las condiciones de su crédito?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: answers.conditionsExplained || 'Pendiente' }
  ]);

  // Standard Question 2
  questionsBody.push([
    { content: '¿Usted recibió directamente el dinero?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: answers.moneyReceivedDirectly || 'Pendiente' }
  ]);

  // Standard Question 3
  const confirmedAmt = answers.confirmedAmount 
    ? answers.confirmedAmount 
    : (record.loanAmount ? `$${record.loanAmount}` : 'Pendiente');
  questionsBody.push([
    { content: '¿De cuánto fue su crédito?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: confirmedAmt }
  ]);

  // Standard Question 4
  questionsBody.push([
    { content: '¿Le comentaron qué día debe realizar su pago?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: answers.paymentDayInformed || 'Pendiente' }
  ]);

  // Standard Question 5
  questionsBody.push([
    { content: '¿Le supervisaron?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: answers.wasSupervised || 'Pendiente' }
  ]);

  // Standard Question 6
  questionsBody.push([
    { content: '¿Quién lo supervisó?', styles: { fontStyle: 'bold', cellWidth: 105 } },
    { content: answers.supervisorName || 'Pendiente' }
  ]);

  // Additional custom questions if configured
  if (questions && questions.length > 0) {
    questions.filter(q => !q.isDefault && q.isActive).forEach(q => {
      const customAns = answers.customAnswers?.[q.id] || 'Pendiente';
      questionsBody.push([
        { content: q.question, styles: { fontStyle: 'bold', cellWidth: 105 } },
        { content: customAns }
      ]);
    });
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: questionsBody,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: 3,
      lineColor: [100, 116, 139],
      lineWidth: 0.35,
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Observations Section (Exact section from bottom of paper sheet)
  const obsBody = [
    [
      { 
        content: 'OBSERVACIONES:\n\n' + (record.observations || 'Sin observaciones registradas.'),
        styles: { 
          minCellHeight: 35,
          fontStyle: 'normal' as const,
          textColor: [30, 41, 59] as [number, number, number]
        } 
      }
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: obsBody as any,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: 3.5,
      lineColor: [100, 116, 139],
      lineWidth: 0.35,
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Signature lines
  const sigColWidth = 55;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigColWidth - 15;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(sig1X, currentY + 15, sig1X + sigColWidth, currentY + 15);
  doc.line(sig2X, currentY + 15, sig2X + sigColWidth, currentY + 15);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Firma de Quien Llamó', sig1X + (sigColWidth / 2), currentY + 20, { align: 'center' });
  doc.text('Validación / Control de Calidad', sig2X + (sigColWidth / 2), currentY + 20, { align: 'center' });

  // Footer note
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento generado el ${new Date().toLocaleString('es-MX')} | Folio ID: ${record.id.substring(0, 10)}`, margin, pageWidth > 220 ? 265 : 260);

  return doc;
};

export const downloadCallSheetPdf = (options: GenerateCallSheetPdfOptions) => {
  const doc = generateCallSheetPdf(options);
  const clientClean = (options.record.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = options.record.callDate || new Date().toISOString().split('T')[0];
  doc.save(`Llamada_Calidad_${clientClean}_${dateStr}.pdf`);
};
