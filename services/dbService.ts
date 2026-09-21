
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where, 
  limit, 
  Timestamp, 
  getDoc, 
  setDoc, 
  writeBatch, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData, 
  onSnapshot, 
  Query, 
  increment 
} from "firebase/firestore";
import { 
  ref, 
  uploadString, 
  getDownloadURL 
} from "firebase/storage";
import { db, storage } from "../firebase";
import { Employee, Expense, Task, TaskStatus, AppSettings, GeneratedImage, Plaza, Fallo, VacationRequest, Office, EmployeeContract } from "../types";
import { uploadToImgBB } from "./imgbbService";


// --- HELPERS ---

/**
 * Uploads a base64 string to Firebase Storage and returns the public download URL.
 * This is MUCH faster for loading than storing base64 in Firestore documents.
 */
const uploadBase64ToStorage = async (base64: string, path: string): Promise<string> => {
  try {
    // If it's already a URL, don't re-upload
    if (base64.startsWith('http')) return base64;
    
    const storageRef = ref(storage, path);
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Storage upload timeout')), 45000)
    );

    // uploadString handles base64 easily
    const uploadPromise = uploadString(storageRef, base64, 'data_url');
    
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    // If it's a timeout or error, we still need to return something.
    // If we return the base64, Firestore might reject it if it's too big (>1MB),
    // but at least it won't hang forever.
    return base64; 
  }
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToEmployees = (callback: (employees: Employee[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "employees"), orderBy("lastName"));
  return onSnapshot(q, (snapshot) => {
    const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    callback(employees);
  }, onError);
};

export const subscribeToPlazas = (callback: (plazas: Plaza[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "plazas"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const plazas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plaza));
    callback(plazas);
  }, onError);
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "tasks"), orderBy("dueDate"));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    callback(tasks);
  }, onError);
};

export const subscribeToAppSettings = (callback: (settings: AppSettings) => void, onError: (error: any) => void) => {
  const docRef = doc(db, "settings", "global_config");
  return onSnapshot(docRef, (docSnap) => {
    const DEFINITIVE_KEY = import.meta.env.VITE_GEMINI_API_KEY || "PLACEHOLDER_GEMINI_KEY";
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        companyName: data.companyName || '',
        companyLogoUrl: data.companyLogoUrl || '',
        companyRfc: data.companyRfc || '',
        companyAddress: data.companyAddress || '',
        companyPhone: data.companyPhone || '',
        showCompanyInfoOnCredential: data.showCompanyInfoOnCredential ?? false,
        mascotaName: data.mascotaName || 'Mascota',
        mascotaUrl: data.mascotaUrl || '',
        googleApiKey: data.googleApiKey || DEFINITIVE_KEY,
        imgbbApiKey: data.imgbbApiKey || '',
        appVersion: data.appVersion || '1.0.0',
        appStatusColor: data.appStatusColor || '#10B981',
        menuOrder: data.menuOrder || ['tablero', 'personal', 'autos', 'gastos', 'tareas', 'pagares', 'formatos', 'fallos', 'mascota', 'imprenta', 'ajustes'],
        mobileNavSections: data.mobileNavSections || ['tablero', 'personal', 'gastos', 'tareas'],
        birthdayPrompt: data.birthdayPrompt || '',
        birthdayVideoPrompt: data.birthdayVideoPrompt || '',
        birthdayWhatsAppTemplate: data.birthdayWhatsAppTemplate || '',
        imprentaUrl: data.imprentaUrl || '',
        multiOfficeEnabled: data.multiOfficeEnabled ?? false
      });
    } else {
      // If it doesn't exist, feed defaults so app doesn't hang
      const defaults = {
        companyName: 'Mi Oficina',
        companyLogoUrl: '',
        companyRfc: '',
        companyAddress: '',
        companyPhone: '',
        showCompanyInfoOnCredential: false,
        mascotaName: 'Mascota',
        mascotaUrl: '',
        googleApiKey: DEFINITIVE_KEY,
        imgbbApiKey: '',
        appVersion: '1.0.0',
        appStatusColor: '#10B981',
        menuOrder: ['tablero', 'personal', 'autos', 'gastos', 'tareas', 'pagares', 'formatos', 'fallos', 'mascota', 'imprenta', 'ajustes'],
        mobileNavSections: ['tablero', 'personal', 'gastos', 'tareas'],
        birthdayPrompt: '',
        birthdayVideoPrompt: '',
        birthdayWhatsAppTemplate: '',
        imprentaUrl: '',
        multiOfficeEnabled: false
      };
      callback(defaults);
      
      // Attempt to auto-create global config document
      setDoc(docRef, defaults).catch(e => {
        console.warn("Could not auto-create global_config document:", e);
      });
    }
  }, onError);
};

