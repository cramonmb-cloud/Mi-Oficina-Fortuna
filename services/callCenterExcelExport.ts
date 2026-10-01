import * as XLSX from 'xlsx';
import { CallRecord, CallQuestion } from '../types';

export const exportCallRecordsToExcel = (
  records: CallRecord[], 
  questions: CallQuestion[] = [],
  fileNamePrefix: string = 'Historial_Call_Center'
) => {
  if (records.length === 0) {
    alert('No hay registros de llamadas para exportar.');
    return;
  }

  const data = records.map((r, idx) => {
    const row: Record<string, any> = {
      '#': idx + 1,
      'Fecha Llamada': r.callDate || r.createdAt?.split('T')[0] || '',
      'Hora': r.callTime || '',
      'Estado': r.status,
      'Quien Llamó': r.callerName || '',
      'Cliente': r.clientName,
      'Dirección Cliente': r.clientAddress || '',
      'Colonia Cliente': r.clientNeighborhood || '',
      'Teléfono': r.phone,
      'Grupo': r.groupName || '',
      'Plaza': r.plaza || '',
      'Ejecutivo': r.executive || '',
      'Supervisora': r.supervisor || '',
      'Fecha Préstamo': r.loanDate || '',
      'Vence': r.dueDate || '',
      'Cantidad / Monto': r.loanAmount || '',
      'Abona Semanal': r.weeklyPayment || '',
      'Nombre Aval': r.guarantorName || '',
      'Dirección Aval': r.guarantorAddress || '',
      'Colonia Aval': r.guarantorNeighborhood || '',
      'Teléfono Aval': r.guarantorPhone || '',
      // Question responses
      '¿Explicaron condiciones?': r.answers?.conditionsExplained || '',
      '¿Recibió dinero directo?': r.answers?.moneyReceivedDirectly || '',
      '¿De cuánto fue su crédito? (Cliente)': r.answers?.confirmedAmount || '',
      '¿Comentaron día de pago?': r.answers?.paymentDayInformed || '',
      '¿Le supervisaron?': r.answers?.wasSupervised || '',
      '¿Quién lo supervisó?': r.answers?.supervisorName || '',
    };

    // Add any custom questions
    questions.filter(q => !q.isDefault && q.isActive).forEach(q => {
      row[q.question] = r.answers?.customAnswers?.[q.id] || '';
    });

    row['Observaciones'] = r.observations || '';
    row['Lote / Archivo Origen'] = r.sourcePdfName || '';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-fit column widths
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length + 3, 14)
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Llamadas Calidad');

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileNamePrefix}_${today}.xlsx`);
};