export const subscribeToDashboardExpenses = (startDate: string, endDate: string, callback: (expenses: Expense[]) => void, onError: (error: any) => void) => {
  const q = query(
    collection(db, "expenses"), 
    where("date", ">=", startDate), 
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    callback(expenses);
  }, onError);
};

export const subscribeToAllExpenses = (callback: (expenses: Expense[]) => void, onError: (error: any) => void, limitCount: number = 100) => {
  const q = limitCount > 0 
    ? query(collection(db, "expenses"), orderBy("date", "desc"), limit(limitCount))
    : query(collection(db, "expenses"), orderBy("date", "desc"));
    
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    callback(expenses);
  }, onError);
};

export const subscribeToAllFallos = (callback: (fallos: Fallo[]) => void, onError: (error: any) => void, limitCount: number = 100, startDate?: string) => {
  let q: Query<DocumentData>;
  const fallosRef = collection(db, "fallos");
  
  if (startDate) {
    q = query(fallosRef, where("date", ">=", startDate), orderBy("date", "desc"));
  } else if (limitCount > 0) {
    q = query(fallosRef, orderBy("date", "desc"), limit(limitCount));
  } else {
    q = query(fallosRef, orderBy("date", "desc"));
  }

  return onSnapshot(q, (snapshot) => {
    const fallos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fallo));
    callback(fallos);
  }, onError);
};

// -------------------------------

const compressBase64 = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    // 10s timeout for compression safety
    const timeout = setTimeout(() => resolve(base64), 10000);

    if (!base64 || base64.length < 500000) {
      clearTimeout(timeout);
      resolve(base64);
      return;
    }
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024; 
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(base64);
    };
  });
};

export const verifyAccessCode = async (code: string): Promise<Employee | null> => {
  if (code === '0120') {
    return {
      id: 'admin_master',
      firstName: 'Cristobal Ramon',
      lastName: 'Moran Buenrostro',
      email: 'admin@oficina.com',
      position: 'Director General',
      plaza: 'Dirección', 
      category: 'Ejecutivos',
      birthDate: new Date().toISOString(),
      hireDate: new Date().toISOString(),
      phone: '',
      accessCode: '0120'
    };
  }
  try {
    // 1. Try checking if this is a registered Office code (for Multi-Office)
    const officeQuery = query(collection(db, "offices"), where("code", "==", code.toUpperCase().trim()), limit(1));
    const officeSnapshot = await getDocs(officeQuery);
    if (!officeSnapshot.empty) {
      const docSnap = officeSnapshot.docs[0];
      const data = docSnap.data() as Office;
      return {
        id: `office_${docSnap.id}`,
        firstName: data.name,
        lastName: 'Sucursal',
        email: '',
        position: 'Oficina',
        plaza: data.name,
        category: 'Oficina' as any,
        birthDate: new Date().toISOString(),
        hireDate: new Date().toISOString(),
        phone: '',
        accessCode: data.code,
        isOfficeUser: true,
        officeId: docSnap.id
      } as Employee;
    }

    // 2. Try checking standard employees
    const q = query(collection(db, "employees"), where("accessCode", "==", code), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Employee;
    }
  } catch (error) {
    console.error("Error verifying code:", error);
  }
  return null;
};

export const getEmployees = async (): Promise<Employee[]> => {
  const q = query(collection(db, "employees"), orderBy("lastName"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
};

/**
 * Genera un código único de 8 dígitos numéricos para credencial oficial
 */
export const generateUniqueCredentialCode = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Obtiene el folio numérico de 8 dígitos de un colaborador.
 * Si ya tiene uno asignado, lo retorna. Si no, calcula uno determinista y consistente.
 */
export const getEmployeeCredentialCode = (employee: Employee): string => {
  if (employee.credentialCode && /^\d{8}$/.test(employee.credentialCode)) {
    return employee.credentialCode;
  }
  const source = employee.id || employee.curp || `${employee.firstName}${employee.lastName}`;
  let hash = 0;
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) % 100000000;
  }
  const num = 10000000 + Math.abs(hash % 90000000);
  return num.toString();
};

export const getEmployeeById = async (idOrCode: string): Promise<Employee | null> => {
  if (!idOrCode) return null;
  const cleanTerm = idOrCode.trim();

  try {
    // 1. Buscar por ID de documento directo
    const employeeRef = doc(db, "employees", cleanTerm);
    const docSnap = await getDoc(employeeRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Employee;
    }

    // 2. Si es un folio numérico de 8 dígitos o código, buscar por campo "credentialCode"
    const q = query(collection(db, "employees"), where("credentialCode", "==", cleanTerm));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const foundDoc = querySnap.docs[0];
      return { id: foundDoc.id, ...foundDoc.data() } as Employee;
    }

    // 3. Fallback: Buscar entre todos los colaboradores si coincide con su código determinista de 8 dígitos
    const allSnap = await getDocs(collection(db, "employees"));
    for (const d of allSnap.docs) {
      const emp = { id: d.id, ...d.data() } as Employee;
      if (getEmployeeCredentialCode(emp) === cleanTerm) {
        return emp;
      }
    }
  } catch (error) {
    console.error("Error fetching employee by id or credential code:", error);
  }
  return null;
};

export const addEmployee = async (employee: Omit<Employee, 'id'>) => {
  const credentialCode = employee.credentialCode || generateUniqueCredentialCode();
  return await addDoc(collection(db, "employees"), {
    ...employee,
    credentialCode
  });
};

export const updateEmployee = async (id: string, employee: Partial<Employee>) => {
  const employeeRef = doc(db, "employees", id);
  const { id: _, ...data } = employee as any; 
  return await updateDoc(employeeRef, data);
};

export const deleteEmployee = async (id: string) => {
  return await deleteDoc(doc(db, "employees", id));
};

export const incrementEmployeeCredentialViews = async (id: string): Promise<void> => {
  try {
    const employeeRef = doc(db, "employees", id);
    await updateDoc(employeeRef, {
      credentialViewsCount: increment(1),
      lastCredentialViewAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error incrementing credential views:", error);
  }
};

// --- BATCH OPERATIONS FOR IMPORT ---

export const deleteAllEmployees = async () => {
  const querySnapshot = await getDocs(collection(db, "employees"));
  // Firestore batches are limited to 500 ops. We must loop.
  const batchSize = 500;
  const chunks = [];
  const docs = querySnapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    chunks.push(docs.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
};

export const saveEmployeesBatch = async (employees: Omit<Employee, 'id'>[]) => {
  const batchSize = 500;
  const chunks = [];
  
  for (let i = 0; i < employees.length; i += batchSize) {
    chunks.push(employees.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(emp => {
      const docRef = doc(collection(db, "employees")); // Auto-ID
      const credentialCode = emp.credentialCode || generateUniqueCredentialCode();
      batch.set(docRef, {
        ...emp,
        credentialCode
      });
    });
    await batch.commit();
  }
};

// ------------------------------------

export const getPlazas = async (): Promise<Plaza[]> => {
  const q = query(collection(db, "plazas"), orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plaza));
};

export const addPlaza = async (name: string) => {
  return await addDoc(collection(db, "plazas"), { name });
};

export const deletePlaza = async (id: string) => {
  return await deleteDoc(doc(db, "plazas", id));
};

export const getExpenses = async (): Promise<Expense[]> => {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

export const addExpense = async (expense: Omit<Expense, 'id'>) => {
  let finalTicketImage = expense.ticketImage;
  if (expense.ticketImage && !expense.ticketImage.startsWith('http')) {
    const fileName = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    finalTicketImage = await uploadBase64ToStorage(expense.ticketImage, `expenses/${fileName}`);
  }
  return await addDoc(collection(db, "expenses"), { ...expense, ticketImage: finalTicketImage });
};

export const getExpensesByDateRange = async (startDate: string, endDate: string): Promise<Expense[]> => {
  const q = query(
    collection(db, "expenses"), 
    where("date", ">=", startDate), 
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

export const updateExpense = async (id: string, expense: Partial<Expense>) => {
  const expenseRef = doc(db, "expenses", id);
  const { id: _, ...data } = expense as any;
  return await updateDoc(expenseRef, data);
};

export const deleteExpense = async (id: string) => {
  return await deleteDoc(doc(db, "expenses", id));
};

export const getTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, "tasks"), orderBy("dueDate"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const addTask = async (task: Omit<Task, 'id'>) => {
  return await addDoc(collection(db, "tasks"), task);
};

export const updateTask = async (id: string, task: Partial<Task>) => {
  const taskRef = doc(db, "tasks", id);
  const { id: _, ...data } = task as any;
  return await updateDoc(taskRef, data);
};

export const updateTaskStatus = async (id: string, status: TaskStatus) => {
  const taskRef = doc(db, "tasks", id);
  return await updateDoc(taskRef, { status });
};

export const deleteTask = async (id: string) => {
  return await deleteDoc(doc(db, "tasks", id));
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const docRef = doc(db, "settings", "global_config");
    const docSnap = await getDoc(docRef);
    
    // Actualizada a la nueva llave
    const DEFINITIVE_KEY = import.meta.env.VITE_GEMINI_API_KEY || "PLACEHOLDER_GEMINI_KEY";

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        companyName: data.companyName || '',
        companyLogoUrl: data.companyLogoUrl || '',
        companyRfc: data.companyRfc || '',
        companyAddress: data.companyAddress || '',
        companyPhone: data.companyPhone || '',
        showCompanyInfoOnCredential: data.showCompanyInfoOnCredential ?? false,
        mascotaName: data.mascotaName || 'Mascota',
        mascotaUrl: data.mascotaUrl || '',
        googleApiKey: data.googleApiKey || DEFINITIVE_KEY,
        imgbbApiKey: data.imgbbApiKey || '',
        appVersion: data.appVersion || '1.0.0',
        appStatusColor: data.appStatusColor || '#10B981',
        birthdayPrompt: data.birthdayPrompt || '',
        birthdayVideoPrompt: data.birthdayVideoPrompt || '',
        birthdayWhatsAppTemplate: data.birthdayWhatsAppTemplate || '',
        imprentaUrl: data.imprentaUrl || '',
        multiOfficeEnabled: data.multiOfficeEnabled ?? false
      };
    } else {
      return {
        companyName: '',
        companyLogoUrl: '',
        companyRfc: '',
        companyAddress: '',
        companyPhone: '',
        showCompanyInfoOnCredential: false,
        mascotaName: 'Mascota',
        mascotaUrl: '',
        googleApiKey: DEFINITIVE_KEY,
        imgbbApiKey: '',
        appVersion: '1.0.0',
        appStatusColor: '#10B981',
        birthdayPrompt: '',
        birthdayVideoPrompt: '',
        birthdayWhatsAppTemplate: '',
        imprentaUrl: '',
        multiOfficeEnabled: false
      };
    }
  } catch (error) {
    console.error("Error fetching settings:", error);
    return { 
      companyName: '', 
      companyLogoUrl: '',
      companyRfc: '',
      companyAddress: '',
      companyPhone: '',
      showCompanyInfoOnCredential: false,
      mascotaName: 'Mascota', 
      mascotaUrl: '', 
      googleApiKey: import.meta.env.VITE_GEMINI_API_KEY || "PLACEHOLDER_GEMINI_KEY",
      imgbbApiKey: '',
      appVersion: '1.0.0',
      appStatusColor: '#10B981',
      birthdayPrompt: '',
      birthdayVideoPrompt: '',
      birthdayWhatsAppTemplate: '',
      imprentaUrl: '',
      multiOfficeEnabled: false
    };
  }
};

export const updateAppSettings = async (settings: AppSettings) => {
  const docRef = doc(db, "settings", "global_config");
  await setDoc(docRef, settings, { merge: true });
};

export const getGalleryImages = async (): Promise<GeneratedImage[]> => {
  const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(12));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedImage));
};

export const saveGalleryImage = async (image: Omit<GeneratedImage, 'id'>) => {
  const compressedUrl = await compressBase64(image.imageUrl);
  const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const storageUrl = await uploadBase64ToStorage(compressedUrl, `gallery/${fileName}`);
  return await addDoc(collection(db, "gallery"), { ...image, imageUrl: storageUrl });
};

export const deleteGalleryImage = async (id: string) => {
  return await deleteDoc(doc(db, "gallery", id));
};

import { getLocalDateString } from '../lib/dateUtils';

export const getDailyBirthdayCard = async (employeeId: string): Promise<{ imageUrl: string | null; videoUrl: string | null } | null> => {
  try {
    const today = getLocalDateString(); 
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        imageUrl: data.imageUrl || null,
        videoUrl: data.videoUrl || null
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const saveDailyBirthdayCard = async (employeeId: string, imageUrl: string) => {
  try {
    const today = getLocalDateString();
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    const compressedUrl = await compressBase64(imageUrl);
    const storageUrl = await uploadBase64ToStorage(compressedUrl, `birthdays/${docId}`);
    await setDoc(docRef, {
      imageUrl: storageUrl,
      employeeId,
      date: today,
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving daily birthday card", e);
  }
};

export const saveDailyBirthdayVideo = async (employeeId: string, videoUrl: string) => {
  try {
    const today = getLocalDateString();
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    
    // Upload video base64 data to Firebase Storage for fast loading
    const storageUrl = await uploadBase64ToStorage(videoUrl, `birthdays/${docId}_video`);
    await setDoc(docRef, {
      videoUrl: storageUrl,
      employeeId,
      date: today,
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving daily birthday video", e);
  }
};

export interface DailyBirthdayEvent {
  id: string;
  employeeId: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  date: string;
  createdAt: string;
}

export const getAllDailyBirthdayEvents = async (): Promise<DailyBirthdayEvent[]> => {
  try {
    const q = query(collection(db, "daily_events"), orderBy("createdAt", "desc"), limit(24));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyBirthdayEvent));
  } catch (e) {
    console.error("Error fetching daily birthday events", e);
    return [];
  }
};

// --- FALLOS / DOCUMENTOS ---

export const getFallos = async (): Promise<Fallo[]> => {
  const q = query(collection(db, "fallos"), orderBy("date", "desc"), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fallo));
};

// --- FALLOS MANAGEMENT ---

export const getBase64Fallos = async (): Promise<Fallo[]> => {
  const q = query(collection(db, "fallos"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Fallo))
    .filter(f => f.imageUrl && f.imageUrl.startsWith('data:'));
};

export const deleteBase64Fallos = async () => {
  const base64Fallos = await getBase64Fallos();
  const deletePromises = base64Fallos.map(f => deleteDoc(doc(db, "fallos", f.id)));
  return await Promise.all(deletePromises);
};

export const importFallos = async (fallos: Omit<Fallo, 'id'>[]) => {
  const addPromises = fallos.map(f => addFallo(f));
  return await Promise.all(addPromises);
};

export const addFallo = async (fallo: Omit<Fallo, 'id'>) => {
  // Check if image is already a URL or needs processing
  let imageToProcess = fallo.imageUrl;
  
  if (!imageToProcess.startsWith('http')) {
    imageToProcess = await compressBase64(fallo.imageUrl);
  } else {
    // If it's already an http link, just save it
    return await addDoc(collection(db, "fallos"), { ...fallo });
  }
  
  try {
    const settings = await getAppSettings();
    const customImgbbKey = settings.imgbbApiKey || undefined;
    
    // Upload to imgBB
    const imageUrl = await uploadToImgBB(imageToProcess, customImgbbKey);
    
    return await addDoc(collection(db, "fallos"), { 
      ...fallo, 
      imageUrl: imageUrl 
    });
  } catch (e: any) {
    console.error("imgBB upload failure, falling back to Firebase Storage:", e);
    
    // Fallback to Firebase Storage as secondary
    try {
      const fileName = `fallos/fallo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageUrl = await uploadBase64ToStorage(imageToProcess, fileName);
      
      return await addDoc(collection(db, "fallos"), { 
        ...fallo, 
        imageUrl: storageUrl 
      });
    } catch (fallbackError: any) {
      throw new Error(`Error al subir imagen: ${e.message}. El respaldo de Firebase también falló.`);
    }
  }
};

export const deleteFallo = async (id: string) => {
  return await deleteDoc(doc(db, "fallos", id));
};

// --- VEHICLES MANAGEMENT ---

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

export const subscribeToVehicles = (callback: (vehicles: Vehicle[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
    callback(vehicles);
  }, onError);
};

export const subscribeToVehicleAssignments = (callback: (assignments: VehicleAssignment[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "vehicle_assignments"), orderBy("assignedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const assignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VehicleAssignment));
    callback(assignments);
  }, onError);
};

export const subscribeToVehicleEvents = (callback: (events: VehicleEvent[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "vehicle_events"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VehicleEvent));
    callback(events);
  }, onError);
};

const cleanUndefined = (obj: any): any => {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
  return await addDoc(collection(db, "vehicles"), cleanUndefined({
    ...vehicle,
    createdAt: new Date().toISOString()
  }));
};

export const updateVehicle = async (id: string, vehicle: Partial<Vehicle>) => {
  const vehicleRef = doc(db, "vehicles", id);
  const { id: _, ...data } = vehicle as any;
  return await updateDoc(vehicleRef, cleanUndefined(data));
};

export const deleteVehicle = async (id: string) => {
  return await deleteDoc(doc(db, "vehicles", id));
};

export const addVehicleAssignment = async (assignment: Omit<VehicleAssignment, 'id'>) => {
  return await addDoc(collection(db, "vehicle_assignments"), assignment);
};

export const addVehicleEvent = async (event: Omit<VehicleEvent, 'id' | 'createdAt'>) => {
  return await addDoc(collection(db, "vehicle_events"), {
    ...event,
    createdAt: new Date().toISOString()
  });
};

export const deleteVehicleEvent = async (id: string) => {
  return await deleteDoc(doc(db, "vehicle_events", id));
};

// --- VACATIONS CONTROL ---

export const subscribeToVacationRequests = (callback: (requests: VacationRequest[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "vacation_requests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VacationRequest));
    callback(requests);
  }, onError);
};

export const addVacationRequest = async (request: Omit<VacationRequest, 'id' | 'createdAt'>) => {
  return await addDoc(collection(db, "vacation_requests"), {
    ...request,
    createdAt: new Date().toISOString()
  });
};

export const updateVacationRequest = async (id: string, request: Partial<VacationRequest>) => {
  const requestRef = doc(db, "vacation_requests", id);
  const { id: _, ...data } = request as any;
  return await updateDoc(requestRef, cleanUndefined(data));
};

export const deleteVacationRequest = async (id: string) => {
  return await deleteDoc(doc(db, "vacation_requests", id));
};

// --- MULTI-OFFICE METHODS ---

export const subscribeToOffices = (callback: (offices: Office[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "offices"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const offices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Office));
    callback(offices);
  }, onError);
};

export const addOffice = async (office: Omit<Office, 'id' | 'createdAt'>) => {
  return await addDoc(collection(db, "offices"), {
    ...office,
    createdAt: new Date().toISOString()
  });
};

export const updateOffice = async (id: string, office: Partial<Omit<Office, 'id' | 'createdAt'>>) => {
  const officeRef = doc(db, "offices", id);
  return await updateDoc(officeRef, office);
};

export const deleteOffice = async (id: string) => {
  return await deleteDoc(doc(db, "offices", id));
};

// --- CUSTOM EXPENSE CATEGORIES ---

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt?: string;
}

export const subscribeToExpenseCategories = (callback: (categories: ExpenseCategory[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "expense_categories"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
    callback(categories);
  }, onError);
};

export const addExpenseCategory = async (name: string) => {
  return await addDoc(collection(db, "expense_categories"), {
    name,
    createdAt: new Date().toISOString()
  });
};

export const deleteExpenseCategory = async (id: string) => {
  return await deleteDoc(doc(db, "expense_categories", id));
};

// --- EMPLOYEE CONTRACTS HISTORY ---

export const subscribeToEmployeeContracts = (callback: (contracts: EmployeeContract[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, "employee_contracts"), orderBy("generatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmployeeContract));
    callback(contracts);
  }, onError || ((err) => console.error("Error subscribing to employee contracts:", err)));
};

export const addEmployeeContract = async (contract: Omit<EmployeeContract, 'id'>) => {
  const genTime = contract.generatedAt || new Date().toISOString();
  const docRef = await addDoc(collection(db, "employee_contracts"), {
    ...contract,
    generatedAt: genTime
  });

  // Automatically update the employee's profile with contract dates
  try {
    const empRef = doc(db, "employees", contract.employeeId);
    await updateDoc(empRef, {
      contractStartDate: contract.startDate,
      contractEndDate: contract.endDate,
      lastContractId: docRef.id,
      lastContractGeneratedAt: genTime,
      position: contract.position || undefined,
      ...(contract.salaryNum ? { salary: contract.salaryNum } : {})
    });
  } catch (err) {
    console.error("Error updating employee with contract dates:", err);
  }

  return docRef;
};

export const deleteEmployeeContract = async (id: string) => {
  return await deleteDoc(doc(db, "employee_contracts", id));
};

// --- CONTRACT TYPES CLOUD CONFIGURATION ---

export const subscribeToContractTypes = (callback: (types: any[]) => void, onError?: (error: any) => void) => {
  const docRef = doc(db, "settings", "contract_types_config");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data?.contractTypes) && data.contractTypes.length > 0) {
        callback(data.contractTypes);
        return;
      }
    }
    callback([]);
  }, onError || ((err) => console.error("Error subscribing to contract types:", err)));
};

export const saveContractTypesToCloud = async (contractTypes: any[]) => {
  try {
    const docRef = doc(db, "settings", "contract_types_config");
    await setDoc(docRef, {
      contractTypes,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Error saving contract types to cloud:", err);
    throw err;
  }
};

// --- DOCUMENT FORMATS CLOUD CONFIGURATION ---

export const subscribeToDocumentFormats = (callback: (formats: any[]) => void, onError?: (error: any) => void) => {
  const docRef = doc(db, "settings", "document_formats_config");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data?.documentFormats) && data.documentFormats.length > 0) {
        callback(data.documentFormats);
        return;
      }
    }
    callback([]);
  }, onError || ((err) => console.error("Error subscribing to document formats:", err)));
};

export const saveDocumentFormatsToCloud = async (documentFormats: any[]) => {
  try {
    const docRef = doc(db, "settings", "document_formats_config");
    await setDoc(docRef, {
      documentFormats,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error("Error saving document formats to cloud:", err);
    throw err;
  }
};

// --- GENERATED DOCUMENTS HISTORY ---

export const subscribeToGeneratedDocuments = (callback: (docs: any[]) => void, onError?: (error: any) => void) => {
  const q = query(collection(db, "generated_documents"), orderBy("generatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(docs);
  }, onError || ((err) => console.error("Error subscribing to generated documents:", err)));
};

export const saveGeneratedDocument = async (docRecord: any) => {
  try {
    const colRef = collection(db, "generated_documents");
    const docRef = await addDoc(colRef, {
      ...docRecord,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (err) {
    console.error("Error saving generated document to cloud:", err);
    throw err;
  }
};

export const deleteGeneratedDocument = async (id: string) => {
  return await deleteDoc(doc(db, "generated_documents", id));
};


